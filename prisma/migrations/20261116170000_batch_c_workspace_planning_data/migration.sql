CREATE TYPE "WorkspaceTaskStatus" AS ENUM (
  'INBOX', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'
);

CREATE TYPE "WorkspaceTaskPriority" AS ENUM (
  'LOW', 'NORMAL', 'HIGH', 'URGENT'
);

CREATE TYPE "WorkspaceProjectStatus" AS ENUM (
  'PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'
);

CREATE TYPE "WorkspaceDatabasePropertyType" AS ENUM (
  'TEXT', 'NUMBER', 'CHECKBOX', 'DATE', 'SELECT', 'MULTI_SELECT', 'URL', 'STATUS', 'RELATION'
);

CREATE TYPE "WorkspaceDatabaseViewType" AS ENUM ('TABLE', 'BOARD');

CREATE TABLE "WorkspaceProject" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "WorkspaceProjectStatus" NOT NULL DEFAULT 'PLANNED',
  "priority" "WorkspaceTaskPriority" NOT NULL DEFAULT 'NORMAL',
  "startsAt" TIMESTAMP(3),
  "targetAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceProject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceProject_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceProject_workspaceId_id_key" UNIQUE ("workspaceId", "id")
);
CREATE INDEX "WorkspaceProject_workspace_status_archive_updated_idx"
  ON "WorkspaceProject"("workspaceId", "status", "archivedAt", "updatedAt");
CREATE INDEX "WorkspaceProject_workspace_target_idx"
  ON "WorkspaceProject"("workspaceId", "targetAt");

CREATE TABLE "WorkspaceProjectMilestone" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "targetAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceProjectMilestone_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceProjectMilestone_project_fkey" FOREIGN KEY ("workspaceId", "projectId")
    REFERENCES "WorkspaceProject"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceProjectMilestone_workspaceId_id_key" UNIQUE ("workspaceId", "id")
);
CREATE INDEX "WorkspaceProjectMilestone_project_order_idx"
  ON "WorkspaceProjectMilestone"("workspaceId", "projectId", "sortOrder", "id");
CREATE INDEX "WorkspaceProjectMilestone_project_completion_target_idx"
  ON "WorkspaceProjectMilestone"("workspaceId", "projectId", "completedAt", "targetAt");

CREATE TABLE "WorkspaceTaskTag" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceTaskTag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceTaskTag_workspace_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceTaskTag_workspaceId_id_key" UNIQUE ("workspaceId", "id"),
  CONSTRAINT "WorkspaceTaskTag_workspace_name_key" UNIQUE ("workspaceId", "name")
);

CREATE TABLE "WorkspaceTask" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "parentTaskId" TEXT,
  "projectId" TEXT,
  "pageId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "WorkspaceTaskStatus" NOT NULL DEFAULT 'INBOX',
  "priority" "WorkspaceTaskPriority" NOT NULL DEFAULT 'NORMAL',
  "startsAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "notes" TEXT,
  "recurrenceRule" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceTask_workspace_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceTask_parent_fkey" FOREIGN KEY ("workspaceId", "parentTaskId")
    REFERENCES "WorkspaceTask"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceTask_project_fkey" FOREIGN KEY ("workspaceId", "projectId")
    REFERENCES "WorkspaceProject"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceTask_page_fkey" FOREIGN KEY ("workspaceId", "pageId")
    REFERENCES "WorkspacePage"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceTask_workspaceId_id_key" UNIQUE ("workspaceId", "id")
);
CREATE INDEX "WorkspaceTask_workspace_status_archive_due_idx"
  ON "WorkspaceTask"("workspaceId", "status", "archivedAt", "dueAt");
CREATE INDEX "WorkspaceTask_project_status_order_idx"
  ON "WorkspaceTask"("workspaceId", "projectId", "status", "sortOrder");
CREATE INDEX "WorkspaceTask_parent_order_idx"
  ON "WorkspaceTask"("workspaceId", "parentTaskId", "sortOrder");
CREATE INDEX "WorkspaceTask_page_idx" ON "WorkspaceTask"("workspaceId", "pageId");
CREATE INDEX "WorkspaceTask_due_status_idx" ON "WorkspaceTask"("workspaceId", "dueAt", "status");
CREATE UNIQUE INDEX "WorkspaceTask_root_order_key"
  ON "WorkspaceTask"("workspaceId", "sortOrder") WHERE "parentTaskId" IS NULL;
CREATE UNIQUE INDEX "WorkspaceTask_child_order_key"
  ON "WorkspaceTask"("workspaceId", "parentTaskId", "sortOrder") WHERE "parentTaskId" IS NOT NULL;

