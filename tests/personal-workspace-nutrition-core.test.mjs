import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { adultBmiClassification, adultBmiScreeningLabel, bodyMassIndex, calculateBmiReport, calculateRecipeEntrySnapshot, nutritionDateTimeInTimezoneToIso, parseBodyMeasurement, parseHydration, parseNutritionFood, parseNutritionGroceryList, parseNutritionMeal, parseNutritionMealPlan, parseNutritionProfile, parseNutritionRecipe, parseNutritionReminder, validNutritionDate } from "../src/lib/personal-workspace-nutrition-core.ts";
import { calendarEventCategory, calendarEventHref, filterCalendarEvents, DEFAULT_WORKSPACE_CALENDAR_FILTERS } from "../src/lib/personal-workspace-calendar-core.ts";
import { DEFAULT_INTELLIGENCE_PERMISSIONS, normalizeIntelligencePermissions, normalizePersonalContext } from "../src/lib/personal-intelligence-core.ts";

test("nutrition profile validation keeps family health fields explicit and bounded", () => {
  const profile = { displayName: "  Amara ", kind: "ADULT", birthDate: "1990-03-20", referenceSex: "NOT_RECORDED", activityLevel: "NOT_RECORDED", objective: "NOT_RECORDED", pregnant: false, pregnancyTrimester: null, breastfeeding: false, dietaryPreferences: [], culturalPreferences: ["Kenyan"], allergies: ["Peanut"], intolerances: [], healthCircumstances: [], notes: null };
  const parsed = parseNutritionProfile(profile);
  assert.equal(parsed.success, true);
  assert.equal(parsed.value.displayName, "Amara");
  assert.equal(parseNutritionProfile({ ...profile, kind: "PREGNANT", pregnant: false }).success, false);
  assert.equal(parseNutritionProfile({ ...profile, pregnancyTrimester: 2 }).success, false);
});

test("nutrition date validation rejects impossible dates and accepts leap days", () => {
  assert.equal(validNutritionDate("2024-02-29"), true);
  assert.equal(validNutritionDate("2025-02-29"), false);
  assert.equal(validNutritionDate("2025-13-01"), false);
});

test("daily diary converts local entries in the profile timezone and rejects invalid calendar times", () => {
  assert.equal(nutritionDateTimeInTimezoneToIso("2026-11-22T08:30", "Africa/Nairobi"), "2026-11-22T05:30:00.000Z");
  assert.throws(() => nutritionDateTimeInTimezoneToIso("2026-02-31T12:00", "Africa/Nairobi"));
  assert.throws(() => nutritionDateTimeInTimezoneToIso("2026-03-08T02:30", "America/New_York"));
  assert.throws(() => nutritionDateTimeInTimezoneToIso("2026-11-22T08:30", "Mars/Olympus"));
});

test("food values require honest data quality and cited sources for verified values", () => {
  const base = { name: "Githeri", group: "MIXED_MEAL", allergens: [], ingredients: ["maize", "beans"], dataQuality: "UNKNOWN" };
  assert.equal(parseNutritionFood(base).success, true);
  assert.equal(parseNutritionFood({ ...base, calories: 120 }).success, false);
  assert.equal(parseNutritionFood({ ...base, calories: 120, dataQuality: "VERIFIED_SOURCE" }).success, false);
  assert.equal(parseNutritionFood({ ...base, calories: 120, dataQuality: "VERIFIED_SOURCE", sourceName: "Reference", sourceUrl: "https://example.test/food" }).success, true);
  assert.equal(parseNutritionFood({ ...base, imageAssetId: { id: "spoof" } }).success, false);
});

test("meal records require bounded food entries and reject duplicate unsafe structure", () => {
  const meal = { profileId: "profile-1", category: "LUNCH", consumedAt: "2026-11-22T10:00:00.000Z", timezone: "Africa/Nairobi", entries: [{ foodId: "food-1", quantity: "1.5", unit: "cup" }] };
  assert.equal(parseNutritionMeal(meal).success, true);
  assert.equal(parseNutritionMeal({ ...meal, entries: [] }).success, false);
  assert.equal(parseNutritionMeal({ ...meal, surprise: "ignored" }).success, false);
  assert.equal(parseNutritionMeal({ ...meal, entries: [{ foodId: "food-1", quantity: 0, unit: "cup" }] }).success, false);
  assert.equal(parseNutritionMeal({ ...meal, entries: [{ recipeId: "recipe-1", quantity: "2", unit: "serving" }] }).success, true);
  assert.equal(parseNutritionMeal({ ...meal, entries: [{ foodId: "food-1", recipeId: "recipe-1", quantity: "1", unit: "serving" }] }).success, false);
});

