import "server-only";
import { NextResponse } from "next/server";
import { workspaceApiUser, workspaceError, workspaceJson, workspaceResult, WORKSPACE_NO_STORE } from "@/lib/personal-workspace-api";
import { addWorkspaceMilestone, createWorkspaceProject, createWorkspaceTask, deleteWorkspaceTask, getWorkspaceProject, listWorkspaceProjects, listWorkspaceTasks, moveWorkspaceTask, reorderWorkspaceTasks, updateWorkspaceMilestone, updateWorkspaceProject, updateWorkspaceTask } from "@/lib/personal-workspace-planning";
import { createWorkspaceDatabase, createWorkspaceDatabaseProperty, createWorkspaceDatabaseRecord, createWorkspaceDatabaseView, deleteWorkspaceDatabase, deleteWorkspaceDatabaseProperty, deleteWorkspaceDatabaseRecord, deleteWorkspaceDatabaseView, duplicateWorkspaceDatabase, duplicateWorkspaceDatabaseRecord, listWorkspaceDatabases, listWorkspaceDatabaseRecords, updateWorkspaceDatabase, updateWorkspaceDatabaseProperty, updateWorkspaceDatabaseRecord, updateWorkspaceDatabaseView } from "@/lib/personal-workspace-databases";

type Context<K extends string> = { params: Promise<Record<K, string>> };
function invalid(message: string, status = 400) { return NextResponse.json({ success: false, message }, { status, headers: WORKSPACE_NO_STORE }); }
async function authorized(request: Request, mutation = false) { const auth = await workspaceApiUser(request, mutation); return auth.response || !auth.user ? { user: null, response: auth.response } : { user: auth.user, response: null }; }
async function mutationBody(request: Request, limit = 64_000) { const result = await workspaceJson(request, limit); if (!result.success) return result; if (typeof result.value !== "object" || result.value === null || Array.isArray(result.value)) return { success: false as const, response: invalid("Request body must be an object.") }; return result; }

export async function tasksGet(request: Request) {
  const auth = await authorized(request); if (auth.response || !auth.user) return auth.response;
  const url = new URL(request.url);
  for (const key of ["q", "status", "bucket", "limit", "projectId", "archived"]) if (url.searchParams.getAll(key).length > 1) return invalid("Repeated query parameters are not supported.");
  const status = url.searchParams.get("status") ?? undefined;
  if (status && !["INBOX", "TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"].includes(status)) return invalid("Task status is invalid.");
  const bucketRaw = url.searchParams.get("bucket") ?? undefined;
  if (bucketRaw && !["overdue", "today", "upcoming", "completed"].includes(bucketRaw)) return invalid("Task view is invalid.");
  const archivedRaw = url.searchParams.get("archived") ?? "false"; if (archivedRaw !== "true" && archivedRaw !== "false") return invalid("Archive filter is invalid.");
  const limitRaw = url.searchParams.get("limit") ?? "100";
  if (!/^\d{1,3}$/.test(limitRaw) || Number(limitRaw) < 1 || Number(limitRaw) > 200) return invalid("Task limit is invalid.");
  try { return NextResponse.json({ success: true, data: await listWorkspaceTasks(auth.user.id, { q: url.searchParams.get("q") ?? undefined, status, bucket: bucketRaw as "overdue" | "today" | "upcoming" | "completed" | undefined, projectId: url.searchParams.get("projectId") ?? undefined, archived: archivedRaw === "true", limit: Number(limitRaw) }) }, { headers: WORKSPACE_NO_STORE }); } catch { return workspaceError(); }
}
export async function tasksPost(request: Request) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response;
  const body = await mutationBody(request); if (!body.success) return body.response;
  try { return workspaceResult(await createWorkspaceTask(auth.user.id, body.value)); } catch { return workspaceError(); }
}
export async function taskPatch(request: Request, context: Context<"taskId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response;
  const body = await mutationBody(request); if (!body.success) return body.response; const { taskId } = await context.params;
  try { return workspaceResult(await updateWorkspaceTask(auth.user.id, taskId, body.value)); } catch { return workspaceError(); }
}
export async function taskMove(request: Request, context: Context<"taskId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response;
  const body = await mutationBody(request, 2_000); if (!body.success) return body.response;
  const movement = body.value;
  if (typeof movement !== "object" || movement === null || Array.isArray(movement) || Object.keys(movement).length !== 1) return invalid("Task movement is invalid.");
  const direction = (movement as Record<string, unknown>).direction;
  if (direction !== "up" && direction !== "down") return invalid("Task movement is invalid.");
  const { taskId } = await context.params;
  try { return workspaceResult(await moveWorkspaceTask(auth.user.id, taskId, direction)); } catch { return workspaceError(); }
}
export async function taskDelete(request: Request, context: Context<"taskId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const { taskId } = await context.params;
  try { return workspaceResult(await deleteWorkspaceTask(auth.user.id, taskId)); } catch { return workspaceError(); }
}
export async function taskReorder(request: Request) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response;
  const body = await mutationBody(request, 24_000); if (!body.success) return body.response;
  try { return workspaceResult(await reorderWorkspaceTasks(auth.user.id, body.value)); } catch { return workspaceError(); }
}

