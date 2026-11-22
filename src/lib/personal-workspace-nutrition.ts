import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateBmiReport, calculateRecipeEntrySnapshot } from "@/lib/personal-workspace-nutrition-core";
import { buildNutritionInsights } from "@/lib/personal-workspace-nutrition-insights";

type Capability = "view" | "health" | "profile" | "meals";
type Tx = Prisma.TransactionClient;
function localDateKey(date: Date, timezone: string) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
  catch { return date.toISOString().slice(0, 10); }
}

async function workspaceForActor(actorUserId: string) {
  return prisma.personalWorkspace.findFirst({
    // Shared profile members may log meals but cannot add to the owner's food library.
    where: { userId: actorUserId },
    select: { id: true, userId: true, timezone: true },
  });
}

async function accessibleProfile(actorUserId: string, profileId: string, capability: Capability = "view") {
  const grant = capability === "view" ? {} : capability === "health" ? { canViewHealth: true } : capability === "profile" ? { canManageProfile: true } : { canManageMeals: true };
  return prisma.nutritionProfile.findFirst({
    where: { id: profileId, archivedAt: null, OR: [{ workspace: { userId: actorUserId } }, { accesses: { some: { memberUserId: actorUserId, ...grant } } }] },
    include: { workspace: { select: { id: true, userId: true, timezone: true } }, accesses: { where: { memberUserId: actorUserId }, select: { role: true, canViewHealth: true, canManageProfile: true, canManageMeals: true } } },
  });
}

function event(tx: Tx, workspaceId: string, action: string, targetType: string, targetId: string, changedFields: string[]) {
  return tx.nutritionEvent.create({ data: { workspaceId, action, targetType, targetId, changedFields } });
}

function nutrientSnapshot(food: { servingLabel: string | null; calories: Prisma.Decimal | null; proteinGrams: Prisma.Decimal | null; carbohydrateGrams: Prisma.Decimal | null; fatGrams: Prisma.Decimal | null; fibreGrams: Prisma.Decimal | null; dataQuality: string }, quantity: string, unit: string) {
  const unitMatches = food.servingLabel?.trim().toLocaleLowerCase() === unit.trim().toLocaleLowerCase();
  if (!unitMatches) return { caloriesSnapshot: null, proteinSnapshot: null, carbohydrateSnapshot: null, fatSnapshot: null, fibreSnapshot: null, dataQuality: "UNKNOWN" as const };
  const amount = new Prisma.Decimal(quantity);
  const scale = (value: Prisma.Decimal | null) => value === null ? null : value.mul(amount);
  return { caloriesSnapshot: scale(food.calories), proteinSnapshot: scale(food.proteinGrams), carbohydrateSnapshot: scale(food.carbohydrateGrams), fatSnapshot: scale(food.fatGrams), fibreSnapshot: scale(food.fibreGrams), dataQuality: food.dataQuality as "VERIFIED_SOURCE" | "ESTIMATED" | "USER_ENTERED" | "UNKNOWN" };
}

