import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkspaceMilestoneInput, parseWorkspaceProjectInput, parseWorkspaceTaskInput, parseWorkspaceDatabasePropertyInput, parseWorkspaceDatabaseViewInput, validateWorkspaceDatabaseValues } from "../src/lib/personal-workspace-planning-core.ts";

test("task parser bounds fields, dates, recurrence, labels and rejects forged ownership", () => {
  assert.equal(parseWorkspaceTaskInput({ title: "Write", status: "TODO", priority: "HIGH", dueAt: "2026-11-20", recurrenceRule: { frequency: "WEEKLY", interval: 2, weekdays: ["MO", "FR"] }, labels: ["work"] }).success, true);
  assert.equal(parseWorkspaceTaskInput({ title: "x", workspaceId: "foreign" }).success, false);
  assert.equal(parseWorkspaceTaskInput({ title: "x", startsAt: "2026-11-20", dueAt: "2026-11-19" }).success, false);
  assert.equal(parseWorkspaceTaskInput({ title: "x", recurrenceRule: { frequency: "HOURLY", interval: 1 } }).success, false);
  assert.equal(parseWorkspaceTaskInput({ title: "x", labels: ["same", "SAME"] }).success, false);
});

test("project and milestone parsers preserve bounded lifecycle inputs", () => {
  assert.equal(parseWorkspaceProjectInput({ name: "Research", status: "ACTIVE", priority: "HIGH", targetAt: "2026-12-01" }).success, true);
  assert.equal(parseWorkspaceProjectInput({ name: "Research", status: "UNRECOGNIZED" }).success, false);
  assert.equal(parseWorkspaceMilestoneInput({ title: "Draft", completed: true }).success, true);
  assert.equal(parseWorkspaceMilestoneInput({ title: "Draft", revision: 10 }).success, false);
});

test("database property and view schemas reject unsupported shapes", () => {
  assert.equal(parseWorkspaceDatabasePropertyInput({ name: "Stage", type: "STATUS", options: { values: ["New", "Done"] }, sortOrder: 0 }).success, true);
  assert.equal(parseWorkspaceDatabasePropertyInput({ name: "Stage", type: "STATUS", options: { values: ["New", "new"] }, sortOrder: 0 }).success, false);
  assert.equal(parseWorkspaceDatabasePropertyInput({ name: "bad", type: "TEXT", options: { sql: "DROP" }, sortOrder: 0 }).success, false);
  assert.equal(parseWorkspaceDatabaseViewInput({ name: "Board", type: "BOARD", configuration: { groupBy: "property-1" }, sortOrder: 0 }).success, true);
  assert.equal(parseWorkspaceDatabaseViewInput({ name: "Board", type: "BOARD", configuration: {}, sortOrder: 0 }).success, false);
});

test("record value validation is driven by declared properties and rejects malformed values", () => {
  const properties = [
    { name: "Name", type: "TEXT", options: {} },
    { name: "Done", type: "CHECKBOX", options: {} },
    { name: "Stage", type: "STATUS", options: { values: ["New", "Done"] } },
  ];
  assert.deepEqual(validateWorkspaceDatabaseValues(properties, { Name: "Draft", Done: false, Stage: "New" }), { success: true, value: { Name: "Draft", Done: false, Stage: "New" } });
  assert.equal(validateWorkspaceDatabaseValues(properties, { Unknown: "value" }).success, false);
  assert.equal(validateWorkspaceDatabaseValues(properties, { Stage: "Other" }).success, false);
  assert.equal(validateWorkspaceDatabaseValues(properties, { Done: "yes" }).success, false);
});