export async function projectsGet(request: Request) {
  const auth = await authorized(request); if (auth.response || !auth.user) return auth.response;
  const url = new URL(request.url); for (const key of ["q", "archived", "status", "sortBy", "direction"]) if (url.searchParams.getAll(key).length > 1) return invalid("Repeated query parameters are not supported.");
  const archivedRaw = url.searchParams.get("archived"); if (archivedRaw && archivedRaw !== "true" && archivedRaw !== "false") return invalid("Archive filter is invalid.");
  const status = url.searchParams.get("status") ?? undefined; if (status && !["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].includes(status)) return invalid("Project status is invalid.");
  const sortBy = url.searchParams.get("sortBy") ?? "targetAt"; if (!["targetAt", "name", "updatedAt"].includes(sortBy)) return invalid("Project sort is invalid.");
  const direction = url.searchParams.get("direction") ?? (sortBy === "updatedAt" ? "desc" : "asc"); if (direction !== "asc" && direction !== "desc") return invalid("Project sort direction is invalid.");
  try { return NextResponse.json({ success: true, data: await listWorkspaceProjects(auth.user.id, { q: url.searchParams.get("q") ?? undefined, archived: archivedRaw === "true", status: status as "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED" | undefined, sortBy: sortBy as "targetAt" | "name" | "updatedAt", direction }) }, { headers: WORKSPACE_NO_STORE }); } catch { return workspaceError(); }
}
export async function projectsPost(request: Request) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const body = await mutationBody(request); if (!body.success) return body.response;
  try { return workspaceResult(await createWorkspaceProject(auth.user.id, body.value)); } catch { return workspaceError(); }
}
export async function projectPatch(request: Request, context: Context<"projectId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const body = await mutationBody(request); if (!body.success) return body.response; const { projectId } = await context.params;
  try { return workspaceResult(await updateWorkspaceProject(auth.user.id, projectId, body.value)); } catch { return workspaceError(); }
}
export async function projectGet(request: Request, context: Context<"projectId">) {
  const auth = await authorized(request); if (auth.response || !auth.user) return auth.response; const { projectId } = await context.params;
  try { const data = await getWorkspaceProject(auth.user.id, projectId); return data ? NextResponse.json({ success: true, data }, { headers: WORKSPACE_NO_STORE }) : invalid("Project not found.", 404); } catch { return workspaceError(); }
}
export async function milestonePost(request: Request, context: Context<"projectId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const body = await mutationBody(request); if (!body.success) return body.response; const { projectId } = await context.params;
  try { return workspaceResult(await addWorkspaceMilestone(auth.user.id, projectId, body.value)); } catch { return workspaceError(); }
}
export async function milestonePatch(request: Request, context: Context<"milestoneId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const body = await mutationBody(request); if (!body.success) return body.response; const { milestoneId } = await context.params;
  try { return workspaceResult(await updateWorkspaceMilestone(auth.user.id, milestoneId, body.value)); } catch { return workspaceError(); }
}

export async function databasesGet(request: Request) {
  const auth = await authorized(request); if (auth.response || !auth.user) return auth.response;
  const url = new URL(request.url); if (url.searchParams.getAll("archived").length > 1) return invalid("Repeated query parameters are not supported.");
  const archived = url.searchParams.get("archived"); if (archived && archived !== "true" && archived !== "false") return invalid("Archive filter is invalid.");
  try { return NextResponse.json({ success: true, data: await listWorkspaceDatabases(auth.user.id, archived === "true") }, { headers: WORKSPACE_NO_STORE }); } catch { return workspaceError(); }
}
export async function databasesPost(request: Request) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const body = await mutationBody(request); if (!body.success) return body.response;
  try { return workspaceResult(await createWorkspaceDatabase(auth.user.id, body.value)); } catch { return workspaceError(); }
}
export async function databasePatch(request: Request, context: Context<"databaseId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const body = await mutationBody(request); if (!body.success) return body.response; const { databaseId } = await context.params;
  try { return workspaceResult(await updateWorkspaceDatabase(auth.user.id, databaseId, body.value)); } catch { return workspaceError(); }
}
export async function databaseDelete(request: Request, context: Context<"databaseId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const { databaseId } = await context.params;
  try { return workspaceResult(await deleteWorkspaceDatabase(auth.user.id, databaseId)); } catch { return workspaceError(); }
}
export async function databaseDuplicate(request: Request, context: Context<"databaseId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const { databaseId } = await context.params;
  try { return workspaceResult(await duplicateWorkspaceDatabase(auth.user.id, databaseId)); } catch { return workspaceError(); }
}
export async function propertyPost(request: Request, context: Context<"databaseId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const body = await mutationBody(request); if (!body.success) return body.response; const { databaseId } = await context.params;
  try { return workspaceResult(await createWorkspaceDatabaseProperty(auth.user.id, databaseId, body.value)); } catch { return workspaceError(); }
}
export async function propertyPatch(request: Request, context: Context<"databaseId" | "propertyId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const body = await mutationBody(request); if (!body.success) return body.response; const { databaseId, propertyId } = await context.params;
  try { return workspaceResult(await updateWorkspaceDatabaseProperty(auth.user.id, databaseId, propertyId, body.value)); } catch { return workspaceError(); }
}
export async function propertyDelete(request: Request, context: Context<"databaseId" | "propertyId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const { databaseId, propertyId } = await context.params;
  try { return workspaceResult(await deleteWorkspaceDatabaseProperty(auth.user.id, databaseId, propertyId)); } catch { return workspaceError(); }
}
export async function recordsGet(request: Request, context: Context<"databaseId">) {
  const auth = await authorized(request); if (auth.response || !auth.user) return auth.response; const { databaseId } = await context.params; const url = new URL(request.url);
  for (const key of ["q", "sortPropertyId", "direction", "archived", "viewId"]) if (url.searchParams.getAll(key).length > 1) return invalid("Repeated query parameters are not supported.");
  const direction = url.searchParams.get("direction") ?? "asc"; if (direction !== "asc" && direction !== "desc") return invalid("Sort direction is invalid.");
  const archived = url.searchParams.get("archived") ?? "false"; if (archived !== "true" && archived !== "false") return invalid("Archive filter is invalid.");
  try { const data = await listWorkspaceDatabaseRecords(auth.user.id, databaseId, { q: url.searchParams.get("q") ?? undefined, sortPropertyId: url.searchParams.get("sortPropertyId") ?? undefined, direction, archived: archived === "true", viewId: url.searchParams.get("viewId") ?? undefined }); return data ? NextResponse.json({ success: true, data }, { headers: WORKSPACE_NO_STORE }) : invalid("Database or saved view not found.", 404); } catch { return workspaceError(); }
}
export async function recordPost(request: Request, context: Context<"databaseId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const body = await mutationBody(request, 48_000); if (!body.success) return body.response; const { databaseId } = await context.params;
  try { return workspaceResult(await createWorkspaceDatabaseRecord(auth.user.id, databaseId, body.value)); } catch { return workspaceError(); }
}
export async function recordPatch(request: Request, context: Context<"databaseId" | "recordId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const body = await mutationBody(request, 48_000); if (!body.success) return body.response; const { databaseId, recordId } = await context.params;
  try { return workspaceResult(await updateWorkspaceDatabaseRecord(auth.user.id, databaseId, recordId, body.value)); } catch { return workspaceError(); }
}
export async function recordDelete(request: Request, context: Context<"databaseId" | "recordId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const { databaseId, recordId } = await context.params;
  try { return workspaceResult(await deleteWorkspaceDatabaseRecord(auth.user.id, databaseId, recordId)); } catch { return workspaceError(); }
}
export async function recordDuplicate(request: Request, context: Context<"databaseId" | "recordId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const { databaseId, recordId } = await context.params;
  try { return workspaceResult(await duplicateWorkspaceDatabaseRecord(auth.user.id, databaseId, recordId)); } catch { return workspaceError(); }
}
export async function viewPost(request: Request, context: Context<"databaseId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const body = await mutationBody(request, 12_000); if (!body.success) return body.response; const { databaseId } = await context.params;
  try { return workspaceResult(await createWorkspaceDatabaseView(auth.user.id, databaseId, body.value)); } catch { return workspaceError(); }
}
export async function viewPatch(request: Request, context: Context<"databaseId" | "viewId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const body = await mutationBody(request, 12_000); if (!body.success) return body.response; const { databaseId, viewId } = await context.params;
  try { return workspaceResult(await updateWorkspaceDatabaseView(auth.user.id, databaseId, viewId, body.value)); } catch { return workspaceError(); }
}
export async function viewDelete(request: Request, context: Context<"databaseId" | "viewId">) {
  const auth = await authorized(request, true); if (auth.response || !auth.user) return auth.response; const { databaseId, viewId } = await context.params;
  try { return workspaceResult(await deleteWorkspaceDatabaseView(auth.user.id, databaseId, viewId)); } catch { return workspaceError(); }
}
