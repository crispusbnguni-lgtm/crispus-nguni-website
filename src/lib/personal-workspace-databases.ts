import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseWorkspaceDatabasePropertyInput, parseWorkspaceDatabaseViewInput, validateWorkspaceDatabaseValues } from "@/lib/personal-workspace-planning-core";
import { withWorkspaceTransaction } from "@/lib/personal-workspace-planning";

type Result<T = unknown> = { ok: true; value: T } | { ok: false; status: 400 | 404 | 409 | 413; code: string; message: string };
const fail = (message: string, status: 400 | 404 | 409 | 413 = 400, code = "INVALID_REQUEST"): Result<never> => ({ ok: false, status, code, message });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const databaseSelect = { id: true, name: true, description: true, archivedAt: true, revision: true, createdAt: true, updatedAt: true } satisfies Prisma.WorkspaceDatabaseSelect;
const propertySelect = { id: true, databaseId: true, name: true, type: true, options: true, sortOrder: true, revision: true, createdAt: true, updatedAt: true } satisfies Prisma.WorkspaceDatabasePropertySelect;
const viewSelect = { id: true, databaseId: true, name: true, type: true, configuration: true, sortOrder: true, revision: true, createdAt: true, updatedAt: true } satisfies Prisma.WorkspaceDatabaseViewSelect;

function plain(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function prismaJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject { return typeof value === "object" && value !== null && !Array.isArray(value); }

export async function listWorkspaceDatabases(ownerUserId: string, includeArchived = false) {
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true } });
  if (!workspace) return [];
  const databases = await prisma.workspaceDatabase.findMany({ where: { workspaceId: workspace.id, archivedAt: includeArchived ? { not: null } : null }, take: 100, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], select: { ...databaseSelect, properties: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: propertySelect, take: 100 }, views: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: viewSelect, take: 50 } } });
  const ids = databases.map((database) => database.id);
  const counts = ids.length ? await prisma.workspaceDatabaseRecord.groupBy({ by: ["databaseId"], where: { workspaceId: workspace.id, databaseId: { in: ids }, archivedAt: null }, _count: { _all: true } }) : [];
  const countMap = new Map(counts.map((row) => [row.databaseId, row._count._all]));
  return databases.map((database) => ({ ...database, recordCount: countMap.get(database.id) ?? 0 }));
}

export async function createWorkspaceDatabase(ownerUserId: string, input: unknown) {
  if (!plain(input) || Object.keys(input).some((key) => !["name", "description"].includes(key)) || typeof input.name !== "string" || !input.name.trim() || input.name.length > 120 || (input.description !== undefined && input.description !== null && (typeof input.description !== "string" || input.description.length > 4_000))) return fail("Database name or description is invalid.");
  const name = input.name.trim();
  const description = input.description as string | null | undefined;
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const database = await tx.workspaceDatabase.create({ data: { workspaceId, name, description }, select: databaseSelect });
    await tx.workspaceDatabaseProperty.create({ data: { workspaceId, databaseId: database.id, name: "Name", type: "TEXT", sortOrder: 0 }, select: { id: true } });
    await tx.workspaceDatabaseView.create({ data: { workspaceId, databaseId: database.id, name: "All records", type: "TABLE", sortOrder: 0, configuration: {} }, select: { id: true } });
    return ok(database);
  });
}

