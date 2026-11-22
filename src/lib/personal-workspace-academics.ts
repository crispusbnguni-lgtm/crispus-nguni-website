import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTimezoneParts, getZonedDateTimeCandidates, getZonedDayRange, isValidIanaTimezone } from "@/lib/consultations/timezone-core";
import {
  academicDateToDatabase,
  canTransitionAcademicActivity,
  parseAcademicActivity,
  parseAcademicDate,
  parseAcademicCourse,
  parseAcademicProfile,
  parseAcademicTerm,
  parseAcademicYear,
  parseClassTimetableException,
  parseClassTimetableRule,
} from "@/lib/personal-workspace-academics-core";
import { withWorkspaceTransaction } from "@/lib/personal-workspace-planning";

type Tx = Prisma.TransactionClient;
type Failed = { ok: false; status: 400 | 404 | 409 | 413; code: string; message: string };
type Result<T = unknown> = { ok: true; value: T } | Failed;
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (message: string, status: Failed["status"] = 400, code = "INVALID_REQUEST"): Failed => ({ ok: false, status, code, message });
const toDate = (value: unknown) => typeof value === "string" ? academicDateToDatabase(value) : value;
function without(value: Record<string, unknown>, ...keys: string[]) { const result = { ...value }; for (const key of keys) delete result[key]; return result; }

const profileSelect = { id: true, institution: true, program: true, department: true, revision: true, createdAt: true, updatedAt: true } satisfies Prisma.AcademicProfileSelect;
const yearSelect = { id: true, name: true, startsOn: true, endsOn: true, isCurrent: true, archivedAt: true, revision: true, createdAt: true, updatedAt: true } satisfies Prisma.AcademicYearSelect;
const termSelect = { id: true, academicYearId: true, name: true, startsOn: true, endsOn: true, isCurrent: true, archivedAt: true, sortOrder: true, revision: true, createdAt: true, updatedAt: true } satisfies Prisma.AcademicTermSelect;
const courseSelect = { id: true, academicYearId: true, code: true, name: true, description: true, credits: true, color: true, archivedAt: true, revision: true, terms: { select: { term: { select: { id: true, name: true, startsOn: true, endsOn: true } } } }, _count: { select: { activities: true, timetableRules: true } }, createdAt: true, updatedAt: true } satisfies Prisma.AcademicCourseSelect;
const activitySelect = { id: true, courseId: true, kind: true, title: true, description: true, status: true, startsAt: true, endsAt: true, dueOn: true, dueAt: true, timezone: true, location: true, archivedAt: true, revision: true, assignment: true, exam: true, studySession: true, taskLinks: { select: { taskId: true } }, projectLinks: { select: { projectId: true } }, course: { select: { id: true, name: true, code: true } }, createdAt: true, updatedAt: true } satisfies Prisma.AcademicActivitySelect;
const ruleSelect = { id: true, courseId: true, title: true, weekdays: true, startsOn: true, endsOn: true, localStart: true, localEnd: true, timezone: true, location: true, archivedAt: true, revision: true, exceptions: true, course: { select: { id: true, name: true, code: true } }, createdAt: true, updatedAt: true } satisfies Prisma.AcademicClassTimetableRuleSelect;

function activityData(value: Record<string, unknown>) {
  return {
    ...(value.courseId !== undefined ? { courseId: value.courseId as string } : {}),
    ...(value.kind !== undefined ? { kind: value.kind as "ASSIGNMENT" | "EXAM" | "STUDY_SESSION" } : {}),
    ...(value.title !== undefined ? { title: value.title as string } : {}),
    ...(value.description !== undefined ? { description: value.description as string | null } : {}),
    ...(value.status !== undefined ? { status: value.status as "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" } : {}),
    ...(value.startsAt !== undefined ? { startsAt: value.startsAt as Date | null } : {}),
    ...(value.endsAt !== undefined ? { endsAt: value.endsAt as Date | null } : {}),
    ...(value.dueOn !== undefined ? { dueOn: value.dueOn ? toDate(value.dueOn) as Date : null } : {}),
    ...(value.dueAt !== undefined ? { dueAt: value.dueAt as Date | null } : {}),
    ...(value.timezone !== undefined ? { timezone: value.timezone as string | null } : {}),
    ...(value.location !== undefined ? { location: value.location as string | null } : {}),
  };
}

async function ensureCourse(tx: Tx, workspaceId: string, courseId: string) {
  return tx.academicCourse.findFirst({ where: { workspaceId, id: courseId, archivedAt: null }, select: { id: true } });
}

async function replaceActivityLinks(tx: Tx, workspaceId: string, activityId: string, taskIds?: string[], projectIds?: string[]) {
  if (taskIds) {
    const count = await tx.workspaceTask.count({ where: { workspaceId, id: { in: taskIds } } });
    if (count !== taskIds.length) return fail("One or more linked tasks were not found.", 404, "NOT_FOUND");
    await tx.academicActivityTaskLink.deleteMany({ where: { workspaceId, activityId } });
    if (taskIds.length) await tx.academicActivityTaskLink.createMany({ data: taskIds.map((taskId) => ({ workspaceId, activityId, taskId })) });
  }
  if (projectIds) {
    const count = await tx.workspaceProject.count({ where: { workspaceId, id: { in: projectIds } } });
    if (count !== projectIds.length) return fail("One or more linked projects were not found.", 404, "NOT_FOUND");
    await tx.academicActivityProjectLink.deleteMany({ where: { workspaceId, activityId } });
    if (projectIds.length) await tx.academicActivityProjectLink.createMany({ data: projectIds.map((projectId) => ({ workspaceId, activityId, projectId })) });
  }
  return null;
}

export async function getAcademicProfile(ownerUserId: string) {
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true } });
  if (!workspace) return null;
  return prisma.academicProfile.findUnique({ where: { workspaceId: workspace.id }, select: profileSelect });
}

export async function saveAcademicProfile(ownerUserId: string, input: unknown) {
  const parsed = parseAcademicProfile(input); if (!parsed.success) return fail(parsed.message);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const { expectedRevision, ...data } = parsed.value;
    const current = await tx.academicProfile.findUnique({ where: { workspaceId }, select: { revision: true } });
    if (current && current.revision !== expectedRevision) return fail("Academic profile changed elsewhere.", 409, "REVISION_CONFLICT");
    if (!current && expectedRevision !== 0) return fail("Academic profile changed elsewhere.", 409, "REVISION_CONFLICT");
    return ok(await tx.academicProfile.upsert({ where: { workspaceId }, create: { ...(data as Prisma.AcademicProfileUncheckedCreateInput), workspaceId }, update: { ...data, revision: { increment: 1 } }, select: profileSelect }));
  });
}

