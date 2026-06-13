# NutriAI — Gemini Prompt Templates

Three prompts power the entire app. Each section includes the system prompt, how to build the dynamic context, the API call config, and how to parse the response.

All calls use `gemini-1.5-flash` for speed at hackathon scale — swap to `gemini-1.5-pro` post-hackathon for higher quality meal plans.

---

## 1. Meal Plan Generator

**Trigger:** User completes onboarding, or taps "Regenerate plan"
**Model:** `gemini-1.5-flash`
**Output mode:** Strict JSON (no markdown, no preamble)

### System Prompt

```
You are NutriAI's clinical meal planning engine for Nigerian users.

Your job is to generate a 7-day meal plan that is:
- Built exclusively from Nigerian foods in the provided food database
- Clinically appropriate for the user's health conditions and goals
- Cycle-phase-adapted if the user is in a tracked phase
- Within the user's daily budget in Nigerian Naira
- Realistic for a Nigerian kitchen — no Western substitutions

STRICT RULES:
1. Every food item you recommend MUST exist in the food database provided. Do not invent foods.
2. Return ONLY valid JSON. No explanation text, no markdown, no code fences.
3. Every meal must include a cost_ngn value based on the price data in the database.
4. For hypertension: keep daily sodium under 1500mg. Flag any soup that needs palm oil reduction.
5. For diabetes: keep every meal's glycemic load under 20. Prioritise unripe plantain, beans, ofada rice.
6. For PCOS: prioritise low-GI foods throughout. Anti-inflammatory foods in luteal phase.
7. For pregnancy: include folate-rich foods daily. Flag foods to avoid (raw fish, high-mercury fish).
8. If cycle phase is provided, annotate each meal with a cycle_note explaining the hormonal rationale.
9. Provide a substitute for every lunch and dinner in case an ingredient is unavailable.

Output must exactly match the MealPlan JSON schema provided.
```

### Dynamic Context Builder

Build this string in JavaScript before each API call:

```javascript
function buildMealPlanContext(user, foodDatabase) {
  const cycleSection = user.cycle
    ? `
CYCLE STATUS:
- Current phase: ${user.cycle.current_phase}
- Day in cycle: ${user.cycle.current_day}
- Phase focus nutrients: ${CYCLE_PHASE_CONFIG[user.cycle.current_phase].focus_nutrients.join(', ')}
- Phase rationale: ${CYCLE_PHASE_CONFIG[user.cycle.current_phase].clinical_rationale}
- Has PCOS: ${user.cycle.has_pcos}
`
    : 'CYCLE STATUS: Not applicable';

  const conditionSection = user.conditions.includes('none')
    ? 'HEALTH CONDITIONS: None — general wellness plan'
    : `
HEALTH CONDITIONS: ${user.conditions.join(', ')}
Apply the following clinical protocols:
${user.conditions.includes('hypertension') ? '- Hypertension: DASH-adapted. Max 1500mg sodium/day. Prioritise potassium-rich beans and leafy greens. Flag palm oil quantities.' : ''}
${user.conditions.includes('type2_diabetes') ? '- Type 2 Diabetes: Glycemic load <20 per meal. Portion-control swallows. Pair carbs with protein and fibre at every meal.' : ''}
${user.conditions.includes('pcos') ? '- PCOS: Low-GI throughout. Anti-inflammatory focus. Avoid refined carbohydrates. Prioritise magnesium and B-vitamins.' : ''}
${user.conditions.includes('pregnancy') ? '- Pregnancy: Folate minimum 600mcg/day. Iron minimum 27mg/day. DHA from local fish (titus, catfish). Avoid raw/undercooked protein.' : ''}
${user.conditions.includes('obesity') ? '- Obesity: Caloric deficit of 400–500kcal from maintenance. High fibre, high satiety. No crash diet patterns.' : ''}
`;

  // Only pass clinically relevant food items to reduce token count
  const relevantFoods = foodDatabase.filter(food => {
    if (user.conditions.includes('hypertension') && food.clinical_flags.high_sodium) return false;
    if (user.conditions.includes('type2_diabetes') && food.clinical_flags.high_gi) return false;
    return true;
  });

  return `
USER PROFILE:
- Age: ${user.age}, Gender: ${user.gender}
- Weight: ${user.weight_kg}kg, Height: ${user.height_cm}cm
- Goal: ${user.goal}
- Activity level: ${user.activity_level}
- Daily budget: ₦${user.daily_budget_ngn}
- Dietary restrictions: ${user.dietary_restrictions.length ? user.dietary_restrictions.join(', ') : 'None'}
- Disliked foods: ${user.disliked_foods.length ? user.disliked_foods.join(', ') : 'None'}