export async function updateWorkspaceDatabase(ownerUserId: string, databaseId: string, input: unknown) {
  if (!plain(input) || Object.keys(input).some((key) => !["name", "description", "archived", "expectedRevision"].includes(key)) || !Number.isInteger(input.expectedRevision) || (input.expectedRevision as number) < 0) return fail("Database update is invalid.");
  if (input.name !== undefined && (typeof input.name !== "string" || !input.name.trim() || input.name.length > 120)) return fail("Database name is invalid.");
  if (input.description !== undefined && input.description !== null && (typeof input.description !== "string" || input.description.length > 4_000)) return fail("Database description is invalid.");
  if (input.archived !== undefined && typeof input.archived !== "boolean") return fail("Database archive state is invalid.");
  const name = input.name as string | undefined;
  const description = input.description as string | null | undefined;
  const archived = input.archived as boolean | undefined;
  const expectedRevision = input.expectedRevision as number;
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const changed = await tx.workspaceDatabase.updateMany({ where: { workspaceId, id: databaseId, revision: expectedRevision }, data: { ...(name !== undefined ? { name: name.trim() } : {}), ...(description !== undefined ? { description } : {}), ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}), revision: { increment: 1 } } });
    if (changed.count !== 1) return fail("Database not found or changed elsewhere.", 409, "REVISION_CONFLICT");
    return ok(await tx.workspaceDatabase.findFirstOrThrow({ where: { id: databaseId, workspaceId }, select: databaseSelect }));
  });
}

export async function deleteWorkspaceDatabase(ownerUserId: string, databaseId: string) {
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const result = await tx.workspaceDatabase.deleteMany({ where: { workspaceId, id: databaseId } });
    return result.count ? ok({ deleted: true }) : fail("Database not found.", 404, "NOT_FOUND");
  });
}

export async function duplicateWorkspaceDatabase(ownerUserId: string, databaseId: string) {
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const source = await tx.workspaceDatabase.findFirst({ where: { id: databaseId, workspaceId }, select: { ...databaseSelect, properties: { orderBy: { sortOrder: "asc" }, select: propertySelect }, views: { orderBy: { sortOrder: "asc" }, select: viewSelect }, records: { orderBy: { sortOrder: "asc" }, select: { id: true, data: true, sortOrder: true }, take: 1001 } } });
    if (!source) return fail("Database not found.", 404, "NOT_FOUND");
    if (source.records.length > 1000) return fail("This database is too large to duplicate in one request.", 413, "DUPLICATE_LIMIT");
    const copy = await tx.workspaceDatabase.create({ data: { workspaceId, name: `${source.name} copy`.slice(0, 120), description: source.description }, select: databaseSelect });
    const propertyIds = new Map<string, string>();
    for (const property of source.properties) {
      const options = property.type === "RELATION" && plain(property.options) && property.options.targetDatabaseId === databaseId ? { ...property.options, targetDatabaseId: copy.id } : property.options;
      const made = await tx.workspaceDatabaseProperty.create({ data: { workspaceId, databaseId: copy.id, name: property.name, type: property.type, options: options as Prisma.InputJsonValue, sortOrder: property.sortOrder }, select: { id: true } });
      propertyIds.set(property.id, made.id);
    }
    const recordIds = new Map<string, string>();
    for (const record of source.records) {
      const made = await tx.workspaceDatabaseRecord.create({ data: { workspaceId, databaseId: copy.id, data: record.data as Prisma.InputJsonValue, sortOrder: record.sortOrder }, select: { id: true } });
      recordIds.set(record.id, made.id);
    }
    const relations = await tx.workspaceDatabaseRelation.findMany({ where: { workspaceId, sourceDatabaseId: databaseId }, select: { sourceRecordId: true, propertyId: true, targetDatabaseId: true, targetRecordId: true } });
    for (const relation of relations) {
      const sourceRecordId = recordIds.get(relation.sourceRecordId);
      const propertyId = propertyIds.get(relation.propertyId);
      if (!sourceRecordId || !propertyId) continue;
      const targetRecordId = relation.targetDatabaseId === databaseId ? recordIds.get(relation.targetRecordId) : relation.targetRecordId;
      const targetDatabaseId = relation.targetDatabaseId === databaseId ? copy.id : relation.targetDatabaseId;
      if (targetRecordId) await tx.workspaceDatabaseRelation.create({ data: { workspaceId, sourceDatabaseId: copy.id, sourceRecordId, propertyId, targetDatabaseId, targetRecordId } });
    }
    for (const view of source.views) {
      const config = plain(view.configuration) ? structuredClone(view.configuration) : {};
      if (typeof config.groupBy === "string") config.groupBy = propertyIds.get(config.groupBy) ?? config.groupBy;
      if (Array.isArray(config.filters)) config.filters = config.filters.map((filter) => plain(filter) && typeof filter.propertyId === "string" ? { ...filter, propertyId: propertyIds.get(filter.propertyId) ?? filter.propertyId } : filter);
      if (Array.isArray(config.sorts)) config.sorts = config.sorts.map((sort) => plain(sort) && typeof sort.propertyId === "string" ? { ...sort, propertyId: propertyIds.get(sort.propertyId) ?? sort.propertyId } : sort);
      await tx.workspaceDatabaseView.create({ data: { workspaceId, databaseId: copy.id, name: view.name, type: view.type, configuration: config as Prisma.InputJsonValue, sortOrder: view.sortOrder } });
    }
    return ok({ ...copy, propertyCount: source.properties.length, recordCount: source.records.length, viewCount: source.views.length });
  });
}

