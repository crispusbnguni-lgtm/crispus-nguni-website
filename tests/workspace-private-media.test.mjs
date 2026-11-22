import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const makeState = () => ({
  user: { id: "owner-user-1" }, originFailure: false, bucket: { public: false },
  workspace: { id: "workspace-owner-1", userId: "owner-user-1" }, assets: [], objects: new Map(),
  refs: { coverPages: 0, blocks: 0 }, calls: [],
});
globalThis.__workspaceMedia = makeState();

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: dataModule("export {};"), shortCircuit: true };
    if (specifier === "next/server") return { url: dataModule("export const NextResponse = { json: (body, init) => Response.json(body, init) };"), shortCircuit: true };
    if (specifier === "@/lib/authorization") return { url: dataModule(`
      export async function requireApiUser() { const s = globalThis.__workspaceMedia; return s.user ? { user: s.user, response: null } : { user: null, response: Response.json({ success: false }, { status: 401 }) }; }
      export function requireSameOriginApiRequest() { return globalThis.__workspaceMedia.originFailure ? Response.json({ success: false }, { status: 403 }) : null; }
    `), shortCircuit: true };
    if (specifier === "@/lib/prisma") return { url: dataModule(`
      const state = () => globalThis.__workspaceMedia;
      export const prisma = {
        personalWorkspace: {
          findUnique: async ({ where }) => { state().calls.push({ op: 'workspace.find', where }); return state().workspace?.userId === where.userId ? { id: state().workspace.id } : null; },
          upsert: async ({ where }) => { state().calls.push({ op: 'workspace.upsert', where }); return state().workspace; },
        },
        workspaceMediaAsset: {
          findMany: async ({ where }) => { state().calls.push({ op: 'asset.list', where }); return state().assets.map(({ refs, ...asset }) => asset); },
          create: async ({ data }) => { state().calls.push({ op: 'asset.create', data }); const asset = { id: 'asset_0001', width: null, height: null, createdAt: new Date('2026-01-01T00:00:00Z'), ...data }; state().assets.push({ ...asset, refs: { coverPages: 0, blocks: 0 } }); return { id: asset.id, mimeType: asset.mimeType, byteSize: asset.byteSize, width: asset.width, height: asset.height, createdAt: asset.createdAt }; },
          findFirst: async ({ where, select }) => { state().calls.push({ op: 'asset.find', where }); const asset = state().assets.find((item) => item.id === where.id && item.workspaceId === state().workspace?.id && (where.objectKey === undefined || where.objectKey === item.objectKey)); if (!asset) return null; const snapshot = { id: asset.id, workspaceId: asset.workspaceId, objectKey: asset.objectKey, mimeType: asset.mimeType, byteSize: asset.byteSize, width: asset.width, height: asset.height, createdAt: asset.createdAt }; return select?._count ? { ...snapshot, _count: { ...asset.refs } } : snapshot; },
          updateMany: async ({ where, data }) => { state().calls.push({ op: 'asset.update', where, data }); const asset = state().assets.find((item) => item.id === where.id && item.workspaceId === where.workspaceId && item.objectKey === where.objectKey); if (!asset) return { count: 0 }; Object.assign(asset, data); return { count: 1 }; },
          delete: async ({ where }) => { state().calls.push({ op: 'asset.delete', where }); const index = state().assets.findIndex((item) => item.id === where.workspaceId_id.id && item.workspaceId === where.workspaceId_id.workspaceId); if (index < 0) throw new Error('missing'); return state().assets.splice(index, 1)[0]; },
        },
      };
    `), shortCircuit: true };
    if (specifier === "@/lib/supabase-admin") return { url: dataModule(`
      const state = () => globalThis.__workspaceMedia;
      export const supabaseAdmin = { storage: {
        getBucket: async (name) => { state().calls.push({ op: 'bucket', name }); return { data: state().bucket ? { name, public: state().bucket.public } : null, error: state().bucket ? null : new Error('missing') }; },
        from: (name) => ({
          upload: async (key, bytes, options) => { state().calls.push({ op: 'upload', name, key, options }); state().objects.set(key, bytes); return { error: null }; },
          download: async (key) => ({ data: state().objects.has(key) ? new Blob([state().objects.get(key)]) : null, error: state().objects.has(key) ? null : new Error('missing') }),
          remove: async (keys) => { state().calls.push({ op: 'remove', name, keys }); for (const key of keys) state().objects.delete(key); return { error: null }; },
        }),
      } };
    `), shortCircuit: true };
    if (specifier === "@/lib/background-media") return { url: dataModule(`
      export async function hasAllowedBackgroundMediaSignature(file, allowed) { if (!allowed.includes(file.type)) return false; const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer()); return file.type === 'image/png' && bytes.length === 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10; }
    `), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const collection = await import("../src/app/api/dashboard/workspace/media/route.ts");
const item = await import("../src/app/api/dashboard/workspace/media/[assetId]/route.ts");
const state = () => globalThis.__workspaceMedia;
const url = (path = "http://app.test/api/dashboard/workspace/media") => path;
const req = (method = "GET", body, headers = {}) => new Request(url(), { method, ...(body ? { body } : {}), headers: { origin: "http://app.test", ...headers } });
const png = () => new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], "client-controlled-name.png", { type: "image/png" });
const pdf = () => new File(["%PDF-1.7\nacademic note"], "lecture-notes.pdf", { type: "application/pdf" });
const uploadRequest = (method = "POST", file = png()) => { const form = new FormData(); form.set("file", file); return req(method, form); };
const context = (assetId) => ({ params: Promise.resolve({ assetId }) });

