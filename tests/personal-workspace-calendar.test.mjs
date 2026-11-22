import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__workspaceCalendar = {};

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: data("export {};"), shortCircuit: true };
  if (specifier === "@/lib/prisma") return { url: data("export const prisma=new Proxy({}, {get(_target,key){return globalThis.__workspaceCalendar.prisma?.[key]}});"), shortCircuit: true };
  if (specifier === "@/lib/consultations/timezone-core") return { url: new URL("../src/lib/consultations/timezone-core.ts", import.meta.url).href, shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-academics-core") return { url: new URL("../src/lib/personal-workspace-academics-core.ts", import.meta.url).href, shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-planning") return { url: data("export async function withWorkspaceTransaction(){throw new Error('Unexpected mutation helper call');}"), shortCircuit: true };
  return nextResolve(specifier, context);
} });

const core = await import("../src/lib/personal-workspace-calendar-core.ts");
const service = await import("../src/lib/personal-workspace-academics.ts");

function fixture(overrides = {}) {
  const state = {
    ownerId: "owner-a",
    workspace: { id: "workspace-a", timezone: "America/Los_Angeles", weekStartsOn: 1 },
    portfolio: { id: "portfolio-a" },
    activities: [], rules: [], tasks: [], milestones: [], consultations: [], followUps: [], unscheduledLeads: [], unscheduledTasks: [], overdueFollowUps: [], overdueTasks: [], financeReminders: [], nutritionPlans: [], nutritionReminders: [], calls: [],
    ...overrides,
  };
  const argsFor = (source) => async (args) => { state.calls.push({ source, args }); return state[source]; };
  state.prisma = {
    personalWorkspace: { findUnique: async ({ where }) => where.userId === state.ownerId ? state.workspace : null },
    academicActivity: { findMany: argsFor("activities") },
    academicClassTimetableRule: { findMany: argsFor("rules") },
    workspaceTask: { findMany: async (args) => { state.calls.push({ source: "tasks", args }); return args.where.OR ? state.tasks : args.where.startsAt === null ? state.unscheduledTasks : state.overdueTasks; } },
    workspaceProjectMilestone: { findMany: argsFor("milestones") },
    portfolioSite: { findUnique: async ({ where }) => where.userId === state.ownerId ? state.portfolio : null },
    consultation: { findMany: argsFor("consultations") },
    lead: { findMany: async (args) => { state.calls.push({ source: "leads", args }); const date = args.where.nextFollowUpAt; return date?.gte ? state.followUps : date?.lt ? state.overdueFollowUps : state.unscheduledLeads; } },
    workspaceFinanceReminder: { findMany: argsFor("financeReminders") },
    nutritionMealPlanItem: { findMany: argsFor("nutritionPlans") },
    nutritionReminder: { findMany: argsFor("nutritionReminders") },
  };
  globalThis.__workspaceCalendar.prisma = state.prisma;
  return state;
}

test("calendar period navigation preserves selected dates and bounds month, week, day, and agenda ranges", () => {
  assert.deepEqual(core.calendarPeriodRange("2026-03-18", "month", 1), { from: "2026-02-23", to: "2026-04-05" });
  assert.deepEqual(core.calendarPeriodRange("2026-03-18", "week", 0), { from: "2026-03-15", to: "2026-03-21" });
  assert.deepEqual(core.calendarPeriodRange("2026-03-18", "day"), { from: "2026-03-18", to: "2026-03-18" });
  assert.deepEqual(core.calendarPeriodRange("2026-03-18", "agenda"), { from: "2026-03-18", to: "2026-04-16" });
  assert.equal(core.calendarGridDates("2026-03-18", 1).length, 42);
  assert.throws(() => core.calendarPeriodRange("2026-02-30", "month"), /invalid/i);
});

test("calendar grouping converts UTC instants to the selected IANA timezone across DST", () => {
  const beforeLocalMidnight = { sourceType: "CLASS", sourceId: "a", title: "Late", startAt: "2026-03-08T07:30:00.000Z", timezone: "America/Los_Angeles" };
  const afterLocalMidnight = { sourceType: "CLASS", sourceId: "b", title: "Morning", startAt: "2026-03-08T08:30:00.000Z", timezone: "America/Los_Angeles" };
  assert.equal(core.eventCalendarDate(beforeLocalMidnight), "2026-03-07");
  assert.equal(core.eventCalendarDate(afterLocalMidnight), "2026-03-08");
  assert.equal(core.eventCalendarDate({ sourceType: "ASSIGNMENT_DEADLINE", sourceId: "c", title: "Essay", date: "2026-03-08" }), "2026-03-08");
});

