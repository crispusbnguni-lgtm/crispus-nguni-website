-- Additive Personal Workspace academic planning foundation.
-- No existing records are rewritten and no academic rows are seeded.

CREATE TYPE "AcademicActivityKind" AS ENUM ('ASSIGNMENT', 'EXAM', 'STUDY_SESSION');
CREATE TYPE "AcademicActivityStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AcademicSubmissionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'GRADED');
CREATE TYPE "AcademicExamKind" AS ENUM ('EXAM', 'QUIZ', 'PRACTICAL', 'ORAL', 'OTHER');
CREATE TYPE "AcademicClassExceptionKind" AS ENUM ('CANCELLED', 'RESCHEDULED');

CREATE TABLE "AcademicProfile" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "institution" TEXT,
  "program" TEXT,
  "department" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicProfile_workspaceId_key" UNIQUE ("workspaceId")
);

CREATE TABLE "AcademicYear" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT FALSE,
  "archivedAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicYear_workspaceId_id_key" UNIQUE ("workspaceId", "id"),
  CONSTRAINT "AcademicYear_workspaceId_name_key" UNIQUE ("workspaceId", "name"),
  CONSTRAINT "AcademicYear_date_range_check" CHECK ("endsOn" >= "startsOn")
);
CREATE UNIQUE INDEX "AcademicYear_one_current_per_workspace_key"
  ON "AcademicYear"("workspaceId") WHERE "isCurrent" = TRUE AND "archivedAt" IS NULL;
CREATE INDEX "AcademicYear_workspace_dates_idx" ON "AcademicYear"("workspaceId", "startsOn", "endsOn");

CREATE TABLE "AcademicTerm" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT FALSE,
  "archivedAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicTerm_workspaceId_id_key" UNIQUE ("workspaceId", "id"),
  CONSTRAINT "AcademicTerm_workspace_year_id_key" UNIQUE ("workspaceId", "academicYearId", "id"),
  CONSTRAINT "AcademicTerm_workspace_year_name_key" UNIQUE ("workspaceId", "academicYearId", "name"),
  CONSTRAINT "AcademicTerm_date_range_check" CHECK ("endsOn" >= "startsOn")
);
CREATE UNIQUE INDEX "AcademicTerm_one_current_per_workspace_key"
  ON "AcademicTerm"("workspaceId") WHERE "isCurrent" = TRUE AND "archivedAt" IS NULL;
CREATE INDEX "AcademicTerm_workspace_year_dates_idx" ON "AcademicTerm"("workspaceId", "academicYearId", "startsOn", "endsOn");

CREATE TABLE "AcademicCourse" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "credits" DECIMAL(6,2),
  "color" TEXT,
  "archivedAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicCourse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicCourse_workspaceId_id_key" UNIQUE ("workspaceId", "id"),
  CONSTRAINT "AcademicCourse_workspace_year_id_key" UNIQUE ("workspaceId", "academicYearId", "id"),
  CONSTRAINT "AcademicCourse_workspace_year_code_key" UNIQUE ("workspaceId", "academicYearId", "code"),
  CONSTRAINT "AcademicCourse_credits_check" CHECK ("credits" IS NULL OR "credits" >= 0)
);
CREATE INDEX "AcademicCourse_workspace_year_archive_name_idx" ON "AcademicCourse"("workspaceId", "academicYearId", "archivedAt", "name");

CREATE TABLE "AcademicCourseTerm" (
  "workspaceId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  CONSTRAINT "AcademicCourseTerm_pkey" PRIMARY KEY ("workspaceId", "courseId", "termId")
);
CREATE INDEX "AcademicCourseTerm_workspace_year_term_idx" ON "AcademicCourseTerm"("workspaceId", "academicYearId", "termId");

