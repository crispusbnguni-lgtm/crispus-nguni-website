"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Apple, BookOpen, Check, Plus, Search, Utensils, X } from "lucide-react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { nutritionDateTimeInTimezoneToIso } from "@/lib/personal-workspace-nutrition-core";

type CatalogFood = { id: string; name: string; group: string; servingLabel: string | null; dataQuality: string; description?: string | null; ingredients?: string[] };
type CatalogRecipe = { id: string; name: string; description: string | null; servings: string | null; ingredients: Array<{ food: Pick<CatalogFood, "name" | "group"> }> };
type Entry = { key: number; itemType: "food" | "recipe"; itemId: string; quantity: string; unit: string };
const field = "min-h-11 w-full rounded-xl border border-white/10 bg-[#101716]/80 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#D9A441]/55 focus-visible:ring-2 focus-visible:ring-[#D9A441]/20";
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#D9A441]/30 bg-[#D9A441]/10 px-4 py-2 text-sm font-medium text-[#F2CF86] transition hover:bg-[#D9A441]/20 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]";

export function WorkspaceDailyFoodLog({ foods, recipes, date, timezone, onDateChange, canManage, onSave }: { foods: CatalogFood[]; recipes: CatalogRecipe[]; date: string; timezone: string; onDateChange: (value: string) => void; canManage: boolean; onSave: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("ALL");
  const [group, setGroup] = useState("ALL");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const groups = useMemo(() => [...new Set(foods.map((food) => food.group))].sort(), [foods]);
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const foodMatches = kind !== "RECIPES" ? foods.filter((food) => (group === "ALL" || food.group === group) && `${food.name} ${food.group} ${food.servingLabel ?? ""} ${food.description ?? ""} ${food.ingredients?.join(" ") ?? ""}`.toLocaleLowerCase().includes(normalized)).map((food) => ({ type: "food" as const, item: food })) : [];
    const recipeMatches = kind !== "FOODS" && group === "ALL" ? recipes.filter((recipe) => `${recipe.name} ${recipe.description ?? ""} ${recipe.ingredients.map(({ food }) => `${food.name} ${food.group}`).join(" ")}`.toLocaleLowerCase().includes(normalized)).map((recipe) => ({ type: "recipe" as const, item: recipe })) : [];
    return [...foodMatches, ...recipeMatches].slice(0, 60);
  }, [foods, group, kind, query, recipes]);
  function add(itemType: Entry["itemType"], itemId: string, unit: string) {
    setEntries((current) => current.length >= 50 ? current : [...current, { key: Date.now() + Math.random(), itemType, itemId, quantity: "1", unit }]);
    setMessage(""); setError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    if (!entries.length || !date || !values.get("time")) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = { category: values.get("category"), title: values.get("title") || null, consumedAt: nutritionDateTimeInTimezoneToIso(String(values.get("time")), timezone), timezone, notes: values.get("notes") || null, preparedBy: null, entries: entries.map(({ itemType, itemId, quantity, unit }) => ({ ...(itemType === "food" ? { foodId: itemId } : { recipeId: itemId }), quantity, unit })) };
      const saved = await onSave(payload);
      if (!saved) return;
      setEntries([]); form.reset(); setMessage("Meal added to this day’s food diary.");
    } catch { setError("Choose a valid date and time, then try again."); }
    finally { setSaving(false); }
  }
  const foodById = new Map(foods.map((food) => [food.id, food]));
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const selectedCount = entries.length;
  return <div className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
    <LiquidLensSurface radius={24} className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-[#F2CF86]"><Utensils size={15}/>Daily food diary</p><h2 className="mt-2 text-xl font-semibold text-white">Build a meal from foods and recipes</h2><p className="mt-2 max-w-xl text-sm leading-5 text-white/50">Search saved foods and mixed recipes together. Add each item, set portions and save once; repeat for other meals during the day.</p></div><span className="rounded-full border border-white/10 px-3 py-1.5 text-xs tabular-nums text-white/50">{selectedCount}/50 selected</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs text-white/55">Diary date<input className={field} type="date" value={date} onChange={(event) => onDateChange(event.target.value)}/></label><label className="grid gap-1.5 text-xs text-white/55">Catalogue type<select className={field} value={kind} onChange={(event) => setKind(event.target.value)}><option value="ALL">All foods and recipes</option><option value="FOODS">Foods</option><option value="RECIPES">Mixed recipes</option></select></label></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]"><label className="relative block"><span className="sr-only">Search foods and recipes</span><Search aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"/><input className={`${field} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ingredient or food group"/></label><label className="grid gap-1.5 text-xs text-white/55"><span className="sr-only">Filter by food group</span><select className={field} value={group} onChange={(event) => setGroup(event.target.value)}><option value="ALL">All food groups</option>{groups.map((item) => <option key={item} value={item}>{item.toLowerCase().replaceAll("_", " ")}</option>)}</select></label></div>
      <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-white/[.08]" aria-label="Food and recipe search results">{results.map(({ type, item }) => {
        if (type === "food") return <div key={`food-${item.id}`} className="flex items-center gap-3 border-b border-white/[.06] p-3 last:border-0"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100/10 bg-emerald-100/[.04] text-emerald-100/75"><Apple size={15}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white/85">{item.name}</p><p className="mt-0.5 truncate text-[10px] capitalize text-white/40">{item.group.toLowerCase().replaceAll("_", " ")} · {item.servingLabel || "serving basis not set"} · {item.dataQuality.toLowerCase().replaceAll("_", " ")}</p></div><button type="button" className="min-h-9 min-w-10 rounded-xl border border-white/10 px-3 text-xs text-white/70 hover:bg-white/[.06] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]" onClick={() => add("food", item.id, item.servingLabel ?? "serving")} disabled={!canManage || selectedCount >= 50} aria-label={`Add ${item.name}`}>Add</button></div>;
        const canLog = item.servings !== null && Number(item.servings) > 0 && item.ingredients.length > 0;
        return <div key={`recipe-${item.id}`} className="flex items-center gap-3 border-b border-white/[.06] p-3 last:border-0"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D9A441]/15 bg-[#D9A441]/[.05] text-[#F2CF86]/75"><BookOpen size={15}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white/85">{item.name}</p><p className="mt-0.5 truncate text-[10px] text-white/40">{item.ingredients.map(({ food }) => food.name).join(" · ") || "No ingredients"} · {canLog ? `${item.servings} servings per recipe` : "Add ingredients and a yield before logging"}</p></div><button type="button" className="min-h-9 min-w-10 rounded-xl border border-white/10 px-3 text-xs text-white/70 hover:bg-white/[.06] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]" onClick={() => add("recipe", item.id, "serving")} disabled={!canManage || selectedCount >= 50 || !canLog} aria-label={`Add recipe ${item.name}`}>Add</button></div>;
      })}{!results.length && <p className="p-6 text-center text-sm text-white/45">{foods.length || recipes.length ? "No saved foods or recipes match this search." : "Your catalogue is empty. Add a food or recipe in its tab first."}</p>}</div>
      <form className="mt-5 grid gap-3 border-t border-white/[.08] pt-5" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs text-white/55">Meal occasion<select className={field} name="category"><option value="BREAKFAST">Breakfast</option><option value="LUNCH">Lunch</option><option value="DINNER">Dinner</option><option value="SNACK">Snack</option><option value="OTHER">Other</option></select></label><label className="grid gap-1.5 text-xs text-white/55">Date and time · {timezone}<input key={date} className={field} type="datetime-local" name="time" defaultValue={`${date}T12:00`} required/></label></div>
        <label className="grid gap-1.5 text-xs text-white/55">Meal name <span className="text-[10px] text-white/35">Optional</span><input className={field} name="title" maxLength={160} placeholder="For example, tea and mandazi"/></label>
        {selectedCount > 0 && <div className="grid gap-2"><p className="text-xs font-medium text-white/65">Selected foods and recipes</p>{entries.map((entry) => {
          const food = entry.itemType === "food" ? foodById.get(entry.itemId) : null;
          const recipe = entry.itemType === "recipe" ? recipeById.get(entry.itemId) : null;
          const name = food?.name ?? recipe?.name;
          if (!name) return null;
          return <div key={entry.key} className="grid gap-2 rounded-xl border border-white/[.08] bg-white/[.02] p-3 sm:grid-cols-[minmax(0,1fr)_90px_minmax(110px,.8fr)_36px]"><div className="min-w-0 self-center"><p className="truncate text-sm text-white/80">{name}</p><p className="text-[10px] text-white/40">{food ? `Basis: ${food.servingLabel || "not recorded"}` : "Mixed recipe · portion in servings"}</p></div><label className="grid gap-1 text-[10px] text-white/40">Amount<input className={`${field} min-h-9 px-2`} type="number" min="0.01" max="100000" step="any" value={entry.quantity} onChange={(event) => setEntries((current) => current.map((item) => item.key === entry.key ? { ...item, quantity: event.target.value } : item))}/></label><label className="grid gap-1 text-[10px] text-white/40">Unit<input className={`${field} min-h-9 px-2`} value={entry.unit} maxLength={40} readOnly={entry.itemType === "recipe"} onChange={(event) => setEntries((current) => current.map((item) => item.key === entry.key ? { ...item, unit: event.target.value } : item))}/></label><button type="button" className="min-h-9 rounded-xl text-white/40 hover:bg-rose-200/10 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200" aria-label={`Remove ${name}`} onClick={() => setEntries((current) => current.filter((item) => item.key !== entry.key))}><X size={15} className="mx-auto"/></button></div>;
        })}</div>}
        {error && <p role="alert" className="rounded-xl border border-rose-200/15 bg-rose-200/[.04] p-3 text-xs text-rose-100/80">{error}</p>}{message && <p role="status" className="rounded-xl border border-emerald-100/10 bg-emerald-100/[.035] p-3 text-xs text-emerald-50/80">{message}</p>}
        {!canManage && <p className="text-xs text-amber-100/65">Meal logging requires permission from this profile’s owner.</p>}
        <button className={button} disabled={!canManage || saving || selectedCount === 0}><Check size={15}/>{saving ? "Saving meal…" : `Save ${selectedCount ? `${selectedCount} item${selectedCount === 1 ? "" : "s"}` : "meal"}`}</button>
      </form>
    </LiquidLensSurface>
    <LiquidLensSurface radius={24} className="p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-emerald-100/70">Day at a glance</p><h2 className="mt-2 text-xl font-semibold text-white">{date}</h2><p className="mt-1 text-xs text-white/40">Recorded meals only · values remain source-qualified</p></div><span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">{selectedCount ? `${selectedCount} unsaved items` : "Diary"}</span></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-white/[.08] p-3"><p className="text-[10px] uppercase tracking-wide text-white/40">Saved foods</p><p className="mt-1 text-xl font-semibold tabular-nums text-white">{foods.length}</p></div><div className="rounded-xl border border-white/[.08] p-3"><p className="text-[10px] uppercase tracking-wide text-white/40">Saved recipes</p><p className="mt-1 text-xl font-semibold tabular-nums text-white">{recipes.length}</p></div><div className="rounded-xl border border-white/[.08] p-3"><p className="text-[10px] uppercase tracking-wide text-white/40">Selected items</p><p className="mt-1 text-xl font-semibold tabular-nums text-white">{selectedCount}</p></div></div>
      <p className="mt-4 flex items-start gap-2 rounded-xl border border-white/[.07] bg-white/[.02] p-3 text-xs leading-5 text-white/45"><Plus size={14} className="mt-0.5 shrink-0 text-[#F2CF86]"/>Search names, ingredient lists or groups, add several catalogue items, then log the meal. Nutrients stay blank when the source, serving unit or recipe yield is incomplete.</p>
    </LiquidLensSurface>
  </div>;
}
