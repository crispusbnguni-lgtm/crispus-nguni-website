"use client";

import { useCallback, useEffect, useState } from "react";
import MediaLibrary from "./MediaLibrary";
import WelcomePageLivePreview from "./WelcomePageLivePreview";
import { defaultWelcomePageContent, type WelcomePageContent } from "@/lib/welcome-page";

type MediaAsset = {
  name: string;
  url: string;
  path?: string;
  type?: "image" | "video";
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
  scheduledAt?: string | null;
};

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
  const [scheduledAtInput, setScheduledAtInput] = useState("");
  const [savedScheduledAt, setSavedScheduledAt] = useState<string | null>(null);
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
    setSavedScheduledAt(result.scheduledAt ?? null);
    setScheduledAtInput(toLocalDateTimeInput(result.scheduledAt));
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
        setSavedScheduledAt(result.scheduledAt ?? null);
        setScheduledAtInput(toLocalDateTimeInput(result.scheduledAt));
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

function updateStep(
  index: number,
  updates: Partial<WelcomePageContent["steps"]["cards"][number]>,
) {
  setContent((current) => {
    if (!current) return current;

    return {
      ...current,
      steps: {
        ...current.steps,
        cards: current.steps.cards.map((step, stepIndex) =>
          stepIndex === index ? { ...step, ...updates } : step,
        ),
      },
    };
  });

  setIsDirty(true);
  setMessage("");
  setError("");
}

function updateWelcomeCard(
  section: "features" | "audiences",
  index: number,
  field: "title" | "description",
  value: string,
) {
  setContent((current) => {
    if (!current) return current;
    return {
      ...current,
      [section]: {
        ...current[section],
        cards: current[section].cards.map((card, cardIndex) =>
          cardIndex === index
            ? { ...card, [field]: value }
            : card,
        ),
      },
    };
  });
  setIsDirty(true);
  setMessage("");
  setError("");
}

function updateSeo(field: "title" | "description", value: string) {
  setContent((current) => current ? {
    ...current,
    seo: {
      ...(current.seo ?? defaultWelcomePageContent.seo!),
      [field]: value,
    },
  } : current);
  setIsDirty(true);
  setMessage("");
  setError("");
}

type WelcomeSectionKey = NonNullable<WelcomePageContent["sectionOrder"]>[number];
const WELCOME_SECTIONS: Array<{ key: WelcomeSectionKey; label: string }> = [
  { key: "hero", label: "Hero" },
  { key: "features", label: "Platform features" },
  { key: "audiences", label: "Who it serves" },
  { key: "steps", label: "How it works" },
  { key: "cta", label: "Call to action" },
  { key: "footer", label: "Footer" },
];

function updateSectionVisibility(key: WelcomeSectionKey, visible: boolean) {
  setContent((current) => current ? {
    ...current,
    sectionVisibility: {
      ...defaultWelcomePageContent.sectionVisibility,
      ...current.sectionVisibility,
      [key]: visible,
    },
  } : current);
  setIsDirty(true);
  setMessage("");
  setError("");
}