test.beforeEach(() => {
  globalThis.__workspaceMedia = makeState();
  process.env.WORKSPACE_PRIVATE_MEDIA_BUCKET = "workspace-private-test";
});

test("unauthenticated requests and cross-origin mutations do not access private storage or persistence", async () => {
  state().user = null;
  assert.equal((await collection.GET()).status, 401);
  assert.equal(state().calls.length, 0);
  state().user = { id: "owner-user-1" }; state().originFailure = true;
  assert.equal((await collection.POST(uploadRequest())).status, 403);
  assert.equal(state().calls.length, 0);
});

test("missing or public buckets fail closed before upload", async () => {
  state().bucket = null;
  assert.equal((await collection.POST(uploadRequest())).status, 503);
  state().bucket = { public: true };
  assert.equal((await collection.POST(uploadRequest())).status, 503);
  assert.equal(state().objects.size, 0);
  assert.equal(state().calls.filter((call) => call.op === "upload").length, 0);
});

test("declared oversized multipart requests are rejected before parsing or storage access", async () => {
  const request = req("POST", "unused", { "content-length": String(16 * 1024 * 1024) });
  const response = await collection.POST(request);
  assert.equal(response.status, 413);
  assert.equal(state().calls.length, 0);
});

test("upload validates declared type, size and actual signature before storing owner-scoped metadata", async () => {
  const spoofed = new File(["not png"], "spoof.png", { type: "image/png" });
  assert.equal((await collection.POST(uploadRequest("POST", spoofed))).status, 415);
  const unsupported = new File(["GIF89a"], "image.gif", { type: "image/gif" });
  assert.equal((await collection.POST(uploadRequest("POST", unsupported))).status, 415);
  const tooLarge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
  assert.equal((await collection.POST(uploadRequest("POST", tooLarge))).status, 413);
  const response = await collection.POST(uploadRequest());
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.asset.id, "asset_0001");
  assert.match(body.asset.src, /\/api\/dashboard\/workspace\/media\/asset_0001$/);
  assert.equal("objectKey" in body.asset, false);
  const create = state().calls.find((call) => call.op === "asset.create");
  assert.equal(create.data.workspaceId, "workspace-owner-1");
  assert.equal(create.data.objectKey.startsWith("workspace-owner-1/"), true);
  assert.equal(create.data.objectKey.includes("client-controlled-name"), false);
});

