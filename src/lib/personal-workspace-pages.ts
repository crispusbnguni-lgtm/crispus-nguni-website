import "server-only";
import { Prisma, type WorkspaceBlockType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseWorkspaceBlockInput, parseWorkspacePageInput, WORKSPACE_TEMPLATES, type ParsedBlockInput, type ParsedPageInput } from "@/lib/personal-workspace-pages-core";

const MAX_PAGE_DEPTH = 5;
const MAX_PAGES = 500;
const MAX_BLOCKS = 200;
const PAGE_SELECT = { id: true, workspaceId: true, parentId: true, title: true, iconKey: true, sortOrder: true, isFavorite: true, isPinned: true, archivedAt: true, deletedAt: true, revision: true, searchText: true, createdAt: true, updatedAt: true } satisfies Prisma.WorkspacePageSelect;
const BLOCK_SELECT = { id: true, pageId: true, parentBlockId: true, mediaAssetId: true, type: true, sortOrder: true, content: true, plainText: true, revision: true, createdAt: true, updatedAt: true, items: { orderBy: { sortOrder: "asc" as const }, select: { id: true, text: true, checkedAt: true, dueAt: true, revision: true, sortOrder: true } }, tableColumns: { orderBy: { sortOrder: "asc" as const }, select: { id: true, label: true, width: true, sortOrder: true } }, tableRows: { orderBy: { sortOrder: "asc" as const }, select: { id: true, sortOrder: true, cells: { select: { id: true, columnId: true, value: true, revision: true } } } }, pageReference: { select: { targetPageId: true } }, reminders: { orderBy: { remindAt: "asc" as const }, select: { id: true, remindAt: true, timezone: true, status: true, dismissedAt: true } } } satisfies Prisma.WorkspaceBlockSelect;

type Tx = Prisma.TransactionClient;
type Result = { ok: true; value: unknown } | { ok: false; status: 400 | 404 | 409 | 413; code: string; message: string; currentRevision?: number };
type Valid<T> = { valid: true; value: T };
const bad = (message: string, status: 400 | 404 | 409 | 413 = 400, code = "INVALID_REQUEST"): Result => ({ ok: false, status, code, message });

async function ensureWorkspaceForUser(client: Tx | typeof prisma, ownerUserId: string) {
  return client.personalWorkspace.upsert({ where: { userId: ownerUserId }, create: { userId: ownerUserId }, update: {}, select: { id: true } });
}

async function readWorkspaceForUser(client: Tx | typeof prisma, ownerUserId: string) {
  return client.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true } });
}