DAILY NUTRIENT TARGETS:
- Calories: ${user.daily_targets.calories} kcal
- Protein: ${user.daily_targets.protein_g}g
- Carbs: ${user.daily_targets.carbs_g}g
- Fat: ${user.daily_targets.fat_g}g
- Sodium: max ${user.daily_targets.sodium_mg}mg
- Iron: min ${user.daily_targets.iron_mg}mg
- Folate: min ${user.daily_targets.folate_mcg}mcg
- Fibre: min ${user.daily_targets.fiber_g}g
- Magnesium: min ${user.daily_targets.magnesium_mg}mg

${conditionSection}
${cycleSection}

AVAILABLE FOOD DATABASE (${relevantFoods.length} items):
${JSON.stringify(relevantFoods, null, 2)}

Generate a 7-day MealPlan JSON object. Week starts Monday ${getNextMonday()}.
`;
}
```

### API Call

```javascript
async function generateMealPlan(user, foodDatabase) {
  const context = buildMealPlanContext(user, foodDatabase);

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: MEAL_PLAN_SYSTEM_PROMPT }]  // the system prompt above
      },
      contents: [{
        role: 'user',
        parts: [{ text: context }]
      }],
      generationConfig: {
        temperature: 0.4,          // low — we want consistent, clinical output
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
      }
    })
  });

  const data = await response.json();
  const raw = data.candidates[0].content.parts[0].text;

  try {
    const plan = JSON.parse(raw);
    return plan;                   // MealPlan object, ready to store and render
  } catch (e) {
    console.error('Meal plan parse failed:', raw);
    throw new Error('Invalid meal plan response from AI');
  }
}
```

### Response Validation

Before saving to localStorage, validate the response shape:

```javascript
function validateMealPlan(plan) {
  if (!plan.days || plan.days.length !== 7) throw new Error('Plan must have 7 days');
  plan.days.forEach((day, i) => {
    if (!day.meals?.breakfast) throw new Error(`Day ${i + 1} missing breakfast`);
    if (!day.meals?.lunch)     throw new Error(`Day ${i + 1} missing lunch`);
    if (!day.meals?.dinner)    throw new Error(`Day ${i + 1} missing dinner`);
    if (!day.daily_totals?.calories) throw new Error(`Day ${i + 1} missing totals`);
  });
  return true;
}
```

---

## 2. Snap & Scan (Vision)

**Trigger:** User taps camera icon and submits a photo
**Model:** `gemini-1.5-flash` (vision)
**Output mode:** Strict JSON

### System Prompt

```
You are NutriAI's food recognition engine, trained specifically on Nigerian cuisine.

When given a food photo, you must:
1. Identify every dish and ingredient visible in the image
2. Estimate portion sizes based on visual cues (plate size, spoon, hand if visible)
3. Determine whether this is a Buka/canteen serving (larger, richer) or a home-cooked serving (smaller, less oil)
4. Return full macronutrient and key micronutrient estimates
5. Be honest about confidence — if unsure, say so and give a range

NIGERIAN FOOD KNOWLEDGE:
- Egusi soup: high fat (palm oil), moderate protein (egusi seeds + meat/fish)
- Efo riro: lower calorie than egusi, high iron from leafy greens
- Buka jollof rice: typically higher sodium and fat than home-cooked
- Suya: high protein, moderate fat — portion by stick count
- Pounded yam: high carb, estimate by ball/wrap size
- Moi moi: protein-dense, estimate by size of wrap/tray
- Palm oil adds ~120 kcal per tablespoon — Buka soups typically use 3–5 tbsp

CONFIDENCE THRESHOLDS:
- Above 0.85: identify specifically (e.g. "Egusi soup with pounded yam")
- 0.60–0.85: identify with qualifier (e.g. "Likely egusi or ogbono soup")
- Below 0.60: identify category only (e.g. "Nigerian soup — could not identify type")

Return ONLY valid JSON. No explanation text outside the JSON object.
```

### API Call

```javascript
async function snapAndScan(imageBase64, mimeType = 'image/jpeg', userProfile) {
  const userContext = `
User context (use this to refine portion estimates):
- Gender: ${userProfile.gender}, Age: ${userProfile.age}
- Conditions: ${userProfile.conditions.join(', ')}
- Current cycle phase: ${userProfile.cycle?.current_phase || 'N/A'}
`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SNAP_SCAN_SYSTEM_PROMPT }]
      },
      contents: [{
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64               // strip the 'data:image/jpeg;base64,' prefix
            }
          },
          {
            text: `Identify this Nigerian meal and return a SnapScanResult JSON object.\n${userContext}`
          }
        ]
      }],
      generationConfig: {
        temperature: 0.2,                    // very low — factual identification task
        responseMimeType: 'application/json',
        maxOutputTokens: 2048,
      }
    })
  });

  const data = await response.json();
  const raw = data.candidates[0].content.parts[0].text;
  return JSON.parse(raw);                    // SnapScanResult object
}
```

