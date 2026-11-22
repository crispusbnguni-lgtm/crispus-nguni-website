"use client";

import { useState } from "react";
import {
  WORKSPACE_FOCUS_AREAS,
  WORKSPACE_MODES,
  type WorkspaceFocusArea,
  type WorkspaceMode,
  type WorkspacePreferences,
} from "@/lib/personal-workspace-core";

const MODE_LABELS: Record<WorkspaceMode, string> = {
  STUDENT: "Student",
  PROFESSIONAL: "Professional",
  ENTREPRENEUR: "Entrepreneur",
  PERSONAL: "Personal productivity",
  CUSTOM: "A mix of things",
};

const FOCUS_LABELS: Record<WorkspaceFocusArea, string> = {
  PAGES_AND_NOTES: "Pages and notes",
  TASKS_AND_PLANS: "Tasks and plans",
  PROJECTS: "Projects",
  STUDY_AND_TIMETABLE: "Study and timetable",
  APPOINTMENTS: "Appointments",
  GOALS_AND_HABITS: "Goals and routines",
  FOLLOW_UPS: "Follow-ups",
};

export function WorkspaceSetup({
  initialPreferences,
  initialRevision,
  configured,
}: {
  initialPreferences: WorkspacePreferences;
  initialRevision: number | null;
  configured: boolean;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [revision, setRevision] = useState(initialRevision);
  const [isConfigured, setIsConfigured] = useState(configured);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function update<K extends keyof WorkspacePreferences>(
    key: K,
    value: WorkspacePreferences[K],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  function toggleFocusArea(area: WorkspaceFocusArea) {
    const next = preferences.focusAreas.includes(area)
      ? preferences.focusAreas.filter((item) => item !== area)
      : [...preferences.focusAreas, area];
    update("focusAreas", next);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/dashboard/workspace", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences, expectedRevision: revision }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        configured?: boolean;
        revision?: number | null;
        preferences?: WorkspacePreferences;
      };

      if (!response.ok || !result.success || !result.preferences) {
        throw new Error(result.message || "Unable to save your workspace setup.");
      }

      setPreferences(result.preferences);
      setRevision(result.revision ?? null);
      setIsConfigured(Boolean(result.configured));
      setNotice("Your workspace preferences are saved to your account.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save your workspace setup.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-5">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">What best describes your workspace?</span>
          <select
            value={preferences.mode}
            onChange={(event) => update("mode", event.target.value as WorkspaceMode)}
            className="min-h-11 rounded-xl border border-white/15 bg-slate-950/70 px-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
          >
            {WORKSPACE_MODES.map((mode) => (
              <option key={mode} value={mode}>{MODE_LABELS[mode]}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm">
          <span className="font-medium">Your timezone</span>
          <input
            value={preferences.timezone}
            onChange={(event) => update("timezone", event.target.value)}
            maxLength={100}
            autoComplete="off"
            placeholder="Africa/Nairobi"
            className="min-h-11 rounded-xl border border-white/15 bg-slate-950/70 px-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
          />
          <span className="text-xs text-white/50">Use an IANA timezone such as Africa/Nairobi or Europe/London.</span>
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">What would you like to organise?</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {WORKSPACE_FOCUS_AREAS.map((area) => (
            <label key={area} className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={preferences.focusAreas.includes(area)}
                onChange={() => toggleFocusArea(area)}
                className="h-4 w-4 accent-[#D9A441]"
              />
              {FOCUS_LABELS[area]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Day starts</span>
          <input type="time" value={preferences.workingHoursStart} onChange={(event) => update("workingHoursStart", event.target.value)} className="min-h-11 rounded-xl border border-white/15 bg-slate-950/70 px-3 text-white" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Day ends</span>
          <input type="time" value={preferences.workingHoursEnd} onChange={(event) => update("workingHoursEnd", event.target.value)} className="min-h-11 rounded-xl border border-white/15 bg-slate-950/70 px-3 text-white" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Break preference (minutes)</span>
          <input type="number" min={0} max={180} step={5} value={preferences.breakMinutes} onChange={(event) => update("breakMinutes", Number(event.target.value))} className="min-h-11 rounded-xl border border-white/15 bg-slate-950/70 px-3 text-white" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Week starts</span>
          <select value={preferences.weekStartsOn} onChange={(event) => update("weekStartsOn", Number(event.target.value))} className="min-h-11 rounded-xl border border-white/15 bg-slate-950/70 px-3 text-white">
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => (
              <option key={day} value={index}>{day}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="min-h-5 text-sm text-white/60">
          {error || notice || (isConfigured ? "These preferences belong to your account." : "This setup is private to your account and can be changed later.")}
        </p>
        <button type="submit" disabled={saving} className="min-h-11 rounded-full border border-[#D9A441]/40 bg-[#D9A441]/15 px-5 text-sm font-semibold text-[#F2CF86] transition hover:bg-[#D9A441]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] disabled:cursor-wait disabled:opacity-60">
          {saving ? "Saving…" : isConfigured ? "Save preferences" : "Set up my workspace"}
        </button>
      </div>
    </form>
  );
}
