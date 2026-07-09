import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface CalorieRingProps {
  consumed: number
  target: number
}

export default function CalorieRing({ consumed, target }: CalorieRingProps) {
  const remaining = Math.max(target - consumed, 0)
  const pct = Math.min(Math.round((consumed / target) * 100), 100)
  const data = [
    { name: 'consumed', value: consumed },
    { name: 'remaining', value: remaining },
  ]

  return (
    <div className="relative flex items-center justify-center">
      <ResponsiveContainer width={220} height={220}>
        <PieChart>
          <Pie
            data={data}
            innerRadius={75}
            outerRadius={95}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill="var(--color-primary)" />
            <Cell fill="var(--color-border)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-text-primary">~{Math.round(consumed)}</span>
        <span className="text-sm text-text-secondary">/ {target} kcal</span>
        <span className="text-xs text-text-secondary mt-1">{pct}%</span>
      </div>
    </div>
  )
}
