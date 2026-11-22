import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";
import { answerPersonalQuestion, answerWithoutPersonalRecords, derivePersonalInsights, normalizeIntelligencePermissions, normalizePersonalContext, parseIntelligenceSources } from "@/lib/personal-intelligence-core";
import { getPersonalFinance } from "@/lib/personal-workspace-finance";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const MAX_BODY_BYTES = 8192;

async function readBoundedBody(request: Request): Promise<string | null> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function POST(request: Request) {
  const originFailure = requireSameOriginApiRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    const raw = await readBoundedBody(request);
    if (raw === null) return NextResponse.json({ success: false, message: "Request is too large." }, { status: 413, headers: NO_STORE });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400, headers: NO_STORE });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body) || Object.getPrototypeOf(body) !== Object.prototype) {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400, headers: NO_STORE });
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "sources" && key !== "question") || !Object.hasOwn(record, "sources")) {
    return NextResponse.json({ success: false, message: "Unsupported intelligence request." }, { status: 400, headers: NO_STORE });
  }
  const sources = parseIntelligenceSources(record.sources);
  const question = record.question === undefined ? "" : typeof record.question === "string" ? record.question.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 500) : null;
  if (!sources || question === null) return NextResponse.json({ success: false, message: "Choose valid context sources and provide a short question." }, { status: 400, headers: NO_STORE });

  const financeQuestion = Boolean(question && /finance|financial|money|budget|saving|debt|income|expense|wealth/i.test(question));
  const selectedFinance = sources.includes("PERSONAL_FINANCE");
  const independentAnswer = question ? answerWithoutPersonalRecords(question) : null;
  if ((independentAnswer && !(financeQuestion && selectedFinance)) || sources.length === 0) {
    const insights = independentAnswer ?? (question ? answerPersonalQuestion(question, []) : derivePersonalInsights([]));
    return NextResponse.json({ success: true, insights, sourcesUsed: [], contextWindowDays: { past: 30, future: 14 }, persistence: "request-only" }, { headers: NO_STORE });
  }

  try {
    const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: auth.user.id }, select: { id: true, intelligencePermissions: true } });
    if (!workspace) {
      if (sources.length > 0) return NextResponse.json({ success: false, message: "Enable each context source in your Personal Intelligence settings before using it." }, { status: 403, headers: NO_STORE });
      const insights = question ? answerPersonalQuestion(question, []) : derivePersonalInsights([]);
      return NextResponse.json({ success: true, insights, sourcesUsed: [], contextWindowDays: { past: 30, future: 14 }, persistence: "request-only" }, { headers: NO_STORE });
    }
    const permissions = normalizeIntelligencePermissions(workspace.intelligencePermissions);
    if (sources.some((source) => !permissions[source])) {
      return NextResponse.json({ success: false, message: "Enable each context source in your Personal Intelligence settings before using it." }, { status: 403, headers: NO_STORE });
    }

    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const until = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const tasksSelected = sources.includes("TASKS");
    const projectsSelected = sources.includes("PROJECTS");
    const academicsSelected = sources.includes("ACADEMICS");
    const preferencesSelected = sources.includes("WORKSPACE_PREFERENCES");
    const memorySelected = sources.includes("PERSONAL_MEMORY");
    const calendarSelected = sources.includes("CALENDAR_DIARY");
    const pagesSelected = sources.includes("WORKSPACE_PAGES");
    const databasesSelected = sources.includes("WORKSPACE_DATABASES");
    const nutritionSelected = sources.includes("NUTRITION");
    const [tasks, projects, academicActivities, personalMemories, calendarReminders, workspacePages, workspaceDatabases, financeData, nutritionMealCount, nutritionPlanCount] = await Promise.all([
      tasksSelected ? prisma.workspaceTask.findMany({ where: { workspaceId: workspace.id, archivedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] }, OR: [{ dueAt: { gte: since, lte: until } }, { startsAt: { gte: since, lte: until } }] }, orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { startsAt: { sort: "asc", nulls: "last" } }, { id: "asc" }], take: 100, select: { id: true, title: true, status: true, dueAt: true, startsAt: true, updatedAt: true } }) : Promise.resolve([]),
      projectsSelected ? prisma.workspaceProject.findMany({ where: { workspaceId: workspace.id, archivedAt: null, status: { in: ["PLANNED", "ACTIVE", "ON_HOLD"] }, OR: [{ targetAt: { gte: since, lte: until } }, { milestones: { some: { completedAt: null, targetAt: { gte: since, lte: until } } } }] }, orderBy: [{ targetAt: { sort: "asc", nulls: "last" } }, { id: "asc" }], take: 50, select: { id: true, name: true, status: true, targetAt: true, updatedAt: true, milestones: { where: { completedAt: null, targetAt: { gte: since, lte: until } }, orderBy: [{ targetAt: "asc" }, { id: "asc" }], take: 50, select: { id: true, title: true, targetAt: true, updatedAt: true } } } }) : Promise.resolve([]),
      academicsSelected ? prisma.academicActivity.findMany({ where: { workspaceId: workspace.id, archivedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] }, OR: [{ dueAt: { gte: since, lte: until } }, { dueOn: { gte: since, lte: until } }, { startsAt: { gte: since, lte: until } }] }, orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { dueOn: { sort: "asc", nulls: "last" } }, { startsAt: { sort: "asc", nulls: "last" } }, { id: "asc" }], take: 100, select: { id: true, title: true, status: true, dueAt: true, dueOn: true, startsAt: true, endsAt: true, updatedAt: true, course: { select: { name: true, academicYear: { select: { name: true } }, terms: { where: { term: { isCurrent: true, archivedAt: null } }, take: 1, select: { term: { select: { name: true } } } } } } } }) : Promise.resolve([]),
      memorySelected ? prisma.workspaceIntelligenceMemory.findMany({ where: { workspaceId: workspace.id, enabled: true }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 20, select: { id: true, label: true, content: true, updatedAt: true } }) : Promise.resolve([]),
      calendarSelected ? prisma.workspaceReminder.findMany({ where: { workspaceId: workspace.id, status: "SCHEDULED", dismissedAt: null, remindAt: { gte: since, lte: until } }, orderBy: [{ remindAt: "asc" }, { id: "asc" }], take: 100, select: { id: true, remindAt: true, status: true, updatedAt: true, block: { select: { page: { select: { title: true } } } } } }) : Promise.resolve([]),
      pagesSelected ? prisma.workspacePage.findMany({ where: { workspaceId: workspace.id, archivedAt: null, deletedAt: null }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 100, select: { id: true, title: true, updatedAt: true } }) : Promise.resolve([]),
      databasesSelected ? prisma.workspaceDatabase.findMany({ where: { workspaceId: workspace.id, archivedAt: null }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 50, select: { id: true, name: true, updatedAt: true, _count: { select: { records: true } } } }).then((databases) => databases.map((database) => ({ id: database.id, name: `${database.name} · ${database._count.records} records`, updatedAt: database.updatedAt }))) : Promise.resolve([]),
      selectedFinance ? getPersonalFinance(auth.user.id, { from: since.toISOString().slice(0, 10), to: until.toISOString().slice(0, 10) }) : Promise.resolve(null),
      nutritionSelected ? prisma.nutritionMeal.count({ where: { workspaceId: workspace.id, consumedAt: { gte: since, lte: now } } }) : Promise.resolve(0),
      nutritionSelected ? prisma.nutritionMealPlan.count({ where: { workspaceId: workspace.id, status: "ACTIVE", startsOn: { lte: until }, endsOn: { gte: since } } }) : Promise.resolve(0),
    ]);
    let workspacePreferences: unknown;
    if (preferencesSelected) {
      workspacePreferences = await prisma.personalWorkspace.findUnique({ where: { userId: auth.user.id }, select: { mode: true, focusAreas: true, timezone: true, workingHoursStart: true, workingHoursEnd: true, updatedAt: true } });
    }
    const milestones = projects.flatMap((project) => project.milestones);
    const calendarRecords = calendarReminders.map((reminder) => ({ id: reminder.id, remindAt: reminder.remindAt, status: reminder.status, updatedAt: reminder.updatedAt, pageTitle: reminder.block.page.title }));
    const academicRecords = academicActivities.map((activity) => ({ ...activity, title: [activity.course?.academicYear.name, activity.course?.terms[0]?.term.name, activity.course?.name, activity.title].filter(Boolean).join(" · ") }));
    const nutritionSummary = nutritionSelected ? { mealCount: nutritionMealCount, planCount: nutritionPlanCount, updatedAt: now } : null;
    const records = normalizePersonalContext({ selectedSources: sources, tasks, projects, milestones, academicActivities: academicRecords, workspacePreferences, personalMemories, calendarReminders: calendarRecords, workspacePages, workspaceDatabases, finance: financeData, nutritionSummary });
    const insights = question ? (financeQuestion && selectedFinance ? derivePersonalInsights(records, now) : answerPersonalQuestion(question, records, now)) : derivePersonalInsights(records, now);
    return NextResponse.json({ success: true, insights, sourcesUsed: sources, contextWindowDays: { past: 30, future: 14 }, persistence: "request-only" }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ success: false, message: "Personal context is temporarily unavailable. No recommendations were generated." }, { status: 503, headers: NO_STORE });
  }
}