async function lockWorkspace(tx: Tx, workspaceId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}), 684512)`;
}

async function serialized<T>(ownerUserId: string, operation: (tx: Tx, workspaceId: string) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    const workspace = await ensureWorkspaceForUser(tx, ownerUserId);
    await lockWorkspace(tx, workspace.id);
    return operation(tx, workspace.id);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function parsedPage(input: unknown, partial = false): Valid<Extract<ParsedPageInput, { success: true }>['value']> | Result {
  const result = parseWorkspacePageInput(input, partial);
  return result.success ? { valid: true, value: result.value } : bad(result.message);
}

function parsedBlock(input: unknown): Valid<Extract<ParsedBlockInput, { success: true }>['value']> | Result {
  const result = parseWorkspaceBlockInput(input);
  return result.success ? { valid: true, value: result.value } : bad(result.message);
}

function isResult(value: unknown): value is Result {
  return typeof value === "object" && value !== null && "ok" in value;
}

async function pageDepth(tx: Tx, workspaceId: string, parentId: string | null): Promise<number | null> {
  let depth = 0;
  let cursor = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor) || depth >= MAX_PAGE_DEPTH) return null;
    seen.add(cursor);
    const parent = await tx.workspacePage.findFirst({ where: { id: cursor, workspaceId, deletedAt: null, archivedAt: null }, select: { id: true, parentId: true } });
    if (!parent) return null;
    depth += 1;
    cursor = parent.parentId;
  }
  return depth;
}

async function descendants(tx: Tx, workspaceId: string, rootId: string) {
  const all = await tx.workspacePage.findMany({ where: { workspaceId }, select: { id: true, parentId: true }, take: MAX_PAGES + 1 });
  if (all.length > MAX_PAGES) throw new Error("Workspace page limit exceeded.");
  const result = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const page of all) if (page.parentId && result.has(page.parentId) && !result.has(page.id)) { result.add(page.id); changed = true; }
  }
  return [...result];
}

function pageSearchContent(blocks: Array<{ plainText: string }>) {
  return blocks.map((block) => block.plainText).join(" ").replace(/\s+/g, " ").slice(0, 20_000);
}

export async function listWorkspacePages(ownerUserId: string, options: { parentId?: string | null | "all"; view?: "active" | "archive" | "trash" | "favorites" | "pinned"; limit?: number; cursor?: string } = {}) {
  const workspace = await readWorkspaceForUser(prisma, ownerUserId);
  if (!workspace) return [];
  if (options.parentId && options.parentId !== "all" && !(await prisma.workspacePage.findFirst({ where: { id: options.parentId, workspaceId: workspace.id, deletedAt: null }, select: { id: true } }))) return null;
  const limit = Math.min(Math.max(Math.floor(options.limit ?? 100), 1), 100);
  const view = options.view ?? "active";
  const where: Prisma.WorkspacePageWhereInput = { workspaceId: workspace.id };
  if (options.parentId !== "all") where.parentId = options.parentId ?? null;
  if (view === "active") { where.archivedAt = null; where.deletedAt = null; }
  else if (view === "archive") { where.archivedAt = { not: null }; where.deletedAt = null; }
  else if (view === "trash") { where.deletedAt = { not: null }; }
  else if (view === "favorites") { where.isFavorite = true; where.archivedAt = null; where.deletedAt = null; }
  else { where.isPinned = true; where.archivedAt = null; where.deletedAt = null; }
  return prisma.workspacePage.findMany({ where, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: limit, ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}), select: PAGE_SELECT });
}

export async function getWorkspacePage(ownerUserId: string, pageId: string) {
  const workspace = await readWorkspaceForUser(prisma, ownerUserId);
  if (!workspace) return null;
  const page = await prisma.workspacePage.findFirst({ where: { id: pageId, workspaceId: workspace.id }, select: PAGE_SELECT });
  if (!page) return null;
  const blocks = await prisma.workspaceBlock.findMany({ where: { workspaceId: workspace.id, pageId }, orderBy: [{ parentBlockId: "asc" }, { sortOrder: "asc" }, { id: "asc" }], take: MAX_BLOCKS, select: BLOCK_SELECT });
  return { ...page, blocks };
}

export async function createWorkspacePage(ownerUserId: string, input: unknown, templateBlocks?: readonly unknown[]) {
  const parsed = parsedPage(input);
  if (isResult(parsed)) return parsed;
  const template = templateBlocks ?? [];
  return serialized(ownerUserId, async (tx, workspaceId) => {
    const pagesCount = await tx.workspacePage.count({ where: { workspaceId, deletedAt: null } });
    if (pagesCount >= MAX_PAGES) return bad("Workspace page limit reached.", 413, "PAGE_LIMIT");
    const parentId = parsed.value.parentId ?? null;
    const depth = await pageDepth(tx, workspaceId, parentId);
    if (depth === null) return bad("Parent page was not found in this workspace.", 404, "PAGE_NOT_FOUND");
    if (depth >= MAX_PAGE_DEPTH) return bad("Maximum page nesting depth reached.", 400, "MAX_DEPTH");
    // The unique ordering indexes include trashed rows, so their positions
    // must remain reserved when allocating a new position.
    const maxOrder = await tx.workspacePage.aggregate({ where: { workspaceId, parentId }, _max: { sortOrder: true } });
    const page = await tx.workspacePage.create({ data: { workspaceId, parentId, title: parsed.value.title ?? "Untitled", iconKey: parsed.value.iconKey ?? null, isFavorite: parsed.value.isFavorite ?? false, isPinned: parsed.value.isPinned ?? false, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 }, select: PAGE_SELECT });
    const madeBlocks: Array<{ plainText: string }> = [];
    for (const inputBlock of template) {
      const blockResult = parsedBlock(inputBlock);
      if (isResult(blockResult)) throw new Error("INVALID_TEMPLATE_BLOCK");
      const block = await createBlockInTransaction(tx, workspaceId, page.id, blockResult.value);
      madeBlocks.push(block);
    }
    if (madeBlocks.length) await tx.workspacePage.update({ where: { id: page.id }, data: { searchText: pageSearchContent(madeBlocks) } });
    return { ok: true, value: page } satisfies Result;
  });
}

export async function updateWorkspacePage(ownerUserId: string, pageId: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Page update is invalid.");
  const body = input as Record<string, unknown>;
  const { expectedRevision, ...fields } = body;
  const parsed = parsedPage(fields, true);
  if (isResult(parsed)) return parsed;
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0) return bad("Expected revision is required.");
  return serialized(ownerUserId, async (tx, workspaceId) => {
    const current = await tx.workspacePage.findFirst({ where: { id: pageId, workspaceId }, select: { revision: true, parentId: true } });
    if (!current) return bad("Page not found.", 404, "NOT_FOUND");
    if (current.revision !== expectedRevision) return { ok: false, status: 409, code: "REVISION_CONFLICT", message: "This page changed elsewhere. Keep your edits and reload the latest version to reconcile.", currentRevision: current.revision };
    if (parsed.value.parentId !== undefined && parsed.value.parentId !== current.parentId) return bad("Use the move operation to change a page parent.");
    const changed = await tx.workspacePage.updateMany({ where: { id: pageId, workspaceId, revision: expectedRevision as number }, data: { ...parsed.value, revision: { increment: 1 } } });
    if (changed.count !== 1) return bad("This page changed elsewhere. Keep your edits and retry.", 409, "REVISION_CONFLICT");
    const saved = await tx.workspacePage.findFirst({ where: { id: pageId, workspaceId }, select: PAGE_SELECT });
    return { ok: true, value: saved } satisfies Result;
  });
}

export async function trashWorkspacePage(ownerUserId: string, pageId: string) {
  return serialized(ownerUserId, async (tx, workspaceId) => {
    const page = await tx.workspacePage.findFirst({ where: { id: pageId, workspaceId }, select: { id: true } });
    if (!page) return bad("Page not found.", 404, "NOT_FOUND");
    const ids = await descendants(tx, workspaceId, pageId);
    await tx.workspacePage.updateMany({ where: { workspaceId, id: { in: ids } }, data: { deletedAt: new Date(), revision: { increment: 1 } } });
    return { ok: true, value: { deleted: ids.length } } satisfies Result;
  });
}

export async function setWorkspacePageState(ownerUserId: string, pageId: string, state: "archive" | "restore") {
  return serialized(ownerUserId, async (tx, workspaceId) => {
    const page = await tx.workspacePage.findFirst({ where: { id: pageId, workspaceId }, select: { id: true } });
    if (!page) return bad("Page not found.", 404, "NOT_FOUND");
    const ids = await descendants(tx, workspaceId, pageId);
    await tx.workspacePage.updateMany({ where: { workspaceId, id: { in: ids } }, data: state === "archive" ? { archivedAt: new Date(), revision: { increment: 1 } } : { archivedAt: null, deletedAt: null, revision: { increment: 1 } } });
    return { ok: true, value: { updated: ids.length } } satisfies Result;
  });
}

export async function moveWorkspacePage(ownerUserId: string, pageId: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Move request is invalid.");
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["parentId", "expectedRevision"].includes(key)) || !("expectedRevision" in body) || (body.parentId !== null && (typeof body.parentId !== "string" || body.parentId.length > 128)) || !Number.isInteger(body.expectedRevision)) return bad("Move request is invalid.");
  return serialized(ownerUserId, async (tx, workspaceId) => {
    const page = await tx.workspacePage.findFirst({ where: { id: pageId, workspaceId, deletedAt: null }, select: { id: true, parentId: true, revision: true } });
    if (!page) return bad("Page not found.", 404, "NOT_FOUND");
    if (page.revision !== body.expectedRevision) return { ok: false, status: 409, code: "REVISION_CONFLICT", message: "This page changed elsewhere; reload before moving it.", currentRevision: page.revision };
    const nextParent = body.parentId as string | null;
    const descendantsOfPage = new Set(await descendants(tx, workspaceId, pageId));
    if (nextParent && descendantsOfPage.has(nextParent)) return bad("A page cannot be moved inside itself or one of its descendants.", 400, "PAGE_CYCLE");
    const depth = await pageDepth(tx, workspaceId, nextParent);
    if (depth === null) return bad("Parent page was not found in this workspace.", 404, "PAGE_NOT_FOUND");
    const childDepths = await descendantDepths(tx, workspaceId, pageId);
    if (depth + childDepths > MAX_PAGE_DEPTH) return bad("Move would exceed maximum page nesting depth.", 400, "MAX_DEPTH");
    const maxOrder = await tx.workspacePage.aggregate({ where: { workspaceId, parentId: nextParent }, _max: { sortOrder: true } });
    const changed = await tx.workspacePage.updateMany({ where: { id: pageId, workspaceId, revision: body.expectedRevision as number }, data: { parentId: nextParent, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1, revision: { increment: 1 } } });
    if (changed.count !== 1) return bad("This page changed elsewhere; retry the move.", 409, "REVISION_CONFLICT");
    return { ok: true, value: await tx.workspacePage.findFirst({ where: { id: pageId, workspaceId }, select: PAGE_SELECT }) } satisfies Result;
  });
}

async function descendantDepths(tx: Tx, workspaceId: string, pageId: string) {
  const all = await tx.workspacePage.findMany({ where: { workspaceId }, select: { id: true, parentId: true }, take: MAX_PAGES + 1 });
  const depthById = new Map<string, number>([[pageId, 0]]);
  let changed = true;
  while (changed) { changed = false; for (const row of all) if (row.parentId && depthById.has(row.parentId) && !depthById.has(row.id)) { depthById.set(row.id, (depthById.get(row.parentId) ?? 0) + 1); changed = true; } }
  return Math.max(0, ...depthById.values());
}

export async function reorderWorkspacePages(ownerUserId: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Reorder request is invalid.");
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["parentId", "pageIds"].includes(key)) || !Array.isArray(body.pageIds) || body.pageIds.length > MAX_PAGES || !body.pageIds.every((id) => typeof id === "string") || new Set(body.pageIds).size !== body.pageIds.length || (body.parentId !== null && body.parentId !== undefined && typeof body.parentId !== "string")) return bad("Reorder request is invalid.");
  return serialized(ownerUserId, async (tx, workspaceId) => {
    const parentId = (body.parentId as string | null | undefined) ?? null;
    if (parentId && !(await tx.workspacePage.findFirst({ where: { id: parentId, workspaceId, deletedAt: null }, select: { id: true } }))) return bad("Parent page not found.", 404, "PAGE_NOT_FOUND");
    const current = await tx.workspacePage.findMany({ where: { workspaceId, parentId, deletedAt: null }, select: { id: true, sortOrder: true } });
    const requestedIds = body.pageIds as string[];
    if (current.length !== requestedIds.length || current.some((row) => !requestedIds.includes(row.id))) return bad("Reorder list must contain exactly the pages in this parent.", 400, "INVALID_ORDER");
    const allPositions = await tx.workspacePage.findMany({ where: { workspaceId, parentId }, select: { sortOrder: true, deletedAt: true } });
    const offset = Math.max(0, ...allPositions.map((row) => row.sortOrder)) + current.length + 10;
    for (const row of current) await tx.workspacePage.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder + offset } });
    const reserved = new Set(allPositions.filter((row) => row.deletedAt !== null).map((row) => row.sortOrder));
    let nextSortOrder = 0;
    for (const id of requestedIds) {
      while (reserved.has(nextSortOrder)) nextSortOrder += 1;
      await tx.workspacePage.update({ where: { id }, data: { sortOrder: nextSortOrder, revision: { increment: 1 } } });
      nextSortOrder += 1;
    }
    return { ok: true, value: await tx.workspacePage.findMany({ where: { workspaceId, parentId, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: PAGE_SELECT }) } satisfies Result;
  });
}

export async function duplicateWorkspacePage(ownerUserId: string, pageId: string) {
  return serialized(ownerUserId, async (tx, workspaceId) => {
    const source = await tx.workspacePage.findFirst({ where: { id: pageId, workspaceId, deletedAt: null, archivedAt: null }, select: PAGE_SELECT });
    if (!source) return bad("Page not found.", 404, "NOT_FOUND");
    if ((await tx.workspacePage.count({ where: { workspaceId, deletedAt: null } })) >= MAX_PAGES) return bad("Workspace page limit reached.", 413, "PAGE_LIMIT");
    const max = await tx.workspacePage.aggregate({ where: { workspaceId, parentId: source.parentId }, _max: { sortOrder: true } });
    const duplicate = await tx.workspacePage.create({ data: { workspaceId, parentId: source.parentId, title: `${source.title} copy`.slice(0, 120), iconKey: source.iconKey, sortOrder: (max._max.sortOrder ?? -1) + 1, searchText: source.searchText }, select: PAGE_SELECT });
    const sourceBlocks = await tx.workspaceBlock.findMany({ where: { workspaceId, pageId, }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: BLOCK_SELECT });
    const oldToNew = new Map<string, string>();
    const pending = [...sourceBlocks];
    while (pending.length) {
      const index = pending.findIndex((block) => !block.parentBlockId || oldToNew.has(block.parentBlockId));
      if (index < 0) throw new Error("WORKSPACE_BLOCK_TREE_INVALID");
      const [block] = pending.splice(index, 1);
      if (!block) continue;
      const copied = await cloneBlock(tx, workspaceId, duplicate.id, block, block.parentBlockId ? oldToNew.get(block.parentBlockId)! : null);
      oldToNew.set(block.id, copied);
    }
    return { ok: true, value: duplicate } satisfies Result;
  });
}

type CloneBlockData = {
  type: WorkspaceBlockType;
  sortOrder: number;
  content: Prisma.JsonValue;
  plainText: string;
  items: Array<{ sortOrder: number; text: string; checkedAt: Date | null; dueAt: Date | null }>;
  tableColumns: Array<{ id: string; sortOrder: number; label: string; width: number | null }>;
  tableRows: Array<{ sortOrder: number; cells: Array<{ columnId: string; value: string }> }>;
  reminders: Array<{ remindAt: Date; timezone: string }>;
  mediaAssetId: string | null;
  pageReference: { targetPageId: string } | null;
  parentBlockId: string | null;
};

async function cloneBlock(tx: Tx, workspaceId: string, pageId: string, source: CloneBlockData, parentBlockId: string | null) {
  const block = await tx.workspaceBlock.create({ data: { workspaceId, pageId, parentBlockId, mediaAssetId: source.mediaAssetId, type: source.type, sortOrder: source.sortOrder, content: source.content as Prisma.InputJsonValue, plainText: source.plainText }, select: { id: true } });
  for (const item of source.items) await tx.workspaceBlockItem.create({ data: { workspaceId, pageId, blockId: block.id, sortOrder: item.sortOrder, text: item.text, checkedAt: item.checkedAt, dueAt: item.dueAt } });
  const columnIds = new Map<string, string>();
  for (const column of source.tableColumns) { const copied = await tx.workspaceTableColumn.create({ data: { workspaceId, pageId, blockId: block.id, sortOrder: column.sortOrder, label: column.label, width: column.width }, select: { id: true } }); columnIds.set(column.id, copied.id); }
  for (const row of source.tableRows) {
    const copiedRow = await tx.workspaceTableRow.create({ data: { workspaceId, pageId, blockId: block.id, sortOrder: row.sortOrder }, select: { id: true } });
    for (const cell of row.cells) { const newColumnId = columnIds.get(cell.columnId); if (newColumnId) await tx.workspaceTableCell.create({ data: { workspaceId, pageId, blockId: block.id, rowId: copiedRow.id, columnId: newColumnId, value: cell.value } }); }
  }
  for (const reminder of source.reminders) await tx.workspaceReminder.create({ data: { workspaceId, pageId, blockId: block.id, remindAt: reminder.remindAt, timezone: reminder.timezone, status: "SCHEDULED" } });
  if (source.pageReference) await tx.workspacePageReference.create({ data: { workspaceId, sourcePageId: pageId, sourceBlockId: block.id, targetPageId: source.pageReference.targetPageId } });
  return block.id;
}

async function createBlockInTransaction(tx: Tx, workspaceId: string, pageId: string, blockData: Exclude<ParsedBlockInput, { success: false }>['value'], parentBlockId: string | null = null, sortOrder?: number) {
  parentBlockId = blockData.parentBlockId ?? parentBlockId;
  if (parentBlockId) {
    const parent = await tx.workspaceBlock.findFirst({ where: { id: parentBlockId, workspaceId, pageId }, select: { id: true, parentBlockId: true } });
    if (!parent) throw new Error("WORKSPACE_PARENT_BLOCK_NOT_FOUND");
    let depth = 1;
    let cursor = parent.parentBlockId;
    while (cursor) { const ancestor = await tx.workspaceBlock.findFirst({ where: { id: cursor, workspaceId, pageId }, select: { parentBlockId: true } }); if (!ancestor || depth >= 4) throw new Error("WORKSPACE_BLOCK_DEPTH"); cursor = ancestor.parentBlockId; depth += 1; }
  }
  if (blockData.mediaAssetId) {
    const asset = await tx.workspaceMediaAsset.findFirst({ where: { id: blockData.mediaAssetId, workspaceId }, select: { id: true } });
    if (!asset) throw new Error("WORKSPACE_MEDIA_ASSET_NOT_FOUND");
  }
  const max = sortOrder === undefined ? await tx.workspaceBlock.aggregate({ where: { workspaceId, pageId, parentBlockId }, _max: { sortOrder: true } }) : null;
  const created = await tx.workspaceBlock.create({ data: { workspaceId, pageId, parentBlockId, mediaAssetId: blockData.mediaAssetId ?? null, type: blockData.type as WorkspaceBlockType, sortOrder: sortOrder ?? (max?._max.sortOrder ?? -1) + 1, content: blockData.content as Prisma.InputJsonValue, plainText: blockData.plainText }, select: { id: true, revision: true, sortOrder: true, plainText: true } });
  if (blockData.items) for (const [index, item] of blockData.items.entries()) await tx.workspaceBlockItem.create({ data: { workspaceId, pageId, blockId: created.id, sortOrder: index, text: item.text, checkedAt: item.checkedAt, dueAt: item.dueAt } });
  if (blockData.table) {
    const columns = [];
    for (const [sortOrder, label] of blockData.table.columns.entries()) columns.push(await tx.workspaceTableColumn.create({ data: { workspaceId, pageId, blockId: created.id, sortOrder, label }, select: { id: true } }));
    for (const [sortOrder, values] of blockData.table.rows.entries()) {
      const row = await tx.workspaceTableRow.create({ data: { workspaceId, pageId, blockId: created.id, sortOrder }, select: { id: true } });
      for (const [columnIndex, value] of values.entries()) await tx.workspaceTableCell.create({ data: { workspaceId, pageId, blockId: created.id, rowId: row.id, columnId: columns[columnIndex]!.id, value } });
    }
  }
  if (blockData.pageReferenceId) {
    const target = await tx.workspacePage.findFirst({ where: { id: blockData.pageReferenceId, workspaceId, deletedAt: null }, select: { id: true } });
    if (!target) throw new Error("WORKSPACE_REFERENCE_NOT_FOUND");
    await tx.workspacePageReference.create({ data: { workspaceId, sourcePageId: pageId, sourceBlockId: created.id, targetPageId: target.id } });
  }
  if (blockData.reminder) await tx.workspaceReminder.create({ data: { workspaceId, pageId, blockId: created.id, remindAt: blockData.reminder.remindAt, timezone: blockData.reminder.timezone } });
  return created;
}

export async function listWorkspaceBlocks(ownerUserId: string, pageId: string) {
  const workspace = await readWorkspaceForUser(prisma, ownerUserId);
  if (!workspace) return null;
  const page = await prisma.workspacePage.findFirst({ where: { id: pageId, workspaceId: workspace.id, deletedAt: null }, select: { id: true } });
  if (!page) return null;
  return prisma.workspaceBlock.findMany({ where: { workspaceId: workspace.id, pageId }, orderBy: [{ parentBlockId: "asc" }, { sortOrder: "asc" }, { id: "asc" }], take: MAX_BLOCKS, select: BLOCK_SELECT });
}

export async function createWorkspaceBlock(ownerUserId: string, pageId: string, input: unknown) {
  const parsed = parsedBlock(input);
  if (isResult(parsed)) return parsed;
  try {
    return await serialized(ownerUserId, async (tx, workspaceId) => {
      const page = await tx.workspacePage.findFirst({ where: { id: pageId, workspaceId, deletedAt: null, archivedAt: null }, select: { id: true } });
      if (!page) return bad("Page not found.", 404, "NOT_FOUND");
      const count = await tx.workspaceBlock.count({ where: { workspaceId, pageId } });
      if (count >= MAX_BLOCKS) return bad("This page has reached its block limit.", 413, "BLOCK_LIMIT");
      const block = await createBlockInTransaction(tx, workspaceId, pageId, parsed.value);
      const all = await tx.workspaceBlock.findMany({ where: { workspaceId, pageId }, select: { plainText: true } });
      await tx.workspacePage.update({ where: { id: pageId }, data: { searchText: pageSearchContent(all) } });
      return { ok: true, value: await tx.workspaceBlock.findFirst({ where: { id: block.id }, select: BLOCK_SELECT }) } satisfies Result;
    });
  } catch (error) { if (error instanceof Error && ["WORKSPACE_REFERENCE_NOT_FOUND", "WORKSPACE_PARENT_BLOCK_NOT_FOUND", "WORKSPACE_MEDIA_ASSET_NOT_FOUND"].includes(error.message)) return bad("Referenced workspace resource not found.", 404, "NOT_FOUND"); if (error instanceof Error && error.message === "WORKSPACE_BLOCK_DEPTH") return bad("Maximum block nesting depth reached.", 400, "MAX_DEPTH"); throw error; }
}

export async function updateWorkspaceBlock(ownerUserId: string, blockId: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Block update is invalid.");
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["expectedRevision", "type", "content"].includes(key)) || !Number.isInteger(body.expectedRevision)) return bad("Expected block revision is required.");
  const parsed = parsedBlock({ type: body.type, content: body.content });
  if (isResult(parsed)) return parsed;
  try {
    return await serialized(ownerUserId, async (tx, workspaceId) => {
      const current = await tx.workspaceBlock.findFirst({ where: { id: blockId, workspaceId }, select: { pageId: true, revision: true, type: true } });
      if (!current) return bad("Block not found.", 404, "NOT_FOUND");
      if (current.revision !== body.expectedRevision) return { ok: false, status: 409, code: "REVISION_CONFLICT", message: "This block changed elsewhere. Keep your edits before reconciling.", currentRevision: current.revision };
      if (parsed.value.pageReferenceId && !(await tx.workspacePage.findFirst({ where: { id: parsed.value.pageReferenceId, workspaceId, deletedAt: null }, select: { id: true } }))) return bad("Referenced page not found.", 404, "NOT_FOUND");
      if (parsed.value.mediaAssetId && !(await tx.workspaceMediaAsset.findFirst({ where: { id: parsed.value.mediaAssetId, workspaceId }, select: { id: true } }))) return bad("Referenced workspace resource not found.", 404, "NOT_FOUND");
      const changed = await tx.workspaceBlock.updateMany({ where: { id: blockId, workspaceId, revision: body.expectedRevision as number }, data: { type: parsed.value.type as WorkspaceBlockType, content: parsed.value.content as Prisma.InputJsonValue, plainText: parsed.value.plainText, mediaAssetId: parsed.value.mediaAssetId ?? null, revision: { increment: 1 } } });
      if (changed.count !== 1) return bad("This block changed elsewhere; keep your edits and retry.", 409, "REVISION_CONFLICT");
      await tx.workspaceBlockItem.deleteMany({ where: { workspaceId, pageId: current.pageId, blockId } });
      await tx.workspaceTableCell.deleteMany({ where: { workspaceId, pageId: current.pageId, blockId } });
      await tx.workspaceTableRow.deleteMany({ where: { workspaceId, pageId: current.pageId, blockId } });
      await tx.workspaceTableColumn.deleteMany({ where: { workspaceId, pageId: current.pageId, blockId } });
      await tx.workspacePageReference.deleteMany({ where: { workspaceId, sourceBlockId: blockId } });
      await tx.workspaceReminder.deleteMany({ where: { workspaceId, pageId: current.pageId, blockId } });
      await tx.workspaceBlock.update({ where: { id: blockId }, data: { mediaAssetId: parsed.value.mediaAssetId ?? null } });
      if (parsed.value.items) for (const [sortOrder, item] of parsed.value.items.entries()) await tx.workspaceBlockItem.create({ data: { workspaceId, pageId: current.pageId, blockId, sortOrder, text: item.text, checkedAt: item.checkedAt, dueAt: item.dueAt } });
      if (parsed.value.table) {
        const columns = [];
        for (const [sortOrder, label] of parsed.value.table.columns.entries()) columns.push(await tx.workspaceTableColumn.create({ data: { workspaceId, pageId: current.pageId, blockId, sortOrder, label }, select: { id: true } }));
        for (const [sortOrder, values] of parsed.value.table.rows.entries()) { const row = await tx.workspaceTableRow.create({ data: { workspaceId, pageId: current.pageId, blockId, sortOrder }, select: { id: true } }); for (const [i, value] of values.entries()) await tx.workspaceTableCell.create({ data: { workspaceId, pageId: current.pageId, blockId, rowId: row.id, columnId: columns[i]!.id, value } }); }
      }
      if (parsed.value.pageReferenceId) await tx.workspacePageReference.create({ data: { workspaceId, sourcePageId: current.pageId, sourceBlockId: blockId, targetPageId: parsed.value.pageReferenceId } });
      if (parsed.value.reminder) await tx.workspaceReminder.create({ data: { workspaceId, pageId: current.pageId, blockId, remindAt: parsed.value.reminder.remindAt, timezone: parsed.value.reminder.timezone } });
      const all = await tx.workspaceBlock.findMany({ where: { workspaceId, pageId: current.pageId }, select: { plainText: true } });
      await tx.workspacePage.update({ where: { id: current.pageId }, data: { searchText: pageSearchContent(all), revision: { increment: 1 } } });
      return { ok: true, value: await tx.workspaceBlock.findFirst({ where: { id: blockId, workspaceId }, select: BLOCK_SELECT }) } satisfies Result;
    });
  } catch (error) { if (error instanceof Error && ["WORKSPACE_REFERENCE_NOT_FOUND", "WORKSPACE_PARENT_BLOCK_NOT_FOUND", "WORKSPACE_MEDIA_ASSET_NOT_FOUND"].includes(error.message)) return bad("Referenced workspace resource not found.", 404, "NOT_FOUND"); if (error instanceof Error && error.message === "WORKSPACE_BLOCK_DEPTH") return bad("Maximum block nesting depth reached.", 400, "MAX_DEPTH"); throw error; }
}

export async function deleteWorkspaceBlock(ownerUserId: string, blockId: string) {
  return serialized(ownerUserId, async (tx, workspaceId) => {
    const block = await tx.workspaceBlock.findFirst({ where: { id: blockId, workspaceId }, select: { id: true, pageId: true } });
    if (!block) return bad("Block not found.", 404, "NOT_FOUND");
    await tx.workspaceBlock.delete({ where: { id: blockId } });
    const all = await tx.workspaceBlock.findMany({ where: { workspaceId, pageId: block.pageId }, select: { plainText: true } });
    await tx.workspacePage.update({ where: { id: block.pageId }, data: { searchText: pageSearchContent(all), revision: { increment: 1 } } });
    return { ok: true, value: { deleted: true } } satisfies Result;
  });
}

export async function reorderWorkspaceBlocks(ownerUserId: string, pageId: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Block order is invalid.");
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["blockIds", "parentBlockId"].includes(key)) || !Array.isArray(body.blockIds) || body.blockIds.length > MAX_BLOCKS || !body.blockIds.every((id) => typeof id === "string") || new Set(body.blockIds).size !== body.blockIds.length || (body.parentBlockId !== undefined && body.parentBlockId !== null && typeof body.parentBlockId !== "string")) return bad("Block order is invalid.");
  return serialized(ownerUserId, async (tx, workspaceId) => {
    if (!(await tx.workspacePage.findFirst({ where: { id: pageId, workspaceId, deletedAt: null }, select: { id: true } }))) return bad("Page not found.", 404, "NOT_FOUND");
    const parentBlockId = (body.parentBlockId as string | null | undefined) ?? null;
    if (parentBlockId && !(await tx.workspaceBlock.findFirst({ where: { id: parentBlockId, workspaceId, pageId }, select: { id: true } }))) return bad("Parent block not found.", 404, "NOT_FOUND");
    const blocks = await tx.workspaceBlock.findMany({ where: { workspaceId, pageId, parentBlockId }, select: { id: true, sortOrder: true } });
    const requestedIds = body.blockIds as string[];
    if (blocks.length !== requestedIds.length || blocks.some(({ id }) => !requestedIds.includes(id))) return bad("Order must include every root block on this page exactly once.", 400, "INVALID_ORDER");
    const offset = Math.max(0, ...blocks.map((block) => block.sortOrder)) + blocks.length + 10;
    for (const block of blocks) await tx.workspaceBlock.update({ where: { id: block.id }, data: { sortOrder: block.sortOrder + offset } });
    for (const [sortOrder, id] of requestedIds.entries()) await tx.workspaceBlock.update({ where: { id }, data: { sortOrder, revision: { increment: 1 } } });
    await tx.workspacePage.update({ where: { id: pageId }, data: { revision: { increment: 1 } } });
    return { ok: true, value: { blocks: await tx.workspaceBlock.findMany({ where: { workspaceId, pageId, parentBlockId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, parentBlockId: true, sortOrder: true, revision: true } }), page: await tx.workspacePage.findFirst({ where: { id: pageId, workspaceId }, select: { revision: true } }) } } satisfies Result;
  });
}

export async function searchWorkspace(ownerUserId: string, query: string, limit = 20) {
  const workspace = await readWorkspaceForUser(prisma, ownerUserId);
  if (!workspace) return [];
  const normalized = query.trim().replace(/\s+/g, " ").slice(0, 100);
  if (normalized.length < 2) return [];
  return prisma.workspacePage.findMany({ where: { workspaceId: workspace.id, deletedAt: null, archivedAt: null, OR: [{ title: { contains: normalized, mode: "insensitive" } }, { searchText: { contains: normalized, mode: "insensitive" } }] }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: Math.min(Math.max(limit, 1), 30), select: PAGE_SELECT });
}

export function workspacePageTemplates() {
  return WORKSPACE_TEMPLATES.map(({ id, title, blocks }) => ({ id, title, version: 1, blockCount: blocks.length }));
}

export function workspaceTransactionForTests() { return prisma.$transaction.bind(prisma); }
