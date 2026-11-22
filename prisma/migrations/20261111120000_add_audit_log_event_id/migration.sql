ALTER TABLE "AuditLog"
ADD COLUMN "eventId" TEXT;

CREATE UNIQUE INDEX "AuditLog_eventId_key"
ON "AuditLog"("eventId");