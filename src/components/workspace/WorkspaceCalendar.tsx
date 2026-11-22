"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, RefreshCw } from "lucide-react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { WorkspaceSectionNav } from "@/components/workspace/WorkspaceSectionNav";
import {
  addCalendarDays,
  calendarDateParts,
  calendarEventCategory,
  calendarEventHref,
  calendarEventLabel,
  calendarGridDates,
  calendarPeriodRange,
  eventCalendarDate,
  filterCalendarEvents,
  formatCalendarDate,
  type WorkspaceCalendarCategory,
  type WorkspaceCalendarEvent,
  type WorkspaceCalendarFilters,
  type WorkspaceCalendarView,
  type WorkspaceUnscheduledItem,
  DEFAULT_WORKSPACE_CALENDAR_FILTERS,
  WORKSPACE_CALENDAR_VIEWS,
} from "@/lib/personal-workspace-calendar-core";

type CalendarResponse = {
  events: WorkspaceCalendarEvent[];
  conflicts: Array<{ sourceType: string; sourceId: string; date: string; warning: string }>;
  timezone: string;
  weekStartsOn: number;
  truncated: boolean;
  unscheduled: WorkspaceUnscheduledItem[];
  overdue: WorkspaceUnscheduledItem[];
};

const FILTERS: Array<{ key: WorkspaceCalendarCategory; label: string }> = [
  { key: "academic", label: "Academic" },
  { key: "tasks", label: "Tasks" },
  { key: "milestones", label: "Milestones" },
  { key: "consultations", label: "Consultations" },
  { key: "crm", label: "CRM follow-ups" },
  { key: "finance", label: "Finance reminders" },
  { key: "nutrition", label: "Nutrition plans & reminders" },
];

const TONES: Record<WorkspaceCalendarCategory, string> = {
  academic: "border-sky-200/25 bg-sky-300/10 text-sky-100",
  tasks: "border-violet-200/25 bg-violet-300/10 text-violet-100",
  milestones: "border-amber-200/25 bg-amber-300/10 text-amber-100",
  consultations: "border-emerald-200/25 bg-emerald-300/10 text-emerald-100",
  crm: "border-rose-200/25 bg-rose-300/10 text-rose-100",
  finance: "border-yellow-200/25 bg-yellow-300/10 text-yellow-100",
  nutrition: "border-lime-200/25 bg-lime-300/10 text-lime-100",
};
const DOT_TONES: Record<WorkspaceCalendarCategory, string> = {
  academic: "bg-sky-300",
  tasks: "bg-violet-300",
  milestones: "bg-amber-300",
  consultations: "bg-emerald-300",
  crm: "bg-rose-300",
  finance: "bg-yellow-300",
  nutrition: "bg-lime-300",
};

