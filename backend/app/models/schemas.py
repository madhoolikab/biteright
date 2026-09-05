from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import date

MEAL_UNITS = ("piece", "cup", "tbsp", "tsp", "gram", "ml", "glass")


# --- Profile ---

class ProfileCreate(BaseModel):
    name: str
    gender: str = Field(pattern="^(male|female)$")
    age: int = Field(ge=13, le=120)
    height_cm: float = Field(gt=0)
    weight_kg: float = Field(gt=0)
    goal: str = Field(pattern="^(maintain|lose|gain)$")
    goal_weight_kg: Optional[float] = None
    weekly_rate_kg: Optional[float] = None
    activity_level: str = Field(pattern="^(sedentary|light|moderate|very_active)$")
    dietary_preference: str = Field(pattern="^(vegetarian|eggetarian|non_vegetarian|vegan)$")
    health_conditions: list[str] = []
    primary_cuisine: str = Field(pattern="^(south_indian|north_indian|mixed_indian|other)$")
    unit_preference: str = Field(default="metric", pattern="^(metric|imperial)$")
    oil_usage_level: Optional[str] = Field(default=None, pattern="^(light|medium|generous)$")
    portion_calibration: Optional[dict] = None
    calorie_target: int = Field(ge=1200)
    protein_target_g: int = Field(ge=0)
    carbs_target_g: int = Field(ge=0)
    fat_target_g: int = Field(ge=0)
    fibre_target_g: int = Field(ge=0)
    bmr: int
    maintenance_calories: int


class ProfileResponse(ProfileCreate):
    id: str
    user_id: str
    onboarding_completed: bool


class CalculateTargetsRequest(BaseModel):
    gender: str = Field(pattern="^(male|female)$")
    age: int = Field(ge=13, le=120)
    height_cm: float = Field(gt=0)
    weight_kg: float = Field(gt=0)
    goal: str = Field(pattern="^(maintain|lose|gain)$")
    goal_weight_kg: Optional[float] = None
    weekly_rate_kg: Optional[float] = None
    activity_level: str = Field(pattern="^(sedentary|light|moderate|very_active)$")


class CalculateTargetsResponse(BaseModel):
    bmr: int
    maintenance_calories: int
    target_calories: int
    protein_target_g: int
    carbs_target_g: int
    fat_target_g: int
    fibre_target_g: int
    weeks_to_goal: Optional[int] = None


# --- Meals ---

class MealItemBasis(BaseModel):
    """The model's 'show your work' for a dish: what it saw and assumed."""
    summary: Optional[str] = None
    ingredients: list[str] = []
    oil_level: Optional[str] = None


class MealItemCreate(BaseModel):
    log_date: date
    meal_type: str = Field(pattern="^(breakfast|lunch|snack|dinner)$")
    item_name: str
    calories: float
    carbs_g: Optional[float] = None
    protein_g: Optional[float] = None
    fat_g: Optional[float] = None
    fibre_g: Optional[float] = None
    portion_grams: Optional[float] = None
    portion_desc: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    calorie_low: Optional[float] = None
    calorie_high: Optional[float] = None
    user_edited_fields: list[str] = []
    is_estimate: bool = True
    source: str = Field(default="manual", pattern="^(photo|manual|favourite|voice|text)$")
    basis: Optional[dict] = None


class MealItemUpdate(BaseModel):
    item_name: Optional[str] = None
    calories: Optional[float] = None
    carbs_g: Optional[float] = None
    protein_g: Optional[float] = None
    fat_g: Optional[float] = None
    fibre_g: Optional[float] = None
    portion_grams: Optional[float] = None
    portion_desc: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    calorie_low: Optional[float] = None
    calorie_high: Optional[float] = None
    user_edited_fields: Optional[list[str]] = None
    basis: Optional[dict] = None


