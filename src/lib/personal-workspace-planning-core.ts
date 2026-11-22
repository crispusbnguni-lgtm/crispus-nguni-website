export const WORKSPACE_TASK_STATUSES = ["INBOX", "TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"] as const;
export const WORKSPACE_TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const WORKSPACE_PROJECT_STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export const WORKSPACE_DATABASE_PROPERTY_TYPES = ["TEXT", "NUMBER", "CHECKBOX", "DATE", "SELECT", "MULTI_SELECT", "URL", "STATUS", "RELATION"] as const;
export const WORKSPACE_DATABASE_VIEW_TYPES = ["TABLE", "BOARD"] as const;

export type WorkspaceTaskInput = {
  title?: string; description?: string | null; status?: (typeof WORKSPACE_TASK_STATUSES)[number]; priority?: (typeof WORKSPACE_TASK_PRIORITIES)[number];
  startsAt?: Date | null; dueAt?: Date | null; parentTaskId?: string | null; projectId?: string | null; pageId?: string | null;
  notes?: string | null; recurrenceRule?: string | null; labels?: string[]; expectedRevision?: number; archived?: boolean;
};
export type WorkspaceProjectInput = {
  name?: string; description?: string | null; status?: (typeof WORKSPACE_PROJECT_STATUSES)[number]; priority?: (typeof WORKSPACE_TASK_PRIORITIES)[number];
  startsAt?: Date | null; targetAt?: Date | null; expectedRevision?: number; archived?: boolean;
};
export type WorkspaceDatabasePropertyInput = {
  name: string; type: (typeof WORKSPACE_DATABASE_PROPERTY_TYPES)[number]; options: Record<string, unknown>; sortOrder: number;
};
export type WorkspaceDatabaseViewInput = {
  name: string; type: (typeof WORKSPACE_DATABASE_VIEW_TYPES)[number]; configuration: Record<string, unknown>; sortOrder: number;
};

const TASK_KEYS = new Set(["title", "description", "status", "priority", "startsAt", "dueAt", "parentTaskId", "projectId", "pageId", "notes", "recurrenceRule", "labels", "expectedRevision", "archived"]);
const PROJECT_KEYS = new Set(["name", "description", "status", "priority", "startsAt", "targetAt", "expectedRevision", "archived"]);
const hasOnlyKeys = (value: Record<string, unknown>, keys: Set<string>) => Object.keys(value).every((key) => keys.has(key));
const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const text = (value: unknown, max: number, required = false): value is string => typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);

function parseDate(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 40 || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) return undefined;
  const result = new Date(value);
  return Number.isFinite(result.getTime()) ? result : undefined;
}

function nullableText(input: Record<string, unknown>, key: string, max: number, output: Record<string, unknown>) {
  if (!(key in input)) return true;
  if (input[key] === null) { output[key] = null; return true; }
  if (!text(input[key], max)) return false;
  output[key] = (input[key] as string).trim();
  if ((output[key] as string).length === 0) output[key] = null;
  return true;
}

function nullableId(input: Record<string, unknown>, key: string, output: Record<string, unknown>) {
  if (!(key in input)) return true;
  const value = input[key];
  if (value !== null && (typeof value !== "string" || value.length < 1 || value.length > 128)) return false;
  output[key] = value;
  return true;
}

function recurrence(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (!plain(value) || !hasOnlyKeys(value, new Set(["frequency", "interval", "weekdays"]))) return undefined;
  const frequency = value.frequency;
  const interval = value.interval;
  if (!(frequency === "DAILY" || frequency === "WEEKLY" || frequency === "MONTHLY") || !Number.isInteger(interval) || (interval as number) < 1 || (interval as number) > 99) return undefined;
  const weekdays = value.weekdays;
  const allowedDays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  if (weekdays !== undefined && (frequency !== "WEEKLY" || !Array.isArray(weekdays) || weekdays.length < 1 || weekdays.length > 7 || !weekdays.every((day) => allowedDays.includes(day as string)) || new Set(weekdays).size !== weekdays.length)) return undefined;
  return `FREQ=${frequency};INTERVAL=${interval}${weekdays ? `;BYDAY=${(weekdays as string[]).slice().sort((a, b) => allowedDays.indexOf(a) - allowedDays.indexOf(b)).join(",")}` : ""}`;
}

