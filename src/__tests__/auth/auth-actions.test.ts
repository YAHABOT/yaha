import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock next/navigation — redirect throws to halt execution, matching Next.js behavior
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

describe('Auth Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('signIn', () => {
    it('returns error when email is missing', async () => {
      const { signIn } = await import('@/app/actions/auth')
      const formData = new FormData()
      formData.set('email', '')
      formData.set('password', 'test123')

      const result = await signIn(formData)
      expect(result).toEqual({ error: 'Email and password are required' })
    })

    it('returns error when password is missing', async () => {
      const { signIn } = await import('@/app/actions/auth')
      const formData = new FormData()
      formData.set('email', 'test@example.com')
      formData.set('password', '')

      const result = await signIn(formData)
      expect(result).toEqual({ error: 'Email and password are required' })
    })

    it('returns error on invalid credentials', async () => {
      const { createServerClient } = await import('@/lib/supabase/server')
      const mockSignInWithPassword = vi.fn().mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      })
      vi.mocked(createServerClient).mockResolvedValue({
        auth: { signInWithPassword: mockSignInWithPassword },
      } as never)

      const { signIn } = await import('@/app/actions/auth')
      const formData = new FormData()
      formData.set('email', 'test@example.com')
      formData.set('password', 'wrong-password')

      const result = await signIn(formData)
      expect(result).toEqual({ error: 'Invalid login credentials' })
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'wrong-password',
      })
    })

    it('redirects to dashboard on successful sign in', async () => {
      const { createServerClient } = await import('@/lib/supabase/server')
      const { redirect } = await import('next/navigation')
      const mockSignInWithPassword = vi.fn().mockResolvedValue({
        error: null,
      })
      vi.mocked(createServerClient).mockResolvedValue({
        auth: { signInWithPassword: mockSignInWithPassword },
      } as never)

      const { signIn } = await import('@/app/actions/auth')
      const formData = new FormData()
      formData.set('email', 'test@example.com')
      formData.set('password', 'correct-password')

      await expect(signIn(formData)).rejects.toThrow('REDIRECT:/dashboard')
      expect(redirect).toHaveBeenCalledWith('/dashboard')
    })
  })

  describe('signUp', () => {
    it('returns error when email is missing', async () => {
      const { signUp } = await import('@/app/actions/auth')
      const formData = new FormData()
      formData.set('email', '')
      formData.set('password', 'test123')

      const result = await signUp(formData)
      expect(result).toEqual({ error: 'Email and password are required' })
    })

    it('returns error when password is too short', async () => {
      const { signUp } = await import('@/app/actions/auth')
      const formData = new FormData()
      formData.set('email', 'test@example.com')
      formData.set('password', '12345')

      const result = await signUp(formData)
      expect(result).toEqual({
        error: 'Password must be at least 6 characters',
      })
    })

    it('returns error from Supabase on signup failure', async () => {
      const { createServerClient } = await import('@/lib/supabase/server')
      const mockSignUp = vi.fn().mockResolvedValue({
        error: { message: 'User already registered' },
      })
      vi.mocked(createServerClient).mockResolvedValue({
        auth: { signUp: mockSignUp },
      } as never)

      const { signUp } = await import('@/app/actions/auth')
      const formData = new FormData()
      formData.set('email', 'existing@example.com')
      formData.set('password', 'password123')

      const result = await signUp(formData)
      expect(result).toEqual({ error: 'User already registered' })
    })

    it('redirects to dashboard on successful sign up', async () => {
      const { createServerClient } = await import('@/lib/supabase/server')
      const { redirect } = await import('next/navigation')
      const mockSignUp = vi.fn().mockResolvedValue({
        error: null,
      })
      vi.mocked(createServerClient).mockResolvedValue({
        auth: { signUp: mockSignUp },
      } as never)

      const { signUp } = await import('@/app/actions/auth')
      const formData = new FormData()
      formData.set('email', 'new@example.com')
      formData.set('password', 'password123')

      await expect(signUp(formData)).rejects.toThrow('REDIRECT:/dashboard')
      expect(redirect).toHaveBeenCalledWith('/dashboard')
    })
  })

  describe('signOut', () => {
    it('signs out and redirects to login', async () => {
      const { createServerClient } = await import('@/lib/supabase/server')
      const { redirect } = await import('next/navigation')
      const mockSignOut = vi.fn().mockResolvedValue({ error: null })
      vi.mocked(createServerClient).mockResolvedValue({
        auth: { signOut: mockSignOut },
      } as never)

      const { signOut } = await import('@/app/actions/auth')

      await expect(signOut()).rejects.toThrow('REDIRECT:/login')
      expect(mockSignOut).toHaveBeenCalled()
      expect(redirect).toHaveBeenCalledWith('/login')
    })
  })
})
