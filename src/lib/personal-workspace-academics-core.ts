import {
  getZonedDateTimeCandidates,
  isValidIanaTimezone,
} from "@/lib/consultations/timezone-core";

export const ACADEMIC_ACTIVITY_KINDS = ["ASSIGNMENT", "EXAM", "STUDY_SESSION"] as const;
export const ACADEMIC_ACTIVITY_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const ACADEMIC_SUBMISSION_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "GRADED"] as const;
export const ACADEMIC_EXAM_KINDS = ["EXAM", "QUIZ", "PRACTICAL", "ORAL", "OTHER"] as const;
const ACTIVITY_TRANSITIONS: Record<(typeof ACADEMIC_ACTIVITY_STATUSES)[number], readonly (typeof ACADEMIC_ACTIVITY_STATUSES)[number][]> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["PLANNED", "COMPLETED", "CANCELLED"],
  COMPLETED: ["IN_PROGRESS"],
  CANCELLED: ["PLANNED"],
};
export function canTransitionAcademicActivity(from: string, to: string) { return from === to || ((ACTIVITY_TRANSITIONS as Record<string, readonly string[]>)[from]?.includes(to) ?? false); }

type RecordValue = Record<string, unknown>;
const plain = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const text = (value: unknown, max: number, required = false): value is string => typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
const only = (value: RecordValue, keys: readonly string[]) => Object.keys(value).every((key) => keys.includes(key));
const fail = (message: string) => ({ success: false as const, message });
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function parseAcademicDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !dateOnlyPattern.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : undefined;
}

export function parseAcademicInstant(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length > 40 || !dateTimePattern.test(value)) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function parseActivityInstant(value: unknown, timezone: unknown): Date | undefined | null {
  if (value === null) return null;
  const absolute = parseAcademicInstant(value);
  if (absolute) return absolute;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || typeof timezone !== "string" || !isValidIanaTimezone(timezone)) return undefined;
  const [datePart, timePart] = value.split("T"); const date = parseAcademicDate(datePart); if (!date) return undefined;
  const [year, month, day] = date.split("-").map(Number); const [hour, minute] = timePart.split(":").map(Number);
  const candidates = getZonedDateTimeCandidates(year, month, day, hour, minute, timezone);
  return candidates.length === 1 ? candidates[0] : undefined;
}

function validRevision(input: RecordValue, required: boolean) {
  return (!required && !("expectedRevision" in input)) || (Number.isInteger(input.expectedRevision) && (input.expectedRevision as number) >= 0);
}

export function parseAcademicProfile(input: unknown) {
  const keys = ["institution", "program", "department", "expectedRevision"];
  if (!plain(input) || !only(input, keys) || !validRevision(input, true)) return fail("Academic profile fields are invalid.");
  const value: RecordValue = { expectedRevision: input.expectedRevision };
  for (const key of ["institution", "program", "department"] as const) {
    if (!(key in input)) continue;
    if (input[key] !== null && !text(input[key], 240)) return fail("Academic profile text is invalid.");
    value[key] = typeof input[key] === "string" && input[key].trim() ? input[key].trim() : null;
  }
  return { success: true as const, value };
}

export function parseAcademicYear(input: unknown, partial = false) {
  const keys = ["name", "startsOn", "endsOn", "isCurrent", "archived", "expectedRevision"];
  if (!plain(input) || !only(input, keys) || !validRevision(input, partial)) return fail("Academic year fields are invalid.");
  const value: RecordValue = {};
  if ("name" in input) { if (!text(input.name, 100, true)) return fail("Academic year name is invalid."); value.name = input.name.trim(); }
  else if (!partial) return fail("Academic year name is required.");
  for (const key of ["startsOn", "endsOn"] as const) if (key in input) { const date = parseAcademicDate(input[key]); if (!date) return fail("Academic year dates must be real calendar dates."); value[key] = date; }
  if (!partial && (!value.startsOn || !value.endsOn)) return fail("Academic year dates are required.");
  if ("isCurrent" in input) { if (typeof input.isCurrent !== "boolean") return fail("Current year state is invalid."); value.isCurrent = input.isCurrent; }
  if ("archived" in input) { if (typeof input.archived !== "boolean") return fail("Archive state is invalid."); value.archived = input.archived; }
  if ("expectedRevision" in input) value.expectedRevision = input.expectedRevision;
  const start = value.startsOn as string | undefined; const end = value.endsOn as string | undefined;
  if (start && end && end < start) return fail("Academic year end must not precede its start.");
  return { success: true as const, value };
}

