import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { vectorSearch } from "@/lib/pgvector";
import { db } from "@/lib/db";

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "query_food_database",
        description: "Look up nutrition for a Nigerian food",
        parameters: {
          type: "OBJECT",
          properties: {
            foodName: { type: "STRING" },
            fields: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["foodName"],
        },
      },
      {
        name: "get_clinical_protocol",
        description: "Retrieve clinical dietary protocol for a condition",
        parameters: {
          type: "OBJECT",
          properties: {
            condition: { type: "STRING" },
            aspect: { type: "STRING" },
          },
          required: ["condition"],
        },
      },
    ],
  },
];

async function executeTool(name, args) {
  if (name === "query_food_database") {
    const r = await db.query("SELECT * FROM nigerian_foods WHERE name ILIKE $1 LIMIT 1", [`%${args.foodName}%`]);
    return r.rows[0] || { error: "Food not found" };
  }
  if (name === "get_clinical_protocol") {
    const r = await db.query("SELECT * FROM clinical_protocols WHERE condition = $1", [args.condition]);
    const p = r.rows[0];
    if (!p) return { error: "Protocol not found" };
    return args.aspect ? { [args.aspect]: p[args.aspect] } : p;
  }
  return { error: "Unknown tool" };
}

async function retrieveContext(message, conditions = []) {
  const chunks = await vectorSearch({ query: message, conditions, limit: 4 });
  if (!chunks.length) return "";
  return "== RELEVANT CLINICAL CONTEXT ==\n" + chunks.map(c => c.content).join("\n\n");
}

function systemPrompt(profile, rag) {
  return `
You are Nourish, the AI nutritionist for NutriAI — Nigeria's clinically intelligent nutrition platform.

PERSONALITY:
- Warm, direct, confident — knowledgeable friend, not a prescription
- Detect whether the user writes English, Pidgin, Yoruba, Igbo, or Hausa and respond in the SAME language
- Reference Nigerian foods by their real names

USER PROFILE:
- Name: ${profile.name || "friend"}
- Conditions: ${profile.conditions?.join(", ") || "General wellness"}
- Cycle phase: ${profile.cyclePhase || "N/A"}
- Weekly budget: ₦${profile.weeklyBudget_NGN || "n/a"}
- Goal: ${profile.goal || "general wellness"}

${rag}

RULES:
1. Ground all advice in Nigerian foods.
2. Use query_food_database for specific food data.
3. Use get_clinical_protocol for condition guidance.
4. Max 3 paragraphs unless explaining clinical depth.
5. For clinical decisions like medication, say "speak to your doctor about that part, but from a nutrition perspective…".
`.trim();
}

export async function POST(request) {
  try {
    if (!genAI) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured. Add it to .env.local to enable chat." },
        { status: 503 },
      );
    }
    const { messages, userProfile = {} } = await request.json();
    if (!messages?.length) return NextResponse.json({ error: "messages required" }, { status: 400 });

    const latest = messages[messages.length - 1].content;
    const rag = await retrieveContext(latest, userProfile.conditions || []);

    const model = genAI.getGenerativeModel({
      model: "gemini-pro-latest",
      systemInstruction: systemPrompt(userProfile, rag),
      tools: TOOLS,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    });

    const chat = model.startChat({
      history: messages.slice(0, -1).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    });

    let response = await chat.sendMessage(latest);

    for (let i = 0; i < 5; i++) {
      const parts = response.response.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter(p => p.functionCall);
      if (!calls.length) {
        const text = parts.filter(p => p.text).map(p => p.text).join("");
        return NextResponse.json({ message: text });
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

    return NextResponse.json({ message: "Sorry, I got stuck in a tool loop. Try rephrasing." });
  } catch (err) {
    console.error("chat error", err);
    return NextResponse.json({ error: err.message || "chat failed" }, { status: 500 });
  }
}
