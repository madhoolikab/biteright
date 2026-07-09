"""Local meal-photo labeling & eval tool.

Run from repo root: uvicorn eval.server:app --port 8100 --reload
Python 3.9 -- Optional[X], no X | None union syntax.
"""
import asyncio
import base64
import csv
import difflib
import hashlib
import io
import json
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Union

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

EVAL_DIR = Path(__file__).parent
REPO_ROOT = EVAL_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"
DATA_DIR = EVAL_DIR / "data"
IMAGES_DIR = DATA_DIR / "images"
DATASET_PATH = DATA_DIR / "dataset.json"
PREDICTIONS_PATH = DATA_DIR / "predictions.json"

DATA_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

load_dotenv(dotenv_path=BACKEND_DIR / ".env")
sys.path.insert(0, str(BACKEND_DIR))

from app.services import gemini_service  # noqa: E402

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
MACRO_FIELDS = ("carbs_g", "protein_g", "fat_g", "fibre_g")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json(path: Path, default):
    if not path.exists():
        return default
    with open(path, "r") as f:
        return json.load(f)


def _save_json(path: Path, data):
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2, default=str)
    tmp.replace(path)


def load_dataset() -> dict:
    return _load_json(DATASET_PATH, {})


def save_dataset(dataset: dict):
    _save_json(DATASET_PATH, dataset)


def load_predictions() -> dict:
    return _load_json(PREDICTIONS_PATH, {})


def save_predictions(predictions: dict):
    _save_json(PREDICTIONS_PATH, predictions)


def _import_bytes(dataset: dict, content: bytes, original_filename: str) -> Optional[str]:
    sample_id = hashlib.sha1(content).hexdigest()[:12]
    if sample_id in dataset:
        return None  # already present, dedupe
    ext = Path(original_filename).suffix.lower() or ".jpg"
    dest = IMAGES_DIR / f"{sample_id}{ext}"
    dest.write_bytes(content)
    dataset[sample_id] = {
        "id": sample_id,
        "original_filename": original_filename,
        "ext": ext,
        "added_at": _now(),
        "status": "unlabeled",
        "notes": "",
        "label": None,
    }
    return sample_id


def _image_path(sample: dict) -> Path:
    return IMAGES_DIR / f"{sample['id']}{sample['ext']}"


# --- Eval queue state (in-process, single worker) ---

class EvalQueue:
    def __init__(self):
        self.pending: List[str] = []
        self.current: Optional[str] = None
        self.done_count = 0
        self.total_count = 0
        self.errors: dict = {}
        self._task: Optional[asyncio.Task] = None

    def enqueue(self, ids: List[str]):
        new_ids = [i for i in ids if i not in self.pending]
        self.pending.extend(new_ids)
        self.total_count += len(new_ids)
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())

    async def _run(self):
        dataset = load_dataset()
        while self.pending:
            sample_id = self.pending.pop(0)
            self.current = sample_id
            sample = dataset.get(sample_id)
            if not sample:
                self.done_count += 1
                continue
            await _run_prediction(sample)
            self.done_count += 1
            self.current = None
            await asyncio.sleep(1.5)  # be gentle with Gemini rate limits
        self.current = None
        self.pending = []
        self.done_count = 0
        self.total_count = 0

    def status(self) -> dict:
        return {
            "pending": len(self.pending),
            "current": self.current,
            "done": self.done_count,
            "total": self.total_count,
        }


queue = EvalQueue()


async def _run_prediction(sample: dict):
    predictions = load_predictions()
    runs = predictions.setdefault(sample["id"], [])
    image_bytes = _image_path(sample).read_bytes()
    image_b64 = base64.b64encode(image_bytes).decode()
    start = time.time()
    run_record = {
        "run_at": _now(),
        "model_name": "gemini-3.1-flash-lite",
        "items": [],
        "meal_description": "",
        "latency_ms": None,
        "error": None,
    }
    try:
        result = await gemini_service.analyze_meal(image_base64=image_b64)
        run_record["items"] = [item.model_dump() for item in result.items]
        run_record["meal_description"] = result.meal_description
    except Exception as exc:
        run_record["error"] = str(exc)
    run_record["latency_ms"] = round((time.time() - start) * 1000)
    runs.append(run_record)
    save_predictions(predictions)


# --- Metrics ---

def _sum_field(items: List[dict], field: str) -> float:
    return sum(item.get(field) or 0 for item in items)


