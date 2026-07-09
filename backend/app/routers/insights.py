import json
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.schemas import WeeklyInsightResponse
from app.services.gemini_service import generate_weekly_insight

router = APIRouter(prefix="/insights", tags=["insights"])


def _get_monday(d: date) -> date:
    """Return the Monday of the week containing date d."""
    return d - timedelta(days=d.weekday())


@router.get("/weekly", response_model=WeeklyInsightResponse)
async def get_weekly_insight(
    week_start: Optional[date] = None,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    if week_start is None:
        week_start = _get_monday(date.today())

    # Check cache
    cached = (
        db.table("weekly_insights")
        .select("*")
        .eq("user_id", user_id)
        .eq("week_start", str(week_start))
        .execute()
    )
    if cached.data:
        row = cached.data[0]
        stats = json.loads(row["stats_json"]) if isinstance(row["stats_json"], str) else row["stats_json"]
        return WeeklyInsightResponse(
            week_start=row["week_start"],
            insight_text=row["insight_text"],
            days_logged=stats.get("days_logged", 0),
            avg_calories=stats.get("avg_daily_calories", 0),
            weight_change_kg=stats.get("weight_change_kg"),
        )

    # Gather stats for the week
    week_end = week_start + timedelta(days=6)
    daily_logs = (
        db.table("daily_logs")
        .select("total_calories, total_carbs_g, total_protein_g, total_fat_g, total_fibre_g")
        .eq("user_id", user_id)
        .gte("log_date", str(week_start))
        .lte("log_date", str(week_end))
        .execute()
    )

    days_logged = len(daily_logs.data)
    if days_logged == 0:
        raise HTTPException(status_code=404, detail="No data logged this week yet")

    avg_cal = sum(d["total_calories"] or 0 for d in daily_logs.data) / days_logged
    avg_carbs = sum(d["total_carbs_g"] or 0 for d in daily_logs.data) / days_logged
    avg_protein = sum(d["total_protein_g"] or 0 for d in daily_logs.data) / days_logged
    avg_fat = sum(d["total_fat_g"] or 0 for d in daily_logs.data) / days_logged
    avg_fibre = sum(d["total_fibre_g"] or 0 for d in daily_logs.data) / days_logged

    # Weight change
    weights = (
        db.table("weight_logs")
        .select("weight_kg, log_date")
        .eq("user_id", user_id)
        .gte("log_date", str(week_start))
        .lte("log_date", str(week_end))
        .order("log_date")
        .execute()
    )
    weight_change = None
    if len(weights.data) >= 2:
        weight_change = round(
            weights.data[-1]["weight_kg"] - weights.data[0]["weight_kg"], 2
        )

    # Get profile for context
    profile = (
        db.table("profiles")
        .select("name, gender, goal, calorie_target, dietary_preference, primary_cuisine, health_conditions, protein_target_g, fibre_target_g, goal_weight_kg")
        .eq("user_id", user_id)
        .execute()
    )
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    p = profile.data[0]

    # Common foods this week
    meals = (
        db.table("meal_items")
        .select("item_name")
        .eq("user_id", user_id)
        .gte("log_date", str(week_start))
        .lte("log_date", str(week_end))
        .execute()
    )
    food_counts: dict[str, int] = {}
    for m in meals.data:
        food_counts[m["item_name"]] = food_counts.get(m["item_name"], 0) + 1
    common_foods = sorted(food_counts, key=food_counts.get, reverse=True)[:6]

    context = {
        "user_profile": {
            "name": p["name"],
            "gender": p["gender"],
            "goal": p["goal"],
            "target_calories": p["calorie_target"],
            "diet_preference": p["dietary_preference"],
            "cuisine": p["primary_cuisine"],
            "health_conditions": p["health_conditions"],
        },
        "week_stats": {
            "days_logged": days_logged,
            "avg_daily_calories": round(avg_cal),
            "target_calories": p["calorie_target"],
            "avg_protein_g": round(avg_protein),
            "avg_carbs_g": round(avg_carbs),
            "avg_fat_g": round(avg_fat),
            "avg_fibre_g": round(avg_fibre),
            "target_protein_g": p["protein_target_g"],
            "target_fibre_g": p["fibre_target_g"],
        },
        "weight_change_kg": weight_change,
        "common_foods": common_foods,
    }

    insight_text = await generate_weekly_insight(p["name"], context)

    stats_for_storage = {
        "days_logged": days_logged,
        "avg_daily_calories": round(avg_cal),
        "weight_change_kg": weight_change,
    }

    db.table("weekly_insights").insert(
        {
            "user_id": user_id,
            "week_start": str(week_start),
            "insight_text": insight_text,
            "stats_json": json.dumps(stats_for_storage),
        }
    ).execute()

    return WeeklyInsightResponse(
        week_start=week_start,
        insight_text=insight_text,
        days_logged=days_logged,
        avg_calories=round(avg_cal),
        weight_change_kg=weight_change,
    )
