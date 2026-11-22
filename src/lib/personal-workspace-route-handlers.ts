import "server-only";
import { NextResponse } from "next/server";
import { WORKSPACE_TEMPLATES } from "@/lib/personal-workspace-pages-core";
import { createWorkspaceBlock, createWorkspacePage, deleteWorkspaceBlock, duplicateWorkspacePage, getWorkspacePage, listWorkspaceBlocks, listWorkspacePages, moveWorkspacePage, reorderWorkspaceBlocks, reorderWorkspacePages, searchWorkspace, setWorkspacePageState, trashWorkspacePage, updateWorkspaceBlock, updateWorkspacePage, workspacePageTemplates } from "@/lib/personal-workspace-pages";
import { workspaceApiUser, workspaceError, workspaceJson, workspaceResult, WORKSPACE_NO_STORE } from "@/lib/personal-workspace-api";

function response(message: string, status: number) { return NextResponse.json({ success: false, message }, { status, headers: WORKSPACE_NO_STORE }); }
function projectPage(page: unknown): unknown {
  if (typeof page !== "object" || page === null) return page;
  const safe = { ...(page as Record<string, unknown>) };
  const blocks = safe.blocks;
  delete safe.workspaceId;
  delete safe.blocks;
  return { ...safe, ...(Array.isArray(blocks) ? { blocks: blocks.map(projectBlock) } : {}) };
}
function projectBlock(block: unknown): unknown { if (typeof block !== "object" || block === null) return block; const safe = { ...(block as Record<string, unknown>) }; delete safe.workspaceId; delete safe.pageId; return safe; }

export async function pagesGet(request: Request) {
  const auth = await workspaceApiUser(request);
  if (auth.response || !auth.user) return auth.response;
  try {
    const url = new URL(request.url);
    for (const key of ["parentId", "view", "limit", "cursor"]) if (url.searchParams.getAll(key).length > 1) return response("Repeated query parameters are not supported.", 400);
    const parent = url.searchParams.get("parentId");
    const view = url.searchParams.get("view") ?? "active";
    if (!(["active", "archive", "trash", "favorites", "pinned"] as const).includes(view as "active" | "archive" | "trash" | "favorites" | "pinned")) return response("Page view is invalid.", 400);
    if (parent && parent !== "root" && parent !== "all" && parent.length > 128) return response("Parent page is invalid.", 400);
    if (parent === "all" && !["archive", "trash", "favorites", "pinned"].includes(view)) return response("This page listing cannot use the all-pages view.", 400);
    const limitRaw = url.searchParams.get("limit");
    if (limitRaw && !/^\d{1,3}$/.test(limitRaw)) return response("Page limit is invalid.", 400);
    const pages = await listWorkspacePages(auth.user.id, { parentId: parent === "all" ? "all" : !parent || parent === "root" ? null : parent, view: view as "active" | "archive" | "trash" | "favorites" | "pinned", ...(limitRaw ? { limit: Number(limitRaw) } : {}), ...(url.searchParams.get("cursor") ? { cursor: url.searchParams.get("cursor")! } : {}) });
    if (!pages) return response("Parent page not found.", 404);
    return NextResponse.json({ success: true, data: pages.map(projectPage) }, { headers: WORKSPACE_NO_STORE });
  } catch { return workspaceError(); }
}

export async function pagesPost(request: Request) {
  const auth = await workspaceApiUser(request, true);
  if (auth.response || !auth.user) return auth.response;
  const parsed = await workspaceJson(request);
  if (!parsed.success) return parsed.response;
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) return response("Page request is invalid.", 400);
  const body = parsed.value as Record<string, unknown>;
  const allowed = new Set(["title", "parentId", "iconKey", "isFavorite", "isPinned", "templateId"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) return response("Unsupported page fields.", 400);
  const templateId = body.templateId;
  if (templateId !== undefined && (typeof templateId !== "string" || !WORKSPACE_TEMPLATES.some((item) => item.id === templateId))) return response("Template is unavailable.", 400);
  const template = typeof templateId === "string" ? WORKSPACE_TEMPLATES.find((item) => item.id === templateId)?.blocks : undefined;
  const pageInput = { ...body };
  delete pageInput.templateId;
  try { return workspaceResult(await createWorkspacePage(auth.user.id, pageInput, template)); } catch { return workspaceError(); }
}

export async function pageGet(_request: Request, context: { params: Promise<{ pageId: string }> }) {
  const auth = await workspaceApiUser(_request);
  if (auth.response || !auth.user) return auth.response;
  const { pageId } = await context.params;
  try { const page = await getWorkspacePage(auth.user.id, pageId); return page ? NextResponse.json({ success: true, data: projectPage(page) }, { headers: WORKSPACE_NO_STORE }) : response("Page not found.", 404); } catch { return workspaceError(); }
}

export async function pagePatch(request: Request, context: { params: Promise<{ pageId: string }> }) {
  const auth = await workspaceApiUser(request, true);
  if (auth.response || !auth.user) return auth.response;
  const body = await workspaceJson(request, 40_000);
  if (!body.success) return body.response;
  const { pageId } = await context.params;
  try { return workspaceResult(await updateWorkspacePage(auth.user.id, pageId, body.value)); } catch { return workspaceError(); }
}

