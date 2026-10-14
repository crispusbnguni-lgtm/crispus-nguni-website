
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MediaUploadField } from "@/components/dashboard/MediaUploadField";

type Insight = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  category: string | null;
  published: boolean;
  featured: boolean;
  publishedAt: string | null;
  sortOrder: number;
};

type InsightForm = {
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  published: boolean;
  featured: boolean;
};

const emptyForm: InsightForm = {
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  category: "",
  published: false,
  featured: false,
};

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#D9A441]/60 focus:bg-white/[0.06]";

const buttonClass =
  "liquid-glass-button inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

export function InsightsManager() {
  const searchParams = useSearchParams();

  const adminUserId =
    searchParams.get("adminUserId")?.trim() || "";

  const insightsApiUrl = adminUserId
    ? `/api/insights?adminUserId=${encodeURIComponent(adminUserId)}`
    : "/api/insights";

  const [insights, setInsights] = useState<Insight[]>([]);
  const [form, setForm] = useState<InsightForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch(insightsApiUrl)
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load insights."
          );
        }

        return data.insights as Insight[];
      })
      .then((data) => {
        if (!cancelled) {
          setInsights(data);
          setLoading(false);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setMessage(error.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [insightsApiUrl]);

  function updateField(
    field: keyof InsightForm,
    value: string | boolean
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setMessage("");
  }

  function editInsight(insight: Insight) {
    setEditingId(insight.id);

    setForm({
      title: insight.title,
      excerpt: insight.excerpt || "",
      content: insight.content,
      coverImage: insight.coverImage || "",
      category: insight.category || "",
      published: insight.published,
      featured: insight.featured,
    });

    setMessage("");

    if (typeof document !== "undefined") {
      document
        .getElementById("insight-editor")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }
  }

  async function saveInsight(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(insightsApiUrl, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingId,
          ...form,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message || "Unable to save insight."
        );
        return;
      }

      if (editingId) {
        setInsights((current) =>
          current.map((insight) =>
            insight.id === editingId
              ? data.insight
              : insight
          )
        );
      } else {
        setInsights((current) => [
          ...current,
          data.insight,
        ]);
      }

      setMessage(
        editingId
          ? "Insight updated successfully."
          : "Insight created successfully."
      );

      setForm(emptyForm);
      setEditingId(null);
    } catch {
      setMessage("Unable to save insight. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteInsight(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this insight? This action cannot be undone."
    );

    if (!confirmed) return;

    setDeletingId(id);
    setMessage("");

    try {
      const response = await fetch(insightsApiUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message || "Unable to delete insight."
        );
        return;
      }

      setInsights((current) =>
        current.filter((insight) => insight.id !== id)
      );

      if (editingId === id) {
        setForm(emptyForm);
        setEditingId(null);
      }

      setMessage("Insight deleted successfully.");
    } catch {
      setMessage("Unable to delete insight. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function togglePublished(insight: Insight) {
    await updateInsight(insight.id, {
      published: !insight.published,
    });
  }

  async function toggleFeatured(insight: Insight) {
    await updateInsight(insight.id, {
      featured: !insight.featured,
    });
  }

  async function updateInsight(
    id: string,
    changes: {
      published?: boolean;
      featured?: boolean;
      sortOrder?: number;
    }
  ) {
    setUpdatingIds((current) =>
      current.includes(id) ? current : [...current, id]
    );
    setMessage("");

    try {
      const response = await fetch(insightsApiUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          ...changes,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message || "Unable to update insight."
        );
        return false;
      }

      setInsights((current) =>
        current.map((insight) =>
          insight.id === id ? data.insight : insight
        )
      );

      return true;
    } catch {
      setMessage("Unable to update insight. Please try again.");
      return false;
    } finally {
      setUpdatingIds((current) =>
        current.filter((item) => item !== id)
      );
    }
  }

  async function moveInsight(
    insight: Insight,
    direction: "up" | "down"
  ) {
    const index = insights.findIndex(
      (item) => item.id === insight.id
    );

    if (index === -1) return;

    const targetIndex =
      direction === "up" ? index - 1 : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= insights.length
    ) {
      return;
    }

    const target = insights[targetIndex];

    setMessage("");

    const results = await Promise.all([
      updateInsight(insight.id, {
        sortOrder: target.sortOrder,
      }),
      updateInsight(target.id, {
        sortOrder: insight.sortOrder,
      }),
    ]);

    if (results.some((result) => !result)) return;

    setInsights((current) => {
      const next = [...current];
      const currentIndex = next.findIndex(
        (item) => item.id === insight.id
      );
      const currentTargetIndex = next.findIndex(
        (item) => item.id === target.id
      );

      if (currentIndex === -1 || currentTargetIndex === -1) {
        return current;
      }

      const currentInsight = next[currentIndex];
      const currentTarget = next[currentTargetIndex];

      next[currentIndex] = {
        ...currentInsight,
        sortOrder: currentTarget.sortOrder,
      };

      next[currentTargetIndex] = {
        ...currentTarget,
        sortOrder: currentInsight.sortOrder,
      };

      return next;
    });
  }

  const messageIsSuccess =
    message.toLowerCase().includes("successfully");

  return (
    <section className="liquid-glass mt-8 rounded-3xl p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#D9A441]">
            Content Management
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white">
            {adminUserId
              ? "Manage User Insights"
              : "Insights & Articles"}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
            Create professional articles, share financial
            knowledge, and build your reputation as a trusted
            thought leader.
          </p>
        </div>

        <div className="liquid-glass rounded-2xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
            Total articles
          </p>
          <p className="mt-1 text-2xl font-semibold text-[#D9A441]">
            {insights.length}
          </p>
        </div>
      </div>

      {/* Admin notice */}
      {adminUserId && (
        <div className="liquid-glass mt-6 rounded-2xl border border-[#D9A441]/20 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-[#D9A441]">
              <span aria-hidden="true">◆</span>
            </span>

            <div>
              <p className="text-sm font-medium text-[#D9A441]">
                Super Admin Mode
              </p>
              <p className="mt-1 text-xs leading-5 text-white/45">
                You are managing the insights and articles of
                the selected user.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status message */}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
            messageIsSuccess
              ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
              : "border-white/10 bg-white/[0.04] text-white/70"
          }`}
        >
          {message}
        </div>
      )}

      {/* Article list */}
      <div className="mt-8 space-y-4">
        {loading ? (
          <>
            <div className="liquid-glass h-32 animate-pulse rounded-2xl" />
            <div className="liquid-glass h-32 animate-pulse rounded-2xl" />
          </>
        ) : insights.length === 0 ? (
          <div className="liquid-glass rounded-2xl border-dashed p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D9A441]/20 bg-[#D9A441]/[0.06]">
              <span className="text-2xl text-[#D9A441]">
                ✦
              </span>
            </div>

            <h3 className="mt-4 text-base font-medium text-white/80">
              Your content library is empty
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
              Create your first insight or article to share
              your knowledge and strengthen your professional
              presence.
            </p>
          </div>
        ) : (
          insights.map((insight, index) => {
            const isUpdating = updatingIds.includes(insight.id);
            const isDeleting = deletingId === insight.id;

            return (
              <article
                key={insight.id}
                className="liquid-glass rounded-2xl p-5 transition duration-300 hover:border-white/15 sm:p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {insight.featured && (
                        <span className="rounded-full border border-[#D9A441]/25 bg-[#D9A441]/[0.08] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-[#D9A441]">
                          Featured
                        </span>
                      )}

                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] ${
                          insight.published
                            ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
                            : "border-white/10 bg-white/[0.04] text-white/45"
                        }`}
                      >
                        {insight.published
                          ? "Published"
                          : "Draft"}
                      </span>

                      {isUpdating && (
                        <span className="text-[10px] text-white/35">
                          Updating...
                        </span>
                      )}
                    </div>

                    <h3 className="mt-4 break-words text-lg font-semibold text-white">
                      {insight.title}
                    </h3>

                    {insight.excerpt && (
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
                        {insight.excerpt}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {insight.category && (
                        <span className="text-xs font-medium uppercase tracking-[0.15em] text-[#D9A441]">
                          {insight.category}
                        </span>
                      )}

                      {insight.publishedAt && (
                        <span className="text-xs text-white/35">
                          {new Date(
                            insight.publishedAt
                          ).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}

                      <span className="text-xs text-white/30">
                        /{insight.slug}
                      </span>
                    </div>
                  </div>

                  {/* Article actions */}
                  <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        moveInsight(insight, "up")
                      }
                      disabled={index === 0 || isUpdating}
                      aria-label={`Move ${insight.title} up`}
                      title="Move up"
                      className={buttonClass}
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        moveInsight(insight, "down")
                      }
                      disabled={
                        index === insights.length - 1 ||
                        isUpdating
                      }
                      aria-label={`Move ${insight.title} down`}
                      title="Move down"
                      className={buttonClass}
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      onClick={() => togglePublished(insight)}
                      disabled={isUpdating || isDeleting}
                      className={buttonClass}
                    >
                      {insight.published
                        ? "Unpublish"
                        : "Publish"}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleFeatured(insight)}
                      disabled={isUpdating || isDeleting}
                      className={buttonClass}
                    >
                      {insight.featured
                        ? "Unfeature"
                        : "Feature"}
                    </button>

                    <button
                      type="button"
                      onClick={() => editInsight(insight)}
                      disabled={isDeleting}
                      className={`${buttonClass} border border-[#D9A441]/25 text-[#D9A441] hover:bg-[#D9A441]/[0.08]`}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteInsight(insight.id)}
                      disabled={isDeleting || isUpdating}
                      className={`${buttonClass} border border-red-400/20 text-red-300 hover:bg-red-400/[0.08]`}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Article editor */}
      <form
        id="insight-editor"
        onSubmit={saveInsight}
        className="mt-10 scroll-mt-24 border-t border-white/10 pt-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#D9A441]">
              {editingId ? "Update Content" : "Content Creator"}
            </p>

            <h3 className="mt-2 text-xl font-semibold text-white">
              {editingId
                ? "Edit Insight"
                : "Create New Insight"}
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/40">
              Write useful content that reflects your expertise
              and builds trust with your audience.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className={`${buttonClass} self-start text-white/55 hover:text-white`}
            >
              Cancel editing
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-5">
          <div>
            <label
              htmlFor="insight-title"
              className="text-sm font-medium text-white/65"
            >
              Article title
            </label>

            <input
              id="insight-title"
              value={form.title}
              onChange={(event) =>
                updateField("title", event.target.value)
              }
              placeholder="Enter a clear, engaging title"
              required
              maxLength={200}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="insight-excerpt"
              className="text-sm font-medium text-white/65"
            >
              Short introduction
            </label>

            <textarea
              id="insight-excerpt"
              value={form.excerpt}
              onChange={(event) =>
                updateField("excerpt", event.target.value)
              }
              placeholder="Summarise the main idea in a few sentences..."
              rows={3}
              maxLength={500}
              className={`${inputClass} resize-y leading-6`}
            />

            <p className="mt-1.5 text-right text-xs text-white/25">
              {form.excerpt.length}/500
            </p>
          </div>

          <div>
            <label
              htmlFor="insight-content"
              className="text-sm font-medium text-white/65"
            >
              Article content
            </label>

            <textarea
              id="insight-content"
              value={form.content}
              onChange={(event) =>
                updateField("content", event.target.value)
              }
              placeholder="Write your complete article here..."
              rows={12}
              required
              className={`${inputClass} resize-y leading-7`}
            />

            <p className="mt-1.5 text-right text-xs text-white/25">
              {form.content.trim()
                ? form.content.trim().split(/\s+/).length
                : 0}{" "}
              words
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="insight-category"
                className="text-sm font-medium text-white/65"
              >
                Category
              </label>

              <input
                id="insight-category"
                value={form.category}
                onChange={(event) =>
                  updateField("category", event.target.value)
                }
                placeholder="Finance, Technology, Leadership..."
                maxLength={100}
                className={inputClass}
              />
            </div>

            <MediaUploadField
              label="Cover Image"
              value={form.coverImage}
              onChange={(value) =>
                updateField("coverImage", value)
              }
              altText={
                form.title
                  ? `${form.title} cover image`
                  : "Insight cover image"
              }
              helpText="Upload a professional cover image for this insight. It will be securely stored and used on the public portfolio."
            />
          </div>

          {/* Publishing options */}
          <div className="liquid-glass rounded-2xl p-5">
            <p className="text-sm font-medium text-white/75">
              Publishing options
            </p>

            <p className="mt-1 text-xs leading-5 text-white/40">
              Choose how this article should appear on your
              public portfolio.
            </p>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-6">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-white/65">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(event) =>
                    updateField(
                      "published",
                      event.target.checked
                    )
                  }
                  className="mt-0.5 h-4 w-4 accent-[#D9A441]"
                />

                <span>
                  <span className="block font-medium text-white/80">
                    Publish immediately
                  </span>
                  <span className="mt-1 block text-xs text-white/40">
                    Make this article available publicly.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 text-sm text-white/65">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) =>
                    updateField(
                      "featured",
                      event.target.checked
                    )
                  }
                  className="mt-0.5 h-4 w-4 accent-[#D9A441]"
                />

                <span>
                  <span className="block font-medium text-white/80">
                    Feature this insight
                  </span>
                  <span className="mt-1 block text-xs text-white/40">
                    Highlight this article on your portfolio.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={saving}
              className="liquid-glass-button inline-flex w-full items-center justify-center rounded-2xl border border-[#D9A441]/30 bg-[#D9A441]/[0.10] px-6 py-3.5 text-sm font-semibold text-[#D9A441] transition hover:bg-[#D9A441]/[0.16] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Insight"
                  : "Create Insight"}
            </button>

            <p className="text-xs leading-5 text-white/35">
              {form.published
                ? "This article is marked for publication."
                : "This article will be saved as a draft unless you publish it."}
            </p>
          </div>
        </div>
      </form>
    </section>
  );
}