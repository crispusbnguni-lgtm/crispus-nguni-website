import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__personalIntelligenceTest = { user: { id: "owner-verified", role: "USER" }, calls: [], financeCalls: [], financeData: null, prisma: {} };
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: data("export {};"), shortCircuit: true };
  if (specifier === "next/server") return { url: data("export const NextResponse={json:(body,init)=>Response.json(body,init)};"), shortCircuit: true };
  if (specifier === "@/lib/prisma") return { url: data("export const prisma=new Proxy({}, {get(_target,key){return globalThis.__personalIntelligenceTest.prisma[key]}});"), shortCircuit: true };
  if (specifier === "@/lib/authorization") return { url: data(`
    export function requireSameOriginApiRequest(request) { const origin=request.headers.get('origin'); try { if(origin && new URL(origin).origin===origin && new URL(request.url).origin===origin) return null; } catch {} return Response.json({success:false},{status:403}); }
    export async function requireApiUser() { const user=globalThis.__personalIntelligenceTest.user; return user ? {user,response:null} : {user:null,response:Response.json({success:false},{status:401})}; }
  `), shortCircuit: true };
  if (specifier === "@/lib/personal-intelligence-core") return { url: new URL("../src/lib/personal-intelligence-core.ts", import.meta.url).href, shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-finance") return { url: data(`export async function getPersonalFinance(...args){const s=globalThis.__personalIntelligenceTest;s.financeCalls.push(args);return s.financeData;}`), shortCircuit: true };
  return nextResolve(specifier, context);
} });

