import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, Plus, Minus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useDailyLogStore, type MealItem } from '../store/dailyLogStore'
import { useProfileStore } from '../store/profileStore'
import { refineItemName } from '../api/mealRefine'
import CalorieCard from '../components/dashboard/CalorieCard'
import WaterTracker from '../components/dashboard/WaterTracker'
import PlateCard from '../components/dashboard/PlateCard'
import MealItemEditor from '../components/meals/MealItemEditor'
import Button from '../components/shared/Button'

export default function DayDetail() {
  const { date = '' } = useParams()
  const navigate = useNavigate()
  const {
    dayDetail,
    dayDetailLoading,
    fetchDayDetail,
    updateMealItem,
    deleteDayMealItem,
    addDayWater,
    removeDayWater,
    logDayWeight,
    toggleFavourite,
  } = useDailyLogStore()
  const { profile } = useProfileStore()

  const [editing, setEditing] = useState<MealItem | null>(null)
  const [waterBusy, setWaterBusy] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  useEffect(() => {
    if (date) fetchDayDetail(date)
  }, [date, fetchDayDetail])

  const heading = date ? format(parseISO(date), 'EEEE, MMMM d') : ''

  if (dayDetailLoading || !dayDetail) {
    return (
      <div className="space-y-4 pt-4">
        <div className="h-8 w-40 rounded-2xl bg-muted animate-pulse" />
        <div className="h-48 rounded-[32px] bg-muted animate-pulse" />
      </div>
    )
  }

  const loggedSlots = dayDetail.meals.filter((s) => s.item_count > 0)

  async function handleWaterAdd(amount: 250 | 500) {
    setWaterBusy(true)
    try {
      await addDayWater(date)
      if (amount === 500) await addDayWater(date)
    } finally {
      setWaterBusy(false)
    }
  }

  async function handleWaterRemove() {
    setWaterBusy(true)
    try {
      await removeDayWater(date)
    } finally {
      setWaterBusy(false)
    }
  }

  async function handleRemoveItem(itemId: string) {
    try {
      await deleteDayMealItem(itemId, date)
      toast.success('Removed')
    } catch {
      toast.error("Couldn't remove item")
    }
  }

  async function handleFavourite(itemId: string) {
    try {
      await toggleFavourite(itemId, date, 'dayDetail')
      toast.success('Updated')
    } catch {
      toast.error("Couldn't update favourite")
    }
  }

  async function handleWeight() {
    const val = Number(weightInput)
    if (!val || val <= 0) return
    setSavingWeight(true)
    try {
      await logDayWeight(date, val)
      setWeightInput('')
      toast.success('Weight saved')
    } catch {
      toast.error("Couldn't save weight")
    } finally {
      setSavingWeight(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate('/history')} aria-label="Back" className="p-2 -ml-2 text-muted-foreground">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="font-display text-2xl text-foreground">{heading}</h1>
      </div>

      <CalorieCard
        consumed={dayDetail.total_calories}
        target={dayDetail.calorie_target}
        protein={dayDetail.total_protein_g}
        carbs={dayDetail.total_carbs_g}
        fat={dayDetail.total_fat_g}
        fibre={dayDetail.total_fibre_g}
        targets={{
          protein_g: dayDetail.protein_target_g,
          carbs_g: dayDetail.carbs_target_g,
          fat_g: dayDetail.fat_target_g,
          fibre_target_g: dayDetail.fibre_target_g,
        }}
      />

      {/* Meals */}
      <section className="mt-6">
        <div className="flex justify-between items-center px-1 mb-4">
          <h2 className="font-display text-xl text-foreground">Meals</h2>
          <button
            onClick={() => navigate(`/log?date=${date}`)}
            className="flex items-center gap-1 text-sm font-semibold text-primary"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {loggedSlots.length === 0 ? (
          <div className="rounded-3xl bg-muted/50 p-6 text-center">
            <p className="text-sm text-muted-foreground">Nothing logged this day.</p>
            <button onClick={() => navigate(`/log?date=${date}`)} className="mt-2 text-sm font-semibold text-primary">
              Add a meal →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {loggedSlots.map((slot, i) => (
              <PlateCard
                key={slot.meal_type}
                slot={slot}
                defaultOpen={i === loggedSlots.length - 1}
                onFavourite={(id) => handleFavourite(id)}
                onRemove={handleRemoveItem}
                onEdit={(item) => setEditing(item)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Hydration */}
      <WaterTracker current={dayDetail.water_ml} target={dayDetail.water_target_ml} onAdd={handleWaterAdd} busy={waterBusy} />
      {dayDetail.water_ml > 0 && (
        <button
          onClick={handleWaterRemove}
          disabled={waterBusy}
          className="mt-2 flex items-center gap-1 mx-auto text-[11px] font-semibold text-muted-foreground disabled:opacity-40"
        >
          <Minus className="h-3 w-3" /> Remove 250ml
        </button>
      )}

      {/* Weight */}
      <section className="mt-4 rounded-3xl bg-card border border-border/60 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Weight</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder={dayDetail.today_weight ? String(dayDetail.today_weight.weight_kg) : 'e.g. 68.5'}
            className="flex-1 px-4 py-3 border border-border rounded-2xl text-sm num focus:outline-none focus:border-primary"
          />
          <span className="text-sm text-muted-foreground">kg</span>
          <Button onClick={handleWeight} size="sm" disabled={savingWeight || !weightInput}>
            {savingWeight ? '…' : dayDetail.today_weight ? 'Update' : 'Save'}
          </Button>
        </div>
        {dayDetail.today_weight && (
          <p className="mt-2 text-[11px] text-muted-foreground num">
            Logged: {dayDetail.today_weight.weight_kg} kg · smoothed {dayDetail.today_weight.smoothed_kg} kg
          </p>
        )}
      </section>

      {editing && (
        <MealItemEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (updates) => {
            try {
              await updateMealItem(editing.id, updates, date)
              toast.success('Updated')
            } catch {
              toast.error("Couldn't save changes")
            }
          }}
          onRename={async (oldName, newName) => {
            try {
              return await refineItemName(
                {
                  item_name: oldName,
                  quantity: editing.quantity ?? 1,
                  unit: editing.unit ?? 'piece',
                  estimated_grams: editing.portion_grams ?? 0,
                  calories: editing.calories,
                  calorie_low: editing.calorie_low ?? editing.calories * 0.85,
                  calorie_high: editing.calorie_high ?? editing.calories * 1.15,
                  carbs_g: editing.carbs_g ?? 0,
                  protein_g: editing.protein_g ?? 0,
                  fat_g: editing.fat_g ?? 0,
                  fibre_g: editing.fibre_g ?? 0,
                },
                newName,
                profile,
                (editing.user_edited_fields ?? []).filter((f) => f !== 'item_name'),
              )
            } catch {
              toast.error("Couldn't re-estimate — numbers left as-is")
            }
          }}
        />
      )}
    </div>
  )
}
