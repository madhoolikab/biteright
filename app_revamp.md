# Multi-modal food logging + honest estimates + non-destructive corrections

## Original request (verbatim)

> Think like a tech architect, Principal Gen AI Engineer, and efficient UX designer. We don't implement anything now. this is to find what is needed and come up with a task list or a plan to hand over to the Fable model to implement.
>
> This is a nutrition tracking app. It is so hard for people to track their food, particularly to maintain a calorie deficit and lose weight. And even if one wants to start using a scale or cup measures for every meal, indian food has so many ingredients, different levels of oil can be used, different sizes of dosas or chapathis, sambar can have varying proportions of water to dal, biriyani can be cooked in so many styles where the calories can looks so different, etc.. you get the drift.
>
> We're building an app where food tracking becomes something people can do without too much hassle, inputs could be: a picture of their food Or speak into the app like a voice note of what they had, or type in a description of their food, or a combination. Then we process the inputs to give the calories, carbs, protein, fat, fibre values. The perfect calories and macros numbers cannot be found from a picture. So we make a best estimate, and callout the error margin too. If they are willing we can ask a few follow up questions about the food, oils, anything not visible, portion sizes, etc. Also, humans cannot tell grams or ml by eyeballing (unless they've measured before). So, the units should be customizable - cups, tbsp, gms, ml, quantity like 1, 2 for dosas idlys, etc. User always has the option to update any number we give.
>
> About user corrections and updates: User always has the option to update any number, item we give. If they correct the item, we should first update the numbers from our side and then let them correct it. Once they edit something and save, we never overwrite silently. Also, if the quantity is changed by the user the corresponding macros should be updated proportionally.. and it should all be a seamless experience.
>
> And during onboarding itself, find out the user's info you need to calculate the target calories, macros so that the user can reach their goals, show approximately by when they should see their target weight.. also find out things about the user that can be helpful in finding the calories, macros later from their inputs. we already collect gender, dietary preference (may be it can be a description too?), primary cuisine, as inputs. If other inputs can be helpful, consider them too. Also, i dunno if it should be a meal by meal thing or a common input, what oil they use (if it matters calorifically or otherwise for our product), if they use less medium or mode oil in cooking, etc. there might be other helpful inputs also.
>
> solve this problem. be efficient with the tokens. use whatever tools will make the app work beautifully. our app should be motivation for users to reach their weight goals.

## Guiding principles for implementation (hand these to Fable as-is)

- **Code**: efficient, readable, simple, well organized, easy to navigate. Reuse existing patterns (`EditableField`, `Card`, `profileStore`/`dailyLogStore` conventions) rather than inventing parallel ones. No speculative abstraction — build for the modalities and units actually specified below, not a generic plugin system. Prefer one obviously-correct code path over branching logic for cases that can't happen (e.g. voice is a text path, not a fourth parallel flow — see §4).
- **UX**: delightful, inviting, simple, clean. Every estimate shown with a range and a tilde, never false precision. Corrections should feel like a natural conversation, not a form: pre-filled, one-tap where possible, always skippable, never a dead end. Motivational tone throughout (ties into existing "forgiving by design, no shame language" rule in CLAUDE.md) — the "weeks to goal" addition in §5 exists specifically to keep the user motivated, not just informed.

## Context

Indian food is genuinely hard to estimate calorically — variable oil, water-to-dal ratios in sambar, dosa/roti sizes, biriyani cooking styles. Forcing users to weigh food or pick from a rigid food database is why tracking apps fail. The goal: let the user log a meal however is easiest for them (photo, voice note, typed description, or any combination), get an honest best-estimate with a visible error margin instead of false precision, optionally answer 1-2 quick clarifying questions, and always be able to correct any number afterward — with corrections applied predictably (proportional macro scaling on quantity change, no silent overwrites) rather than each field being edited independently as today.

