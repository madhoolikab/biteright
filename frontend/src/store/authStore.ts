import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import api from '../api/client'

interface AuthState {
  session: Session | null
  user: User | null
  isLoading: boolean
  isOnboarded: boolean
  initialize: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>
  resendConfirmationEmail: (email: string) => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  signOut: () => Promise<void>
  setOnboarded: (value: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  isOnboarded: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    set({ session, user: session?.user ?? null })

    if (session) {
      try {
        const { data } = await api.get('/profile/')
        set({ isOnboarded: data.onboarding_completed })
      } catch {
        set({ isOnboarded: false })
      }
    }

    set({ isLoading: false })

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null })
    })
  },

  signInWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  },

  signInWithPassword: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  },

  signUpWithPassword: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    // Supabase returns a fake "new user" (empty identities) instead of an error
    // when the email is already registered under another provider, to avoid
    // leaking which emails exist. No confirmation email is actually sent.
    // To make it explicit to the user we show that info on the register page and ask user to login with Google.
    if (data.user && data.user.identities?.length === 0) {
      throw new Error('ACCOUNT_EXISTS_OTHER_PROVIDER')
    }
    return { needsEmailConfirmation: !data.session }
  },

  resendConfirmationEmail: async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) throw error
  },

  resetPasswordForEmail: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, isOnboarded: false })
  },

  setOnboarded: (value) => set({ isOnboarded: value }),
}))
