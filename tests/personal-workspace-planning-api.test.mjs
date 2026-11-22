import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__workspacePlanningApi = { user: { id: "verified-owner" }, originFailure: false, calls: [] };
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: dataModule("export {};"), shortCircuit: true };
  if (specifier === "next/server") return { url: dataModule("export const NextResponse = { json: (body, init) => Response.json(body, init) };"), shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-api") return { url: dataModule(`
    export const WORKSPACE_NO_STORE = { 'Cache-Control': 'no-store' };
    export async function workspaceApiUser(request, mutation = false) { const s = globalThis.__workspacePlanningApi; if (mutation && s.originFailure) return { user: null, response: Response.json({ success: false }, { status: 403 }) }; return s.user ? { user: s.user, response: null } : { user: null, response: Response.json({ success: false }, { status: 401 }) }; }
    export async function workspaceJson(request) { try { return { success: true, value: await request.json() }; } catch { return { success: false, response: Response.json({ success: false }, { status: 400 }) }; } }
    export function workspaceResult(result) { return result?.ok === false ? Response.json({ success: false, ...result }, { status: result.status }) : Response.json({ success: true, data: result?.value ?? result }); }
    export function workspaceError() { return Response.json({ success: false }, { status: 500 }); }
  `), shortCircuit: true };
  const planningNames = ["addWorkspaceMilestone", "createWorkspaceProject", "createWorkspaceTask", "deleteWorkspaceTask", "getWorkspaceProject", "listWorkspaceProjects", "listWorkspaceTasks", "moveWorkspaceTask", "reorderWorkspaceTasks", "updateWorkspaceMilestone", "updateWorkspaceProject", "updateWorkspaceTask"];
  if (specifier === "@/lib/personal-workspace-planning") return { url: dataModule(`${planningNames.map((name) => `export async function ${name}(...args) { globalThis.__workspacePlanningApi.calls.push({ name: '${name}', args }); return { ok: true, value: [] }; }`).join("\n")}`), shortCircuit: true };
  const databaseNames = ["createWorkspaceDatabase", "createWorkspaceDatabaseProperty", "createWorkspaceDatabaseRecord", "createWorkspaceDatabaseView", "deleteWorkspaceDatabase", "deleteWorkspaceDatabaseProperty", "deleteWorkspaceDatabaseRecord", "deleteWorkspaceDatabaseView", "duplicateWorkspaceDatabase", "duplicateWorkspaceDatabaseRecord", "listWorkspaceDatabases", "listWorkspaceDatabaseRecords", "updateWorkspaceDatabase", "updateWorkspaceDatabaseProperty", "updateWorkspaceDatabaseRecord", "updateWorkspaceDatabaseView"];
  if (specifier === "@/lib/personal-workspace-databases") return { url: dataModule(`${databaseNames.map((name) => `export async function ${name}(...args) { globalThis.__workspacePlanningApi.calls.push({ name: '${name}', args }); return { ok: true, value: [] }; }`).join("\n")}`), shortCircuit: true };
  return nextResolve(specifier, context);
} });

const routes = await import("../src/lib/personal-workspace-planning-routes.ts");
const req = (url, method = "GET", body) => new Request(url, { method, headers: { origin: "https://app.test", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
test.beforeEach(() => { globalThis.__workspacePlanningApi = { user: { id: "verified-owner" }, originFailure: false, calls: [] }; });

test("unauthenticated task and project requests never reach services", async () => {
  globalThis.__workspacePlanningApi.user = null;
  assert.equal((await routes.tasksGet(req("https://app.test/api/dashboard/workspace/tasks"))).status, 401);
  assert.equal((await routes.projectsGet(req("https://app.test/api/dashboard/workspace/projects"))).status, 401);
  assert.equal(globalThis.__workspacePlanningApi.calls.length, 0);
});

test("same-origin guard blocks task and database mutations before service calls", async () => {
  globalThis.__workspacePlanningApi.originFailure = true;
  assert.equal((await routes.tasksPost(req("https://app.test/api/dashboard/workspace/tasks", "POST", { title: "Draft" }))).status, 403);
  assert.equal((await routes.databasesPost(req("https://app.test/api/dashboard/workspace/databases", "POST", { name: "Books" }))).status, 403);
  assert.equal(globalThis.__workspacePlanningApi.calls.length, 0);
});

test("task API derives owner from server session and rejects repeated or invalid filters", async () => {
  assert.equal((await routes.tasksGet(req("https://app.test/api/dashboard/workspace/tasks?status=UNKNOWN"))).status, 400);
  assert.equal((await routes.tasksGet(req("https://app.test/api/dashboard/workspace/tasks?q=a&q=b"))).status, 400);
  assert.equal(globalThis.__workspacePlanningApi.calls.length, 0);
  assert.equal((await routes.tasksPost(req("https://app.test/api/dashboard/workspace/tasks", "POST", { title: "Plan" }))).status, 200);
  assert.equal(globalThis.__workspacePlanningApi.calls[0].args[0], "verified-owner");
});

test("manual task movement remains authenticated, same-origin and owner-scoped", async () => {
  const context = { params: Promise.resolve({ taskId: "task-1" }) };
  assert.equal((await routes.taskMove(req("https://app.test/api/dashboard/workspace/tasks/task-1", "POST", { direction: "sideways" }), context)).status, 400);
  assert.equal(globalThis.__workspacePlanningApi.calls.length, 0);
  const moved = await routes.taskMove(req("https://app.test/api/dashboard/workspace/tasks/task-1", "POST", { direction: "up" }), context);
  assert.equal(moved.status, 200);
  assert.equal(globalThis.__workspacePlanningApi.calls[0].name, "moveWorkspaceTask");
  assert.equal(globalThis.__workspacePlanningApi.calls[0].args[0], "verified-owner");
  assert.equal(globalThis.__workspacePlanningApi.calls[0].args[1], "task-1");
  globalThis.__workspacePlanningApi.originFailure = true;
  assert.equal((await routes.taskMove(req("https://app.test/api/dashboard/workspace/tasks/task-1", "POST", { direction: "down" }), context)).status, 403);
  assert.equal(globalThis.__workspacePlanningApi.calls.length, 1);
});

test("project filtering and sorting reject invalid or repeated inputs and reach the service", async () => {
  assert.equal((await routes.projectsGet(req("https://app.test/api/dashboard/workspace/projects?status=UNKNOWN"))).status, 400);
  assert.equal((await routes.projectsGet(req("https://app.test/api/dashboard/workspace/projects?sortBy=name&sortBy=targetAt"))).status, 400);
  assert.equal(globalThis.__workspacePlanningApi.calls.length, 0);
  const response = await routes.projectsGet(req("https://app.test/api/dashboard/workspace/projects?status=ACTIVE&sortBy=name&direction=desc"));
  assert.equal(response.status, 200);
  const call = globalThis.__workspacePlanningApi.calls[0];
  assert.equal(call.name, "listWorkspaceProjects");
  assert.equal(call.args[0], "verified-owner");
  assert.deepEqual(call.args[1], { q: undefined, archived: false, status: "ACTIVE", sortBy: "name", direction: "desc" });
});

test("saved-view changes use the verified owner, scoped route IDs and revision supplied to the service", async () => {
  const context = { params: Promise.resolve({ databaseId: "db-1", viewId: "view-1" }) };
  const patch = await routes.viewPatch(req("https://app.test/api/dashboard/workspace/databases/db-1/views/view-1", "PATCH", { name: "Focused", expectedRevision: 3, configuration: { filters: [], sorts: [] } }), context);
  assert.equal(patch.status, 200);
  assert.deepEqual(globalThis.__workspacePlanningApi.calls[0], {
    name: "updateWorkspaceDatabaseView",
    args: ["verified-owner", "db-1", "view-1", { name: "Focused", expectedRevision: 3, configuration: { filters: [], sorts: [] } }],
  });
  const deleted = await routes.viewDelete(req("https://app.test/api/dashboard/workspace/databases/db-1/views/view-1", "DELETE"), context);
  assert.equal(deleted.status, 200);
  assert.equal(globalThis.__workspacePlanningApi.calls[1].name, "deleteWorkspaceDatabaseView");
  assert.deepEqual(globalThis.__workspacePlanningApi.calls[1].args, ["verified-owner", "db-1", "view-1"]);
});

test("database record reads reject repeated scalar parameters and preserve owner context", async () => {
  const response = await routes.recordsGet(req("https://app.test/api/dashboard/workspace/databases/db1/records?direction=asc&direction=desc"), { params: Promise.resolve({ databaseId: "db1" }) });
  assert.equal(response.status, 400);
  assert.equal(globalThis.__workspacePlanningApi.calls.length, 0);
  await routes.recordPost(req("https://app.test/api/dashboard/workspace/databases/db1/records", "POST", { data: { Name: "Book" } }), { params: Promise.resolve({ databaseId: "db1" }) });
  assert.equal(globalThis.__workspacePlanningApi.calls[0].args[0], "verified-owner");
});
