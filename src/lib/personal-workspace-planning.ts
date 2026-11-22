import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTimezoneParts, getZonedDayRange, isValidIanaTimezone } from "@/lib/consultations/timezone-core";
import { parseWorkspaceMilestoneInput, parseWorkspaceProjectInput, parseWorkspaceTaskInput } from "@/lib/personal-workspace-planning-core";

type Tx = Prisma.TransactionClient;
type Failure = { ok: false; status: 400 | 404 | 409 | 413; code: string; message: string };
type Result<T = unknown> = { ok: true; value: T } | Failure;
const fail = (message: string, status: 400 | 404 | 409 | 413 = 400, code = "INVALID_REQUEST"): Failure => ({ ok: false, status, code, message });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export async function withWorkspaceTransaction<T>(ownerUserId: string, operation: (tx: Tx, workspaceId: string) => Promise<T>) {
  class AbortWithResult extends Error { readonly result: unknown; constructor(result: unknown) { super("Workspace transaction requested rollback."); this.result = result; } }
  try { return await prisma.$transaction(async (tx) => {
    const workspace = await tx.personalWorkspace.upsert({ where: { userId: ownerUserId }, create: { userId: ownerUserId }, update: {}, select: { id: true } });
    // This shares the page-hierarchy lock namespace, so independent workspace features serialize mutations consistently.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspace.id}), 684512)`;
    const result = await operation(tx, workspace.id);
    if (typeof result === "object" && result !== null && "ok" in result && (result as { ok?: unknown }).ok === false) throw new AbortWithResult(result);
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  catch (error) { if (error instanceof AbortWithResult) return error.result as T; throw error; }
}

const taskSelect = {
  id: true, title: true, description: true, status: true, priority: true, startsAt: true, dueAt: true, completedAt: true,
  archivedAt: true, notes: true, recurrenceRule: true, parentTaskId: true, projectId: true, pageId: true, sortOrder: true,
  revision: true, createdAt: true, updatedAt: true,
  labels: { select: { tag: { select: { id: true, name: true, color: true } } } },
  project: { select: { id: true, name: true, status: true } },
} satisfies Prisma.WorkspaceTaskSelect;

function safeTask<T extends { labels?: Array<{ tag: { id: string; name: string; color: string | null } }> }>(task: T) {
  return { ...task, labels: task.labels?.map((item) => item.tag) ?? [] };
}

export type TaskListOptions = { q?: string; status?: string; bucket?: "overdue" | "today" | "upcoming" | "completed"; projectId?: string; archived?: boolean; limit?: number; now?: Date };

export async function getWorkspacePlanningSummary(ownerUserId: string) {
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true, timezone: true } });
  if (!workspace) return { openTasks: 0, overdueTasks: 0, dueToday: 0, upcomingDeadlines: 0, activeProjects: [], databases: 0, recentDatabases: [] };
  const timezone = isValidIanaTimezone(workspace.timezone) ? workspace.timezone : "Africa/Nairobi";
  const now = new Date(); const parts = getTimezoneParts(now, timezone); const dayKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`; const futureDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 7)); const futureKey = `${futureDate.getUTCFullYear()}-${String(futureDate.getUTCMonth() + 1).padStart(2, "0")}-${String(futureDate.getUTCDate()).padStart(2, "0")}`; const today = getZonedDayRange(dayKey, timezone); const future = getZonedDayRange(futureKey, timezone);
  const [openTasks, overdueTasks, dueToday, upcomingDeadlines, projectRows, databases, recentDatabases] = await Promise.all([
    prisma.workspaceTask.count({ where: { workspaceId: workspace.id, archivedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    prisma.workspaceTask.count({ where: { workspaceId: workspace.id, archivedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] }, dueAt: { lt: now } } }),
    prisma.workspaceTask.count({ where: { workspaceId: workspace.id, archivedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] }, dueAt: { gte: today.startDate, lt: today.endDate } } }),
    prisma.workspaceTask.count({ where: { workspaceId: workspace.id, archivedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] }, dueAt: { gte: today.endDate, lt: future.endDate } } }),
    prisma.workspaceProject.findMany({ where: { workspaceId: workspace.id, archivedAt: null, status: "ACTIVE" }, take: 3, orderBy: [{ targetAt: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }, { id: "asc" }], select: projectSelect }),
    prisma.workspaceDatabase.count({ where: { workspaceId: workspace.id, archivedAt: null } }),
    prisma.workspaceDatabase.findMany({ where: { workspaceId: workspace.id, archivedAt: null }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 3, select: { id: true, name: true, updatedAt: true } }),
  ]);
  const projectIds = projectRows.map((project) => project.id);
  const [taskCounts, completedTaskCounts, milestoneCounts, completedMilestoneCounts] = projectIds.length ? await Promise.all([
    prisma.workspaceTask.groupBy({ by: ["projectId"], where: { workspaceId: workspace.id, projectId: { in: projectIds }, archivedAt: null }, _count: { _all: true } }),
    prisma.workspaceTask.groupBy({ by: ["projectId"], where: { workspaceId: workspace.id, projectId: { in: projectIds }, archivedAt: null, status: "COMPLETED" }, _count: { _all: true } }),
    prisma.workspaceProjectMilestone.groupBy({ by: ["projectId"], where: { workspaceId: workspace.id, projectId: { in: projectIds } }, _count: { _all: true } }),
    prisma.workspaceProjectMilestone.groupBy({ by: ["projectId"], where: { workspaceId: workspace.id, projectId: { in: projectIds }, completedAt: { not: null } }, _count: { _all: true } }),
  ]) : [[], [], [], []];
  const countMap = (rows: Array<{ projectId: string | null; _count: { _all: number } }>) => new Map(rows.filter((row) => row.projectId !== null).map((row) => [row.projectId!, row._count._all]));
  const taskCount = countMap(taskCounts); const taskComplete = countMap(completedTaskCounts); const milestoneCount = countMap(milestoneCounts); const milestoneComplete = countMap(completedMilestoneCounts);
  const activeProjects = projectRows.map((project) => ({ ...project, progress: { taskCount: taskCount.get(project.id) ?? 0, completedTasks: taskComplete.get(project.id) ?? 0, milestoneCount: milestoneCount.get(project.id) ?? 0, completedMilestones: milestoneComplete.get(project.id) ?? 0 } }));
  return { openTasks, overdueTasks, dueToday, upcomingDeadlines, activeProjects, databases, recentDatabases };
}

export async function listWorkspaceTasks(ownerUserId: string, options: TaskListOptions = {}) {
  const limit = Math.max(1, Math.min(200, Number.isInteger(options.limit) ? options.limit! : 100));
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true, timezone: true } });
  if (!workspace) return [];
  const now = options.now ?? new Date();
  const where: Prisma.WorkspaceTaskWhereInput = { workspaceId: workspace.id };
  if (options.bucket === "completed") where.status = "COMPLETED";
  where.archivedAt = options.archived ? { not: null } : null;
  if (options.projectId) where.projectId = options.projectId;
  if (options.status && (options.status === "INBOX" || options.status === "TODO" || options.status === "IN_PROGRESS" || options.status === "BLOCKED" || options.status === "COMPLETED" || options.status === "CANCELLED")) where.status = options.status;
  if (options.q?.trim()) where.OR = [{ title: { contains: options.q.trim().slice(0, 100), mode: "insensitive" } }, { description: { contains: options.q.trim().slice(0, 100), mode: "insensitive" } }, { notes: { contains: options.q.trim().slice(0, 100), mode: "insensitive" } }];
  if (options.bucket === "overdue") where.dueAt = { lt: now };
  if (options.bucket === "today" || options.bucket === "upcoming") {
    const parts = getTimezoneParts(now, workspace.timezone);
    const day = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    const range = getZonedDayRange(day, workspace.timezone);
    where.dueAt = options.bucket === "today" ? { gte: range.startDate, lt: range.endDate } : { gte: range.endDate };
  }
  return (await prisma.workspaceTask.findMany({ where, take: limit, orderBy: [{ sortOrder: "asc" }, { dueAt: { sort: "asc", nulls: "last" } }, { id: "asc" }], select: taskSelect })).map(safeTask);
}

async function validateTaskRelations(tx: Tx, workspaceId: string, input: { parentTaskId?: string | null; projectId?: string | null; pageId?: string | null }, taskId?: string) {
  let inheritedProjectId: string | null | undefined;
  if (input.parentTaskId) {
    if (input.parentTaskId === taskId) return fail("A task cannot be its own parent.", 400, "TASK_CYCLE");
    const parent = await tx.workspaceTask.findFirst({ where: { id: input.parentTaskId, workspaceId }, select: { id: true, parentTaskId: true, projectId: true } });
    if (!parent) return fail("Parent task was not found in this workspace.", 404, "TASK_PARENT_NOT_FOUND");
    inheritedProjectId = parent.projectId;
    const all = await tx.workspaceTask.findMany({ where: { workspaceId }, select: { id: true, parentTaskId: true }, take: 2001 });
    if (all.length > 2000) return fail("Task hierarchy is too large to validate safely.", 413, "TASK_HIERARCHY_LIMIT");
    const byId = new Map(all.map((row) => [row.id, row.parentTaskId]));
    const seen = new Set<string>();
    let cursor: string | null = input.parentTaskId;
    while (cursor) {
      if (cursor === taskId || seen.has(cursor)) return fail("This parent would create a task cycle.", 400, "TASK_CYCLE");
      seen.add(cursor);
      cursor = byId.get(cursor) ?? null;
    }
  }
  const projectId = input.projectId === undefined ? inheritedProjectId : input.projectId;
  if (projectId) {
    const project = await tx.workspaceProject.findFirst({ where: { id: projectId, workspaceId, archivedAt: null }, select: { id: true } });
    if (!project) return fail("Project was not found in this workspace.", 404, "PROJECT_NOT_FOUND");
  }
  if (input.pageId) {
    const page = await tx.workspacePage.findFirst({ where: { id: input.pageId, workspaceId, deletedAt: null }, select: { id: true } });
    if (!page) return fail("Workspace page was not found.", 404, "PAGE_NOT_FOUND");
  }
  return { ok: true as const, projectId };
}

async function setTaskLabels(tx: Tx, workspaceId: string, taskId: string, labels: string[]) {
  await tx.workspaceTaskLabel.deleteMany({ where: { workspaceId, taskId } });
  for (const name of labels) {
    const tag = await tx.workspaceTaskTag.upsert({ where: { workspaceId_name: { workspaceId, name } }, create: { workspaceId, name }, update: {}, select: { id: true } });
    await tx.workspaceTaskLabel.create({ data: { workspaceId, taskId, tagId: tag.id } });
  }
}

export async function createWorkspaceTask(ownerUserId: string, input: unknown) {
  const parsed = parseWorkspaceTaskInput(input);
  if (!parsed.success) return fail(parsed.message);
  try {
    return await withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
      const relation = await validateTaskRelations(tx, workspaceId, parsed.value);
      if (!relation.ok) return relation;
      const siblings = await tx.workspaceTask.aggregate({ where: { workspaceId, parentTaskId: parsed.value.parentTaskId ?? null }, _max: { sortOrder: true } });
      const { labels = [] } = parsed.value;
      const status = parsed.value.status ?? "INBOX";
      const created = await tx.workspaceTask.create({ data: {
        workspaceId, title: parsed.value.title!, description: parsed.value.description ?? null, status,
        priority: parsed.value.priority ?? "NORMAL", startsAt: parsed.value.startsAt ?? null, dueAt: parsed.value.dueAt ?? null,
        completedAt: status === "COMPLETED" ? new Date() : null, parentTaskId: parsed.value.parentTaskId ?? null,
        projectId: relation.projectId ?? null, pageId: parsed.value.pageId ?? null, notes: parsed.value.notes ?? null,
        recurrenceRule: parsed.value.recurrenceRule ?? null, sortOrder: (siblings._max.sortOrder ?? -1) + 1,
      }, select: taskSelect });
      if (labels.length) await setTaskLabels(tx, workspaceId, created.id, labels);
      const saved = await tx.workspaceTask.findFirstOrThrow({ where: { id: created.id, workspaceId }, select: taskSelect });
      return ok(safeTask(saved));
    });
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail("Task ordering changed concurrently. Please retry.", 409, "TASK_ORDER_CONFLICT"); throw error; }
}

export async function updateWorkspaceTask(ownerUserId: string, taskId: string, input: unknown) {
  const parsed = parseWorkspaceTaskInput(input, true);
  if (!parsed.success) return fail(parsed.message);
  if (parsed.value.expectedRevision === undefined) return fail("Expected task revision is required.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const current = await tx.workspaceTask.findFirst({ where: { id: taskId, workspaceId }, select: { revision: true, status: true, parentTaskId: true, projectId: true, sortOrder: true } });
    if (!current) return fail("Task not found.", 404, "NOT_FOUND");
    if (current.revision !== parsed.value.expectedRevision) return fail("Task changed elsewhere. Reload before saving.", 409, "REVISION_CONFLICT");
    const relation = await validateTaskRelations(tx, workspaceId, { parentTaskId: parsed.value.parentTaskId === undefined ? current.parentTaskId : parsed.value.parentTaskId, projectId: parsed.value.projectId === undefined ? current.projectId : parsed.value.projectId, pageId: parsed.value.pageId }, taskId);
    if (!relation.ok) return relation;
    if (parsed.value.parentTaskId !== undefined && parsed.value.parentTaskId !== current.parentTaskId) {
      const siblings = await tx.workspaceTask.aggregate({ where: { workspaceId, parentTaskId: parsed.value.parentTaskId }, _max: { sortOrder: true } });
      current.sortOrder = (siblings._max.sortOrder ?? -1) + 1;
    }
    const { expectedRevision, labels, archived, ...fields } = parsed.value;
    const status = fields.status ?? current.status;
    const completedAt = status === "COMPLETED" ? undefined : null;
    const changed = await tx.workspaceTask.updateMany({ where: { id: taskId, workspaceId, revision: expectedRevision }, data: { ...fields, ...(parsed.value.projectId !== undefined || parsed.value.parentTaskId !== undefined ? { projectId: relation.projectId ?? null } : {}), ...(parsed.value.parentTaskId !== undefined ? { sortOrder: current.sortOrder } : {}), ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}), ...(status === "COMPLETED" && current.status !== "COMPLETED" ? { completedAt: new Date() } : completedAt !== undefined ? { completedAt } : {}), revision: { increment: 1 } } });
    if (changed.count !== 1) return fail("Task changed elsewhere. Reload before saving.", 409, "REVISION_CONFLICT");
    if (labels !== undefined) await setTaskLabels(tx, workspaceId, taskId, labels);
    return ok(safeTask(await tx.workspaceTask.findFirstOrThrow({ where: { id: taskId, workspaceId }, select: taskSelect })));
  });
}

export async function deleteWorkspaceTask(ownerUserId: string, taskId: string) {
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const deleted = await tx.workspaceTask.deleteMany({ where: { id: taskId, workspaceId } });
    return deleted.count ? ok({ deleted: true }) : fail("Task not found.", 404, "NOT_FOUND");
  });
}

export async function reorderWorkspaceTasks(ownerUserId: string, input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail("Task order is invalid.");
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["parentTaskId", "taskIds"].includes(key)) || (body.parentTaskId !== null && typeof body.parentTaskId !== "string") || !Array.isArray(body.taskIds) || body.taskIds.length > 200 || !body.taskIds.every((id) => typeof id === "string") || new Set(body.taskIds).size !== body.taskIds.length) return fail("Task order is invalid.");
  const taskIds = body.taskIds as string[];
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const parentTaskId = body.parentTaskId as string | null;
    if (parentTaskId && !(await tx.workspaceTask.findFirst({ where: { id: parentTaskId, workspaceId }, select: { id: true } }))) return fail("Parent task not found.", 404, "NOT_FOUND");
    const siblings = await tx.workspaceTask.findMany({ where: { workspaceId, parentTaskId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, sortOrder: true } });
    if (siblings.length !== taskIds.length || siblings.some((row) => !taskIds.includes(row.id))) return fail("Reorder must include every sibling task exactly once.");
    const offset = Math.max(0, ...siblings.map((row) => row.sortOrder)) + siblings.length + 10;
    for (const row of siblings) await tx.workspaceTask.update({ where: { id: row.id }, data: { sortOrder: row.sortOrder + offset } });
    for (const [sortOrder, id] of taskIds.entries()) await tx.workspaceTask.update({ where: { id }, data: { sortOrder, revision: { increment: 1 } } });
    return ok(await tx.workspaceTask.findMany({ where: { workspaceId, parentTaskId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: taskSelect }).then((rows) => rows.map(safeTask)));
  });
}

export async function moveWorkspaceTask(ownerUserId: string, taskId: string, direction: "up" | "down") {
  if (direction !== "up" && direction !== "down") return fail("Task movement is invalid.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const task = await tx.workspaceTask.findFirst({ where: { id: taskId, workspaceId }, select: { id: true, parentTaskId: true } });
    if (!task) return fail("Task not found.", 404, "NOT_FOUND");
    const siblings = await tx.workspaceTask.findMany({ where: { workspaceId, parentTaskId: task.parentTaskId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, sortOrder: true } });
    const currentIndex = siblings.findIndex((sibling) => sibling.id === taskId);
    const nextIndex = currentIndex + (direction === "up" ? -1 : 1);
    if (currentIndex < 0) return fail("Task ordering changed. Reload and try again.", 409, "TASK_ORDER_CONFLICT");
    if (nextIndex < 0 || nextIndex >= siblings.length) return ok(await tx.workspaceTask.findMany({ where: { workspaceId, parentTaskId: task.parentTaskId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: taskSelect }).then((rows) => rows.map(safeTask)));
    const reordered = siblings.map(({ id }) => id);
    [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
    const offset = Math.max(0, ...siblings.map((sibling) => sibling.sortOrder)) + siblings.length + 10;
    for (const sibling of siblings) await tx.workspaceTask.update({ where: { id: sibling.id, workspaceId }, data: { sortOrder: sibling.sortOrder + offset } });
    for (const [sortOrder, id] of reordered.entries()) await tx.workspaceTask.update({ where: { id, workspaceId }, data: { sortOrder, revision: { increment: 1 } } });
    return ok(await tx.workspaceTask.findMany({ where: { workspaceId, parentTaskId: task.parentTaskId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: taskSelect }).then((rows) => rows.map(safeTask)));
  });
}

const projectSelect = { id: true, name: true, description: true, status: true, priority: true, startsAt: true, targetAt: true, archivedAt: true, revision: true, createdAt: true, updatedAt: true } satisfies Prisma.WorkspaceProjectSelect;
const milestoneSelect = { id: true, projectId: true, title: true, description: true, targetAt: true, completedAt: true, sortOrder: true, revision: true, createdAt: true, updatedAt: true } satisfies Prisma.WorkspaceProjectMilestoneSelect;

export async function listWorkspaceProjects(ownerUserId: string, options: { q?: string; archived?: boolean; status?: "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED"; sortBy?: "targetAt" | "name" | "updatedAt"; direction?: "asc" | "desc" } = {}) {
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true } });
  if (!workspace) return [];
  const where: Prisma.WorkspaceProjectWhereInput = { workspaceId: workspace.id, archivedAt: options.archived ? { not: null } : null };
  if (options.status) where.status = options.status;
  if (options.q?.trim()) where.OR = [{ name: { contains: options.q.trim().slice(0, 100), mode: "insensitive" } }, { description: { contains: options.q.trim().slice(0, 100), mode: "insensitive" } }];
  const sortBy = options.sortBy ?? "targetAt";
  const direction = options.direction ?? (sortBy === "updatedAt" ? "desc" : "asc");
  const orderBy: Prisma.WorkspaceProjectOrderByWithRelationInput[] = sortBy === "targetAt"
    ? [{ targetAt: { sort: direction, nulls: "last" } }, { updatedAt: "desc" }, { id: "asc" }]
    : [{ [sortBy]: direction }, { id: "asc" }];
  const projects = await prisma.workspaceProject.findMany({ where, take: 100, orderBy, select: { ...projectSelect, milestones: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: milestoneSelect, take: 100 } } });
  const ids = projects.map((project) => project.id);
  if (!ids.length) return [];
  const [tasks, doneTasks, milestones, doneMilestones] = await Promise.all([
    prisma.workspaceTask.groupBy({ by: ["projectId"], where: { workspaceId: workspace.id, projectId: { in: ids }, archivedAt: null }, _count: { _all: true } }),
    prisma.workspaceTask.groupBy({ by: ["projectId"], where: { workspaceId: workspace.id, projectId: { in: ids }, archivedAt: null, status: "COMPLETED" }, _count: { _all: true } }),
    prisma.workspaceProjectMilestone.groupBy({ by: ["projectId"], where: { workspaceId: workspace.id, projectId: { in: ids } }, _count: { _all: true } }),
    prisma.workspaceProjectMilestone.groupBy({ by: ["projectId"], where: { workspaceId: workspace.id, projectId: { in: ids }, completedAt: { not: null } }, _count: { _all: true } }),
  ]);
  const map = (rows: Array<{ projectId: string | null; _count: { _all: number } }>) => new Map(rows.filter((row): row is typeof row & { projectId: string } => row.projectId !== null).map((row) => [row.projectId, row._count._all]));
  const taskCount = map(tasks); const taskDone = map(doneTasks); const milestoneCount = map(milestones); const milestoneDone = map(doneMilestones);
  return projects.map((project) => ({ ...project, progress: { completedTasks: taskDone.get(project.id) ?? 0, taskCount: taskCount.get(project.id) ?? 0, completedMilestones: milestoneDone.get(project.id) ?? 0, milestoneCount: milestoneCount.get(project.id) ?? 0 } }));
}

export async function getWorkspaceProject(ownerUserId: string, projectId: string) {
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true } });
  if (!workspace) return null;
  const project = await prisma.workspaceProject.findFirst({ where: { id: projectId, workspaceId: workspace.id }, select: { ...projectSelect, milestones: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: milestoneSelect, take: 100 } } });
  if (!project) return null;
  const tasks = await listWorkspaceTasks(ownerUserId, { projectId, limit: 200, archived: false });
  return { ...project, tasks };
}

export async function createWorkspaceProject(ownerUserId: string, input: unknown) {
  const parsed = parseWorkspaceProjectInput(input);
  if (!parsed.success) return fail(parsed.message);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => ok(await tx.workspaceProject.create({ data: { workspaceId, name: parsed.value.name!, description: parsed.value.description ?? null, status: parsed.value.status ?? "PLANNED", priority: parsed.value.priority ?? "NORMAL", startsAt: parsed.value.startsAt ?? null, targetAt: parsed.value.targetAt ?? null }, select: projectSelect })));
}

export async function updateWorkspaceProject(ownerUserId: string, projectId: string, input: unknown) {
  const parsed = parseWorkspaceProjectInput(input, true);
  if (!parsed.success) return fail(parsed.message);
  if (parsed.value.expectedRevision === undefined) return fail("Expected project revision is required.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const { expectedRevision, archived, ...data } = parsed.value;
    const changed = await tx.workspaceProject.updateMany({ where: { workspaceId, id: projectId, revision: expectedRevision }, data: { ...data, ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}), revision: { increment: 1 } } });
    if (changed.count !== 1) return fail("Project not found or changed elsewhere.", 409, "REVISION_CONFLICT");
    return ok(await tx.workspaceProject.findFirstOrThrow({ where: { workspaceId, id: projectId }, select: projectSelect }));
  });
}

export async function addWorkspaceMilestone(ownerUserId: string, projectId: string, input: unknown) {
  const parsed = parseWorkspaceMilestoneInput(input);
  if (!parsed.success) return fail(parsed.message);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const project = await tx.workspaceProject.findFirst({ where: { id: projectId, workspaceId, archivedAt: null }, select: { id: true } });
    if (!project) return fail("Project not found.", 404, "NOT_FOUND");
    const aggregate = await tx.workspaceProjectMilestone.aggregate({ where: { workspaceId, projectId }, _max: { sortOrder: true } });
    return ok(await tx.workspaceProjectMilestone.create({ data: { workspaceId, projectId, title: parsed.value.title!, description: parsed.value.description ?? null, targetAt: parsed.value.targetAt ?? null, ...(parsed.value.completed ? { completedAt: new Date() } : {}), sortOrder: (aggregate._max.sortOrder ?? -1) + 1 }, select: milestoneSelect }));
  });
}

export async function updateWorkspaceMilestone(ownerUserId: string, milestoneId: string, input: unknown) {
  const parsed = parseWorkspaceMilestoneInput(input, true);
  if (!parsed.success) return fail(parsed.message);
  if (parsed.value.expectedRevision === undefined) return fail("Expected milestone revision is required.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const { expectedRevision, completed, ...data } = parsed.value;
    const changed = await tx.workspaceProjectMilestone.updateMany({ where: { workspaceId, id: milestoneId, revision: expectedRevision }, data: { ...data, ...(completed !== undefined ? { completedAt: completed ? new Date() : null } : {}), revision: { increment: 1 } } });
    if (changed.count !== 1) return fail("Milestone not found or changed elsewhere.", 409, "REVISION_CONFLICT");
    return ok(await tx.workspaceProjectMilestone.findFirstOrThrow({ where: { workspaceId, id: milestoneId }, select: milestoneSelect }));
  });
}
