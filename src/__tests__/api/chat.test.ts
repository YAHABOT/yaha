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
  mockProcessHealthMessage,
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
  mockProcessHealthMessage: vi.fn(),
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
  getMessages: vi.fn(),
  getSessions: vi.fn(),
  getRecentMessagesForAI: vi.fn(),
}))

vi.mock('@/lib/db/trackers', () => ({
  getTrackers: mockGetTrackers,
}))

vi.mock('@/lib/ai/gemini', () => ({
  processHealthMessage: mockProcessHealthMessage,
  streamHealthMessage: vi.fn(),
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
  mockProcessHealthMessage.mockResolvedValue({ text: 'Logged your meal!', actions: [] })
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
    const body = await res.json() as { sessionId: string }
    expect(body.sessionId).toBe(FAKE_SESSION.id)
  })

  it('uses provided sessionId without creating a new session', async () => {
    const res = await POST(makeRequest({ message: 'Hello', sessionId: 'existing-session' }))

    expect(res.status).toBe(200)
    expect(mockCreateSession).not.toHaveBeenCalled()
    const body = await res.json() as { sessionId: string }
    expect(body.sessionId).toBe('existing-session')
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
    const res = await POST(makeRequest({ message: 'I ate 500 calories' }))

    expect(res.status).toBe(200)
    expect(mockAddMessage).toHaveBeenCalledTimes(2)

    // First call: user message
    expect(mockAddMessage).toHaveBeenNthCalledWith(1, {
      session_id: FAKE_SESSION.id,
      role: 'user',
      content: 'I ate 500 calories',
    })

    // Second call: model response
    expect(mockAddMessage).toHaveBeenNthCalledWith(2, {
      session_id: FAKE_SESSION.id,
      role: 'model',
      content: 'Logged your meal!',
      actions: [],
    })
  })

  it('saves model response with parsed actions when present', async () => {
    mockProcessHealthMessage.mockResolvedValue({
      text: 'Logged your nutrition!',
      actions: [FAKE_ACTION],
    })

    await POST(makeRequest({ message: 'I had 350 calories of chicken' }))

    expect(mockAddMessage).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        actions: [FAKE_ACTION],
      })
    )
  })
})

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

describe('POST /api/chat — response shape', () => {
  it('returns correct ChatResponse shape with sessionId', async () => {
    mockProcessHealthMessage.mockResolvedValue({
      text: 'Got it!',
      actions: [FAKE_ACTION],
    })

    const res = await POST(makeRequest({ message: 'Hello' }))

    expect(res.status).toBe(200)
    const body = await res.json() as {
      message: { role: string; content: string; actions: ActionCard[] }
      sessionId: string
    }

    expect(body.sessionId).toBe(FAKE_SESSION.id)
    expect(body.message).toEqual({
      role: 'model',
      content: 'Got it!',
      actions: [FAKE_ACTION],
    })
  })

  it('returns allowed attachment MIME types through to processHealthMessage', async () => {
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

    expect(res.status).toBe(200)
    expect(mockProcessHealthMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ mimeType: 'image/jpeg' }),
        ],
      }),
      expect.any(String)
    )
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('POST /api/chat — error handling', () => {
  it('returns 500 when processHealthMessage throws', async () => {
    mockProcessHealthMessage.mockRejectedValue(new Error('Gemini API error'))

    const res = await POST(makeRequest({ message: 'Hello' }))

    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Internal server error')
  })

  it('returns 500 when getTrackers throws', async () => {
    mockGetTrackers.mockRejectedValue(new Error('DB connection failed'))

    const res = await POST(makeRequest({ message: 'Hello' }))

    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Internal server error')
  })

  it('returns 500 when addMessage throws', async () => {
    mockAddMessage.mockRejectedValue(new Error('DB write failed'))

    const res = await POST(makeRequest({ message: 'Hello' }))

    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Internal server error')
  })

  it('does not expose internal error details in the response', async () => {
    mockProcessHealthMessage.mockRejectedValue(new Error('Secret internal details'))

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

    expect(res.status).toBe(200)
    expect(mockBuildRoutineSystemPrompt).toHaveBeenCalledWith(FAKE_ROUTINE)
    expect(mockBuildHealthSystemPrompt).not.toHaveBeenCalled()
    expect(mockProcessHealthMessage).toHaveBeenCalledWith(
      expect.anything(),
      'You are YAHA executing a routine.'
    )
  })

  it('uses default health system prompt when no routine is triggered', async () => {
    mockDetectRoutineTrigger.mockResolvedValue(null)

    const res = await POST(makeRequest({ message: 'I slept 8 hours' }))

    expect(res.status).toBe(200)
    expect(mockBuildHealthSystemPrompt).toHaveBeenCalledOnce()
    expect(mockBuildRoutineSystemPrompt).not.toHaveBeenCalled()
    expect(mockProcessHealthMessage).toHaveBeenCalledWith(
      expect.anything(),
      'You are a health assistant.'
    )
  })

  it('falls back to default system prompt when detectRoutineTrigger throws', async () => {
    mockDetectRoutineTrigger.mockRejectedValue(new Error('Auth error'))

    const res = await POST(makeRequest({ message: 'start day' }))

    expect(res.status).toBe(200)
    expect(mockBuildHealthSystemPrompt).toHaveBeenCalledOnce()
    expect(mockBuildRoutineSystemPrompt).not.toHaveBeenCalled()
  })
})
