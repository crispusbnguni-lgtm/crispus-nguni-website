"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import type React from "react";

type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "DISQUALIFIED"
  | "CONVERTED"
  | "LOST";

type LeadTemperature = "HOT" | "WARM" | "COLD" | "DORMANT";

type ActivityType =
  | "NOTE"
  | "CALL"
  | "EMAIL"
  | "WHATSAPP"
  | "MEETING"
  | "FOLLOW_UP";

type LeadActivity = {
  id: string;
  type: string;
  title: string;
  content: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  user?: { name: string | null; email: string } | null;
};

type Consultation = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  consultationType?: { title: string } | null;
};

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  location: string | null;
  message: string | null;
  source: string;
  status: LeadStatus;
  temperature: LeadTemperature;
  score: number;
  interestedIn: string | null;
  budget: string | null;
  timeline: string | null;
  decisionMaker: boolean | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
  portfolio?: {
  id: string;
  name: string;
  slug: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    portfolioSite?: {
  theme: string;
  dashboardBackground: string | null;
} | null;
  } | null;
} | null;
  activities: LeadActivity[];
  consultations: Consultation[];
};

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "DISQUALIFIED", label: "Disqualified" },
  { value: "CONVERTED", label: "Converted" },
  { value: "LOST", label: "Lost" },
];

const temperatureOptions: { value: LeadTemperature; label: string }[] = [
  { value: "HOT", label: "Hot" },
  { value: "WARM", label: "Warm" },
  { value: "COLD", label: "Cold" },
  { value: "DORMANT", label: "Dormant" },
];

const activityOptions: { value: ActivityType; label: string }[] = [
  { value: "NOTE", label: "Note" },
  { value: "CALL", label: "Phone call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "MEETING", label: "Meeting" },
  { value: "FOLLOW_UP", label: "Follow-up" },
];

const panelClass =
  "liquid-glass rounded-2xl border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.12)]";

const fieldClass =
  "w-full rounded-xl border border-white/15 bg-white/[0.045] px-3 py-3 text-sm text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none backdrop-blur-2xl transition-all duration-300 placeholder:text-[var(--text-muted)] hover:border-white/25 hover:bg-white/[0.065] focus:border-[#D9A441]/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-[#D9A441]/10";

const labelClass =
  "mb-2 block text-sm font-medium text-[var(--text-muted)]";

const headingClass = "text-lg font-bold text-[var(--text)]";

const mutedClass = "text-[var(--text-muted)]";

const goldButtonClass =
  "rounded-xl border border-[#D9A441]/40 bg-[#D9A441] px-4 py-3 text-sm font-semibold text-[#15110A] shadow-[0_8px_24px_rgba(217,164,65,0.12)] transition hover:bg-[#E8B957] disabled:cursor-not-allowed disabled:opacity-50";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );

  return localDate.toISOString().slice(0, 16);
}

function labelFor(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusClasses(status: string) {
  switch (status) {
    case "QUALIFIED":
    case "CONVERTED":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
    case "CONTACTED":
      return "border-sky-400/25 bg-sky-400/10 text-sky-300";
    case "LOST":
    case "DISQUALIFIED":
      return "border-red-400/25 bg-red-400/10 text-red-300";
    default:
      return "border-white/15 bg-white/[0.05] text-[var(--text-muted)]";
  }
}

function temperatureClasses(temperature: string) {
  switch (temperature) {
    case "HOT":
      return "border-red-400/25 bg-red-400/10 text-red-300";
    case "WARM":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200";
    case "COLD":
      return "border-sky-400/25 bg-sky-400/10 text-sky-200";
    default:
      return "border-white/15 bg-white/[0.05] text-[var(--text-muted)]";
  }
}

function activitySymbol(type: string) {
  switch (type) {
    case "CALL":
      return "☎";
    case "EMAIL":
      return "✉";
    case "WHATSAPP":
      return "W";
    case "MEETING":
      return "M";
    case "FOLLOW_UP":
      return "↗";
    case "STATUS_CHANGE":
      return "↻";
    case "TEMPERATURE_CHANGE":
      return "°";
    default:
      return "N";
  }
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium text-[var(--text)]">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className={headingClass}>{title}</h2>
      {description && (
        <p className={`mt-1 text-sm leading-6 ${mutedClass}`}>
          {description}
        </p>
      )}
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const leadId = params.id;

const [lead, setLead] = useState<Lead | null>(null);
  
  const [status, setStatus] = useState<LeadStatus>("NEW");
  const [temperature, setTemperature] = useState<LeadTemperature>("COLD");
  const [followUp, setFollowUp] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activityType, setActivityType] = useState<ActivityType>("NOTE");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityContent, setActivityContent] = useState("");
  const [activityOutcome, setActivityOutcome] = useState("");
  const [activityFollowUp, setActivityFollowUp] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);
