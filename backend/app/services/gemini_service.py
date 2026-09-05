import base64
import json
import re
from typing import Optional

import google.generativeai as genai

from app.config import get_settings
from app.models.schemas import MealAnalysisResponse, MealRefineRequest

ITEMS_JSON_SCHEMA = """{
  "items": [
    {
      "item_name": "string",
      "portion_description": "string",
      "quantity": number,
      "unit": "piece" | "cup" | "tbsp" | "tsp" | "gram" | "ml" | "glass",
      "estimated_grams": number,
      "calories": number,
      "calorie_low": number,
      "calorie_high": number,
      "carbs_g": number,
      "protein_g": number,
      "fat_g": number,
      "fibre_g": number,
      "confidence": "high" | "medium" | "low",
      "basis": {
        "summary": "one short plain-language line: what you identified + main composition + oil level, e.g. 'ridge gourd, tomato-onion base, moderate oil'. Omit any oil mention for oil-free dishes",
        "ingredients": ["short list of the assumed components; for cooked-in-oil dishes include one oil entry with a concrete anchor, e.g. 'ridge gourd', 'tomato', 'onion', '~2 tsp oil'. Omit the oil entry for oil-free dishes"],
        "oil_level": "light" | "medium" | "generous" | "none"
      },
      "alternatives": [
        {
          "item_name": "string - a plausible alternative dish this could be instead",
          "confidence": "high" | "medium" | "low",
          "note": "optional short reason the alternative is plausible, e.g. 'similar color and consistency'"
        }
      ]
    }
  ],
  "meal_description": "Brief one-line description of the overall meal",
  "clarifying_questions": [
    {
      "item_index": number,
      "field": "string",
      "question": "string",
      "options": ["string"]
    }
  ]
}"""

MEAL_ANALYSIS_PROMPT = """You are a nutrition analyst specializing in Indian cuisine.
Identify each food item from the meal photo and/or the user's description below. If both are given, the description clarifies or adds to what is visible (e.g. "extra ghee on this").

For each item, provide:
- item_name: common Indian name (e.g., "Pesarattu" not "green gram crepe", "Idli" not "steamed rice cake")
- portion_description: the portion in household terms (e.g., "2 medium idlis", "1 cup of sambar")
- quantity + unit: the portion as a number and a household unit from the allowed list. Prefer natural units: countable items (idli, dosa, roti) = "piece"; curries/dal/rice = "cup" (use fractional amounts like 0.5 or 1.5 as needed); oil/ghee/chutney = "tbsp"/"tsp"; drinks like water, buttermilk/chaas, or ragi java = "glass"; tea/coffee = "cup"
- estimated_grams: approximate total weight in grams (consistent with quantity x unit)
- calories: best point estimate in kilocalories
- calorie_low / calorie_high: an honest error range around the estimate. Narrow (~±10%) when confidence is high, wide (~±25-35%) when low — variable oil, hidden ghee, or ambiguous portions widen the range
- carbs_g, protein_g, fat_g, fibre_g: grams
- confidence: "high", "medium", or "low"
- basis: show your work so the user can trust the number. "summary" is one short, plain-language line naming what you identified and the assumptions behind the estimate — the main ingredients, the rough composition (e.g. tomato-onion base vs. coconut base), and, for cooked-in-oil dishes, the oil level (this makes clear the oil is already counted in the calories). "ingredients" lists those components in common Indian terms. "oil_level" is your assumed oil use: "light", "medium", or "generous". For dishes made with NO added cooking oil or ghee — boiled, steamed, or raw items (boiled egg white, plain idli, ragi java/porridge, curd, fruit, most beverages) — set "oil_level": "none", do NOT include an oil entry in "ingredients", and do NOT mention oil in "summary". For all other (oil-cooked) dishes, "ingredients" MUST include one entry for the oil/ghee you assumed with a concrete anchor (e.g. "~2 tsp oil"). No jargon, no Western renaming.
- alternatives: a short list of other dishes this could plausibly be instead of your primary identification. Populate this ONLY when the dish is genuinely visually or descriptively ambiguous with another common Indian dish (e.g. sambar vs. rasam, dosa vs. uttapam, one dal vs. another). Each alternative needs at least item_name and confidence; note is optional. Return an empty list [] for items you are confidently able to identify — do not pad this with unlikely or generic guesses just to fill it in. At most 2 alternatives per item.

Important rules:
1. Use common Indian food names, not anglicized versions
2. Account for typical Indian cooking methods (oil tempering, ghee, etc.) in calorie estimates
3. If items are folded, stacked, or partially hidden, estimate the full portion
4. All values are for the item's full stated quantity, not per single unit
5. Be conservative — slightly overestimate rather than underestimate calories
6. If you cannot identify an item clearly, include it with your best guess and set confidence to "low"

Clarifying questions:
- Populate "clarifying_questions" ONLY when confidence is low or medium on a calorically material item (e.g. oil amount not visible in a curry, ambiguous portion size). At most 2 questions per meal; return [] when nothing material is unclear.
- Each question: item_index (0-based into items), field (what it clarifies, e.g. "oil_usage_level", "quantity"), a short friendly question, and 2-4 short answer options.
- Never ask about something the user's description or the calibration context already answers.
- Never ask an oil question ("oil_usage_level") for a dish cooked/served without oil (boiled, steamed, raw, curd, fruit, beverages) — i.e. one whose basis.oil_level is "none".

Respond ONLY with valid JSON in this exact format:
""" + ITEMS_JSON_SCHEMA

