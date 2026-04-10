import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ActionCard } from '@/types/action-card'
import type { ChatSession } from '@/types/chat'

// ---------------------------------------------------------------------------
// vi.hoisted ensures these fn references exist when vi.mock factories run
// (vi.mock is hoisted above const declarations by Vitest's AST transform)
// ---------------------------------------------------------------------------

const {
  mockGetUser,
  mockCreateServerClient,
  mockCreateSession,
  mockGetSession,
  mockAddMessage,
  mockGetTrackers,
  mockStreamHealthMessage,
  mockBuildHealthSystemPrompt,
  mockBuildRoutineSystemPrompt,
  mockDetectRoutineTrigger,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCreateServerClient: vi.fn(),
  mockCreateSession: vi.fn(),
  mockGetSession: vi.fn(),
  mockAddMessage: vi.fn(),
  mockGetTrackers: vi.fn(),
  mockStreamHealthMessage: vi.fn(),
  mockBuildHealthSystemPrompt: vi.fn(),
  mockBuildRoutineSystemPrompt: vi.fn(),
  mockDetectRoutineTrigger: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: mockCreateServerClient,
}))

vi.mock('@/lib/db/chat', () => ({
  createSession: mockCreateSession,
  getSession: mockGetSession,
  addMessage: mockAddMessage,
  updateSession: vi.fn().mockResolvedValue(undefined),
  getMessages: vi.fn(),
  getSessions: vi.fn(),
  getRecentMessagesForAI: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/db/trackers', () => ({
  getTrackers: mockGetTrackers,
  getTrackersBasic: mockGetTrackers,
}))

vi.mock('@/lib/ai/gemini', () => ({
  processHealthMessage: vi.fn(),
  streamHealthMessage: mockStreamHealthMessage,
  extractFromImage: vi.fn(),
  GEMINI_MODEL: 'gemini-2.5-flash',
}))

vi.mock('@/lib/ai/prompt-builder', () => ({
  buildHealthSystemPrompt: mockBuildHealthSystemPrompt,
  buildRoutineSystemPrompt: mockBuildRoutineSystemPrompt,
}))

vi.mock('@/lib/routines/detector', () => ({
  detectRoutineTrigger: mockDetectRoutineTrigger,
}))

vi.mock('@/lib/db/day-state', () => ({
  getActiveDayState: vi.fn().mockResolvedValue(null),
  markDayEnded: vi.fn().mockResolvedValue(undefined),
  markDayStarted: vi.fn().mockResolvedValue(undefined),
  getDayState: vi.fn().mockResolvedValue(null),
  upsertDayState: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/db/logs', () => ({
  getLogsForDay: vi.fn().mockResolvedValue([]),
  getLogsForDateRange: vi.fn().mockResolvedValue([]),
  searchLogsByFieldText: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/db/routines', () => ({
  getRoutine: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/ai/master-brain', () => ({
  getMasterBrainContext: vi.fn().mockResolvedValue(''),
}))

vi.mock('@/lib/db/agents', () => ({
  getAgents: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/ai/actions', () => ({
  sanitizeFields: vi.fn((fields) => fields),
  parseActionCards: vi.fn(() => []),
}))

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/chat/route'

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { id: 'user-123', email: 'test@example.com' }
const FAKE_SESSION: ChatSession = {
  id: 'session-abc',
  user_id: FAKE_USER.id,
  title: 'New Chat',
  updated_at: '2026-03-10T00:00:00Z',
  active_routine_id: null,
  current_step_index: 0,
  active_agent_id: null,
}
const FAKE_ACTION: ActionCard = {
  type: 'LOG_DATA',
  trackerId: 'tracker-1',
  trackerName: 'Nutrition',
  fields: { fld_001: 350 },
  date: '2026-03-10',
  source: 'chat',
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setAuthenticatedUser(): void {
  mockGetUser.mockResolvedValue({ data: { user: FAKE_USER }, error: null })
  mockCreateServerClient.mockResolvedValue({
    auth: { getUser: mockGetUser },
  })
}

function setUnauthenticatedUser(): void {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
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

// Helper: get the done event payload from an SSE response
async function getDoneEvent(res: Response): Promise<Record<string, unknown>> {
  const events = await readSSEStream(res.body!)
  const parsed = events.map(e => JSON.parse(e) as Record<string, unknown>)
  const doneEvent = parsed.find(e => e.type === 'done')
  if (!doneEvent) throw new Error('No done event found in SSE stream')
  return doneEvent
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()

  // Default happy path setup
  setAuthenticatedUser()
  mockCreateSession.mockResolvedValue(FAKE_SESSION)
  // Return a session with the requested id so session.id matches the caller's sessionId
  mockGetSession.mockImplementation(async (id: string) => ({ ...FAKE_SESSION, id }))
  mockAddMessage.mockResolvedValue({ id: 'msg-1' })
  mockGetTrackers.mockResolvedValue([])
  mockBuildHealthSystemPrompt.mockReturnValue('You are a health assistant.')
  mockBuildRoutineSystemPrompt.mockReturnValue('You are YAHA executing a routine.')
  mockDetectRoutineTrigger.mockResolvedValue(null)

  // Default streaming mock: yields a simple response
  mockStreamHealthMessage.mockImplementation(() =>
    makeChunkGenerator(['Logged your meal!'])
  )
})

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe('POST /api/chat — authentication', () => {
  it('returns 401 when user is not authenticated', async () => {
    setUnauthenticatedUser()

    const res = await POST(makeRequest({ message: 'Hello' }))

    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Unauthorized')
  })
})

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('POST /api/chat — input validation', () => {
  it('returns 400 when message is missing', async () => {
    const res = await POST(makeRequest({}))

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/message/i)
  })

  it('returns 400 when message is an empty string', async () => {
    const res = await POST(makeRequest({ message: '' }))

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/message/i)
  })

  it('returns 400 when message is only whitespace', async () => {
    const res = await POST(makeRequest({ message: '   ' }))

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/message/i)
  })

  it('returns 400 when message exceeds 4000 characters', async () => {
    const longMessage = 'a'.repeat(4001)
    const res = await POST(makeRequest({ message: longMessage }))

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/4000/i)
  })

  it('returns 400 when attachment has a disallowed MIME type', async () => {
    const res = await POST(
      makeRequest({
        message: 'Check this file',
        attachments: [
          {
            base64: 'abc123==',
            mimeType: 'application/x-executable',
            type: 'file',
          },
        ],
      })
    )

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/mime type/i)
  })

  it('returns 400 when request body is not valid JSON', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json at all{{{',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/invalid request body/i)
  })
})

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

