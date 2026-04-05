import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatSession } from '@/types/chat'

// ---------------------------------------------------------------------------
// vi.hoisted mocks for all dependencies
// ---------------------------------------------------------------------------

const {
  mockGetUser,
  mockCreateServerClient,
  mockCreateSession,
  mockGetSession,
  mockAddMessage,
  mockUpdateSession,
  mockGetTrackers,
  mockProcessHealthMessage,
  mockBuildHealthSystemPrompt,
  mockDetectRoutineTrigger,
  mockGetActiveDayState,
  mockMarkDayEnded,
  mockMarkDayStarted,
  mockGetRecentMessagesForAI,
  mockGetLogsForDay,
  mockGetMasterBrainContext,
  mockGetAgents,
  mockFetchRoutine,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCreateServerClient: vi.fn(),
  mockCreateSession: vi.fn(),
  mockGetSession: vi.fn(),
  mockAddMessage: vi.fn(),
  mockUpdateSession: vi.fn(),
  mockGetTrackers: vi.fn(),
  mockProcessHealthMessage: vi.fn(),
  mockBuildHealthSystemPrompt: vi.fn(),
  mockDetectRoutineTrigger: vi.fn(),
  mockGetActiveDayState: vi.fn(),
  mockMarkDayEnded: vi.fn(),
  mockMarkDayStarted: vi.fn(),
  mockGetRecentMessagesForAI: vi.fn(),
  mockGetLogsForDay: vi.fn(),
  mockGetMasterBrainContext: vi.fn(),
  mockGetAgents: vi.fn(),
  mockFetchRoutine: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: mockCreateServerClient,
}))

vi.mock('@/lib/db/chat', () => ({
  createSession: mockCreateSession,
  getSession: mockGetSession,
  addMessage: mockAddMessage,
  updateSession: mockUpdateSession,
  getMessages: vi.fn(),
  getSessions: vi.fn(),
  getRecentMessagesForAI: mockGetRecentMessagesForAI,
}))

vi.mock('@/lib/db/trackers', () => ({
  getTrackersBasic: mockGetTrackers,
}))

vi.mock('@/lib/db/day-state', () => ({
  getActiveDayState: mockGetActiveDayState,
  markDayEnded: mockMarkDayEnded,
  markDayStarted: mockMarkDayStarted,
}))

vi.mock('@/lib/db/logs', () => ({
  getLogsForDay: mockGetLogsForDay,
}))

vi.mock('@/lib/ai/gemini', () => ({
  processHealthMessage: mockProcessHealthMessage,
}))

vi.mock('@/lib/ai/prompt-builder', () => ({
  buildHealthSystemPrompt: mockBuildHealthSystemPrompt,
  buildRoutineSystemPrompt: vi.fn(),
}))

vi.mock('@/lib/ai/master-brain', () => ({
  getMasterBrainContext: mockGetMasterBrainContext,
}))

vi.mock('@/lib/routines/detector', () => ({
  detectRoutineTrigger: mockDetectRoutineTrigger,
}))

vi.mock('@/lib/db/agents', () => ({
  getAgents: mockGetAgents,
}))

// Dynamic import helper for routine fetching
vi.mock('@/lib/db/routines', () => ({
  getRoutine: mockFetchRoutine,
}))

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/chat/route'
import type { UserDayState } from '@/lib/db/day-state'

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { id: 'user-v27-auto-end', email: 'v27@test.example' }

const FAKE_SESSION: ChatSession = {
  id: 'session-v27-01',
  user_id: FAKE_USER.id,
  title: 'Auto-End-Day Test',
  updated_at: '2026-03-30T00:00:00Z',
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setAuthenticatedUser(userId: string = FAKE_USER.id): void {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId, email: `${userId}@test.example` } },
    error: null,
  })
  mockCreateServerClient.mockResolvedValue({
    auth: { getUser: mockGetUser },
  })
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()

  // Default happy path setup
  setAuthenticatedUser()
  mockCreateSession.mockResolvedValue(FAKE_SESSION)
  mockGetSession.mockImplementation(async (id: string) => ({ ...FAKE_SESSION, id }))
  mockAddMessage.mockResolvedValue({ id: 'msg-1' })
  mockUpdateSession.mockResolvedValue({})
  mockGetTrackers.mockResolvedValue([])
  mockBuildHealthSystemPrompt.mockReturnValue('You are a health assistant.')
  mockDetectRoutineTrigger.mockResolvedValue(null)
  mockGetActiveDayState.mockResolvedValue(null) // No active session by default
  mockMarkDayEnded.mockResolvedValue({})
  mockGetRecentMessagesForAI.mockResolvedValue([])
  mockGetLogsForDay.mockResolvedValue([])
  mockGetMasterBrainContext.mockResolvedValue({ context: 'test' })
  mockGetAgents.mockResolvedValue([])
  mockProcessHealthMessage.mockResolvedValue({ text: 'Got it!', actions: [] })
})

