export const NUTRITION_PROFILE_KINDS = ["ADULT", "CHILD", "ADOLESCENT", "PREGNANT", "BREASTFEEDING", "OLDER_ADULT", "ATHLETE", "HEALTH_CONDITION"] as const;
export const NUTRITION_FOOD_GROUPS = ["FRUITS", "VEGETABLES", "CEREALS_WHOLE_GRAINS", "ROOTS_TUBERS", "LEGUMES_PULSES", "MEAT_POULTRY", "FISH_SEAFOOD", "EGGS", "MILK_DAIRY", "NUTS_SEEDS", "OILS_FATS", "WATER_BEVERAGES", "MIXED_MEAL", "OTHER"] as const;
export const NUTRITION_MEAL_CATEGORIES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK", "OTHER"] as const;
export const NUTRITION_DATA_QUALITIES = ["VERIFIED_SOURCE", "ESTIMATED", "USER_ENTERED", "UNKNOWN"] as const;
export const NUTRITION_ACTIVITY_LEVELS = ["LOW", "MODERATE", "HIGH", "NOT_RECORDED"] as const;
export const NUTRITION_OBJECTIVES = ["BALANCED_EATING", "WEIGHT_MAINTENANCE", "HEALTHY_WEIGHT_GAIN", "HEALTHY_WEIGHT_LOSS", "SPORTS_FUELING", "GENERAL_WELLBEING", "NOT_RECORDED"] as const;
export const NUTRITION_PLAN_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"] as const;
export const NUTRITION_GROCERY_STATUSES = ["NEEDED", "PURCHASED", "SKIPPED"] as const;

type RecordValue = Record<string, unknown>;
const plainObject = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const text = (value: unknown, max: number, required = false): value is string => typeof value === "string" && value.length <= max && (!required || value.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const list = (value: unknown, maxItems = 40, maxLength = 100): value is string[] => Array.isArray(value) && value.length <= maxItems && value.every((item) => text(item, maxLength, true));
const decimal = (value: unknown, max = 100_000) => (typeof value === "string" || typeof value === "number") && String(value).length <= 32 && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= max;
const only = (value: RecordValue, allowed: readonly string[]) => Object.keys(value).every((key) => allowed.includes(key));
export const validNutritionDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number); const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
};
export function nutritionDateTimeInTimezoneToIso(value: string, timezone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid local date and time.");
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const targetDate = new Date(0);
  targetDate.setUTCFullYear(year, month - 1, day);
  targetDate.setUTCHours(hour, minute, 0, 0);
  if (targetDate.getUTCFullYear() !== year || targetDate.getUTCMonth() !== month - 1 || targetDate.getUTCDate() !== day || hour > 23 || minute > 59) throw new Error("Invalid local date and time.");
  const targetEpoch = targetDate.getTime();
  let instant = targetEpoch;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, calendar: "iso8601", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const correction = targetEpoch - represented;
    if (correction === 0) break;
    instant += correction;
  }
  const finalParts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  if (Number(finalParts.year) !== year || Number(finalParts.month) !== month || Number(finalParts.day) !== day || Number(finalParts.hour) !== hour || Number(finalParts.minute) !== minute) throw new Error("This local time is not valid in the selected timezone.");
  return new Date(instant).toISOString();
}
const enumValue = (value: unknown, allowed: readonly string[]) => typeof value === "string" && allowed.includes(value);

export function parseNutritionProfile(input: unknown) {
  const keys = ["displayName", "kind", "birthDate", "referenceSex", "activityLevel", "objective", "pregnant", "pregnancyTrimester", "breastfeeding", "dietaryPreferences", "culturalPreferences", "allergies", "intolerances", "healthCircumstances", "notes"];
  if (!plainObject(input) || !only(input, keys) || !text(input.displayName, 100, true) || !enumValue(input.kind, NUTRITION_PROFILE_KINDS) || (input.birthDate !== null && input.birthDate !== undefined && !validNutritionDate(input.birthDate)) || !enumValue(input.referenceSex, ["FEMALE", "MALE", "NOT_RECORDED"]) || !enumValue(input.activityLevel, NUTRITION_ACTIVITY_LEVELS) || !enumValue(input.objective, NUTRITION_OBJECTIVES) || typeof input.pregnant !== "boolean" || typeof input.breastfeeding !== "boolean" || !(input.pregnancyTrimester === null || input.pregnancyTrimester === undefined || [1, 2, 3].includes(input.pregnancyTrimester as number)) || !list(input.dietaryPreferences) || !list(input.culturalPreferences) || !list(input.allergies) || !list(input.intolerances) || !list(input.healthCircumstances) || !(input.notes === null || input.notes === undefined || text(input.notes, 2000))) return { success: false as const, message: "Nutrition profile fields are invalid." };
  if (input.kind === "PREGNANT" && input.pregnant !== true) return { success: false as const, message: "Pregnancy profile details must be explicitly confirmed." };
  if (input.kind !== "PREGNANT" && input.pregnancyTrimester != null) return { success: false as const, message: "Pregnancy stage is only available on a pregnancy profile." };
  return { success: true as const, value: { ...input, displayName: input.displayName.trim() } };
}

