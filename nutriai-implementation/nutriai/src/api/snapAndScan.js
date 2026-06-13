/**
 * Snap & Scan — Gemini 1.5 Flash Vision integration
 *
 * Flow:
 *  1. User captures / uploads a photo
 *  2. Image → base64
 *  3. POST to /api/scan with base64 + user context
 *  4. Server sends image + grounding prompt to Gemini Vision
 *  5. Gemini returns structured JSON → macros populated in UI
 *
 * Why Flash over Pro here: latency matters for a scan feature.
 * Flash handles food recognition at ~600ms vs Pro's ~2s.
 * Escalate to Pro only if confidence score < 0.6.
 */

// ── CLIENT SIDE ──────────────────────────────────────────────────────────────

/**
 * Converts a File/Blob from the camera to base64.
 */
export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Main client call — takes a File object, returns NutriAI scan result.
 * @param {File} imageFile
 * @param {{ userId: string, conditions: string[], cyclePhase?: string }} userCtx
 * @returns {Promise<ScanResult>}
 */
export async function scanDish(imageFile, userCtx) {
  const base64 = await fileToBase64(imageFile);

  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: base64,
      mimeType: imageFile.type,       // "image/jpeg" | "image/png" | "image/webp"
      userContext: userCtx,
    }),
  });

  if (!res.ok) throw new Error(`Scan failed: ${res.status}`);
  return res.json(); // → ScanResult
}


// ── SERVER SIDE (Next.js API route: /api/scan/route.js) ──────────────────────
// Paste this into your Next.js app/api/scan/route.js

export const SERVER_HANDLER = `
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Grounding prompt — forces Gemini to reason from our DB, not generic web ──
function buildScanPrompt(userContext) {
  const conditionNote = userContext.conditions?.length
    ? \`The user manages: \${userContext.conditions.join(", ")}. Flag any ingredients that conflict with these conditions.\`
    : "";

  const cycleNote = userContext.cyclePhase
    ? \`The user is in the \${userContext.cyclePhase} phase of their menstrual cycle. Note any foods particularly beneficial or detrimental for this phase.\`
    : "";

  return \`
You are the food recognition engine for NutriAI, a Nigerian nutrition platform.
Analyze the food image and identify the Nigerian dish(es) present.

CRITICAL RULES:
- You MUST identify Nigerian dishes ONLY using names from Nigerian cuisine
  (e.g. "Egusi soup", "Pounded yam", "Jollof rice with chicken", NOT "vegetable stew")
- Differentiate between Buka-style portions (larger, more oil) and home-cooked
- If multiple components are present, list each separately
- If you cannot identify the dish with >60% confidence, return confidence: "low"
  and your best guess

\${conditionNote}
\${cycleNote}

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "dishName": "string — primary dish name in Nigerian English",
  "components": ["string", ...],
  "servingStyle": "buka" | "home" | "restaurant" | "unknown",
  "portionEstimate": "small" | "medium" | "large",
  "confidence": "high" | "medium" | "low",
  "nutrition": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number,
    "sodium_mg": number,
    "iron_mg": number
  },
  "glycemicLoad": "low" | "medium" | "high",
  "clinicalFlags": [
    {
      "condition": "string",
      "flag": "caution" | "avoid" | "beneficial",
      "reason": "string — one sentence max"
    }
  ],
  "cycleNote": "string | null — one sentence about this food for user cycle phase"
}
\`.trim();
}

export async function POST(request) {
  try {
    const { imageBase64, mimeType, userContext } = await request.json();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      {
        inlineData: { mimeType, data: imageBase64 },
      },
      buildScanPrompt(userContext),
    ]);

    const raw = result.response.text().trim();

    // Strip any accidental markdown fences
    const clean = raw.replace(/^\`\`\`json|^\`\`\`|^\`\`\`$/gm, "").trim();
    const parsed = JSON.parse(clean);

    // If confidence is low → re-run with Pro
    if (parsed.confidence === "low") {
      const proModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const proResult = await proModel.generateContent([
        { inlineData: { mimeType, data: imageBase64 } },
        buildScanPrompt(userContext),
      ]);
      const proRaw = proResult.response.text().trim().replace(/^\`\`\`json|^\`\`\`|\`\`\`$/gm, "").trim();
      return Response.json(JSON.parse(proRaw));
    }

    return Response.json(parsed);
  } catch (err) {
    console.error("Scan error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
`;


// ── REACT COMPONENT (Snap & Scan UI) ────────────────────────────────────────

export const SNAP_SCAN_COMPONENT = `
import { useState, useRef } from "react";
import { scanDish } from "@/api/snapAndScan";

export function SnapScan({ userContext }) {
  const [state, setState] = useState("idle"); // idle | scanning | result | error
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setState("scanning");
    try {
      const data = await scanDish(file, userContext);
      setResult(data);
      setState("result");
    } catch (e) {
      setState("error");
    }
  }

  return (
    <div className="snap-scan-wrap">
      {state === "idle" && (
        <button
          className="snap-btn"
          onClick={() => inputRef.current?.click()}
        >
          <CameraIcon /> Snap your meal
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"   // opens rear camera on mobile
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {preview && (
        <div className="snap-preview">
          <img src={preview} alt="Captured meal" />
          {state === "scanning" && (
            <div className="scan-overlay">
              <ScanAnimation />
              <span>Identifying dish…</span>
            </div>
          )}
        </div>
      )}

      {state === "result" && result && (
        <ScanResult data={result} />
      )}
    </div>
  );
}

function ScanResult({ data }) {
  return (
    <div className="scan-result-card">
      <div className="scan-dish-name">{data.dishName}</div>
      <div className="scan-confidence" data-level={data.confidence}>
        {data.confidence} confidence · {data.servingStyle}
      </div>
      <div className="macro-grid">
        <MacroPill label="Cal"     value={data.nutrition.calories}   unit="" />
        <MacroPill label="Protein" value={data.nutrition.protein_g}  unit="g" />
        <MacroPill label="Carbs"   value={data.nutrition.carbs_g}    unit="g" />
        <MacroPill label="Fat"     value={data.nutrition.fat_g}      unit="g" />
        <MacroPill label="Sodium"  value={data.nutrition.sodium_mg}  unit="mg" />
      </div>
      {data.clinicalFlags?.length > 0 && (
        <div className="clinical-flags">
          {data.clinicalFlags.map((f, i) => (
            <div key={i} className={\`flag flag-\${f.flag}\`}>
              <strong>{f.condition}</strong>: {f.reason}
            </div>
          ))}
        </div>
      )}
      {data.cycleNote && (
        <div className="cycle-note">🌸 {data.cycleNote}</div>
      )}
    </div>
  );
}
`;
