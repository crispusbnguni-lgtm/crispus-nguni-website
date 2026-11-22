import { NextResponse } from "next/server";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";
import { createGroceryListFromMealPlan, createNutritionFood, createNutritionGroceryList, createNutritionHydration, createNutritionMeal, createNutritionMealPlan, createNutritionMeasurement, createNutritionProfile, createNutritionRecipe, createNutritionReminder, deleteNutritionHydration, deleteNutritionMeal, deleteNutritionMeasurement, dismissNutritionReminder, duplicateNutritionMeal, getNutritionDashboard, updateNutritionGroceryItem, updateNutritionHydration, updateNutritionMeal } from "@/lib/personal-workspace-nutrition";
import { NUTRITION_MEAL_CATEGORIES, parseBodyMeasurement, parseHydration, parseNutritionFood, parseNutritionGroceryList, parseNutritionMeal, parseNutritionMealPlan, parseNutritionProfile, parseNutritionRecipe, parseNutritionReminder } from "@/lib/personal-workspace-nutrition-core";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const MAX_BODY_BYTES = 32_000;
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: NO_STORE }); }
async function readBody(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > MAX_BODY_BYTES) throw new Error("too-large");
  const reader = request.body?.getReader(); if (!reader) return null;
  const chunks: Uint8Array[] = []; let length = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("too-large"); } chunks.push(value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }

export async function GET(request: Request) {
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => key !== "profileId") || params.getAll("profileId").length > 1) return json({ success: false, message: "Unsupported or repeated nutrition query parameter." }, 400);
  try {
    const data = await getNutritionDashboard(auth.user.id, { profileId: params.get("profileId") ?? undefined });
    if (params.has("profileId") && !data.selectedProfile) return json({ success: false, message: "Nutrition profile was not found." }, 404);
    return json({ success: true, data });
  }
  catch { return json({ success: false, message: "Nutrition records are temporarily unavailable." }, 503); }
}

