// Mirror of backend/app/services/unit_conversion.py — keep the two in sync.

export const MEAL_UNITS = ['piece', 'cup', 'tbsp', 'tsp', 'bowl', 'katori', 'glass', 'gram', 'ml'] as const
export type MealUnit = (typeof MEAL_UNITS)[number]

// Approximate grams per 1 unit. "piece" is derived per-item (estimated_grams / quantity).
const UNIT_GRAMS: Partial<Record<string, number>> = {
  katori: 150,
  cup: 240,
  bowl: 250,
  glass: 250,
  tbsp: 15,
  tsp: 5,
  gram: 1,
  ml: 1,
}

export interface ScalableItem {
  quantity: number
  unit: string
  estimated_grams: number
  calories: number
  calorie_low: number
  calorie_high: number
  carbs_g: number
  protein_g: number
  fat_g: number
  fibre_g: number
  user_edited_fields: string[]
}

const SCALABLE_FIELDS = [
  'calories', 'calorie_low', 'calorie_high',
  'carbs_g', 'protein_g', 'fat_g', 'fibre_g', 'estimated_grams',
] as const

function gramsPerUnit(item: ScalableItem, unit: string): number | null {
  const table = UNIT_GRAMS[unit]
  if (table) return table
  if (item.quantity && item.estimated_grams) return item.estimated_grams / item.quantity
  return null
}

/** Rescale calories/macros proportionally on quantity/unit change,
 *  never touching fields the user has explicitly corrected. */
export function scaleItem<T extends ScalableItem>(item: T, newQuantity: number, newUnit?: string): T {
  const unit = newUnit || item.unit
  const edited = new Set(item.user_edited_fields)
  let factor: number
  if (unit === item.unit) {
    factor = item.quantity ? newQuantity / item.quantity : 1
  } else {
    const oldGpu = gramsPerUnit(item, item.unit)
    const newGpu = gramsPerUnit(item, unit)
    factor = oldGpu && newGpu && item.quantity
      ? (newQuantity * newGpu) / (item.quantity * oldGpu)
      : (item.quantity ? newQuantity / item.quantity : 1)
  }
  const scaled = { ...item, quantity: newQuantity, unit }
  for (const field of SCALABLE_FIELDS) {
    if (edited.has(field) || item[field] == null) continue
    scaled[field] = Math.round(item[field] * factor * 10) / 10
  }
  return scaled
}
