# NutriAI — Data Models

All models are written as TypeScript interfaces. Works for both TypeScript and plain JS projects. These are the canonical schemas — every component and API route must conform to these shapes.

---

## 1. UserProfile

Created during onboarding. Persisted in localStorage for the hackathon (no auth backend needed).

```typescript
interface UserProfile {
  id: string;                          // uuid, generated on first load
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  weight_kg: number;
  height_cm: number;

  // Health conditions (multi-select on onboarding)
  conditions: Array<
    | 'none'
    | 'hypertension'
    | 'type2_diabetes'
    | 'pcos'
    | 'obesity'
    | 'pregnancy'
    | 'postpartum'
    | 'athlete'
  >;

  // Goals (single select)
  goal: 'weight_loss' | 'muscle_gain' | 'maintenance' | 'manage_condition' | 'pregnancy_nutrition';

  // Budget
  monthly_budget_ngn: number;          // e.g. 15000
  daily_budget_ngn: number;            // derived: monthly / 30

  // Activity
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

  // Dietary
  dietary_restrictions: string[];      // e.g. ['no_pork', 'no_shellfish']
  disliked_foods: string[];            // food IDs the user has rejected

  // Cycle (only populated if gender === 'female')
  cycle?: CycleData;

  // Computed targets (set after onboarding, updated by AI)
  daily_targets: NutrientTargets;

  created_at: string;                  // ISO date string
}
```

---

## 2. NutrientTargets

Derived from user profile. Gemini calculates these during onboarding based on condition + goal.

```typescript
interface NutrientTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;

  // Clinically significant micros — tracked for conditions
  sodium_mg: number;       // critical for hypertension (target: <1500mg DASH)
  iron_mg: number;         // critical for menstrual / pregnancy
  folate_mcg: number;      // critical for pregnancy
  calcium_mg: number;
  potassium_mg: number;    // hypertension support
  magnesium_mg: number;    // PCOS / luteal phase
  fiber_g: number;         // diabetes glycemic control
}
```

---

## 3. FoodItem

The Nigerian Food Intelligence Database. Seed 50 items for hackathon MVP.

```typescript
interface FoodItem {
  id: string;                          // e.g. 'egusi_soup'
  name: string;                        // 'Egusi soup'
  local_names?: string[];              // ['Ofe Egusi', 'Miyan Gushi']
  category: FoodCategory;
  region_tags: Array<'nationwide' | 'southwest' | 'southeast' | 'north' | 'southsouth'>;

  // Macros per 100g (raw/base state)
  per_100g: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  };

  // Clinically significant micros per 100g
  micros_per_100g: {
    sodium_mg: number;
    iron_mg: number;
    folate_mcg: number;
    calcium_mg: number;
    potassium_mg: number;
    magnesium_mg: number;
  };

  glycemic_index: number;              // 0–100
  glycemic_load: number;              // accounts for typical serving

  // Preparation variants that meaningfully change nutrition
  preparation_variants?: {
    method: 'boiled' | 'fried' | 'smoked' | 'grilled' | 'fermented' | 'raw';
    calorie_multiplier: number;        // e.g. fried plantain = 1.4x boiled
    sodium_delta_mg?: number;          // added salt in processing
  }[];

  // Typical serving sizes
  serving_sizes: {
    label: string;                     // e.g. 'medium bowl', '1 wrap', '1 skewer'
    grams: number;
  }[];

  // Market price estimate
  price_per_serving_ngn: {
    min: number;
    max: number;
    market_type: 'buka' | 'market' | 'supermarket';
  }[];

  // Clinical tags
  clinical_flags: {
    high_sodium: boolean;              // flag for hypertension protocol
    high_gi: boolean;                  // flag for diabetes protocol
    iron_rich: boolean;                // flag for menstrual / pregnancy
    folate_rich: boolean;
    high_fiber: boolean;
    anti_inflammatory: boolean;
    magnesium_rich: boolean;
  };

  // Cycle recommendations
  cycle_phases?: Array<'menstrual' | 'follicular' | 'ovulation' | 'luteal'>;

  image_emoji: string;                 // fallback display: '🍲'
}

type FoodCategory =
  | 'swallow'        // eba, amala, pounded yam, semo, tuwo
  | 'soup'           // egusi, ogbono, efo riro, banga, okra
  | 'protein'        // suya, grilled fish, moi moi, akara, beans
  | 'rice_grains'    // jollof, ofada, rice and stew, millet
  | 'snack'          // chin chin, boli, plantain chips
  | 'breakfast'      // pap/ogi, akara, agege bread, yam and egg
  | 'drink'          // zobo, kunu, palm wine, tiger nut
  | 'fruit_veg'      // ugu leaves, tomatoes, plantain, yam
  | 'condiment';     // palm oil, groundnut oil, maggi, crayfish
```

