import { create } from 'zustand'
import api from '../api/client'

const DEV_MODE = import.meta.env.DEV && import.meta.env.VITE_SUPABASE_URL?.includes('placeholder')

interface MealItem {
  id: string
  meal_type: string
  item_name: string
  calories: number
  carbs_g: number | null
  protein_g: number | null
  fat_g: number | null
  fibre_g: number | null
  portion_grams: number | null
  portion_desc: string | null
  quantity: number | null
  unit: string | null
  calorie_low: number | null
  calorie_high: number | null
  user_edited_fields: string[]
  is_estimate: boolean
  is_favourite: boolean
  source: string
}

interface MealSlot {
  meal_type: string
  total_calories: number
  item_count: number
  items: MealItem[]
}

interface WeightEntry {
  id: string
  log_date: string
  weight_kg: number
  smoothed_kg: number
}

interface DashboardData {
  log_date: string
  total_calories: number
  total_carbs_g: number
  total_protein_g: number
  total_fat_g: number
  total_fibre_g: number
  calorie_target: number
  protein_target_g: number
  carbs_target_g: number
  fat_target_g: number
  fibre_target_g: number
  water_ml: number
  water_target_ml: number
  meals: MealSlot[]
  today_weight: WeightEntry | null
}

const MOCK_DASHBOARD: DashboardData = {
  log_date: new Date().toISOString().split('T')[0],
  total_calories: 1340,
  total_carbs_g: 156,
  total_protein_g: 62,
  total_fat_g: 48,
  total_fibre_g: 14,
  calorie_target: 1850,
  carbs_target_g: 231,
  protein_target_g: 93,
  fat_target_g: 51,
  fibre_target_g: 25,
  water_ml: 1250,
  water_target_ml: 2500,
  meals: [
    {
      meal_type: 'breakfast', total_calories: 420, item_count: 2,
      items: [
        { id: 'b1', meal_type: 'breakfast', item_name: 'Poha with peanuts', calories: 280, carbs_g: 48, protein_g: 8, fat_g: 7, fibre_g: 3, portion_grams: 180, portion_desc: '1 bowl', quantity: null, unit: null, calorie_low: null, calorie_high: null, user_edited_fields: [], is_estimate:true, is_favourite: true, source: 'photo' },
        { id: 'b2', meal_type: 'breakfast', item_name: 'Masala chai', calories: 140, carbs_g: 18, protein_g: 4, fat_g: 5, fibre_g: 0, portion_grams: 200, portion_desc: '1 cup', quantity: null, unit: null, calorie_low: null, calorie_high: null, user_edited_fields: [], is_estimate:false, is_favourite: false, source: 'manual' },
      ],
    },
    {
      meal_type: 'lunch', total_calories: 580, item_count: 3,
      items: [
        { id: 'l1', meal_type: 'lunch', item_name: 'Dal tadka', calories: 220, carbs_g: 32, protein_g: 12, fat_g: 6, fibre_g: 5, portion_grams: 200, portion_desc: '1 katori', quantity: null, unit: null, calorie_low: null, calorie_high: null, user_edited_fields: [], is_estimate:true, is_favourite: false, source: 'photo' },
        { id: 'l2', meal_type: 'lunch', item_name: 'Jeera rice', calories: 210, carbs_g: 42, protein_g: 4, fat_g: 3, fibre_g: 1, portion_grams: 150, portion_desc: '1 cup', quantity: null, unit: null, calorie_low: null, calorie_high: null, user_edited_fields: [], is_estimate:false, is_favourite: true, source: 'manual' },
        { id: 'l3', meal_type: 'lunch', item_name: 'Mixed vegetable sabzi', calories: 150, carbs_g: 14, protein_g: 3, fat_g: 8, fibre_g: 4, portion_grams: 100, portion_desc: '½ cup', quantity: null, unit: null, calorie_low: null, calorie_high: null, user_edited_fields: [], is_estimate:true, is_favourite: false, source: 'photo' },
      ],
    },
    {
      meal_type: 'snack', total_calories: 140, item_count: 1,
      items: [
        { id: 's1', meal_type: 'snack', item_name: 'Roasted makhana', calories: 140, carbs_g: 22, protein_g: 5, fat_g: 4, fibre_g: 2, portion_grams: 40, portion_desc: '1 handful', quantity: null, unit: null, calorie_low: null, calorie_high: null, user_edited_fields: [], is_estimate:false, is_favourite: true, source: 'manual' },
      ],
    },
    { meal_type: 'dinner', total_calories: 0, item_count: 0, items: [] },
  ],
  today_weight: null,
}

interface DailyLogState {
  dashboard: DashboardData | null
  isLoading: boolean
  fetchDashboard: (date: string) => Promise<void>
  addWater: (date: string) => Promise<void>
  logMealItems: (items: Array<{
    log_date: string
    meal_type: string
    item_name: string
    calories: number
    carbs_g?: number
    protein_g?: number
    fat_g?: number
    fibre_g?: number
    portion_grams?: number
    portion_desc?: string
    quantity?: number
    unit?: string
    calorie_low?: number
    calorie_high?: number
    user_edited_fields?: string[]
    is_estimate?: boolean
    source?: string
  }>) => Promise<void>
  deleteMealItem: (itemId: string, date: string) => Promise<void>
  toggleFavourite: (itemId: string) => Promise<void>
}

export const useDailyLogStore = create<DailyLogState>((set, get) => ({
  dashboard: null,
  isLoading: false,

  fetchDashboard: async (date) => {
    if (DEV_MODE) {
      set({ dashboard: MOCK_DASHBOARD, isLoading: false })
      return
    }
    set({ isLoading: true })
    try {
      const { data } = await api.get(`/dashboard/today?log_date=${date}`)
      set({ dashboard: data })
    } catch {
      set({ dashboard: null })
    } finally {
      set({ isLoading: false })
    }
  },

  addWater: async (date) => {
    if (DEV_MODE) {
      const d = get().dashboard
      if (d) set({ dashboard: { ...d, water_ml: d.water_ml + 250 } })
      return
    }
    await api.post('/water/', { log_date: date })
    await get().fetchDashboard(date)
  },

  logMealItems: async (items) => {
    if (DEV_MODE) return
    await api.post('/meals/', items)
    if (items.length > 0) {
      await get().fetchDashboard(items[0].log_date)
    }
  },

  deleteMealItem: async (itemId, date) => {
    if (DEV_MODE) return
    await api.delete(`/meals/${itemId}`)
    await get().fetchDashboard(date)
  },

  toggleFavourite: async (itemId) => {
    if (DEV_MODE) return
    await api.post(`/meals/${itemId}/favourite`)
  },
}))

export type { MealItem, MealSlot, DashboardData, WeightEntry }
