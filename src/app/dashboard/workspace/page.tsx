import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Compass, ListTodo, Sparkles, FolderKanban, Database, CheckSquare2 } from "lucide-react";
import { requireUser } from "@/lib/authorization";
import { getPersonalWorkspaceOverview } from "@/lib/personal-workspace-overview";
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  parseWorkspacePreferences,
  type WorkspacePreferences,
} from "@/lib/personal-workspace-core";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { WorkspaceSetup } from "@/components/workspace/WorkspaceSetup";
import { WorkspaceSectionNav } from "@/components/workspace/WorkspaceSectionNav";
import { getWorkspacePlanningSummary } from "@/lib/personal-workspace-planning";

export const dynamic = "force-dynamic";

function formatDate(date: Date, timezone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-KE", { ...options, timeZone: timezone }).format(date);
}

function friendlyDateLabel(date: Date, today: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const key = `${values.year}-${values.month}-${values.day}`;
  return key === today ? "Today" : formatDate(date, timezone, { weekday: "short", month: "short", day: "numeric" });
}

function statusLabel(status: string) {
  return status === "PENDING" ? "Awaiting confirmation" : "Confirmed";
}

function preferenceSnapshot(workspace: Awaited<ReturnType<typeof getPersonalWorkspaceOverview>>["workspace"]): WorkspacePreferences {
  if (!workspace) return DEFAULT_WORKSPACE_PREFERENCES;
  const candidate = {
    mode: workspace.mode,
    focusAreas: workspace.focusAreas,
    timezone: workspace.timezone,
    workingHoursStart: workspace.workingHoursStart,
    workingHoursEnd: workspace.workingHoursEnd,
    breakMinutes: workspace.breakMinutes,
    weekStartsOn: workspace.weekStartsOn,
  };
  const parsed = parseWorkspacePreferences(candidate);
  return parsed.success ? parsed.preferences : DEFAULT_WORKSPACE_PREFERENCES;
}

