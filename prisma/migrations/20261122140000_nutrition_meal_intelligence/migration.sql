-- Additive Nutrition and Meal Intelligence Centre schema. Generated from the local Prisma schema; not applied.
-- CreateEnum
CREATE TYPE "NutritionProfileKind" AS ENUM ('ADULT', 'CHILD', 'ADOLESCENT', 'PREGNANT', 'BREASTFEEDING', 'OLDER_ADULT', 'ATHLETE', 'HEALTH_CONDITION');


-- CreateEnum
CREATE TYPE "NutritionReferenceSex" AS ENUM ('FEMALE', 'MALE', 'NOT_RECORDED');


-- CreateEnum
CREATE TYPE "NutritionActivityLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'NOT_RECORDED');


-- CreateEnum
CREATE TYPE "NutritionObjective" AS ENUM ('BALANCED_EATING', 'WEIGHT_MAINTENANCE', 'HEALTHY_WEIGHT_GAIN', 'HEALTHY_WEIGHT_LOSS', 'SPORTS_FUELING', 'GENERAL_WELLBEING', 'NOT_RECORDED');


-- CreateEnum
CREATE TYPE "NutritionFoodGroup" AS ENUM ('FRUITS', 'VEGETABLES', 'CEREALS_WHOLE_GRAINS', 'ROOTS_TUBERS', 'LEGUMES_PULSES', 'MEAT_POULTRY', 'FISH_SEAFOOD', 'EGGS', 'MILK_DAIRY', 'NUTS_SEEDS', 'OILS_FATS', 'WATER_BEVERAGES', 'MIXED_MEAL', 'OTHER');


-- CreateEnum
CREATE TYPE "NutritionDataQuality" AS ENUM ('VERIFIED_SOURCE', 'ESTIMATED', 'USER_ENTERED', 'UNKNOWN');


-- CreateEnum
CREATE TYPE "NutritionMealCategory" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER');


-- CreateEnum
CREATE TYPE "NutritionPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');


-- CreateEnum
CREATE TYPE "NutritionGroceryStatus" AS ENUM ('NEEDED', 'PURCHASED', 'SKIPPED');


-- CreateEnum
CREATE TYPE "NutritionReminderKind" AS ENUM ('MEAL_PREPARATION', 'GROCERY_SHOPPING', 'MEAL_PLANNING', 'HYDRATION', 'NUTRITION_REVIEW', 'ANTENATAL_APPOINTMENT', 'OTHER');


-- CreateEnum
CREATE TYPE "NutritionAccessRole" AS ENUM ('VIEWER', 'CAREGIVER', 'EDITOR');


