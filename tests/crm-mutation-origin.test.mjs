import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__crmOrigin = { authCalls: 0, dbCalls: 0, originChecks: 0, prisma: {} };

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return {
        url: dataModule(`export class NextResponse { static json(body, init = {}) { return Response.json(body, init); } }`),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/auth") {
      return { url: dataModule(`export async function getCurrentUser() { globalThis.__crmOrigin.authCalls++; return { id: "owner", role: "USER" }; }`), shortCircuit: true };
    }
    if (specifier === "@/lib/observability") {
      return { url: dataModule(`export function reportOperationalFailure() {}`), shortCircuit: true };
    }
    if (specifier === "@/lib/authorization") {
      return {
        url: dataModule(`export function requireSameOriginApiRequest(request) {
          globalThis.__crmOrigin.originChecks++;
          const origin = request.headers.get("origin");
          return origin === new URL(request.url).origin ? null : Response.json({ success: false }, { status: 403, headers: { "Cache-Control": "no-store" } });
        }`),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/prisma") {
      return {
        url: dataModule(`const fail = async () => { globalThis.__crmOrigin.dbCalls++; throw new Error("Unexpected database access"); };
          export const prisma = new Proxy({}, { get(_target, key) {
            if (key in globalThis.__crmOrigin.prisma) return globalThis.__crmOrigin.prisma[key];
            return new Proxy({}, { get() { return fail; } });
          } });`),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/rate-limit") {
      return { url: dataModule(`export async function checkLeadCreationRateLimit() { throw new Error("Origin must be checked before rate limiting"); }`), shortCircuit: true };
    }
    if (specifier === "@/lib/lead-crm") {
      return { url: dataModule(`export const findLeadContactDuplicates = async () => []; export const lockLeadContacts = async () => {}; export const normalizeLeadEmail = (v) => v; export const normalizeLeadPhone = (v) => v; export const recalculateLeadScore = async () => {};`), shortCircuit: true };
    }
    if (specifier === "@/lib/lead-access") {
      return { url: dataModule(`export function leadPortfolioScope() { return {}; }`), shortCircuit: true };
    }
    if (specifier === "@/lib/consultations/availability") {
  return {
    url: dataModule(`
      export async function getAvailabilitySlots() {
        return [];
      }

      export function getZonedDayRange() {
        return {
          start: new Date("2026-01-01T00:00:00.000Z"),
          end: new Date("2026-01-02T00:00:00.000Z"),
        };
      }

      export function isValidIanaTimezone() {
        return true;
      }
    `),
    shortCircuit: true,
  };
}
    return nextResolve(specifier, context);
  },
});

const [leadDetail, leadCreate, consultation, consultationDetail, availability, types, notifications] = await Promise.all([
  import("../src/app/api/leads/[id]/route.ts"),
  import("../src/app/api/dashboard/leads/route.ts"),
  import("../src/app/api/consultation/route.ts"),
  import("../src/app/api/consultation/[id]/route.ts"),
  import("../src/app/api/consultations/availability/route.ts"),
  import("../src/app/api/consultations/types/route.ts"),
  import("../src/app/api/notifications/route.ts"),
]);

function reset() {
  globalThis.__crmOrigin = { authCalls: 0, dbCalls: 0, originChecks: 0, prisma: {} };
}

function request(path, method, body) {
  return new Request(`https://crispus.example${path}`, {
    method,
    headers: {
      origin: "https://attacker.example",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("lead and consultation mutations reject cross-origin requests before auth or database access", async () => {
  const cases = [
    () => leadDetail.PATCH(request("/api/leads/lead-1", "PATCH", { status: "LOST" }), { params: Promise.resolve({ id: "lead-1" }) }),
    () => leadDetail.POST(request("/api/leads/lead-1", "POST", { type: "NOTE", title: "Note" }), { params: Promise.resolve({ id: "lead-1" }) }),
    () => leadCreate.POST(request("/api/dashboard/leads", "POST", {})),
    () => consultation.POST(request("/api/consultation", "POST", {})),
    () => consultationDetail.PATCH(request("/api/consultation/id-1", "PATCH", { status: "CANCELLED" }), { params: Promise.resolve({ id: "id-1" }) }),
  ];

  for (const invoke of cases) {
    reset();
    const response = await invoke();
    assert.equal(response.status, 403);
    assert.equal(globalThis.__crmOrigin.authCalls, 0);
    assert.equal(globalThis.__crmOrigin.dbCalls, 0);
  }
});

test("consultation status endpoint does not mark a booking rescheduled without the rescheduling workflow", async () => {
  reset();
  let updates = 0;
  globalThis.__crmOrigin.prisma.$transaction = async (operation) => operation({
    consultation: {
      async findFirst() {
        globalThis.__crmOrigin.dbCalls++;
        return {
          id: "consultation-1",
          leadId: "lead-1",
          status: "PENDING",
          cancellationReason: null,
          title: "Intro call",
          scheduledAt: new Date("2026-12-01T09:00:00.000Z"),
        };
      },
      async update() {
        updates++;
        throw new Error("A reschedule must not change status only");
      },
    },
  });

  const response = await consultationDetail.PATCH(
    new Request("https://crispus.example/api/consultation/consultation-1", {
      method: "PATCH",
      headers: { origin: "https://crispus.example", "content-type": "application/json" },
      body: JSON.stringify({ status: "RESCHEDULED" }),
    }),
    { params: Promise.resolve({ id: "consultation-1" }) },
  );

  assert.equal(response.status, 409);
  assert.equal(updates, 0);
});

test("availability, consultation-type and notification mutations reject cross-origin requests before auth or data access", async () => {
  const cases = [
    () => availability.POST(request("/api/consultations/availability", "POST", {})),
    () => availability.PUT(request("/api/consultations/availability", "PUT", {})),
    () => availability.DELETE(request("/api/consultations/availability?id=x", "DELETE")),
    () => types.POST(request("/api/consultations/types", "POST", {})),
    () => types.PUT(request("/api/consultations/types", "PUT", {})),
    () => types.DELETE(request("/api/consultations/types?id=x", "DELETE")),
    () => notifications.PATCH(request("/api/notifications", "PATCH", { action: "mark-all-read" })),
  ];

  for (const invoke of cases) {
    reset();
    const response = await invoke();
    assert.equal(response.status, 403);
    assert.equal(globalThis.__crmOrigin.authCalls, 0);
    assert.equal(globalThis.__crmOrigin.dbCalls, 0);
  }
});