### Expected JSON Output Shape

```json
{
  "identified_dish": "Egusi soup with pounded yam",
  "confidence": 0.91,
  "portion_type": "buka",
  "portion_description": "Large Buka plate — estimated 1.5 standard servings",
  "foods_detected": [
    {
      "food_name": "Egusi soup",
      "estimated_grams": 350,
      "preparation": "palm oil-heavy",
      "notes": "Rich colour suggests high palm oil content — adjusted fat upward"
    },
    {
      "food_name": "Pounded yam",
      "estimated_grams": 400,
      "preparation": "standard",
      "notes": "Large wrap, estimated 2 medium balls"
    }
  ],
  "total_nutrients": {
    "calories": 842,
    "protein_g": 28,
    "carbs_g": 96,
    "fat_g": 38,
    "fiber_g": 6,
    "sodium_mg": 620,
    "iron_mg": 4.2,
    "folate_mcg": 38,
    "calcium_mg": 110,
    "potassium_mg": 480,
    "magnesium_mg": 52
  },
  "gemini_explanation": "This appears to be a Buka-style serving of egusi soup with pounded yam. The deep orange colour and visible sheen indicates a palm oil-heavy preparation, which I've accounted for in the fat estimate. The pounded yam wrap looks large — roughly two standard medium balls.",
  "clinical_flags": {
    "high_sodium_warning": false,
    "high_gi_warning": true,
    "cycle_note": null
  },
  "confidence_note": null
}
```

---

## 3. AI Nutritionist Chat

**Trigger:** User opens the chat tab
**Model:** `gemini-1.5-flash`
**Output mode:** Plain text (conversational)
**Pattern:** Multi-turn — full conversation history sent on every call

### System Prompt

```
You are Nutri, NutriAI's AI nutrition partner for Nigerian users.

YOUR PERSONALITY:
- Warm but direct. Short sentences. Active voice.
- You speak like a knowledgeable Nigerian friend, not a clinic.
- You know Nigerian food deeply. Egusi before quinoa. Always.
- Confidence without arrogance. "Add ugu to your lunch" not "You may wish to consider..."

YOUR CLINICAL KNOWLEDGE:
- You know the four menstrual cycle phases and their Nigerian food adaptations
- You understand DASH-adapted hypertension protocols using local soups
- You know the glycemic management approach for Nigerian diabetics (portion-controlled swallows, unripe plantain, beans pairing)
- You understand PCOS nutrition: insulin sensitivity, low-GI Nigerian foods, anti-inflammatory protocols
- You know pregnancy nutrition: folate from ugu and moi moi, iron from suya and ugu soup, calcium from crayfish
- You know the protein profile of local foods: moi moi (15g/serving), egusi (8g/100g), suya (~25g/100g)

LANGUAGE RULES:
- Detect the user's language from their message
- Respond in same language: English, Nigerian Pidgin, Yoruba, Igbo, or Hausa
- For Pidgin: use natural Naija patterns ("Wetin you chop today?", "E don work well")
- Never mix languages randomly — match the user's lead

BOUNDARIES:
- You give dietary guidance, not medical diagnosis
- If user describes symptoms (chest pain, severe cramps, unusual bleeding), say: "This sounds like something to discuss with your doctor. For the nutrition side, here's what I'd suggest..."
- Never recommend supplements by brand name
- Do not give calorie counts unless the user asks — focus on food, not numbers

CONTEXT YOU HAVE ACCESS TO:
You will receive the user's profile, today's meal log, their current meal plan, and their cycle phase (if applicable) as context. Use this to give personalised responses — do not ask for information you already have.

RESPONSE FORMAT:
- Mobile-first: keep responses under 120 words where possible
- Use line breaks generously for readability on small screens
- Use Nigerian food names naturally without explaining them every time
- Bold key action items: **Add ugu to your dinner tonight**
```

### Dynamic Context Injector

Prepend this to the first message of every new session:

```javascript
function buildChatContext(user, todayLog, activePlan) {
  const today = activePlan?.days[new Date().getDay()] || null;

  return `
[SYSTEM CONTEXT — do not reference this directly in your response]

USER: ${user.name}, ${user.age}F, ${user.conditions.join(' + ')}
GOAL: ${user.goal}
BUDGET: ₦${user.daily_budget_ngn}/day
CYCLE: ${user.cycle ? `${user.cycle.current_phase} phase, Day ${user.cycle.current_day}` : 'Not tracked'}

