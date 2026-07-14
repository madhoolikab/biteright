# BiteRight — CLAUDE.md

## What is this

A personal nutrition tracking web app that productizes a real Claude conversation about postpartum weight loss and calorie tracking for Indian food. Portfolio project with few expected users (LinkedIn shares + family). The primary user persona eats Indian food and is focused on gradual weight loss.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 8, TypeScript 6, Tailwind CSS v4, Zustand, Axios, Recharts, react-router-dom v7 |
| Backend | FastAPI, Pydantic v2, pydantic-settings, Supabase Python SDK |
| Database | Supabase (PostgreSQL + Google Auth) |
| AI — meal photos | Google Gemini Flash (`gemini-2.0-flash`) — Indian cuisine specialization |
| Deploy target | Vercel (frontend) + Railway (backend) |

> **Dormant feature:** the AI weekly-insight generator (Gemini Flash, `gemini-2.0-flash`, max_tokens=200, temp=0.7) still exists in `insights.py` / `gemini_service.py` but is **no longer surfaced in the UI** — the old Insights tab was replaced by the **Log** (history) view. The endpoint and prompt are kept for possible reuse; nothing in the frontend calls `/insights/weekly`.

## Dev environment

- **Python 3.9.6** — use `Optional[X]` from typing, NOT `X | None` union syntax
- **Node 22** / npm
- **Frontend dev server**: `cd frontend && npm run dev` → port 5173
- **Backend dev server**: `cd backend && uvicorn app.main:app --reload` → port 8000
- **DEV_MODE**: When `VITE_DEV_MODE=true`, auth is bypassed and stores return mock data so the UI can be previewed without Supabase or a backend.

## Project structure

```
backend/
  app/
    config.py          — pydantic-settings, loads env vars
    dependencies.py    — JWT validation via Supabase SDK (db.auth.get_user), Supabase client factory
    main.py            — FastAPI app, CORS, mounts 6 routers under /api/v1
    models/
      schemas.py       — all Pydantic request/response models
    routers/
      profile.py       — GET/POST/PUT profile, POST calculate-targets
      dashboard.py     — GET /today (aggregated, avoids N+1; includes current_streak), GET /history (past-day summaries for the Log view)
      meals.py         — POST /analyze, CRUD meals (incl. PUT /{id} for editing logged items), favourites, recents
      water.py         — POST (add 250ml), GET /today, DELETE /{id}, DELETE /?log_date= (remove latest glass on a past day)
      weight.py        — POST (log + EMA smoothing, upserts per date), GET /history, GET /today
      insights.py      — GET /weekly (DORMANT — cached Gemini generation, no longer called by the frontend)
    services/
      nutrition_calc.py — Mifflin-St Jeor BMR, activity multipliers, macro splits, weeks_to_goal
      gemini_service.py — unified photo+text meal analysis (quantity/unit/calorie range/clarifying questions), refine_meal_analysis, weekly insight generation (10-rule warm prompt, fallback template — dormant, see insights.py note)
      unit_conversion.py — Indian household unit→grams table (katori, tbsp, bowl…) and scale_item() for proportional macro rescaling that skips user-edited fields
  migrations/
    001_create_tables.sql — profiles, daily_logs, meal_items, water_logs, weight_logs, weekly_insights
    002_meal_and_profile_calibration.sql — meal_items: quantity, unit, calorie_low/high, user_edited_fields, voice/text sources; profiles: oil_usage_level, portion_calibration
  requirements.txt
  Procfile             — Railway deploy

frontend/
  src/
    api/client.ts      — Axios instance, injects Supabase JWT via interceptor
    lib/supabase.ts    — Supabase client (auth only, NOT for data)
    hooks/
      useToday.ts        — today string, week start, isEvening()
      useSpeechInput.ts   — Web Speech API (en-IN) dictation; mic buttons simply don't render on unsupported browsers
    store/
      authStore.ts     — Supabase session, Google sign-in, onboarding check
      profileStore.ts  — profile CRUD, target calculation
      dailyLogStore.ts — Today's `dashboard` (with current_streak) + separate `history`/`dayDetail` slices for the Log view (fetchHistory, fetchDayDetail, updateMealItem, deleteDayMealItem, addDayWater, removeDayWater, logDayWeight) — kept separate so browsing past days never clobbers Today
    components/
      layout/          — AppShell (floating pill nav + max-w-md container, replaces BottomNav)
      dashboard/       — CalorieCard, MacroBars, WaterTracker (HydrationRing), PlateCard (optional onEdit shows a pencil), LogDuoCard
      meals/           — ReviewCard (edit-before-save: quantity/unit stepper, calorie range, per-item delete, "your correction" indicator, opt-in rescale chip); MealItemEditor (edit-AFTER-save: bottom-sheet for a persisted meal_item → PUT /meals/{id}, live rescale via unitConversion, respects user_edited_fields)
      shared/          — Card (rounded-3xl), Button (primary/secondary/ghost/gradient), StreakBadge
    lib/
      format.ts          — fmtApprox() for ~kcal display, greeting() for time-based salutation
      unitConversion.ts  — client-side mirror of backend unit_conversion.py for instant rescale on quantity/unit change
    pages/
      Login.tsx        — Google sign-in
      Onboarding.tsx   — 10-step stepper with validation; targets step shows weeks-to-goal for lose/gain
      Dashboard.tsx    — greeting + real StreakBadge (current_streak), CalorieCard, LogDuoCard, HydrationRing, PlateCards (today only)
      MealLog.tsx      — Photo / Describe / Recent & Faves tabs, all through POST /meals/analyze; clarifying-question chips; mic input on Describe and as photo caption. Accepts `?date=YYYY-MM-DD` to log to a past day (defaults to today; returns to /history/{date} when set)
      HistoryLog.tsx   — the "Log" tab (route /history): weekly adherence strip (7 day-dots), calorie-vs-goal trend chart (Recharts, 7/14/30-day toggle), and newest-first day list. Read-only summaries; taps open DayDetail
      DayDetail.tsx    — route /history/:date: full editable past day — reuses CalorieCard/WaterTracker/PlateCard; edit/delete/add meals (via MealItemEditor + POST /meals/ with ?date), +/- water, backfill weight
      WeightTracker.tsx — input form, LineChart with raw + smoothed + goal line
      Profile.tsx      — inline-editable details, targets, sign out
    App.tsx            — BrowserRouter, AuthGuard with DEV_MODE bypass
    index.css          — Tailwind v4 @theme with design tokens
  .env                 — placeholder values for DEV_MODE
```

