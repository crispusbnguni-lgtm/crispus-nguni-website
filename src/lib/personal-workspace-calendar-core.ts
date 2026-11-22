export const WORKSPACE_CALENDAR_VIEWS = ["month", "week", "day", "agenda"] as const;
export type WorkspaceCalendarView = (typeof WORKSPACE_CALENDAR_VIEWS)[number];
export type WorkspaceCalendarCategory = "academic" | "tasks" | "milestones" | "consultations" | "crm" | "finance" | "nutrition";

export type WorkspaceCalendarEvent = {
  sourceType: string;
  sourceId: string;
  title: string;
  description?: string | null;
  date?: string;
  occurrenceDate?: string;
  startAt?: string | null;
  endAt?: string | null;
  allDay?: boolean;
  timezone?: string | null;
  status?: string;
  location?: string | null;
  course?: { id?: string; name: string; code?: string | null };
  project?: { id: string; name: string } | null;
  projectId?: string | null;
  lead?: { id: string; name: string };
  purpose?: string | null;
  priority?: string;
  overdue?: boolean;
  readOnly?: boolean;
};

export type WorkspaceUnscheduledItem = {
  sourceType: string;
  sourceId: string;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  project?: { id: string; name: string } | null;
  lead?: { id: string; name: string };
  dueAt?: string | null;
};

export type WorkspaceCalendarFilters = Record<WorkspaceCalendarCategory, boolean>;

export const DEFAULT_WORKSPACE_CALENDAR_FILTERS: WorkspaceCalendarFilters = {
  academic: true,
  tasks: true,
  milestones: true,
  consultations: true,
  crm: true,
  finance: true,
  nutrition: true,
};

export function validCalendarDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function addCalendarDays(dateKey: string, amount: number): string {
  if (!validCalendarDateKey(dateKey) || !Number.isInteger(amount)) throw new Error("Calendar date is invalid.");
  const [year, month, day] = dateKey.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + amount));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
}