function moveWelcomeSection(key: WelcomeSectionKey, direction: -1 | 1) {
  setContent((current) => {
    if (!current) return current;
    const order = [...(current.sectionOrder ?? defaultWelcomePageContent.sectionOrder!)];
    const index = order.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return current;
    [order[index], order[target]] = [order[target], order[index]];
    return { ...current, sectionOrder: order };
  });
  setIsDirty(true);
  setMessage("");
  setError("");
}



  function updateGlassSetting(
    field: keyof NonNullable<WelcomePageContent["appearance"]["glass"]>,
    value: number | boolean,
  ) {
    setContent((current) => {
      if (!current) return current;

      return {
        ...current,
        appearance: {
          ...current.appearance,
          glass: {
            ...current.appearance.glass,
            enabled: current.appearance.glass?.enabled ?? true,
            strength: current.appearance.glass?.strength ?? 0.72,
            frost: current.appearance.glass?.frost ?? 0.18,
            transparency: current.appearance.glass?.transparency ?? 0.72,
            reflection: current.appearance.glass?.reflection ?? 0.65,
            depth: current.appearance.glass?.depth ?? 0.65,
            radius: current.appearance.glass?.radius ?? 24,
            [field]: value,
          },
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
      setSavedScheduledAt(data.scheduledAt ?? null);
      setScheduledAtInput(toLocalDateTimeInput(data.scheduledAt));
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

  async function saveSchedule() {
    if (!content || saving || !scheduledAtInput) return;
    if (!window.confirm("Save this content as a scheduled publication? Automatic publishing is not connected yet.")) return;
    const scheduledAt = new Date(scheduledAtInput);
    if (Number.isNaN(scheduledAt.getTime())) {
      setError("Choose a valid future date and time.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/backgrounds/welcome-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schedule", content, scheduledAt: scheduledAt.toISOString() }),
      });
      const data: ApiResponse = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not save the scheduled publication.");
      setSavedScheduledAt(data.scheduledAt ?? scheduledAt.toISOString());
      setScheduledAtInput(toLocalDateTimeInput(data.scheduledAt ?? scheduledAt.toISOString()));
      setMessage(data.message || "Scheduled publication details saved. Automatic publishing is not connected yet.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the scheduled publication.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelSchedule() {
    if (saving || !savedScheduledAt) return;
    if (!window.confirm("Cancel the saved scheduled publication?")) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/backgrounds/welcome-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_schedule" }),
      });
      const data: ApiResponse = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not cancel the saved schedule.");
      setSavedScheduledAt(null);
      setScheduledAtInput("");
      setMessage(data.message || "Scheduled publication details cancelled.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cancel the saved schedule.");
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
      setSavedScheduledAt(data.scheduledAt ?? null);
      setScheduledAtInput(toLocalDateTimeInput(data.scheduledAt));
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
        <span aria-hidden="true">Ã¢â€”â€°</span>
        Preview Draft
        <span aria-hidden="true">Ã¢â€ â€”</span>
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

  const glassSettings =
    content.appearance.glass ??
    defaultWelcomePageContent.appearance.glass!;

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

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" aria-labelledby="welcome-page-structure-heading">
        <h2 id="welcome-page-structure-heading" className="text-lg font-semibold text-white">Page structure and search preview</h2>
        <p className="mt-1 text-sm text-slate-400">Reorder or hide homepage sections. Changes stay in draft until published.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {WELCOME_SECTIONS.map(({ key, label }) => {
            const order = content.sectionOrder ?? defaultWelcomePageContent.sectionOrder!;
            const index = order.indexOf(key);
            return <div key={key} className="flex min-h-12 items-center gap-2 rounded-xl border border-white/10 px-3">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-white">
                <input type="checkbox" checked={(content.sectionVisibility ?? defaultWelcomePageContent.sectionVisibility)?.[key] !== false} onChange={(event) => updateSectionVisibility(key, event.target.checked)} />
                <span className="truncate">{label}</span>
              </label>
              <button type="button" aria-label={`Move ${label} up`} disabled={index <= 0} onClick={() => moveWelcomeSection(key, -1)} className="min-h-9 min-w-9 rounded-lg border border-white/10 text-white disabled:opacity-30">↑</button>
              <button type="button" aria-label={`Move ${label} down`} disabled={index < 0 || index >= order.length - 1} onClick={() => moveWelcomeSection(key, 1)} className="min-h-9 min-w-9 rounded-lg border border-white/10 text-white disabled:opacity-30">↓</button>
            </div>;
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200/15 bg-amber-950/15 p-5" aria-labelledby="welcome-schedule-heading">
        <h2 id="welcome-schedule-heading" className="text-lg font-semibold text-white">Publication schedule</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-100/70">The CMS can save a future publication time and content for review. There is no automatic publisher connected yet, so this setting will not publish by itself.</p>
        {savedScheduledAt && <p className="mt-3 text-sm text-white/80" role="status">Saved time: {new Date(savedScheduledAt).toLocaleString()}</p>}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="grid gap-2 text-sm text-slate-200">Date and time<input type="datetime-local" value={scheduledAtInput} onChange={(event) => setScheduledAtInput(event.target.value)} className="min-h-11 rounded-xl border border-white/15 bg-slate-900 px-3 text-white" /></label>
          <button type="button" disabled={saving || !scheduledAtInput} onClick={() => void saveSchedule()} className="min-h-11 rounded-xl border border-amber-100/20 px-4 font-semibold text-amber-50 disabled:opacity-40">Save scheduled content</button>
          {savedScheduledAt && <button type="button" disabled={saving} onClick={() => void cancelSchedule()} className="min-h-11 rounded-xl border border-white/15 px-4 font-semibold text-white/80 disabled:opacity-40">Cancel schedule</button>}
        </div>
      </section>

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
              <label className="block space-y-2 text-sm font-medium text-slate-300">
                <span>Focal position</span>
                <select value={content.hero.backgroundPosition ?? "center center"} onChange={(event) => updateField("hero", "backgroundPosition", event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#080B14] px-4 py-3 text-white">
                  <option value="center center">Center</option>
                  <option value="center top">Top center</option>
                  <option value="center bottom">Bottom center</option>
                  <option value="left center">Left</option>
                  <option value="right center">Right</option>
                </select>
              </label>
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
            <div className="grid gap-4">
              {content.features.cards.map((card, index) => <fieldset key={`feature-${index}`} className="grid gap-3 rounded-xl border border-white/10 p-4 sm:grid-cols-2">
                <legend className="px-2 text-xs text-slate-400">Feature {index + 1}</legend>
                <label className="grid gap-2 text-sm text-slate-300">Title<input value={card.title} onChange={(event) => updateWelcomeCard("features", index, "title", event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#080B14] px-3 text-white" /></label>
                <label className="grid gap-2 text-sm text-slate-300">Description<textarea rows={2} value={card.description} onChange={(event) => updateWelcomeCard("features", index, "description", event.target.value)} className="rounded-xl border border-white/10 bg-[#080B14] px-3 py-2 text-white" /></label>
              </fieldset>)}
            </div>
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
            <div className="grid gap-4">
              {content.audiences.cards.map((card, index) => <fieldset key={`audience-${index}`} className="grid gap-3 rounded-xl border border-white/10 p-4 sm:grid-cols-2">
                <legend className="px-2 text-xs text-slate-400">Audience {index + 1}</legend>
                <label className="grid gap-2 text-sm text-slate-300">Title<input value={card.title} onChange={(event) => updateWelcomeCard("audiences", index, "title", event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#080B14] px-3 text-white" /></label>
                <label className="grid gap-2 text-sm text-slate-300">Description<textarea rows={2} value={card.description} onChange={(event) => updateWelcomeCard("audiences", index, "description", event.target.value)} className="rounded-xl border border-white/10 bg-[#080B14] px-3 py-2 text-white" /></label>
              </fieldset>)}
            </div>
          </section>


<section
  id={sectionIds.steps}
  className="scroll-mt-8 space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
>
  <div>
    <h2 className="text-xl font-semibold text-white">How it works</h2>
    <p className="mt-1 text-sm text-slate-400">
Edit the number, title and description of each instructional step.
    </p>
  </div>

  <div className="grid gap-5 md:grid-cols-2">
    {textField("steps", "eyebrow", "Section label")}
    {textField("steps", "title", "Section heading")}
  </div>

  <div className="space-y-5">
    {content.steps.cards.map((step, index) => (
      <div
        key={`${step.number}-${index}`}
        className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-white">
            Instructional step {index + 1}
          </h3>
          <span className="rounded-lg bg-indigo-400/10 px-3 py-1 text-xs text-indigo-200">
            {step.number}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Step number
            </label>
            <input
              value={step.number}
              onChange={(event) =>
                updateStep(index, { number: event.target.value })
              }
              className="w-full rounded-xl border border-white/10 bg-[#080B14] px-4 py-3 text-white outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Step title
            </label>
            <input
              value={step.title}
              onChange={(event) =>
                updateStep(index, { title: event.target.value })
              }
              className="w-full rounded-xl border border-white/10 bg-[#080B14] px-4 py-3 text-white outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">
            Step description
          </label>
          <textarea
            value={step.description}
            onChange={(event) =>
              updateStep(index, { description: event.target.value })
            }
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-[#080B14] px-4 py-3 text-white outline-none focus:border-indigo-400"
          />
        </div>

      </div>
    ))}
  </div>

</section>

          <section
            id={sectionIds.cta}
            className="scroll-mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="text-xl font-semibold text-white">
              Call to action
            </h2>

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

          <section className="scroll-mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6" aria-labelledby="welcome-seo-heading">
            <div>
              <h2 id="welcome-seo-heading" className="text-xl font-semibold text-white">Search and social metadata</h2>
              <p className="mt-1 text-sm text-slate-400">These values are published with the homepage. Draft metadata is never used for public rendering.</p>
            </div>
            <label className="grid gap-2 text-sm text-slate-300">SEO title<input maxLength={80} value={(content.seo ?? defaultWelcomePageContent.seo!).title} onChange={(event) => updateSeo("title", event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#080B14] px-4 text-white" /></label>
            <label className="grid gap-2 text-sm text-slate-300">SEO description<textarea maxLength={180} rows={3} value={(content.seo ?? defaultWelcomePageContent.seo!).description} onChange={(event) => updateSeo("description", event.target.value)} className="rounded-xl border border-white/10 bg-[#080B14] px-4 py-3 text-white" /></label>
          </section>

          <section
            id={sectionIds.appearance}
            className="scroll-mt-8 space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <div>
              <h2 className="text-xl font-semibold text-white">Appearance</h2>
              <p className="mt-1 text-sm text-slate-400">
                Customise the colours and live liquid-glass appearance of your homepage.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {textField("appearance", "accentColor", "Accent color (hex)")}
              {textField(
                "appearance",
                "backgroundColor",
                "Background color (hex)",
              )}
            </div>

            <div className="space-y-5 rounded-xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white">Liquid Glass</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Controls the glass surfaces across the welcome page.
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-200">
                  <input
                    type="checkbox"
                    checked={glassSettings.enabled}
                    onChange={(event) =>
                      updateGlassSetting("enabled", event.target.checked)
                    }
                    className="h-5 w-5 accent-indigo-500"
                  />
                  Enable liquid glass
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="flex justify-between gap-3 text-sm text-slate-300">
                    <span>Glass strength</span>
                    <span className="tabular-nums text-indigo-300">
                      {Math.round(glassSettings.strength * 100)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={glassSettings.strength}
                    onChange={(event) =>
                      updateGlassSetting("strength", Number(event.target.value))
                    }
                    className="w-full accent-indigo-500"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="flex justify-between gap-3 text-sm text-slate-300">
                    <span>Frost</span>
                    <span className="tabular-nums text-indigo-300">
                      {Math.round(glassSettings.frost * 100)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={glassSettings.frost}
                    onChange={(event) =>
                      updateGlassSetting("frost", Number(event.target.value))
                    }
                    className="w-full accent-indigo-500"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="flex justify-between gap-3 text-sm text-slate-300">
                    <span>Transparency</span>
                    <span className="tabular-nums text-indigo-300">
                      {Math.round(glassSettings.transparency * 100)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={glassSettings.transparency}
                    onChange={(event) =>
                      updateGlassSetting("transparency", Number(event.target.value))
                    }
                    className="w-full accent-indigo-500"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="flex justify-between gap-3 text-sm text-slate-300">
                    <span>Reflection</span>
                    <span className="tabular-nums text-indigo-300">
                      {Math.round(glassSettings.reflection * 100)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={glassSettings.reflection}
                    onChange={(event) =>
                      updateGlassSetting("reflection", Number(event.target.value))
                    }
                    className="w-full accent-indigo-500"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="flex justify-between gap-3 text-sm text-slate-300">
                    <span>Depth</span>
                    <span className="tabular-nums text-indigo-300">
                      {Math.round(glassSettings.depth * 100)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={glassSettings.depth}
                    onChange={(event) =>
                      updateGlassSetting("depth", Number(event.target.value))
                    }
                    className="w-full accent-indigo-500"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="flex justify-between gap-3 text-sm text-slate-300">
                    <span>Corner radius</span>
                    <span className="tabular-nums text-indigo-300">
                      {glassSettings.radius} px
                    </span>
                  </span>
                  <input
                    type="range"
                    min="8"
                    max="40"
                    step="1"
                    value={glassSettings.radius}
                    onChange={(event) =>
                      updateGlassSetting("radius", Number(event.target.value))
                    }
                    className="w-full accent-indigo-500"
                  />
                </label>
              </div>

              <p className="text-xs leading-5 text-slate-500">
                Changes update the editor preview immediately. Save as draft to
                retain your settings, or publish when you are ready to make them
                visible to visitors.
              </p>
            </div>
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
