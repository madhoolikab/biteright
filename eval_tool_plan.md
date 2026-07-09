# Meal-Photo Labeling & Eval Tool

## Context

BiteRight's core feature is Gemini-based meal-photo analysis (calories + macros per item), but there's currently no way to measure how accurate it is. There's a dataset of 65 real food photos at `BiteRight FoodPics/`, and the goal is a local labeling UI to record per-item ground truth (calories + macros), manage the dataset (add/remove images individually or by folder, mark samples as ignored), and — behind a toggle so it never intrudes on labeling — run the actual analysis pipeline against one/some/all samples in the background and see accuracy metrics.

## Approach

A self-contained local tool at `eval/` in the repo: a small FastAPI server (`eval/server.py`) serving one static HTML page (vanilla JS, no build step). It reuses the backend's existing `analyze_meal()` from `backend/app/services/gemini_service.py:137` for predictions, so the eval measures exactly what the app ships. Runs on port **8100**, separate from the app's backend.

```
eval/
  server.py            — FastAPI app: dataset CRUD, label save, eval runner, static files
  static/index.html    — single-file UI (HTML+CSS+JS inline)
  data/                — gitignored
    images/            — canonical copies of dataset images, named <sha1-12>.jpg
    dataset.json       — manifest: one record per sample (label, notes, status)
    predictions.json   — model runs keyed by sample id (kept separate from labels)
```

### Data model

`dataset.json` — list of samples:

```json
{
  "id": "a3f9c2e1b0d4",              // sha1 of file bytes (12 chars) → dedupe + survives renames
  "original_filename": "IMG-20260704-WA0028.jpg",
  "added_at": "2026-07-05T...",
  "status": "unlabeled | labeled | ignored",
  "notes": "",
  "label": {
    "items": [
      { "item_name": "rice", "quantity": 1, "unit": "katori",
        "estimated_grams": 150, "calories": 200,
        "carbs_g": 44, "protein_g": 4, "fat_g": 0.5, "fibre_g": 1 }
      // grams and macros optional per item; calories required
    ],
    "labeled_at": "..."
  }
}
```

Label item fields deliberately mirror `AnalyzedFoodItem` (`backend/app/models/schemas.py:137`) so comparison is field-for-field. Meal totals are always derived by summing items — never stored.

`predictions.json` — per sample id, a list of runs: `{run_at, model_name, items: [AnalyzedFoodItem…], meal_description, latency_ms, error}`. Keeping runs separate from labels means re-running the model (e.g. after a prompt change) never touches ground truth, and prompt iterations can be compared.

### Server endpoints (all local, no auth)

- `GET /api/samples` — full manifest + derived progress counts
- `POST /api/samples/import` — body `{path}`: import a server-side folder (recursively) or single file; copies into `data/images/`, dedupes by hash. Used to seed from `BiteRight FoodPics/`.
- `POST /api/samples/upload` — multipart upload (file-picker / drag-drop / folder upload from the browser)
- `DELETE /api/samples/{id}` — remove from dataset (deletes copy, keeps original source file untouched)
- `PUT /api/samples/{id}` — save label / notes / status (ignore toggle)
- `GET /images/{id}` + `GET /thumbs/{id}` — full image and a cached thumbnail for the grid
- `POST /api/eval/run` — body `{ids: […] | "all"}`: queues background prediction runs (asyncio task, sequential with small delay — Gemini rate limits). Returns immediately so labeling continues.
- `GET /api/eval/status` — queue progress (n done / n queued / current id)
- `GET /api/eval/results` — latest run per sample joined with labels + computed metrics

Imports: `server.py` inserts `backend/` into `sys.path` and loads `backend/.env` (explicit path) before importing `gemini_service`, so the existing `GEMINI_API_KEY` config works unchanged. **Python 3.9** — `Optional[X]`, no `X | None`.

### UI — labeling mode (default view)