const core = await import("../src/lib/personal-intelligence-core.ts");
const route = await import("../src/app/api/dashboard/workspace/intelligence/route.ts");
const url = "https://workspace.test/api/dashboard/workspace/intelligence";
const request = (body, origin = "https://workspace.test") => new Request(url, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

function setup({ user = { id: "owner-verified", role: "USER" }, tasks = [], projects = [], academics = [], memories = [], reminders = [], pages = [], databases = [], preferences = null, permissions = null } = {}) {
  const state = globalThis.__personalIntelligenceTest;
  state.user = user; state.calls = []; state.financeCalls = []; state.financeData = null;
  state.prisma = {
    personalWorkspace: { findUnique: async (args) => { state.calls.push(["workspace", args]); if (args.where.userId !== user?.id) return null; return args.select.mode ? { id: "workspace-owned", ...(preferences ?? {}) } : { id: "workspace-owned", intelligencePermissions: permissions ?? core.DEFAULT_INTELLIGENCE_PERMISSIONS }; } },
    workspaceTask: { findMany: async (args) => { state.calls.push(["tasks", args]); return tasks; } },
    workspaceProject: { findMany: async (args) => { state.calls.push(["projects", args]); return projects; } },
    academicActivity: { findMany: async (args) => { state.calls.push(["academics", args]); return academics; } },
    workspaceIntelligenceMemory: { findMany: async (args) => { state.calls.push(["memory", args]); return memories.filter((memory) => memory.enabled && memory.workspaceId === args.where.workspaceId); } },
    workspaceReminder: { findMany: async (args) => { state.calls.push(["calendar", args]); return reminders; } },
    workspacePage: { findMany: async (args) => { state.calls.push(["pages", args]); return pages; } },
    workspaceDatabase: { findMany: async (args) => { state.calls.push(["databases", args]); return databases; } },
  };
  return state;
}

test("source selection is finite, independent, duplicate-free and opt-in", () => {
  assert.deepEqual(core.parseIntelligenceSources([]), []);
  assert.deepEqual(core.parseIntelligenceSources(["ACADEMICS"]), ["ACADEMICS"]);
  assert.deepEqual(core.parseIntelligenceSources(["TASKS", "PROJECTS"]), ["TASKS", "PROJECTS"]);
  assert.deepEqual(core.parseIntelligenceSources(["WORKSPACE_PREFERENCES"]), ["WORKSPACE_PREFERENCES"]);
  assert.equal(core.parseIntelligenceSources(["CRM"]), null);
  assert.deepEqual(core.parseIntelligenceSources(["PERSONAL_FINANCE"]), ["PERSONAL_FINANCE"]);
  assert.equal(core.parseIntelligenceSources(["ACADEMICS", "ACADEMICS"]), null);
  assert.equal(core.parseIntelligenceSources("ACADEMICS"), null);
});

test("finance insights are limited to explicitly selected owner records and distinguish derived observations", () => {
  const now = new Date("2026-11-17T12:00:00.000Z");
  const records = core.normalizePersonalContext({ selectedSources: ["PERSONAL_FINANCE"], finance: {
    history: [{ createdAt: now }],
    summary: [{ currency: "KES", actualIncome: "100.0000", actualExpenses: "125.0000" }],
    budgets: [{ id: "b1", name: "Food", category: "Food", currency: "KES", percent: 120, updatedAt: now }],
    goals: [{ id: "g1", name: "Reserve", currency: "KES", status: "ACTIVE", progressPercent: 10, targetOn: "2026-12-01", updatedAt: now }],
    debts: [{ id: "d1", name: "Loan", currency: "KES", interestType: "UNKNOWN", repaymentAmount: null, nextDueOn: null, updatedAt: now }],
    reminders: [{ id: "r1", title: "Electricity bill", currency: "KES", status: "ACTIVE", remindAt: "2026-11-20T09:00:00.000Z", updatedAt: now }],
  } });
  const insights = core.derivePersonalInsights(records, now);
  assert.ok(insights.some((item) => item.id.startsWith("finance-budget-overrun:")));
  assert.ok(insights.some((item) => item.id.startsWith("finance-cashflow:")));
  assert.ok(insights.some((item) => item.id.startsWith("finance-goal-progress:")));
  assert.ok(insights.some((item) => item.id.startsWith("finance-incomplete:")));
  assert.ok(insights.some((item) => item.type === "UPCOMING" && item.evidence.some((evidence) => evidence.source === "PERSONAL_FINANCE")));
  const noConsent = core.normalizePersonalContext({ selectedSources: [], finance: { summary: [{ currency: "KES", actualIncome: "1", actualExpenses: "2" }] } });
  assert.deepEqual(noConsent, []);
});

test("finance intelligence route requires the stored opt-in and binds the finance query to the authenticated owner", async () => {
  const state = setup();
  const body = { sources: ["PERSONAL_FINANCE"], question: "How are my budgets?" };
  const denied = await route.POST(request(body));
  assert.equal(denied.status, 403);
  assert.equal(state.financeCalls.length, 0);

  const permissions = { ...core.DEFAULT_INTELLIGENCE_PERMISSIONS, PERSONAL_FINANCE: true };
  state.prisma.personalWorkspace.findUnique = async ({ where, select }) => select.mode ? { id: "workspace-owned", ...{} } : { id: "workspace-owned", intelligencePermissions: permissions };
  state.financeData = { history: [], summary: [], budgets: [], goals: [], debts: [], reminders: [] };
  const allowed = await route.POST(request(body));
  assert.equal(allowed.status, 200);
  assert.equal(state.financeCalls.length, 1);
  assert.equal(state.financeCalls[0][0], "owner-verified");
});

test("persistent permission contract defaults every source off and validates a complete settings shape", () => {
  assert.ok(Object.values(core.DEFAULT_INTELLIGENCE_PERMISSIONS).every((enabled) => enabled === false));
  assert.deepEqual(core.parseIntelligencePermissionSet(core.DEFAULT_INTELLIGENCE_PERMISSIONS), core.DEFAULT_INTELLIGENCE_PERMISSIONS);
  assert.equal(core.parseIntelligencePermissionSet({ ...core.DEFAULT_INTELLIGENCE_PERMISSIONS, CRM: true }), null);
  assert.equal(core.parseIntelligencePermissionSet({ ...core.DEFAULT_INTELLIGENCE_PERMISSIONS, PERSONAL_FINANCE: "yes" }), null);
  const input = { ...core.DEFAULT_INTELLIGENCE_PERMISSIONS };
  Object.defineProperty(input, "TASKS", { get() { throw new Error("getter must not execute"); }, enumerable: true });
  assert.equal(core.parseIntelligencePermissionSet(input), null);
  const hostileProxy = new Proxy({}, { getPrototypeOf() { throw new Error("reflection failure"); } });
  assert.equal(core.parseIntelligencePermissionSet(hostileProxy), null);
});

test("permission upgrades preserve prior explicit consent and default new sources off", () => {
  const prior = { TASKS: true, PROJECTS: false, ACADEMICS: true, WORKSPACE_PREFERENCES: false, CALENDAR_DIARY: false, PERSONAL_FINANCE: false, PERSONAL_GOALS_PREFERENCES: false, PERSONAL_MEMORY: false, SECURITY_METADATA: false, FUTURE_MODULES: false };
  const upgraded = core.normalizeIntelligencePermissions(prior);
  assert.equal(upgraded.TASKS, true);
  assert.equal(upgraded.ACADEMICS, true);
  assert.equal(upgraded.WORKSPACE_PAGES, false);
  assert.equal(upgraded.WORKSPACE_DATABASES, false);
});

test("saved dismissal and feedback data are bounded and reject malformed values", () => {
  assert.deepEqual(core.parseDismissedInsightIds(["overdue:1:task:2026-11-18", "overdue:1:task:2026-11-18"]), ["overdue:1:task:2026-11-18"]);
  assert.equal(core.parseDismissedInsightIds(["x".repeat(513)]), null);
  assert.equal(core.parseDismissedInsightIds(Array(101).fill("id")), null);
  assert.deepEqual({ ...core.parseIntelligenceFeedback({ "upcoming:1": "helpful" }) }, { "upcoming:1": "helpful" });
  assert.equal(core.parseIntelligenceFeedback({ invalid: "secret" }), null);
  const accessor = Object.defineProperty({}, "x", { enumerable: true, get() { throw new Error("must not execute"); } });
  assert.equal(core.parseIntelligenceFeedback(accessor), null);
});

test("context normalization retains provenance and only selected sources", () => {
  const rows = core.normalizePersonalContext({ selectedSources: ["TASKS"], tasks: [{ id: "task-1", title: "  Submit essay  ", status: "TODO", dueAt: new Date("2026-11-20T12:00:00Z"), updatedAt: new Date("2026-11-16T12:00:00Z"), description: "should not be retained" }], academicActivities: [{ id: "exam-1", title: "Exam", status: "PLANNED", dueOn: "2026-11-21", updatedAt: "2026-11-16T12:00:00Z" }] });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { id: "task-1", source: "TASKS", kind: "TASK", title: "Submit essay", status: "TODO", dueAt: "2026-11-20T12:00:00.000Z", startsAt: null, endsAt: null, updatedAt: "2026-11-16T12:00:00.000Z", confidence: "OWNER_ENTERED", destination: "/dashboard/workspace/tasks" });
  assert.equal(JSON.stringify(rows).includes("should not be retained"), false);
});

