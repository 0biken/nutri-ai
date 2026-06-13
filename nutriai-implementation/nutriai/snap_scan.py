# snap_scan.py  —  Gemini Vision integration for Snap & Scan
# POST /api/scan  { image: base64 }  →  { dish, macros, confidence }

import os, base64, json
import google.generativeai as genai
from PIL import Image
import io

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-1.5-flash")

SYSTEM_PROMPT = """
You are a Nigerian nutrition expert with deep knowledge of local cuisine.
You will receive a photo of a meal. Your job is to:
1. Identify the Nigerian dish(es) in the image
2. Estimate portion size (small / medium / large / buka-sized)
3. Return macronutrient data grounded in the Nigerian Food Intelligence Database

IMPORTANT RULES:
- Only identify dishes from Nigerian or West African cuisine
- Distinguish preparation variants: palm-oil heavy vs light, boiled vs fried, Buka vs home-cooked
- If the dish is unclear, return your best guess with a low confidence score
- Never invent foods not in Nigerian cuisine
- Always return valid JSON — no markdown, no prose

Return ONLY this JSON structure:
{
  "dish_name": "string (e.g. Egusi soup with pounded yam)",
  "components": ["egusi soup", "pounded yam"],
  "portion_size": "medium",
  "preparation_variant": "palm-oil heavy, Buka-style",
  "confidence": 0.92,
  "nutrition": {
    "calories": 687,
    "protein_g": 24,
    "carbs_g": 82,
    "fat_g": 28,
    "fiber_g": 6,
    "sodium_mg": 890,
    "iron_mg": 4.2,
    "glycemic_index": 68
  },
  "clinical_flags": ["high_sodium", "high_gi"],
  "notes": "Palm oil content increases saturated fat. Pounded yam has higher GI than amala."
}
"""

def scan_meal(image_bytes: bytes) -> dict:
    """
    Accepts raw image bytes, returns structured nutrition data.
    Grounds the response against the Nigerian Food Database context.
    """
    image = Image.open(io.BytesIO(image_bytes))

    # Inject a subset of the food database as grounding context
    # In production, use pgvector similarity search to retrieve the
    # most relevant 20-30 foods based on visual classification
    db_context = load_food_db_context(top_n=30)

    prompt = f"""
{SYSTEM_PROMPT}

NIGERIAN FOOD DATABASE REFERENCE (use these verified values):
{db_context}

Analyse the meal in this image and return JSON only.
"""

    response = model.generate_content(
        [prompt, image],
        generation_config=genai.types.GenerationConfig(
            response_mime_type="application/json",  # Forces JSON output
            temperature=0.1,                         # Low temp = factual, consistent
            max_output_tokens=512,
        )
    )

    result = json.loads(response.text)
    return enrich_with_db(result)   # Cross-reference with verified DB values


def enrich_with_db(gemini_result: dict) -> dict:
    """
    Cross-references Gemini's estimate with the verified food DB.
    If a high-confidence DB match exists, replace Gemini's values with
    verified ones. Gemini handles identification; DB handles accuracy.
    """
    for component in gemini_result.get("components", []):
        db_match = query_food_db(component)
        if db_match and db_match["confidence"] > 0.85:
            # Merge: DB values override Gemini estimates for matched components
            gemini_result["nutrition"] = merge_nutrition(
                gemini_result["nutrition"],
                db_match["nutrition"],
                gemini_result["portion_size"]
            )
            gemini_result["db_verified"] = True
    return gemini_result


def load_food_db_context(top_n: int = 30) -> str:
    """
    In production: query pgvector with the image embedding to retrieve
    the most semantically similar foods. For hackathon: return a static
    subset of your top Nigerian staples as JSON string.
    """
    # Placeholder — replace with real DB query
    sample = [
        {"name": "Egusi soup", "calories_per_100g": 214, "protein_g": 7.2, "fat_g": 16, "carbs_g": 11},
        {"name": "Pounded yam", "calories_per_100g": 118, "protein_g": 1.5, "fat_g": 0.2, "carbs_g": 27, "gi": 72},
        {"name": "Jollof rice", "calories_per_100g": 160, "protein_g": 3.2, "fat_g": 4.1, "carbs_g": 28, "gi": 65},
        {"name": "Moi moi", "calories_per_100g": 135, "protein_g": 8.4, "fat_g": 6.2, "carbs_g": 12},
        {"name": "Suya", "calories_per_100g": 290, "protein_g": 28, "fat_g": 18, "carbs_g": 4},
    ]
    return json.dumps(sample, indent=2)


def query_food_db(food_name: str) -> dict | None:
    """Stub — replace with real pgvector similarity search."""
    return None


def merge_nutrition(gemini_vals, db_vals, portion_size):
    """Apply portion size multiplier to DB values."""
    multipliers = {"small": 0.7, "medium": 1.0, "large": 1.4, "buka-sized": 1.8}
    mult = multipliers.get(portion_size, 1.0)
    return {k: round(v * mult, 1) for k, v in db_vals.items()}


# ── FastAPI route ────────────────────────────────────────────────────────
from fastapi import FastAPI, UploadFile
from fastapi.responses import JSONResponse

app = FastAPI()

@app.post("/api/scan")
async def scan_route(file: UploadFile):
    image_bytes = await file.read()
    try:
        result = scan_meal(image_bytes)
        return JSONResponse(result)
    except json.JSONDecodeError:
        return JSONResponse({"error": "Could not parse dish"}, status_code=422)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