test("recipe parser requires explicit, valid food composition and serving data", () => {
  const base = { name: "Family stew", description: null, instructions: "Simmer", servings: "4", ingredients: [{ foodId: "food-a", quantity: "2", unit: "cup" }] };
  assert.equal(parseNutritionRecipe(base).success, true);
  assert.equal(parseNutritionRecipe({ ...base, ingredients: [] }).success, false);
  assert.equal(parseNutritionRecipe({ ...base, servings: "0" }).success, false);
  assert.equal(parseNutritionRecipe({ ...base, unknown: true }).success, false);
});

test("recipe snapshots calculate only across matching serving bases and known source values", () => {
  const result = calculateRecipeEntrySnapshot({ servings: 2, entryServings: 1, ingredients: [
    { quantity: 2, unit: "cup", servingLabel: "cup", dataQuality: "VERIFIED_SOURCE", calories: 100, proteinGrams: 4, carbohydrateGrams: 20, fatGrams: 2, fibreGrams: 3 },
    { quantity: 1, unit: "piece", servingLabel: "piece", dataQuality: "VERIFIED_SOURCE", calories: 80, proteinGrams: 2, carbohydrateGrams: 10, fatGrams: 1, fibreGrams: 1 },
  ] });
  assert.equal(result.calories, 140);
  assert.equal(result.proteinGrams, 5);
  assert.equal(result.dataQuality, "VERIFIED_SOURCE");
  const incompatible = calculateRecipeEntrySnapshot({ servings: 2, entryServings: 1, ingredients: [{ quantity: 2, unit: "g", servingLabel: "cup", dataQuality: "VERIFIED_SOURCE", calories: 100, proteinGrams: null, carbohydrateGrams: 20, fatGrams: 2, fibreGrams: 3 }] });
  assert.equal(incompatible.calories, null);
  assert.equal(incompatible.proteinGrams, null);
  assert.equal(incompatible.dataQuality, "VERIFIED_SOURCE");
});

test("measurement and hydration validation reject impossible and out-of-range values", () => {
  assert.equal(parseBodyMeasurement({ profileId: "p1", measuredOn: "2026-11-22", weightKg: "72", heightCm: "168", waistCm: null }).success, true);
  assert.equal(parseBodyMeasurement({ profileId: "p1", measuredOn: "2026-11-22", weightKg: "0", heightCm: null, waistCm: null }).success, false);
  assert.equal(parseHydration({ profileId: "p1", amountMl: 250, recordedAt: "2026-11-22T10:00:00Z" }).success, true);
  assert.equal(parseHydration({ profileId: "p1", amountMl: 6000, recordedAt: "2026-11-22T10:00:00Z" }).success, false);
});

test("meal plan dates, items and reminder timezone are validated", () => {
  assert.equal(parseNutritionMealPlan({ profileId: "p1", title: "Week", startsOn: "2026-11-22", endsOn: "2026-11-23", status: "ACTIVE", items: [{ category: "DINNER", scheduledAt: "2026-11-22T18:00:00Z", label: "Family meal" }] }).success, true);
  assert.equal(parseNutritionMealPlan({ profileId: "p1", title: "Week", startsOn: "2026-11-23", endsOn: "2026-11-22", status: "ACTIVE", items: [] }).success, false);
  assert.equal(parseNutritionReminder({ profileId: "p1", kind: "HYDRATION", title: "Water", remindAt: "2026-11-22T18:00:00Z", timezone: "Africa/Nairobi" }).success, true);
  assert.equal(parseNutritionReminder({ profileId: "p1", kind: "HYDRATION", title: "Water", remindAt: "2026-11-22T18:00:00Z", timezone: "Mars/Olympus" }).success, false);
});

