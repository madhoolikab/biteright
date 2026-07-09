from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.schemas import WaterAddRequest, WaterResponse

router = APIRouter(prefix="/water", tags=["water"])


def _update_daily_water(db: Client, user_id: str, log_date: date):
    """Recalculate total water in daily_logs from water_logs."""
    result = (
        db.table("water_logs")
        .select("amount_ml")
        .eq("user_id", user_id)
        .eq("log_date", str(log_date))
        .execute()
    )
    total = sum(w["amount_ml"] for w in result.data)

    existing = (
        db.table("daily_logs")
        .select("id")
        .eq("user_id", user_id)
        .eq("log_date", str(log_date))
        .execute()
    )
    if existing.data:
        db.table("daily_logs").update({"water_ml": total}).eq(
            "user_id", user_id
        ).eq("log_date", str(log_date)).execute()
    else:
        db.table("daily_logs").insert(
            {"user_id": user_id, "log_date": str(log_date), "water_ml": total}
        ).execute()


@router.post("/", response_model=WaterResponse)
async def add_water(
    req: WaterAddRequest,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    db.table("water_logs").insert(
        {
            "user_id": user_id,
            "log_date": str(req.log_date),
            "amount_ml": req.amount_ml,
        }
    ).execute()
    _update_daily_water(db, user_id, req.log_date)

    result = (
        db.table("water_logs")
        .select("amount_ml")
        .eq("user_id", user_id)
        .eq("log_date", str(req.log_date))
        .execute()
    )
    total = sum(w["amount_ml"] for w in result.data)
    return WaterResponse(total_ml=total)


@router.get("/today", response_model=WaterResponse)
async def get_water_today(
    log_date: date,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    result = (
        db.table("water_logs")
        .select("amount_ml")
        .eq("user_id", user_id)
        .eq("log_date", str(log_date))
        .execute()
    )
    total = sum(w["amount_ml"] for w in result.data)
    return WaterResponse(total_ml=total)


@router.delete("/{log_id}")
async def undo_water(
    log_id: str,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    existing = (
        db.table("water_logs")
        .select("log_date")
        .eq("id", log_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Water log not found")

    db.table("water_logs").delete().eq("id", log_id).eq("user_id", user_id).execute()
    log_date = date.fromisoformat(existing.data[0]["log_date"])
    _update_daily_water(db, user_id, log_date)
    return {"status": "deleted"}
