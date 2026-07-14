import { Droplet, Plus } from 'lucide-react'

interface WaterTrackerProps {
  current: number
  target: number
  onAdd: (amount: 250 | 500) => void
  busy?: boolean
}

export default function WaterTracker({ current, target, onAdd, busy = false }: WaterTrackerProps) {
  const pct = Math.min(100, Math.round((current / target) * 100))
  const r = 42
  const c = 2 * Math.PI * r
  const offset = c - (c * pct) / 100

  return (
    <section className="mt-4 rounded-3xl bg-card border border-border/60 p-5">
      <div className="flex items-center gap-4">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <defs>
              <linearGradient id="hydroGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--color-secondary)" />
                <stop offset="100%" stopColor="var(--color-primary)" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="url(#hydroGrad)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Droplet className={['h-3.5 w-3.5 text-secondary', busy ? 'water-wave' : ''].join(' ')} />
            <span className="mt-0.5 font-display text-xl text-foreground num leading-none">
              {current}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">ml</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Hydration</p>
          <p className="mt-0.5 text-sm text-muted-foreground num">
            of <span className="text-foreground font-semibold">{target}</span> ml ·{' '}
            <span className="text-secondary font-semibold">{pct}%</span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onAdd(250)}
              disabled={busy}
              className="flex items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-semibold bg-secondary text-secondary-foreground border border-secondary transition-colors disabled:opacity-40 num"
            >
              <Plus className="h-3 w-3" />
              250ml
            </button>
            <button
              onClick={() => onAdd(500)}
              disabled={busy}
              className="flex items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-semibold bg-muted text-foreground border-transparent border transition-colors disabled:opacity-40 num"
            >
              <Plus className="h-3 w-3" />
              500ml
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
