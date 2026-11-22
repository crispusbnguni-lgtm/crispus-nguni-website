export const KENYA_NUTRITION_SOURCES = {
  foodCompositionTables: {
    title: "Kenya Food Composition Tables 2018",
    url: "https://nutrition.health.go.ke/programmes/healthy-diets-physical/food-composition-tables/",
    publisher: "Government of Kenya, Ministry of Health and Ministry of Agriculture with KALRO and FAO",
    coverage: "522 raw and cooked foods and 142 mixed recipes; values depend on the named food, preparation and serving basis.",
  },
  recipeBook: {
    title: "Kenyan Food Recipes 2018",
    url: "https://www.fao.org/4/i9056en/I9056EN.pdf",
    publisher: "FAO and the Government of Kenya",
    coverage: "A community-developed collection of 142 common mixed dishes with ingredients, preparation, yield and nutrient profiles per 100 g.",
  },
  dietaryGuidelines: {
    title: "Kenya National Guidelines for Healthy Diets and Physical Activity",
    url: "https://www.fao.org/nutrition/education/food-dietary-guidelines/regions/kenya/en/",
    publisher: "Kenya Ministry of Health; indexed by FAO",
  },
} as const;

export const KENYA_FOOD_GUIDANCE = [
  { id: "variety", title: "Build variety across the day", guidance: "Use foods from different groups and include whole or minimally processed starchy staples where available.", examples: "Maize, millet, sorghum, rice, roots and tubers" },
  { id: "plants", title: "Include vegetables and fruit", guidance: "Kenya’s general guidance encourages green leafy, red and yellow vegetables, fruit and other vegetables regularly.", examples: "Sukuma wiki, terere, managu, pumpkin leaves, seasonal fruit" },
  { id: "pulses", title: "Use pulses and nuts regularly", guidance: "The guideline highlights beans, peas, lentils, cowpeas, pigeon peas, soya, nuts and edible seeds as regular foods.", examples: "Githeri, ndengu, kunde, njahi, mbaazi, groundnuts" },
  { id: "protein", title: "Vary protein foods", guidance: "The general guideline includes lean meat, fish and seafood, poultry, insects or eggs as options; preference, access and health needs vary.", examples: "Omena, tilapia, eggs, chicken, goat and other locally available foods" },
  { id: "dairy", title: "Consider milk or fermented dairy", guidance: "The national general-population guidance includes fresh or fermented milk and yoghurt; this is not suitable for everyone.", examples: "Maziwa, mursik, mala or yoghurt when chosen and tolerated" },
  { id: "moderation", title: "Keep seasoning choices personal", guidance: "The guideline advises moderation with fats, sugar and salt and use of iodised salt. This guide does not set a personal target.", examples: "Household recipes and portions differ" },
] as const;

export const KENYAN_REFERENCE_DISHES = [
  { name: "Githeri", aliases: "Maize and beans", group: "Maize and pulses", context: "The Kenya recipe reference lists fresh-bean and maize, dried-bean and maize, and sautéed variations. Their ingredients make a staple-plus-pulse combination; portions and added ingredients change the final profile." },
  { name: "Mukimo", aliases: "Fresh maize, potato and pumpkin leaves", group: "Staple, roots and leafy vegetables", context: "The 2018 recipe book documents several mukimo variants. Pumpkin leaves and other additions differ by household and community." },
  { name: "Mseto wa Maharagwe", aliases: "Rice with beans", group: "Cereal and pulses", context: "A rice-and-bean mixed dish listed in the national recipe collection. A title alone cannot establish the nutrient profile of a home preparation." },
  { name: "Mchuzi wa Ndengu", aliases: "Green gram stew", group: "Pulses", context: "A green-gram dish in the national recipe book. Green grams are one of the pulses highlighted in Kenya’s general dietary guidance." },
  { name: "Sukuma wiki", aliases: "Stir-fried kale", group: "Leafy vegetables", context: "A vegetable dish in the national recipe book and an example of a locally familiar leafy vegetable. Cooking method and accompanying foods vary." },
  { name: "Terere", aliases: "Amaranth leaves", group: "Leafy vegetables", context: "The recipe collection includes stir-fried amaranth leaves. The dish contributes vegetable variety; no disease-prevention effect is inferred." },
  { name: "Mchuzi wa Mbaazi", aliases: "Pigeon-pea stew", group: "Pulses", context: "A pigeon-pea stew listed in the Kenya recipe collection. The ingredient group is represented in Kenya’s dietary guidance." },
  { name: "Wukunu", aliases: "Sweet potatoes and dehulled black beans", group: "Roots and pulses", context: "A community recipe documented by the Kenya/FAO book, showing one way roots and pulses are prepared together." },
  { name: "Uji wa Wimbi", aliases: "Finger-millet porridge", group: "Cereal", context: "A finger-millet porridge included in the recipe book. Grain, enrichment, liquid and serving size affect the final composition." },
  { name: "Uji wa Muhogo", aliases: "Cassava porridge", group: "Root and tuber staple", context: "Named by FAO as one end of the Kenyan recipe collection. Its composition depends on the recipe, ingredients and serving size; a dish name is not a nutrient estimate." },
  { name: "Inghokho", aliases: "Stewed chicken", group: "Poultry and mixed dishes", context: "Named by FAO as an example from the Kenyan recipe collection. The ingredient contributes a poultry option; portions and accompanying foods determine the meal profile." },
  { name: "Omena", aliases: "Silver sardine stew", group: "Fish and mixed dishes", context: "The recipe book includes silver-sardine stew and fried omena preparations. Preparation and accompanying foods materially change the dish." },
  { name: "Matoke", aliases: "Stewed green bananas", group: "Roots, tubers and bananas", context: "The national recipe collection documents stewed green bananas and a version prepared with meat." },
] as const;

export const KENYA_CONTEXT_PRIVACY_NOTE = "This general food guide does not infer needs from marital status or sexual activity. Pregnancy, breastfeeding, allergies, health circumstances and other sensitive context should be optional, clearly explained, owner-controlled and used only for an explicitly chosen purpose. Personalised clinical nutrition decisions belong with a qualified health professional.";
