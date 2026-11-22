import { Activity, Droplets, Lightbulb, Utensils } from "lucide-react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import type { NutritionInsightsResult } from "@/lib/personal-workspace-nutrition-insights";

const icons = [Utensils, Droplets, Activity];

export function NutritionIntelligencePanel({ value }: { value: NutritionInsightsResult }) {
  const weekly = value.trends.week.map((point) => point.meals);
  const monthly = value.trends.month;
  const monthlyBuckets = Array.from({ length: 5 }, (_, index) => monthly.slice(index * 6, index * 6 + 6).reduce((sum, point) => sum + point.meals, 0));
  return <div className="grid gap-5">
    <LiquidLensSurface radius={24} className="overflow-hidden p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[#F2CF86]"><Lightbulb size={14}/>Nutrition intelligence</p><h2 className="mt-2 text-xl font-semibold text-white">Patterns in your saved records</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Simple, traceable summaries of records you chose to save. Observations are not medical advice or proof of what was consumed.</p></div>
        <span className="rounded-full border border-emerald-200/15 bg-emerald-200/[.04] px-3 py-1.5 text-[10px] uppercase tracking-wide text-emerald-100/75">Deterministic · no external AI</span>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {value.insights.map((insight, index) => { const Icon = icons[index] ?? Activity; return <article key={insight.id} className="rounded-2xl border border-white/[.09] bg-gradient-to-br from-white/[.07] to-white/[.015] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
          <p className="flex items-center gap-2 text-xs font-semibold text-[#F2CF86]"><Icon size={14}/>{insight.title}</p><p className="mt-3 text-sm leading-6 text-white/85">{insight.observation}</p><p className="mt-3 text-[11px] text-white/50">{insight.timeframe}</p><p className="mt-1 text-[11px] leading-5 text-white/40">Evidence: {insight.evidence}</p><p className="mt-2 border-t border-white/[.08] pt-2 text-[11px] leading-5 text-white/40">Limit: {insight.limitation}</p>{insight.suggestion && <p className="mt-2 text-xs leading-5 text-emerald-100/75">Optional next step: {insight.suggestion}</p>}
        </article>; })}
      </div>
    </LiquidLensSurface>
    <div className="grid gap-5 lg:grid-cols-2">
      <LiquidLensSurface radius={22} className="p-4 sm:p-5"><h3 className="text-sm font-semibold text-white">Meals recorded · 7 days</h3><p className="mb-3 mt-1 text-xs text-white/40">A count of saved meal records by local date.</p><MiniBars values={weekly} labels={value.trends.week.map((point) => point.date.slice(5))} label="Meals recorded by day" color="gold"/></LiquidLensSurface>
      <LiquidLensSurface radius={22} className="p-4 sm:p-5"><h3 className="text-sm font-semibold text-white">Hydration entries · 7 days</h3><p className="mb-3 mt-1 text-xs text-white/40">Recorded millilitres by day; no target is set or implied.</p><MiniBars values={value.trends.hydrationWeek.map((point) => point.amountMl)} labels={value.trends.hydrationWeek.map((point) => point.date.slice(5))} label="Hydration millilitres by day" color="aqua" unit="ml"/></LiquidLensSurface>
      <LiquidLensSurface radius={22} className="p-4 sm:p-5 lg:col-span-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-white">Meal records · 30 days</h3><p className="mt-1 text-xs text-white/40">Six-day windows ending today · counts, not dietary assessment.</p></div><div className="flex items-baseline gap-2"><span className="text-2xl font-semibold tabular-nums text-white">{monthly.reduce((sum, point) => sum + point.meals, 0)}</span><span className="text-xs text-white/40">records</span></div></div><MiniBars values={monthlyBuckets} labels={["30–25d", "24–19d", "18–13d", "12–7d", "6–today"]} label="Meal records in five six-day periods" color="green"/></LiquidLensSurface>
    </div>
    {value.measurementComparison && <LiquidLensSurface radius={22} className="p-4 sm:p-5"><p className="text-sm font-semibold text-white">Recorded weight comparison</p><p className="mt-2 text-sm text-white/70">{value.measurementComparison.changeKg > 0 ? "+" : ""}{value.measurementComparison.changeKg} kg between {value.measurementComparison.fromDate} and {value.measurementComparison.toDate} ({value.measurementComparison.records} saved measurements).</p><p className="mt-2 text-xs leading-5 text-white/40">{value.measurementComparison.interpretation}</p></LiquidLensSurface>}
  </div>;
}

function MiniBars({ values, labels, label, color, unit = "meals" }: { values: number[]; labels: string[]; label: string; color: "gold" | "aqua" | "green"; unit?: string }) {
  const max = Math.max(1, ...values);
  const fill = color === "gold" ? "from-[#F2CF86] to-[#D9A441]" : color === "aqua" ? "from-cyan-200 to-teal-400" : "from-emerald-200 to-emerald-500";
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(2.7rem,1fr))] items-end gap-2" role="img" aria-label={label}>
    {values.map((value, index) => <div key={`${labels[index]}-${index}`} className="grid min-h-28 grid-rows-[auto_1fr_auto] items-end justify-items-center gap-2" title={`${labels[index]}: ${value} ${unit}`}><span className="text-[10px] tabular-nums text-white/50">{unit === "ml" && value >= 1000 ? `${(value / 1000).toFixed(1)}L` : value}</span><span className="flex h-full w-full items-end overflow-hidden rounded-t-md bg-white/[.045]"><span className={`block w-full rounded-t-md bg-gradient-to-t ${fill} shadow-[0_0_18px_rgba(217,164,65,.13)] transition-[height] duration-500 motion-reduce:transition-none`} style={{ height: `${value ? Math.max(5, (value / max) * 68) : 2}px` }}/></span><span className="text-[9px] text-white/40">{labels[index]}</span></div>)}
  </div>;
}