test("personal memory enters context only when its source is explicitly selected", () => {
  const memory = [{ id: "memory_12345678", label: "Planning preference", content: "I prefer small steps.", updatedAt: new Date("2026-11-16T09:00:00Z") }];
  assert.deepEqual(core.normalizePersonalContext({ selectedSources: [], personalMemories: memory }), []);
  const records = core.normalizePersonalContext({ selectedSources: ["PERSONAL_MEMORY"], personalMemories: memory });
  assert.equal(records.length, 1);
  assert.equal(records[0].source, "PERSONAL_MEMORY");
  assert.match(records[0].title, /Planning preference: I prefer small steps/);
  assert.equal(core.derivePersonalInsights(records, new Date("2026-11-17T09:00:00Z")).some((item) => item.type === "PERSONAL_CONTEXT"), true);
});

test("deterministic guidance cites selected evidence and distinguishes insufficient information", () => {
  const now = new Date("2026-11-17T12:00:00.000Z");
  const record = { id: "t1", source: "TASKS", kind: "TASK", title: "Finish report", status: "TODO", dueAt: "2026-11-18T12:00:00.000Z", startsAt: null, endsAt: null, updatedAt: "2026-11-16T09:00:00.000Z", confidence: "OWNER_ENTERED", destination: "/dashboard/workspace/tasks" };
  const insights = core.derivePersonalInsights([record], now);
  assert.equal(insights[0].type, "UPCOMING");
  assert.equal(insights[0].evidence[0].title, "Finish report");
  assert.equal(insights[0].certainty, "Derived from the selected records");
  assert.equal(core.derivePersonalInsights([], now)[0].certainty, "Insufficient selected information");
});