## Database tables

Six tables, all with RLS enabled (user sees own data only):

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | user_id (unique), name, gender, age, height_cm, weight_kg, goal, activity_level, dietary_preference, primary_cuisine, calorie/macro targets, bmr, oil_usage_level (light/medium/generous), portion_calibration (jsonb, e.g. `{"rice_katori_g": 150}`) | One row per user; calibration fields populated progressively during meal logging, not onboarding |
| `daily_logs` | user_id + log_date (unique), total_calories/macros, water_ml | Denormalized for fast dashboard reads |
| `meal_items` | daily_log_id FK, meal_type (breakfast/lunch/snack/dinner), item_name, quantity, unit, calories, calorie_low/high, macros, is_favourite, user_edited_fields (text[], fields never silently overwritten again), source (photo/manual/voice/text/favourite) | |
| `water_logs` | user_id, log_date, amount_ml (default 250) | Each row = one glass |
| `weight_logs` | user_id + log_date (unique), weight_kg, smoothed_kg | EMA smoothing (alpha=0.3) |
| `weekly_insights` | user_id + week_start (unique), insight_text, stats_json | Cached Gemini responses — table retained but the feature is dormant (see stack note) |

## Key algorithms

- **BMR**: Mifflin-St Jeor — `(10 × weight) + (6.25 × height) - (5 × age) + offset` where offset = +5 male, -161 female
- **Activity multipliers**: sedentary=1.2, light=1.35, moderate=1.55, very_active=1.75
- **Macro splits by goal**: lose=40C/30P/25F/5Fi, maintain=50/25/20/5, gain=45/30/20/5
- **Calorie floor**: 1200 kcal minimum regardless of deficit
- **Weight smoothing**: EMA — `smoothed = 0.3 × raw + 0.7 × previous_smoothed`
- **Deficit/surplus**: `weekly_rate_kg × 1100` cal/day (7700 cal ≈ 1 kg)
- **Weeks to goal**: `abs(current_weight_kg - goal_weight_kg) / weekly_rate_kg`, computed for lose/gain only (omitted for maintain)
- **Unit conversion**: `unit_conversion.py` maps Indian household units (katori, tbsp, bowl, piece, etc.) to grams; `scale_item()` rescales calories/macros proportionally on quantity/unit change, skipping any field listed in `user_edited_fields`
- **Consistency streak**: consecutive days (ending today, or yesterday if today isn't logged yet) with `total_calories > 0`; computed in `dashboard.py` and returned as `current_streak` on `GET /dashboard/today`
- **Day logged status** (Log view, `HistoryLog.tsx` `dayStatus()`): `logged` (accent pink) if `total_calories > 0`, `none` (grey) if unlogged — no "on track"/"off" verdict against the goal, just visual awareness of what was logged vs. the goal line

## Design system — Berry Pop (MUST be followed throughout the product)

The UI was redesigned from the Plate Pal project. All new UI work must continue this design language — do not revert to the old sage green palette.

### Colors (OKLCH, defined in `frontend/src/index.css`)
- **Primary**: Electric violet `oklch(0.6 0.22 285)` / `#7c5cff`
- **Secondary**: Mint teal `oklch(0.72 0.13 180)` / `#00c2a8`
- **Accent**: Bubblegum pink `oklch(0.7 0.22 0)` / `#ff5d9e`
- **Warning**: Sunny yellow `oklch(0.88 0.16 95)` / `#ffd23f`
- **Background**: Off-white lavender `oklch(0.985 0.012 305)`
- **Macro colors**: protein=violet (primary), carbs=yellow (warning), fat=pink (accent), fibre=mint (secondary)
- **Gradients**: `gradient-berry` (violet→pink), `gradient-mint` (mint→violet) — use `gradient-berry` on primary CTAs

### Typography
- **Display font**: Fredoka — use `font-display` class on headings, large numbers, page titles
- **Body font**: Plus Jakarta Sans — default for all other text
- **Tabular numbers**: add `num` class on any numeric output (calories, weights, percentages)

### Spacing & radius
- Base radius `1.25rem` with Tailwind scale: `rounded-2xl` for inputs/buttons, `rounded-3xl` for cards, `rounded-[32px]` for the CalorieCard hero
- Mobile-first: `max-w-md` content container, `px-5 pt-8 pb-32` page padding (leaves room for floating nav)

### Layout
- **Bottom nav**: Floating pill (`rounded-full`, `bg-card/90 backdrop-blur`), centered, 3 tabs (Today / **Log** / Profile) + gradient **`+ Add`** FAB button (→ `/log`) — defined in `AppShell.tsx`. Note: the "Log" tab (history, `/history`) is a noun; the "+ Add" FAB is the verb — kept distinct on purpose so the two labels don't collide
- No full-width sticky bottom bar — the floating pill is the only nav pattern

### Component conventions
- **Cards**: `rounded-3xl bg-card border border-border/60 shadow-[0_4px_30px_-12px_rgba(108,92,231,0.15)]`
- **Buttons**: `rounded-2xl font-semibold active:scale-[0.98]`; primary CTAs use `gradient-berry`
- **Section labels**: `text-[10px] font-bold uppercase tracking-[0.18em]` in `text-secondary` or `text-primary`
- **Blur orbs**: decorative `absolute` divs with `rounded-full blur-3xl opacity-70` inside cards for depth
- **Animations**: `streak-pop` (badge pop), `water-wave` (hydration icon) — defined in `index.css`

## UX rules — follow these strictly

- **Forgiving by design** — no shame language, no "cheat day", celebrate consistency
- **One hard warning**: under-eating (<1200 kcal after 7 PM) — gentle nudge, not alarm
- **Over-eating**: soft message at >115% target — "listen to your hunger from here"
- **All calorie estimates shown with tilde**: "~430 kcal" — never false precision
- **Log (history) is encouragement, not audit**: past days shown with accent-pink/grey logged dots — no on-track/off verdict, just awareness of what was logged vs. goal; consistency celebrated via streak + "X/7 days logged" — missed days are grey, not flagged
- **Past days are editable**: meals (add/edit/delete), water (+/-), and weight can all be corrected retroactively from `DayDetail.tsx` — forgiving by design

## Auth flow

1. Frontend uses Supabase JS SDK for Google OAuth only
2. Supabase session JWT is attached to all API calls via Axios interceptor
3. Backend validates JWT via Supabase SDK (`db.auth.get_user`), extracts user_id from the returned user object
4. Frontend talks to Supabase ONLY for auth — all data goes through FastAPI

## Environment variables

**Backend** (`backend/.env`):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
- `ALLOWED_ORIGINS` (comma-separated, default `http://localhost:5173`)

**Frontend** (`frontend/.env`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`)

## API routes (all under /api/v1)

- `GET /health` — health check (no auth)
- `GET/POST/PUT /profile/` — profile CRUD
- `POST /profile/calculate-targets` — preview targets without saving
- `GET /dashboard/today?log_date=YYYY-MM-DD` — aggregated dashboard data (includes `current_streak`)
- `GET /dashboard/history?limit=30` — past-day summaries for the Log view: `{ targets, days: [{ log_date, totals, water_ml, weight_kg }] }`, newest first
- `POST /meals/analyze` — Gemini analysis; accepts any combo of photo + text_description, returns items with quantity/unit/calorie range and optional clarifying_questions
- `POST /meals/analyze/refine` — re-estimates from clarifying-question answers; never overwrites `user_edited_fields`
- `POST /meals/` — log items (each carries its own `log_date`, so it works for past days), `GET /meals/date/{date}`, `PUT/DELETE /meals/{id}` (PUT = edit a logged item)
- `GET /meals/favourites`, `GET /meals/recent`, `POST /meals/{id}/favourite`
- `POST /water/`, `GET /water/today`, `DELETE /water/{id}`, `DELETE /water/?log_date=YYYY-MM-DD` (remove most-recent glass on that date)
- `POST /weight/` (upserts per date, so it backfills/corrects), `GET /weight/history`, `GET /weight/today`
- `GET /insights/weekly` — DORMANT: cached Gemini generation, not called by the frontend anymore

## Remaining work

### Must do before deploy
- [ ] Set up Supabase project (create tables via `001_create_tables.sql` then `002_meal_and_profile_calibration.sql`, enable Google Auth)
- [ ] Configure real API keys in .env files
- [ ] Test full auth flow end-to-end (Google sign-in → onboarding → dashboard)
- [ ] Test Gemini meal analysis with real Indian food photos, text-only descriptions, and photo+caption combos; confirm calorie ranges and clarifying questions are sensible
- [ ] Test voice entry (`useSpeechInput`) on iOS Safari specifically — Web Speech API support is inconsistent there; confirm graceful fallback to text
- [ ] Test the Log/history flow end-to-end against a real Supabase: log across ≥2 days → `GET /dashboard/history` lists them → open a past day → edit a meal (PUT /meals/{id}) and confirm the day's totals + calorie/macro bars re-fetch correctly → add/remove water and backfill weight → confirm `current_streak` increments across consecutive logged days (all verified statically so far — tsc clean + Vite bundle builds; not yet run against a live backend)
- [ ] Handle empty states gracefully (first-time user with no data)
- [ ] Add error toasts for failed API calls
- [ ] Deploy: Vercel (frontend) + Railway (backend)

### Nice to have
- [ ] Image upload to Supabase Storage (currently base64 in request)
- [ ] Offline support / PWA
- [ ] Dark mode (design tokens ready for it)
- [ ] Search within the Log / history view
- [ ] Per-day snapshot of targets (the Log currently judges past days against *today's* profile targets, not the targets in effect on that day)
- [ ] Export data
- [ ] Decide the fate of the dormant weekly-insight feature (`insights.py` + `gemini_service`) — resurface somewhere or delete

## Eval tool

A separate local tool at `eval/` for labeling ground truth on meal photos
and measuring Gemini meal-analysis accuracy — no changes to `backend/` or
`frontend/`, it only imports `analyze_meal()` from
`backend/app/services/gemini_service.py` so the eval measures exactly what
the app ships. Runs on port 8100, independent of the app backend.

```
eval/
  server.py            — FastAPI app: dataset CRUD, labeling, background eval runner, metrics, CSV export
  static/index.html    — single-file vanilla-JS UI (labeling view + toggleable eval panel), no build step
  README.md            — run instructions, keyboard shortcuts
  data/                — gitignored: images/ (content-hash named), dataset.json (samples+labels), predictions.json (model runs, kept separate from labels)
```

- Loads `GEMINI_API_KEY` etc. from `backend/.env` explicitly (`load_dotenv` + `sys.path.insert` for `backend/`) before importing `gemini_service` — Python 3.9 rules apply here too.
- Samples are deduped by sha1 of file bytes; `status` is `unlabeled | labeled | ignored` (ignored ≠ deleted — excluded from metrics/remaining count, reversible).
- Eval runs execute in a background asyncio queue (`POST /api/eval/run`, `GET /api/eval/status`) so labeling isn't blocked; predictions are stored per-run (model name, timestamp, latency) separate from `dataset.json`, so re-running after a prompt change never touches ground truth.
- Metrics (`GET /api/eval/results`): MAE/MAPE/mean-signed-bias for calories + each macro, % of samples where true calories fall in the predicted `[calorie_low, calorie_high]` range, and fuzzy-matched (`difflib`, threshold 0.55) item-level precision/recall.
- Run it: `uvicorn eval.server:app --port 8100 --reload` from repo root. Full usage/shortcuts in `eval/README.md`.

## Commands

### Makefile shortcuts (run from repo root)
```bash
make dev       # frontend + backend together (Ctrl+C stops both)
make backend   # backend only  → http://localhost:8000
make frontend  # frontend only → http://localhost:5173
make eval      # eval tool     → http://localhost:8100
make install   # npm install + pip install for both
```
Backend targets expect `backend/.venv` to exist (`python3 -m venv backend/.venv`) — if it was created under a different path/folder name, its shebangs break; recreate it if `uvicorn`/`pip` stop resolving inside it.

### Original commands
```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# Type check frontend
cd frontend && npx tsc --noEmit

# Eval tool (meal-photo labeling + accuracy metrics)
uvicorn eval.server:app --port 8100 --reload
```
