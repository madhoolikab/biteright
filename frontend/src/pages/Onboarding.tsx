import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useProfileStore } from '../store/profileStore'
import { useAuthStore } from '../store/authStore'
import Button from '../components/shared/Button'

type OnboardingData = {
  name: string
  gender: string
  age: number
  height_cm: number
  weight_kg: number
  unit_preference: string
  goal: string
  goal_weight_kg: number | null
  weekly_rate_kg: number | null
  activity_level: string
  dietary_preference: string
  health_conditions: string[]
  primary_cuisine: string
  // Calculated
  bmr: number
  maintenance_calories: number
  calorie_target: number
  protein_target_g: number
  carbs_target_g: number
  fat_target_g: number
  fibre_target_g: number
  weeks_to_goal: number | null
}

const STEPS = ['name', 'gender', 'body', 'goal', 'goal_details', 'activity', 'diet', 'health', 'cuisine', 'targets'] as const

export default function Onboarding() {
  const navigate = useNavigate()
  const { createProfile, calculateTargets } = useProfileStore()
  const setOnboarded = useAuthStore((s) => s.setOnboarded)
  const [step, setStep] = useState(0)
  const [data, setData] = useState<Partial<OnboardingData>>({
    unit_preference: 'metric',
    health_conditions: [],
  })
  const [isCalculating, setIsCalculating] = useState(false)

  const currentStep = STEPS[step]
  const shouldShowGoalDetails = data.goal === 'lose' || data.goal === 'gain'

  // Always-current ref so setTimeout / event listeners never capture a stale next()
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextRef = useRef<() => void>(() => {})

  const update = (updates: Partial<OnboardingData>) => setData((d) => ({ ...d, ...updates }))

  const next = async () => {
    // Skip goal_details if maintaining
    let nextStep = step + 1
    if (STEPS[nextStep] === 'goal_details' && !shouldShowGoalDetails) {
      nextStep++
    }

    // Calculate targets before showing targets step
    if (STEPS[nextStep] === 'targets') {
      setIsCalculating(true)
      try {
        const targets = await calculateTargets({
          gender: data.gender!,
          age: data.age!,
          height_cm: data.height_cm!,
          weight_kg: data.weight_kg!,
          goal: data.goal!,
          goal_weight_kg: data.goal_weight_kg || undefined,
          weekly_rate_kg: data.weekly_rate_kg || undefined,
          activity_level: data.activity_level!,
        })
        update({
          weeks_to_goal: targets.weeks_to_goal,
          bmr: targets.bmr,
          maintenance_calories: targets.maintenance_calories,
          calorie_target: targets.target_calories,
          protein_target_g: targets.protein_target_g,
          carbs_target_g: targets.carbs_target_g,
          fat_target_g: targets.fat_target_g,
          fibre_target_g: targets.fibre_target_g,
        })
      } catch (err) {
        // Fallback client-side calculation
        console.error('[onboarding] calculate-targets failed', err)
      } finally {
        setIsCalculating(false)
      }
    }

    setStep(nextStep)
  }

  const back = () => {
    let prevStep = step - 1
    if (STEPS[prevStep] === 'goal_details' && !shouldShowGoalDetails) {
      prevStep--
    }
    setStep(Math.max(0, prevStep))
  }

  const finish = async () => {
    try {
      // oil_usage_level / portion_calibration are populated progressively
      // during meal logging, not collected during onboarding
      await createProfile({
        ...(data as OnboardingData),
        oil_usage_level: null,
        portion_calibration: null,
      })
      setOnboarded(true)
      navigate('/')
    } catch (err) {
      console.error('[onboarding] create profile failed', err)
      toast.error("Couldn't save your profile — give it another try")
    }
  }

  // Keep ref pointing at latest next() so closures never go stale
  nextRef.current = next

  const selectAndNext = (updateFn: () => void) => {
    updateFn()
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null
      nextRef.current()
    }, 300)
  }

  // Enter key advances the multi-select health step (no <input> to trigger form submit)
  useEffect(() => {
    if (currentStep !== 'health') return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      nextRef.current()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [currentStep])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isStepValid(currentStep, data)) return
    if (currentStep === 'targets') {
      finish()
    } else {
      next()
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="min-h-screen bg-background px-6 py-8 flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full mb-8">
        <div className="h-full gradient-berry rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        {/* Step content */}
        <div className="flex-1">
          {currentStep === 'name' && (
            <StepContent title="What should we call you?">
              <input
                type="text"
                value={data.name || ''}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="Your name"
                className="w-full px-4 py-3 border border-border rounded-xl text-lg focus:outline-none focus:border-primary"
                autoFocus
              />
            </StepContent>
          )}

          {currentStep === 'gender' && (
            <StepContent title="Select your gender" subtitle="This helps calculate your calorie needs accurately">
              <div className="grid grid-cols-2 gap-3">
                {['female', 'male'].map((g) => (
                  <OptionCard key={g} selected={data.gender === g} onClick={() => selectAndNext(() => update({ gender: g }))}>
                    {g === 'female' ? 'Female' : 'Male'}
                  </OptionCard>
                ))}
              </div>
            </StepContent>
          )}

          {currentStep === 'body' && (
            <StepContent title="Your body metrics">
              <div className="flex gap-2 mb-6">
                {['metric', 'imperial'].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => update({ unit_preference: u })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.unit_preference === u ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {u === 'metric' ? 'kg / cm' : 'lbs / ft'}
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                <NumberInput label="Age" value={data.age} onChange={(v) => update({ age: v })} unit="years" />
                <NumberInput
                  label="Height"
                  value={data.height_cm}
                  onChange={(v) => update({ height_cm: v })}
                  unit={data.unit_preference === 'metric' ? 'cm' : 'in'}
                />
                <NumberInput
                  label="Weight"
                  value={data.weight_kg}
                  onChange={(v) => update({ weight_kg: v })}
                  unit={data.unit_preference === 'metric' ? 'kg' : 'lbs'}
                />
              </div>
            </StepContent>
          )}

          {currentStep === 'goal' && (
            <StepContent title="What's your goal?">
              <div className="space-y-3">
                {[
                  { value: 'lose', label: 'Lose weight', desc: 'Gradual, sustainable fat loss' },
                  { value: 'maintain', label: 'Maintain weight', desc: 'Stay where you are' },
                  { value: 'gain', label: 'Gain weight', desc: 'Build muscle and strength' },
                ].map(({ value, label, desc }) => (
                  <OptionCard key={value} selected={data.goal === value} onClick={() => selectAndNext(() => update({ goal: value }))}>
                    <span className="font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground block mt-0.5">{desc}</span>
                  </OptionCard>
                ))}
              </div>
            </StepContent>
          )}

          {currentStep === 'goal_details' && (
            <StepContent title={data.goal === 'lose' ? 'How much per week?' : 'How much per week?'} subtitle="A safe, sustainable pace is 0.25–0.5 kg per week">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[0.25, 0.3, 0.4, 0.5].map((rate) => (
                    <OptionCard key={rate} selected={data.weekly_rate_kg === rate} onClick={() => update({ weekly_rate_kg: rate })}>
                      {rate} kg/week
                    </OptionCard>
                  ))}
                </div>
                <NumberInput
                  label="Target weight"
                  value={data.goal_weight_kg ?? undefined}
                  onChange={(v) => update({ goal_weight_kg: v })}
                  unit="kg"
                />
              </div>
            </StepContent>
          )}

          {currentStep === 'activity' && (
            <StepContent title="How active are you?">
              <div className="space-y-3">
                {[
                  { value: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise, desk job' },
                  { value: 'light', label: 'Lightly active', desc: 'Light exercise 1-3 days/week' },
                  { value: 'moderate', label: 'Moderately active', desc: 'Moderate exercise 3-5 days/week' },
                  { value: 'very_active', label: 'Very active', desc: 'Hard exercise 6-7 days/week' },
                ].map(({ value, label, desc }) => (
                  <OptionCard key={value} selected={data.activity_level === value} onClick={() => selectAndNext(() => update({ activity_level: value }))}>
                    <span className="font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground block mt-0.5">{desc}</span>
                  </OptionCard>
                ))}
              </div>
            </StepContent>
          )}

          {currentStep === 'diet' && (
            <StepContent title="Dietary preference">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'vegetarian', label: 'Vegetarian' },
                  { value: 'eggetarian', label: 'Eggetarian' },
                  { value: 'non_vegetarian', label: 'Non-vegetarian' },
                  { value: 'vegan', label: 'Vegan' },
                ].map(({ value, label }) => (
                  <OptionCard key={value} selected={data.dietary_preference === value} onClick={() => selectAndNext(() => update({ dietary_preference: value }))}>
                    {label}
                  </OptionCard>
                ))}
              </div>
            </StepContent>
          )}

          {currentStep === 'health' && (
            <StepContent title="Any health conditions?" subtitle="Optional — helps us tailor advice">
              <div className="grid grid-cols-2 gap-3">
                {['Postpartum', 'Thyroid', 'Diabetes', 'PCOS', 'None'].map((condition) => {
                  const selected = condition === 'None'
                    ? data.health_conditions?.length === 0
                    : data.health_conditions?.includes(condition) ?? false
                  return (
                    <OptionCard
                      key={condition}
                      selected={selected}
                      onClick={() => {
                        if (condition === 'None') {
                          update({ health_conditions: [] })
                        } else {
                          const current = data.health_conditions ?? []
                          update({
                            health_conditions: current.includes(condition)
                              ? current.filter((c) => c !== condition)
                              : [...current, condition],
                          })
                        }
                      }}
                    >
                      {condition}
                    </OptionCard>
                  )
                })}
              </div>
            </StepContent>
          )}

          {currentStep === 'cuisine' && (
            <StepContent title="Primary cuisine">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'south_indian', label: 'South Indian' },
                  { value: 'north_indian', label: 'North Indian' },
                  { value: 'mixed_indian', label: 'Mixed Indian' },
                  { value: 'other', label: 'Other' },
                ].map(({ value, label }) => (
                  <OptionCard key={value} selected={data.primary_cuisine === value} onClick={() => selectAndNext(() => update({ primary_cuisine: value }))}>
                    {label}
                  </OptionCard>
                ))}
              </div>
            </StepContent>
          )}

          {currentStep === 'targets' && (
            <StepContent title="Your personalised targets" subtitle="These are calculated from your profile. Feel free to adjust.">
              {isCalculating ? (
                <div className="text-center py-8 text-muted-foreground">Calculating...</div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-primary-soft rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">BMR</span>
                      <span className="font-medium">{data.bmr} kcal</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Maintenance</span>
                      <span className="font-medium">{data.maintenance_calories} kcal</span>
                    </div>
                    {data.weeks_to_goal != null && data.goal_weight_kg != null && (
                      <div className="pt-2 mt-1 border-t border-primary/10 text-sm font-medium text-primary">
                        ~{data.weeks_to_goal} weeks to reach {data.goal_weight_kg} kg 🎯
                      </div>
                    )}
                  </div>
                  <NumberInput label="Daily calorie target" value={data.calorie_target} onChange={(v) => update({ calorie_target: v })} unit="kcal" />
                  <NumberInput label="Protein" value={data.protein_target_g} onChange={(v) => update({ protein_target_g: v })} unit="g" />
                  <NumberInput label="Carbs" value={data.carbs_target_g} onChange={(v) => update({ carbs_target_g: v })} unit="g" />
                  <NumberInput label="Fat" value={data.fat_target_g} onChange={(v) => update({ fat_target_g: v })} unit="g" />
                  <NumberInput label="Fibre" value={data.fibre_target_g} onChange={(v) => update({ fibre_target_g: v })} unit="g" />
                </div>
              )}
            </StepContent>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={back} className="flex-1">Back</Button>
          )}
          {currentStep === 'targets' ? (
            <Button type="submit" className="flex-1" disabled={isCalculating}>
              Confirm & Start
            </Button>
          ) : (
            <Button type="submit" className="flex-1" disabled={!isStepValid(currentStep, data)}>
              Continue
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

function StepContent({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-2xl text-foreground mb-1">{title}</h2>
      {subtitle && <p className="text-muted-foreground text-sm mb-6">{subtitle}</p>}
      {!subtitle && <div className="mb-6" />}
      {children}
    </div>
  )
}

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-4 rounded-2xl text-left transition-all border ${
        selected ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-card text-foreground hover:border-primary/40'
      }`}
    >
      {children}
    </button>
  )
}

function NumberInput({ label, value, onChange, unit }: { label: string; value?: number; onChange: (v: number | undefined) => void; unit: string }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-muted-foreground w-24 shrink-0">{label}</label>
      <div className="flex-1 relative">
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value
            onChange(raw === '' ? undefined : Number(raw))
          }}
          className="w-full px-4 py-3 border border-border rounded-2xl bg-input focus:outline-none focus:border-primary pr-12"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{unit}</span>
      </div>
    </div>
  )
}

function isStepValid(step: string, data: Partial<OnboardingData>): boolean {
  switch (step) {
    case 'name': return !!data.name?.trim()
    case 'gender': return !!data.gender
    case 'body': return !!data.age && !!data.height_cm && !!data.weight_kg
    case 'goal': return !!data.goal
    case 'goal_details': return !!data.weekly_rate_kg
    case 'activity': return !!data.activity_level
    case 'diet': return !!data.dietary_preference
    case 'health': return true
    case 'cuisine': return !!data.primary_cuisine
    case 'targets': return !!data.calorie_target
    default: return false
  }
}
