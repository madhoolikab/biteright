import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { useNavigate, useSearchParams } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { useDailyLogStore } from '../store/dailyLogStore'
import { useProfileStore } from '../store/profileStore'
import { useToday } from '../hooks/useToday'
import { useSpeechInput } from '../hooks/useSpeechInput'
import api from '../api/client'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import ReviewCard, { type ReviewItem } from '../components/meals/ReviewCard'

interface ClarifyingQuestion {
  item_index: number
  field: string
  question: string
  options: string[]
}

interface FavouriteItem {
  item_name: string
  calories: number
  carbs_g: number | null
  protein_g: number | null
  fat_g: number | null
  fibre_g: number | null
}

type Tab = 'photo' | 'describe' | 'favourites'

const OIL_LEVELS = ['light', 'medium', 'generous']

export default function MealLog() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const today = useToday()
  const { logMealItems } = useDailyLogStore()
  const { profile, updateProfile } = useProfileStore()

  const targetDate = searchParams.get('date') || today
  const afterLog = () => navigate(targetDate === today ? '/' : `/history/${targetDate}`)

  const [tab, setTab] = useState<Tab>('photo')
  const [mealType, setMealType] = useState(searchParams.get('meal') || 'breakfast')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [error, setError] = useState('')

  // Inputs
  const [description, setDescription] = useState('')
  const [caption, setCaption] = useState('')
  const [photoBase64, setPhotoBase64] = useState('')
  const [usedVoice, setUsedVoice] = useState(false)

  // Review state
  const [items, setItems] = useState<ReviewItem[]>([])
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([])
  const answersRef = useRef<Array<{ item_index: number; field: string; answer: string }>>([])

  const [favourites, setFavourites] = useState<FavouriteItem[]>([])
  const [recents, setRecents] = useState<FavouriteItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const appendTranscript = (text: string) => {
    setUsedVoice(true)
    if (tab === 'photo') setCaption((c) => (c ? `${c} ${text}` : text))
    else setDescription((d) => (d ? `${d} ${text}` : text))
  }
  const speech = useSpeechInput(appendTranscript)

  useEffect(() => {
    api.get('/meals/favourites').then(({ data }) => setFavourites(data)).catch(() => {})
    api.get('/meals/recent').then(({ data }) => setRecents(data)).catch(() => {})
  }, [])

  const runAnalysis = async (image: string, text: string) => {
    setIsAnalyzing(true)
    setError('')
    try {
      const { data } = await api.post('/meals/analyze', {
        image_base64: image || undefined,
        text_description: text.trim() || undefined,
        dietary_preference: profile?.dietary_preference,
        primary_cuisine: profile?.primary_cuisine,
        oil_usage_level: profile?.oil_usage_level || undefined,
        portion_calibration: profile?.portion_calibration || undefined,
      })
      setItems(data.items.map((it: Omit<ReviewItem, 'user_edited_fields'>) => ({
        ...it,
        calorie_low: it.calorie_low || it.calories * 0.85,
        calorie_high: it.calorie_high || it.calories * 1.15,
        user_edited_fields: [],
      })))
      setQuestions(data.clarifying_questions || [])
      answersRef.current = []
    } catch {
      setError("Couldn't analyze that. Try a clearer photo or add a few more words — or adjust the numbers after logging.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handlePhoto = async (file: File) => {
    setIsLoadingPhoto(true)
    setError('')
    try {
      const compressed = await imageCompression(file, { maxWidthOrHeight: 1024, maxSizeMB: 1 })
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        setPhotoBase64(base64)
        setIsLoadingPhoto(false)
      }
      reader.readAsDataURL(compressed)
    } catch {
      setIsLoadingPhoto(false)
      setError("Couldn't read that image. Try another photo or describe your meal instead.")
    }
  }

  // --- Clarifying questions ---

  const saveCalibration = (q: ClarifyingQuestion, answer: string, refined: ReviewItem[]) => {
    if (q.field === 'oil_usage_level') {
      const level = OIL_LEVELS.find((l) => answer.toLowerCase().includes(l))
      if (level && profile && profile.oil_usage_level !== level) {
        updateProfile({ oil_usage_level: level }).catch(() => {})
      }
    } else if (q.field === 'quantity' && profile) {
      const it = refined[q.item_index]
      if (it?.estimated_grams) {
        const key = `${it.item_name.toLowerCase().replace(/\s+/g, '_')}_g`
        updateProfile({
          portion_calibration: { ...(profile.portion_calibration || {}), [key]: Math.round(it.estimated_grams) },
        }).catch(() => {})
      }
    }
  }

  const answerQuestion = async (q: ClarifyingQuestion, answer: string) => {
    answersRef.current = [...answersRef.current, { item_index: q.item_index, field: q.field, answer }]
    setQuestions((qs) => qs.filter((x) => x !== q))
    setIsRefining(true)
    try {
      const editedByIndex: Record<string, string[]> = {}
      items.forEach((it, i) => {
        if (it.user_edited_fields.length) editedByIndex[String(i)] = it.user_edited_fields
      })
      const { data } = await api.post('/meals/analyze/refine', {
        items: items.map(({ user_edited_fields: _uef, ...rest }) => rest),
        answers: answersRef.current,
        user_edited_fields: editedByIndex,
        dietary_preference: profile?.dietary_preference,
        primary_cuisine: profile?.primary_cuisine,
      })
      const refined: ReviewItem[] = data.items.map((it: Omit<ReviewItem, 'user_edited_fields'>, i: number) => ({
        ...it,
        user_edited_fields: items[i]?.user_edited_fields || [],
      }))
      setItems(refined)
      saveCalibration(q, answer, refined)
    } catch {
      // Refinement is best-effort — the original estimate stays usable
    } finally {
      setIsRefining(false)
    }
  }

  const defaultOption = (q: ClarifyingQuestion): string | null => {
    if (q.field === 'oil_usage_level' && profile?.oil_usage_level) {
      return q.options.find((o) => o.toLowerCase().includes(profile.oil_usage_level!)) || null
    }
    return null
  }

  // --- Logging ---

  const confirmAnalyzed = async () => {
    const source = photoBase64 ? 'photo' : usedVoice ? 'voice' : 'text'
    await logMealItems(items.map((item) => ({
      log_date: targetDate,
      meal_type: mealType,
      item_name: item.item_name,
      calories: item.calories,
      carbs_g: item.carbs_g,
      protein_g: item.protein_g,
      fat_g: item.fat_g,
      fibre_g: item.fibre_g,
      portion_grams: item.estimated_grams,
      portion_desc: item.portion_description,
      quantity: item.quantity,
      unit: item.unit,
      calorie_low: item.calorie_low,
      calorie_high: item.calorie_high,
      user_edited_fields: item.user_edited_fields,
      is_estimate: true,
      source,
    })))
    afterLog()
  }

  const relogItem = async (item: FavouriteItem) => {
    await logMealItems([{
      log_date: targetDate,
      meal_type: mealType,
      item_name: item.item_name,
      calories: item.calories,
      carbs_g: item.carbs_g ?? undefined,
      protein_g: item.protein_g ?? undefined,
      fat_g: item.fat_g ?? undefined,
      fibre_g: item.fibre_g ?? undefined,
      source: 'favourite',
    }])
    afterLog()
  }

  const resetAnalysis = () => {
    setItems([])
    setQuestions([])
    setPhotoBase64('')
    setError('')
    answersRef.current = []
  }

  const totalLow = items.reduce((s, i) => s + i.calorie_low, 0)
  const totalHigh = items.reduce((s, i) => s + i.calorie_high, 0)
  const inReview = items.length > 0

  const MicButton = ({ className = '' }: { className?: string }) =>
    speech.supported ? (
      <button
        type="button"
        onClick={speech.listening ? speech.stop : speech.start}
        aria-label={speech.listening ? 'Stop dictation' : 'Speak your meal'}
        className={`p-2.5 rounded-2xl active:scale-[0.95] transition-all ${
          speech.listening ? 'gradient-berry text-white animate-pulse' : 'bg-muted text-primary'
        } ${className}`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      </button>
    ) : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-muted-foreground">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-display text-2xl text-foreground">Log Meal</h1>
        {targetDate !== today && (
          <span className="ml-auto rounded-full bg-warning-soft px-3 py-1 text-[11px] font-semibold text-foreground border border-warning/20">
            {format(new Date(`${targetDate}T00:00:00`), 'EEE, MMM d')}
          </span>
        )}
      </div>

      {/* Meal type selector */}
      <div className="flex gap-2">
        {['breakfast', 'lunch', 'snack', 'dinner'].map((mt) => (
          <button
            key={mt}
            onClick={() => setMealType(mt)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold capitalize transition-colors ${
              mealType === mt ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {mt}
          </button>
        ))}
      </div>

      {!inReview && (
        <>
          {/* Tab selector */}
          <div className="flex border-b border-border">
            {(['photo', 'describe', 'favourites'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
                  tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                }`}
              >
                {t === 'favourites' ? 'Recent & Faves' : t === 'photo' ? 'Photo' : 'Describe'}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-accent">{error}</p>}

          {/* Photo tab */}
          {tab === 'photo' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])}
              />
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Anything we can't see? (e.g. extra ghee on this)"
                  className="flex-1 px-4 py-3 border border-border rounded-2xl text-sm focus:outline-none focus:border-primary"
                />
                <MicButton />
              </div>

              {photoBase64 ? (
                <div className="space-y-3">
                  <div className="relative rounded-3xl overflow-hidden">
                    <img
                      src={`data:image/jpeg;base64,${photoBase64}`}
                      alt="Selected meal"
                      className="w-full max-h-64 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoBase64('')}
                      disabled={isAnalyzing}
                      className="absolute top-2 right-2 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur text-xs font-semibold disabled:opacity-50"
                    >
                      Retake
                    </button>
                  </div>
                  <Button
                    onClick={() => runAnalysis(photoBase64, caption)}
                    className="w-full"
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze meal'}
                  </Button>
                </div>
              ) : (
                <Card
                  onClick={() => !isLoadingPhoto && fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border cursor-pointer hover:border-primary/40"
                >
                  {isLoadingPhoto ? (
                    <>
                      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
                      <p className="text-muted-foreground">Loading photo...</p>
                    </>
                  ) : (
                    <>
                      <svg className="w-12 h-12 text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="font-medium">Take or upload a photo</p>
                      <p className="text-sm text-muted-foreground mt-1">Add a note above if you like, then we'll identify items and estimate calories</p>
                    </>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* Describe tab — typed or dictated, same analysis pipeline as photo */}
          {tab === 'describe' && (
            <div className="space-y-4">
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder={'Describe your meal — portions help!\ne.g. "2 idlis with sambar and coconut chutney, medium oil"'}
                  className="w-full px-4 py-3 pr-14 border border-border rounded-2xl text-sm focus:outline-none focus:border-primary resize-none"
                />
                <MicButton className="absolute right-2 bottom-3" />
              </div>
              {speech.listening && (
                <p className="text-sm text-primary font-medium">Listening... speak naturally, tap the mic when done</p>
              )}
              <Button
                onClick={() => runAnalysis('', description)}
                className="w-full"
                disabled={!description.trim() || isAnalyzing}
              >
                {isAnalyzing ? 'Estimating...' : 'Estimate calories'}
              </Button>
            </div>
          )}

          {/* Favourites & Recents tab */}
          {tab === 'favourites' && (
            <div className="space-y-4">
              {favourites.length > 0 && (
                <>
                  <h3 className="font-semibold text-sm">Favourites</h3>
                  {favourites.map((item, i) => (
                    <Card key={`fav-${i}`} onClick={() => relogItem(item)} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-muted-foreground num">~{Math.round(item.calories)} kcal</p>
                      </div>
                      <span className="text-primary text-sm">+ Log</span>
                    </Card>
                  ))}
                </>
              )}
              {recents.length > 0 && (
                <>
                  <h3 className="font-semibold text-sm mt-4">Recent</h3>
                  {recents.map((item, i) => (
                    <Card key={`rec-${i}`} onClick={() => relogItem(item)} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-muted-foreground num">~{Math.round(item.calories)} kcal</p>
                      </div>
                      <span className="text-primary text-sm">+ Log</span>
                    </Card>
                  ))}
                </>
              )}
              {!favourites.length && !recents.length && (
                <p className="text-muted-foreground text-center py-8">No favourites or recent meals yet. Start logging!</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Review: clarifying chips + editable cards */}
      {inReview && (
        <div className="space-y-4">
          {questions.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Quick question — optional</p>
              {questions.map((q, qi) => {
                const preselected = defaultOption(q)
                return (
                  <Card key={qi} className="space-y-2.5 bg-primary-soft border-none">
                    <p className="text-sm font-medium">{q.question}</p>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={isRefining}
                          onClick={() => answerQuestion(q, opt)}
                          className={`px-3 py-1.5 rounded-full text-sm font-semibold active:scale-[0.96] transition-transform disabled:opacity-50 ${
                            opt === preselected ? 'gradient-berry text-white' : 'bg-card text-primary'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuestions((qs) => qs.filter((x) => x !== q))}
                      className="text-xs text-muted-foreground underline underline-offset-2"
                    >
                      Skip — use estimate
                    </button>
                  </Card>
                )
              })}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {isRefining ? 'Updating your estimate...' : 'These are estimates — adjust anything, we\'ll rescale the rest'}
          </p>
          {items.map((item, i) => (
            <ReviewCard
              key={i}
              item={item}
              onChange={(updated) => setItems((its) => its.map((it, j) => (j === i ? updated : it)))}
              onDelete={() => setItems((its) => its.filter((_, j) => j !== i))}
            />
          ))}
          <div className="bg-primary-soft rounded-2xl p-3 text-center">
            <span className="text-primary font-bold text-lg num">
              ~{Math.round(totalLow)}–{Math.round(totalHigh)} kcal total
            </span>
          </div>
          <Button onClick={confirmAnalyzed} className="w-full" disabled={isRefining}>Confirm & Log</Button>
          <button type="button" onClick={resetAnalysis} className="w-full text-sm text-muted-foreground py-1">
            Start over
          </button>
        </div>
      )}
    </div>
  )
}