test("combined projection is owner-scoped, bounded, and keeps source identities and read-only consultations", async () => {
  const state = fixture();
  const dueOn = new Date("2026-03-08T00:00:00.000Z");
  state.activities = [{ id: "assignment-1", kind: "ASSIGNMENT", title: "Essay", description: "Submit", startsAt: null, endsAt: null, dueAt: null, dueOn, timezone: null, status: "PLANNED", course: { id: "course-1", name: "History", code: "HIS" }, taskLinks: [], projectLinks: [] }];
  state.tasks = [
    { id: "task-same-day", title: "Read", description: null, status: "TODO", startsAt: new Date("2026-03-08T18:00:00.000Z"), dueAt: new Date("2026-03-08T19:00:00.000Z"), projectId: null, project: null },
    { id: "task-due-only-in-range", title: "Finish draft", description: "Task begins earlier", status: "IN_PROGRESS", startsAt: new Date("2026-03-07T18:00:00.000Z"), dueAt: new Date("2026-03-08T17:00:00.000Z"), projectId: "project-1", project: { id: "project-1", name: "Research" } },
    { id: "task-two-dates", title: "Prepare presentation", description: null, status: "TODO", startsAt: new Date("2026-03-08T18:00:00.000Z"), dueAt: new Date("2026-03-09T18:00:00.000Z"), projectId: null, project: null },
  ];
  state.milestones = [{ id: "milestone-1", title: "Review", description: "Check progress", targetAt: new Date("2026-03-09T12:00:00.000Z"), completedAt: null, project: { id: "project-1", name: "Research" } }];
  state.consultations = [
    { id: "consultation-1", title: "Planning call", scheduledAt: new Date("2026-03-08T19:00:00.000Z"), durationMinutes: 30, timezone: "America/Los_Angeles", status: "CONFIRMED", lead: { id: "lead-1", name: "Amina" }, consultationType: { title: "Strategy session" } },
    { id: "consultation-cancelled", title: "Cancelled call", scheduledAt: new Date("2026-03-09T19:00:00.000Z"), durationMinutes: 30, timezone: "America/Los_Angeles", status: "CANCELLED", lead: { id: "lead-4", name: "Imani" }, consultationType: { title: "Review" } },
    { id: "consultation-completed", title: "Completed call", scheduledAt: new Date("2026-03-10T19:00:00.000Z"), durationMinutes: 30, timezone: "America/Los_Angeles", status: "COMPLETED", lead: { id: "lead-5", name: "Ayo" }, consultationType: { title: "Planning" } },
  ];
  state.followUps = [{ id: "lead-1", name: "Amina", status: "QUALIFIED", nextFollowUpAt: new Date("2026-03-08T19:00:00.000Z"), nextBestAction: "Review proposal" }, { id: "lead-2", name: "Tariq", status: "CONTACTED", nextFollowUpAt: new Date("2026-03-09T08:00:00.000Z"), nextBestAction: "Call to confirm scope" }];
  state.unscheduledLeads = [{ id: "lead-3", name: "Maya", status: "NEW", nextBestAction: "Qualify the request" }];
  state.unscheduledTasks = [{ id: "task-unscheduled", title: "Prepare notes", description: null, status: "INBOX", priority: "HIGH", project: null }];
  state.overdueFollowUps = [{ id: "lead-old", name: "Noor", status: "QUALIFIED", nextFollowUpAt: new Date("2026-03-07T10:00:00.000Z"), nextBestAction: "Send the revised estimate" }];
  state.overdueTasks = [{ id: "task-overdue", title: "Submit draft", description: null, status: "TODO", priority: "URGENT", startsAt: null, dueAt: new Date("2026-03-07T12:00:00.000Z"), project: null }];

  const result = await service.getAcademicCalendar("owner-a", "2026-03-08", "2026-03-14", new Date("2026-03-08T00:00:00.000Z"));
  assert.equal(result.ok, true);
  const events = result.value.events;
  assert.ok(events.some((event) => event.sourceType === "ASSIGNMENT_DEADLINE" && event.sourceId === "assignment-1" && event.date === "2026-03-08"));
  assert.equal(events.filter((event) => event.sourceId === "task-same-day").length, 1);
  assert.equal(events.find((event) => event.sourceId === "task-same-day").endAt, "2026-03-08T19:00:00.000Z");
  assert.deepEqual(events.filter((event) => event.sourceId === "task-due-only-in-range").map((event) => event.sourceType), ["WORKSPACE_TASK_DEADLINE"]);
  assert.deepEqual(events.filter((event) => event.sourceId === "task-two-dates").map((event) => event.sourceType), ["WORKSPACE_TASK", "WORKSPACE_TASK_DEADLINE"]);
  assert.ok(events.some((event) => event.sourceType === "WORKSPACE_MILESTONE" && event.description === "Check progress"));
  const consultation = events.find((event) => event.sourceType === "CONSULTATION");
  assert.equal(consultation.readOnly, true);
  assert.equal(consultation.sourceId, "consultation-1");
  assert.deepEqual(consultation.lead, { id: "lead-1", name: "Amina" });
  assert.equal(consultation.purpose, "Strategy session");
  assert.equal(core.calendarEventHref(consultation), "/dashboard/leads/lead-1");
  assert.ok(events.some((event) => event.sourceId === "consultation-cancelled" && event.status === "CANCELLED"));
  assert.ok(events.some((event) => event.sourceId === "consultation-completed" && event.status === "COMPLETED"));
  assert.equal(events.filter((event) => event.sourceType === "CRM_LEAD_FOLLOW_UP" && event.sourceId === "lead-1").length, 0, "a follow-up linked to a consultation at the same time is projected once");
  assert.ok(events.some((event) => event.sourceType === "CRM_LEAD_FOLLOW_UP" && event.sourceId === "lead-2" && event.purpose === "Call to confirm scope"));
  assert.ok(result.value.unscheduled.some((event) => event.sourceType === "CRM_LEAD_UNSCHEDULED" && event.sourceId === "lead-3"));
  assert.ok(result.value.unscheduled.some((event) => event.sourceType === "WORKSPACE_TASK_UNSCHEDULED" && event.sourceId === "task-unscheduled"));
  assert.ok(result.value.overdue.some((event) => event.sourceType === "CRM_LEAD_FOLLOW_UP" && event.sourceId === "lead-old"));
  assert.ok(result.value.overdue.some((event) => event.sourceType === "WORKSPACE_TASK_DEADLINE" && event.sourceId === "task-overdue"));
  assert.equal(result.value.timezone, "America/Los_Angeles");
  assert.equal(result.value.weekStartsOn, 1);

  const taskQuery = state.calls.find((call) => call.source === "tasks").args;
  assert.equal(taskQuery.where.workspaceId, "workspace-a");
  assert.equal(taskQuery.where.archivedAt, null);
  assert.equal(taskQuery.take, 501);
  assert.equal(taskQuery.where.OR[0].startsAt.gte.toISOString(), "2026-03-08T08:00:00.000Z");
  const consultationQuery = state.calls.find((call) => call.source === "consultations").args;
  assert.equal(consultationQuery.where.portfolioId, "portfolio-a");
  assert.equal(consultationQuery.where.scheduledAt.gte.toISOString(), "2026-03-08T08:00:00.000Z");
  const followUpQuery = state.calls.find((call) => call.source === "leads").args;
  assert.equal(followUpQuery.where.portfolioId, "portfolio-a");
  assert.deepEqual(followUpQuery.where.status.notIn, ["CONVERTED", "LOST"]);
});

