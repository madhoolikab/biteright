import { create } from 'zustand'
import api from '../api/client'

const DEV_MODE = import.meta.env.DEV && import.meta.env.VITE_DEV_MODE === 'true'

interface Profile {
  id: string
  user_id: string
  name: string
  gender: string
  age: number
  height_cm: number
  weight_kg: number
  goal: string
  goal_weight_kg: number | null
  weekly_rate_kg: number | null
  activity_level: string
  dietary_preference: string
  health_conditions: string[]
  primary_cuisine: string
  unit_preference: string
  oil_usage_level: string | null
  portion_calibration: Record<string, number> | null
  calorie_target: number
  protein_target_g: number
  carbs_target_g: number
  fat_target_g: number
  fibre_target_g: number
  bmr: number
  maintenance_calories: number
  onboarding_completed: boolean
}

interface Targets {
  bmr: number
  maintenance_calories: number
  target_calories: number
  protein_target_g: number
  carbs_target_g: number
  fat_target_g: number
  fibre_target_g: number
  weeks_to_goal: number | null
}

interface ProfileState {
  profile: Profile | null
  isLoading: boolean
  fetchProfile: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
  calculateTargets: (params: {
    gender: string
    age: number
    height_cm: number
    weight_kg: number
    goal: string
    goal_weight_kg?: number
    weekly_rate_kg?: number
    activity_level: string
  }) => Promise<Targets>
  createProfile: (data: Omit<Profile, 'id' | 'user_id' | 'onboarding_completed'>) => Promise<void>
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  isLoading: false,

  fetchProfile: async () => {
    if (DEV_MODE) {
      set({
        profile: {
          id: 'dev', user_id: 'dev', name: 'Priya', gender: 'female',
          age: 30, height_cm: 160, weight_kg: 68, goal: 'lose',
          goal_weight_kg: 58, weekly_rate_kg: 0.5, activity_level: 'light',
          dietary_preference: 'vegetarian', health_conditions: [],
          primary_cuisine: 'indian', unit_preference: 'metric',
          oil_usage_level: null, portion_calibration: null,
          calorie_target: 1850, protein_target_g: 93, carbs_target_g: 231,
          fat_target_g: 51, fibre_target_g: 25, bmr: 1410,
          maintenance_calories: 1900, onboarding_completed: true,
        },
        isLoading: false,
      })
      return
    }
    set({ isLoading: true })
    try {
      const { data } = await api.get('/profile/')
      set({ profile: data })
    } catch {
      set({ profile: null })
    } finally {
      set({ isLoading: false })
    }
  },

  updateProfile: async (updates) => {
    const { data } = await api.put('/profile/', updates)
    set({ profile: data })
  },

  calculateTargets: async (params) => {
    const { data } = await api.post('/profile/calculate-targets', params)
    return data
  },

  createProfile: async (profileData) => {
    const { data } = await api.post('/profile/', profileData)
    set({ profile: data })
  },
}))