- **Header**: progress bar + text — `23 labeled · 3 ignored · 39 remaining`, filter pills (All / Unlabeled / Labeled / Ignored).
- **Main split**: left = image (click to zoom/lightbox); right = label editor:
  - per-item rows: name, quantity, unit (dropdown from `MEAL_UNITS`), grams, calories, protein, carbs, fat, fibre; ✕ to delete row; `+ Add item` button
  - notes textarea (free text: "shot at angle", "oil unclear", etc.)
  - Ignore toggle (ignored samples are skipped by next-unlabeled navigation and excluded from eval metrics)
- **Autosave** on navigate-away; dirty-state indicator.
- **Grid view** (toggle): thumbnail grid with status badges, multi-select → remove / ignore / queue-for-eval; drag-drop or file-picker (`multiple` + `webkitdirectory`) to add images.
- **Keyboard shortcuts** (shown in a `?` overlay):
  - `←`/`→` prev / next · `Enter` or `Cmd+S` save · `Cmd+Enter` save & jump to next unlabeled
  - `I` toggle ignore · `A` add item row · `G` grid view · `E` toggle eval panel · `R` queue current sample for eval
  - shortcuts suppressed while typing in inputs (except Cmd-combos)

### UI — eval mode (hidden until toggled)

- Toggle via `E` or a header tab; labeling view is otherwise completely free of eval UI.
- **Run controls**: run current sample / selected (from grid multi-select) / all labeled. Non-blocking — a small queue badge in the header shows background progress while you keep labeling.
- **Results table** (labeled samples with a prediction): per-sample truth vs predicted calories & macros, error, and a hit/miss flag for whether true calories fall inside the model's `[calorie_low, calorie_high]` range.
- **Aggregate metrics card**:
  - calories & each macro: MAE, MAPE, mean signed bias (does the model systematically over/under-estimate?)
  - **range coverage**: % of samples where true calories ∈ predicted range — directly tests the app's "~430 kcal" honesty
  - **item detection**: greedy fuzzy name matching (`difflib.SequenceMatcher`, threshold ~0.55) between labeled and predicted items → missed / hallucinated item counts, precision/recall
- Per-sample drill-down: side-by-side item lists with matches highlighted.
- `GET /api/eval/export` — CSV of per-sample results for spreadsheet analysis later.

### Extras folded in (the "anything else" ask)

- **Hash-based dedupe** — re-importing the same folder or WhatsApp re-downloads never creates duplicates.
- **Model/prompt snapshot per run** — each prediction stores the Gemini model name and run timestamp, so after a prompt change you can re-run and compare eras.
- **Latency capture** per prediction (free signal while running the eval).
- **Ignored ≠ deleted** — ignore keeps the label but excludes it from metrics and "remaining" count; reversible.
- `.gitignore` entry for `eval/data/` (real food photos + personal labels shouldn't be committed).

## Files to create/modify

| File | Change |
|---|---|
| `eval/server.py` | new — FastAPI app (~250 lines) |
| `eval/static/index.html` | new — single-file UI |
| `eval/README.md` | new — run instructions + shortcut list |
| `.gitignore` | add `eval/data/` |
| `CLAUDE.md` | short section documenting the eval tool |

No changes to `backend/` or `frontend/` — the tool only imports from `backend/app/services/`.

## Verification

1. `cd backend && uvicorn` deps already cover fastapi/uvicorn/google-generativeai — run `uvicorn eval.server:app --port 8100` from repo root (README documents exact command).
2. Import `BiteRight FoodPics/` via the import box → expect 65 samples, progress shows `0 labeled · 65 remaining`; re-import → still 65 (dedupe).
3. Label 2–3 images end-to-end with keyboard only (arrows, add-item, save-and-next); restart server → labels persist.
4. Mark one sample ignored → remaining count drops, next-unlabeled skips it.
5. With a real `GEMINI_API_KEY`, queue 2 labeled samples for eval while continuing to label a third → queue badge updates, results appear in eval panel with sane metrics; export CSV opens correctly.
