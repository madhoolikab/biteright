from datetime import date, timedelta

from fastapi import APIRouter, Depends
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.schemas import (
    DashboardResponse,
    DaySummary,
    HistoryResponse,
    HistoryTargets,
    MealItemResponse,
    MealSlotSummary,
    WeightLogResponse,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"]

DEFAULT_TARGETS = {
    "calorie_target": 1650,
    "protein_target_g": 82,
    "carbs_target_g": 165,
    "fat_target_g": 46,
    "fibre_target_g": 25,
}


def _get_targets(db: Client, user_id: str) -> dict:
    profile = (
        db.table("profiles")
        .select("calorie_target, protein_target_g, carbs_target_g, fat_target_g, fibre_target_g")
        .eq("user_id", user_id)
        .execute()
    )
    return profile.data[0] if profile.data else dict(DEFAULT_TARGETS)


def _compute_streak(db: Client, user_id: str, log_date: date) -> int:
    """Consecutive days (ending on log_date or the day before) with calories logged."""
    rows = (
        db.table("daily_logs")
        .select("log_date, total_calories")
        .eq("user_id", user_id)
        .lte("log_date", str(log_date))
        .order("log_date", desc=True)
        .limit(400)
        .execute()
    )
    logged = {
        date.fromisoformat(r["log_date"])
        for r in rows.data
        if (r.get("total_calories") or 0) > 0
    }
    if not logged:
        return 0
    # Allow the streak to be "alive" if today isn't logged yet but yesterday is.
    cursor = log_date if log_date in logged else log_date - timedelta(days=1)
    streak = 0
    while cursor in logged:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


@router.get("/today", response_model=DashboardResponse)
async def get_dashboard(
    log_date: date,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    # Profile for targets
    targets = _get_targets(db, user_id)

    # Daily log
    daily = (
        db.table("daily_logs")
        .select("*")
        .eq("user_id", user_id)
        .eq("log_date", str(log_date))
        .execute()
    )
    daily_data = daily.data[0] if daily.data else {
        "total_calories": 0,
        "total_carbs_g": 0,
        "total_protein_g": 0,
        "total_fat_g": 0,
        "total_fibre_g": 0,
        "water_ml": 0,
    }

    # Meal items grouped by type
    meals_result = (
        db.table("meal_items")
        .select("*")
        .eq("user_id", user_id)
        .eq("log_date", str(log_date))
        .order("created_at")
        .execute()
    )

    meals_by_type: dict[str, list] = {mt: [] for mt in MEAL_TYPES}
    for item in meals_result.data:
        mt = item["meal_type"]
        if mt in meals_by_type:
            meals_by_type[mt].append(item)

    meal_summaries = []
    for mt in MEAL_TYPES:
        items = meals_by_type[mt]
        meal_summaries.append(
            MealSlotSummary(
                meal_type=mt,
                total_calories=sum(i.get("calories") or 0 for i in items),
                item_count=len(items),
                items=[MealItemResponse(**i) for i in items],
            )
        )

    # Weight
    weight = (
        db.table("weight_logs")
        .select("*")
        .eq("user_id", user_id)
        .eq("log_date", str(log_date))
        .execute()
    )
    today_weight = None
    if weight.data:
        today_weight = WeightLogResponse(**weight.data[0])

    return DashboardResponse(
        log_date=log_date,
        total_calories=daily_data.get("total_calories") or 0,
        total_carbs_g=daily_data.get("total_carbs_g") or 0,
        total_protein_g=daily_data.get("total_protein_g") or 0,
        total_fat_g=daily_data.get("total_fat_g") or 0,
        total_fibre_g=daily_data.get("total_fibre_g") or 0,
        calorie_target=targets["calorie_target"],
        protein_target_g=targets["protein_target_g"],
        carbs_target_g=targets["carbs_target_g"],
        fat_target_g=targets["fat_target_g"],
        fibre_target_g=targets["fibre_target_g"],
        water_ml=daily_data.get("water_ml") or 0,
        water_target_ml=2500,
        meals=meal_summaries,
        today_weight=today_weight,
        current_streak=_compute_streak(db, user_id, log_date),
    )


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    limit: int = 30,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    targets = _get_targets(db, user_id)

    logs = (
        db.table("daily_logs")
        .select("*")
        .eq("user_id", user_id)
        .order("log_date", desc=True)
        .limit(limit)
        .execute()
    )

    weights = (
        db.table("weight_logs")
        .select("log_date, weight_kg")
        .eq("user_id", user_id)
        .order("log_date", desc=True)
        .limit(limit)
        .execute()
    )
    weight_by_date = {w["log_date"]: w["weight_kg"] for w in weights.data}

    days = [
        DaySummary(
            log_date=row["log_date"],
            total_calories=row.get("total_calories") or 0,
            total_protein_g=row.get("total_protein_g") or 0,
            total_carbs_g=row.get("total_carbs_g") or 0,
            total_fat_g=row.get("total_fat_g") or 0,
            total_fibre_g=row.get("total_fibre_g") or 0,
            water_ml=row.get("water_ml") or 0,
            weight_kg=weight_by_date.get(row["log_date"]),
        )
        for row in logs.data
    ]

    return HistoryResponse(
        targets=HistoryTargets(
            calorie_target=targets["calorie_target"],
            protein_target_g=targets["protein_target_g"],
            carbs_target_g=targets["carbs_target_g"],
            fat_target_g=targets["fat_target_g"],
            fibre_target_g=targets["fibre_target_g"],
        ),
        days=days,
    )
