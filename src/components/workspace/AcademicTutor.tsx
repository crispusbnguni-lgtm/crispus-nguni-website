"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, GraduationCap, LoaderCircle, Sparkles } from "lucide-react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { WorkspaceSectionNav } from "@/components/workspace/WorkspaceSectionNav";

type Course = { id: string; name: string; code: string | null; description: string | null };
type Resource = { id: string; title: string; topic: string | null; description: string | null; searchableText?: string | null; downloadUrl: string };
const modes = [{ id: "HINT", label: "Hint first" }, { id: "EXPLAIN", label: "Explain" }, { id: "PRACTICE", label: "Practice questions" }, { id: "MOCK_CAT", label: "Mock CAT" }, { id: "CHECK_ANSWER", label: "Check my answer" }] as const;

export function AcademicTutor() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState("BEGINNER");
  const [helpMode, setHelpMode] = useState<(typeof modes)[number]["id"]>("EXPLAIN");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/dashboard/workspace/academics/courses", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { success?: boolean; data?: Course[] };
      if (response.ok && result.success && result.data) { setCourses(result.data); setCourseId(result.data[0]?.id ?? ""); }
    }).catch(() => setError("Your courses could not be loaded."));
  }, []);
  useEffect(() => {
    if (!courseId) return;
    let ignore = false;
    void fetch(`/api/dashboard/workspace/academics/resources?courseId=${encodeURIComponent(courseId)}`, { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { success?: boolean; resources?: Resource[] };
      if (response.ok && result.success && !ignore) { setResources(result.resources ?? []); setSelectedResources([]); }
    }).catch(() => { if (!ignore) setError("Course resources could not be loaded."); });
    return () => { ignore = true; };
  }, [courseId]);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setAnswer("");
    try {
      const response = await fetch("/api/dashboard/workspace/intelligence/academic-tutor", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, topic, question, level, helpMode, resourceIds: selectedResources }) });
      const result = await response.json() as { success?: boolean; answer?: string; message?: string };
      if (!response.ok || !result.success || !result.answer) throw new Error(result.message || "Tutor is unavailable.");
      setAnswer(result.answer);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tutor is unavailable."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-20 pt-7 text-white sm:px-6 lg:px-8">
    <header><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-[#D9A441]"><GraduationCap size={15}/>Shared Personal Intelligence</p><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Academic AI Tutor</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">Get course-aware explanations, mathematical walkthroughs, hints, practice and mock CAT questions. Course records are verified as your records; AI responses are recommendations, not official Moi University material.</p></header>
    <WorkspaceSectionNav active="academics"/>
    <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <LiquidLensSurface radius={24} className="grid content-start gap-4 p-5 sm:p-7"><h2 className="flex items-center gap-2 font-semibold"><BookOpen size={17} className="text-[#F2CF86]"/>Study context</h2>
        <label className="grid gap-1.5 text-sm text-white/70">Course<select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#10131c] px-3 text-white"><option value="">Choose a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code ? `${course.code} · ` : ""}{course.name}</option>)}</select></label>
        <label className="grid gap-1.5 text-sm text-white/70">Topic<input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={180} required placeholder="e.g. conditional expectation" className="min-h-11 rounded-xl border border-white/10 bg-[#10131c] px-3 text-white"/></label>
        <label className="grid gap-1.5 text-sm text-white/70">Learning level<select value={level} onChange={(event) => setLevel(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#10131c] px-3 text-white"><option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select></label>
        <label className="grid gap-1.5 text-sm text-white/70">Help mode<select value={helpMode} onChange={(event) => setHelpMode(event.target.value as typeof helpMode)} className="min-h-11 rounded-xl border border-white/10 bg-[#10131c] px-3 text-white">{modes.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select></label>
        <fieldset className="grid gap-2"><legend className="mb-1 text-sm text-white/70">Course material (optional)</legend>{resources.map((resource) => <label key={resource.id} className="flex items-start gap-2 rounded-xl border border-white/10 p-3 text-xs text-white/65"><input type="checkbox" checked={selectedResources.includes(resource.id)} onChange={(event) => setSelectedResources((current) => event.target.checked ? [...current, resource.id].slice(-5) : current.filter((id) => id !== resource.id))}/><span>{resource.title}{resource.topic ? ` · ${resource.topic}` : ""}</span></label>)}{!resources.length && <p className="text-xs text-white/40">No course resources saved. Add notes in the Knowledge Centre.</p>}</fieldset>
        <p className="text-xs leading-5 text-white/40">Only the selected course and materials are included. Selected notes are sent to the configured model provider for this request and are not saved as a conversation.</p>
      </LiquidLensSurface>
      <div className="grid content-start gap-5"><LiquidLensSurface radius={24} className="p-5 sm:p-7"><form onSubmit={ask} className="grid gap-3"><label htmlFor="academic-question" className="text-sm text-white/70">Your question or submitted answer</label><textarea id="academic-question" value={question} onChange={(event) => setQuestion(event.target.value)} required maxLength={3000} rows={6} placeholder="Ask for an explanation, enter your attempt, or describe the type of practice you want." className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm leading-6 text-white outline-none focus:border-[#D9A441]/50"/><button disabled={busy || !courseId || !topic.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#D9A441]/35 bg-[#D9A441]/10 px-5 text-sm font-medium text-[#F2CF86] disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin"/> : <Sparkles size={16}/>} {busy ? "Working through it…" : "Ask the tutor"}</button></form>{error && <p role="alert" className="mt-4 rounded-xl border border-rose-200/15 p-3 text-sm text-rose-100">{error}</p>}</LiquidLensSurface>
        {answer && <LiquidLensSurface radius={24} className="p-5 sm:p-7"><h2 className="font-semibold">Tutor response</h2><p className="mt-1 text-xs text-white/40">AI-generated learning guidance. Verify against your lecturer’s materials and assessment instructions.</p><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/80">{answer}</div></LiquidLensSurface>}
      </div>
    </div>
  </main>;
}
