export const WORKSPACE_PAGE_ICONS = [
  "book", "calendar", "check", "code", "file", "flag", "folder",
  "graduation", "heart", "home", "lightbulb", "list", "map", "notebook",
  "people", "target", "briefcase",
] as const;

export const WORKSPACE_BLOCK_TYPES = [
  "PARAGRAPH", "HEADING", "BULLETED_LIST", "NUMBERED_LIST", "CHECKLIST",
  "TODO", "QUOTE", "CALLOUT", "DIVIDER", "CODE", "TABLE", "IMAGE", "LINK",
  "TOGGLE", "PAGE_REFERENCE", "DATE", "REMINDER",
] as const;

export type WorkspaceBlockTypeInput = (typeof WORKSPACE_BLOCK_TYPES)[number];
export type WorkspacePageInput = {
  title?: string;
  parentId?: string | null;
  iconKey?: string | null;
  isFavorite?: boolean;
  isPinned?: boolean;
};

export type ParsedPageInput =
  | { success: true; value: WorkspacePageInput }
  | { success: false; message: string };

export type ParsedBlockInput =
  | { success: true; value: { type: WorkspaceBlockTypeInput; content: Record<string, unknown>; plainText: string; items?: Array<{ text: string; checkedAt: Date | null; dueAt: Date | null }>; table?: { columns: string[]; rows: string[][] }; pageReferenceId?: string; reminder?: { remindAt: Date; timezone: string }; mediaAssetId?: string | null; parentBlockId?: string | null } }
  | { success: false; message: string };

const PAGE_KEYS = new Set(["title", "parentId", "iconKey", "isFavorite", "isPinned"]);
const BLOCK_KEYS = new Set(["type", "content", "parentBlockId"]);
const SAFE_TEXT = 12_000;
const BLOCK_BYTES = 32_000;
const MAX_LIST_ITEMS = 100;
const MAX_TABLE_ROWS = 50;
const MAX_TABLE_COLUMNS = 20;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function boundedText(value: unknown, max = SAFE_TEXT): value is string {
  return typeof value === "string" && value.length <= max;
}

function exactKeys(value: Record<string, unknown>, keys: Set<string>): boolean {
  return Object.keys(value).every((key) => keys.has(key));
}

export function parseWorkspacePageInput(input: unknown, partial = false): ParsedPageInput {
  if (!record(input) || !exactKeys(input, PAGE_KEYS)) return { success: false, message: "Page fields are invalid." };
  const value: WorkspacePageInput = {};
  if ("title" in input) {
    if (!boundedText(input.title, 120) || input.title.trim().length === 0) return { success: false, message: "Page title must be 1–120 characters." };
    value.title = input.title.trim();
  } else if (!partial) value.title = "Untitled";
  if ("parentId" in input) {
    if (input.parentId !== null && (typeof input.parentId !== "string" || input.parentId.length < 1 || input.parentId.length > 128)) return { success: false, message: "Parent page is invalid." };
    value.parentId = input.parentId as string | null;
  }
  if ("iconKey" in input) {
    if (input.iconKey !== null && (typeof input.iconKey !== "string" || !(WORKSPACE_PAGE_ICONS as readonly string[]).includes(input.iconKey))) return { success: false, message: "Choose a supported page icon." };
    value.iconKey = input.iconKey as string | null;
  }
  for (const key of ["isFavorite", "isPinned"] as const) {
    if (key in input) {
      if (typeof input[key] !== "boolean") return { success: false, message: "Page preference is invalid." };
      value[key] = input[key] as boolean;
    }
  }
  return { success: true, value };
}

function plainTextFromContent(type: WorkspaceBlockTypeInput, content: Record<string, unknown>, items?: Array<{ text: string }>, table?: { columns: string[]; rows: string[][] }): string {
  if (items) return items.map((item) => item.text).join("\n");
  if (type === "TABLE") return table ? [table.columns.join(" | "), ...table.rows.map((row) => row.join(" | "))].join("\n") : "";
  const values = [content.text, content.title, content.code, content.label, content.alt];
  return values.filter((value): value is string => typeof value === "string").join("\n");
}

