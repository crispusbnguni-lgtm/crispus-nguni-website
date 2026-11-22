
import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) =>
  `data:text/javascript,${encodeURIComponent(source)}`;

function createCurrent(overrides = {}) {
  return {
    id: "consultation-1",
    leadId: "lead-1",
    status: "PENDING",
    cancellationReason: null,
    title: "Intro consultation",
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    durationMinutes: 30,
    ...overrides,
  };
}

globalThis.__consultationLifecycle = {
  current: createCurrent(),
  activities: [],
  leadActivities: [],
  existingMeeting: false,
  forceConflict: false,
  scoreCalls: 0,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return {
        url: dataModule(`
          export class NextResponse {
            static json(body, init = {}) {
              return Response.json(body, init);
            }
          }
        `),
        shortCircuit: true,
      };
    }

    if (specifier === "@prisma/client") {
      return {
        url: dataModule(`
          export const ConsultationStatus = {
            PENDING: "PENDING",
            CONFIRMED: "CONFIRMED",
            COMPLETED: "COMPLETED",
            CANCELLED: "CANCELLED",
            NO_SHOW: "NO_SHOW",
            RESCHEDULED: "RESCHEDULED",
          };
        `),
        shortCircuit: true,
      };
    }

    if (specifier === "@/lib/auth") {
      return {
        url: dataModule(`
          export async function getCurrentUser() {
            return { id: "owner", role: "USER" };
          }
        `),
        shortCircuit: true,
      };
    }

    if (specifier === "@/lib/authorization") {
      return {
        url: dataModule(`
          export function requireSameOriginApiRequest(request) {
            return request.headers.get("origin") === new URL(request.url).origin
              ? null
              : Response.json({ success: false }, { status: 403 });
          }
        `),
        shortCircuit: true,
      };
    }

    if (specifier === "@/lib/lead-crm") {
      return {
        url: dataModule(`
          export async function recalculateLeadScore() {
            globalThis.__consultationLifecycle.scoreCalls++;
          }
        `),
        shortCircuit: true,
      };
    }

    if (specifier === "@/lib/prisma") {
      return {
        url: dataModule(`
          const state = () => globalThis.__consultationLifecycle;

          const tx = {
            consultation: {
              async findFirst() {
                return state().current;
              },

              async updateMany({ where, data }) {
                if (
                  state().forceConflict ||
                  state().current.status !== where.status
                ) {
                  return { count: 0 };
                }

                Object.assign(state().current, data);
                return { count: 1 };
              },
            },

            consultationActivity: {
              async create({ data }) {
                state().activities.push(data);
                return data;
              },
            },

            leadActivity: {
              async findFirst() {
                return state().existingMeeting
                  ? { id: "existing-meeting" }
                  : null;
              },

              async create({ data }) {
                state().leadActivities.push(data);
                return data;
              },
            },
          };

          export const prisma = {
            async $transaction(operation) {
              return operation(tx);
            },

            consultation: {
              async findFirst() {
                return {
                  ...state().current,
                  lead: {
                    id: "lead-1",
                    name: "Test Lead",
                    email: null,
                    phone: null,
                  },
                  portfolio: {
                    id: "portfolio-1",
                    name: "Test Portfolio",
                    slug: "test",
                    userId: "owner",
                  },
                  consultationType: {},
                  activities: state().activities,
                };
              },
            },
          };
        `),
        shortCircuit: true,
      };
    }

    return nextResolve(specifier, context);
  },
});

const route = await import("../src/app/api/consultation/[id]/route.ts");

function reset(overrides = {}) {
  globalThis.__consultationLifecycle = {
    current: createCurrent(),
    activities: [],
    leadActivities: [],
    existingMeeting: false,
    forceConflict: false,
    scoreCalls: 0,
    ...overrides,
  };
}