export async function getNutritionDashboard(actorUserId: string, options: { profileId?: string; from?: Date; to?: Date } = {}) {
  const profiles = await prisma.nutritionProfile.findMany({ where: { archivedAt: null, OR: [{ workspace: { userId: actorUserId } }, { accesses: { some: { memberUserId: actorUserId } } }] }, include: { workspace: { select: { id: true, userId: true, timezone: true } }, accesses: { where: { memberUserId: actorUserId }, select: { role: true, canViewHealth: true, canManageProfile: true, canManageMeals: true } } }, orderBy: [{ displayName: "asc" }, { id: "asc" }], take: 100 });
  // Never silently switch a requested profile to another accessible profile.
  const profile = options.profileId ? profiles.find((item) => item.id === options.profileId) ?? null : profiles[0] ?? null;
  if (!profile) return { profiles: [], selectedProfile: null, foods: [], recipes: [], meals: [], hydration: [], measurements: [], mealPlans: [], groceryLists: [], reminders: [], history: [], summary: null, timezone: "Africa/Nairobi" };
  const isOwner = profile.workspace.userId === actorUserId;
  const grant = profile.accesses[0];
  const from = options.from ?? new Date(Date.now() - 30 * 86_400_000); const to = options.to ?? new Date(Date.now() + 90 * 86_400_000);
  const canViewMeals = isOwner || Boolean(grant?.canManageMeals);
  const [meals, hydration, measurements, mealPlans, groceryLists, reminders, foods, recipes] = await Promise.all([
    canViewMeals ? prisma.nutritionMeal.findMany({ where: { workspaceId: profile.workspaceId, profileId: profile.id, consumedAt: { gte: from, lte: to } }, orderBy: [{ consumedAt: "desc" }, { id: "asc" }], take: 200, include: { entries: { orderBy: { id: "asc" }, select: { id: true, labelSnapshot: true, quantity: true, unit: true, caloriesSnapshot: true, proteinSnapshot: true, carbohydrateSnapshot: true, fatSnapshot: true, fibreSnapshot: true, dataQuality: true, food: { select: { allergens: true, group: true } } } }, imageAsset: { select: { id: true, mimeType: true, byteSize: true } } } }) : Promise.resolve([]),
    canViewMeals ? prisma.nutritionHydrationEntry.findMany({ where: { workspaceId: profile.workspaceId, profileId: profile.id, recordedAt: { gte: from, lte: to } }, orderBy: [{ recordedAt: "desc" }, { id: "asc" }], take: 500 }) : Promise.resolve([]),
      isOwner || grant?.canViewHealth ? prisma.nutritionBodyMeasurement.findMany({ where: { workspaceId: profile.workspaceId, profileId: profile.id }, orderBy: [{ measuredOn: "desc" }, { id: "desc" }], take: 100 }) : Promise.resolve([]),
    canViewMeals ? prisma.nutritionMealPlan.findMany({ where: { workspaceId: profile.workspaceId, profileId: profile.id, status: { not: "ARCHIVED" } }, orderBy: [{ startsOn: "desc" }, { id: "asc" }], take: 50, include: { items: { where: { scheduledAt: { gte: from, lte: to } }, orderBy: [{ scheduledAt: "asc" }, { id: "asc" }] } } }) : Promise.resolve([]),
    canViewMeals ? prisma.nutritionGroceryList.findMany({ where: { workspaceId: profile.workspaceId, profileId: profile.id, archivedAt: null }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 50, include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 250 } } }) : Promise.resolve([]),
    canViewMeals ? prisma.nutritionReminder.findMany({ where: { workspaceId: profile.workspaceId, profileId: profile.id, dismissedAt: null, remindAt: { gte: new Date(Date.now() - 1 * 86_400_000), lte: new Date(Date.now() + 180 * 86_400_000) } }, orderBy: [{ remindAt: "asc" }, { id: "asc" }], take: 100 }) : Promise.resolve([]),
    canViewMeals ? prisma.nutritionFood.findMany({ where: { workspaceId: profile.workspaceId, archivedAt: null }, orderBy: [{ group: "asc" }, { name: "asc" }, { id: "asc" }], take: 600, select: { id: true, name: true, group: true, description: true, servingLabel: true, imageAssetId: true, calories: true, proteinGrams: true, carbohydrateGrams: true, fatGrams: true, fibreGrams: true, allergens: true, ingredients: true, preparation: true, dataQuality: true, sourceName: true, sourceUrl: true } }) : Promise.resolve([]),
    canViewMeals
      ? prisma.nutritionRecipe.findMany({
        where: { workspaceId: profile.workspaceId, archivedAt: null },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 200,
        include: {
          ingredients: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: {
              id: true, quantity: true, unit: true,
              food: { select: { id: true, name: true, servingLabel: true, calories: true, proteinGrams: true, carbohydrateGrams: true, fatGrams: true, fibreGrams: true, dataQuality: true } },
            },
          },
        },
      })
      : Promise.resolve([]),
  ]);
  const historyIds = [profile.id, ...meals.map((item) => item.id), ...hydration.map((item) => item.id), ...measurements.map((item) => item.id), ...mealPlans.map((item) => item.id), ...groceryLists.map((item) => item.id), ...reminders.map((item) => item.id), ...recipes.map((item) => item.id)];
  const history = canViewMeals || isOwner ? await prisma.nutritionEvent.findMany({ where: { workspaceId: profile.workspaceId, targetId: { in: historyIds } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 50, select: { id: true, action: true, targetType: true, targetId: true, changedFields: true, createdAt: true } }) : [];
  const latest = measurements[0];
  const mealEntries = meals.flatMap((meal) => meal.entries);
  const nutrientFields = { calories: "caloriesSnapshot", proteinGrams: "proteinSnapshot", carbohydrateGrams: "carbohydrateSnapshot", fatGrams: "fatSnapshot", fibreGrams: "fibreSnapshot" } as const;
  const knownNutrients = Object.fromEntries(Object.entries(nutrientFields).map(([label, field]) => {
    const recorded = mealEntries.filter((entry) => entry[field] !== null);
    return [label, recorded.length ? recorded.reduce((sum, entry) => sum + (entry[field]?.toNumber() ?? 0), 0) : null];
  }));
  const foodGroups = mealEntries.flatMap((entry) => entry.food ? [String(entry.food.group)] : []);
  const summary = {
    mealsLogged: meals.length,
    knownNutrients,
    missingNutrientEntries: mealEntries.filter((entry) => entry.caloriesSnapshot === null || entry.proteinSnapshot === null || entry.carbohydrateSnapshot === null || entry.fatSnapshot === null || entry.fibreSnapshot === null).length,
    valuesContainEstimates: mealEntries.some((entry) => entry.dataQuality !== "VERIFIED_SOURCE"),
    uniqueFoodGroups: [...new Set(foodGroups)],
    foodGroupDistribution: Object.entries(foodGroups.reduce<Record<string, number>>((counts, group) => { counts[group] = (counts[group] ?? 0) + 1; return counts; }, {})).map(([group, count]) => ({ group, count })),
    todayHydrationMl: hydration.filter((entry) => localDateKey(entry.recordedAt, profile.workspace.timezone || "Africa/Nairobi") === localDateKey(new Date(), profile.workspace.timezone || "Africa/Nairobi")).reduce((sum, item) => sum + item.amountMl, 0),
  };
  const bmi = isOwner || grant?.canViewHealth ? latest ? calculateBmiReport(profile, latest) : null : null;
  const canViewHealth = isOwner || Boolean(grant?.canViewHealth);
  const insights = buildNutritionInsights({
    meals: meals.map((meal) => ({ category: meal.category, consumedAt: meal.consumedAt, entries: meal.entries.map((entry) => ({ dataQuality: entry.dataQuality, caloriesSnapshot: entry.caloriesSnapshot?.toString() ?? null, proteinSnapshot: entry.proteinSnapshot?.toString() ?? null, carbohydrateSnapshot: entry.carbohydrateSnapshot?.toString() ?? null, fatSnapshot: entry.fatSnapshot?.toString() ?? null, fibreSnapshot: entry.fibreSnapshot?.toString() ?? null })) })),
    hydration: hydration.map((entry) => ({ amountMl: entry.amountMl, recordedAt: entry.recordedAt })),
    measurements: canViewHealth ? measurements.map((measurement) => ({ measuredOn: measurement.measuredOn, weightKg: measurement.weightKg?.toString() ?? null })) : [],
    timezone: profile.workspace.timezone || "Africa/Nairobi",
  });
  const publicProfile = { id: profile.id, displayName: profile.displayName, kind: profile.kind, ...(canViewHealth ? { birthDate: profile.birthDate, referenceSex: profile.referenceSex, activityLevel: profile.activityLevel, objective: profile.objective, pregnant: profile.pregnant, pregnancyTrimester: profile.pregnancyTrimester, breastfeeding: profile.breastfeeding, dietaryPreferences: profile.dietaryPreferences, culturalPreferences: profile.culturalPreferences, allergies: profile.allergies, intolerances: profile.intolerances, healthCircumstances: profile.healthCircumstances, notes: profile.notes } : {}), canManageProfile: isOwner || Boolean(grant?.canManageProfile), canManageMeals: isOwner || Boolean(grant?.canManageMeals), canManageFoodLibrary: isOwner, canViewHealth };
  return { profiles: profiles.map((item) => ({ id: item.id, displayName: item.displayName, kind: item.kind })), selectedProfile: { ...publicProfile, canViewMeals }, foods: canViewMeals ? foods : [], recipes, meals, hydration, measurements: isOwner || grant?.canViewHealth ? measurements.map((item) => ({ ...item, bmi: calculateBmiReport(profile, item) })) : [], latestBmi: bmi, mealPlans, groceryLists, reminders, history, summary, insights, timezone: profile.workspace.timezone };
}