test("recurring classes honor cancellation and replacement exceptions without duplicate occurrences", async () => {
  const state = fixture({
    workspace: { id: "workspace-a", timezone: "Africa/Nairobi", weekStartsOn: 1 },
    portfolio: null,
  });
  const date = (value) => new Date(`${value}T00:00:00.000Z`);
  state.rules = [
    { id: "cancelled-rule", startsOn: date("2026-03-09"), endsOn: date("2026-03-09"), weekdays: [1], localStart: "09:00", localEnd: "10:00", timezone: "Africa/Nairobi", title: "Cancelled", location: null, course: { id: "course-a", name: "Math" }, exceptions: [{ occurrenceOn: date("2026-03-09"), kind: "CANCELLED" }] },
    { id: "moved-rule", startsOn: date("2026-03-10"), endsOn: date("2026-03-10"), weekdays: [2], localStart: "09:00", localEnd: "10:00", timezone: "Africa/Nairobi", title: "Moved", location: null, course: { id: "course-a", name: "Math" }, exceptions: [{ occurrenceOn: date("2026-03-10"), kind: "RESCHEDULED", startsAt: new Date("2026-03-10T22:00:00.000Z"), endsAt: new Date("2026-03-10T23:00:00.000Z"), timezone: "Africa/Nairobi", location: "Room 4" }] },
  ];
  const result = await service.getAcademicCalendar("owner-a", "2026-03-09", "2026-03-15");
  assert.equal(result.ok, true);
  const classes = result.value.events.filter((event) => event.sourceType === "CLASS");
  assert.equal(classes.some((event) => event.sourceId === "cancelled-rule"), false);
  assert.equal(classes.filter((event) => event.sourceId === "moved-rule").length, 1);
  assert.equal(classes.find((event) => event.sourceId === "moved-rule").occurrenceDate, "2026-03-10");
  assert.equal(classes.find((event) => event.sourceId === "moved-rule").date, "2026-03-11");
  assert.equal(classes.find((event) => event.sourceId === "moved-rule").location, "Room 4");
  const range = await service.getAcademicCalendar("owner-a", "2026-03-10", "2026-03-10");
  assert.equal(range.value.events.some((event) => event.sourceType === "CLASS" && event.sourceId === "moved-rule"), false);
});