async function patch(status, extra = {}) {
  const request = new Request(
    "https://crispus.example/api/consultation/consultation-1",
    {
      method: "PATCH",
      headers: {
        origin: "https://crispus.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ status, ...extra }),
    },
  );

  return route.PATCH(request, {
    params: Promise.resolve({ id: "consultation-1" }),
  });
}

test("PENDING can transition to CONFIRMED and records confirmation activity", async () => {
  reset();

  const response = await patch("CONFIRMED");
  const body = await response.json();
  const state = globalThis.__consultationLifecycle;

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(state.current.status, "CONFIRMED");
  assert.ok(state.current.confirmedAt instanceof Date);
  assert.equal(state.activities.length, 1);
  assert.equal(state.scoreCalls, 1);
});

test("PENDING cannot transition directly to COMPLETED", async () => {
  reset();

  const response = await patch("COMPLETED");
  const body = await response.json();
  const state = globalThis.__consultationLifecycle;

  assert.equal(response.status, 409);
  assert.match(body.message, /transition is not permitted/i);
  assert.equal(state.current.status, "PENDING");
  assert.equal(state.activities.length, 0);
  assert.equal(state.scoreCalls, 0);
});

test("NO_SHOW is rejected before the scheduled end time", async () => {
  reset({
    current: createCurrent({
      status: "CONFIRMED",
      scheduledAt: new Date(Date.now() - 10 * 60 * 1000),
      durationMinutes: 30,
    }),
  });

  const response = await patch("NO_SHOW");
  const body = await response.json();
  const state = globalThis.__consultationLifecycle;

  assert.equal(response.status, 409);
  assert.match(body.message, /after its scheduled end time/i);
  assert.equal(state.current.status, "CONFIRMED");
  assert.equal(state.activities.length, 0);
  assert.equal(state.scoreCalls, 0);
});

test("CONFIRMED can transition to NO_SHOW after its scheduled end", async () => {
  reset({
    current: createCurrent({
      status: "CONFIRMED",
      scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
      durationMinutes: 30,
    }),
  });

  const response = await patch("NO_SHOW");
  const state = globalThis.__consultationLifecycle;

  assert.equal(response.status, 200);
  assert.equal(state.current.status, "NO_SHOW");
  assert.equal(state.activities.length, 1);
  assert.equal(
    state.activities[0].title,
    "Consultation marked as no-show",
  );
  assert.equal(state.scoreCalls, 1);
});

test("cancellation requires a non-empty reason", async () => {
  reset();

  const response = await patch("CANCELLED");
  const body = await response.json();
  const state = globalThis.__consultationLifecycle;

  assert.equal(response.status, 400);
  assert.match(body.message, /cancellation reason is required/i);
  assert.equal(state.current.status, "PENDING");
  assert.equal(state.activities.length, 0);
});

test("CONFIRMED can be cancelled without erasing its confirmation timestamp", async () => {
  const confirmedAt = new Date("2026-11-10T08:00:00.000Z");

  reset({
    current: createCurrent({
      status: "CONFIRMED",
      confirmedAt,
    }),
  });

  const response = await patch("CANCELLED", {
    cancellationReason: "Client requested cancellation.",
  });

  const state = globalThis.__consultationLifecycle;

  assert.equal(response.status, 200);
  assert.equal(state.current.status, "CANCELLED");
  assert.equal(state.current.confirmedAt, confirmedAt);
  assert.ok(state.current.cancelledAt instanceof Date);
  assert.equal(
    state.current.cancellationReason,
    "Client requested cancellation.",
  );
});

test("terminal consultation statuses cannot be reopened", async () => {
  for (const terminalStatus of [
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
    "RESCHEDULED",
  ]) {
    reset({
      current: createCurrent({ status: terminalStatus }),
    });

    const response = await patch("CONFIRMED");
    const state = globalThis.__consultationLifecycle;

    assert.equal(response.status, 409, terminalStatus);
    assert.equal(state.current.status, terminalStatus);
    assert.equal(state.activities.length, 0);
    assert.equal(state.scoreCalls, 0);
  }
});

test("RESCHEDULED cannot be assigned through the ordinary status endpoint", async () => {
  reset();

  const response = await patch("RESCHEDULED");
  const state = globalThis.__consultationLifecycle;

  assert.equal(response.status, 409);
  assert.equal(state.current.status, "PENDING");
  assert.equal(state.activities.length, 0);
});

test("a concurrent status change is rejected without creating activities", async () => {
  reset({ forceConflict: true });

  const response = await patch("CONFIRMED");
  const body = await response.json();
  const state = globalThis.__consultationLifecycle;

  assert.equal(response.status, 409);
  assert.match(body.message, /updated by another request/i);
  assert.equal(state.activities.length, 0);
  assert.equal(state.scoreCalls, 0);
});

test("completing a consultation does not duplicate an existing linked meeting", async () => {
  reset({
    current: createCurrent({
      status: "CONFIRMED",
      scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
    }),
    existingMeeting: true,
  });

  const response = await patch("COMPLETED");
  const state = globalThis.__consultationLifecycle;

  assert.equal(response.status, 200);
  assert.equal(state.current.status, "COMPLETED");
  assert.equal(state.activities.length, 1);
  assert.equal(state.leadActivities.length, 0);
  assert.equal(state.scoreCalls, 1);
});

test("completing a consultation creates one linked lead meeting when missing", async () => {
  reset({
    current: createCurrent({
      status: "CONFIRMED",
      scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
    }),
  });

  const response = await patch("COMPLETED");
  const state = globalThis.__consultationLifecycle;

  assert.equal(response.status, 200);
  assert.equal(state.current.status, "COMPLETED");
  assert.equal(state.leadActivities.length, 1);
  assert.equal(
    state.leadActivities[0].metadata.consultationId,
    "consultation-1",
  );
});