export function parseWorkspaceTaskInput(input: unknown, partial = false) {
  if (!plain(input) || !hasOnlyKeys(input, TASK_KEYS)) return { success: false as const, message: "Task fields are invalid." };
  const value: WorkspaceTaskInput = {};
  if ("title" in input) { if (!text(input.title, 200, true)) return { success: false as const, message: "Task title must contain 1–200 characters." }; value.title = input.title.trim(); }
  else if (!partial) return { success: false as const, message: "Task title is required." };
  if (!nullableText(input, "description", 10_000, value) || !nullableText(input, "notes", 10_000, value)) return { success: false as const, message: "Task text is invalid." };
  if ("status" in input) { if (typeof input.status !== "string" || !(WORKSPACE_TASK_STATUSES as readonly string[]).includes(input.status)) return { success: false as const, message: "Task status is invalid." }; value.status = input.status as WorkspaceTaskInput["status"]; }
  if ("priority" in input) { if (typeof input.priority !== "string" || !(WORKSPACE_TASK_PRIORITIES as readonly string[]).includes(input.priority)) return { success: false as const, message: "Task priority is invalid." }; value.priority = input.priority as WorkspaceTaskInput["priority"]; }
  for (const key of ["startsAt", "dueAt"] as const) if (key in input) { const date = parseDate(input[key]); if (date === undefined) return { success: false as const, message: "Task date is invalid." }; value[key] = date; }
  if (!nullableId(input, "parentTaskId", value) || !nullableId(input, "projectId", value) || !nullableId(input, "pageId", value)) return { success: false as const, message: "Task relationship is invalid." };
  if ("recurrenceRule" in input) { const rule = recurrence(input.recurrenceRule); if (rule === undefined) return { success: false as const, message: "Recurrence must be a daily, weekly or monthly rule with a bounded interval." }; value.recurrenceRule = rule; }
  if ("labels" in input) { if (!Array.isArray(input.labels) || input.labels.length > 20 || !input.labels.every((label) => text(label, 40, true)) || new Set((input.labels as string[]).map((label) => label.trim().toLocaleLowerCase())).size !== input.labels.length) return { success: false as const, message: "Task labels are invalid." }; value.labels = (input.labels as string[]).map((label) => label.trim()); }
  if ("expectedRevision" in input) { if (!Number.isInteger(input.expectedRevision) || (input.expectedRevision as number) < 0) return { success: false as const, message: "Task revision is invalid." }; value.expectedRevision = input.expectedRevision as number; }
  if ("archived" in input) { if (typeof input.archived !== "boolean") return { success: false as const, message: "Archive state is invalid." }; value.archived = input.archived; }
  const starts = value.startsAt instanceof Date ? value.startsAt.getTime() : undefined;
  const due = value.dueAt instanceof Date ? value.dueAt.getTime() : undefined;
  if (starts !== undefined && due !== undefined && due < starts) return { success: false as const, message: "Task due date cannot be before its start date." };
  return { success: true as const, value };
}

export function parseWorkspaceProjectInput(input: unknown, partial = false) {
  if (!plain(input) || !hasOnlyKeys(input, PROJECT_KEYS)) return { success: false as const, message: "Project fields are invalid." };
  const value: WorkspaceProjectInput = {};
  if ("name" in input) { if (!text(input.name, 160, true)) return { success: false as const, message: "Project name must contain 1–160 characters." }; value.name = input.name.trim(); }
  else if (!partial) return { success: false as const, message: "Project name is required." };
  if (!nullableText(input, "description", 10_000, value)) return { success: false as const, message: "Project description is invalid." };
  if ("status" in input) { if (typeof input.status !== "string" || !(WORKSPACE_PROJECT_STATUSES as readonly string[]).includes(input.status)) return { success: false as const, message: "Project status is invalid." }; value.status = input.status as WorkspaceProjectInput["status"]; }
  if ("priority" in input) { if (typeof input.priority !== "string" || !(WORKSPACE_TASK_PRIORITIES as readonly string[]).includes(input.priority)) return { success: false as const, message: "Project priority is invalid." }; value.priority = input.priority as WorkspaceProjectInput["priority"]; }
  for (const key of ["startsAt", "targetAt"] as const) if (key in input) { const date = parseDate(input[key]); if (date === undefined) return { success: false as const, message: "Project date is invalid." }; value[key] = date; }
  if ("expectedRevision" in input) { if (!Number.isInteger(input.expectedRevision) || (input.expectedRevision as number) < 0) return { success: false as const, message: "Project revision is invalid." }; value.expectedRevision = input.expectedRevision as number; }
  if ("archived" in input) { if (typeof input.archived !== "boolean") return { success: false as const, message: "Archive state is invalid." }; value.archived = input.archived; }
  if (value.startsAt && value.targetAt && value.targetAt < value.startsAt) return { success: false as const, message: "Target date cannot be before the start date." };
  return { success: true as const, value };
}

