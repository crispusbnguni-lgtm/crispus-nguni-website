import { WorkspaceSectionNav } from "@/components/workspace/WorkspaceSectionNav";

export default function WorkspaceOverviewLoading() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-7 px-4 pb-20 pt-8 text-white sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading your workspace">
      <header className="grid gap-3">
        <div className="h-3 w-52 animate-pulse rounded bg-white/10" />
        <div className="h-9 w-72 max-w-full animate-pulse rounded bg-white/10" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-white/[.07]" />
      </header>
      <WorkspaceSectionNav active="overview" />
      <p role="status" className="text-sm text-white/55">Loading your workspace data…</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[.035]" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
        <div className="h-64 animate-pulse rounded-3xl border border-white/10 bg-white/[.035]" />
        <div className="h-64 animate-pulse rounded-3xl border border-white/10 bg-white/[.035]" />
      </div>
    </main>
  );
}
