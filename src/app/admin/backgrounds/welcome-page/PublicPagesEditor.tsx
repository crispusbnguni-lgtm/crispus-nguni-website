
"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PUBLIC_SITE_PAGES,
  PUBLIC_SITE_PAGE_KEYS,
  type PublicSitePageContent,
  type PublicSitePageKey,
} from "@/lib/public-site-pages";

const labels: Record<PublicSitePageKey, string> = {
  about: "About",
  "how-it-works": "How it works",
  services: "Services",
  contact: "Contact",
};

type State = {
  publishedContent: PublicSitePageContent;
  draftContent: PublicSitePageContent | null;
  history: Array<{
    content: PublicSitePageContent;
    publishedAt: string;
  }>;
  publishedAt: string | null;
};

export default function PublicPagesEditor() {
  const [pageKey, setPageKey] = useState<PublicSitePageKey>("about");
  const [state, setState] = useState<State | null>(null);
  const [content, setContent] = useState<PublicSitePageContent>(
    DEFAULT_PUBLIC_SITE_PAGES.about,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isDirty = Boolean(
    state &&
      JSON.stringify(content) !==
        JSON.stringify(state.draftContent ?? state.publishedContent),
  );

  async function load(key: PublicSitePageKey) {
    try {
      const response = await fetch(
        `/api/admin/backgrounds/welcome-page?pageKey=${encodeURIComponent(key)}`,
        { cache: "no-store" },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load this page.");
      }

      const next: State = {
        publishedContent: result.publishedContent,
        draftContent: result.draftContent,
        history: result.history ?? [],
        publishedAt: result.publishedAt ?? null,
      };

      setState(next);
      setContent(next.draftContent ?? next.publishedContent);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load this page.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      try {
        const response = await fetch(
          `/api/admin/backgrounds/welcome-page?pageKey=${encodeURIComponent(pageKey)}`,
          { cache: "no-store" },
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load this page.");
        }

        if (cancelled) return;

        const next: State = {
          publishedContent: result.publishedContent,
          draftContent: result.draftContent,
          history: result.history ?? [],
          publishedAt: result.publishedAt ?? null,
        };

        setState(next);
        setContent(next.draftContent ?? next.publishedContent);
        setError("");
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load this page.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  function update<K extends keyof PublicSitePageContent>(
    key: K,
    value: PublicSitePageContent[K],
  ) {
    setContent((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateSection(
    index: number,
    field: "title" | "body" | "visible" | "mediaUrl",
    value: string | boolean,
  ) {
    setContent((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) =>
        sectionIndex === index
          ? { ...section, [field]: value }
          : section,
      ),
    }));
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;

    if (target < 0 || target >= content.sections.length) return;

    setContent((current) => {
      const sections = [...current.sections];

      [sections[index], sections[target]] = [
        sections[target],
        sections[index],
      ];

      return { ...current, sections };
    });
  }

  async function submit(
    action: "draft" | "publish" | "restore",
    versionPublishedAt?: string,
  ) {
    if (
      action === "publish" &&
      !window.confirm(`Publish the ${labels[pageKey]} page now?`)
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/backgrounds/welcome-page",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pageKey,
            action,
            content: action === "restore" ? undefined : content,
            versionPublishedAt,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save this page.");
      }

      setMessage(result.message || "Changes saved.");

      setLoading(true);
      setError("");

      await load(pageKey);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save this page.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-12 rounded-[28px] border border-white/10 bg-slate-950/45 p-5 text-white shadow-xl backdrop-blur-xl sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
            Public pages
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            Website page editor
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            Drafts remain private until published. Contact fields are shown
            publicly only when you choose to fill them in.
          </p>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          Select page

          <select
            value={pageKey}
            onChange={(event) => {
              if (
                isDirty &&
                !window.confirm(
                  "Discard unsaved edits and switch pages?",
                )
              ) {
                return;
              }

              setLoading(true);
              setError("");
              setMessage("");
              setPageKey(event.target.value as PublicSitePageKey);
            }}
            className="min-h-11 rounded-xl border border-white/15 bg-slate-900 px-3 text-white"
          >
            {PUBLIC_SITE_PAGE_KEYS.map((key) => (
              <option key={key} value={key}>
                {labels[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="py-10 text-white/70" role="status">
          Loading page settings…
        </p>
      ) : error && !state ? (
        <p className="mt-6 text-red-300" role="alert">
          {error}
        </p>
      ) : (
        <div className="mt-7 grid gap-5">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-300/20 bg-red-950/30 p-3 text-sm text-red-200"
            >
              {error}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="rounded-xl border border-emerald-300/20 bg-emerald-950/30 p-3 text-sm text-emerald-100"
            >
              {message}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="SEO title"
              value={content.metaTitle}
              onChange={(value) => update("metaTitle", value)}
            />

            <Field
              label="Social image (HTTPS URL)"
              value={content.socialImage}
              onChange={(value) => update("socialImage", value)}
            />

            <Field
              label="SEO description"
              value={content.metaDescription}
              onChange={(value) => update("metaDescription", value)}
            />

            <Field
              label="Page title"
              value={content.title}
              onChange={(value) => update("title", value)}
            />

            <Field
              label="Eyebrow"
              value={content.eyebrow}
              onChange={(value) => update("eyebrow", value)}
            />

            <Field
              label="CTA label"
              value={content.ctaLabel}
              onChange={(value) => update("ctaLabel", value)}
            />

            <Field
              label="CTA destination"
              value={content.ctaHref}
              onChange={(value) => update("ctaHref", value)}
            />

            <Field
              label="Accent colour"
              value={content.accentColor}
              onChange={(value) => update("accentColor", value)}
            />

            <Field
              label="Optional page background image (HTTPS URL)"
              value={content.backgroundImage}
              onChange={(value) => update("backgroundImage", value)}
            />

            <label className="grid gap-2 text-sm font-medium">
              Background focal position

              <select
                value={content.backgroundPosition ?? "center center"}
                onChange={(event) =>
                  update("backgroundPosition", event.target.value)
                }
                className="min-h-11 rounded-xl border border-white/15 bg-slate-900 px-3 text-white"
              >
                <option value="center center">Center</option>
                <option value="center top">Top center</option>
                <option value="center bottom">Bottom center</option>
                <option value="left center">Left</option>
                <option value="right center">Right</option>
              </select>
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium">
            Introduction

            <textarea
              rows={3}
              value={content.subtitle}
              onChange={(event) => update("subtitle", event.target.value)}
              className="rounded-xl border border-white/15 bg-slate-900 px-3 py-2"
            />
          </label>

          {pageKey === "contact" && (
            <div className="grid gap-4 rounded-2xl border border-amber-200/20 bg-amber-950/20 p-4 md:grid-cols-3">
              <Field
                label="Public email (optional)"
                value={content.contactEmail}
                onChange={(value) => update("contactEmail", value)}
              />

              <Field
                label="Public phone (optional)"
                value={content.contactPhone}
                onChange={(value) => update("contactPhone", value)}
              />

              <Field
                label="Public location (optional)"
                value={content.contactLocation}
                onChange={(value) => update("contactLocation", value)}
              />
            </div>
          )}

          <div className="grid gap-4">
            {content.sections.map((section, index) => (
              <fieldset
                key={section.id}
                className="rounded-2xl border border-white/10 p-4 sm:p-5"
              >
                <legend className="px-2 font-semibold">
                  {section.title || `Section ${index + 1}`}
                </legend>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveSection(index, -1)}
                    className="min-h-10 rounded-lg border border-white/15 px-3 text-sm disabled:opacity-40"
                  >
                    Move up
                  </button>

                  <button
                    type="button"
                    disabled={index === content.sections.length - 1}
                    onClick={() => moveSection(index, 1)}
                    className="min-h-10 rounded-lg border border-white/15 px-3 text-sm disabled:opacity-40"
                  >
                    Move down
                  </button>

                  <label className="flex min-h-10 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={section.visible}
                      onChange={(event) =>
                        updateSection(index, "visible", event.target.checked)
                      }
                    />
                    Visible
                  </label>
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="grid gap-2 text-sm">
                    Section title

                    <input
                      value={section.title}
                      onChange={(event) =>
                        updateSection(index, "title", event.target.value)
                      }
                      className="min-h-10 rounded-lg border border-white/15 bg-slate-900 px-3"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    Section text

                    <textarea
                      rows={3}
                      value={section.body}
                      onChange={(event) =>
                        updateSection(index, "body", event.target.value)
                      }
                      className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2"
                    />
                  </label>

                  <Field
                    label="Optional section image (HTTPS URL)"
                    value={section.mediaUrl ?? ""}
                    onChange={(value) =>
                      updateSection(index, "mediaUrl", value)
                    }
                  />

                  {section.items.map((item, itemIndex) => (
                    <div
                      key={`${section.id}-item-${itemIndex}`}
                      className="grid gap-3 rounded-xl bg-white/[0.035] p-3 sm:grid-cols-2"
                    >
                      <label className="grid gap-1 text-xs">
                        Item title

                        <input
                          value={item.title}
                          onChange={(event) =>
                            setContent((current) => ({
                              ...current,
                              sections: current.sections.map((entry, i) =>
                                i === index
                                  ? {
                                      ...entry,
                                      items: entry.items.map((child, j) =>
                                        j === itemIndex
                                          ? {
                                              ...child,
                                              title: event.target.value,
                                            }
                                          : child,
                                      ),
                                    }
                                  : entry,
                              ),
                            }))
                          }
                          className="min-h-10 rounded-lg border border-white/15 bg-slate-900 px-3 text-sm"
                        />
                      </label>

                      <label className="grid gap-1 text-xs">
                        Item text

                        <textarea
                          rows={2}
                          value={item.body}
                          onChange={(event) =>
                            setContent((current) => ({
                              ...current,
                              sections: current.sections.map((entry, i) =>
                                i === index
                                  ? {
                                      ...entry,
                                      items: entry.items.map((child, j) =>
                                        j === itemIndex
                                          ? {
                                              ...child,
                                              body: event.target.value,
                                            }
                                          : child,
                                      ),
                                    }
                                  : entry,
                              ),
                            }))
                          }
                          className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit("draft")}
              className="min-h-11 rounded-xl border border-white/20 px-5 font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => void submit("publish")}
              className="min-h-11 rounded-xl bg-blue-600 px-5 font-semibold disabled:opacity-50"
            >
              Publish page
            </button>
          </div>

          <details className="rounded-2xl border border-white/10 p-4">
            <summary className="cursor-pointer font-semibold">
              Preview current draft
            </summary>

            <article
              className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-5"
              style={{ borderColor: `${content.accentColor}66` }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: content.accentColor }}
              >
                {content.eyebrow}
              </p>

              <h3 className="mt-2 text-2xl font-semibold">
                {content.title}
              </h3>

              <p className="mt-3 leading-7 text-white/70">
                {content.subtitle}
              </p>

              {content.sections
                .filter((section) => section.visible)
                .map((section) => (
                  <section
                    key={section.id}
                    className="mt-5 border-t border-white/10 pt-4"
                  >
                    <h4 className="font-semibold">{section.title}</h4>

                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/70">
                      {section.body}
                    </p>

                    {section.items.map((item, index) => (
                      <p
                        key={`${section.id}-preview-${index}`}
                        className="mt-3 text-sm"
                      >
                        <strong>{item.title}</strong>
                        <span className="ml-2 text-white/65">
                          {item.body}
                        </span>
                      </p>
                    ))}
                  </section>
                ))}

              <span
                className="mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-white/20"
                style={{ backgroundColor: `${content.accentColor}55` }}
              >
                {content.ctaLabel}
              </span>
            </article>
          </details>

          <p className="text-sm text-white/60">
            Last published:{" "}
            {state?.publishedAt
              ? new Date(state.publishedAt).toLocaleString()
              : "Using the built-in page until the first publish."}
          </p>

          {state?.history.length ? (
            <details className="rounded-2xl border border-white/10 p-4">
              <summary className="cursor-pointer font-semibold">
                Publication history ({state.history.length})
              </summary>

              <ul className="mt-4 grid gap-2">
                {state.history.map((version) => (
                  <li
                    key={version.publishedAt}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.035] p-3 text-sm"
                  >
                    <span>
                      {new Date(version.publishedAt).toLocaleString()}
                    </span>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void submit("restore", version.publishedAt)
                      }
                      className="min-h-10 rounded-lg border border-white/15 px-3"
                    >
                      Restore to draft
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl border border-white/15 bg-slate-900 px-3 text-white"
      />
    </label>
  );
}
