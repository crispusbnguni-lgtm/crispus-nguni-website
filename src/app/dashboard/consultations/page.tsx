
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { MotionReveal } from "@/components/ui/MotionReveal";

type ConsultationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "RESCHEDULED";

type ConsultationActivity = {
  id: string;
  title: string;
  content: string | null;
  metadata?: unknown;
  createdAt: string;
  user?: {
    id?: string;
    name: string | null;
    email: string;
  } | null;
};

type Consultation = {
  id: string;
  portfolioId: string;
  title: string;
  status: ConsultationStatus;
  scheduledAt: string;
  timezone: string;
  durationMinutes: number;
  meetingMethod: string | null;
  meetingUrl?: string | null;
  meetingLocation?: string | null;
  notes?: string | null;
  cancellationReason?: string | null;
  confirmedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  activities?: ConsultationActivity[];
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  portfolio: {
    id: string;
    name: string;
    slug: string;
    userId: string;
  };
  consultationType?: {
    title: string;
  };
};

type ApiResponse = {
  success: boolean;
  message?: string;
  consultations?: Consultation[];
  consultation?: Consultation;
};

const STATUS_OPTIONS: ConsultationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
];

const STATUS_STYLES: Record<ConsultationStatus, string> = {
  PENDING: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  CONFIRMED: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  COMPLETED: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  CANCELLED: "border-red-400/25 bg-red-400/10 text-red-200",
  NO_SHOW: "border-orange-400/25 bg-orange-400/10 text-orange-200",
  RESCHEDULED: "border-violet-400/25 bg-violet-400/10 text-violet-200",
};

const glassInput =
  "w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white outline-none transition duration-300 placeholder:text-white/30 focus:border-[#D9A441]/60 focus:ring-2 focus:ring-[#D9A441]/10";

const glassButton =
  "liquid-glass-button inline-flex items-center justify-center gap-2 px-4 py-3 text-sm transition duration-300 disabled:cursor-not-allowed disabled:opacity-50";

const panelClass = "w-full";