export async function listAcademicYears(ownerUserId: string, archived = false) {
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true } });
  if (!workspace) return [];
  return prisma.academicYear.findMany({ where: { workspaceId: workspace.id, archivedAt: archived ? { not: null } : null }, orderBy: [{ startsOn: "desc" }, { id: "asc" }], select: { ...yearSelect, _count: { select: { terms: true, courses: true } } } });
}

export async function createAcademicYear(ownerUserId: string, input: unknown) {
  const parsed = parseAcademicYear(input); if (!parsed.success) return fail(parsed.message);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const value = parsed.value;
    if (value.isCurrent) {
      await tx.academicYear.updateMany({ where: { workspaceId, isCurrent: true, archivedAt: null }, data: { isCurrent: false, revision: { increment: 1 } } });
      await tx.academicTerm.updateMany({ where: { workspaceId, isCurrent: true, archivedAt: null }, data: { isCurrent: false, revision: { increment: 1 } } });
    }
    return ok(await tx.academicYear.create({ data: { workspaceId, name: value.name as string, startsOn: toDate(value.startsOn) as Date, endsOn: toDate(value.endsOn) as Date, isCurrent: Boolean(value.isCurrent) }, select: yearSelect }));
  });
}

export async function updateAcademicYear(ownerUserId: string, yearId: string, input: unknown) {
  const parsed = parseAcademicYear(input, true); if (!parsed.success) return fail(parsed.message);
  if (parsed.value.expectedRevision === undefined) return fail("Expected academic year revision is required.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const current = await tx.academicYear.findFirst({ where: { workspaceId, id: yearId }, select: { revision: true, isCurrent: true, startsOn: true, endsOn: true } });
    if (!current || current.revision !== parsed.value.expectedRevision) return fail("Academic year not found or changed elsewhere.", 409, "REVISION_CONFLICT");
    const { expectedRevision, archived, ...raw } = parsed.value;
    const startsOn = raw.startsOn ? toDate(raw.startsOn) as Date : current.startsOn; const endsOn = raw.endsOn ? toDate(raw.endsOn) as Date : current.endsOn;
    const childTerm = await tx.academicTerm.findFirst({ where: { workspaceId, academicYearId: yearId, OR: [{ startsOn: { lt: startsOn } }, { endsOn: { gt: endsOn } }] }, select: { id: true } });
    if (childTerm) return fail("Academic year dates cannot exclude an existing term.", 409, "DATE_CONFLICT");
    if (raw.isCurrent === true) {
      await tx.academicYear.updateMany({ where: { workspaceId, id: { not: yearId }, isCurrent: true, archivedAt: null }, data: { isCurrent: false, revision: { increment: 1 } } });
      await tx.academicTerm.updateMany({ where: { workspaceId, isCurrent: true, archivedAt: null }, data: { isCurrent: false, revision: { increment: 1 } } });
    }
    const changed = await tx.academicYear.updateMany({ where: { workspaceId, id: yearId, revision: expectedRevision as number }, data: { ...raw, ...(raw.startsOn ? { startsOn: toDate(raw.startsOn) as Date } : {}), ...(raw.endsOn ? { endsOn: toDate(raw.endsOn) as Date } : {}), ...(archived !== undefined ? { archivedAt: archived ? new Date() : null, isCurrent: archived ? false : undefined } : {}), revision: { increment: 1 } } });
    if (changed.count !== 1) return fail("Academic year changed elsewhere.", 409, "REVISION_CONFLICT");
    if (archived === true) {
      const archivedAt = new Date();
      await tx.academicTerm.updateMany({ where: { workspaceId, academicYearId: yearId, archivedAt: null }, data: { archivedAt, isCurrent: false, revision: { increment: 1 } } });
      await tx.academicCourse.updateMany({ where: { workspaceId, academicYearId: yearId, archivedAt: null }, data: { archivedAt, revision: { increment: 1 } } });
      await tx.academicActivity.updateMany({ where: { workspaceId, course: { academicYearId: yearId }, archivedAt: null }, data: { archivedAt, revision: { increment: 1 } } });
      await tx.academicClassTimetableRule.updateMany({ where: { workspaceId, course: { academicYearId: yearId }, archivedAt: null }, data: { archivedAt, revision: { increment: 1 } } });
    }
    if (raw.isCurrent === false) await tx.academicTerm.updateMany({ where: { workspaceId, academicYearId: yearId, isCurrent: true, archivedAt: null }, data: { isCurrent: false, revision: { increment: 1 } } });
    return ok(await tx.academicYear.findFirstOrThrow({ where: { workspaceId, id: yearId }, select: yearSelect }));
  });
}

export async function listAcademicTerms(ownerUserId: string, yearId?: string, archived = false) {
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true } }); if (!workspace) return [];
  return prisma.academicTerm.findMany({ where: { workspaceId: workspace.id, ...(yearId ? { academicYearId: yearId } : {}), archivedAt: archived ? { not: null } : null, ...(archived ? {} : { academicYear: { archivedAt: null } }) }, orderBy: [{ startsOn: "asc" }, { sortOrder: "asc" }, { id: "asc" }], select: termSelect });
}

export async function createAcademicTerm(ownerUserId: string, input: unknown) {
  const parsed = parseAcademicTerm(input); if (!parsed.success) return fail(parsed.message);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const value = parsed.value; const year = await tx.academicYear.findFirst({ where: { workspaceId, id: value.academicYearId as string, archivedAt: null }, select: { startsOn: true, endsOn: true } });
    const startsOn = toDate(value.startsOn) as Date; const endsOn = toDate(value.endsOn) as Date;
    if (!year) return fail("Academic year not found.", 404, "NOT_FOUND");
    if (startsOn < year.startsOn || endsOn > year.endsOn) return fail("Term dates must fall within the academic year.", 400, "DATE_RANGE");
    if (value.isCurrent) {
      await tx.academicYear.updateMany({ where: { workspaceId, isCurrent: true, archivedAt: null }, data: { isCurrent: false, revision: { increment: 1 } } });
      await tx.academicYear.updateMany({ where: { workspaceId, id: value.academicYearId as string, archivedAt: null }, data: { isCurrent: true, revision: { increment: 1 } } });
      await tx.academicTerm.updateMany({ where: { workspaceId, isCurrent: true, archivedAt: null }, data: { isCurrent: false, revision: { increment: 1 } } });
    }
    return ok(await tx.academicTerm.create({ data: { workspaceId, academicYearId: value.academicYearId as string, name: value.name as string, startsOn, endsOn, isCurrent: Boolean(value.isCurrent), sortOrder: (value.sortOrder as number | undefined) ?? 0 }, select: termSelect }));
  });
}