CREATE TABLE "WorkspaceTaskLabel" (
  "workspaceId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  CONSTRAINT "WorkspaceTaskLabel_pkey" PRIMARY KEY ("workspaceId", "taskId", "tagId"),
  CONSTRAINT "WorkspaceTaskLabel_task_fkey" FOREIGN KEY ("workspaceId", "taskId")
    REFERENCES "WorkspaceTask"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceTaskLabel_tag_fkey" FOREIGN KEY ("workspaceId", "tagId")
    REFERENCES "WorkspaceTaskTag"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkspaceTaskLabel_tag_idx" ON "WorkspaceTaskLabel"("workspaceId", "tagId");

CREATE TABLE "WorkspaceDatabase" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "archivedAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceDatabase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceDatabase_workspace_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceDatabase_workspaceId_id_key" UNIQUE ("workspaceId", "id")
);
CREATE INDEX "WorkspaceDatabase_workspace_archive_updated_idx"
  ON "WorkspaceDatabase"("workspaceId", "archivedAt", "updatedAt");

CREATE TABLE "WorkspaceDatabaseProperty" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "databaseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "WorkspaceDatabasePropertyType" NOT NULL,
  "options" JSONB NOT NULL DEFAULT '{}',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceDatabaseProperty_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceDatabaseProperty_database_fkey" FOREIGN KEY ("workspaceId", "databaseId")
    REFERENCES "WorkspaceDatabase"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceDatabaseProperty_workspace_database_id_key" UNIQUE ("workspaceId", "databaseId", "id"),
  CONSTRAINT "WorkspaceDatabaseProperty_name_key" UNIQUE ("workspaceId", "databaseId", "name")
);
CREATE INDEX "WorkspaceDatabaseProperty_order_idx"
  ON "WorkspaceDatabaseProperty"("workspaceId", "databaseId", "sortOrder");

CREATE TABLE "WorkspaceDatabaseRecord" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "databaseId" TEXT NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceDatabaseRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceDatabaseRecord_database_fkey" FOREIGN KEY ("workspaceId", "databaseId")
    REFERENCES "WorkspaceDatabase"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceDatabaseRecord_workspace_database_id_key" UNIQUE ("workspaceId", "databaseId", "id"),
  CONSTRAINT "WorkspaceDatabaseRecord_workspace_id_key" UNIQUE ("workspaceId", "id")
);
CREATE INDEX "WorkspaceDatabaseRecord_order_idx"
  ON "WorkspaceDatabaseRecord"("workspaceId", "databaseId", "archivedAt", "sortOrder");
CREATE INDEX "WorkspaceDatabaseRecord_updated_idx"
  ON "WorkspaceDatabaseRecord"("workspaceId", "databaseId", "updatedAt");

CREATE TABLE "WorkspaceDatabaseRelation" (
  "workspaceId" TEXT NOT NULL,
  "sourceDatabaseId" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "targetDatabaseId" TEXT NOT NULL,
  "targetRecordId" TEXT NOT NULL,
  CONSTRAINT "WorkspaceDatabaseRelation_pkey" PRIMARY KEY ("workspaceId", "sourceRecordId", "propertyId", "targetRecordId"),
  CONSTRAINT "WorkspaceDatabaseRelation_source_fkey" FOREIGN KEY ("workspaceId", "sourceDatabaseId", "sourceRecordId")
    REFERENCES "WorkspaceDatabaseRecord"("workspaceId", "databaseId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceDatabaseRelation_target_fkey" FOREIGN KEY ("workspaceId", "targetDatabaseId", "targetRecordId")
    REFERENCES "WorkspaceDatabaseRecord"("workspaceId", "databaseId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceDatabaseRelation_property_fkey" FOREIGN KEY ("workspaceId", "sourceDatabaseId", "propertyId")
    REFERENCES "WorkspaceDatabaseProperty"("workspaceId", "databaseId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkspaceDatabaseRelation_property_idx"
  ON "WorkspaceDatabaseRelation"("workspaceId", "sourceDatabaseId", "propertyId");
CREATE INDEX "WorkspaceDatabaseRelation_target_idx"
  ON "WorkspaceDatabaseRelation"("workspaceId", "targetDatabaseId", "targetRecordId");

CREATE TABLE "WorkspaceDatabaseView" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "databaseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "WorkspaceDatabaseViewType" NOT NULL DEFAULT 'TABLE',
  "configuration" JSONB NOT NULL DEFAULT '{}',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceDatabaseView_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceDatabaseView_database_fkey" FOREIGN KEY ("workspaceId", "databaseId")
    REFERENCES "WorkspaceDatabase"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceDatabaseView_workspace_database_id_key" UNIQUE ("workspaceId", "databaseId", "id"),
  CONSTRAINT "WorkspaceDatabaseView_name_key" UNIQUE ("workspaceId", "databaseId", "name")
);
CREATE INDEX "WorkspaceDatabaseView_order_idx"
  ON "WorkspaceDatabaseView"("workspaceId", "databaseId", "sortOrder");