def _match_items(label_items: List[dict], pred_items: List[dict], threshold: float = 0.55):
    remaining_pred = list(enumerate(pred_items))
    matches = []
    for label_item in label_items:
        best_idx = None
        best_score = 0.0
        for idx, pred_item in remaining_pred:
            score = difflib.SequenceMatcher(
                None,
                (label_item.get("item_name") or "").lower(),
                (pred_item.get("item_name") or "").lower(),
            ).ratio()
            if score > best_score:
                best_score = score
                best_idx = idx
        if best_idx is not None and best_score >= threshold:
            matches.append((label_item, dict(remaining_pred)[best_idx]))
            remaining_pred = [(i, p) for i, p in remaining_pred if i != best_idx]
    missed = len(label_items) - len(matches)
    hallucinated = len(remaining_pred)
    return matches, missed, hallucinated


def _sample_result(sample: dict, run: dict) -> Optional[dict]:
    if not sample.get("label") or run.get("error"):
        return None
    label_items = sample["label"]["items"]
    pred_items = run["items"]

    true_totals = {"calories": _sum_field(label_items, "calories")}
    pred_totals = {"calories": _sum_field(pred_items, "calories")}
    for field in MACRO_FIELDS:
        true_totals[field] = _sum_field(label_items, field)
        pred_totals[field] = _sum_field(pred_items, field)

    pred_low = _sum_field(pred_items, "calorie_low")
    pred_high = _sum_field(pred_items, "calorie_high")
    in_range = pred_low <= true_totals["calories"] <= pred_high if (pred_low or pred_high) else None

    matches, missed, hallucinated = _match_items(label_items, pred_items)
    matched_label_ids = {id(l) for l, _ in matches}
    matched_pred_ids = {id(p) for _, p in matches}

    return {
        "id": sample["id"],
        "original_filename": sample["original_filename"],
        "true": true_totals,
        "predicted": pred_totals,
        "predicted_range": {"low": pred_low, "high": pred_high},
        "in_range": in_range,
        "missed_items": missed,
        "hallucinated_items": hallucinated,
        "label_item_count": len(label_items),
        "pred_item_count": len(pred_items),
        "latency_ms": run.get("latency_ms"),
        "run_at": run.get("run_at"),
        "label_items": [
            {**item, "_matched": id(item) in matched_label_ids} for item in label_items
        ],
        "pred_items": [
            {**item, "_matched": id(item) in matched_pred_ids} for item in pred_items
        ],
        "meal_description": run.get("meal_description", ""),
    }


def _aggregate_metrics(results: List[dict]) -> dict:
    if not results:
        return {}
    metrics = {}
    for field in ("calories",) + MACRO_FIELDS:
        errors = [r["predicted"][field] - r["true"][field] for r in results]
        abs_errors = [abs(e) for e in errors]
        pct_errors = [
            abs(e) / r["true"][field] * 100
            for e, r in zip(errors, results)
            if r["true"][field]
        ]
        metrics[field] = {
            "mae": round(sum(abs_errors) / len(abs_errors), 1),
            "mape": round(sum(pct_errors) / len(pct_errors), 1) if pct_errors else None,
            "mean_signed_bias": round(sum(errors) / len(errors), 1),
        }
    in_range_results = [r for r in results if r["in_range"] is not None]
    metrics["range_coverage_pct"] = (
        round(100 * sum(1 for r in in_range_results if r["in_range"]) / len(in_range_results), 1)
        if in_range_results
        else None
    )
    total_missed = sum(r["missed_items"] for r in results)
    total_hallucinated = sum(r["hallucinated_items"] for r in results)
    total_labeled_items = sum(r["label_item_count"] for r in results)
    total_pred_items = sum(r["pred_item_count"] for r in results)
    matched = total_labeled_items - total_missed
    metrics["item_detection"] = {
        "missed": total_missed,
        "hallucinated": total_hallucinated,
        "precision": round(matched / total_pred_items, 2) if total_pred_items else None,
        "recall": round(matched / total_labeled_items, 2) if total_labeled_items else None,
    }
    metrics["sample_count"] = len(results)
    return metrics


# --- API models ---

class ImportRequest(BaseModel):
    path: str


class SampleUpdate(BaseModel):
    label: Optional[dict] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class EvalRunRequest(BaseModel):
    ids: Union[List[str], str]  # list of sample ids, or the literal "all"


app = FastAPI(title="BiteRight Eval Tool")


@app.get("/api/samples")
def get_samples():
    dataset = load_dataset()
    samples = list(dataset.values())
    counts = {
        "total": len(samples),
        "labeled": sum(1 for s in samples if s["status"] == "labeled"),
        "ignored": sum(1 for s in samples if s["status"] == "ignored"),
        "unlabeled": sum(1 for s in samples if s["status"] == "unlabeled"),
    }
    return {"samples": samples, "counts": counts}