test("schedule-conflict observation requires a real timed overlap in the selected records", () => {
  const now = new Date("2026-11-17T12:00:00.000Z");
  const make = (id, start, end) => ({ id, source: "ACADEMICS", kind: "ACADEMIC_ACTIVITY", title: id, status: "PLANNED", dueAt: null, startsAt: start, endsAt: end, updatedAt: "2026-11-16T09:00:00.000Z", confidence: "OWNER_ENTERED", destination: "/dashboard/workspace/academics" });
  const overlapping = core.derivePersonalInsights([make("long", "2026-11-18T08:00:00Z", "2026-11-18T12:00:00Z"), make("contained", "2026-11-18T09:00:00Z", "2026-11-18T10:00:00Z"), make("later", "2026-11-18T11:00:00Z", "2026-11-18T13:00:00Z")], now);
  assert.equal(overlapping[0].type, "SCHEDULE_CONFLICT");
  const adjacent = core.derivePersonalInsights([make("first", "2026-11-18T08:00:00Z", "2026-11-18T09:00:00Z"), make("second", "2026-11-18T09:00:00Z", "2026-11-18T10:00:00Z")], now);
  assert.equal(adjacent[0].type, "LIMITATION");
});

test("financial and password questions state unavailable context without inventing facts", () => {
  const money = core.answerPersonalQuestion("What financial obligations should I prepare for?", []);
  assert.match(money[0].observation, /not available/i);
  assert.match(money[0].suggestedAction, /saved balance/i);
  const security = core.answerPersonalQuestion("Is my password breached?", []);
  assert.match(security[0].observation, /never included/i);
  assert.doesNotMatch(JSON.stringify([...money, ...security]), /passwordCandidate|balance:|\$\d/);
});

test("unauthenticated and cross-origin requests are rejected before workspace reads", async () => {
  const state = setup({ user: null });
  assert.equal((await route.POST(request({ sources: [] }))).status, 401);
  assert.equal(state.calls.length, 0);
  setup();
  assert.equal((await route.POST(request({ sources: [] }, "https://attacker.test"))).status, 403);
  assert.equal(globalThis.__personalIntelligenceTest.calls.length, 0);
});

test("browser-supplied owner IDs and unapproved sources are rejected", async () => {
  const state = setup({ user: { id: "verified-user", role: "SUPER_ADMIN" } });
  assert.equal((await route.POST(request({ sources: ["TASKS"], userId: "victim" }))).status, 400);
  assert.equal((await route.POST(request({ sources: ["CRM"] }))).status, 400);
  assert.equal(state.calls.length, 0);
});

test("oversized intelligence requests are bounded before any workspace query", async () => {
  const state = setup();
  const response = await route.POST(request({ sources: [], question: "x".repeat(9000) }));
  assert.equal(response.status, 413);
  assert.equal(state.calls.length, 0);
});

