import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// vi.hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetSafeUser,
  mockCreateServerClient,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetSafeUser: vi.fn(),
  mockCreateServerClient: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

// Mock next/cache revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock('@/lib/supabase/auth', () => ({
  getSafeUser: mockGetSafeUser,
}))

// Supabase update chain mock — reusable across tests
let mockUpdateChain: {
  from: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  error: null | { message: string }
}

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: mockCreateServerClient,
}))

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { resetEndDayStateAction } from '@/app/actions/day-state'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FAKE_USER = { id: 'user-reset-test', email: 'reset@test.example' }

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()

  // Default: authenticated user
  mockGetSafeUser.mockResolvedValue(FAKE_USER)

  // Build a chainable Supabase mock that returns { error: null } by default
  const eqFinal = vi.fn().mockResolvedValue({ error: null })
  const eqMid = vi.fn().mockReturnValue({ eq: eqFinal })
  const updateMock = vi.fn().mockReturnValue({ eq: eqMid })
  const fromMock = vi.fn().mockReturnValue({ update: updateMock })

  mockCreateServerClient.mockResolvedValue({
    from: fromMock,
  })

  mockUpdateChain = {
    from: fromMock,
    update: updateMock,
    eq: eqMid,
    error: null,
  }
})

// ---------------------------------------------------------------------------
// resetEndDayStateAction tests
// ---------------------------------------------------------------------------

describe('resetEndDayStateAction', () => {
  // =========================================================================
  // Happy path
  // =========================================================================

  describe('Happy path', () => {
    it('nulls only day_ended_at — day_started_at is untouched', async () => {
      const result = await resetEndDayStateAction()

      expect(result).toEqual({})

      // Verify the update only touches day_ended_at
      expect(mockUpdateChain.update).toHaveBeenCalledWith({ day_ended_at: null })
      // Does NOT include day_started_at in the update payload
      expect(mockUpdateChain.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ day_started_at: null })
      )
    })

    it('calls revalidatePath("/dashboard") after successful update', async () => {
      await resetEndDayStateAction()

      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard')
    })

    it('returns empty object on success', async () => {
      const result = await resetEndDayStateAction()

      expect(result).toEqual({})
      expect(result.error).toBeUndefined()
    })

    it('filters update by user_id and today\'s date', async () => {
      await resetEndDayStateAction()

      // First .eq() filters by user_id
      expect(mockUpdateChain.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
      // Second .eq() filters by date (today, format YYYY-MM-DD)
      const eqFinal = (mockUpdateChain.eq as ReturnType<typeof vi.fn>).mock.results[0]?.value?.eq
      if (eqFinal) {
        const todayStr = new Date().toISOString().split('T')[0]
        expect(eqFinal).toHaveBeenCalledWith('date', todayStr)
      }
    })
  })

  // =========================================================================
  // Auth failure
  // =========================================================================

  describe('Auth failure', () => {
    it('returns error when user is not authenticated', async () => {
      mockGetSafeUser.mockResolvedValue(null)

      const result = await resetEndDayStateAction()

      expect(result).toEqual({ error: 'Unauthorized' })
    })

    it('does not call supabase update when unauthenticated', async () => {
      mockGetSafeUser.mockResolvedValue(null)

      await resetEndDayStateAction()

      expect(mockUpdateChain.update).not.toHaveBeenCalled()
    })

    it('does not call revalidatePath when unauthenticated', async () => {
      mockGetSafeUser.mockResolvedValue(null)

      await resetEndDayStateAction()

      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // DB error handling
  // =========================================================================

  describe('DB error handling', () => {
    it('returns error when supabase update returns an error', async () => {
      // Override the chain to return a DB error
      const eqFinal = vi.fn().mockResolvedValue({ error: { message: 'DB write failed' } })
      const eqMid = vi.fn().mockReturnValue({ eq: eqFinal })
      const updateMock = vi.fn().mockReturnValue({ eq: eqMid })
      const fromMock = vi.fn().mockReturnValue({ update: updateMock })

      mockCreateServerClient.mockResolvedValue({ from: fromMock })

      const result = await resetEndDayStateAction()

      expect(result).toEqual({ error: 'DB write failed' })
    })

    it('returns error when createServerClient throws', async () => {
      mockCreateServerClient.mockRejectedValue(new Error('Connection refused'))

      const result = await resetEndDayStateAction()

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Connection refused')
    })

    it('does not expose stack traces in error message', async () => {
      mockCreateServerClient.mockRejectedValue(new Error('Secret DB credentials'))

      const result = await resetEndDayStateAction()

      // Should return the error message, but not raw stack trace
      expect(result.error).toBe('Secret DB credentials')
    })
  })
})