export async function createNutritionProfile(ownerUserId: string, input: Record<string, unknown>) {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.personalWorkspace.upsert({ where: { userId: ownerUserId }, create: { userId: ownerUserId }, update: {}, select: { id: true } });
    const profile = await tx.nutritionProfile.create({ data: { workspaceId: workspace.id, displayName: String(input.displayName).trim(), kind: input.kind as never, birthDate: input.birthDate ? new Date(`${String(input.birthDate)}T00:00:00Z`) : null, referenceSex: input.referenceSex as never, activityLevel: input.activityLevel as never, objective: input.objective as never, pregnant: input.pregnant === true, pregnancyTrimester: input.pregnancyTrimester == null ? null : Number(input.pregnancyTrimester), breastfeeding: input.breastfeeding === true, dietaryPreferences: input.dietaryPreferences as string[], culturalPreferences: input.culturalPreferences as string[], allergies: input.allergies as string[], intolerances: input.intolerances as string[], healthCircumstances: input.healthCircumstances as string[], notes: input.notes ? String(input.notes) : null } });
    await event(tx, workspace.id, "PROFILE_CREATED", "PROFILE", profile.id, ["displayName", "kind"]); return profile;
  });
}

export async function createNutritionFood(actorUserId: string, input: Record<string, unknown>) {
  const workspace = await workspaceForActor(actorUserId); if (!workspace) throw new Error("Nutrition workspace unavailable.");
  return prisma.$transaction(async (tx) => {
    const imageAssetId = input.imageAssetId ? String(input.imageAssetId) : null;
    if (imageAssetId && !await tx.workspaceMediaAsset.findFirst({ where: { workspaceId: workspace.id, id: imageAssetId, mimeType: { startsWith: "image/" } }, select: { id: true } })) throw new Error("Nutrition image unavailable.");
    const food = await tx.nutritionFood.create({ data: { workspaceId: workspace.id, name: String(input.name).trim(), group: input.group as never, description: input.description ? String(input.description) : null, servingLabel: input.servingLabel ? String(input.servingLabel) : null, imageAssetId, calories: input.calories == null ? null : new Prisma.Decimal(String(input.calories)), proteinGrams: input.proteinGrams == null ? null : new Prisma.Decimal(String(input.proteinGrams)), carbohydrateGrams: input.carbohydrateGrams == null ? null : new Prisma.Decimal(String(input.carbohydrateGrams)), fatGrams: input.fatGrams == null ? null : new Prisma.Decimal(String(input.fatGrams)), fibreGrams: input.fibreGrams == null ? null : new Prisma.Decimal(String(input.fibreGrams)), allergens: input.allergens as string[], ingredients: input.ingredients as string[], preparation: input.preparation ? String(input.preparation) : null, dataQuality: input.dataQuality as never, sourceName: input.sourceName ? String(input.sourceName) : null, sourceUrl: input.sourceUrl ? String(input.sourceUrl) : null } });
    await event(tx, workspace.id, "FOOD_CREATED", "FOOD", food.id, ["name", "group", "dataQuality"]); return food;
  });
}

