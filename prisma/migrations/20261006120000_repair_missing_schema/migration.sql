-- Missing enums
CREATE TYPE "LeadTemperature" AS ENUM ('HOT', 'WARM', 'COLD', 'DORMANT');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED', 'LOST');
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'GOOGLE', 'REFERRAL', 'MANUAL', 'EMAIL', 'ADVERTISEMENT', 'OTHER');
CREATE TYPE "LeadActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'STATUS_CHANGE', 'TEMPERATURE_CHANGE', 'ASSIGNMENT', 'FOLLOW_UP');
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');
CREATE TYPE "MediaVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- Missing tables
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "location" TEXT,
    "message" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'WEBSITE',
    "temperature" "LeadTemperature" NOT NULL DEFAULT 'COLD',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "score" INTEGER NOT NULL DEFAULT 0,
    "interestedIn" TEXT,
    "budget" TEXT,
    "timeline" TEXT,
    "decisionMaker" BOOLEAN,
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "LeadActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "level" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "link" TEXT,
    "category" TEXT,
    "technologies" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "company" TEXT,
    "message" TEXT NOT NULL,
    "image" TEXT,
    "rating" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Education" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "field" TEXT,
    "location" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "category" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" "MediaType" NOT NULL,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PRIVATE',
    "altText" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Lead_portfolioId_idx" ON "Lead"("portfolioId");
CREATE INDEX "Lead_ownerId_idx" ON "Lead"("ownerId");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_temperature_idx" ON "Lead"("temperature");
CREATE INDEX "Lead_source_idx" ON "Lead"("source");
CREATE INDEX "Lead_score_idx" ON "Lead"("score");
CREATE INDEX "Lead_nextFollowUpAt_idx" ON "Lead"("nextFollowUpAt");

CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");
CREATE INDEX "LeadActivity_userId_idx" ON "LeadActivity"("userId");
CREATE INDEX "LeadActivity_createdAt_idx" ON "LeadActivity"("createdAt");

CREATE INDEX "Skill_portfolioId_idx" ON "Skill"("portfolioId");
CREATE INDEX "Project_portfolioId_idx" ON "Project"("portfolioId");
CREATE INDEX "Testimonial_portfolioId_idx" ON "Testimonial"("portfolioId");
CREATE INDEX "Education_portfolioId_idx" ON "Education"("portfolioId");
CREATE UNIQUE INDEX "Insight_portfolioId_slug_key" ON "Insight"("portfolioId", "slug");
CREATE INDEX "Media_portfolioId_idx" ON "Media"("portfolioId");
CREATE INDEX "Media_uploadedById_idx" ON "Media"("uploadedById");
CREATE INDEX "Media_type_idx" ON "Media"("type");
CREATE INDEX "Media_visibility_idx" ON "Media"("visibility");

-- Foreign keys
ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_portfolioId_fkey"
FOREIGN KEY ("portfolioId") REFERENCES "PortfolioSite"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadActivity"
ADD CONSTRAINT "LeadActivity_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadActivity"
ADD CONSTRAINT "LeadActivity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Skill"
ADD CONSTRAINT "Skill_portfolioId_fkey"
FOREIGN KEY ("portfolioId") REFERENCES "PortfolioSite"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_portfolioId_fkey"
FOREIGN KEY ("portfolioId") REFERENCES "PortfolioSite"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Testimonial"
ADD CONSTRAINT "Testimonial_portfolioId_fkey"
FOREIGN KEY ("portfolioId") REFERENCES "PortfolioSite"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Education"
ADD CONSTRAINT "Education_portfolioId_fkey"
FOREIGN KEY ("portfolioId") REFERENCES "PortfolioSite"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Insight"
ADD CONSTRAINT "Insight_portfolioId_fkey"
FOREIGN KEY ("portfolioId") REFERENCES "PortfolioSite"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Media"
ADD CONSTRAINT "Media_portfolioId_fkey"
FOREIGN KEY ("portfolioId") REFERENCES "PortfolioSite"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Media"
ADD CONSTRAINT "Media_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
