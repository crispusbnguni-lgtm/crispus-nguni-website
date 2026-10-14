
"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

import type { WelcomePageContent } from "@/lib/welcome-page";

type Props = {
  content: WelcomePageContent;
  onSelectSection: (section: string) => void;
};

type RecordValue = Record<string, unknown>;

type PreviewSection = {
  id: string;
  label: string;
  fallback: string;
  data: RecordValue;
};

function asRecord(value: unknown): RecordValue {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim()
    ? value
    : fallback;
}

function isMediaVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(url);
}

export default function WelcomePageLivePreview({
  content,
  onSelectSection,
}: Props) {
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "desktop",
  );

  const hero = asRecord(content.hero);
  const features = asRecord(content.features);
  const audiences = asRecord(content.audiences);
  const steps = asRecord(content.steps);
  const cta = asRecord(content.cta);
  const footer = asRecord(content.footer);
  const appearance = asRecord(content.appearance);

  const background = text(hero.backgroundImage, "");
  const videoBackground = isMediaVideo(background);
  const accent = text(appearance.accentColor, "#818cf8");
  const backgroundColor = text(
    appearance.backgroundColor,
    "#080b14",
  );

  const pageStyle = {
    "--preview-accent": accent,
    backgroundColor,
  } as CSSProperties;

  const jump = (section: string) => {
    onSelectSection(section);
  };

  const sections: PreviewSection[] = [
    {
      id: "features",
      label: "What I offer",
      fallback: "What I offer",
      data: features,
    },
    {
      id: "audiences",
      label: "Who I help",
      fallback: "Who I work with",
      data: audiences,
    },
    {
      id: "steps",
      label: "How it works",
      fallback: "Your journey starts here",
      data: steps,
    },
  ];

  return (
    <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
      {/* Preview header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
            Visual editor
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Live preview
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Preview your homepage on different screens
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-xl border border-white/10 bg-black/20 p-1"
            role="group"
            aria-label="Preview device size"
          >
            <button
              type="button"
              onClick={() => setPreviewMode("desktop")}
              aria-pressed={previewMode === "desktop"}
              className={`rounded-lg px-3 py-2 text-xs transition ${
                previewMode === "desktop"
                  ? "bg-white/15 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Desktop
            </button>

            <button
              type="button"
              onClick={() => setPreviewMode("mobile")}
              aria-pressed={previewMode === "mobile"}
              className={`rounded-lg px-3 py-2 text-xs transition ${
                previewMode === "mobile"
                  ? "bg-white/15 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Mobile
            </button>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
        </div>
      </div>

      {/* Glass browser frame */}
      <div
        className={`mx-auto overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-br from-white/[0.12] via-white/[0.035] to-white/[0.07] p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl transition-[width] duration-500 ${
          previewMode === "mobile" ? "w-full max-w-[390px]" : "w-full"
        }`}
      >
        {/* Browser controls */}
        <div className="flex items-center gap-2 px-3 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />

          <div className="ml-2 min-w-0 flex-1 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-center text-[10px] text-slate-400">
            crispus.nguni / homepage
          </div>
        </div>

        {/* Website viewport */}
        <div
          style={pageStyle}
          className="relative isolate max-h-[75vh] min-h-[520px] overflow-y-auto overscroll-contain rounded-[21px] border border-white/10 text-white shadow-inner shadow-black/20"
        >
          {/* Navigation */}
          <nav className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950/65 px-4 py-3 shadow-lg shadow-black/5 backdrop-blur-2xl">
            <button
              type="button"
              onClick={() => jump("hero")}
              aria-label="Edit homepage hero"
              className="shrink-0 rounded-lg text-left font-semibold tracking-tight text-white transition hover:opacity-75"
            >
              Crispus
              <span style={{ color: accent }}>.</span>
            </button>

            <button
              type="button"
              onClick={() => jump("features")}
              className="rounded-full border border-white/15 bg-white/[0.055] px-3 py-1.5 text-xs text-white/85 shadow-lg shadow-black/5 backdrop-blur-xl transition duration-300 hover:border-white/30 hover:bg-white/15"
            >
              Explore <span aria-hidden="true">↗</span>
            </button>
          </nav>

          {/* Hero */}
          <button
            type="button"
            onClick={() => jump("hero")}
            aria-label="Edit hero section"
            className="group relative isolate block min-h-[390px] w-full overflow-hidden text-left"
          >
            {/* Background media */}
            {background && videoBackground ? (
              <video
                key={background}
                src={background}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden="true"
                className="absolute inset-0 z-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            ) : background ? (
              <div
                aria-hidden="true"
                className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.04]"
                style={{
                  backgroundImage: `url("${background}")`,
                }}
              />
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 z-0"
                style={{
                  background: `
                    radial-gradient(
                      ellipse at 85% 10%,
                      ${accent}55,
                      transparent 48%
                    ),
                    radial-gradient(
                      ellipse at 5% 85%,
                      rgba(14,165,233,0.22),
                      transparent 45%
                    ),
                    linear-gradient(
                      145deg,
                      #10182b,
                      ${backgroundColor} 75%
                    )
                  `,
                }}
              />
            )}

            {/* Contrast overlay */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-slate-950/65 via-slate-950/60 to-slate-950/95"
            />

            {/* Glass lighting */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 opacity-60"
              style={{
                background: `radial-gradient(ellipse at 80% 25%, ${accent}30, transparent 55%)`,
              }}
            />

            {/* Hero content */}
            <div className="relative z-20 flex min-h-[390px] flex-col items-start justify-center p-5 sm:p-7">
              {text(hero.badge, "") && (
                <span
                  className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider shadow-lg backdrop-blur-2xl"
                  style={{
                    borderColor: `${accent}75`,
                    backgroundColor: `${accent}22`,
                    color: "#eef2ff",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: accent,
                      boxShadow: `0 0 12px ${accent}`,
                    }}
                  />
                  <span className="break-words">
                    {text(hero.badge, "")}
                  </span>
                </span>
              )}

              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                Welcome to my world
              </p>

              <h3 className="max-w-full break-words text-3xl font-bold leading-[1.12] tracking-tight text-white drop-shadow-lg sm:text-4xl">
                {text(hero.title, "Your headline goes here")}
                {text(hero.highlight, "") && (
                  <>
                    {" "}
                    <span
                      style={{
                        color: accent,
                        textShadow: `0 0 28px ${accent}55`,
                      }}
                    >
                      {text(hero.highlight, "")}
                    </span>
                  </>
                )}
              </h3>

              <p className="mt-5 max-w-sm break-words text-sm leading-6 text-slate-300">
                {text(
                  hero.description,
                  "Your introduction will appear here as you edit it.",
                )}
              </p>

              {/* Preview buttons */}
              <div className="mt-7 flex flex-wrap gap-2">
                <span
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-xs font-semibold text-white shadow-xl shadow-black/20 transition duration-300 group-hover:-translate-y-0.5"
                  style={{
                    background: `linear-gradient(135deg, ${accent}, #6366f1)`,
                    boxShadow: `0 8px 24px ${accent}25`,
                  }}
                >
                  {text(hero.primaryButton, "Primary button")}
                  <span aria-hidden="true">↗</span>
                </span>

                <span className="rounded-xl border border-white/20 bg-white/[0.09] px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-black/10 backdrop-blur-2xl transition duration-300 group-hover:bg-white/[0.13]">
                  {text(hero.secondaryButton, "Secondary button")}
                </span>
              </div>

              {text(hero.note, "") && (
                <p className="mt-5 max-w-sm break-words text-[10px] leading-5 text-slate-300/80">
                  {text(hero.note, "")}
                </p>
              )}

              <span className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[10px] text-white/75 shadow-lg backdrop-blur-2xl">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                Select to edit hero
              </span>
            </div>
          </button>

          {/* Main content sections */}
          <div className="relative space-y-4 px-3 py-5">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {sections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                onClick={() => jump(section.id)}
                className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.035] to-white/[0.015] p-4 text-left shadow-lg shadow-black/10 backdrop-blur-2xl transition duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:from-white/[0.13] hover:to-white/[0.045]"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full opacity-20 blur-3xl transition-opacity duration-300 group-hover:opacity-50"
                  style={{ backgroundColor: accent }}
                />

                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="text-[9px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: accent }}
                    >
                      {text(section.data.eyebrow, section.label)}
                    </span>

                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-[10px] text-white/60 transition group-hover:border-white/25 group-hover:text-white">
                      0{index + 1}
                    </span>
                  </div>

                  <span className="mt-3 block break-words text-base font-semibold leading-snug text-white">
                    {text(section.data.title, section.fallback)}
                  </span>

                  {typeof section.data.description === "string" &&
                    section.data.description && (
                      <span className="mt-2 block line-clamp-3 break-words text-xs leading-5 text-slate-400">
                        {section.data.description}
                      </span>
                    )}

                  <span className="mt-4 inline-flex items-center gap-2 text-[10px] font-medium text-slate-400 transition group-hover:text-white">
                    Edit section
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    >
                      ↗
                    </span>
                  </span>
                </div>
              </button>
            ))}

            {/* Call to action */}
            <button
              type="button"
              onClick={() => jump("cta")}
              className="group relative block w-full overflow-hidden rounded-2xl border border-white/15 p-5 text-left shadow-xl shadow-black/10 backdrop-blur-2xl transition duration-300 hover:-translate-y-0.5 hover:border-white/30"
              style={{
                background: `
                  radial-gradient(
                    ellipse at 100% 0%,
                    ${accent}35,
                    transparent 65%
                  ),
                  linear-gradient(
                    145deg,
                    ${accent}18,
                    rgba(255,255,255,0.035)
                  )
                `,
              }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-16 -right-12 h-36 w-36 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
                style={{ backgroundColor: accent }}
              />

              <div className="relative">
                <span
                  className="text-[9px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: accent }}
                >
                  {text(cta.eyebrow, "Take the next step")}
                </span>

                <span className="mt-3 block break-words text-lg font-semibold leading-snug text-white">
                  {text(cta.title, "Your call to action")}
                </span>

                <span className="mt-2 block break-words text-xs leading-5 text-slate-300">
                  {text(
                    cta.description,
                    "Your call-to-action description will appear here.",
                  )}
                </span>

                <span
                  className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition duration-300 group-hover:shadow-xl"
                  style={{
                    background: `linear-gradient(135deg, ${accent}, #6366f1)`,
                  }}
                >
                  {text(cta.primaryButton, "Get started")}
                  <span aria-hidden="true">↗</span>
                </span>

                <span className="mt-4 block text-[10px] text-slate-400">
                  Select to edit this section
                </span>
              </div>
            </button>
          </div>

          {/* Footer */}
          <footer className="relative overflow-hidden border-t border-white/10 bg-black/15 px-4 py-6 text-center backdrop-blur-xl">
            <div
              aria-hidden="true"
              className="absolute inset-x-12 top-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${accent}80, transparent)`,
              }}
            />

            <button
              type="button"
              onClick={() => jump("footer")}
              className="rounded-lg text-[10px] leading-5 text-slate-400 transition hover:text-white"
            >
              {text(footer.copyright, "© Your website")}
              <span className="ml-2 text-white/50">↗ Edit footer</span>
            </button>
          </footer>
        </div>
      </div>

      {/* Editor shortcuts */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.065] to-white/[0.02] p-4 shadow-xl shadow-black/10 backdrop-blur-2xl">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]"
            style={{ color: accent }}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </svg>
          </span>

          <div>
            <p className="text-sm font-medium text-white">
              Edit by clicking a section
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Changes appear here as you type. Select a section to jump to its
              controls, then save a draft to preserve your work privately.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            ["media-library", "Background media"],
            ["hero", "Hero section"],
            ["features", "Features"],
            ["audiences", "Audience"],
            ["steps", "How it works"],
            ["cta", "Call to action"],
            ["footer", "Footer"],
            ["appearance", "Appearance"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => jump(id)}
              className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-left text-xs text-slate-300 transition duration-200 hover:border-white/25 hover:bg-white/[0.085] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}