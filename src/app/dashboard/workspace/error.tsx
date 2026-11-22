"use client";

import { RefreshCw } from "lucide-react";

export default function WorkspaceOverviewError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto grid min-h-[55vh] w-full max-w-3xl content-center gap-5 px-4 py-12 text-white sm:px-6" role="alert">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D9A441]">Personal Intelligence Workspace</p>
      <h1 className="text-3xl font-semibold">Your workspace could not be loaded</h1>
      <p className="max-w-xl text-sm leading-6 text-white/60">We couldn’t retrieve your saved workspace data. Your records were not replaced with sample data. Try again in a moment.</p>
      <button onClick={() => retry()} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-[#D9A441]/35 bg-[#D9A441]/10 px-5 text-sm font-semibold text-[#F2CF86] transition hover:bg-[#D9A441]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]">
        <RefreshCw size={15} aria-hidden="true" /> Retry
      </button>
    </main>
  );
}