export function parseNutritionFood(input: unknown) {
  const keys = ["name", "group", "description", "servingLabel", "imageAssetId", "calories", "proteinGrams", "carbohydrateGrams", "fatGrams", "fibreGrams", "allergens", "ingredients", "preparation", "dataQuality", "sourceName", "sourceUrl"];
  if (!plainObject(input) || !only(input, keys) || !text(input.name, 120, true) || !enumValue(input.group, NUTRITION_FOOD_GROUPS) || !(input.description == null || text(input.description, 500)) || !(input.servingLabel == null || text(input.servingLabel, 80)) || !(input.imageAssetId == null || text(input.imageAssetId, 128, true)) || !["calories", "proteinGrams", "carbohydrateGrams", "fatGrams", "fibreGrams"].every((key) => input[key] == null || decimal(input[key])) || !list(input.allergens) || !list(input.ingredients, 60, 120) || !(input.preparation == null || text(input.preparation, 2000)) || !enumValue(input.dataQuality, NUTRITION_DATA_QUALITIES) || !(input.sourceName == null || text(input.sourceName, 160)) || !(input.sourceUrl == null || (text(input.sourceUrl, 1000) && /^https:\/\//i.test(input.sourceUrl)))) return { success: false as const, message: "Food fields are invalid." };
  const hasNutritionValue = [input.calories, input.proteinGrams, input.carbohydrateGrams, input.fatGrams, input.fibreGrams].some((value) => value != null);
  if (hasNutritionValue && input.dataQuality === "VERIFIED_SOURCE" && (!input.sourceName || !input.sourceUrl)) return { success: false as const, message: "Verified nutrition values require a source name and HTTPS source URL." };
  if (input.dataQuality === "UNKNOWN" && hasNutritionValue) return { success: false as const, message: "Unknown nutrition values must remain blank." };
  return { success: true as const, value: { ...input, name: input.name.trim() } };
}

export function parseNutritionMeal(input: unknown) {
  const keys = ["profileId", "category", "title", "consumedAt", "timezone", "notes", "preparedBy", "entries"];
  if (!plainObject(input) || !only(input, keys) || !text(input.profileId, 128, true) || !enumValue(input.category, NUTRITION_MEAL_CATEGORIES) || !(input.title == null || text(input.title, 160)) || !text(input.consumedAt, 40, true) || !Number.isFinite(Date.parse(input.consumedAt)) || !text(input.timezone, 80, true) || !(input.notes == null || text(input.notes, 2000)) || !(input.preparedBy == null || text(input.preparedBy, 100)) || !Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 50) return { success: false as const, message: "Meal fields are invalid." };
  const entries: Array<{ foodId?: string; recipeId?: string; quantity: string; unit: string }> = [];
  for (const entry of input.entries) {
    const hasFood = plainObject(entry) && typeof entry.foodId === "string";
    const hasRecipe = plainObject(entry) && typeof entry.recipeId === "string";
    if (!plainObject(entry) || !only(entry, ["foodId", "recipeId", "quantity", "unit"]) || hasFood === hasRecipe || (hasFood && !text(entry.foodId, 128, true)) || (hasRecipe && !text(entry.recipeId, 128, true)) || !decimal(entry.quantity, 100_000) || Number(entry.quantity) <= 0 || !text(entry.unit, 40, true)) return { success: false as const, message: "Meal entries are invalid." };
    entries.push({ ...(hasFood ? { foodId: entry.foodId as string } : { recipeId: entry.recipeId as string }), quantity: String(entry.quantity), unit: entry.unit.trim() });
  }
  return { success: true as const, value: { ...input, entries } };
}

export function parseNutritionRecipe(input: unknown) {
  const keys = ["name", "description", "instructions", "servings", "ingredients"];
  if (!plainObject(input) || !only(input, keys) || !text(input.name, 120, true) || !(input.description == null || text(input.description, 1000)) || !(input.instructions == null || text(input.instructions, 5000)) || !(input.servings == null || (decimal(input.servings, 1000) && Number(input.servings) > 0)) || !Array.isArray(input.ingredients) || input.ingredients.length < 1 || input.ingredients.length > 100) return { success: false as const, message: "Recipe fields are invalid." };
  const ingredients: Array<{ foodId: string; quantity: string; unit: string }> = [];
  for (const ingredient of input.ingredients) {
    if (!plainObject(ingredient) || !only(ingredient, ["foodId", "quantity", "unit"]) || !text(ingredient.foodId, 128, true) || !decimal(ingredient.quantity, 100_000) || Number(ingredient.quantity) <= 0 || !text(ingredient.unit, 40, true)) return { success: false as const, message: "Recipe ingredient fields are invalid." };
    ingredients.push({ foodId: ingredient.foodId, quantity: String(ingredient.quantity), unit: ingredient.unit.trim() });
  }
  return { success: true as const, value: { ...input, name: input.name.trim(), ingredients } };
}

export function calculateRecipeEntrySnapshot(input: { servings: number | null; entryServings: number; ingredients: Array<{ quantity: number; unit: string; servingLabel: string | null; dataQuality: string; calories: number | null; proteinGrams: number | null; carbohydrateGrams: number | null; fatGrams: number | null; fibreGrams: number | null }> }) {
  const fields = ["calories", "proteinGrams", "carbohydrateGrams", "fatGrams", "fibreGrams"] as const;
  const usable = Number.isFinite(input.entryServings) && input.entryServings > 0 && Number.isFinite(input.servings) && Number(input.servings) > 0 && input.ingredients.length > 0;
  const result = Object.fromEntries(fields.map((field) => {
    const compatible = usable && input.ingredients.every((item) => item.unit.trim().toLocaleLowerCase() === (item.servingLabel ?? "").trim().toLocaleLowerCase() && Number.isFinite(item.quantity) && item.quantity > 0 && item[field] !== null && Number.isFinite(item[field]));
    if (!compatible) return [field, null];
    const value = input.ingredients.reduce((sum, item) => sum + Number(item[field]) * item.quantity, 0) / Number(input.servings) * input.entryServings;
    return [field, Number.isFinite(value) && value <= 999_999_999.999 ? Number(value.toFixed(3)) : null];
  })) as Record<(typeof fields)[number], number | null>;
  const qualities = input.ingredients.map((item) => item.dataQuality);
  const dataQuality: (typeof NUTRITION_DATA_QUALITIES)[number] = qualities.length && qualities.every((quality) => quality === "VERIFIED_SOURCE") ? "VERIFIED_SOURCE" : qualities.includes("ESTIMATED") ? "ESTIMATED" : qualities.includes("USER_ENTERED") ? "USER_ENTERED" : "UNKNOWN";
  return { ...result, dataQuality };
}

export function parseHydration(input: unknown) {
  if (!plainObject(input) || !only(input, ["profileId", "amountMl", "recordedAt"]) || !text(input.profileId, 128, true) || !Number.isInteger(input.amountMl) || Number(input.amountMl) < 1 || Number(input.amountMl) > 5000 || !text(input.recordedAt, 40, true) || !Number.isFinite(Date.parse(input.recordedAt))) return { success: false as const, message: "Hydration entry is invalid." };
  return { success: true as const, value: input };
}

export function parseBodyMeasurement(input: unknown) {
  if (!plainObject(input) || !only(input, ["profileId", "measuredOn", "weightKg", "heightCm", "waistCm", "notes"]) || !text(input.profileId, 128, true) || !validNutritionDate(input.measuredOn) || ["weightKg", "heightCm", "waistCm"].every((key) => input[key] == null) || !["weightKg", "heightCm", "waistCm"].every((key) => input[key] == null || decimal(input[key], 1000)) || (input.weightKg != null && Number(input.weightKg) <= 0) || (input.heightCm != null && Number(input.heightCm) <= 0) || (input.waistCm != null && Number(input.waistCm) <= 0) || !(input.notes == null || text(input.notes, 1000))) return { success: false as const, message: "Body measurement is invalid." };
  return { success: true as const, value: input };
}

export function parseNutritionReminder(input: unknown) {
  if (!plainObject(input) || !only(input, ["profileId", "kind", "title", "remindAt", "timezone"]) || !text(input.profileId, 128, true) || !enumValue(input.kind, ["MEAL_PREPARATION", "GROCERY_SHOPPING", "MEAL_PLANNING", "HYDRATION", "NUTRITION_REVIEW", "ANTENATAL_APPOINTMENT", "OTHER"]) || !text(input.title, 160, true) || !text(input.remindAt, 40, true) || !Number.isFinite(Date.parse(input.remindAt)) || !text(input.timezone, 80, true)) return { success: false as const, message: "Nutrition reminder is invalid." };
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }); } catch { return { success: false as const, message: "Nutrition timezone is invalid." }; }
  return { success: true as const, value: input };
}