export async function createNutritionRecipe(actorUserId: string, input: { name: string; description?: string | null; instructions?: string | null; servings?: string | number | null; ingredients: Array<{ foodId: string; quantity: string; unit: string }> }) {
  const workspace = await workspaceForActor(actorUserId);
  if (!workspace) throw new Error("Nutrition workspace unavailable.");
  return prisma.$transaction(async (tx) => {
    const foodIds = [...new Set(input.ingredients.map((item) => item.foodId))];
    const foods = await tx.nutritionFood.findMany({ where: { workspaceId: workspace.id, id: { in: foodIds }, archivedAt: null }, select: { id: true } });
    if (foods.length !== foodIds.length) throw new Error("Recipe ingredient unavailable.");
    const recipe = await tx.nutritionRecipe.create({ data: { workspaceId: workspace.id, name: input.name, description: input.description ?? null, instructions: input.instructions ?? null, servings: input.servings == null ? null : new Prisma.Decimal(String(input.servings)), ingredients: { create: input.ingredients.map((item, index) => ({ workspaceId: workspace.id, foodId: item.foodId, quantity: new Prisma.Decimal(item.quantity), unit: item.unit, sortOrder: index })) } }, select: { id: true, name: true } });
    await event(tx, workspace.id, "RECIPE_CREATED", "RECIPE", recipe.id, ["name", "ingredients"]);
    return recipe;
  });
}

