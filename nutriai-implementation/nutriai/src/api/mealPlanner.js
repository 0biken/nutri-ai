/**
 * AI Meal Plan Generator — Gemini 1.5 Pro, JSON output mode
 *
 * Key architectural decisions:
 * 1. Use Pro (not Flash) — we're injecting a large food DB subset + health rules
 *    simultaneously. Pro's 1M token context handles this comfortably.
 * 2. Force strict JSON output — never expose raw LLM text in the UI.
 *    The frontend only ever receives typed meal plan objects.
 * 3. DB subset injection — we don't send all 2,000 foods. We query the DB
 *    for the ~150 foods relevant to the user's conditions + budget tier,
 *    then inject only those into the prompt. Keeps latency low.
 */

// ── SERVER SIDE (Next.js: app/api/meal-plan/route.js) ──────────────────────

export const MEAL_PLAN_SERVER = `
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { getFoodsForProfile } from "@/lib/db";   // your PostgreSQL query helper

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── JSON schema — Gemini enforces this structure in the response ──────────
const MEAL_PLAN_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    planTitle: { type: SchemaType.STRING },
    weeklyBudget_NGN: { type: SchemaType.NUMBER },
    totalCalories_daily: { type: SchemaType.NUMBER },
    days: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          day: { type: SchemaType.STRING },    // "Monday"
          meals: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                mealType:   { type: SchemaType.STRING },   // "Breakfast"
                dishName:   { type: SchemaType.STRING },   // "Pap with akara"
                portion:    { type: SchemaType.STRING },   // "1 bowl + 3 pieces"
                calories:   { type: SchemaType.NUMBER },
                protein_g:  { type: SchemaType.NUMBER },
                carbs_g:    { type: SchemaType.NUMBER },
                fat_g:      { type: SchemaType.NUMBER },
                cost_NGN:   { type: SchemaType.NUMBER },
                prepTime_min: { type: SchemaType.NUMBER },
                cycleNote:  { type: SchemaType.STRING },   // null if N/A
                clinicalNote: { type: SchemaType.STRING }, // null if N/A
              },
              required: ["mealType","dishName","portion","calories","cost_NGN"],
            },
          },
          dayTotal_calories: { type: SchemaType.NUMBER },
          dayTotal_cost_NGN: { type: SchemaType.NUMBER },
        },
        required: ["day","meals","dayTotal_calories","dayTotal_cost_NGN"],
      },
    },
    shoppingList: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ingredient:  { type: SchemaType.STRING },
          quantity:    { type: SchemaType.STRING },
          cost_NGN:    { type: SchemaType.NUMBER },
          market:      { type: SchemaType.STRING },  // "Any open market"
        },
      },
    },
    nutritionSummary: {
      type: SchemaType.OBJECT,
      properties: {
        avgDailyCalories: { type: SchemaType.NUMBER },
        avgProtein_g:     { type: SchemaType.NUMBER },
        avgCarbs_g:       { type: SchemaType.NUMBER },
        avgFat_g:         { type: SchemaType.NUMBER },
        totalWeeklyCost:  { type: SchemaType.NUMBER },
        clinicalCompliance: { type: SchemaType.STRING }, // "Meets DASH targets"
      },
    },
  },
  required: ["planTitle","weeklyBudget_NGN","days","shoppingList","nutritionSummary"],
};

function buildMealPlanPrompt(profile, foods, clinicalRules) {
  return \`
You are NutriAI's meal planning engine for Nigerian users.
Generate a 7-day meal plan that strictly follows all rules below.

== USER PROFILE ==
Age: \${profile.age} | Sex: \${profile.sex} | Weight: \${profile.weight_kg}kg
Conditions: \${profile.conditions.join(", ") || "None"}
Cycle phase: \${profile.cyclePhase || "N/A"}
Weekly food budget: ₦\${profile.weeklyBudget_NGN}
Calorie target: \${profile.dailyCalorieTarget} kcal/day
Excluded foods: \${profile.excludedFoods?.join(", ") || "None"}
Goal: \${profile.goal}  // e.g. "weight loss" | "muscle gain" | "maintain"

== CLINICAL RULES (MUST FOLLOW) ==
\${clinicalRules}

== AVAILABLE FOODS (use ONLY foods from this list) ==
\${JSON.stringify(foods, null, 2)}

== RULES ==
1. Every meal MUST use foods from the Available Foods list above
2. Daily cost MUST stay within (weeklyBudget / 7) ± 10%
3. Total daily calories MUST be within ±50 kcal of the target
4. Breakfast = lighter (≤400 kcal), Lunch = largest (≥500 kcal), Dinner = moderate
5. Use Nigerian meal naming conventions — "Lunch" not "midday meal"
6. Rotate proteins across the week — do not repeat same protein twice in a row
7. Apply cycleNote to any meal where the food is particularly relevant to the cycle phase
8. Apply clinicalNote to any meal where a specific condition interaction exists
9. Include realistic Nigerian market shopping list with approximate Naira costs
\`.trim();
}

export async function POST(request) {
  const { profile } = await request.json();

  // 1. Pull relevant food subset from DB based on profile
  const foods = await getFoodsForProfile({
    conditions: profile.conditions,
    budget_tier: profile.weeklyBudget_NGN < 5000 ? "low" : profile.weeklyBudget_NGN < 15000 ? "mid" : "high",
    excluded: profile.excludedFoods || [],
    limit: 150,
  });

  // 2. Pull clinical rules for user's conditions
  const clinicalRules = buildClinicalRules(profile.conditions);

  // 3. Call Gemini Pro with JSON output schema enforced
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: MEAL_PLAN_SCHEMA,
      temperature: 0.4,    // Low temp for consistent structured output
      maxOutputTokens: 8192,
    },
  });

  const result = await model.generateContent(
    buildMealPlanPrompt(profile, foods, clinicalRules)
  );

  const parsed = JSON.parse(result.response.text());
  return Response.json(parsed);
}

function buildClinicalRules(conditions) {
  const rules = [];
  if (conditions.includes("hypertension")) {
    rules.push("HYPERTENSION: Sodium ≤1500mg/day. Avoid Maggi cubes — use crayfish/iru instead. Prioritize beans, plantain, oats. No processed meats.");
  }
  if (conditions.includes("diabetes") || conditions.includes("pcos")) {
    rules.push("GLYCEMIC: Glycemic load must be low-medium. Avoid pounded yam as only carb — pair with fiber (vegetables). Prefer unripe plantain, beans, oat ogi. Max portion of high-GI swallows = 1 ball.");
  }
  if (conditions.includes("pregnancy")) {
    rules.push("PREGNANCY: Folate ≥400mcg/day (ugu, moi moi, spinach). Iron ≥27mg/day. Avoid raw fish, undercooked meat, excess vitamin A (no liver >once/week). Include DHA sources (titus, sardine).");
  }
  if (conditions.includes("anemia")) {
    rules.push("ANEMIA: Iron-rich foods at every meal. Pair iron sources with vitamin C (tomatoes, peppers). Avoid tea/coffee within 1 hour of iron-rich meals.");
  }
  return rules.join("\\n") || "General wellness — balanced macros, varied Nigerian staples.";
}
`;


