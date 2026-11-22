
"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

import type { WelcomePageContent } from "@/lib/welcome-page";
import WelcomePageView from "@/components/welcome-page/WelcomePageView";

type Props = {
  content: WelcomePageContent;
  onSelectSection: (section: string) => void;
};

type RecordValue = Record<string, unknown>;

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

export default function WelcomePageLivePreview({
  content,
  onSelectSection,
}: Props) {
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "desktop",
  );

  const appearance = asRecord(content.appearance);

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
          <WelcomePageView
            content={content}
            preview
            onSelectSection={onSelectSection}
          />
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
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
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
