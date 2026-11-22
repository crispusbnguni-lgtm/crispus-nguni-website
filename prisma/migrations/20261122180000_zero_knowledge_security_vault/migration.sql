CREATE TABLE "SecurityVault" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "formatVersion" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "kdfAlgorithm" VARCHAR(16) NOT NULL DEFAULT 'argon2id',
    "kdfMemoryKiB" INTEGER NOT NULL DEFAULT 65536,
    "kdfIterations" INTEGER NOT NULL DEFAULT 3,
    "kdfParallelism" INTEGER NOT NULL DEFAULT 1,
    "masterSalt" VARCHAR(64) NOT NULL,
    "masterNonce" VARCHAR(32) NOT NULL,
    "masterWrappedDataKey" VARCHAR(128) NOT NULL,
    "recoverySalt" VARCHAR(64) NOT NULL,
    "recoveryNonce" VARCHAR(32) NOT NULL,
    "recoveryWrappedDataKey" VARCHAR(128) NOT NULL,
    "recoveryKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityVault_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SecurityVault_formatVersion_check" CHECK ("formatVersion" = 1),
    CONSTRAINT "SecurityVault_kdfAlgorithm_check" CHECK ("kdfAlgorithm" = 'argon2id'),
    CONSTRAINT "SecurityVault_kdfParameters_check" CHECK ("kdfMemoryKiB" = 65536 AND "kdfIterations" = 3 AND "kdfParallelism" = 1)
);

CREATE TABLE "SecurityVaultRecord" (
    "vaultId" TEXT NOT NULL,
    "id" VARCHAR(80) NOT NULL,
    "nonce" VARCHAR(32) NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityVaultRecord_pkey" PRIMARY KEY ("vaultId", "id")
);

CREATE UNIQUE INDEX "SecurityVault_workspaceId_key" ON "SecurityVault"("workspaceId");
CREATE INDEX "SecurityVaultRecord_vaultId_updatedAt_idx" ON "SecurityVaultRecord"("vaultId", "updatedAt");

ALTER TABLE "SecurityVault"
  ADD CONSTRAINT "SecurityVault_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecurityVaultRecord"
  ADD CONSTRAINT "SecurityVaultRecord_vaultId_fkey"
  FOREIGN KEY ("vaultId") REFERENCES "SecurityVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