export async function createWorkspaceDatabaseProperty(ownerUserId: string, databaseId: string, input: unknown) {
  const parsed = parseWorkspaceDatabasePropertyInput(input);
  if (!parsed.success) return fail(parsed.message);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const database = await tx.workspaceDatabase.findFirst({ where: { id: databaseId, workspaceId, archivedAt: null }, select: { id: true } });
    if (!database) return fail("Database not found.", 404, "NOT_FOUND");
    const property = { ...parsed.value, name: parsed.value.name!, type: parsed.value.type!, options: parsed.value.options ?? {}, sortOrder: parsed.value.sortOrder ?? 0 };
    if (property.type === "RELATION") {
      const target = await tx.workspaceDatabase.findFirst({ where: { id: property.options.targetDatabaseId as string, workspaceId, archivedAt: null }, select: { id: true } });
      if (!target) return fail("Relation target database was not found in this workspace.", 404, "RELATION_TARGET_NOT_FOUND");
    }
    return ok(await tx.workspaceDatabaseProperty.create({ data: { workspaceId, databaseId, ...property, options: property.options as Prisma.InputJsonValue }, select: propertySelect }));
  });
}

export async function updateWorkspaceDatabaseProperty(ownerUserId: string, databaseId: string, propertyId: string, input: unknown) {
  const parsed = parseWorkspaceDatabasePropertyInput(input, true);
  if (!parsed.success) return fail(parsed.message);
  if (parsed.value.expectedRevision === undefined) return fail("Expected property revision is required.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const current = await tx.workspaceDatabaseProperty.findFirst({ where: { id: propertyId, databaseId, workspaceId }, select: { id: true, name: true, type: true, options: true, sortOrder: true, revision: true } });
    if (!current) return fail("Property not found.", 404, "NOT_FOUND");
    if (current.revision !== parsed.value.expectedRevision) return fail("Property changed elsewhere.", 409, "REVISION_CONFLICT");
    const effective = parseWorkspaceDatabasePropertyInput({ name: parsed.value.name ?? current.name, type: parsed.value.type ?? current.type, options: parsed.value.options ?? (plain(current.options) ? current.options : {}), sortOrder: parsed.value.sortOrder ?? current.sortOrder }, false);
    if (!effective.success) return fail(effective.message);
    const effectiveValue = { ...effective.value, name: effective.value.name!, type: effective.value.type!, options: effective.value.options ?? {}, sortOrder: effective.value.sortOrder ?? current.sortOrder };
    if (effectiveValue.type === "RELATION") {
      const target = await tx.workspaceDatabase.findFirst({ where: { id: effectiveValue.options.targetDatabaseId as string, workspaceId, archivedAt: null }, select: { id: true } });
      if (!target) return fail("Relation target database was not found in this workspace.", 404, "RELATION_TARGET_NOT_FOUND");
    }
    const newName = effectiveValue.name;
    const [valueState] = await tx.$queryRaw<Array<{ hasValues: boolean; renameConflict: boolean }>>`SELECT
      EXISTS (SELECT 1 FROM "WorkspaceDatabaseRecord" WHERE "workspaceId" = ${workspaceId} AND "databaseId" = ${databaseId} AND "data" ? ${current.name}) AS "hasValues",
      EXISTS (SELECT 1 FROM "WorkspaceDatabaseRecord" WHERE "workspaceId" = ${workspaceId} AND "databaseId" = ${databaseId} AND ${newName !== current.name} AND "data" ? ${newName}) AS "renameConflict"`;
    const hasValues = valueState?.hasValues ?? false;
    if (newName !== current.name && valueState?.renameConflict) return fail("A record already contains a value under the new property name.", 409, "PROPERTY_RENAME_CONFLICT");
    if ((parsed.value.type !== undefined && parsed.value.type !== current.type && hasValues) && !parsed.value.clearExistingValues) return fail("Type changes with existing values require explicit clearExistingValues confirmation.", 409, "PROPERTY_VALUES_EXIST");
    if (parsed.value.clearExistingValues || newName !== current.name) {
      const preserveRenameValue = newName !== current.name && !parsed.value.clearExistingValues;
      await tx.$executeRaw`UPDATE "WorkspaceDatabaseRecord" SET "data" = CASE WHEN "data" ? ${current.name} THEN ("data" - ${current.name}) || CASE WHEN ${preserveRenameValue} THEN jsonb_build_object(${newName}, "data" -> ${current.name}) ELSE '{}'::jsonb END ELSE "data" END, "revision" = "revision" + 1 WHERE "workspaceId" = ${workspaceId} AND "databaseId" = ${databaseId}`;
    }
    if (current.type === "RELATION" && effectiveValue.type !== "RELATION") await tx.workspaceDatabaseRelation.deleteMany({ where: { workspaceId, sourceDatabaseId: databaseId, propertyId } });
    const changed = await tx.workspaceDatabaseProperty.updateMany({ where: { workspaceId, databaseId, id: propertyId, revision: parsed.value.expectedRevision }, data: { ...effectiveValue, options: effectiveValue.options as Prisma.InputJsonValue, revision: { increment: 1 } } });
    if (changed.count !== 1) return fail("Property changed elsewhere.", 409, "REVISION_CONFLICT");
    return ok(await tx.workspaceDatabaseProperty.findFirstOrThrow({ where: { workspaceId, databaseId, id: propertyId }, select: propertySelect }));
  });
}

