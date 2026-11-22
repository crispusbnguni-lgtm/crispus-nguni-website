CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');
CREATE TYPE "AdminVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "User"
  ADD COLUMN "accountStatus" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "accountStatusReason" TEXT,
  ADD COLUMN "accountSuspendedUntil" TIMESTAMP(3),
  ADD COLUMN "verificationStatus" "AdminVerificationStatus" NOT NULL DEFAULT 'VERIFIED',
  ADD COLUMN "verificationReason" TEXT;

-- Existing accounts remain usable. New accounts enter the review queue by default.
ALTER TABLE "User"
  ALTER COLUMN "verificationStatus" SET DEFAULT 'PENDING';

CREATE INDEX "User_accountStatus_verificationStatus_idx"
  ON "User"("accountStatus", "verificationStatus");
