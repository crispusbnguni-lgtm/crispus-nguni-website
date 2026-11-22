
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  ChevronRight,
  GraduationCap,
  LoaderCircle,
  Plus,
  RefreshCw,
  Archive,
  Link2,
  X,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { WorkspaceSectionNav } from "@/components/workspace/WorkspaceSectionNav";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { AcademicProgressPanel } from "@/components/workspace/AcademicProgressPanel";

type Section =
  | "overview"
  | "courses"
  | "assignments"
  | "exams"
  | "timetable"
  | "study";

type Row = Record<string, unknown> & {
  id: string;
  revision: number;
};

type AcademicYear = Row & {
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  archivedAt: string | null;
};

type AcademicTerm = Row & {
  academicYearId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  archivedAt: string | null;
  sortOrder: number;
};

type AcademicCourse = Row & {
  academicYearId: string;
  name: string;
  code: string | null;
  description: string | null;
  credits: number | null;
  archivedAt: string | null;
  terms: Array<{ term: { id: string; name: string } }>;
};

type AcademicActivity = Row & {
  courseId: string;
  kind: "ASSIGNMENT" | "EXAM" | "STUDY_SESSION";
  title: string;
  description: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  dueOn: string | null;
  dueAt: string | null;
  timezone: string | null;
  course: { id: string; name: string; code: string | null };
  assignment: {
    submissionStatus: string;
    submittedAt: string | null;
    grade: string | null;
    feedback: string | null;
  } | null;
  exam: {
    examKind: string;
    venue: string | null;
    topic?: string | null;
    score?: string | number | null;
    maxScore?: string | number | null;
  } | null;
  studySession: {
    goal: string | null;
    topic?: string | null;
    progress: number;
    completedAt: string | null;
  } | null;
  taskLinks: Array<{ taskId: string }>;
  projectLinks: Array<{ projectId: string }>;
};

type ClassRule = Row & {
  courseId: string;
  title: string;
  weekdays: number[];
  startsOn: string;
  endsOn: string;
  localStart: string;
  localEnd: string;
  timezone: string;
  location: string | null;
  exceptions: Array<{
    occurrenceOn: string;
    kind: string;
  }>;
  course: { name: string };
};

type CalendarEvent = {
  sourceType: string;
  sourceId: string;
  occurrenceDate?: string;
  date?: string;
  title: string;
  startAt?: string | null;
  endAt?: string | null;
  allDay?: boolean;
  timezone?: string;
  location?: string | null;
  status?: string;
  course?: { name: string };
};

type JsonResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string;
  conflicts?: Array<{
    sourceType: string;
    sourceId: string;
    date: string;
    warning: string;
  }>;
};

const sections: Record<
  Section,
  {
    title: string;
    description: string;
    active: "overview" | "academics";
  }
> = {
  overview: {
    title: "Academic overview",
    description: "Your courses, upcoming deadlines, classes and study plans.",
    active: "academics",
  },
  courses: {
    title: "Courses and subjects",
    description: "Organise courses by academic year and term.",
    active: "academics",
  },
  assignments: {
    title: "Assignments and coursework",
    description:
      "Track submission progress and preserve date-only deadlines.",
    active: "academics",
  },
  exams: {
    title: "Examinations",
    description: "Keep exam times, venues and preparation links together.",
    active: "academics",
  },
  timetable: {
    title: "Class timetable",
    description:
      "Create bounded weekly schedules and manage individual date changes.",
    active: "academics",
  },
  study: {
    title: "Study planning",
    description: "Plan focused sessions and track revision progress.",
    active: "academics",
  },
};

const academicLinks = [
  {
    key: "overview",
    label: "Overview",
    href: "/dashboard/workspace/academics",
  },
  {
    key: "courses",
    label: "Courses",
    href: "/dashboard/workspace/academics/courses",
  },
  {
    key: "assignments",
    label: "Assignments",
    href: "/dashboard/workspace/academics/assignments",
  },
  {
    key: "exams",
    label: "Examinations",
    href: "/dashboard/workspace/academics/exams",
  },
  {
    key: "timetable",
    label: "Timetable",
    href: "/dashboard/workspace/academics/timetable",
  },
  {
    key: "study",
    label: "Study Planner",
    href: "/dashboard/workspace/academics/study",
  },
] as const;

async function readJson<T>(response: Response): Promise<T> {
  const json = (await response.json()) as JsonResponse<T>;

  if (!response.ok || !json.success || json.data === undefined) {
    throw new Error(
      json.message || "Unable to load academic workspace data.",
    );
  }

  return json.data;
}

function localDay(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((item) => item.type !== "literal")
      .map((item) => [item.type, item.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function localDateTimeInput(
  value?: string | null,
  timezone = "Africa/Nairobi",
) {
  if (!value) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  const fields = Object.fromEntries(
    parts
      .filter((item) => item.type !== "literal")
      .map((item) => [item.type, item.value]),
  );

  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}

function dayOffset(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day + days),
  )
    .toISOString()
    .slice(0, 10);
}

function field(form: HTMLFormElement, name: string) {
  return new FormData(form).get(name);
}

function textValue(form: HTMLFormElement, name: string) {
  return String(field(form, name) ?? "").trim();
}

function dateValue(form: HTMLFormElement, name: string) {
  return textValue(form, name) || null;
}

function multiple(form: HTMLFormElement, name: string) {
  return new FormData(form).getAll(name).map(String);
}

function formatWhen(
  value?: string | null,
  timezone = "Africa/Nairobi",
) {
  if (!value) return "Date not set";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-KE", {
        dateStyle: "medium",
        timeStyle: value.includes("T") ? "short" : undefined,
        timeZone: timezone,
      }).format(date);
}

function dateText(value?: string | null) {
  return value
    ? new Date(value).toISOString().slice(0, 10)
    : "No date";
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <LiquidLensSurface
      radius={22}
      className={`p-4 sm:p-6 ${className}`}
    >
      {children}
    </LiquidLensSurface>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  maxLength?: number;
}) {
  return (
    <label className="grid gap-1.5 text-sm text-white/70">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue ?? ""}
        className="min-h-11 rounded-xl border border-white/10 bg-[#10131c] px-3 text-white outline-none transition focus:border-[#D9A441]/60 focus:ring-2 focus:ring-[#D9A441]/20"
      />
    </label>
  );
}

