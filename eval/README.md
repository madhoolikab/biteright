# Meal-Photo Labeling & Eval Tool

A local tool for building ground-truth labels for meal photos and measuring
how accurate BiteRight's Gemini-based meal analysis actually is. It reuses
`analyze_meal()` from `backend/app/services/gemini_service.py` directly, so
the eval measures exactly what the app ships.

## Run it

Uses the same virtualenv/deps as `backend/` (fastapi, uvicorn,
python-dotenv, google-generativeai are already in `backend/requirements.txt`).
From the repo root:

```bash
cd backend && source .venv/bin/activate   # or however you activate the backend env
cd ..
uvicorn eval.server:app --port 8100 --reload
```

Open http://localhost:8100. It reads `GEMINI_API_KEY` from `backend/.env`
automatically — no separate config needed.

All data (images, labels, prediction runs) lives in `eval/data/`, which is
gitignored — it's real food photos and personal labels, not app code.

## Seeding the dataset

Use the import box at the top of the page and point it at a server-side
path, e.g. `BiteRight FoodPics` (relative to wherever you started uvicorn,
or an absolute path). It recurses into folders, copies each image into
`eval/data/images/` under a content-hash name, and dedupes automatically —
re-importing the same folder is a no-op. You can also drag/upload files
directly from the browser via "Upload files".

## Labeling

- Left: the photo (click to zoom). Right: an editable table of items —
  name, quantity, unit, grams, calories, protein, carbs, fat, fibre.
- `+ Add item` for missed items, `✕` to delete a row.
- Notes field for anything about the shot (angle, oil unclear, etc).
- "Ignore this sample" excludes it from the remaining-count and from eval
  metrics without deleting it — reversible.
- Saving is manual (`Enter` / `Cmd+S`) or automatic when you navigate away
  with unsaved changes (a pink dot next to the image shows dirty state).

### Keyboard shortcuts

| Key | Action |
|---|---|
| `←` / `→` | prev / next sample |
| `Enter` / `Cmd+S` | save |
| `Cmd+Enter` | save & jump to next unlabeled sample |
| `I` | toggle ignore |
| `A` | add item row |
| `G` | toggle grid view |
| `E` | toggle eval panel |
| `R` | queue current sample for eval |
| `?` | shortcut overlay |

Shortcuts are suppressed while typing in a field, except `Cmd`-combos.

### Grid view

Toggle with `G` or the header button. Shows all samples as thumbnails with
status badges. Shift/Cmd-click to multi-select, then use the toolbar to
bulk ignore/un-ignore/remove or queue selected samples for eval.

## Running the eval

Toggle eval mode with `E` or the header button — it's a separate panel, the
labeling view never shows eval UI unless you switch to it. Run controls:
run the current sample, run all labeled samples, or (from grid view)
run a multi-selected subset. Runs execute in a background asyncio queue
with a small delay between calls to stay under Gemini rate limits, so you
can keep labeling while a batch runs — a queue badge in the header shows
progress.

**Metrics** (computed over labeled samples with at least one prediction
run):
- Calories & each macro: MAE, MAPE, mean signed bias (systematic
  over/under-estimation)
- **Range coverage**: % of samples where the true calorie total falls
  inside the model's predicted `[calorie_low, calorie_high]` sum — this
  directly tests whether the app's "~430 kcal" honesty claim holds up
- **Item detection**: greedy fuzzy name matching (`difflib.SequenceMatcher`,
  threshold 0.55) between labeled and predicted items → missed/hallucinated
  item counts, precision/recall
- Per-sample drill-down (click a row in the results table): side-by-side
  item lists with matched/unmatched items highlighted

Export the current results as CSV via the "Export CSV" button
(`GET /api/eval/export`) for further analysis in a spreadsheet.

Each prediction run stores the Gemini model name and timestamp, so after a
prompt change in `gemini_service.py` you can re-run and compare eras —
re-running never touches your ground-truth labels, since predictions and
labels are stored separately (`predictions.json` vs `dataset.json`).

## Notes

- No image-resizing dependency (Pillow) is in the repo, so `/thumbs/{id}`
  currently serves the full image — fine at the current dataset size (the
  browser scales it down for the grid).
- This tool only imports from `backend/app/services/` — it never modifies
  `backend/` or `frontend/`.