function formatDate(value: string, timezone: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  try {
    return new Intl.DateTimeFormat("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
}

function formatActivityDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatStatus(status: ConsultationStatus) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isUpcoming(consultation: Consultation) {
  return (
    new Date(consultation.scheduledAt).getTime() >= Date.now() &&
    !["CANCELLED", "COMPLETED", "NO_SHOW", "RESCHEDULED"].includes(
      consultation.status,
    )
  );
}

export default function ConsultationsPage() {
  const reduceMotion = useReducedMotion();

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [updatingId, setUpdatingId] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const [cancellationTarget, setCancellationTarget] =
    useState<Consultation | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationValidation, setCancellationValidation] = useState("");

  const loadConsultations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/consultation", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load consultations.");
      }

      const items = data.consultations ?? [];
      setConsultations(items);
      setSelected((current) =>
        current ? items.find((item) => item.id === current.id) ?? null : null,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load consultations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialConsultations() {
      setError("");

      try {
        const response = await fetch("/api/consultation", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load consultations.");
        }

        if (!controller.signal.aborted) {
          const items = data.consultations ?? [];
          setConsultations(items);
          setSelected((current) =>
            current ? items.find((item) => item.id === current.id) ?? null : null,
          );
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load consultations.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadInitialConsultations();

    return () => controller.abort();
  }, []);

  const counts = useMemo(
    () => ({
      total: consultations.length,
      pending: consultations.filter((item) => item.status === "PENDING")
        .length,
      confirmed: consultations.filter((item) => item.status === "CONFIRMED")
        .length,
      upcoming: consultations.filter(isUpcoming).length,
    }),
    [consultations],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return consultations.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" || item.status === statusFilter;

      const matchesSearch =
        !query ||
        [
          item.title,
          item.lead.name,
          item.lead.email ?? "",
          item.lead.phone ?? "",
          item.portfolio.name,
        ].some((value) => value.toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [consultations, search, statusFilter]);

  async function updateStatus(
    consultation: Consultation,
    status: ConsultationStatus,
  ) {
    if (status === consultation.status) return;

    setActionError("");
    setNotice("");

    if (status === "CANCELLED") {
      setCancellationTarget(consultation);
      setCancellationReason(consultation.cancellationReason ?? "");
      setCancellationValidation("");
      return;
    }

    await saveStatus(consultation, status);
  }

  async function saveStatus(
    consultation: Consultation,
    status: ConsultationStatus,
    reason?: string,
  ) {
    setUpdatingId(consultation.id);
    setActionError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/consultation/${encodeURIComponent(consultation.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            ...(status === "CANCELLED"
              ? { cancellationReason: reason?.trim() ?? "" }
              : {}),
          }),
        },
      );

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "The consultation status could not be updated.",
        );
      }

      if (data.consultation) {
        setConsultations((current) =>
          current.map((item) =>
            item.id === consultation.id
              ? { ...item, ...data.consultation }
              : item,
          ),
        );

        setSelected((current) =>
          current?.id === consultation.id
            ? { ...current, ...data.consultation }
            : current,
        );
      }

      setCancellationTarget(null);
      setCancellationReason("");
      setCancellationValidation("");
      setNotice(
        status === "CANCELLED"
          ? "Consultation cancelled."
          : "Consultation status updated.",
      );

      await loadConsultations();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to update consultation.",
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function confirmCancellation() {
    if (!cancellationTarget) return;

    const reason = cancellationReason.trim();

    if (!reason) {
      setCancellationValidation(
        "Please enter a reason so the cancellation is documented.",
      );
      return;
    }

    await saveStatus(cancellationTarget, "CANCELLED", reason);
  }

  const summaryCards = [
    {
      label: "Total consultations",
      value: counts.total,
      accent: "text-white",
      icon: "◷",
    },
    {
      label: "Awaiting review",
      value: counts.pending,
      accent: "text-amber-200",
      icon: "◌",
    },
    {
      label: "Confirmed",
      value: counts.confirmed,
      accent: "text-emerald-200",
      icon: "✓",
    },
    {
      label: "Upcoming",
      value: counts.upcoming,
      accent: "text-[#D9A441]",
      icon: "↗",
    },
  ];

  const panelMotion = {
    initial: reduceMotion ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduceMotion ? 0 : 0.35, ease: "easeOut" as const },
  };

  return (
    <main className="min-h-screen px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <MotionReveal>
          <LiquidLensSurface
            radius={28}
            intensity="medium"
            className={`${panelClass} p-6 sm:p-8`}
          >
            <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link
                  href="/dashboard"
                  className="text-sm text-white/55 transition hover:text-white"
                >
                  ← Dashboard
                </Link>

                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.25em] text-[#D9A441]">
                  Client relationships
                </p>

                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Consultations
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                  Review appointment requests, contact prospective clients, and
                  manage consultation statuses from one workspace.
                </p>
              </div>

              <motion.button
                type="button"
                onClick={() => void loadConsultations()}
                disabled={loading}
                whileHover={reduceMotion ? undefined : { y: -2 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className={glassButton}
              >
                {loading ? "Refreshing..." : "↻ Refresh"}
              </motion.button>
            </header>
          </LiquidLensSurface>
        </MotionReveal>

        {error && (
          <LiquidLensSurface
            radius={18}
            intensity="subtle"
            className="mt-6 border border-red-400/30 p-4"
          >
            <div role="alert" className="text-sm text-red-200">
              {error}
              <button
                type="button"
                onClick={() => void loadConsultations()}
                className="ml-3 underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          </LiquidLensSurface>
        )}

        {notice && (
          <LiquidLensSurface
            radius={18}
            intensity="subtle"
            className="mt-5 border border-emerald-400/30 p-4"
          >
            <p role="status" className="text-sm text-emerald-200">
              {notice}
            </p>
          </LiquidLensSurface>
        )}

        {actionError && !cancellationTarget && (
          <LiquidLensSurface
            radius={18}
            intensity="subtle"
            className="mt-5 border border-red-400/30 p-4"
          >
            <p role="alert" className="text-sm text-red-200">
              {actionError}
            </p>
          </LiquidLensSurface>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card, index) => (
            <MotionReveal key={card.label}>
              <motion.div
                {...panelMotion}
                transition={{
                  ...panelMotion.transition,
                  delay: reduceMotion ? 0 : index * 0.06,
                }}
                whileHover={reduceMotion ? undefined : { y: -3 }}
                className="h-full"
              >
                <LiquidLensSurface
                  radius={22}
                  intensity="medium"
                  className="h-full p-5 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-white/60">{card.label}</p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-lg text-[#D9A441]">
                      {card.icon}
                    </span>
                  </div>

                  <p
                    className={`mt-5 text-4xl font-semibold tracking-tight ${card.accent}`}
                  >
                    {loading ? "—" : card.value}
                  </p>

                  <div className="mt-5 h-px w-full bg-gradient-to-r from-[#D9A441]/40 via-white/10 to-transparent" />
                </LiquidLensSurface>
              </motion.div>
            </MotionReveal>
          ))}
        </section>

        <MotionReveal>
          <LiquidLensSurface
            radius={26}
            intensity="medium"
            className="mt-8 overflow-hidden"
          >
            <section>
              <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Appointment requests
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    {filtered.length} result
                    {filtered.length === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[440px]">
                  <label className="block">
                    <span className="mb-2 block text-xs text-white/55">
                      Search
                    </span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Name, email or consultation"
                      className={glassInput}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs text-white/55">
                      Status
                    </span>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className={glassInput}
                    >
                      <option className="bg-[#111319]" value="ALL">
                        All statuses
                      </option>
                      {STATUS_OPTIONS.map((status) => (
                        <option
                          className="bg-[#111319]"
                          key={status}
                          value={status}
                        >
                          {formatStatus(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-sm text-white/55">
                  <span className="mx-auto mb-4 block h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#D9A441]" />
                  Loading consultations...
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-2xl text-[#D9A441]">
                    ◷
                  </div>
                  <h3 className="mt-5 text-lg font-medium">
                    {consultations.length === 0
                      ? "No consultations yet"
                      : "No matching consultations"}
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
                    {consultations.length === 0
                      ? "New requests submitted through your published portfolio will appear here."
                      : "Try changing your search or status filter."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {filtered.map((consultation) => (
                    <article
                      key={consultation.id}
                      className={`p-5 transition duration-300 sm:p-6 ${
                        selected?.id === consultation.id
                          ? "bg-[#D9A441]/[0.06]"
                          : "hover:bg-white/[0.025]"
                      }`}
                    >
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setSelected((current) =>
                              current?.id === consultation.id
                                ? null
                                : consultation,
                            )
                          }
                          aria-expanded={selected?.id === consultation.id}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[consultation.status]}`}
                            >
                              {formatStatus(consultation.status)}
                            </span>
                            <span className="text-xs text-white/45">
                              {consultation.durationMinutes} minutes
                            </span>
                          </div>

                          <h3 className="mt-3 text-lg font-semibold">
                            {consultation.title}
                          </h3>
                          <p className="mt-1 text-sm text-white/75">
                            {consultation.lead.name}
                          </p>
                          <p className="mt-2 break-words text-xs text-white/50">
                            {consultation.lead.email || "No email provided"}
                            {consultation.lead.phone
                              ? ` · ${consultation.lead.phone}`
                              : ""}
                          </p>
                          <p className="mt-3 text-sm text-[#D9A441]">
                            {formatDate(
                              consultation.scheduledAt,
                              consultation.timezone,
                            )}
                          </p>
                          {consultation.meetingMethod && (
                            <p className="mt-1 text-xs text-white/45">
                              {consultation.meetingMethod}
                            </p>
                          )}
                        </button>

                        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                          <motion.button
                            type="button"
                            onClick={() =>
                              setSelected((current) =>
                                current?.id === consultation.id
                                  ? null
                                  : consultation,
                              )
                            }
                            whileHover={reduceMotion ? undefined : { y: -1 }}
                            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                            className="liquid-glass-button px-3 py-2.5 text-xs"
                          >
                            {selected?.id === consultation.id
                              ? "Hide details"
                              : "View details"}
                          </motion.button>

                          <label
                            className="sr-only"
                            htmlFor={`status-${consultation.id}`}
                          >
                            Update consultation status
                          </label>
                          <select
                            id={`status-${consultation.id}`}
                            value={consultation.status}
                            disabled={updatingId === consultation.id}
                            onChange={(event) =>
                              void updateStatus(
                                consultation,
                                event.target.value as ConsultationStatus,
                              )
                            }
                            className="max-w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-xs text-white outline-none transition focus:border-[#D9A441]/60 disabled:opacity-50"
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option
                                className="bg-[#111319]"
                                key={status}
                                value={status}
                              >
                                {formatStatus(status)}
                              </option>
                            ))}
                          </select>

                          {consultation.lead.email && (
                            <a
                              href={`mailto:${consultation.lead.email}`}
                              className="inline-flex items-center justify-center rounded-full border border-[#D9A441]/40 bg-[#D9A441] px-4 py-2.5 text-xs font-semibold text-[#17130B] transition hover:bg-[#E8B957]"
                            >
                              Contact
                            </a>
                          )}
                        </div>
                      </div>

                      {selected?.id === consultation.id && (
                        <motion.div
                          initial={
                            reduceMotion ? false : { opacity: 0, y: 8 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: reduceMotion ? 0 : 0.25,
                          }}
                          className="mt-6 grid gap-4 border-t border-white/10 pt-6 md:grid-cols-2 xl:grid-cols-3"
                        >
                          <LiquidLensSurface
                            radius={18}
                            intensity="subtle"
                            className="p-4"
                          >
                            <p className="text-xs uppercase tracking-wider text-white/45">
                              Visitor
                            </p>
                            <p className="mt-3 font-medium">
                              {consultation.lead.name}
                            </p>
                            <p className="mt-2 break-words text-sm text-white/60">
                              {consultation.lead.email || "No email"}
                            </p>
                            <p className="mt-1 text-sm text-white/60">
                              {consultation.lead.phone || "No phone"}
                            </p>
                            <Link
                              href={`/dashboard/leads/${consultation.lead.id}`}
                              className="mt-4 inline-block text-xs text-[#D9A441] transition hover:text-white"
                            >
                              Open lead record →
                            </Link>
                          </LiquidLensSurface>

                          <LiquidLensSurface
                            radius={18}
                            intensity="subtle"
                            className="p-4"
                          >
                            <p className="text-xs uppercase tracking-wider text-white/45">
                              Appointment
                            </p>
                            <p className="mt-3 font-medium">
                              {formatDate(
                                consultation.scheduledAt,
                                consultation.timezone,
                              )}
                            </p>
                            <p className="mt-2 text-sm text-white/60">
                              Time zone: {consultation.timezone}
                            </p>
                            <p className="mt-1 text-sm text-white/60">
                              Duration: {consultation.durationMinutes} minutes
                            </p>
                            <p className="mt-1 text-sm text-white/60">
                              Method: {consultation.meetingMethod || "Not specified"}
                            </p>
                          </LiquidLensSurface>

                          <LiquidLensSurface
                            radius={18}
                            intensity="subtle"
                            className="p-4"
                          >
                            <p className="text-xs uppercase tracking-wider text-white/45">
                              Portfolio
                            </p>
                            <p className="mt-3 font-medium">
                              {consultation.portfolio.name}
                            </p>
                            <Link
                              href={`/p/${consultation.portfolio.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-block text-sm text-[#D9A441] transition hover:text-white"
                            >
                              View public portfolio →
                            </Link>

                            {consultation.meetingUrl && (
                              <a
                                href={consultation.meetingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 block break-all text-sm text-sky-200 transition hover:text-white"
                              >
                                Open meeting link →
                              </a>
                            )}

                            {consultation.meetingLocation && (
                              <p className="mt-3 text-sm leading-6 text-white/60">
                                {consultation.meetingLocation}
                              </p>
                            )}
                          </LiquidLensSurface>

                          {consultation.notes && (
                            <LiquidLensSurface
                              radius={18}
                              intensity="subtle"
                              className="p-4 md:col-span-2 xl:col-span-3"
                            >
                              <p className="text-xs uppercase tracking-wider text-white/45">
                                Notes
                              </p>
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/70">
                                {consultation.notes}
                              </p>
                            </LiquidLensSurface>
                          )}

                          {consultation.cancellationReason && (
                            <LiquidLensSurface
                              radius={18}
                              intensity="subtle"
                              className="border border-red-400/25 p-4 md:col-span-2 xl:col-span-3"
                            >
                              <p className="text-xs uppercase tracking-wider text-red-200/80">
                                Cancellation reason
                              </p>
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-red-100/80">
                                {consultation.cancellationReason}
                              </p>
                            </LiquidLensSurface>
                          )}

                          <LiquidLensSurface
                            radius={20}
                            intensity="subtle"
                            className="p-4 md:col-span-2 xl:col-span-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs uppercase tracking-wider text-white/45">
                                  Activity history
                                </p>
                                <p className="mt-2 text-sm text-white/55">
                                  Recorded events for this consultation.
                                </p>
                              </div>
                              <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">
                                {consultation.activities?.length ?? 0} events
                              </span>
                            </div>

                            {!consultation.activities?.length ? (
                              <p className="mt-5 rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/50">
                                No activity history was returned by the API yet.
                              </p>
                            ) : (
                              <ol className="mt-5 space-y-4">
                                {consultation.activities.map((activity) => (
                                  <li
                                    key={activity.id}
                                    className="relative border-l border-[#D9A441]/40 pb-1 pl-5 last:border-l-transparent"
                                  >
                                    <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border border-[#D9A441]/70 bg-[#15130F]" />
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                      <p className="text-sm font-medium text-white/90">
                                        {activity.title}
                                      </p>
                                      <time className="text-xs text-white/45">
                                        {formatActivityDate(activity.createdAt)}
                                      </time>
                                    </div>
                                    {activity.content && (
                                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">
                                        {activity.content}
                                      </p>
                                    )}
                                    <p className="mt-2 text-xs text-white/45">
                                      {activity.user?.name ||
                                        activity.user?.email ||
                                        "System"}
                                    </p>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </LiquidLensSurface>
                        </motion.div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </LiquidLensSurface>
        </MotionReveal>

        <footer className="mt-6 px-1 text-xs leading-5 text-white/40">
          Consultation access is controlled by your authenticated API. Status
          changes and cancellation reasons are submitted to the consultation
          update endpoint.
        </footer>
      </div>

      {cancellationTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !updatingId) {
              setCancellationTarget(null);
              setCancellationReason("");
              setCancellationValidation("");
              setActionError("");
            }
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-consultation-title"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="w-full max-w-lg"
          >
            <LiquidLensSurface
              radius={26}
              intensity="strong"
              className="p-6 shadow-2xl sm:p-7"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-200/80">
                Cancellation
              </p>

              <h2
                id="cancel-consultation-title"
                className="mt-3 text-2xl font-semibold"
              >
                Cancel consultation?
              </h2>

              <p className="mt-3 text-sm leading-6 text-white/65">
                You are cancelling the consultation with{" "}
                <span className="font-medium text-white">
                  {cancellationTarget.lead.name}
                </span>
                . Record the reason for future reference.
              </p>

              <label
                htmlFor="cancellation-reason"
                className="mt-6 block text-sm font-medium text-white/80"
              >
                Reason for cancellation
                <span className="ml-1 text-red-200">*</span>
              </label>

              <textarea
                id="cancellation-reason"
                value={cancellationReason}
                onChange={(event) => {
                  setCancellationReason(event.target.value);
                  if (cancellationValidation) setCancellationValidation("");
                }}
                placeholder="For example, the client requested a different date..."
                rows={4}
                maxLength={2000}
                disabled={Boolean(updatingId)}
                className={`${glassInput} mt-2 resize-y leading-6`}
              />

              <div className="mt-2 flex items-center justify-between gap-3">
                {cancellationValidation ? (
                  <p role="alert" className="text-xs text-red-200">
                    {cancellationValidation}
                  </p>
                ) : (
                  <p className="text-xs text-white/45">
                    This will be saved with the consultation.
                  </p>
                )}
                <span className="shrink-0 text-xs text-white/45">
                  {cancellationReason.length}/2000
                </span>
              </div>

              {actionError && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200"
                >
                  {actionError}
                </p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={Boolean(updatingId)}
                  onClick={() => {
                    setCancellationTarget(null);
                    setCancellationReason("");
                    setCancellationValidation("");
                    setActionError("");
                  }}
                  className="liquid-glass-button px-4 py-3 text-sm"
                >
                  Keep consultation
                </button>

                <button
                  type="button"
                  disabled={Boolean(updatingId)}
                  onClick={() => void confirmCancellation()}
                  className="rounded-full border border-red-400/30 bg-red-500/15 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updatingId === cancellationTarget.id
                    ? "Cancelling..."
                    : "Confirm cancellation"}
                </button>
              </div>
            </LiquidLensSurface>
          </motion.section>
        </div>
      )}
    </main>
  );
}