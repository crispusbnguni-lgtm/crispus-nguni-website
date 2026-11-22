
import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const SLOT = "2026-11-20T10:00:00.000Z";

const dataModule = (source) =>
  `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__bookingConcurrency = {};

function resetState(overrides = {}) {
  globalThis.__bookingConcurrency = {
    portfolios: {
      owner: {
        id: "portfolio-1",
        userId: "owner-1",
        published: true,
        timezone: "Africa/Nairobi",
        timezoneReviewRequired: false,
        user: { email: null },
      },
    },
    typeActive: true,
    bookings: [],
    lockTails: new Map(),
    lockCalls: 0,
    activeLocks: 0,
    maximumActiveLocks: 0,
    failNextCreate: false,
    ...overrides,
  };
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return {
        url: dataModule(`
          export const NextResponse = {
            json(body, init = {}) {
              return Response.json(body, init);
            },
          };
        `),
        shortCircuit: true,
      };
    }

    if (specifier === "resend") {
      return {
        url: dataModule(`
          export class Resend {
            constructor() {
              this.emails = {
                async send() {
                  return { error: null };
                },
              };
            }
          }
        `),
        shortCircuit: true,
      };
    }

    if (specifier === "@/lib/observability") {
      return {
        url: dataModule(`
          export function reportOperationalFailure() {}
        `),
        shortCircuit: true,
      };
    }

    if (specifier === "@/lib/rate-limit") {
      return {
        url: dataModule(`
          export async function checkPublicIntakeRateLimit() {
            return {
              limited: false,
              retryAfter: 0,
              unavailable: false,
            };
          }
        `),
        shortCircuit: true,
      };
    }

    if (specifier === "@/lib/consultations/availability") {
      return {
        url: dataModule(`
          export function getZonedDayRange() {
            return {
              startDate: new Date("2026-11-20T00:00:00.000Z"),
              endDate: new Date("2026-11-21T00:00:00.000Z"),
            };
          }

          export function isValidIanaTimezone() {
            return true;
          }

          export async function getAvailabilitySlots({
            portfolioId,
          }) {
            const state = globalThis.__bookingConcurrency;

            const alreadyBooked = state.bookings.some(
              (booking) =>
                booking.portfolioId === portfolioId &&
                booking.scheduledAt === "${SLOT}",
            );

            if (alreadyBooked) {
              return [];
            }

            return [{
              start: new Date("${SLOT}"),
              end: new Date("2026-11-20T10:30:00.000Z"),
              timezone: "Africa/Nairobi",
            }];
          }
        `),
        shortCircuit: true,
      };
    }

    if (specifier === "@/lib/lead-crm") {
      return {
        url: dataModule(`
          export async function findLeadContactDuplicates() {
            return [];
          }

          export async function lockLeadContacts() {}

          export function normalizeLeadEmail(value) {
            return value.trim().toLowerCase();
          }

          export function normalizeLeadPhone(value) {
            return value.trim();
          }

          export async function recalculateLeadScore() {}
        `),
        shortCircuit: true,
      };
    }

    if (specifier === "@/lib/prisma") {
      return {
        url: dataModule(`
          const state = () => globalThis.__bookingConcurrency;

          async function acquireLock(key) {
            const current = state();
            const previous =
              current.lockTails.get(key) ?? Promise.resolve();

            let releaseGate;

            const gate = new Promise((resolve) => {
              releaseGate = resolve;
            });

            const tail = previous.then(() => gate);
            current.lockTails.set(key, tail);

            await previous;

            current.activeLocks += 1;
            current.maximumActiveLocks = Math.max(
              current.maximumActiveLocks,
              current.activeLocks,
            );

            return () => {
              current.activeLocks -= 1;
              releaseGate();

              if (current.lockTails.get(key) === tail) {
                current.lockTails.delete(key);
              }
            };
          }

          function createTransactionClient() {
            return {
              async $queryRaw(strings, ...values) {
                const current = state();
                current.lockCalls += 1;

                const key = String(values[0]);
                return acquireLock(key);
              },

              consultationType: {
                async findFirst() {
                  if (!state().typeActive) {
                    return null;
                  }

                  return {
                    id: "type-1",
                    title: "Initial Consultation",
                    durationMinutes: 30,
                    meetingMethod: "ONLINE",
                  };
                },
              },

              lead: {
                async create({ data }) {
                  return {
                    id: "lead-1",
                    name: data.name,
                  };
                },
              },

              consultation: {
                async create({ data }) {
                  const current = state();

                  if (current.failNextCreate) {
                    current.failNextCreate = false;
                    throw new Error("Simulated consultation write failure");
                  }

                  current.bookings.push({
                    portfolioId: data.portfolioId,
                    scheduledAt: data.scheduledAt.toISOString(),
                  });

                  return {
                    id: "consultation-1",
                    title: data.title,
                    status: data.status,
                    scheduledAt: data.scheduledAt,
                    timezone: data.timezone,
                    durationMinutes: data.durationMinutes,
                  };
                },
              },

              leadActivity: {
                async create() {
                  return { id: "lead-activity-1" };
                },
              },

              consultationActivity: {
                async create() {
                  return { id: "consultation-activity-1" };
                },
              },
            };
          }

          export const prisma = {
            portfolioSite: {
              async findUnique({ where }) {
                return state().portfolios[where.slug] ?? null;
              },
            },

            async $transaction(callback) {
              const current = state();
              const initialBookingCount = current.bookings.length;
              let releaseLock;

              const tx = createTransactionClient();

              const originalQueryRaw = tx.$queryRaw;

              tx.$queryRaw = async (strings, ...values) => {
                releaseLock = await originalQueryRaw(strings, ...values);
                return [];
              };

              try {
                return await callback(tx);
              } catch (error) {
                current.bookings.length = initialBookingCount;
                throw error;
              } finally {
                releaseLock?.();
              }
            },

            notification: {
              async create() {
                return { id: "notification-1" };
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

const { POST: bookConsultation } = await import(
  "../src/app/api/consultations/book/route.ts"
);

function makeRequest(overrides = {}) {
  return new Request(
    "https://crispus.example/api/consultations/book",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        portfolioSlug: "owner",
        consultationTypeId: "type-1",
        scheduledAt: SLOT,
        fullName: "Test Person",
        email: "person@example.test",
        phone: "+254700000001",
        reason: "Concurrency test",
        ...overrides,
      }),
    },
  );
}

