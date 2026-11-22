import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import test from "node:test";
import { validatePersonalWorkspaceTestUrl } from "./helpers/personal-workspace-postgres.mjs";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: dataModule("export {};"), shortCircuit: true };
    if (specifier === "@/lib/prisma") return { url: new URL("./helpers/personal-workspace-postgres.mjs", import.meta.url).href, shortCircuit: true };
    if (specifier === "@/lib/personal-workspace-pages-core") return { url: new URL("../src/lib/personal-workspace-pages-core.ts", import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const { config, integrationEnabled, prisma } = await import("./helpers/personal-workspace-postgres.mjs");
const service = await import("../src/lib/personal-workspace-pages.ts");
const integration = (name, fn) => test(name, { skip: !integrationEnabled }, fn);
let owners = [];

test("rejects remote, unrecognized, and option-overridden database URLs without connecting", () => {
  assert.throws(() => validatePersonalWorkspaceTestUrl("postgresql://user:secret@db.example.com/crispus_workspace_test_local"), /loopback IP/);
  assert.throws(() => validatePersonalWorkspaceTestUrl("postgresql://user:secret@127.0.0.1/production"), /not an approved/);
  assert.throws(() => validatePersonalWorkspaceTestUrl("postgresql://postgres:secret@127.0.0.1/crispus_workspace_test_local"), /test role/);
  assert.throws(() => validatePersonalWorkspaceTestUrl("postgresql://crispus_workspace_test_runner:secret@127.0.0.1/crispus_workspace_test_local?host=db.example.com"), /Connection options/);
  assert.throws(() => validatePersonalWorkspaceTestUrl("https://127.0.0.1/crispus_workspace_test_local"), /must use PostgreSQL/);
});

test("accepts only a loopback PostgreSQL URL with the dedicated test database prefix", () => {
  const safe = validatePersonalWorkspaceTestUrl("postgresql://crispus_workspace_test_runner:test@127.0.0.1:55432/crispus_workspace_test_local");
  assert.equal(safe.databaseName, "crispus_workspace_test_local");
  assert.equal(safe.hostname, "127.0.0.1");
  assert.equal(safe.port, 55432);
});

test.before(async () => {
  if (!integrationEnabled || !prisma || !config) return;
  await prisma.$connect();
  const [database] = await prisma.$queryRaw`SELECT current_database() AS name`;
  assert.equal(database?.name, config.databaseName, "Connected database name must exactly match the guarded test URL.");
  const [schema] = await prisma.$queryRaw`
    SELECT to_regclass('public."PersonalWorkspace"') IS NOT NULL AS workspaces_exist,
      to_regclass('public."WorkspacePage"') IS NOT NULL AS pages_exist,
      to_regclass('public."_personal_workspace_test_guard"') IS NOT NULL AS test_guard_exists,
      EXISTS (
        SELECT 1 FROM pg_trigger
        JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_trigger.tgname = 'WorkspacePage_parent_acyclic'
          AND pg_class.relname = 'WorkspacePage'
          AND pg_namespace.nspname = 'public'
          AND NOT tgisinternal
      ) AS hierarchy_trigger_exists`;
  assert.equal(schema?.workspaces_exist, true, "The test database must already have the workspace foundation migration applied.");
  assert.equal(schema?.pages_exist, true, "The test database must already have the workspace-page migration applied.");
  assert.equal(schema?.test_guard_exists, true, "The explicitly provisioned test-only database marker is required.");
  assert.equal(schema?.hierarchy_trigger_exists, true, "The test database must already have the separately approved hierarchy-guard migration applied.");
  const [marker] = await prisma.$queryRaw`SELECT EXISTS (SELECT 1 FROM public."_personal_workspace_test_guard" WHERE marker = 'CRISPUS_PERSONAL_WORKSPACE_DISPOSABLE_TEST_DATABASE') AS valid`;
  assert.equal(marker?.valid, true, "Database marker did not identify an approved disposable Personal Workspace test database.");
});

test.after(async () => { if (prisma) await prisma.$disconnect(); });
test.afterEach(async () => {
  if (prisma && owners.length) await prisma.user.deleteMany({ where: { id: { in: owners } } });
  owners = [];
});

async function createOwner() {
  const id = `pw_it_${randomUUID().replaceAll("-", "")}`;
  await prisma.user.create({ data: { id, updatedAt: new Date() } });
  owners.push(id);
  return id;
}

async function createPage(ownerId, title, parentId = null) {
  const result = await service.createWorkspacePage(ownerId, { title, parentId });
  assert.equal(result.ok, true, result.message);
  return result.value;
}

integration("rejects direct self-parenting and a multi-page cycle atomically", async () => {
  const ownerId = await createOwner();
  const a = await createPage(ownerId, "A");
  const b = await createPage(ownerId, "B");
  const c = await createPage(ownerId, "C");

  await assert.rejects(prisma.workspacePage.update({ where: { id: a.id }, data: { parentId: a.id } }));
  await assert.rejects(prisma.$transaction(async (tx) => {
    await tx.workspacePage.update({ where: { id: a.id }, data: { parentId: b.id, sortOrder: 10 } });
    await tx.workspacePage.update({ where: { id: b.id }, data: { parentId: c.id, sortOrder: 11 } });
    await tx.workspacePage.update({ where: { id: c.id }, data: { parentId: a.id, sortOrder: 12 } });
  }));
  const rows = await prisma.workspacePage.findMany({ where: { id: { in: [a.id, b.id, c.id] } } });
  assert.ok(rows.every((page) => page.parentId === null));
});

integration("rejects cross-workspace parents while allowing valid nested pages", async () => {
  const ownerA = await createOwner();
  const ownerB = await createOwner();
  const parentA = await createPage(ownerA, "A root");
  const parentB = await createPage(ownerB, "B root");
  const workspaceA = await prisma.personalWorkspace.findUnique({ where: { userId: ownerA }, select: { id: true } });

  await assert.rejects(prisma.workspacePage.create({ data: { workspaceId: workspaceA.id, parentId: parentB.id, title: "Foreign child", sortOrder: 20 } }));
  const child = await createPage(ownerA, "Valid child", parentA.id);
  assert.equal(child.parentId, parentA.id);
});

integration("concurrent opposite moves cannot commit a page cycle", async () => {
  const ownerId = await createOwner();
  const a = await createPage(ownerId, "A");
  const b = await createPage(ownerId, "B");
  const results = await Promise.allSettled([
    service.moveWorkspacePage(ownerId, a.id, { parentId: b.id, expectedRevision: a.revision }),
    service.moveWorkspacePage(ownerId, b.id, { parentId: a.id, expectedRevision: b.revision }),
  ]);
  const accepted = results.filter((result) => result.status === "fulfilled" && result.value.ok);
  assert.ok(accepted.length < 2, "Both opposite moves must not succeed.");

  const pages = await prisma.workspacePage.findMany({ where: { workspaceId: (await prisma.personalWorkspace.findUnique({ where: { userId: ownerId }, select: { id: true } })).id }, select: { id: true, parentId: true } });
  const byId = new Map(pages.map((page) => [page.id, page]));
  for (const start of pages) {
    const seen = new Set();
    let cursor = start;
    while (cursor?.parentId) {
      assert.equal(seen.has(cursor.id), false, "Committed page hierarchy must be acyclic.");
      seen.add(cursor.id);
      cursor = byId.get(cursor.parentId);
    }
  }
});

integration("trashed ordering slots stay reserved during allocation and reorder", async () => {
  const ownerId = await createOwner();
  const first = await createPage(ownerId, "First");
  const second = await createPage(ownerId, "Second");
  const trashed = await createPage(ownerId, "Trashed");
  assert.equal((await service.trashWorkspacePage(ownerId, trashed.id)).ok, true);
  const appended = await createPage(ownerId, "Appended");
  assert.equal(appended.sortOrder, 3);

  const reordered = await service.reorderWorkspacePages(ownerId, { parentId: null, pageIds: [second.id, appended.id, first.id] });
  assert.equal(reordered.ok, true, reordered.message);
  const all = await prisma.workspacePage.findMany({ where: { workspaceId: appended.workspaceId, parentId: null }, select: { id: true, sortOrder: true, deletedAt: true } });
  assert.equal(new Set(all.map((page) => page.sortOrder)).size, all.length);
  assert.equal(all.find((page) => page.id === trashed.id).sortOrder, 2);
});

integration("composite table-cell keys reject cross-table references and page deletion cascades", async () => {
  const ownerId = await createOwner();
  const page = await createPage(ownerId, "Tables");
  await service.createWorkspaceBlock(ownerId, page.id, { type: "TABLE", content: { columns: ["A"], rows: [["a"]] } });
  await service.createWorkspaceBlock(ownerId, page.id, { type: "TABLE", content: { columns: ["B"], rows: [["b"]] } });
  const tables = await prisma.workspaceBlock.findMany({ where: { pageId: page.id }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  const row = await prisma.workspaceTableRow.findFirst({ where: { blockId: tables[0].id } });
  const otherColumn = await prisma.workspaceTableColumn.findFirst({ where: { blockId: tables[1].id } });
  await assert.rejects(prisma.workspaceTableCell.create({ data: { workspaceId: page.workspaceId, pageId: page.id, blockId: tables[0].id, rowId: row.id, columnId: otherColumn.id } }));

  await prisma.workspacePage.delete({ where: { id: page.id } });
  assert.equal(await prisma.workspaceBlock.count({ where: { pageId: page.id } }), 0);
  assert.equal(await prisma.workspaceTableRow.count({ where: { pageId: page.id } }), 0);
  assert.equal(await prisma.workspaceTableColumn.count({ where: { pageId: page.id } }), 0);
});