This also directly resolves an already-logged bug (`issues_identified.md` #1: "portion size edits don't auto-recalculate macros") and a related one (#4: "deleting one item deletes the whole meal") that the new review-card UX must not reproduce.

Current state confirmed by exploration:
- Only **photo** and **manual name+calories** input exist. No voice, no text-description mode.
- `gemini_service.py` does a single-shot Gemini call (`gemini-3.1-flash-lite`), returns items with `estimated_grams`, calories, macros, and a coarse `confidence` label ("high"/"medium"/"low") — **no numeric error range**.
- Everything is metric-only (grams/kcal). No unit selector (cups/tbsp/pieces/etc).
- In `MealLog.tsx`, each macro field is edited independently via `EditableField`; there is **no quantity input at all** in the UI today, so nothing scales proportionally.
- Corrections are destructive direct `UPDATE`s — no concept of "this field was user-set, don't touch it again."
- `dietary_preference`, `primary_cuisine`, `health_conditions` are collected at onboarding but **not currently consumed** by `nutrition_calc.py` (targets math only uses gender/weight/height/age/activity/goal/weekly_rate_kg) — they're informational/stored today, available to pass into the Gemini prompt but not wired into calorie math.

Decisions locked in with the user:
1. **Voice → text**: use the Web Speech API client-side for transcription (free, instant, no extra vendor), then send the transcript as text alongside/with photo — not raw audio to Gemini.
2. **Calibration (oil usage, portion size)**: gathered **progressively, in-context** the first time it's relevant during meal logging — not added to onboarding, which stays at its current 10 steps.
3. **Follow-up clarifying questions**: always **skippable** — shown as quick-reply chips only when confidence is low, with a visible "skip, just estimate" path. Never blocks saving a meal.

---

## Architecture

### 1. Unified analysis request (backend)

Extend `POST /meals/analyze` to accept any combination of `image` (existing), `text_description` (new — from typed input or from Web Speech transcript), plus profile calibration hints. One Gemini call reasons over whatever is present — no separate vendor for voice since transcription happens client-side first.

`backend/app/services/gemini_service.py`:
- Generalize `MEAL_ANALYSIS_PROMPT` to accept an optional photo, optional free-text description, plus `dietary_preference`, `primary_cuisine`, and new calibration hints (`oil_usage_level`, `portion_calibration` dict) pulled from the user's profile — used as default assumptions when the input doesn't make oil/portion explicit.
- Change output schema per item to include:
  - `quantity` (number) + `unit` (string: piece/cup/tbsp/tsp/bowl/katori/glass/gram/ml) instead of grams-only — grams still computed but as a derived/canonical field, not the only one shown.
  - `calorie_low` / `calorie_high` (numeric range) alongside the existing point estimate — replaces "confidence label as the only signal of uncertainty." Keep the label too for a quick UI badge, but the range is what's shown to the user (ties into existing UX rule: always show "~", never false precision).
  - `clarifying_questions`: optional array of `{field, question, options[]}`, populated only when confidence is low/medium on a material item (e.g. oil quantity not visible, ambiguous portion). Empty array = nothing to ask.
- Add `services/unit_conversion.py`: canonical unit→grams table for common Indian household units (katori, tbsp of oil/rice, medium dosa, medium roti, etc.), plus a `scale_item(item, new_quantity, new_unit)` helper that recomputes grams and macros proportionally. This is the single source of truth used both server-side (if ever needed) and mirrored client-side for instant UI feedback.
- Add a second, lightweight endpoint `POST /meals/analyze/refine` that takes the original analysis + the user's answers to `clarifying_questions` and returns adjusted numbers — only called if the user actually answers a follow-up chip (keeps the common path to one Gemini call).

### 2. Data model changes

New migration on top of `001_create_tables.sql`:
- `meal_items`: add `quantity numeric`, `unit text`, `calorie_low numeric`, `calorie_high numeric`, `user_edited_fields text[]` (tracks which fields the user has explicitly corrected, e.g. `{quantity, protein_g}` — anything in this list is never silently recalculated again for that item), extend `source` enum to include `voice`, `text`.
- `profiles`: add `oil_usage_level text` (light/medium/generous, nullable — populated progressively) and `portion_calibration jsonb` (nullable, e.g. `{"rice_katori_g": 150, "roti_g": 40}`, grows over time from answered calibration prompts).
- `schemas.py`: mirror these in `AnalyzedFoodItem`, `MealItemCreate/Update/Response`, and `ProfileCreate/Response`.

### 3. Non-destructive correction rule (the core UX contract)

- When a user edits **quantity or unit** on a review card: proportionally rescale calories/macros using `unit_conversion.scale_item()`, client-side, instantly — this is the fix for issue #1.
- When a user directly edits a **macro field** (e.g. overrides protein): mark that field in `user_edited_fields` and stop scaling it automatically going forward (if quantity later changes, scale the other fields but leave user-edited ones untouched, and surface a subtle "this was your correction, scale it too?" toggle rather than silently overwriting).
- Any later refinement call (`/meals/analyze/refine`) must skip fields already in `user_edited_fields`.
- Deleting a single item must delete only that `meal_items` row and re-trigger the existing daily-total recompute — not cascade to the whole meal/plate (fixes issue #4, which the new review-card delete affordance would otherwise reproduce).

### 4. Frontend changes (`frontend/src/pages/MealLog.tsx`)

- Replace the current Photo/Manual/Favourites three-tab layout's "Manual" tab semantics: manual becomes a true **text description** entry ("2 idlis with sambar and coconut chutney, medium oil") sent through the same `/meals/analyze` pipeline as photo — not a bare name+calories form.
- Add a **Voice** entry point: mic button using the Web Speech API (`SpeechRecognition`) for live transcription into the same text field used by the text tab — so voice is really "text input via speaking," reusing one code path, not a fourth parallel flow. Feature-detect API support and fall back to showing the text tab if unavailable (older Safari).
- Allow combining inputs: photo tab gets an optional caption field/mic icon so a user can snap a photo and add "extra ghee on this" in the same submission.
- New shared `ReviewCard` component (replacing today's independent `EditableField`s): quantity + unit selector, calorie range display (`~350–420 kcal`), macro fields, a small "you corrected this" indicator on user-edited fields, and per-item delete.
- Clarifying-question chips render above the review cards only when `clarifying_questions` is non-empty, each with quick-tap options plus an always-visible "skip, use estimate" action. Pre-fill sensible defaults from `profile.oil_usage_level`/`portion_calibration` when available so the chip is a confirm-or-adjust rather than a blank ask.
- First time a calibration-relevant field is answered (e.g. user picks "medium oil" or corrects a rice portion), write it back to `profile.oil_usage_level` / `portion_calibration` via a small `PUT /profile/` patch so future estimates start from that default — this is the "progressive onboarding" mechanism, no separate settings screen needed for v1.

### 5. Onboarding — one small addition, not a new step

No new onboarding steps. Add a computed **"time to goal"** line to the existing `targets` step summary (already shows `bmr`, `calorie_target`, etc.): `weeks_to_goal = abs(current_weight_kg - goal_weight_kg) / weekly_rate_kg`, shown as "~14 weeks to reach 62kg" — purely derived from fields already collected (`weight_kg`, `goal_weight_kg`, `weekly_rate_kg`), no backend change required (or optionally added to `CalculateTargetsResponse` for consistency, backend-computed is cleaner since the formula already lives in `nutrition_calc.py`). This is the motivational payoff the user asked for ("show approximately by when they should see their target weight") without adding onboarding friction.

---

## Explicitly out of scope for this plan
- Wiring `dietary_preference`/`health_conditions` into calorie/macro target math (PCOS/thyroid-adjusted macros) — a nutrition-science decision, not a logging-UX one; worth a separate conversation.
- The other open items in `issues_identified.md` unrelated to this feature (hydration button reload, macro legend redundancy, macro bar remaining-vs-consumed) — not touched here.
- Server-side audio transcription / non-browser voice support — deferred since Web Speech API was chosen.
- Correction-history/audit table — not needed for v1; `user_edited_fields` on the row is sufficient.

## Files to touch (representative, not exhaustive)
- `backend/migrations/002_meal_and_profile_calibration.sql` (new)
- `backend/app/models/schemas.py`
- `backend/app/services/gemini_service.py`
- `backend/app/services/unit_conversion.py` (new)
- `backend/app/services/nutrition_calc.py` (only for the weeks-to-goal helper)
- `backend/app/routers/meals.py`, `backend/app/routers/profile.py`
- `frontend/src/pages/MealLog.tsx`
- `frontend/src/components/meals/ReviewCard.tsx` (new, replaces inline `EditableField` usage for AI-analyzed items)
- `frontend/src/store/dailyLogStore.ts`, `frontend/src/store/profileStore.ts`
- `frontend/src/pages/Onboarding.tsx` (targets step only)

## Verification
- Backend: log a meal via each input mode (photo only, text only, photo+text) against a dev Gemini key; confirm `quantity`/`unit`/`calorie_low`/`calorie_high` are populated and `clarifying_questions` appears only on deliberately ambiguous test photos (e.g. a curry with no visible oil).
- Frontend: in the browser, change an item's quantity and confirm macros rescale instantly and proportionally; directly edit a macro, then change quantity again, and confirm the manually-edited field does not get silently overwritten while others do rescale.
- Delete a single item from a multi-item meal and confirm the other items and the daily total remain intact (regression check for issue #4).
- Answer a clarifying-question chip (e.g. oil level) and confirm it persists to the profile and pre-fills on the next ambiguous meal.
- Confirm the onboarding `targets` step shows a "weeks to goal" line for `lose`/`gain` goals and omits it for `maintain`.
- Test voice entry on the target mobile browser (iOS Safari) explicitly, since Web Speech API support there is inconsistent — confirm the graceful fallback to text-only entry works.
