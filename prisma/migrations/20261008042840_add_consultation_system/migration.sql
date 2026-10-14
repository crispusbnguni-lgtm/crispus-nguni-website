-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "AvailabilityExceptionType" AS ENUM ('UNAVAILABLE', 'CUSTOM_HOURS');

-- DropIndex
DROP INDEX "Education_portfolioId_idx";

-- DropIndex
DROP INDEX "Project_portfolioId_idx";

-- DropIndex
DROP INDEX "Skill_portfolioId_idx";

-- DropIndex
DROP INDEX "Testimonial_portfolioId_idx";

-- CreateTable
CREATE TABLE "ConsultationType" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 15,
    "minimumNoticeMinutes" INTEGER NOT NULL DEFAULT 120,
    "maximumAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "meetingMethod" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "AvailabilityExceptionType" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "ownerId" TEXT,
    "consultationTypeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    "meetingMethod" TEXT,
    "meetingUrl" TEXT,
    "meetingLocation" TEXT,
    "notes" TEXT,
    "outcome" TEXT,
    "cancellationReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rescheduledFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationActivity" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultationType_portfolioId_idx" ON "ConsultationType"("portfolioId");

-- CreateIndex
CREATE INDEX "ConsultationType_active_idx" ON "ConsultationType"("active");

-- CreateIndex
CREATE INDEX "ConsultationType_sortOrder_idx" ON "ConsultationType"("sortOrder");

-- CreateIndex
CREATE INDEX "AvailabilityRule_portfolioId_idx" ON "AvailabilityRule"("portfolioId");

-- CreateIndex
CREATE INDEX "AvailabilityRule_dayOfWeek_idx" ON "AvailabilityRule"("dayOfWeek");

-- CreateIndex
CREATE INDEX "AvailabilityRule_enabled_idx" ON "AvailabilityRule"("enabled");

-- CreateIndex
CREATE INDEX "AvailabilityException_portfolioId_idx" ON "AvailabilityException"("portfolioId");

-- CreateIndex
CREATE INDEX "AvailabilityException_date_idx" ON "AvailabilityException"("date");

-- CreateIndex
CREATE INDEX "AvailabilityException_type_idx" ON "AvailabilityException"("type");

-- CreateIndex
CREATE INDEX "Consultation_portfolioId_idx" ON "Consultation"("portfolioId");

-- CreateIndex
CREATE INDEX "Consultation_leadId_idx" ON "Consultation"("leadId");

-- CreateIndex
CREATE INDEX "Consultation_ownerId_idx" ON "Consultation"("ownerId");

-- CreateIndex
CREATE INDEX "Consultation_consultationTypeId_idx" ON "Consultation"("consultationTypeId");

-- CreateIndex
CREATE INDEX "Consultation_status_idx" ON "Consultation"("status");

-- CreateIndex
CREATE INDEX "Consultation_scheduledAt_idx" ON "Consultation"("scheduledAt");

-- CreateIndex
CREATE INDEX "ConsultationActivity_consultationId_idx" ON "ConsultationActivity"("consultationId");

-- CreateIndex
CREATE INDEX "ConsultationActivity_userId_idx" ON "ConsultationActivity"("userId");

-- CreateIndex
CREATE INDEX "ConsultationActivity_createdAt_idx" ON "ConsultationActivity"("createdAt");

-- AddForeignKey
ALTER TABLE "ConsultationType" ADD CONSTRAINT "ConsultationType_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "PortfolioSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "PortfolioSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "PortfolioSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "PortfolioSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_consultationTypeId_fkey" FOREIGN KEY ("consultationTypeId") REFERENCES "ConsultationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationActivity" ADD CONSTRAINT "ConsultationActivity_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationActivity" ADD CONSTRAINT "ConsultationActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
