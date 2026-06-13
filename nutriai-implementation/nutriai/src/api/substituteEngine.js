/**
 * Smart Substitute Engine — Gemini Function Calling
 *
 * Trigger: user says "I can't find X" / "X is too expensive" / budget exceeded
 * Flow:
 *  1. Gemini receives the user's constraint (availability or budget)
 *  2. Gemini calls check_ingredient_price() to verify real cost
 *  3. Gemini calls find_substitutes() to query our DB for clinical equivalents
 *  4. Gemini reasons over the results and returns the best swap + explanation
 *
 * This is function calling, not RAG — Gemini decides WHEN to call tools
 * and WHICH tools based on the conversation. We just implement the tools.
 */

// ── SERVER SIDE (app/api/substitute/route.js) ────────────────────────────────

export const SUBSTITUTE_SERVER = `
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Tool definitions ─────────────────────────────────────────────────────────
const SUBSTITUTE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "check_ingredient_price",
        description: "Get the current approximate market price in Naira for an ingredient in Nigerian open markets",
        parameters: {
          type: "OBJECT",
          properties: {
            ingredient: { type: "STRING", description: "Ingredient name e.g. 'titus fish', 'ponmo', 'unripe plantain'" },
            quantity:   { type: "STRING", description: "Quantity e.g. '1 piece', '500g', '1 wrap'" },
          },
          required: ["ingredient"],
        },
      },
      {
        name: "find_clinical_substitutes",
        description: "Find nutritionally equivalent Nigerian food substitutes that meet clinical requirements for a specific condition",
        parameters: {
          type: "OBJECT",
          properties: {
            originalFood:  { type: "STRING", description: "The food to replace" },
            conditions:    {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "User conditions that the substitute must be safe for",
            },
            maxCost_NGN:   { type: "NUMBER", description: "Maximum cost per portion in Naira" },
            mustMatch:     {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Nutritional properties that must match: protein | iron | fiber | low_glycemic | low_sodium",
            },
          },
          required: ["originalFood"],
        },
      },
      {
        name: "get_nutrient_equivalence",
        description: "Check whether substitute B is nutritionally equivalent to food A for a given condition and nutrient target",
        parameters: {
          type: "OBJECT",
          properties: {
            foodA: { type: "STRING" },
            foodB: { type: "STRING" },
            nutrient: { type: "STRING", description: "protein_g | iron_mg | sodium_mg | glycemic_load | calories" },
          },
          required: ["foodA", "foodB", "nutrient"],
        },
      },
    ],
  },
];

// ── Tool implementations ─────────────────────────────────────────────────────
async function executeTool(name, args) {
  switch (name) {
    case "check_ingredient_price": {
      // In production: query NBS market price API or your scraped price table
      // For hackathon: static price table from our DB seeded with NBS data
      const result = await db.query(
        "SELECT ingredient, price_NGN, unit, last_updated FROM market_prices WHERE ingredient ILIKE $1 LIMIT 1",
        [\`%\${args.ingredient}%\`]
      );
      if (!result.rows[0]) {
        return { found: false, note: "Price not in database — use approximate market rate" };
      }
      return {
        found: true,
        ingredient: result.rows[0].ingredient,
        price_NGN: result.rows[0].price_NGN,
        unit: result.rows[0].unit,
        lastUpdated: result.rows[0].last_updated,
      };
    }

    case "find_clinical_substitutes": {
      // Vector similarity search — finds foods with similar nutritional profiles
      // filtered by condition safety and cost ceiling
      const conditions = args.conditions || [];
      const maxCost    = args.maxCost_NGN || 99999;

      let query = \`
        SELECT
          f.name,
          f.calories,
          f.protein_g,
          f.iron_mg,
          f.sodium_mg,
          f.glycemic_load,
          f.avg_cost_NGN,
          f.safe_for_conditions
        FROM nigerian_foods f
        WHERE f.avg_cost_NGN <= $1
          AND f.name NOT ILIKE $2
      \`;

      const params = [maxCost, \`%\${args.originalFood}%\`];

      // Dynamically add condition safety filters
      conditions.forEach((c, i) => {
        query += \` AND $\${params.length + 1} = ANY(f.safe_for_conditions)\`;
        params.push(c);
      });

      if (args.mustMatch?.includes("low_sodium")) {
        query += " AND f.sodium_mg < 200";
      }
      if (args.mustMatch?.includes("low_glycemic")) {
        query += " AND f.glycemic_load = 'low'";
      }
      if (args.mustMatch?.includes("protein")) {
        query += " AND f.protein_g >= 10";
      }

      query += " ORDER BY f.avg_cost_NGN ASC LIMIT 5";

      const results = await db.query(query, params);
      return { substitutes: results.rows };
    }

    case "get_nutrient_equivalence": {
      const [a, b] = await Promise.all([
        db.query("SELECT * FROM nigerian_foods WHERE name ILIKE $1 LIMIT 1", [\`%\${args.foodA}%\`]),
        db.query("SELECT * FROM nigerian_foods WHERE name ILIKE $1 LIMIT 1", [\`%\${args.foodB}%\`]),
      ]);

      if (!a.rows[0] || !b.rows[0]) return { error: "One or both foods not found" };

      const nutrient = args.nutrient;
      const valA = a.rows[0][nutrient];
      const valB = b.rows[0][nutrient];
      const pctDiff = Math.abs((valB - valA) / valA * 100).toFixed(1);

      return {
        foodA: args.foodA, [nutrient + "_A"]: valA,
        foodB: args.foodB, [nutrient + "_B"]: valB,
        percentDifference: pctDiff + "%",
        equivalent: parseFloat(pctDiff) <= 20,
      };
    }

    default:
      return { error: "Unknown tool: " + name };
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  const { userMessage, currentMeal, userProfile } = await request.json();

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",  // Flash is fast enough here — simpler reasoning
    tools: SUBSTITUTE_TOOLS,
    systemInstruction: \`
You are the Smart Substitutes engine for NutriAI.
A user needs to replace a food in their meal plan.

Current meal they're replacing from: \${JSON.stringify(currentMeal)}
User conditions: \${userProfile.conditions?.join(", ") || "none"}
Weekly budget: ₦\${userProfile.weeklyBudget_NGN}

When given a constraint:
1. Use check_ingredient_price to verify the cost of the original and substitute
2. Use find_clinical_substitutes to get options that fit conditions and budget  
3. Use get_nutrient_equivalence to confirm the best option maintains nutrition targets
4. Return your recommendation in plain conversational Nigerian English

Always explain WHY the substitute works clinically — not just that it's cheaper.
Keep your response to 2-3 sentences max.
    \`.trim(),
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
  });

  const chat = model.startChat();
  let response = await chat.sendMessage(userMessage);

  // Agentic tool loop
  while (true) {
    const parts = response.response.candidates?.[0]?.content?.parts || [];
    const toolCalls = parts.filter(p => p.functionCall);

    if (!toolCalls.length) {
      const text = parts.filter(p => p.text).map(p => p.text).join("");
      return Response.json({ substitute: text });
    }

    const toolResults = await Promise.all(
      toolCalls.map(async p => ({
        functionResponse: {
          name: p.functionCall.name,
          response: await executeTool(p.functionCall.name, p.functionCall.args),
        },
      }))
    );

    response = await chat.sendMessage(toolResults);
  }
}
`;


// ── REACT: Substitute trigger in meal plan UI ────────────────────────────────

export const SUBSTITUTE_COMPONENT = `
import { useState } from "react";
import { gsap } from "gsap";

export function SubstituteButton({ meal, userProfile }) {
  const [loading, setLoading] = useState(false);
  const [substitute, setSubstitute] = useState(null);

  async function requestSubstitute() {
    setLoading(true);
    try {
      const res = await fetch("/api/substitute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: \`I can't find \${meal.dishName} / it's too expensive for my budget\`,
          currentMeal: meal,
          userProfile,
        }),
      });
      const { substitute } = await res.json();
      setSubstitute(substitute);

      // Animate the substitute card in
      gsap.from(".substitute-result", {
        opacity: 0, y: 12, duration: 0.4, ease: "power2.out",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="substitute-wrap">
      <button
        className="substitute-btn"
        onClick={requestSubstitute}
        disabled={loading}
      >
        {loading ? "Finding substitute…" : "Can't find this? Swap it →"}
      </button>

      {substitute && (
        <div className="substitute-result">
          <span className="substitute-icon">↻</span>
          {substitute}
        </div>
      )}
    </div>
  );
}
`;