class MealItemResponse(BaseModel):
    id: str
    meal_type: str
    item_name: str
    calories: float
    carbs_g: Optional[float] = None
    protein_g: Optional[float] = None
    fat_g: Optional[float] = None
    fibre_g: Optional[float] = None
    portion_grams: Optional[float] = None
    portion_desc: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    calorie_low: Optional[float] = None
    calorie_high: Optional[float] = None
    user_edited_fields: list[str] = []
    is_estimate: bool
    is_favourite: bool
    source: str
    basis: Optional[dict] = None


class MealAnalyzeRequest(BaseModel):
    image_base64: Optional[str] = None
    text_description: Optional[str] = None
    dietary_preference: Optional[str] = None
    primary_cuisine: Optional[str] = None
    oil_usage_level: Optional[str] = None
    portion_calibration: Optional[dict] = None

    @model_validator(mode="after")
    def require_some_input(self):
        if not self.image_base64 and not (self.text_description or "").strip():
            raise ValueError("Provide a photo, a description, or both")
        return self


class FoodItemEstimate(BaseModel):
    """The full nutritional estimate for one dish identification — same shape whether
    it's the primary guess or an alternative, so acting on either needs no further model call."""
    item_name: str
    portion_description: str
    quantity: float = 1
    unit: str = "piece"
    estimated_grams: float
    calories: float
    calorie_low: float = 0
    calorie_high: float = 0
    carbs_g: float
    protein_g: float
    fat_g: float
    fibre_g: float
    confidence: str = "medium"
    basis: Optional[MealItemBasis] = None


class AlternativeCandidate(FoodItemEstimate):
    """A plausible alternative identification for an item whose dish is genuinely ambiguous."""
    note: Optional[str] = None


class AnalyzedFoodItem(FoodItemEstimate):
    alternatives: list[AlternativeCandidate] = []


class ClarifyingQuestion(BaseModel):
    item_index: int
    field: str
    question: str
    options: list[str]


class MealAnalysisResponse(BaseModel):
    items: list[AnalyzedFoodItem]
    meal_description: str
    clarifying_questions: list[ClarifyingQuestion] = []


class RefineAnswer(BaseModel):
    item_index: int
    field: str
    answer: str


class MealRefineRequest(BaseModel):
    items: list[AnalyzedFoodItem]
    answers: list[RefineAnswer]
    # item_index (as string key) -> fields the user has corrected; refine must not change these
    user_edited_fields: dict = {}
    dietary_preference: Optional[str] = None
    primary_cuisine: Optional[str] = None


# --- Water ---

class WaterAddRequest(BaseModel):
    log_date: date
    amount_ml: int = 250


class WaterResponse(BaseModel):
    total_ml: int
    target_ml: int = 2500


# --- Weight ---

class WeightLogCreate(BaseModel):
    log_date: date
    weight_kg: float = Field(gt=0)


class WeightLogResponse(BaseModel):
    id: str
    log_date: date
    weight_kg: float
    smoothed_kg: float


# --- Dashboard ---

class MealSlotSummary(BaseModel):
    meal_type: str
    total_calories: float
    item_count: int
    items: list[MealItemResponse]


class DashboardResponse(BaseModel):
    log_date: date
    total_calories: float
    total_carbs_g: float
    total_protein_g: float
    total_fat_g: float
    total_fibre_g: float
    calorie_target: int
    protein_target_g: int
    carbs_target_g: int
    fat_target_g: int
    fibre_target_g: int
    water_ml: int
    water_target_ml: int
    meals: list[MealSlotSummary]
    today_weight: Optional[WeightLogResponse] = None
    current_streak: int = 0


# --- History ---

class HistoryTargets(BaseModel):
    calorie_target: int
    protein_target_g: int
    carbs_target_g: int
    fat_target_g: int
    fibre_target_g: int
    water_target_ml: int = 2500


class DaySummary(BaseModel):
    log_date: date
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    total_fibre_g: float
    water_ml: int
    weight_kg: Optional[float] = None


class HistoryResponse(BaseModel):
    targets: HistoryTargets
    days: list[DaySummary]


# --- Insights ---

class WeeklyInsightResponse(BaseModel):
    week_start: date
    insight_text: str
    days_logged: int
    avg_calories: float
    weight_change_kg: Optional[float] = None
