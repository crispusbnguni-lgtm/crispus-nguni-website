import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MIGRATION_NAME = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)$/;
const LOCK_PROVIDER = /^\s*provider\s*=\s*["']([^"']+)["']\s*$/m;

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function validTimestamp(value) {
  if (!/^\d{14}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));
  const second = Number(value.slice(12, 14));

  if (year < 1000 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function finding(severity, code, message) {
  return { severity, code, message };
}

/**
 * Inspect a local Prisma migration tree without opening a database or executing SQL.
 * trackedMigrationFiles contains paths relative to migrationRoot, as returned by Git.
 */
export function inspectMigrationLayout({ migrationRoot, trackedMigrationFiles = null }) {
  const findings = [];
  const inventory = [];
  const root = resolve(migrationRoot);

  if (!existsSync(root)) {
    return {
      inventory,
      findings: [finding("error", "MIGRATION_ROOT_MISSING", `Migration directory does not exist: ${root}`)],
    };
  }

  const lockPath = join(root, "migration_lock.toml");
  if (!existsSync(lockPath)) {
    findings.push(finding("error", "MIGRATION_LOCK_MISSING", "prisma/migrations/migration_lock.toml is missing."));
  } else {
    const lock = readFileSync(lockPath, "utf8");
    const provider = lock.match(LOCK_PROVIDER)?.[1];
    if (provider !== "postgresql") {
      findings.push(finding("error", "MIGRATION_LOCK_PROVIDER", "Migration lock provider must be postgresql."));
    }
  }

  const rootEntries = readdirSync(root, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!entry.isDirectory() && entry.name !== "migration_lock.toml") {
      findings.push(finding("error", "UNEXPECTED_MIGRATION_ROOT_ENTRY", `Unexpected entry under prisma/migrations: ${entry.name}`));
    }
  }

  const directories = rootEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const namesByFoldedValue = new Map();
  const namesByTimestamp = new Map();
  const directoryNames = new Set(directories.map((name) => name.toLowerCase()));

  for (const name of directories) {
    const match = name.match(MIGRATION_NAME);
    if (!match || !validTimestamp(match[1])) {
      findings.push(finding("error", "INVALID_MIGRATION_NAME", `Migration directory has an invalid timestamp/name: ${name}`));
    } else {
      const previous = namesByFoldedValue.get(name.toLowerCase());
      if (previous) {
        findings.push(finding("error", "DUPLICATE_MIGRATION_NAME", `Migration directory names differ only by case: ${previous} and ${name}`));
      } else {
        namesByFoldedValue.set(name.toLowerCase(), name);
      }
      const timestampNames = namesByTimestamp.get(match[1]) ?? [];
      timestampNames.push(name);
      namesByTimestamp.set(match[1], timestampNames);
    }

    const directoryPath = join(root, name);
    const entries = readdirSync(directoryPath, { withFileTypes: true });
    const sqlEntry = entries.find((entry) => entry.isFile() && entry.name === "migration.sql");
    const migrationPath = join(directoryPath, "migration.sql");
    let sqlStatus = "missing";

    if (entries.length === 0) {
      sqlStatus = "empty-directory";
      findings.push(finding("error", "EMPTY_MIGRATION_DIRECTORY", `Empty migration directory requires provenance review: ${name}`));
    } else if (!sqlEntry) {
      findings.push(finding("error", "MIGRATION_SQL_MISSING", `Non-empty migration directory has no migration.sql: ${name}`));
    } else {
      sqlStatus = "present";
      if (entries.length !== 1) {
        const extras = entries.filter((entry) => entry.name !== "migration.sql").map((entry) => entry.name).join(", ");
        findings.push(finding("error", "UNEXPECTED_MIGRATION_ENTRY", `Migration directory must contain only migration.sql: ${name} (${extras})`));
      }
      if (statSync(migrationPath).size === 0) {
        sqlStatus = "zero-byte-sql";
        findings.push(finding("error", "EMPTY_MIGRATION_SQL", `migration.sql is empty: ${name}`));
      }
    }

    const relativeSqlPath = normalizePath(relative(root, migrationPath));
    let tracked = null;
    if (trackedMigrationFiles !== null) {
      const trackedSet = new Set([...trackedMigrationFiles].map(normalizePath));
      tracked = trackedSet.has(relativeSqlPath);
      if (sqlStatus === "present" && !tracked) {
        findings.push(finding("warning", "UNTRACKED_MIGRATION", `Migration SQL is not in Git's tracked source history: ${name}`));
      }
    }

    inventory.push({ name, migrationSql: sqlStatus, tracked });
  }

  for (const [timestamp, names] of namesByTimestamp) {
    if (names.length > 1) {
      findings.push(finding("warning", "DUPLICATE_MIGRATION_TIMESTAMP", `Multiple directories share timestamp ${timestamp}; review their lexical order: ${names.join(", ")}`));
    }
  }

  if (trackedMigrationFiles !== null) {
    for (const trackedPath of trackedMigrationFiles) {
      const normalized = normalizePath(trackedPath);
      const match = normalized.match(/^([^/]+)\/migration\.sql$/);
      if (!match) continue;
      const name = match[1];
      if (!directoryNames.has(name.toLowerCase()) || !existsSync(join(root, name, "migration.sql"))) {
        findings.push(finding("error", "TRACKED_MIGRATION_MISSING", `Git-tracked migration SQL is missing from the working tree: ${normalized}`));
      }
    }
  } else {
    findings.push(finding("warning", "GIT_INVENTORY_UNAVAILABLE", "Git tracking state is unavailable; migration tracking was not compared."));
  }

  return { inventory, findings };
}

function readTrackedMigrationFiles(repositoryRoot) {
  const output = execFileSync("git", ["ls-files", "--", "prisma/migrations"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output
    .split(/\r?\n/)
    .filter((line) => line.startsWith("prisma/migrations/") && line.endsWith("/migration.sql"))
    .map((line) => line.slice("prisma/migrations/".length));
}

function run() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = resolve(scriptDirectory, "..");
  const migrationRoot = join(repositoryRoot, "prisma", "migrations");
  let trackedMigrationFiles;
  try {
    trackedMigrationFiles = readTrackedMigrationFiles(repositoryRoot);
  } catch {
    trackedMigrationFiles = null;
  }

  const { inventory, findings } = inspectMigrationLayout({ migrationRoot, trackedMigrationFiles });
  for (const item of inventory) {
    console.log(`${item.migrationSql === "present" ? "SQL" : item.migrationSql.toUpperCase()} ${item.name}${item.tracked === false ? " [untracked]" : ""}`);
  }
  for (const item of findings) {
    console.log(`${item.severity.toUpperCase()} ${item.code}: ${item.message}`);
  }

  const errors = findings.filter((item) => item.severity === "error").length;
  const warnings = findings.filter((item) => item.severity === "warning").length;
  console.log(`Migration integrity: ${errors} error(s), ${warnings} warning(s), ${inventory.length} directory/directories inspected.`);
  if (errors > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run();
}
