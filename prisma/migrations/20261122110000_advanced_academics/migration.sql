-- Additive Advanced Academics support. Existing academic records and media are preserved.
ALTER TABLE "AcademicExam" ADD COLUMN "topic" TEXT, ADD COLUMN "score" DECIMAL(8,2), ADD COLUMN "maxScore" DECIMAL(8,2);
ALTER TABLE "AcademicStudySession" ADD COLUMN "topic" TEXT;
CREATE TABLE "AcademicKnowledgeResource" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "topic" TEXT,
  "description" TEXT,
  "searchableText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicKnowledgeResource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicKnowledgeResource_workspace_id_key" UNIQUE ("workspaceId", "id"),
  CONSTRAINT "AcademicKnowledgeResource_workspace_media_key" UNIQUE ("workspaceId", "mediaAssetId"),
  CONSTRAINT "AcademicKnowledgeResource_course_fkey" FOREIGN KEY ("workspaceId", "courseId") REFERENCES "AcademicCourse"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AcademicKnowledgeResource_media_fkey" FOREIGN KEY ("workspaceId", "mediaAssetId") REFERENCES "WorkspaceMediaAsset"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AcademicKnowledgeResource_workspace_course_topic_idx" ON "AcademicKnowledgeResource"("workspaceId", "courseId", "topic");
