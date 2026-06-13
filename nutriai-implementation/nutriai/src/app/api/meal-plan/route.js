import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { getFoodsForProfile } from "@/lib/db";

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

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
          day: { type: SchemaType.STRING },
          meals: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                mealType: { type: SchemaType.STRING },
                dishName: { type: SchemaType.STRING },
                portion: { type: SchemaType.STRING },
                calories: { type: SchemaType.NUMBER },
                protein_g: { type: SchemaType.NUMBER },
                carbs_g: { type: SchemaType.NUMBER },
                fat_g: { type: SchemaType.NUMBER },
                cost_NGN: { type: SchemaType.NUMBER },
                prepTime_min: { type: SchemaType.NUMBER },
                cycleNote: { type: SchemaType.STRING },
                clinicalNote: { type: SchemaType.STRING },
              },
              required: ["mealType", "dishName", "portion", "calories", "cost_NGN"],
            },
          },
          dayTotal_calories: { type: SchemaType.NUMBER },
          dayTotal_cost_NGN: { type: SchemaType.NUMBER },
        },
        required: ["day", "meals", "dayTotal_calories", "dayTotal_cost_NGN"],
      },
    },
    shoppingList: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ingredient: { type: SchemaType.STRING },
          quantity: { type: SchemaType.STRING },
          cost_NGN: { type: SchemaType.NUMBER },
          market: { type: SchemaType.STRING },
        },
      },
    },
    nutritionSummary: {
      type: SchemaType.OBJECT,
      properties: {
        avgDailyCalories: { type: SchemaType.NUMBER },
        avgProtein_g: { type: SchemaType.NUMBER },
        avgCarbs_g: { type: SchemaType.NUMBER },
        avgFat_g: { type: SchemaType.NUMBER },
        totalWeeklyCost: { type: SchemaType.NUMBER },
        clinicalCompliance: { type: SchemaType.STRING },
      },
    },
  },
  required: ["planTitle", "weeklyBudget_NGN", "days", "shoppingList", "nutritionSummary"],
};

function buildClinicalRules(conditions = []) {
  const rules = [];
  if (conditions.includes("hypertension")) rules.push("HYPERTENSION: Sodium ≤1500mg/day. Avoid Maggi cubes — use crayfish/iru instead. No processed meats.");
  if (conditions.includes("diabetes") || conditions.includes("pcos")) rules.push("GLYCEMIC: Glycemic load must be low-medium. Pair carbs with fiber. Max 1 ball of high-GI swallow per meal.");
  if (conditions.includes("pregnancy")) rules.push("PREGNANCY: Folate ≥400mcg/day. Iron ≥27mg/day. Avoid raw fish, excess vitamin A.");
  if (conditions.includes("anemia")) rules.push("ANEMIA: Iron-rich foods every meal. Pair with vitamin C. Avoid tea/coffee within 1hr of iron meals.");
  return rules.join("\n") || "General wellness — balanced macros, varied Nigerian staples.";
}

function buildPrompt(profile, foods, clinicalRules) {
  return `
You are NutriAI's meal planning engine for Nigerian users.
Generate a 7-day meal plan that strictly follows all rules.

== USER PROFILE ==
Age: ${profile.age} | Sex: ${profile.sex} | Weight: ${profile.weight_kg}kg
Conditions: ${profile.conditions?.join(", ") || "None"}
Cycle phase: ${profile.cyclePhase || "N/A"}
Weekly budget: ₦${profile.weeklyBudget_NGN}
Daily calorie target: ${profile.dailyCalorieTarget} kcal
Excluded foods: ${profile.excludedFoods?.join(", ") || "None"}
Goal: ${profile.goal}

== CLINICAL RULES ==
${clinicalRules}

== AVAILABLE FOODS (use ONLY these) ==
${JSON.stringify(foods, null, 2)}

== RULES ==
1. Every meal MUST use foods from the list.
2. Daily cost ≤ weeklyBudget/7 ± 10%.
3. Daily calories within ±50 kcal of target.
4. Breakfast ≤400 kcal, Lunch ≥500 kcal, Dinner moderate.
5. Use Nigerian meal naming. Rotate proteins. Add cycleNote / clinicalNote where relevant.
6. Include a realistic Nigerian market shopping list with Naira costs.
`.trim();
}

export async function POST(request) {
  try {
    if (!genAI) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured. Add it to .env.local to generate meal plans." },
        { status: 503 },
      );
    }
    const { profile } = await request.json();
    if (!profile) return NextResponse.json({ error: "profile required" }, { status: 400 });

    const foods = await getFoodsForProfile({
      conditions: profile.conditions || [],
      excluded: profile.excludedFoods || [],
      limit: 150,
    });

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: MEAL_PLAN_SCHEMA,
        temperature: 0.4,
        maxOutputTokens: 8192,
      },
    });

    const result = await model.generateContent(
      buildPrompt(profile, foods, buildClinicalRules(profile.conditions)),
    );

    return NextResponse.json(JSON.parse(result.response.text()));
  } catch (err) {
    console.error("meal-plan error", err);
    return NextResponse.json({ error: err.message || "meal plan failed" }, { status: 500 });
  }
}