export async function deleteWorkspaceDatabaseProperty(ownerUserId: string, databaseId: string, propertyId: string) {
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const property = await tx.workspaceDatabaseProperty.findFirst({ where: { id: propertyId, databaseId, workspaceId }, select: { name: true } });
    if (!property) return fail("Property not found.", 404, "NOT_FOUND");
    await tx.$executeRaw`UPDATE "WorkspaceDatabaseRecord" SET "data" = "data" - ${property.name}, "revision" = "revision" + 1 WHERE "workspaceId" = ${workspaceId} AND "databaseId" = ${databaseId}`;
    await tx.workspaceDatabaseProperty.delete({ where: { workspaceId_databaseId_id: { workspaceId, databaseId, id: propertyId } } });
    return ok({ deleted: true });
  });
}

type RecordInput = { data: Record<string, unknown>; dataProvided: boolean; relations: Record<string, string[]> };
function parseRecordInput(input: unknown, partial: boolean): { success: true; value: RecordInput & { expectedRevision?: number; archived?: boolean } } | { success: false; message: string } {
  if (!plain(input) || Object.keys(input).some((key) => !["data", "relations", "expectedRevision", "archived"].includes(key))) return { success: false, message: "Record fields are invalid." };
  if ((!partial && !plain(input.data)) || (input.data !== undefined && !plain(input.data))) return { success: false, message: "Record data must be an object." };
  if (input.relations !== undefined && !plain(input.relations)) return { success: false, message: "Record relations are invalid." };
  if (input.expectedRevision !== undefined && (!Number.isInteger(input.expectedRevision) || (input.expectedRevision as number) < 0)) return { success: false, message: "Record revision is invalid." };
  if (input.archived !== undefined && typeof input.archived !== "boolean") return { success: false, message: "Record archive state is invalid." };
  const relations: Record<string, string[]> = {};
  for (const [propertyId, ids] of Object.entries((input.relations ?? {}) as Record<string, unknown>)) {
    if (!/^[\w-]{1,128}$/.test(propertyId) || !Array.isArray(ids) || ids.length > 100 || !ids.every((id) => typeof id === "string" && id.length <= 128) || new Set(ids).size !== ids.length) return { success: false, message: "Record relation values are invalid." };
    relations[propertyId] = ids as string[];
  }
  return { success: true, value: { data: (input.data ?? {}) as Record<string, unknown>, dataProvided: Object.hasOwn(input, "data"), relations, ...(input.expectedRevision !== undefined ? { expectedRevision: input.expectedRevision as number } : {}), ...(input.archived !== undefined ? { archived: input.archived as boolean } : {}) } };
}