export function parseAcademicTerm(input: unknown, partial = false) {
  const keys = ["academicYearId", "name", "startsOn", "endsOn", "isCurrent", "archived", "sortOrder", "expectedRevision"];
  if (!plain(input) || !only(input, keys) || !validRevision(input, partial)) return fail("Academic term fields are invalid.");
  const value: RecordValue = {};
  if ("academicYearId" in input) { if (!text(input.academicYearId, 128, true)) return fail("Academic year reference is invalid."); value.academicYearId = input.academicYearId; }
  else if (!partial) return fail("Academic year is required.");
  if ("name" in input) { if (!text(input.name, 100, true)) return fail("Academic term name is invalid."); value.name = input.name.trim(); }
  else if (!partial) return fail("Academic term name is required.");
  for (const key of ["startsOn", "endsOn"] as const) if (key in input) { const date = parseAcademicDate(input[key]); if (!date) return fail("Academic term dates must be real calendar dates."); value[key] = date; }
  if (!partial && (!value.startsOn || !value.endsOn)) return fail("Academic term dates are required.");
  if ("isCurrent" in input) { if (typeof input.isCurrent !== "boolean") return fail("Current term state is invalid."); value.isCurrent = input.isCurrent; }
  if ("archived" in input) { if (typeof input.archived !== "boolean") return fail("Archive state is invalid."); value.archived = input.archived; }
  if ("sortOrder" in input) { if (!Number.isInteger(input.sortOrder) || (input.sortOrder as number) < 0 || (input.sortOrder as number) > 10_000) return fail("Term ordering is invalid."); value.sortOrder = input.sortOrder; }
  if ("expectedRevision" in input) value.expectedRevision = input.expectedRevision;
  const start = value.startsOn as string | undefined; const end = value.endsOn as string | undefined;
  if (start && end && end < start) return fail("Academic term end must not precede its start.");
  return { success: true as const, value };
}

export function parseAcademicCourse(input: unknown, partial = false) {
  const keys = ["academicYearId", "name", "code", "description", "credits", "color", "termIds", "archived", "expectedRevision"];
  if (!plain(input) || !only(input, keys) || !validRevision(input, partial)) return fail("Academic course fields are invalid.");
  const value: RecordValue = {};
  if ("academicYearId" in input) { if (!text(input.academicYearId, 128, true)) return fail("Academic year reference is invalid."); value.academicYearId = input.academicYearId; }
  else if (!partial) return fail("Academic year is required.");
  if ("name" in input) { if (!text(input.name, 160, true)) return fail("Course name is invalid."); value.name = input.name.trim(); }
  else if (!partial) return fail("Course name is required.");
  for (const [key, max] of [["code", 40], ["description", 4000], ["color", 32]] as const) if (key in input) { if (input[key] !== null && !text(input[key], max)) return fail("Course text is invalid."); value[key] = typeof input[key] === "string" && input[key].trim() ? input[key].trim() : null; }
  if ("credits" in input) { if (input.credits !== null && (typeof input.credits !== "number" || !Number.isFinite(input.credits) || input.credits < 0 || input.credits > 1000)) return fail("Course credits are invalid."); value.credits = input.credits; }
  if ("termIds" in input) { if (!Array.isArray(input.termIds) || input.termIds.length > 32 || !input.termIds.every((id) => text(id, 128, true)) || new Set(input.termIds).size !== input.termIds.length) return fail("Course terms are invalid."); value.termIds = input.termIds; }
  if ("archived" in input) { if (typeof input.archived !== "boolean") return fail("Archive state is invalid."); value.archived = input.archived; }
  if ("expectedRevision" in input) value.expectedRevision = input.expectedRevision;
  return { success: true as const, value };
}

