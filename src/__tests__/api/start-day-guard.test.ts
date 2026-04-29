import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatSession, ChatMessage } from '@/types/chat'
import type { Routine } from '@/types/routine'

// ---------------------------------------------------------------------------
// vi.hoisted mocks for all dependencies
// ---------------------------------------------------------------------------

const {
  mockGetUser,
  mockGetSafeUser,
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
  mockMarkDayStarted,
  mockMarkDayEnded,
  mockGetRecentMessagesForAI,
  mockGetLogsForDay,
  mockGetMasterBrainContext,
  mockGetAgents,
  mockFetchRoutine,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetSafeUser: vi.fn(),
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
  mockMarkDayStarted: vi.fn(),
  mockMarkDayEnded: vi.fn(),
  mockGetRecentMessagesForAI: vi.fn(),
  mockGetLogsForDay: vi.fn(),
  mockGetMasterBrainContext: vi.fn(),
  mockGetAgents: vi.fn(),
  mockFetchRoutine: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: mockCreateServerClient,
}))

vi.mock('@/lib/supabase/auth', () => ({
  getSafeUser: mockGetSafeUser,
}))

vi.mock('@/lib/db/chat', () => ({
  createSession: mockCreateSession,
  getSession: mockGetSession,
  addMessage: mockAddMessage,
  updateSession: mockUpdateSession,
  getRecentMessagesForAI: mockGetRecentMessagesForAI,
}))

vi.mock('@/lib/db/trackers', () => ({
  getTrackersBasic: mockGetTrackers,
}))