export function parseNutritionMealPlan(input: unknown) {
  const keys = ["profileId", "title", "startsOn", "endsOn", "status", "items"];
  if (!plainObject(input) || !only(input, keys) || !text(input.profileId, 128, true) || !text(input.title, 120, true) || !validNutritionDate(input.startsOn) || !validNutritionDate(input.endsOn) || input.startsOn > input.endsOn || !enumValue(input.status, NUTRITION_PLAN_STATUSES) || !Array.isArray(input.items) || input.items.length > 100) return { success: false as const, message: "Meal plan fields are invalid." };
  const items: Array<{ category: (typeof NUTRITION_MEAL_CATEGORIES)[number]; scheduledAt: string; label: string; foodId?: string; recipeId?: string; notes?: string | null }> = [];
  for (const item of input.items) {
    if (!plainObject(item) || !only(item, ["category", "scheduledAt", "label", "foodId", "recipeId", "notes"]) || !enumValue(item.category, NUTRITION_MEAL_CATEGORIES) || !text(item.scheduledAt, 40, true) || !Number.isFinite(Date.parse(item.scheduledAt)) || item.scheduledAt.slice(0, 10) < input.startsOn || item.scheduledAt.slice(0, 10) > input.endsOn || !text(item.label, 160, true) || !(item.foodId == null || text(item.foodId, 128, true)) || !(item.recipeId == null || text(item.recipeId, 128, true)) || (item.foodId != null && item.recipeId != null) || !(item.notes == null || text(item.notes, 1000))) return { success: false as const, message: "Meal plan items are invalid." };
    items.push({ category: item.category as (typeof NUTRITION_MEAL_CATEGORIES)[number], scheduledAt: item.scheduledAt, label: item.label.trim(), ...(item.foodId ? { foodId: item.foodId } : {}), ...(item.recipeId ? { recipeId: item.recipeId } : {}), ...(item.notes != null ? { notes: item.notes } : {}) });
  }
  return { success: true as const, value: { ...input, title: input.title.trim(), items } };
}

