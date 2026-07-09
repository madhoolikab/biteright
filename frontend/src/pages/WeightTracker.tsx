import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import { format, parseISO } from 'date-fns'
import api from '../api/client'
import { useProfileStore } from '../store/profileStore'
import { useToday } from '../hooks/useToday'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'

interface WeightEntry {
  id: string
  log_date: string
  weight_kg: number
  smoothed_kg: number
}

export default function WeightTracker() {
  const today = useToday()
  const { profile } = useProfileStore()
  const [weight, setWeight] = useState('')
  const [history, setHistory] = useState<WeightEntry[]>([])
  const [todayLogged, setTodayLogged] = useState(false)

  useEffect(() => {
    api.get('/weight/history').then(({ data }) => setHistory(data)).catch(() => {})
    api.get(`/weight/today?log_date=${today}`).then(({ data }) => {
      if (data) {
        setWeight(String(data.weight_kg))
        setTodayLogged(true)
      }
    }).catch(() => {})
  }, [today])

  const logWeight = async () => {
    await api.post('/weight/', { log_date: today, weight_kg: Number(weight) })
    setTodayLogged(true)
    const { data } = await api.get('/weight/history')
    setHistory(data)
  }

  const chartData = history.map((e) => ({
    date: format(parseISO(e.log_date), 'dd MMM'),
    weight: e.weight_kg,
    trend: e.smoothed_kg,
  }))

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl text-foreground">Weight</h1>

      {/* Log today */}
      <Card>
        <h3 className="font-semibold text-sm mb-3">
          {todayLogged ? "Today's weight" : 'Log your weight'}
        </h3>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 76.5"
              className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:border-primary pr-10"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">kg</span>
          </div>
          <Button onClick={logWeight} disabled={!weight}>
            {todayLogged ? 'Update' : 'Save'}
          </Button>
        </div>
      </Card>

      {/* Chart */}
      {chartData.length >= 2 && (
        <Card>
          <h3 className="font-semibold text-sm mb-4">Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={35}
              />
              <Tooltip />
              <Line type="monotone" dataKey="weight" stroke="var(--color-border)" dot={{ r: 3 }} strokeWidth={1} name="Raw" />
              <Line type="monotone" dataKey="trend" stroke="var(--color-primary)" dot={false} strokeWidth={2.5} name="Trend" />
              {profile?.goal_weight_kg && (
                <ReferenceLine y={profile.goal_weight_kg} stroke="var(--color-warning)" strokeDasharray="5 5" label={{ value: 'Goal', fill: 'var(--color-warning)', fontSize: 11 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {chartData.length < 2 && (
        <Card className="text-center py-8">
          <p className="text-muted-foreground">Log your weight for a few days to see the trend chart</p>
        </Card>
      )}
    </div>
  )
}
