import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ status: "missing-key" });
  }
  const started = Date.now();
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent("Reply with the single word: OK");
    const echo = result.response.text().trim();
    return NextResponse.json({
      status: "ok",
      model: "gemini-flash-latest",
      echo,
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    console.error("health error", err);
    return NextResponse.json(
      { status: "error", message: err.message || "unknown" },
      { status: 500 },
    );
  }
}