export function parseWorkspaceMilestoneInput(input: unknown, partial = false) {
  const allowed = new Set(["title", "description", "targetAt", "completed", "expectedRevision"]);
  if (!plain(input) || !hasOnlyKeys(input, allowed)) return { success: false as const, message: "Milestone fields are invalid." };
  const value: { title?: string; description?: string | null; targetAt?: Date | null; completed?: boolean; expectedRevision?: number } = {};
  if ("title" in input) { if (!text(input.title, 160, true)) return { success: false as const, message: "Milestone title is invalid." }; value.title = input.title.trim(); }
  else if (!partial) return { success: false as const, message: "Milestone title is required." };
  if (!nullableText(input, "description", 4_000, value)) return { success: false as const, message: "Milestone description is invalid." };
  if ("targetAt" in input) { const date = parseDate(input.targetAt); if (date === undefined) return { success: false as const, message: "Milestone target date is invalid." }; value.targetAt = date; }
  if ("completed" in input) { if (typeof input.completed !== "boolean") return { success: false as const, message: "Milestone completion is invalid." }; value.completed = input.completed; }
  if ("expectedRevision" in input) { if (!Number.isInteger(input.expectedRevision) || (input.expectedRevision as number) < 0) return { success: false as const, message: "Milestone revision is invalid." }; value.expectedRevision = input.expectedRevision as number; }
  return { success: true as const, value };
}

export function parseWorkspaceDatabasePropertyInput(input: unknown, partial = false) {
  const allowed = new Set(["name", "type", "options", "sortOrder", "clearExistingValues", "expectedRevision"]);
  if (!plain(input) || !hasOnlyKeys(input, allowed)) return { success: false as const, message: "Property fields are invalid." };
  const value: Partial<WorkspaceDatabasePropertyInput> & { clearExistingValues?: boolean; expectedRevision?: number } = {};
  if ("name" in input) { if (!text(input.name, 80, true)) return { success: false as const, message: "Property name must contain 1–80 characters." }; value.name = input.name.trim(); }
  else if (!partial) return { success: false as const, message: "Property name is required." };
  if ("type" in input) { if (typeof input.type !== "string" || !(WORKSPACE_DATABASE_PROPERTY_TYPES as readonly string[]).includes(input.type)) return { success: false as const, message: "Property type is invalid." }; value.type = input.type as WorkspaceDatabasePropertyInput["type"]; }
  if ("options" in input) { if (!plain(input.options) || Buffer.byteLength(JSON.stringify(input.options), "utf8") > 4_000) return { success: false as const, message: "Property options are invalid." }; value.options = structuredClone(input.options); }
  if ("sortOrder" in input) { if (!Number.isInteger(input.sortOrder) || (input.sortOrder as number) < 0 || (input.sortOrder as number) > 100_000) return { success: false as const, message: "Property order is invalid." }; value.sortOrder = input.sortOrder as number; }
  if ("clearExistingValues" in input) { if (typeof input.clearExistingValues !== "boolean") return { success: false as const, message: "Value reset choice is invalid." }; value.clearExistingValues = input.clearExistingValues; }
  if ("expectedRevision" in input) { if (!Number.isInteger(input.expectedRevision) || (input.expectedRevision as number) < 0) return { success: false as const, message: "Property revision is invalid." }; value.expectedRevision = input.expectedRevision as number; }
  const type = value.type;
  const optionsValue = value.options ?? {};
  if (type === "SELECT" || type === "STATUS" || type === "MULTI_SELECT") {
    const options = optionsValue.values;
    if (!Array.isArray(options) || options.length < 1 || options.length > 100 || !options.every((option) => text(option, 80, true)) || new Set((options as string[]).map((option) => option.trim().toLocaleLowerCase())).size !== options.length) return { success: false as const, message: "Select properties need unique bounded options." };
    value.options = { values: (options as string[]).map((option) => option.trim()) };
  } else if (type === "RELATION") {
    if (typeof optionsValue.targetDatabaseId !== "string" || optionsValue.targetDatabaseId.length < 1 || optionsValue.targetDatabaseId.length > 128 || (optionsValue.multiple !== undefined && typeof optionsValue.multiple !== "boolean")) return { success: false as const, message: "Relation properties need a target database." };
    value.options = { targetDatabaseId: optionsValue.targetDatabaseId, multiple: optionsValue.multiple !== false };
  } else if (Object.keys(optionsValue).length) return { success: false as const, message: "This property type does not accept options." };
  return { success: true as const, value };
}