export async function createNutritionMeal(actorUserId: string, input: Record<string, unknown>) {
  const profile = await accessibleProfile(actorUserId, String(input.profileId), "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => {
    const entries = input.entries as Array<{ foodId?: string; recipeId?: string; quantity: string; unit: string }>;
    const ids = [...new Set(entries.flatMap((entry) => entry.foodId ? [entry.foodId] : []))];
    const recipeIds = [...new Set(entries.flatMap((entry) => entry.recipeId ? [entry.recipeId] : []))];
    const nutritionSelect = { id: true, name: true, servingLabel: true, calories: true, proteinGrams: true, carbohydrateGrams: true, fatGrams: true, fibreGrams: true, dataQuality: true, allergens: true } as const;
    const [foods, recipes] = await Promise.all([
      ids.length ? tx.nutritionFood.findMany({ where: { workspaceId: profile.workspaceId, id: { in: ids }, archivedAt: null }, select: nutritionSelect }) : Promise.resolve([]),
      recipeIds.length ? tx.nutritionRecipe.findMany({ where: { workspaceId: profile.workspaceId, id: { in: recipeIds }, archivedAt: null }, include: { ingredients: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { food: { select: nutritionSelect } } } } }) : Promise.resolve([]),
    ]);
    const foodMap = new Map(foods.map((food) => [food.id, food]));
    const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));
    if (foods.length !== ids.length || recipes.length !== recipeIds.length) throw new Error("Nutrition food or recipe unavailable.");
    const selectedFoods = [...foods, ...recipes.flatMap((recipe) => recipe.ingredients.map((item) => item.food))];
    const declaredAllergens = new Set(profile.allergies.map((value) => value.trim().toLocaleLowerCase()).filter(Boolean));
    if (selectedFoods.some((food) => food.allergens.some((allergen) => declaredAllergens.has(allergen.trim().toLocaleLowerCase())))) throw new Error("A selected food conflicts with an allergen recorded on this profile.");
    const meal = await tx.nutritionMeal.create({ data: { workspaceId: profile.workspaceId, profileId: profile.id, category: input.category as never, title: input.title ? String(input.title) : null, consumedAt: new Date(String(input.consumedAt)), timezone: String(input.timezone), notes: input.notes ? String(input.notes) : null, preparedBy: input.preparedBy ? String(input.preparedBy) : null } });
    for (const entry of entries) {
      if (entry.foodId) {
        const food = foodMap.get(entry.foodId)!; const values = nutrientSnapshot(food, entry.quantity, entry.unit);
        await tx.nutritionMealEntry.create({ data: { workspaceId: profile.workspaceId, mealId: meal.id, foodId: food.id, labelSnapshot: food.name, quantity: new Prisma.Decimal(entry.quantity), unit: entry.unit, ...values } });
        continue;
      }
      const recipe = recipeMap.get(entry.recipeId!)!;
      if (entry.unit.trim().toLocaleLowerCase() !== "serving" || !recipe.servings || recipe.servings.lte(0) || recipe.ingredients.length === 0) throw new Error("Recipe entries require a serving count and a recipe serving unit.");
      const composition = calculateRecipeEntrySnapshot({ servings: recipe.servings.toNumber(), entryServings: Number(entry.quantity), ingredients: recipe.ingredients.map((item) => ({ quantity: item.quantity.toNumber(), unit: item.unit, servingLabel: item.food.servingLabel, dataQuality: item.food.dataQuality, calories: item.food.calories?.toNumber() ?? null, proteinGrams: item.food.proteinGrams?.toNumber() ?? null, carbohydrateGrams: item.food.carbohydrateGrams?.toNumber() ?? null, fatGrams: item.food.fatGrams?.toNumber() ?? null, fibreGrams: item.food.fibreGrams?.toNumber() ?? null })) });
      const values = { caloriesSnapshot: composition.calories === null ? null : new Prisma.Decimal(composition.calories), proteinSnapshot: composition.proteinGrams === null ? null : new Prisma.Decimal(composition.proteinGrams), carbohydrateSnapshot: composition.carbohydrateGrams === null ? null : new Prisma.Decimal(composition.carbohydrateGrams), fatSnapshot: composition.fatGrams === null ? null : new Prisma.Decimal(composition.fatGrams), fibreSnapshot: composition.fibreGrams === null ? null : new Prisma.Decimal(composition.fibreGrams) };
      const dataQuality = composition.dataQuality;
      await tx.nutritionMealEntry.create({ data: { workspaceId: profile.workspaceId, mealId: meal.id, recipeId: recipe.id, labelSnapshot: recipe.name, quantity: new Prisma.Decimal(entry.quantity), unit: entry.unit, ...values, dataQuality } });
    }
    await event(tx, profile.workspaceId, "MEAL_LOGGED", "MEAL", meal.id, ["category", "consumedAt", "entries"]); return meal;
  });
}

export async function duplicateNutritionMeal(actorUserId: string, input: { profileId: string; mealId: string; consumedAt: string }) {
  const profile = await accessibleProfile(actorUserId, input.profileId, "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => {
    const original = await tx.nutritionMeal.findFirst({ where: { workspaceId: profile.workspaceId, profileId: profile.id, id: input.mealId }, include: { entries: { orderBy: { id: "asc" } } } });
    if (!original) throw new Error("Nutrition meal unavailable.");
    const copy = await tx.nutritionMeal.create({ data: { workspaceId: profile.workspaceId, profileId: profile.id, category: original.category, title: `${original.title ?? "Meal"} (copy)`.slice(0, 160), consumedAt: new Date(input.consumedAt), timezone: original.timezone, notes: original.notes, preparedBy: original.preparedBy, imageAssetId: original.imageAssetId, entries: { create: original.entries.map((entry) => ({ workspaceId: profile.workspaceId, foodId: entry.foodId, recipeId: entry.recipeId, labelSnapshot: entry.labelSnapshot, quantity: entry.quantity, unit: entry.unit, caloriesSnapshot: entry.caloriesSnapshot, proteinSnapshot: entry.proteinSnapshot, carbohydrateSnapshot: entry.carbohydrateSnapshot, fatSnapshot: entry.fatSnapshot, fibreSnapshot: entry.fibreSnapshot, dataQuality: entry.dataQuality })) } }, select: { id: true, title: true } });
    await event(tx, profile.workspaceId, "MEAL_DUPLICATED", "MEAL", copy.id, ["category", "entries"]);
    return copy;
  });
}

