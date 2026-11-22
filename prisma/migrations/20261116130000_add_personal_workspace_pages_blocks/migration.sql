-- CreateEnum
CREATE TYPE "WorkspaceBlockType" AS ENUM ('PARAGRAPH', 'HEADING', 'BULLETED_LIST', 'NUMBERED_LIST', 'CHECKLIST', 'TODO', 'QUOTE', 'CALLOUT', 'DIVIDER', 'CODE', 'TABLE', 'IMAGE', 'LINK', 'TOGGLE', 'PAGE_REFERENCE', 'DATE', 'REMINDER');

-- CreateEnum
CREATE TYPE "WorkspaceReminderStatus" AS ENUM ('SCHEDULED', 'DELIVERED', 'DISMISSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WorkspacePage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "iconKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "searchText" TEXT NOT NULL DEFAULT '',
    "coverAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspacePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceBlock" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "parentBlockId" TEXT,
    "type" "WorkspaceBlockType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL DEFAULT '{}',
    "plainText" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "mediaAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceBlockItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceBlockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceTableColumn" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "width" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceTableColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceTableRow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceTableRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceTableCell" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceTableCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspacePageReference" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourcePageId" TEXT NOT NULL,
    "sourceBlockId" TEXT NOT NULL,
    "targetPageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspacePageReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceReminder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" "WorkspaceReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "deliveredAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMediaAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspacePage_workspaceId_parentId_sortOrder_idx" ON "WorkspacePage"("workspaceId", "parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkspacePage_workspaceId_archivedAt_deletedAt_updatedAt_idx" ON "WorkspacePage"("workspaceId", "archivedAt", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkspacePage_workspaceId_isFavorite_updatedAt_idx" ON "WorkspacePage"("workspaceId", "isFavorite", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkspacePage_workspaceId_isPinned_updatedAt_idx" ON "WorkspacePage"("workspaceId", "isPinned", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePage_workspaceId_id_key" ON "WorkspacePage"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePage_root_order_key" ON "WorkspacePage"("workspaceId", "sortOrder") WHERE ("parentId" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePage_child_order_key" ON "WorkspacePage"("workspaceId", "parentId", "sortOrder") WHERE ("parentId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "WorkspaceBlock_workspaceId_pageId_parentBlockId_sortOrder_idx" ON "WorkspaceBlock"("workspaceId", "pageId", "parentBlockId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceBlock_workspaceId_pageId_id_key" ON "WorkspaceBlock"("workspaceId", "pageId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceBlock_root_order_key" ON "WorkspaceBlock"("workspaceId", "pageId", "sortOrder") WHERE ("parentBlockId" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceBlock_child_order_key" ON "WorkspaceBlock"("workspaceId", "pageId", "parentBlockId", "sortOrder") WHERE ("parentBlockId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceBlockItem_workspaceId_pageId_blockId_sortOrder_key" ON "WorkspaceBlockItem"("workspaceId", "pageId", "blockId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceBlockItem_workspaceId_pageId_blockId_id_key" ON "WorkspaceBlockItem"("workspaceId", "pageId", "blockId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceTableColumn_workspaceId_pageId_blockId_sortOrder_key" ON "WorkspaceTableColumn"("workspaceId", "pageId", "blockId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceTableColumn_workspaceId_pageId_blockId_id_key" ON "WorkspaceTableColumn"("workspaceId", "pageId", "blockId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceTableRow_workspaceId_pageId_blockId_sortOrder_key" ON "WorkspaceTableRow"("workspaceId", "pageId", "blockId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceTableRow_workspaceId_pageId_blockId_id_key" ON "WorkspaceTableRow"("workspaceId", "pageId", "blockId", "id");

-- CreateIndex
CREATE INDEX "WorkspaceTableCell_workspaceId_pageId_blockId_idx" ON "WorkspaceTableCell"("workspaceId", "pageId", "blockId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceTableCell_workspaceId_pageId_blockId_rowId_columnI_key" ON "WorkspaceTableCell"("workspaceId", "pageId", "blockId", "rowId", "columnId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePageReference_sourceBlockId_key" ON "WorkspacePageReference"("sourceBlockId");

-- CreateIndex
CREATE INDEX "WorkspacePageReference_workspaceId_targetPageId_idx" ON "WorkspacePageReference"("workspaceId", "targetPageId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePageReference_workspaceId_sourcePageId_sourceBlock_key" ON "WorkspacePageReference"("workspaceId", "sourcePageId", "sourceBlockId");

-- CreateIndex
CREATE INDEX "WorkspaceReminder_workspaceId_status_remindAt_idx" ON "WorkspaceReminder"("workspaceId", "status", "remindAt");

-- CreateIndex
CREATE INDEX "WorkspaceReminder_workspaceId_pageId_blockId_idx" ON "WorkspaceReminder"("workspaceId", "pageId", "blockId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMediaAsset_workspaceId_id_key" ON "WorkspaceMediaAsset"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMediaAsset_workspaceId_objectKey_key" ON "WorkspaceMediaAsset"("workspaceId", "objectKey");

-- AddForeignKey
ALTER TABLE "WorkspacePage" ADD CONSTRAINT "WorkspacePage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePage" ADD CONSTRAINT "WorkspacePage_workspaceId_parentId_fkey" FOREIGN KEY ("workspaceId", "parentId") REFERENCES "WorkspacePage"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePage" ADD CONSTRAINT "WorkspacePage_workspaceId_coverAssetId_fkey" FOREIGN KEY ("workspaceId", "coverAssetId") REFERENCES "WorkspaceMediaAsset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceBlock" ADD CONSTRAINT "WorkspaceBlock_workspaceId_pageId_fkey" FOREIGN KEY ("workspaceId", "pageId") REFERENCES "WorkspacePage"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceBlock" ADD CONSTRAINT "WorkspaceBlock_workspaceId_pageId_parentBlockId_fkey" FOREIGN KEY ("workspaceId", "pageId", "parentBlockId") REFERENCES "WorkspaceBlock"("workspaceId", "pageId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceBlock" ADD CONSTRAINT "WorkspaceBlock_workspaceId_mediaAssetId_fkey" FOREIGN KEY ("workspaceId", "mediaAssetId") REFERENCES "WorkspaceMediaAsset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceBlockItem" ADD CONSTRAINT "WorkspaceBlockItem_workspaceId_pageId_blockId_fkey" FOREIGN KEY ("workspaceId", "pageId", "blockId") REFERENCES "WorkspaceBlock"("workspaceId", "pageId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceTableColumn" ADD CONSTRAINT "WorkspaceTableColumn_workspaceId_pageId_blockId_fkey" FOREIGN KEY ("workspaceId", "pageId", "blockId") REFERENCES "WorkspaceBlock"("workspaceId", "pageId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceTableRow" ADD CONSTRAINT "WorkspaceTableRow_workspaceId_pageId_blockId_fkey" FOREIGN KEY ("workspaceId", "pageId", "blockId") REFERENCES "WorkspaceBlock"("workspaceId", "pageId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceTableCell" ADD CONSTRAINT "WorkspaceTableCell_workspaceId_pageId_blockId_rowId_fkey" FOREIGN KEY ("workspaceId", "pageId", "blockId", "rowId") REFERENCES "WorkspaceTableRow"("workspaceId", "pageId", "blockId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceTableCell" ADD CONSTRAINT "WorkspaceTableCell_workspaceId_pageId_blockId_columnId_fkey" FOREIGN KEY ("workspaceId", "pageId", "blockId", "columnId") REFERENCES "WorkspaceTableColumn"("workspaceId", "pageId", "blockId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePageReference" ADD CONSTRAINT "WorkspacePageReference_workspaceId_sourcePageId_fkey" FOREIGN KEY ("workspaceId", "sourcePageId") REFERENCES "WorkspacePage"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePageReference" ADD CONSTRAINT "WorkspacePageReference_workspaceId_sourcePageId_sourceBloc_fkey" FOREIGN KEY ("workspaceId", "sourcePageId", "sourceBlockId") REFERENCES "WorkspaceBlock"("workspaceId", "pageId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePageReference" ADD CONSTRAINT "WorkspacePageReference_workspaceId_targetPageId_fkey" FOREIGN KEY ("workspaceId", "targetPageId") REFERENCES "WorkspacePage"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceReminder" ADD CONSTRAINT "WorkspaceReminder_workspaceId_pageId_blockId_fkey" FOREIGN KEY ("workspaceId", "pageId", "blockId") REFERENCES "WorkspaceBlock"("workspaceId", "pageId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMediaAsset" ADD CONSTRAINT "WorkspaceMediaAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
