import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__workspacePagesApi = { user: { id: "owner-1" }, originFailure: false, calls: [] };

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: dataModule("export {};"), shortCircuit: true };
    if (specifier === "next/server") return { url: dataModule("export const NextResponse = { json: (body, init) => Response.json(body, init) };"), shortCircuit: true };
    if (specifier === "@/lib/personal-workspace-pages-core") return { url: dataModule("export const WORKSPACE_TEMPLATES = [{ id: 'notes-v1', title: 'Notes', blocks: [{ type: 'PARAGRAPH', content: { text: 'starter' } }] }];"), shortCircuit: true };
    if (specifier === "@/lib/personal-workspace-api") return { url: dataModule(`
      export const WORKSPACE_NO_STORE = { 'Cache-Control': 'no-store' };
      export async function workspaceApiUser(request, mutation = false) { const state = globalThis.__workspacePagesApi; if (mutation && state.originFailure) return { user: null, response: Response.json({ success: false }, { status: 403 }) }; return state.user ? { user: state.user, response: null } : { user: null, response: Response.json({ success: false }, { status: 401 }) }; }
      export async function workspaceJson(request, maxBytes = 64000) { try { const text = await request.text(); if (Buffer.byteLength(text) > maxBytes) return { success: false, response: Response.json({ success: false }, { status: 413 }) }; return { success: true, value: JSON.parse(text) }; } catch { return { success: false, response: Response.json({ success: false }, { status: 400 }) }; } }
      export function workspaceResult(result) { if (result && typeof result === 'object' && 'ok' in result) { if (!result.ok) return Response.json({ success: false, ...result }, { status: result.status || 400 }); return Response.json({ success: true, data: result.value }); } return Response.json({ success: true, data: result }); }
      export function workspaceError() { return Response.json({ success: false }, { status: 500 }); }
    `), shortCircuit: true };
    if (specifier === "@/lib/personal-workspace-pages") return { url: dataModule(`
      const state = () => globalThis.__workspacePagesApi;
      export async function listWorkspacePages(owner, options) { state().calls.push({ op: 'list', owner, options }); return []; }
      export async function createWorkspacePage(owner, input, template) { state().calls.push({ op: 'create', owner, input, template }); return { ok: true, value: { id: 'page-1' } }; }
      export async function getWorkspacePage(owner, pageId) { state().calls.push({ op: 'get', owner, pageId }); return pageId === 'foreign' ? null : { id: pageId, workspaceId: 'hidden', title: 'Notes', blocks: [] }; }
      export async function updateWorkspacePage(owner, pageId, input) { state().calls.push({ op: 'patch', owner, pageId, input }); return { ok: false, status: 409, code: 'REVISION_CONFLICT', message: 'Conflict', currentRevision: 5 }; }
      export async function trashWorkspacePage(owner, pageId) { state().calls.push({ op: 'trash', owner, pageId }); return { ok: true, value: true }; }
      export async function moveWorkspacePage() { return { ok: true, value: true }; } export async function reorderWorkspacePages() { return { ok: true, value: true }; }
      export async function duplicateWorkspacePage() { return { ok: true, value: true }; } export async function setWorkspacePageState() { return { ok: true, value: true }; }
      export async function searchWorkspace(owner, query) { state().calls.push({ op: 'search', owner, query }); return []; }
      export function workspacePageTemplates() { return [{ id: 'notes-v1', title: 'Notes', version: 1, blockCount: 1 }]; }
      export async function listWorkspaceBlocks() { return []; } export async function createWorkspaceBlock() { return { ok: true, value: { id: 'block-1' } }; }
      export async function updateWorkspaceBlock() { return { ok: true, value: true }; } export async function deleteWorkspaceBlock() { return { ok: true, value: true }; } export async function reorderWorkspaceBlocks() { return { ok: true, value: true }; }
    `), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const routes = await import("../src/lib/personal-workspace-route-handlers.ts");
const request = (url, method = "GET", body) => new Request(url, { method, headers: { origin: "http://app.test", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

test.beforeEach(() => { globalThis.__workspacePagesApi.user = { id: "owner-1" }; globalThis.__workspacePagesApi.originFailure = false; globalThis.__workspacePagesApi.calls = []; });

test("unauthenticated page and search requests do not call workspace services", async () => {
  globalThis.__workspacePagesApi.user = null;
  assert.equal((await routes.pagesGet(request("http://app.test/api/dashboard/workspace/pages?parentId=root"))).status, 401);
  assert.equal((await routes.workspaceSearch(request("http://app.test/api/dashboard/workspace/search?q=note"))).status, 401);
  assert.equal(globalThis.__workspacePagesApi.calls.length, 0);
});

test("mutation rejects cross-origin requests before persistence", async () => {
  globalThis.__workspacePagesApi.originFailure = true;
  assert.equal((await routes.pagesPost(request("http://app.test/api/dashboard/workspace/pages", "POST", { title: "Notes" }))).status, 403);
  assert.equal(globalThis.__workspacePagesApi.calls.length, 0);
});

test("page creation derives owner from the server session and rejects forged identity fields", async () => {
  const forged = await routes.pagesPost(request("http://app.test/api/dashboard/workspace/pages", "POST", { title: "Notes", userId: "attacker", workspaceId: "foreign" }));
  assert.equal(forged.status, 400);
  assert.equal(globalThis.__workspacePagesApi.calls.length, 0);
  const created = await routes.pagesPost(request("http://app.test/api/dashboard/workspace/pages", "POST", { title: "Notes", templateId: "notes-v1" }));
  assert.equal(created.status, 200);
  assert.equal(globalThis.__workspacePagesApi.calls[0].owner, "owner-1");
  assert.equal(globalThis.__workspacePagesApi.calls[0].template.length, 1);
  assert.equal("workspaceId" in globalThis.__workspacePagesApi.calls[0].input, false);
});

test("foreign page lookups return 404 and do not reveal another owner", async () => {
  const found = await routes.pageGet(request("http://app.test/api/dashboard/workspace/pages/foreign"), { params: Promise.resolve({ pageId: "foreign" }) });
  assert.equal(found.status, 404);
  assert.equal(globalThis.__workspacePagesApi.calls[0].owner, "owner-1");
});

test("page responses omit internal workspace ownership identifiers", async () => {
  const found = await routes.pageGet(request("http://app.test/api/dashboard/workspace/pages/page-1"), { params: Promise.resolve({ pageId: "page-1" }) });
  assert.equal(found.status, 200);
  const body = await found.json();
  assert.equal("workspaceId" in body.data, false);
});

test("revision conflicts preserve the current revision and use 409", async () => {
  const response = await routes.pagePatch(request("http://app.test/api/dashboard/workspace/pages/page-1", "PATCH", { title: "Edited", expectedRevision: 4 }), { params: Promise.resolve({ pageId: "page-1" }) });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).currentRevision, 5);
});

test("duplicate scalar query parameters are rejected", async () => {
  const response = await routes.pagesGet(request("http://app.test/api/dashboard/workspace/pages?parentId=root&parentId=foreign"));
  assert.equal(response.status, 400);
  assert.equal(globalThis.__workspacePagesApi.calls.length, 0);
});
