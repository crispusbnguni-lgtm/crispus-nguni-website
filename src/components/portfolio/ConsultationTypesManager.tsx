
"use client";

import { useCallback, useEffect, useState } from "react";

type ConsultationType = {
  id: string;
  portfolioId: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  meetingMethod: string | null;
  active: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ConsultationTypesManagerProps = {
  adminUserId?: string;
};

const DEFAULT_FORM = {
  title: "",
  description: "",
  durationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 15,
  minimumNoticeMinutes: 120,
  maximumAdvanceDays: 60,
  meetingMethod: "Online",
  active: true,
  featured: false,
  sortOrder: 0,
};

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#D9A441]/60 focus:bg-white/[0.06]";

const buttonClass =
  "liquid-glass-button inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

export function ConsultationTypesManager({
  adminUserId = "",
}: ConsultationTypesManagerProps) {
  const [consultationTypes, setConsultationTypes] = useState<
    ConsultationType[]
  >([]);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const apiUrl = adminUserId
    ? `/api/consultations/types?adminUserId=${encodeURIComponent(
        adminUserId,
      )}`
    : "/api/consultations/types";

  const loadConsultationTypes = useCallback(async () => {
    const response = await fetch(apiUrl, {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          data.error ||
          "Unable to load consultation types.",
      );
    }

    setConsultationTypes(data.consultationTypes || []);
  }, [apiUrl]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(apiUrl, {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              data.error ||
              "Unable to load consultation types.",
          );
        }

        if (!cancelled) {
          setConsultationTypes(data.consultationTypes || []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load consultation types.",
          );
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  }

  function startEditing(consultationType: ConsultationType) {
    setEditingId(consultationType.id);

    setForm({
      title: consultationType.title,
      description: consultationType.description || "",
      durationMinutes: consultationType.durationMinutes,
      bufferBeforeMinutes: consultationType.bufferBeforeMinutes,
      bufferAfterMinutes: consultationType.bufferAfterMinutes,
      minimumNoticeMinutes: consultationType.minimumNoticeMinutes,
      maximumAdvanceDays: consultationType.maximumAdvanceDays,
      meetingMethod: consultationType.meetingMethod || "",
      active: consultationType.active,
      featured: consultationType.featured,
      sortOrder: consultationType.sortOrder,
    });

    setSuccess("");
    setError("");

    document
      .getElementById("consultation-type-editor")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(apiUrl, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          editingId
            ? { id: editingId, ...form }
            : form,
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to save consultation type.",
        );
      }

      setSuccess(
        editingId
          ? "Consultation type updated successfully."
          : "Consultation type created successfully.",
      );

      resetForm();
      await loadConsultationTypes();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save consultation type.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Delete this consultation type? If it has booking history, it may be protected from deletion.",
    );

    if (!confirmed) return;

    setDeletingId(id);
    setError("");
    setSuccess("");

    try {
      const separator = apiUrl.includes("?") ? "&" : "?";

      const response = await fetch(
        `${apiUrl}${separator}id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to delete consultation type.",
        );
      }

      if (editingId === id) {
        resetForm();
      }

      setSuccess("Consultation type deleted successfully.");
      await loadConsultationTypes();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete consultation type.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(
    consultationType: ConsultationType,
  ) {
    setUpdatingId(consultationType.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: consultationType.id,
          active: !consultationType.active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to update consultation type.",
        );
      }

      setSuccess(
        consultationType.active
          ? "Consultation type deactivated."
          : "Consultation type activated.",
      );

      await loadConsultationTypes();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update consultation type.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="liquid-glass mt-8 rounded-3xl p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#D9A441]">
            Consultation System
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
            Consultation Types
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
            Configure the consultation services visitors can
            book through your professional website. Control
            meeting methods, availability rules, and booking
            preferences from one place.
          </p>
        </div>

        <div className="liquid-glass shrink-0 rounded-2xl px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
            Total options
          </p>
          <p className="mt-1 text-2xl font-semibold text-[#D9A441]">
            {consultationTypes.length}
          </p>
          <p className="mt-1 text-xs text-white/35">
            {consultationTypes.filter((item) => item.active).length}{" "}
            active
          </p>
        </div>
      </div>

      {/* Admin notice */}
      {adminUserId && (
        <div className="liquid-glass mt-6 rounded-2xl border border-[#D9A441]/20 p-4">
          <p className="text-sm font-medium text-[#D9A441]">
            Super Admin Mode
          </p>
          <p className="mt-1 text-xs leading-5 text-white/45">
            You are managing consultation options for the
            selected user.
          </p>
        </div>
      )}

      {/* Feedback */}
      {error && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-300"
        >
          {success}
        </div>
      )}

      {/* Editor */}
      <form
        id="consultation-type-editor"
        onSubmit={handleSubmit}
        className="liquid-glass mt-8 scroll-mt-24 rounded-3xl p-5 sm:p-7"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#D9A441]">
              {editingId ? "Update Service" : "Service Setup"}
            </p>

            <h3 className="mt-2 text-xl font-semibold text-white">
              {editingId
                ? "Edit Consultation Type"
                : "Create Consultation Type"}
            </h3>

            <p className="mt-2 text-sm leading-6 text-white/40">
              Define the consultation experience before visitors
              book an appointment.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className={`${buttonClass} self-start text-white/60 hover:text-white`}
            >
              Cancel editing
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label
              htmlFor="consultation-title"
              className="text-sm font-medium text-white/65"
            >
              Consultation title
            </label>

            <input
              id="consultation-title"
              type="text"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Financial Planning Consultation"
              required
              maxLength={200}
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="consultation-description"
              className="text-sm font-medium text-white/65"
            >
              Description
            </label>

            <textarea
              id="consultation-description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Explain what the consultation covers and who it is designed for..."
              rows={4}
              className={`${inputClass} resize-y leading-6`}
            />
          </div>

          <div>
            <label
              htmlFor="consultation-duration"
              className="text-sm font-medium text-white/65"
            >
              Duration
            </label>

            <select
              id="consultation-duration"
              value={form.durationMinutes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  durationMinutes: Number(event.target.value),
                }))
              }
              className={inputClass}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
              <option value={120}>120 minutes</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="consultation-method"
              className="text-sm font-medium text-white/65"
            >
              Meeting method
            </label>

            <select
              id="consultation-method"
              value={form.meetingMethod}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  meetingMethod: event.target.value,
                }))
              }
              className={inputClass}
            >
              <option value="Online">Online</option>
              <option value="Phone">Phone</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="In Person">In Person</option>
              <option value="Online / Phone">Online / Phone</option>
              <option value="">Not specified</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="consultation-buffer-before"
              className="text-sm font-medium text-white/65"
            >
              Buffer before
            </label>

            <select
              id="consultation-buffer-before"
              value={form.bufferBeforeMinutes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bufferBeforeMinutes: Number(event.target.value),
                }))
              }
              className={inputClass}
            >
              <option value={0}>No buffer</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="consultation-buffer-after"
              className="text-sm font-medium text-white/65"
            >
              Buffer after
            </label>

            <select
              id="consultation-buffer-after"
              value={form.bufferAfterMinutes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bufferAfterMinutes: Number(event.target.value),
                }))
              }
              className={inputClass}
            >
              <option value={0}>No buffer</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="consultation-notice"
              className="text-sm font-medium text-white/65"
            >
              Minimum booking notice
            </label>

            <select
              id="consultation-notice"
              value={form.minimumNoticeMinutes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  minimumNoticeMinutes: Number(event.target.value),
                }))
              }
              className={inputClass}
            >
              <option value={0}>No minimum notice</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={240}>4 hours</option>
              <option value={1440}>24 hours</option>
              <option value={2880}>48 hours</option>
              <option value={10080}>7 days</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="consultation-advance"
              className="text-sm font-medium text-white/65"
            >
              Maximum advance booking
            </label>

            <select
              id="consultation-advance"
              value={form.maximumAdvanceDays}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  maximumAdvanceDays: Number(event.target.value),
                }))
              }
              className={inputClass}
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>365 days</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="consultation-sort-order"
              className="text-sm font-medium text-white/65"
            >
              Sort order
            </label>

            <input
              id="consultation-sort-order"
              type="number"
              min={0}
              step={1}
              value={form.sortOrder}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sortOrder: Math.max(
                    0,
                    Number(event.target.value) || 0,
                  ),
                }))
              }
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-white/30">
              Lower numbers can be displayed first if your
              public page sorts by this value.
            </p>
          </div>
        </div>

        {/* Visibility settings */}
        <div className="liquid-glass mt-6 rounded-2xl p-5">
          <p className="text-sm font-medium text-white/75">
            Availability and visibility
          </p>

          <p className="mt-1 text-xs leading-5 text-white/40">
            Choose whether this consultation can be booked and
            whether it should be highlighted.
          </p>

          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:gap-8">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
                className="mt-0.5 h-4 w-4 accent-[#D9A441]"
              />

              <span>
                <span className="block text-sm font-medium text-white/80">
                  Active and bookable
                </span>
                <span className="mt-1 block text-xs leading-5 text-white/40">
                  Allow visitors to select this consultation.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    featured: event.target.checked,
                  }))
                }
                className="mt-0.5 h-4 w-4 accent-[#D9A441]"
              />

              <span>
                <span className="block text-sm font-medium text-white/80">
                  Featured consultation
                </span>
                <span className="mt-1 block text-xs leading-5 text-white/40">
                  Highlight this option where supported.
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Form actions */}
        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={saving}
            className="liquid-glass-button inline-flex w-full items-center justify-center rounded-2xl border border-[#D9A441]/30 bg-[#D9A441]/[0.10] px-6 py-3.5 text-sm font-semibold text-[#D9A441] transition hover:bg-[#D9A441]/[0.16] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Update Consultation"
                : "Create Consultation"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className={`${buttonClass} text-white/55 hover:text-white`}
            >
              Cancel
            </button>
          )}

          <p className="text-xs leading-5 text-white/35 sm:ml-auto">
            {form.active
              ? "This consultation is marked as bookable."
              : "This consultation is marked as inactive."}
          </p>
        </div>
      </form>

      {/* Existing consultation types */}
      <div className="mt-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#D9A441]">
              Your Services
            </p>

            <h3 className="mt-2 text-xl font-semibold text-white">
              Your Consultation Options
            </h3>

            <p className="mt-1 text-sm text-white/40">
              Manage the consultation services available on
              your website.
            </p>
          </div>

          <p className="text-sm text-white/40">
            {consultationTypes.length}{" "}
            {consultationTypes.length === 1
              ? "consultation type"
              : "consultation types"}
          </p>
        </div>

        {loading ? (
          <div className="mt-5 space-y-4">
            <div className="liquid-glass h-32 animate-pulse rounded-2xl" />
            <div className="liquid-glass h-32 animate-pulse rounded-2xl" />
          </div>
        ) : consultationTypes.length === 0 ? (
          <div className="liquid-glass mt-5 rounded-2xl border-dashed p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D9A441]/20 bg-[#D9A441]/[0.06]">
              <span className="text-2xl text-[#D9A441]">
                ✦
              </span>
            </div>

            <h4 className="mt-4 text-base font-medium text-white/80">
              No consultation types yet
            </h4>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
              Create your first consultation option above to
              help visitors understand and book your services.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {consultationTypes.map((consultationType) => {
              const isDeleting =
                deletingId === consultationType.id;
              const isUpdating =
                updatingId === consultationType.id;

              const notice =
                consultationType.minimumNoticeMinutes;

              const noticeLabel =
                notice === 0
                  ? "No minimum notice"
                  : notice < 60
                    ? `${notice} min notice`
                    : notice % 1440 === 0
                      ? `${notice / 1440} day${
                          notice / 1440 === 1 ? "" : "s"
                        } notice`
                      : notice % 60 === 0
                        ? `${notice / 60} hr notice`
                        : `${Math.floor(notice / 60)} hr ${notice % 60} min notice`;

              return (
                <article
                  key={consultationType.id}
                  className="liquid-glass rounded-2xl p-5 transition duration-300 hover:border-white/15 sm:p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="break-words text-lg font-semibold text-white">
                          {consultationType.title}
                        </h4>

                        {consultationType.featured && (
                          <span className="rounded-full border border-[#D9A441]/25 bg-[#D9A441]/[0.08] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#D9A441]">
                            Featured
                          </span>
                        )}

                        <span
                          className={`rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${
                            consultationType.active
                              ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
                              : "border-white/10 bg-white/[0.04] text-white/40"
                          }`}
                        >
                          {consultationType.active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>

                      {consultationType.description && (
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
                          {consultationType.description}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
                          <span className="text-[#D9A441]">
                            Duration:
                          </span>{" "}
                          {consultationType.durationMinutes} min
                        </span>

                        {consultationType.meetingMethod && (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
                            <span className="text-[#D9A441]">
                              Method:
                            </span>{" "}
                            {consultationType.meetingMethod}
                          </span>
                        )}

                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
                          {noticeLabel}
                        </span>

                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
                          Up to{" "}
                          {consultationType.maximumAdvanceDays}{" "}
                          days ahead
                        </span>

                        {consultationType.bufferBeforeMinutes > 0 && (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
                            {consultationType.bufferBeforeMinutes} min before
                          </span>
                        )}

                        {consultationType.bufferAfterMinutes > 0 && (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
                            {consultationType.bufferAfterMinutes} min after
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          toggleActive(consultationType)
                        }
                        disabled={isUpdating || isDeleting}
                        className={buttonClass}
                      >
                        {isUpdating
                          ? "Updating..."
                          : consultationType.active
                            ? "Deactivate"
                            : "Activate"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          startEditing(consultationType)
                        }
                        disabled={isDeleting}
                        className={`${buttonClass} border border-[#D9A441]/25 text-[#D9A441] hover:bg-[#D9A441]/[0.08]`}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(consultationType.id)
                        }
                        disabled={isDeleting || isUpdating}
                        className={`${buttonClass} border border-red-400/20 text-red-300 hover:bg-red-400/[0.08]`}
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}