CREATE TABLE "AcademicActivity" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "kind" "AcademicActivityKind" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "AcademicActivityStatus" NOT NULL DEFAULT 'PLANNED',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "dueOn" DATE,
  "dueAt" TIMESTAMP(3),
  "timezone" TEXT,
  "location" TEXT,
  "archivedAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicActivity_workspaceId_id_key" UNIQUE ("workspaceId", "id"),
  CONSTRAINT "AcademicActivity_time_range_check" CHECK ("endsAt" IS NULL OR "startsAt" IS NOT NULL AND "endsAt" > "startsAt"),
  CONSTRAINT "AcademicActivity_deadline_semantics_check" CHECK ("dueOn" IS NULL OR "dueAt" IS NULL)
);
CREATE INDEX "AcademicActivity_workspace_course_kind_archive_due_idx" ON "AcademicActivity"("workspaceId", "courseId", "kind", "archivedAt", "dueOn");
CREATE INDEX "AcademicActivity_workspace_start_end_idx" ON "AcademicActivity"("workspaceId", "startsAt", "endsAt");
CREATE INDEX "AcademicActivity_workspace_due_status_idx" ON "AcademicActivity"("workspaceId", "dueAt", "status");

CREATE TABLE "AcademicAssignment" (
  "workspaceId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "submissionStatus" "AcademicSubmissionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "submittedAt" TIMESTAMP(3),
  "grade" TEXT,
  "feedback" TEXT,
  CONSTRAINT "AcademicAssignment_pkey" PRIMARY KEY ("workspaceId", "activityId")
);
CREATE TABLE "AcademicExam" (
  "workspaceId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "examKind" "AcademicExamKind" NOT NULL DEFAULT 'EXAM',
  "venue" TEXT,
  CONSTRAINT "AcademicExam_pkey" PRIMARY KEY ("workspaceId", "activityId")
);
CREATE TABLE "AcademicStudySession" (
  "workspaceId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "goal" TEXT,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AcademicStudySession_pkey" PRIMARY KEY ("workspaceId", "activityId"),
  CONSTRAINT "AcademicStudySession_progress_check" CHECK ("progress" BETWEEN 0 AND 100)
);

CREATE TABLE "AcademicActivityTaskLink" (
  "workspaceId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicActivityTaskLink_pkey" PRIMARY KEY ("workspaceId", "activityId", "taskId")
);
CREATE INDEX "AcademicActivityTaskLink_workspace_task_idx" ON "AcademicActivityTaskLink"("workspaceId", "taskId");
CREATE TABLE "AcademicActivityProjectLink" (
  "workspaceId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicActivityProjectLink_pkey" PRIMARY KEY ("workspaceId", "activityId", "projectId")
);
CREATE INDEX "AcademicActivityProjectLink_workspace_project_idx" ON "AcademicActivityProjectLink"("workspaceId", "projectId");

CREATE TABLE "AcademicClassTimetableRule" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "weekdays" INTEGER[] NOT NULL,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL,
  "localStart" TEXT NOT NULL,
  "localEnd" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "location" TEXT,
  "archivedAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicClassTimetableRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicClassTimetableRule_workspaceId_id_key" UNIQUE ("workspaceId", "id"),
  CONSTRAINT "AcademicClassTimetableRule_dates_check" CHECK ("endsOn" >= "startsOn"),
  CONSTRAINT "AcademicClassTimetableRule_weekdays_check" CHECK (cardinality("weekdays") BETWEEN 1 AND 7 AND "weekdays" <@ ARRAY[1,2,3,4,5,6,7]::INTEGER[]),
  CONSTRAINT "AcademicClassTimetableRule_times_check" CHECK ("localStart" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND "localEnd" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND "localEnd" > "localStart")
);
CREATE INDEX "AcademicClassTimetableRule_workspace_dates_idx" ON "AcademicClassTimetableRule"("workspaceId", "startsOn", "endsOn", "archivedAt");
CREATE INDEX "AcademicClassTimetableRule_workspace_course_idx" ON "AcademicClassTimetableRule"("workspaceId", "courseId");

