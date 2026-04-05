import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ActionCard } from '@/types/action-card'

// Must be hoisted before vi.mock (vi.mock gets hoisted during AST transform)
const {
  mockSupabaseInsert,
  mockSupabaseSelect,
  mockSupabaseEq,
  mockSupabaseUpdate,
  mockSupabaseSingle,
  mockFrom,
  mockGetUser,
  mockCreateServerClient,
} = vi.hoisted(() => ({
  mockSupabaseInsert: vi.fn(),
  mockSupabaseSelect: vi.fn(),
  mockSupabaseEq: vi.fn(),
  mockSupabaseUpdate: vi.fn(),
  mockSupabaseSingle: vi.fn(),
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockCreateServerClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: mockCreateServerClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { confirmLogAction } from '@/app/actions/chat'

describe('Action Card Date Logging (V27-P0-E)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.log = vi.fn()

    mockSupabaseSingle.mockResolvedValue({ data: null, error: null })
    mockSupabaseEq.mockReturnValue({
      single: mockSupabaseSingle,
      update: mockSupabaseUpdate,
    })
    mockSupabaseSelect.mockReturnValue({
      eq: mockSupabaseEq,
      single: mockSupabaseSingle,
    })
    mockSupabaseInsert.mockReturnValue({
      select: mockSupabaseSelect,
    })
    mockFrom.mockReturnValue({
      insert: mockSupabaseInsert,
      select: mockSupabaseSelect,
      update: mockSupabaseUpdate,
    })

    mockCreateServerClient.mockResolvedValue({
      from: mockFrom,
      auth: {
        getUser: mockGetUser,
      },
    })

    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // TEST 1: Happy Path
  it('Happy Path: Action card logged with correct date (2026-03-30)', async () => {
    const card: ActionCard = {
      type: 'LOG_DATA',
      trackerId: 'tracker-123',
      trackerName: 'Food Log',
      fields: { fld_calories: 350, fld_food: 'chicken' },
      date: '2026-03-30',
      source: 'chat',
    }

    mockSupabaseInsert.mockReturnValue({
      select: mockSupabaseSelect,
    })
    mockSupabaseSelect.mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
    })

    const result = await confirmLogAction(card)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tracker_id: 'tracker-123',
        user_id: 'test-user-id',
        fields: { fld_calories: 350, fld_food: 'chicken' },
        source: 'chat',
      })
    )

    const insertCall = mockSupabaseInsert.mock.calls[0][0]
    expect(insertCall.logged_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(insertCall.logged_at).not.toContain('2026-03-04')
  })

  // TEST 2: Date Validation
  it('Date Validation: Invalid formats rejected (03-30-2026)', async () => {
    const card: ActionCard = {
      type: 'LOG_DATA',
      trackerId: 'tracker-123',
      trackerName: 'Food Log',
      fields: { fld_calories: 350 },
      date: '03-30-2026',
      source: 'chat',
    }

    const result = await confirmLogAction(card)

    expect(result.error).toBeDefined()
    expect(result.error).toContain('Invalid date format')
    expect(result.success).toBeUndefined()
    expect(mockSupabaseInsert).not.toHaveBeenCalled()
  })

  // TEST 3: Empty Date Handling
  it('Empty/Undefined Date: Empty string rejected by format validation', async () => {
    const card: ActionCard = {
      type: 'LOG_DATA',
      trackerId: 'tracker-123',
      trackerName: 'Food Log',
      fields: { fld_calories: 350 },
      date: '',
      source: 'chat',
    }

    const result = await confirmLogAction(card)

    expect(result.error).toBeDefined()
    expect(result.error).toContain('Invalid date format')
    expect(result.success).toBeUndefined()
    expect(mockSupabaseInsert).not.toHaveBeenCalled()
  })

  // TEST 4: Date Consistency
  it('Date Consistency: logDateStr validated once, used consistently', async () => {
    const card: ActionCard = {
      type: 'LOG_DATA',
      trackerId: 'tracker-123',
      trackerName: 'Sleep Log',
      fields: { fld_hours: 8 },
      date: '2026-03-25',
      source: 'chat',
    }

    mockSupabaseInsert.mockReturnValue({
      select: mockSupabaseSelect,
    })
    mockSupabaseSelect.mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
    })

    const result = await confirmLogAction(card)

    expect(result.success).toBe(true)

    const insertCall = mockSupabaseInsert.mock.calls[0][0]
    expect(insertCall.logged_at).toMatch(/^2026-03-25T/)
  })

  // TEST 5: Debug Console Output
  it('Debug Console Output: Full tracing with date, loggedAt, tracker ID', async () => {
    const card: ActionCard = {
      type: 'LOG_DATA',
      trackerId: 'tracker-workout-001',
      trackerName: 'Workout Log',
      fields: { fld_distance: 5.2, fld_duration: 45 },
      date: '2026-03-28',
      source: 'chat',
    }

    mockSupabaseInsert.mockReturnValue({
      select: mockSupabaseSelect,
    })
    mockSupabaseSelect.mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
    })

    const result = await confirmLogAction(card)

    expect(result.success).toBe(true)

    // Check that console.log was called with the correct arguments
    // Format: console.log('[confirmLogAction] Logging to date:', logDateStr, '— loggedAt:', loggedAt, '— tracker:', card.trackerId)
    const consoleCalls = (console.log as unknown as { mock: { calls: Array<unknown[]> } }).mock.calls
    const debugCall = (consoleCalls as Array<unknown[]>).find((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('[confirmLogAction] Logging to date:')
    ) as unknown[]

    expect(debugCall).toBeDefined()
    expect(debugCall[0]).toBe('[confirmLogAction] Logging to date:')
    expect(debugCall[1]).toBe('2026-03-28')
    expect(debugCall[2]).toBe('— loggedAt:')
    expect(debugCall[3]).toMatch(/^\d{4}-\d{2}-\d{2}T/) // ISO timestamp
    expect(debugCall[4]).toBe('— tracker:')
    expect(debugCall[5]).toBe('tracker-workout-001')
  })

  // BONUS: Regression test for March 4 bug
  it('Regression: Logged date is NOT March 4 mismatch bug', async () => {
    const card: ActionCard = {
      type: 'LOG_DATA',
      trackerId: 'tracker-123',
      trackerName: 'Daily Log',
      fields: { fld_value: 100 },
      date: '2026-03-27',
      source: 'chat',
    }

    mockSupabaseInsert.mockReturnValue({
      select: mockSupabaseSelect,
    })
    mockSupabaseSelect.mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
    })

    await confirmLogAction(card)

    const insertCall = mockSupabaseInsert.mock.calls[0][0]
    const loggedAt = insertCall.logged_at

    expect(loggedAt).not.toContain('2026-03-04')
    expect(loggedAt).toContain('2026-03-27')
  })

  // BONUS: Multiple logs same day allowed
  it('Multiple logs same day should be allowed', async () => {
    const card1: ActionCard = {
      type: 'LOG_DATA',
      trackerId: 'tracker-nutrition',
      trackerName: 'Food Log',
      fields: { fld_calories: 500 },
      date: '2026-03-30',
      source: 'chat',
    }

    const card2: ActionCard = {
      type: 'LOG_DATA',
      trackerId: 'tracker-nutrition',
      trackerName: 'Food Log',
      fields: { fld_calories: 600 },
      date: '2026-03-30',
      source: 'chat',
    }

    mockSupabaseInsert.mockReturnValue({
      select: mockSupabaseSelect,
    })
    mockSupabaseSelect.mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
    })

    const result1 = await confirmLogAction(card1)
    const result2 = await confirmLogAction(card2)

    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
    expect(mockSupabaseInsert).toHaveBeenCalledTimes(2)
  })
})
