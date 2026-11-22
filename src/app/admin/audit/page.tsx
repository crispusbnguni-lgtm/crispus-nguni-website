import Link from "next/link";
import { requireSuperAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
type AuditEntry = { id: string; action: string; actorUserId: string | null; targetType: string | null; targetId: string | null; createdAt: Date };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSuperAdmin();
  const params = await searchParams;
  const rawQuery = params.q;
  const rawPage = params.page;
  const query = typeof rawQuery === "string" ? rawQuery.trim().slice(0, 100) : "";
  const parsedPage = typeof rawPage === "string" && /^\d{1,5}$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Math.max(1, parsedPage);
  const where = query ? {
    action: { contains: query, mode: "insensitive" as const },
  } : {};

  let entries: AuditEntry[] = [];
  let total: number | null = null;
  let unavailable = false;
  let pages = 1;
  let currentPage = 1;
  try {
    total = await prisma.auditLog.count({ where });
    pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(page, pages);
    entries = await prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, action: true, actorUserId: true, targetType: true, targetId: true, createdAt: true },
      });
  } catch {
    unavailable = true;
  }
  const href = (nextPage: number) => `/admin/audit?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(nextPage) })}`;

  return <main className="min-h-screen px-4 pb-16 pt-7 text-[var(--admin-text)] sm:px-6 sm:pt-10 lg:px-10">
    <div className="mx-auto w-full max-w-[1440px]">
      <header className="mb-7"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[var(--admin-accent)]">Accountability</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Administrative audit history</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--admin-muted)]">A privacy-conscious record of administrative actions. This view shows action, actor identifier, target and time; event metadata and private content are intentionally omitted.</p></header>
      <LiquidLensSurface radius={24} intensity="subtle" className="mb-5 p-4 sm:p-5">
        <form method="get" className="flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="audit-search">Search actions</label><input id="audit-search" name="q" defaultValue={query} maxLength={100} placeholder="Search action names" className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--admin-line)] bg-black/10 px-4 text-sm outline-none focus:border-[var(--admin-accent)]"/><button className="min-h-11 rounded-xl border border-[var(--admin-line)] px-5 text-sm font-medium hover:bg-white/[.06]">Search</button></form>
      </LiquidLensSurface>
      {unavailable ? <LiquidLensSurface radius={24} className="p-8 text-sm text-[var(--admin-muted)]" role="status">Audit history is unavailable. No audit data was modified.</LiquidLensSurface> : entries.length === 0 ? <LiquidLensSurface radius={24} className="p-8 text-sm text-[var(--admin-muted)]">No matching administrative events were found.</LiquidLensSurface> : <LiquidLensSurface radius={24} intensity="subtle" className="overflow-hidden p-0">
        <ul className="divide-y divide-[var(--admin-line)]">{entries.map((entry) => <li key={entry.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:px-7">
          <div className="min-w-0"><p className="break-words text-sm font-semibold">{entry.action}</p><p className="mt-1 text-xs text-[var(--admin-muted)]">{entry.targetType ?? "Platform action"}{entry.targetId ? ` · ${entry.targetId.slice(0, 48)}` : ""}</p></div>
          <p className="truncate text-xs text-[var(--admin-muted)]" title={entry.actorUserId ?? undefined}>Actor: {entry.actorUserId ? entry.actorUserId.slice(0, 20) : "system or deleted account"}</p>
          <time className="text-xs tabular-nums text-[var(--admin-faint)]" dateTime={entry.createdAt.toISOString()}>{dateFormatter.format(entry.createdAt)}</time>
        </li>)}</ul>
        <footer className="flex items-center justify-between gap-3 border-t border-[var(--admin-line)] px-5 py-4 text-xs text-[var(--admin-muted)] sm:px-7"><span>{total?.toLocaleString() ?? "—"} matching events · page {currentPage} of {pages}</span><div className="flex gap-2"><Link aria-disabled={currentPage <= 1} className={`rounded-lg border border-[var(--admin-line)] px-3 py-2 ${currentPage <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white/[.06]"}`} href={href(Math.max(1, currentPage - 1))}>Previous</Link><Link aria-disabled={currentPage >= pages} className={`rounded-lg border border-[var(--admin-line)] px-3 py-2 ${currentPage >= pages ? "pointer-events-none opacity-40" : "hover:bg-white/[.06]"}`} href={href(Math.min(pages, currentPage + 1))}>Next</Link></div></footer>
      </LiquidLensSurface>}
      <p className="mt-5 text-xs leading-5 text-[var(--admin-faint)]">AuditLog uses the current application schema. Access is restricted to the Super Admin page boundary; this view exposes no action payloads or secret-bearing metadata.</p>
    </div>
  </main>;
}