const portfolioSite = lead?.portfolio?.user?.portfolioSite;
const ownerBackground = portfolioSite?.dashboardBackground;
const ownerTheme = portfolioSite?.theme?.toLowerCase();

const ownerPageStyle = {
  background:
    ownerBackground && !/^https?:\/\//i.test(ownerBackground)
      ? ownerBackground
      : ownerTheme === "light"
        ? "#F8FAFC"
        : "var(--dashboard-background, #05070D)",

  ...(ownerBackground && /^https?:\/\//i.test(ownerBackground)
    ? {
        backgroundImage: `url("${ownerBackground}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed" as const,
      }
    : {}),

  ...(ownerTheme === "light"
    ? {
        color: "#111827",
        "--text": "#111827",
        "--text-muted": "#64748B",
      }
    : {}),
} as React.CSSProperties;

  const loadLead = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/leads/${encodeURIComponent(leadId)}`,
        { cache: "no-store" },
      );

      const result = await response.json();

      if (!response.ok || !result.success || !result.lead) {
        throw new Error(result.message || "Unable to load this lead.");
      }

      const loadedLead = result.lead as Lead;

      setLead(loadedLead);
      setStatus(loadedLead.status);
      setTemperature(loadedLead.temperature);
      setFollowUp(toDateTimeLocal(loadedLead.nextFollowUpAt));
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load this lead.",
      );
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (!cancelled) void loadLead();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadLead]);

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/leads/${encodeURIComponent(leadId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            temperature,
            nextFollowUpAt: followUp
              ? new Date(followUp).toISOString()
              : null,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save lead changes.");
      }

      setSuccess("Lead details updated successfully.");
      await loadLead();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save lead changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function recordActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = activityTitle.trim();

    if (!title) {
      setError("Enter a title for this activity.");
      return;
    }

    if (
      activityFollowUp &&
      Number.isNaN(new Date(activityFollowUp).getTime())
    ) {
      setError("Enter a valid follow-up date and time.");
      return;
    }

    setSavingActivity(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/leads/${encodeURIComponent(leadId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: activityType,
            title,
            content: activityContent.trim() || null,
            outcome: activityOutcome.trim() || undefined,
            nextFollowUpAt: activityFollowUp
              ? new Date(activityFollowUp).toISOString()
              : undefined,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to record this activity.");
      }

      setActivityTitle("");
      setActivityContent("");
      setActivityOutcome("");
      setActivityFollowUp("");
      setSuccess("Activity recorded successfully.");

      await loadLead();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to record this activity.",
      );
    } finally {
      setSavingActivity(false);
    }
  }

  if (loading) {
    return (
      <main
  className="min-h-screen px-4 py-8 text-[var(--text)] sm:px-6 lg:px-10 transition-colors duration-500"
 style={ownerPageStyle}
>
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-5 w-36 rounded-lg bg-white/10" />
          <div className={`${panelClass} h-52`} />
          <div className={`${panelClass} h-72`} />
        </div>
      </main>
    );
  }

  if (!lead) {
  return (
    <main
      className="min-h-screen px-4 py-8 text-[var(--text)] transition-colors duration-500 sm:px-6 lg:px-10"
      style={{
        background:
          "var(--lead-owner-dashboard-background, var(--dashboard-background, #05070D))",
      }}
    >
      <div className={`mx-auto max-w-3xl p-8 sm:p-10 ${panelClass}`}>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-red-300">
          !
        </div>

        <h1 className="text-xl font-semibold text-[var(--text)]">
          Unable to open lead
        </h1>

        <p className="mt-2 text-sm leading-6 text-red-300">
          {error ||
            "This lead may have been removed or you may not have access."}
        </p>

        <button
          type="button"
          onClick={() => router.push("/dashboard/leads")}
          className="mt-6 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:bg-white/10"
        >
          ← Back to leads
        </button>
      </div>
    </main>
  );
}

  return (
    <main
  className="min-h-screen px-4 py-8 text-[var(--text)] sm:px-6 lg:px-10 transition-colors duration-500"
 style={ownerPageStyle}
>
      <div className="mx-auto max-w-7xl space-y-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard/leads")}
          className="group inline-flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] transition hover:text-[#D9A441]"
        >
          <span className="transition group-hover:-translate-x-1">←</span>
          Back to leads
        </button>

        {/* Lead profile header */}
        <section className={`${panelClass} overflow-hidden rounded-3xl`}>
          <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-r from-white/[0.07] via-white/[0.025] to-transparent px-6 py-7 sm:px-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-28 h-64 w-64 rounded-full bg-[#D9A441]/10 blur-[90px]"
            />

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#D9A441]/30 bg-gradient-to-br from-[#D9A441]/20 to-white/[0.04] text-xl font-bold text-[#E8C77C] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                  {lead.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("") || "L"}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D9A441]">
                    Lead profile
                  </p>
                  <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
                    {lead.name}
                  </h1>
                  <p className={`mt-1 text-sm ${mutedClass}`}>
                    {lead.company || "Individual contact"}
                    {lead.location ? ` · ${lead.location}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClasses(lead.status)}`}
                >
                  {labelFor(lead.status)}
                </span>
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${temperatureClasses(lead.temperature)}`}
                >
                  {labelFor(lead.temperature)} interest
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 p-6 sm:grid-cols-4 sm:px-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Lead score
              </p>
              <p className="mt-2 text-2xl font-bold text-[var(--text)]">
                {lead.score}
                <span className={`ml-1 text-sm font-normal ${mutedClass}`}>
                  points
                </span>
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Lead source
              </p>
              <p className="mt-2 text-base font-semibold text-[var(--text)]">
                {labelFor(lead.source)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Date created
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                {formatDate(lead.createdAt)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Next follow-up
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                {formatDate(lead.nextFollowUpAt)}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm text-red-300 backdrop-blur-xl"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-3 text-sm text-emerald-300 backdrop-blur-xl"
          >
            {success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            {/* Contact information */}
            <section className={`${panelClass} p-6 sm:p-7`}>
              <SectionHeading
                title="Contact information"
                description="Details submitted by this lead."
              />

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <InfoItem label="Full name" value={lead.name} />
                <InfoItem label="Email address" value={lead.email} />
                <InfoItem label="Phone number" value={lead.phone} />
                <InfoItem label="Company" value={lead.company} />
                <InfoItem label="Location" value={lead.location} />
                <InfoItem label="Interested in" value={lead.interestedIn} />
                <InfoItem label="Budget" value={lead.budget} />
                <InfoItem
                  label="Decision maker"
                  value={
                    lead.decisionMaker === null
                      ? "Not specified"
                      : lead.decisionMaker
                        ? "Yes"
                        : "No"
                  }
                />
                <InfoItem label="Buying timeline" value={lead.timeline} />
                <InfoItem
                  label="Last contacted"
                  value={
                    lead.lastContactedAt
                      ? formatDate(lead.lastContactedAt)
                      : "Not contacted yet"
                  }
                />
              </div>

              {lead.message && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Original message
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text)]">
                    {lead.message}
                  </p>
                </div>
              )}
            </section>

            {/* Record activity */}
            <section className={`${panelClass} p-6 sm:p-7`}>
              <SectionHeading
                title="Record an activity"
                description="Keep a reliable record of conversations, progress, and promised next steps."
              />

              <form onSubmit={recordActivity} className="mt-6 space-y-5">
                <div>
                  <label htmlFor="activity-type" className={labelClass}>
                    Activity type
                  </label>
                  <select
                    id="activity-type"
                    value={activityType}
                    onChange={(event) =>
                      setActivityType(event.target.value as ActivityType)
                    }
                    className={fieldClass}
                  >
                    {activityOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="bg-[#10131C] text-white"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="activity-title" className={labelClass}>
                    Activity title
                  </label>
                  <input
                    id="activity-title"
                    value={activityTitle}
                    onChange={(event) => setActivityTitle(event.target.value)}
                    maxLength={160}
                    required
                    placeholder={
                      activityType === "CALL"
                        ? "e.g. Discussed the client's needs"
                        : activityType === "WHATSAPP"
                          ? "e.g. Sent product information"
                          : activityType === "EMAIL"
                            ? "e.g. Sent proposal"
                            : activityType === "MEETING"
                              ? "e.g. Initial consultation"
                              : activityType === "FOLLOW_UP"
                                ? "e.g. Follow up on quotation"
                                : "e.g. Prospect's preferences"
                    }
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="activity-content" className={labelClass}>
                    Notes and details
                  </label>
                  <textarea
                    id="activity-content"
                    value={activityContent}
                    onChange={(event) => setActivityContent(event.target.value)}
                    rows={4}
                    maxLength={5000}
                    placeholder="What happened? What did the prospect say? What should you remember?"
                    className={`${fieldClass} resize-y`}
                  />
                  <p className={`mt-1 text-xs ${mutedClass}`}>
                    {activityContent.length}/5000 characters
                  </p>
                </div>

                {["CALL", "EMAIL", "WHATSAPP", "MEETING"].includes(
                  activityType,
                ) && (
                  <div>
                    <label htmlFor="activity-outcome" className={labelClass}>
                      Outcome
                    </label>
                    <select
                      id="activity-outcome"
                      value={activityOutcome}
                      onChange={(event) =>
                        setActivityOutcome(event.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="" className="bg-[#10131C] text-white">
                        Select an outcome (optional)
                      </option>
                      {[
                        "Connected",
                        "Awaiting response",
                        "Interested",
                        "Proposal requested",
                        "Not interested",
                        "No answer",
                        "Reschedule requested",
                      ].map((outcome) => (
                        <option
                          key={outcome}
                          value={outcome}
                          className="bg-[#10131C] text-white"
                        >
                          {outcome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="activity-follow-up"
                    className={labelClass}
                  >
                    Schedule a next follow-up (optional)
                  </label>
                  <input
                    id="activity-follow-up"
                    type="datetime-local"
                    value={activityFollowUp}
                    onChange={(event) =>
                      setActivityFollowUp(event.target.value)
                    }
                    className={fieldClass}
                  />
                  <p className={`mt-2 text-xs leading-5 ${mutedClass}`}>
                    If set, this becomes the lead&apos;s next follow-up date.
                    Leave empty to keep the current schedule unchanged.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={savingActivity}
                  className={`${goldButtonClass} w-full sm:w-auto`}
                >
                  {savingActivity ? "Recording activity…" : "Record activity"}
                </button>
              </form>
            </section>

            {/* Activity history */}
            <section className={`${panelClass} p-6 sm:p-7`}>
              <SectionHeading
                title="Activity history"
                description="A chronological record of interactions and changes."
              />

              {lead.activities.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl text-[#D9A441]">
                    ◷
                  </div>
                  <p className="mt-3 font-medium text-[var(--text)]">
                    No activity recorded yet
                  </p>
                  <p className={`mt-1 text-sm ${mutedClass}`}>
                    Record your first note or contact attempt above.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  {lead.activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D9A441]/20 bg-[#D9A441]/[0.08] text-sm font-bold text-[#D9A441]">
                        {activitySymbol(activity.type)}
                      </div>

                      <div className="min-w-0 flex-1 border-b border-white/[0.08] pb-5 last:border-0 last:pb-0">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text)]">
                              {activity.title}
                            </p>
                            <p className={`mt-1 text-xs ${mutedClass}`}>
                              {labelFor(activity.type)}
                            </p>
                          </div>
                          <p className={`text-xs ${mutedClass}`}>
                            {formatDate(activity.createdAt)}
                          </p>
                        </div>

                        {activity.content && (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-muted)]">
                            {activity.content}
                          </p>
                        )}

                        {typeof activity.metadata?.outcome === "string" && (
                          <p className="mt-2 text-sm text-[var(--text-muted)]">
                            <span className="font-medium text-[var(--text)]">
                              Outcome:
                            </span>{" "}
                            {activity.metadata.outcome}
                          </p>
                        )}

                        {activity.user && (
                          <p className={`mt-2 text-xs ${mutedClass}`}>
                            Recorded by{" "}
                            {activity.user.name || activity.user.email}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Consultations */}
            <section className={`${panelClass} p-6 sm:p-7`}>
              <SectionHeading
                title="Consultations"
                description="Consultations linked to this lead."
              />

              {lead.consultations.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-white/15 px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                  No consultations linked to this lead yet.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {lead.consultations.map((consultation) => (
                    <div
                      key={consultation.id}
                      className="rounded-xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/20 hover:bg-white/[0.045]"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-semibold text-[var(--text)]">
                            {consultation.title}
                          </h3>
                          <p className={`mt-1 text-sm ${mutedClass}`}>
                            {consultation.consultationType?.title ||
                              "Consultation"}
                          </p>
                        </div>
                        <span className="w-fit rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">
                          {labelFor(consultation.status)}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--text-muted)]">
                        <span>{formatDate(consultation.scheduledAt)}</span>
                        <span>{consultation.durationMinutes} minutes</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right sidebar */}
          <aside className="min-w-0 space-y-6">
            {/* Manage lead */}
            <section className={`${panelClass} p-6`}>
              <SectionHeading
                title="Manage lead"
                description="Update the lead's progress and plan your next contact."
              />

              <form onSubmit={saveChanges} className="mt-6 space-y-5">
                <div>
                  <label htmlFor="lead-status" className={labelClass}>
                    Lead status
                  </label>
                  <select
                    id="lead-status"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as LeadStatus)
                    }
                    className={fieldClass}
                  >
                    {statusOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="bg-[#10131C] text-white"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="lead-temperature" className={labelClass}>
                    Interest temperature
                  </label>
                  <select
                    id="lead-temperature"
                    value={temperature}
                    onChange={(event) =>
                      setTemperature(event.target.value as LeadTemperature)
                    }
                    className={fieldClass}
                  >
                    {temperatureOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="bg-[#10131C] text-white"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className={`mt-2 text-xs leading-5 ${mutedClass}`}>
                    Hot means high interest. Warm means some interest. Cold
                    means limited engagement. Dormant means inactive.
                  </p>
                </div>

                <div>
                  <label htmlFor="lead-follow-up" className={labelClass}>
                    Next follow-up
                  </label>
                  <input
                    id="lead-follow-up"
                    type="datetime-local"
                    value={followUp}
                    onChange={(event) => setFollowUp(event.target.value)}
                    className={fieldClass}
                  />
                  <p className={`mt-2 text-xs ${mutedClass}`}>
                    Leave empty to remove the scheduled follow-up.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className={`${goldButtonClass} w-full`}
                >
                  {saving ? "Saving changes…" : "Save changes"}
                </button>
              </form>
            </section>

            {/* Portfolio owner */}
            <section className={`${panelClass} p-6`}>
              <SectionHeading title="Portfolio owner" />
              <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>
                This lead belongs to the portfolio that captured it.
              </p>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="font-semibold text-[var(--text)]">
                  {lead.portfolio?.name || "Portfolio"}
                </p>

                {lead.portfolio?.user?.name && (
                  <p className={`mt-1 text-sm ${mutedClass}`}>
                    {lead.portfolio.user.name}
                  </p>
                )}

                {lead.portfolio?.user?.email && (
                  <p className={`mt-1 break-words text-sm ${mutedClass}`}>
                    {lead.portfolio.user.email}
                  </p>
                )}

                {lead.portfolio?.slug && (
                  <a
                    href={`/${encodeURIComponent(lead.portfolio.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#D9A441] transition hover:text-[#F0CB78]"
                  >
                    View public portfolio
                    <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}