-- CreateTable
CREATE TABLE "NutritionProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "kind" "NutritionProfileKind" NOT NULL DEFAULT 'ADULT',
    "birthDate" DATE,
    "referenceSex" "NutritionReferenceSex" NOT NULL DEFAULT 'NOT_RECORDED',
    "activityLevel" "NutritionActivityLevel" NOT NULL DEFAULT 'NOT_RECORDED',
    "objective" "NutritionObjective" NOT NULL DEFAULT 'NOT_RECORDED',
    "pregnant" BOOLEAN NOT NULL DEFAULT false,
    "pregnancyTrimester" INTEGER,
    "breastfeeding" BOOLEAN NOT NULL DEFAULT false,
    "dietaryPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "culturalPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intolerances" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "healthCircumstances" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" VARCHAR(2000),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionProfile_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionProfileAccess" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "memberUserId" TEXT NOT NULL,
    "role" "NutritionAccessRole" NOT NULL,
    "canViewHealth" BOOLEAN NOT NULL DEFAULT false,
    "canManageProfile" BOOLEAN NOT NULL DEFAULT false,
    "canManageMeals" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionProfileAccess_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionFood" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "group" "NutritionFoodGroup" NOT NULL,
    "description" VARCHAR(500),
    "servingLabel" VARCHAR(80),
    "imageAssetId" TEXT,
    "calories" DECIMAL(12,3),
    "proteinGrams" DECIMAL(12,3),
    "carbohydrateGrams" DECIMAL(12,3),
    "fatGrams" DECIMAL(12,3),
    "fibreGrams" DECIMAL(12,3),
    "micronutrients" JSONB,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preparation" VARCHAR(2000),
    "dataQuality" "NutritionDataQuality" NOT NULL DEFAULT 'UNKNOWN',
    "sourceName" VARCHAR(160),
    "sourceUrl" VARCHAR(1000),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionFood_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionRecipe" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "instructions" VARCHAR(5000),
    "servings" DECIMAL(8,2),
    "imageAssetId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionRecipe_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionRecipeIngredient" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" VARCHAR(40) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NutritionRecipeIngredient_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionMeal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "category" "NutritionMealCategory" NOT NULL,
    "title" VARCHAR(160),
    "consumedAt" TIMESTAMP(3) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'Africa/Nairobi',
    "notes" VARCHAR(2000),
    "preparedBy" VARCHAR(100),
    "imageAssetId" TEXT,

    CONSTRAINT "NutritionMeal_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionMealEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "foodId" TEXT,
    "recipeId" TEXT,
    "labelSnapshot" VARCHAR(160) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" VARCHAR(40) NOT NULL,
    "caloriesSnapshot" DECIMAL(12,3),
    "proteinSnapshot" DECIMAL(12,3),
    "carbohydrateSnapshot" DECIMAL(12,3),
    "fatSnapshot" DECIMAL(12,3),
    "fibreSnapshot" DECIMAL(12,3),
    "dataQuality" "NutritionDataQuality" NOT NULL DEFAULT 'UNKNOWN',

    CONSTRAINT "NutritionMealEntry_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionHydrationEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionHydrationEntry_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionBodyMeasurement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "measuredOn" DATE NOT NULL,
    "weightKg" DECIMAL(8,3),
    "heightCm" DECIMAL(7,2),
    "waistCm" DECIMAL(7,2),
    "notes" VARCHAR(1000),

    CONSTRAINT "NutritionBodyMeasurement_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionMealPlan" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "status" "NutritionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionMealPlan_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionMealPlanItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "foodId" TEXT,
    "recipeId" TEXT,
    "category" "NutritionMealCategory" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "notes" VARCHAR(1000),

    CONSTRAINT "NutritionMealPlanItem_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionGroceryList" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "reusable" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionGroceryList_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionGroceryListItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "foodId" TEXT,
    "name" VARCHAR(160) NOT NULL,
    "category" VARCHAR(80),
    "quantity" DECIMAL(12,3),
    "unit" VARCHAR(40),
    "estimatedCost" DECIMAL(12,2),
    "currency" CHAR(3),
    "status" "NutritionGroceryStatus" NOT NULL DEFAULT 'NEEDED',
    "notes" VARCHAR(500),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NutritionGroceryListItem_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionReminder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" "NutritionReminderKind" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutritionReminder_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "NutritionEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "action" VARCHAR(48) NOT NULL,
    "targetType" VARCHAR(48) NOT NULL,
    "targetId" VARCHAR(128) NOT NULL,
    "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutritionEvent_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX "NutritionProfile_workspaceId_archivedAt_displayName_idx" ON "NutritionProfile"("workspaceId", "archivedAt", "displayName");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionProfile_workspaceId_id_key" ON "NutritionProfile"("workspaceId", "id");


-- CreateIndex
CREATE INDEX "NutritionProfileAccess_memberUserId_profileId_idx" ON "NutritionProfileAccess"("memberUserId", "profileId");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionProfileAccess_workspaceId_profileId_memberUserId_key" ON "NutritionProfileAccess"("workspaceId", "profileId", "memberUserId");


-- CreateIndex
CREATE INDEX "NutritionFood_workspaceId_group_archivedAt_name_idx" ON "NutritionFood"("workspaceId", "group", "archivedAt", "name");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionFood_workspaceId_id_key" ON "NutritionFood"("workspaceId", "id");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionFood_workspaceId_name_key" ON "NutritionFood"("workspaceId", "name");


-- CreateIndex
CREATE INDEX "NutritionRecipe_workspaceId_archivedAt_name_idx" ON "NutritionRecipe"("workspaceId", "archivedAt", "name");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionRecipe_workspaceId_id_key" ON "NutritionRecipe"("workspaceId", "id");


-- CreateIndex
CREATE INDEX "NutritionRecipeIngredient_workspaceId_recipeId_sortOrder_idx" ON "NutritionRecipeIngredient"("workspaceId", "recipeId", "sortOrder");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionRecipeIngredient_workspaceId_id_key" ON "NutritionRecipeIngredient"("workspaceId", "id");


-- CreateIndex
CREATE INDEX "NutritionMeal_workspaceId_profileId_consumedAt_id_idx" ON "NutritionMeal"("workspaceId", "profileId", "consumedAt", "id");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionMeal_workspaceId_id_key" ON "NutritionMeal"("workspaceId", "id");


-- CreateIndex
CREATE INDEX "NutritionMealEntry_workspaceId_mealId_id_idx" ON "NutritionMealEntry"("workspaceId", "mealId", "id");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionMealEntry_workspaceId_id_key" ON "NutritionMealEntry"("workspaceId", "id");


-- CreateIndex
CREATE INDEX "NutritionHydrationEntry_workspaceId_profileId_recordedAt_idx" ON "NutritionHydrationEntry"("workspaceId", "profileId", "recordedAt");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionHydrationEntry_workspaceId_id_key" ON "NutritionHydrationEntry"("workspaceId", "id");


