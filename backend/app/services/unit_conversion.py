"""Canonical unit -> grams table and proportional item scaling.

Single source of truth for household-unit conversions; mirrored client-side
in frontend/src/lib/unitConversion.ts for instant UI feedback.
"""
from typing import List, Optional

# Approximate grams per 1 unit for common Indian household measures.
# "piece" is intentionally absent: piece weight varies per food (idli vs dosa),
# so it is derived from the item's own estimated_grams / quantity.
UNIT_GRAMS = {
    "cup": 240,
    "glass": 250,
    "tbsp": 15,
    "tsp": 5,
    "gram": 1,
    "ml": 1,
}

SCALABLE_FIELDS = (
    "calories",
    "calorie_low",
    "calorie_high",
    "carbs_g",
    "protein_g",
    "fat_g",
    "fibre_g",
    "estimated_grams",
)


def _grams_per_unit(item: dict, unit: str) -> Optional[float]:
    if unit in UNIT_GRAMS:
        return float(UNIT_GRAMS[unit])
    # piece (or unknown unit): derive from the item's own estimate
    quantity = item.get("quantity") or 0
    grams = item.get("estimated_grams") or 0
    if quantity and grams:
        return grams / quantity
    return None


def scale_item(
    item: dict,
    new_quantity: float,
    new_unit: Optional[str] = None,
    user_edited_fields: Optional[List[str]] = None,
) -> dict:
    """Return a copy of item with macros/calories rescaled proportionally.

    Fields listed in user_edited_fields are left untouched (never silently
    overwrite a user's correction).
    """
    edited = set(user_edited_fields or [])
    old_quantity = item.get("quantity") or 1
    old_unit = item.get("unit") or "piece"
    new_unit = new_unit or old_unit

    if new_unit == old_unit:
        factor = new_quantity / old_quantity if old_quantity else 1.0
    else:
        old_gpu = _grams_per_unit(item, old_unit)
        new_gpu = _grams_per_unit(item, new_unit)
        if old_gpu and new_gpu and old_quantity:
            factor = (new_quantity * new_gpu) / (old_quantity * old_gpu)
        else:
            factor = new_quantity / old_quantity if old_quantity else 1.0

    scaled = dict(item)
    scaled["quantity"] = new_quantity
    scaled["unit"] = new_unit
    for field in SCALABLE_FIELDS:
        if field in edited or item.get(field) is None:
            continue
        scaled[field] = round(item[field] * factor, 1)
    return scaled
