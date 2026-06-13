import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "check_ingredient_price",
        description: "Get current approximate Nigerian market price for an ingredient",
        parameters: {
          type: "OBJECT",
          properties: {
            ingredient: { type: "STRING" },
            quantity: { type: "STRING" },
          },
          required: ["ingredient"],
        },
      },
      {
        name: "find_clinical_substitutes",
        description: "Find nutritionally equivalent Nigerian substitutes",
        parameters: {
          type: "OBJECT",
          properties: {
            originalFood: { type: "STRING" },
            conditions: { type: "ARRAY", items: { type: "STRING" } },
            maxCost_NGN: { type: "NUMBER" },
            mustMatch: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["originalFood"],
        },
      },
      {
        name: "get_nutrient_equivalence",
        description: "Check whether substitute is nutritionally equivalent for a target nutrient",
        parameters: {
          type: "OBJECT",
          properties: {
            foodA: { type: "STRING" },
            foodB: { type: "STRING" },
            nutrient: { type: "STRING" },
          },
          required: ["foodA", "foodB", "nutrient"],
        },
      },
    ],
  },
];

async function executeTool(name, args) {
  switch (name) {
    case "check_ingredient_price": {
      const r = await db.query(
        "SELECT ingredient, price_NGN, unit, last_updated FROM market_prices WHERE ingredient ILIKE $1 LIMIT 1",
        [`%${args.ingredient}%`],
      );
      if (!r.rows[0]) return { found: false, note: "Price not in database — use approximate market rate" };
      return { found: true, ...r.rows[0] };
    }
    case "find_clinical_substitutes": {
      const maxCost = args.maxCost_NGN || 99999;
      const r = await db.query(
        "SELECT name, calories, protein_g, iron_mg, sodium_mg, glycemic_load, avg_cost_NGN, safe_for_conditions FROM nigerian_foods WHERE avg_cost_NGN <= $1 AND name NOT ILIKE $2",
        [maxCost, `%${args.originalFood}%`],
      );
      return { substitutes: r.rows };
    }
    case "get_nutrient_equivalence": {
      const [a, b] = await Promise.all([
        db.query("SELECT * FROM nigerian_foods WHERE name ILIKE $1 LIMIT 1", [`%${args.foodA}%`]),
        db.query("SELECT * FROM nigerian_foods WHERE name ILIKE $1 LIMIT 1", [`%${args.foodB}%`]),
      ]);
      if (!a.rows[0] || !b.rows[0]) return { error: "One or both foods not found" };
      const n = args.nutrient;
      const va = a.rows[0][n], vb = b.rows[0][n];
      const pct = Math.abs(((vb - va) / va) * 100).toFixed(1);
      return {
        foodA: args.foodA, [n + "_A"]: va,
        foodB: args.foodB, [n + "_B"]: vb,
        percentDifference: pct + "%",
        equivalent: parseFloat(pct) <= 20,
      };
    }
    default:
      return { error: "Unknown tool: " + name };
  }
}

export async function POST(request) {
  try {
    if (!genAI) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured. Add it to .env.local to enable substitutes." },
        { status: 503 },
      );
    }
    const { userMessage, currentMeal = {}, userProfile = {} } = await request.json();
    if (!userMessage) return NextResponse.json({ error: "userMessage required" }, { status: 400 });

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      tools: TOOLS,
      systemInstruction: `
You are the Smart Substitutes engine for NutriAI.
A user needs to replace a food in their meal plan.

Current meal: ${JSON.stringify(currentMeal)}
User conditions: ${userProfile.conditions?.join(", ") || "none"}
Weekly budget: ₦${userProfile.weeklyBudget_NGN || "n/a"}

1. Use check_ingredient_price to verify costs.
2. Use find_clinical_substitutes for safe options.
3. Use get_nutrient_equivalence to confirm the swap.
4. Reply in plain conversational Nigerian English, 2-3 sentences. Explain WHY clinically.
      `.trim(),
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
    });

    const chat = model.startChat();
    let response = await chat.sendMessage(userMessage);

    for (let i = 0; i < 5; i++) {
      const parts = response.response.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter(p => p.functionCall);
      if (!calls.length) {
        const text = parts.filter(p => p.text).map(p => p.text).join("");
        return NextResponse.json({ substitute: text });
      }
      const toolResults = await Promise.all(
        calls.map(async p => ({
          functionResponse: {
            name: p.functionCall.name,
            response: await executeTool(p.functionCall.name, p.functionCall.args),
          },
        })),
      );
      response = await chat.sendMessage(toolResults);
    }
    return NextResponse.json({ substitute: "Couldn't decide on a substitute — try giving more detail." });
  } catch (err) {
    console.error("substitute error", err);
    return NextResponse.json({ error: err.message || "substitute failed" }, { status: 500 });
  }
}