export function validateWorkspaceDatabaseValues(properties: Array<{ name: string; type: string; options: unknown }>, input: unknown) {
  if (!plain(input) || Object.keys(input).length > 100) return { success: false as const, message: "Record values are invalid." };
  const byName = new Map(properties.filter((property) => property.type !== "RELATION").map((property) => [property.name, property]));
  if (Object.keys(input).some((key) => !byName.has(key))) return { success: false as const, message: "Record contains an unknown property." };
  const values: Record<string, string | number | boolean | string[] | null> = {};
  for (const [name, raw] of Object.entries(input)) {
    const property = byName.get(name)!;
    if (raw === null) { values[name] = null; continue; }
    if (property.type === "TEXT" && text(raw, 10_000)) values[name] = raw;
    else if (property.type === "NUMBER" && typeof raw === "number" && Number.isFinite(raw)) values[name] = raw;
    else if (property.type === "CHECKBOX" && typeof raw === "boolean") values[name] = raw;
    else if (property.type === "DATE") { const date = parseDate(raw); if (date instanceof Date) values[name] = date.toISOString(); else return { success: false as const, message: `Value for ${name} must be a valid date.` }; }
    else if (property.type === "URL" && text(raw, 2_000)) { try { const url = new URL(raw); if (!(["https:", "http:"].includes(url.protocol))) throw new Error(); values[name] = url.toString(); } catch { return { success: false as const, message: `Value for ${name} must be a web URL.` }; } }
    else if (property.type === "SELECT" || property.type === "STATUS") { const options = plain(property.options) && Array.isArray(property.options.values) ? property.options.values : []; if (typeof raw !== "string" || !options.includes(raw)) return { success: false as const, message: `Value for ${name} is not an available option.` }; values[name] = raw; }
    else if (property.type === "MULTI_SELECT") { const options = plain(property.options) && Array.isArray(property.options.values) ? property.options.values : []; if (!Array.isArray(raw) || raw.length > 100 || !raw.every((item) => typeof item === "string" && options.includes(item)) || new Set(raw).size !== raw.length) return { success: false as const, message: `Value for ${name} must contain available options.` }; values[name] = raw.slice() as string[]; }
    else return { success: false as const, message: `Value for ${name} does not match its property type.` };
  }
  return { success: true as const, value: values };
}

export function parseWorkspaceDatabaseViewInput(input: unknown, partial = false) {
  const allowed = new Set(["name", "type", "configuration", "sortOrder", "expectedRevision"]);
  if (!plain(input) || !hasOnlyKeys(input, allowed)) return { success: false as const, message: "View fields are invalid." };
  const value: WorkspaceDatabaseViewInput & { expectedRevision?: number } = { name: "", type: "TABLE", configuration: {}, sortOrder: 0 };
  if ("name" in input) { if (!text(input.name, 80, true)) return { success: false as const, message: "View name is invalid." }; value.name = input.name.trim(); }
  else if (!partial) return { success: false as const, message: "View name is required." };
  if ("type" in input) { if (typeof input.type !== "string" || !(WORKSPACE_DATABASE_VIEW_TYPES as readonly string[]).includes(input.type)) return { success: false as const, message: "View type is invalid." }; value.type = input.type as WorkspaceDatabaseViewInput["type"]; }
  if ("configuration" in input) { if (!plain(input.configuration) || Buffer.byteLength(JSON.stringify(input.configuration), "utf8") > 8_000) return { success: false as const, message: "View configuration is invalid." }; value.configuration = structuredClone(input.configuration); }
  if ("sortOrder" in input) { if (!Number.isInteger(input.sortOrder) || (input.sortOrder as number) < 0 || (input.sortOrder as number) > 100_000) return { success: false as const, message: "View order is invalid." }; value.sortOrder = input.sortOrder as number; }
  if ("expectedRevision" in input) { if (!Number.isInteger(input.expectedRevision) || (input.expectedRevision as number) < 0) return { success: false as const, message: "View revision is invalid." }; value.expectedRevision = input.expectedRevision as number; }
  const filters = value.configuration.filters;
  if (filters !== undefined && (!Array.isArray(filters) || filters.length > 30 || !filters.every((filter) => plain(filter) && hasOnlyKeys(filter, new Set(["propertyId", "operator", "value"])) && typeof filter.propertyId === "string" && filter.propertyId.length <= 128 && typeof filter.operator === "string" && ["equals", "contains", "gt", "lt", "isEmpty"].includes(filter.operator)))) return { success: false as const, message: "Saved view filters are invalid." };
  const sorts = value.configuration.sorts;
  if (sorts !== undefined && (!Array.isArray(sorts) || sorts.length > 10 || !sorts.every((sort) => plain(sort) && hasOnlyKeys(sort, new Set(["propertyId", "direction"])) && typeof sort.propertyId === "string" && sort.propertyId.length <= 128 && ["asc", "desc"].includes(sort.direction as string)))) return { success: false as const, message: "Saved view sorting is invalid." };
  if (value.type === "BOARD" && (typeof value.configuration.groupBy !== "string" || value.configuration.groupBy.length > 128)) return { success: false as const, message: "Board view needs a grouping property." };
  return { success: true as const, value };
}
