import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__academicsService = {
  profile: null, activities: [], assignments: [], taskLinks: [], availableTasks: ["task-1"],
  transactions: [], rule: null, exceptions: [], workspaceId: "workspace-verified", ownerId: "owner-verified",
  calendarActivities: [], calendarRules: [], calendarTasks: [], calendarMilestones: [], calendarConsultations: [], calendarQueries: [], portfolio: null,
};

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: data("export {};"), shortCircuit: true };
  if (specifier === "@/lib/prisma") return { url: data("export const prisma=globalThis.__academicsService.prisma;"), shortCircuit: true };
  if (specifier === "@/lib/consultations/timezone-core") return { url: new URL("../src/lib/consultations/timezone-core.ts", import.meta.url).href, shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-academics-core") return { url: new URL("../src/lib/personal-workspace-academics-core.ts", import.meta.url).href, shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-planning") return { url: data(`export async function withWorkspaceTransaction(owner,run){const s=globalThis.__academicsService;s.transactions.push(owner);const snapshot=structuredClone({profile:s.profile,activities:s.activities,assignments:s.assignments,taskLinks:s.taskLinks});const tx=s.tx;const result=await run(tx,s.workspaceId);if(result&&result.ok===false){Object.assign(s,snapshot);}return result;}`), shortCircuit: true };
  return nextResolve(specifier, context);
} });

const rows = () => globalThis.__academicsService;
const s = rows();
const makeActivity = (input) => ({ id: `activity-${s.activities.length + 1}`, workspaceId: s.workspaceId, ...input, revision: 0 });
s.tx = {
  $executeRaw: async () => 0,
  academicProfile: {
    findUnique: async () => s.profile ? { revision: s.profile.revision } : null,
    upsert: async ({ create, update }) => { s.profile = s.profile ? { ...s.profile, institution: update.institution ?? s.profile.institution, program: update.program ?? s.profile.program, department: update.department ?? s.profile.department, revision: s.profile.revision + 1 } : { id: "profile-1", ...create, revision: 0 }; return s.profile; },
  },
  academicCourse: { findFirst: async ({ where }) => where.workspaceId === s.workspaceId && where.id === "course-1" ? { id: "course-1" } : null },
  workspaceTask: { count: async ({ where }) => where.workspaceId === s.workspaceId ? where.id.in.filter((id) => s.availableTasks.includes(id)).length : 0, findFirst: async ({ where }) => where.workspaceId === s.workspaceId && s.availableTasks.includes(where.id) ? { id: where.id } : null },
  workspaceProject: { count: async () => 0 },
  academicActivity: {
    create: async ({ data }) => { const row = makeActivity(data); s.activities.push(row); return row; },
    findFirst: async ({ where }) => s.activities.find((row) => row.id === where.id && row.workspaceId === where.workspaceId) ?? null,
    findFirstOrThrow: async ({ where }) => s.activities.find((row) => row.id === where.id && row.workspaceId === where.workspaceId),
  },
  academicAssignment: { create: async ({ data }) => { s.assignments.push(data); return data; } },
  academicExam: { create: async ({ data }) => data },
  academicStudySession: { create: async ({ data }) => data },
  academicActivityTaskLink: {
    deleteMany: async ({ where }) => { const n = s.taskLinks.length; s.taskLinks = s.taskLinks.filter((row) => row.workspaceId !== where.workspaceId || row.activityId !== where.activityId); return { count: n - s.taskLinks.length }; },
    createMany: async ({ data }) => { s.taskLinks.push(...data); return { count: data.length }; },
  },
  academicActivityProjectLink: { deleteMany: async () => ({ count: 0 }), createMany: async () => ({ count: 0 }) },
  academicClassTimetableRule: {
    findFirst: async ({ where }) => where.workspaceId === s.workspaceId && where.id === s.rule?.id ? s.rule : null,
    updateMany: async ({ where, data }) => { if (where.workspaceId !== s.workspaceId || where.id !== s.rule?.id || where.revision !== s.rule.revision) return { count: 0 }; s.rule = { ...s.rule, ...data, revision: s.rule.revision + 1 }; return { count: 1 }; },
    findFirstOrThrow: async ({ where }) => s.rule?.id === where.id ? s.rule : null,
  },
  academicClassTimetableException: { findMany: async ({ where }) => where.workspaceId === s.workspaceId && where.ruleId === s.rule?.id ? s.exceptions : [] },
};
s.prisma = {
  personalWorkspace: { findUnique: async ({ where }) => where.userId === s.ownerId ? { id: s.workspaceId, timezone: s.calendarTimezone ?? "Africa/Nairobi", weekStartsOn: 1 } : null },
  academicActivity: { findMany: async (args) => { s.calendarQueries.push({ source: "activities", args }); return s.calendarActivities; } },
  academicClassTimetableRule: { findMany: async (args) => { s.calendarQueries.push({ source: "rules", args }); return s.calendarRules; } },
  workspaceTask: { findMany: async (args) => { s.calendarQueries.push({ source: "tasks", args }); return s.calendarTasks; } },
  workspaceProjectMilestone: { findMany: async (args) => { s.calendarQueries.push({ source: "milestones", args }); return s.calendarMilestones; } },
  portfolioSite: { findUnique: async ({ where }) => where.userId === s.ownerId ? s.portfolio : null },
  consultation: { findMany: async (args) => { s.calendarQueries.push({ source: "consultations", args }); return s.calendarConsultations; } },
};

