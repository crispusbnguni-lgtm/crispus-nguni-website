import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
globalThis.__workspaceStore = { workspaces: [], pages: [], blocks: [], items: [], tableColumns: [], tableRows: [], tableCells: [], pageReferences: [], reminders: [], mediaAssets: [], locks: [] };

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: dataModule("export {};"), shortCircuit: true };
    if (specifier === "@prisma/client") return { url: dataModule("export const Prisma = { TransactionIsolationLevel: { Serializable: 'Serializable' } };"), shortCircuit: true };
    if (specifier === "@/lib/prisma") return { url: dataModule(`
      const initial = () => globalThis.__workspaceStore;
      const rows = (model) => initial()[model];
      const clone = (value) => structuredClone(value);
      function matches(row, where = {}) { return Object.entries(where || {}).every(([key, wanted]) => { const actual = row[key]; if (wanted && typeof wanted === 'object' && !(wanted instanceof Date)) { if ('in' in wanted) return wanted.in.includes(actual); if ('not' in wanted) return actual !== wanted.not; } return actual === wanted; }); }
      function apply(row, data) { for (const [key, value] of Object.entries(data || {})) { if (value && typeof value === 'object' && 'increment' in value) row[key] = (row[key] || 0) + value.increment; else if (value !== undefined) row[key] = clone(value); } row.updatedAt = new Date(); return row; }
      const tableMap = { personalWorkspace: 'workspaces', workspacePage: 'pages', workspaceBlock: 'blocks', workspaceBlockItem: 'items', workspaceTableColumn: 'tableColumns', workspaceTableRow: 'tableRows', workspaceTableCell: 'tableCells', workspacePageReference: 'pageReferences', workspaceReminder: 'reminders', workspaceMediaAsset: 'mediaAssets' };
      function delegate(name) { const model = tableMap[name]; return {
        async upsert({ where, create }) { let row = rows(model).find((item) => matches(item, where)); if (!row) { row = { id: 'ws-' + create.userId, revision: 0, ...clone(create), createdAt: new Date(), updatedAt: new Date() }; rows(model).push(row); } return clone(row); },
        async findFirst({ where }) { const row = rows(model).find((item) => matches(item, where)); return row ? clone(row) : null; },
        async findMany({ where, orderBy, take }) { let result = rows(model).filter((item) => matches(item, where)); if (orderBy) { const orders = Array.isArray(orderBy) ? orderBy : [orderBy]; result = [...result].sort((a,b) => { for (const order of orders) { const [key, dir] = Object.entries(order)[0]; if (a[key] < b[key]) return dir === 'desc' ? 1 : -1; if (a[key] > b[key]) return dir === 'desc' ? -1 : 1; } return 0; }); } return clone(result.slice(0, take ?? result.length)); },
        async count({ where }) { return rows(model).filter((item) => matches(item, where)).length; },
        async aggregate({ where }) { const result = rows(model).filter((item) => matches(item, where)); return { _max: { sortOrder: result.length ? Math.max(...result.map((item) => item.sortOrder)) : null } }; },
        async create({ data }) { const row = { id: name + '-' + Math.random().toString(36).slice(2), revision: 0, sortOrder: 0, parentId: null, parentBlockId: null, isFavorite: false, isPinned: false, archivedAt: null, deletedAt: null, items: [], tableColumns: [], tableRows: [], pageReference: null, reminders: [], mediaAssetId: null, createdAt: new Date(), updatedAt: new Date(), ...clone(data) }; if (model === 'pages' && rows(model).some((item) => item.workspaceId === row.workspaceId && item.parentId === row.parentId && item.sortOrder === row.sortOrder)) throw new Error('unique page ordering constraint'); rows(model).push(row); return clone(row); },
        async update({ where, data }) { const row = rows(model).find((item) => matches(item, where)); if (!row) throw new Error('not found'); if (model === 'pages' && data.sortOrder !== undefined && rows(model).some((item) => item.id !== row.id && item.workspaceId === row.workspaceId && item.parentId === (data.parentId === undefined ? row.parentId : data.parentId) && item.sortOrder === data.sortOrder)) throw new Error('unique page ordering constraint'); return clone(apply(row, data)); },
        async updateMany({ where, data }) { const found = rows(model).filter((item) => matches(item, where)); for (const row of found) apply(row, data); return { count: found.length }; },
        async deleteMany({ where }) { const list = rows(model); const remaining = list.filter((item) => !matches(item, where)); const count = list.length - remaining.length; initial()[model] = remaining; return { count }; },
        async delete({ where }) { const list = rows(model); const index = list.findIndex((item) => matches(item, where)); if (index < 0) throw new Error('not found'); return clone(list.splice(index, 1)[0]); },
      }; }
      function client() { const value = {}; for (const name of Object.keys(tableMap)) value[name] = delegate(name); value.$executeRaw = async (strings, ...values) => { initial().locks.push(values[0]); return 0; }; return value; }
      export const prisma = { ...client(), async $transaction(callback) { const before = clone(initial()); try { return await callback(client()); } catch (error) { globalThis.__workspaceStore = before; throw error; } } };
    `), shortCircuit: true };
    if (specifier === "@/lib/personal-workspace-pages-core") return { url: new URL("../src/lib/personal-workspace-pages-core.ts", import.meta.url).href, shortCircuit: true };
    if (specifier === "@/lib/consultations/timezone-core") return { url: new URL("../src/lib/consultations/timezone-core.ts", import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const service = await import("../src/lib/personal-workspace-pages.ts");
const store = () => globalThis.__workspaceStore;

test.beforeEach(() => { globalThis.__workspaceStore = { workspaces: [], pages: [], blocks: [], items: [], tableColumns: [], tableRows: [], tableCells: [], pageReferences: [], reminders: [], mediaAssets: [], locks: [] }; });

test("page creation is scoped to owner and rejects a foreign parent", async () => {
  const created = await service.createWorkspacePage("owner-a", { title: "Private notes" });
  assert.equal(created.ok, true);
  assert.equal(store().pages.length, 1);
  assert.equal(store().pages[0].workspaceId, "ws-owner-a");
  const foreignParent = await service.createWorkspacePage("owner-a", { title: "Child", parentId: "page-owned-by-b" });
  assert.equal(foreignParent.ok, false);
  if (!foreignParent.ok) assert.equal(foreignParent.status, 404);
  assert.equal(store().pages.length, 1);
});

test("page revision updates are conditional and stale writes preserve stored state", async () => {
  const created = await service.createWorkspacePage("owner-a", { title: "Original" });
  const pageId = created.value.id;
  const saved = await service.updateWorkspacePage("owner-a", pageId, { title: "Updated", expectedRevision: 0 });
  assert.equal(saved.ok, true);
  assert.equal(store().pages[0].revision, 1);
  const stale = await service.updateWorkspacePage("owner-a", pageId, { title: "Stale overwrite", expectedRevision: 0 });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.status, 409);
  assert.equal(store().pages[0].title, "Updated");
});

test("page moves reject self-descendant cycles", async () => {
  const root = await service.createWorkspacePage("owner-a", { title: "Root" });
  const child = await service.createWorkspacePage("owner-a", { title: "Child", parentId: root.value.id });
  const result = await service.moveWorkspacePage("owner-a", root.value.id, { parentId: child.value.id, expectedRevision: 0 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "PAGE_CYCLE");
  assert.equal(store().pages.find((page) => page.id === root.value.id).parentId, null);
});

test("tables persist as normalized columns, rows and same-table cells", async () => {
  const page = await service.createWorkspacePage("owner-a", { title: "Data" });
  const result = await service.createWorkspaceBlock("owner-a", page.value.id, { type: "TABLE", content: { columns: ["Name", "Status"], rows: [["Ada", "Ready"]] } });
  assert.equal(result.ok, true);
  assert.equal(store().blocks.length, 1);
  assert.equal(store().tableColumns.length, 2);
  assert.equal(store().tableRows.length, 1);
  assert.equal(store().tableCells.length, 2);
  assert.equal("columns" in store().blocks[0].content, false);
  assert.equal(new Set(store().tableCells.map((cell) => `${cell.rowId}:${cell.columnId}`)).size, 2);
});

test("cross-workspace block updates resolve as not found", async () => {
  const page = await service.createWorkspacePage("owner-a", { title: "A" });
  const block = await service.createWorkspaceBlock("owner-a", page.value.id, { type: "PARAGRAPH", content: { text: "private" } });
  const result = await service.updateWorkspaceBlock("owner-b", block.value.id, { expectedRevision: 0, type: "PARAGRAPH", content: { text: "tamper" } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 404);
  assert.equal(store().blocks[0].plainText, "private");
});

test("invalid page references roll back block creation in the transaction test double", async () => {
  const page = await service.createWorkspacePage("owner-a", { title: "Source" });
  const result = await service.createWorkspaceBlock("owner-a", page.value.id, { type: "PAGE_REFERENCE", content: { targetPageId: "not-in-this-workspace" } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 404);
  assert.equal(store().blocks.length, 0);
});

test("checklist items persist checked and due state in normalized rows", async () => {
  const page = await service.createWorkspacePage("owner-a", { title: "Tasks" });
  const dueAt = "2026-11-20T09:00:00.000Z";
  const block = await service.createWorkspaceBlock("owner-a", page.value.id, { type: "TODO", content: { items: [{ text: "Ship", checked: true, dueAt }, { text: "Review", checked: false, dueAt: null }] } });
  assert.equal(block.ok, true);
  assert.equal(store().items.length, 2);
  assert.equal(store().items[0].text, "Ship");
  assert.ok(store().items[0].checkedAt instanceof Date);
  assert.equal(store().items[0].dueAt.toISOString(), dueAt);
  assert.equal(store().items[1].checkedAt, null);
});

test("block edits use conditional revisions and stale content cannot overwrite", async () => {
  const page = await service.createWorkspacePage("owner-a", { title: "Notes" });
  const block = await service.createWorkspaceBlock("owner-a", page.value.id, { type: "PARAGRAPH", content: { text: "Saved" } });
  const stale = await service.updateWorkspaceBlock("owner-a", block.value.id, { expectedRevision: 1, type: "PARAGRAPH", content: { text: "Wrong" } });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.status, 409);
  assert.equal(store().blocks[0].plainText, "Saved");
});

test("block reorder changes sibling positions under the workspace transaction", async () => {
  const page = await service.createWorkspacePage("owner-a", { title: "Blocks" });
  const one = await service.createWorkspaceBlock("owner-a", page.value.id, { type: "PARAGRAPH", content: { text: "one" } });
  const two = await service.createWorkspaceBlock("owner-a", page.value.id, { type: "PARAGRAPH", content: { text: "two" } });
  const result = await service.reorderWorkspaceBlocks("owner-a", page.value.id, { parentBlockId: null, blockIds: [two.value.id, one.value.id] });
  assert.equal(result.ok, true);
  assert.equal(store().blocks.find((block) => block.id === two.value.id).sortOrder, 0);
  assert.equal(store().blocks.find((block) => block.id === one.value.id).sortOrder, 1);
  assert.ok(store().locks.length >= 4);
});

test("page allocation and reorder reserve sort positions still held by trashed pages", async () => {
  const root = await service.createWorkspacePage("owner-a", { title: "Root" });
  const second = await service.createWorkspacePage("owner-a", { title: "Second" });
  const trashedRoot = await service.createWorkspacePage("owner-a", { title: "Trashed root" });
  assert.equal((await service.trashWorkspacePage("owner-a", trashedRoot.value.id)).ok, true);

  const appended = await service.createWorkspacePage("owner-a", { title: "Appended" });
  assert.equal(appended.ok, true);
  assert.equal(appended.value.sortOrder, 3);

  const duplicate = await service.duplicateWorkspacePage("owner-a", second.value.id);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.value.sortOrder, 4);

  const child = await service.createWorkspacePage("owner-a", { title: "Child", parentId: root.value.id });
  const trashedChild = await service.createWorkspacePage("owner-a", { title: "Trashed child", parentId: root.value.id });
  assert.equal((await service.trashWorkspacePage("owner-a", trashedChild.value.id)).ok, true);
  const moving = await service.createWorkspacePage("owner-a", { title: "Moving" });
  const moved = await service.moveWorkspacePage("owner-a", moving.value.id, { parentId: root.value.id, expectedRevision: 0 });
  assert.equal(moved.ok, true);
  assert.equal(moved.value.sortOrder, 2);

  const orderPages = [
    await service.createWorkspacePage("owner-order", { title: "Order one" }),
    await service.createWorkspacePage("owner-order", { title: "Order two" }),
    await service.createWorkspacePage("owner-order", { title: "Order deleted" }),
  ];
  assert.ok(orderPages.every((item) => item.ok));
  await service.trashWorkspacePage("owner-order", orderPages[2].value.id);
  const deletedRow = store().pages.find((page) => page.id === orderPages[2].value.id);
  const appendedOrderPage = await service.createWorkspacePage("owner-order", { title: "After trash" });
  assert.equal(appendedOrderPage.value.sortOrder, 3);
  const reordered = await service.reorderWorkspacePages("owner-order", { parentId: null, pageIds: [orderPages[1].value.id, appendedOrderPage.value.id, orderPages[0].value.id] });
  assert.equal(reordered.ok, true);
  assert.equal(store().pages.find((page) => page.id === orderPages[1].value.id).sortOrder, 0);
  assert.equal(store().pages.find((page) => page.id === appendedOrderPage.value.id).sortOrder, 1);
  assert.equal(store().pages.find((page) => page.id === orderPages[0].value.id).sortOrder, 3);
  assert.equal(store().pages.find((page) => page.id === deletedRow.id).sortOrder, 2);
  assert.equal(store().pages.find((page) => page.id === child.value.id).sortOrder, 0);
});