---

## 4. MealPlan

Output of the AI Meal Plan Generator. One plan = 7 days.

```typescript
interface MealPlan {
  id: string;
  user_id: string;
  generated_at: string;                // ISO date string
  week_start: string;                  // ISO date string (Monday)

  // Context used to generate this plan
  context: {
    cycle_phase?: CyclePhase;
    budget_ngn: number;
    active_conditions: string[];
    goal: string;
  };

  days: DayPlan[];

  // Weekly summary
  weekly_totals: {
    avg_daily_calories: number;
    avg_daily_cost_ngn: number;
    estimated_monthly_cost_ngn: number;
    nutritional_completeness_score: number; // 0–100, how well it hits targets
  };

  // AI-generated explanation (shown in UI)
  plan_summary: string;                // e.g. "This plan prioritises iron-rich foods for your menstrual phase..."
  clinical_notes?: string;             // condition-specific note from AI
}

interface DayPlan {
  day_index: number;                   // 0 = Monday, 6 = Sunday
  date: string;
  cycle_phase_note?: string;           // e.g. "Day 18 – Luteal phase. Prioritising magnesium."

  meals: {
    breakfast: Meal;
    lunch: Meal;
    dinner: Meal;
    snack?: Meal;
  };

  daily_totals: NutrientTargets & {
    cost_ngn: number;
  };

  // Compared to user's targets
  target_adherence: {
    calories_pct: number;              // e.g. 96 = 96% of target
    protein_pct: number;
    sodium_pct: number;                // lower is better for hypertension
  };
}

interface Meal {
  name: string;                        // e.g. 'Akara + Pap'
  description?: string;                // e.g. 'Light, protein-forward breakfast'
  foods: MealFood[];
  preparation_notes?: string;          // e.g. 'Use less palm oil — reduces sodium by ~40mg'

  totals: NutrientTargets & {
    cost_ngn: number;
    cost_breakdown: string;            // e.g. 'Akara ₦200 · Pap ₦80'
  };

  // Cycle / condition annotation shown as badge in UI
  annotation?: {
    label: string;                     // e.g. '+Iron' or 'Low GI'
    reason: string;                    // e.g. 'Ugu is your best local source of iron'
  };

  // Smart substitute (shown when tapped)
  substitute?: {
    name: string;
    reason: string;
    cost_ngn: number;
    calorie_delta: number;
  };
}

interface MealFood {
  food_id: string;                     // references FoodItem.id
  food_name: string;                   // denormalized for display
  serving_label: string;               // e.g. '1 medium bowl'
  grams: number;
  calories: number;
  preparation?: string;                // e.g. 'boiled', 'fried'
}
```

---

## 5. CycleData

Only populated for female users who enable cycle tracking.

```typescript
interface CycleData {
  last_period_start: string;           // ISO date string
  cycle_length_days: number;           // default 28
  period_length_days: number;          // default 5
  has_pcos: boolean;

  // Computed — recalculate on each app load
  current_phase: CyclePhase;
  current_day: number;                 // day within current cycle
  days_until_next_period: number;
  next_phase_in_days: number;
}

type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

// Phase definitions — used by meal plan generator and UI
const CYCLE_PHASE_CONFIG: Record<CyclePhase, {
  days: string;                        // e.g. 'Days 1–5'
  color: string;                       // UI accent hex
  focus_nutrients: string[];
  avoid: string[];
  ui_label: string;
  clinical_rationale: string;
}> = {
  menstrual: {
    days: 'Days 1–5',
    color: '#E8651A',
    focus_nutrients: ['iron', 'vitamin_c', 'omega3', 'anti_inflammatory'],
    avoid: ['excessive_caffeine', 'high_sodium'],
    ui_label: 'Menstrual',
    clinical_rationale: 'Average iron loss 30–40mg per cycle. Nigerian women have high baseline anaemia rates.'
  },
  follicular: {
    days: 'Days 6–14',
    color: '#A8E063',
    focus_nutrients: ['b_vitamins', 'lean_protein', 'complex_carbs'],
    avoid: [],
    ui_label: 'Follicular',
    clinical_rationale: 'Rising oestrogen increases insulin sensitivity — optimal window for complex carbohydrates.'
  },
  ovulation: {
    days: 'Day 14',
    color: '#6DBF5A',
    focus_nutrients: ['antioxidants', 'omega3', 'hydration'],
    avoid: [],
    ui_label: 'Ovulation',
    clinical_rationale: 'Prostaglandin production peaks — anti-inflammatory foods reduce cramping severity.'
  },
  luteal: {
    days: 'Days 15–28',
    color: '#E8651A',
    focus_nutrients: ['magnesium', 'complex_carbs', 'b6', 'tryptophan'],
    avoid: ['refined_sugar', 'alcohol', 'excess_caffeine'],
    ui_label: 'Luteal',
    clinical_rationale: 'Progesterone raises metabolic rate 5–10%. Magnesium deficiency correlates with PMS severity.'
  }
};
```

