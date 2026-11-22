import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__memoryApi = { user: { id: "owner-1" }, rows: [], writes: [], workspace: { id: "workspace-1" } };

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/server") return { url: data(`export const NextResponse = { json(body, init={}) { return Response.json(body, init); } };`), shortCircuit: true };
    if (specifier === "@/lib/authorization") return { url: data(`export async function requireApiUser() { return globalThis.__memoryApi.user ? { user: globalThis.__memoryApi.user } : { response: Response.json({success:false}, {status:401}) }; } export function requireSameOriginApiRequest(request) { return request.headers.get("origin") === new URL(request.url).origin ? null : Response.json({success:false}, {status:403}); }`), shortCircuit: true };
    if (specifier === "@/lib/prisma") return { url: data(`const state=()=>globalThis.__memoryApi; const own=()=>state().user?.id==="owner-1"?state().workspace:null; export const prisma={ personalWorkspace:{ async findUnique(args){ state().writes.push(["workspace.findUnique",args]); return own(); }, async upsert(args){ state().writes.push(["workspace.upsert",args]); return own(); } }, workspaceIntelligenceMemory:{ async findMany(args){ state().writes.push(["memory.findMany",args]); return state().rows.filter(r=>r.workspaceId===args.where.workspaceId); }, async count(args){ return state().rows.filter(r=>r.workspaceId===args.where.workspaceId).length; }, async create(args){ const row={id:"memory_12345678",createdAt:new Date(),updatedAt:new Date(),...args.data}; state().rows.push(row); state().writes.push(["memory.create",args]); return row; }, async updateMany(args){ const row=own()&&state().rows.find(r=>r.id===args.where.id && r.workspaceId===state().workspace.id); if(!row) return {count:0}; Object.assign(row,args.data); state().writes.push(["memory.updateMany",args]); return {count:1}; }, async findFirst(args){ return own()&&state().rows.find(r=>r.id===args.where.id && r.workspaceId===state().workspace.id) || null; }, async deleteMany(args){ const before=state().rows.length; state().rows=state().rows.filter(r=>!(own()&&r.id===args.where.id && r.workspaceId===state().workspace.id)); return {count:before-state().rows.length}; } }, async $transaction(fn){ return fn({personalWorkspace:prisma.personalWorkspace,workspaceIntelligenceMemory:prisma.workspaceIntelligenceMemory}); } };`), shortCircuit: true };
    return next(specifier, context);
  },
});

const collection = await import("../src/app/api/dashboard/workspace/intelligence/memory/route.ts");
const item = await import("../src/app/api/dashboard/workspace/intelligence/memory/[memoryId]/route.ts");
const request = (method, body, origin = "https://app.test") => new Request("https://app.test/api/dashboard/workspace/intelligence/memory", { method, headers: { origin, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

test("memory CRUD is owner-scoped and new entries are disabled by default", async () => {
  globalThis.__memoryApi = { user: { id: "owner-1" }, rows: [], writes: [], workspace: { id: "workspace-1" } };
  const created = await collection.POST(request("POST", { kind: "PREFERENCE", label: "Planning style", content: "I prefer small steps." }));
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.memory.enabled, false);
  assert.equal(globalThis.__memoryApi.rows[0].workspaceId, "workspace-1");
  assert.equal(globalThis.__memoryApi.writes.some(([op]) => op === "workspace.upsert"), true);

  const enabled = await item.PATCH(request("PATCH", { enabled: true }), { params: Promise.resolve({ memoryId: createdBody.memory.id }) });
  assert.equal(enabled.status, 200);
  assert.equal((await enabled.json()).memory.enabled, true);

  const otherUser = globalThis.__memoryApi.user;
  globalThis.__memoryApi.user = { id: "other-user" };
  const hidden = await item.PATCH(request("PATCH", { enabled: false }), { params: Promise.resolve({ memoryId: createdBody.memory.id }) });
  assert.equal(hidden.status, 404);
  globalThis.__memoryApi.user = otherUser;

  const deleted = await item.DELETE(request("DELETE"), { params: Promise.resolve({ memoryId: createdBody.memory.id }) });
  assert.equal(deleted.status, 200);
  assert.equal(globalThis.__memoryApi.rows.length, 0);
});

test("memory rejects oversized, invalid and cross-origin writes without persistence", async () => {
  globalThis.__memoryApi = { user: { id: "owner-1" }, rows: [], writes: [], workspace: { id: "workspace-1" } };
  assert.equal((await collection.POST(request("POST", { kind: "SECRET", label: "x", content: "y" }))).status, 400);
  assert.equal((await collection.POST(request("POST", { kind: "CONTEXT", label: "x", content: "x".repeat(501) }))).status, 400);
  assert.equal((await collection.POST(request("POST", { kind: "CONTEXT", label: "ok", content: "note" }, "https://attacker.test"))).status, 403);
  assert.equal(globalThis.__memoryApi.rows.length, 0);
});

test("memory listing is private and no-store", async () => {
  globalThis.__memoryApi = { user: { id: "owner-1" }, rows: [{ id: "memory_12345678", workspaceId: "workspace-1", kind: "CONTEXT", label: "Private", content: "Owner text", enabled: false }], writes: [], workspace: { id: "workspace-1" } };
  const response = await collection.GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual((await response.json()).memories.map((memory) => memory.id), ["memory_12345678"]);
  assert.deepEqual(globalThis.__memoryApi.writes[0][1].where, { userId: "owner-1" });
});