describe('POST /api/chat — session management', () => {
  it('creates a new session when sessionId is not provided', async () => {
    const res = await POST(makeRequest({ message: 'Hello' }))

    expect(res.status).toBe(200)
    expect(mockCreateSession).toHaveBeenCalledOnce()
    const doneEvent = await getDoneEvent(res)
    expect(doneEvent.sessionId).toBe(FAKE_SESSION.id)
  })

  it('uses provided sessionId without creating a new session', async () => {
    const res = await POST(makeRequest({ message: 'Hello', sessionId: 'existing-session' }))

    expect(res.status).toBe(200)
    expect(mockCreateSession).not.toHaveBeenCalled()
    const doneEvent = await getDoneEvent(res)
    expect(doneEvent.sessionId).toBe('existing-session')
  })

  it('returns 404 when provided sessionId does not belong to user', async () => {
    mockGetSession.mockRejectedValue(new Error('Session not found or unauthorized'))

    const res = await POST(makeRequest({ message: 'Hello', sessionId: 'foreign-session' }))

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Session not found')
  })
})

// ---------------------------------------------------------------------------
// Message persistence
// ---------------------------------------------------------------------------

describe('POST /api/chat — message persistence', () => {
  it('saves user message and model response to DB', async () => {
    mockStreamHealthMessage.mockImplementation(() =>
      makeChunkGenerator(['Logged your meal!'])
    )

    const res = await POST(makeRequest({ message: 'I ate 500 calories' }))

    // Drain the stream before asserting
    await readSSEStream(res.body!)

    expect(res.status).toBe(200)
    expect(mockAddMessage).toHaveBeenCalledTimes(2)

    // First call: user message
    expect(mockAddMessage).toHaveBeenNthCalledWith(1, {
      session_id: FAKE_SESSION.id,
      role: 'user',
      content: 'I ate 500 calories',
      attachments: null,
    })

    // Second call: assistant response (accumulated full text)
    expect(mockAddMessage).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        session_id: FAKE_SESSION.id,
        role: 'assistant',
        content: 'Logged your meal!',
      })
    )
  })

  it('saves model response with parsed actions when present', async () => {
    // parseActionCards mock returns FAKE_ACTION
    const { parseActionCards } = await import('@/lib/ai/actions')
    vi.mocked(parseActionCards).mockReturnValue([FAKE_ACTION])

    mockStreamHealthMessage.mockImplementation(() =>
      makeChunkGenerator(['Logged your nutrition!'])
    )

    const res = await POST(makeRequest({ message: 'I had 350 calories of chicken' }))
    await readSSEStream(res.body!)

    expect(mockAddMessage).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        actions: expect.arrayContaining([expect.objectContaining({ type: 'LOG_DATA' })]),
      })
    )
  })
})

// ---------------------------------------------------------------------------
// Response shape (SSE)
// ---------------------------------------------------------------------------