export async function createNutritionHydration(actorUserId: string, input: Record<string, unknown>) {
  const profile = await accessibleProfile(actorUserId, String(input.profileId), "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => { const result = await tx.nutritionHydrationEntry.create({ data: { workspaceId: profile.workspaceId, profileId: profile.id, amountMl: Number(input.amountMl), recordedAt: new Date(String(input.recordedAt)) } }); await event(tx, profile.workspaceId, "HYDRATION_LOGGED", "HYDRATION", result.id, ["amountMl", "recordedAt"]); return result; });
}

export async function updateNutritionHydration(actorUserId: string, input: { profileId: string; entryId: string; amountMl: number; recordedAt: string }) {
  const profile = await accessibleProfile(actorUserId, input.profileId, "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => { const result = await tx.nutritionHydrationEntry.updateMany({ where: { workspaceId: profile.workspaceId, profileId: profile.id, id: input.entryId }, data: { amountMl: input.amountMl, recordedAt: new Date(input.recordedAt) } }); if (result.count !== 1) throw new Error("Hydration entry unavailable."); await event(tx, profile.workspaceId, "HYDRATION_CORRECTED", "HYDRATION", input.entryId, ["amountMl", "recordedAt"]); return { updated: true }; });
}

export async function deleteNutritionHydration(actorUserId: string, profileId: string, entryId: string) {
  const profile = await accessibleProfile(actorUserId, profileId, "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => { const result = await tx.nutritionHydrationEntry.deleteMany({ where: { workspaceId: profile.workspaceId, profileId: profile.id, id: entryId } }); if (result.count !== 1) throw new Error("Hydration entry unavailable."); await event(tx, profile.workspaceId, "HYDRATION_DELETED", "HYDRATION", entryId, ["deleted"]); return { deleted: true }; });
}

export async function createNutritionMeasurement(actorUserId: string, input: Record<string, unknown>) {
  const profile = await accessibleProfile(actorUserId, String(input.profileId), "health"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => { const result = await tx.nutritionBodyMeasurement.create({ data: { workspaceId: profile.workspaceId, profileId: profile.id, measuredOn: new Date(`${String(input.measuredOn)}T00:00:00Z`), weightKg: input.weightKg == null ? null : new Prisma.Decimal(String(input.weightKg)), heightCm: input.heightCm == null ? null : new Prisma.Decimal(String(input.heightCm)), waistCm: input.waistCm == null ? null : new Prisma.Decimal(String(input.waistCm)), notes: input.notes ? String(input.notes) : null } }); await event(tx, profile.workspaceId, "MEASUREMENT_RECORDED", "MEASUREMENT", result.id, ["measuredOn", "weightKg", "heightCm", "waistCm"]); return result; });
}

export async function deleteNutritionMeasurement(actorUserId: string, profileId: string, measurementId: string) {
  const profile = await accessibleProfile(actorUserId, profileId, "profile");
  if (!profile) throw new Error("Nutrition measurement unavailable.");
  return prisma.$transaction(async (tx) => {
    const result = await tx.nutritionBodyMeasurement.deleteMany({
      where: { workspaceId: profile.workspaceId, profileId: profile.id, id: measurementId },
    });
    if (result.count !== 1) throw new Error("Nutrition measurement unavailable.");
    await event(tx, profile.workspaceId, "MEASUREMENT_DELETED", "MEASUREMENT", measurementId, ["deleted"]);
    return { deleted: true };
  });
}

export async function createNutritionReminder(actorUserId: string, input: Record<string, unknown>) {
  const profile = await accessibleProfile(actorUserId, String(input.profileId), "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => { const result = await tx.nutritionReminder.create({ data: { workspaceId: profile.workspaceId, profileId: profile.id, kind: input.kind as never, title: String(input.title).trim(), remindAt: new Date(String(input.remindAt)), timezone: String(input.timezone) } }); await event(tx, profile.workspaceId, "REMINDER_CREATED", "REMINDER", result.id, ["kind", "remindAt"]); return result; });
}

export async function createNutritionMealPlan(actorUserId: string, input: Record<string, unknown>) {
  const profile = await accessibleProfile(actorUserId, String(input.profileId), "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => {
    const foodIds = [...new Set((input.items as Array<{ foodId?: string }>).map((item) => item.foodId).filter((id): id is string => Boolean(id)))];
    const recipeIds = [...new Set((input.items as Array<{ recipeId?: string }>).map((item) => item.recipeId).filter((id): id is string => Boolean(id)))];
    if (foodIds.length) {
      const foods = await tx.nutritionFood.findMany({ where: { workspaceId: profile.workspaceId, id: { in: foodIds }, archivedAt: null }, select: { id: true } });
      if (foods.length !== foodIds.length) throw new Error("Nutrition food unavailable.");
    }
    if (recipeIds.length) { const recipes = await tx.nutritionRecipe.findMany({ where: { workspaceId: profile.workspaceId, id: { in: recipeIds }, archivedAt: null }, select: { id: true } }); if (recipes.length !== recipeIds.length) throw new Error("Nutrition recipe unavailable."); }
    const plan = await tx.nutritionMealPlan.create({ data: { workspaceId: profile.workspaceId, profileId: profile.id, title: String(input.title).trim(), startsOn: new Date(`${String(input.startsOn)}T00:00:00Z`), endsOn: new Date(`${String(input.endsOn)}T00:00:00Z`), status: input.status as never, items: { create: (input.items as Array<{ category: string; scheduledAt: string; label: string; foodId?: string; recipeId?: string; notes?: string | null }>).map((item) => ({ workspaceId: profile.workspaceId, category: item.category as never, scheduledAt: new Date(item.scheduledAt), label: item.label, ...(item.foodId ? { foodId: item.foodId } : {}), ...(item.recipeId ? { recipeId: item.recipeId } : {}), ...(item.notes ? { notes: item.notes } : {}) })) } } });
    await event(tx, profile.workspaceId, "MEAL_PLAN_CREATED", "MEAL_PLAN", plan.id, ["title", "dateRange", "items"]); return plan;
  });
}

export async function createNutritionGroceryList(actorUserId: string, input: Record<string, unknown>) {
  const profile = await accessibleProfile(actorUserId, String(input.profileId), "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => {
    const foodIds = [...new Set((input.items as Array<{ foodId?: string }>).map((item) => item.foodId).filter((id): id is string => Boolean(id)))];
    if (foodIds.length) {
      const foods = await tx.nutritionFood.findMany({ where: { workspaceId: profile.workspaceId, id: { in: foodIds }, archivedAt: null }, select: { id: true } });
      if (foods.length !== foodIds.length) throw new Error("Nutrition food unavailable.");
    }
    const list = await tx.nutritionGroceryList.create({ data: { workspaceId: profile.workspaceId, profileId: profile.id, title: String(input.title).trim(), reusable: input.reusable as boolean, items: { create: (input.items as Array<{ name: string; foodId?: string; category?: string | null; quantity?: string | null; unit?: string | null }>).map((item, index) => ({ workspaceId: profile.workspaceId, name: item.name, sortOrder: index, ...(item.foodId ? { foodId: item.foodId } : {}), ...(item.category ? { category: item.category } : {}), ...(item.quantity ? { quantity: new Prisma.Decimal(item.quantity) } : {}), ...(item.unit ? { unit: item.unit } : {}) })) } } });
    await event(tx, profile.workspaceId, "GROCERY_LIST_CREATED", "GROCERY_LIST", list.id, ["title", "items"]); return list;
  });
}

export async function createGroceryListFromMealPlan(actorUserId: string, input: { profileId: string; planId: string; title: string }) {
  const profile = await accessibleProfile(actorUserId, input.profileId, "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => {
    const plan = await tx.nutritionMealPlan.findFirst({ where: { workspaceId: profile.workspaceId, profileId: profile.id, id: input.planId, status: { not: "ARCHIVED" } }, select: { id: true, title: true, items: { select: { food: { select: { id: true, name: true } }, recipe: { select: { ingredients: { select: { food: { select: { id: true, name: true } } } } } } } } } });
    if (!plan) throw new Error("Meal plan unavailable.");
    const ingredientFoods = plan.items.flatMap((item) => item.food ? [item.food] : item.recipe?.ingredients.map((ingredient) => ingredient.food) ?? []);
    const uniqueFoods = [...new Map(ingredientFoods.map((food) => [food.id, food])).values()];
    const list = await tx.nutritionGroceryList.create({ data: { workspaceId: profile.workspaceId, profileId: profile.id, title: input.title.trim(), reusable: false, items: { create: uniqueFoods.map((food, sortOrder) => ({ workspaceId: profile.workspaceId, foodId: food.id, name: food.name, sortOrder, notes: "Ingredient quantity omitted: planned servings are not recorded." })) } } });
    await event(tx, profile.workspaceId, "GROCERY_LIST_GENERATED", "GROCERY_LIST", list.id, ["title", "items"]); return list;
  });
}

export async function updateNutritionGroceryItem(actorUserId: string, input: { profileId: string; itemId: string; status: "NEEDED" | "PURCHASED" | "SKIPPED" }) {
  const profile = await accessibleProfile(actorUserId, input.profileId, "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => {
    const result = await tx.nutritionGroceryListItem.updateMany({ where: { workspaceId: profile.workspaceId, id: input.itemId, list: { profileId: profile.id, archivedAt: null } }, data: { status: input.status } });
    if (result.count !== 1) throw new Error("Grocery item unavailable.");
    await event(tx, profile.workspaceId, "GROCERY_ITEM_UPDATED", "GROCERY_ITEM", input.itemId, ["status"]); return { updated: true };
  });
}

