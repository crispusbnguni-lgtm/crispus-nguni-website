import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { KENYA_CONTEXT_PRIVACY_NOTE, KENYA_FOOD_GUIDANCE, KENYA_NUTRITION_SOURCES, KENYAN_REFERENCE_DISHES } from "../src/lib/kenya-nutrition-reference.ts";
import { parseNutritionProfile } from "../src/lib/personal-workspace-nutrition-core.ts";

test("Kenyan nutrition references point to official government or FAO material and describe coverage honestly", () => {
  assert.match(KENYA_NUTRITION_SOURCES.foodCompositionTables.url, /^https:\/\/nutrition\.health\.go\.ke\//);
  assert.match(KENYA_NUTRITION_SOURCES.recipeBook.url, /^https:\/\/www\.fao\.org\//);
  assert.match(KENYA_NUTRITION_SOURCES.dietaryGuidelines.url, /^https:\/\/www\.fao\.org\//);
  assert.match(KENYA_NUTRITION_SOURCES.foodCompositionTables.coverage, /522.*142/);
  assert.ok(KENYA_FOOD_GUIDANCE.length >= 5);
  assert.ok(KENYAN_REFERENCE_DISHES.some((dish) => dish.name === "Githeri"));
  assert.ok(KENYAN_REFERENCE_DISHES.some((dish) => dish.name === "Uji wa Muhogo"));
  assert.ok(KENYAN_REFERENCE_DISHES.some((dish) => dish.name === "Inghokho"));
  assert.equal(new Set(KENYAN_REFERENCE_DISHES.map((dish) => dish.name)).size, KENYAN_REFERENCE_DISHES.length);
  for (const dish of KENYAN_REFERENCE_DISHES) assert.doesNotMatch(dish.context, /(?:cures?|prevents?|treats?|heals?) (?:disease|diabetes|cancer|infection)|detoxifies|guarantees? (?:weight|health)/i);
});

test("personal nutrition context does not collect marital or sexual status", () => {
  const profile = { displayName: "Profile", kind: "ADULT", birthDate: null, referenceSex: "NOT_RECORDED", activityLevel: "NOT_RECORDED", objective: "NOT_RECORDED", pregnant: false, pregnancyTrimester: null, breastfeeding: false, dietaryPreferences: [], culturalPreferences: [], allergies: [], intolerances: [], healthCircumstances: [], notes: null };
  assert.equal(parseNutritionProfile(profile).success, true);
  assert.equal(parseNutritionProfile({ ...profile, maritalStatus: "MARRIED" }).success, false);
  assert.equal(parseNutritionProfile({ ...profile, sexuallyActive: true }).success, false);
  assert.match(KENYA_CONTEXT_PRIVACY_NOTE, /does not infer needs from marital status or sexual activity/i);
});

test("Nutrition guide includes official source links and warns against treating the sample as complete", async () => {
  const guide = await readFile(new URL("../src/components/workspace/KenyanNutritionGuide.tsx", import.meta.url), "utf8");
  assert.match(guide, /not a complete list of Kenyan cuisine/);
  assert.match(guide, /Dish notes describe ingredients or food groups only/);
  assert.match(guide, /KENYA_NUTRITION_SOURCES\.recipeBook/);
  assert.match(guide, /KENYA_NUTRITION_SOURCES\.foodCompositionTables/);
  assert.match(guide, /count="522"/);
  assert.match(guide, /count="142"/);
  assert.match(guide, /full reference records are not yet loaded into private food catalogues/);
  assert.match(guide, /KENYA_NUTRITION_SOURCES\.dietaryGuidelines/);
  assert.doesNotMatch(guide, /<a\b|href=/i);
});
