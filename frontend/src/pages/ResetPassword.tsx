import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'

const inputClass =
  'w-full px-4 py-3 border border-border rounded-2xl bg-input focus:outline-none focus:border-primary'

export default function ResetPassword() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const updatePassword = useAuthStore((s) => s.updatePassword)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error('Password needs to be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Those passwords don't match — try again")
      return
    }
    setLoading(true)
    try {
      await updatePassword(newPassword)
      toast.success("Password updated — you're all set")
      navigate('/')
    } catch {
      toast.error('Something went wrong — give it another try')
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
      </div>

      {session ? (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <h2 className="font-display text-xl text-foreground text-center">Set a new password</h2>

          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className={inputClass}
            autoFocus
            autoComplete="new-password"
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className={inputClass}
            autoComplete="new-password"
          />

          <Button variant="gradient" size="lg" className="w-full" disabled={loading} type="submit">
            {loading ? 'Please wait…' : 'Update password'}
          </Button>
        </form>
      ) : (
        <Card className="w-full max-w-sm text-center space-y-4">
          <p className="text-foreground">This reset link is invalid or has expired — request a new one.</p>
          <Button variant="gradient" className="w-full" onClick={() => navigate('/login')}>
            Back to sign in
          </Button>
        </Card>
      )}
    </div>
  )
}
