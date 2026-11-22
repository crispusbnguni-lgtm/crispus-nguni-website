import "server-only";
import { NextResponse } from "next/server";
import { workspaceApiUser, workspaceError, workspaceJson, workspaceResult, WORKSPACE_NO_STORE } from "@/lib/personal-workspace-api";
import {
  academicDashboard,
  createAcademicActivity,
  createAcademicCourse,
  createAcademicTerm,
  createAcademicYear,
  createTimetableRule,
  deleteTimetableException,
  getAcademicCalendar,
  getAcademicProfile,
  listAcademicActivities,
  listAcademicCourses,
  listAcademicTerms,
  listAcademicYears,
  saveAcademicProfile,
  saveTimetableException,
  listTimetableRules,
  setAcademicActivityLink,
  updateAcademicActivity,
  updateAcademicCourse,
  updateAcademicTerm,
  updateAcademicYear,
  updateTimetableRule,
} from "@/lib/personal-workspace-academics";

type Context = { params: Promise<{ resource?: string; id?: string; occurrenceOn?: string }> };
const resources = new Set(["profile", "years", "terms", "courses", "timetable", "assignments", "exams", "study", "calendar", "overview"]);
function invalid(message: string, status = 400) { return NextResponse.json({ success: false, message }, { status, headers: WORKSPACE_NO_STORE }); }
async function authorize(request: Request, mutation = false) { const result = await workspaceApiUser(request, mutation); return result.response || !result.user ? result : { user: result.user, response: null }; }
async function body(request: Request) { const result = await workspaceJson(request, 32_000); if (!result.success) return result; if (typeof result.value !== "object" || result.value === null || Array.isArray(result.value)) return { success: false as const, response: invalid("Request body must be an object.") }; return result; }
function hasForgedOwnership(value: Record<string, unknown>) { return ["userId", "ownerUserId", "workspaceId", "role"].some((key) => key in value); }
function scalar(url: URL, keys: string[]) { for (const key of keys) if (url.searchParams.getAll(key).length > 1) return false; return true; }
function queryBool(url: URL, key: string) { const value = url.searchParams.get(key); return value === "true" ? true : value === "false" ? false : undefined; }