vi.mock('@/lib/db/day-state', () => ({
  getActiveDayState: mockGetActiveDayState,
  markDayStarted: mockMarkDayStarted,
  markDayEnded: mockMarkDayEnded,
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
  buildRoutineSystemPrompt: () => 'You are YAHA executing a routine.',
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

const FAKE_USER = { id: 'user-start-day-guard', email: 'guard@test.example' }

const FAKE_SESSION: ChatSession = {
  id: 'session-start-day-01',
  user_id: FAKE_USER.id,
  title: 'Start Day Guard Test',
  updated_at: '2026-03-31T00:00:00Z',
  active_routine_id: null,
  current_step_index: 0,
  active_agent_id: null,
}

const FAKE_START_DAY_ROUTINE: Routine = {
  id: 'routine-start-day',
  user_id: FAKE_USER.id,
  name: 'Morning Check-In',
  trigger_phrase: 'start day',
  type: 'day_start',
  steps: [
    {
      trackerId: 'tracker-sleep',
      trackerName: 'Sleep',
      trackerColor: '#3b82f6',
      targetFields: ['fld_hours'],
    },
  ],
  created_at: '2026-03-31T00:00:00Z',
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

// Helper: async generator producing chunks
async function* makeChunkGenerator(chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk
  }
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()

  // Default happy path setup
  setAuthenticatedUser()
  mockGetSafeUser.mockResolvedValue(FAKE_USER)
  // Create a fresh copy of FAKE_SESSION for each test to prevent mutation carryover
  const freshSession = { ...FAKE_SESSION }
  mockCreateSession.mockResolvedValue(freshSession)
  mockGetSession.mockImplementation(async (id: string) => ({ ...FAKE_SESSION, id }))
  mockAddMessage.mockResolvedValue({ id: 'msg-1' } as ChatMessage)
  mockGetTrackers.mockResolvedValue([])
  mockBuildHealthSystemPrompt.mockReturnValue('You are a health assistant.')
  mockDetectRoutineTrigger.mockResolvedValue(null)
  mockFetchRoutine.mockResolvedValue(null) // Default: no routine found
  mockGetActiveDayState.mockResolvedValue(null) // No active session by default
  mockGetRecentMessagesForAI.mockResolvedValue([])
  mockGetLogsForDay.mockResolvedValue([])
  mockGetMasterBrainContext.mockResolvedValue({})
  mockGetAgents.mockResolvedValue([])
  mockUpdateSession.mockResolvedValue(undefined)
  mockMarkDayStarted.mockResolvedValue(undefined)
  mockMarkDayEnded.mockResolvedValue(undefined)

  // Default streaming mock
  mockStreamHealthMessage.mockImplementation(() =>
    makeChunkGenerator(['Logged!'])
  )
})

// ---------------------------------------------------------------------------
// TC-V27-C-01: Start Day allowed when no session open
// ---------------------------------------------------------------------------

describe('POST /api/chat — Start Day Guard (TC-01)', () => {
  it('allows Start Day when no active session exists (routineId path)', async () => {
    // Setup: No active session
    mockGetActiveDayState.mockResolvedValue(null)
    mockFetchRoutine.mockResolvedValue(FAKE_START_DAY_ROUTINE)

    const res = await POST(
      makeRequest({
        message: 'start day',
        routineId: FAKE_START_DAY_ROUTINE.id,
        date: '2026-03-31',
      })
    )

    // Drain the SSE stream
    await readSSEStream(res.body!)

    expect(res.status).toBe(200)

    // Guard should NOT block — updateSession should be called (to activate the routine)
    expect(mockUpdateSession).toHaveBeenCalledWith(
      FAKE_SESSION.id,
      expect.objectContaining({ active_routine_id: FAKE_START_DAY_ROUTINE.id })
    )
  })

  it('allows Start Day when no active session exists (trigger phrase path)', async () => {
    // Setup: No active session, routine detected from text
    mockGetActiveDayState.mockResolvedValue(null)
    mockDetectRoutineTrigger.mockResolvedValue(FAKE_START_DAY_ROUTINE)

    const res = await POST(
      makeRequest({
        message: 'start day',
        date: '2026-03-31',
      })
    )

    await readSSEStream(res.body!)

    expect(res.status).toBe(200)

    // Guard should NOT block — updateSession should be called
    expect(mockUpdateSession).toHaveBeenCalledWith(
      FAKE_SESSION.id,
      expect.objectContaining({ active_routine_id: FAKE_START_DAY_ROUTINE.id })
    )
  })
})

// ---------------------------------------------------------------------------
// TC-V27-C-02: Start Day blocked when session exists for SAME date
// ---------------------------------------------------------------------------

describe('POST /api/chat — Start Day Guard (TC-02)', () => {
  it('blocks Start Day when session exists for same date (routineId path)', async () => {
    // Setup: Active session for TODAY (2026-03-31) — cannot start again
    const activeDayState: UserDayState = {
      id: 'state-1',
      user_id: FAKE_USER.id,
      date: '2026-03-31',
      day_started_at: '2026-03-31T08:00:00Z',
      day_ended_at: null,
    }

    mockGetActiveDayState.mockResolvedValue(activeDayState)
    mockFetchRoutine.mockResolvedValue(FAKE_START_DAY_ROUTINE)

    const res = await POST(
      makeRequest({
        message: 'start day',
        routineId: FAKE_START_DAY_ROUTINE.id,
        date: '2026-03-31',
      })
    )

    expect(res.status).toBe(200)

    // Guard SHOULD block — updateSession should NOT be called
    expect(mockUpdateSession).not.toHaveBeenCalled()

    // Response should be the blocking message (JSON for guard blocks, not SSE)
    const body = await res.json() as {
      message: { role: string; content: string }
      sessionId: string
    }
    expect(body.message.content).toContain("already active")
  })

  it('blocks Start Day when session exists for same date (trigger phrase path)', async () => {
    // Setup: Active session for TODAY (same date)
    const activeDayState: UserDayState = {
      id: 'state-1',
      user_id: FAKE_USER.id,
      date: '2026-03-31',
      day_started_at: '2026-03-31T08:00:00Z',
      day_ended_at: null,
    }
    mockGetActiveDayState.mockResolvedValue(activeDayState)
    mockDetectRoutineTrigger.mockResolvedValue(FAKE_START_DAY_ROUTINE)

    const res = await POST(
      makeRequest({
        message: 'start day',
        date: '2026-03-31',
      })
    )

    expect(res.status).toBe(200)

    // Guard SHOULD block
    expect(mockUpdateSession).not.toHaveBeenCalled()

    const body = await res.json() as {
      message: { role: string; content: string }
      sessionId: string
    }
    // Trigger phrase path: same day says "A session for X is already active..."
    expect(body.message.content).toContain("already active")
  })
})

// ---------------------------------------------------------------------------
// TC-V27-C-03: Session from a DIFFERENT date also blocks Start Day
// (No auto-close — sessions stay active until explicitly ended)
// ---------------------------------------------------------------------------

describe('POST /api/chat — Start Day Guard (TC-03)', () => {
  it('blocks Start Day when a session from a different date is still open', async () => {
    // The route does NOT auto-close stale sessions.
    // An open session from March 30 still blocks Start Day on March 31.
    const activeDayState: UserDayState = {
      id: 'state-1',
      user_id: FAKE_USER.id,
      date: '2026-03-30', // Yesterday's session still open
      day_started_at: '2026-03-30T08:00:00Z',
      day_ended_at: null,
    }
    mockGetActiveDayState.mockResolvedValue(activeDayState)
    mockFetchRoutine.mockResolvedValue(FAKE_START_DAY_ROUTINE)

    const res = await POST(
      makeRequest({
        message: 'start day',
        routineId: FAKE_START_DAY_ROUTINE.id,
        date: '2026-03-31',
      })
    )

    expect(res.status).toBe(200)

    // Guard SHOULD block (finalActiveDayState !== null even for a different date)
    expect(mockUpdateSession).not.toHaveBeenCalled()

    // markDayEnded should NOT be called (no auto-close)
    expect(mockMarkDayEnded).not.toHaveBeenCalled()

    // Response should be the blocking message
    const body = await res.json() as {
      message: { role: string; content: string }
      sessionId: string
    }
    expect(body.message.content).toContain("is still active")
  })
})

// ---------------------------------------------------------------------------
// TC-V27-C-04: Dashboard button click path is protected
// ---------------------------------------------------------------------------

describe('POST /api/chat — Start Day Guard (TC-04)', () => {
  it('protects dashboard button click path with guard check', async () => {
    // Setup: Active session for today (guard WILL block)
    const activeDayState: UserDayState = {
      id: 'state-1',
      user_id: FAKE_USER.id,
      date: '2026-03-31',
      day_started_at: '2026-03-31T08:00:00Z',
      day_ended_at: null,
    }
    mockGetActiveDayState.mockResolvedValue(activeDayState)
    mockFetchRoutine.mockResolvedValue(FAKE_START_DAY_ROUTINE)

    // Simulate dashboard button click (explicit routineId, empty message)
    const res = await POST(
      makeRequest({
        message: '', // Empty message from dashboard click
        routineId: FAKE_START_DAY_ROUTINE.id,
        date: '2026-03-31',
      })
    )

    expect(res.status).toBe(400) // Empty message validation

    // But if we send a message, guard should work
    const res2 = await POST(
      makeRequest({
        message: 'start day',
        routineId: FAKE_START_DAY_ROUTINE.id,
        date: '2026-03-31',
      })
    )

    // Guard blocks — user message was added, then blocking response
    expect(res2.status).toBe(200)
    const body = await res2.json() as {
      message: { role: string; content: string }
    }
    expect(body.message.content).toContain("all set to continue")

    // updateSession should NOT be called (guard blocked activation)
    expect(mockUpdateSession).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// TC-V27-C-05: Chat phrase path is protected
// ---------------------------------------------------------------------------

describe('POST /api/chat — Start Day Guard (TC-05)', () => {
  it('protects chat trigger phrase path with guard check', async () => {
    // Setup: Active session for TODAY
    const activeDayState: UserDayState = {
      id: 'state-1',
      user_id: FAKE_USER.id,
      date: '2026-03-31',
      day_started_at: '2026-03-31T09:00:00Z',
      day_ended_at: null,
    }
    mockGetActiveDayState.mockResolvedValue(activeDayState)
    mockDetectRoutineTrigger.mockResolvedValue(FAKE_START_DAY_ROUTINE)

    // Simulate user typing "start day" in chat (trigger phrase detection)
    const res = await POST(
      makeRequest({
        message: 'start day',
        date: '2026-03-31',
      })
    )

    expect(res.status).toBe(200)

    // Guard SHOULD block
    expect(mockUpdateSession).not.toHaveBeenCalled()

    // Response should be the blocking message
    const body = await res.json() as {
      message: { role: string; content: string }
      sessionId: string
    }
    expect(body.message.content).toContain("already active")
    expect(body.message.content).toContain("2026-03-31")
  })

  it('verifies user message is persisted when guard blocks (audit trail)', async () => {
    // Setup: Active session
    const activeDayState: UserDayState = {
      id: 'state-1',
      user_id: FAKE_USER.id,
      date: '2026-03-31',
      day_started_at: '2026-03-31T09:00:00Z',
      day_ended_at: null,
    }
    mockGetActiveDayState.mockResolvedValue(activeDayState)
    mockDetectRoutineTrigger.mockResolvedValue(FAKE_START_DAY_ROUTINE)

    await POST(
      makeRequest({
        message: 'start day',
        date: '2026-03-31',
      })
    )

    // User message should still be added to chat (for audit trail)
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'user',
        content: 'start day',
      })
    )

    // Assistant message (blocking response) should be added
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining("already active"),
      })
    )
  })
})