export async function updateAcademicTerm(ownerUserId: string, termId: string, input: unknown) {
  const parsed = parseAcademicTerm(input, true); if (!parsed.success) return fail(parsed.message);
  if (parsed.value.expectedRevision === undefined) return fail("Expected academic term revision is required.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const current = await tx.academicTerm.findFirst({ where: { workspaceId, id: termId }, select: { revision: true, academicYearId: true, startsOn: true, endsOn: true } });
    if (!current || current.revision !== parsed.value.expectedRevision) return fail("Academic term not found or changed elsewhere.", 409, "REVISION_CONFLICT");
    const { expectedRevision, archived, ...raw } = parsed.value;
    const yearId = (raw.academicYearId as string | undefined) ?? current.academicYearId;
    const year = await tx.academicYear.findFirst({ where: { workspaceId, id: yearId, archivedAt: null }, select: { startsOn: true, endsOn: true } });
    if (!year) return fail("Academic year not found.", 404, "NOT_FOUND");
    const startsOn = raw.startsOn ? toDate(raw.startsOn) as Date : current.startsOn; const endsOn = raw.endsOn ? toDate(raw.endsOn) as Date : current.endsOn;
    if (startsOn < year.startsOn || endsOn > year.endsOn) return fail("Term dates must fall within the academic year.", 400, "DATE_RANGE");
    if (raw.isCurrent === true) {
      await tx.academicYear.updateMany({ where: { workspaceId, isCurrent: true, archivedAt: null }, data: { isCurrent: false, revision: { increment: 1 } } });
      await tx.academicYear.updateMany({ where: { workspaceId, id: yearId, archivedAt: null }, data: { isCurrent: true, revision: { increment: 1 } } });
      await tx.academicTerm.updateMany({ where: { workspaceId, id: { not: termId }, isCurrent: true, archivedAt: null }, data: { isCurrent: false, revision: { increment: 1 } } });
    }
    const changed = await tx.academicTerm.updateMany({ where: { workspaceId, id: termId, revision: expectedRevision as number }, data: { ...raw, ...(raw.startsOn ? { startsOn: toDate(raw.startsOn) as Date } : {}), ...(raw.endsOn ? { endsOn: toDate(raw.endsOn) as Date } : {}), ...(archived !== undefined ? { archivedAt: archived ? new Date() : null, isCurrent: archived ? false : undefined } : {}), revision: { increment: 1 } } });
    if (changed.count !== 1) return fail("Academic term changed elsewhere.", 409, "REVISION_CONFLICT");
    if (archived === true || raw.isCurrent === false) await tx.academicTerm.updateMany({ where: { workspaceId, id: termId, isCurrent: true, archivedAt: null }, data: { isCurrent: false, revision: { increment: 1 } } });
    return ok(await tx.academicTerm.findFirstOrThrow({ where: { workspaceId, id: termId }, select: termSelect }));
  });
}

export async function listAcademicCourses(ownerUserId: string, options: { yearId?: string; termId?: string; archived?: boolean } = {}) {
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true } }); if (!workspace) return [];
  return prisma.academicCourse.findMany({ where: { workspaceId: workspace.id, ...(options.yearId ? { academicYearId: options.yearId } : {}), archivedAt: options.archived ? { not: null } : null, ...(options.archived ? {} : { academicYear: { archivedAt: null } }), ...(options.termId ? { terms: { some: { termId: options.termId, term: { archivedAt: null } } } } : {}) }, orderBy: [{ name: "asc" }, { id: "asc" }], select: courseSelect });
}

export async function createAcademicCourse(ownerUserId: string, input: unknown) {
  const parsed = parseAcademicCourse(input); if (!parsed.success) return fail(parsed.message);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const value = parsed.value; const year = await tx.academicYear.findFirst({ where: { workspaceId, id: value.academicYearId as string, archivedAt: null }, select: { id: true } }); if (!year) return fail("Academic year not found.", 404, "NOT_FOUND");
    const termIds = (value.termIds as string[] | undefined) ?? [];
    if (termIds.length && await tx.academicTerm.count({ where: { workspaceId, academicYearId: value.academicYearId as string, id: { in: termIds }, archivedAt: null } }) !== termIds.length) return fail("One or more terms do not belong to this academic year.", 404, "NOT_FOUND");
    const data = without(value, "termIds", "expectedRevision");
    const course = await tx.academicCourse.create({ data: { ...(data as Prisma.AcademicCourseUncheckedCreateInput), workspaceId }, select: { id: true } });
    if (termIds.length) await tx.academicCourseTerm.createMany({ data: termIds.map((termId) => ({ workspaceId, academicYearId: value.academicYearId as string, courseId: course.id, termId })) });
    return ok(await tx.academicCourse.findFirstOrThrow({ where: { workspaceId, id: course.id }, select: courseSelect }));
  });
}

export async function updateAcademicCourse(ownerUserId: string, courseId: string, input: unknown) {
  const parsed = parseAcademicCourse(input, true); if (!parsed.success) return fail(parsed.message);
  if (parsed.value.expectedRevision === undefined) return fail("Expected course revision is required.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const current = await tx.academicCourse.findFirst({ where: { workspaceId, id: courseId }, select: { revision: true, academicYearId: true } });
    if (!current || current.revision !== parsed.value.expectedRevision) return fail("Course not found or changed elsewhere.", 409, "REVISION_CONFLICT");
    const { expectedRevision, archived, termIds, ...raw } = parsed.value;
    const yearId = (raw.academicYearId as string | undefined) ?? current.academicYearId;
    if (yearId !== current.academicYearId && await tx.academicCourseTerm.count({ where: { workspaceId, courseId } })) return fail("Remove course term links before changing its academic year.", 409, "TERM_LINK_CONFLICT");
    if (raw.academicYearId && !await tx.academicYear.findFirst({ where: { workspaceId, id: yearId, archivedAt: null }, select: { id: true } })) return fail("Academic year not found.", 404, "NOT_FOUND");
    if (termIds) {
      if (await tx.academicTerm.count({ where: { workspaceId, academicYearId: yearId, id: { in: termIds as string[] }, archivedAt: null } }) !== (termIds as string[]).length) return fail("One or more terms do not belong to this academic year.", 404, "NOT_FOUND");
      await tx.academicCourseTerm.deleteMany({ where: { workspaceId, courseId } });
      if ((termIds as string[]).length) await tx.academicCourseTerm.createMany({ data: (termIds as string[]).map((termId) => ({ workspaceId, academicYearId: yearId, courseId, termId })) });
    }
    const changed = await tx.academicCourse.updateMany({ where: { workspaceId, id: courseId, revision: expectedRevision as number }, data: { ...raw, academicYearId: yearId, ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}), revision: { increment: 1 } } });
    if (changed.count !== 1) return fail("Course changed elsewhere.", 409, "REVISION_CONFLICT");
    if (archived === true) {
      const archivedAt = new Date();
      await tx.academicActivity.updateMany({ where: { workspaceId, courseId, archivedAt: null }, data: { archivedAt, revision: { increment: 1 } } });
      await tx.academicClassTimetableRule.updateMany({ where: { workspaceId, courseId, archivedAt: null }, data: { archivedAt, revision: { increment: 1 } } });
    }
    return ok(await tx.academicCourse.findFirstOrThrow({ where: { workspaceId, id: courseId }, select: courseSelect }));
  });
}