REFINE_PROMPT = """You are a nutrition analyst specializing in Indian cuisine.
You previously analyzed a meal (JSON below). The user has now answered clarifying questions. Adjust the affected items' numbers accordingly and return the complete updated analysis.

Previous analysis:
{items_json}

User's answers:
{answers_json}

Rules:
1. Only adjust values that the answers actually affect; keep everything else identical
2. Tighten calorie_low/calorie_high now that you know more; update confidence if warranted
3. NEVER change fields the user has manually corrected: {user_edited_json} (keys are item indexes, values are the protected field names)
4. Return "clarifying_questions": [] — do not ask anything further
5. If an answer's field is "item_name", the item was misidentified — the item_name in the previous analysis JSON already reflects the corrected dish. Re-derive estimated_grams, calories, calorie_low/high, and all macros for that dish from scratch (keep the same quantity/unit unless clearly wrong for the new dish) rather than nudging the old numbers
6. Re-emit "basis" for any item whose numbers changed so it stays consistent with the new estimate. When an answer's field is "oil_usage_level", update that item's basis.oil_level to match, adjust the oil entry in basis.ingredients (e.g. "~1 tsp oil" vs "~1 tbsp oil"), and reword basis.summary accordingly. Leave basis unchanged for items you did not touch.
7. If an answer resolves the ambiguity behind an item's "alternatives" (e.g. the user confirms it's sambar, not rasam), clear that item's alternatives to []. Otherwise leave alternatives unchanged.

Respond ONLY with valid JSON in this exact format:
"""


def _get_model():
    settings = get_settings()
    genai.configure(api_key=settings.gemini_api_key)
    return genai.GenerativeModel("gemini-3.1-flash-lite")


def _build_prompt(
    dietary_preference: Optional[str],
    primary_cuisine: Optional[str],
    oil_usage_level: Optional[str] = None,
    portion_calibration: Optional[dict] = None,
    text_description: Optional[str] = None,
) -> str:
    prompt = MEAL_ANALYSIS_PROMPT
    context_parts = []
    if dietary_preference:
        context_parts.append(f"The user follows a {dietary_preference} diet.")
    if primary_cuisine:
        cuisine_label = primary_cuisine.replace("_", " ").title()
        context_parts.append(f"Their primary cuisine is {cuisine_label}.")
    if oil_usage_level:
        context_parts.append(
            f"They typically cook with {oil_usage_level} oil — assume this unless the input says otherwise."
        )
    if portion_calibration:
        cal = ", ".join(f"{k} = {v}g" for k, v in portion_calibration.items())
        context_parts.append(f"Their typical portions (use as defaults): {cal}.")
    if context_parts:
        prompt += "\n\nAdditional context: " + " ".join(context_parts)
    if text_description and text_description.strip():
        prompt += f'\n\nUser\'s description of the meal: "{text_description.strip()}"'
    return prompt


def _drop_moot_oil_questions(result: MealAnalysisResponse) -> MealAnalysisResponse:
    """The model sometimes asks about oil despite the prompt rule against it.
    Enforce the rule in code rather than trusting it followed the instruction:
    drop any oil_usage_level question for an item whose own basis says no oil."""
    result.clarifying_questions = [
        q
        for q in result.clarifying_questions
        if not (
            q.field == "oil_usage_level"
            and q.item_index < len(result.items)
            and result.items[q.item_index].basis
            and result.items[q.item_index].basis.oil_level == "none"
        )
    ]
    return result


