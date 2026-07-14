import { useState } from 'react'
import { X, Minus, Plus } from 'lucide-react'
import type { MealItem, MealItemUpdate } from '../../store/dailyLogStore'
import { MEAL_UNITS, scaleItem, unitLabel, type ScalableItem } from '../../lib/unitConversion'
import Button from '../shared/Button'

interface Props {
  item: MealItem
  onSave: (updates: MealItemUpdate) => Promise<void> | void
  onClose: () => void
}

/**
 * Edit an already-logged meal item. Changing quantity/unit rescales calories &
 * macros proportionally (mirroring the backend), but never touches a field the
 * user has explicitly typed — those get recorded in user_edited_fields so future
 * re-estimates leave them alone too.
 */
export default function MealItemEditor({ item, onSave, onClose }: Props) {
  const [name, setName] = useState(item.item_name)
  const [quantity, setQuantity] = useState<number>(item.quantity ?? 1)
  const [unit, setUnit] = useState<string>(item.unit ?? 'piece')
  const [calories, setCalories] = useState<number>(Math.round(item.calories))
  const [protein, setProtein] = useState<number>(Math.round(item.protein_g ?? 0))
  const [carbs, setCarbs] = useState<number>(Math.round(item.carbs_g ?? 0))
  const [fat, setFat] = useState<number>(Math.round(item.fat_g ?? 0))
  const [fibre, setFibre] = useState<number>(Math.round(item.fibre_g ?? 0))
  const [grams, setGrams] = useState<number>(item.portion_grams ?? 0)
  const [calLow, setCalLow] = useState<number | null>(item.calorie_low)
  const [calHigh, setCalHigh] = useState<number | null>(item.calorie_high)
  const [edited, setEdited] = useState<string[]>(item.user_edited_fields ?? [])
  const [saving, setSaving] = useState(false)

  const markEdited = (field: string) =>
    setEdited((e) => (e.includes(field) ? e : [...e, field]))

  // Rescale everything that isn't user-locked when quantity/unit changes.
  const applyScale = (nextQty: number, nextUnit: string) => {
    const current: ScalableItem = {
      quantity,
      unit,
      estimated_grams: grams,
      calories,
      calorie_low: calLow ?? calories * 0.85,
      calorie_high: calHigh ?? calories * 1.15,
      carbs_g: carbs,
      protein_g: protein,
      fat_g: fat,
      fibre_g: fibre,
      user_edited_fields: edited,
    }
    const s = scaleItem(current, nextQty, nextUnit)
    setQuantity(s.quantity)
    setUnit(s.unit)
    setCalories(Math.round(s.calories))
    setCalLow(Math.round(s.calorie_low))
    setCalHigh(Math.round(s.calorie_high))
    setCarbs(Math.round(s.carbs_g))
    setProtein(Math.round(s.protein_g))
    setFat(Math.round(s.fat_g))
    setFibre(Math.round(s.fibre_g))
    setGrams(Math.round(s.estimated_grams))
  }

  const changeQty = (next: number) => {
    if (next < 0.25) return
    applyScale(Math.round(next * 4) / 4, unit)
  }
  const changeUnit = (nextUnit: string) => applyScale(quantity, nextUnit)

  const save = async () => {
    setSaving(true)
    try {
      await onSave({
        item_name: name.trim() || item.item_name,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        fibre_g: fibre,
        portion_grams: grams || null,
        quantity,
        unit,
        calorie_low: calLow,
        calorie_high: calHigh,
        user_edited_fields: edited,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-[32px] bg-card border border-border/60 p-5 pb-8 shadow-[0_-8px_40px_-12px_rgba(26,20,48,0.35)] max-h-[88vh] overflow-y-auto">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-foreground">Edit item</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Name */}
        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Item</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 mb-4 w-full px-4 py-3 border border-border rounded-2xl text-sm focus:outline-none focus:border-primary"
        />

        {/* Portion */}
        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Portion</label>
        <div className="mt-1.5 mb-4 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl bg-muted p-1">
            <button onClick={() => changeQty(quantity - 0.25)} aria-label="Less" className="p-2 rounded-xl bg-card text-foreground active:scale-95">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-display text-lg num">{quantity}</span>
            <button onClick={() => changeQty(quantity + 0.25)} aria-label="More" className="p-2 rounded-xl bg-card text-foreground active:scale-95">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <select
            value={unit}
            onChange={(e) => changeUnit(e.target.value)}
            className="flex-1 px-3 py-3 border border-border rounded-2xl text-sm bg-card focus:outline-none focus:border-primary"
          >
            {MEAL_UNITS.map((u) => (
              <option key={u} value={u}>{unitLabel(u)}</option>
            ))}
          </select>
        </div>

        {/* Calories */}
        <NumberField
          label="Calories (kcal)"
          value={calories}
          onChange={(v) => { setCalories(v); markEdited('calories') }}
        />

        {/* Macros */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <NumberField label="Protein (g)" value={protein} onChange={(v) => { setProtein(v); markEdited('protein_g') }} />
          <NumberField label="Carbs (g)" value={carbs} onChange={(v) => { setCarbs(v); markEdited('carbs_g') }} />
          <NumberField label="Fat (g)" value={fat} onChange={(v) => { setFat(v); markEdited('fat_g') }} />
          <NumberField label="Fibre (g)" value={fibre} onChange={(v) => { setFibre(v); markEdited('fibre_g') }} />
        </div>

        {edited.length > 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Your corrections are kept — we won't overwrite them when rescaling.
          </p>
        )}

        <Button onClick={save} className="w-full mt-5" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        className="mt-1.5 w-full px-4 py-3 border border-border rounded-2xl text-sm num focus:outline-none focus:border-primary"
      />
    </div>
  )
}
