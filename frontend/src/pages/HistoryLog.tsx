import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { CalendarPlus } from 'lucide-react'
import { BarChart, Bar, Cell, XAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import { useDailyLogStore, type DaySummary, type HistoryTargets } from '../store/dailyLogStore'
import { useProfileStore } from '../store/profileStore'
import StreakBadge from '../components/shared/StreakBadge'
import { fmtApprox } from '../lib/format'

type Status = 'none' | 'logged'

// No "on track" / "off" judgment — this is just awareness of what was logged
// against the goal, not a verdict. Grey means nothing was logged that day.
function dayStatus(cal: number): Status {
  return cal > 0 ? 'logged' : 'none'
}

const STATUS_COLOR: Record<Status, string> = {
  none: 'var(--color-muted)',
  logged: 'var(--color-accent)',
}

const STATUS_TEXT_COLOR: Record<Status, string> = {
  none: 'var(--color-muted-foreground)',
  logged: '#fff',
}

export default function HistoryLog() {
  const navigate = useNavigate()
  const { history, historyTargets, historyLoading, fetchHistory, dashboard, fetchDashboard } = useDailyLogStore()
  const { profile, fetchProfile } = useProfileStore()
  const [range, setRange] = useState<7 | 14 | 30>(7)
  const pastDayInputRef = useRef<HTMLInputElement>(null)
  const todayIso = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    fetchHistory(30)
    fetchProfile()
    fetchDashboard(todayIso)
  }, [fetchHistory, fetchProfile, fetchDashboard, todayIso])

  const goal = historyTargets?.calorie_target ?? dashboard?.calorie_target ?? 1850
  const byDate = useMemo(() => {
    const m = new Map<string, DaySummary>()
    history.forEach((d) => m.set(d.log_date, d))
    return m
  }, [history])

  // Last 7 calendar days (rolling), oldest→newest, for the adherence strip.
  const week = useMemo(() => lastNDays(7).map((iso) => ({ iso, day: byDate.get(iso) })), [byDate])
  const loggedCount = week.filter((w) => (w.day?.total_calories ?? 0) > 0).length
  const weekLogged = week.filter((w) => (w.day?.total_calories ?? 0) > 0)
  const avgCals = weekLogged.length
    ? Math.round(weekLogged.reduce((s, w) => s + (w.day!.total_calories), 0) / weekLogged.length)
    : 0

  const chartData = useMemo(
    () =>
      lastNDays(range).map((iso) => {
        const d = byDate.get(iso)
        return {
          iso,
          label: format(parseISO(iso), range > 7 ? 'd' : 'EEEEE'),
          calories: Math.round(d?.total_calories ?? 0),
          status: dayStatus(d?.total_calories ?? 0),
        }
      }),
    [byDate, range]
  )

  const firstName = profile?.name?.split(' ')[0] || 'friend'

  if (historyLoading && history.length === 0) {
    return (
      <div className="space-y-4 pt-4">
        <div className="h-8 w-40 rounded-2xl bg-muted animate-pulse" />
        <div className="h-24 rounded-3xl bg-muted animate-pulse" />
        <div className="h-48 rounded-3xl bg-muted animate-pulse" />
      </div>
    )
  }

  const hasData = history.some((d) => d.total_calories > 0)

  return (
    <div>
      {/* Header */}
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground leading-tight">Your Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every day counts, {firstName} — here's your story so far.</p>
        <div className="mt-3 flex items-center gap-3">
          <StreakBadge days={dashboard?.current_streak ?? 0} />
          <button
            type="button"
            onClick={() => {
              const el = pastDayInputRef.current
              if (!el) return
              if (el.showPicker) el.showPicker()
              else el.click()
            }}
            className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3.5 py-1.5 text-xs font-semibold text-primary active:scale-[0.98] transition-transform"
          >
            <CalendarPlus className="h-4 w-4" />
            Log a past day
            <input
              ref={pastDayInputRef}
              type="date"
              max={todayIso}
              onChange={(e) => {
                if (e.target.value) navigate(`/history/${e.target.value}`)
              }}
              className="sr-only"
              aria-label="Pick a past day to log"
            />
          </button>
        </div>
      </header>

      {!hasData ? (
        <div className="rounded-3xl bg-gradient-to-br from-primary-soft to-accent-soft p-8 text-center">
          <div className="text-3xl mb-2">🌱</div>
          <p className="font-display text-lg text-foreground">Your log starts today</p>
          <p className="text-sm text-muted-foreground mt-1">Log a meal and your days will appear here.</p>
        </div>
      ) : (
        <>
          {/* Weekly adherence strip */}
          <section className="rounded-3xl bg-card border border-border/60 p-5 shadow-[0_4px_30px_-12px_rgba(108,92,231,0.15)]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">This week</p>
              <p className="text-[11px] text-muted-foreground num">
                {loggedCount}/7 days · avg {avgCals ? fmtApprox(avgCals) : '—'} kcal
              </p>
            </div>
            <div className="flex justify-between">
              {week.map(({ iso, day }) => {
                const status = dayStatus(day?.total_calories ?? 0)
                const isToday = iso === todayIso
                return (
                  <button
                    key={iso}
                    onClick={() => navigate(`/history/${iso}`)}
                    className="flex flex-col items-center gap-1.5"
                    aria-label={format(parseISO(iso), 'EEEE MMM d')}
                  >
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {format(parseISO(iso), 'EEEEE')}
                    </span>
                    <span
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold num"
                      style={{
                        backgroundColor: isToday ? 'var(--color-card)' : STATUS_COLOR[status],
                        color: isToday ? 'var(--color-accent)' : STATUS_TEXT_COLOR[status],
                        boxShadow: isToday ? 'inset 0 0 0 2px var(--color-accent)' : 'none',
                      }}
                    >
                      {status === 'none' && !isToday ? '·' : format(parseISO(iso), 'd')}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Trend chart */}
          <section className="mt-4 rounded-3xl bg-card border border-border/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Calories vs goal</p>
              <div className="flex gap-1 bg-muted rounded-full p-0.5">
                {([7, 14, 30] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={[
                      'px-2.5 py-1 rounded-full text-[11px] font-semibold num transition-colors',
                      range === r ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {r}d
                  </button>
                ))}
              </div>
            </div>
            <div className="h-40 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} interval={range > 14 ? 3 : 0} />
                  <ReferenceLine y={goal} stroke="var(--color-primary)" strokeDasharray="4 4" strokeWidth={1.5} />
                  <Tooltip
                    cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
                    contentStyle={{ borderRadius: 16, border: '1px solid var(--color-border)', fontSize: 12 }}
                    formatter={(v) => [`~${Math.round(Number(v))} kcal`, 'Eaten'] as [string, string]}
                    labelFormatter={(l, p) => (p?.[0] ? format(parseISO(p[0].payload.iso), 'EEE, MMM d') : String(l))}
                  />
                  <Bar dataKey="calories" radius={[6, 6, 0, 0]} maxBarSize={28}>
                    {chartData.map((d) => (
                      <Cell key={d.iso} fill={STATUS_COLOR[d.status]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Dashed line = your {goal} kcal goal.
            </p>
          </section>

          {/* Day list */}
          <section className="mt-8">
            <h2 className="font-display text-xl text-foreground px-1 mb-4">All days</h2>
            <div className="space-y-2.5">
              {history
                .filter((d) => d.total_calories > 0 || d.water_ml > 0)
                .map((day) => (
                  <DayRow key={day.log_date} day={day} targets={historyTargets} goal={goal} onOpen={() => navigate(`/history/${day.log_date}`)} />
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function DayRow({ day, targets, goal, onOpen }: { day: DaySummary; targets: HistoryTargets | null; goal: number; onOpen: () => void }) {
  const status = dayStatus(day.total_calories)
  const pct = Math.min(100, Math.round((day.total_calories / Math.max(1, goal)) * 100))
  const d = parseISO(day.log_date)
  const rel = relativeLabel(day.log_date)
  const isToday = rel === 'Today'

  return (
    <button
      onClick={onOpen}
      className="relative w-full text-left overflow-hidden rounded-3xl bg-card border border-border/60 p-4 pl-5 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.06)] active:scale-[0.99] transition-transform"
    >
      <span
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ backgroundColor: isToday ? 'var(--color-accent)' : 'var(--color-primary)' }}
      />
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-foreground text-sm">{format(d, 'EEE, MMM d')}</p>
          {rel && <p className="text-[11px] text-muted-foreground">{rel}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-lg text-ink num leading-none">{fmtApprox(day.total_calories)}</p>
          <p className="text-[10px] text-muted-foreground num">/ {goal} kcal</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: STATUS_COLOR[status] }} />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        <MacroChip color="protein" label="P" value={day.total_protein_g} target={targets?.protein_target_g} />
        <MacroChip color="carbs" label="C" value={day.total_carbs_g} target={targets?.carbs_target_g} />
        <MacroChip color="fat" label="F" value={day.total_fat_g} target={targets?.fat_target_g} />
        <MacroChip color="fiber" label="Fib" value={day.total_fibre_g} target={targets?.fibre_target_g} />
        {day.weight_kg != null && (
          <span className="ml-auto text-[10px] font-semibold text-muted-foreground num">⚖ {day.weight_kg} kg</span>
        )}
      </div>
    </button>
  )
}

function MacroChip({ color, label, value, target }: { color: 'protein' | 'carbs' | 'fat' | 'fiber'; label: string; value: number; target?: number }) {
  const bg =
    color === 'protein' ? 'bg-primary-soft text-primary'
    : color === 'carbs' ? 'bg-warning-soft text-warning'
    : color === 'fat' ? 'bg-accent-soft text-accent'
    : 'bg-fiber-soft text-fiber'
  return (
    <span className={['text-[9px] font-semibold px-2 py-0.5 rounded-full num', bg].join(' ')}>
      {label} {Math.round(value)}{target ? `/${target}` : ''}g
    </span>
  )
}

// --- date helpers ---

function lastNDays(n: number): string[] {
  const out: string[] = []
  const today = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    out.push(format(d, 'yyyy-MM-dd'))
  }
  return out
}

function relativeLabel(iso: string): string | null {
  const diff = differenceInCalendarDays(new Date(), parseISO(iso))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  return null
}