test("simultaneous requests for the same slot produce only one booking", async () => {
  resetState();

  const responses = await Promise.all([
    bookConsultation(makeRequest()),
    bookConsultation(makeRequest()),
  ]);

  const statuses = responses
    .map((response) => response.status)
    .sort((a, b) => a - b);

  assert.deepEqual(statuses, [201, 409]);

  const payloads = await Promise.all(
    responses.map((response) => response.json()),
  );

  const conflict = payloads.find(
    (payload) => payload.code === "SLOT_UNAVAILABLE",
  );

  assert.ok(conflict, "The losing request should report SLOT_UNAVAILABLE");

  const state = globalThis.__bookingConcurrency;

  assert.equal(state.bookings.length, 1);
  assert.equal(state.lockCalls, 2);
  assert.equal(state.maximumActiveLocks, 1);
});

test("a failed booking transaction releases its lock for the next request", async () => {
  resetState({ failNextCreate: true });

  const failedResponse = await bookConsultation(makeRequest());

  assert.equal(failedResponse.status, 500);
  assert.equal(
    globalThis.__bookingConcurrency.bookings.length,
    0,
  );

  const successfulResponse = await bookConsultation(makeRequest());

  assert.equal(successfulResponse.status, 201);
  assert.equal(
    globalThis.__bookingConcurrency.bookings.length,
    1,
  );

  assert.equal(
    globalThis.__bookingConcurrency.activeLocks,
    0,
  );
});