CREATE TABLE "AcademicClassTimetableException" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "occurrenceOn" DATE NOT NULL,
  "kind" "AcademicClassExceptionKind" NOT NULL,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "timezone" TEXT,
  "location" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicClassTimetableException_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicClassTimetableException_rule_date_key" UNIQUE ("workspaceId", "ruleId", "occurrenceOn"),
  CONSTRAINT "AcademicClassTimetableException_override_check" CHECK (("kind" = 'CANCELLED' AND "startsAt" IS NULL AND "endsAt" IS NULL) OR ("kind" = 'RESCHEDULED' AND "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" > "startsAt"))
);
CREATE INDEX "AcademicClassTimetableException_workspace_date_idx" ON "AcademicClassTimetableException"("workspaceId", "occurrenceOn");

ALTER TABLE "AcademicProfile" ADD CONSTRAINT "AcademicProfile_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_year_fkey" FOREIGN KEY ("workspaceId", "academicYearId") REFERENCES "AcademicYear"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicCourse" ADD CONSTRAINT "AcademicCourse_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicCourse" ADD CONSTRAINT "AcademicCourse_year_fkey" FOREIGN KEY ("workspaceId", "academicYearId") REFERENCES "AcademicYear"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicCourseTerm" ADD CONSTRAINT "AcademicCourseTerm_course_fkey" FOREIGN KEY ("workspaceId", "academicYearId", "courseId") REFERENCES "AcademicCourse"("workspaceId", "academicYearId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicCourseTerm" ADD CONSTRAINT "AcademicCourseTerm_term_fkey" FOREIGN KEY ("workspaceId", "academicYearId", "termId") REFERENCES "AcademicTerm"("workspaceId", "academicYearId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicActivity" ADD CONSTRAINT "AcademicActivity_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicActivity" ADD CONSTRAINT "AcademicActivity_course_fkey" FOREIGN KEY ("workspaceId", "courseId") REFERENCES "AcademicCourse"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicAssignment" ADD CONSTRAINT "AcademicAssignment_activity_fkey" FOREIGN KEY ("workspaceId", "activityId") REFERENCES "AcademicActivity"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicExam" ADD CONSTRAINT "AcademicExam_activity_fkey" FOREIGN KEY ("workspaceId", "activityId") REFERENCES "AcademicActivity"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicStudySession" ADD CONSTRAINT "AcademicStudySession_activity_fkey" FOREIGN KEY ("workspaceId", "activityId") REFERENCES "AcademicActivity"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicActivityTaskLink" ADD CONSTRAINT "AcademicActivityTaskLink_activity_fkey" FOREIGN KEY ("workspaceId", "activityId") REFERENCES "AcademicActivity"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicActivityTaskLink" ADD CONSTRAINT "AcademicActivityTaskLink_task_fkey" FOREIGN KEY ("workspaceId", "taskId") REFERENCES "WorkspaceTask"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicActivityProjectLink" ADD CONSTRAINT "AcademicActivityProjectLink_activity_fkey" FOREIGN KEY ("workspaceId", "activityId") REFERENCES "AcademicActivity"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicActivityProjectLink" ADD CONSTRAINT "AcademicActivityProjectLink_project_fkey" FOREIGN KEY ("workspaceId", "projectId") REFERENCES "WorkspaceProject"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicClassTimetableRule" ADD CONSTRAINT "AcademicClassTimetableRule_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicClassTimetableRule" ADD CONSTRAINT "AcademicClassTimetableRule_course_fkey" FOREIGN KEY ("workspaceId", "courseId") REFERENCES "AcademicCourse"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicClassTimetableException" ADD CONSTRAINT "AcademicClassTimetableException_rule_fkey" FOREIGN KEY ("workspaceId", "ruleId") REFERENCES "AcademicClassTimetableRule"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
