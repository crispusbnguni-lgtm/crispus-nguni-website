-- Display Studio settings
CREATE TABLE "DisplayStudioSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "preferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DisplayStudioSettings_pkey" PRIMARY KEY ("id")
);

-- User sessions for device visibility and session revocation
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- Security and administrative audit trail
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserSession_userId_revokedAt_idx"
    ON "UserSession"("userId", "revokedAt");

CREATE INDEX "UserSession_expiresAt_idx"
    ON "UserSession"("expiresAt");

CREATE INDEX "AuditLog_actorUserId_createdAt_idx"
    ON "AuditLog"("actorUserId", "createdAt");

CREATE INDEX "AuditLog_action_createdAt_idx"
    ON "AuditLog"("action", "createdAt");

CREATE INDEX "AuditLog_targetType_targetId_idx"
    ON "AuditLog"("targetType", "targetId");

ALTER TABLE "UserSession"
    ADD CONSTRAINT "UserSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;