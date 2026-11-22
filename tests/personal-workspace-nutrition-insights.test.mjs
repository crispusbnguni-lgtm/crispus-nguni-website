import test from "node:test";
import assert from "node:assert/strict";
import { buildNutritionInsights } from "../src/lib/personal-workspace-nutrition-insights.ts";

const now = new Date("2026-11-22T09:00:00.000Z");
const entry = (values = {}) => ({ dataQuality: "USER_ENTERED", caloriesSnapshot: null, proteinSnapshot: null, carbohydrateSnapshot: null, fatSnapshot: null, fibreSnapshot: null, ...values });

test("nutrition insights compare recorded meals across local weeks and preserve timezone dates", () => {
  const result = buildNutritionInsights({ timezone: "Africa/Nairobi", now, meals: [
    { category: "LUNCH", consumedAt: "2026-11-22T08:00:00Z", entries: [entry()] },
    { category: "DINNER", consumedAt: "2026-11-16T18:00:00Z", entries: [entry()] },
    { category: "BREAKFAST", consumedAt: "2026-11-10T06:00:00Z", entries: [entry()] },
  ], hydration: [] });
  assert.match(result.insights[0].observation, /2 meals recorded in the last 7 days, compared with 1/);
  assert.equal(result.trends.week.length, 7);
  assert.equal(result.trends.week.at(-1).date, "2026-11-22");
  assert.equal(result.trends.month.length, 30);
});

test("hydration insight reports observed entries without introducing a target", () => {
  const result = buildNutritionInsights({ timezone: "Africa/Nairobi", now, meals: [], hydration: [
    { amountMl: 350, recordedAt: "2026-11-22T07:00:00Z" },
    { amountMl: 500, recordedAt: "2026-11-21T07:00:00Z" },
  ] });
  assert.match(result.insights[1].observation, /2 of the last 7 days.*850 ml recorded/);
  assert.match(result.insights[1].limitation, /No universal hydration target/);
  assert.equal(result.trends.hydrationWeek.at(-1).amountMl, 350);
});

test("nutrient completeness distinguishes missing values and data quality", () => {
  const result = buildNutritionInsights({ timezone: "Africa/Nairobi", now, meals: [
    { category: "LUNCH", consumedAt: "2026-11-22T08:00:00Z", entries: [entry({ dataQuality: "VERIFIED_SOURCE", caloriesSnapshot: "100", proteinSnapshot: "5" }), entry({ dataQuality: "ESTIMATED", caloriesSnapshot: "80" })] },
  ], hydration: [] });
  assert.match(result.insights[2].observation, /30% of nutrient fields across 2 entries/);
  assert.match(result.insights[2].evidence, /verified source: 1/);
  assert.match(result.insights[2].evidence, /estimated: 1/);
  assert.match(result.insights[2].limitation, /not independently verified/);
});

test("no meal-entry values are described as missing rather than zero", () => {
  const result = buildNutritionInsights({ timezone: "Africa/Nairobi", now, meals: [], hydration: [] });
  assert.match(result.insights[2].observation, /No meal-entry nutrient values are available/);
  assert.equal(result.measurementComparison, null);
});

test("measurement comparison is descriptive and requires two valid saved records", () => {
  const result = buildNutritionInsights({ timezone: "Africa/Nairobi", now, meals: [], hydration: [], measurements: [
    { measuredOn: "2026-10-22T00:00:00Z", weightKg: "70.2" },
    { measuredOn: "2026-11-22T00:00:00Z", weightKg: "69.7" },
  ] });
  assert.equal(result.measurementComparison?.changeKg, -0.5);
  assert.match(result.measurementComparison.interpretation, /no goal or health judgment/);
});

test("invalid timezones yield no fabricated dated trend points", () => {
  const result = buildNutritionInsights({ timezone: "Mars/Olympus", now, meals: [], hydration: [] });
  assert.equal(result.trends.week.length, 0);
  assert.equal(result.insights[0].observation.includes("0 meals"), true);
});
