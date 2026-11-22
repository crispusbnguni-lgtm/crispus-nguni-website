-- Additive CRM metadata and scoring history. Existing leads are retained.
ALTER TYPE "LeadSource" ADD VALUE 'SOCIAL_MEDIA' BEFORE 'OTHER';
ALTER TYPE "LeadSource" ADD VALUE 'EVENT' BEFORE 'OTHER';
ALTER TYPE "LeadSource" ADD VALUE 'WALK_IN' BEFORE 'OTHER';
ALTER TYPE "LeadSource" ADD VALUE 'CAMPAIGN' BEFORE 'OTHER';

CREATE TYPE "LeadOrigin" AS ENUM (
    'MANUAL_ENTRY',
    'WEBSITE_FORM',
    'PUBLIC_CONSULTATION',
    'LEGACY'
);

ALTER TABLE "Lead"
    ADD COLUMN "createdById" TEXT,
    ADD COLUMN "emailNormalized" TEXT,
    ADD COLUMN "phoneNormalized" TEXT,
    ADD COLUMN "origin" "LeadOrigin" NOT NULL DEFAULT 'LEGACY',
    ADD COLUMN "sourceDetail" TEXT,
    ADD COLUMN "temperatureOverride" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "scoreBreakdown" JSONB,
    ADD COLUMN "nextBestAction" TEXT,
    ADD COLUMN "scoreCalculatedAt" TIMESTAMP(3),
    ADD COLUMN "nextScoreRefreshAt" TIMESTAMP(3);

-- Attribute historic records only when their existing activity data says so.
UPDATE "Lead" AS lead
SET "origin" = CASE
    WHEN EXISTS (
        SELECT 1 FROM "LeadActivity" AS activity
        WHERE activity."leadId" = lead."id"
          AND activity."metadata"->>'source' = 'PUBLIC_CONSULTATION_BOOKING'
    ) THEN 'PUBLIC_CONSULTATION'::"LeadOrigin"
    WHEN EXISTS (
        SELECT 1 FROM "LeadActivity" AS activity
        WHERE activity."leadId" = lead."id"
          AND activity."metadata"->>'source' = 'WEBSITE'
    ) THEN 'WEBSITE_FORM'::"LeadOrigin"
    ELSE 'LEGACY'::"LeadOrigin"
END;

-- Normalized columns start empty so legacy duplicates are never merged or
-- discarded. New application writes populate them and receive DB uniqueness.
CREATE UNIQUE INDEX "Lead_portfolioId_emailNormalized_key"
ON "Lead"("portfolioId", "emailNormalized");

CREATE UNIQUE INDEX "Lead_portfolioId_phoneNormalized_key"
ON "Lead"("portfolioId", "phoneNormalized");

CREATE INDEX "Lead_createdById_idx" ON "Lead"("createdById");
CREATE INDEX "Lead_portfolioId_nextScoreRefreshAt_idx"
ON "Lead"("portfolioId", "nextScoreRefreshAt");

CREATE TABLE "LeadScoreHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "intentScore" INTEGER NOT NULL,
    "engagementScore" INTEGER NOT NULL,
    "recencyScore" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "nextBestAction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadScoreHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadScoreHistory_leadId_createdAt_idx"
ON "LeadScoreHistory"("leadId", "createdAt");

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadScoreHistory"
ADD CONSTRAINT "LeadScoreHistory_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
