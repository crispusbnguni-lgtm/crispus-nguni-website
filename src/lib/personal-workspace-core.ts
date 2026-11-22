import { isValidIanaTimezone } from "@/lib/consultations/timezone-core";

export const WORKSPACE_MODES = [
  "STUDENT",
  "PROFESSIONAL",
  "ENTREPRENEUR",
  "PERSONAL",
  "CUSTOM",
] as const;

export const WORKSPACE_FOCUS_AREAS = [
  "PAGES_AND_NOTES",
  "TASKS_AND_PLANS",
  "PROJECTS",
  "STUDY_AND_TIMETABLE",
  "APPOINTMENTS",
  "GOALS_AND_HABITS",
  "FOLLOW_UPS",
] as const;

export type WorkspaceMode = (typeof WORKSPACE_MODES)[number];
export type WorkspaceFocusArea = (typeof WORKSPACE_FOCUS_AREAS)[number];

export type WorkspacePreferences = {
  mode: WorkspaceMode;
  focusAreas: WorkspaceFocusArea[];
  timezone: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  breakMinutes: number;
  weekStartsOn: number;
};

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  mode: "CUSTOM",
  focusAreas: [],
  timezone: "Africa/Nairobi",
  workingHoursStart: "09:00",
  workingHoursEnd: "17:00",
  breakMinutes: 15,
  weekStartsOn: 1,
};

export type ParsedWorkspacePreferences =
  | { success: true; preferences: WorkspacePreferences }
  | { success: false; message: string };

const PREFERENCE_KEYS = [
  "mode",
  "focusAreas",
  "timezone",
  "workingHoursStart",
  "workingHoursEnd",
  "breakMinutes",
  "weekStartsOn",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function validClockTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function parseWorkspacePreferences(
  input: unknown,
): ParsedWorkspacePreferences {
  if (!isRecord(input)) {
    return { success: false, message: "Workspace preferences must be an object." };
  }

  const keys = Object.keys(input);
  if (
    keys.length !== PREFERENCE_KEYS.length ||
    PREFERENCE_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(input, key)) ||
    keys.some((key) => !PREFERENCE_KEYS.includes(key as (typeof PREFERENCE_KEYS)[number]))
  ) {
    return { success: false, message: "Workspace preferences are incomplete or contain unsupported fields." };
  }

  const mode = input.mode;
  const focusAreas = input.focusAreas;
  const timezone = input.timezone;
  const workingHoursStart = input.workingHoursStart;
  const workingHoursEnd = input.workingHoursEnd;
  const breakMinutes = input.breakMinutes;
  const weekStartsOn = input.weekStartsOn;

  if (!WORKSPACE_MODES.some((candidate) => candidate === mode)) {
    return { success: false, message: "Choose a supported workspace mode." };
  }

  if (
    !Array.isArray(focusAreas) ||
    focusAreas.length > WORKSPACE_FOCUS_AREAS.length ||
    focusAreas.some(
      (area) =>
        typeof area !== "string" ||
        !WORKSPACE_FOCUS_AREAS.some((candidate) => candidate === area),
    ) ||
    new Set(focusAreas).size !== focusAreas.length
  ) {
    return { success: false, message: "Choose valid, non-duplicate workspace focus areas." };
  }

  if (
    typeof timezone !== "string" ||
    !isValidIanaTimezone(timezone) ||
    !validClockTime(workingHoursStart) ||
    !validClockTime(workingHoursEnd)
  ) {
    return { success: false, message: "Enter a valid timezone and working-hour range." };
  }

  if (
    typeof breakMinutes !== "number" ||
    !Number.isInteger(breakMinutes) ||
    breakMinutes < 0 ||
    breakMinutes > 180 ||
    typeof weekStartsOn !== "number" ||
    !Number.isInteger(weekStartsOn) ||
    weekStartsOn < 0 ||
    weekStartsOn > 6
  ) {
    return { success: false, message: "Break length or week start is outside the supported range." };
  }

  return {
    success: true,
    preferences: {
      mode: mode as WorkspaceMode,
      focusAreas: [...focusAreas] as WorkspaceFocusArea[],
      timezone,
      workingHoursStart,
      workingHoursEnd,
      breakMinutes,
      weekStartsOn,
    },
  };
}
