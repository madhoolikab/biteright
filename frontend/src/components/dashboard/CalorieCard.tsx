import MacroBars from './MacroBars'

interface CalorieCardProps {
  consumed: number
  target: number
  protein: number
  carbs: number
  fat: number
  fibre: number
  targets: { protein_g: number; carbs_g: number; fat_g: number; fibre_target_g: number }
}

export default function CalorieCard({ consumed, target, protein, carbs, fat, fibre, targets }: CalorieCardProps) {
  const remaining = Math.max(0, Math.round(target - consumed))
  const over = consumed > target

  return (
    <section className="relative overflow-hidden rounded-[32px] bg-card border border-secondary/10 p-6 shadow-[0_4px_30px_-12px_rgba(108,92,231,0.15)]">
      <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-secondary-soft blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-primary-soft blur-3xl opacity-70" />

      <div className="relative z-10 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">
          {over ? 'Over today' : 'Remaining today'}
        </span>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-5xl text-ink num">
            {over ? `+${Math.round(consumed - target)}` : remaining}
          </span>
          <span className="text-base font-medium text-muted-foreground num">
            / {target} kcal
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {over ? "You're over today — that's okay." : `${Math.round(consumed)} kcal logged`}
        </p>
      </div>

      <div className="relative z-10 mt-6">
        <MacroBars
          protein={protein}
          carbs={carbs}
          fat={fat}
          fibre={fibre}
          targets={targets}
          compact
        />
      </div>
    </section>
  )
}