export function parseWorkspaceBlockInput(input: unknown): ParsedBlockInput {
  if (!record(input) || !exactKeys(input, BLOCK_KEYS) || typeof input.type !== "string" || !(WORKSPACE_BLOCK_TYPES as readonly string[]).includes(input.type) || !record(input.content)) {
    return { success: false, message: "Block fields are invalid." };
  }
  const type = input.type as WorkspaceBlockTypeInput;
  const content = input.content;
  let items: Array<{ text: string; checkedAt: Date | null; dueAt: Date | null }> | undefined;
  let table: { columns: string[]; rows: string[][] } | undefined;
  let pageReferenceId: string | undefined;
  let reminder: { remindAt: Date; timezone: string } | undefined;
  let mediaAssetId: string | null | undefined;
  let parentBlockId: string | null | undefined;

  if ("parentBlockId" in input) {
    if (input.parentBlockId !== null && (typeof input.parentBlockId !== "string" || input.parentBlockId.length > 128)) return { success: false, message: "Parent block is invalid." };
    parentBlockId = input.parentBlockId as string | null;
  }

  const textOnly = new Set(["PARAGRAPH", "HEADING", "QUOTE", "CALLOUT", "TOGGLE"]);
  if (textOnly.has(type)) {
    const allowed = type === "HEADING" ? new Set(["text", "level"]) : type === "QUOTE" ? new Set(["text", "attribution"]) : type === "CALLOUT" ? new Set(["text", "tone"]) : type === "TOGGLE" ? new Set(["title", "text"]) : new Set(["text"]);
    if (!exactKeys(content, allowed)) return { success: false, message: "Block content contains unsupported fields." };
    const primary = type === "TOGGLE" ? content.title : content.text;
    if (!boundedText(primary) || (type === "TOGGLE" && !boundedText(content.text))) return { success: false, message: "Block text is invalid or too long." };
    if (type === "HEADING" && ![1, 2, 3].includes(content.level as number)) return { success: false, message: "Heading level must be 1, 2 or 3." };
    if (type === "CALLOUT" && !["neutral", "info", "success", "warning"].includes(content.tone as string)) return { success: false, message: "Callout tone is invalid." };
  } else if (["BULLETED_LIST", "NUMBERED_LIST", "CHECKLIST", "TODO"].includes(type)) {
    if (!exactKeys(content, new Set(["items"])) || !Array.isArray(content.items) || content.items.length < 1 || content.items.length > MAX_LIST_ITEMS) return { success: false, message: "List items are invalid." };
    const parsedItems: Array<{ text: string; checkedAt: Date | null; dueAt: Date | null }> = [];
    for (const item of content.items) {
      if (boundedText(item, 2_000)) parsedItems.push({ text: item.trim(), checkedAt: null, dueAt: null });
      else if (record(item) && exactKeys(item, new Set(["text", "checked", "dueAt"])) && boundedText(item.text, 2_000) && typeof item.checked === "boolean" && (item.dueAt === null || (boundedText(item.dueAt, 40) && Number.isFinite(Date.parse(item.dueAt)))) ) parsedItems.push({ text: item.text.trim(), checkedAt: item.checked ? new Date() : null, dueAt: item.dueAt ? new Date(item.dueAt as string) : null });
      else return { success: false, message: "List items are invalid." };
    }
    items = parsedItems;
    content.items = undefined;
  } else if (type === "CODE") {
    if (!exactKeys(content, new Set(["code", "language"])) || !boundedText(content.code, 20_000) || !boundedText(content.language, 40)) return { success: false, message: "Code block is invalid." };
  } else if (type === "TABLE") {
    if (!exactKeys(content, new Set(["columns", "rows"])) || !Array.isArray(content.columns) || !Array.isArray(content.rows)) return { success: false, message: "Table dimensions or cell values are invalid." };
    const columns = content.columns as unknown[];
    const rows = content.rows as unknown[];
    if (columns.length < 1 || columns.length > MAX_TABLE_COLUMNS || rows.length > MAX_TABLE_ROWS || !columns.every((column) => boundedText(column, 120)) || !rows.every((row) => Array.isArray(row) && row.length === columns.length && row.every((cell) => boundedText(cell, 2_000)))) return { success: false, message: "Table dimensions or cell values are invalid." };
    table = { columns: [...columns] as string[], rows: (rows as string[][]).map((row) => [...row]) };
    content.columns = undefined;
    content.rows = undefined;
  } else if (type === "IMAGE") {
    if (!exactKeys(content, new Set(["assetId", "alt"])) || (content.assetId !== null && content.assetId !== undefined && (typeof content.assetId !== "string" || content.assetId.length > 128)) || !boundedText(content.alt ?? "", 500)) return { success: false, message: "Private image reference is invalid." };
    mediaAssetId = (content.assetId as string | null | undefined) ?? null;
    delete content.assetId;
  } else if (type === "LINK") {
    if (!exactKeys(content, new Set(["label", "url"])) || !boundedText(content.label, 500) || !boundedText(content.url, 2_000)) return { success: false, message: "Link fields are invalid." };
    try { const url = new URL(content.url as string); if (!["https:", "http:"].includes(url.protocol)) return { success: false, message: "Only web links are supported." }; } catch { return { success: false, message: "Link URL is invalid." }; }
  } else if (type === "PAGE_REFERENCE") {
    if (!exactKeys(content, new Set(["targetPageId"])) || typeof content.targetPageId !== "string" || content.targetPageId.length > 128) return { success: false, message: "Referenced page is invalid." };
    pageReferenceId = content.targetPageId;
    content.targetPageId = undefined;
  } else if (type === "DATE") {
    if (!exactKeys(content, new Set(["date", "label"])) || !boundedText(content.date, 40) || !Number.isFinite(Date.parse(content.date)) || !boundedText(content.label ?? "", 500)) return { success: false, message: "Date block is invalid." };
  } else if (type === "REMINDER") {
    if (!exactKeys(content, new Set(["remindAt", "timezone", "label"])) || !boundedText(content.remindAt, 40) || !Number.isFinite(Date.parse(content.remindAt)) || !boundedText(content.timezone, 100) || !boundedText(content.label ?? "", 500)) return { success: false, message: "Reminder fields are invalid." };
    try { new Intl.DateTimeFormat("en", { timeZone: content.timezone as string }); } catch { return { success: false, message: "Reminder timezone is invalid." }; }
    reminder = { remindAt: new Date(content.remindAt as string), timezone: content.timezone as string };
  } else if (type === "DIVIDER") {
    if (Object.keys(content).length !== 0) return { success: false, message: "Divider content must be empty." };
  }

  const safeContent = structuredClone(content);
  for (const key of Object.keys(safeContent)) if (safeContent[key] === undefined) delete safeContent[key];
  if (Buffer.byteLength(JSON.stringify(safeContent), "utf8") > BLOCK_BYTES) return { success: false, message: "Block content is too large." };
  return { success: true, value: { type, content: safeContent, plainText: plainTextFromContent(type, safeContent, items, table), ...(items ? { items } : {}), ...(table ? { table } : {}), ...(pageReferenceId ? { pageReferenceId } : {}), ...(reminder ? { reminder } : {}), ...(mediaAssetId !== undefined ? { mediaAssetId } : {}), ...(parentBlockId !== undefined ? { parentBlockId } : {}) } };
}

export const WORKSPACE_TEMPLATES = [
  { id: "meeting-notes-v1", title: "Meeting notes", blocks: [{ type: "HEADING", content: { text: "Meeting notes", level: 1 } }, { type: "PARAGRAPH", content: { text: "Date, attendees and purpose" } }, { type: "HEADING", content: { text: "Notes", level: 2 } }, { type: "BULLETED_LIST", content: { items: ["Key discussion", "Decisions"] } }, { type: "HEADING", content: { text: "Actions", level: 2 } }, { type: "TODO", content: { items: ["Follow-up action"] } }] },
  { id: "weekly-plan-v1", title: "Weekly plan", blocks: [{ type: "HEADING", content: { text: "Weekly plan", level: 1 } }, { type: "PARAGRAPH", content: { text: "One priority for this week" } }, { type: "CHECKLIST", content: { items: ["Plan", "Focus", "Review"] } }] },
] as const;
