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
  mockStreamHealthMessage,
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
  mockStreamHealthMessage: vi.fn(),
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
  getLogsForDateRange: vi.fn().mockResolvedValue([]),
  searchLogsByFieldText: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/ai/gemini', () => ({
  processHealthMessage: vi.fn(),
  streamHealthMessage: mockStreamHealthMessage,
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

vi.mock('@/lib/db/routines', () => ({
  getRoutine: mockFetchRoutine,
}))

vi.mock('@/lib/ai/actions', () => ({
  sanitizeFields: vi.fn((fields) => fields),
  parseActionCards: vi.fn(() => []),
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
  active_routine_id: null,
  current_step_index: 0,
  active_agent_id: null,
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

// Helper: read all SSE events from a ReadableStream
async function readSSEStream(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const events: string[] = []
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        events.push(line.slice(6))
      }
    }
  }

  return events
}

// Helper: async generator producing chunks
async function* makeChunkGenerator(chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk
  }
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

  // Default streaming mock
  mockStreamHealthMessage.mockImplementation(() =>
    makeChunkGenerator(['Got it!'])
  )
})

// ---------------------------------------------------------------------------
// TEST SUITE: Day Session State Behavior
// ---------------------------------------------------------------------------

describe('Day Session State — Active Session Continuity', () => {
  // =========================================================================
  // Sessions persist across dates (no auto-close)
  // The route intentionally keeps sessions active until explicit end.
  // =========================================================================

  describe('Active session persists across physical date changes', () => {
    it('keeps session active when physical date differs from session date', async () => {
      // The route does NOT auto-close — sessions stay active until explicitly ended.
      const activeDayState: UserDayState = {
        id: 'day-state-1',
        user_id: FAKE_USER.id,
        date: '2026-03-30', // Session date
        day_started_at: '2026-03-30T07:00:00Z',
        day_ended_at: null,
      }

      mockGetActiveDayState.mockResolvedValue(activeDayState)

      // Message sent the next day — session should remain active
      const res = await POST(
        makeRequest({
          message: 'Good morning, logging for today',
          date: '2026-03-31',
        })
      )

      await readSSEStream(res.body!)

      expect(res.status).toBe(200)

      // markDayEnded must NOT be called (no auto-close)
      expect(mockMarkDayEnded).not.toHaveBeenCalled()

      // Session stays active → daySessionActive = true
      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          daySessionActive: true,
        })
      )
    })

    it('uses session date as loggingDate when active session spans physical date', async () => {
      // When a session is active, the session's date is the authoritative logging date.
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
          message: 'Checking in',
          date: '2026-03-31', // Physical date is later
        })
      )

      await readSSEStream(res.body!)

      expect(res.status).toBe(200)

      // loggingDate = session date (2026-03-28), not physical date
      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-03-28',
          daySessionActive: true,
        })
      )
    })

    it('uses physical date when no active session exists', async () => {
      // No active session → falls back to physical date
      mockGetActiveDayState.mockResolvedValue(null)

      const res = await POST(
        makeRequest({
          message: 'Hello on March 31',
          date: '2026-03-31',
        })
      )

      await readSSEStream(res.body!)

      expect(res.status).toBe(200)

      // loggingDate = physical date when no session is active
      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-03-31',
          daySessionActive: false,
        })
      )
    })
  })

  // =========================================================================
  // TC-V27-02: Auth failure
  // =========================================================================

  describe('Auth Failure', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

      const res = await POST(
        makeRequest({
          message: 'Hello',
          date: '2026-03-31',
        })
      )

      expect(res.status).toBe(401)
      const body = await res.json() as { error: string }
      expect(body.error).toBe('Unauthorized')

      // Verify markDayEnded is never called without auth
      expect(mockMarkDayEnded).not.toHaveBeenCalled()
    })

    it('does not affect another user\'s session (RLS enforced)', async () => {
      // getActiveDayState returns null for User B (RLS filters User A's data)
      mockGetActiveDayState.mockResolvedValue(null)
      setAuthenticatedUser('user-b-id')

      const res = await POST(
        makeRequest({
          message: 'User B sending message',
          date: '2026-03-31',
        })
      )

      await readSSEStream(res.body!)

      expect(res.status).toBe(200)
      expect(mockMarkDayEnded).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // TC-V27-03: Boundary — same date, session remains active
  // =========================================================================

  describe('Boundary Condition — Same date keeps session active', () => {
    it('session stays active when session date equals physical date', async () => {
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
          date: '2026-03-30',
        })
      )

      await readSSEStream(res.body!)

      expect(res.status).toBe(200)
      expect(mockMarkDayEnded).not.toHaveBeenCalled()

      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          daySessionActive: true,
        })
      )
    })

    it('session stays active even when physical date is before session date', async () => {
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
          date: '2026-03-29',
        })
      )

      await readSSEStream(res.body!)

      expect(res.status).toBe(200)
      expect(mockMarkDayEnded).not.toHaveBeenCalled()

      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          daySessionActive: true,
        })
      )
    })
  })

  // =========================================================================
  // TC-V27-04: Multi-session isolation
  // =========================================================================

  describe('Multi-session isolation', () => {
    it('consecutive messages in same session all see the same active state', async () => {
      const activeDayState: UserDayState = {
        id: 'day-state-1',
        user_id: FAKE_USER.id,
        date: '2026-03-29',
        day_started_at: '2026-03-29T07:00:00Z',
        day_ended_at: null,
      }

      mockGetActiveDayState.mockResolvedValue(activeDayState)

      // Message 1
      const res1 = await POST(
        makeRequest({
          message: 'First message',
          date: '2026-03-31',
          sessionId: FAKE_SESSION.id,
        })
      )

      await readSSEStream(res1.body!)
      expect(res1.status).toBe(200)
      expect(mockMarkDayEnded).not.toHaveBeenCalled()

      // Message 2 — same session, same active day state
      const res2 = await POST(
        makeRequest({
          message: 'I slept 8 hours',
          date: '2026-03-31',
          sessionId: FAKE_SESSION.id,
        })
      )

      await readSSEStream(res2.body!)
      expect(res2.status).toBe(200)
      expect(mockMarkDayEnded).not.toHaveBeenCalled()

      // Both messages should have seen daySessionActive = true
      expect(mockBuildHealthSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          daySessionActive: true,
        })
      )
    })
  })
})
