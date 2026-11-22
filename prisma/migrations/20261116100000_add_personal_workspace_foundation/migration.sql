CREATE TYPE "WorkspaceMode" AS ENUM (
  'STUDENT',
  'PROFESSIONAL',
  'ENTREPRENEUR',
  'PERSONAL',
  'CUSTOM'
);

CREATE TABLE "PersonalWorkspace" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mode" "WorkspaceMode" NOT NULL DEFAULT 'CUSTOM',
  "focusAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
  "workingHoursStart" TEXT NOT NULL DEFAULT '09:00',
  "workingHoursEnd" TEXT NOT NULL DEFAULT '17:00',
  "breakMinutes" INTEGER NOT NULL DEFAULT 15,
  "weekStartsOn" INTEGER NOT NULL DEFAULT 1,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "onboardingCompletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PersonalWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PersonalWorkspace_userId_key"
  ON "PersonalWorkspace"("userId");

ALTER TABLE "PersonalWorkspace"
  ADD CONSTRAINT "PersonalWorkspace_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