export async function dismissNutritionReminder(actorUserId: string, profileId: string, reminderId: string) {
  const profile = await accessibleProfile(actorUserId, profileId, "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => {
    const result = await tx.nutritionReminder.updateMany({ where: { workspaceId: profile.workspaceId, profileId: profile.id, id: reminderId, dismissedAt: null }, data: { dismissedAt: new Date() } });
    if (result.count !== 1) throw new Error("Nutrition reminder unavailable.");
    await event(tx, profile.workspaceId, "REMINDER_DISMISSED", "REMINDER", reminderId, ["dismissedAt"]); return { dismissed: true };
  });
}

export async function updateNutritionMeal(actorUserId: string, input: { profileId: string; mealId: string; title: string | null; notes: string | null; category: string; consumedAt: string }) {
  const profile = await accessibleProfile(actorUserId, input.profileId, "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.nutritionMeal.updateMany({ where: { workspaceId: profile.workspaceId, profileId: profile.id, id: input.mealId }, data: { title: input.title, notes: input.notes, category: input.category as never, consumedAt: new Date(input.consumedAt) } });
    if (updated.count !== 1) throw new Error("Nutrition meal unavailable.");
    await event(tx, profile.workspaceId, "MEAL_UPDATED", "MEAL", input.mealId, ["title", "notes", "category", "consumedAt"]); return { updated: true };
  });
}

