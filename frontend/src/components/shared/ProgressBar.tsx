interface ProgressBarProps {
  value: number
  max: number
  color: string
  label: string
  unit?: string
  showTilde?: boolean
}

export default function ProgressBar({ value, max, color, label, unit = 'g', showTilde = false }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100)
  const displayValue = showTilde ? `~${Math.round(value)}` : Math.round(value)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="font-medium">
          {displayValue}{unit} / {max}{unit}
        </span>
      </div>
      <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