export function AcademicPlanner({
  section,
}: {
  section: Section;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [profile, setProfile] = useState<Record<string, unknown> | null>(
    null,
  );
  const [timezone, setTimezone] = useState("Africa/Nairobi");

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [courses, setCourses] = useState<AcademicCourse[]>([]);

  const [assignments, setAssignments] = useState<AcademicActivity[]>([]);
  const [exams, setExams] = useState<AcademicActivity[]>([]);
  const [study, setStudy] = useState<AcademicActivity[]>([]);
  const [rules, setRules] = useState<ClassRule[]>([]);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [conflicts, setConflicts] = useState<
    Array<{
      sourceType: string;
      sourceId: string;
      date: string;
      warning: string;
    }>
  >([]);

  const [tasks, setTasks] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [projects, setProjects] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [workingHours, setWorkingHours] = useState({ start: "09:00", end: "17:00" });

  const [calendarSpan, setCalendarSpan] = useState<7 | 30>(30);

  const [yearFilter, setYearFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const get = async <T,>(path: string) =>
        readJson<T>(
          await fetch(
            `/api/dashboard/workspace/academics/${path}`,
            {
              cache: "no-store",
              credentials: "same-origin",
            },
          ),
        );

      const overview = await get<{
        timezone: string;
        profile: Record<string, unknown> | null;
      }>("overview");

      const zone = overview.timezone || "Africa/Nairobi";

      setTimezone(zone);
      setProfile(overview.profile);

      const preferenceResponse = await fetch("/api/dashboard/workspace", { cache: "no-store", credentials: "same-origin" });
      if (preferenceResponse.ok) {
        const preferenceData = await preferenceResponse.json() as { success?: boolean; preferences?: { workingHoursStart?: string; workingHoursEnd?: string } };
        if (preferenceData.success && preferenceData.preferences) setWorkingHours({ start: preferenceData.preferences.workingHoursStart ?? "09:00", end: preferenceData.preferences.workingHoursEnd ?? "17:00" });
      }

      const today = localDay(zone);

      const [
        yearRows,
        termRows,
        courseRows,
        assignmentRows,
        examRows,
        studyRows,
        ruleRows,
        calendar,
        taskData,
        projectData,
      ] = await Promise.all([
        get<AcademicYear[]>("years"),
        get<AcademicTerm[]>("terms"),
        get<AcademicCourse[]>("courses"),
        get<AcademicActivity[]>("assignments"),
        get<AcademicActivity[]>("exams"),
        get<AcademicActivity[]>("study"),
        get<ClassRule[]>("timetable"),
        get<{
          events: CalendarEvent[];
          conflicts: typeof conflicts;
        }>(
          `calendar?from=${today}&to=${dayOffset(
            today,
            calendarSpan - 1,
          )}`,
        ),
        readJson<Array<{ id: string; title: string }>>(
          await fetch(
            "/api/dashboard/workspace/tasks?limit=200",
            {
              cache: "no-store",
              credentials: "same-origin",
            },
          ),
        ),
        readJson<Array<{ id: string; name: string }>>(
          await fetch(
            "/api/dashboard/workspace/projects",
            {
              cache: "no-store",
              credentials: "same-origin",
            },
          ),
        ),
      ]);

      setYears(yearRows);
      setTerms(termRows);
      setCourses(courseRows);
      setAssignments(assignmentRows);
      setExams(examRows);
      setStudy(studyRows);
      setRules(ruleRows);
      setEvents(calendar.events);
      setConflicts(calendar.conflicts);
      setTasks(taskData);
      setProjects(projectData);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load academic workspace data.",
      );
    } finally {
      setLoading(false);
    }
  }, [calendarSpan]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(handle);
  }, [load]);

  const activeYear =
    years.find((year) => year.isCurrent && !year.archivedAt) ?? null;

  const filteredCourses = useMemo(
    () =>
      courses.filter(
        (course) =>
          (!yearFilter ||
            course.academicYearId === yearFilter) &&
          (!termFilter ||
            course.terms.some(
              (item) => item.term.id === termFilter,
            )),
      ),
    [courses, yearFilter, termFilter],
  );

  const activeActivities =
    section === "assignments"
      ? assignments
      : section === "exams"
        ? exams
        : study;

  const filteredActivities = activeActivities.filter(
    (activity) =>
      !courseFilter || activity.courseId === courseFilter,
  );

  async function mutate(
    path: string,
    method: string,
    data: unknown,
    success: string,
  ) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/dashboard/workspace/academics/${path}`,
        {
          method,
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
          },
          body:
            data === undefined
              ? undefined
              : JSON.stringify(data),
        },
      );

      const json =
        (await response.json()) as JsonResponse<unknown>;

      if (!response.ok || !json.success) {
        throw new Error(
          json.message || "Academic change failed.",
        );
      }

      setNotice(success);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Academic change failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  function submit(
    event: FormEvent<HTMLFormElement>,
    transform: (
      form: HTMLFormElement,
    ) => {
      path: string;
      method: string;
      data: unknown;
      message: string;
    },
  ) {
    event.preventDefault();

    const config = transform(event.currentTarget);

    void mutate(
      config.path,
      config.method,
      config.data,
      config.message,
    );
  }

  async function archive(resource: string, row: Row) {
    if (
      !window.confirm(
        "Archive this academic record and preserve its history?",
      )
    ) {
      return;
    }

    await mutate(
      `${resource}/${row.id}`,
      "DELETE",
      { expectedRevision: row.revision },
      "Academic record archived.",
    );
  }

  async function link(
    activity: AcademicActivity,
    type: "task" | "project",
    targetId: string,
    linked: boolean,
  ) {
    await mutate(
      `activities/${activity.id}/links`,
      linked ? "POST" : "DELETE",
      { type, targetId },
      linked
        ? "Workspace item linked."
        : "Workspace link removed.",
    );
  }

  async function exception(
    ruleId: string,
    occurrenceOn: string,
    kind: "CANCELLED" | "RESCHEDULED",
    startsAt?: string,
    endsAt?: string,
    exceptionTimezone = timezone,
  ) {
    await mutate(
      `timetable/${ruleId}/exceptions`,
      "POST",
      kind === "CANCELLED"
        ? { occurrenceOn, kind }
        : {
            occurrenceOn,
            kind,
            startsAt,
            endsAt,
            timezone: exceptionTimezone,
            location: null,
          },
      kind === "CANCELLED"
        ? "Class occurrence cancelled."
        : "Class occurrence rescheduled.",
    );
  }

  const activityKinds =
    section === "assignments"
      ? "ASSIGNMENT"
      : section === "exams"
        ? "EXAM"
        : "STUDY_SESSION";

  const activityEndpoint = section;

  const weekdays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-20 pt-7 text-white sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-[#D9A441]">
            <GraduationCap size={15} />
            Personal Intelligence Workspace
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {sections[section].title}
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-white/55">
            {sections[section].description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white/55">
            {timezone}
          </span>

          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh academic data"
            disabled={loading}
            className="grid size-10 place-items-center rounded-full border border-white/10 text-white/65 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>
      </header>

      <WorkspaceSectionNav active={sections[section].active} />

      {/* Academics navigation */}
      <LiquidLensSurface
        radius={22}
        intensity="subtle"
        className="w-full p-2"
      >
        <nav
          aria-label="Academic sections"
          className="flex w-full items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {academicLinks.map((item) => {
            const isActive = section === item.key;

            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`group relative inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border px-3.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] ${
                  isActive
                    ? "border-[#D9A441]/35 bg-[#D9A441]/10 text-[#F2CF86] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_18px_rgba(217,164,65,0.06)]"
                    : "border-transparent text-white/55 hover:border-white/10 hover:bg-white/[.06] hover:text-white"
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-[#D9A441]/70 to-transparent"
                  />
                )}

                {item.label}
              </Link>
            );
          })}
        </nav>
      </LiquidLensSurface>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100"
        >
          {error}

          <button
            type="button"
            onClick={() => void load()}
            className="ml-4 underline underline-offset-4"
          >
            Retry
          </button>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100"
        >
          {notice}
        </p>
      )}

      {loading ? (
        <Panel>
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-white/55"
          >
            <LoaderCircle
              className="animate-spin"
              size={16}
            />
            Loading your academic records…
          </p>
        </Panel>
      ) : (
        <>
          {section === "overview" && (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Stat
                  label="Current academic year"
                  value={activeYear?.name ?? "Not set"}
                />

                <Stat
                  label="Current term"
                  value={
                    terms.find(
                      (term) =>
                        term.isCurrent && !term.archivedAt,
                    )?.name ?? "Not set"
                  }
                />

                <Stat
                  label="Registered courses"
                  value={String(
                    courses.filter(
                      (course) => !course.archivedAt,
                    ).length,
                  )}
                />

                <Stat
                  label="Credit units"
                  value={String(
                    courses
                      .filter((course) => !course.archivedAt)
                      .reduce(
                        (total, course) =>
                          total + (course.credits ?? 0),
                        0,
                      ),
                  )}
                />

                <Stat
                  label="Today's classes"
                  value={String(
                    events.filter(
                      (event) =>
                        event.sourceType === "CLASS" &&
                        (event.occurrenceDate ?? event.date) ===
                          localDay(timezone),
                    ).length,
                  )}
                />

                <Stat
                  label="Planned study sessions"
                  value={String(
                    study.filter(
                      (item) =>
                        item.status !== "COMPLETED" &&
                        item.status !== "CANCELLED",
                    ).length,
                  )}
                />
              </section>

              <Panel className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">
                    Academic intelligence
                  </h2>

                  <p className="mt-1 text-sm text-white/50">
                    Ask about recorded deadlines, exams and study
                    activities using the context you select.
                  </p>
                </div>

                <Link
                  href="/dashboard/workspace/intelligence"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D9A441]/30 bg-[#D9A441]/10 px-4 text-sm font-medium text-[#F2CF86] transition hover:bg-[#D9A441]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
                >
                  <Sparkles size={15} />
                  Open Personal Intelligence
                  <ChevronRight size={15} />
                </Link>
                <Link href="/dashboard/workspace/academics/tutor" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-white/75 hover:bg-white/[.06]"><Sparkles size={15}/>Academic AI Tutor<ChevronRight size={15}/></Link>
                <Link href="/dashboard/workspace/academics/knowledge" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-white/75 hover:bg-white/[.06]"><BookOpen size={15}/>Knowledge Centre<ChevronRight size={15}/></Link>
              </Panel>

              <AcademicProgressPanel
                courses={courses
                  .filter((course) => !course.archivedAt)
                  .map((course) => ({
                    id: course.id,
                    name: course.name,
                    code: course.code,
                    credits: course.credits,
                  }))}
                activities={[...assignments, ...exams, ...study].map(
                  (activity) => ({
                    id: activity.id,
                    courseId: activity.courseId,
                    title: activity.title,
                    kind: activity.kind,
                    status: activity.status,
                    startsAt: activity.startsAt,
                    endsAt: activity.endsAt,
                    dueOn: activity.dueOn,
                    dueAt: activity.dueAt,
                    updatedAt: String(activity.updatedAt ?? ""),
                    assignment: activity.assignment,
                    exam: activity.exam ? { topic: activity.exam.topic ?? null, score: activity.exam.score ?? null, maxScore: activity.exam.maxScore ?? null } : null,
                    studySession: activity.studySession,
                  }),
                )}
                timezone={timezone}
                workingHoursStart={workingHours.start}
                workingHoursEnd={workingHours.end}
                classEvents={events.filter((event) => event.sourceType === "CLASS")}
                onSchedule={(
                  courseId,
                  title,
                  goal,
                  startsAt,
                  endsAt,
                  sessionTimezone,
                ) =>
                  mutate(
                    "study",
                    "POST",
                    {
                      courseId,
                      title,
                      goal,
                      startsAt,
                      endsAt,
                      timezone: sessionTimezone,
                      progress: 0,
                    },
                    "Accepted revision session added to Study Planner.",
                  )
                }
              />

              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Academic profile
                    </h2>

                    <p className="mt-1 text-sm text-white/50">
                      Private to your workspace. Nothing is published
                      to your portfolio.
                    </p>
                  </div>
                </div>

                <form
                  className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                  onSubmit={(event) =>
                    submit(event, (form) => ({
                      path: "profile",
                      method: "POST",
                      data: {
                        institution: dateValue(
                          form,
                          "institution",
                        ),
                        program: dateValue(form, "program"),
                        department: dateValue(
                          form,
                          "department",
                        ),
                        expectedRevision: Number(
                          profile?.revision ?? 0,
                        ),
                      },
                      message: "Academic profile saved.",
                    }))
                  }
                >
                  <Field
                    label="Institution"
                    name="institution"
                    maxLength={240}
                    defaultValue={
                      profile?.institution as string | null
                    }
                  />

                  <Field
                    label="Program or degree"
                    name="program"
                    maxLength={240}
                    defaultValue={
                      profile?.program as string | null
                    }
                  />

                  <Field
                    label="Department"
                    name="department"
                    maxLength={240}
                    defaultValue={
                      profile?.department as string | null
                    }
                  />

                  <button
                    disabled={saving}
                    className="self-end rounded-xl bg-[#D9A441] px-4 py-3 text-sm font-semibold text-[#15120b] transition hover:bg-[#e6b653] disabled:opacity-50"
                  >
                    Save profile
                  </button>
                </form>
              </Panel>

              <section className="grid gap-4 lg:grid-cols-2">
                <Panel>
                  <h2 className="font-semibold">
                    Upcoming academic work
                  </h2>

                  <div className="mt-3 grid gap-2">
                    {[...assignments, ...exams]
                      .filter(
                        (item) =>
                          item.status !== "COMPLETED" &&
                          item.status !== "CANCELLED",
                      )
                      .sort((a, b) =>
                        String(
                          a.dueOn ?? a.dueAt ?? a.startsAt,
                        ).localeCompare(
                          String(
                            b.dueOn ?? b.dueAt ?? b.startsAt,
                          ),
                        ),
                      )
                      .slice(0, 6)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {item.title}
                            </p>

                            <p className="text-xs text-white/45">
                              {item.course.name} ·{" "}
                              {item.kind === "ASSIGNMENT"
                                ? dateText(item.dueOn)
                                : formatWhen(
                                    item.startsAt,
                                    item.timezone ?? timezone,
                                  )}
                            </p>
                          </div>

                          <span className="text-xs text-white/45">
                            {item.status.replaceAll("_", " ")}
                          </span>
                        </div>
                      ))}

                    {!assignments.length && !exams.length && (
                      <Empty>
                        No assignments or examinations are recorded
                        yet.
                      </Empty>
                    )}
                  </div>
                </Panel>

                <Panel>
                  <h2 className="font-semibold">
                    Classes and calendar
                  </h2>

                  <div className="mt-3 grid gap-2">
                    {events.slice(0, 8).map((event, index) => (
                      <div
                        key={`${event.sourceType}-${event.sourceId}-${event.occurrenceDate ?? event.date ?? index}`}
                        className="rounded-xl border border-white/10 p-3"
                      >
                        <p className="text-sm font-medium">
                          {event.title}
                        </p>

                        <p className="text-xs text-white/45">
                          {event.allDay
                            ? event.date
                            : formatWhen(
                                event.startAt,
                                event.timezone ?? timezone,
                              )}{" "}
                          · {event.sourceType.replaceAll("_", " ")}
                        </p>
                      </div>
                    ))}

                    {!events.length && (
                      <Empty>
                        No events in the next 30 days.
                      </Empty>
                    )}
                  </div>

                  {conflicts.length > 0 && (
                    <p
                      role="status"
                      className="mt-3 rounded-lg bg-amber-300/10 p-3 text-xs text-amber-100"
                    >
                      {conflicts.length} timetable or scheduling
                      warning(s) need review.
                    </p>
                  )}
                </Panel>
              </section>

              <Panel>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">
                    Academic years
                  </h2>

                  <Link
                    href="/dashboard/workspace/academics/courses"
                    className="text-sm text-[#F2CF86] transition hover:text-white"
                  >
                    Manage courses{" "}
                    <ChevronRight
                      size={14}
                      className="inline"
                    />
                  </Link>
                </div>

                <YearEditor
                  years={years}
                  onSubmit={(event, row) =>
                    submit(event, (form) => ({
                      path: row
                        ? `years/${row.id}`
                        : "years",
                      method: row ? "PATCH" : "POST",
                      data: {
                        name: textValue(form, "name"),
                        startsOn: dateValue(form, "startsOn"),
                        endsOn: dateValue(form, "endsOn"),
                        isCurrent:
                          field(form, "isCurrent") === "on",
                        ...(row
                          ? {
                              expectedRevision: row.revision,
                            }
                          : {}),
                      },
                      message: row
                        ? "Academic year updated."
                        : "Academic year created.",
                    }))
                  }
                  onArchive={(row) =>
                    void archive("years", row)
                  }
                  saving={saving}
                />
              </Panel>
            </>
          )}

          {section === "courses" && (
            <>
              <Panel>
                <h2 className="font-semibold">
                  Filter courses
                </h2>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Academic year"
                    value={yearFilter}
                    onChange={setYearFilter}
                  >
                    <option value="">All active years</option>

                    {years
                      .filter((item) => !item.archivedAt)
                      .map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                        </option>
                      ))}
                  </Select>

                  <Select
                    label="Term"
                    value={termFilter}
                    onChange={setTermFilter}
                  >
                    <option value="">All terms</option>

                    {terms
                      .filter(
                        (item) =>
                          !item.archivedAt &&
                          (!yearFilter ||
                            item.academicYearId === yearFilter),
                      )
                      .map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                        </option>
                      ))}
                  </Select>
                </div>
              </Panel>

              <Panel>
                <h2 className="font-semibold">
                  Add a course or subject
                </h2>

                <form
                  className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                  onSubmit={(event) =>
                    submit(event, (form) => ({
                      path: "courses",
                      method: "POST",
                      data: {
                        academicYearId: textValue(
                          form,
                          "academicYearId",
                        ),
                        name: textValue(form, "name"),
                        code: dateValue(form, "code"),
                        description: dateValue(
                          form,
                          "description",
                        ),
                        credits: textValue(form, "credits")
                          ? Number(textValue(form, "credits"))
                          : null,
                        termIds: multiple(form, "termIds"),
                      },
                      message: "Course created.",
                    }))
                  }
                >
                  <Select
                    label="Academic year"
                    name="academicYearId"
                    required
                  >
                    <option value="">Choose a year</option>

                    {years
                      .filter((item) => !item.archivedAt)
                      .map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                        </option>
                      ))}
                  </Select>

                  <Field
                    label="Course name"
                    name="name"
                    required
                    maxLength={160}
                  />

                  <Field
                    label="Code"
                    name="code"
                    maxLength={40}
                  />

                  <Field
                    label="Credits"
                    name="credits"
                    type="number"
                  />

                  <label className="grid gap-1.5 text-sm text-white/70 sm:col-span-2">
                    Terms

                    <select
                      name="termIds"
                      multiple
                      className="min-h-24 rounded-xl border border-white/10 bg-[#10131c] p-3 text-white"
                    >
                      {terms
                        .filter((term) => !term.archivedAt)
                        .map((term) => (
                          <option
                            key={term.id}
                            value={term.id}
                          >
                            {term.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="grid gap-1.5 text-sm text-white/70 sm:col-span-2">
                    Description

                    <textarea
                      name="description"
                      maxLength={4000}
                      rows={2}
                      className="rounded-xl border border-white/10 bg-[#10131c] p-3 text-white"
                    />
                  </label>

                  <button
                    disabled={
                      saving ||
                      years.filter(
                        (item) => !item.archivedAt,
                      ).length === 0
                    }
                    className="min-h-11 rounded-xl bg-[#D9A441] px-4 text-sm font-semibold text-[#15120b] transition hover:bg-[#e6b653] disabled:opacity-50"
                  >
                    <Plus
                      className="mr-1 inline"
                      size={15}
                    />
                    Create course
                  </button>
                </form>
              </Panel>

              <section className="grid gap-3 lg:grid-cols-2">
                {filteredCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    years={years}
                    terms={terms}
                    saving={saving}
                    onSave={(event) =>
                      submit(event, (form) => ({
                        path: `courses/${course.id}`,
                        method: "PATCH",
                        data: {
                          name: textValue(form, "name"),
                          code: dateValue(form, "code"),
                          description: dateValue(
                            form,
                            "description",
                          ),
                          academicYearId: textValue(
                            form,
                            "academicYearId",
                          ),
                          credits: textValue(form, "credits")
                            ? Number(
                                textValue(form, "credits"),
                              )
                            : null,
                          termIds: multiple(form, "termIds"),
                          expectedRevision: course.revision,
                        },
                        message: "Course updated.",
                      }))
                    }
                    onArchive={() =>
                      void archive("courses", course)
                    }
                  />
                ))}
              </section>

              {!filteredCourses.length && (
                <Panel>
                  <Empty>
                    No courses match these filters. Add a course
                    after creating an academic year.
                  </Empty>
                </Panel>
              )}

              <Panel>
                <h2 className="font-semibold">
                  Academic years and terms
                </h2>

                <YearEditor
                  years={years}
                  onSubmit={(event, row) =>
                    submit(event, (form) => ({
                      path: row
                        ? `years/${row.id}`
                        : "years",
                      method: row ? "PATCH" : "POST",
                      data: {
                        name: textValue(form, "name"),
                        startsOn: dateValue(form, "startsOn"),
                        endsOn: dateValue(form, "endsOn"),
                        isCurrent:
                          field(form, "isCurrent") === "on",
                        ...(row
                          ? {
                              expectedRevision: row.revision,
                            }
                          : {}),
                      },
                      message: row
                        ? "Academic year updated."
                        : "Academic year created.",
                    }))
                  }
                  onArchive={(row) =>
                    void archive("years", row)
                  }
                  saving={saving}
                />

                <form
                  className="mt-5 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-4"
                  onSubmit={(event) =>
                    submit(event, (form) => ({
                      path: "terms",
                      method: "POST",
                      data: {
                        academicYearId: textValue(
                          form,
                          "academicYearId",
                        ),
                        name: textValue(form, "name"),
                        startsOn: dateValue(form, "startsOn"),
                        endsOn: dateValue(form, "endsOn"),
                        sortOrder: Number(
                          textValue(form, "sortOrder") || 0,
                        ),
                        isCurrent:
                          field(form, "isCurrent") === "on",
                      },
                      message: "Term created.",
                    }))
                  }
                >
                  <Select
                    label="Academic year"
                    name="academicYearId"
                    required
                  >
                    <option value="">Choose a year</option>

                    {years
                      .filter((item) => !item.archivedAt)
                      .map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                        </option>
                      ))}
                  </Select>

                  <Field
                    label="Term name"
                    name="name"
                    required
                  />

                  <Field
                    label="Starts"
                    name="startsOn"
                    type="date"
                    required
                  />

                  <Field
                    label="Ends"
                    name="endsOn"
                    type="date"
                    required
                  />

                  <Field
                    label="Order"
                    name="sortOrder"
                    type="number"
                    defaultValue={0}
                  />

                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      name="isCurrent"
                      type="checkbox"
                    />
                    Current term
                  </label>

                  <button
                    disabled={saving}
                    className="min-h-11 rounded-xl bg-[#D9A441] px-4 text-sm font-semibold text-[#15120b] disabled:opacity-50"
                  >
                    Add term
                  </button>
                </form>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {terms
                    .filter((item) => !item.archivedAt)
                    .map((term) => (
                      <TermCard
                        key={term.id}
                        term={term}
                        years={years}
                        onArchive={() =>
                          void archive("terms", term)
                        }
                        onSave={(event) =>
                          submit(event, (form) => ({
                            path: `terms/${term.id}`,
                            method: "PATCH",
                            data: {
                              academicYearId: textValue(
                                form,
                                "academicYearId",
                              ),
                              name: textValue(form, "name"),
                              startsOn: dateValue(
                                form,
                                "startsOn",
                              ),
                              endsOn: dateValue(
                                form,
                                "endsOn",
                              ),
                              sortOrder: Number(
                                textValue(form, "sortOrder"),
                              ),
                              isCurrent:
                                field(form, "isCurrent") ===
                                "on",
                              expectedRevision: term.revision,
                            },
                            message: "Term updated.",
                          }))
                        }
                      />
                    ))}
                </div>
              </Panel>
            </>
          )}

          {(section === "assignments" ||
            section === "exams" ||
            section === "study") && (
            <>
              <Panel>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">
                      Create{" "}
                      {section === "assignments"
                        ? "assignment"
                        : section === "exams"
                          ? "examination"
                          : "study session"}
                    </h2>

                    <p className="mt-1 text-xs text-white/45">
                      Academic records are private and remain the
                      source of truth. Linked tasks and projects are
                      not copied.
                    </p>
                  </div>

                  <Select
                    label="Filter by course"
                    value={courseFilter}
                    onChange={setCourseFilter}
                  >
                    <option value="">All courses</option>

                    {courses
                      .filter((course) => !course.archivedAt)
                      .map((course) => (
                        <option
                          key={course.id}
                          value={course.id}
                        >
                          {course.name}
                        </option>
                      ))}
                  </Select>
                </div>

                <form
                  className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                  onSubmit={(event) =>
                    submit(event, (form) => {
                      const base: Record<string, unknown> = {
                        kind: activityKinds,
                        courseId: textValue(form, "courseId"),
                        title: textValue(form, "title"),
                        description: dateValue(
                          form,
                          "description",
                        ),
                        timezone: textValue(form, "timezone"),
                        taskIds: multiple(form, "taskIds"),
                        projectIds: multiple(
                          form,
                          "projectIds",
                        ),
                      };

                      if (section === "assignments") {
                        Object.assign(base, {
                          dueOn: dateValue(form, "dueOn"),
                          dueAt:
                            textValue(form, "dueAt") || null,
                          submissionStatus: "NOT_STARTED",
                        });
                      }

                      if (section === "exams") {
                        Object.assign(base, {
                          startsAt: textValue(
                            form,
                            "startsAt",
                          ),
                          endsAt: textValue(form, "endsAt"),
                          examKind: textValue(
                            form,
                            "examKind",
                          ),
                          venue: dateValue(form, "venue"),
                          topic: dateValue(form, "examTopic"),
                          score: textValue(form, "score") ? Number(textValue(form, "score")) : null,
                          maxScore: textValue(form, "maxScore") ? Number(textValue(form, "maxScore")) : null,
                        });
                      }

                      if (section === "study") {
                        Object.assign(base, {
                          startsAt: textValue(
                            form,
                            "startsAt",
                          ),
                          endsAt: textValue(form, "endsAt"),
                          goal: dateValue(form, "goal"),
                          topic: dateValue(form, "studyTopic"),
                          progress: 0,
                        });
                      }

                      return {
                        path: activityEndpoint,
                        method: "POST",
                        data: base,
                        message: "Academic activity created.",
                      };
                    })
                  }
                >
                  <Select
                    label="Course"
                    name="courseId"
                    required
                  >
                    <option value="">Choose a course</option>

                    {courses
                      .filter((course) => !course.archivedAt)
                      .map((course) => (
                        <option
                          key={course.id}
                          value={course.id}
                        >
                          {course.name}
                        </option>
                      ))}
                  </Select>

                  <Field
                    label="Title"
                    name="title"
                    required
                    maxLength={200}
                  />

                  <Field
                    label="Description"
                    name="description"
                    maxLength={8000}
                  />

                  {section === "assignments" && (
                    <>
                      <Field
                        label="Date-only deadline"
                        name="dueOn"
                        type="date"
                      />

                      <Field
                        label={`Exact deadline in ${timezone}`}
                        name="dueAt"
                        type="datetime-local"
                      />

                      <p className="text-xs text-white/45">
                        Set either a date-only deadline or an exact
                        local time.
                      </p>
                    </>
                  )}

                  {section === "exams" && (
                    <>
                      <Field
                        label="Starts (local time)"
                        name="startsAt"
                        type="datetime-local"
                        required
                      />

                      <Field
                        label="Ends (local time)"
                        name="endsAt"
                        type="datetime-local"
                        required
                      />

                      <Select
                        label="Exam type"
                        name="examKind"
                      >
                        <option>EXAM</option>
                        <option>QUIZ</option>
                        <option>PRACTICAL</option>
                        <option>ORAL</option>
                        <option>OTHER</option>
                      </Select>

                      <Field
                        label="Venue"
                        name="venue"
                        maxLength={500}
                      />
                      <Field label="Topic (for weak-topic analysis)" name="examTopic" maxLength={160}/>
                      <Field label="Score earned (optional)" name="score" type="number"/>
                      <Field label="Maximum marks (optional)" name="maxScore" type="number"/>
                    </>
                  )}

                  {section === "study" && (
                    <>
                      <Field
                        label="Starts (local time)"
                        name="startsAt"
                        type="datetime-local"
                        required
                      />

                      <Field
                        label="Ends (local time)"
                        name="endsAt"
                        type="datetime-local"
                        required
                      />

                      <Field
                        label="Revision goal"
                        name="goal"
                        maxLength={2000}
                      />
                      <Field label="Topic" name="studyTopic" maxLength={160}/>
                    </>
                  )}

                  {(section === "exams" ||
                    section === "study") && (
                    <input
                      type="hidden"
                      name="timezone"
                      value={timezone}
                    />
                  )}

                  <MultiSelect
                    label="Link workspace tasks"
                    name="taskIds"
                    options={tasks.map((task) => ({
                      id: task.id,
                      label: task.title,
                    }))}
                  />

                  <MultiSelect
                    label="Link workspace projects"
                    name="projectIds"
                    options={projects.map((project) => ({
                      id: project.id,
                      label: project.name,
                    }))}
                  />

                  <button
                    disabled={
                      saving ||
                      !courses.some(
                        (course) => !course.archivedAt,
                      )
                    }
                    className="min-h-11 rounded-xl bg-[#D9A441] px-4 text-sm font-semibold text-[#15120b] disabled:opacity-50"
                  >
                    <Plus
                      className="mr-1 inline"
                      size={15}
                    />
                    Add
                  </button>
                </form>
              </Panel>

              <Panel>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">
                    {section === "assignments"
                      ? "Coursework"
                      : section === "exams"
                        ? "Examinations"
                        : "Study sessions"}
                  </h2>

                  <span className="text-xs text-white/45">
                    {filteredActivities.length} records
                  </span>
                </div>

                <div className="mt-3 grid gap-3">
                  {filteredActivities.map((activity) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      timezone={timezone}
                      tasks={tasks}
                      projects={projects}
                      saving={saving}
                      onSave={(event) =>
                        submit(event, (form) => ({
                          path: `${section}/${activity.id}`,
                          method: "PATCH",
                          data: {
                            title: textValue(form, "title"),
                            description: dateValue(
                              form,
                              "description",
                            ),
                            status: textValue(form, "status"),

                            ...(section === "assignments"
                              ? {
                                  dueOn: dateValue(
                                    form,
                                    "dueOn",
                                  ),
                                  dueAt:
                                    textValue(form, "dueAt") ||
                                    null,
                                  submissionStatus: textValue(
                                    form,
                                    "submissionStatus",
                                  ),
                                  grade: dateValue(
                                    form,
                                    "grade",
                                  ),
                                  feedback: dateValue(
                                    form,
                                    "feedback",
                                  ),
                                }
                              : {}),

                            ...(section === "exams"
                              ? {
                                  startsAt: dateValue(
                                    form,
                                    "startsAt",
                                  ),
                                  endsAt: dateValue(
                                    form,
                                    "endsAt",
                                  ),
                                  examKind: textValue(
                                    form,
                                    "examKind",
                                  ),
                                  venue: dateValue(
                                    form,
                                    "venue",
                                  ),
                                  topic: dateValue(form, "topic"),
                                  score: textValue(form, "score") ? Number(textValue(form, "score")) : null,
                                  maxScore: textValue(form, "maxScore") ? Number(textValue(form, "maxScore")) : null,
                                  timezone,
                                }
                              : {}),

                            ...(section === "study"
                              ? {
                                  startsAt: dateValue(
                                    form,
                                    "startsAt",
                                  ),
                                  endsAt: dateValue(
                                    form,
                                    "endsAt",
                                  ),
                                  goal: dateValue(
                                    form,
                                    "goal",
                                  ),
                                  topic: dateValue(form, "topic"),
                                  progress: Number(
                                    textValue(form, "progress"),
                                  ),
                                  timezone,
                                }
                              : {}),

                            expectedRevision: activity.revision,
                          },
                          message: "Academic activity updated.",
                        }))
                      }
                      onArchive={() =>
                        void archive(section, activity)
                      }
                      onLink={(type, id, linked) =>
                        void link(activity, type, id, linked)
                      }
                    />
                  ))}
                </div>

                {!filteredActivities.length && (
                  <Empty>
                    No {section === "study" ? "study sessions" : section}{" "}
                    yet. Add the first record above.
                  </Empty>
                )}
              </Panel>
            </>
          )}

          {section === "timetable" && (
            <>
              <Panel>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">
                      Add a recurring weekly class
                    </h2>

                    <p className="mt-1 text-xs text-white/45">
                      Set the days, time and date range for a
                      recurring class.
                    </p>
                  </div>

                  <span className="rounded-full border border-[#D9A441]/20 bg-[#D9A441]/[.07] px-3 py-1.5 text-xs text-[#F2CF86]">
                    {timezone}
                  </span>
                </div>

                <form
                  className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                  onSubmit={(event) =>
                    submit(event, (form) => ({
                      path: "timetable",
                      method: "POST",
                      data: {
                        courseId: textValue(form, "courseId"),
                        title: textValue(form, "title"),
                        weekdays: multiple(
                          form,
                          "weekdays",
                        ).map(Number),
                        startsOn: dateValue(form, "startsOn"),
                        endsOn: dateValue(form, "endsOn"),
                        localStart: textValue(
                          form,
                          "localStart",
                        ),
                        localEnd: textValue(form, "localEnd"),
                        timezone: textValue(form, "timezone"),
                        location: dateValue(form, "location"),
                      },
                      message: "Timetable rule created.",
                    }))
                  }
                >
                  <Select
                    label="Course"
                    name="courseId"
                    required
                  >
                    <option value="">Choose a course</option>

                    {courses
                      .filter((course) => !course.archivedAt)
                      .map((course) => (
                        <option
                          key={course.id}
                          value={course.id}
                        >
                          {course.name}
                        </option>
                      ))}
                  </Select>

                  <Field
                    label="Class title"
                    name="title"
                    required
                    maxLength={160}
                  />

                  <Field
                    label="Valid from"
                    name="startsOn"
                    type="date"
                    required
                  />

                  <Field
                    label="Valid through"
                    name="endsOn"
                    type="date"
                    required
                  />

                  <Field
                    label="Starts"
                    name="localStart"
                    type="time"
                    required
                  />

                  <Field
                    label="Ends"
                    name="localEnd"
                    type="time"
                    required
                  />

                  <Field
                    label="IANA timezone"
                    name="timezone"
                    required
                    defaultValue={timezone}
                  />

                  <Field
                    label="Location"
                    name="location"
                    maxLength={500}
                  />

                  <fieldset className="grid gap-2 sm:col-span-2">
                    <legend className="mb-2 text-sm text-white/70">
                      Repeats on
                    </legend>

                    <div className="flex flex-wrap gap-3">
                      {weekdays.map((day, index) => (
                        <label
                          key={day}
                          className="flex items-center gap-1.5 text-xs text-white/65"
                        >
                          <input
                            type="checkbox"
                            name="weekdays"
                            value={index + 1}
                            defaultChecked={index < 5}
                          />
                          {day.slice(0, 3)}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <button
                    disabled={
                      saving ||
                      !courses.some(
                        (course) => !course.archivedAt,
                      )
                    }
                    className="min-h-11 rounded-xl bg-[#D9A441] px-4 text-sm font-semibold text-[#15120b] transition hover:bg-[#e6b653] disabled:opacity-50"
                  >
                    <Plus
                      className="mr-1 inline"
                      size={15}
                    />
                    Add weekly class
                  </button>
                </form>

                <p className="mt-3 text-xs text-white/45">
                  Overlaps are shown as warnings. Daylight-saving
                  times that do not exist or occur twice are rejected
                  rather than shifted.
                </p>
              </Panel>

              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">
                      Recurring classes
                    </h2>

                    <p className="mt-1 text-xs text-white/45">
                      Manage your saved weekly class schedules.
                    </p>
                  </div>

                  <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-white/55">
                    {rules.filter((rule) => !rule.archivedAt).length}{" "}
                    active schedules
                  </span>
                </div>

                <div className="mt-3 grid gap-3">
                  {rules
                    .filter((rule) => !rule.archivedAt)
                    .map((rule) => (
                      <TimetableRuleCard
                        key={rule.id}
                        rule={rule}
                        courses={courses}
                        weekdays={weekdays}
                        saving={saving}
                        onArchive={() =>
                          void archive("timetable", rule)
                        }
                        onSave={(event) =>
                          submit(event, (form) => ({
                            path: `timetable/${rule.id}`,
                            method: "PATCH",
                            data: {
                              courseId: textValue(
                                form,
                                "courseId",
                              ),
                              title: textValue(form, "title"),
                              weekdays: multiple(
                                form,
                                "weekdays",
                              ).map(Number),
                              startsOn: dateValue(
                                form,
                                "startsOn",
                              ),
                              endsOn: dateValue(
                                form,
                                "endsOn",
                              ),
                              localStart: textValue(
                                form,
                                "localStart",
                              ),
                              localEnd: textValue(
                                form,
                                "localEnd",
                              ),
                              timezone: textValue(
                                form,
                                "timezone",
                              ),
                              location: dateValue(
                                form,
                                "location",
                              ),
                              expectedRevision: rule.revision,
                            },
                            message: "Timetable rule updated.",
                          }))
                        }
                      />
                    ))}

                  {!rules.some((rule) => !rule.archivedAt) && (
                    <Empty>
                      No timetable rules yet. Add your first
                      recurring class above.
                    </Empty>
                  )}
                </div>
              </Panel>

              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">
                      Upcoming classes and scheduling warnings
                    </h2>

                    <p className="mt-1 text-xs text-white/45">
                      Review individual class occurrences without
                      changing the recurring schedule.
                    </p>
                  </div>

                  <div className="flex rounded-xl border border-white/10 p-1">
                    <button
                      type="button"
                      aria-pressed={calendarSpan === 7}
                      onClick={() => setCalendarSpan(7)}
                      className={`rounded-lg px-3 py-2 text-xs transition ${
                        calendarSpan === 7
                          ? "bg-white/10 text-white"
                          : "text-white/45 hover:text-white"
                      }`}
                    >
                      Week
                    </button>

                    <button
                      type="button"
                      aria-pressed={calendarSpan === 30}
                      onClick={() => setCalendarSpan(30)}
                      className={`rounded-lg px-3 py-2 text-xs transition ${
                        calendarSpan === 30
                          ? "bg-white/10 text-white"
                          : "text-white/45 hover:text-white"
                      }`}
                    >
                      Month
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  {events
                    .filter(
                      (event) => event.sourceType === "CLASS",
                    )
                    .slice(0, 24)
                    .map((event, index) => (
                      <div
                        key={`${event.sourceId}-${event.occurrenceDate}-${index}`}
                        className="rounded-xl border border-white/10 bg-white/[.02] p-3 transition hover:border-white/20 hover:bg-white/[.035]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              {event.title}
                            </p>

                            <p className="text-xs text-white/45">
                              {event.occurrenceDate} ·{" "}
                              {formatWhen(
                                event.startAt,
                                event.timezone ?? timezone,
                              )}{" "}
                              –{" "}
                              {formatWhen(
                                event.endAt,
                                event.timezone ?? timezone,
                              )}
                            </p>

                            {event.location && (
                              <p className="mt-1 text-xs text-white/40">
                                {event.location}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              event.occurrenceDate &&
                              void exception(
                                event.sourceId,
                                event.occurrenceDate,
                                "CANCELLED",
                              )
                            }
                            className="rounded-lg border border-rose-200/15 px-3 py-2 text-xs text-rose-100/75 transition hover:bg-rose-200/10 disabled:opacity-50"
                          >
                            Cancel occurrence
                          </button>
                        </div>

                        <form
                          className="mt-3 grid gap-2 border-t border-white/[.06] pt-3 sm:grid-cols-[1fr_1fr_auto]"
                          onSubmit={(submitEvent) => {
                            submitEvent.preventDefault();

                            if (!event.occurrenceDate) return;

                            const form =
                              submitEvent.currentTarget;

                            void exception(
                              event.sourceId,
                              event.occurrenceDate,
                              "RESCHEDULED",
                              textValue(form, "startsAt"),
                              textValue(form, "endsAt"),
                              event.timezone ?? timezone,
                            );
                          }}
                        >
                          <Field
                            label="Reschedule starts"
                            name="startsAt"
                            type="datetime-local"
                            required
                            defaultValue={localDateTimeInput(
                              event.startAt,
                              event.timezone ?? timezone,
                            )}
                          />

                          <Field
                            label="Reschedule ends"
                            name="endsAt"
                            type="datetime-local"
                            required
                            defaultValue={localDateTimeInput(
                              event.endAt,
                              event.timezone ?? timezone,
                            )}
                          />

                          <button
                            disabled={saving}
                            className="self-end rounded-lg border border-white/10 px-3 py-2 text-xs text-white/75 transition hover:bg-white/5 disabled:opacity-50"
                          >
                            Reschedule
                          </button>
                        </form>
                      </div>
                    ))}

                  {!events.some(
                    (event) => event.sourceType === "CLASS",
                  ) && (
                    <Empty>
                      No classes in the selected period.
                    </Empty>
                  )}
                </div>

                {conflicts.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200/20 bg-amber-200/[.06] p-3 text-sm text-amber-100">
                    <p className="font-medium">
                      Review scheduling warnings
                    </p>

                    <ul className="mt-2 grid gap-1 text-xs">
                      {conflicts.slice(0, 8).map((warning, index) => (
                        <li
                          key={`${warning.sourceId}-${warning.date}-${index}`}
                        >
                          {warning.date}:{" "}
                          {warning.warning.replaceAll("_", " ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>
            </>
          )}
        </>
      )}

      <footer className="flex items-center gap-2 text-xs text-white/35">
        <CalendarDays size={14} />
        Private academic records · Calendar is a read-only projection
        of each source.
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Panel>
      <p className="text-xs uppercase tracking-wider text-white/45">
        {label}
      </p>

      <p className="mt-2 truncate text-xl font-semibold">
        {value}
      </p>
    </Panel>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/45">
      {children}
    </p>
  );
}

function Select({
  label,
  name,
  value,
  defaultValue,
  onChange,
  required,
  children,
}: {
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm text-white/70">
      {label}

      <select
        name={name}
        value={value}
        defaultValue={
          value === undefined ? defaultValue : undefined
        }
        onChange={
          onChange
            ? (event) => onChange(event.target.value)
            : undefined
        }
        required={required}
        className="min-h-11 rounded-xl border border-white/10 bg-[#10131c] px-3 text-white outline-none transition focus:border-[#D9A441]/60 focus:ring-2 focus:ring-[#D9A441]/20"
      >
        {children}
      </select>
    </label>
  );
}

function MultiSelect({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <label className="grid gap-1.5 text-sm text-white/70">
      {label}

      <select
        name={name}
        multiple
        className="min-h-20 rounded-xl border border-white/10 bg-[#10131c] p-2 text-xs text-white"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function YearEditor({
  years,
  onSubmit,
  onArchive,
  saving,
}: {
  years: AcademicYear[];
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    row?: AcademicYear,
  ) => void;
  onArchive: (row: AcademicYear) => void;
  saving: boolean;
}) {
  return (
    <>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => onSubmit(event)}
      >
        <Field
          label="Year name"
          name="name"
          required
          maxLength={100}
        />

        <Field
          label="Starts"
          name="startsOn"
          type="date"
          required
        />

        <Field
          label="Ends"
          name="endsOn"
          type="date"
          required
        />

        <label className="flex min-h-11 items-center gap-2 text-sm text-white/70">
          <input type="checkbox" name="isCurrent" />
          Current academic year
        </label>

        <button
          disabled={saving}
          className="min-h-11 rounded-xl bg-[#D9A441] px-4 text-sm font-semibold text-[#15120b] disabled:opacity-50"
        >
          Create academic year
        </button>
      </form>

      <div className="mt-4 grid gap-2">
        {years
          .filter((year) => !year.archivedAt)
          .map((year) => (
            <div
              key={year.id}
              className="rounded-xl border border-white/10 p-3"
            >
              <form
                className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
                onSubmit={(event) => onSubmit(event, year)}
              >
                <Field
                  label="Name"
                  name="name"
                  defaultValue={year.name}
                  required
                />

                <Field
                  label="Starts"
                  name="startsOn"
                  type="date"
                  defaultValue={dateText(year.startsOn)}
                  required
                />

                <Field
                  label="Ends"
                  name="endsOn"
                  type="date"
                  defaultValue={dateText(year.endsOn)}
                  required
                />

                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    name="isCurrent"
                    defaultChecked={year.isCurrent}
                  />
                  Current
                </label>

                <div className="flex items-end gap-2">
                  <button
                    disabled={saving}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs transition hover:bg-white/5 disabled:opacity-50"
                  >
                    Save
                  </button>

                  <button
                    type="button"
                    onClick={() => onArchive(year)}
                    className="rounded-xl border border-rose-200/15 px-3 py-2 text-xs text-rose-100/75 transition hover:bg-rose-200/10"
                    aria-label={`Archive ${year.name}`}
                  >
                    <Archive size={13} />
                  </button>
                </div>
              </form>
            </div>
          ))}
      </div>

      {!years.length && (
        <Empty>No academic years yet.</Empty>
      )}
    </>
  );
}

function TermCard({
  term,
  years,
  onArchive,
  onSave,
}: {
  term: AcademicTerm;
  years: AcademicYear[];
  onArchive: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <details className="rounded-xl border border-white/10 p-3">
      <summary className="flex cursor-pointer items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {term.name}
            {term.isCurrent ? " · Current" : ""}
          </p>

          <p className="text-xs text-white/45">
            {dateText(term.startsOn)} – {dateText(term.endsOn)}
          </p>
        </div>

        <span className="text-xs text-[#F2CF86]">
          Edit
        </span>
      </summary>

      <form
        className="mt-3 grid gap-2 sm:grid-cols-2"
        onSubmit={onSave}
      >
        <Field
          label="Name"
          name="name"
          defaultValue={term.name}
          required
        />

        <Field
          label="Starts"
          name="startsOn"
          type="date"
          defaultValue={dateText(term.startsOn)}
          required
        />

        <Field
          label="Ends"
          name="endsOn"
          type="date"
          defaultValue={dateText(term.endsOn)}
          required
        />

        <Field
          label="Sort order"
          name="sortOrder"
          type="number"
          defaultValue={term.sortOrder}
        />

        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            name="isCurrent"
            type="checkbox"
            defaultChecked={term.isCurrent}
          />
          Current term
        </label>

        <Select
          label="Academic year"
          name="academicYearId"
          defaultValue={term.academicYearId}
        >
          {years
            .filter((year) => !year.archivedAt)
            .map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
        </Select>

        <div className="flex justify-between sm:col-span-2">
          <button
            type="button"
            onClick={onArchive}
            className="rounded-lg border border-rose-200/15 px-3 py-2 text-xs text-rose-100/75 transition hover:bg-rose-200/10"
          >
            Archive
          </button>

          <button className="rounded-lg bg-[#D9A441] px-3 py-2 text-xs font-semibold text-[#15120b]">
            Save term
          </button>
        </div>
      </form>
    </details>
  );
}

function CourseCard({
  course,
  years,
  terms,
  onSave,
  onArchive,
  saving,
}: {
  course: AcademicCourse;
  years: AcademicYear[];
  terms: AcademicTerm[];
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: () => void;
  saving: boolean;
}) {
  return (
    <Panel>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={onSave}
      >
        <div className="sm:col-span-2">
          <p className="text-xs uppercase tracking-wider text-[#F2CF86]">
            {years.find(
              (year) => year.id === course.academicYearId,
            )?.name ?? "Academic year"}
          </p>
        </div>

        <Field
          label="Course name"
          name="name"
          defaultValue={course.name}
          required
        />

        <Field
          label="Code"
          name="code"
          defaultValue={course.code}
        />

        <Field
          label="Credits"
          name="credits"
          type="number"
          defaultValue={course.credits}
        />

        <Select
          label="Academic year"
          name="academicYearId"
        >
          <option value={course.academicYearId}>
            {years.find(
              (year) => year.id === course.academicYearId,
            )?.name}
          </option>

          {years
            .filter(
              (year) =>
                !year.archivedAt &&
                year.id !== course.academicYearId,
            )
            .map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
        </Select>

        <label className="grid gap-1.5 text-sm text-white/70 sm:col-span-2">
          Description

          <textarea
            name="description"
            defaultValue={course.description ?? ""}
            maxLength={4000}
            rows={2}
            className="rounded-xl border border-white/10 bg-[#10131c] p-3 text-white"
          />
        </label>

        <label className="grid gap-1.5 text-sm text-white/70 sm:col-span-2">
          Terms

          <select
            name="termIds"
            multiple
            defaultValue={course.terms.map(
              (item) => item.term.id,
            )}
            className="min-h-16 rounded-xl border border-white/10 bg-[#10131c] p-2 text-white"
          >
            {terms
              .filter((term) => !term.archivedAt)
              .map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
          </select>
        </label>

        <div className="flex items-center justify-between sm:col-span-2">
          <span className="text-xs text-white/40">
            {course._count &&
            typeof course._count === "object"
              ? `${String((course._count as Record<string, unknown>).activities ?? 0)} linked activities`
              : ""}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onArchive}
              className="rounded-lg border border-rose-200/15 px-3 py-2 text-xs text-rose-100/75 transition hover:bg-rose-200/10"
            >
              <Archive
                size={13}
                className="mr-1 inline"
              />
              Archive
            </button>

            <button
              disabled={saving}
              className="rounded-lg bg-[#D9A441] px-3 py-2 text-xs font-semibold text-[#15120b] disabled:opacity-50"
            >
              Save changes
            </button>
          </div>
        </div>
      </form>
    </Panel>
  );
}

function TimetableRuleCard({
  rule,
  courses,
  weekdays,
  onSave,
  onArchive,
  saving,
}: {
  rule: ClassRule;
  courses: AcademicCourse[];
  weekdays: string[];
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: () => void;
  saving: boolean;
}) {
  return (
    <details className="rounded-xl border border-white/10 bg-white/[.02] p-4 transition hover:border-white/20">
      <summary className="flex cursor-pointer items-start justify-between gap-3">
        <div>
          <p className="font-medium">{rule.title}</p>

          <p className="mt-1 text-xs text-white/45">
            {rule.course.name} ·{" "}
            {rule.weekdays
              .map((day) => weekdays[day - 1]?.slice(0, 3))
              .join(", ")}{" "}
            · {rule.localStart}–{rule.localEnd} ·{" "}
            {rule.timezone}
          </p>

          <p className="text-xs text-white/45">
            {dateText(rule.startsOn)} – {dateText(rule.endsOn)}
            {rule.location ? ` · ${rule.location}` : ""}
          </p>
        </div>

        <span className="text-xs text-[#F2CF86]">
          Edit
        </span>
      </summary>

      <form
        className="mt-3 grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={onSave}
      >
        <Select
          label="Course"
          name="courseId"
          defaultValue={rule.courseId}
        >
          {courses
            .filter((course) => !course.archivedAt)
            .map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
        </Select>

        <Field
          label="Title"
          name="title"
          defaultValue={rule.title}
          required
        />

        <Field
          label="Starts on"
          name="startsOn"
          type="date"
          defaultValue={dateText(rule.startsOn)}
          required
        />

        <Field
          label="Ends on"
          name="endsOn"
          type="date"
          defaultValue={dateText(rule.endsOn)}
          required
        />

        <Field
          label="Local start"
          name="localStart"
          type="time"
          defaultValue={rule.localStart}
          required
        />

        <Field
          label="Local end"
          name="localEnd"
          type="time"
          defaultValue={rule.localEnd}
          required
        />

        <Field
          label="Timezone"
          name="timezone"
          defaultValue={rule.timezone}
          required
        />

        <Field
          label="Location"
          name="location"
          defaultValue={rule.location}
        />

        <fieldset className="grid gap-2 sm:col-span-2">
          <legend className="text-xs text-white/55">
            Weekly recurrence
          </legend>

          <div className="flex flex-wrap gap-3">
            {weekdays.map((day, index) => (
              <label
                key={day}
                className="flex items-center gap-1 text-xs text-white/65"
              >
                <input
                  type="checkbox"
                  name="weekdays"
                  value={index + 1}
                  defaultChecked={rule.weekdays.includes(
                    index + 1,
                  )}
                />
                {day.slice(0, 3)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-between sm:col-span-2 lg:col-span-4">
          <button
            type="button"
            onClick={onArchive}
            className="rounded-lg border border-rose-200/15 px-3 py-2 text-xs text-rose-100/75 transition hover:bg-rose-200/10"
          >
            Archive
          </button>

          <button
            disabled={saving}
            className="rounded-lg bg-[#D9A441] px-3 py-2 text-xs font-semibold text-[#15120b] disabled:opacity-50"
          >
            Save schedule
          </button>
        </div>
      </form>

      <p className="mt-3 text-xs text-white/45">
        Saved exceptions: {rule.exceptions.length}. Individual
        occurrence changes do not alter this recurrence.
      </p>
    </details>
  );
}

function ActivityCard({
  activity,
  timezone,
  tasks,
  projects,
  onSave,
  onArchive,
  onLink,
  saving,
}: {
  activity: AcademicActivity;
  timezone: string;
  tasks: Array<{ id: string; title: string }>;
  projects: Array<{ id: string; name: string }>;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: () => void;
  onLink: (
    type: "task" | "project",
    id: string,
    linked: boolean,
  ) => void;
  saving: boolean;
}) {
  return (
    <details className="rounded-xl border border-white/10 bg-white/[.02] p-4 transition hover:border-white/20">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium">{activity.title}</p>

            <p className="mt-1 text-xs text-white/45">
              {activity.course.name} ·{" "}
              {activity.kind.replaceAll("_", " ")} ·{" "}
              {activity.status.replaceAll("_", " ")}
            </p>

            <p className="text-xs text-white/45">
              {activity.dueOn
                ? `Due ${dateText(activity.dueOn)} (date only)`
                : activity.dueAt
                  ? `Due ${formatWhen(
                      activity.dueAt,
                      activity.timezone ?? timezone,
                    )}`
                  : formatWhen(
                      activity.startsAt,
                      activity.timezone ?? timezone,
                    )}
            </p>
          </div>

          <span className="text-xs text-[#F2CF86]">
            Details / edit
          </span>
        </div>
      </summary>

      <form
        className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2"
        onSubmit={onSave}
      >
        <Field
          label="Title"
          name="title"
          defaultValue={activity.title}
          required
        />

        <Select
          label="Status"
          name="status"
          defaultValue={activity.status}
        >
          <option>PLANNED</option>
          <option>IN_PROGRESS</option>
          <option>COMPLETED</option>
          <option>CANCELLED</option>
        </Select>

        <label className="grid gap-1.5 text-sm text-white/70 sm:col-span-2">
          Description

          <textarea
            name="description"
            defaultValue={activity.description ?? ""}
            rows={2}
            maxLength={8000}
            className="rounded-xl border border-white/10 bg-[#10131c] p-3 text-white"
          />
        </label>

        {activity.kind === "ASSIGNMENT" && (
          <>
            <Field
              label="Date-only deadline"
              name="dueOn"
              type="date"
              defaultValue={
                activity.dueOn
                  ? dateText(activity.dueOn)
                  : ""
              }
            />

            <Field
              label={`Exact deadline (${activity.timezone ?? timezone})`}
              name="dueAt"
              type="datetime-local"
              defaultValue={localDateTimeInput(
                activity.dueAt,
                activity.timezone ?? timezone,
              )}
            />

            <Select
              label="Submission status"
              name="submissionStatus"
              defaultValue={
                activity.assignment?.submissionStatus ??
                "NOT_STARTED"
              }
            >
              <option>NOT_STARTED</option>
              <option>IN_PROGRESS</option>
              <option>SUBMITTED</option>
              <option>GRADED</option>
            </Select>

            <Field
              label="Grade"
              name="grade"
              defaultValue={activity.assignment?.grade}
            />

            <label className="grid gap-1.5 text-sm text-white/70 sm:col-span-2">
              Feedback

              <textarea
                name="feedback"
                defaultValue={
                  activity.assignment?.feedback ?? ""
                }
                rows={2}
                maxLength={4000}
                className="rounded-xl border border-white/10 bg-[#10131c] p-3 text-white"
              />
            </label>
          </>
        )}

        {activity.kind === "EXAM" && (
          <>
            <Field
              label="Starts (local)"
              name="startsAt"
              type="datetime-local"
              defaultValue={localDateTimeInput(
                activity.startsAt,
                activity.timezone ?? timezone,
              )}
            />

            <Field
              label="Ends (local)"
              name="endsAt"
              type="datetime-local"
              defaultValue={localDateTimeInput(
                activity.endsAt,
                activity.timezone ?? timezone,
              )}
            />

            <Select
              label="Exam type"
              name="examKind"
              defaultValue={activity.exam?.examKind ?? "EXAM"}
            >
              <option>EXAM</option>
              <option>QUIZ</option>
              <option>PRACTICAL</option>
              <option>ORAL</option>
              <option>OTHER</option>
            </Select>

            <Field
              label="Venue"
              name="venue"
              defaultValue={activity.exam?.venue}
            />
            <Field label="Topic (for weak-topic analysis)" name="topic" maxLength={160} defaultValue={activity.exam?.topic}/>
            <Field label="Score earned (optional)" name="score" type="number" defaultValue={activity.exam?.score}/>
            <Field label="Maximum marks (optional)" name="maxScore" type="number" defaultValue={activity.exam?.maxScore}/>
          </>
        )}

        {activity.kind === "STUDY_SESSION" && (
          <>
            <Field
              label="Starts (local)"
              name="startsAt"
              type="datetime-local"
              defaultValue={localDateTimeInput(
                activity.startsAt,
                activity.timezone ?? timezone,
              )}
            />

            <Field
              label="Ends (local)"
              name="endsAt"
              type="datetime-local"
              defaultValue={localDateTimeInput(
                activity.endsAt,
                activity.timezone ?? timezone,
              )}
            />

            <Field
              label="Revision goal"
              name="goal"
              defaultValue={activity.studySession?.goal}
            />
            <Field label="Topic" name="topic" maxLength={160} defaultValue={activity.studySession?.topic}/>

            <Field
              label="Progress (0–100)"
              name="progress"
              type="number"
              defaultValue={
                activity.studySession?.progress ?? 0
              }
            />
          </>
        )}

        <input
          type="hidden"
          name="timezone"
          value={activity.timezone ?? timezone}
        />

        <div className="flex flex-wrap justify-between gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={onArchive}
            className="rounded-lg border border-rose-200/15 px-3 py-2 text-xs text-rose-100/75 transition hover:bg-rose-200/10"
          >
            <Archive
              size={13}
              className="mr-1 inline"
            />
            Archive
          </button>

          <button
            disabled={saving}
            className="rounded-lg bg-[#D9A441] px-4 py-2 text-xs font-semibold text-[#15120b] disabled:opacity-50"
          >
            Save updates
          </button>
        </div>
      </form>

      <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-2">
        <LinkManager
          label="Workspace tasks"
          type="task"
          linked={activity.taskLinks.map(
            (item) => item.taskId,
          )}
          options={tasks.map((item) => ({
            id: item.id,
            label: item.title,
          }))}
          onLink={onLink}
        />

        <LinkManager
          label="Workspace projects"
          type="project"
          linked={activity.projectLinks.map(
            (item) => item.projectId,
          )}
          options={projects.map((item) => ({
            id: item.id,
            label: item.name,
          }))}
          onLink={onLink}
        />
      </div>
    </details>
  );
}

function LinkManager({
  label,
  type,
  linked,
  options,
  onLink,
}: {
  label: string;
  type: "task" | "project";
  linked: string[];
  options: Array<{ id: string; label: string }>;
  onLink: (
    type: "task" | "project",
    id: string,
    linked: boolean,
  ) => void;
}) {
  const [selected, setSelected] = useState("");

  return (
    <div>
      <p className="mb-2 flex items-center gap-1 text-xs font-medium text-white/55">
        <Link2 size={13} />
        {label}
      </p>

      <div className="flex gap-2">
        <select
          value={selected}
          onChange={(event) =>
            setSelected(event.target.value)
          }
          className="min-h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#10131c] px-2 text-xs text-white"
        >
          <option value="">Choose item</option>

          {options
            .filter((item) => !linked.includes(item.id))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
        </select>

        <button
          type="button"
          disabled={!selected}
          onClick={() => {
            onLink(type, selected, true);
            setSelected("");
          }}
          className="rounded-lg border border-white/10 px-3 text-xs transition hover:bg-white/5 disabled:opacity-40"
        >
          Link
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {linked.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full bg-white/[.06] px-2 py-1 text-[10px] text-white/55"
          >
            {options.find((item) => item.id === id)?.label ?? id}

            <button
              type="button"
              aria-label={`Unlink ${id}`}
              onClick={() => onLink(type, id, false)}
              className="rounded-full transition hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D9A441]"
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
