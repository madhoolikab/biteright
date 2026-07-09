from math import ceil

from app.models.schemas import CalculateTargetsRequest, CalculateTargetsResponse

ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,
    "light": 1.35,
    "moderate": 1.55,
    "very_active": 1.75,
}

MIN_CALORIES = 1200


def calculate_bmr(gender: str, weight_kg: float, height_cm: float, age: int) -> int:
    """Mifflin-St Jeor equation. Women: -161, Men: +5."""
    base = (10 * weight_kg) + (6.25 * height_cm) - (5 * age)
    offset = 5 if gender == "male" else -161
    return round(base + offset)


def calculate_targets(req: CalculateTargetsRequest) -> CalculateTargetsResponse:
    bmr = calculate_bmr(req.gender, req.weight_kg, req.height_cm, req.age)
    multiplier = ACTIVITY_MULTIPLIERS[req.activity_level]
    maintenance = round(bmr * multiplier)

    if req.goal == "maintain":
        target = maintenance
    elif req.goal == "lose":
        daily_deficit = round((req.weekly_rate_kg or 0.3) * 1100)
        target = max(maintenance - daily_deficit, MIN_CALORIES)
    else:  # gain
        daily_surplus = round((req.weekly_rate_kg or 0.3) * 1100)
        target = maintenance + daily_surplus

    target = max(target, MIN_CALORIES)

    # Macro splits based on goal
    if req.goal == "lose":
        carb_pct, protein_pct, fat_pct, fibre_pct = 0.40, 0.30, 0.25, 0.05
    elif req.goal == "gain":
        carb_pct, protein_pct, fat_pct, fibre_pct = 0.45, 0.30, 0.20, 0.05
    else:
        carb_pct, protein_pct, fat_pct, fibre_pct = 0.50, 0.25, 0.20, 0.05

    protein_g = round((target * protein_pct) / 4)
    carbs_g = round((target * carb_pct) / 4)
    fat_g = round((target * fat_pct) / 9)
    fibre_g = round((target * fibre_pct) / 2)  # ~25-30g typically

    weeks_to_goal = None
    if req.goal != "maintain" and req.goal_weight_kg and req.weekly_rate_kg:
        delta = abs(req.weight_kg - req.goal_weight_kg)
        if delta > 0:
            weeks_to_goal = ceil(delta / req.weekly_rate_kg)

    return CalculateTargetsResponse(
        weeks_to_goal=weeks_to_goal,
        bmr=bmr,
        maintenance_calories=maintenance,
        target_calories=target,
        protein_target_g=protein_g,
        carbs_target_g=carbs_g,
        fat_target_g=fat_g,
        fibre_target_g=fibre_g,
    )
