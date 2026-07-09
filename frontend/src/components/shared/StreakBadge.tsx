import { useEffect, useState } from 'react'

export default function StreakBadge({ days }: { days: number }) {
  const [prev, setPrev] = useState(days)
  const [pop, setPop] = useState(false)

  useEffect(() => {
    if (days > prev) {
      setPop(true)
      const t = setTimeout(() => setPop(false), 700)
      return () => clearTimeout(t)
    }
    setPrev(days)
  }, [days, prev])

  if (days <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
        <span aria-hidden>✨</span>
        Fresh start
      </span>
    )
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-foreground border border-warning/20',
        pop ? 'streak-pop' : '',
      ].join(' ')}
    >
      <span aria-hidden>🔥</span>
      <span className="num">{days}</span>
      <span className="text-muted-foreground font-normal">
        day{days === 1 ? '' : 's'} in a row
      </span>
    </span>
  )
}