test("only the authenticated owner's consented selected task source is queried", async () => {
  const state = setup({ user: { id: "verified-super-admin", role: "SUPER_ADMIN" }, permissions: { ...core.DEFAULT_INTELLIGENCE_PERMISSIONS, TASKS: true }, tasks: [{ id: "t", title: "Overdue task", status: "TODO", dueAt: new Date(Date.now() - 60_000), updatedAt: new Date() }] });
  const response = await route.POST(request({ sources: ["TASKS"], question: "What should I prioritise?" }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.insights[0].type, "OVERDUE");
  assert.equal(body.persistence, "request-only");
  const workspaceCall = state.calls.find(([name]) => name === "workspace");
  assert.equal(workspaceCall[1].where.userId, "verified-super-admin");
  assert.equal(state.calls.some(([name]) => name === "academics"), false);
  assert.deepEqual(state.calls.map(([name]) => name), ["workspace", "tasks"]);
});

test("a request-selected but unconsented source is rejected before its data query", async () => {
  const state = setup({ tasks: [{ id: "private-task", title: "Task", status: "TODO", updatedAt: new Date() }] });
  const response = await route.POST(request({ sources: ["TASKS"] }));
  assert.equal(response.status, 403);
  assert.equal(state.calls.map(([name]) => name).join(","), "workspace");
});

test("project and academic records are fetched only for their independently selected source", async () => {
  const state = setup({
    permissions: { ...core.DEFAULT_INTELLIGENCE_PERMISSIONS, PROJECTS: true, ACADEMICS: true },
    projects: [{ id: "project-1", name: "Exam preparation", status: "ACTIVE", targetAt: new Date("2026-11-20T12:00:00Z"), updatedAt: new Date(), milestones: [] }],
    academics: [{ id: "activity-1", title: "Coursework", status: "PLANNED", dueOn: new Date("2026-11-21T00:00:00Z"), updatedAt: new Date() }],
  });
  assert.equal((await route.POST(request({ sources: ["PROJECTS"] }))).status, 200);
  assert.deepEqual(state.calls.map(([name]) => name), ["workspace", "projects"]);
  state.calls = [];
  assert.equal((await route.POST(request({ sources: ["ACADEMICS"] }))).status, 200);
  assert.deepEqual(state.calls.map(([name]) => name), ["workspace", "academics"]);
});

test("disabled context sources and finance questions cause no source queries", async () => {
  const state = setup();
  const response = await route.POST(request({ sources: [], question: "How am I doing financially?" }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.insights[0].observation, /not available/i);
  assert.equal(state.calls.length, 0);
});

test("workspace preferences are queried only after their source is explicitly selected and consented", async () => {
  const state = setup({ permissions: { ...core.DEFAULT_INTELLIGENCE_PERMISSIONS, WORKSPACE_PREFERENCES: true }, preferences: { mode: "STUDENT", focusAreas: ["STUDY_AND_TIMETABLE"], timezone: "Africa/Nairobi", workingHoursStart: "08:00", workingHoursEnd: "16:00", updatedAt: new Date("2026-11-16T09:00:00Z") } });
  await route.POST(request({ sources: ["WORKSPACE_PREFERENCES"] }));
  const preferenceCall = state.calls.find(([name, args]) => name === "workspace" && args.select.mode);
  assert.ok(preferenceCall);
  assert.equal(preferenceCall[1].where.userId, "owner-verified");
  const normalized = core.normalizePersonalContext({ selectedSources: ["WORKSPACE_PREFERENCES"], workspacePreferences: { mode: "STUDENT", focusAreas: ["STUDY_AND_TIMETABLE"], timezone: "Africa/Nairobi", workingHoursStart: "08:00", workingHoursEnd: "16:00", updatedAt: new Date("2026-11-16T09:00:00Z") } });
  assert.equal(normalized[0].confidence, "OWNER_ENTERED");
  assert.match(normalized[0].title, /Africa\/Nairobi/);
});

test("personal memories require source permission and only individually enabled owner notes are selected", async () => {
  const permissions = { ...core.DEFAULT_INTELLIGENCE_PERMISSIONS, PERSONAL_MEMORY: true };
  const state = setup({ permissions, memories: [
    { id: "on_12345678", workspaceId: "workspace-owned", label: "Preference", content: "Likes short planning blocks", updatedAt: new Date("2026-11-16T09:00:00Z"), enabled: true },
    { id: "off_12345678", workspaceId: "workspace-owned", label: "Disabled", content: "Must not be selected", updatedAt: new Date("2026-11-16T09:00:00Z"), enabled: false },
    { id: "other_12345678", workspaceId: "another-workspace", label: "Other owner", content: "Must not be selected", updatedAt: new Date("2026-11-16T09:00:00Z"), enabled: true },
  ] });
  const response = await route.POST(request({ sources: ["PERSONAL_MEMORY"] }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.insights.some((insight) => insight.evidence.some((evidence) => evidence.title.includes("Likes short planning blocks"))), true);
  assert.equal(body.insights.some((insight) => JSON.stringify(insight).includes("Must not be selected")), false);
  const memoryCall = state.calls.find(([kind]) => kind === "memory");
  assert.deepEqual(memoryCall[1].where, { workspaceId: "workspace-owned", enabled: true });

  const denied = setup({ permissions: core.DEFAULT_INTELLIGENCE_PERMISSIONS, memories: [{ id: "m", workspaceId: "workspace-owned", enabled: true }] });
  assert.equal((await route.POST(request({ sources: ["PERSONAL_MEMORY"] }))).status, 403);
  assert.equal(denied.calls.some(([kind]) => kind === "memory"), false);
});

test("calendar, page and database sources are consent-gated and query only bounded owner-scoped summaries", async () => {
  const permissions = { ...core.DEFAULT_INTELLIGENCE_PERMISSIONS, CALENDAR_DIARY: true, WORKSPACE_PAGES: true, WORKSPACE_DATABASES: true };
  const state = setup({ permissions,
    reminders: [{ id: "reminder_12345678", remindAt: new Date("2026-11-20T10:00:00Z"), status: "SCHEDULED", updatedAt: new Date("2026-11-16T10:00:00Z"), block: { page: { title: "Planning" } } }],
    pages: [{ id: "page_12345678", title: "Personal plan", updatedAt: new Date("2026-11-16T10:00:00Z"), content: "must not be selected" }],
    databases: [{ id: "db_12345678", name: "Reading list", updatedAt: new Date("2026-11-16T10:00:00Z"), _count: { records: 4 }, values: "must not be selected" }],
  });
  const response = await route.POST(request({ sources: ["CALENDAR_DIARY", "WORKSPACE_PAGES", "WORKSPACE_DATABASES"] }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.sourcesUsed, ["CALENDAR_DIARY", "WORKSPACE_PAGES", "WORKSPACE_DATABASES"]);
  assert.equal(JSON.stringify(body.insights).includes("must not be selected"), false);
  for (const key of ["calendar", "pages", "databases"]) {
    const call = state.calls.find(([kind]) => kind === key);
    assert.equal(call[1].where.workspaceId, "workspace-owned");
  }
  assert.deepEqual(state.calls.find(([kind]) => kind === "calendar")[1].where.status, "SCHEDULED");
  assert.deepEqual(state.calls.find(([kind]) => kind === "pages")[1].where.deletedAt, null);

  const disabled = setup({ permissions: core.DEFAULT_INTELLIGENCE_PERMISSIONS });
  const denied = await route.POST(request({ sources: ["CALENDAR_DIARY"] }));
  assert.equal(denied.status, 403);
  assert.equal(disabled.calls.some(([kind]) => kind === "calendar"), false);
});

test("storage failure returns a generic failure and does not leak persistence details", async () => {
  const state = setup({ permissions: { ...core.DEFAULT_INTELLIGENCE_PERMISSIONS, TASKS: true } });
  state.prisma.workspaceTask.findMany = async () => { throw new Error("private database diagnostic"); };
  const response = await route.POST(request({ sources: ["TASKS"] }));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.message, /temporarily unavailable/i);
  assert.doesNotMatch(JSON.stringify(body), /private database diagnostic/);
});

test("personal intelligence page itself requires an authenticated session", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/app/dashboard/workspace/intelligence/page.tsx", import.meta.url), "utf8");
  assert.match(source, /await requireUser\(\)/);
  assert.doesNotMatch(source, /requireSuperAdmin|isSuperAdmin/);
});