function currentDateKey(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function initialDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function shiftMonth(dateKey: string, direction: number) {
  const { year, month, day } = calendarDateParts(dateKey);
  const first = new Date(Date.UTC(year, month - 1 + direction, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function shiftedDate(dateKey: string, view: WorkspaceCalendarView, direction: number) {
  if (view === "month") return shiftMonth(dateKey, direction);
  return addCalendarDays(dateKey, direction * (view === "week" ? 7 : view === "agenda" ? 30 : 1));
}

function eventKey(event: WorkspaceCalendarEvent) {
  return `${event.sourceType}:${event.sourceId}:${event.date ?? event.occurrenceDate ?? event.startAt ?? "none"}`;
}

function eventTime(event: WorkspaceCalendarEvent, timezone: string) {
  if (!event.startAt) return "All day";
  const start = new Date(event.startAt);
  const startLabel = new Intl.DateTimeFormat("en-KE", { timeZone: event.timezone || timezone, hour: "numeric", minute: "2-digit" }).format(start);
  if (!event.endAt) return startLabel;
  const endLabel = new Intl.DateTimeFormat("en-KE", { timeZone: event.timezone || timezone, hour: "numeric", minute: "2-digit" }).format(new Date(event.endAt));
  return `${startLabel} – ${endLabel}`;
}

function EventCard({ event, timezone, onSelect, selected = false }: { event: WorkspaceCalendarEvent; timezone: string; onSelect: (event: WorkspaceCalendarEvent) => void; selected?: boolean }) {
  const category = calendarEventCategory(event);
  return <button type="button" onClick={() => onSelect(event)} aria-pressed={selected} className={`block w-full rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] ${TONES[category]} ${selected ? "ring-1 ring-[#D9A441]/70" : "hover:bg-white/[.08]"}`}>
    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-75"><span aria-hidden="true">{category === "academic" ? "◆" : category === "tasks" ? "□" : category === "milestones" ? "◇" : "●"}</span>{calendarEventLabel(event)}</span>
    <span className="mt-1 block truncate text-xs font-medium">{event.title}</span>
    {event.lead && <span className="mt-1 block truncate text-[10px] opacity-65">{event.lead.name}</span>}
    {!event.allDay && event.startAt && <span className="mt-1 flex items-center gap-1 text-[10px] opacity-65"><Clock3 size={11} aria-hidden="true"/>{eventTime(event, timezone)}</span>}
  </button>;
}

function ReviewBriefing({ mode, date, from, to, events, overdue, unscheduled, conflicts, timezone }: {
  mode: "daily" | "weekly";
  date: string;
  from: string;
  to: string;
  events: WorkspaceCalendarEvent[];
  overdue: WorkspaceUnscheduledItem[];
  unscheduled: WorkspaceUnscheduledItem[];
  conflicts: CalendarResponse["conflicts"];
  timezone: string;
}) {
  const appointments = events.filter((event) => event.sourceType === "CONSULTATION" && !["CANCELLED", "RESCHEDULED"].includes(event.status ?? ""));
  const followUps = events.filter((event) => event.sourceType === "CRM_LEAD_FOLLOW_UP");
  const deadlines = events.filter((event) => event.sourceType.endsWith("_DEADLINE"));
  const completed = events.filter((event) => event.status === "COMPLETED");
  const priorities = events.filter((event) => event.sourceType.startsWith("WORKSPACE_TASK") && ["URGENT", "HIGH"].includes(event.priority ?? ""));
  const rescheduled = events.filter((event) => event.status === "RESCHEDULED");
  const weekDates = Array.from({ length: 7 }, (_, index) => addCalendarDays(from, index));
  const datesWithoutListedEvents = mode === "weekly" ? weekDates.filter((day) => !events.some((event) => eventCalendarDate(event, timezone) === day)) : [];
  const title = mode === "daily" ? `Daily diary · ${formatCalendarDate(date, timezone)}` : `Weekly review · ${formatCalendarDate(from, timezone, { month: "short", day: "numeric" })} – ${formatCalendarDate(to, timezone, { month: "short", day: "numeric", year: "numeric" })}`;
  const attention = mode === "daily" ? overdue : [...overdue, ...unscheduled];

  return <section aria-label={mode === "daily" ? "Daily diary briefing" : "Weekly review briefing"} className="grid gap-4 rounded-2xl border border-[#D9A441]/20 bg-[#D9A441]/[.035] p-4 sm:p-5">
    <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#D9A441]">On-demand review</p><h2 className="mt-1 text-lg font-semibold">{title}</h2><p className="mt-1 text-xs text-white/45">Generated from the records currently connected to this calendar. No automatic briefing is scheduled.</p></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[{ label: "Schedule", value: events.length }, { label: "Appointments", value: appointments.length }, { label: "CRM follow-ups", value: followUps.length }, { label: "Deadlines", value: deadlines.length }].map((item) => <div key={item.label} className="rounded-xl border border-white/[.08] bg-black/[.08] p-3"><p className="text-[10px] text-white/40">{item.label}</p><p className="mt-1 text-xl font-semibold">{item.value}</p></div>)}
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-white/[.08] p-3"><h3 className="text-xs font-semibold text-white/75">Priorities and status</h3><p className="mt-2 text-xs text-white/50">{priorities.length} high-priority task{priorities.length === 1 ? "" : "s"} · {completed.length} completed · {rescheduled.length} rescheduled · {conflicts.length} scheduling warning{conflicts.length === 1 ? "" : "s"}</p>{conflicts.length > 0 && <ul className="mt-2 grid gap-1 text-xs text-amber-100/75">{conflicts.slice(0, 4).map((conflict) => <li key={`${conflict.sourceType}:${conflict.sourceId}:${conflict.date}`}>{conflict.date}: {conflict.warning.replaceAll("_", " ").toLowerCase()}</li>)}</ul>}</div>
      <div className="rounded-xl border border-white/[.08] p-3"><h3 className="text-xs font-semibold text-white/75">Needs attention</h3>{attention.length ? <ul className="mt-2 grid gap-2">{attention.slice(0, 6).map((item) => <li key={`${item.sourceType}:${item.sourceId}`}><Link href={calendarEventHref(item)} className="text-xs text-[#F2CF86] underline-offset-2 hover:underline">{item.title}</Link>{item.dueAt && <span className="ml-2 text-[10px] text-white/40">{formatCalendarDate(eventCalendarDate({ ...item, startAt: item.dueAt }) ?? date, timezone)}</span>}</li>)}</ul> : <p className="mt-2 text-xs text-white/45">No overdue items in the current data.</p>}</div>
      {mode === "weekly" && <div className="rounded-xl border border-white/[.08] p-3 md:col-span-2"><h3 className="text-xs font-semibold text-white/75">Days without listed commitments</h3><p className="mt-2 text-xs text-white/50">{datesWithoutListedEvents.length ? datesWithoutListedEvents.map((day) => formatCalendarDate(day, timezone, { weekday: "short", month: "short", day: "numeric" })).join(" · ") : "Every day has at least one listed event."} These are gaps in connected records, not a full availability calculation.</p></div>}
      {unscheduled.length > 0 && <div className="rounded-xl border border-white/[.08] p-3 md:col-span-2"><h3 className="text-xs font-semibold text-white/75">Unscheduled inbox · {unscheduled.length}</h3><ul className="mt-2 grid gap-2 sm:grid-cols-2">{unscheduled.slice(0, 8).map((item) => <li key={`${item.sourceType}:${item.sourceId}`} className="flex items-center justify-between gap-3"><span className="truncate text-xs text-white/60">{item.title}</span><Link href={calendarEventHref(item)} className="shrink-0 text-[10px] text-[#F2CF86] underline-offset-2 hover:underline">Open source</Link></li>)}</ul></div>}
    </div>
  </section>;
}

export function WorkspaceCalendar() {
  const [selectedDate, setSelectedDate] = useState(initialDateKey);
  const [view, setView] = useState<WorkspaceCalendarView>("month");
  const [filters, setFilters] = useState<WorkspaceCalendarFilters>(DEFAULT_WORKSPACE_CALENDAR_FILTERS);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<WorkspaceCalendarEvent | null>(null);
  const [reviewMode, setReviewMode] = useState<"daily" | "weekly" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const timezone = data?.timezone || "Africa/Nairobi";
  const weekStartsOn = data?.weekStartsOn ?? 1;
  const range = useMemo(() => calendarPeriodRange(selectedDate, view, weekStartsOn), [selectedDate, view, weekStartsOn]);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ from: range.from, to: range.to });
      const response = await fetch(`/api/dashboard/workspace/academics/calendar?${query}`, { credentials: "same-origin", cache: "no-store", signal });
      const result = await response.json() as { success?: boolean; data?: CalendarResponse; message?: string };
      if (!response.ok || !result.success || !result.data || !Array.isArray(result.data.events)) throw new Error(result.message || "The calendar could not be loaded.");
      setData(result.data);
      setSelectedEvent((current) => current && result.data!.events.some((event) => eventKey(event) === eventKey(current)) ? current : null);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "The calendar could not be loaded.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, refresh]);

  const visibleEvents = useMemo(() => filterCalendarEvents(data?.events ?? [], filters), [data?.events, filters]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, WorkspaceCalendarEvent[]>();
    for (const event of visibleEvents) {
      const date = eventCalendarDate(event, timezone);
      if (!date) continue;
      const list = grouped.get(date) ?? [];
      list.push(event);
      grouped.set(date, list);
    }
    for (const list of grouped.values()) list.sort((a, b) => (a.startAt ?? a.date ?? "").localeCompare(b.startAt ?? b.date ?? "") || a.sourceType.localeCompare(b.sourceType) || a.sourceId.localeCompare(b.sourceId));
    return grouped;
  }, [visibleEvents, timezone]);

  const monthTitle = new Intl.DateTimeFormat("en-KE", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(calendarDateParts(selectedDate).year, calendarDateParts(selectedDate).month - 1, 1, 12)));
  const heading = view === "month" ? monthTitle : view === "agenda" ? `${formatCalendarDate(range.from)} – ${formatCalendarDate(range.to)}` : view === "week" ? `${formatCalendarDate(range.from, timezone, { month: "short", day: "numeric" })} – ${formatCalendarDate(range.to, timezone, { month: "short", day: "numeric", year: "numeric" })}` : formatCalendarDate(selectedDate, timezone);

  function selectEvent(event: WorkspaceCalendarEvent) {
    setSelectedEvent(event);
    const date = eventCalendarDate(event, timezone);
    if (date) setSelectedDate(date);
  }

  function changeFilter(key: WorkspaceCalendarCategory, checked: boolean) {
    setFilters((current) => ({ ...current, [key]: checked }));
    if (selectedEvent && !checked && calendarEventCategory(selectedEvent) === key) setSelectedEvent(null);
  }

  const dates = view === "month" ? calendarGridDates(selectedDate, weekStartsOn) : view === "week" ? Array.from({ length: 7 }, (_, index) => addCalendarDays(range.from, index)) : view === "day" ? [selectedDate] : Array.from({ length: 30 }, (_, index) => addCalendarDays(range.from, index));
  const weekdayHeaders = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat("en-KE", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + ((weekStartsOn + index) % 7), 12))));

  return <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-20 pt-7 text-white sm:px-6 lg:px-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#D9A441]">Personal Intelligence Workspace</p><h1 className="mt-2 text-3xl font-semibold">Calendar</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">One view of academic work, tasks, projects, CRM follow-ups and consultations. Source records stay in their original modules.</p></div>
      <Link href="/dashboard/workspace" className="inline-flex min-h-10 items-center gap-2 self-start rounded-full border border-white/10 px-4 text-sm text-white/65 transition hover:bg-white/[.06] sm:self-auto"><ArrowLeft size={15} aria-hidden="true"/>Workspace</Link>
    </header>
    <WorkspaceSectionNav active="calendar"/>

    <LiquidLensSurface radius={24} className="grid gap-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setReviewMode(null); setSelectedDate(currentDateKey(timezone)); }} className="min-h-10 rounded-full border border-[#D9A441]/35 bg-[#D9A441]/10 px-4 text-sm font-semibold text-[#F2CF86] transition hover:bg-[#D9A441]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]">Today</button>
          <div className="flex items-center rounded-full border border-white/10 bg-black/10 p-1">
            <button type="button" aria-label="Previous period" onClick={() => { setReviewMode(null); setSelectedDate((date) => shiftedDate(date, view, -1)); }} className="grid h-9 w-9 place-items-center rounded-full text-white/65 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"><ChevronLeft size={18}/></button>
            <button type="button" aria-label="Next period" onClick={() => { setReviewMode(null); setSelectedDate((date) => shiftedDate(date, view, 1)); }} className="grid h-9 w-9 place-items-center rounded-full text-white/65 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"><ChevronRight size={18}/></button>
          </div>
          <label className="sr-only" htmlFor="workspace-calendar-date">Choose calendar date</label>
          <input id="workspace-calendar-date" type="date" value={selectedDate} onChange={(event) => { if (event.target.value) { setReviewMode(null); setSelectedDate(event.target.value); } }} className="min-h-10 rounded-xl border border-white/10 bg-[#171613] px-3 text-sm text-white focus:border-[#D9A441]/50 focus:outline-none focus:ring-2 focus:ring-[#D9A441]/20"/>
          <h2 aria-live="polite" className="min-w-40 text-lg font-semibold">{heading}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Calendar view" className="flex flex-wrap rounded-xl border border-white/10 bg-black/10 p-1">
            {WORKSPACE_CALENDAR_VIEWS.map((item) => <button key={item} type="button" aria-pressed={view === item && reviewMode === null} onClick={() => { setReviewMode(null); setView(item); }} className={`min-h-9 rounded-lg px-3 text-xs font-medium capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] ${view === item && reviewMode === null ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>{item}</button>)}
          </div>
          <button type="button" aria-pressed={reviewMode === "daily"} onClick={() => { setSelectedDate(currentDateKey(timezone)); setView("day"); setReviewMode("daily"); }} className={`min-h-9 rounded-lg border px-3 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] ${reviewMode === "daily" ? "border-[#D9A441]/40 bg-[#D9A441]/10 text-[#F2CF86]" : "border-white/10 text-white/55 hover:bg-white/[.06]"}`}>Daily diary</button>
          <button type="button" aria-pressed={reviewMode === "weekly"} onClick={() => { setSelectedDate(currentDateKey(timezone)); setView("week"); setReviewMode("weekly"); }} className={`min-h-9 rounded-lg border px-3 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] ${reviewMode === "weekly" ? "border-[#D9A441]/40 bg-[#D9A441]/10 text-[#F2CF86]" : "border-white/10 text-white/55 hover:bg-white/[.06]"}`}>Weekly review</button>
          <button type="button" aria-label="Refresh calendar" onClick={() => setRefresh((value) => value + 1)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/60 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"><RefreshCw size={15}/></button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-white/[.08] py-3" aria-label="Filter calendar events">
        {FILTERS.map(({ key, label }) => <label key={key} className="inline-flex min-h-8 items-center gap-2 text-xs text-white/65"><input type="checkbox" checked={filters[key]} onChange={(event) => changeFilter(key, event.target.checked)} className="h-4 w-4 accent-[#D9A441]"/>{label}<span className={`h-2 w-2 rounded-full ${DOT_TONES[key]}`} aria-hidden="true"/></label>)}
        <button type="button" onClick={() => { setFilters(DEFAULT_WORKSPACE_CALENDAR_FILTERS); setSelectedEvent(null); }} className="ml-auto min-h-8 rounded-lg px-2 text-xs text-[#F2CF86] underline-offset-4 hover:underline">Reset filters</button>
        <span className="w-full text-xs text-white/40 sm:ml-auto sm:w-auto">{visibleEvents.length} event{visibleEvents.length === 1 ? "" : "s"} · {timezone}</span>
      </div>

      {error && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200/20 bg-rose-300/[.06] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-rose-100">Calendar unavailable</p><p className="mt-1 text-xs text-rose-100/65">{error}</p></div><button type="button" onClick={() => setRefresh((value) => value + 1)} className="inline-flex min-h-10 items-center gap-2 self-start rounded-full border border-rose-200/20 px-4 text-xs text-rose-100 hover:bg-rose-200/10"><RefreshCw size={13}/>Retry</button></div>}
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-white/50"><RefreshCw size={15} className="animate-spin"/>Loading your calendar…</p>}
      {data?.truncated && !loading && <p role="status" className="rounded-xl border border-amber-200/20 bg-amber-200/[.06] px-3 py-2 text-xs text-amber-100">This date range contains more records than the calendar limit. Narrow the view to see a complete selection.</p>}
      {reviewMode && data && !loading && <ReviewBriefing mode={reviewMode} date={selectedDate} from={range.from} to={range.to} events={visibleEvents.filter((event) => {
        const eventDate = eventCalendarDate(event, timezone);
        return Boolean(eventDate && (reviewMode === "daily" ? eventDate === selectedDate : eventDate >= range.from && eventDate <= range.to));
      })} overdue={data.overdue} unscheduled={data.unscheduled} conflicts={data.conflicts.filter((item) => item.date >= range.from && item.date <= range.to)} timezone={timezone}/>}

      {!error && !loading && <>
        {view === "month" && <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekdayHeaders.map((weekday, index) => <div key={`${weekday}-${index}`} className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-white/40 sm:text-xs">{weekday}</div>)}
          {dates.map((date) => {
            const dayEvents = eventsByDate.get(date) ?? [];
            const inMonth = date.slice(0, 7) === selectedDate.slice(0, 7);
            return <div key={date} className={`min-h-24 overflow-hidden rounded-xl border p-1.5 text-left align-top transition sm:min-h-32 sm:p-2 ${selectedDate === date ? "border-[#D9A441]/55 bg-[#D9A441]/[.08]" : "border-white/[.07] bg-black/[.08] hover:border-white/20"} ${inMonth ? "" : "opacity-45"}`}>
              <button type="button" onClick={() => setSelectedDate(date)} aria-pressed={selectedDate === date} aria-label={`${formatCalendarDate(date, timezone)}${dayEvents.length ? `, ${dayEvents.length} events` : ""}`} className={`grid h-7 w-7 place-items-center rounded-full text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] ${selectedDate === date ? "bg-[#D9A441]/20 text-[#F2CF86]" : "text-white/65"}`}>{calendarDateParts(date).day}</button>
              <span className="mt-1 grid gap-1">{dayEvents.slice(0, 2).map((event) => <EventCard key={eventKey(event)} event={event} timezone={timezone} onSelect={selectEvent} selected={selectedEvent ? eventKey(event) === eventKey(selectedEvent) : false}/>)}{dayEvents.length > 2 && <span className="px-1 text-[9px] text-white/45">+{dayEvents.length - 2} more</span>}</span>
            </div>;
          })}
        </div>}

        {(view === "week" || view === "day") && <div className={`grid gap-2 ${view === "week" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" : "grid-cols-1"}`}>
          {dates.map((date) => <section key={date} aria-label={formatCalendarDate(date, timezone)} className={`min-h-48 rounded-2xl border p-3 ${selectedDate === date ? "border-[#D9A441]/35 bg-[#D9A441]/[.035]" : "border-white/[.08] bg-black/[.07]"}`}>
            <button type="button" onClick={() => setSelectedDate(date)} aria-pressed={selectedDate === date} className="mb-3 flex min-h-9 w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"><span className="text-sm font-semibold">{formatCalendarDate(date, timezone, { weekday: "short", month: "short", day: "numeric" })}</span><span className="text-xs text-white/40">{(eventsByDate.get(date) ?? []).length}</span></button>
            <div className="grid gap-2">{(eventsByDate.get(date) ?? []).map((event) => <EventCard key={eventKey(event)} event={event} timezone={timezone} onSelect={selectEvent} selected={selectedEvent ? eventKey(event) === eventKey(selectedEvent) : false}/>)}</div>
          </section>)}
        </div>}

        {view === "agenda" && <div className="grid gap-2">{dates.map((date) => {
          const dayEvents = eventsByDate.get(date) ?? [];
          return <section key={date} className="grid gap-3 rounded-2xl border border-white/[.08] bg-black/[.06] p-4 sm:grid-cols-[11rem_1fr] sm:items-start"><div><h3 className="text-sm font-semibold">{formatCalendarDate(date, timezone, { weekday: "long", month: "short", day: "numeric" })}</h3><p className="mt-1 text-xs text-white/40">{dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}</p></div><div className="grid gap-2">{dayEvents.map((event) => <EventCard key={eventKey(event)} event={event} timezone={timezone} onSelect={selectEvent} selected={selectedEvent ? eventKey(event) === eventKey(selectedEvent) : false}/>)}{!dayEvents.length && <p className="py-2 text-xs text-white/35">Nothing scheduled</p>}</div></section>;
        })}</div>}

        {!visibleEvents.length && <div className="rounded-2xl border border-dashed border-white/15 px-5 py-12 text-center"><CalendarDays className="mx-auto text-white/35" size={24}/><h3 className="mt-3 font-medium">Nothing in this date range</h3><p className="mt-1 text-sm text-white/45">Try another date or turn on more event filters.</p></div>}
      </>}
    </LiquidLensSurface>

    {selectedEvent && !loading && <LiquidLensSurface radius={24} className="grid gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#D9A441]">{calendarEventLabel(selectedEvent)}</p><h2 className="mt-1 text-xl font-semibold">{selectedEvent.title}</h2></div><button type="button" onClick={() => setSelectedEvent(null)} className="min-h-9 rounded-full border border-white/10 px-3 text-xs text-white/55 hover:bg-white/[.06]">Close details</button></div>
      <div className="grid gap-2 text-sm text-white/60 sm:grid-cols-2">
        <p className="flex items-center gap-2"><CalendarDays size={15} className="text-[#F2CF86]"/>{formatCalendarDate(eventCalendarDate(selectedEvent, timezone) ?? selectedDate, timezone)}{selectedEvent.allDay ? " · All day" : selectedEvent.startAt ? ` · ${eventTime(selectedEvent, timezone)}` : ""}</p>
        {selectedEvent.location && <p className="flex items-center gap-2"><MapPin size={15} className="text-[#F2CF86]"/>{selectedEvent.location}</p>}
        {selectedEvent.course && <p>Course: {selectedEvent.course.name}{selectedEvent.course.code ? ` · ${selectedEvent.course.code}` : ""}</p>}
        {selectedEvent.project && <p>Project: {selectedEvent.project.name}</p>}
        {selectedEvent.lead && <p>Lead: {selectedEvent.lead.name}</p>}
        {selectedEvent.purpose && <p>Purpose: {selectedEvent.purpose}</p>}
        {selectedEvent.status && <p>Status: {selectedEvent.status.replaceAll("_", " ").toLowerCase()}</p>}
      </div>
      {selectedEvent.description && <p className="whitespace-pre-wrap text-sm leading-6 text-white/55">{selectedEvent.description}</p>}
      {selectedEvent.sourceType === "CONSULTATION" && <p className="rounded-xl border border-emerald-200/15 bg-emerald-200/[.04] px-3 py-2 text-xs text-emerald-100/70">Consultations are shown read-only. Manage them in their existing module.</p>}
      <Link href={calendarEventHref(selectedEvent)} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-[#D9A441]/30 bg-[#D9A441]/10 px-4 text-sm font-semibold text-[#F2CF86] transition hover:bg-[#D9A441]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]">Open source record<ArrowRight size={15}/></Link>
    </LiquidLensSurface>}
    {data?.conflicts?.length ? <p role="status" className="rounded-xl border border-amber-200/20 bg-amber-200/[.05] p-3 text-xs text-amber-100">{data.conflicts.length} timetable or scheduling warning(s) need review. See Academics to review the original schedule.</p> : null}
  </main>;
}
