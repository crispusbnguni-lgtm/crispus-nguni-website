import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = await readFile(new URL("../prisma/migrations/20261116190000_academic_planning_foundation/migration.sql", import.meta.url), "utf8");
const advancedSchema = await readFile(new URL("../prisma/migrations/20261122110000_advanced_academics/migration.sql", import.meta.url), "utf8");

test("additive migration defines each academic enum and model in the Prisma schema", () => {
  for (const name of ["AcademicActivityKind", "AcademicActivityStatus", "AcademicSubmissionStatus", "AcademicExamKind", "AcademicClassExceptionKind"]) {
    assert.match(schema, new RegExp(`enum ${name}\\s*\\{`));
    assert.match(migration, new RegExp(`CREATE TYPE "${name}" AS ENUM`));
  }
  for (const name of ["AcademicProfile", "AcademicYear", "AcademicTerm", "AcademicCourse", "AcademicCourseTerm", "AcademicActivity", "AcademicAssignment", "AcademicExam", "AcademicStudySession", "AcademicActivityTaskLink", "AcademicActivityProjectLink", "AcademicClassTimetableRule", "AcademicClassTimetableException"]) {
    assert.match(schema, new RegExp(`model ${name}\\s*\\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${name}"`));
  }
});

test("migration retains date-only deadlines, partial current-row uniqueness and workspace-scoped relations", () => {
  assert.match(schema, /dueOn\s+DateTime\?\s+@db\.Date/);
  assert.match(migration, /"dueOn" DATE/);
  assert.match(migration, /AcademicYear_one_current_per_workspace_key[\s\S]*?WHERE "isCurrent" = TRUE AND "archivedAt" IS NULL/);
  assert.match(migration, /AcademicTerm_one_current_per_workspace_key[\s\S]*?WHERE "isCurrent" = TRUE AND "archivedAt" IS NULL/);
  for (const constraint of ["AcademicCourseTerm_course_fkey", "AcademicCourseTerm_term_fkey", "AcademicActivityTaskLink_task_fkey", "AcademicActivityProjectLink_project_fkey"]) assert.match(migration, new RegExp(`CONSTRAINT "${constraint}" FOREIGN KEY \\(\\"workspaceId\\"`));
});

test("custom SQL index and relation constraint names are mapped in the Prisma datamodel", () => {
  const names = [
    "AcademicYear_workspace_dates_idx", "AcademicTerm_workspace_year_dates_idx", "AcademicCourse_workspace_year_archive_name_idx",
    "AcademicCourseTerm_workspace_year_term_idx", "AcademicActivity_workspace_course_kind_archive_due_idx", "AcademicActivity_workspace_start_end_idx",
    "AcademicActivity_workspace_due_status_idx", "AcademicActivityTaskLink_workspace_task_idx", "AcademicActivityProjectLink_workspace_project_idx",
    "AcademicClassTimetableRule_workspace_dates_idx", "AcademicClassTimetableRule_workspace_course_idx", "AcademicClassTimetableException_workspace_date_idx",
    "AcademicTerm_workspace_year_id_key", "AcademicTerm_workspace_year_name_key", "AcademicCourse_workspace_year_id_key",
    "AcademicCourse_workspace_year_code_key", "AcademicClassTimetableException_rule_date_key",
    "AcademicProfile_workspace_fkey", "AcademicYear_workspace_fkey", "AcademicTerm_year_fkey", "AcademicCourse_workspace_fkey",
    "AcademicCourse_year_fkey", "AcademicCourseTerm_course_fkey", "AcademicCourseTerm_term_fkey", "AcademicActivity_workspace_fkey", "AcademicActivity_course_fkey",
    "AcademicAssignment_activity_fkey", "AcademicExam_activity_fkey", "AcademicStudySession_activity_fkey",
    "AcademicActivityTaskLink_task_fkey", "AcademicActivityProjectLink_project_fkey", "AcademicClassTimetableRule_workspace_fkey", "AcademicClassTimetableRule_course_fkey",
    "AcademicClassTimetableException_rule_fkey",
  ];
  for (const name of names) assert.ok(schema.includes(`"${name}"`), `Prisma mapping for ${name} is required.`);
});

test("academic migration is additive and does not rewrite or remove existing data", () => {
  assert.match(migration, /CREATE TYPE/);
  assert.match(migration, /CREATE TABLE/);
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+"|ALTER\s+TABLE[\s\S]*?DROP)\b/i);
});

test("advanced academics migration adds topic scores and private course resource metadata additively", () => {
  for (const field of ['"topic" TEXT', '"score" DECIMAL(8,2)', '"maxScore" DECIMAL(8,2)']) assert.ok(advancedSchema.includes(field));
  assert.match(advancedSchema, /CREATE TABLE "AcademicKnowledgeResource"/);
  assert.match(advancedSchema, /AcademicKnowledgeResource_course_fkey[\s\S]*?FOREIGN KEY \("workspaceId", "courseId"\)/);
  assert.match(advancedSchema, /AcademicKnowledgeResource_media_fkey[\s\S]*?FOREIGN KEY \("workspaceId", "mediaAssetId"\)/);
  for (const name of ["AcademicKnowledgeResource_course_fkey", "AcademicKnowledgeResource_media_fkey", "AcademicKnowledgeResource_workspace_id_key", "AcademicKnowledgeResource_workspace_media_key", "AcademicKnowledgeResource_workspace_course_topic_idx"]) assert.ok(schema.includes(`"${name}"`), `Prisma mapping for ${name} is required.`);
  assert.doesNotMatch(advancedSchema, /\b(DROP|TRUNCATE|DELETE\s+FROM)\b/i);
  assert.match(schema, /model AcademicKnowledgeResource\s*\{/);
});