export function calendarDateParts(dateKey: string) {
  if (!validCalendarDateKey(dateKey)) throw new Error("Calendar date is invalid.");
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

export function calendarDayOfWeek(dateKey: string): number {
  const { year, month, day } = calendarDateParts(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function calendarPeriodRange(dateKey: string, view: WorkspaceCalendarView, weekStartsOn = 1) {
  if (!validCalendarDateKey(dateKey)) throw new Error("Calendar date is invalid.");
  const startDay = Number.isInteger(weekStartsOn) && weekStartsOn >= 0 && weekStartsOn <= 6 ? weekStartsOn : 1;
  if (view === "day") return { from: dateKey, to: dateKey };
  if (view === "agenda") return { from: dateKey, to: addCalendarDays(dateKey, 29) };
  if (view === "week") {
    const offset = (calendarDayOfWeek(dateKey) - startDay + 7) % 7;
    const from = addCalendarDays(dateKey, -offset);
    return { from, to: addCalendarDays(from, 6) };
  }
  const { year, month } = calendarDateParts(dateKey);
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const offset = (calendarDayOfWeek(first) - startDay + 7) % 7;
  const from = addCalendarDays(first, -offset);
  return { from, to: addCalendarDays(from, 41) };
}

export function calendarGridDates(dateKey: string, weekStartsOn = 1): string[] {
  const { from } = calendarPeriodRange(dateKey, "month", weekStartsOn);
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(from, index));
}

export function eventCalendarDate(event: WorkspaceCalendarEvent, fallbackTimezone = "Africa/Nairobi"): string | null {
  const date = event.date ?? event.occurrenceDate;
  if (date && validCalendarDateKey(date)) return date;
  if (!event.startAt) return null;
  const instant = new Date(event.startAt);
  if (!Number.isFinite(instant.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: event.timezone || fallbackTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    const key = `${value.year}-${value.month}-${value.day}`;
    return validCalendarDateKey(key) ? key : null;
  } catch {
    return null;
  }
}

export function calendarEventCategory(event: WorkspaceCalendarEvent): WorkspaceCalendarCategory {
  if (event.sourceType.startsWith("WORKSPACE_NUTRITION_")) return "nutrition";
  if (event.sourceType.startsWith("WORKSPACE_FINANCE_")) return "finance";
  if (event.sourceType === "CONSULTATION") return "consultations";
  if (event.sourceType.startsWith("CRM_")) return "crm";
  if (event.sourceType === "WORKSPACE_MILESTONE") return "milestones";
  if (event.sourceType.startsWith("WORKSPACE_TASK")) return "tasks";
  return "academic";
}

export function filterCalendarEvents(events: WorkspaceCalendarEvent[], filters: WorkspaceCalendarFilters): WorkspaceCalendarEvent[] {
  return events.filter((event) => filters[calendarEventCategory(event)]);
}

export function calendarEventLabel(event: WorkspaceCalendarEvent): string {
  const labels: Record<string, string> = {
    ASSIGNMENT: "Assignment",
    ASSIGNMENT_DEADLINE: "Assignment deadline",
    EXAM: "Examination",
    EXAM_DEADLINE: "Exam deadline",
    STUDY_SESSION: "Study session",
    STUDY_SESSION_DEADLINE: "Study deadline",
    CLASS: "Class",
    WORKSPACE_TASK: "Task",
    WORKSPACE_TASK_DEADLINE: "Task deadline",
    WORKSPACE_MILESTONE: "Project milestone",
    CONSULTATION: "Consultation",
    CRM_LEAD_FOLLOW_UP: "Lead follow-up",
    CRM_LEAD_FOLLOW_UP_OVERDUE: "Overdue lead follow-up",
    CRM_LEAD_UNSCHEDULED: "Lead needs follow-up",
    WORKSPACE_TASK_UNSCHEDULED: "Unscheduled task",
    WORKSPACE_FINANCE_REMINDER: "Finance reminder",
    WORKSPACE_NUTRITION_MEAL_PLAN: "Planned meal",
    WORKSPACE_NUTRITION_REMINDER: "Nutrition reminder",
  };
  return labels[event.sourceType] ?? "Academic event";
}

export function calendarEventHref(event: Pick<WorkspaceCalendarEvent, "sourceType" | "sourceId" | "project" | "lead">): string {
  if (event.sourceType.startsWith("WORKSPACE_NUTRITION_")) return "/dashboard/workspace/nutrition";
  if (event.sourceType.startsWith("WORKSPACE_FINANCE_")) return "/dashboard/workspace/finance";
  if (event.sourceType.startsWith("CRM_")) return `/dashboard/leads/${encodeURIComponent(event.sourceId)}`;
  if (event.sourceType === "CONSULTATION" && event.lead?.id) return `/dashboard/leads/${encodeURIComponent(event.lead.id)}`;
  if (event.sourceType === "CONSULTATION") return "/dashboard/consultations";
  if (event.sourceType === "WORKSPACE_MILESTONE") return event.project?.id ? `/dashboard/workspace/projects/${encodeURIComponent(event.project.id)}` : "/dashboard/workspace/projects";
  if (event.sourceType.startsWith("WORKSPACE_TASK")) return "/dashboard/workspace/tasks";
  if (event.sourceType === "CLASS") return "/dashboard/workspace/academics/timetable";
  if (event.sourceType.startsWith("EXAM")) return "/dashboard/workspace/academics/exams";
  if (event.sourceType.startsWith("STUDY_SESSION")) return "/dashboard/workspace/academics/study";
  return "/dashboard/workspace/academics/assignments";
}

export function formatCalendarDate(dateKey: string, _timezone?: string, options: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" }): string {
  const { year, month, day } = calendarDateParts(dateKey);
  return new Intl.DateTimeFormat("en-KE", { ...options, timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