const service = await import("../src/lib/personal-workspace-academics.ts");
test.beforeEach(() => {
  const x = rows(); x.profile = null; x.activities = []; x.assignments = []; x.taskLinks = []; x.availableTasks = ["task-1"]; x.transactions = []; x.rule = null; x.exceptions = [];
  x.calendarActivities = []; x.calendarRules = []; x.calendarTasks = []; x.calendarMilestones = []; x.calendarConsultations = []; x.calendarQueries = []; x.portfolio = null; x.calendarTimezone = "Africa/Nairobi";
});

test("profile writes use the supplied verified owner and revision contract", async () => {
  const result = await service.saveAcademicProfile("owner-verified", { institution: "Example University", program: "BSc", department: null, expectedRevision: 0 });
  assert.equal(result.ok, true);
  assert.equal(rows().transactions[0], "owner-verified");
  assert.equal(rows().profile.institution, "Example University");
  assert.equal((await service.saveAcademicProfile("owner-verified", { institution: "Changed", expectedRevision: 1 })).code, "REVISION_CONFLICT");
  assert.equal(rows().profile.institution, "Example University");
});

test("activity creation and workspace links persist together, while invalid links roll back", async () => {
  const invalid = await service.createAcademicActivity("owner-verified", { kind: "ASSIGNMENT", courseId: "course-1", title: "Essay", dueOn: "2026-11-30", taskIds: ["foreign-task"] });
  assert.equal(invalid.ok, false);
  assert.equal(rows().activities.length, 0);
  assert.equal(rows().assignments.length, 0);

  const created = await service.createAcademicActivity("owner-verified", { kind: "ASSIGNMENT", courseId: "course-1", title: "Essay", dueOn: "2026-11-30", taskIds: ["task-1"] });
  assert.equal(created.ok, true);
  assert.equal(rows().activities.length, 1);
  assert.equal(rows().assignments.length, 1);
  assert.deepEqual(rows().taskLinks, [{ workspaceId: "workspace-verified", activityId: "activity-1", taskId: "task-1" }]);
});

test("workspace task links reject unavailable cross-owner targets without changing links", async () => {
  const created = await service.createAcademicActivity("owner-verified", { kind: "ASSIGNMENT", courseId: "course-1", title: "Essay" });
  assert.equal(created.ok, true);
  const result = await service.setAcademicActivityLink("owner-verified", created.value.id, { type: "task", targetId: "not-owned" }, true);
  assert.equal(result.ok, false);
  assert.deepEqual(rows().taskLinks, []);
});

test("timetable rule revisions cannot invalidate saved occurrence exceptions", async () => {
  const s = rows();
  s.rule = { id: "rule-1", workspaceId: s.workspaceId, revision: 0, startsOn: new Date("2026-11-01T00:00:00.000Z"), endsOn: new Date("2026-12-01T00:00:00.000Z"), weekdays: [1] };
  s.exceptions = [{ occurrenceOn: new Date("2026-11-02T00:00:00.000Z") }];
  const result = await service.updateTimetableRule("owner-verified", "rule-1", { weekdays: [2], expectedRevision: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.code, "EXCEPTION_CONFLICT");
  assert.equal(s.rule.revision, 0);
  assert.deepEqual(s.rule.weekdays, [1]);
});
