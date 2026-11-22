ALTER TABLE "TotpCredential"
  ADD COLUMN "pendingSecretCiphertext" TEXT,
  ADD COLUMN "enrollmentExpiresAt" TIMESTAMP(3),
  ADD COLUMN "lastAcceptedStep" BIGINT;

ALTER TABLE "RecoveryCode"
  ADD COLUMN "generationId" TEXT,
  ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE INDEX "RecoveryCode_userId_generationId_revokedAt_usedAt_idx"
ON "RecoveryCode"("userId", "generationId", "revokedAt", "usedAt");
