
"use client";

import { useCallback, useEffect, useState } from "react";
import MediaLibrary from "./MediaLibrary";
import WelcomePageLivePreview from "./WelcomePageLivePreview";
import type { WelcomePageContent } from "@/lib/welcome-page";

type MediaAsset = {
  name: string;
  url: string;
  path?: string;
  type?: string;
};

type WelcomePageVersion = {
  content: Record<string, unknown>;
  publishedAt: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  content?: WelcomePageContent;
  publishedContent?: WelcomePageContent;
  draftContent?: WelcomePageContent | null;
  hasDraft?: boolean;
  publishedAt?: string | null;
  history?: WelcomePageVersion[];
};

const sectionIds: Record<string, string> = {
  "media-library": "welcome-editor-media-library",
  hero: "welcome-editor-hero",
  features: "welcome-editor-features",
  audiences: "welcome-editor-audiences",
  steps: "welcome-editor-steps",
  cta: "welcome-editor-cta",
  footer: "welcome-editor-footer",
  appearance: "welcome-editor-appearance",
};

export default function WelcomePageEditor() {
  const [content, setContent] = useState<WelcomePageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<WelcomePageVersion[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
const loadContent = useCallback(async () => {
  try {
    const response = await fetch("/api/admin/backgrounds/welcome-page", {
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to load welcome page content.");
    }

    setContent(result.draftContent ?? result.content);
    setHistory(result.history ?? []);
    setHasDraft(Boolean(result.hasDraft));
    setPublishedAt(result.publishedAt ?? null);
    setError("");
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Failed to load welcome page content.",
    );
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  let cancelled = false;

  const fetchContent = async () => {
    try {
      const response = await fetch("/api/admin/backgrounds/welcome-page", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to load welcome page content.",
        );
      }

      if (!cancelled) {
        setContent(result.draftContent ?? result.content);
        setHistory(result.history ?? []);
        setHasDraft(Boolean(result.hasDraft));
        setPublishedAt(result.publishedAt ?? null);
        setError("");
      }
    } catch (error) {
      if (!cancelled) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load welcome page content.",
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };

  void fetchContent();

  return () => {
    cancelled = true;
  };
}, []);

  useEffect(() => {
    if (!isDirty) return;

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);

    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
    };
  }, [isDirty]);

  function jumpToSection(section: string) {
    const id = sectionIds[section];
    if (!id) return;

    setActiveSection(section);

    if (section === "media-library") {
      setShowMediaLibrary(true);
    }

    window.requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;

      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      window.setTimeout(() => {
        const field = target.querySelector<HTMLElement>(
          "input, textarea, button",
        );

        field?.focus({ preventScroll: true });
      }, 350);
    });
  }

  function updateField(
    section: keyof WelcomePageContent,
    field: string,
    value: string,
  ) {
    setContent((current) => {
      if (!current) return current;

      const sectionContent = current[section];

      if (
        typeof sectionContent !== "object" ||
        sectionContent === null ||
        !field
      ) {
        return current;
      }

      return {
        ...current,
        [section]: {
          ...sectionContent,
          [field]: value,
        },
      };
    });

    setIsDirty(true);
    setMessage("");
    setError("");
  }

  async function saveContent(action: "draft" | "publish") {
    if (!content || saving) return;

    if (
      action === "publish" &&
      !window.confirm(
        "Publish these changes to your live homepage? Visitors will see the updated content.",
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/backgrounds/welcome-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, action }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok || !data.success || !data.content) {
        throw new Error(data.message || "Could not save settings.");
      }

      setContent(data.content);
      setHasDraft(data.hasDraft ?? false);
      setPublishedAt(data.publishedAt ?? null);
      setHistory(data.history ?? []);
      setIsDirty(false);

      setMessage(
        data.message ??
          (action === "publish"
            ? "Welcome page published successfully."
            : "Draft saved successfully."),
      );

      if (action === "publish") {
        setActiveSection("hero");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function restoreVersion(version: WelcomePageVersion) {
    if (saving) return;

    const confirmed = window.confirm(
      isDirty
        ? "You have unsaved changes. Restoring this version will replace the content currently in the editor. Continue?"
        : `Restore "${getVersionTitle(version)}" from ${formatDate(
            version.publishedAt,
          )} as your draft? Your live homepage will remain unchanged.`,
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/backgrounds/welcome-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          versionPublishedAt: version.publishedAt,
        }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok || !data.success || !data.content) {
        throw new Error(data.message || "Could not restore this version.");
      }

      setContent(data.content);
      setHasDraft(data.hasDraft ?? false);
      setPublishedAt(data.publishedAt ?? null);
      setHistory(data.history ?? []);
      setIsDirty(false);
      setMessage(
        data.message ??
          "Version restored to your draft. Preview it before publishing.",
      );

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not restore this version.",
      );
    } finally {
      setSaving(false);
    }
  }

  function textField(
    section: keyof WelcomePageContent,
    field: string,
    label: string,
    multiline = false,
  ) {
    if (!content) return null;

    const sectionContent = content[section] as unknown as Record<
      string,
      unknown
    >;

    const value = String(sectionContent?.[field] ?? "");

    return (
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-300">
          {label}
        </span>

        {multiline ? (
          <textarea
            value={value}
            onChange={(event) =>
              updateField(section, field, event.target.value)
            }
            rows={4}
            className="w-full rounded-xl border border-white/10 bg-[#080B14] px-4 py-3 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
          />
        ) : (
          <input
            value={value}
            onChange={(event) =>
              updateField(section, field, event.target.value)
            }
            className="w-full rounded-xl border border-white/10 bg-[#080B14] px-4 py-3 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
          />
        )}
      </label>
    );
  }

  function formatDate(value: string | null) {
    if (!value) return "Not recorded";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Unknown";

    return date.toLocaleString();
  }

  function getVersionTitle(version: WelcomePageVersion) {
    const hero = version.content.hero;

    if (
      typeof hero === "object" &&
      hero !== null &&
      "title" in hero &&
      typeof hero.title === "string"
    ) {
      return hero.title;
    }

    return "Welcome page version";
  }

  function previewButton() {
    if (isDirty) {
      return (
        <span className="inline-flex items-center rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
          Save your changes before previewing.
        </span>
      );
    }

    if (!hasDraft) return null;

    return (
      <a
        href="/api/admin/backgrounds/welcome-page/preview"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
      >
        <span aria-hidden="true">◉</span>
        Preview Draft
        <span aria-hidden="true">↗</span>
      </a>
    );
  }

  function publishingActions() {
    return (
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => saveContent("draft")}
          disabled={saving || !isDirty}
          className="rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save Draft"}
        </button>

        <button
          type="button"
          onClick={() => saveContent("publish")}
          disabled={saving}
          className="rounded-xl bg-indigo-500 px-5 py-3 font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Please wait..." : "Publish Changes"}
        </button>

        {previewButton()}
      </div>
    );
  }

  if (loading) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-slate-300"
      >
        Loading welcome page settings...
      </div>
    );
  }

  if (!content) {
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6 text-red-200">
        <p>{error || "Welcome page settings could not be loaded."}</p>
        <button
          type="button"
          onClick={() => void loadContent()}
          className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-white transition hover:bg-white/15"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-indigo-300">Website configuration</p>
          <h1 className="mt-1 text-3xl font-bold text-white">
            Welcome Page Editor
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Edit your homepage, save private drafts, preview changes, and
            publish when ready.
          </p>
        </div>

        {publishingActions()}
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Current editor status</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  isDirty
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                    : hasDraft
                      ? "border-indigo-400/30 bg-indigo-400/10 text-indigo-200"
                      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                }`}
              >
                {isDirty
                  ? "Unsaved changes"
                  : hasDraft
                    ? "Draft saved"
                    : "Published"}
              </span>

              {hasDraft && (
                <span className="text-xs text-slate-400">
                  Your saved draft is separate from the live homepage.
                </span>
              )}
            </div>
          </div>

          <div className="text-sm text-slate-400">
            <p>Last published</p>
            <p className="mt-1 text-white">{formatDate(publishedAt)}</p>
          </div>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-white/10 px-4 py-2 text-center text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            View Live Homepage
          </a>
        </div>
      </section>

      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-300"
        >
          {message}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-300"
        >
          {error}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-8">
          <section
            id={sectionIds["media-library"]}
            className={`scroll-mt-8 space-y-5 rounded-2xl border bg-white/[0.03] p-6 ${
              activeSection === "media-library"
                ? "border-indigo-400/40"
                : "border-white/10"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Background media library
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Upload and select images or videos for your website.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowMediaLibrary((current) => !current)}
                className="rounded-xl border border-indigo-400/30 bg-indigo-400/10 px-5 py-3 font-medium text-indigo-200 transition hover:bg-indigo-400/20"
              >
                {showMediaLibrary ? "Hide Media Library" : "Open Media Library"}
              </button>
            </div>

            {showMediaLibrary && (
              <div className="border-t border-white/10 pt-5">
                <MediaLibrary
                  onSelect={(asset: MediaAsset) => {
                    updateField("hero", "backgroundImage", asset.url);
                    setShowMediaLibrary(false);
                    setMessage(
                      "Background media selected. Save your draft or publish to apply it.",
                    );
                  }}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Hero background image or video URL
              </label>

              <input
                value={String(
                  (content.hero as unknown as Record<string, unknown>)
                    .backgroundImage ?? "",
                )}
                onChange={(event) =>
                  updateField("hero", "backgroundImage", event.target.value)
                }
                placeholder="Select media above or paste a public URL"
                className="w-full rounded-xl border border-white/10 bg-[#080B14] px-4 py-3 text-white outline-none transition focus:border-indigo-400"
              />

              <p className="text-xs text-slate-500">
                Select media to update the editor, then save a draft or publish
                to apply it.
              </p>
            </div>
          </section>

          <section
            id={sectionIds.hero}
            className={`scroll-mt-8 space-y-5 rounded-2xl border bg-white/[0.03] p-6 ${
              activeSection === "hero"
                ? "border-indigo-400/40"
                : "border-white/10"
            }`}
          >
            <div>
              <h2 className="text-xl font-semibold text-white">Hero section</h2>
              <p className="mt-1 text-sm text-slate-400">
                The first content visitors see when they open your website.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {textField("hero", "badge", "Small badge")}
              {textField("hero", "title", "Main heading")}
              {textField("hero", "highlight", "Highlighted heading")}
              {textField("hero", "primaryButton", "Primary button label")}
              {textField("hero", "primaryLink", "Primary button link")}
              {textField("hero", "secondaryButton", "Secondary button label")}
              {textField("hero", "secondaryLink", "Secondary button link")}
              {textField("hero", "note", "Small note")}
            </div>

            {textField("hero", "description", "Hero description", true)}
          </section>

          <section
            id={sectionIds.features}
            className="scroll-mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="text-xl font-semibold text-white">
              Features section
            </h2>
            <div className="grid gap-5 md:grid-cols-2">
              {textField("features", "eyebrow", "Section label")}
              {textField("features", "title", "Section heading")}
            </div>
            {textField("features", "description", "Section description", true)}
            <p className="text-sm text-slate-400">
              Feature card titles and descriptions are not yet individually
              editable here.
            </p>
          </section>

          <section
            id={sectionIds.audiences}
            className="scroll-mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="text-xl font-semibold text-white">
              Audience section
            </h2>
            <div className="grid gap-5 md:grid-cols-2">
              {textField("audiences", "eyebrow", "Section label")}
              {textField("audiences", "title", "Section heading")}
            </div>
            {textField(
              "audiences",
              "description",
              "Section description",
              true,
            )}
            <p className="text-sm text-slate-400">
              Audience card titles and descriptions are not yet individually
              editable here.
            </p>
          </section>

          <section
            id={sectionIds.steps}
            className="scroll-mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="text-xl font-semibold text-white">How it works</h2>
            <div className="grid gap-5 md:grid-cols-2">
              {textField("steps", "eyebrow", "Section label")}
              {textField("steps", "title", "Section heading")}
            </div>
            <p className="text-sm text-slate-400">
              Step card titles and descriptions are not yet individually
              editable here.
            </p>
          </section>

          <section
            id={sectionIds.cta}
            className="scroll-mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="text-xl font-semibold text-white">Call to action</h2>
            <div className="grid gap-5 md:grid-cols-2">
              {textField("cta", "eyebrow", "Section label")}
              {textField("cta", "title", "Heading")}
              {textField("cta", "primaryButton", "Primary button label")}
              {textField("cta", "primaryLink", "Primary button link")}
              {textField("cta", "secondaryButton", "Secondary button label")}
              {textField("cta", "secondaryLink", "Secondary button link")}
            </div>
            {textField("cta", "description", "Description", true)}
          </section>

          <section
            id={sectionIds.footer}
            className="scroll-mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="text-xl font-semibold text-white">Footer</h2>
            {textField("footer", "description", "Footer description", true)}
            {textField("footer", "copyright", "Copyright text")}
          </section>

          <section
            id={sectionIds.appearance}
            className="scroll-mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="text-xl font-semibold text-white">Appearance</h2>
            <div className="grid gap-5 md:grid-cols-2">
              {textField("appearance", "accentColor", "Accent color (hex)")}
              {textField(
                "appearance",
                "backgroundColor",
                "Background color (hex)",
              )}
            </div>
            <p className="text-sm text-slate-400">
              These values are saved in your settings. The live preview
              approximates the homepage appearance.
            </p>
          </section>

          <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Version history
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Restore an earlier published version as a draft without
                immediately changing your live homepage.
              </p>
            </div>

            {history.length === 0 ? (
              <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">
                No previous published versions have been recorded yet. A
                version will appear here after publishing changes.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((version, index) => (
                  <div
                    key={`${version.publishedAt}-${index}`}
                    className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium text-white">
                        {getVersionTitle(version)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Published: {formatDate(version.publishedAt)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Version {history.length - index}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => restoreVersion(version)}
                      disabled={saving}
                      className="shrink-0 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Please wait..." : "Restore Version"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-wrap justify-end gap-3">
            {publishingActions()}
          </div>
        </div>

        <WelcomePageLivePreview
          content={content}
          onSelectSection={jumpToSection}
        />
      </div>
    </div>
  );
}