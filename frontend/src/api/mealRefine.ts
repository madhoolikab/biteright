import api from './client'

interface RefineableItem {
  item_name: string
  portion_description?: string
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
  confidence?: string
}

interface RefineProfile {
  dietary_preference?: string
  primary_cuisine?: string
}

export interface RefinedItem {
  item_name: string
  portion_description: string
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
  confidence: string
}

// Re-estimates nutrition for a single item after the user corrects its dish name,
// reusing the /meals/analyze/refine flow (field: "item_name" tells Gemini to
// fully re-derive the numbers rather than nudge the old, misidentified estimate).
export async function refineItemName(
  item: RefineableItem,
  newName: string,
  profile: RefineProfile | null | undefined,
  lockedFields: string[] = [],
): Promise<RefinedItem> {
  const { data } = await api.post('/meals/analyze/refine', {
    items: [
      {
        ...item,
        item_name: newName,
        portion_description: item.portion_description ?? '',
        confidence: item.confidence ?? 'medium',
      },
    ],
    answers: [{ item_index: 0, field: 'item_name', answer: `Corrected dish name to "${newName}"` }],
    user_edited_fields: lockedFields.length ? { '0': lockedFields } : {},
    dietary_preference: profile?.dietary_preference,
    primary_cuisine: profile?.primary_cuisine,
  })
  return data.items[0]
}
