import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

globalThis.__workspaceApi = {
  user: { id: "user-a", role: "USER" },
  workspace: null,
  calls: [],
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return { url: dataModule(`export const NextResponse = { json: (body, init) => Response.json(body, init) };`), shortCircuit: true };
    }
    if (specifier === "@/lib/auth") {
      return { url: dataModule(`export async function getCurrentUser() { return globalThis.__workspaceApi.user; }`), shortCircuit: true };
    }
    if (specifier === "@/lib/authorization") {
      return { url: dataModule(`export function requireSameOriginApiRequest(request) { return request.headers.get("origin") === new URL(request.url).origin ? null : Response.json({ success: false }, { status: 403 }); }`), shortCircuit: true };
    }
    if (specifier === "@/lib/prisma") {
      return {
        url: dataModule(`
          const state = () => globalThis.__workspaceApi;
          export const prisma = {
            personalWorkspace: {
              async findUnique(args) {
                state().calls.push({ op: "findUnique", args });
                return state().workspace && state().workspace.userId === args.where.userId
                  ? { ...state().workspace }
                  : null;
              },
              async create({ data }) {
                state().calls.push({ op: "create", data });
                if (state().workspace) { const error = new Error("unique"); error.code = "P2002"; throw error; }
                state().workspace = { ...data, revision: 0, createdAt: new Date(), updatedAt: new Date() };
                return state().workspace;
              },
              async updateMany({ where, data }) {
                state().calls.push({ op: "updateMany", where, data });
                if (!state().workspace || state().workspace.userId !== where.userId || state().workspace.revision !== where.revision) return { count: 0 };
                const revision = state().workspace.revision + data.revision.increment;
                state().workspace = { ...state().workspace, ...data, revision, updatedAt: new Date(Date.now() + revision) };
                delete state().workspace.revision.increment;
                return { count: 1 };
              },
            },
          };
        `),
        shortCircuit: true,
      };
    }
    if (specifier.startsWith("@/lib/")) {
      const relative = specifier.slice("@/lib/".length).replaceAll("/", "/");
      return { url: new URL(`../src/lib/${relative}.ts`, import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const route = await import("../src/app/api/dashboard/workspace/route.ts");

const preferences = {
  mode: "STUDENT",
  focusAreas: ["STUDY_AND_TIMETABLE", "TASKS_AND_PLANS"],
  timezone: "Africa/Nairobi",
  workingHoursStart: "08:00",
  workingHoursEnd: "17:30",
  breakMinutes: 15,
  weekStartsOn: 1,
};

function patchRequest(body, origin = "http://app.test") {
  return new Request("http://app.test/api/dashboard/workspace", {
    method: "PATCH",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function json(response) {
  return response.json();
}

test.beforeEach(() => {
  globalThis.__workspaceApi.user = { id: "user-a", role: "USER" };
  globalThis.__workspaceApi.workspace = null;
  globalThis.__workspaceApi.calls = [];
});

test("unauthenticated reads and writes do not touch workspace persistence", async () => {
  globalThis.__workspaceApi.user = null;
  assert.equal((await route.GET()).status, 401);
  assert.equal((await route.PATCH(patchRequest({ preferences, expectedRevision: null }))).status, 401);
  assert.equal(globalThis.__workspaceApi.calls.length, 0);
});

test("GET is scoped to the verified account and returns no identity selector", async () => {
  globalThis.__workspaceApi.workspace = { userId: "user-a", ...preferences, revision: 2, onboardingCompletedAt: new Date(), updatedAt: new Date("2026-01-01T00:00:00.000Z") };
  const response = await route.GET();
  const payload = await json(response);
  assert.equal(response.status, 200);
  assert.equal(globalThis.__workspaceApi.calls[0].args.where.userId, "user-a");
  assert.equal("userId" in payload, false);
  assert.equal(payload.revision, 2);
});

test("foreign identity fields and invalid preferences are rejected before writes", async () => {
  const response = await route.PATCH(patchRequest({ preferences, expectedRevision: null, userId: "user-b" }));
  assert.equal(response.status, 400);
  assert.equal(globalThis.__workspaceApi.calls.length, 0);

  const invalid = await route.PATCH(patchRequest({ preferences: { ...preferences, timezone: "fake/zone" }, expectedRevision: null }));
  assert.equal(invalid.status, 400);
  assert.equal(globalThis.__workspaceApi.calls.length, 0);
});

test("same-origin policy is required for preference mutation", async () => {
  const response = await route.PATCH(patchRequest({ preferences, expectedRevision: null }, "https://attacker.test"));
  assert.equal(response.status, 403);
  assert.equal(globalThis.__workspaceApi.calls.length, 0);
});

test("preference creation binds the row to the authenticated user", async () => {
  const response = await route.PATCH(patchRequest({ preferences, expectedRevision: null }));
  const payload = await json(response);
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(globalThis.__workspaceApi.workspace.userId, "user-a");
  assert.equal(globalThis.__workspaceApi.workspace.mode, "STUDENT");
  assert.equal(globalThis.__workspaceApi.workspace.revision, 0);
});

test("conditional revision update rejects a stale preference save", async () => {
  globalThis.__workspaceApi.workspace = { userId: "user-a", ...preferences, revision: 4, onboardingCompletedAt: new Date(), updatedAt: new Date() };
  const response = await route.PATCH(patchRequest({ preferences: { ...preferences, mode: "PERSONAL" }, expectedRevision: 3 }));
  assert.equal(response.status, 409);
  assert.equal(globalThis.__workspaceApi.workspace.mode, "STUDENT");
  assert.equal(globalThis.__workspaceApi.calls.some((call) => call.op === "updateMany"), false);
});

test("matching revision updates only the signed-in user's workspace", async () => {
  globalThis.__workspaceApi.workspace = { userId: "user-a", ...preferences, revision: 4, onboardingCompletedAt: new Date(), updatedAt: new Date() };
  const response = await route.PATCH(patchRequest({ preferences: { ...preferences, mode: "PERSONAL" }, expectedRevision: 4 }));
  assert.equal(response.status, 200);
  assert.equal(globalThis.__workspaceApi.workspace.mode, "PERSONAL");
  assert.equal(globalThis.__workspaceApi.workspace.revision, 5);
  const update = globalThis.__workspaceApi.calls.find((call) => call.op === "updateMany");
  assert.equal(update.where.userId, "user-a");
  assert.equal(update.where.revision, 4);
});

test("concurrent preference saves with one revision allow at most one update", async () => {
  globalThis.__workspaceApi.workspace = { userId: "user-a", ...preferences, revision: 4, onboardingCompletedAt: new Date(), updatedAt: new Date() };
  const first = patchRequest({ preferences: { ...preferences, mode: "PERSONAL" }, expectedRevision: 4 });
  const second = patchRequest({ preferences: { ...preferences, mode: "PROFESSIONAL" }, expectedRevision: 4 });
  const responses = await Promise.all([route.PATCH(first), route.PATCH(second)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal(globalThis.__workspaceApi.workspace.revision, 5);
});
