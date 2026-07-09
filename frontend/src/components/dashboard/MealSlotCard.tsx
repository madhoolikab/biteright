import { useNavigate } from 'react-router-dom'
import Card from '../shared/Card'
import type { MealSlot } from '../../store/dailyLogStore'

interface MealSlotCardProps {
  slot: MealSlot
}

const mealIcons: Record<string, string> = {
  breakfast: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707',
  lunch: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636',
  snack: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
  dinner: 'M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z',
}

const mealLabels: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
}

export default function MealSlotCard({ slot }: MealSlotCardProps) {
  const navigate = useNavigate()
  const hasItems = slot.item_count > 0

  return (
    <Card
      onClick={() => navigate(`/log?meal=${slot.meal_type}`)}
      className="flex flex-col items-center gap-2 py-5"
    >
      <svg className={`w-6 h-6 ${hasItems ? 'text-primary' : 'text-text-secondary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={mealIcons[slot.meal_type]} />
      </svg>
      <span className="text-sm font-medium">{mealLabels[slot.meal_type]}</span>
      {hasItems ? (
        <span className="text-lg font-bold text-primary">~{Math.round(slot.total_calories)}</span>
      ) : (
        <span className="text-xs text-text-secondary">+ Add</span>
      )}
      {hasItems && (
        <span className="text-xs text-text-secondary">{slot.item_count} item{slot.item_count > 1 ? 's' : ''}</span>
      )}
    </Card>
  )
}
