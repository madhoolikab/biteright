import { useRef, useState } from 'react'
import Card from '../shared/Card'
import { MEAL_UNITS, scaleItem, unitLabel, type ScalableItem } from '../../lib/unitConversion'

export interface ReviewItem extends ScalableItem {
  item_name: string
  portion_description: string
  confidence: string
}

const MACRO_FIELDS = [
  { field: 'carbs_g', label: 'Carbs' },
  { field: 'protein_g', label: 'Protein' },
  { field: 'fat_g', label: 'Fat' },
  { field: 'fibre_g', label: 'Fibre' },
] as const

interface ReviewCardProps {
  item: ReviewItem
  justUpdated?: boolean
  refining?: boolean
  onChange: (item: ReviewItem) => void
  onDelete: () => void
  onRename?: (oldName: string, newName: string) => void
}

export default function ReviewCard({ item, justUpdated = false, refining = false, onChange, onDelete, onRename }: ReviewCardProps) {
  // Accumulated factor for user-edited fields since their last edit — applied
  // only if the user opts in via the "scale your edits too?" chip.
  const [pendingFactor, setPendingFactor] = useState(1)
  // Tracks the last name we actually sent for re-estimation, so blur only
  // fires a refine call when the name really changed since the last commit.
  const committedName = useRef(item.item_name)

  const markEdited = (field: string) =>
    item.user_edited_fields.includes(field)
      ? item.user_edited_fields
      : [...item.user_edited_fields, field]

  const editField = (field: keyof ReviewItem & string, value: number) => {
    onChange({ ...item, [field]: value, user_edited_fields: markEdited(field) })
    if (field !== 'quantity') setPendingFactor(1)
  }

  const changePortion = (quantity: number, unit?: string) => {
    if (quantity <= 0) return
    const before = item.calories || 1
    const scaled = scaleItem(item, quantity, unit)
    onChange(scaled)
    if (item.user_edited_fields.some((f) => f !== 'quantity' && f !== 'item_name')) {
      setPendingFactor((p) => p * ((scaled.calories || before) / before))
    }
  }

  const applyPendingToEdits = () => {
    const updated = { ...item }
    for (const f of item.user_edited_fields) {
      const v = (item as any)[f]
      if (typeof v === 'number') (updated as any)[f] = Math.round(v * pendingFactor * 10) / 10
    }
    onChange(updated)
    setPendingFactor(1)
  }

  const showScaleChip =
    Math.abs(pendingFactor - 1) > 0.01 &&
    item.user_edited_fields.some((f) => f !== 'quantity' && f !== 'item_name')

  return (
    <Card className="space-y-3">
      <div className="flex justify-between items-start gap-2">
        <input
          value={item.item_name}
          onChange={(e) => onChange({ ...item, item_name: e.target.value, user_edited_fields: markEdited('item_name') })}
          onBlur={(e) => {
            const newName = e.target.value.trim()
            if (newName && newName !== committedName.current) {
              onRename?.(committedName.current, newName)
              committedName.current = newName
            }
          }}
          disabled={refining}
          className="font-medium text-lg bg-transparent border-none focus:outline-none flex-1 min-w-0 disabled:opacity-60"
        />
        {refining && (
          <span className="text-[10px] font-semibold text-primary shrink-0 animate-pulse">Recalculating…</span>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            item.confidence === 'high' ? 'bg-secondary-soft text-secondary' :
            item.confidence === 'low' ? 'bg-warning/10 text-warning' :
            'bg-primary-soft text-primary'
          }`}>
            {item.confidence}
          </span>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Remove ${item.item_name}`}
            className="p-1 -mr-1 text-muted-foreground hover:text-accent active:scale-[0.9] transition-transform"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Portion: quantity stepper + unit */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-2xl bg-muted overflow-hidden">
          <button type="button" onClick={() => changePortion(item.quantity - (item.quantity > 1 ? 1 : 0.5))} className="px-3 py-1.5 font-semibold text-primary active:scale-[0.9]">−</button>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={item.quantity}
            onChange={(e) => changePortion(Number(e.target.value))}
            className="w-12 py-1.5 num bg-transparent text-center font-semibold focus:outline-none"
          />
          <button type="button" onClick={() => changePortion(item.quantity + (item.quantity >= 1 ? 1 : 0.5))} className="px-3 py-1.5 font-semibold text-primary active:scale-[0.9]">+</button>
        </div>
        <select
          value={item.unit}
          onChange={(e) => changePortion(item.quantity, e.target.value)}
          className="rounded-2xl bg-muted px-3 py-1.5 text-sm font-semibold focus:outline-none capitalize"
        >
          {MEAL_UNITS.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
        </select>
        <span className="text-xs text-muted-foreground num ml-auto">~{Math.round(item.estimated_grams)}g</span>
      </div>

      {/* Honest calorie range */}
      <div className="flex items-baseline gap-1">
        <span className={`font-display text-xl text-foreground num ${justUpdated ? 'value-updated' : ''}`}>
          ~{Math.round(item.calorie_low)}–{Math.round(item.calorie_high)}
        </span>
        <span className="text-sm text-muted-foreground">kcal</span>
        {item.user_edited_fields.includes('calories') && <EditedDot />}
        {justUpdated && (
          <span className="text-[10px] font-semibold text-secondary ml-1">Updated</span>
        )}
      </div>

      {showScaleChip && (
        <button
          type="button"
          onClick={applyPendingToEdits}
          className="w-full text-left text-xs font-semibold text-primary bg-primary-soft rounded-2xl px-3 py-2 active:scale-[0.98]"
        >
          Your corrections were kept as-is — scale them with the new portion?
        </button>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm">
        <MacroField label="Calories" unit="kcal" value={item.calories} edited={item.user_edited_fields.includes('calories')} onChange={(v) => editField('calories', v)} />
        {MACRO_FIELDS.map(({ field, label }) => (
          <MacroField key={field} label={label} unit="g" value={item[field]} edited={item.user_edited_fields.includes(field)} onChange={(v) => editField(field, v)} />
        ))}
      </div>
    </Card>
  )
}

function EditedDot() {
  return <span title="Your correction" className="w-1.5 h-1.5 rounded-full bg-accent inline-block shrink-0" />
}

function MacroField({ label, value, unit, edited, onChange }: {
  label: string; value: number; unit: string; edited: boolean; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground">{label}:</span>
      <input
        type="number"
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-14 num bg-transparent border-b border-border focus:outline-none focus:border-primary text-right font-medium"
      />
      <span className="text-muted-foreground">{unit}</span>
      {edited && <EditedDot />}
    </div>
  )
}
