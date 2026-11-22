import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/consultations/timezone-core") return { url: new URL("../src/lib/consultations/timezone-core.ts", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });

const core = await import("../src/lib/personal-workspace-academics-core.ts");

test("academic date-only fields accept real dates and reject impossible calendar dates", () => {
  assert.equal(core.parseAcademicDate("2028-02-29"), "2028-02-29");
  assert.equal(core.parseAcademicDate("2027-02-29"), undefined);
  assert.equal(core.parseAcademicDate("2026-2-01"), undefined);
});

test("assignment deadline retains date-only semantics without manufacturing a UTC instant", () => {
  const parsed = core.parseAcademicActivity({ kind: "ASSIGNMENT", courseId: "course-a", title: "Essay", dueOn: "2026-11-30" });
  assert.equal(parsed.success, true);
  assert.equal(parsed.value.dueOn, "2026-11-30");
  assert.equal(parsed.value.dueAt, null);
  assert.equal(core.parseAcademicActivity({ kind: "ASSIGNMENT", courseId: "course-a", title: "Essay", dueOn: "2026-11-30", dueAt: "2026-11-30T12:00:00Z" }).success, false);
  assert.equal(core.parseAcademicActivity({ dueAt: "2026-11-30T12:00:00Z", expectedRevision: 0 }, true).value.dueOn, null);
  assert.equal(core.parseAcademicActivity({ dueOn: "2026-11-30", expectedRevision: 0 }, true).value.dueAt, null);
  assert.equal(core.parseAcademicActivity({ title: "Renamed", expectedRevision: 0 }, true).value.dueOn, undefined);
});

test("exact activities require a valid IANA zone for local input and reject DST ambiguity", () => {
  const valid = core.parseAcademicActivity({ kind: "EXAM", courseId: "course-a", title: "Final", startsAt: "2026-11-20T09:00", endsAt: "2026-11-20T11:00", timezone: "Africa/Nairobi" });
  assert.equal(valid.success, true);
  assert.equal(valid.value.startsAt.toISOString(), "2026-11-20T06:00:00.000Z");
  assert.equal(core.parseAcademicActivity({ kind: "EXAM", courseId: "course-a", title: "Final", startsAt: "2026-11-20T09:00", endsAt: "2026-11-20T11:00", timezone: "Bad/Zone" }).success, false);
  assert.equal(core.parseAcademicActivity({ kind: "EXAM", courseId: "course-a", title: "Final", startsAt: "2026-11-01T01:30", endsAt: "2026-11-01T02:30", timezone: "America/New_York" }).success, false);
});

test("exam and study sessions require bounded start and end values", () => {
  assert.equal(core.parseAcademicActivity({ kind: "EXAM", courseId: "course-a", title: "Final" }).success, false);
  assert.equal(core.parseAcademicActivity({ kind: "STUDY_SESSION", courseId: "course-a", title: "Revision", startsAt: "2026-11-20T11:00Z", endsAt: "2026-11-20T10:00Z" }).success, false);
  assert.equal(core.parseAcademicActivity({ kind: "STUDY_SESSION", courseId: "course-a", title: "Revision", startsAt: "2026-11-20T10:00Z", endsAt: "2026-11-20T11:00Z", progress: 101 }).success, false);
});

test("assessment scores require a greater maximum and retain an optional topic", () => {
  const base = { kind: "EXAM", courseId: "course-a", title: "CAT 1", startsAt: "2026-11-20T10:00Z", endsAt: "2026-11-20T11:00Z" };
  assert.equal(core.parseAcademicActivity({ ...base, topic: "Probability", score: 18, maxScore: 20 }).success, true);
  assert.equal(core.parseAcademicActivity({ ...base, score: 20, maxScore: 20 }).success, false);
  assert.equal(core.parseAcademicActivity({ ...base, score: -1, maxScore: 20 }).success, false);
  assert.equal(core.parseAcademicActivity({ ...base, score: 12 }).success, false);
});

test("weekly rules reject duplicate weekdays, unbounded dates, and nonexistent local class times", () => {
  const base = { courseId: "course-a", title: "Lecture", weekdays: [1, 3], startsOn: "2026-11-16", endsOn: "2026-12-16", localStart: "09:00", localEnd: "10:00", timezone: "Africa/Nairobi" };
  assert.equal(core.parseClassTimetableRule(base).success, true);
  assert.equal(core.parseClassTimetableRule({ ...base, weekdays: [1, 1] }).success, false);
  assert.equal(core.parseClassTimetableRule({ ...base, endsOn: "2026-11-15" }).success, false);
  assert.equal(core.parseClassTimetableRule({ ...base, weekdays: [7], startsOn: "2026-03-08", endsOn: "2026-03-30", localStart: "02:30", localEnd: "03:30", timezone: "America/New_York" }).success, false);
});

test("rescheduled occurrences require valid, unambiguous local times; cancellation has no replacement fields", () => {
  assert.equal(core.parseClassTimetableException({ occurrenceOn: "2026-11-20", kind: "CANCELLED" }).success, true);
  assert.equal(core.parseClassTimetableException({ occurrenceOn: "2026-11-20", kind: "CANCELLED", startsAt: "2026-11-20T09:00Z" }).success, false);
  const moved = core.parseClassTimetableException({ occurrenceOn: "2026-11-20", kind: "RESCHEDULED", startsAt: "2026-11-20T12:00", endsAt: "2026-11-20T13:00", timezone: "Africa/Nairobi" });
  assert.equal(moved.success, true);
  assert.equal(moved.value.startsAt.toISOString(), "2026-11-20T09:00:00.000Z");
});

test("activity state transitions reject terminal-state jumps and allow explicit reopen", () => {
  assert.equal(core.canTransitionAcademicActivity("PLANNED", "COMPLETED"), false);
  assert.equal(core.canTransitionAcademicActivity("PLANNED", "IN_PROGRESS"), true);
  assert.equal(core.canTransitionAcademicActivity("COMPLETED", "IN_PROGRESS"), true);
  assert.equal(core.canTransitionAcademicActivity("CANCELLED", "COMPLETED"), false);
});