export async function getAcademicResource(request: Request, context: Context) {
  const auth = await authorize(request); if (auth.response || !auth.user) return auth.response;
  const { resource } = await context.params; if (!resource || !resources.has(resource)) return invalid("Academic resource not found.", 404);
  const url = new URL(request.url); const queryKeys = ["yearId", "termId", "courseId", "kind", "status", "archived", "from", "to"];
  if (Array.from(url.searchParams.keys()).some((key) => !queryKeys.includes(key))) return invalid("Unsupported query parameter.");
  if (!scalar(url, queryKeys)) return invalid("Repeated query parameters are not supported.");
  if (resource === "profile") { try { return NextResponse.json({ success: true, data: await getAcademicProfile(auth.user.id) }, { headers: WORKSPACE_NO_STORE }); } catch { return workspaceError(); } }
  if (resource === "calendar") {
    const from = url.searchParams.get("from"); const to = url.searchParams.get("to"); if (!from || !to) return invalid("Calendar from and to dates are required.");
    try { return workspaceResult(await getAcademicCalendar(auth.user.id, from, to)); } catch { return workspaceError(); }
  }
  if (resource === "overview") { try { return NextResponse.json({ success: true, data: await academicDashboard(auth.user.id) }, { headers: WORKSPACE_NO_STORE }); } catch { return workspaceError(); } }
  const archived = queryBool(url, "archived"); if (url.searchParams.has("archived") && archived === undefined) return invalid("Archive filter is invalid.");
  try {
    if (resource === "years") return NextResponse.json({ success: true, data: await listAcademicYears(auth.user.id, archived ?? false) }, { headers: WORKSPACE_NO_STORE });
    if (resource === "terms") return NextResponse.json({ success: true, data: await listAcademicTerms(auth.user.id, url.searchParams.get("yearId") ?? undefined, archived ?? false) }, { headers: WORKSPACE_NO_STORE });
    if (resource === "courses") return NextResponse.json({ success: true, data: await listAcademicCourses(auth.user.id, { yearId: url.searchParams.get("yearId") ?? undefined, termId: url.searchParams.get("termId") ?? undefined, archived: archived ?? false }) }, { headers: WORKSPACE_NO_STORE });
    if (resource === "timetable") return NextResponse.json({ success: true, data: await listTimetableRules(auth.user.id, archived ?? false) }, { headers: WORKSPACE_NO_STORE });
    const kind = resource === "assignments" ? "ASSIGNMENT" : resource === "exams" ? "EXAM" : resource === "study" ? "STUDY_SESSION" : undefined;
    if (url.searchParams.has("kind") && url.searchParams.get("kind") !== kind) return invalid("Academic activity kind is invalid.");
    const status = url.searchParams.get("status") ?? undefined;
    if (status && !["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)) return invalid("Activity status is invalid.");
    return NextResponse.json({ success: true, data: await listAcademicActivities(auth.user.id, { kind, courseId: url.searchParams.get("courseId") ?? undefined, status: status as "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | undefined, archived: archived ?? false }) }, { headers: WORKSPACE_NO_STORE });
  } catch { return workspaceError(); }
}

export async function postAcademicResource(request: Request, context: Context) {
  const auth = await authorize(request, true); if (auth.response || !auth.user) return auth.response;
  const { resource } = await context.params; if (!resource || !resources.has(resource) || resource === "overview" || resource === "calendar") return invalid("Academic resource does not support creation.", 404);
  const parsed = await body(request); if (!parsed.success) return parsed.response;
  const input = parsed.value as Record<string, unknown>;
  if (hasForgedOwnership(input)) return invalid("Ownership fields are not accepted.");
  try {
    const operation = resource === "profile" ? saveAcademicProfile(auth.user.id, input)
      : resource === "years" ? createAcademicYear(auth.user.id, input)
      : resource === "terms" ? createAcademicTerm(auth.user.id, input)
      : resource === "courses" ? createAcademicCourse(auth.user.id, input)
      : resource === "timetable" ? createTimetableRule(auth.user.id, input)
      : createAcademicActivity(auth.user.id, { ...input, kind: resource === "assignments" ? "ASSIGNMENT" : resource === "exams" ? "EXAM" : "STUDY_SESSION" });
    return workspaceResult(await operation);
  } catch { return workspaceError(); }
}

export async function patchAcademicResource(request: Request, context: Context) {
  const auth = await authorize(request, true); if (auth.response || !auth.user) return auth.response;
  const { resource, id } = await context.params; if (!id || !resource || !resources.has(resource) || resource === "overview" || resource === "calendar") return invalid("Academic resource not found.", 404);
  const parsed = await body(request); if (!parsed.success) return parsed.response;
  if (hasForgedOwnership(parsed.value as Record<string, unknown>)) return invalid("Ownership fields are not accepted.");
  try {
    const operation = resource === "profile" ? saveAcademicProfile(auth.user.id, parsed.value)
      : resource === "years" ? updateAcademicYear(auth.user.id, id, parsed.value)
      : resource === "terms" ? updateAcademicTerm(auth.user.id, id, parsed.value)
      : resource === "courses" ? updateAcademicCourse(auth.user.id, id, parsed.value)
      : resource === "timetable" ? updateTimetableRule(auth.user.id, id, parsed.value)
      : updateAcademicActivity(auth.user.id, id, parsed.value);
    return workspaceResult(await operation);
  } catch { return workspaceError(); }
}

export async function deleteAcademicResource(request: Request, context: Context) {
  const auth = await authorize(request, true); if (auth.response || !auth.user) return auth.response;
  const { resource, id } = await context.params; if (!id || !resource || !["years", "terms", "courses", "timetable", "assignments", "exams", "study"].includes(resource)) return invalid("Academic resource not found.", 404);
  const parsed = await body(request); if (!parsed.success) return parsed.response;
  if (Object.keys(parsed.value as Record<string, unknown>).some((key) => key !== "expectedRevision")) return invalid("Only the expected revision is accepted for archiving.");
  if (!Number.isInteger((parsed.value as Record<string, unknown>).expectedRevision)) return invalid("Expected revision is required.");
  const input = { expectedRevision: (parsed.value as Record<string, unknown>).expectedRevision, archived: true };
  try {
    const operation = resource === "years" ? updateAcademicYear(auth.user.id, id, input)
      : resource === "terms" ? updateAcademicTerm(auth.user.id, id, input)
      : resource === "courses" ? updateAcademicCourse(auth.user.id, id, input)
      : resource === "timetable" ? updateTimetableRule(auth.user.id, id, input)
      : updateAcademicActivity(auth.user.id, id, input);
    return workspaceResult(await operation);
  } catch { return workspaceError(); }
}

export async function postTimetableException(request: Request, context: Context) {
  const auth = await authorize(request, true); if (auth.response || !auth.user) return auth.response;
  const { id } = await context.params; if (!id) return invalid("Timetable rule is required.");
  const parsed = await body(request); if (!parsed.success) return parsed.response;
  try { return workspaceResult(await saveTimetableException(auth.user.id, id, parsed.value)); } catch { return workspaceError(); }
}

export async function deleteTimetableExceptionRoute(request: Request, context: Context) {
  const auth = await authorize(request, true); if (auth.response || !auth.user) return auth.response;
  const { id, occurrenceOn } = await context.params; if (!id || !occurrenceOn) return invalid("Timetable exception is required.");
  try { return workspaceResult(await deleteTimetableException(auth.user.id, id, occurrenceOn)); } catch { return workspaceError(); }
}

export async function changeAcademicActivityLink(request: Request, context: Context, linked: boolean) {
  const auth = await authorize(request, true); if (auth.response || !auth.user) return auth.response;
  const { id } = await context.params; if (!id) return invalid("Academic activity is required.");
  const parsed = await body(request); if (!parsed.success) return parsed.response;
  const value = parsed.value as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "targetId,type" || (value.type !== "task" && value.type !== "project") || typeof value.targetId !== "string") return invalid("Academic link is invalid.");
  try { return workspaceResult(await setAcademicActivityLink(auth.user.id, id, { type: value.type, targetId: value.targetId }, linked)); } catch { return workspaceError(); }
}
