-- CreateTable
CREATE TABLE "BackgroundOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COLOR',
    "value" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackgroundOption_enabled_sortOrder_idx" ON "BackgroundOption"("enabled", "sortOrder");