test("private asset reads are owner-scoped and return non-cacheable private bytes", async () => {
  const key = "workspace-owner-1/random.png";
  state().assets.push({ id: "asset_0001", workspaceId: "workspace-owner-1", objectKey: key, mimeType: "image/png", byteSize: 8, width: null, height: null, createdAt: new Date(), refs: { coverPages: 0, blocks: 0 } });
  state().objects.set(key, Uint8Array.from([137, 80, 78, 71]));
  const response = await item.GET(req(), context("asset_0001"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal((await response.arrayBuffer()).byteLength, 4);
  assert.equal(state().calls.find((call) => call.op === "asset.find").where.workspace.userId, "owner-user-1");
  state().calls = [];
  const foreign = await item.GET(req(), context("foreign_01"));
  assert.equal(foreign.status, 404);
  assert.equal(state().calls.find((call) => call.op === "asset.find").where.workspace.userId, "owner-user-1");
});

test("PDFs are signature-checked, stored privately, and served as downloads", async () => {
  const response = await collection.POST(uploadRequest("POST", pdf()));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(state().calls.find((call) => call.op === "asset.create").data.mimeType, "application/pdf");
  state().objects.set(state().assets[0].objectKey, new TextEncoder().encode("%PDF-1.7"));
  const download = await item.GET(req(), context(body.asset.id));
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /^attachment;/);
  const spoofed = new File(["not a PDF"], "spoof.pdf", { type: "application/pdf" });
  assert.equal((await collection.POST(uploadRequest("POST", spoofed))).status, 415);
});

test("Super Admin private media remains scoped to the administrator's own Workspace", async () => {
  state().user = { id: "verified-super-admin", role: "SUPER_ADMIN" };
  state().workspace = { id: "workspace-admin-own", userId: "verified-super-admin" };
  state().assets.push({ id: "admin_asset1", workspaceId: "workspace-admin-own", objectKey: "workspace-admin-own/private.png", mimeType: "image/png", byteSize: 8, width: null, height: null, createdAt: new Date(), refs: { coverPages: 0, blocks: 0 } });
  const response = await collection.GET();
  assert.equal(response.status, 200);
  assert.equal(state().calls.find((call) => call.op === "workspace.find").where.userId, "verified-super-admin");
  assert.equal(state().calls.find((call) => call.op === "asset.list").where.workspaceId, "workspace-admin-own");
  assert.equal((await response.json()).assets.length, 1);
});

test("replacement keeps a stable asset ID and conditionally swaps its private object", async () => {
  state().assets.push({ id: "asset_0001", workspaceId: "workspace-owner-1", objectKey: "workspace-owner-1/old.png", mimeType: "image/png", byteSize: 8, width: 20, height: 20, createdAt: new Date(), refs: { coverPages: 1, blocks: 1 } });
  state().objects.set("workspace-owner-1/old.png", new Uint8Array([1]));
  const response = await item.PUT(uploadRequest("PUT"), context("asset_0001"));
  assert.equal(response.status, 200);
  assert.equal(state().assets[0].id, "asset_0001");
  assert.notEqual(state().assets[0].objectKey, "workspace-owner-1/old.png");
  assert.equal(state().calls.some((call) => call.op === "remove" && call.keys.includes("workspace-owner-1/old.png")), true);
  assert.equal(state().objects.has(state().assets[0].objectKey), true);
  assert.equal(state().objects.has("workspace-owner-1/old.png"), false);
  assert.equal(state().calls.some((call) => call.op === "asset.update"), true);
});

test("deletion refuses referenced assets and removes unreferenced metadata before private object cleanup", async () => {
  state().assets.push({ id: "asset_0001", workspaceId: "workspace-owner-1", objectKey: "workspace-owner-1/used.png", mimeType: "image/png", byteSize: 8, width: null, height: null, createdAt: new Date(), refs: { coverPages: 1, blocks: 0 } });
  let response = await item.DELETE(req("DELETE"), context("asset_0001"));
  assert.equal(response.status, 409);
  assert.equal(state().assets.length, 1);
  state().assets[0].refs = { coverPages: 0, blocks: 0 };
  state().objects.set("workspace-owner-1/used.png", new Uint8Array([1]));
  response = await item.DELETE(req("DELETE"), context("asset_0001"));
  assert.equal(response.status, 200);
  assert.equal(state().assets.length, 0);
  assert.equal(state().objects.size, 0);
});
