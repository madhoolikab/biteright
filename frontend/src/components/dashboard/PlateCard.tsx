import { useState } from 'react'
import { ChevronDown, Pencil, Star, Trash2 } from 'lucide-react'
import type { MealSlot, MealItem } from '../../store/dailyLogStore'
import { fmtApprox } from '../../lib/format'

const SLOT_EMOJI: Record<string, string> = {
  breakfast: '🥣',
  lunch: '🥗',
  snack: '🍎',
  dinner: '🍲',
}

interface PlateCardProps {
  slot: MealSlot
  defaultOpen?: boolean
  onFavourite?: (itemId: string, next: boolean) => void
  onRemove?: (itemId: string) => void
  onEdit?: (item: MealItem) => void
}

export default function PlateCard({ slot, defaultOpen = false, onFavourite, onRemove, onEdit }: PlateCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const title = slot.meal_type.charAt(0).toUpperCase() + slot.meal_type.slice(1)

  return (
    <div className="rounded-3xl bg-card border border-border/60 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.06)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center p-4 text-left"
      >
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-muted flex items-center justify-center text-xl">
          {SLOT_EMOJI[slot.meal_type] ?? '🍽️'}
        </div>
        <div className="ml-3 min-w-0 flex-1">
          <h4 className="truncate font-semibold text-foreground text-sm">{title}</h4>
          <p className="text-[11px] text-muted-foreground num">
            {slot.item_count} {slot.item_count === 1 ? 'item' : 'items'} · ~{Math.round(slot.total_calories)} kcal
          </p>
        </div>
        <ChevronDown
          className={['h-4 w-4 text-muted-foreground transition-transform shrink-0', open ? 'rotate-180' : ''].join(' ')}
        />
      </button>

      {open && slot.items.length > 0 && (
        <div className="px-4 pb-4 pt-0 border-t border-border/60 space-y-2">
          {slot.items.map((it) => (
            <ItemRow key={it.id} item={it} onFavourite={onFavourite} onRemove={onRemove} onEdit={onEdit} />
          ))}
        </div>
      )}

      {open && slot.items.length === 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-border/60">
          <p className="text-[11px] text-muted-foreground">No item details available.</p>
        </div>
      )}
    </div>
  )
}

function ItemRow({
  item,
  onFavourite,
  onRemove,
  onEdit,
}: {
  item: MealItem
  onFavourite?: (id: string, next: boolean) => void
  onRemove?: (id: string) => void
  onEdit?: (item: MealItem) => void
}) {
  return (
    <div className="flex items-center gap-3 pt-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">{item.item_name}</p>
        <p className="text-[11px] text-muted-foreground num">
          {item.is_estimate ? fmtApprox(item.calories) : Math.round(item.calories)} kcal
        </p>
      </div>
      <div className="flex flex-wrap gap-1 justify-end max-w-[55%] shrink-0">
        <MacroChip color="protein" label="P" value={item.protein_g ?? 0} />
        <MacroChip color="carbs" label="C" value={item.carbs_g ?? 0} />
        <MacroChip color="fat" label="F" value={item.fat_g ?? 0} />
        <MacroChip color="fiber" label="Fib" value={item.fibre_g ?? 0} />
      </div>
      {(onFavourite || onRemove || onEdit) && (
        <div className="flex flex-col gap-1 shrink-0">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(item) }}
              aria-label="Edit"
              className="text-muted-foreground/60"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onFavourite && (
            <button
              onClick={(e) => { e.stopPropagation(); onFavourite(item.id, !item.is_favourite) }}
              aria-label="Favourite"
              className={item.is_favourite ? 'text-accent' : 'text-muted-foreground/60'}
            >
              <Star className={['h-3.5 w-3.5', item.is_favourite ? 'fill-current' : ''].join(' ')} />
            </button>
          )}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
              aria-label="Remove"
              className="text-muted-foreground/60"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function MacroChip({ color, label, value }: { color: 'protein' | 'carbs' | 'fat' | 'fiber'; label: string; value: number }) {
  const bg =
    color === 'protein' ? 'bg-secondary-soft text-secondary'
    : color === 'carbs' ? 'bg-warning-soft text-warning'
    : color === 'fat' ? 'bg-accent-soft text-accent'
    : 'bg-fiber-soft text-fiber'
  return (
    <span className={['text-[9px] font-semibold px-2 py-0.5 rounded-full num', bg].join(' ')}>
      {label} {Math.round(value)}g
    </span>
  )
}
