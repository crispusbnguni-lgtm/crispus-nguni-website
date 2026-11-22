"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleHelp, Compass, LoaderCircle, LockKeyhole, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { DEFAULT_INTELLIGENCE_PERMISSIONS, type IntelligencePermissionSet, type IntelligenceSource, type PersonalInsight } from "@/lib/personal-intelligence-core";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { WorkspaceSectionNav } from "@/components/workspace/WorkspaceSectionNav";

const sourceChoices: Array<{ id: IntelligenceSource; title: string; description: string }> = [
  { id: "TASKS", title: "Tasks", description: "Active tasks with due dates or scheduled start times." },
  { id: "PROJECTS", title: "Projects and milestones", description: "Active projects and incomplete, dated milestones." },
  { id: "ACADEMICS", title: "Academic planning", description: "Assignments, exams, study sessions and scheduled academic activities." },
  { id: "WORKSPACE_PREFERENCES", title: "Workspace preferences", description: "Your selected workspace mode, focus areas, timezone and working-hour preferences." },
  { id: "PERSONAL_MEMORY", title: "Saved personal context", description: "Only individual notes you explicitly enable; no automatic conversation or document storage." },
  { id: "CALENDAR_DIARY", title: "Workspace reminders", description: "Owner-created reminders linked to pages; this is not a complete diary or availability calendar." },
  { id: "PERSONAL_FINANCE", title: "Personal finance", description: "Owner-entered finance summaries and selected records, read only when you enable permission and select this source." },
  { id: "WORKSPACE_PAGES", title: "Workspace pages", description: "Page titles only; private block contents are not read by this source." },
  { id: "WORKSPACE_DATABASES", title: "Workspace databases", description: "Database names and record/link counts only; record values are not read." },
  { id: "NUTRITION", title: "Nutrition activity", description: "Meal and active-plan counts only; food details, allergies, measurements and health profile data are excluded." },
];

const unavailableSources = [
  ["Full diary availability", "Only saved workspace reminders are currently available; a complete personal diary source is not implemented."],
  ["Personal goals and preferences", "No persistent personal-goal model exists. Workspace preferences can be selected separately above."],
  ["Security metadata", "Password candidates and security-analyser state are excluded."],
] as const;

const sourceLabels: Record<IntelligenceSource, string> = {
  TASKS: "Tasks",
  PROJECTS: "Projects",
  ACADEMICS: "Academics",
  WORKSPACE_PREFERENCES: "Workspace preferences",
  PERSONAL_MEMORY: "Saved personal context",
  CALENDAR_DIARY: "Workspace reminders",
  PERSONAL_FINANCE: "Personal finance",
  WORKSPACE_PAGES: "Workspace pages",
  WORKSPACE_DATABASES: "Workspace databases",
  NUTRITION: "Nutrition activity",
};

const destinations: Record<string, string> = {
  "/dashboard/workspace/tasks": "Open tasks",
  "/dashboard/workspace/projects": "Open projects",
  "/dashboard/workspace/academics": "Open academic planner",
  "/dashboard/workspace/finance": "Open Finance Centre",
  "/dashboard/workspace/security": "Open Security Analyser",
  "/dashboard/workspace/nutrition": "Open Nutrition Centre",
};