test("nutrition plans and reminders project once as read-only source-linked calendar events", async () => {
  const state = fixture({
    nutritionPlans: [{ id: "plan-item-1", label: "Githeri lunch", category: "LUNCH", scheduledAt: new Date("2026-03-10T10:00:00.000Z"), plan: { profile: { displayName: "Amara" } } }],
    nutritionReminders: [{ id: "nutrition-reminder-1", title: "Plan meals", kind: "MEAL_PLANNING", remindAt: new Date("2026-03-11T12:00:00.000Z"), timezone: "Africa/Nairobi", profile: { displayName: "Amara" } }],
  });
  const result = await service.getAcademicCalendar("owner-a", "2026-03-08", "2026-03-14");
  const plans = result.value.events.filter((event) => event.sourceType.startsWith("WORKSPACE_NUTRITION_"));
  assert.equal(plans.length, 2);
  assert.ok(plans.every((event) => event.readOnly === true));
  assert.equal(plans.find((event) => event.sourceId === "plan-item-1").title, "Githeri lunch · Amara");
  assert.equal(state.calls.find((call) => call.source === "nutritionPlans").args.where.workspaceId, "workspace-a");
});

test("a workspace-less account receives a stable empty calendar configuration", async () => {
  const state = fixture({ workspace: null });
  const result = await service.getAcademicCalendar("owner-a", "2026-03-08", "2026-03-14");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { events: [], conflicts: [], unscheduled: [], overdue: [], from: "2026-03-08", to: "2026-03-14", timezone: "Africa/Nairobi", weekStartsOn: 1, truncated: false });
  assert.equal(state.calls.length, 0);
});

test("invalid and oversized date ranges are rejected before calendar source reads", async () => {
  const state = fixture();
  assert.equal((await service.getAcademicCalendar("owner-a", "2026-02-30", "2026-03-01")).ok, false);
  assert.equal((await service.getAcademicCalendar("owner-a", "2026-01-01", "2026-03-10")).ok, false);
  assert.equal(state.calls.length, 0);
});

test("filters combine categories and event destinations return to authoritative modules", () => {
  const events = [
    { sourceType: "ASSIGNMENT_DEADLINE", sourceId: "a", title: "Essay" },
    { sourceType: "WORKSPACE_TASK_DEADLINE", sourceId: "t", title: "Task" },
    { sourceType: "WORKSPACE_MILESTONE", sourceId: "m", title: "Milestone", project: { id: "p/1", name: "Project" } },
    { sourceType: "CONSULTATION", sourceId: "c", title: "Call", readOnly: true },
    { sourceType: "CONSULTATION", sourceId: "linked-c", title: "Linked call", lead: { id: "lead/2", name: "Lead" }, readOnly: true },
    { sourceType: "CRM_LEAD_FOLLOW_UP", sourceId: "lead/1", title: "Follow-up" },
  ];
  const filtered = core.filterCalendarEvents(events, { academic: true, tasks: false, milestones: true, consultations: false, crm: true });
  assert.deepEqual(filtered.map((event) => event.sourceId), ["a", "m", "lead/1"]);
  assert.equal(core.calendarEventHref(events[0]), "/dashboard/workspace/academics/assignments");
  assert.equal(core.calendarEventHref(events[1]), "/dashboard/workspace/tasks");
  assert.equal(core.calendarEventHref(events[2]), "/dashboard/workspace/projects/p%2F1");
  assert.equal(core.calendarEventHref(events[3]), "/dashboard/consultations");
  assert.equal(core.calendarEventHref(events[4]), "/dashboard/leads/lead%2F2");
  assert.equal(core.calendarEventHref(events[5]), "/dashboard/leads/lead%2F1");
});
