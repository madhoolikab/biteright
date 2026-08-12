# BiteRight 🍛

BiteRight is a calorie and nutrition tracker built for people who eat Indian food. Snap a photo of your meal or describe it in your own words, and get calorie and macro estimates that actually understand a katori of dal or a bowl of rice.

🔗 **Try it live:** [biteright-eight.vercel.app](https://biteright-eight.vercel.app)

## What it does

- 📸 **Log meals fast** — take a photo, type a description, or both. Get calorie and macro estimates sized for Indian household units (katori, tbsp, bowl, piece, and more).
- 💧 **Track water and weight** — simple daily logging with a smoothed weight trend so one bad day on the scale doesn't throw you off.
- 🔥 **Build a streak** — see your consistency over time, not just today's numbers.
- 📅 **Fix any day** — go back and edit, add, or delete meals, water, or weight for past days. Nothing is locked in.
- 💛 **No shame, ever** — no "cheat days," no red alerts for going over. Just gentle nudges and encouragement.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Backend | FastAPI (Python) |
| Database & Auth | Supabase (PostgreSQL + Google Auth) |
| Meal photo analysis | Google Gemini |
| Hosting | Vercel (frontend) + Railway (backend) |

## Setting up for development

### Prerequisites

- Node 22
- Python 3.9.6
- A [Supabase](https://supabase.com) project
- A Gemini API key

### Steps

1. **Clone the repo and install dependencies:**
   ```bash
   git clone <repo-url>
   cd biteright
   make install
   ```

2. **Set up your database.** In your Supabase project's SQL editor, run the migrations in order:
   - `backend/migrations/001_create_tables.sql`
   - `backend/migrations/002_meal_and_profile_calibration.sql`

   Also enable Google Auth in your Supabase project settings.

3. **Add your environment variables.**

   `backend/.env` needs:
   ```
   SUPABASE_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   SUPABASE_JWT_SECRET=
   GEMINI_API_KEY=
   ANTHROPIC_API_KEY=
   ALLOWED_ORIGINS=http://localhost:5173
   ```

   `frontend/.env` needs:
   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   ```

   ⚠️ Never commit real keys. Both `.env` files are already gitignored.

4. **Run it:**
   ```bash
   make dev
   ```
   This starts the frontend on `http://localhost:5173` and the backend on `http://localhost:8000`.

For architecture details, database schema, API routes, and the full project structure, see [CLAUDE.md](./CLAUDE.md).

## License

MIT — see [LICENSE](./LICENSE) 📄
