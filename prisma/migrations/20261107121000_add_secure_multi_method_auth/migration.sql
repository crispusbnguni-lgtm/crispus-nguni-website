-- Reconcile the WelcomePageSettings table, which exists in production
-- but is absent from the historical migration files.
-- Existing production data is preserved by IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "WelcomePageSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'main',
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WelcomePageSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WelcomePageSettings_key_key"
ON "WelcomePageSettings"("key");

-- Authentication providers
CREATE TYPE "IdentityProvider" AS ENUM ('EMAIL', 'PHONE', 'GOOGLE', 'APPLE');

-- Existing users retain their existing email addresses and password hashes.
ALTER TABLE "User"
    ALTER COLUMN "email" DROP NOT NULL,
    ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Additional authentication metadata for sessions.
ALTER TABLE "UserSession"
    ADD COLUMN "deviceVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "lastReauthenticatedAt" TIMESTAMP(3),
    ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "primaryAuthMethod" TEXT,
    ADD COLUMN "secondFactorMethod" TEXT;

-- Linked verified identities.
CREATE TABLE "UserIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "identifier" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- WebAuthn passkey credentials: public keys only.
CREATE TABLE "PasskeyCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "deviceType" TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
);

-- Per-user security preferences.
CREATE TABLE "UserSecuritySettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newDeviceAlerts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserSecuritySettings_pkey" PRIMARY KEY ("id")
);

-- Encrypted TOTP secrets.
CREATE TABLE "TotpCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretCiphertext" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TotpCredential_pkey" PRIMARY KEY ("id")
);

-- Hashed, single-use recovery codes.
CREATE TABLE "RecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- Indexes.
CREATE INDEX "UserIdentity_userId_provider_idx"
ON "UserIdentity"("userId", "provider");

CREATE INDEX "UserIdentity_identifier_idx"
ON "UserIdentity"("identifier");

CREATE UNIQUE INDEX "UserIdentity_provider_providerSubject_key"
ON "UserIdentity"("provider", "providerSubject");

CREATE UNIQUE INDEX "PasskeyCredential_credentialId_key"
ON "PasskeyCredential"("credentialId");

CREATE INDEX "PasskeyCredential_userId_revokedAt_idx"
ON "PasskeyCredential"("userId", "revokedAt");

CREATE UNIQUE INDEX "UserSecuritySettings_userId_key"
ON "UserSecuritySettings"("userId");

CREATE UNIQUE INDEX "TotpCredential_userId_key"
ON "TotpCredential"("userId");

CREATE UNIQUE INDEX "RecoveryCode_codeHash_key"
ON "RecoveryCode"("codeHash");

CREATE INDEX "RecoveryCode_userId_usedAt_idx"
ON "RecoveryCode"("userId", "usedAt");

-- Foreign keys.
ALTER TABLE "UserIdentity"
ADD CONSTRAINT "UserIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PasskeyCredential"
ADD CONSTRAINT "PasskeyCredential_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSecuritySettings"
ADD CONSTRAINT "UserSecuritySettings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TotpCredential"
ADD CONSTRAINT "TotpCredential_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecoveryCode"
ADD CONSTRAINT "RecoveryCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Email verification, passwordless login and password-reset token purposes.
CREATE TYPE "EmailActionPurpose" AS ENUM (
    'VERIFY_EMAIL',
    'MAGIC_LINK',
    'PASSWORD_RESET'
);

-- Existing accounts are not automatically marked as email-verified.
ALTER TABLE "User"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- Store only token hashes. Tokens are purpose-specific, expire and can be consumed once.
CREATE TABLE "EmailActionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "EmailActionPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailActionToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailActionToken_tokenHash_key"
ON "EmailActionToken"("tokenHash");

CREATE INDEX "EmailActionToken_userId_purpose_consumedAt_idx"
ON "EmailActionToken"("userId", "purpose", "consumedAt");

CREATE INDEX "EmailActionToken_expiresAt_idx"
ON "EmailActionToken"("expiresAt");

ALTER TABLE "EmailActionToken"
ADD CONSTRAINT "EmailActionToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;