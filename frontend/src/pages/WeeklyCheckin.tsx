import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentWeekStart } from '../hooks/useToday'
import api from '../api/client'
import Card from '../components/shared/Card'

interface InsightData {
  week_start: string
  insight_text: string
  days_logged: number
  avg_calories: number
  weight_change_kg: number | null
}

export default function WeeklyCheckin() {
  const navigate = useNavigate()
  const weekStart = useCurrentWeekStart()
  const [insight, setInsight] = useState<InsightData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setIsLoading(true)
    api.get(`/insights/weekly?week_start=${weekStart}`)
      .then(({ data }) => setInsight(data))
      .catch((e) => setError(e.response?.data?.detail || 'No data for this week yet'))
      .finally(() => setIsLoading(false))
  }, [weekStart])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-muted-foreground">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-display text-2xl text-foreground">Weekly Check-in</h1>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-muted-foreground">Preparing your weekly summary...</p>
        </div>
      )}

      {error && (
        <Card className="text-center py-8">
          <p className="text-muted-foreground">{error}</p>
        </Card>
      )}

      {insight && (
        <>
          {/* Consistency */}
          <Card className="text-center py-6">
            <div className="font-display text-5xl text-primary mb-1 num">{insight.days_logged}/7</div>
            <p className="text-muted-foreground text-sm">
              {insight.days_logged >= 5
                ? 'Great consistency this week!'
                : insight.days_logged >= 3
                ? 'Good effort — keep building the habit'
                : 'Every logged day counts'}
            </p>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <p className="text-muted-foreground text-xs">Avg. Daily Calories</p>
              <p className="font-display text-2xl mt-1 num">~{Math.round(insight.avg_calories)}</p>
              <p className="text-xs text-muted-foreground">kcal</p>
            </Card>
            {insight.weight_change_kg !== null && (
              <Card>
                <p className="text-muted-foreground text-xs">Weight Change</p>
                <p className={`text-xl font-bold mt-1 ${insight.weight_change_kg < 0 ? 'text-secondary' : 'text-foreground'}`}>
                  {insight.weight_change_kg > 0 ? '+' : ''}{insight.weight_change_kg} kg
                </p>
                <p className="text-xs text-muted-foreground">this week</p>
              </Card>
            )}
          </div>

          {/* AI Insight */}
          <Card className="border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-soft flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-sm leading-relaxed">{insight.insight_text}</p>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