export default async function PersonalWorkspacePage() {
  const user = await requireUser();
  const [overview, planning] = await Promise.all([getPersonalWorkspaceOverview(user.id), getWorkspacePlanningSummary(user.id)]);
  const preferences = preferenceSnapshot(overview.workspace);
  const configured = Boolean(overview.workspace?.onboardingCompletedAt);
  const firstName = user.name?.trim().split(/\s+/)[0] || "there";
  const now = new Date();
  const todayAppointments = overview.appointments.filter(
    (appointment) => appointment.scheduledAt >= overview.todayRange.startDate && appointment.scheduledAt < overview.todayRange.endDate,
  );
  const upcomingAppointments = overview.appointments.filter((appointment) => appointment.scheduledAt >= now);

  return (
    <div className="min-h-screen px-4 pb-20 pt-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-7">
        <header className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#D9A441]">
              <Sparkles size={14} aria-hidden="true" /> Personal Intelligence Workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Good day, {firstName}.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
              Your private overview brings together your tasks, projects, databases and existing commitments.
            </p>
            <Link href="/dashboard/workspace/pages" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D9A441]/35 bg-[#D9A441]/10 px-5 text-sm font-semibold text-[#F2CF86] transition hover:bg-[#D9A441]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]">
              Open my pages <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <LiquidLensSurface radius={22} className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/50">Your day</p>
            <p className="mt-2 text-xl font-semibold">{formatDate(now, overview.timezone, { weekday: "long", month: "long", day: "numeric" })}</p>
            <p className="mt-1 text-sm text-white/55">Times shown in {overview.timezone}</p>
          </LiquidLensSurface>
        </header>

        <WorkspaceSectionNav active="overview" />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" aria-label="Personal planning summary">
          <SummaryCard icon={<CheckSquare2 size={18} />} label="Open tasks" value={planning.openTasks} detail="Across your workspace" />
          <SummaryCard icon={<CalendarDays size={18} />} label="Due today" value={planning.dueToday} detail="Open tasks due today" />
          <SummaryCard icon={<Clock3 size={18} />} label="Overdue" value={planning.overdueTasks} detail="Open tasks past due" />
          <SummaryCard icon={<CalendarDays size={18} />} label="Next 7 days" value={planning.upcomingDeadlines} detail="Upcoming task deadlines" />
          <SummaryCard icon={<FolderKanban size={18} />} label="Active projects" value={planning.activeProjects.length} detail="Progress from live tasks and milestones" />
          <SummaryCard icon={<Database size={18} />} label="Databases" value={planning.databases} detail="Private collections" />
        </section>

        <section className="grid gap-4 lg:grid-cols-2" aria-label="Active projects and recent databases">
          <LiquidLensSurface radius={22} className="p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Project progress</h2><Link href="/dashboard/workspace/projects" className="text-sm text-[#F2CF86]">All projects</Link></div><div className="mt-3 grid gap-3">{planning.activeProjects.map((project) => { const total = project.progress.taskCount + project.progress.milestoneCount; const complete = project.progress.completedTasks + project.progress.completedMilestones; const percent = total ? Math.round(complete / total * 100) : 0; return <Link href={`/dashboard/workspace/projects/${project.id}`} key={project.id} className="rounded-xl border border-white/10 p-3 transition hover:bg-white/[.04]"><div className="flex justify-between gap-3"><span className="truncate text-sm font-medium">{project.name}</span><span className="text-xs text-white/45">{percent}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#D9A441]" style={{ width: `${percent}%` }}/></div></Link>; })}{!planning.activeProjects.length && <p className="py-3 text-sm text-white/45">No active projects yet.</p>}</div></LiquidLensSurface>
          <LiquidLensSurface radius={22} className="p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Recently updated databases</h2><Link href="/dashboard/workspace/databases" className="text-sm text-[#F2CF86]">All databases</Link></div><div className="mt-3 grid gap-2">{planning.recentDatabases.map((database) => <Link key={database.id} href="/dashboard/workspace/databases" className="rounded-xl border border-white/10 p-3 text-sm transition hover:bg-white/[.04]">{database.name}<span className="mt-1 block text-xs text-white/40">Updated {formatDate(database.updatedAt, overview.timezone, { dateStyle: "medium" })}</span></Link>)}{!planning.recentDatabases.length && <p className="py-3 text-sm text-white/45">Your personal databases will appear here.</p>}</div></LiquidLensSurface>
        </section>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard icon={<CalendarDays size={18} />} label="Today's consultations" value={overview.todayAppointmentCount} detail="Existing bookings on your portfolio" />
          <SummaryCard icon={<Clock3 size={18} />} label="Next 7 days" value={overview.upcomingAppointmentCount} detail="Pending and confirmed records" />
          <SummaryCard icon={<ListTodo size={18} />} label="Follow-ups needing attention" value={overview.followUpCount} detail={overview.overdueFollowUpCount ? `${overview.overdueFollowUpCount} overdue` : "Due by the end of today"} />
        </div>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <LiquidLensSurface radius={24} className="overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-white/10 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.17em] text-white/45">Authoritative bookings</p>
                <h2 className="mt-2 text-xl font-semibold">Your agenda</h2>
              </div>
              <Link href="/dashboard/consultations" className="inline-flex min-h-10 items-center gap-2 text-sm text-[#E6C270] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]">
                Manage consultations <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            {todayAppointments.length ? (
              <ul className="divide-y divide-white/[0.08]">
                {todayAppointments.slice(0, 6).map((appointment) => (
                  <li key={appointment.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{appointment.title}</p>
                      <p className="mt-1 text-sm text-white/55">{appointment.consultationType.title} · {statusLabel(appointment.status)}</p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-sm font-medium">{formatDate(appointment.scheduledAt, overview.timezone, { timeStyle: "short" })}</p>
                      <p className="mt-1 text-xs text-white/45">{appointment.durationMinutes} minutes · {appointment.timezone}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-7 sm:p-9">
                <p className="font-medium">No consultations are scheduled for today.</p>
                <p className="mt-2 text-sm leading-6 text-white/55">When a booking is created for your portfolio, it will appear here directly from the existing consultation record.</p>
              </div>
            )}
            {overview.upcomingAppointmentCount > upcomingAppointments.filter((item) => item.scheduledAt >= now).length && (
              <div className="border-t border-white/[0.08] px-5 py-4 text-sm text-white/55 sm:px-6">
                Showing a selection from your upcoming bookings. <Link href="/dashboard/consultations" className="text-[#E6C270] underline underline-offset-4">View the full schedule</Link>
              </div>
            )}
          </LiquidLensSurface>

          <LiquidLensSurface radius={24} className="overflow-hidden">
            <div className="flex items-end justify-between gap-3 border-b border-white/10 p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.17em] text-white/45">From your CRM</p>
                <h2 className="mt-2 text-xl font-semibold">Follow-ups</h2>
              </div>
              <Link href="/dashboard/leads" aria-label="Manage lead follow-ups" className="rounded-full p-2 text-[#E6C270] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"><ArrowRight size={18} /></Link>
            </div>
            {overview.followUps.length ? (
              <ul className="divide-y divide-white/[0.08]">
                {overview.followUps.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="mt-1 text-xs text-white/50">{item.temperature.toLowerCase()} · {item.status.toLowerCase()}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-xs font-semibold ${item.nextFollowUpAt && item.nextFollowUpAt < now ? "text-amber-300" : "text-white/70"}`}>
                        {item.nextFollowUpAt ? friendlyDateLabel(item.nextFollowUpAt, overview.today, overview.timezone) : "Due"}
                      </p>
                      {item.nextFollowUpAt && <p className="mt-1 text-xs text-white/45">{formatDate(item.nextFollowUpAt, overview.timezone, { timeStyle: "short" })}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-7 sm:p-9">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200"><CheckCircle2 size={20} /></div>
                <p className="mt-4 font-medium">Nothing needs a follow-up today.</p>
                <p className="mt-2 text-sm leading-6 text-white/55">When you schedule a lead follow-up in the CRM, this view will surface it here.</p>
              </div>
            )}
          </LiquidLensSurface>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <LiquidLensSurface radius={24} className="p-5 sm:p-6">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.17em] text-[#D9A441]"><Compass size={14} /> Workspace direction</p>
            <h2 className="mt-3 text-xl font-semibold">A space shaped around you</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {configured
                ? `Your ${preferences.mode.toLowerCase().replaceAll("_", " ")} workspace is set to ${preferences.timezone}. Your planning preferences stay separate from your public portfolio and Super Admin display defaults.`
                : "Choose what matters to you. This setup is private to your account and does not change your public portfolio or global display settings."}
            </p>
            {overview.portfolioName && <p className="mt-4 text-xs text-white/40">Connected source: {overview.portfolioName}</p>}
          </LiquidLensSurface>
          <LiquidLensSurface radius={24} className="p-5 sm:p-6">
            <WorkspaceSetup
              initialPreferences={preferences}
              initialRevision={overview.workspace?.revision ?? null}
              configured={configured}
            />
          </LiquidLensSurface>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/15 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-white/50"><Sparkles size={17} aria-hidden="true" /></div>
            <div>
              <h2 className="font-semibold">A careful foundation</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-white/55">
                The agenda reads existing consultations and CRM follow-ups. Tasks, project milestones, custom databases and pages are stored as private workspace data and remain separate from your public portfolio.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail: string }) {
  return (
    <LiquidLensSurface radius={20} className="flex min-h-32 items-start gap-4 p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#E6C270]">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.12em] text-white/50">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-white/45">{detail}</p>
      </div>
    </LiquidLensSurface>
  );
}
