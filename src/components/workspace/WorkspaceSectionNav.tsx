import Link from "next/link";
import { CalendarDays, CheckSquare2, Database, FolderKanban, NotebookPen, GraduationCap, CalendarRange, ShieldCheck, WalletCards, Sparkles, Apple } from "lucide-react";

const links = [
  ["Overview", "/dashboard/workspace", "overview", CalendarDays],
  ["Tasks", "/dashboard/workspace/tasks", "tasks", CheckSquare2],
  ["Projects", "/dashboard/workspace/projects", "projects", FolderKanban],
  ["Databases", "/dashboard/workspace/databases", "databases", Database],
  ["Pages", "/dashboard/workspace/pages", "pages", NotebookPen],
  ["Academics", "/dashboard/workspace/academics", "academics", GraduationCap],
  ["Calendar", "/dashboard/workspace/calendar", "calendar", CalendarRange],
  ["Finance", "/dashboard/workspace/finance", "finance", WalletCards],
  ["Nutrition", "/dashboard/workspace/nutrition", "nutrition", Apple],
  ["Security", "/dashboard/workspace/security", "security", ShieldCheck],
  ["Intelligence", "/dashboard/workspace/intelligence", "intelligence", Sparkles],
] as const;

export function WorkspaceSectionNav({ active }: { active: (typeof links)[number][2] }) {
  return <nav aria-label="Personal workspace" className="flex gap-2 overflow-x-auto pb-1">
    {links.map(([label, href, key, Icon]) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] ${active === key ? "border-[#D9A441]/40 bg-[#D9A441]/15 text-[#F2CF86]" : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.08] hover:text-white"}`}><Icon size={15} aria-hidden="true" />{label}</Link>)}
  </nav>;
}
