type Macro = { label: string; value: number; target: number; color: string }

interface MacroBarsProps {
  protein: number
  carbs: number
  fat: number
  fibre?: number
  targets: { protein_g: number; carbs_g: number; fat_g: number; fibre_target_g?: number }
  compact?: boolean
}

export default function MacroBars({ protein, carbs, fat, fibre, targets, compact = false }: MacroBarsProps) {
  const items: Macro[] = [
    { label: 'Protein', value: protein, target: targets.protein_g, color: 'var(--color-protein)' },
    { label: 'Carbs', value: carbs, target: targets.carbs_g, color: 'var(--color-carbs)' },
    { label: 'Fat', value: fat, target: targets.fat_g, color: 'var(--color-fat)' },
  ]
  if (typeof fibre === 'number' && targets.fibre_target_g) {
    items.push({ label: 'Fibre', value: fibre, target: targets.fibre_target_g, color: 'var(--color-fiber)' })
  }

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3.5'}>
      {items.map((m) => {
        const pct = Math.min(100, Math.round((m.value / Math.max(1, m.target)) * 100))
        return (
          <div key={m.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs font-semibold">
              <span className="text-muted-foreground">{m.label}</span>
              <span className="num text-foreground">
                {Math.round(m.value)}
                <span className="text-muted-foreground font-normal">/{m.target}g</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%`, backgroundColor: m.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
