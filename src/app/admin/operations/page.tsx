import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

export const dynamic = "force-dynamic";

type LocalMigration = { name: string; hasSql: boolean };
type LedgerEntry = { migrationName: string; startedAt: Date; finishedAt: Date | null; rolledBackAt: Date | null; appliedStepsCount: number; hasLogs: boolean };

async function readLocalMigrations(): Promise<LocalMigration[] | null> {
  try {
    const root = path.join(process.cwd(), "prisma", "migrations");
    const entries = await readdir(root, { withFileTypes: true });
    const migrations: LocalMigration[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^\d{14}_.+/.test(entry.name)) continue;
      let hasSql = false;
      try { hasSql = (await stat(path.join(root, entry.name, "migration.sql"))).isFile(); } catch { /* missing migration SQL remains visible */ }
      migrations.push({ name: entry.name, hasSql });
    }
    return migrations.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return null;
  }
}

async function readMigrationLedger(): Promise<{ state: "available" | "missing" | "unavailable"; rows: LedgerEntry[] }> {
  try {
    const existence = await prisma.$queryRaw<Array<{ exists: boolean }>>`SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS "exists"`;
    if (!existence[0]?.exists) return { state: "missing", rows: [] };
    const rows = await prisma.$queryRaw<LedgerEntry[]>`SELECT migration_name AS "migrationName", started_at AS "startedAt", finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt", applied_steps_count AS "appliedStepsCount", (logs IS NOT NULL) AS "hasLogs" FROM public."_prisma_migrations" ORDER BY started_at DESC`;
    return { state: "available", rows };
  } catch {
    return { state: "unavailable", rows: [] };
  }
}

function MigrationState({ migration, ledgerRows, ledgerState }: { migration: LocalMigration; ledgerRows: LedgerEntry[]; ledgerState: "available" | "missing" | "unavailable" }) {
  if (!migration.hasSql) return <span className="text-amber-200">Unresolved · no migration.sql</span>;
  if (ledgerState !== "available") return <span className="text-[var(--admin-muted)]">{ledgerState === "missing" ? "Ledger absent" : "Ledger unavailable"}</span>;
  const attempts = ledgerRows.filter((row) => row.migrationName === migration.name);
  const latest = attempts[0];
  if (latest?.rolledBackAt || latest?.hasLogs || (latest && !latest.finishedAt)) return <span className="text-rose-200">Failed or incomplete latest attempt</span>;
  if (latest?.finishedAt) return <span className="text-emerald-200">Recorded as finished</span>;
  return <span className="text-amber-200">Not recorded as applied</span>;
}