-- CreateIndex
CREATE INDEX "NutritionBodyMeasurement_workspaceId_profileId_measuredOn_i_idx" ON "NutritionBodyMeasurement"("workspaceId", "profileId", "measuredOn", "id");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionBodyMeasurement_workspaceId_id_key" ON "NutritionBodyMeasurement"("workspaceId", "id");


-- CreateIndex
CREATE INDEX "NutritionMealPlan_workspaceId_profileId_status_startsOn_idx" ON "NutritionMealPlan"("workspaceId", "profileId", "status", "startsOn");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionMealPlan_workspaceId_id_key" ON "NutritionMealPlan"("workspaceId", "id");


-- CreateIndex
CREATE INDEX "NutritionMealPlanItem_workspaceId_planId_scheduledAt_id_idx" ON "NutritionMealPlanItem"("workspaceId", "planId", "scheduledAt", "id");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionMealPlanItem_workspaceId_id_key" ON "NutritionMealPlanItem"("workspaceId", "id");


-- CreateIndex
CREATE INDEX "NutritionGroceryList_workspaceId_profileId_archivedAt_updat_idx" ON "NutritionGroceryList"("workspaceId", "profileId", "archivedAt", "updatedAt");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionGroceryList_workspaceId_id_key" ON "NutritionGroceryList"("workspaceId", "id");


-- CreateIndex
CREATE INDEX "NutritionGroceryListItem_workspaceId_listId_status_sortOrde_idx" ON "NutritionGroceryListItem"("workspaceId", "listId", "status", "sortOrder");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionGroceryListItem_workspaceId_id_key" ON "NutritionGroceryListItem"("workspaceId", "id");


-- CreateIndex
CREATE INDEX "NutritionReminder_workspaceId_profileId_dismissedAt_remindA_idx" ON "NutritionReminder"("workspaceId", "profileId", "dismissedAt", "remindAt");


-- CreateIndex
CREATE UNIQUE INDEX "NutritionReminder_workspaceId_id_key" ON "NutritionReminder"("workspaceId", "id");


-- CreateIndex
CREATE INDEX "NutritionEvent_workspaceId_targetType_targetId_createdAt_idx" ON "NutritionEvent"("workspaceId", "targetType", "targetId", "createdAt");