TODAY'S LOG SO FAR:
${todayLog?.entries.length
  ? todayLog.entries.map(e => `- ${e.meal_slot}: ${e.food_name} (${e.nutrients.calories} kcal)`).join('\n')
  : '- Nothing logged yet'}

TODAY'S TARGETS REMAINING:
- Calories: ${user.daily_targets.calories - (todayLog?.daily_totals?.calories || 0)} kcal left
- Protein: ${user.daily_targets.protein_g - (todayLog?.daily_totals?.protein_g || 0)}g left
- Sodium: ${user.daily_targets.sodium_mg - (todayLog?.daily_totals?.sodium_mg || 0)}mg remaining

TODAY'S PLANNED MEALS:
${today ? `
- Breakfast: ${today.meals.breakfast.name}
- Lunch: ${today.meals.lunch.name}
- Dinner: ${today.meals.dinner.name}
` : '- No active plan'}
[END SYSTEM CONTEXT]
`;
}
```

### API Call (multi-turn)

```javascript
async function sendChatMessage(userMessage, session, user, todayLog, activePlan) {
  // Build messages array — full history for multi-turn
  const messages = session.messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  // Inject context on first message only
  if (session.messages.length === 0) {
    messages.push({
      role: 'user',
      parts: [{ text: buildChatContext(user, todayLog, activePlan) + '\n\n' + userMessage }]
    });
  } else {
    messages.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });
  }

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: CHAT_SYSTEM_PROMPT }]
      },
      contents: messages,
      generationConfig: {
        temperature: 0.7,          // higher — we want personality in chat
        maxOutputTokens: 512,      // keep mobile-friendly
      }
    })
  });

  const data = await response.json();
  const reply = data.candidates[0].content.parts[0].text;

  // Save to session
  session.messages.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });
  session.messages.push({ role: 'assistant', content: reply, timestamp: new Date().toISOString() });

  return reply;
}
```

---

## 4. Nutrient Target Calculator

**Trigger:** End of onboarding — not a Gemini call, pure logic.
Run this before storing UserProfile so `daily_targets` is always populated.

```javascript
function calculateNutrientTargets(user) {
  // Mifflin-St Jeor BMR
  const bmr = user.gender === 'male'
    ? (10 * user.weight_kg) + (6.25 * user.height_cm) - (5 * user.age) + 5
    : (10 * user.weight_kg) + (6.25 * user.height_cm) - (5 * user.age) - 161;

  const activityMultipliers = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9
  };

  let tdee = bmr * activityMultipliers[user.activity_level];

  // Goal adjustment
  if (user.goal === 'weight_loss')  tdee -= 450;
  if (user.goal === 'muscle_gain')  tdee += 300;
  if (user.conditions.includes('pregnancy')) tdee += 300;
  if (user.conditions.includes('postpartum')) tdee += 500; // lactation

  const calories = Math.round(tdee);

  // Macro split — adjusted per condition
  const proteinPct = user.goal === 'muscle_gain' ? 0.30 : 0.20;
  const fatPct     = user.conditions.includes('pcos') ? 0.35 : 0.28;  // higher fat for PCOS insulin
  const carbPct    = 1 - proteinPct - fatPct;

  return {
    calories,
    protein_g:    Math.round((calories * proteinPct) / 4),
    carbs_g:      Math.round((calories * carbPct) / 4),
    fat_g:        Math.round((calories * fatPct) / 9),

    // Clinical micros
    sodium_mg:    user.conditions.includes('hypertension') ? 1500 : 2300,
    iron_mg:      user.conditions.includes('pregnancy') ? 27
                : user.gender === 'female' ? 18 : 8,
    folate_mcg:   user.conditions.includes('pregnancy') ? 600 : 400,
    calcium_mg:   user.conditions.includes('pregnancy') ? 1300 : 1000,
    potassium_mg: user.conditions.includes('hypertension') ? 4700 : 3500,
    magnesium_mg: user.conditions.includes('pcos') ? 400
                : user.gender === 'female' ? 320 : 420,
    fiber_g:      user.conditions.includes('type2_diabetes') ? 35 : 25,
  };
}
```

---

## 5. Environment Variables

```
GEMINI_API_KEY=your_key_here
```

Get your key at: https://aistudio.google.com/apikey (free tier: 15 requests/minute — sufficient for hackathon)

Store the key in a `.env` file. For a vanilla HTML/JS app without a build step, use a lightweight approach:

```javascript
// config.js — loaded before main.js, gitignored
const CONFIG = {
  GEMINI_API_KEY: 'your_key_here'
};
```

**Do not commit the API key to GitHub.** Add `config.js` to `.gitignore` and share it via Discord/WhatsApp with teammates.