export async function listAcademicActivities(ownerUserId: string, options: { kind?: "ASSIGNMENT" | "EXAM" | "STUDY_SESSION"; courseId?: string; status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"; archived?: boolean } = {}) {
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true } }); if (!workspace) return [];
  return prisma.academicActivity.findMany({ where: { workspaceId: workspace.id, ...(options.kind ? { kind: options.kind } : {}), ...(options.courseId ? { courseId: options.courseId } : {}), ...(options.status ? { status: options.status } : {}), archivedAt: options.archived ? { not: null } : null, ...(options.archived ? {} : { course: { archivedAt: null, academicYear: { archivedAt: null } } }) }, orderBy: [{ dueOn: "asc" }, { dueAt: "asc" }, { startsAt: "asc" }, { id: "asc" }], select: activitySelect });
}

async function writeSubtype(tx: Tx, workspaceId: string, activityId: string, kind: string, value: Record<string, unknown>, create: boolean) {
  if (kind === "ASSIGNMENT") {
    const data = { ...(create || value.submissionStatus !== undefined ? { submissionStatus: (value.submissionStatus as "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "GRADED" | undefined) ?? "NOT_STARTED" } : {}), ...(value.submittedAt !== undefined ? { submittedAt: value.submittedAt as Date | null } : {}), ...(value.grade !== undefined ? { grade: value.grade as string | null } : {}), ...(value.feedback !== undefined ? { feedback: value.feedback as string | null } : {}) };
    if (create) await tx.academicAssignment.create({ data: { workspaceId, activityId, ...data } });
    else await tx.academicAssignment.update({ where: { workspaceId_activityId: { workspaceId, activityId } }, data });
  } else if (kind === "EXAM") {
    const data = { ...(create || value.examKind !== undefined ? { examKind: (value.examKind as "EXAM" | "QUIZ" | "PRACTICAL" | "ORAL" | "OTHER" | undefined) ?? "EXAM" } : {}), ...(value.venue !== undefined ? { venue: value.venue as string | null } : {}), ...(value.topic !== undefined ? { topic: value.topic as string | null } : {}), ...(value.score !== undefined ? { score: value.score === null ? null : new Prisma.Decimal(value.score as number) } : {}), ...(value.maxScore !== undefined ? { maxScore: value.maxScore === null ? null : new Prisma.Decimal(value.maxScore as number) } : {}) };
    if (create) await tx.academicExam.create({ data: { workspaceId, activityId, ...data } });
    else await tx.academicExam.update({ where: { workspaceId_activityId: { workspaceId, activityId } }, data });
  } else if (kind === "STUDY_SESSION") {
    const data = { ...(create || value.goal !== undefined ? { goal: value.goal as string | null | undefined } : {}), ...(value.topic !== undefined ? { topic: value.topic as string | null } : {}), ...(create || value.progress !== undefined ? { progress: (value.progress as number | undefined) ?? 0, completedAt: (value.progress as number | undefined) === 100 ? new Date() : null } : {}) };
    if (create) await tx.academicStudySession.create({ data: { workspaceId, activityId, ...data } });
    else await tx.academicStudySession.update({ where: { workspaceId_activityId: { workspaceId, activityId } }, data });
  }
}

export async function createAcademicActivity(ownerUserId: string, input: unknown) {
  const parsed = parseAcademicActivity(input); if (!parsed.success) return fail(parsed.message);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const value = parsed.value; if (!await ensureCourse(tx, workspaceId, value.courseId as string)) return fail("Course not found.", 404, "NOT_FOUND");
    const taskIds = value.taskIds as string[] | undefined; const projectIds = value.projectIds as string[] | undefined;
    const record = without(value, "submissionStatus", "submittedAt", "grade", "feedback", "examKind", "venue", "goal", "progress", "taskIds", "projectIds", "archived", "expectedRevision");
    const activity = await tx.academicActivity.create({ data: { ...(activityData(record) as Prisma.AcademicActivityUncheckedCreateInput), workspaceId }, select: { id: true, kind: true } });
    await writeSubtype(tx, workspaceId, activity.id, activity.kind, value, true);
    const linkFailure = await replaceActivityLinks(tx, workspaceId, activity.id, taskIds as string[] | undefined, projectIds as string[] | undefined); if (linkFailure) return linkFailure;
    return ok(await tx.academicActivity.findFirstOrThrow({ where: { workspaceId, id: activity.id }, select: activitySelect }));
  });
}

export async function updateAcademicActivity(ownerUserId: string, activityId: string, input: unknown) {
  const parsed = parseAcademicActivity(input, true); if (!parsed.success) return fail(parsed.message);
  if (parsed.value.expectedRevision === undefined) return fail("Expected activity revision is required.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const current = await tx.academicActivity.findFirst({ where: { workspaceId, id: activityId }, select: { kind: true, status: true, revision: true, courseId: true, startsAt: true, endsAt: true, assignment: { select: { submissionStatus: true } }, exam: { select: { score: true, maxScore: true } } } });
    if (!current || current.revision !== parsed.value.expectedRevision) return fail("Academic activity not found or changed elsewhere.", 409, "REVISION_CONFLICT");
    const value = parsed.value;
    const kind = (value.kind as string | undefined) ?? current.kind;
    if (kind !== current.kind) return fail("Activity kind cannot be changed; create a new activity instead.", 400, "KIND_IMMUTABLE");
    if (kind === "EXAM") {
      const nextScore = value.score !== undefined ? value.score : current.exam?.score?.toNumber() ?? null;
      const nextMaximum = value.maxScore !== undefined ? value.maxScore : current.exam?.maxScore?.toNumber() ?? null;
      if (nextScore !== null && (nextMaximum === null || Number(nextMaximum) <= Number(nextScore))) return fail("Maximum marks must be greater than the recorded score.");
    }
    const nextStartsAt = value.startsAt !== undefined ? value.startsAt : current.startsAt;
    const nextEndsAt = value.endsAt !== undefined ? value.endsAt : current.endsAt;
    if ((kind === "EXAM" || kind === "STUDY_SESSION") && (!(nextStartsAt instanceof Date) || !(nextEndsAt instanceof Date) || nextEndsAt <= nextStartsAt)) return fail("Examinations and study sessions require a valid start and end time.");
    if (value.status && !canTransitionAcademicActivity(current.status, value.status as string)) return fail("Academic activity status transition is not allowed.", 409, "INVALID_TRANSITION");
    if (kind === "ASSIGNMENT" && value.submissionStatus && current.assignment) {
      const submissionTransitions: Record<string, string[]> = { NOT_STARTED: ["IN_PROGRESS", "SUBMITTED"], IN_PROGRESS: ["NOT_STARTED", "SUBMITTED"], SUBMITTED: ["IN_PROGRESS", "GRADED"], GRADED: ["SUBMITTED"] };
      const next = value.submissionStatus as string;
      if (current.assignment.submissionStatus !== next && !submissionTransitions[current.assignment.submissionStatus]?.includes(next)) return fail("Assignment submission status transition is not allowed.", 409, "INVALID_TRANSITION");
    }
    const courseId = (value.courseId as string | undefined) ?? current.courseId; if (courseId !== current.courseId && !await ensureCourse(tx, workspaceId, courseId)) return fail("Course not found.", 404, "NOT_FOUND");
    const taskIds = value.taskIds as string[] | undefined; const projectIds = value.projectIds as string[] | undefined;
    const archived = value.archived as boolean | undefined; const expectedRevision = value.expectedRevision;
    const record = without(value, "submissionStatus", "submittedAt", "grade", "feedback", "examKind", "venue", "goal", "progress", "taskIds", "projectIds", "archived", "expectedRevision");
    const changed = await tx.academicActivity.updateMany({ where: { workspaceId, id: activityId, revision: expectedRevision as number }, data: { ...activityData(record), ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}), revision: { increment: 1 } } });
    if (changed.count !== 1) return fail("Academic activity changed elsewhere.", 409, "REVISION_CONFLICT");
    await writeSubtype(tx, workspaceId, activityId, kind, value, false);
    const linkFailure = await replaceActivityLinks(tx, workspaceId, activityId, taskIds as string[] | undefined, projectIds as string[] | undefined); if (linkFailure) return linkFailure;
    return ok(await tx.academicActivity.findFirstOrThrow({ where: { workspaceId, id: activityId }, select: activitySelect }));
  });
}