describe('POST /api/chat — response shape', () => {
  it('returns Content-Type text/event-stream', async () => {
    const res = await POST(makeRequest({ message: 'Hello' }))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('done event contains sessionId and messageId', async () => {
    const res = await POST(makeRequest({ message: 'Hello' }))
    const doneEvent = await getDoneEvent(res)

    expect(doneEvent.sessionId).toBe(FAKE_SESSION.id)
    expect(doneEvent.messageId).toBe('msg-1')
  })

  it('done event contains accumulated full content', async () => {
    mockStreamHealthMessage.mockImplementation(() =>
      makeChunkGenerator(['Got ', 'it!'])
    )

    const res = await POST(makeRequest({ message: 'Hello' }))
    const doneEvent = await getDoneEvent(res)

    expect(doneEvent.content).toBe('Got it!')
  })

  it('passes allowed attachment MIME types to streamHealthMessage', async () => {
    const res = await POST(
      makeRequest({
        message: 'Here is my meal photo',
        attachments: [
          {
            base64: 'abc123==',
            mimeType: 'image/jpeg',
            type: 'image',
            filename: 'meal.jpg',
          },
        ],
      })
    )

    await readSSEStream(res.body!)

    expect(mockStreamHealthMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ mimeType: 'image/jpeg' }),
        ],
      }),
      expect.any(String),
      expect.any(Array)
    )
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('POST /api/chat — error handling', () => {
  it('emits SSE error event when streamHealthMessage throws', async () => {
    mockStreamHealthMessage.mockImplementation(async function* () {
      throw new Error('Gemini API error')
    })

    const res = await POST(makeRequest({ message: 'Hello' }))

    // Route still returns 200 SSE with error event inside stream
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')

    const events = await readSSEStream(res.body!)
    const parsed = events.map(e => JSON.parse(e) as { type: string; error?: string })
    const errorEvent = parsed.find(e => e.type === 'error')

    expect(errorEvent).toBeDefined()
    expect(errorEvent?.error).toBe('Streaming failed')
  })

  it('returns 500 when getTrackers throws', async () => {
    mockGetTrackers.mockRejectedValue(new Error('DB connection failed'))

    const res = await POST(makeRequest({ message: 'Hello' }))

    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Internal server error')
  })

  it('does not expose internal error details in the response', async () => {
    mockGetTrackers.mockRejectedValue(new Error('Secret internal details'))

    const res = await POST(makeRequest({ message: 'Hello' }))

    const body = await res.json() as { error: string }
    expect(body.error).not.toContain('Secret internal details')
  })
})

// ---------------------------------------------------------------------------
// Routine trigger detection
// ---------------------------------------------------------------------------

import type { Routine } from '@/types/routine'

const FAKE_ROUTINE: Routine = {
  id: 'routine-1',
  user_id: 'user-123',
  name: 'Morning Check-In',
  trigger_phrase: 'start day',
  type: 'day_start',
  steps: [
    {
      trackerId: 'tracker-sleep',
      trackerName: 'Sleep',
      trackerColor: '#3b82f6',
      targetFields: ['fld_hours', 'fld_quality'],
    },
  ],
  created_at: '2026-03-11T00:00:00Z',
}

describe('POST /api/chat — routine trigger detection', () => {
  it('uses routine system prompt when detectRoutineTrigger returns a routine', async () => {
    mockDetectRoutineTrigger.mockResolvedValue(FAKE_ROUTINE)

    const res = await POST(makeRequest({ message: 'start day' }))

    await readSSEStream(res.body!)

    expect(res.status).toBe(200)
    expect(mockBuildRoutineSystemPrompt).toHaveBeenCalledWith(
      FAKE_ROUTINE,
      expect.any(Array),
      expect.any(Number),
      expect.any(String),
      expect.any(Array),
      expect.any(String),
      expect.any(String),
    )
    expect(mockBuildHealthSystemPrompt).not.toHaveBeenCalled()
    expect(mockStreamHealthMessage).toHaveBeenCalledWith(
      expect.anything(),
      'You are YAHA executing a routine.',
      expect.any(Array)
    )
  })

  it('uses default health system prompt when no routine is triggered', async () => {
    mockDetectRoutineTrigger.mockResolvedValue(null)

    const res = await POST(makeRequest({ message: 'I slept 8 hours' }))

    await readSSEStream(res.body!)

    expect(res.status).toBe(200)
    expect(mockBuildHealthSystemPrompt).toHaveBeenCalledOnce()
    expect(mockBuildRoutineSystemPrompt).not.toHaveBeenCalled()
    expect(mockStreamHealthMessage).toHaveBeenCalledWith(
      expect.anything(),
      'You are a health assistant.',
      expect.any(Array)
    )
  })

  it('falls back to default system prompt when detectRoutineTrigger throws', async () => {
    mockDetectRoutineTrigger.mockRejectedValue(new Error('Auth error'))

    const res = await POST(makeRequest({ message: 'start day' }))

    await readSSEStream(res.body!)

    expect(res.status).toBe(200)
    expect(mockBuildHealthSystemPrompt).toHaveBeenCalledOnce()
    expect(mockBuildRoutineSystemPrompt).not.toHaveBeenCalled()
  })
})