def _parse_response(text: str) -> MealAnalysisResponse:
    try:
        data = json.loads(text)
        return _drop_moot_oil_questions(MealAnalysisResponse(**data))
    except (json.JSONDecodeError, ValueError):
        pass

    json_match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if json_match:
        data = json.loads(json_match.group(1))
        return _drop_moot_oil_questions(MealAnalysisResponse(**data))

    raise ValueError("Could not parse Gemini response as JSON")


async def analyze_meal(
    image_base64: Optional[str] = None,
    text_description: Optional[str] = None,
    dietary_preference: Optional[str] = None,
    primary_cuisine: Optional[str] = None,
    oil_usage_level: Optional[str] = None,
    portion_calibration: Optional[dict] = None,
) -> MealAnalysisResponse:
    model = _get_model()
    prompt = _build_prompt(
        dietary_preference,
        primary_cuisine,
        oil_usage_level,
        portion_calibration,
        text_description,
    )
    contents = [prompt]
    if image_base64:
        image_data = base64.b64decode(image_base64)
        contents.append({"mime_type": "image/jpeg", "data": image_data})

    response = model.generate_content(
        contents,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
        request_options={"timeout": 15},
    )

    return _parse_response(response.text)


async def refine_meal_analysis(req: MealRefineRequest) -> MealAnalysisResponse:
    model = _get_model()
    prompt = REFINE_PROMPT.format(
        items_json=json.dumps([i.model_dump() for i in req.items]),
        answers_json=json.dumps([a.model_dump() for a in req.answers]),
        user_edited_json=json.dumps(req.user_edited_fields or {}),
    ) + ITEMS_JSON_SCHEMA
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
        request_options={"timeout": 15},
    )
    result = _parse_response(response.text)
    # Hard guarantee: user-corrected fields are never overwritten, even if the model ignores rule 3
    for idx_str, fields in (req.user_edited_fields or {}).items():
        idx = int(idx_str)
        if idx < len(req.items) and idx < len(result.items):
            for field in fields:
                if hasattr(result.items[idx], field):
                    setattr(result.items[idx], field, getattr(req.items[idx], field))
    # Hard guarantee: an item_index whose identity was just resolved by a clarifying
    # answer can't still be ambiguous, even if the model ignores rule 7
    for ans in req.answers:
        if ans.field == "item_name" and ans.item_index < len(result.items):
            result.items[ans.item_index].alternatives = []
    result.clarifying_questions = []
    return result


WEEKLY_INSIGHT_PROMPT = """You are a supportive nutrition coach for {name}. Generate ONE brief, personalised weekly insight based on their tracking data.

Context:
{context}

Rules:
1. Keep it to 2-3 sentences maximum
2. Be conversational and warm, never clinical or preachy
3. Never use shame language. If they went over calories, frame it neutrally
4. Celebrate consistency ("5 out of 7 days logged" is great, not "you missed 2 days")
5. If protein is consistently low, suggest specific Indian vegetarian sources they're already eating (dal, paneer, curd, sprouts, chana) — not supplements or Western foods
6. If fibre is low, suggest adding a side of vegetables or switching to whole grains
7. Reference their actual foods when possible, not generic advice
8. If weight is trending in goal direction, acknowledge it simply
9. Under-eating is more concerning than over-eating — flag it gently if avg < 1200
10. Sign off warmly but briefly"""


async def generate_weekly_insight(name: str, context: dict) -> str:
    model = _get_model()
    prompt = WEEKLY_INSIGHT_PROMPT.format(
        name=name,
        context=json.dumps(context, indent=2, default=str),
    )
    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                max_output_tokens=200,
                temperature=0.7,
            ),
            request_options={"timeout": 15},
        )
        return response.text.strip()
    except Exception:
        days = context.get("week_stats", {}).get("days_logged", 0)
        avg = context.get("week_stats", {}).get("avg_daily_calories", 0)
        target = context.get("week_stats", {}).get("target_calories", 0)
        return (
            f"You logged {days} out of 7 days this week. "
            f"Your average intake was ~{round(avg)} kcal against a target of {target} kcal."
        )