export function parseAcademicActivity(input: unknown, partial = false) {
  const keys = ["kind", "courseId", "title", "description", "status", "startsAt", "endsAt", "dueOn", "dueAt", "timezone", "location", "submissionStatus", "submittedAt", "grade", "feedback", "examKind", "venue", "score", "maxScore", "topic", "goal", "progress", "taskIds", "projectIds", "archived", "expectedRevision"];
  if (!plain(input) || !only(input, keys) || !validRevision(input, partial)) return fail("Academic activity fields are invalid.");
  const value: RecordValue = {};
  for (const key of ["kind", "courseId", "title"] as const) {
    if (!(key in input)) { if (!partial) return fail("Activity type, course and title are required."); continue; }
    if (key === "kind" ? !(ACADEMIC_ACTIVITY_KINDS as readonly unknown[]).includes(input[key]) : !text(input[key], key === "title" ? 200 : 128, true)) return fail("Academic activity fields are invalid.");
    value[key] = key === "title" ? (input[key] as string).trim() : input[key];
  }
  if ("description" in input) { if (input.description !== null && !text(input.description, 8000)) return fail("Activity description is invalid."); value.description = input.description === null || !(input.description as string)?.trim() ? null : (input.description as string).trim(); }
  if ("status" in input) { if (!(ACADEMIC_ACTIVITY_STATUSES as readonly unknown[]).includes(input.status)) return fail("Activity status is invalid."); value.status = input.status; }
  if ("timezone" in input) { if (input.timezone !== null && (!text(input.timezone, 100, true) || !isValidIanaTimezone(input.timezone))) return fail("Activity timezone is invalid."); value.timezone = input.timezone; }
  for (const key of ["startsAt", "endsAt", "dueAt", "submittedAt"] as const) if (key in input) { const date = parseActivityInstant(input[key], input.timezone); if (date === undefined) return fail("Activity date and time must be valid in the selected timezone."); value[key] = date; }
  if ("dueOn" in input) { const date = input.dueOn === null ? null : parseAcademicDate(input.dueOn); if (date === undefined) return fail("Date-only deadline must be a real YYYY-MM-DD date."); value.dueOn = date; }
  if ("dueOn" in input && input.dueOn !== null && input.dueAt === undefined) value.dueAt = null;
  if ("dueAt" in input && input.dueAt !== null && input.dueOn === undefined) value.dueOn = null;
  if (value.dueOn && value.dueAt) return fail("Use either a date-only deadline or an exact deadline time, not both.");
  if (value.startsAt instanceof Date && value.endsAt instanceof Date && value.endsAt <= value.startsAt) return fail("Activity end must be after its start.");
  if (!partial && (value.kind === "EXAM" || value.kind === "STUDY_SESSION") && (!(value.startsAt instanceof Date) || !(value.endsAt instanceof Date))) return fail("Examinations and study sessions require a start and end time.");
  if ((value.kind === "EXAM" || value.kind === "STUDY_SESSION") && ((value.startsAt === null) !== (value.endsAt === null))) return fail("Activity start and end times must be provided together.");
  for (const key of ["location", "venue", "grade", "feedback", "goal", "topic"] as const) if (key in input) { const max = key === "feedback" ? 4000 : key === "goal" ? 2000 : key === "topic" ? 160 : 500; if (input[key] !== null && !text(input[key], max)) return fail("Academic activity details are invalid."); value[key] = typeof input[key] === "string" && input[key].trim() ? input[key].trim() : null; }
  for (const key of ["score", "maxScore"] as const) if (key in input) { const score = input[key]; if (score !== null && (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1_000_000)) return fail("Assessment marks must be non-negative numbers."); value[key] = score; }
  if (value.maxScore !== undefined && value.maxScore !== null && (value.maxScore as number) <= 0) return fail("Maximum marks must be greater than zero.");
  if (value.score !== undefined && value.score !== null && value.maxScore === undefined) return fail("Maximum marks are required when a score is entered.");
  if (value.maxScore !== undefined && value.maxScore !== null && value.score !== undefined && value.score !== null && (value.maxScore as number) <= (value.score as number)) return fail("Maximum marks must be greater than the entered score.");
  if ("submissionStatus" in input) { if (!(ACADEMIC_SUBMISSION_STATUSES as readonly unknown[]).includes(input.submissionStatus)) return fail("Submission status is invalid."); value.submissionStatus = input.submissionStatus; }
  if ("examKind" in input) { if (!(ACADEMIC_EXAM_KINDS as readonly unknown[]).includes(input.examKind)) return fail("Exam type is invalid."); value.examKind = input.examKind; }
  if ("progress" in input) { if (!Number.isInteger(input.progress) || (input.progress as number) < 0 || (input.progress as number) > 100) return fail("Study progress must be from 0 to 100."); value.progress = input.progress; }
  for (const key of ["taskIds", "projectIds"] as const) if (key in input) { if (!Array.isArray(input[key]) || input[key].length > 20 || !input[key].every((id) => text(id, 128, true)) || new Set(input[key]).size !== input[key].length) return fail("Workspace links are invalid."); value[key] = input[key]; }
  if ("archived" in input) { if (typeof input.archived !== "boolean") return fail("Archive state is invalid."); value.archived = input.archived; }
  if ("expectedRevision" in input) value.expectedRevision = input.expectedRevision;
  return { success: true as const, value };
}

