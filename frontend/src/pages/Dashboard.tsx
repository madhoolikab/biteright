import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import { useDailyLogStore } from '../store/dailyLogStore'
import { useProfileStore } from '../store/profileStore'
import { useToday, isEvening } from '../hooks/useToday'
import CalorieCard from '../components/dashboard/CalorieCard'
import WaterTracker from '../components/dashboard/WaterTracker'
import PlateCard from '../components/dashboard/PlateCard'
import LogDuoCard from '../components/dashboard/LogDuoCard'
import StreakBadge from '../components/shared/StreakBadge'
import { greeting } from '../lib/format'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const today = useToday()
  const navigate = useNavigate()
  const { dashboard, isLoading, fetchDashboard, addWater, deleteMealItem, toggleFavourite } = useDailyLogStore()
  const { profile, fetchProfile } = useProfileStore()
  const [waterBusy, setWaterBusy] = useState(false)

  useEffect(() => {
    fetchDashboard(today)
    fetchProfile()
  }, [today, fetchDashboard, fetchProfile])

  if (isLoading || !dashboard) {
    return (
      <div className="space-y-4 pt-4">
        <div className="h-8 w-48 rounded-2xl bg-muted animate-pulse" />
        <div className="h-48 rounded-[32px] bg-muted animate-pulse" />
        <div className="h-36 rounded-3xl bg-muted animate-pulse" />
      </div>
    )
  }

  const firstName = profile?.name?.split(' ')[0] || 'friend'
  const showUnderEatingWarning = isEvening() && dashboard.total_calories < 1200 && dashboard.total_calories > 0
  const showOverMessage = dashboard.total_calories > dashboard.calorie_target * 1.15
  const loggedSlots = dashboard.meals.filter((s) => s.item_count > 0)

  async function handleWaterAdd(amount: 250 | 500) {
    setWaterBusy(true)
    try {
      await addWater(today)
      if (amount === 500) await addWater(today)
    } finally {
      setWaterBusy(false)
    }
  }

  async function handleRemoveItem(itemId: string) {
    try {
      await deleteMealItem(itemId, today)
      toast.success('Removed')
    } catch {
      toast.error("Couldn't remove item")
    }
  }

  async function handleFavourite(itemId: string) {
    try {
      await toggleFavourite(itemId)
      toast.success('Updated')
    } catch {
      toast.error("Couldn't update favourite")
    }
  }

  return (
    <div>
      {/* Tab pill */}
      <div className="bg-muted p-1.5 rounded-2xl flex gap-1 mb-6">
        <button className="flex-1 py-2.5 rounded-xl bg-card text-primary text-sm font-semibold shadow-sm ring-1 ring-black/5">
          Today
        </button>
        <Link
          to="/checkin"
          className="flex-1 py-2.5 rounded-xl text-muted-foreground text-sm font-medium text-center"
        >
          Insights
        </Link>
      </div>

      {/* Greeting */}
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground leading-tight">
          {greeting()}, <span className="text-accent">{firstName}.</span>
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <StreakBadge days={0} />
        </div>
      </header>

      {/* Calorie card */}
      <CalorieCard
        consumed={dashboard.total_calories}
        target={dashboard.calorie_target}
        protein={dashboard.total_protein_g}
        carbs={dashboard.total_carbs_g}
        fat={dashboard.total_fat_g}
        fibre={dashboard.total_fibre_g}
        targets={{
          protein_g: dashboard.protein_target_g,
          carbs_g: dashboard.carbs_target_g,
          fat_g: dashboard.fat_target_g,
          fibre_target_g: dashboard.fibre_target_g,
        }}
      />

      {/* Log meal duo */}
      <LogDuoCard
        onSnap={() => navigate('/log')}
        onManual={() => navigate('/log')}
      />

      {/* Hydration */}
      <WaterTracker
        current={dashboard.water_ml}
        target={dashboard.water_target_ml}
        onAdd={handleWaterAdd}
        busy={waterBusy}
      />

      {/* Today's plates */}
      <section className="mt-8">
        <div className="flex justify-between items-center px-1 mb-4">
          <h2 className="font-display text-xl text-foreground">Today's Plates</h2>
          {loggedSlots.length > 0 && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground num">
              {loggedSlots.length} {loggedSlots.length === 1 ? 'plate' : 'plates'}
            </span>
          )}
        </div>

        {loggedSlots.length === 0 ? (
          <div className="rounded-3xl bg-gradient-to-br from-primary-soft to-accent-soft p-8 text-center">
            <div className="text-3xl mb-2">✨</div>
            <p className="font-display text-lg text-foreground">Snap your first plate</p>
            <p className="text-sm text-muted-foreground mt-1">Tap + below to start your day.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {loggedSlots.map((slot, i) => (
              <PlateCard
                key={slot.meal_type}
                slot={slot}
                defaultOpen={i === loggedSlots.length - 1}
                onFavourite={(id) => handleFavourite(id)}
                onRemove={handleRemoveItem}
              />
            ))}
          </div>
        )}
      </section>

      {/* Warnings */}
      {showUnderEatingWarning && (
        <div className="mt-4 rounded-3xl border border-warning/30 bg-warning-soft p-4">
          <p className="text-sm text-foreground">
            Looks like today was light — your body needs fuel to reach your goals.
          </p>
        </div>
      )}

      {showOverMessage && (
        <div className="mt-4 rounded-3xl border border-primary/20 bg-primary-soft p-4">
          <p className="text-sm text-foreground">
            You've had a full day — listen to your hunger from here.
          </p>
        </div>
      )}

      {/* Monday check-in nudge */}
      {new Date().getDay() === 1 && (
        <div
          onClick={() => navigate('/checkin')}
          className="mt-4 rounded-3xl border border-secondary/30 bg-secondary-soft p-4 cursor-pointer"
        >
          <p className="text-sm text-secondary font-medium">Your weekly check-in is ready →</p>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        {format(new Date(), 'EEEE, MMMM d')}
      </p>
    </div>
  )
}
