/**
 * Prototype DB stub. Replace with real Postgres+pgvector wiring before launch.
 * Returns plausible Nigerian-food rows so the Gemini routes work without a DB.
 */

const FOODS = [
  { name: "Egusi soup",     category: "soup",    calories: 480, protein_g: 22, carbs_g: 18, fat_g: 32, fiber_g: 6,  iron_mg: 4.1, sodium_mg: 380, glycemic_load: "medium", avg_cost_NGN: 650, safe_for_conditions: ["pregnancy", "anemia"] },
  { name: "Jollof rice",    category: "rice",    calories: 520, protein_g: 12, carbs_g: 82, fat_g: 14, fiber_g: 3,  iron_mg: 2.3, sodium_mg: 540, glycemic_load: "high",   avg_cost_NGN: 500, safe_for_conditions: [] },
  { name: "Moi moi",        category: "protein", calories: 280, protein_g: 18, carbs_g: 24, fat_g: 10, fiber_g: 8,  iron_mg: 3.6, sodium_mg: 210, glycemic_load: "low",    avg_cost_NGN: 300, safe_for_conditions: ["diabetes","pcos","hypertension","pregnancy"] },
  { name: "Akara",          category: "protein", calories: 220, protein_g: 11, carbs_g: 18, fat_g: 12, fiber_g: 5,  iron_mg: 2.4, sodium_mg: 180, glycemic_load: "low",    avg_cost_NGN: 200, safe_for_conditions: ["diabetes","pcos"] },
  { name: "Ogi / Pap",      category: "swallow", calories: 180, protein_g: 4,  carbs_g: 38, fat_g: 1,  fiber_g: 2,  iron_mg: 1.1, sodium_mg: 60,  glycemic_load: "medium", avg_cost_NGN: 150, safe_for_conditions: ["hypertension"] },
  { name: "Beans porridge", category: "protein", calories: 340, protein_g: 19, carbs_g: 48, fat_g: 6,  fiber_g: 11, iron_mg: 4.8, sodium_mg: 240, glycemic_load: "low",    avg_cost_NGN: 350, safe_for_conditions: ["diabetes","pcos","hypertension","anemia"] },
  { name: "Plantain (unripe boiled)", category: "swallow", calories: 220, protein_g: 2, carbs_g: 56, fat_g: 0.5, fiber_g: 3, iron_mg: 0.8, sodium_mg: 12, glycemic_load: "low", avg_cost_NGN: 250, safe_for_conditions: ["diabetes","pcos","hypertension"] },
  { name: "Efo riro",       category: "soup",    calories: 260, protein_g: 14, carbs_g: 12, fat_g: 18, fiber_g: 7, iron_mg: 5.2, sodium_mg: 320, glycemic_load: "low", avg_cost_NGN: 450, safe_for_conditions: ["pregnancy","anemia","pcos"] },
  { name: "Pounded yam",    category: "swallow", calories: 380, protein_g: 4,  carbs_g: 90, fat_g: 0.5, fiber_g: 4, iron_mg: 0.9, sodium_mg: 8,  glycemic_load: "high", avg_cost_NGN: 400, safe_for_conditions: [] },
  { name: "Titus fish (grilled)", category: "protein", calories: 240, protein_g: 28, carbs_g: 0, fat_g: 14, fiber_g: 0, iron_mg: 1.6, sodium_mg: 90, glycemic_load: "low", avg_cost_NGN: 800, safe_for_conditions: ["pregnancy","anemia","hypertension","pcos","diabetes"] },
];

const PRICES = {
  "titus fish":       { ingredient: "Titus fish", price_NGN: 800,  unit: "1 medium piece" },
  "ponmo":            { ingredient: "Ponmo",      price_NGN: 250,  unit: "100g" },
  "unripe plantain":  { ingredient: "Unripe plantain", price_NGN: 200, unit: "1 finger" },
  "egusi seed":       { ingredient: "Egusi seed", price_NGN: 1200, unit: "500g" },
  "rice":             { ingredient: "Rice",       price_NGN: 1500, unit: "1 cup" },
  "beans":            { ingredient: "Beans",      price_NGN: 1100, unit: "1 cup" },
};

const PROTOCOLS = {
  hypertension: { condition: "hypertension", foods_to_avoid: "Maggi cubes, processed meats, fried buka stews",   foods_to_prioritize: "Beans, plantain, oats, hibiscus (zobo unsweetened)", daily_targets: "Sodium ≤1500mg", sample_meal: "Beans porridge with plantain" },
  diabetes:     { condition: "diabetes",     foods_to_avoid: "Pounded yam alone, white rice, soft drinks",        foods_to_prioritize: "Unripe plantain, beans, vegetables, oat ogi",        daily_targets: "Low glycemic load", sample_meal: "Moi moi + ogi (no sugar)" },
  pcos:         { condition: "pcos",         foods_to_avoid: "Sugary drinks, white bread, deep-fried snacks",     foods_to_prioritize: "Low-GI swallows, leafy greens, fish, beans",          daily_targets: "Low GI, high fiber", sample_meal: "Efo riro + 1 ball wheat" },
  pregnancy:    { condition: "pregnancy",    foods_to_avoid: "Raw fish, undercooked meat, liver more than weekly", foods_to_prioritize: "Ugu, moi moi, spinach, titus, sardine",              daily_targets: "Folate ≥400mcg, Iron ≥27mg", sample_meal: "Efo riro + moi moi" },
  anemia:       { condition: "anemia",       foods_to_avoid: "Tea/coffee within 1hr of iron meals",               foods_to_prioritize: "Beef liver, beans, ugu, moi moi paired with tomatoes", daily_targets: "Iron-rich every meal", sample_meal: "Beans porridge + tomato stew" },
};

function ilike(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export const db = {
  async query(sql, params = []) {
    const s = sql.toLowerCase();

    if (s.includes("from nigerian_foods") && s.includes("ilike")) {
      const needle = String(params[0] || "").replace(/%/g, "");
      const row = FOODS.find(f => ilike(f.name, needle));
      return { rows: row ? [row] : [] };
    }

    if (s.includes("from market_prices")) {
      const needle = String(params[0] || "").replace(/%/g, "").toLowerCase();
      const found = Object.entries(PRICES).find(([k]) => k.includes(needle) || needle.includes(k));
      return { rows: found ? [{ ...found[1], last_updated: new Date().toISOString() }] : [] };
    }

    if (s.includes("from clinical_protocols")) {
      const row = PROTOCOLS[params[0]];
      return { rows: row ? [row] : [] };
    }

    if (s.includes("from nigerian_foods")) {
      // Substitute search — return all that fit cost ceiling
      const maxCost = Number(params[0]) || 99999;
      const excludeNeedle = String(params[1] || "").replace(/%/g, "").toLowerCase();
      let rows = FOODS.filter(f => f.avg_cost_NGN <= maxCost && !ilike(f.name, excludeNeedle));
      return { rows: rows.slice(0, 5) };
    }

    return { rows: [] };
  },
};

export async function getFoodsForProfile({ conditions = [], excluded = [], limit = 150 } = {}) {
  return FOODS
    .filter(f => !excluded.some(x => ilike(f.name, x)))
    .filter(f => !conditions.length || f.safe_for_conditions.some(c => conditions.includes(c)) || f.safe_for_conditions.length === 0)
    .slice(0, limit);
}
