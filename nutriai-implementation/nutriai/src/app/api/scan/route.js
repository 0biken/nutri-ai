import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

function buildScanPrompt(userContext = {}) {
  const conditions = userContext.conditions?.length
    ? `The user manages: ${userContext.conditions.join(", ")}. Flag any ingredients that conflict.`
    : "";
  const cycle = userContext.cyclePhase
    ? `User is in the ${userContext.cyclePhase} phase of their menstrual cycle. Note relevant impacts.`
    : "";
  return `
You are the food recognition engine for NutriAI, a Nigerian nutrition platform.
Identify the Nigerian dish(es) in the image using Nigerian English names (e.g. "Egusi soup", "Jollof rice", not "vegetable stew").
Differentiate buka-style vs home-cooked portions. If confidence < 60%, return confidence: "low".

${conditions}
${cycle}

Return ONLY valid JSON matching this schema (no markdown):
{
  "dishName": "string",
  "components": ["string"],
  "servingStyle": "buka" | "home" | "restaurant" | "unknown",
  "portionEstimate": "small" | "medium" | "large",
  "confidence": "high" | "medium" | "low",
  "nutrition": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number, "sodium_mg": number, "iron_mg": number },
  "glycemicLoad": "low" | "medium" | "high",
  "clinicalFlags": [{ "condition": "string", "flag": "caution" | "avoid" | "beneficial", "reason": "string" }],
  "cycleNote": "string | null"
}`.trim();
}

function stripFences(s) {
  return s.replace(/^```json|^```|```$/gm, "").trim();
}

export async function POST(request) {
  try {
    if (!genAI) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured. Add it to .env.local to enable scan." },
        { status: 503 },
      );
    }
    const { imageBase64, mimeType, userContext } = await request.json();
    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "imageBase64 and mimeType required" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent([
      { inlineData: { mimeType, data: imageBase64 } },
      buildScanPrompt(userContext),
    ]);

    const parsed = JSON.parse(stripFences(result.response.text().trim()));

    if (parsed.confidence === "low") {
      const pro = genAI.getGenerativeModel({ model: "gemini-pro-latest" });
      const proRes = await pro.generateContent([
        { inlineData: { mimeType, data: imageBase64 } },
        buildScanPrompt(userContext),
      ]);
      return NextResponse.json(JSON.parse(stripFences(proRes.response.text().trim())));
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("scan error", err);
    return NextResponse.json({ error: err.message || "scan failed" }, { status: 500 });
  }
}
