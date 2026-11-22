import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { inspectMigrationLayout } from "../scripts/check-migrations.mjs";

const roots = new Set();

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "crispus-migration-integrity-"));
  roots.add(root);
  writeFileSync(join(root, "migration_lock.toml"), 'provider = "postgresql"\n');
  return root;
}

function addMigration(root, name, sql = "-- test migration\n", extraFiles = []) {
  const directory = join(root, name);
  mkdirSync(directory, { recursive: true });
  if (sql !== null) writeFileSync(join(directory, "migration.sql"), sql);
  for (const [fileName, contents] of extraFiles) writeFileSync(join(directory, fileName), contents);
  return directory;
}

function codes(result) {
  return result.findings.map((item) => item.code);
}

test.afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.clear();
});

test("accepts a valid PostgreSQL migration tree whose SQL files are tracked", () => {
  const root = makeRoot();
  addMigration(root, "20261101090000_initial_step");
  addMigration(root, "20261101100000_follow_up");

  const result = inspectMigrationLayout({
    migrationRoot: root,
    trackedMigrationFiles: ["20261101090000_initial_step/migration.sql", "20261101100000_follow_up/migration.sql"],
  });

  assert.deepEqual(result.findings, []);
  assert.equal(result.inventory.length, 2);
  assert.ok(result.inventory.every((item) => item.migrationSql === "present" && item.tracked));
});

test("reports an empty migration directory instead of treating it as valid", () => {
  const root = makeRoot();
  addMigration(root, "20261101090000_placeholder", null);

  const result = inspectMigrationLayout({ migrationRoot: root, trackedMigrationFiles: [] });
  assert.ok(codes(result).includes("EMPTY_MIGRATION_DIRECTORY"));
  assert.equal(result.inventory[0].migrationSql, "empty-directory");
});

test("rejects malformed names, invalid timestamps, missing SQL and zero-byte SQL", () => {
  const root = makeRoot();
  addMigration(root, "20261101090000_missing_sql", null, [["README.txt", "not a migration"]]);
  addMigration(root, "20260230090000_invalid_date");
  addMigration(root, "not_a_timestamp");
  addMigration(root, "20261101100000_empty_sql", "");

  const result = inspectMigrationLayout({ migrationRoot: root, trackedMigrationFiles: [] });
  assert.ok(codes(result).includes("MIGRATION_SQL_MISSING"));
  assert.ok(codes(result).includes("INVALID_MIGRATION_NAME"));
  assert.ok(codes(result).includes("EMPTY_MIGRATION_SQL"));
});

test("rejects unexpected files inside migration directories", () => {
  const root = makeRoot();
  addMigration(root, "20261101090000_extra_file", "-- test\n", [["notes.txt", "review required"]]);

  const result = inspectMigrationLayout({ migrationRoot: root, trackedMigrationFiles: [] });
  assert.ok(codes(result).includes("UNEXPECTED_MIGRATION_ENTRY"));
});

test("checks migration lock presence and the PostgreSQL provider", () => {
  const root = makeRoot();
  writeFileSync(join(root, "migration_lock.toml"), 'provider = "mysql"\n');
  const wrongProvider = inspectMigrationLayout({ migrationRoot: root, trackedMigrationFiles: [] });
  assert.ok(codes(wrongProvider).includes("MIGRATION_LOCK_PROVIDER"));

  rmSync(join(root, "migration_lock.toml"));
  const missingLock = inspectMigrationLayout({ migrationRoot: root, trackedMigrationFiles: [] });
  assert.ok(codes(missingLock).includes("MIGRATION_LOCK_MISSING"));
});

test("surfaces untracked migrations and repeated timestamps as warnings", () => {
  const root = makeRoot();
  addMigration(root, "20261101090000_first_step");
  addMigration(root, "20261101090000_second_step");

  const result = inspectMigrationLayout({ migrationRoot: root, trackedMigrationFiles: [] });
  assert.equal(result.findings.filter((item) => item.code === "UNTRACKED_MIGRATION").length, 2);
  assert.ok(codes(result).includes("DUPLICATE_MIGRATION_TIMESTAMP"));
  assert.ok(result.findings.every((item) => item.severity === "warning"));
});

test("a valid untracked migration is a visible warning, not a structural failure", () => {
  const root = makeRoot();
  addMigration(root, "20261101090000_untracked_source");

  const result = inspectMigrationLayout({ migrationRoot: root, trackedMigrationFiles: [] });
  assert.deepEqual(codes(result), ["UNTRACKED_MIGRATION"]);
  assert.equal(result.findings[0].severity, "warning");
  assert.equal(result.inventory[0].migrationSql, "present");
  assert.equal(result.inventory[0].tracked, false);
});

test("reports Git-tracked migration SQL missing from the working tree", () => {
  const root = makeRoot();
  const result = inspectMigrationLayout({
    migrationRoot: root,
    trackedMigrationFiles: ["20261101090000_deleted/migration.sql"],
  });
  assert.ok(codes(result).includes("TRACKED_MIGRATION_MISSING"));
});
