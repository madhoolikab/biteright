import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import MealLog from './pages/MealLog'
import WeightTracker from './pages/WeightTracker'
import Profile from './pages/Profile'
import HistoryLog from './pages/HistoryLog'
import DayDetail from './pages/DayDetail'

const DEV_MODE = import.meta.env.DEV && import.meta.env.VITE_SUPABASE_URL?.includes('placeholder')

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading, isOnboarded } = useAuthStore()

  if (DEV_MODE) return <>{children}</>

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-display text-lg">BiteRight</div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (!isOnboarded) return <Navigate to="/onboarding" replace />

  return <>{children}</>
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<AuthGuard><AppShell /></AuthGuard>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/log" element={<MealLog />} />
          <Route path="/weight" element={<WeightTracker />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/history" element={<HistoryLog />} />
          <Route path="/history/:date" element={<DayDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
