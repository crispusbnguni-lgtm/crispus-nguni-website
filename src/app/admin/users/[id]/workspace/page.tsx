import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/authorization";
import { resolveAdminAuditActor, writeAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { getPersonalWorkspaceOverview } from "@/lib/personal-workspace-overview";
import { getWorkspacePlanningSummary, listWorkspaceProjects, listWorkspaceTasks } from "@/lib/personal-workspace-planning";
import { getWorkspacePage, listWorkspacePages } from "@/lib/personal-workspace-pages";
import { listWorkspaceDatabaseRecords, listWorkspaceDatabases } from "@/lib/personal-workspace-databases";
import { getAcademicProfile, listAcademicActivities, listAcademicCourses, listAcademicYears, listTimetableRules } from "@/lib/personal-workspace-academics";
import { getPersonalFinance } from "@/lib/personal-workspace-finance";
import { getNutritionDashboard } from "@/lib/personal-workspace-nutrition";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };
type ViewerSection = { title: string; value: unknown; unavailable?: boolean };

async function readSection(title: string, read: () => Promise<unknown>): Promise<ViewerSection> {
  try { return { title, value: await read() }; }
  catch { return { title, value: "This section could not be loaded. Check schema readiness and application logs.", unavailable: true }; }
}

export default async function AdminUserWorkspacePage({ params }: Props) {
  await requireSuperAdmin();
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, accountStatus: true } });
  if (!user) notFound();

  // Log privileged access before loading any workspace content. Fail closed if the audit write fails.
  const actor = await resolveAdminAuditActor();
  await writeAdminAudit(actor, { action: "ADMIN_ACCOUNT_VIEWED", targetType: "User", targetId: user.id, metadata: { changedFields: ["personalWorkspace"] }, reason: "ADMIN_REQUEST", outcome: "SUCCEEDED" });

  const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: user.id }, select: { id: true, mode: true, focusAreas: true, timezone: true, workingHoursStart: true, workingHoursEnd: true, breakMinutes: true, weekStartsOn: true, intelligencePermissions: true, intelligenceDismissedIds: true, intelligenceFeedback: true, onboardingCompletedAt: true, updatedAt: true } });
  let sections: ViewerSection[] = [];
  if (workspace) {
    const [overview, planning, activePages, archivedPages, trashedPages, tasks, completedTasks, archivedTasks, projects, archivedProjects, databases, archivedDatabases, academicProfile, academicYears, archivedAcademicYears, courses, archivedCourses, activities, archivedActivities, timetableRules, finance, nutrition, media, intelligenceMemories, vault] = await Promise.all([
      readSection("Workspace overview", () => getPersonalWorkspaceOverview(user.id)),
      readSection("Tasks and planning summary", () => getWorkspacePlanningSummary(user.id)),
      readSection("Active pages and content", async () => { const pages = await listWorkspacePages(user.id, { view: "active", limit: 100 }); return Promise.all((pages ?? []).map((page) => getWorkspacePage(user.id, page.id))); }),
      readSection("Archived pages", () => listWorkspacePages(user.id, { view: "archive", limit: 100 })),
      readSection("Trashed pages", () => listWorkspacePages(user.id, { view: "trash", limit: 100 })),
      readSection("Current tasks", () => listWorkspaceTasks(user.id, { limit: 200 })),
      readSection("Completed tasks", () => listWorkspaceTasks(user.id, { bucket: "completed", limit: 200 })),
      readSection("Archived tasks", () => listWorkspaceTasks(user.id, { archived: true, limit: 200 })),
      readSection("Projects and milestones", () => listWorkspaceProjects(user.id)),
      readSection("Archived projects", () => listWorkspaceProjects(user.id, { archived: true })),
      readSection("Databases and saved views", () => listWorkspaceDatabases(user.id)),
      readSection("Archived databases", () => listWorkspaceDatabases(user.id, true)),
      readSection("Academic profile", () => getAcademicProfile(user.id)),
      readSection("Academic years", () => listAcademicYears(user.id)),
      readSection("Archived academic years", () => listAcademicYears(user.id, true)),
      readSection("Courses", () => listAcademicCourses(user.id)),
      readSection("Archived courses", () => listAcademicCourses(user.id, { archived: true })),
      readSection("Assignments, exams and study sessions", () => listAcademicActivities(user.id)),
      readSection("Archived academic activities", () => listAcademicActivities(user.id, { archived: true })),
      readSection("Class timetable", () => listTimetableRules(user.id)),
      readSection("Personal finance", () => getPersonalFinance(user.id, { from: "1900-01-01", to: "2200-12-31" }, { page: 1, pageSize: 100 })),
      readSection("Nutrition and health records", () => getNutritionDashboard(user.id)),
      readSection("Private media metadata", () => prisma.workspaceMediaAsset.findMany({ where: { workspaceId: workspace.id }, select: { id: true, mimeType: true, byteSize: true, width: true, height: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] })),
      readSection("Personal Intelligence memories", () => prisma.workspaceIntelligenceMemory.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] })),
      readSection("Security vault status (encrypted contents are not exposed)", () => prisma.securityVault.findUnique({ where: { workspaceId: workspace.id }, select: { createdAt: true, updatedAt: true, _count: { select: { records: true } } } })),
    ]);
    const databaseDetails = await readSection("Database records", async () => {
      const records = await Promise.all((databases.unavailable ? [] : (databases.value as Array<{ id: string; name: string }>)).map(async (database) => ({ database: database.name, records: await listWorkspaceDatabaseRecords(user.id, database.id) })));
      return records;
    });
    sections = [overview, planning, activePages, archivedPages, trashedPages, tasks, completedTasks, archivedTasks, projects, archivedProjects, databases, archivedDatabases, databaseDetails, academicProfile, academicYears, archivedAcademicYears, courses, archivedCourses, activities, archivedActivities, timetableRules, finance, nutrition, media, intelligenceMemories, vault];
  }

  return <main className="min-h-screen px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-7xl">
      <Link href={`/admin/users/${encodeURIComponent(user.id)}`} className="text-sm text-[#F2CF86] hover:text-white">← Back to account</Link>
      <header className="mt-5 rounded-3xl border border-white/10 bg-white/[.03] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#F2CF86]">Super Admin · audited read-only access</p>
        <h1 className="mt-3 text-3xl font-semibold">{user.name || "Unnamed user"}’s Workspace</h1>
        <p className="mt-2 text-sm text-white/55">{user.email || "No email on file"} · {user.role} · {user.accountStatus}</p>
        <p className="mt-4 max-w-3xl text-xs leading-5 text-white/45">Workspace records are shown using the existing owner-scoped readers. This view cannot edit or impersonate the account. Security-vault ciphertext and recovery material are never displayed. Some domains may be unavailable until their database migrations are deployed.</p>
      </header>
      {!workspace ? <section className="mt-6 rounded-2xl border border-dashed border-white/15 p-6"><h2 className="font-semibold">No personal workspace yet</h2><p className="mt-2 text-sm text-white/50">This account has not created a Personal Workspace.</p></section> : <>
        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Workspace mode" value={workspace.mode}/><Summary label="Timezone" value={workspace.timezone}/><Summary label="Focus areas" value={workspace.focusAreas.join(", ") || "None recorded"}/><Summary label="Onboarding" value={workspace.onboardingCompletedAt ? "Completed" : "Not completed"}/>
        </section>
        <section className="mt-6 grid gap-3">
          {sections.map((section) => <details key={section.title} className="group rounded-2xl border border-white/10 bg-white/[.025] p-4 open:bg-white/[.04]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold"><span>{section.title}</span><span className={section.unavailable ? "text-amber-200/70" : "text-white/40"}>{section.unavailable ? "Unavailable" : Array.isArray(section.value) ? `${section.value.length} records` : "View records"}</span></summary>
            {section.title === "Private media metadata" && !section.unavailable && Array.isArray(section.value) ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(section.value as Array<{ id: string; mimeType: string; byteSize: number; width: number | null; height: number | null; createdAt: Date }>).map((asset) => <article key={asset.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">{asset.mimeType.startsWith("image/") ? <Image src={`/api/admin/users/${encodeURIComponent(user.id)}/workspace-media/${encodeURIComponent(asset.id)}`} alt="Private workspace upload" width={640} height={400} unoptimized className="h-40 w-full object-cover"/> : <a className="flex h-40 items-center justify-center text-sm text-[#F2CF86]" href={`/api/admin/users/${encodeURIComponent(user.id)}/workspace-media/${encodeURIComponent(asset.id)}`}>Download private PDF</a>}<p className="p-3 text-[10px] text-white/45">{asset.mimeType} · {Math.ceil(asset.byteSize / 1024)} KB · {new Date(asset.createdAt).toLocaleDateString()}</p></article>)}</div> : <pre className="mt-4 max-h-[36rem] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/[.06] bg-black/20 p-4 text-[11px] leading-5 text-white/65">{JSON.stringify(section.value, null, 2)}</pre>}
          </details>)}
        </section>
      </>}
    </div>
  </main>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p><p className="mt-2 break-words text-sm text-white/80">{value}</p></div>;
}
