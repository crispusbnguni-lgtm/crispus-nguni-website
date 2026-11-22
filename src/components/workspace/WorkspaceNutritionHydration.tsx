"use client";

import { useState, type FormEvent } from "react";
import { Check, Droplets, Pencil, Plus, Trash2, X } from "lucide-react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

type Entry = { id: string; amountMl: number; recordedAt: string };
type Point = { date: string; amountMl: number };
const field = "w-full rounded-xl border border-white/10 bg-[#11191a]/80 px-3 py-2.5 text-sm text-white outline-none focus:border-[#D9A441]/60 focus-visible:ring-2 focus-visible:ring-[#D9A441]/20";
const button = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/[.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] disabled:opacity-50";

function localInputValue(value = new Date()) { return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }

export function WorkspaceNutritionHydration({ profileId, timezone, entries, trend, canManage, onChanged }: { profileId: string; timezone: string; entries: Entry[]; trend: Point[]; canManage: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState<Entry | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function send(action: string, data: Record<string, unknown>) {
    setSaving(true); setError("");
    try { const response = await fetch("/api/dashboard/workspace/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message || "Hydration record update failed."); setEditing(null); onChanged(); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Hydration record update failed."); return false; }
    finally { setSaving(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); if (await send("hydration", { profileId, amountMl: Number(values.get("amountMl")), recordedAt: new Date(String(values.get("recordedAt"))).toISOString() })) form.reset();
  }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; const values = new FormData(event.currentTarget); await send("updateHydration", { profileId, entryId: editing.id, amountMl: Number(values.get("amountMl")), recordedAt: new Date(String(values.get("recordedAt"))).toISOString() });
  }
  const maximum = Math.max(1, ...trend.map((point) => point.amountMl));
  return <LiquidLensSurface radius={24} className="overflow-hidden p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-cyan-100/80"><Droplets size={15}/>Hydration log</p><h2 className="mt-2 text-lg font-semibold text-white">Your recorded intake</h2><p className="mt-1 max-w-xl text-xs leading-5 text-white/45">Tracking only. No universal hydration target or medical recommendation is applied.</p></div><span className="rounded-full border border-cyan-100/15 bg-cyan-100/[.04] px-3 py-1.5 text-xs text-cyan-50/75">Timezone · {timezone}</span></div>
    {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200/20 bg-rose-200/[.05] p-3 text-xs text-rose-100">{error}</p>}
    <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/[.08] bg-black/[.08] p-4" onSubmit={(event) => void create(event)}><label className="grid min-w-28 flex-1 gap-1.5 text-xs text-white/55">Millilitres<input className={field} name="amountMl" type="number" min="1" max="5000" step="1" defaultValue="250" required disabled={!canManage || saving}/></label><label className="grid min-w-48 flex-[1.5] gap-1.5 text-xs text-white/55">Time<input className={field} name="recordedAt" type="datetime-local" defaultValue={localInputValue()} required disabled={!canManage || saving}/></label><button className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-100/20 bg-cyan-100/[.08] px-4 text-sm text-cyan-50 transition hover:bg-cyan-100/[.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/70 disabled:opacity-50 sm:w-auto" disabled={!canManage || saving}><Plus size={14}/>Log intake</button></form>
      <div className="rounded-2xl border border-white/[.08] bg-black/[.08] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-white/80">Last 7 days</p><p className="text-[10px] text-white/40">Recorded ml per day</p></div><div className="grid min-h-28 grid-cols-7 items-end gap-2" role="img" aria-label="Recorded hydration by day for the last seven days">{trend.map((point) => <div key={point.date} className="grid h-full grid-rows-[auto_1fr_auto] items-end justify-items-center gap-1.5" title={`${point.date}: ${point.amountMl} ml`}><span className="text-[9px] tabular-nums text-white/45">{point.amountMl ? (point.amountMl >= 1000 ? `${(point.amountMl / 1000).toFixed(1)}L` : point.amountMl) : "—"}</span><span className="flex h-full w-full items-end rounded-t bg-white/[.04]"><span className="w-full rounded-t bg-gradient-to-t from-teal-500/65 to-cyan-100/80 shadow-[0_0_15px_rgba(103,232,249,.12)]" style={{ height: `${point.amountMl ? Math.max(4, point.amountMl / maximum * 64) : 2}px` }}/></span><span className="text-[9px] text-white/40">{point.date.slice(5)}</span></div>)}</div></div>
    </div>
    <div className="mt-5 grid gap-2">{entries.slice(0, 12).map((entry) => <div key={entry.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.02] px-3 py-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-cyan-100/10 bg-cyan-100/[.04] text-cyan-100/80"><Droplets size={14}/></span><div className="min-w-0 flex-1"><p className="text-sm font-medium tabular-nums text-white/80">{entry.amountMl.toLocaleString()} ml</p><p className="text-[11px] text-white/40">{new Date(entry.recordedAt).toLocaleString()}</p></div>{canManage && <div className="flex gap-1"><button type="button" className={button} aria-label={`Correct hydration record ${entry.amountMl} ml`} onClick={() => setEditing(entry)}><Pencil size={13}/>Correct</button><button type="button" className={button} aria-label={`Delete hydration record ${entry.amountMl} ml`} onClick={() => { if (window.confirm("Delete this hydration record?")) void send("deleteHydration", { profileId, entryId: entry.id }); }}><Trash2 size={13}/>Delete</button></div>}{editing?.id === entry.id && <form onSubmit={(event) => void saveEdit(event)} className="grid w-full gap-2 rounded-xl border border-cyan-100/10 bg-black/[.12] p-3 sm:grid-cols-[1fr_1.4fr_auto_auto]"><label className="grid gap-1 text-[11px] text-white/50">Millilitres<input className={field} type="number" name="amountMl" min="1" max="5000" defaultValue={editing.amountMl} required/></label><label className="grid gap-1 text-[11px] text-white/50">Recorded time<input className={field} type="datetime-local" name="recordedAt" defaultValue={localInputValue(new Date(editing.recordedAt))} required/></label><button className={button} disabled={saving}><Check size={13}/>Save</button><button type="button" className={button} onClick={() => setEditing(null)}><X size={13}/>Cancel</button></form>}</div>)}{!entries.length && <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/45">No hydration records in this recent window.</p>}</div>
    {!canManage && <p className="mt-3 text-xs text-amber-100/60">The profile owner has not granted meal-management access.</p>}
  </LiquidLensSurface>;
}
