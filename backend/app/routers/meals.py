from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.schemas import (
    MealAnalyzeRequest,
    MealAnalysisResponse,
    MealItemCreate,
    MealItemResponse,
    MealItemUpdate,
    MealRefineRequest,
)
from app.services.gemini_service import analyze_meal, refine_meal_analysis

router = APIRouter(prefix="/meals", tags=["meals"])


def _ensure_daily_log(db: Client, user_id: str, log_date: date) -> str:
    """Get or create a daily_log row, return its id."""
    result = (
        db.table("daily_logs")
        .select("id")
        .eq("user_id", user_id)
        .eq("log_date", str(log_date))
        .execute()
    )
    if result.data:
        return result.data[0]["id"]

    new = (
        db.table("daily_logs")
        .insert({"user_id": user_id, "log_date": str(log_date)})
        .execute()
    )
    return new.data[0]["id"]


def _recalculate_daily_totals(db: Client, user_id: str, log_date: date):
    """Sum all meal_items for the day and update daily_logs."""
    items = (
        db.table("meal_items")
        .select("calories, carbs_g, protein_g, fat_g, fibre_g")
        .eq("user_id", user_id)
        .eq("log_date", str(log_date))
        .execute()
    )
    totals = {
        "total_calories": sum(i.get("calories") or 0 for i in items.data),
        "total_carbs_g": sum(i.get("carbs_g") or 0 for i in items.data),
        "total_protein_g": sum(i.get("protein_g") or 0 for i in items.data),
        "total_fat_g": sum(i.get("fat_g") or 0 for i in items.data),
        "total_fibre_g": sum(i.get("fibre_g") or 0 for i in items.data),
    }
    db.table("daily_logs").update(totals).eq("user_id", user_id).eq(
        "log_date", str(log_date)
    ).execute()


@router.post("/analyze", response_model=MealAnalysisResponse)
async def analyze(
    req: MealAnalyzeRequest,
    user_id: str = Depends(get_current_user),
):
    try:
        return await analyze_meal(
            image_base64=req.image_base64,
            text_description=req.text_description,
            dietary_preference=req.dietary_preference,
            primary_cuisine=req.primary_cuisine,
            oil_usage_level=req.oil_usage_level,
            portion_calibration=req.portion_calibration,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Could not analyze this meal. Try a clearer photo or more detail. ({e})",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed. Please try again. ({e})",
        )


@router.post("/analyze/refine", response_model=MealAnalysisResponse)
async def refine_analysis(
    req: MealRefineRequest,
    user_id: str = Depends(get_current_user),
):
    try:
        return await refine_meal_analysis(req)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Could not refine the estimate. ({e})")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Refinement failed. Your original estimate is still good to log. ({e})",
        )


@router.post("/", response_model=list[MealItemResponse])
async def log_meal_items(
    items: list[MealItemCreate],
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    if not items:
        raise HTTPException(status_code=400, detail="No items to log")

    log_date = items[0].log_date
    daily_log_id = _ensure_daily_log(db, user_id, log_date)

    rows = []
    for item in items:
        data = item.model_dump()
        data["user_id"] = user_id
        data["daily_log_id"] = daily_log_id
        data["log_date"] = str(data["log_date"])
        rows.append(data)

    result = db.table("meal_items").insert(rows).execute()
    _recalculate_daily_totals(db, user_id, log_date)
    return result.data


@router.get("/date/{log_date}", response_model=list[MealItemResponse])
async def get_meals_by_date(
    log_date: date,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    result = (
        db.table("meal_items")
        .select("*")
        .eq("user_id", user_id)
        .eq("log_date", str(log_date))
        .order("created_at")
        .execute()
    )
    return result.data


@router.put("/{item_id}", response_model=MealItemResponse)
async def update_meal_item(
    item_id: str,
    updates: MealItemUpdate,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    existing = (
        db.table("meal_items")
        .select("log_date")
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Meal item not found")

    update_data = updates.model_dump(exclude_unset=True)
    result = (
        db.table("meal_items")
        .update(update_data)
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute()
    )
    log_date = existing.data[0]["log_date"]
    _recalculate_daily_totals(db, user_id, date.fromisoformat(log_date))
    return result.data[0]


@router.delete("/{item_id}")
async def delete_meal_item(
    item_id: str,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    existing = (
        db.table("meal_items")
        .select("log_date")
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Meal item not found")

    db.table("meal_items").delete().eq("id", item_id).eq("user_id", user_id).execute()
    log_date = existing.data[0]["log_date"]
    _recalculate_daily_totals(db, user_id, date.fromisoformat(log_date))
    return {"status": "deleted"}


@router.get("/favourites", response_model=list[MealItemResponse])
async def get_favourites(
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    result = (
        db.table("meal_items")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_favourite", True)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    # Deduplicate by item_name, keep most recent
    seen = set()
    unique = []
    for item in result.data:
        if item["item_name"] not in seen:
            seen.add(item["item_name"])
            unique.append(item)
    return unique


@router.get("/recent", response_model=list[MealItemResponse])
async def get_recent(
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    result = (
        db.table("meal_items")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    seen = set()
    unique = []
    for item in result.data:
        if item["item_name"] not in seen:
            seen.add(item["item_name"])
            unique.append(item)
        if len(unique) >= 10:
            break
    return unique


@router.post("/{item_id}/favourite")
async def toggle_favourite(
    item_id: str,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    existing = (
        db.table("meal_items")
        .select("is_favourite")
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Meal item not found")

    new_value = not existing.data[0]["is_favourite"]
    db.table("meal_items").update({"is_favourite": new_value}).eq("id", item_id).execute()
    return {"is_favourite": new_value}
