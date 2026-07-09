# BiteRight — Product Requirements for Claude Code

## What This Is
A personal nutrition tracking web app with AI-powered meal analysis. Built as a portfolio project. Clean, minimal UI. Designed for real daily use — forgiving by design, not punitive.

---

## Tech Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React (mobile-first, responsive)
- **Auth + Database**: Supabase (handles Google Sign-In, PostgreSQL, cross-device sync in one service)
- **Image Analysis**: Google Gemini 3.5 Flash (meal photo → identify items, portions, calories + macros)
- **AI Insights**: Claude API (claude-sonnet-4-6) for weekly insight generation only
- **Charting**: Recharts (macro rings, weight trend)

---

## Design Direction
- See the shared screenshots for inspiration. Come up with design inspired by those.
- Clean UI
- Card-based layout, rounded corners, subtle shadows
- Colour used for key numbers, progress indicators, and CTAs, dont splash colours unnecessarily
- No illustrations, no heavy gradients, no decorative elements
- Mobile-first: primary use case is photographing food on a phone
- should adapt to laptop also
- **UI is expected to evolve** — scaffold simply and keep components modular for easy iteration

---

## Core Philosophy (Important — Inform All UX Decisions)
- **Forgiving by design**: Missing a meal log, going over calories, or skipping a day should never feel like failure. Neutral language, no red alerts for minor misses.
- **Consistency > perfection**: Celebrate streaks and patterns, never penalise individual bad days
- **Under-eating is the one hard warning**: If daily intake is below ~1,200 kcal and the day is mostly done, show a clear but non-alarmist message: "Looks like today was light — your body needs fuel to reach your goals"
- **Honest estimates**: AI calorie estimates from photos are approximate — always show as "~430 kcal" not "430 kcal"

---

## User Flows

### 1. Onboarding (First Time Only)
A clean multi-step form — progressive, one step at a time. No AI needed here; questions are well-defined.

**Steps in order:**
1. Name
2. Age, height, weight (with unit toggle: kg/cm or lbs/ft)
3. Goal: Maintain weight / Lose weight / Gain weight
4. If lose/gain: How much per week? (show safe range: 0.25kg–0.5kg/week for loss)
5. Activity level: Sedentary / Lightly active / Moderately active / Very active
6. Dietary preference: Vegetarian / Eggetarian / Non-vegetarian / Vegan
7. Any relevant health conditions? (Postpartum, Thyroid, Diabetes, PCOS, None — optional)
8. Primary cuisine: South Indian / North Indian / Mixed Indian / Other

**Output screen after onboarding:**
- BMR and maintenance calories shown with brief explanation
- Target calories shown (based on goal + activity)
- Macro split suggested (protein/carbs/fat)
- All values manually editable before user confirms
- User confirms → taken to Dashboard

**Formula reference:**
- BMR (women) = (10 × weight kg) + (6.25 × height cm) − (5 × age) − 161
- Maintenance = BMR × activity multiplier (sedentary 1.2 / light 1.35 / moderate 1.55 / very active 1.75)
- Weight loss deficit: ~300 kcal/week = 0.3kg/week; ~500 kcal = 0.5kg/week
- Hard floor: never recommend below 1,200 kcal/day regardless of inputs

---

### 2. Dashboard (Daily Home Screen)
What users see every day. Show only what matters today.

**Elements:**
- Greeting with first name + today's date
- **Calorie ring** (circular): calories consumed / daily target — prominent, centre
- **Macros strip**: Carbs / Protein / Fat — progress bars (consumed vs target)
- **Water tracker**: Tap to add 250ml, show consumed vs daily target
- **Meal cards**: Breakfast / Lunch / Snack / Dinner — each shows kcal logged, tap to add
- **Quick log button**: Prominent camera/+ icon

**Tone by state:**
- On track → neutral, clean
- Significantly over → "You've had a full day — listen to your hunger from here"
- Under by end of day → "Looks like today was light — make sure you're eating enough"
- Under 1,200 kcal and day is mostly done → clear warning (non-alarmist, see philosophy)

---

### 3. Meal Logging

**A. Photo Analysis (Primary)**
- User taps camera icon, takes or uploads a photo
- Gemini 1.5 Flash analyses image: identifies items, estimates portions
- Returns structured data: item name, estimated grams, kcal, carbs, protein, fat
- Shown as editable cards — user can correct any field
- Confidence communicated subtly: "These are estimates — tap any item to adjust"
- User confirms → logged to selected meal slot (breakfast/lunch/snack/dinner)

**B. Manual Entry (Fallback)**
- User types food name + calories + optional macros
- No need for a full food database — keep it simple

**Favourites / Recent Meals:**
- Last 5 logged meals shown for one-tap re-log
- Option to star/save as favourite
- Critical for usability — Indian meals repeat daily

---

### 4. Weekly Check-in
Surfaces once a week (Monday morning). Non-intrusive.

**Shows:**
- Days logged this week (e.g. "You logged 5 out of 7 days — great consistency")
- Average daily calories vs target
- Weight change if user logged weight
- One AI-generated insight via Claude API (e.g. "Your protein has been consistently low — try adding dal or curd to one more meal per day")
- Option to adjust calorie/macro targets

**Tone:** Conversational, supportive. Never shame language.

---

### 5. Weight Tracking (Optional)
- User logs today's weight (not required)
- Line chart: smoothed trend over time (not raw daily — weight fluctuates)
- Goal weight shown as reference line

---

### 6. Profile / Settings
- Edit personal details (weight, height, age)
- Edit calorie/macro targets manually at any time
- Change goal
- Dietary preference
- Reset onboarding
- Sign out

---

## Cross-Device Sync
All data stored in Supabase (PostgreSQL). Users log in with Google via Supabase Auth. Any device, same account → same data. No local-only storage.

---

## Key Screens Summary
1. Onboarding (multi-step form)
2. Onboarding Results (targets + manual adjust)
3. Dashboard (daily home)
4. Meal Log — Photo Analysis (Gemini)
5. Meal Log — Manual Entry
6. Meal Detail / Edit
7. Weekly Check-in (with Claude insight)
8. Weight Tracker
9. Profile / Settings

---

## AI Usage — Clear Split
| Feature | Model | Purpose |
|---|---|---|
| Meal photo analysis | Gemini 1.5 Flash | Identify food items, estimate calories + macros from image |
| Weekly insight | Claude API (claude-sonnet-4-6) | One personalised, conversational nutrition insight per week |
| Onboarding | None — standard form | Questions are well-defined, no AI needed |

---

## What This App Does NOT Do
- No barcode scanning
- No exercise tracking
- No social/sharing features
- No meal planning or recipe suggestions
- No push notifications
- No payments or subscriptions
- No full food database

---

## Portfolio Notes for Claude Code
- Code should be clean and well-commented
- README should explain architecture, local setup, and how Gemini + Claude APIs are used
- Keep components modular — UI will evolve, easy swaps should be possible
- Mobile-first CSS throughout

---

## Open Questions for Claude Code to Resolve During Planning
- Supabase schema design (users/profiles, daily_logs, meal_items, weight_logs)
- Timezone handling for "today's" meal grouping
- Image upload flow — process in memory only (no need to persist meal photos)
- Gemini API integration in FastAPI (image → structured JSON response)
- How to handle Gemini low-confidence or failed analysis gracefully