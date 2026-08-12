from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.schemas import (
    CalculateTargetsRequest,
    CalculateTargetsResponse,
    ProfileCreate,
    ProfileResponse,
)
from app.services.nutrition_calc import calculate_targets

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/", response_model=ProfileResponse)
async def get_profile(
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    result = db.table("profiles").select("*").eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data[0]


@router.post("/", response_model=ProfileResponse)
async def create_profile(
    profile: ProfileCreate,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    data = profile.model_dump()
    data["user_id"] = user_id
    data["onboarding_completed"] = True
    result = db.table("profiles").upsert(data, on_conflict="user_id").execute()
    return result.data[0]


@router.put("/", response_model=ProfileResponse)
async def update_profile(
    updates: dict,
    user_id: str = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    updates.pop("user_id", None)
    updates.pop("id", None)
    result = (
        db.table("profiles")
        .update(updates)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data[0]


@router.post("/calculate-targets", response_model=CalculateTargetsResponse)
async def preview_targets(req: CalculateTargetsRequest):
    return calculate_targets(req)
