import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__publicIntake = {
  actions: [],
  dbCalls: 0,
  result: { limited: true, retryAfter: 60, unavailable: false },
  portfolio: null,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return {
        url: dataModule(`export const NextResponse = { json(body, init = {}) { return Response.json(body, init); } };`),
        shortCircuit: true,
      };
    }
    if (specifier === "resend") {
      return { url: dataModule("export class Resend { constructor() { throw new Error('Email provider must not be constructed in this test'); } }"), shortCircuit: true };
    }
    if (specifier === "@/lib/observability") {
      return { url: dataModule(`export function reportOperationalFailure() {}`), shortCircuit: true };
    }
    if (specifier === "@/lib/rate-limit") {
      return {
        url: dataModule(`export async function checkPublicIntakeRateLimit(_request, action) {
          globalThis.__publicIntake.actions.push(action);
          return globalThis.__publicIntake.result;
        }`),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/prisma") {
      return {
        url: dataModule(`const state = () => globalThis.__publicIntake;
          const fail = async () => { state().dbCalls++; throw new Error('Unexpected database operation'); };
          export const prisma = {
            portfolioSite: { async findUnique() { state().dbCalls++; return state().portfolio; } },
            async $transaction(operation) {
              state().dbCalls++;
              return operation({
                lead: {
                  async create() { state().dbCalls++; return { id: "lead-private-id" }; },
                  async findUnique() { state().dbCalls++; return { id: "lead-private-id", name: "Private Person", status: "NEW", temperature: "COLD", score: 97 }; },
                },
                leadActivity: { async create() { state().dbCalls++; return { id: "activity-1" }; } },
              });
            },
            notification: { async create() { state().dbCalls++; return { id: "notification-1" }; } },
          };`),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/lead-crm") {
      return { url: dataModule(`export const findLeadContactDuplicates = async () => []; export const lockLeadContacts = async () => {}; export const normalizeLeadEmail = (v) => v; export const normalizeLeadPhone = (v) => v; export const recalculateLeadScore = async () => {};`), shortCircuit: true };
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

const { POST: submitLead } = await import("../src/app/api/leads/route.ts");
const { POST: bookConsultation } = await import("../src/app/api/consultations/book/route.ts");

test("public lead intake rate limits before reading or writing the database", async () => {
  globalThis.__publicIntake = { actions: [], dbCalls: 0, result: { limited: true, retryAfter: 60, unavailable: false } };
  const response = await submitLead(new Request("https://crispus.example/api/leads", { method: "POST" }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(globalThis.__publicIntake.actions, ["lead"]);
  assert.equal(globalThis.__publicIntake.dbCalls, 0);
});

test("public consultation booking rate limits before reading or writing the database", async () => {
  globalThis.__publicIntake = { actions: [], dbCalls: 0, result: { limited: true, retryAfter: 60, unavailable: false } };
  const response = await bookConsultation(new Request("https://crispus.example/api/consultations/book", { method: "POST" }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(globalThis.__publicIntake.actions, ["consultation"]);
  assert.equal(globalThis.__publicIntake.dbCalls, 0);
});

test("public lead intake fails closed when its rate-limit service is unavailable", async () => {
  globalThis.__publicIntake = { actions: [], dbCalls: 0, result: { limited: false, retryAfter: 0, unavailable: true } };
  const response = await submitLead(new Request("https://crispus.example/api/leads", { method: "POST" }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(globalThis.__publicIntake.dbCalls, 0);
});

test("public consultation booking fails closed when its rate-limit service is unavailable", async () => {
  globalThis.__publicIntake = { actions: [], dbCalls: 0, result: { limited: false, retryAfter: 0, unavailable: true } };
  const response = await bookConsultation(new Request("https://crispus.example/api/consultations/book", { method: "POST" }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(globalThis.__publicIntake.dbCalls, 0);
});

test("public lead submission confirms receipt without exposing internal CRM lead fields", async () => {
  globalThis.__publicIntake = {
    actions: [],
    dbCalls: 0,
    result: { limited: false, retryAfter: 0, unavailable: false },
    portfolio: { id: "portfolio-1", userId: "owner-1", published: true, user: { email: null, name: "Owner" } },
  };
  const response = await submitLead(new Request("https://crispus.example/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ portfolioSlug: "owner", name: "Private Person", email: "person@example.test", message: "Private enquiry" }),
  }));
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.deepEqual(payload, { success: true, message: "Your request has been received successfully." });
  assert.equal("lead" in payload, false);
});