async function applyRecordRelations(tx: Prisma.TransactionClient, workspaceId: string, databaseId: string, recordId: string, supplied: Record<string, string[]>) {
  for (const [propertyId, targetIds] of Object.entries(supplied)) {
    const property = await tx.workspaceDatabaseProperty.findFirst({ where: { id: propertyId, workspaceId, databaseId, type: "RELATION" }, select: { id: true, options: true } });
    if (!property || !plain(property.options) || typeof property.options.targetDatabaseId !== "string") return fail("Relation property was not found.", 404, "RELATION_PROPERTY_NOT_FOUND");
    const targetDatabaseId = property.options.targetDatabaseId;
    if (property.options.multiple === false && targetIds.length > 1) return fail("This relation allows only one target.");
    const targets = targetIds.length ? await tx.workspaceDatabaseRecord.findMany({ where: { workspaceId, databaseId: targetDatabaseId, id: { in: targetIds }, archivedAt: null }, select: { id: true } }) : [];
    if (targets.length !== targetIds.length) return fail("One or more relation targets were not found in this workspace.", 404, "RELATION_TARGET_NOT_FOUND");
    await tx.workspaceDatabaseRelation.deleteMany({ where: { workspaceId, sourceDatabaseId: databaseId, sourceRecordId: recordId, propertyId } });
    if (targetIds.length) await tx.workspaceDatabaseRelation.createMany({ data: targetIds.map((targetRecordId) => ({ workspaceId, sourceDatabaseId: databaseId, sourceRecordId: recordId, propertyId, targetDatabaseId, targetRecordId })) });
  }
  return null;
}

