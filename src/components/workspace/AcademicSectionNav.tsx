import Link from "next/link";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  GraduationCap,
  CalendarDays,
  BrainCircuit,
} from "lucide-react";

import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

type AcademicSection =
  | "overview"
  | "courses"
  | "assignments"
  | "exams"
  | "timetable"
  | "study";

const academicLinks = [
  {
    key: "overview",
    label: "Overview",
    href: "/dashboard/workspace/academics",
    icon: LayoutDashboard,
  },
  {
    key: "courses",
    label: "Courses",
    href: "/dashboard/workspace/academics/courses",
    icon: BookOpen,
  },
  {
    key: "assignments",
    label: "Assignments",
    href: "/dashboard/workspace/academics/assignments",
    icon: ClipboardList,
  },
  {
    key: "exams",
    label: "Examinations",
    href: "/dashboard/workspace/academics/exams",
    icon: GraduationCap,
  },
  {
    key: "timetable",
    label: "Timetable",
    href: "/dashboard/workspace/academics/timetable",
    icon: CalendarDays,
  },
  {
    key: "study",
    label: "Study Planner",
    href: "/dashboard/workspace/academics/study",
    icon: BrainCircuit,
  },
] as const;

export function AcademicSectionNav({
  active,
}: {
  active: AcademicSection;
}) {
  return (
    <LiquidLensSurface
      radius={22}
      intensity="medium"
      className="overflow-hidden border border-white/[0.09] p-1.5 sm:p-2"
    >
      <nav
        aria-label="Academic workspace sections"
        className="flex w-full items-center gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {academicLinks.map((item) => {
          const isActive = active === item.key;
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={[
                "group relative inline-flex min-h-11 shrink-0 snap-start items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium",
                "transition-[background,border-color,color,box-shadow,transform] duration-300 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2 focus-visible:ring-offset-[#11131b]",
                isActive
                  ? "border-[#D9A441]/30 bg-gradient-to-b from-[#D9A441]/20 to-[#D9A441]/[0.07] text-[#F5D795] shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_3px_14px_rgba(217,164,65,0.08)]"
                  : "border-transparent text-white/55 hover:border-white/[0.09] hover:bg-white/[0.055] hover:text-white",
              ].join(" ")}
            >
              <Icon
                size={16}
                strokeWidth={isActive ? 2 : 1.7}
                aria-hidden="true"
                className={
                  isActive
                    ? "text-[#E8BD69]"
                    : "text-white/45 transition-colors group-hover:text-white/80"
                }
              />

              <span>{item.label}</span>

              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-[#E8BD69]/70 to-transparent"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </LiquidLensSurface>
  );
}