// ── REACT: Meal Plan Card renderer ──────────────────────────────────────────

export const MEAL_PLAN_COMPONENT = `
import { useState } from "react";
import { gsap } from "gsap";

export function MealPlanCard({ meal, index }) {
  const [expanded, setExpanded] = useState(false);

  function handleToggle() {
    setExpanded(v => !v);
    // GSAP micro-animation on expand
    gsap.from(\`.meal-details-\${index}\`, {
      height: 0, opacity: 0, duration: 0.35, ease: "power2.out",
    });
  }

  return (
    <div className="meal-card" onClick={handleToggle}>
      <div className="meal-card-header">
        <span className="meal-type">{meal.mealType}</span>
        <h3 className="meal-name">{meal.dishName}</h3>
        <span className="meal-cal">{meal.calories} kcal</span>
        <span className="meal-cost">₦{meal.cost_NGN}</span>
      </div>

      {expanded && (
        <div className={\`meal-details meal-details-\${index}\`}>
          <div className="macro-row">
            <span>Protein: {meal.protein_g}g</span>
            <span>Carbs: {meal.carbs_g}g</span>
            <span>Fat: {meal.fat_g}g</span>
          </div>
          <div className="meal-portion">Portion: {meal.portion}</div>
          {meal.prepTime_min && (
            <div className="meal-prep">Prep: ~{meal.prepTime_min} min</div>
          )}
          {meal.cycleNote && (
            <div className="cycle-note">🌸 {meal.cycleNote}</div>
          )}
          {meal.clinicalNote && (
            <div className="clinical-note">⚕️ {meal.clinicalNote}</div>
          )}
        </div>
      )}
    </div>
  );
}
`;