export async function listWorkspaceDatabaseRecords(ownerUserId: string, databaseId: string, options: { q?: string; sortPropertyId?: string; direction?: "asc" | "desc"; archived?: boolean; viewId?: string } = {}) {
  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: ownerUserId }, select: { id: true } });
  if (!workspace) return null;
  const database = await prisma.workspaceDatabase.findFirst({ where: { id: databaseId, workspaceId: workspace.id }, select: { id: true } });
  if (!database) return null;
  const view = options.viewId ? await prisma.workspaceDatabaseView.findFirst({ where: { id: options.viewId, databaseId, workspaceId: workspace.id }, select: { id: true, name: true, type: true, configuration: true } }) : null;
  if (options.viewId && !view) return null;
  const [properties, records, relations] = await Promise.all([
    prisma.workspaceDatabaseProperty.findMany({ where: { workspaceId: workspace.id, databaseId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: propertySelect }),
    prisma.workspaceDatabaseRecord.findMany({ where: { workspaceId: workspace.id, databaseId, archivedAt: options.archived ? { not: null } : null }, take: 500, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, data: true, sortOrder: true, revision: true, archivedAt: true, createdAt: true, updatedAt: true } }),
    prisma.workspaceDatabaseRelation.findMany({ where: { workspaceId: workspace.id, sourceDatabaseId: databaseId }, select: { sourceRecordId: true, propertyId: true, targetDatabaseId: true, targetRecordId: true } }),
  ]);
  let visible = records;
  if (options.q?.trim()) { const needle = options.q.trim().toLocaleLowerCase().slice(0, 100); visible = visible.filter((record) => JSON.stringify(record.data).toLocaleLowerCase().includes(needle)); }
  const configuration = view && plain(view.configuration) ? view.configuration : {};
  const filters: Prisma.JsonObject[] = Array.isArray(configuration.filters) ? configuration.filters.filter(prismaJsonObject) : [];
  if (filters.length) visible = visible.filter((record) => filters.every((filter) => {
    if (typeof filter.propertyId !== "string" || typeof filter.operator !== "string") return false;
    const property = properties.find((item) => item.id === filter.propertyId);
    if (!property || property.type === "RELATION") return false;
    const value = plain(record.data) ? record.data[property.name] : undefined;
    if (filter.operator === "isEmpty") return value === undefined || value === null || value === "";
    if (filter.operator === "contains") return typeof value === "string" && typeof filter.value === "string" && value.toLocaleLowerCase().includes(filter.value.toLocaleLowerCase());
    if (filter.operator === "equals") return value === filter.value;
    if (filter.operator === "gt") return compareValues(value, filter.value) > 0;
    if (filter.operator === "lt") return compareValues(value, filter.value) < 0;
    return false;
  }));
  const configuredSorts: Prisma.JsonObject[] = Array.isArray(configuration.sorts) ? configuration.sorts.filter(prismaJsonObject) : [];
  const sorts: Array<Prisma.JsonObject | { propertyId: string; direction: "asc" | "desc" }> = configuredSorts.length ? configuredSorts : options.sortPropertyId ? [{ propertyId: options.sortPropertyId, direction: options.direction ?? "asc" }] : [];
  if (sorts.length) visible = visible.slice().sort((a, b) => {
    for (const sort of sorts) {
      if (typeof sort.propertyId !== "string") continue;
      const property = properties.find((item) => item.id === sort.propertyId);
      if (!property || property.type === "RELATION") continue;
      const difference = compareValues(plain(a.data) ? a.data[property.name] : undefined, plain(b.data) ? b.data[property.name] : undefined) * (sort.direction === "desc" ? -1 : 1);
      if (difference) return difference;
    }
    return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
  });
  if (!sorts.length && options.sortPropertyId) {
    const property = properties.find((item) => item.id === options.sortPropertyId);
    if (property && property.type !== "RELATION") visible = visible.slice().sort((a, b) => compareValues(plain(a.data) ? a.data[property.name] : undefined, plain(b.data) ? b.data[property.name] : undefined) * (options.direction === "desc" ? -1 : 1) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }
  const relationMap = new Map<string, Array<{ propertyId: string; targetDatabaseId: string; targetRecordId: string }>>();
  for (const relation of relations) { const items = relationMap.get(relation.sourceRecordId) ?? []; items.push({ propertyId: relation.propertyId, targetDatabaseId: relation.targetDatabaseId, targetRecordId: relation.targetRecordId }); relationMap.set(relation.sourceRecordId, items); }
  return { properties, records: visible.map((record) => ({ ...record, relations: relationMap.get(record.id) ?? [] })), view };
}

function compareValues(a: unknown, b: unknown) {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export async function createWorkspaceDatabaseRecord(ownerUserId: string, databaseId: string, input: unknown) {
  const parsed = parseRecordInput(input, false);
  if (!parsed.success) return fail(parsed.message);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const properties = await tx.workspaceDatabaseProperty.findMany({ where: { workspaceId, databaseId }, select: { name: true, type: true, options: true } });
    if (!properties.length) return fail("Database not found or has no properties.", 404, "NOT_FOUND");
    const values = validateWorkspaceDatabaseValues(properties, parsed.value.data);
    if (!values.success) return fail(values.message);
    const max = await tx.workspaceDatabaseRecord.aggregate({ where: { workspaceId, databaseId }, _max: { sortOrder: true } });
    const record = await tx.workspaceDatabaseRecord.create({ data: { workspaceId, databaseId, data: values.value as Prisma.InputJsonValue, sortOrder: (max._max.sortOrder ?? -1) + 1 }, select: { id: true, databaseId: true, data: true, sortOrder: true, revision: true, createdAt: true, updatedAt: true } });
    const relationError = await applyRecordRelations(tx, workspaceId, databaseId, record.id, parsed.value.relations);
    if (relationError) return relationError;
    return ok({ ...record, relations: parsed.value.relations });
  });
}