export async function createTimetableRule(ownerUserId: string, input: unknown) {
  const parsed = parseClassTimetableRule(input); if (!parsed.success) return fail(parsed.message);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const value = parsed.value; if (!await ensureCourse(tx, workspaceId, value.courseId as string)) return fail("Course not found.", 404, "NOT_FOUND");
    return ok(await tx.academicClassTimetableRule.create({ data: { workspaceId, courseId: value.courseId as string, title: value.title as string, weekdays: value.weekdays as number[], startsOn: toDate(value.startsOn) as Date, endsOn: toDate(value.endsOn) as Date, localStart: value.localStart as string, localEnd: value.localEnd as string, timezone: value.timezone as string, location: value.location as string | null | undefined }, select: ruleSelect }));
  });
}

export async function listTimetableRules(ownerUserId: string, archived = false) {
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true } }); if (!workspace) return [];
  return prisma.academicClassTimetableRule.findMany({ where: { workspaceId: workspace.id, archivedAt: archived ? { not: null } : null, ...(archived ? {} : { course: { archivedAt: null, academicYear: { archivedAt: null } } }) }, orderBy: [{ startsOn: "asc" }, { localStart: "asc" }, { id: "asc" }], select: ruleSelect });
}

export async function setAcademicActivityLink(ownerUserId: string, activityId: string, target: { type: "task" | "project"; targetId: string }, linked: boolean) {
  if (!target.targetId || target.targetId.length > 128) return fail("Link target is invalid.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const activity = await tx.academicActivity.findFirst({ where: { workspaceId, id: activityId, archivedAt: null }, select: { id: true } }); if (!activity) return fail("Academic activity not found.", 404, "NOT_FOUND");
    if (target.type === "task") {
      const task = await tx.workspaceTask.findFirst({ where: { workspaceId, id: target.targetId }, select: { id: true } }); if (!task) return fail("Workspace task not found.", 404, "NOT_FOUND");
      if (linked) await tx.academicActivityTaskLink.createMany({ data: [{ workspaceId, activityId, taskId: target.targetId }], skipDuplicates: true });
      else await tx.academicActivityTaskLink.deleteMany({ where: { workspaceId, activityId, taskId: target.targetId } });
    } else {
      const project = await tx.workspaceProject.findFirst({ where: { workspaceId, id: target.targetId }, select: { id: true } }); if (!project) return fail("Workspace project not found.", 404, "NOT_FOUND");
      if (linked) await tx.academicActivityProjectLink.createMany({ data: [{ workspaceId, activityId, projectId: target.targetId }], skipDuplicates: true });
      else await tx.academicActivityProjectLink.deleteMany({ where: { workspaceId, activityId, projectId: target.targetId } });
    }
    return ok({ linked });
  });
}

export async function updateTimetableRule(ownerUserId: string, ruleId: string, input: unknown) {
  const parsed = parseClassTimetableRule(input, true); if (!parsed.success) return fail(parsed.message);
  if (parsed.value.expectedRevision === undefined) return fail("Expected timetable revision is required.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const { expectedRevision, archived, ...value } = parsed.value;
    const current = await tx.academicClassTimetableRule.findFirst({ where: { workspaceId, id: ruleId }, select: { revision: true, startsOn: true, endsOn: true, weekdays: true } });
    if (!current || current.revision !== expectedRevision) return fail("Timetable rule not found or changed elsewhere.", 409, "REVISION_CONFLICT");
    if (value.courseId && !await ensureCourse(tx, workspaceId, value.courseId as string)) return fail("Course not found.", 404, "NOT_FOUND");
    const startsOn = value.startsOn ? toDate(value.startsOn) as Date : current.startsOn;
    const endsOn = value.endsOn ? toDate(value.endsOn) as Date : current.endsOn;
    const weekdays = (value.weekdays as number[] | undefined) ?? current.weekdays;
    const exceptions = await tx.academicClassTimetableException.findMany({ where: { workspaceId, ruleId }, select: { occurrenceOn: true } });
    if (exceptions.some((exception) => exception.occurrenceOn < startsOn || exception.occurrenceOn > endsOn || !weekdays.includes(exception.occurrenceOn.getUTCDay() || 7))) return fail("Changing this recurrence would invalidate a saved occurrence exception.", 409, "EXCEPTION_CONFLICT");
    const changed = await tx.academicClassTimetableRule.updateMany({ where: { workspaceId, id: ruleId, revision: expectedRevision as number }, data: { ...value, ...(value.startsOn ? { startsOn: toDate(value.startsOn) as Date } : {}), ...(value.endsOn ? { endsOn: toDate(value.endsOn) as Date } : {}), ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}), revision: { increment: 1 } } });
    if (changed.count !== 1) return fail("Timetable rule not found or changed elsewhere.", 409, "REVISION_CONFLICT");
    return ok(await tx.academicClassTimetableRule.findFirstOrThrow({ where: { workspaceId, id: ruleId }, select: ruleSelect }));
  });
}