export function PersonalIntelligenceCentre() {
  const [selectedSources, setSelectedSources] = useState<IntelligenceSource[]>([]);
  const [permissions, setPermissions] = useState<IntelligencePermissionSet>({ ...DEFAULT_INTELLIGENCE_PERMISSIONS });
  const [question, setQuestion] = useState("");
  const [insights, setInsights] = useState<PersonalInsight[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Record<string, "helpful" | "not-helpful">>({});
  const [busy, setBusy] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestedAt, setRequestedAt] = useState<string | null>(null);
  const [memories, setMemories] = useState<Array<{ id: string; kind: "PREFERENCE" | "GOAL" | "CONTEXT"; label: string; content: string; enabled: boolean }>>([]);
  const [memoryKind, setMemoryKind] = useState<"PREFERENCE" | "GOAL" | "CONTEXT">("CONTEXT");
  const [memoryLabel, setMemoryLabel] = useState("");
  const [memoryContent, setMemoryContent] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [memorySaving, setMemorySaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/dashboard/workspace/intelligence/preferences", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { success?: boolean; permissions?: IntelligencePermissionSet; dismissedIds?: string[]; feedback?: Record<string, "helpful" | "not-helpful"> };
        if (!response.ok || !result.success || !result.permissions) throw new Error("Saved intelligence preferences are unavailable.");
        if (!cancelled) {
          setPermissions(result.permissions);
          setDismissed(Array.isArray(result.dismissedIds) ? result.dismissedIds : []);
          setFeedback(result.feedback ?? {});
        }
      })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Saved intelligence preferences are unavailable."); })
      .finally(() => { if (!cancelled) setPreferencesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/dashboard/workspace/intelligence/memory", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { success?: boolean; memories?: Array<{ id: string; kind: "PREFERENCE" | "GOAL" | "CONTEXT"; label: string; content: string; enabled: boolean }> };
        if (!response.ok || !result.success || !Array.isArray(result.memories)) throw new Error("Private memory is temporarily unavailable.");
        if (!cancelled) setMemories(result.memories);
      })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Private memory is temporarily unavailable."); });
    return () => { cancelled = true; };
  }, []);

  async function saveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMemorySaving(true); setError("");
    try {
      const endpoint = editingMemoryId ? `/api/dashboard/workspace/intelligence/memory/${encodeURIComponent(editingMemoryId)}` : "/api/dashboard/workspace/intelligence/memory";
      const response = await fetch(endpoint, { method: editingMemoryId ? "PATCH" : "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: memoryKind, label: memoryLabel, content: memoryContent }) });
      const result = await response.json() as { success?: boolean; memory?: (typeof memories)[number]; message?: string };
      if (!response.ok || !result.success || !result.memory) throw new Error(result.message || "Private memory could not be saved.");
      setMemories((current) => editingMemoryId ? current.map((item) => item.id === result.memory!.id ? result.memory! : item) : [result.memory!, ...current]);
      setMemoryKind("CONTEXT"); setMemoryLabel(""); setMemoryContent(""); setEditingMemoryId(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Private memory could not be saved."); }
    finally { setMemorySaving(false); }
  }

  async function setMemoryEnabled(memory: (typeof memories)[number], enabled: boolean) {
    const response = await fetch(`/api/dashboard/workspace/intelligence/memory/${encodeURIComponent(memory.id)}`, { method: "PATCH", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    const result = await response.json() as { success?: boolean; memory?: (typeof memories)[number]; message?: string };
    if (!response.ok || !result.success || !result.memory) { setError(result.message || "Memory consent could not be updated."); return; }
    setMemories((current) => current.map((item) => item.id === memory.id ? result.memory! : item));
    if (!enabled) { setInsights([]); setRequestedAt(null); }
  }

  async function deleteMemory(memory: (typeof memories)[number]) {
    if (!window.confirm("Delete this saved personal context? This cannot be undone.")) return;
    const response = await fetch(`/api/dashboard/workspace/intelligence/memory/${encodeURIComponent(memory.id)}`, { method: "DELETE", cache: "no-store" });
    const result = await response.json() as { success?: boolean; message?: string };
    if (!response.ok || !result.success) { setError(result.message || "Memory could not be deleted."); return; }
    setMemories((current) => current.filter((item) => item.id !== memory.id)); setInsights([]); setRequestedAt(null);
  }

  function editMemory(memory: (typeof memories)[number]) {
    setEditingMemoryId(memory.id); setMemoryKind(memory.kind); setMemoryLabel(memory.label); setMemoryContent(memory.content);
  }

  async function savePreferences(update: Record<string, unknown>) {
    const response = await fetch("/api/dashboard/workspace/intelligence/preferences", {
      method: "PATCH", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update),
    });
    const result = await response.json() as { success?: boolean; permissions?: IntelligencePermissionSet; dismissedIds?: string[]; feedback?: Record<string, "helpful" | "not-helpful">; message?: string };
    if (!response.ok || !result.success) throw new Error(result.message || "Unable to save your preference.");
    if (result.permissions) setPermissions(result.permissions);
    if (result.dismissedIds) setDismissed(result.dismissedIds);
    if (result.feedback) setFeedback(result.feedback);
  }

  async function togglePermission(source: IntelligenceSource) {
    const next = { ...permissions, [source]: !permissions[source] };
    setPreferencesSaving(true); setError("");
    try {
      await savePreferences({ permissions: next });
      if (!next[source]) setSelectedSources((current) => current.filter((item) => item !== source));
      setInsights([]); setRequestedAt(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save your preference."); }
    finally { setPreferencesSaving(false); }
  }

  async function dismissInsight(id: string) {
    const next = [...new Set([...dismissed, id])].slice(-100);
    setDismissed(next);
    try { await savePreferences({ dismissedIds: next }); }
    catch (cause) { setDismissed(dismissed); setError(cause instanceof Error ? cause.message : "Unable to save this dismissal."); }
  }

  async function saveFeedback(id: string, value: "helpful" | "not-helpful") {
    const next = { ...feedback, [id]: value };
    setFeedback(next);
    try { await savePreferences({ feedback: next }); }
    catch (cause) { setFeedback(feedback); setError(cause instanceof Error ? cause.message : "Unable to save feedback."); }
  }

  async function resetPermissions() {
    setPreferencesSaving(true); setError("");
    try { await savePreferences({ permissions: { ...DEFAULT_INTELLIGENCE_PERMISSIONS } }); setSelectedSources([]); setInsights([]); setRequestedAt(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reset permissions."); }
    finally { setPreferencesSaving(false); }
  }

  function toggleSource(source: IntelligenceSource) {
    if (!permissions[source]) return;
    setSelectedSources((current) => current.includes(source) ? current.filter((item) => item !== source) : [...current, source]);
    setError(""); setInsights([]); setRequestedAt(null);
  }

  async function requestGuidance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/dashboard/workspace/intelligence", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: selectedSources, question: question.trim() }),
      });
      const result = await response.json() as { success?: boolean; insights?: PersonalInsight[]; message?: string };
      if (!response.ok || !result.success || !Array.isArray(result.insights)) throw new Error(result.message || "Unable to prepare guidance right now.");
      setInsights(result.insights); setRequestedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to prepare guidance right now.");
    } finally { setBusy(false); }
  }

  const visibleInsights = insights.filter((insight) => !dismissed.includes(insight.id));

  return <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-20 pt-7 text-white sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-[#D9A441]"><Sparkles size={15}/> Personal Intelligence Workspace</p><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Personal Intelligence</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">A quiet place to notice relevant dates and think through a next step. You choose what context is included, each time.</p></div><div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/15 bg-emerald-200/[.06] px-3 py-2 text-xs text-emerald-100"><LockKeyhole size={14}/>Private request · no external AI</div></header>
    <WorkspaceSectionNav active="intelligence" />
    <div className="grid gap-5 xl:grid-cols-[.82fr_1.18fr]">
      <LiquidLensSurface radius={26} className="p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#F2CF86]">Your context controls</p><h2 className="mt-2 text-xl font-semibold">Start with everything off</h2><p className="mt-2 text-sm leading-6 text-white/55">Only the sources selected here are read for this request. Selection is temporary and resets when you leave or reload. Context is derived from your authenticated workspace; no owner ID is accepted from the browser.</p><fieldset className="mt-5 grid gap-3" disabled={preferencesLoading}><legend className="mb-2 text-sm text-white/75">Available sources</legend>{sourceChoices.map((source) => <div key={source.id} className="grid gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 sm:grid-cols-[1fr_auto]"><div><label className="flex items-start gap-3"><input type="checkbox" checked={selectedSources.includes(source.id)} disabled={!permissions[source.id] || preferencesLoading || busy} onChange={() => toggleSource(source.id)} className="mt-1 accent-[#D9A441]"/><span><span className="block text-sm font-medium">Use for this request · {source.title}</span><span className="mt-1 block text-xs leading-5 text-white/50">{source.description}</span></span></label><p className="ml-6 mt-2 text-[11px] text-white/40">{permissions[source.id] ? "Permission is on; this source is read only when selected above." : "Permission is off. Enable it below before using this source."}</p></div><button type="button" disabled={preferencesLoading || preferencesSaving} onClick={() => void togglePermission(source.id)} className="min-h-10 rounded-full border border-[#D9A441]/25 px-4 text-xs font-medium text-[#F2CF86] hover:bg-[#D9A441]/10 disabled:opacity-50">{preferencesSaving ? "Saving…" : permissions[source.id] ? "Revoke permission" : "Allow this source"}</button></div>)}</fieldset><div className="mt-5 rounded-2xl border border-white/8 bg-black/10 p-4"><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-white/50">Not connected as context</h3><div className="mt-3 grid gap-3">{unavailableSources.map(([title, description]) => <div key={title} className="flex items-start gap-3 text-sm text-white/40"><input type="checkbox" disabled aria-label={`${title} unavailable`} className="mt-1 accent-[#D9A441]"/><span><span className="block text-white/55">{title}</span><span className="mt-1 block text-xs leading-5">{description}</span></span></div>)}</div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[.03] p-4"><p className="text-xs leading-5 text-white/55">{preferencesLoading ? "Loading saved permissions…" : `${Object.values(permissions).filter(Boolean).length} source permission${Object.values(permissions).filter(Boolean).length === 1 ? "" : "s"} active`}. You can revoke access at any time.</p><button type="button" disabled={preferencesLoading || preferencesSaving || Object.values(permissions).every((value) => !value)} onClick={() => void resetPermissions()} className="min-h-9 rounded-full border border-white/10 px-3 text-xs text-white/65 hover:bg-white/[.06] disabled:opacity-40">Reset all permissions</button></div><p className="mt-3 text-xs text-white/40">Date window: 30 days past through 14 days ahead. Older or later records are not considered.</p><div className="mt-4 rounded-2xl border border-white/8 bg-white/[.03] p-4 text-xs leading-5 text-white/50"><p><strong className="text-white/75">Explicitly excluded:</strong> CRM client information and revenue, consultations, portfolio valuations, personal finance records unless explicitly selected as a source, and password candidates.</p><p className="mt-2">Permission is persistent; source selection is temporary and resets when you leave or reload. Calendar observations are limited to selected dated records, not complete availability.</p></div></LiquidLensSurface>
      <div className="grid content-start gap-5"><LiquidLensSurface radius={26} className="p-5 sm:p-7"><div className="flex items-center gap-2"><Compass className="text-[#F2CF86]" size={17}/><h2 className="text-xl font-semibold">Ask for a grounded reflection</h2></div><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">This version uses transparent rules over selected records. It does not call an AI provider or pretend to understand details you have not shared.</p><form onSubmit={requestGuidance} className="mt-5 grid gap-3"><label htmlFor="intelligence-question" className="text-sm text-white/70">What would you like to think through?</label><textarea id="intelligence-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} rows={3} placeholder="For example: What should I prioritise this week?" className="resize-y rounded-2xl border border-white/10 bg-black/15 p-4 text-sm leading-6 text-white outline-none placeholder:text-white/30 focus:border-[#D9A441]/50 focus:ring-2 focus:ring-[#D9A441]/15"/><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-white/40">{question.length}/500 · never include passwords, tokens, or secrets</span><button disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D9A441]/35 bg-[#D9A441]/10 px-5 text-sm font-medium text-[#F2CF86] transition hover:bg-[#D9A441]/20 disabled:cursor-wait disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" size={16}/> : <Sparkles size={16}/>}{busy ? "Reviewing selected context…" : "Prepare guidance"}</button></div></form>{error && <p role="alert" className="mt-4 rounded-xl border border-rose-200/15 bg-rose-200/[.05] p-3 text-sm text-rose-100">{error}</p>}</LiquidLensSurface>
        <section aria-live="polite" aria-label="Personal guidance" className="grid gap-4">{visibleInsights.length ? <><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold uppercase tracking-[.14em] text-white/60">Your reflection</h2>{requestedAt && <time className="text-xs text-white/40" dateTime={requestedAt}>Requested {new Date(requestedAt).toLocaleTimeString()}</time>}</div>{visibleInsights.map((insight) => <LiquidLensSurface key={insight.id} radius={24} className="p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#F2CF86]">{insight.type.replaceAll("_", " ")}</span><h3 className="mt-3 text-lg font-semibold leading-6">{insight.observation}</h3></div><button type="button" onClick={() => void dismissInsight(insight.id)} aria-label="Dismiss this insight" className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 text-white/55 hover:bg-white/10"><X size={16}/></button></div><p className="mt-3 text-sm leading-6 text-white/60">{insight.whyItMatters}</p>{insight.evidence.length > 0 && <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4"><p className="text-xs font-medium text-white/60">Supporting records · user-entered</p><ul className="mt-2 grid gap-2">{insight.evidence.map((evidence, index) => <li key={`${evidence.source}:${evidence.title}:${index}`} className="flex flex-wrap justify-between gap-2 text-sm"><span>{evidence.title}</span><span className="text-xs text-white/40">{sourceLabels[evidence.source]} · updated {new Date(evidence.recordedAt).toLocaleDateString("en-KE", { timeZone: "UTC" })}</span></li>)}</ul></div>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-wider text-white/40">A possible next step</p><p className="mt-1 text-sm leading-5 text-white/75">{insight.suggestedAction}</p></div><div><p className="text-xs uppercase tracking-wider text-white/40">Consider</p><p className="mt-1 text-sm leading-5 text-white/60">{insight.potentialConsequence}</p></div></div><p className="mt-4 flex items-center gap-2 text-xs text-white/40"><CircleHelp size={14}/>{insight.certainty}</p>{insight.destination && <Link href={insight.destination} className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm text-[#F2CF86] hover:text-white">{destinations[insight.destination] ?? "Open source"}<ArrowRight size={15}/></Link>}<div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3"><span className="mr-1 text-xs text-white/40">Was this useful?</span>{(["helpful", "not-helpful"] as const).map((value) => <button key={value} type="button" onClick={() => void saveFeedback(insight.id, value)} aria-pressed={feedback[insight.id] === value} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs ${feedback[insight.id] === value ? "border-emerald-200/30 bg-emerald-200/10 text-emerald-100" : "border-white/10 text-white/50 hover:bg-white/[.06]"}`}>{feedback[insight.id] === value && <Check size={12}/>}{value === "helpful" ? "Helpful" : "Not useful"}</button>)}<span className="ml-auto text-[10px] text-white/35">Feedback is saved to this private workspace</span></div></LiquidLensSurface>)}</> : <LiquidLensSurface radius={24} className="grid min-h-56 place-items-center p-7 text-center"><div><div className="mx-auto grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[.04] text-[#F2CF86]"><Sparkles size={20}/></div><h2 className="mt-4 font-semibold">No guidance has been requested</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">Choose the context that feels useful, then ask when you are ready. Nothing is collected automatically.</p></div></LiquidLensSurface>}</section>
      </div>
    </div>
    <LiquidLensSurface radius={26} className="mx-auto w-full max-w-7xl p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#F2CF86]">Private memory</p><h2 className="mt-2 text-xl font-semibold">Notes you chose to save</h2></div><p className="max-w-xl text-xs leading-5 text-white/45">Memory is off for intelligence by default. Never store passwords, recovery codes, medical details or other sensitive secrets here.</p></div>
      <form onSubmit={saveMemory} className="mt-5 grid gap-3 md:grid-cols-[150px_1fr_2fr_auto]">
        <label className="grid gap-1 text-xs text-white/55">Type<select value={memoryKind} onChange={(event) => setMemoryKind(event.target.value as typeof memoryKind)} className="min-h-10 rounded-xl border border-white/10 bg-[#0b101a] px-3 text-sm text-white"><option value="CONTEXT">Context</option><option value="PREFERENCE">Preference</option><option value="GOAL">Goal</option></select></label>
        <label className="grid gap-1 text-xs text-white/55">Label<input value={memoryLabel} onChange={(event) => setMemoryLabel(event.target.value)} maxLength={80} required className="min-h-10 rounded-xl border border-white/10 bg-black/15 px-3 text-sm text-white" placeholder="e.g. Preferred planning style"/></label>
        <label className="grid gap-1 text-xs text-white/55">Your note<textarea value={memoryContent} onChange={(event) => setMemoryContent(event.target.value)} maxLength={500} required rows={2} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-white" placeholder="Write only context you want to keep."/></label>
        <button disabled={memorySaving} className="min-h-10 self-end rounded-full border border-[#D9A441]/30 px-4 text-xs font-semibold text-[#F2CF86] disabled:opacity-50">{memorySaving ? "Saving…" : editingMemoryId ? "Save changes" : "Save privately"}</button>
        {editingMemoryId && <button type="button" onClick={() => { setEditingMemoryId(null); setMemoryKind("CONTEXT"); setMemoryLabel(""); setMemoryContent(""); }} className="min-h-9 text-xs text-white/50">Cancel edit</button>}
      </form>
      <p className="mt-2 text-[11px] text-white/40">New notes are disabled for intelligence until you explicitly enable them. Private notes are never sent to an external AI provider.</p>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">{memories.map((memory) => <li key={memory.id} className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs uppercase tracking-wider text-[#F2CF86]">{memory.kind.toLowerCase()}</p><h3 className="mt-1 font-medium">{memory.label}</h3></div><span className="text-[11px] text-white/45">{memory.enabled ? "Enabled by you" : "Disabled"}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/65">{memory.content}</p><div className="mt-3 flex flex-wrap gap-2 border-t border-white/8 pt-3"><button type="button" onClick={() => setMemoryEnabled(memory, !memory.enabled)} className="min-h-9 rounded-full border border-white/10 px-3 text-xs text-white/65">{memory.enabled ? "Disable" : "Enable"} for intelligence</button><button type="button" onClick={() => editMemory(memory)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-white/10 px-3 text-xs text-white/65"><Pencil size={13}/>Edit</button><button type="button" onClick={() => void deleteMemory(memory)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-rose-200/15 px-3 text-xs text-rose-100"><Trash2 size={13}/>Delete</button></div></li>)}</ul>
      {memories.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/45">No private memory notes saved.</p>}
    </LiquidLensSurface>
    <p className="mx-auto max-w-3xl text-center text-xs leading-5 text-white/35">Guidance is informational, based on a bounded set of selected records, and may miss context. It is not professional medical, legal, therapeutic or financial advice. You remain in control of every decision.</p>
  </main>;
}
