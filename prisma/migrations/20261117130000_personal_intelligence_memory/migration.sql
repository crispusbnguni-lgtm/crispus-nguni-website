-- Separate, explicitly user-authored private intelligence context.
-- This additive migration assumes the PersonalWorkspace foundation exists.
CREATE TYPE "WorkspaceIntelligenceMemoryKind" AS ENUM ('PREFERENCE', 'GOAL', 'CONTEXT');

CREATE TABLE "WorkspaceIntelligenceMemory" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "kind" "WorkspaceIntelligenceMemoryKind" NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "content" VARCHAR(500) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceIntelligenceMemory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceIntelligenceMemory_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkspaceIntelligenceMemory_workspaceId_id_key"
  ON "WorkspaceIntelligenceMemory"("workspaceId", "id");
CREATE INDEX "WorkspaceIntelligenceMemory_workspaceId_enabled_updatedAt_idx"
  ON "WorkspaceIntelligenceMemory"("workspaceId", "enabled", "updatedAt");