export async function saveTimetableException(ownerUserId: string, ruleId: string, input: unknown) {
  const parsed = parseClassTimetableException(input); if (!parsed.success) return fail(parsed.message);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const rule = await tx.academicClassTimetableRule.findFirst({ where: { workspaceId, id: ruleId, archivedAt: null }, select: { id: true, weekdays: true, startsOn: true, endsOn: true } }); if (!rule) return fail("Timetable rule not found.", 404, "NOT_FOUND");
    const value = parsed.value;
    const occurrence = academicDateToDatabase(value.occurrenceOn);
    const weekday = occurrence.getUTCDay() || 7;
    if (occurrence < rule.startsOn || occurrence > rule.endsOn || !rule.weekdays.includes(weekday)) return fail("The selected date is not an occurrence of this class rule.", 400, "INVALID_OCCURRENCE");
    return ok(await tx.academicClassTimetableException.upsert({ where: { workspaceId_ruleId_occurrenceOn: { workspaceId, ruleId, occurrenceOn: academicDateToDatabase(value.occurrenceOn) } }, create: { workspaceId, ruleId, occurrenceOn: academicDateToDatabase(value.occurrenceOn), kind: value.kind, ...(value.kind === "RESCHEDULED" ? { startsAt: value.startsAt, endsAt: value.endsAt, timezone: value.timezone, location: value.location } : {}) }, update: { kind: value.kind, startsAt: value.kind === "RESCHEDULED" ? value.startsAt : null, endsAt: value.kind === "RESCHEDULED" ? value.endsAt : null, timezone: value.kind === "RESCHEDULED" ? value.timezone : null, location: value.kind === "RESCHEDULED" ? value.location : null, revision: { increment: 1 } } }));
  });
}

export async function deleteTimetableException(ownerUserId: string, ruleId: string, occurrenceOn: string) {
  if (!parseAcademicDate(occurrenceOn)) return fail("Timetable exception date is invalid.");
  const date = academicDateToDatabase(occurrenceOn);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const result = await tx.academicClassTimetableException.deleteMany({ where: { workspaceId, ruleId, occurrenceOn: date } });
    return result.count ? ok({ deleted: true }) : fail("Timetable exception not found.", 404, "NOT_FOUND");
  });
}

function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
function addDays(key: string, amount: number) { const [y, m, d] = key.split("-").map(Number); const date = new Date(Date.UTC(y, m - 1, d + amount)); return dateKey(date); }
function isoIfValid(parts: number[], time: string, timezone: string): Date | null { const [hour, minute] = time.split(":").map(Number); const candidates = getZonedDateTimeCandidates(parts[0], parts[1], parts[2], hour, minute, timezone); return candidates.length === 1 ? candidates[0] : null; }