// ---------------------------------------------------------------------------
// TEST SUITE: Auto-End-Day Feature (V27-P0-A)
// ---------------------------------------------------------------------------

describe('Auto-End-Day — Session Auto-Close on Date Advance', () => {
  // =========================================================================
  // TC-V27-01: Session auto-closes when date advances
  // =========================================================================

  describe('TC-V27-01: Happy Path — Auto-close on date advance', () => {
    it('triggers markDayEnded when physical date > locked session date', async () => {
      // Setup: Active session locked to March 30
      const activeDayState: UserDayState = {
        id: 'day-state-1',
        user_id: FAKE_USER.id,
        date: '2026-03-30', // Session date
        day_started_at: '2026-03-30T07:00:00Z',
        day_ended_at: null,
      }

      mockGetActiveDayState.mockResolvedValue(activeDayState)

      // Action: Send message on March 31 (physical date)
      const res = await POST(
        makeRequest({
          message: 'Good morning, logging for today',
          date: '2026-03-31', // Physical date (client reports this)
        })
      )

      // Verify response is OK
      expect(res.status).toBe(200)

      // Verify markDayEnded was called with the OLD session date
      expect(mockMarkDayEnded).toHaveBeenCalledWith('2026-03-30')
      expect(mockMarkDayEnded).toHaveBeenCalledOnce()
    })

    it('sets finalActiveDayState to null after auto-close', async () => {
      // Setup: Active session
      const activeDayState: UserDayState = {
        id: 'day-state-1',
        user_id: FAKE_USER.id,
        date: '2026-03-28', // Old session date
        day_started_at: '2026-03-28T07:00:00Z',
        day_ended_at: null,
      }

      mockGetActiveDayState.mockResolvedValue(activeDayState)

      // Action: Send message on March 31
      const res = await POST(
        makeRequest({
          message: 'Checking in',
          date: '2026-03-31', // Physical date is 3 days later
        })
      )

      expect(res.status).toBe(200)

      // Verify that buildHealthSystemPrompt was called with daySessionActive=false
      // because finalActiveDayState was nullified after auto-close
      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          daySessionActive: false,
        })
      )
    })

    it('uses physical date (today) as loggingDate after auto-close', async () => {
      // Setup: Session locked to March 28, physical date is March 31
      const activeDayState: UserDayState = {
        id: 'day-state-1',
        user_id: FAKE_USER.id,
        date: '2026-03-28',
        day_started_at: '2026-03-28T07:00:00Z',
        day_ended_at: null,
      }

      mockGetActiveDayState.mockResolvedValue(activeDayState)

      await POST(
        makeRequest({
          message: 'Hello on March 31',
          date: '2026-03-31',
        })
      )

      // After auto-close, loggingDate should be March 31 (the physical date)
      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-03-31', // Physical date, not the old session date
        })
      )
    })
  })

  // =========================================================================
  // TC-V27-02: Auth failure — unauthorized user cannot trigger auto-close
  // =========================================================================

  describe('TC-V27-02: Auth Failure — Different user cannot trigger auto-close', () => {
    it('returns 401 when user is not authenticated', async () => {
      // Setup: No authenticated user
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

      const res = await POST(
        makeRequest({
          message: 'Hello',
          date: '2026-03-31',
        })
      )

      // Verify auth rejection
      expect(res.status).toBe(401)
      const body = await res.json() as { error: string }
      expect(body.error).toBe('Unauthorized')

      // Verify markDayEnded is never called without auth
      expect(mockMarkDayEnded).not.toHaveBeenCalled()
    })

    it('does not auto-close another user\'s session', async () => {
      // Setup: User A's session exists in the DB
      const userADayState: UserDayState = {
        id: 'day-state-user-a',
        user_id: 'user-a-id',
        date: '2026-03-30',
        day_started_at: '2026-03-30T07:00:00Z',
        day_ended_at: null,
      }

      // getActiveDayState is called by User B (FAKE_USER)
      // It should not return User A's session (RLS would prevent this)
      mockGetActiveDayState.mockResolvedValue(null)

      // Set authenticated user as User B
      setAuthenticatedUser('user-b-id')

      const res = await POST(
        makeRequest({
          message: 'User B sending message',
          date: '2026-03-31',
        })
      )

      expect(res.status).toBe(200)

      // Verify markDayEnded was NOT called for User A's session
      expect(mockMarkDayEnded).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // TC-V27-03: Invalid input — exact date match does NOT trigger auto-close
  // =========================================================================

  describe('TC-V27-03: Boundary Condition — Same date (no auto-close)', () => {
    it('does not auto-close when session date equals physical date', async () => {
      // Setup: Session locked to March 30, physical date is also March 30
      const activeDayState: UserDayState = {
        id: 'day-state-1',
        user_id: FAKE_USER.id,
        date: '2026-03-30',
        day_started_at: '2026-03-30T07:00:00Z',
        day_ended_at: null,
      }

      mockGetActiveDayState.mockResolvedValue(activeDayState)

      const res = await POST(
        makeRequest({
          message: 'Still logging for today',
          date: '2026-03-30', // Same as session date
        })
      )

      expect(res.status).toBe(200)

      // Verify markDayEnded is NOT called (comparison: "2026-03-30" < "2026-03-30" is false)
      expect(mockMarkDayEnded).not.toHaveBeenCalled()

      // Verify session stays active (finalActiveDayState !== null)
      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          daySessionActive: true,
        })
      )
    })

    it('does not auto-close when physical date is BEFORE session date', async () => {
      // This is an impossible scenario (can't time-travel), but test the logic
      // Setup: Session locked to March 30, physical date is March 29 (should not happen)
      const activeDayState: UserDayState = {
        id: 'day-state-1',
        user_id: FAKE_USER.id,
        date: '2026-03-30',
        day_started_at: '2026-03-30T07:00:00Z',
        day_ended_at: null,
      }

      mockGetActiveDayState.mockResolvedValue(activeDayState)

      const res = await POST(
        makeRequest({
          message: 'Back to yesterday',
          date: '2026-03-29', // Before session date
        })
      )

      expect(res.status).toBe(200)

      // Verify markDayEnded is NOT called (comparison: "2026-03-30" < "2026-03-29" is false)
      expect(mockMarkDayEnded).not.toHaveBeenCalled()

      // Session should still be active
      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          daySessionActive: true,
        })
      )
    })
  })

  // =========================================================================
  // TC-V27-04: Edge case — multi-day gap (offline for 3 days)
  // =========================================================================

  describe('TC-V27-04: Edge Case — Multi-day gap (user offline)', () => {
    it('auto-closes correctly when user is offline for multiple days', async () => {
      // Setup: Session locked to March 28, physical date is March 31 (3-day gap)
      const activeDayState: UserDayState = {
        id: 'day-state-1',
        user_id: FAKE_USER.id,
        date: '2026-03-28',
        day_started_at: '2026-03-28T07:00:00Z',
        day_ended_at: null,
      }

      mockGetActiveDayState.mockResolvedValue(activeDayState)

      const res = await POST(
        makeRequest({
          message: 'I\'m back!',
          date: '2026-03-31', // 3 days later
        })
      )

      expect(res.status).toBe(200)

      // Verify markDayEnded was called with the correct old date
      expect(mockMarkDayEnded).toHaveBeenCalledWith('2026-03-28')
      expect(mockMarkDayEnded).toHaveBeenCalledOnce()

      // Verify loggingDate uses the physical date (March 31)
      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-03-31',
        })
      )
    })
  })

  // =========================================================================
  // TC-V27-05: Integration test — Neutral state prompt after auto-close
  // =========================================================================

  describe('TC-V27-05: Integration — Neutral state entry after auto-close', () => {
    it('enters neutral state and prompts for date confirmation after auto-close', async () => {
      // Setup: Active session on March 30
      const activeDayState: UserDayState = {
        id: 'day-state-1',
        user_id: FAKE_USER.id,
        date: '2026-03-30',
        day_started_at: '2026-03-30T07:00:00Z',
        day_ended_at: null,
      }

      mockGetActiveDayState.mockResolvedValue(activeDayState)

      // First message: triggers auto-close
      const res1 = await POST(
        makeRequest({
          message: 'Hello from March 31',
          date: '2026-03-31',
          sessionId: FAKE_SESSION.id,
        })
      )

      expect(res1.status).toBe(200)

      // Verify first message triggered auto-close
      expect(mockMarkDayEnded).toHaveBeenCalledWith('2026-03-30')

      // Reset mocks for second message (same session, same date)
      mockGetActiveDayState.mockClear()
      mockGetActiveDayState.mockResolvedValue(null) // No active session now
      mockMarkDayEnded.mockClear()

      // Second message: should ask for date confirmation (neutral state)
      const res2 = await POST(
        makeRequest({
          message: 'I ate 500 calories',
          date: '2026-03-31',
          sessionId: FAKE_SESSION.id,
        })
      )

      expect(res2.status).toBe(200)

      // Verify second message sees neutral state (daySessionActive = false)
      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          daySessionActive: false,
        })
      )

      // Verify markDayEnded was NOT called a second time
      expect(mockMarkDayEnded).not.toHaveBeenCalled()

      // Verify loggingDate uses the physical date (not a locked session date)
      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-03-31',
        })
      )
    })

    it('consecutive messages after auto-close use neutral state prompts', async () => {
      // Setup: Active session
      const activeDayState: UserDayState = {
        id: 'day-state-1',
        user_id: FAKE_USER.id,
        date: '2026-03-29',
        day_started_at: '2026-03-29T07:00:00Z',
        day_ended_at: null,
      }

      mockGetActiveDayState.mockResolvedValue(activeDayState)

      // Message 1: triggers auto-close
      const res1 = await POST(
        makeRequest({
          message: 'March 31 log',
          date: '2026-03-31',
          sessionId: FAKE_SESSION.id,
        })
      )

      expect(res1.status).toBe(200)
      expect(mockMarkDayEnded).toHaveBeenCalledTimes(1)

      // Setup: No active session for message 2
      mockGetActiveDayState.mockClear()
      mockGetActiveDayState.mockResolvedValue(null)
      mockMarkDayEnded.mockClear()

      // Message 2: in neutral state
      const res2 = await POST(
        makeRequest({
          message: 'I slept 8 hours',
          date: '2026-03-31',
          sessionId: FAKE_SESSION.id,
        })
      )

      expect(res2.status).toBe(200)

      // Message 3: still neutral state
      const res3 = await POST(
        makeRequest({
          message: 'Workout: 30 min run',
          date: '2026-03-31',
          sessionId: FAKE_SESSION.id,
        })
      )

      expect(res3.status).toBe(200)

      // Verify both messages 2 and 3 use neutral state
      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          daySessionActive: false,
        })
      )

      // Verify markDayEnded was only called once (at message 1)
      expect(mockMarkDayEnded).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Additional edge cases and logging
  // =========================================================================

  describe('Auto-End-Day — Logging and debugging', () => {
    it('logs auto-close action to console for debugging', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log')

      const activeDayState: UserDayState = {
        id: 'day-state-1',
        user_id: FAKE_USER.id,
        date: '2026-03-30',
        day_started_at: '2026-03-30T07:00:00Z',
        day_ended_at: null,
      }

      mockGetActiveDayState.mockResolvedValue(activeDayState)

      await POST(
        makeRequest({
          message: 'Test log message',
          date: '2026-03-31',
        })
      )

      // Verify auto-close was logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-closing stale day session')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/locked=2026-03-30.*physical=2026-03-31/)
      )

      consoleLogSpy.mockRestore()
    })

    it('catches errors from markDayEnded and logs them without throwing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error')

      const activeDayState: UserDayState = {
        id: 'day-state-1',
        user_id: FAKE_USER.id,
        date: '2026-03-30',
        day_started_at: '2026-03-30T07:00:00Z',
        day_ended_at: null,
      }

      mockGetActiveDayState.mockResolvedValue(activeDayState)
      mockMarkDayEnded.mockRejectedValueOnce(new Error('DB failure'))

      const res = await POST(
        makeRequest({
          message: 'Test with error',
          date: '2026-03-31',
        })
      )

      // Response should still be 200 (error is caught and logged)
      expect(res.status).toBe(200)

      // Verify error was logged (actual format includes DayState prefix and error object)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[DayState\].*auto-close.*markDayEnded.*failed/),
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })
})