export async function updateWorkspaceDatabaseRecord(ownerUserId: string, databaseId: string, recordId: string, input: unknown) {
  const parsed = parseRecordInput(input, true);
  if (!parsed.success) return fail(parsed.message);
  if (parsed.value.expectedRevision === undefined) return fail("Expected record revision is required.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const current = await tx.workspaceDatabaseRecord.findFirst({ where: { id: recordId, databaseId, workspaceId }, select: { revision: true, data: true } });
    if (!current) return fail("Record not found.", 404, "NOT_FOUND");
    if (current.revision !== parsed.value.expectedRevision) return fail("Record changed elsewhere.", 409, "REVISION_CONFLICT");
    const properties = await tx.workspaceDatabaseProperty.findMany({ where: { workspaceId, databaseId }, select: { name: true, type: true, options: true } });
    const nextData = parsed.value.dataProvided ? parsed.value.data : plain(current.data) ? current.data : {};
    const values = validateWorkspaceDatabaseValues(properties, nextData);
    if (!values.success) return fail(values.message);
    const { expectedRevision, archived } = parsed.value;
    const changed = await tx.workspaceDatabaseRecord.updateMany({ where: { workspaceId, databaseId, id: recordId, revision: expectedRevision }, data: { data: values.value as Prisma.InputJsonValue, ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}), revision: { increment: 1 } } });
    if (changed.count !== 1) return fail("Record changed elsewhere.", 409, "REVISION_CONFLICT");
    const relationError = await applyRecordRelations(tx, workspaceId, databaseId, recordId, parsed.value.relations);
    if (relationError) return relationError;
    return ok(await tx.workspaceDatabaseRecord.findFirstOrThrow({ where: { workspaceId, databaseId, id: recordId }, select: { id: true, databaseId: true, data: true, sortOrder: true, revision: true, archivedAt: true, createdAt: true, updatedAt: true } }));
  });
}

export async function deleteWorkspaceDatabaseRecord(ownerUserId: string, databaseId: string, recordId: string) {
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const deleted = await tx.workspaceDatabaseRecord.deleteMany({ where: { workspaceId, databaseId, id: recordId } });
    return deleted.count ? ok({ deleted: true }) : fail("Record not found.", 404, "NOT_FOUND");
  });
}

export async function duplicateWorkspaceDatabaseRecord(ownerUserId: string, databaseId: string, recordId: string) {
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const source = await tx.workspaceDatabaseRecord.findFirst({ where: { workspaceId, databaseId, id: recordId, archivedAt: null }, select: { data: true, sortOrder: true } });
    if (!source) return fail("Record not found.", 404, "NOT_FOUND");
    const next = await tx.workspaceDatabaseRecord.aggregate({ where: { workspaceId, databaseId }, _max: { sortOrder: true } });
    const copy = await tx.workspaceDatabaseRecord.create({ data: { workspaceId, databaseId, data: source.data as Prisma.InputJsonValue, sortOrder: (next._max.sortOrder ?? -1) + 1 }, select: { id: true, databaseId: true, data: true, sortOrder: true, revision: true, createdAt: true, updatedAt: true } });
    const relations = await tx.workspaceDatabaseRelation.findMany({ where: { workspaceId, sourceDatabaseId: databaseId, sourceRecordId: recordId }, select: { propertyId: true, targetDatabaseId: true, targetRecordId: true } });
    if (relations.length) await tx.workspaceDatabaseRelation.createMany({ data: relations.map((relation) => ({ ...relation, workspaceId, sourceDatabaseId: databaseId, sourceRecordId: copy.id })) });
    return ok(copy);
  });
}