test("grocery lists accept bounded manual items and reject malformed quantities", () => {
  assert.equal(parseNutritionGroceryList({ profileId: "p1", title: "Market", reusable: false, items: [{ name: "Beans", quantity: "2", unit: "kg" }] }).success, true);
  assert.equal(parseNutritionGroceryList({ profileId: "p1", title: "Market", reusable: false, items: [{ name: "Beans", quantity: "-2" }] }).success, false);
});

test("BMI classification is limited to eligible adults and not used for child or pregnancy assessment", () => {
  assert.equal(bodyMassIndex(70, 175), 22.9);
  assert.equal(bodyMassIndex(-1, 175), null);
  assert.equal(adultBmiClassification(24.9), "REFERENCE_RANGE");
  assert.equal(adultBmiScreeningLabel(18.4), "Underweight");
  assert.equal(adultBmiScreeningLabel(18.5), "Healthy weight");
  assert.equal(adultBmiScreeningLabel(25), "Overweight");
  assert.equal(adultBmiScreeningLabel(30), "Class 1 obesity");
  assert.equal(adultBmiScreeningLabel(35), "Class 2 obesity");
  assert.equal(adultBmiScreeningLabel(40), "Class 3 obesity");
  assert.equal(adultBmiScreeningLabel(0), null);
  const measure = { weightKg: 70, heightCm: 175, measuredOn: new Date("2026-01-01T00:00:00Z") };
  assert.equal(calculateBmiReport({ kind: "ADULT", pregnant: false, birthDate: new Date("1990-01-01T00:00:00Z") }, measure).classification, "REFERENCE_RANGE");
  assert.equal(calculateBmiReport({ kind: "ADULT", pregnant: false, birthDate: new Date("2007-01-01T00:00:00Z") }, measure).classification, null);
  assert.equal(calculateBmiReport({ kind: "CHILD", pregnant: false, birthDate: new Date("2018-01-01T00:00:00Z") }, measure).classification, null);
  assert.equal(calculateBmiReport({ kind: "PREGNANT", pregnant: true, birthDate: new Date("1990-01-01T00:00:00Z") }, measure).classification, null);
});

test("nutrition calendar events retain a read-only route to the Nutrition Centre", () => {
  const event = { sourceType: "WORKSPACE_NUTRITION_MEAL_PLAN", sourceId: "item-1", title: "Planned meal", startAt: "2026-11-22T18:00:00Z" };
  assert.equal(calendarEventCategory(event), "nutrition");
  assert.equal(calendarEventHref(event), "/dashboard/workspace/nutrition");
  assert.equal(DEFAULT_WORKSPACE_CALENDAR_FILTERS.nutrition, true);
  assert.equal(filterCalendarEvents([event], { ...DEFAULT_WORKSPACE_CALENDAR_FILTERS, nutrition: false }).length, 0);
});

test("nutrition route and navigation enforce server auth and same-origin mutations", async () => {
  const route = await readFile(new URL("../src/app/api/dashboard/workspace/nutrition/route.ts", import.meta.url), "utf8");
  const nav = await readFile(new URL("../src/components/workspace/WorkspaceSectionNav.tsx", import.meta.url), "utf8");
  assert.match(route, /requireApiUser\(\)/);
  assert.match(route, /requireSameOriginApiRequest\(request\)/);
  assert.match(route, /auth\.user\.id/);
  assert.match(nav, /dashboard\/workspace\/nutrition/);
});

test("nutrition Intelligence is off by default and only emits count-only explicitly selected context", () => {
  assert.equal(DEFAULT_INTELLIGENCE_PERMISSIONS.NUTRITION, false);
  const permissions = normalizeIntelligencePermissions({ ...DEFAULT_INTELLIGENCE_PERMISSIONS, NUTRITION: true });
  assert.equal(permissions.NUTRITION, true);
  const summary = { mealCount: 3, planCount: 1, updatedAt: new Date("2026-11-22T10:00:00Z") };
  assert.equal(normalizePersonalContext({ selectedSources: [], nutritionSummary: summary }).length, 0);
  const records = normalizePersonalContext({ selectedSources: ["NUTRITION"], nutritionSummary: summary });
  assert.equal(records.length, 1);
  assert.match(records[0].title, /3 meals and 1 active plans/);
  assert.doesNotMatch(records[0].title, /allerg|weight|calorie/i);
});
