import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'

type Mode = 'signin' | 'signup' | 'forgot'

const EMAIL_RE = /\S+@\S+\.\S+/

function friendlyAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : ''
  if (message.includes('Invalid login credentials')) {
    return "That email or password didn't match — try again"
  }
  if (message.includes('User already registered')) {
    return 'Looks like you already have an account — try signing in instead'
  }
  if (message === 'ACCOUNT_EXISTS_OTHER_PROVIDER') {
    return 'This email is already linked to a Google account — try "Continue with Google" instead'
  }
  if (message.includes('Password should be at least')) {
    return 'Password needs to be at least 6 characters'
  }
  if (message.includes('you can only request this after')) {
    return 'Please wait a bit before requesting another email'
  }
  return 'Something went wrong — give it another try'
}

const inputClass =
  'w-full px-4 py-3 border border-border rounded-2xl bg-input focus:outline-none focus:border-primary'

export default function Login() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const isOnboarded = useAuthStore((s) => s.isOnboarded)
  const isLoading = useAuthStore((s) => s.isLoading)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const signInWithPassword = useAuthStore((s) => s.signInWithPassword)
  const signUpWithPassword = useAuthStore((s) => s.signUpWithPassword)
  const resetPasswordForEmail = useAuthStore((s) => s.resetPasswordForEmail)
  const resendConfirmationEmail = useAuthStore((s) => s.resendConfirmationEmail)

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [resending, setResending] = useState(false)

  // Already signed in (e.g. a stale /login tab, or the back button) — leave this page
  useEffect(() => {
    if (!isLoading && session) {
      navigate(isOnboarded ? '/' : '/onboarding', { replace: true })
    }
  }, [isLoading, session, isOnboarded, navigate])

  function switchMode(next: Mode) {
    setMode(next)
    setPassword('')
    setConfirmPassword('')
  }

  function validate(): boolean {
    if (!EMAIL_RE.test(email)) {
      toast.error('Enter a valid email address')
      return false
    }
    if (mode === 'forgot') return true
    if (password.length < 6) {
      toast.error('Password needs to be at least 6 characters')
      return false
    }
    if (mode === 'signup' && password !== confirmPassword) {
      toast.error("Those passwords don't match — try again")
      return false
    }
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password)
      } else if (mode === 'signup') {
        const { needsEmailConfirmation } = await signUpWithPassword(email, password)
        if (needsEmailConfirmation) {
          setConfirmationSent(true)
          toast.success('Check your email to confirm your account')
        }
      } else {
        await resetPasswordForEmail(email)
        toast.success("If that email is registered, we've sent a reset link")
        switchMode('signin')
      }
    } catch (err) {
      toast.error(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="text-center mb-10">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl gradient-berry shadow-[0_14px_30px_-10px_rgba(124,92,255,0.5)] mb-6">
          <span className="text-4xl">🥗</span>
        </div>
        <h1 className="font-display text-5xl text-foreground mb-2">BiteRight</h1>
        <p className="text-muted-foreground text-base">Your meals, your pace, your progress</p>
      </div>

      {confirmationSent ? (
        <Card className="w-full max-w-sm text-center space-y-4">
          <p className="text-foreground">
            Check your inbox — we sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account.
          </p>
          <Button
            variant="secondary"
            className="w-full"
            disabled={resending}
            onClick={async () => {
              setResending(true)
              try {
                await resendConfirmationEmail(email)
                toast.success('Confirmation email sent again')
              } catch (err) {
                toast.error(friendlyAuthError(err))
              } finally {
                setResending(false)
              }
            }}
          >
            {resending ? 'Sending…' : "Didn't get it? Resend email"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setConfirmationSent(false)
              switchMode('signin')
            }}
          >
            Back to sign in
          </Button>
        </Card>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
            <h2 className="font-display text-xl text-foreground text-center">
              {mode === 'signin' && 'Welcome back'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
            </h2>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={inputClass}
              autoFocus
              autoComplete="email"
            />

            {mode !== 'forgot' && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={inputClass}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            )}

            {mode === 'signup' && (
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className={inputClass}
                autoComplete="new-password"
              />
            )}

            {mode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button variant="gradient" size="lg" className="w-full" disabled={loading} type="submit">
              {loading
                ? 'Please wait…'
                : mode === 'signin'
                ? 'Sign in'
                : mode === 'signup'
                ? 'Create account'
                : 'Send reset link'}
            </Button>

            {mode === 'forgot' ? (
              <Button variant="ghost" className="w-full" type="button" onClick={() => switchMode('signin')}>
                Back to sign in
              </Button>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                  className="font-semibold text-primary"
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            )}
          </form>

          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 w-full max-w-sm my-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="w-full max-w-sm">
                <button
                  onClick={signInWithGoogle}
                  className="w-full flex items-center justify-center gap-3 rounded-2xl px-6 py-3.5 text-base font-semibold bg-card border border-border shadow-[0_4px_30px_-12px_rgba(108,92,231,0.15)] text-foreground transition-all active:scale-[0.98] hover:border-primary/30"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>
              </div>
            </>
          )}

          <p className="mt-8 text-xs text-muted-foreground text-center max-w-xs">
            Track your nutrition with photo-powered meal analysis. Built for real daily use.
          </p>
        </>
      )}
    </div>
  )
}
