import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/consultations/timezone-core") return { url: new URL("../src/lib/consultations/timezone-core.ts", import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const { parseWorkspacePageInput, parseWorkspaceBlockInput, WORKSPACE_BLOCK_TYPES } = await import("../src/lib/personal-workspace-pages-core.ts");

test("page parser accepts bounded supported fields and rejects identity injection", () => {
  assert.deepEqual(parseWorkspacePageInput({ title: "Notes", parentId: null, iconKey: "notebook", isFavorite: true }), { success: true, value: { title: "Notes", parentId: null, iconKey: "notebook", isFavorite: true } });
  assert.equal(parseWorkspacePageInput({ title: "x", workspaceId: "someone-elses" }).success, false);
  assert.equal(parseWorkspacePageInput({ title: "x".repeat(121) }).success, false);
  assert.equal(parseWorkspacePageInput({ title: "notes", iconKey: "admin" }).success, false);
});

test("every advertised block type has a bounded valid initial representation", () => {
  const payloads = {
    PARAGRAPH: { text: "note" }, HEADING: { text: "title", level: 2 }, BULLETED_LIST: { items: ["one"] }, NUMBERED_LIST: { items: ["one"] }, CHECKLIST: { items: ["one"] }, TODO: { items: ["one"] }, QUOTE: { text: "quote", attribution: "author" }, CALLOUT: { text: "note", tone: "info" }, DIVIDER: {}, CODE: { code: "const x = 1", language: "ts" }, TABLE: { columns: ["Task", "Done"], rows: [["Study", "yes"]] }, IMAGE: { assetId: null, alt: "diagram" }, LINK: { label: "Site", url: "https://example.test" }, TOGGLE: { title: "More", text: "Details" }, PAGE_REFERENCE: { targetPageId: "page-a" }, DATE: { date: "2026-11-16", label: "Today" }, REMINDER: { remindAt: "2026-11-17T09:00:00Z", timezone: "Africa/Nairobi", label: "Check in" },
  };
  assert.equal(Object.keys(payloads).length, WORKSPACE_BLOCK_TYPES.length);
  for (const type of WORKSPACE_BLOCK_TYPES) assert.equal(parseWorkspaceBlockInput({ type, content: payloads[type] }).success, true, type);
});

test("list and table structures are normalized in parsed output and bounded", () => {
  const list = parseWorkspaceBlockInput({ type: "CHECKLIST", content: { items: ["alpha", "beta"] } });
  assert.equal(list.success, true);
  if (list.success) { assert.deepEqual(list.value.items?.map((item) => item.text), ["alpha", "beta"]); assert.equal(list.value.content.items, undefined); }
  const table = parseWorkspaceBlockInput({ type: "TABLE", content: { columns: ["A", "B"], rows: [["x", "y"]] } });
  assert.equal(table.success, true);
  if (table.success) { assert.deepEqual(table.value.table?.rows, [["x", "y"]]); assert.equal(table.value.content.rows, undefined); }
  assert.equal(parseWorkspaceBlockInput({ type: "TABLE", content: { columns: ["A"], rows: [["x", "y"]] } }).success, false);
  assert.equal(parseWorkspaceBlockInput({ type: "TODO", content: { items: Array.from({ length: 101 }, () => "x") } }).success, false);
  const checked = parseWorkspaceBlockInput({ type: "TODO", content: { items: [{ text: "Done", checked: true, dueAt: null }] } });
  assert.equal(checked.success, true);
  if (checked.success) assert.ok(checked.value.items?.[0]?.checkedAt instanceof Date);
});

test("unsafe URLs, malformed JSON-shaped fields, and unsupported metadata are rejected", () => {
  assert.equal(parseWorkspaceBlockInput({ type: "LINK", content: { label: "bad", url: "javascript:alert(1)" } }).success, false);
  assert.equal(parseWorkspaceBlockInput({ type: "PARAGRAPH", content: { text: "x", token: "secret" } }).success, false);
  assert.equal(parseWorkspaceBlockInput({ type: "HEADING", content: { text: "x", level: 8 } }).success, false);
});
