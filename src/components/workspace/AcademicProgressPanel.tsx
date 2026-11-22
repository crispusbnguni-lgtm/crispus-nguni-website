"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, CalendarClock, Check, CircleHelp, X } from "lucide-react";
import Link from "next/link";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

type Course = { id: string; name: string; code: string | null; credits: number | null };
type Activity = {
  id: string; courseId: string; title: string; kind: "ASSIGNMENT" | "EXAM" | "STUDY_SESSION";
  status: string; startsAt: string | null; endsAt: string | null; dueOn: string | null; dueAt: string | null;
  updatedAt: string; assignment: { grade: string | null } | null;
  exam: { topic: string | null; score: string | number | null; maxScore: string | number | null } | null;
  studySession: { progress: number; topic?: string | null; completedAt: string | null } | null;
};
type Plan = { courseId: string; courseName: string; date: string; time: string; topic: string; reason: string; priority: number };

function dayKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function addDays(day: string, amount: number) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + amount)).toISOString().slice(0, 10);
}
function gradeNumber(value: string | null | undefined) {
  if (!value || !/^(?:100(?:\.0+)?|\d{1,2}(?:\.\d+)?)%?$/.test(value.trim())) return null;
  const score = Number(value.trim().replace(/%$/, ""));
  return Number.isFinite(score) && score <= 100 ? score : null;
}
function wallClock(value: string, timezone: string) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)); const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])); return { date: `${map.year}-${map.month}-${map.day}`, minute: Number(map.hour) * 60 + Number(map.minute) }; }
function recommendations(courses: Course[], activities: Activity[], timezone: string, hoursPerWeek: number, workingStart: string, workingEnd: string, classEvents: Array<{ startAt?: string | null; endAt?: string | null }>, now = new Date()): Plan[] {
  const today = dayKey(now, timezone);
  const activeCourses = courses;
  const suggestions = activeCourses.map((course) => {
    const courseActivities = activities.filter((item) => item.courseId === course.id && item.status !== "CANCELLED");
    const exam = courseActivities.filter((item) => item.kind === "EXAM" && item.startsAt && new Date(item.startsAt) >= now).sort((a, b) => a.startsAt!.localeCompare(b.startsAt!))[0];
    const deadline = courseActivities.filter((item) => item.kind === "ASSIGNMENT" && item.status !== "COMPLETED").map((item) => item.dueAt ?? item.dueOn).filter((date): date is string => Boolean(date && date.slice(0, 10) >= today)).sort()[0];
    const lastStudy = courseActivities.filter((item) => item.kind === "STUDY_SESSION" && item.status === "COMPLETED" && item.studySession?.completedAt).map((item) => new Date(item.studySession!.completedAt!).getTime()).sort((a, b) => b - a)[0];
    const daysSinceStudy = lastStudy ? Math.floor((now.getTime() - lastStudy) / 86_400_000) : null;
    const examDays = exam ? Math.max(0, Math.ceil((new Date(exam.startsAt!).getTime() - now.getTime()) / 86_400_000)) : null;
    const deadlineDays = deadline ? Math.max(0, Math.ceil((new Date(`${deadline.slice(0, 10)}T23:59:59`).getTime() - now.getTime()) / 86_400_000)) : null;
    const hasUpcoming = (examDays !== null && examDays <= 45) || (deadlineDays !== null && deadlineDays <= 14);
    const neglected = daysSinceStudy === null || daysSinceStudy >= 14;
    const priority = (examDays !== null && examDays <= 45 ? Math.max(10, 70 - examDays) : 0)
      + (deadlineDays !== null && deadlineDays <= 14 ? Math.max(8, 45 - deadlineDays * 2) : 0)
      + (neglected ? 15 : 0);
    if (!hasUpcoming && !neglected) return null;
    const reason = examDays !== null && examDays <= 45 ? `${exam!.title} is in ${examDays} day${examDays === 1 ? "" : "s"}`
      : deadlineDays !== null && deadlineDays <= 14 ? `${courseActivities.find((item) => (item.dueAt ?? item.dueOn)?.slice(0, 10) === deadline)?.title ?? "An assignment"} is due in ${deadlineDays} day${deadlineDays === 1 ? "" : "s"}`
      : daysSinceStudy === null ? "No completed study session is recorded yet"
      : `No completed study session is recorded in the last ${daysSinceStudy} days`;
    return { courseId: course.id, courseName: course.name, date: addDays(today, 1), time: workingStart, topic: "", reason, priority };
  }).filter((plan): plan is Plan => plan !== null).sort((a, b) => b.priority - a.priority);
  const dailyCapacity = Math.max(1, Math.ceil(hoursPerWeek / 5));
  const dailyCount = new Map<string, number>(); const occupied = classEvents.flatMap((event) => event.startAt && event.endAt ? [{ ...wallClock(event.startAt, timezone), end: wallClock(event.endAt, timezone).minute }] : []);
  return suggestions.map((plan) => {
    let selected = { date: addDays(today, 1), minute: Number(workingStart.slice(0, 2)) * 60 + Number(workingStart.slice(3, 5)) };
    for (let offset = 1; offset <= 21; offset++) {
      const date = addDays(today, offset); const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      let minute = Number(workingStart.slice(0, 2)) * 60 + Number(workingStart.slice(3, 5));
      const end = Number(workingEnd.slice(0, 2)) * 60 + Number(workingEnd.slice(3, 5));
      if (weekday === 0 || weekday === 6 || (dailyCount.get(date) ?? 0) >= dailyCapacity) continue;
      while (minute + 60 <= end) {
        const conflict = occupied.some((slot) => slot.date === date && minute < slot.end && minute + 60 > slot.minute);
        if (!conflict) break;
        minute += 60;
      }
      if (minute + 60 <= end) { selected = { date, minute }; break; }
    }
    dailyCount.set(selected.date, (dailyCount.get(selected.date) ?? 0) + 1);
    return { ...plan, date: selected.date, time: `${String(Math.floor(selected.minute / 60)).padStart(2, "0")}:${String(selected.minute % 60).padStart(2, "0")}` };
  });
}
export function AcademicProgressPanel({ courses, activities, timezone, workingHoursStart = "09:00", workingHoursEnd = "17:00", classEvents = [], onSchedule }: {
  courses: Course[];
  activities: Activity[];
  timezone: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  classEvents?: Array<{ startAt?: string | null; endAt?: string | null }>;
  onSchedule: (courseId: string, title: string, goal: string, startsAt: string, endsAt: string, timezone: string) => Promise<void>;
}) {
  const [hoursPerWeek, setHoursPerWeek] = useState(7);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const now = new Date();
  const courseGrades = useMemo(() => courses.map((course) => {
    const recorded = activities.filter((item) => item.courseId === course.id).flatMap((item) => {
      if (item.kind === "ASSIGNMENT" && item.assignment?.grade) { const score = gradeNumber(item.assignment.grade); return score === null ? [] : [{ title: item.title, score, date: item.updatedAt }]; }
      if (item.kind === "EXAM" && item.exam?.score !== null && item.exam?.score !== undefined && Number(item.exam.maxScore) > 0) return [{ title: item.title, score: Number(item.exam.score) / Number(item.exam.maxScore) * 100, date: item.updatedAt }];
      return [];
    }).sort((a, b) => a.date.localeCompare(b.date));
    const average = recorded.length ? recorded.reduce((total, item) => total + item.score!, 0) / recorded.length : null;
    const trend = recorded.length < 2 ? "Need two recorded numeric grades for a trend" : recorded.at(-1)!.score! > recorded[0].score! ? "Latest recorded grade is higher" : recorded.at(-1)!.score! < recorded[0].score! ? "Latest recorded grade is lower" : "Recorded grades are unchanged";
    return { course, count: recorded.length, average, trend };
  }), [activities, courses]);
  const scoreFor = (item: Activity) => item.kind === "ASSIGNMENT" ? gradeNumber(item.assignment?.grade) : item.kind === "EXAM" && item.exam?.score !== null && item.exam?.score !== undefined && Number(item.exam.maxScore) > 0 ? Number(item.exam.score) / Number(item.exam.maxScore) * 100 : null;
  const allGradeRows = activities.filter((item) => scoreFor(item) !== null);
  const allWeightedCredits = courses.filter((course) => course.credits && allGradeRows.some((item) => item.courseId === course.id)).reduce((sum, course) => sum + (course.credits ?? 0), 0);
  const semesterWeighted = allWeightedCredits ? courses.reduce((sum, course) => {
    const scores = allGradeRows.filter((item) => item.courseId === course.id).map((item) => scoreFor(item)!).filter(Number.isFinite);
    return sum + (course.credits ?? 0) * (scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0);
  }, 0) / allWeightedCredits : null;
  const weakTopics = new Map<string, { course: string; score: number; count: number }>();
  for (const activity of activities.filter((item) => item.kind === "EXAM" && item.exam?.topic && item.exam.score !== null && item.exam.score !== undefined && Number(item.exam.maxScore) > 0)) {
    const score = Number(activity.exam!.score) / Number(activity.exam!.maxScore) * 100;
    const key = `${activity.courseId}:${activity.exam!.topic!.toLowerCase()}`;
    const prior = weakTopics.get(key);
    weakTopics.set(key, { course: courses.find((course) => course.id === activity.courseId)?.name ?? "Course", score: ((prior?.score ?? 0) * (prior?.count ?? 0) + score) / ((prior?.count ?? 0) + 1), count: (prior?.count ?? 0) + 1 });
  }
  const completedStudy = activities.filter((item) => item.kind === "STUDY_SESSION" && item.studySession?.completedAt).map((item) => new Date(item.studySession!.completedAt!).getTime());
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const monthAgo = now.getTime() - 30 * 86_400_000;
  const studyWeek = completedStudy.filter((date) => date >= weekAgo && date <= now.getTime()).length;
  const studyMonth = completedStudy.filter((date) => date >= monthAgo && date <= now.getTime()).length;
  const makePlans = () => recommendations(courses, activities, timezone, hoursPerWeek, workingHoursStart, workingHoursEnd, classEvents, now);
  const currentPlans = (plans ?? makePlans()).filter((plan) => !dismissed.includes(plan.courseId) && !saved.includes(plan.courseId));
  function slotProblem(plan: Plan) {
    const weekday = new Date(`${plan.date}T12:00:00Z`).getUTCDay();
    const [hour, minutePart] = plan.time.split(":").map(Number); const minute = hour * 60 + minutePart;
    const startLimit = Number(workingHoursStart.slice(0, 2)) * 60 + Number(workingHoursStart.slice(3, 5));
    const endLimit = Number(workingHoursEnd.slice(0, 2)) * 60 + Number(workingHoursEnd.slice(3, 5));
    if (weekday === 0 || weekday === 6) return "Select a weekday.";
    if (minute < startLimit || minute + 60 > endLimit) return "Choose a one-hour slot within your saved work hours.";
    if (classEvents.some((event) => event.startAt && event.endAt && (() => { const start = wallClock(event.startAt!, timezone); const end = wallClock(event.endAt!, timezone); return start.date === plan.date && minute < end.minute && minute + 60 > start.minute; })())) return "This time overlaps a recorded class.";
    if (currentPlans.some((other) => other.courseId !== plan.courseId && other.date === plan.date && (() => { const [otherHour, otherMinute] = other.time.split(":").map(Number); const otherStart = otherHour * 60 + otherMinute; return minute < otherStart + 60 && minute + 60 > otherStart; })())) return "This overlaps another suggested revision session.";
    return "";
  }

  async function accept(plan: Plan) {
    setSaving(plan.courseId);
    try {
      const [hour, minute] = plan.time.split(":").map(Number); const endsMinute = hour * 60 + minute + 60;
      const startsAt = `${plan.date}T${plan.time}`;
      await onSchedule(plan.courseId, `Revision: ${plan.courseName}`, plan.topic.trim() || `Review the course material for ${plan.courseName}. Priority: ${plan.reason}.`, startsAt, `${plan.date}T${String(Math.floor(endsMinute / 60)).padStart(2, "0")}:${String(endsMinute % 60).padStart(2, "0")}`, timezone);
      setSaved((value) => [...value, plan.courseId]);
    } finally { setSaving(null); }
  }

  return <div className="grid gap-4 lg:grid-cols-2">
    <LiquidLensSurface radius={22} className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><CalendarClock size={17} className="text-[#F2CF86]"/>Revision priorities</h2><p className="mt-1 text-xs leading-5 text-white/45">Rule-based suggestions fit your saved workspace hours ({workingHoursStart}–{workingHoursEnd}), avoid recorded class blocks, and use weekdays. They do not create sessions until you accept one.</p></div><label className="grid gap-1 text-xs text-white/55">Study hours/week<input type="number" min={1} max={84} value={hoursPerWeek} onChange={(event) => { setHoursPerWeek(Math.max(1, Math.min(84, Number(event.target.value) || 1))); setPlans(null); }} className="min-h-9 w-24 rounded-lg border border-white/10 bg-[#10131c] px-2 text-white"/></label></div>
      <div className="mt-4 grid gap-3">{currentPlans.map((plan) => <article key={plan.courseId} className="rounded-xl border border-white/10 bg-white/[.025] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{plan.courseName}</p><p className="mt-1 text-xs text-[#F2CF86]">{plan.reason}</p></div><button type="button" aria-label={`Dismiss ${plan.courseName} recommendation`} onClick={() => setDismissed((value) => [...value, plan.courseId])} className="rounded-lg p-1 text-white/40 hover:bg-white/10"><X size={15}/></button></div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_145px_110px_auto]"><label className="grid gap-1 text-xs text-white/50">Topic (optional)<input value={plan.topic} maxLength={160} onChange={(event) => setPlans((current) => (current ?? makePlans()).map((item) => item.courseId === plan.courseId ? { ...item, topic: event.target.value } : item))} placeholder="Enter your topic" className="min-h-9 rounded-lg border border-white/10 bg-[#10131c] px-2 text-white"/></label><label className="grid gap-1 text-xs text-white/50">Proposed day<input type="date" min={addDays(dayKey(now, timezone), 1)} value={plan.date} onChange={(event) => setPlans((current) => (current ?? makePlans()).map((item) => item.courseId === plan.courseId ? { ...item, date: event.target.value } : item))} className="min-h-9 rounded-lg border border-white/10 bg-[#10131c] px-2 text-white"/></label><label className="grid gap-1 text-xs text-white/50">Start time<input type="time" value={plan.time} onChange={(event) => setPlans((current) => (current ?? makePlans()).map((item) => item.courseId === plan.courseId ? { ...item, time: event.target.value } : item))} className="min-h-9 rounded-lg border border-white/10 bg-[#10131c] px-2 text-white"/></label><button type="button" disabled={saving !== null || Boolean(slotProblem(plan))} onClick={() => void accept(plan)} className="self-end inline-flex min-h-9 items-center justify-center gap-1 rounded-lg bg-[#D9A441] px-3 text-xs font-semibold text-[#15120b] disabled:opacity-50">{saving === plan.courseId ? "Saving…" : <><Check size={14}/>Add session</>}</button></div>{slotProblem(plan) && <p role="status" className="mt-2 text-xs text-amber-100">{slotProblem(plan)}</p>}</article>)}{!currentPlans.length && <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/45">No revision recommendations from recorded dates. Add an upcoming assessment or course study session to generate priorities.</p>}</div>
    </LiquidLensSurface>
    <LiquidLensSurface radius={22} className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><BookOpenCheck size={17} className="text-[#F2CF86]"/>Recorded performance</h2><p className="mt-1 text-xs leading-5 text-white/45">Only numeric assignment grades from saved records are included. Missing grades are excluded, never treated as zero.</p></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">{semesterWeighted === null ? "No numeric grades" : `Credit-weighted ${semesterWeighted.toFixed(1)}`}</span></div>
      <div className="mt-4 grid gap-2">{courseGrades.map(({ course, count, average, trend }) => <div key={course.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 p-3"><div><p className="text-sm font-medium">{course.code ? `${course.code} · ` : ""}{course.name}</p><p className="mt-1 text-xs text-white/40">{count ? `${count} recorded numeric score${count === 1 ? "" : "s"} · ${trend}` : "No numeric assignment or exam scores recorded"}</p></div><span className="text-sm font-semibold text-[#F2CF86]">{average === null ? "—" : average.toFixed(1)}</span></div>)}</div>
      <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2"><p className="text-xs text-white/55">Study consistency: <strong className="text-white/80">{studyWeek}</strong> completed this week · <strong className="text-white/80">{studyMonth}</strong> in 30 days</p><div className="text-xs text-white/55">Weak topics (recorded CAT/exam topic averages below 60%): {[...weakTopics.entries()].filter(([, value]) => value.score < 60).slice(0, 4).map(([key, value]) => <span key={key} className="ml-2 inline-block rounded-full border border-amber-200/15 px-2 py-1 text-amber-100">{value.course}: {key.split(":").slice(1).join(":")} ({value.score.toFixed(0)}%)</span>)}{![...weakTopics.values()].some((value) => value.score < 60) && <span className="ml-1">No low topic scores recorded.</span>}</div></div>
      <div className="mt-4 flex flex-wrap gap-3 border-t border-white/10 pt-4"><Link href="/dashboard/workspace/intelligence" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#D9A441]/25 px-4 text-xs text-[#F2CF86] hover:bg-[#D9A441]/10">Ask shared Intelligence<ArrowRight size={14}/></Link><p className="flex items-center gap-1 text-xs text-white/35"><CircleHelp size={13}/>Grades use the same numeric scale as entered; exam marks are not stored yet.</p></div>
    </LiquidLensSurface>
  </div>;
}