export function parseNutritionGroceryList(input: unknown) {
  if (!plainObject(input) || !only(input, ["profileId", "title", "reusable", "items"]) || !text(input.profileId, 128, true) || !text(input.title, 120, true) || typeof input.reusable !== "boolean" || !Array.isArray(input.items) || input.items.length > 200) return { success: false as const, message: "Grocery list fields are invalid." };
  const items: Array<{ name: string; foodId?: string; category?: string | null; quantity?: string | null; unit?: string | null }> = [];
  for (const item of input.items) {
    if (!plainObject(item) || !only(item, ["name", "foodId", "category", "quantity", "unit"]) || !text(item.name, 160, true) || !(item.foodId == null || text(item.foodId, 128, true)) || !(item.category == null || text(item.category, 80)) || !(item.quantity == null || decimal(item.quantity, 100_000)) || !(item.unit == null || text(item.unit, 40))) return { success: false as const, message: "Grocery list items are invalid." };
    items.push({ name: item.name.trim(), ...(item.foodId ? { foodId: item.foodId } : {}), ...(item.category != null ? { category: item.category.trim() } : {}), ...(item.quantity != null ? { quantity: String(item.quantity) } : {}), ...(item.unit != null ? { unit: item.unit.trim() } : {}) });
  }
  return { success: true as const, value: { ...input, title: input.title.trim(), items } };
}

