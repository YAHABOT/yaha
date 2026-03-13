'use client' // Needed: form state management, tab switching, error display

import { useState } from 'react'
import { signIn, signUp } from '@/app/actions/auth'

type AuthMode = 'signin' | 'signup'

export function LoginForm(): React.ReactElement {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

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
    </div>
  )
}