export default async function AdminOperationsPage() {
  await requireSuperAdmin();
  const [database, ledger, localMigrations] = await Promise.all([
    prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1::int AS ok`.then(() => "available" as const).catch(() => "unavailable" as const),
    readMigrationLedger(),
    readLocalMigrations(),
  ]);
  const ledgerRows = ledger.rows;
  const unresolved = localMigrations?.filter((item) => !item.hasSql).length ?? null;
  const pending = localMigrations === null || ledger.state !== "available" ? null : localMigrations.filter((item) => item.hasSql && !ledgerRows.some((row) => row.migrationName === item.name && row.finishedAt && !row.rolledBackAt && !row.hasLogs)).length;
  const latestByMigration = new Map<string, LedgerEntry>();
  for (const row of ledgerRows) if (!latestByMigration.has(row.migrationName)) latestByMigration.set(row.migrationName, row);
  const failed = [...latestByMigration.values()].filter((row) => row.rolledBackAt || row.hasLogs || !row.finishedAt).length;

  return <main className="min-h-screen px-4 pb-16 pt-7 text-[var(--admin-text)] sm:px-6 sm:pt-10 lg:px-10">
    <div className="mx-auto w-full max-w-[1440px]">
      <header className="mb-7"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[var(--admin-accent)]">System & governance</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Platform operations</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">Read-only operational signals from this request and the configured application database. Unknown means unverified; it is never shown as healthy.</p></header>
      <section aria-label="Current system signals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LiquidLensSurface radius={22} className="p-5"><p className="text-xs uppercase tracking-wider text-[var(--admin-faint)]">Application</p><p className="mt-3 text-lg font-semibold text-emerald-200">Responding</p><p className="mt-2 text-xs leading-5 text-[var(--admin-muted)]">This protected page rendered successfully.</p></LiquidLensSurface>
        <LiquidLensSurface radius={22} className="p-5"><p className="text-xs uppercase tracking-wider text-[var(--admin-faint)]">Database query</p><p className={`mt-3 text-lg font-semibold ${database === "available" ? "text-emerald-200" : "text-rose-200"}`}>{database === "available" ? "Responding" : "Unavailable"}</p><p className="mt-2 text-xs leading-5 text-[var(--admin-muted)]">Read-only `SELECT 1` probe; no schema objects or records were changed.</p></LiquidLensSurface>
        <LiquidLensSurface radius={22} className="p-5"><p className="text-xs uppercase tracking-wider text-[var(--admin-faint)]">Migration ledger</p><p className="mt-3 text-lg font-semibold">{ledger.state === "available" ? "Readable" : ledger.state === "missing" ? "Not found" : "Unavailable"}</p><p className="mt-2 text-xs leading-5 text-[var(--admin-muted)]">{ledger.state === "available" ? `${ledgerRows.length} ledger rows · ${failed} failed or incomplete records` : "Migration state is not confirmed."}</p></LiquidLensSurface>
        <LiquidLensSurface radius={22} className="p-5"><p className="text-xs uppercase tracking-wider text-[var(--admin-faint)]">Recovery readiness</p><p className="mt-3 text-lg font-semibold text-amber-200">Not verified</p><p className="mt-2 text-xs leading-5 text-[var(--admin-muted)]">This application has no connected, verified backup inventory or restore-test signal.</p></LiquidLensSurface>
      </section>

      <section className="mt-8"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[var(--admin-faint)]">Read-only inventory</p><h2 className="mt-1 text-xl font-semibold">Local migration files and ledger records</h2></div><p className="text-xs text-[var(--admin-muted)]">Pending estimate: {pending ?? "unknown"} · empty folders: {unresolved ?? "unknown"}</p></div>
        {localMigrations === null ? <LiquidLensSurface radius={22} className="p-6 text-sm text-[var(--admin-muted)]">Local migration files are unavailable in this runtime. No deployment state is inferred from their absence.</LiquidLensSurface> : <LiquidLensSurface radius={22} intensity="subtle" className="overflow-hidden p-0"><ul className="divide-y divide-[var(--admin-line)]">{localMigrations.map((migration) => <li key={migration.name} className="flex flex-col gap-2 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6"><code className="break-all text-[var(--admin-muted)]">{migration.name}</code><span>{MigrationState({ migration, ledgerRows, ledgerState: ledger.state })}</span></li>)}</ul></LiquidLensSurface>}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2"><LiquidLensSurface radius={22} className="p-5"><h2 className="font-semibold">Known operational limits</h2><ul className="mt-3 grid gap-2 text-xs leading-5 text-[var(--admin-muted)]"><li>Database reachability here is only a lightweight query check; it does not prove every application model or route works.</li><li>Migration rows marked finished are ledger evidence, not proof that every expected object exists.</li><li>Storage, background jobs, notification delivery and API health have no independent live probes on this page.</li></ul></LiquidLensSurface><LiquidLensSurface radius={22} className="p-5"><h2 className="font-semibold">Recovery and accountability</h2><p className="mt-3 text-xs leading-5 text-[var(--admin-muted)]">Backups outside the running application are not inventoried or validated here. Archive listing alone would not prove restore success.</p><Link href="/admin/audit" className="mt-4 inline-flex min-h-10 items-center rounded-full border border-[var(--admin-line)] px-4 text-xs font-medium hover:bg-white/[.06]">Open administrative audit history</Link></LiquidLensSurface></section>
    </div>
  </main>;
}
