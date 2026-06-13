# NutriAI — Technical Implementation

## Stack
- **Framework**: Next.js 14 (App Router)
- **Scroll animation**: GSAP 3 + ScrollTrigger
- **AI**: Google Gemini 1.5 Pro + Flash
- **Database**: PostgreSQL + pgvector (Supabase works for hackathon)
- **Deployment**: Vercel

---

## Four Gemini Integration Patterns

### 1. Snap & Scan — Multimodal Vision
`src/api/snapAndScan.js`

- Model: **Gemini 1.5 Flash** (speed-first; escalates to Pro on low confidence)
- Input: base64 image + user health context
- Output: strict JSON — dish name, macros, clinical flags, cycle note
- Key: grounding prompt forces Nigerian food naming + serving-style differentiation

### 2. Meal Plan Generator — Context Window
`src/api/mealPlanner.js`

- Model: **Gemini 1.5 Pro** (large context for DB injection)
- Input: user profile + ~150 filtered foods from DB + clinical rules
- Output: `responseSchema`-enforced JSON — 7-day plan, shopping list, nutrition summary
- Key: `responseMimeType: "application/json"` with `responseSchema` — no raw text ever hits the UI

### 3. AI Nutritionist Chat — ADK Agent + RAG
`src/api/nutritionistChat.js`

- Model: **Gemini 1.5 Pro** with tool use
- RAG: pgvector similarity search over clinical protocol chunks
- Tools: `query_food_database`, `get_clinical_protocol`
- Language detection: responds in English, Pidgin, Yoruba, Igbo, or Hausa
- Key: stateless — full conversation history sent on every request

### 4. Smart Substitute Engine — Function Calling
`src/api/substituteEngine.js`

- Model: **Gemini 1.5 Flash** (simpler reasoning, faster response)
- Tools: `check_ingredient_price`, `find_clinical_substitutes`, `get_nutrient_equivalence`
- Key: agentic loop — Gemini calls tools until it has enough information to respond

---

## GSAP Scroll Architecture
`src/hooks/useScrollAnimations.js`
`src/components/PinnedFeature.jsx`

- **Hero**: staggered entrance timeline on mount
- **Feature sections**: `ScrollTrigger pin: true` for 150vh each, scrub: 0.9
- **Stats**: count-up numbers on viewport entry (once)
- **Food cloud**: staggered scale-in with random glow loop via `gsap.delayedCall`
- **PinnedFeature component**: reusable pinned section with idle → active phone screen dissolve

### GSAP timing model for pinned sections
```
0.0 ──── 0.3  copy + phone enter (opacity + translate)
0.3 ──── 0.55 phone screen: idle fades out → active fades in
0.55 ─── 0.85 feature points stagger in (opacity + translate)
0.85 ─── 1.0  hold at full state before unpin
```

---

## Environment Variables
```
GEMINI_API_KEY=your_key_here
DATABASE_URL=postgresql://...
NEXT_PUBLIC_APP_URL=https://nutriai.vercel.app
```

---

## Hackathon MVP — what to build in 48hrs

### Hour 0–4: Setup
- [ ] `npx create-next-app nutriai-web`
- [ ] Install deps: `npm install gsap @google/generative-ai`
- [ ] Set up Supabase project (free tier) + run food DB seed script
- [ ] Copy landing page HTML → convert to Next.js components
- [ ] Wire `useScrollAnimations()` hook

### Hour 4–12: Core features
- [ ] Snap & Scan (`/api/scan`) — this is the demo centrepiece
- [ ] Meal Plan Generator (`/api/meal-plan`) — wire to onboarding form
- [ ] Seed Nigerian food DB with at least 50 core staples

### Hour 12–24: Polish + chat
- [ ] AI Nutritionist Chat (`/api/chat`)
- [ ] Smart Substitutes on meal cards
- [ ] Cycle sync UI on meal plan view

### Hour 24–36: Integration + testing
- [ ] End-to-end test: photo → scan → meal plan → chat about it
- [ ] Budget slider on meal plan regeneration
- [ ] Mobile responsive check

### Hour 36–48: Demo prep
- [ ] Record Loom of scan feature working
- [ ] Seed 3 demo user profiles (student, PCOS, hypertension)
- [ ] Deploy to Vercel

---

## DB Schema (minimum viable for hackathon)

```sql
-- Nigerian food intelligence
CREATE TABLE nigerian_foods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  category        TEXT,           -- 'swallow' | 'soup' | 'protein' | 'snack'
  calories        INTEGER,
  protein_g       DECIMAL(5,2),
  carbs_g         DECIMAL(5,2),
  fat_g           DECIMAL(5,2),
  fiber_g         DECIMAL(5,2),
  iron_mg         DECIMAL(5,2),
  sodium_mg       DECIMAL(6,2),
  folate_mcg      DECIMAL(6,2),
  glycemic_load   TEXT,           -- 'low' | 'medium' | 'high'
  serving_size    TEXT,           -- '1 medium bowl'
  avg_cost_NGN    INTEGER,
  safe_for_conditions TEXT[],     -- ['hypertension', 'diabetes', 'pregnancy']
  preparation_variant TEXT,       -- 'standard' | 'buka' | 'home'
  embedding       vector(768)     -- for pgvector similarity search
);

-- Market prices (seed from NBS data)
CREATE TABLE market_prices (
  ingredient    TEXT PRIMARY KEY,
  price_NGN     INTEGER,
  unit          TEXT,
  region        TEXT DEFAULT 'Lagos',
  last_updated  TIMESTAMP DEFAULT NOW()
);

-- Clinical protocol chunks (for RAG)
CREATE TABLE clinical_protocols (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition     TEXT,
  aspect        TEXT,
  content       TEXT,
  embedding     vector(768)
);

-- User profiles
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT,
  age             INTEGER,
  sex             TEXT,
  weight_kg       DECIMAL(5,2),
  conditions      TEXT[],
  cycle_phase     TEXT,
  weekly_budget   INTEGER,
  goal            TEXT,
  excluded_foods  TEXT[]
);
```
