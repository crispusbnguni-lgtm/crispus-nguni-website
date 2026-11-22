import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
function makeStore() {
  const state = { tasks: [], databases: [], properties: [], views: [], records: [], projectQueries: [] };
  const tx = {
    personalWorkspace: { upsert: async () => ({ id: "workspace-owner" }), findUnique: async () => ({ id: "workspace-owner" }) },
    $executeRaw: async () => 0,
    $queryRaw: async () => [{ hasValues: false, renameConflict: false }],
    workspaceTask: {
      aggregate: async () => ({ _max: { sortOrder: state.tasks.reduce((max, task) => Math.max(max, task.sortOrder), -1) } }),
      findMany: async ({ where, orderBy } = {}) => { const rows = state.tasks.filter((task) => (!where?.workspaceId || task.workspaceId === where.workspaceId) && (where?.parentTaskId === undefined || task.parentTaskId === where.parentTaskId)); if (orderBy?.[0]?.sortOrder) rows.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)); return rows; },
      findFirst: async ({ where }) => state.tasks.find((task) => task.id === where.id && task.workspaceId === where.workspaceId) ?? null,
      create: async ({ data }) => { const task = { id: `task-${state.tasks.length + 1}`, ...data, revision: 0, labels: [], project: null, createdAt: new Date(), updatedAt: new Date() }; state.tasks.push(task); return task; },
      findFirstOrThrow: async ({ where }) => { const task = state.tasks.find((item) => item.id === where.id && item.workspaceId === where.workspaceId); if (!task) throw new Error("missing"); return task; },
      updateMany: async ({ where, data }) => { const task = state.tasks.find((item) => item.id === where.id && item.workspaceId === where.workspaceId && item.revision === where.revision); if (!task) return { count: 0 }; const nextRevision = task.revision + (data.revision?.increment ?? 0); const values = { ...data }; delete values.revision; Object.assign(task, values, { revision: nextRevision, updatedAt: new Date() }); return { count: 1 }; },
      update: async ({ where, data }) => { const task = state.tasks.find((item) => item.id === where.id); if (!task) throw new Error("missing"); task.sortOrder = data.sortOrder; if (data.revision?.increment) task.revision += data.revision.increment; return task; },
      deleteMany: async ({ where }) => { const before = state.tasks.length; state.tasks = state.tasks.filter((task) => task.id !== where.id || task.workspaceId !== where.workspaceId); return { count: before - state.tasks.length }; },
    },
    workspaceProject: { findFirst: async () => null, findMany: async (args) => { state.projectQueries.push(args); return []; }, create: async ({ data }) => { const row = { id: `project-${state.databases.length + 1}`, ...data }; state.databases.push(row); return row; } },
    workspaceDatabase: { create: async ({ data }) => { const row = { id: `database-${state.databases.length + 1}`, ...data }; state.databases.push(row); return row; }, findFirst: async () => ({ id: "target-db" }) },
    workspaceDatabaseProperty: {
      create: async ({ data }) => { const row = { id: `property-${state.properties.length + 1}`, ...data }; state.properties.push(row); return row; },
      findMany: async () => state.properties.length ? state.properties : [{ id: "property-name", name: "Name", type: "TEXT", options: {} }],
      findFirst: async () => null,
    },
    workspaceDatabaseView: {
      create: async ({ data }) => { const row = { id: `view-${state.views.length + 1}`, revision: 0, ...data }; state.views.push(row); return row; },
      findFirst: async ({ where }) => state.views.find((view) => view.id === where.id && view.databaseId === where.databaseId && view.workspaceId === where.workspaceId && view.revision === where.revision) ?? null,
      updateMany: async ({ where, data }) => { const view = state.views.find((item) => item.id === where.id && item.databaseId === where.databaseId && item.workspaceId === where.workspaceId && item.revision === where.revision); if (!view) return { count: 0 }; Object.assign(view, data, { revision: view.revision + (data.revision?.increment ?? 0) }); return { count: 1 }; },
      findFirstOrThrow: async ({ where }) => { const view = state.views.find((item) => item.id === where.id && item.databaseId === where.databaseId && item.workspaceId === where.workspaceId); if (!view) throw new Error("missing"); return view; },
      deleteMany: async ({ where }) => { const before = state.views.length; state.views = state.views.filter((view) => view.id !== where.id || view.databaseId !== where.databaseId || view.workspaceId !== where.workspaceId); return { count: before - state.views.length }; },
    },
    workspaceDatabaseRecord: {
      aggregate: async () => ({ _max: { sortOrder: state.records.length - 1 } }),
      create: async ({ data }) => { const row = { id: `record-${state.records.length + 1}`, ...data }; state.records.push(row); return row; },
    },
  };
  const prisma = { ...tx, $transaction: async (callback) => { const before = structuredClone(state); try { return await callback(tx); } catch (error) { Object.assign(state, before); throw error; } } };
  return { state, prisma };
}
globalThis.__workspacePlanningStore = makeStore();
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: dataModule("export {};"), shortCircuit: true };
  if (specifier === "@prisma/client") return { url: dataModule("export const Prisma = { TransactionIsolationLevel: { Serializable: 'Serializable' }, PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {} };"), shortCircuit: true };
  if (specifier === "@/lib/prisma") return { url: dataModule("export const prisma = globalThis.__workspacePlanningStore.prisma;"), shortCircuit: true };
  if (specifier === "@/lib/consultations/timezone-core") return { url: new URL("../src/lib/consultations/timezone-core.ts", import.meta.url).href, shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-planning-core") return { url: new URL("../src/lib/personal-workspace-planning-core.ts", import.meta.url).href, shortCircuit: true };
  if (specifier === "@/lib/personal-workspace-planning") return { url: new URL("../src/lib/personal-workspace-planning.ts", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });

const planning = await import("../src/lib/personal-workspace-planning.ts");
const databases = await import("../src/lib/personal-workspace-databases.ts");
test.beforeEach(() => { const state = globalThis.__workspacePlanningStore.state; state.tasks.length = 0; state.databases.length = 0; state.properties.length = 0; state.views.length = 0; state.records.length = 0; });

test("task creation persists server defaults, owner scope, start date and recurrence definition", async () => {
  const result = await planning.createWorkspaceTask("owner-1", { title: "Study", startsAt: "2026-11-17T12:00:00.000Z", recurrenceRule: { frequency: "WEEKLY", interval: 1 }, labels: [] });
  assert.equal(result.ok, true);
  const task = globalThis.__workspacePlanningStore.state.tasks[0];
  assert.equal(task.workspaceId, "workspace-owner");
  assert.equal(task.status, "INBOX");
  assert.equal(task.priority, "NORMAL");
  assert.equal(task.startsAt.toISOString(), "2026-11-17T12:00:00.000Z");
  assert.equal(task.recurrenceRule, "FREQ=WEEKLY;INTERVAL=1");
});

test("task updates use optimistic revisions and stale updates leave persisted state unchanged", async () => {
  const created = await planning.createWorkspaceTask("owner-1", { title: "Draft" });
  const id = created.value.id;
  const updated = await planning.updateWorkspaceTask("owner-1", id, { title: "Revised", expectedRevision: 0 });
  assert.equal(updated.ok, true);
  assert.equal(globalThis.__workspacePlanningStore.state.tasks[0].title, "Revised");
  const stale = await planning.updateWorkspaceTask("owner-1", id, { title: "Stale", expectedRevision: 0 });
  assert.equal(stale.ok, false);
  assert.equal(globalThis.__workspacePlanningStore.state.tasks[0].title, "Revised");
});

test("subtask cycle validation rejects a move before persistence", async () => {
  const root = await planning.createWorkspaceTask("owner-1", { title: "Parent" });
  const child = await planning.createWorkspaceTask("owner-1", { title: "Child", parentTaskId: root.value.id });
  const result = await planning.updateWorkspaceTask("owner-1", root.value.id, { parentTaskId: child.value.id, expectedRevision: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.code, "TASK_CYCLE");
  assert.equal(globalThis.__workspacePlanningStore.state.tasks[0].parentTaskId, null);
});

test("manual task movement swaps siblings and preserves a stable ordering independent of due dates", async () => {
  const earlyDue = await planning.createWorkspaceTask("owner-1", { title: "First", dueAt: "2026-11-20T00:00:00.000Z" });
  const lateDue = await planning.createWorkspaceTask("owner-1", { title: "Second", dueAt: "2026-11-18T00:00:00.000Z" });
  const moved = await planning.moveWorkspaceTask("owner-1", lateDue.value.id, "up");
  assert.equal(moved.ok, true);
  const ordered = [...globalThis.__workspacePlanningStore.state.tasks].sort((left, right) => left.sortOrder - right.sortOrder);
  assert.deepEqual(ordered.map((task) => task.id), [lateDue.value.id, earlyDue.value.id]);
  assert.deepEqual(ordered.map((task) => task.sortOrder), [0, 1]);
  const listed = await planning.listWorkspaceTasks("owner-1");
  assert.deepEqual(listed.map((task) => task.id), [lateDue.value.id, earlyDue.value.id]);
});

test("project list options add server-side status filtering and user-selected stable ordering", async () => {
  const result = await planning.listWorkspaceProjects("owner-1", { status: "ACTIVE", sortBy: "name", direction: "desc" });
  assert.deepEqual(result, []);
  const query = globalThis.__workspacePlanningStore.state.projectQueries[0];
  assert.equal(query.where.status, "ACTIVE");
  assert.deepEqual(query.orderBy, [{ name: "desc" }, { id: "asc" }]);
});

test("task deletion only removes the matching workspace-owned row", async () => {
  const result = await planning.createWorkspaceTask("owner-1", { title: "Delete me" });
  assert.equal((await planning.deleteWorkspaceTask("owner-1", result.value.id)).ok, true);
  assert.equal(globalThis.__workspacePlanningStore.state.tasks.length, 0);
  assert.equal((await planning.deleteWorkspaceTask("owner-1", result.value.id)).ok, false);
});

test("database creation atomically creates its initial Name property and table view", async () => {
  const result = await databases.createWorkspaceDatabase("owner-1", { name: "Reading list" });
  assert.equal(result.ok, true);
  const state = globalThis.__workspacePlanningStore.state;
  assert.equal(state.databases.length, 1);
  assert.equal(state.properties[0].name, "Name");
  assert.equal(state.views[0].type, "TABLE");
});

test("saved view edits persist independent configuration under revision checks and can be deleted", async () => {
  const createdDatabase = await databases.createWorkspaceDatabase("owner-1", { name: "Books" });
  const databaseId = createdDatabase.value.id;
  const propertyId = globalThis.__workspacePlanningStore.state.properties[0].id;
  const createdView = await databases.createWorkspaceDatabaseView("owner-1", databaseId, { name: "Recent", type: "TABLE", configuration: { filters: [], sorts: [{ propertyId, direction: "desc" }] }, sortOrder: 1 });
  const updated = await databases.updateWorkspaceDatabaseView("owner-1", databaseId, createdView.value.id, { name: "Featured", configuration: { filters: [{ propertyId, operator: "contains", value: "guide" }], sorts: [{ propertyId, direction: "asc" }] }, expectedRevision: 0 });
  assert.equal(updated.ok, true);
  assert.equal(updated.value.name, "Featured");
  assert.equal(updated.value.revision, 1);
  assert.equal(updated.value.configuration.filters[0].value, "guide");
  const stale = await databases.updateWorkspaceDatabaseView("owner-1", databaseId, createdView.value.id, { name: "Stale", expectedRevision: 0 });
  assert.equal(stale.ok, false);
  assert.equal(globalThis.__workspacePlanningStore.state.views.find((view) => view.id === createdView.value.id).name, "Featured");
  assert.equal((await databases.deleteWorkspaceDatabaseView("owner-1", databaseId, createdView.value.id)).ok, true);
  assert.equal(globalThis.__workspacePlanningStore.state.views.length, 1);
});

test("failed relation validation rolls back a database record create", async () => {
  const result = await databases.createWorkspaceDatabaseRecord("owner-1", "database-1", { data: { Name: "Book" }, relations: { "missing-relation-property": ["record-foreign"] } });
  assert.equal(result.ok, false);
  assert.equal(globalThis.__workspacePlanningStore.state.records.length, 0);
});

test("database record creation validates values against persisted property definitions", async () => {
  const result = await databases.createWorkspaceDatabaseRecord("owner-1", "database-1", { data: { Name: "Research notes" } });
  assert.equal(result.ok, true);
  assert.equal(globalThis.__workspacePlanningStore.state.records[0].data.Name, "Research notes");
  const invalid = await databases.createWorkspaceDatabaseRecord("owner-1", "database-1", { data: { Unknown: "value" } });
  assert.equal(invalid.ok, false);
  assert.equal(globalThis.__workspacePlanningStore.state.records.length, 1);
});