export async function getAcademicCalendar(ownerUserId: string, from: string, to: string, now = new Date()) {
  const startKey = from; const endKey = to;
  if (!parseAcademicDate(startKey) || !parseAcademicDate(endKey) || startKey > endKey) return fail("Calendar date range is invalid.");
  const days = Math.round((academicDateToDatabase(endKey).getTime() - academicDateToDatabase(startKey).getTime()) / 86_400_000) + 1;
  if (days > 62) return fail("Calendar range cannot exceed 62 days.");
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true, timezone: true, weekStartsOn: true } });
  if (!workspace) return ok({ events: [], conflicts: [], unscheduled: [], overdue: [], from: startKey, to: endKey, timezone: "Africa/Nairobi", weekStartsOn: 1, truncated: false });
  const timezone = isValidIanaTimezone(workspace.timezone) ? workspace.timezone : "Africa/Nairobi";
  const fromDate = academicDateToDatabase(startKey); const throughDate = academicDateToDatabase(addDays(endKey, 1));
  const timeFrom = getZonedDayRange(startKey, timezone).startDate;
  const timeThrough = getZonedDayRange(endKey, timezone).endDate;
  const [activities, rules, tasks, projects, portfolio, financeReminders, nutritionPlans, nutritionReminders] = await Promise.all([
    prisma.academicActivity.findMany({ where: { workspaceId: workspace.id, archivedAt: null, OR: [{ startsAt: { gte: timeFrom, lt: timeThrough } }, { startsAt: { lt: timeFrom }, endsAt: { gte: timeFrom } }, { dueAt: { gte: timeFrom, lt: timeThrough } }, { dueOn: { gte: fromDate, lt: throughDate } }] }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: 501, select: { ...activitySelect } }),
    prisma.academicClassTimetableRule.findMany({ where: { workspaceId: workspace.id, archivedAt: null, startsOn: { lte: academicDateToDatabase(endKey) }, endsOn: { gte: fromDate } }, orderBy: [{ startsOn: "asc" }, { id: "asc" }], take: 201, select: { ...ruleSelect, exceptions: { where: { occurrenceOn: { gte: fromDate, lt: throughDate } } } } }),
    prisma.workspaceTask.findMany({ where: { workspaceId: workspace.id, archivedAt: null, OR: [{ startsAt: { gte: timeFrom, lt: timeThrough } }, { dueAt: { gte: timeFrom, lt: timeThrough } }] }, orderBy: [{ startsAt: "asc" }, { dueAt: "asc" }, { id: "asc" }], take: 501, select: { id: true, title: true, description: true, status: true, priority: true, completedAt: true, startsAt: true, dueAt: true, projectId: true, project: { select: { id: true, name: true } } } }),
    prisma.workspaceProjectMilestone.findMany({ where: { workspaceId: workspace.id, targetAt: { gte: fromDate, lt: throughDate }, project: { archivedAt: null } }, orderBy: [{ targetAt: "asc" }, { id: "asc" }], take: 501, select: { id: true, title: true, description: true, targetAt: true, completedAt: true, project: { select: { id: true, name: true } } } }),
    prisma.portfolioSite.findUnique({ where: { userId: ownerUserId }, select: { id: true } }),
    prisma.workspaceFinanceReminder.findMany({ where: { workspaceId: workspace.id, status: "ACTIVE", remindAt: { gte: timeFrom, lt: timeThrough } }, orderBy: [{ remindAt: "asc" }, { id: "asc" }], take: 501, select: { id: true, title: true, kind: true, remindAt: true, timezone: true } }),
    prisma.nutritionMealPlanItem.findMany({ where: { workspaceId: workspace.id, scheduledAt: { gte: timeFrom, lt: timeThrough }, plan: { status: "ACTIVE", profile: { archivedAt: null } } }, orderBy: [{ scheduledAt: "asc" }, { id: "asc" }], take: 501, select: { id: true, label: true, category: true, scheduledAt: true, plan: { select: { profile: { select: { displayName: true } } } } } }),
    prisma.nutritionReminder.findMany({ where: { workspaceId: workspace.id, dismissedAt: null, remindAt: { gte: timeFrom, lt: timeThrough } }, orderBy: [{ remindAt: "asc" }, { id: "asc" }], take: 501, select: { id: true, title: true, kind: true, remindAt: true, timezone: true, profile: { select: { displayName: true } } } }),
  ]);
  const [consultations, followUps, unscheduledLeads, overdueFollowUps] = portfolio ? await Promise.all([
    prisma.consultation.findMany({ where: { portfolioId: portfolio.id, scheduledAt: { gte: timeFrom, lt: timeThrough } }, orderBy: [{ scheduledAt: "asc" }, { id: "asc" }], take: 501, select: { id: true, title: true, scheduledAt: true, durationMinutes: true, timezone: true, status: true, lead: { select: { id: true, name: true } }, consultationType: { select: { title: true } } } }),
    prisma.lead.findMany({ where: { portfolioId: portfolio.id, status: { notIn: ["CONVERTED", "LOST"] }, nextFollowUpAt: { gte: timeFrom, lt: timeThrough } }, orderBy: [{ nextFollowUpAt: "asc" }, { id: "asc" }], take: 501, select: { id: true, name: true, status: true, nextFollowUpAt: true, nextBestAction: true } }),
    prisma.lead.findMany({ where: { portfolioId: portfolio.id, status: { notIn: ["CONVERTED", "LOST"] }, nextFollowUpAt: null }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 201, select: { id: true, name: true, status: true, nextBestAction: true } }),
    prisma.lead.findMany({ where: { portfolioId: portfolio.id, status: { notIn: ["CONVERTED", "LOST"] }, nextFollowUpAt: { lt: now } }, orderBy: [{ nextFollowUpAt: "asc" }, { id: "asc" }], take: 201, select: { id: true, name: true, status: true, nextFollowUpAt: true, nextBestAction: true } }),
  ]) : [[], [], [], []] as const;
  const [unscheduledTasks, overdueTasks] = await Promise.all([
    prisma.workspaceTask.findMany({ where: { workspaceId: workspace.id, archivedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] }, startsAt: null, dueAt: null }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }, { id: "asc" }], take: 201, select: { id: true, title: true, description: true, status: true, priority: true, project: { select: { id: true, name: true } } } }),
    prisma.workspaceTask.findMany({ where: { workspaceId: workspace.id, archivedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] }, dueAt: { lt: now } }, orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: 201, select: { id: true, title: true, description: true, status: true, priority: true, startsAt: true, dueAt: true, project: { select: { id: true, name: true } } } }),
  ]);
  const events: Record<string, unknown>[] = [];
  let truncated = activities.length >= 501 || rules.length >= 201 || tasks.length >= 501 || projects.length >= 501 || consultations.length >= 501 || followUps.length >= 501 || financeReminders.length >= 501 || nutritionPlans.length >= 501 || nutritionReminders.length >= 501 || unscheduledLeads.length >= 201 || unscheduledTasks.length >= 201 || overdueFollowUps.length >= 201 || overdueTasks.length >= 201;
  for (const reminder of financeReminders) events.push({ sourceType: "WORKSPACE_FINANCE_REMINDER", sourceId: reminder.id, title: reminder.title, description: reminder.kind.replaceAll("_", " ").toLowerCase(), startAt: reminder.remindAt.toISOString(), endAt: null, allDay: false, timezone: reminder.timezone, status: "ACTIVE" });
  for (const item of nutritionPlans) events.push({ sourceType: "WORKSPACE_NUTRITION_MEAL_PLAN", sourceId: item.id, title: `${item.label} · ${item.plan.profile.displayName}`, description: item.category.replaceAll("_", " ").toLowerCase(), startAt: item.scheduledAt.toISOString(), endAt: null, allDay: false, timezone, status: "PLANNED", readOnly: true });
  for (const reminder of nutritionReminders) events.push({ sourceType: "WORKSPACE_NUTRITION_REMINDER", sourceId: reminder.id, title: `${reminder.title} · ${reminder.profile.displayName}`, description: reminder.kind.replaceAll("_", " ").toLowerCase(), startAt: reminder.remindAt.toISOString(), endAt: null, allDay: false, timezone: reminder.timezone, status: "ACTIVE", readOnly: true });
  for (const activity of activities) {
    if (activity.startsAt) events.push({ sourceType: activity.kind, sourceId: activity.id, title: activity.title, description: activity.description, startAt: activity.startsAt.toISOString(), endAt: activity.endsAt?.toISOString() ?? null, allDay: false, timezone: activity.timezone ?? timezone, status: activity.status, course: activity.course, links: { taskIds: activity.taskLinks.map((link) => link.taskId), projectIds: activity.projectLinks.map((link) => link.projectId) } });
    if (activity.dueAt) events.push({ sourceType: `${activity.kind}_DEADLINE`, sourceId: activity.id, title: activity.title, description: activity.description, startAt: activity.dueAt.toISOString(), endAt: null, allDay: false, timezone: activity.timezone ?? timezone, status: activity.status, course: activity.course });
    if (activity.dueOn) events.push({ sourceType: `${activity.kind}_DEADLINE`, sourceId: activity.id, title: activity.title, date: dateKey(activity.dueOn), allDay: true, status: activity.status, course: activity.course });
  }
  for (const task of tasks) {
    const startsInRange = Boolean(task.startsAt && task.startsAt >= timeFrom && task.startsAt < timeThrough);
    const dueInRange = Boolean(task.dueAt && task.dueAt >= timeFrom && task.dueAt < timeThrough);
    const sameLocalDate = Boolean(task.startsAt && task.dueAt && dateKeyInZone(task.startsAt, timezone) === dateKeyInZone(task.dueAt, timezone));
    if (startsInRange) events.push({ sourceType: "WORKSPACE_TASK", sourceId: task.id, title: task.title, description: task.description, startAt: task.startsAt!.toISOString(), endAt: sameLocalDate && dueInRange ? task.dueAt!.toISOString() : null, allDay: false, timezone, status: task.status, priority: task.priority, projectId: task.projectId, project: task.project });
    if (dueInRange && (!startsInRange || !sameLocalDate)) events.push({ sourceType: "WORKSPACE_TASK_DEADLINE", sourceId: task.id, title: task.title, description: task.description, startAt: task.dueAt!.toISOString(), endAt: null, allDay: false, timezone, status: task.status, priority: task.priority, projectId: task.projectId, project: task.project });
  }
  for (const milestone of projects) if (milestone.targetAt) events.push({ sourceType: "WORKSPACE_MILESTONE", sourceId: milestone.id, title: milestone.title, description: milestone.description, date: dateKey(milestone.targetAt), allDay: true, status: milestone.completedAt ? "COMPLETED" : "PLANNED", project: milestone.project });
  const consultationsByLeadTime = new Set(consultations.map((item) => `${item.lead.id}:${item.scheduledAt.getTime()}`));
  for (const lead of followUps) {
    if (!lead.nextFollowUpAt) continue;
    if (consultationsByLeadTime.has(`${lead.id}:${lead.nextFollowUpAt.getTime()}`)) continue;
    events.push({ sourceType: "CRM_LEAD_FOLLOW_UP", sourceId: lead.id, title: `Follow-up with ${lead.name}`, description: lead.nextBestAction, startAt: lead.nextFollowUpAt.toISOString(), endAt: null, allDay: false, timezone, status: lead.status, lead: { id: lead.id, name: lead.name }, purpose: lead.nextBestAction, overdue: lead.nextFollowUpAt < now });
  }
  for (const item of consultations) events.push({ sourceType: "CONSULTATION", sourceId: item.id, title: item.title, description: null, purpose: item.consultationType?.title ?? null, startAt: item.scheduledAt.toISOString(), endAt: new Date(item.scheduledAt.getTime() + item.durationMinutes * 60_000).toISOString(), allDay: false, timezone: item.timezone ?? timezone, status: item.status, lead: item.lead, readOnly: true });
  const unscheduled = [
    ...unscheduledTasks.map((item) => ({ sourceType: "WORKSPACE_TASK_UNSCHEDULED", sourceId: item.id, title: item.title, description: item.description, status: item.status, priority: item.priority, project: item.project })),
    ...unscheduledLeads.map((item) => ({ sourceType: "CRM_LEAD_UNSCHEDULED", sourceId: item.id, title: `Needs follow-up: ${item.name}`, description: item.nextBestAction, status: item.status, lead: { id: item.id, name: item.name } })),
  ];
  const overdue = [
    ...overdueTasks.map((item) => ({ sourceType: "WORKSPACE_TASK_DEADLINE", sourceId: item.id, title: item.title, description: item.description, status: item.status, priority: item.priority, dueAt: item.dueAt?.toISOString() ?? null, project: item.project })),
    ...overdueFollowUps.map((item) => ({ sourceType: "CRM_LEAD_FOLLOW_UP", sourceId: item.id, title: `Overdue follow-up: ${item.name}`, description: item.nextBestAction, status: item.status, dueAt: item.nextFollowUpAt?.toISOString() ?? null, lead: { id: item.id, name: item.name } })),
  ];
  const conflicts: Array<{ sourceType: string; sourceId: string; date: string; warning: string }> = [];
  let recurrenceTruncated = false;
  for (const rule of rules) {
    const exceptions = new Map(rule.exceptions.map((item) => [dateKey(item.occurrenceOn), item]));
    let day = rule.startsOn < fromDate ? startKey : dateKey(rule.startsOn);
    const last = rule.endsOn > academicDateToDatabase(endKey) ? endKey : dateKey(rule.endsOn);
    for (let i = 0; i < 62 && day <= last; i++, day = addDays(day, 1)) {
      if (events.length >= 2_000) { truncated = true; recurrenceTruncated = true; break; }
      const [year, month, date] = day.split("-").map(Number); const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay() || 7;
      if (!rule.weekdays.includes(weekday)) continue;
      const exception = exceptions.get(day);
      if (exception?.kind === "CANCELLED") continue;
      const startsAt = exception?.kind === "RESCHEDULED" ? exception.startsAt : isoIfValid([year, month, date], rule.localStart, rule.timezone);
      const endsAt = exception?.kind === "RESCHEDULED" ? exception.endsAt : isoIfValid([year, month, date], rule.localEnd, rule.timezone);
      if (!startsAt || !endsAt || endsAt <= startsAt) { conflicts.push({ sourceType: "CLASS", sourceId: rule.id, date: day, warning: "DST_TIME_REQUIRES_REVIEW" }); continue; }
      const eventTimezone = exception?.timezone ?? rule.timezone;
      const displayedDate = exception?.kind === "RESCHEDULED" ? dateKeyInZone(startsAt, eventTimezone) : day;
      if (displayedDate < startKey || displayedDate > endKey) continue;
      events.push({ sourceType: "CLASS", sourceId: rule.id, occurrenceDate: day, ...(displayedDate !== day ? { date: displayedDate } : {}), title: rule.title, startAt: startsAt.toISOString(), endAt: endsAt.toISOString(), allDay: false, timezone: eventTimezone, status: exception?.kind === "RESCHEDULED" ? "RESCHEDULED" : undefined, location: exception?.location ?? rule.location, course: rule.course });
    }
    if (recurrenceTruncated) break;
  }
  events.sort((a, b) => String(a.startAt ?? a.date ?? a.occurrenceDate).localeCompare(String(b.startAt ?? b.date ?? b.occurrenceDate)) || String(a.sourceType).localeCompare(String(b.sourceType)) || String(a.sourceId).localeCompare(String(b.sourceId)));
  const timed = events.filter((event) => typeof event.startAt === "string" && typeof event.endAt === "string").sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)) || String(a.sourceType).localeCompare(String(b.sourceType)) || String(a.sourceId).localeCompare(String(b.sourceId)));
  const overlapping = new Set<Record<string, unknown>>();
  for (let i = 0; i < timed.length; i++) {
    const end = String(timed[i].endAt);
    for (let j = i + 1; j < timed.length && String(timed[j].startAt) < end; j++) {
      overlapping.add(timed[i]); overlapping.add(timed[j]);
    }
  }
  for (const event of overlapping) conflicts.push({ sourceType: String(event.sourceType), sourceId: String(event.sourceId), date: String(event.startAt).slice(0, 10), warning: "OVERLAPPING_SESSION" });
  return ok({ from: startKey, to: endKey, timezone, weekStartsOn: workspace.weekStartsOn, events: events.slice(0, 2_000), conflicts: conflicts.slice(0, 2_000), unscheduled: unscheduled.slice(0, 400), overdue: overdue.slice(0, 400), truncated: truncated || events.length > 2_000 || conflicts.length > 2_000 || unscheduled.length > 400 || overdue.length > 400 });
}

