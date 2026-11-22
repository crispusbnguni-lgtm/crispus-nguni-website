import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("daily diary searches foods and saved recipes and records their correct source ids", async () => {
  const source = await readFile(new URL("../src/components/workspace/WorkspaceDailyFoodLog.tsx", import.meta.url), "utf8");
  assert.match(source, /Search foods and recipes/);
  assert.match(source, /recipes.filter/);
  assert.match(source, /recipeId: itemId/);
  assert.match(source, /foodId: itemId/);
  assert.match(source, /ingredients.map/);
  assert.match(source, /servings per recipe/);
  assert.match(source, /All food groups/);
  assert.match(source, /entries: entries\.map/);
  assert.match(source, /quantity, unit/);
  assert.match(source, /Breakfast/);
  assert.match(source, /Dinner/);
  assert.match(source, /current\.length >= 50/);
  assert.match(source, /nutritionDateTimeInTimezoneToIso/);
});

test("Nutrition tab order groups daily logging, catalogue and planning; tile uses shared Liquid Glass styling", async () => {
  const source = await readFile(new URL("../src/components/workspace/WorkspaceNutrition.tsx", import.meta.url), "utf8");
  assert.match(source, /label: "Daily food log"/);
  assert.match(source, /label: "Food catalogue"/);
  assert.match(source, /label: "Meal planning"/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /onKeyDown=\{\(event\) => \{/);
  assert.match(source, /<LiquidLensSurface radius=\{28\}/);
  assert.doesNotMatch(source, /radial-gradient|linear-gradient\(135deg,rgba\(22,33,32/);
});

test("Nutrition has one direct route back to Workspace and no external or duplicate content links", async () => {
  const source = await readFile(new URL("../src/components/workspace/WorkspaceNutrition.tsx", import.meta.url), "utf8");
  assert.match(source, /<Link href="\/dashboard\/workspace"/);
  assert.equal((source.match(/<Link\b/g) ?? []).length, 1);
  assert.equal((source.match(/href=/g) ?? []).length, 1);
  const paths = ["WorkspaceDailyFoodLog.tsx", "WorkspaceNutritionRecipes.tsx", "WorkspaceNutritionHydration.tsx", "NutritionIntelligencePanel.tsx", "KenyanNutritionGuide.tsx"];
  for (const file of paths) {
    const source = await readFile(new URL(`../src/components/workspace/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /<a\b|<Link\b|href=/i, `${file} should not add a clickable link`);
  }
});

test("nutrition data load permits the complete official food count while remaining workspace-scoped", async () => {
  const source = await readFile(new URL("../src/lib/personal-workspace-nutrition.ts", import.meta.url), "utf8");
  assert.match(source, /where: \{ workspaceId: profile\.workspaceId, archivedAt: null \}/);
  assert.match(source, /take: 600/);
});

test("BMI feedback is descriptive, uses saved history and does not draw misleading age or pregnancy thresholds", async () => {
  const source = await readFile(new URL("../src/components/workspace/NutritionBmiFeedback.tsx", import.meta.url), "utf8");
  assert.match(source, /measurements/);
  assert.match(source, /role="img"/);
  assert.match(source, /BMI history chart/);
  assert.match(source, /adult screening reference/);
  assert.match(source, /does not diagnose health/);
  assert.match(source, /pregnancy status/);
  assert.match(source, /Weight history/);
  assert.match(source, /Partial measurements remain visible as missing/);
  assert.match(source, /Short-term changes can reflect ordinary fluctuation/);
  assert.match(source, /Understanding your BMI result/);
  assert.match(source, /Adult screening categories/);
  assert.match(source, /kg ÷ \(metres × metres\)/);
  assert.match(source, /pounds × 703/);
  assert.match(source, /Class 1 obesity/);
  assert.match(source, /Class 2 obesity/);
  assert.match(source, /Class 3 obesity/);
  assert.doesNotMatch(source, /<a\b|<Link\b|href=/i);
  assert.doesNotMatch(source, /WHO chart|diagnostic range/i);
  const nutrition = await readFile(new URL("../src/components/workspace/WorkspaceNutrition.tsx", import.meta.url), "utf8");
  assert.match(nutrition, /canViewHealth && <NutritionBmiFeedback compact/);
  assert.match(nutrition, /onOpenHistory=\{\(\) => setTab\("health"\)\}/);
});

test("BMI history lists every saved result newest-first and exposes deletion only through its authorized callback", async () => {
  const component = await readFile(new URL("../src/components/workspace/NutritionBmiFeedback.tsx", import.meta.url), "utf8");
  assert.match(component, /const recentMeasurements = \[\.\.\.measurements\]\.sort/);
  assert.match(component, /Recent measurements and results/);
  assert.match(component, /newest dates first/);
  assert.match(component, /recentMeasurements\.map/);
  assert.doesNotMatch(component, /recentMeasurements\.slice/);
  assert.match(component, /onDeleteMeasurement\(item\.id\)/);
  assert.match(component, /item\.bmi\.interpretation/);

  const workspace = await readFile(new URL("../src/components/workspace/WorkspaceNutrition.tsx", import.meta.url), "utf8");
  assert.match(workspace, /window\.confirm\("Delete this saved measurement and its BMI result\?/);
  assert.match(workspace, /onDeleteMeasurement=\{canManageProfile \? deleteMeasurement : undefined\}/);
});

test("measurement deletion is profile-scoped, manager-authorized and audited in the same transaction", async () => {
  const service = await readFile(new URL("../src/lib/personal-workspace-nutrition.ts", import.meta.url), "utf8");
  const deletion = service.slice(service.indexOf("export async function deleteNutritionMeasurement"), service.indexOf("export async function createNutritionReminder"));
  assert.match(deletion, /accessibleProfile\(actorUserId, profileId, "profile"\)/);
  assert.match(deletion, /prisma\.\$transaction\(async \(tx\)/);
  assert.match(deletion, /workspaceId: profile\.workspaceId, profileId: profile\.id, id: measurementId/);
  assert.match(deletion, /deleteMany/);
  assert.match(deletion, /MEASUREMENT_DELETED/);
  assert.match(deletion, /await event\(tx/);

  const route = await readFile(new URL("../src/app/api/dashboard/workspace/nutrition/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireSameOriginApiRequest/);
  assert.match(route, /deleteNutritionMeasurement\(auth\.user\.id, data\.profileId, data\.measurementId\)/);
  assert.match(route, /Measurement deletion is invalid/);
});