-- AddForeignKey
ALTER TABLE "NutritionProfile" ADD CONSTRAINT "NutritionProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionProfileAccess" ADD CONSTRAINT "NutritionProfileAccess_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionProfileAccess" ADD CONSTRAINT "NutritionProfileAccess_workspaceId_profileId_fkey" FOREIGN KEY ("workspaceId", "profileId") REFERENCES "NutritionProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionProfileAccess" ADD CONSTRAINT "NutritionProfileAccess_memberUserId_fkey" FOREIGN KEY ("memberUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionFood" ADD CONSTRAINT "NutritionFood_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionFood" ADD CONSTRAINT "NutritionFood_workspaceId_imageAssetId_fkey" FOREIGN KEY ("workspaceId", "imageAssetId") REFERENCES "WorkspaceMediaAsset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionRecipe" ADD CONSTRAINT "NutritionRecipe_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionRecipeIngredient" ADD CONSTRAINT "NutritionRecipeIngredient_workspaceId_recipeId_fkey" FOREIGN KEY ("workspaceId", "recipeId") REFERENCES "NutritionRecipe"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionRecipeIngredient" ADD CONSTRAINT "NutritionRecipeIngredient_workspaceId_foodId_fkey" FOREIGN KEY ("workspaceId", "foodId") REFERENCES "NutritionFood"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionMeal" ADD CONSTRAINT "NutritionMeal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionMeal" ADD CONSTRAINT "NutritionMeal_workspaceId_profileId_fkey" FOREIGN KEY ("workspaceId", "profileId") REFERENCES "NutritionProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionMeal" ADD CONSTRAINT "NutritionMeal_workspaceId_imageAssetId_fkey" FOREIGN KEY ("workspaceId", "imageAssetId") REFERENCES "WorkspaceMediaAsset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionMealEntry" ADD CONSTRAINT "NutritionMealEntry_workspaceId_mealId_fkey" FOREIGN KEY ("workspaceId", "mealId") REFERENCES "NutritionMeal"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionMealEntry" ADD CONSTRAINT "NutritionMealEntry_workspaceId_foodId_fkey" FOREIGN KEY ("workspaceId", "foodId") REFERENCES "NutritionFood"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionMealEntry" ADD CONSTRAINT "NutritionMealEntry_workspaceId_recipeId_fkey" FOREIGN KEY ("workspaceId", "recipeId") REFERENCES "NutritionRecipe"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionHydrationEntry" ADD CONSTRAINT "NutritionHydrationEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionHydrationEntry" ADD CONSTRAINT "NutritionHydrationEntry_workspaceId_profileId_fkey" FOREIGN KEY ("workspaceId", "profileId") REFERENCES "NutritionProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionBodyMeasurement" ADD CONSTRAINT "NutritionBodyMeasurement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionBodyMeasurement" ADD CONSTRAINT "NutritionBodyMeasurement_workspaceId_profileId_fkey" FOREIGN KEY ("workspaceId", "profileId") REFERENCES "NutritionProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionMealPlan" ADD CONSTRAINT "NutritionMealPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionMealPlan" ADD CONSTRAINT "NutritionMealPlan_workspaceId_profileId_fkey" FOREIGN KEY ("workspaceId", "profileId") REFERENCES "NutritionProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionMealPlanItem" ADD CONSTRAINT "NutritionMealPlanItem_workspaceId_planId_fkey" FOREIGN KEY ("workspaceId", "planId") REFERENCES "NutritionMealPlan"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionMealPlanItem" ADD CONSTRAINT "NutritionMealPlanItem_workspaceId_foodId_fkey" FOREIGN KEY ("workspaceId", "foodId") REFERENCES "NutritionFood"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionMealPlanItem" ADD CONSTRAINT "NutritionMealPlanItem_workspaceId_recipeId_fkey" FOREIGN KEY ("workspaceId", "recipeId") REFERENCES "NutritionRecipe"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionGroceryList" ADD CONSTRAINT "NutritionGroceryList_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionGroceryList" ADD CONSTRAINT "NutritionGroceryList_workspaceId_profileId_fkey" FOREIGN KEY ("workspaceId", "profileId") REFERENCES "NutritionProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionGroceryListItem" ADD CONSTRAINT "NutritionGroceryListItem_workspaceId_listId_fkey" FOREIGN KEY ("workspaceId", "listId") REFERENCES "NutritionGroceryList"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionGroceryListItem" ADD CONSTRAINT "NutritionGroceryListItem_workspaceId_foodId_fkey" FOREIGN KEY ("workspaceId", "foodId") REFERENCES "NutritionFood"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionReminder" ADD CONSTRAINT "NutritionReminder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionReminder" ADD CONSTRAINT "NutritionReminder_workspaceId_profileId_fkey" FOREIGN KEY ("workspaceId", "profileId") REFERENCES "NutritionProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "NutritionEvent" ADD CONSTRAINT "NutritionEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PersonalWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "NutritionProfile" ADD CONSTRAINT "NutritionProfile_pregnancy_trimester_check" CHECK ("pregnancyTrimester" IS NULL OR "pregnancyTrimester" BETWEEN 1 AND 3);
ALTER TABLE "NutritionFood" ADD CONSTRAINT "NutritionFood_nonnegative_nutrients_check" CHECK (("calories" IS NULL OR "calories" >= 0) AND ("proteinGrams" IS NULL OR "proteinGrams" >= 0) AND ("carbohydrateGrams" IS NULL OR "carbohydrateGrams" >= 0) AND ("fatGrams" IS NULL OR "fatGrams" >= 0) AND ("fibreGrams" IS NULL OR "fibreGrams" >= 0));
ALTER TABLE "NutritionRecipe" ADD CONSTRAINT "NutritionRecipe_positive_servings_check" CHECK ("servings" IS NULL OR "servings" > 0);
ALTER TABLE "NutritionRecipeIngredient" ADD CONSTRAINT "NutritionRecipeIngredient_positive_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "NutritionMealEntry" ADD CONSTRAINT "NutritionMealEntry_positive_quantity_one_source_check" CHECK ("quantity" > 0 AND (("foodId" IS NOT NULL)::integer + ("recipeId" IS NOT NULL)::integer = 1));
ALTER TABLE "NutritionHydrationEntry" ADD CONSTRAINT "NutritionHydrationEntry_amount_check" CHECK ("amountMl" BETWEEN 1 AND 5000);
ALTER TABLE "NutritionBodyMeasurement" ADD CONSTRAINT "NutritionBodyMeasurement_positive_values_check" CHECK (("weightKg" IS NULL OR "weightKg" > 0) AND ("heightCm" IS NULL OR "heightCm" > 0) AND ("waistCm" IS NULL OR "waistCm" > 0));
ALTER TABLE "NutritionMealPlan" ADD CONSTRAINT "NutritionMealPlan_date_range_check" CHECK ("startsOn" <= "endsOn");
ALTER TABLE "NutritionMealPlanItem" ADD CONSTRAINT "NutritionMealPlanItem_one_source_check" CHECK ((("foodId" IS NOT NULL)::integer + ("recipeId" IS NOT NULL)::integer = 1));
ALTER TABLE "NutritionGroceryListItem" ADD CONSTRAINT "NutritionGroceryListItem_nonnegative_check" CHECK (("quantity" IS NULL OR "quantity" > 0) AND ("estimatedCost" IS NULL OR "estimatedCost" >= 0));
