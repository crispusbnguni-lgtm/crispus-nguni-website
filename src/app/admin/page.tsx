import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  Clock3,
  FileText,
  Image,
  MonitorCog,
  PanelsTopLeft,
  ShieldCheck,
  ScrollText,
  UsersRound,
} from "lucide-react";
import { AdminReveal } from "@/components/admin/AdminReveal";
import styles from "@/components/admin/AdminShell.module.css";
import { DisplayStudioEditor } from "@/components/admin/DisplayStudioEditor";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { requireSuperAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const activityLabels: Readonly<Record<string, string>> = {
  ADMIN_SESSION_REVOKED: "Session revoked",
  ADMIN_CMS_DRAFT_SAVED: "Welcome Page draft saved",
  ADMIN_CMS_PUBLISHED: "Welcome Page published",
  ADMIN_CMS_VERSION_RESTORED: "Welcome Page version restored",
  ADMIN_CMS_SCHEDULED: "Welcome Page publication scheduled",
  ADMIN_CMS_SCHEDULE_CANCELLED: "Welcome Page schedule cancelled",
  ADMIN_BACKGROUND_CREATED: "Background created",
  ADMIN_BACKGROUND_UPDATED: "Background updated",
  ADMIN_BACKGROUND_DELETED: "Background deleted",
  ADMIN_BACKGROUND_MEDIA_UPLOADED: "Background media uploaded",
  ADMIN_BACKGROUND_MEDIA_DELETED: "Background media deleted",
  ADMIN_DISPLAY_STUDIO_UPDATED: "Display Studio updated",
  ADMIN_PORTFOLIO_UPDATED: "Portfolio updated",
  ADMIN_PORTFOLIO_RESOURCE_CREATED: "Portfolio resource created",
  ADMIN_PORTFOLIO_RESOURCE_UPDATED: "Portfolio resource updated",
  ADMIN_PORTFOLIO_RESOURCE_DELETED: "Portfolio resource deleted",
};

const snapshotFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function MetricCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
  delay,
}: {
  label: string;
  value: number | null;
  detail: string;
  href: string;
  icon: typeof UsersRound;
  delay: number;
}) {
  return (
    <AdminReveal delay={delay} hover>
      <Link href={href} className="group block h-full rounded-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent">
        <LiquidLensSurface
          radius={24}
          intensity="subtle"
          className="h-full min-h-[158px] border border-[var(--admin-line)] bg-[var(--admin-panel)] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.12)] transition-colors group-hover:border-blue-400/30 sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">{label}</span>
            <span className="grid h-9 w-9 place-items-center rounded-[13px] border border-blue-300/15 bg-blue-400/[0.08] text-[var(--admin-accent)] transition-transform group-hover:scale-105">
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-5 text-4xl font-semibold tabular-nums tracking-[-0.045em] text-[var(--admin-text)]">
            {value === null ? <span className="text-lg font-medium text-[var(--admin-faint)]">Unavailable</span> : value.toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-[var(--admin-faint)]">{detail}</p>
        </LiquidLensSurface>
      </Link>
    </AdminReveal>
  );
}

function QuickAction({
  href,
  eyebrow,
  title,
  detail,
  icon: Icon,
  delay,
}: {
  href: string;
  eyebrow: string;
  title: string;
  detail: string;
  icon: typeof FileText;
  delay: number;
}) {
  return (
    <AdminReveal delay={delay} hover>
      <Link href={href} className={`group block h-full rounded-[22px] ${styles.actionLink}`}>
        <LiquidLensSurface radius={22} intensity="subtle" className={styles.actionSurface}>
          <div className="flex h-full min-h-[132px] items-start gap-4 p-5 sm:p-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] border border-white/10 bg-white/[0.045] text-[var(--admin-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]">
              <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--admin-faint)]">{eyebrow}</span>
              <span className="mt-2 flex items-center justify-between gap-2 text-sm font-semibold text-[var(--admin-text)]">
                {title}<ArrowUpRight size={15} className="shrink-0 text-[var(--admin-faint)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--admin-accent)]" aria-hidden="true" />
              </span>
              <span className="mt-1.5 block text-xs leading-5 text-[var(--admin-muted)]">{detail}</span>
            </span>
          </div>
        </LiquidLensSurface>
      </Link>
    </AdminReveal>
  );
}

