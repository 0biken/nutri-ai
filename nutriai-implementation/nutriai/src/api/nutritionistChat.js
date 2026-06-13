/**
 * AI Nutritionist Chat — Gemini ADK agent with RAG
 *
 * Architecture:
 *  - Gemini 1.5 Pro as the base LLM
 *  - RAG over clinical protocols (chunked dietitian guidelines stored in pgvector)
 *  - Language detection → responds in English, Pidgin, Yoruba, Igbo, or Hausa
 *  - Multi-turn conversation history kept in React state, sent fresh each call
 *  - Tool: query_food_db — lets the agent look up specific foods on demand
 *  - Tool: get_user_plan  — lets the agent reference current user meal plan
 *
 * Why not streaming for the hackathon:
 *  Non-streaming is simpler to implement in 48hrs and works fine for chat.
 *  Add streaming post-hackathon with Vercel AI SDK's useChat hook.
 */

// ── SERVER SIDE (app/api/chat/route.js) ──────────────────────────────────────

export const CHAT_SERVER = `
import { GoogleGenerativeAI } from "@google/generative-ai";
import { vectorSearch } from "@/lib/pgvector";   // RAG retrieval helper
import { db } from "@/lib/db";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Tool definitions — Gemini can call these during reasoning ──────────────
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "query_food_database",
        description: "Look up nutritional information for a specific Nigerian food item",
        parameters: {
          type: "OBJECT",
          properties: {
            foodName: {
              type: "STRING",
              description: "The Nigerian food to look up, e.g. 'egusi soup', 'moi moi'",
            },
            fields: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Which fields to return: calories, protein_g, carbs_g, fat_g, sodium_mg, glycemic_load, etc.",
            },
          },
          required: ["foodName"],
        },
      },
      {
        name: "get_clinical_protocol",
        description: "Retrieve the clinical dietary protocol for a specific health condition",
        parameters: {
          type: "OBJECT",
          properties: {
            condition: {
              type: "STRING",
              description: "The condition: hypertension | diabetes | pcos | pregnancy | anemia | obesity",
            },
            aspect: {
              type: "STRING",
              description: "Specific aspect to retrieve: foods_to_avoid | foods_to_prioritize | sample_meal | daily_targets",
            },
          },
          required: ["condition"],
        },
      },
    ],
  },
];

// ── Tool execution — called when Gemini triggers a function ──────────────────
async function executeTool(name, args) {
  if (name === "query_food_database") {
    const food = await db.query(
      "SELECT * FROM nigerian_foods WHERE name ILIKE $1 LIMIT 1",
      [\`%\${args.foodName}%\`]
    );
    return food.rows[0] || { error: "Food not found in database" };
  }

  if (name === "get_clinical_protocol") {
    const rows = await db.query(
      "SELECT * FROM clinical_protocols WHERE condition = $1",
      [args.condition]
    );
    const protocol = rows.rows[0];
    if (!protocol) return { error: "Protocol not found" };
    return args.aspect ? { [args.aspect]: protocol[args.aspect] } : protocol;
  }

  return { error: "Unknown tool" };
}

// ── RAG retrieval — pulls relevant clinical chunks from pgvector ─────────────
async function retrieveContext(userMessage, conditions) {
  const chunks = await vectorSearch({
    query: userMessage,
    filter: conditions.length
      ? \`condition = ANY(ARRAY[\${conditions.map(c => \`'\${c}'\`).join(",")}])\`
      : null,
    limit: 4,
  });
  if (!chunks.length) return "";
  return "== RELEVANT CLINICAL CONTEXT ==\\n" +
    chunks.map(c => c.content).join("\\n\\n");
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(userProfile, ragContext) {
  return \`
You are Nourish, the AI nutritionist for NutriAI — Nigeria's first clinically intelligent nutrition platform.

PERSONALITY:
- Warm, direct, and confident — like a knowledgeable friend, not a doctor reading a prescription
- Use the user's language: detect whether they write in English, Pidgin, Yoruba, Igbo, or Hausa and RESPOND IN THE SAME LANGUAGE
- Never say "I cannot provide medical advice" — you ARE the nutrition expert. Give clear, actionable guidance
- Reference Nigerian foods by their real names (egusi, not "melon seed soup")

USER PROFILE:
- Name: \${userProfile.name}
- Conditions: \${userProfile.conditions.join(", ") || "General wellness"}
- Cycle phase: \${userProfile.cyclePhase || "N/A"}
- Weekly budget: ₦\${userProfile.weeklyBudget_NGN}
- Goal: \${userProfile.goal}

\${ragContext}

RULES:
1. Always ground advice in Nigerian foods — never recommend quinoa, kale, or other non-local alternatives unless the user asks
2. When a user asks about a specific food, use the query_food_database tool to get accurate data
3. When a user asks about managing a condition, use get_clinical_protocol for evidence-based guidance
4. Keep responses concise — max 3 paragraphs unless explaining a complex clinical topic
5. If the question involves a clinical decision (e.g. "should I stop my medication"), say "speak to your doctor about that part, but from a nutrition perspective..."
\`.trim();
}

export async function POST(request) {
  const { messages, userProfile } = await request.json();

  const latestMessage = messages[messages.length - 1].content;

  // 1. RAG retrieval based on latest message + user conditions
  const ragContext = await retrieveContext(latestMessage, userProfile.conditions || []);

  // 2. Build the model with tools
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    systemInstruction: buildSystemPrompt(userProfile, ragContext),
    tools: TOOLS,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  });

  // 3. Start chat with full history (stateless — we send everything each time)
  const chat = model.startChat({
    history: messages.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  });

  let response = await chat.sendMessage(latestMessage);
  let responseText = "";

  // 4. Agentic loop — handle tool calls until Gemini stops calling tools
  while (true) {
    const candidate = response.response.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    const toolCalls = parts.filter(p => p.functionCall);
    if (!toolCalls.length) {
      // No more tool calls — extract final text response
      responseText = parts.filter(p => p.text).map(p => p.text).join("");
      break;
    }

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      toolCalls.map(async (part) => ({
        functionResponse: {
          name: part.functionCall.name,
          response: await executeTool(part.functionCall.name, part.functionCall.args),
        },
      }))
    );

    // Send tool results back to Gemini
    response = await chat.sendMessage(toolResults);
  }

  return Response.json({ message: responseText });
}
`;


// ── REACT: Chat UI component ─────────────────────────────────────────────────

export const CHAT_COMPONENT = `
import { useState, useRef, useEffect } from "react";
import { gsap } from "gsap";

export function NutritionistChat({ userProfile }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: \`Hi \${userProfile.name}! I'm Nourish, your AI nutritionist. Ask me anything about your meal plan, your \${userProfile.conditions[0] || "health goals"}, or any Nigerian food.\`,
    },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Animate each new message in
  useEffect(() => {
    const last = document.querySelector(".chat-message:last-child");
    if (last) {
      gsap.from(last, { opacity: 0, y: 16, duration: 0.35, ease: "power2.out" });
    }
  }, [messages.length]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, userProfile }),
      });
      const { message } = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: message }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Network error — try again.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-wrap">
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={\`chat-message chat-message--\${m.role}\`}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="chat-message chat-message--assistant chat-typing">
            <span/><span/><span/>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask about your meal plan, a Nigerian food, your condition…"
          className="chat-input"
        />
        <button onClick={send} disabled={loading} className="chat-send-btn">
          Send
        </button>
      </div>
    </div>
  );
}
`;