function dateKeyInZone(date: Date, timezone: string) {
  const parts = getTimezoneParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export async function academicDashboard(ownerUserId: string, now = new Date()) {
  const [profile, years, courses, activities, workspace] = await Promise.all([getAcademicProfile(ownerUserId), listAcademicYears(ownerUserId), listAcademicCourses(ownerUserId), listAcademicActivities(ownerUserId), prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { timezone: true } })]);
  const currentYear = years.find((year) => year.isCurrent && !year.archivedAt) ?? null;
  const terms = currentYear ? await listAcademicTerms(ownerUserId, currentYear.id) : [];
  const currentTerm = terms.find((term) => term.isCurrent && !term.archivedAt) ?? null;
  const upcoming = activities.filter((activity) => activity.status !== "CANCELLED" && activity.status !== "COMPLETED" && ((activity.dueAt && activity.dueAt >= now) || (activity.startsAt && activity.startsAt >= now) || (activity.dueOn && activity.dueOn >= academicDateToDatabase(dateKey(now))))).slice(0, 12);
  return { profile, currentYear, currentTerm, timezone: workspace?.timezone ?? "Africa/Nairobi", courses, upcoming, assignmentCount: activities.filter((item) => item.kind === "ASSIGNMENT").length, examCount: activities.filter((item) => item.kind === "EXAM").length, studySessionCount: activities.filter((item) => item.kind === "STUDY_SESSION").length };
}
