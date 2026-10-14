"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type AvailabilityRule = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  enabled: boolean;
};

type AvailabilityException = {
  id: string;
  date: string;
  type: "UNAVAILABLE" | "CUSTOM_HOURS";
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
};

type AvailabilityResponse = {
  success: boolean;
  availabilityRules?: AvailabilityRule[];
  availabilityExceptions?: AvailabilityException[];
  message?: string;
};

type AvailabilityManagerProps = {
  adminUserId?: string;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TIMEZONES = [
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Africa/Lagos",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

const defaultRule = {
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "17:00",
  timezone: "Africa/Nairobi",
};

const defaultException = {
  date: "",
  type: "UNAVAILABLE" as
    | "UNAVAILABLE"
    | "CUSTOM_HOURS",
  startTime: "09:00",
  endTime: "13:00",
  reason: "",
};


const inputClass =
  "w-full min-w-0 rounded-xl border border-white/[0.10] bg-[#080B12]/90 px-4 py-3 text-sm text-white shadow-inner shadow-black/10 outline-none transition-all duration-200 placeholder:text-white/30 hover:border-white/[0.18] focus:border-[#D9A441]/70 focus:bg-[#0B101A] focus:ring-4 focus:ring-[#D9A441]/[0.08]";

const labelClass =
  "mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55";

const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.045] px-4 py-2.5 text-xs font-semibold text-white/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D9A441]/30 hover:bg-[#D9A441]/[0.08] hover:text-[#E8B957] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";

const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#F0C66D]/40 bg-gradient-to-b from-[#E8B957] to-[#D9A441] px-5 py-3 text-sm font-bold text-[#11100B] shadow-[0_5px_20px_rgba(217,164,65,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_26px_rgba(217,164,65,0.20)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

const dangerButtonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-red-400/[0.16] bg-red-400/[0.045] px-3 py-2 text-xs font-semibold text-red-300/90 transition-all duration-200 hover:border-red-400/40 hover:bg-red-400/[0.10] hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40";

const panelClass =
  "liquid-glass relative overflow-hidden rounded-3xl border border-white/[0.09] bg-[#0B101A]/65 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition-colors duration-300 sm:p-6";

const nestedPanelClass =
  "relative rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.045] to-white/[0.015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:p-5";

function formatDate(date: string) {
  const normalizedDate = date.slice(0, 10);
  const parsedDate = new Date(
    `${normalizedDate}T12:00:00`,
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedDate;
  }

  return parsedDate.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isValidTimeRange(
  startTime: string,
  endTime: string,
) {
  return startTime < endTime;
}

export function AvailabilityManager({
  adminUserId = "",
}: AvailabilityManagerProps) {
  const apiUrl = useMemo(() => {
    if (!adminUserId) {
      return "/api/consultations/availability";
    }

    return `/api/consultations/availability?adminUserId=${encodeURIComponent(
      adminUserId,
    )}`;
  }, [adminUserId]);

  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<
    AvailabilityException[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [savingException, setSavingException] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [togglingId, setTogglingId] =
    useState<string | null>(null);

  const [ruleForm, setRuleForm] = useState(defaultRule);
  const [exceptionForm, setExceptionForm] =
    useState(defaultException);

  const [editingRuleId, setEditingRuleId] =
    useState<string | null>(null);

  const [editingExceptionId, setEditingExceptionId] =
    useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error"
  >("success");

  const [ruleError, setRuleError] = useState("");
  const [exceptionError, setExceptionError] =
    useState("");

  const showMessage = useCallback(
    (
      text: string,
      type: "success" | "error" = "success",
    ) => {
      setMessage(text);
      setMessageType(type);
    },
    [],
  );

  const loadAvailability = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        cache: "no-store",
      });

      const data =
        (await response.json()) as AvailabilityResponse;

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load availability.",
        );
      }

      setRules(data.availabilityRules ?? []);
      setExceptions(data.availabilityExceptions ?? []);
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect to the server.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [apiUrl, showMessage]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(apiUrl, {
          method: "GET",
          cache: "no-store",
        });

        const data =
          (await response.json()) as AvailabilityResponse;

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to load availability.",
          );
        }

        if (!cancelled) {
          setRules(data.availabilityRules ?? []);
          setExceptions(
            data.availabilityExceptions ?? [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          showMessage(
            error instanceof Error
              ? error.message
              : "Unable to connect to the server.",
            "error",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, showMessage]);

  function resetRuleForm() {
    setRuleForm({ ...defaultRule });
    setEditingRuleId(null);
    setRuleError("");
  }

  function resetExceptionForm() {
    setExceptionForm({ ...defaultException });
    setEditingExceptionId(null);
    setExceptionError("");
  }

  async function saveRule(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setRuleError("");
    setMessage("");

    if (
      !isValidTimeRange(
        ruleForm.startTime,
        ruleForm.endTime,
      )
    ) {
      setRuleError(
        "End time must be later than start time.",
      );
      return;
    }

    setSavingRule(true);

    try {
      const response = await fetch(apiUrl, {
        method: editingRuleId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          editingRuleId
            ? {
                resource: "rule",
                id: editingRuleId,
                ...ruleForm,
                ...(adminUserId
                  ? { adminUserId }
                  : {}),
              }
            : {
                action: "rule",
                ...ruleForm,
                ...(adminUserId
                  ? { adminUserId }
                  : {}),
              },
        ),
      });

      const data =
        (await response.json()) as AvailabilityResponse;

      if (!response.ok) {
        setRuleError(
          data.message ||
            "Unable to save availability rule.",
        );
        return;
      }

      const successText = editingRuleId
        ? "Working hours updated successfully."
        : "Working hours added successfully.";

      resetRuleForm();
      showMessage(successText);

      await loadAvailability();
    } catch {
      setRuleError(
        "Unable to connect to the server. Please try again.",
      );
    } finally {
      setSavingRule(false);
    }
  }

  async function saveException(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setExceptionError("");
    setMessage("");

    if (!exceptionForm.date) {
      setExceptionError(
        "Please select a date for this exception.",
      );
      return;
    }

    if (
      exceptionForm.type === "CUSTOM_HOURS" &&
      !isValidTimeRange(
        exceptionForm.startTime,
        exceptionForm.endTime,
      )
    ) {
      setExceptionError(
        "End time must be later than start time.",
      );
      return;
    }

    setSavingException(true);

    try {
      const response = await fetch(apiUrl, {
        method: editingExceptionId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          editingExceptionId
            ? {
                resource: "exception",
                id: editingExceptionId,
                ...exceptionForm,
                ...(adminUserId
                  ? { adminUserId }
                  : {}),
              }
            : {
                action: "exception",
                ...exceptionForm,
                ...(adminUserId
                  ? { adminUserId }
                  : {}),
              },
        ),
      });

      const data =
        (await response.json()) as AvailabilityResponse;

      if (!response.ok) {
        setExceptionError(
          data.message ||
            "Unable to save date exception.",
        );
        return;
      }

      const successText = editingExceptionId
        ? "Date exception updated successfully."
        : "Date exception added successfully.";

      resetExceptionForm();
      showMessage(successText);

      await loadAvailability();
    } catch {
      setExceptionError(
        "Unable to connect to the server. Please try again.",
      );
    } finally {
      setSavingException(false);
    }
  }

  function editRule(rule: AvailabilityRule) {
    setEditingRuleId(rule.id);

    setRuleForm({
      dayOfWeek: rule.dayOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
      timezone: rule.timezone,
    });

    setRuleError("");
    setMessage("");
  }

  function editException(
    exception: AvailabilityException,
  ) {
    setEditingExceptionId(exception.id);

    setExceptionForm({
      date: exception.date.slice(0, 10),
      type: exception.type,
      startTime: exception.startTime ?? "09:00",
      endTime: exception.endTime ?? "13:00",
      reason: exception.reason ?? "",
    });

    setExceptionError("");
    setMessage("");
  }

  async function deleteRule(id: string) {
    const confirmed = window.confirm(
      "Delete this working-hours period?",
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    setMessage("");

    try {
      const url = new URL(
        apiUrl,
        window.location.origin,
      );

      url.searchParams.set("resource", "rule");
      url.searchParams.set("id", id);

      const response = await fetch(url.toString(), {
        method: "DELETE",
      });

      const data =
        (await response.json()) as AvailabilityResponse;

      if (!response.ok) {
        showMessage(
          data.message ||
            "Unable to delete working hours.",
          "error",
        );
        return;
      }

      if (editingRuleId === id) {
        resetRuleForm();
      }

      showMessage(
        "Working-hours period deleted successfully.",
      );

      await loadAvailability();
    } catch {
      showMessage(
        "Unable to connect to the server.",
        "error",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteException(id: string) {
    const confirmed = window.confirm(
      "Delete this date exception?",
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    setMessage("");

    try {
      const url = new URL(
        apiUrl,
        window.location.origin,
      );

      url.searchParams.set("resource", "exception");
      url.searchParams.set("id", id);

      const response = await fetch(url.toString(), {
        method: "DELETE",
      });

      const data =
        (await response.json()) as AvailabilityResponse;

      if (!response.ok) {
        showMessage(
          data.message ||
            "Unable to delete date exception.",
          "error",
        );
        return;
      }

      if (editingExceptionId === id) {
        resetExceptionForm();
      }

      showMessage(
        "Date exception deleted successfully.",
      );

      await loadAvailability();
    } catch {
      showMessage(
        "Unable to connect to the server.",
        "error",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleRule(rule: AvailabilityRule) {
    setTogglingId(rule.id);
    setMessage("");

    try {
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resource: "rule",
          id: rule.id,
          enabled: !rule.enabled,
          ...(adminUserId
            ? { adminUserId }
            : {}),
        }),
      });

      const data =
        (await response.json()) as AvailabilityResponse;

      if (!response.ok) {
        showMessage(
          data.message ||
            "Unable to update working hours.",
          "error",
        );
        return;
      }

      showMessage(
        rule.enabled
          ? "Working-hours period disabled."
          : "Working-hours period enabled.",
      );

      await loadAvailability();
    } catch {
      showMessage(
        "Unable to connect to the server.",
        "error",
      );
    } finally {
      setTogglingId(null);
    }
  }

  const rulesByDay = useMemo(() => {
    const grouped: Record<number, AvailabilityRule[]> = {};

    for (const rule of rules) {
      if (!grouped[rule.dayOfWeek]) {
        grouped[rule.dayOfWeek] = [];
      }

      grouped[rule.dayOfWeek].push(rule);
    }

    for (const dayRules of Object.values(grouped)) {
      dayRules.sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      );
    }

    return grouped;
  }, [rules]);

  const sortedExceptions = useMemo(
    () =>
      [...exceptions].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    [exceptions],
  );

  const enabledRulesCount = rules.filter(
    (rule) => rule.enabled,
  ).length;

  const unavailableCount = exceptions.filter(
    (exception) => exception.type === "UNAVAILABLE",
  ).length;

  return (
    <section className="flex flex-col gap-6 pb-8 text-white">
      {/* Header */}
      <div className="liquid-glass relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#D9A441]/[0.08] blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#D9A441] shadow-[0_0_12px_rgba(217,164,65,0.7)]" />

              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#D9A441]">
                Consultation Management
              </p>
            </div>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Working Hours & Availability
            </h2>

            <p className="mt-3 text-sm leading-7 text-white/50">
              Control when visitors can book consultations.
              Set your weekly schedule, manage multiple time
              periods, and create exceptions for holidays,
              leave days, and special working hours.
            </p>
          </div>

          {adminUserId && (
            <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-[#D9A441]/25 bg-[#D9A441]/10 px-3.5 py-2 text-xs font-medium text-[#D9A441]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D9A441]" />
              Super Admin
            </span>
          )}
        </div>

        {/* Summary */}
        <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
            <p className="text-xs text-white/40">
              Total time periods
            </p>

            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {rules.length}
            </p>

            <p className="mt-1 text-xs text-white/35">
              Configured weekly periods
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
            <p className="text-xs text-white/40">
              Active periods
            </p>

            <p className="mt-2 text-2xl font-semibold tracking-tight text-[#D9A441]">
              {enabledRulesCount}
            </p>

            <p className="mt-1 text-xs text-white/35">
              Currently enabled
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
            <p className="text-xs text-white/40">
              Unavailable dates
            </p>

            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {unavailableCount}
            </p>

            <p className="mt-1 text-xs text-white/35">
              Full-day exceptions
            </p>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {message && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm ${
            messageType === "error"
              ? "border-red-400/20 bg-red-400/[0.06] text-red-300"
              : "border-[#D9A441]/20 bg-[#D9A441]/[0.06] text-[#D9A441]"
          }`}
        >
          <span className="mt-0.5 shrink-0">
            {messageType === "error" ? "!" : "✓"}
          </span>

          <p className="leading-6">{message}</p>

          <button
            type="button"
            onClick={() => setMessage("")}
            className="ml-auto shrink-0 text-current/60 transition hover:text-current"
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* Main layout */}
      <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Weekly schedule */}
        <section className={panelClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D9A441]/20 bg-[#D9A441]/10 text-[#D9A441]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path
                      d="M12 7v5l3 2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>

                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D9A441]">
                  Weekly Schedule
                </p>
              </div>

              <h3 className="mt-4 text-xl font-semibold tracking-tight">
                Working Hours
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-white/45">
                Set your available days and hours. You can
                configure multiple periods for the same day.
              </p>
            </div>

            <span className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
              {rules.length}{" "}
              {rules.length === 1 ? "period" : "periods"}
            </span>
          </div>

          {/* Rule form */}
          <form
            onSubmit={saveRule}
            className={`${nestedPanelClass} mt-6`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {editingRuleId
                    ? "Edit working hours"
                    : "Add working hours"}
                </p>

                <p className="mt-1 text-xs leading-5 text-white/40">
                  Configure a time period for a particular day.
                </p>
              </div>

              {editingRuleId && (
                <span className="rounded-full border border-[#D9A441]/20 bg-[#D9A441]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#D9A441]">
                  Editing
                </span>
              )}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Day</label>

                <select
                  value={ruleForm.dayOfWeek}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      dayOfWeek: Number(event.target.value),
                    }))
                  }
                  className={inputClass}
                >
                  {DAYS.map((day, index) => (
                    <option
                      key={day}
                      value={index}
                      className="bg-[#080B12]"
                    >
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Timezone
                </label>

                <select
                  value={ruleForm.timezone}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  {TIMEZONES.map((timezone) => (
                    <option
                      key={timezone}
                      value={timezone}
                      className="bg-[#080B12]"
                    >
                      {timezone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Start Time
                </label>

                <input
                  type="time"
                  value={ruleForm.startTime}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      startTime: event.target.value,
                    }))
                  }
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  End Time
                </label>

                <input
                  type="time"
                  value={ruleForm.endTime}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      endTime: event.target.value,
                    }))
                  }
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {ruleError && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.05] px-3.5 py-3 text-sm text-red-300"
              >
                {ruleError}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={savingRule}
                className={primaryButtonClass}
              >
                {savingRule ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                    Saving...
                  </>
                ) : editingRuleId ? (
                  "Save Changes"
                ) : (
                  "Add Working Hours"
                )}
              </button>

              {editingRuleId && (
                <button
                  type="button"
                  onClick={resetRuleForm}
                  disabled={savingRule}
                  className={buttonClass}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* Existing rules */}
          <div className="mt-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-white/85">
                Weekly Overview
              </h4>

              <button
                type="button"
                onClick={() => void loadAvailability()}
                disabled={loading}
                className={buttonClass}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path
                    d="M20 7v5h-5M4 17v-5h5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4"
                  >
                    <div className="h-4 w-24 rounded bg-white/10" />
                    <div className="mt-4 h-12 rounded-xl bg-white/[0.05]" />
                  </div>
                ))}
              </div>
            ) : rules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.015] px-5 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D9A441]/15 bg-[#D9A441]/[0.06] text-[#D9A441]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-6 w-6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="16"
                      rx="2"
                    />
                    <path
                      d="M16 3v4M8 3v4M3 10h18"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <p className="mt-4 text-sm font-medium text-white/75">
                  No working hours yet
                </p>

                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/40">
                  Add your first availability period above to
                  begin configuring your booking calendar.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {DAYS.map((day, dayIndex) => {
                  const dayRules =
                    rulesByDay[dayIndex] ?? [];

                  return (
                    <div
                      key={day}
                      className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                        <p className="text-sm font-semibold text-white/85">
                          {day}
                        </p>

                        <span className="text-xs text-white/35">
                          {dayRules.length === 0
                            ? "No periods"
                            : `${dayRules.length} ${
                                dayRules.length === 1
                                  ? "period"
                                  : "periods"
                              }`}
                        </span>
                      </div>

                      {dayRules.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-white/30">
                          No availability configured for this
                          day.
                        </p>
                      ) : (
                        <div className="space-y-2 p-3">
                          {dayRules.map((rule) => (
                            <div
                              key={rule.id}
                              className="rounded-xl border border-white/[0.07] bg-black/20 p-3"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${
                                        rule.enabled
                                          ? "bg-[#D9A441]"
                                          : "bg-white/25"
                                      }`}
                                    />

                                    <span
                                      className={`text-sm font-medium ${
                                        rule.enabled
                                          ? "text-white/85"
                                          : "text-white/35 line-through"
                                      }`}
                                    >
                                      {rule.startTime} –{" "}
                                      {rule.endTime}
                                    </span>
                                  </div>

                                  <p className="mt-1.5 pl-3.5 text-[11px] text-white/35">
                                    {rule.timezone}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void toggleRule(rule)
                                    }
                                    disabled={
                                      togglingId === rule.id ||
                                      deletingId === rule.id
                                    }
                                    className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                      rule.enabled
                                        ? "border-[#D9A441]/20 bg-[#D9A441]/[0.07] text-[#D9A441] hover:bg-[#D9A441]/15"
                                        : "border-white/10 bg-white/[0.04] text-white/40 hover:bg-white/10"
                                    }`}
                                  >
                                    {togglingId === rule.id
                                      ? "Updating..."
                                      : rule.enabled
                                        ? "Enabled"
                                        : "Disabled"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      editRule(rule)
                                    }
                                    disabled={
                                      deletingId === rule.id ||
                                      togglingId === rule.id
                                    }
                                    className={buttonClass}
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void deleteRule(rule.id)
                                    }
                                    disabled={
                                      deletingId === rule.id ||
                                      togglingId === rule.id
                                    }
                                    className={dangerButtonClass}
                                  >
                                    {deletingId === rule.id
                                      ? "Deleting..."
                                      : "Delete"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Date exceptions */}
        <div className="space-y-6">
          <section className={panelClass}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D9A441]/20 bg-[#D9A441]/10 text-[#D9A441]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="16"
                    rx="2"
                  />
                  <path
                    d="M16 3v4M8 3v4M3 10h18M9 14l6 4M15 14l-6 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D9A441]">
                  Date Overrides
                </p>

                <h3 className="mt-2 text-xl font-semibold tracking-tight">
                  Exceptions
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/45">
                  Manage holidays, days off, or dates when you
                  need a different consultation schedule.
                </p>
              </div>
            </div>

            {/* Exception form */}
            <form
              onSubmit={saveException}
              className={`${nestedPanelClass} mt-6`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {editingExceptionId
                      ? "Edit date exception"
                      : "Add date exception"}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-white/40">
                    Override your regular weekly schedule for
                    one specific date.
                  </p>
                </div>

                {editingExceptionId && (
                  <span className="rounded-full border border-[#D9A441]/20 bg-[#D9A441]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#D9A441]">
                    Editing
                  </span>
                )}
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className={labelClass}>
                    Date
                  </label>

                  <input
                    type="date"
                    value={exceptionForm.date}
                    onChange={(event) =>
                      setExceptionForm((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Exception Type
                  </label>

                  <select
                    value={exceptionForm.type}
                    onChange={(event) =>
                      setExceptionForm((current) => ({
                        ...current,
                        type: event.target.value as
                          | "UNAVAILABLE"
                          | "CUSTOM_HOURS",
                      }))
                    }
                    className={inputClass}
                  >
                    <option
                      value="UNAVAILABLE"
                      className="bg-[#080B12]"
                    >
                      Unavailable all day
                    </option>

                    <option
                      value="CUSTOM_HOURS"
                      className="bg-[#080B12]"
                    >
                      Custom working hours
                    </option>
                  </select>
                </div>

                {exceptionForm.type === "CUSTOM_HOURS" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>
                        Start Time
                      </label>

                      <input
                        type="time"
                        value={exceptionForm.startTime}
                        onChange={(event) =>
                          setExceptionForm((current) => ({
                            ...current,
                            startTime: event.target.value,
                          }))
                        }
                        required
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        End Time
                      </label>

                      <input
                        type="time"
                        value={exceptionForm.endTime}
                        onChange={(event) =>
                          setExceptionForm((current) => ({
                            ...current,
                            endTime: event.target.value,
                          }))
                        }
                        required
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelClass}>
                    Reason
                    <span className="ml-1 font-normal text-white/30">
                      (Optional)
                    </span>
                  </label>

                  <textarea
                    value={exceptionForm.reason}
                    onChange={(event) =>
                      setExceptionForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    rows={3}
                    maxLength={500}
                    className={`${inputClass} resize-y leading-6`}
                    placeholder="e.g. Personal commitment, public holiday..."
                  />

                  <p className="mt-1.5 text-right text-[11px] text-white/30">
                    {exceptionForm.reason.length}/500
                  </p>
                </div>
              </div>

              {exceptionError && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.05] px-3.5 py-3 text-sm text-red-300"
                >
                  {exceptionError}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={savingException}
                  className={primaryButtonClass}
                >
                  {savingException ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                      Saving...
                    </>
                  ) : editingExceptionId ? (
                    "Save Changes"
                  ) : (
                    "Add Exception"
                  )}
                </button>

                {editingExceptionId && (
                  <button
                    type="button"
                    onClick={resetExceptionForm}
                    disabled={savingException}
                    className={buttonClass}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* Existing exceptions */}
            <div className="mt-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-white/85">
                  Scheduled Exceptions
                </h4>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/50">
                  {exceptions.length}
                </span>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-24 animate-pulse rounded-2xl bg-white/[0.04]"
                    />
                  ))}
                </div>
              ) : sortedExceptions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.015] px-4 py-8 text-center">
                  <p className="text-sm font-medium text-white/70">
                    No date exceptions
                  </p>

                  <p className="mt-2 text-xs leading-5 text-white/40">
                    Your schedule has no date-specific overrides
                    configured yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedExceptions.map((exception) => (
                    <article
                      key={exception.id}
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition duration-200 hover:border-white/[0.14] hover:bg-white/[0.035]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white/90">
                            {formatDate(exception.date)}
                          </p>

                          <span
                            className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                              exception.type === "UNAVAILABLE"
                                ? "border-red-400/15 bg-red-400/[0.06] text-red-300"
                                : "border-[#D9A441]/20 bg-[#D9A441]/[0.07] text-[#D9A441]"
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />

                            {exception.type === "UNAVAILABLE"
                              ? "Unavailable"
                              : "Custom Hours"}
                          </span>
                        </div>

                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              editException(exception)
                            }
                            disabled={
                              deletingId === exception.id
                            }
                            className={buttonClass}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void deleteException(exception.id)
                            }
                            disabled={
                              deletingId === exception.id
                            }
                            className={dangerButtonClass}
                          >
                            {deletingId === exception.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </div>

                      {exception.type === "CUSTOM_HOURS" &&
                        exception.startTime &&
                        exception.endTime && (
                          <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
                            <p className="text-xs text-white/40">
                              Available hours
                            </p>

                            <p className="mt-1 text-sm font-medium text-white/80">
                              {exception.startTime} –{" "}
                              {exception.endTime}
                            </p>
                          </div>
                        )}

                      {exception.reason && (
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/45">
                          {exception.reason}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Booking information */}
          <section className="relative overflow-hidden rounded-3xl border border-[#D9A441]/15 bg-gradient-to-br from-[#D9A441]/[0.08] via-white/[0.025] to-transparent p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#D9A441]/[0.08] blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D9A441]/20 bg-[#D9A441]/10 text-[#D9A441]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 3 4.5 6v5c0 4.5 3 7.5 7.5 10 4.5-2.5 7.5-5.5 7.5-10V6L12 3Z"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m9 12 2 2 4-4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>

                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D9A441]">
                  Booking Logic
                </p>
              </div>

              <h3 className="mt-4 text-lg font-semibold tracking-tight">
                Your schedule controls availability
              </h3>

              <p className="mt-3 text-sm leading-7 text-white/50">
                Weekly working hours define when consultations
                may be offered. Date exceptions provide
                date-specific overrides. Consultation duration,
                buffer periods, minimum notice, and maximum
                advance booking are configured separately in
                your consultation types.
              </p>

              <div className="mt-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D9A441]/10 text-[10px] text-[#D9A441]">
                    1
                  </span>

                  <p className="text-xs leading-5 text-white/55">
                    <span className="font-medium text-white/80">
                      Working hours
                    </span>
                    {" "}set your normal booking windows.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D9A441]/10 text-[10px] text-[#D9A441]">
                    2
                  </span>

                  <p className="text-xs leading-5 text-white/55">
                    <span className="font-medium text-white/80">
                      Date exceptions
                    </span>
                    {" "}modify availability for particular dates.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D9A441]/10 text-[10px] text-[#D9A441]">
                    3
                  </span>

                  <p className="text-xs leading-5 text-white/55">
                    <span className="font-medium text-white/80">
                      Booking rules
                    </span>
                    {" "}must be enforced by the server when
                    calculating available time slots.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}