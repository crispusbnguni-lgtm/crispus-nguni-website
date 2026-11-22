import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__intelligencePreferencesTest = { user: { id: "verified-owner", role: "USER" }, row: null, calls: [], failure: false };
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: data("export {};"), shortCircuit: true };
  if (specifier === "next/server") return { url: data("export const NextResponse={json:(body,init)=>Response.json(body,init)};"), shortCircuit: true };
  if (specifier === "@/lib/prisma") return { url: data(`export const prisma=new Proxy({}, {get(_target,key){return globalThis.__intelligencePreferencesTest.prisma?.[key]}});`), shortCircuit: true };
  if (specifier === "@/lib/authorization") return { url: data(`
    export function requireSameOriginApiRequest(request) { const origin=request.headers.get('origin'); try { if(origin && new URL(origin).origin===origin && new URL(request.url).origin===origin) return null; } catch {} return Response.json({success:false},{status:403}); }
    export async function requireApiUser() { const user=globalThis.__intelligencePreferencesTest.user; return user ? {user,response:null} : {user:null,response:Response.json({success:false},{status:401})}; }
  `), shortCircuit: true };
  if (specifier === "@/lib/personal-intelligence-core") return { url: new URL("../src/lib/personal-intelligence-core.ts", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });

const route = await import("../src/app/api/dashboard/workspace/intelligence/preferences/route.ts");
const url = "https://workspace.test/api/dashboard/workspace/intelligence/preferences";
const request = (body, origin = "https://workspace.test") => new Request(url, { method: "PATCH", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
const defaults = { TASKS: false, PROJECTS: false, ACADEMICS: false, WORKSPACE_PREFERENCES: false, CALENDAR_DIARY: false, PERSONAL_FINANCE: false, PERSONAL_GOALS_PREFERENCES: false, PERSONAL_MEMORY: false, SECURITY_METADATA: false, FUTURE_MODULES: false, WORKSPACE_PAGES: false, WORKSPACE_DATABASES: false };

function setup() {
  const state = globalThis.__intelligencePreferencesTest;
  state.user = { id: "verified-owner", role: "USER" }; state.row = null; state.calls = []; state.failure = false;
  state.prisma = { personalWorkspace: {
    findUnique: async (args) => { state.calls.push(["findUnique", args]); return state.row; },
    upsert: async (args) => { state.calls.push(["upsert", args]); if (state.failure) throw new Error("private database failure"); state.row = { ...(state.row ?? { intelligencePermissions: defaults, intelligenceDismissedIds: [], intelligenceFeedback: {} }), ...args.create, ...args.update }; return state.row; },
  } };
  return state;
}

test("GET returns fail-closed defaults scoped to the authenticated owner", async () => {
  const state = setup();
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).permissions, defaults);
  assert.equal(state.calls[0][1].where.userId, "verified-owner");
});

test("PATCH persists explicit source consent, dismissal and feedback using server session identity", async () => {
  const state = setup();
  const enabled = { ...defaults, TASKS: true };
  let response = await route.PATCH(request({ permissions: enabled }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).permissions, enabled);
  response = await route.PATCH(request({ dismissedIds: ["upcoming:1:task-1"] }));
  assert.equal(response.status, 200);
  response = await route.PATCH(request({ feedback: { "upcoming:1:task-1": "helpful" } }));
  assert.equal(response.status, 200);
  const writes = state.calls.filter(([name]) => name === "upsert");
  assert.equal(writes.length, 3);
  assert.ok(writes.every(([, args]) => args.where.userId === "verified-owner" && args.create.userId === "verified-owner"));
  assert.deepEqual(state.row.intelligenceDismissedIds, ["upcoming:1:task-1"]);
  assert.deepEqual(state.row.intelligenceFeedback, { "upcoming:1:task-1": "helpful" });
});

test("browser-supplied identity and unknown preference fields are rejected before persistence", async () => {
  const state = setup();
  assert.equal((await route.PATCH(request({ userId: "victim", permissions: defaults }))).status, 400);
  assert.equal((await route.PATCH(request({ permissions: defaults, allowNewSource: true }))).status, 400);
  assert.equal(state.calls.length, 0);
});

test("invalid consent and overlarge dismissal or feedback values are rejected", async () => {
  const state = setup();
  assert.equal((await route.PATCH(request({ permissions: { ...defaults, TASKS: "yes" } }))).status, 400);
  assert.equal((await route.PATCH(request({ dismissedIds: Array(101).fill("id") }))).status, 400);
  assert.equal((await route.PATCH(request({ feedback: { insight: "maybe" } }))).status, 400);
  assert.equal(state.calls.length, 0);
});

test("same-origin protection precedes writes, authentication is required, and persistence errors fail safely", async () => {
  const state = setup();
  assert.equal((await route.PATCH(request({ dismissedIds: [] }, "https://attacker.test"))).status, 403);
  assert.equal(state.calls.length, 0);
  state.user = null;
  assert.equal((await route.PATCH(request({ dismissedIds: [] }))).status, 401);
  assert.equal(state.calls.length, 0);
  state.user = { id: "verified-owner", role: "USER" }; state.failure = true;
  const response = await route.PATCH(request({ dismissedIds: [] }));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private database failure/);
});