// ---------------------------------------------------------------------------
// Guard logic correctness tests
// ---------------------------------------------------------------------------

describe('POST /api/chat — Start Day Guard Logic', () => {
  it('does not block non-day_start routines even with active session', async () => {
    // Setup: Active session, but triggering an evening routine
    const activeDayState: UserDayState = {
      id: 'state-1',
      user_id: FAKE_USER.id,
      date: '2026-03-31',
      day_started_at: '2026-03-31T08:00:00Z',
      day_ended_at: null,
    }
    mockGetActiveDayState.mockResolvedValue(activeDayState)

    const endDayRoutine: Routine = {
      ...FAKE_START_DAY_ROUTINE,
      id: 'routine-end-day',
      name: 'Evening Review',
      type: 'day_end',
    }
    mockFetchRoutine.mockResolvedValue(endDayRoutine)

    const res = await POST(
      makeRequest({
        message: 'end day',
        routineId: endDayRoutine.id,
        date: '2026-03-31',
      })
    )

    await readSSEStream(res.body!)

    expect(res.status).toBe(200)

    // Guard should NOT block — only day_start routines are checked
    expect(mockUpdateSession).toHaveBeenCalledWith(
      FAKE_SESSION.id,
      expect.objectContaining({ active_routine_id: endDayRoutine.id })
    )
  })

  it('guard condition: finalActiveDayState must be non-null and routine.type must be day_start', async () => {
    // Test: routine is day_start, finalActiveDayState is null → do NOT block
    mockGetActiveDayState.mockResolvedValue(null)
    mockFetchRoutine.mockResolvedValue(FAKE_START_DAY_ROUTINE)

    const res = await POST(
      makeRequest({
        message: 'start day',
        routineId: FAKE_START_DAY_ROUTINE.id,
        date: '2026-03-31',
      })
    )

    await readSSEStream(res.body!)

    expect(res.status).toBe(200)

    // Condition: routine.type === 'day_start' (true) && finalActiveDayState !== null (false)
    // Overall: true && false = false → do NOT block
    expect(mockUpdateSession).toHaveBeenCalled()
  })
})