export async function POST(request: Request) {
  const originFailure = requireSameOriginApiRequest(request); if (originFailure) return originFailure;
  const auth = await requireApiUser(); if (auth.response) return auth.response;
  let body: unknown; try { body = await readBody(request); } catch (error) { const tooLarge = error instanceof Error && error.message === "too-large"; return json({ success: false, message: tooLarge ? "Request is too large." : "Invalid request body." }, tooLarge ? 413 : 400); }
  if (!isRecord(body) || Object.keys(body).some((key) => key !== "action" && key !== "data") || typeof body.action !== "string" || !isRecord(body.data)) return json({ success: false, message: "Invalid nutrition request." }, 400);
  const { action, data } = body;
  const parsers = {
    profile: parseNutritionProfile,
    food: parseNutritionFood,
    recipe: parseNutritionRecipe,
    meal: parseNutritionMeal,
    hydration: parseHydration,
    measurement: parseBodyMeasurement,
    reminder: parseNutritionReminder,
    mealPlan: parseNutritionMealPlan,
    groceryList: parseNutritionGroceryList,
  } as const;
  if (!Object.hasOwn(parsers, action) && !["groceryItemStatus", "dismissReminder", "generateGroceries", "updateMeal", "deleteMeal", "duplicateMeal", "updateHydration", "deleteHydration", "deleteMeasurement"].includes(action)) return json({ success: false, message: "Unsupported nutrition action." }, 400);
  try {
    let result: unknown;
    if (Object.hasOwn(parsers, action)) {
      const key = action as keyof typeof parsers; const parsed = parsers[key](data);
      if (!parsed.success) return json({ success: false, message: parsed.message }, 400);
      switch (key) {
        case "profile": result = await createNutritionProfile(auth.user.id, parsed.value as Record<string, unknown>); break;
        case "food": result = await createNutritionFood(auth.user.id, parsed.value as Record<string, unknown>); break;
        case "recipe": result = await createNutritionRecipe(auth.user.id, parsed.value as { name: string; description?: string | null; instructions?: string | null; servings?: string | number | null; ingredients: Array<{ foodId: string; quantity: string; unit: string }> }); break;
        case "meal": result = await createNutritionMeal(auth.user.id, parsed.value as Record<string, unknown>); break;
        case "hydration": result = await createNutritionHydration(auth.user.id, parsed.value as Record<string, unknown>); break;
        case "measurement": result = await createNutritionMeasurement(auth.user.id, parsed.value as Record<string, unknown>); break;
        case "reminder": result = await createNutritionReminder(auth.user.id, parsed.value as Record<string, unknown>); break;
        case "mealPlan": result = await createNutritionMealPlan(auth.user.id, parsed.value as Record<string, unknown>); break;
        case "groceryList": result = await createNutritionGroceryList(auth.user.id, parsed.value as Record<string, unknown>); break;
      }
    } else if (action === "groceryItemStatus") {
      if (Object.keys(data).some((key) => !["profileId", "itemId", "status"].includes(key)) || typeof data.profileId !== "string" || typeof data.itemId !== "string" || !["NEEDED", "PURCHASED", "SKIPPED"].includes(String(data.status))) return json({ success: false, message: "Grocery item update is invalid." }, 400);
      result = await updateNutritionGroceryItem(auth.user.id, { profileId: data.profileId, itemId: data.itemId, status: data.status as "NEEDED" | "PURCHASED" | "SKIPPED" });
    } else if (action === "generateGroceries") {
      if (Object.keys(data).some((key) => !["profileId", "planId", "title"].includes(key)) || typeof data.profileId !== "string" || typeof data.planId !== "string" || typeof data.title !== "string" || data.title.trim().length < 1 || data.title.length > 120) return json({ success: false, message: "Generated grocery list details are invalid." }, 400);
      result = await createGroceryListFromMealPlan(auth.user.id, { profileId: data.profileId, planId: data.planId, title: data.title.trim() });
    } else if (action === "updateMeal") {
      if (Object.keys(data).some((key) => !["profileId", "mealId", "title", "notes", "category", "consumedAt"].includes(key)) || typeof data.profileId !== "string" || typeof data.mealId !== "string" || !(data.title === null || (typeof data.title === "string" && data.title.length <= 160)) || !(data.notes === null || (typeof data.notes === "string" && data.notes.length <= 2000)) || typeof data.category !== "string" || !NUTRITION_MEAL_CATEGORIES.includes(data.category as typeof NUTRITION_MEAL_CATEGORIES[number]) || typeof data.consumedAt !== "string" || !Number.isFinite(Date.parse(data.consumedAt))) return json({ success: false, message: "Meal update is invalid." }, 400);
      result = await updateNutritionMeal(auth.user.id, { profileId: data.profileId, mealId: data.mealId, title: data.title as string | null, notes: data.notes as string | null, category: data.category, consumedAt: data.consumedAt });
    } else if (action === "deleteMeal") {
      if (Object.keys(data).some((key) => !["profileId", "mealId"].includes(key)) || typeof data.profileId !== "string" || typeof data.mealId !== "string") return json({ success: false, message: "Meal deletion is invalid." }, 400);
      result = await deleteNutritionMeal(auth.user.id, data.profileId, data.mealId);
    } else if (action === "duplicateMeal") {
      if (Object.keys(data).some((key) => !["profileId", "mealId", "consumedAt"].includes(key)) || typeof data.profileId !== "string" || typeof data.mealId !== "string" || typeof data.consumedAt !== "string" || !Number.isFinite(Date.parse(data.consumedAt))) return json({ success: false, message: "Meal duplication is invalid." }, 400);
      result = await duplicateNutritionMeal(auth.user.id, { profileId: data.profileId, mealId: data.mealId, consumedAt: data.consumedAt });
    } else if (action === "updateHydration") {
      if (Object.keys(data).some((key) => !["profileId", "entryId", "amountMl", "recordedAt"].includes(key)) || typeof data.profileId !== "string" || typeof data.entryId !== "string" || !Number.isInteger(data.amountMl) || (data.amountMl as number) < 1 || (data.amountMl as number) > 5000 || typeof data.recordedAt !== "string" || !Number.isFinite(Date.parse(data.recordedAt))) return json({ success: false, message: "Hydration correction is invalid." }, 400);
      result = await updateNutritionHydration(auth.user.id, { profileId: data.profileId, entryId: data.entryId, amountMl: data.amountMl as number, recordedAt: data.recordedAt });
    } else if (action === "deleteHydration") {
      if (Object.keys(data).some((key) => !["profileId", "entryId"].includes(key)) || typeof data.profileId !== "string" || typeof data.entryId !== "string") return json({ success: false, message: "Hydration deletion is invalid." }, 400);
      result = await deleteNutritionHydration(auth.user.id, data.profileId, data.entryId);
    } else if (action === "deleteMeasurement") {
      if (Object.keys(data).some((key) => !["profileId", "measurementId"].includes(key)) || typeof data.profileId !== "string" || typeof data.measurementId !== "string") return json({ success: false, message: "Measurement deletion is invalid." }, 400);
      result = await deleteNutritionMeasurement(auth.user.id, data.profileId, data.measurementId);
    } else {
      if (Object.keys(data).some((key) => !["profileId", "reminderId"].includes(key)) || typeof data.profileId !== "string" || typeof data.reminderId !== "string") return json({ success: false, message: "Reminder update is invalid." }, 400);
      result = await dismissNutritionReminder(auth.user.id, data.profileId, data.reminderId);
    }
    return json({ success: true, data: result }, 201);
  } catch { return json({ success: false, message: "Unable to save this nutrition record. Check the values and access, then try again." }, 503); }
}
