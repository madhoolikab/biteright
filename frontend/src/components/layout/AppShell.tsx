import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, BarChart3, User, Plus } from 'lucide-react'

const tabs = [
  { path: '/', label: 'Today', Icon: Home },
  { path: '/checkin', label: 'Insights', Icon: BarChart3 },
  { path: '/profile', label: 'Profile', Icon: User },
] as const

export default function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-md px-5 pt-8 pb-32">
        <Outlet />
      </main>

      <nav
        aria-label="Primary"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-sm rounded-full bg-card/90 backdrop-blur-md border border-border shadow-[0_18px_40px_-18px_rgba(26,20,48,0.35)]"
      >
        <ul className="flex items-center justify-between px-2 py-2">
          {tabs.map(({ path, label, Icon }) => {
            const active = location.pathname === path
            return (
              <li key={path}>
                <button
                  onClick={() => navigate(path)}
                  className={[
                    'flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors',
                    active ? 'bg-accent-soft text-accent' : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  <Icon className={['h-5 w-5', active ? 'stroke-[2.4]' : 'stroke-[1.75]'].join(' ')} />
                  {active && <span>{label}</span>}
                </button>
              </li>
            )
          })}
          <li>
            <button
              onClick={() => navigate('/log')}
              aria-label="Log a meal"
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold text-primary-foreground gradient-berry shadow-[0_8px_18px_-8px_rgba(124,92,255,0.7)] active:scale-95 transition-transform"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Log
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}