@app.post("/api/samples/import")
def import_samples(req: ImportRequest):
    source = Path(req.path).expanduser()
    if not source.exists():
        raise HTTPException(404, f"Path not found: {source}")
    dataset = load_dataset()
    imported = 0
    skipped = 0
    files = [source] if source.is_file() else sorted(
        p for p in source.rglob("*") if p.suffix.lower() in IMAGE_EXTS
    )
    for f in files:
        if f.suffix.lower() not in IMAGE_EXTS:
            continue
        sample_id = _import_bytes(dataset, f.read_bytes(), f.name)
        if sample_id:
            imported += 1
        else:
            skipped += 1
    save_dataset(dataset)
    return {"imported": imported, "skipped_duplicates": skipped}


@app.post("/api/samples/upload")
async def upload_samples(files: List[UploadFile] = File(...)):
    dataset = load_dataset()
    imported = 0
    skipped = 0
    for upload in files:
        content = await upload.read()
        if Path(upload.filename).suffix.lower() not in IMAGE_EXTS:
            continue
        sample_id = _import_bytes(dataset, content, upload.filename)
        if sample_id:
            imported += 1
        else:
            skipped += 1
    save_dataset(dataset)
    return {"imported": imported, "skipped_duplicates": skipped}


@app.delete("/api/samples/{sample_id}")
def delete_sample(sample_id: str):
    dataset = load_dataset()
    sample = dataset.pop(sample_id, None)
    if not sample:
        raise HTTPException(404, "Sample not found")
    image_path = _image_path(sample)
    if image_path.exists():
        image_path.unlink()
    save_dataset(dataset)
    predictions = load_predictions()
    predictions.pop(sample_id, None)
    save_predictions(predictions)
    return {"ok": True}


@app.put("/api/samples/{sample_id}")
def update_sample(sample_id: str, update: SampleUpdate):
    dataset = load_dataset()
    sample = dataset.get(sample_id)
    if not sample:
        raise HTTPException(404, "Sample not found")
    if update.label is not None:
        sample["label"] = {**update.label, "labeled_at": _now()}
        if sample["status"] == "unlabeled":
            sample["status"] = "labeled"
    if update.notes is not None:
        sample["notes"] = update.notes
    if update.status is not None:
        if update.status not in ("unlabeled", "labeled", "ignored"):
            raise HTTPException(400, "Invalid status")
        sample["status"] = update.status
    save_dataset(dataset)
    return sample


@app.get("/images/{sample_id}")
def get_image(sample_id: str):
    dataset = load_dataset()
    sample = dataset.get(sample_id)
    if not sample:
        raise HTTPException(404, "Sample not found")
    return FileResponse(_image_path(sample))


@app.get("/thumbs/{sample_id}")
def get_thumb(sample_id: str):
    # No image-processing dependency in this repo; browser scales the full
    # image down for the grid view (dataset is small enough this is fine).
    return get_image(sample_id)


@app.post("/api/eval/run")
async def run_eval(req: EvalRunRequest):
    dataset = load_dataset()
    if req.ids == "all":
        ids = [s["id"] for s in dataset.values() if s["status"] == "labeled"]
    else:
        ids = [i for i in req.ids if i in dataset]
    if not ids:
        raise HTTPException(400, "No valid sample ids to queue")
    queue.enqueue(ids)
    return {"queued": len(ids)}


@app.get("/api/eval/status")
def eval_status():
    return queue.status()


@app.get("/api/eval/results")
def eval_results():
    dataset = load_dataset()
    predictions = load_predictions()
    results = []
    for sample_id, sample in dataset.items():
        runs = predictions.get(sample_id)
        if not runs:
            continue
        result = _sample_result(sample, runs[-1])
        if result:
            results.append(result)
    return {"results": results, "aggregate": _aggregate_metrics(results)}


@app.get("/api/eval/export")
def export_csv():
    dataset = load_dataset()
    predictions = load_predictions()
    results = []
    for sample_id, sample in dataset.items():
        runs = predictions.get(sample_id)
        if not runs:
            continue
        result = _sample_result(sample, runs[-1])
        if result:
            results.append(result)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    header = ["id", "filename", "true_calories", "pred_calories", "pred_low", "pred_high", "in_range"]
    for field in MACRO_FIELDS:
        header += [f"true_{field}", f"pred_{field}"]
    header += ["missed_items", "hallucinated_items", "latency_ms"]
    writer.writerow(header)
    for r in results:
        row = [
            r["id"], r["original_filename"],
            r["true"]["calories"], r["predicted"]["calories"],
            r["predicted_range"]["low"], r["predicted_range"]["high"], r["in_range"],
        ]
        for field in MACRO_FIELDS:
            row += [r["true"][field], r["predicted"][field]]
        row += [r["missed_items"], r["hallucinated_items"], r["latency_ms"]]
        writer.writerow(row)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=eval_results.csv"},
    )


app.mount("/", StaticFiles(directory=str(EVAL_DIR / "static"), html=True), name="static")
