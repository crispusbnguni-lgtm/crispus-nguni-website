
import { Suspense } from "react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import PortfolioEditor from "./PortfolioEditor";

function PortfolioLoading() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-8 sm:py-12">
      {/* Ambient glass lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 -z-10 h-80 w-80 rounded-full bg-blue-500/[0.09] blur-[100px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 -z-10 h-80 w-80 rounded-full bg-amber-400/[0.07] blur-[100px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#126BFF]/[0.035] blur-[120px]"
      />

      <div className="mx-auto flex min-h-[75vh] w-full max-w-5xl items-center justify-center">
        <div className="w-full max-w-lg animate-in fade-in duration-500 motion-reduce:animate-none">
          <LiquidLensSurface
            radius={32}
            intensity="strong"
            className="relative overflow-hidden rounded-[2rem] p-7 text-center sm:p-12"
          >
            {/* Subtle glass reflections */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-white/[0.07]"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full border border-white/[0.06]"
            />

            <div className="relative">
              {/* Animated loading indicator */}
              <div className="relative mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-[1.65rem] border border-white/[0.14] bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_36px_rgba(0,0,0,0.10)]">
                <div
                  aria-hidden="true"
                  className="absolute inset-1 rounded-[1.35rem] border border-white/[0.055]"
                />

                <div
                  className="h-10 w-10 rounded-full border-[2.5px] border-white/[0.12] border-t-[var(--accent)] motion-safe:animate-spin motion-reduce:animate-none"
                  role="status"
                  aria-label="Loading portfolio editor"
                />

                <span
                  aria-hidden="true"
                  className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]"
                />
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
                Crispus<span className="text-[#126BFF]">.</span>
              </p>

              <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                Preparing your portfolio
              </h1>

              <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[var(--text-muted)]">
                Getting your workspace ready so you can manage your
                professional profile, services and public content.
              </p>

              {/* Loading progress decoration */}
              <div
                aria-hidden="true"
                className="mx-auto mt-8 h-1 w-full max-w-52 overflow-hidden rounded-full bg-white/[0.08]"
              >
                <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#126BFF]/60 via-[var(--accent)] to-[#126BFF]/60 motion-safe:animate-pulse motion-reduce:animate-none" />
              </div>

              <p className="mt-4 text-[11px] font-medium tracking-wide text-[var(--text-muted)] opacity-70">
                Loading your editor…
              </p>
            </div>
          </LiquidLensSurface>
        </div>
      </div>
    </main>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<PortfolioLoading />}>
      <PortfolioEditor />
    </Suspense>
  );
}