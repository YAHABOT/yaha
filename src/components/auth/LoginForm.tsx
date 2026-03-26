'use client' // Needed: form state management, tab switching, error display

import { useState } from 'react'
import { signIn, signUp } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'

type AuthMode = 'signin' | 'signup'

export function LoginForm(): React.ReactElement {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [googleLoading, setGoogleLoading] = useState<boolean>(false)

  async function handleGoogleSignIn(): Promise<void> {
    setGoogleLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setGoogleLoading(false)
    }
    // On success, browser is redirected to Google — no further action needed
  }

  async function handleSubmit(formData: FormData): Promise<void> {
    setError(null)
    setLoading(true)
    try {
      const action = mode === 'signin' ? signIn : signUp
      const result = await action(formData)
      if (result?.error) {
        setError(result.error)
      }
    } catch {
      // redirect() throws NEXT_REDIRECT, which is expected on success
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      {/* Tab toggle */}
      <div className="mb-6 flex rounded-lg border border-border bg-background p-1">
        <button
          type="button"
          onClick={() => {
            setMode('signin')
            setError(null)
          }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            mode === 'signin'
              ? 'bg-surfaceHighlight text-textPrimary'
              : 'text-textMuted hover:text-textPrimary'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signup')
            setError(null)
          }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            mode === 'signup'
              ? 'bg-surfaceHighlight text-textPrimary'
              : 'text-textMuted hover:text-textPrimary'
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Form */}
      <form action={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm text-textMuted"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-textPrimary placeholder-textMuted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm text-textMuted"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-textPrimary placeholder-textMuted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {loading
            ? 'Loading...'
            : mode === 'signin'
              ? 'Sign In'
              : 'Create Account'}
        </button>
      </form>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-textMuted">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="mt-4 flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background py-2.5 text-sm font-medium text-textPrimary transition-colors hover:bg-surfaceHighlight disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {googleLoading ? 'Redirecting...' : 'Continue with Google'}
      </button>
    </div>
  )
}
