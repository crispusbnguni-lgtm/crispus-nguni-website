import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: dataModule("export {};"), shortCircuit: true };
    }
    if (specifier === "@/lib/prisma") {
      return { url: dataModule("export const prisma = {};"), shortCircuit: true };
    }
    if (specifier.startsWith("@/lib/")) {
      return { url: new URL(`../src/lib/${specifier.slice("@/lib/".length)}.ts`, import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { getPersonalWorkspaceOverview } = await import("../src/lib/personal-workspace-overview.ts");

test("overview scopes all appointment and follow-up reads to the verified user's own portfolio", async () => {
  const calls = [];
  const client = {
    personalWorkspace: { findUnique: async (args) => { calls.push(["workspace", args]); return null; } },
    portfolioSite: { findUnique: async (args) => { calls.push(["portfolio", args]); return { id: "portfolio-a", name: "A's portfolio" }; } },
    consultation: { findMany: async (args) => { calls.push(["consultation", args]); return []; }, count: async (args) => { calls.push(["consultationCount", args]); return 0; } },
    lead: { findMany: async (args) => { calls.push(["lead", args]); return []; }, count: async (args) => { calls.push(["leadCount", args]); return 0; } },
  };
  const result = await getPersonalWorkspaceOverview("user-a", new Date("2026-11-16T08:00:00.000Z"), client);

  assert.equal(result.portfolioName, "A's portfolio");
  assert.deepEqual(calls.find(([name]) => name === "workspace")[1].where, { userId: "user-a" });
  assert.deepEqual(calls.find(([name]) => name === "portfolio")[1].where, { userId: "user-a" });
  assert.equal(calls.find(([name]) => name === "consultation")[1].where.portfolioId, "portfolio-a");
  assert.equal(calls.find(([name]) => name === "lead")[1].where.portfolioId, "portfolio-a");
  assert.deepEqual(calls.find(([name]) => name === "consultation")[1].where.status.in, ["PENDING", "CONFIRMED"]);
  assert.deepEqual(calls.find(([name]) => name === "lead")[1].where.status.notIn, ["CONVERTED", "LOST"]);
});

test("without an owned portfolio the overview does not query another person's records", async () => {
  const calls = [];
  const client = {
    personalWorkspace: { findUnique: async (args) => { calls.push(["workspace", args]); return null; } },
    portfolioSite: { findUnique: async (args) => { calls.push(["portfolio", args]); return null; } },
    consultation: { findMany: async () => { calls.push(["consultation"]); return []; }, count: async () => { calls.push(["consultationCount"]); return 0; } },
    lead: { findMany: async () => { calls.push(["lead"]); return []; }, count: async () => { calls.push(["leadCount"]); return 0; } },
  };
  const result = await getPersonalWorkspaceOverview("user-without-portfolio", new Date("2026-11-16T08:00:00.000Z"), client);
  assert.equal(result.portfolioName, null);
  assert.equal(result.appointments.length, 0);
  assert.equal(result.followUps.length, 0);
  assert.equal(calls.some(([name]) => name === "consultation" || name === "lead"), false);
});

test("agenda bounds reads to the selected local timezone and does not return lead contact details", async () => {
  const calls = [];
  const client = {
    personalWorkspace: { findUnique: async () => ({ mode: "CUSTOM", focusAreas: [], timezone: "Pacific/Auckland", workingHoursStart: "09:00", workingHoursEnd: "17:00", breakMinutes: 15, weekStartsOn: 1, onboardingCompletedAt: null, updatedAt: new Date() }) },
    portfolioSite: { findUnique: async () => ({ id: "portfolio-owner", name: "Workspace" }) },
    consultation: { findMany: async (args) => { calls.push(["consultation", args]); return []; }, count: async (args) => { calls.push(["consultationCount", args]); return 0; } },
    lead: { findMany: async (args) => { calls.push(["lead", args]); return []; }, count: async (args) => { calls.push(["leadCount", args]); return 0; } },
  };
  const result = await getPersonalWorkspaceOverview("user-a", new Date("2026-11-16T08:00:00.000Z"), client);
  assert.equal(result.timezone, "Pacific/Auckland");
  const leadQuery = calls.find(([name]) => name === "lead")[1];
  assert.deepEqual(Object.keys(leadQuery.select).sort(), ["id", "name", "nextFollowUpAt", "status", "temperature"].sort());
  assert.equal("email" in leadQuery.select, false);
  assert.equal("phone" in leadQuery.select, false);
});