---

## 6. MealLog

User's daily food diary. One document per user per day.

```typescript
interface MealLog {
  id: string;
  user_id: string;
  date: string;                        // 'YYYY-MM-DD'
  cycle_phase?: CyclePhase;

  entries: LogEntry[];

  daily_totals: NutrientTargets & {
    cost_ngn: number;
  };

  // vs. user's daily targets
  target_adherence: Record<keyof NutrientTargets, number>; // percentage

  // Snap & Scan results attached to this log
  scanned_meals: SnapScanResult[];
}

interface LogEntry {
  id: string;
  timestamp: string;
  meal_slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_id: string;
  food_name: string;
  serving_label: string;
  grams: number;
  source: 'manual' | 'meal_plan' | 'snap_scan';
  nutrients: NutrientTargets;
  cost_ngn?: number;
}

interface SnapScanResult {
  id: string;
  timestamp: string;
  image_base64?: string;               // stored locally only, never sent to backend
  identified_dish: string;
  confidence: number;                  // 0–1
  portion_type: 'buka' | 'home_cooked' | 'restaurant' | 'unknown';
  foods_detected: {
    food_id?: string;                  // null if not in database
    food_name: string;
    estimated_grams: number;
  }[];
  total_nutrients: NutrientTargets;
  gemini_explanation: string;          // raw text from Gemini for display
  added_to_log: boolean;
}
```

---

## 7. ChatSession

AI Nutritionist conversation history.

```typescript
interface ChatSession {
  id: string;
  user_id: string;
  started_at: string;
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  language: 'english' | 'pidgin' | 'yoruba' | 'igbo' | 'hausa';  // detected or selected
  sources?: string[];                  // clinical protocol references cited by AI
}
```

---

## 8. localStorage Key Map

For the hackathon, all persistence is localStorage. Use these exact keys.

```
nutriai_user_profile      → UserProfile (JSON)
nutriai_meal_plans        → MealPlan[]  (JSON, latest 4 plans)
nutriai_meal_logs         → Record<string, MealLog>  (keyed by 'YYYY-MM-DD')
nutriai_chat_session      → ChatSession (JSON, current session)
nutriai_food_db           → FoodItem[]  (JSON, seeded on first load)
nutriai_onboarded         → 'true' | undefined  (gate for onboarding flow)
```

---

## Hackathon Seed Data

Minimum 50 food items needed. Priority order for the seed file:

1. Swallows: eba, amala, pounded yam, semo, tuwo shinkafa (×5)
2. Soups: egusi, ogbono, efo riro, okra, banga, oha, afang, vegetable soup (×8)
3. Rice/grains: jollof rice, ofada rice, fried rice, millet pap, oat pap (×5)
4. Proteins: moi moi, akara, suya, grilled catfish, beans, boiled egg, groundnut soup, egusi with goat meat (×8)
5. Breakfast: pap/ogi, agege bread, yam and egg sauce, plantain and egg (×4)
6. Fruits/veg: ripe plantain, unripe plantain, ugu leaves, water leaf, tomatoes, garden egg (×6)
7. Drinks: zobo, kunu, palm wine, fresh coconut water, tiger nut milk (×5)
8. Snacks: boli, roasted plantain, groundnut, chin chin, dates (×5)
9. Condiments: palm oil, crayfish, ogiri, dawadawa (×4)
