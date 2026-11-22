export type NutritionInsightMeal = {
  category: string;
  consumedAt: Date | string;
  entries: Array<{
    dataQuality: string;
    caloriesSnapshot: number | string | null;
    proteinSnapshot: number | string | null;
    carbohydrateSnapshot: number | string | null;
    fatSnapshot: number | string | null;
    fibreSnapshot: number | string | null;
  }>;
};

export type NutritionInsightHydration = { amountMl: number; recordedAt: Date | string };
export type NutritionInsightMeasurement = { measuredOn: Date | string; weightKg: number | string | null };

function localDateKey(value: Date | string, timezone: string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    const year = part("year"); const month = part("month"); const day = part("day");
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch { return null; }
}

function dateWindow(end: Date, days: number, timezone: string): string[] {
  const key = localDateKey(end, timezone);
  if (!key) return [];
  const [year, month, day] = key.split("-").map(Number);
  return Array.from({ length: days }, (_, index) => new Date(Date.UTC(year, month - 1, day - (days - index - 1))).toISOString().slice(0, 10));
}

export function buildNutritionInsights(input: {
  meals: NutritionInsightMeal[];
  hydration: NutritionInsightHydration[];
  measurements?: NutritionInsightMeasurement[];
  timezone: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const currentWeek = dateWindow(now, 7, input.timezone);
  const previousWeek = dateWindow(new Date(now.getTime() - 7 * 86_400_000), 7, input.timezone);
  const last30 = new Set(dateWindow(now, 30, input.timezone));
  const mealRows = input.meals.filter((meal) => {
    const key = localDateKey(meal.consumedAt, input.timezone);
    return key !== null && last30.has(key);
  });
  const mealCounts = new Map([...currentWeek, ...previousWeek].map((key) => [key, 0]));
  for (const meal of input.meals) {
    const key = localDateKey(meal.consumedAt, input.timezone);
    if (key && mealCounts.has(key)) mealCounts.set(key, (mealCounts.get(key) ?? 0) + 1);
  }
  const currentMeals = currentWeek.reduce((sum, key) => sum + (mealCounts.get(key) ?? 0), 0);
  const previousMeals = previousWeek.reduce((sum, key) => sum + (mealCounts.get(key) ?? 0), 0);
  const hydrationByDay = new Map(currentWeek.map((key) => [key, 0]));
  for (const item of input.hydration) {
    const key = localDateKey(item.recordedAt, input.timezone);
    if (key && hydrationByDay.has(key) && Number.isInteger(item.amountMl) && item.amountMl > 0) hydrationByDay.set(key, (hydrationByDay.get(key) ?? 0) + item.amountMl);
  }
  const hydrationDays = [...hydrationByDay.values()].filter((value) => value > 0).length;
  const hydrationTotalMl = [...hydrationByDay.values()].reduce((sum, value) => sum + value, 0);
  const nutrientKeys = ["caloriesSnapshot", "proteinSnapshot", "carbohydrateSnapshot", "fatSnapshot", "fibreSnapshot"] as const;
  const allEntries = mealRows.flatMap((meal) => meal.entries);
  const knownNutrientCells = allEntries.reduce((sum, entry) => sum + nutrientKeys.filter((key) => entry[key] !== null && Number.isFinite(Number(entry[key]))).length, 0);
  const totalNutrientCells = allEntries.length * nutrientKeys.length;
  const completenessPercent = totalNutrientCells ? Math.round((knownNutrientCells / totalNutrientCells) * 100) : null;
  const sourceCounts = allEntries.reduce<Record<string, number>>((counts, entry) => {
    const quality = ["VERIFIED_SOURCE", "ESTIMATED", "USER_ENTERED", "UNKNOWN"].includes(entry.dataQuality) ? entry.dataQuality : "UNKNOWN";
    counts[quality] = (counts[quality] ?? 0) + 1;
    return counts;
  }, {});
  const weekTrend = currentWeek.map((date) => ({ date, meals: mealCounts.get(date) ?? 0 }));
  const monthTrend = dateWindow(now, 30, input.timezone).map((date) => ({ date, meals: mealRows.filter((meal) => localDateKey(meal.consumedAt, input.timezone) === date).length }));
  const insights = [
    {
      id: "meal-logging",
      title: "Meal logging pattern",
      observation: `${currentMeals} meal${currentMeals === 1 ? "" : "s"} recorded in the last 7 days, compared with ${previousMeals} in the preceding 7 days.`,
      timeframe: "Current 7 days vs preceding 7 days",
      evidence: `${currentMeals} current-week records · ${previousMeals} previous-week records`,
      limitation: "This describes saved records only; it does not establish what was eaten or missed.",
      suggestion: currentMeals === 0 ? "If tracking is useful to you, log a meal when convenient." : null,
    },
    {
      id: "hydration-recording",
      title: "Hydration records",
      observation: `${hydrationDays} of the last 7 days contain hydration entries (${hydrationTotalMl.toLocaleString()} ml recorded).`,
      timeframe: "Last 7 days",
      evidence: `${hydrationDays}/7 days with saved entries · ${hydrationTotalMl.toLocaleString()} ml in recorded entries`,
      limitation: "Recorded intake may be incomplete. No universal hydration target is assumed.",
      suggestion: hydrationDays < 7 ? "You can add entries on days when you want a more complete record." : null,
    },
    {
      id: "data-completeness",
      title: "Nutrition data completeness",
      observation: completenessPercent === null ? "No meal-entry nutrient values are available for a completeness comparison." : `${completenessPercent}% of nutrient fields across ${allEntries.length} entries contain recorded values.`,
      timeframe: "Meals recorded in the last 30 days",
      evidence: `${knownNutrientCells}/${totalNutrientCells} nutrient cells populated · ${Object.entries(sourceCounts).map(([key, count]) => `${key.toLowerCase().replaceAll("_", " ")}: ${count}`).join(" · ") || "no entries"}`,
      limitation: "A populated value is not independently verified unless its source quality says VERIFIED_SOURCE.",
      suggestion: completenessPercent !== null && completenessPercent < 100 ? "Review source and serving details for entries where you want more complete totals." : null,
    },
  ];
  const validWeights = [...(input.measurements ?? [])].map((item) => ({ date: localDateKey(item.measuredOn, input.timezone), weight: item.weightKg == null ? null : Number(item.weightKg) })).filter((item): item is { date: string; weight: number } => item.date !== null && item.weight !== null && Number.isFinite(item.weight) && item.weight > 0).sort((a, b) => a.date.localeCompare(b.date));
  const measurementComparison = validWeights.length >= 2 ? { fromDate: validWeights[0].date, toDate: validWeights.at(-1)!.date, changeKg: Math.round((validWeights.at(-1)!.weight - validWeights[0].weight) * 100) / 100, records: validWeights.length, interpretation: "Descriptive difference between the earliest and latest saved weight records; no goal or health judgment is inferred." } : null;
  return { insights, trends: { week: weekTrend, month: monthTrend, hydrationWeek: currentWeek.map((date) => ({ date, amountMl: hydrationByDay.get(date) ?? 0 })) }, measurementComparison };
}

export type NutritionInsightsResult = ReturnType<typeof buildNutritionInsights>;