export async function createWorkspaceDatabaseView(ownerUserId: string, databaseId: string, input: unknown) {
  const parsed = parseWorkspaceDatabaseViewInput(input);
  if (!parsed.success) return fail(parsed.message);
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const properties = await tx.workspaceDatabaseProperty.findMany({ where: { workspaceId, databaseId }, select: { id: true, type: true } });
    if (!properties.length) return fail("Database not found.", 404, "NOT_FOUND");
    const propertyIds = new Set(properties.map((property) => property.id));
    const config = parsed.value.configuration;
    const referenced = [config.groupBy, ...(Array.isArray(config.filters) ? config.filters.map((f) => plain(f) ? f.propertyId : null) : []), ...(Array.isArray(config.sorts) ? config.sorts.map((s) => plain(s) ? s.propertyId : null) : [])].filter((id): id is string => typeof id === "string");
    if (referenced.some((id) => !propertyIds.has(id))) return fail("View references a property outside this database.", 404, "VIEW_PROPERTY_NOT_FOUND");
    if (parsed.value.type === "BOARD") { const group = properties.find((property) => property.id === config.groupBy); if (!group || (group.type !== "SELECT" && group.type !== "STATUS")) return fail("Board views must group by a select or status property."); }
    const { name, type, configuration, sortOrder } = parsed.value;
    return ok(await tx.workspaceDatabaseView.create({ data: { workspaceId, databaseId, name, type, sortOrder, configuration: configuration as Prisma.InputJsonValue }, select: viewSelect }));
  });
}

export async function updateWorkspaceDatabaseView(ownerUserId: string, databaseId: string, viewId: string, input: unknown) {
  const parsed = parseWorkspaceDatabaseViewInput(input, true);
  if (!parsed.success) return fail(parsed.message);
  if (parsed.value.expectedRevision === undefined) return fail("Expected view revision is required.");
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const current = await tx.workspaceDatabaseView.findFirst({ where: { id: viewId, databaseId, workspaceId, revision: parsed.value.expectedRevision }, select: { id: true } });
    if (!current) return fail("View not found or changed elsewhere.", 409, "REVISION_CONFLICT");
    const properties = await tx.workspaceDatabaseProperty.findMany({ where: { workspaceId, databaseId }, select: { id: true, type: true } });
    const ids = new Set(properties.map((property) => property.id));
    const config = parsed.value.configuration;
    const refs = [config.groupBy, ...(Array.isArray(config.filters) ? config.filters.map((f) => plain(f) ? f.propertyId : null) : []), ...(Array.isArray(config.sorts) ? config.sorts.map((s) => plain(s) ? s.propertyId : null) : [])].filter((id): id is string => typeof id === "string");
    if (refs.some((id) => !ids.has(id))) return fail("View references a property outside this database.", 404, "VIEW_PROPERTY_NOT_FOUND");
    if (parsed.value.type === "BOARD") { const group = properties.find((property) => property.id === config.groupBy); if (!group || (group.type !== "SELECT" && group.type !== "STATUS")) return fail("Board views must group by a select or status property."); }
    const { expectedRevision, ...data } = parsed.value;
    const changed = await tx.workspaceDatabaseView.updateMany({ where: { workspaceId, databaseId, id: viewId, revision: expectedRevision }, data: { ...data, configuration: data.configuration as Prisma.InputJsonValue, revision: { increment: 1 } } });
    if (changed.count !== 1) return fail("View changed elsewhere.", 409, "REVISION_CONFLICT");
    return ok(await tx.workspaceDatabaseView.findFirstOrThrow({ where: { workspaceId, databaseId, id: viewId }, select: viewSelect }));
  });
}

export async function deleteWorkspaceDatabaseView(ownerUserId: string, databaseId: string, viewId: string) {
  return withWorkspaceTransaction(ownerUserId, async (tx, workspaceId) => {
    const deleted = await tx.workspaceDatabaseView.deleteMany({ where: { workspaceId, databaseId, id: viewId } });
    return deleted.count ? ok({ deleted: true }) : fail("View not found.", 404, "NOT_FOUND");
  });
}