export async function pageDelete(request: Request, context: { params: Promise<{ pageId: string }> }) {
  const auth = await workspaceApiUser(request, true);
  if (auth.response || !auth.user) return auth.response;
  const { pageId } = await context.params;
  try { return workspaceResult(await trashWorkspacePage(auth.user.id, pageId)); } catch { return workspaceError(); }
}

export async function pageMove(request: Request, context: { params: Promise<{ pageId: string }> }) {
  const auth = await workspaceApiUser(request, true);
  if (auth.response || !auth.user) return auth.response;
  const body = await workspaceJson(request, 8_000);
  if (!body.success) return body.response;
  const { pageId } = await context.params;
  try { return workspaceResult(await moveWorkspacePage(auth.user.id, pageId, body.value)); } catch { return workspaceError(); }
}

export async function pageDuplicate(request: Request, context: { params: Promise<{ pageId: string }> }) {
  const auth = await workspaceApiUser(request, true);
  if (auth.response || !auth.user) return auth.response;
  const { pageId } = await context.params;
  try { return workspaceResult(await duplicateWorkspacePage(auth.user.id, pageId)); } catch { return workspaceError(); }
}

export async function pageArchive(request: Request, context: { params: Promise<{ pageId: string }> }, state: "archive" | "restore") {
  const auth = await workspaceApiUser(request, true);
  if (auth.response || !auth.user) return auth.response;
  const { pageId } = await context.params;
  try { return workspaceResult(await setWorkspacePageState(auth.user.id, pageId, state)); } catch { return workspaceError(); }
}

export async function pagesReorder(request: Request) {
  const auth = await workspaceApiUser(request, true);
  if (auth.response || !auth.user) return auth.response;
  const body = await workspaceJson(request, 20_000);
  if (!body.success) return body.response;
  try { return workspaceResult(await reorderWorkspacePages(auth.user.id, body.value)); } catch { return workspaceError(); }
}

export async function workspaceSearch(request: Request) {
  const auth = await workspaceApiUser(request);
  if (auth.response || !auth.user) return auth.response;
  const url = new URL(request.url);
  if (url.searchParams.getAll("q").length !== 1 || url.searchParams.getAll("limit").length > 1) return response("Search parameters are invalid.", 400);
  const query = url.searchParams.get("q") ?? "";
  const limit = url.searchParams.get("limit") ?? "20";
  if (!/^\d{1,2}$/.test(limit)) return response("Search limit is invalid.", 400);
  try { return NextResponse.json({ success: true, data: (await searchWorkspace(auth.user.id, query, Number(limit))).map(projectPage) }, { headers: WORKSPACE_NO_STORE }); } catch { return workspaceError(); }
}

export async function workspaceTemplates(request: Request) {
  const auth = await workspaceApiUser(request);
  if (auth.response || !auth.user) return auth.response;
  return NextResponse.json({ success: true, data: workspacePageTemplates() }, { headers: WORKSPACE_NO_STORE });
}

export async function pageBlocksGet(request: Request, context: { params: Promise<{ pageId: string }> }) {
  const auth = await workspaceApiUser(request);
  if (auth.response || !auth.user) return auth.response;
  const { pageId } = await context.params;
  try { const blocks = await listWorkspaceBlocks(auth.user.id, pageId); return blocks ? NextResponse.json({ success: true, data: blocks.map(projectBlock) }, { headers: WORKSPACE_NO_STORE }) : response("Page not found.", 404); } catch { return workspaceError(); }
}

export async function pageBlocksPost(request: Request, context: { params: Promise<{ pageId: string }> }) {
  const auth = await workspaceApiUser(request, true);
  if (auth.response || !auth.user) return auth.response;
  const body = await workspaceJson(request, 40_000);
  if (!body.success) return body.response;
  const { pageId } = await context.params;
  try { return workspaceResult(await createWorkspaceBlock(auth.user.id, pageId, body.value)); } catch { return workspaceError(); }
}

export async function blockPatch(request: Request, context: { params: Promise<{ blockId: string }> }) {
  const auth = await workspaceApiUser(request, true);
  if (auth.response || !auth.user) return auth.response;
  const body = await workspaceJson(request, 40_000);
  if (!body.success) return body.response;
  const { blockId } = await context.params;
  try { return workspaceResult(await updateWorkspaceBlock(auth.user.id, blockId, body.value)); } catch { return workspaceError(); }
}

export async function blockDelete(request: Request, context: { params: Promise<{ blockId: string }> }) {
  const auth = await workspaceApiUser(request, true);
  if (auth.response || !auth.user) return auth.response;
  const { blockId } = await context.params;
  try { return workspaceResult(await deleteWorkspaceBlock(auth.user.id, blockId)); } catch { return workspaceError(); }
}

export async function blocksReorder(request: Request, context: { params: Promise<{ pageId: string }> }) {
  const auth = await workspaceApiUser(request, true);
  if (auth.response || !auth.user) return auth.response;
  const body = await workspaceJson(request, 20_000);
  if (!body.success) return body.response;
  const { pageId } = await context.params;
  try { return workspaceResult(await reorderWorkspaceBlocks(auth.user.id, pageId, body.value)); } catch { return workspaceError(); }
}
