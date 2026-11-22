"use client";

import { useState, type FormEvent } from "react";
import { BookOpen, Plus, Utensils } from "lucide-react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";

type Food = { id: string; name: string; group: string; servingLabel: string | null; dataQuality: string };
type Recipe = { id: string; name: string; description: string | null; instructions: string | null; servings: string | null; ingredients: Array<{ id: string; quantity: string; unit: string; food: Food }> };
type DraftRow = { key: number; foodId: string; quantity: string; unit: string };
const input = "w-full rounded-xl border border-white/10 bg-[#11191a]/80 px-3 py-2.5 text-sm text-white outline-none focus:border-[#D9A441]/60 focus-visible:ring-2 focus-visible:ring-[#D9A441]/20";
const action = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#D9A441]/30 bg-[#D9A441]/12 px-4 py-2 text-sm font-medium text-[#F2CF86] transition hover:bg-[#D9A441]/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]";

export function WorkspaceNutritionRecipes({ foods, recipes, canManage, onCreated }: { foods: Food[]; recipes: Recipe[]; canManage: boolean; onCreated: () => void }) {
  const [rows, setRows] = useState<DraftRow[]>([{ key: 1, foodId: foods[0]?.id ?? "", quantity: "1", unit: foods[0]?.servingLabel ?? "serving" }]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const ingredients = rows.map((row) => ({ foodId: row.foodId, quantity: row.quantity, unit: row.unit }));
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/dashboard/workspace/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recipe", data: { name: data.get("name"), description: data.get("description") || null, instructions: data.get("instructions") || null, servings: data.get("servings") || null, ingredients } }) });
      const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message || "Recipe could not be saved.");
      form.reset(); setRows([{ key: Date.now(), foodId: foods[0]?.id ?? "", quantity: "1", unit: foods[0]?.servingLabel ?? "serving" }]); setMessage("Recipe saved for reuse. Its ingredient sources and serving bases remain attached."); onCreated();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Recipe could not be saved."); }
    finally { setSaving(false); }
  }
  return <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
    <LiquidLensSurface radius={24} className="p-5 sm:p-6">
      <div className="mb-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-[#F2CF86]"><BookOpen size={15}/>Reusable recipes</p><h2 className="mt-2 text-lg font-semibold text-white">Compose from your food records</h2><p className="mt-2 text-sm leading-5 text-white/50">Recipe values are derived only when each ingredient unit matches its food serving basis and a serving count is recorded. Otherwise the resulting nutrient value stays unknown.</p></div>
      {!canManage && <p className="mb-3 rounded-xl border border-amber-200/15 bg-amber-200/[.04] p-3 text-xs text-amber-100/70">Recipe creation requires workspace ownership. This profile has read-only meal access.</p>}
      {error && <p role="alert" className="mb-3 rounded-xl border border-rose-200/20 bg-rose-200/[.05] p-3 text-sm text-rose-100">{error}</p>}{message && <p role="status" className="mb-3 rounded-xl border border-emerald-200/15 bg-emerald-200/[.04] p-3 text-xs text-emerald-100/80">{message}</p>}
      <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-1.5 text-xs text-white/60">Recipe name<input className={input} name="name" maxLength={120} required disabled={!canManage}/></label>
        <label className="grid gap-1.5 text-xs text-white/60">Description<input className={input} name="description" maxLength={1000} disabled={!canManage}/></label>
        <label className="grid gap-1.5 text-xs text-white/60">Instructions<textarea className={`${input} min-h-20`} name="instructions" maxLength={5000} disabled={!canManage}/></label>
        <label className="grid gap-1.5 text-xs text-white/60">Yield (number of servings)<input className={input} name="servings" type="number" min="0.01" max="1000" step="any" placeholder="Leave blank if not known" disabled={!canManage}/></label>
        <div className="grid gap-2"><p className="text-xs font-medium text-white/65">Ingredients</p>{rows.map((row, index) => <div key={row.key} className="grid gap-2 rounded-xl border border-white/[.08] bg-black/[.08] p-3 sm:grid-cols-[1.2fr_.65fr_.8fr]">
          <label className="grid gap-1 text-[11px] text-white/50">Food<select className={input} value={row.foodId} required disabled={!canManage || foods.length === 0} onChange={(event) => setRows((current) => current.map((item) => item.key === row.key ? { ...item, foodId: event.target.value } : item))}><option value="">Choose saved food</option>{foods.map((food) => <option key={food.id} value={food.id}>{food.name} · {food.group.toLowerCase().replaceAll("_", " ")}</option>)}</select></label>
          <label className="grid gap-1 text-[11px] text-white/50">Amount<input className={input} type="number" min="0.001" max="100000" step="any" value={row.quantity} required disabled={!canManage} onChange={(event) => setRows((current) => current.map((item) => item.key === row.key ? { ...item, quantity: event.target.value } : item))}/></label>
          <label className="grid gap-1 text-[11px] text-white/50">Unit<input className={input} value={row.unit} maxLength={40} required disabled={!canManage} placeholder="Match food serving basis" onChange={(event) => setRows((current) => current.map((item) => item.key === row.key ? { ...item, unit: event.target.value } : item))}/></label>
          {rows.length > 1 && <button type="button" className="min-h-8 justify-self-start text-xs text-white/45 underline sm:col-span-3" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>Remove ingredient {index + 1}</button>}
        </div>)}</div>
        <div className="flex flex-wrap gap-2"><button type="button" className="min-h-9 rounded-xl border border-white/10 px-3 text-xs text-white/70 hover:bg-white/[.06]" disabled={!canManage || rows.length >= 100 || foods.length === 0} onClick={() => setRows((current) => [...current, { key: Date.now(), foodId: foods[0]?.id ?? "", quantity: "1", unit: foods[0]?.servingLabel ?? "serving" }])}><Plus size={13} className="mr-1 inline"/>Add ingredient</button><button className={action} disabled={!canManage || saving || foods.length === 0}><Utensils size={14}/>{saving ? "Saving…" : "Save recipe"}</button></div>
      </form>
      {!foods.length && <p className="mt-3 text-xs leading-5 text-white/45">Save food records first. No sample food data is inserted automatically.</p>}
    </LiquidLensSurface>
    <LiquidLensSurface radius={24} className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">Saved recipes</h2><p className="mt-1 text-xs text-white/45">Recipes are reusable compositions, not independent nutrient sources.</p></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs tabular-nums text-white/55">{recipes.length}</span></div><div className="mt-4 grid gap-3">{recipes.map((recipe) => <article key={recipe.id} className="rounded-2xl border border-white/[.09] bg-gradient-to-br from-white/[.05] to-transparent p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-medium text-white">{recipe.name}</h3>{recipe.description && <p className="mt-1 text-xs text-white/45">{recipe.description}</p>}</div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/45">{recipe.servings ? `${recipe.servings} servings` : "Yield unknown"}</span></div><ul className="mt-3 grid gap-1 border-t border-white/[.07] pt-3 sm:grid-cols-2">{recipe.ingredients.map((ingredient) => <li key={ingredient.id} className="text-xs text-white/60">{ingredient.quantity} {ingredient.unit} · {ingredient.food.name}<span className="ml-1 text-[10px] text-white/35">({ingredient.food.dataQuality.toLowerCase().replaceAll("_", " ")})</span></li>)}</ul>{recipe.instructions && <details className="mt-3 text-xs text-white/50"><summary className="min-h-8 cursor-pointer py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]">Preparation</summary><p className="whitespace-pre-wrap leading-5">{recipe.instructions}</p></details>}</article>)}{!recipes.length && <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">No recipes yet. Compose one from foods you have already sourced or entered.</p>}</div></LiquidLensSurface>
  </div>;
}
