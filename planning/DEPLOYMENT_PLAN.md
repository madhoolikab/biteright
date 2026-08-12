# Deploy BiteRight to Vercel + Railway

## Context

BiteRight works end to end on localhost against a real Supabase project (migrations 001–003 applied, Google sign-in working). The goal is a public URL that can be shared on LinkedIn and with family.

Nothing about the app logic needs to change. What is missing is purely deployment plumbing: there is no `vercel.json` (so the SPA routes 404 on refresh), no SPA rewrite, no Python version pin, CORS defaults to localhost, and the Supabase OAuth redirect allow-list only knows about localhost. There is also one piece of broken dead code that would fail a build if anyone touched it.

Two known UX bugs (#3 hydration reload, #4 delete wipes the plate, in `issues_identified.md`) are explicitly **out of scope** — the decision was to deploy first and fix after.

Host choice: **Vercel for the frontend, Railway for the backend.** The frontend is a static Vite bundle and gets a free global CDN plus per-branch preview deploys on Vercel. The backend must be a long-running container, which is Railway's strength. Platform-provided URLs, no custom domain.

## Step 1 — Pre-deploy cleanup (code changes)

These are small and all in service of the deploy.

1. **Delete `backend/app/services/claude_service.py`.** It imports `anthropic`, which is not in `requirements.txt`, and reads `settings.anthropic_api_key`, which is not a field on `Settings` (`backend/app/config.py`). Nothing imports it — `insights.py` uses `gemini_service.generate_weekly_insight`. It is a build landmine, not a feature.
2. **Remove `ANTHROPIC_API_KEY` from `backend/.env.example`** for the same reason.
3. **Delete `lovable_log_makeover.js`** from the repo root. It is an untracked Lovable design mockup using `@tanstack/react-router` (this app uses react-router-dom), with TypeScript syntax in a `.js` file. Move it out of the project if you want to keep it as a visual reference.
4. **Add `backend/.python-version` containing `3.11`.** Railway otherwise picks its own default. The codebase follows Python 3.9 syntax rules (`Optional[X]`, never `X | None`) which is forward-compatible, so 3.11 is safe and better supported by the pinned dep versions. Keep the 3.9 syntax rule in `CLAUDE.md` — it stays true.
5. **Add `frontend/vercel.json`** with a SPA rewrite. Without it, `BrowserRouter` routes like `/history/2026-07-20` return 404 on a hard refresh or a shared link:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
6. **Add an axios response interceptor in `frontend/src/api/client.ts`** — a 30s timeout and a console-visible error path. Currently there is no timeout and no 401 handling, so a cold-starting or down backend hangs silently. Minimal version only: log the failure and re-reject. Full error toasts stay a follow-up.
7. **Guard missing env vars in `frontend/src/lib/supabase.ts`** — throw a clear error if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are undefined, so a misconfigured Vercel build fails loudly instead of producing a white screen.

Verify locally after these: `cd frontend && npx tsc --noEmit && npm run build`, and `cd backend && python -c "import app.main"`.

## Step 2 — Deploy the backend to Railway

Do the backend first — the frontend build needs its URL baked in.

1. Create a Railway project from the GitHub repo. Set **Root Directory = `backend`** so `Procfile` and `requirements.txt` resolve. The existing `backend/Procfile` (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`) is already correct.
2. Set environment variables in the Railway dashboard, copying values from local `backend/.env`:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `GEMINI_API_KEY`
   - `ALLOWED_ORIGINS` — leave unset for now, set in Step 4 once the Vercel URL exists. **This is the single most common way this deploy breaks**: `backend/app/main.py:10` silently falls back to `http://localhost:5173`, so every browser call fails CORS with no server-side error.
3. Generate a public domain in Railway settings (`*.up.railway.app`).
4. Verify: `curl https://<railway-domain>/health` returns `{"status":"ok"}`.

## Step 3 — Deploy the frontend to Vercel

1. Import the repo on Vercel. Set **Root Directory = `frontend`**. Framework preset Vite; build `npm run build`, output `dist` — all auto-detected.
2. Set environment variables (Production scope):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — same as local `frontend/.env`
   - `VITE_API_BASE_URL` = `https://<railway-domain>/api/v1`
   - `VITE_DEV_MODE` = `false`
   Vite inlines these **at build time**, so any change here requires a redeploy, not just a restart. (`DEV_MODE` is additionally guarded by `import.meta.env.DEV` in `App.tsx`, `profileStore.ts`, `dailyLogStore.ts`, so it is already force-off in production builds — the env var is belt and braces.)
3. Deploy and note the production URL.

## Step 4 — Wire the two together

1. Set `ALLOWED_ORIGINS` on Railway to the exact Vercel production URL, e.g. `https://biteright.vercel.app`. No trailing slash — `CORSMiddleware` does exact string matching on the split list. Redeploy the Railway service.
2. In the **Supabase dashboard → Authentication → URL Configuration**:
   - Site URL = the Vercel production URL
   - Redirect URLs = add the Vercel URL. `authStore.signInWithGoogle()` passes `redirectTo: window.location.origin`, so the deployed origin must be on the allow-list or Google sign-in fails after the consent screen.
3. In the **Google Cloud Console** OAuth client backing the Supabase provider, confirm the Supabase callback URL (`https://<project>.supabase.co/auth/v1/callback`) is in Authorized redirect URIs. This is usually already set from local testing since the callback goes to Supabase, not to your app.

## Step 5 — Verification (end to end, on the deployed URLs)

Run through this in a fresh incognito window on the Vercel URL:

1. `curl https://<railway>/health` → `{"status":"ok"}`
2. Load the app → Login page renders, no console errors about missing Supabase env vars.
3. Google sign-in → lands back on the app authenticated (not stuck on the Supabase callback).
4. New user → onboarding completes → targets calculate → dashboard loads.
5. Log a meal by photo → Gemini analysis returns items with calorie ranges → save → dashboard totals update.
6. Log a meal by text description → same.
7. Add water, log weight → both persist across a page refresh.
8. Open `/history`, open a past day, edit a meal item, delete a water glass.
9. **Hard-refresh directly on `/history/<date>`** → page loads, does not 404. This confirms the `vercel.json` rewrite.
10. Sign out, sign back in → data still there.

Check the Railway logs during this for 500s, and the browser console for CORS errors.

## Known limitations being accepted

- **Gemini calls take several seconds** and Railway has no configured request timeout tuning. Acceptable at this scale.
- **Images are sent as base64 in the request body**, not uploaded to Supabase Storage. Large photos make large requests. Already noted as a nice-to-have in `CLAUDE.md`.
- **`get_current_user()` in `backend/app/dependencies.py`** makes a network round trip to Supabase and builds a fresh client on every request. Fine for a handful of users, would need caching at scale.
- **No error toasts.** Store catch blocks are bare (`dailyLogStore.ts`, `profileStore.ts`), so a failed call shows nothing to the user. The axios interceptor from Step 1 at least makes failures visible in the console.
- **Bugs #3 and #4** from `issues_identified.md` ship as-is, per the deploy-first decision. #4 (delete one item wipes the plate) is worth fixing in the very next deploy.
