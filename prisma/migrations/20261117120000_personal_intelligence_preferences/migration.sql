-- Persist user-controlled intelligence consent and low-sensitivity feedback.
-- This migration is additive and assumes the workspace foundation migration ran first.
ALTER TABLE "PersonalWorkspace"
  ADD COLUMN "intelligencePermissions" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "intelligenceDismissedIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "intelligenceFeedback" JSONB NOT NULL DEFAULT '{}'::jsonb;