export async function deleteNutritionMeal(actorUserId: string, profileId: string, mealId: string) {
  const profile = await accessibleProfile(actorUserId, profileId, "meals"); if (!profile) throw new Error("Nutrition profile unavailable.");
  return prisma.$transaction(async (tx) => {
    const meal = await tx.nutritionMeal.findFirst({ where: { workspaceId: profile.workspaceId, profileId: profile.id, id: mealId }, select: { id: true } }); if (!meal) throw new Error("Nutrition meal unavailable.");
    await event(tx, profile.workspaceId, "MEAL_DELETED", "MEAL", meal.id, ["deleted"]);
    await tx.nutritionMeal.delete({ where: { workspaceId_id: { workspaceId: profile.workspaceId, id: meal.id } } }); return { deleted: true };
  });
}

export async function grantNutritionProfileAccess(ownerUserId: string, input: { profileId: string; memberUserId: string; role: "VIEWER" | "CAREGIVER" | "EDITOR"; canViewHealth: boolean; canManageProfile: boolean; canManageMeals: boolean }) {
  const profile = await prisma.nutritionProfile.findFirst({ where: { id: input.profileId, archivedAt: null, workspace: { userId: ownerUserId } }, select: { id: true, workspaceId: true } }); if (!profile || input.memberUserId === ownerUserId) throw new Error("Profile access could not be granted.");
  return prisma.$transaction(async (tx) => { const result = await tx.nutritionProfileAccess.upsert({ where: { workspaceId_profileId_memberUserId: { workspaceId: profile.workspaceId, profileId: profile.id, memberUserId: input.memberUserId } }, create: { workspaceId: profile.workspaceId, profileId: profile.id, memberUserId: input.memberUserId, role: input.role, canViewHealth: input.canViewHealth, canManageProfile: input.canManageProfile, canManageMeals: input.canManageMeals }, update: { role: input.role, canViewHealth: input.canViewHealth, canManageProfile: input.canManageProfile, canManageMeals: input.canManageMeals } }); await event(tx, profile.workspaceId, "PROFILE_ACCESS_CHANGED", "PROFILE", profile.id, ["access"]); return { id: result.id, role: result.role }; });
}

export async function revokeNutritionProfileAccess(ownerUserId: string, profileId: string, memberUserId: string) {
  const profile = await prisma.nutritionProfile.findFirst({ where: { id: profileId, workspace: { userId: ownerUserId } }, select: { id: true, workspaceId: true } }); if (!profile) throw new Error("Profile access could not be revoked.");
  return prisma.$transaction(async (tx) => { const result = await tx.nutritionProfileAccess.deleteMany({ where: { workspaceId: profile.workspaceId, profileId, memberUserId } }); await event(tx, profile.workspaceId, "PROFILE_ACCESS_REVOKED", "PROFILE", profile.id, ["access"]); return result.count; });
}