export function parseClassTimetableRule(input: unknown, partial = false) {
  const keys = ["courseId", "title", "weekdays", "startsOn", "endsOn", "localStart", "localEnd", "timezone", "location", "archived", "expectedRevision"];
  if (!plain(input) || !only(input, keys) || !validRevision(input, partial)) return fail("Timetable fields are invalid.");
  const value: RecordValue = {};
  for (const key of ["courseId", "title", "startsOn", "endsOn", "localStart", "localEnd", "timezone"] as const) {
    if (!(key in input)) { if (!partial) return fail("Timetable fields are required."); continue; }
    value[key] = input[key];
  }
  if ("courseId" in value && !text(value.courseId, 128, true)) return fail("Course reference is invalid.");
  if ("title" in value && !text(value.title, 160, true)) return fail("Class title is invalid.");
  for (const key of ["startsOn", "endsOn"] as const) if (key in value) { const date = parseAcademicDate(value[key]); if (!date) return fail("Timetable dates are invalid."); value[key] = date; }
  if ("weekdays" in input) { const days = input.weekdays; if (!Array.isArray(days) || days.length < 1 || days.length > 7 || !days.every((day) => Number.isInteger(day) && day >= 1 && day <= 7) || new Set(days).size !== days.length) return fail("Choose one or more distinct weekdays from 1 to 7."); value.weekdays = [...days].sort(); }
  else if (!partial) return fail("Timetable weekdays are required.");
  for (const key of ["localStart", "localEnd"] as const) if (key in value && (typeof value[key] !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value[key] as string))) return fail("Class times must use 24-hour HH:MM format.");
  if ("timezone" in value && (typeof value.timezone !== "string" || !isValidIanaTimezone(value.timezone))) return fail("Timetable timezone is invalid.");
  if ("location" in input) { if (input.location !== null && !text(input.location, 500)) return fail("Class location is invalid."); value.location = input.location; }
  if ("archived" in input) { if (typeof input.archived !== "boolean") return fail("Archive state is invalid."); value.archived = input.archived; }
  if ("expectedRevision" in input) value.expectedRevision = input.expectedRevision;
  if (value.startsOn && value.endsOn && (value.endsOn as string) < (value.startsOn as string)) return fail("Timetable end date must not precede its start.");
  if (typeof value.startsOn === "string" && Array.isArray(value.weekdays) && typeof value.localStart === "string" && typeof value.localEnd === "string" && typeof value.timezone === "string") {
    const [y, m, d] = value.startsOn.split("-").map(Number);
    for (let offset = 0; offset < 7; offset++) {
      const date = new Date(Date.UTC(y, m - 1, d + offset));
      const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
      if (!(value.weekdays as number[]).includes(weekday)) continue;
      const [sh, sm] = (value.localStart as string).split(":").map(Number);
      const [eh, em] = (value.localEnd as string).split(":").map(Number);
      if (getZonedDateTimeCandidates(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), sh, sm, value.timezone as string).length !== 1 || getZonedDateTimeCandidates(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), eh, em, value.timezone as string).length !== 1) return fail("The first class occurrence falls on an ambiguous or nonexistent local time.");
      if (eh * 60 + em <= sh * 60 + sm) return fail("A class session must end later on the same local day.");
      break;
    }
  }
  return { success: true as const, value };
}

export function parseClassTimetableException(input: unknown) {
  const keys = ["occurrenceOn", "kind", "startsAt", "endsAt", "timezone", "location"];
  if (!plain(input) || !only(input, keys)) return fail("Timetable exception fields are invalid.");
  const occurrenceOn = parseAcademicDate(input.occurrenceOn);
  if (!occurrenceOn || (input.kind !== "CANCELLED" && input.kind !== "RESCHEDULED")) return fail("Timetable exception date or kind is invalid.");
  if (input.kind === "CANCELLED") {
    if (Object.keys(input).some((key) => !["occurrenceOn", "kind"].includes(key))) return fail("Cancelled occurrence cannot include a replacement time.");
    return { success: true as const, value: { occurrenceOn, kind: "CANCELLED" as const } };
  }
  if (!text(input.timezone, 100, true) || !isValidIanaTimezone(input.timezone)) return fail("Rescheduled occurrence must have a valid timezone.");
  const startsAt = parseActivityInstant(input.startsAt, input.timezone); const endsAt = parseActivityInstant(input.endsAt, input.timezone);
  if (!(startsAt instanceof Date) || !(endsAt instanceof Date) || endsAt <= startsAt) return fail("Rescheduled occurrence must have valid, unambiguous local times.");
  if (input.location !== undefined && input.location !== null && !text(input.location, 500)) return fail("Replacement location is invalid.");
  return { success: true as const, value: { occurrenceOn, kind: "RESCHEDULED" as const, startsAt, endsAt, timezone: input.timezone, location: input.location ?? null } };
}

export function academicDateToDatabase(value: string): Date { return new Date(`${value}T00:00:00.000Z`); }