export default async function AdminPage() {
  const admin = await requireSuperAdmin();
  const generatedAt = new Date();

  const [totalUsersResult, publishedResult, draftResult, activeSessionsResult, activityResult] =
    await Promise.allSettled([
      prisma.user.count(),
      prisma.portfolioSite.count({ where: { published: true } }),
      prisma.portfolioSite.count({ where: { published: false } }),
      prisma.userSession.count({
        where: { revokedAt: null, expiresAt: { gt: generatedAt } },
      }),
      prisma.auditLog.findMany({
        where: { action: { startsWith: "ADMIN_" } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          action: true,
          targetType: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      }),
    ] as const);

  const totalUsers = totalUsersResult.status === "fulfilled" ? totalUsersResult.value : null;
  const publishedSites = publishedResult.status === "fulfilled" ? publishedResult.value : null;
  const draftSites = draftResult.status === "fulfilled" ? draftResult.value : null;
  const activeSessions = activeSessionsResult.status === "fulfilled" ? activeSessionsResult.value : null;
  const recentActivity = activityResult.status === "fulfilled" ? activityResult.value : null;

  return (
    <main className="min-h-screen min-w-0 px-4 pb-16 pt-7 text-[var(--admin-text)] sm:px-6 sm:pt-10 lg:px-10">
      <div className="mx-auto w-full max-w-[1440px]">
        <AdminReveal>
          <LiquidLensSurface radius={30} intensity="medium" className={styles.heroSurface}>
            <header className="relative isolate px-6 py-7 sm:px-9 sm:py-9 lg:px-11 lg:py-11">
            <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-[var(--admin-accent-soft)] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.17em] text-[var(--admin-accent)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-accent)] shadow-[0_0_12px_rgba(125,184,255,0.65)]" />
                  Administrative overview
                </div>
                <h1 className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-[var(--admin-text)] sm:text-4xl lg:text-[2.8rem]">
                  Welcome back, {admin.name?.trim() || "Super Admin"}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--admin-muted)] sm:text-base sm:leading-7">
                  A clear view of the account, portfolio, and content controls available to you.
                </p>
                <p className="mt-5 inline-flex items-center gap-2 text-[11px] text-[var(--admin-faint)]">
                  <Clock3 size={14} aria-hidden="true" />
                  Live database snapshot · {snapshotFormatter.format(generatedAt)}
                </p>
              </div>
              <Link href="/admin/accounts" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[15px] border border-blue-300/30 bg-blue-500/20 px-5 py-3 text-sm font-semibold text-[var(--admin-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:border-blue-300/55 hover:bg-blue-500/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                Open account directory <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            </header>
          </LiquidLensSurface>
        </AdminReveal>

        <section aria-labelledby="platform-snapshot-heading" className="mt-9">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--admin-faint)]">Platform snapshot</p>
              <h2 id="platform-snapshot-heading" className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--admin-text)]">Current operating picture</h2>
            </div>
            <span className="text-[10px] text-[var(--admin-faint)]">Counts are queried on page load</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
            <MetricCard label="Registered accounts" value={totalUsers} detail="All user accounts" href="/admin/accounts" icon={UsersRound} delay={0.04} />
            <MetricCard label="Published portfolios" value={publishedSites} detail="Portfolio sites marked published" href="/admin/accounts" icon={PanelsTopLeft} delay={0.09} />
            <MetricCard label="Draft portfolios" value={draftSites} detail="Portfolio sites not published" href="/admin/accounts" icon={FileText} delay={0.14} />
            <MetricCard label="Active sessions" value={activeSessions} detail="Unrevoked sessions that have not expired" href="/admin/sessions" icon={ShieldCheck} delay={0.19} />
          </div>
        </section>

        <section aria-labelledby="admin-actions-heading" className="mt-10">
          <div className="mb-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--admin-faint)]">Available controls</p>
            <h2 id="admin-actions-heading" className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--admin-text)]">Go to a workspace</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <QuickAction href="/admin/accounts" eyebrow="People & access" title="All Accounts" detail="Search accounts, review portfolio status, and open account management." icon={UsersRound} delay={0.05} />
            <QuickAction href="/admin/sessions" eyebrow="Security" title="Sessions & Devices" detail="Review active sessions and revoke a selected session." icon={ShieldCheck} delay={0.1} />
            <QuickAction href="/admin/backgrounds/welcome-page" eyebrow="Content governance" title="Welcome Page Editor" detail="Edit, preview, restore, or schedule public homepage content." icon={FileText} delay={0.15} />
            <QuickAction href="/admin/backgrounds" eyebrow="Content & experience" title="Background Library" detail="Manage shared portfolio backgrounds and their defaults." icon={Image} delay={0.2} />
            <QuickAction href="#display-studio" eyebrow="Global appearance" title="Display Studio" detail="Configure shared display defaults and inspect the live preview." icon={MonitorCog} delay={0.25} />
            <QuickAction href="/admin/audit" eyebrow="Accountability" title="Audit History" detail="Search administrative events without exposing private metadata." icon={ScrollText} delay={0.3} />
            <QuickAction href="/admin/operations" eyebrow="System & governance" title="Platform Operations" detail="Review read-only database, migration and recovery signals." icon={Activity} delay={0.35} />
          </div>
        </section>

        <section aria-labelledby="activity-heading" className="mt-10">
          <LiquidLensSurface radius={26} intensity="subtle" className="overflow-hidden border border-[var(--admin-line)] bg-[var(--admin-panel)] p-0">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-5 sm:px-7">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--admin-faint)]">AuditLog · recent entries</p>
                <h2 id="activity-heading" className="mt-1.5 text-lg font-semibold text-[var(--admin-text)]">Administrative activity</h2>
              </div>
              <p className="text-[10px] text-[var(--admin-faint)]">Action, resource type, actor name, and time only</p>
            </div>
            {recentActivity === null ? (
              <p className="px-5 py-7 text-sm text-[var(--admin-muted)] sm:px-7">Activity is temporarily unavailable. Other overview counts remain independent.</p>
            ) : recentActivity.length === 0 ? (
              <p className="px-5 py-7 text-sm text-[var(--admin-muted)] sm:px-7">No administrative activity has been recorded yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--admin-line)]">
                {recentActivity.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--admin-text)]">{activityLabels[entry.action] ?? "Administrative action"}</p>
                      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">
                        {entry.targetType ? `Resource: ${entry.targetType}` : "Platform action"}
                        {entry.actor?.name ? ` · by ${entry.actor.name}` : ""}
                      </p>
                    </div>
                    <time dateTime={entry.createdAt.toISOString()} className="shrink-0 text-[10px] tabular-nums text-[var(--admin-faint)]">
                      {snapshotFormatter.format(entry.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </LiquidLensSurface>
        </section>

        <section id="display-studio" aria-labelledby="display-studio-heading" className="scroll-mt-24 pt-12">
          <div className="mb-5">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--admin-accent)]">Global appearance</p>
              <h2 id="display-studio-heading" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--admin-text)] sm:text-3xl">Display Studio</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">Configure shared visual defaults, glass effects, typography, accessibility, and motion.</p>
            </div>
          </div>
          <DisplayStudioEditor />
        </section>

        <p className="mt-10 text-center text-[10px] text-[var(--admin-faint)]">
          This overview includes only data and administrative destinations currently available in the application.
        </p>
      </div>
    </main>
  );
}