export function bodyMassIndex(weightKg: number, heightCm: number) {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || weightKg <= 0 || heightCm <= 0 || weightKg > 1000 || heightCm > 300) return null;
  return Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10;
}

export function adultBmiClassification(bmi: number) {
  if (!Number.isFinite(bmi) || bmi <= 0) return null;
  if (bmi < 18.5) return "UNDERWEIGHT" as const;
  if (bmi < 25) return "REFERENCE_RANGE" as const;
  if (bmi < 30) return "OVERWEIGHT" as const;
  return "OBESITY_RANGE" as const;
}

export function adultBmiScreeningLabel(bmi: number) {
  if (!Number.isFinite(bmi) || bmi <= 0) return null;
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy weight";
  if (bmi < 30) return "Overweight";
  if (bmi < 35) return "Class 1 obesity";
  if (bmi < 40) return "Class 2 obesity";
  return "Class 3 obesity";
}

export function calculateBmiReport(profile: { kind: string; pregnant: boolean; birthDate: Date | null }, measurement: { weightKg: unknown; heightCm: unknown; measuredOn: Date }) {
  if (measurement.weightKg == null || measurement.heightCm == null) return { bmi: null, classification: null, interpretation: "A complete height and weight measurement is required." };
  const bmi = bodyMassIndex(Number(measurement.weightKg), Number(measurement.heightCm));
  if (bmi === null) return { bmi: null, classification: null, interpretation: "Measurement values are outside supported limits." };
  if (profile.pregnant || profile.kind === "PREGNANT") return { bmi, classification: null, interpretation: "BMI classification is not used to assess pregnancy progress. Discuss measurements with your antenatal clinician." };
  const ageAtMeasure = profile.birthDate ? ageOnDate(profile.birthDate, measurement.measuredOn) : null;
  if (ageAtMeasure === null || ageAtMeasure < 20 || ["CHILD", "ADOLESCENT"].includes(profile.kind)) return { bmi, classification: null, interpretation: "Adult BMI categories are intended for adults aged 20 and older. BMI-for-age requires a validated growth reference and relevant age/reference data; no child or adolescent classification is calculated here." };
  const classification = adultBmiClassification(bmi);
  return { bmi, classification, interpretation: "WHO adult BMI screening categories are a screening measure, not a diagnosis or complete health assessment." };
}

function ageOnDate(birthDate: Date, at: Date) {
  let age = at.getUTCFullYear() - birthDate.getUTCFullYear();
  if (at.getUTCMonth() < birthDate.getUTCMonth() || (at.getUTCMonth() === birthDate.getUTCMonth() && at.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

export function summarizeRecordedNutrition(meals: Array<{ consumedAt: Date; entries: Array<{ caloriesSnapshot: unknown; proteinSnapshot: unknown; carbohydrateSnapshot: unknown; fatSnapshot: unknown; fibreSnapshot: unknown; dataQuality: string; labelSnapshot: string }> }>) {
  const result = { mealsLogged: meals.length, foodNames: [...new Set(meals.flatMap((meal) => meal.entries.map((entry) => entry.labelSnapshot)))], known: { calories: 0, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 0, fibreGrams: 0 }, missing: { calories: 0, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 0, fibreGrams: 0 }, valuesContainEstimates: false };
  const keys = ["calories", "proteinGrams", "carbohydrateGrams", "fatGrams", "fibreGrams"] as const;
  const dbKeys = ["caloriesSnapshot", "proteinSnapshot", "carbohydrateSnapshot", "fatSnapshot", "fibreSnapshot"] as const;
  for (const meal of meals) for (const entry of meal.entries) {
    if (entry.dataQuality === "ESTIMATED" || entry.dataQuality === "USER_ENTERED") result.valuesContainEstimates = true;
    keys.forEach((key, i) => { if (entry[dbKeys[i]] == null) result.missing[key]++; else result.known[key] += Number(entry[dbKeys[i]]); });
  }
  return { ...result, foodNames: result.foodNames.slice(0, 40) };
}
