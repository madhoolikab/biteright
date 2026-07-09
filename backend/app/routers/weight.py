from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.schemas import WeightLogCreate, WeightLogResponse

router = APIRouter(prefix="/weight", tags=["weight"])

EMA_ALPHA = 0.3


def _compute_smoothed(db: Client, user_id: str, raw_kg: float) -> float:
    """Exponential Moving Average. First entry: smoothed = raw."""
    prev = (
        db.table("weight_logs")
        .select("smoothed_kg")
        .eq("user_id", user_id)
        .order("log_date", desc=True)
        .limit(1)
        .execute()
    )
    if not prev.data:
        return raw_kg
    prev_smoothed = prev.data[0]["smoothed_kg"]
    return round(EMA_ALPHA * raw_kg + (1 - EMA_ALPHA) * prev_smoothed, 2)


@router.post("/", response_model=WeightLogResponse)
async def log_weight(
    req: WeightLogCreate,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    smoothed = _compute_smoothed(db, user_id, req.weight_kg)

    existing = (
        db.table("weight_logs")
        .select("id")
        .eq("user_id", user_id)
        .eq("log_date", str(req.log_date))
        .execute()
    )

    data = {
        "user_id": user_id,
        "log_date": str(req.log_date),
        "weight_kg": req.weight_kg,
        "smoothed_kg": smoothed,
    }

    if existing.data:
        result = (
            db.table("weight_logs")
            .update(data)
            .eq("id", existing.data[0]["id"])
            .execute()
        )
    else:
        result = db.table("weight_logs").insert(data).execute()

    return result.data[0]


@router.get("/history", response_model=list[WeightLogResponse])
async def get_weight_history(
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
    days: int = 90,
):
    result = (
        db.table("weight_logs")
        .select("*")
        .eq("user_id", user_id)
        .order("log_date", desc=True)
        .limit(days)
        .execute()
    )
    return list(reversed(result.data))


@router.get("/today")
async def get_weight_today(
    log_date: date,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    result = (
        db.table("weight_logs")
        .select("*")
        .eq("user_id", user_id)
        .eq("log_date", str(log_date))
        .execute()
    )
    if not result.data:
        return None
    return result.data[0]
