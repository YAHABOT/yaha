import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CreateSessionInput, CreateMessageInput } from '@/types/chat'

// --- Mock setup -----------------------------------------------------------

type QueryResult = { data: unknown; error: { message: string } | null }
type ChainableBuilder = Record<string, ReturnType<typeof vi.fn>> & { _result: QueryResult }

/**
 * Build a fully chainable query builder that mimics the Supabase client.
 * Every method returns the builder itself, and the builder is thenable
 * so `await supabase.from(...).select(...)...` resolves with _result.
 */
function createQueryBuilder(): ChainableBuilder {
  const builder = {} as ChainableBuilder

  // Default result when the chain is awaited
  builder._result = { data: null, error: null }

  // Every Supabase method returns the builder for chaining
  builder.select = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.single = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)

  // Make the builder thenable so `await` resolves to _result
  builder.then = vi.fn((resolve: (v: QueryResult) => void) =>
    resolve(builder._result)
  )

  return builder
}

let queryBuilder = createQueryBuilder()

const mockGetUser = vi.fn()
const mockFrom = vi.fn(() => queryBuilder)

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    })
  ),
}))

// --- Helpers ---------------------------------------------------------------

const FAKE_USER = { id: 'user-123', email: 'test@example.com' }
const FAKE_SESSION_ID = 'session-abc'

function setAuthenticatedUser(): void {
  mockGetUser.mockResolvedValue({ data: { user: FAKE_USER }, error: null })
}

function setUnauthenticatedUser(): void {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
}

function setQueryResult(data: unknown, error: { message: string } | null = null): void {
  queryBuilder._result = { data, error }
}

// --- Import under test (after mocks) --------------------------------------

import {
  getSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  getMessages,
  addMessage,
  getRecentMessagesForAI,
} from '@/lib/db/chat'

// --- Tests ----------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  queryBuilder = createQueryBuilder()
  mockFrom.mockReturnValue(queryBuilder)
})

// ==========================================================================
// getSessions
// ==========================================================================

describe('getSessions', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(getSessions()).rejects.toThrow('Unauthorized')
  })

  it('queries chat_sessions and orders by updated_at descending', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getSessions()

    expect(mockFrom).toHaveBeenCalledWith('chat_sessions')
    expect(queryBuilder.select).toHaveBeenCalledWith('id, user_id, title, updated_at')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
    expect(queryBuilder.order).toHaveBeenCalledWith('updated_at', { ascending: false })
  })

  it('returns sessions on success', async () => {
    setAuthenticatedUser()
    const sessions = [{ id: 'session-1', title: 'My Chat' }]
    setQueryResult(sessions)

    const result = await getSessions()

    expect(result).toEqual(sessions)
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'connection timeout' })

    await expect(getSessions()).rejects.toThrow(
      'Failed to fetch sessions: connection timeout'
    )
  })
})

// ==========================================================================
// getSession
// ==========================================================================

describe('getSession', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(getSession('session-1')).rejects.toThrow('Unauthorized')
  })

  it('filters by id and user_id for ownership verification', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 'session-1', title: 'Chat' })

    await getSession('session-1')

    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'session-1')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
    expect(queryBuilder.single).toHaveBeenCalled()
  })

  it('returns session data on success', async () => {
    setAuthenticatedUser()
    const session = { id: 'session-1', title: 'Chat', user_id: FAKE_USER.id }
    setQueryResult(session)

    const result = await getSession('session-1')

    expect(result).toEqual(session)
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'row not found' })

    await expect(getSession('nonexistent')).rejects.toThrow(
      'Failed to fetch session: row not found'
    )
  })
})

// ==========================================================================
// createSession
// ==========================================================================

describe('createSession', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(createSession()).rejects.toThrow('Unauthorized')
  })

  it('creates session with default title "New Chat" when no input provided', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 'session-1', title: 'New Chat' })

    await createSession()

    expect(queryBuilder.insert).toHaveBeenCalledWith({
      user_id: FAKE_USER.id,
      title: 'New Chat',
    })
  })

  it('creates session with provided title', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 'session-1', title: 'My Session' })

    const input: CreateSessionInput = { title: 'My Session' }
    await createSession(input)

    expect(queryBuilder.insert).toHaveBeenCalledWith({
      user_id: FAKE_USER.id,
      title: 'My Session',
    })
  })

  it('calls .single() to return the created session', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 'session-1', title: 'New Chat' })

    await createSession()

    expect(queryBuilder.single).toHaveBeenCalled()
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'duplicate key' })

    await expect(createSession()).rejects.toThrow(
      'Failed to create session: duplicate key'
    )
  })
})

// ==========================================================================
// updateSession
// ==========================================================================

describe('updateSession', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(updateSession('session-1', { title: 'New Title' })).rejects.toThrow('Unauthorized')
  })

  it('updates with provided title and touches updated_at', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 'session-1', title: 'New Title' })

    await updateSession('session-1', { title: 'New Title' })

    const updateCall = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>
    expect(updateCall).toHaveProperty('title', 'New Title')
    expect(updateCall).toHaveProperty('updated_at')
    expect(typeof updateCall.updated_at).toBe('string')
  })

  it('filters by id and user_id for ownership verification', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 'session-1' })

    await updateSession('session-1', { title: 'X' })

    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'session-1')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'row not found' })

    await expect(updateSession('session-1', { title: 'X' })).rejects.toThrow(
      'Failed to update session: row not found'
    )
  })
})

// ==========================================================================
// deleteSession
// ==========================================================================

describe('deleteSession', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(deleteSession('session-1')).rejects.toThrow('Unauthorized')
  })

  it('verifies ownership then calls delete', async () => {
    setAuthenticatedUser()
    // Both the ownership check (.single()) and the delete resolve with success
    setQueryResult({ id: 'session-1' })

    await deleteSession('session-1')

    expect(queryBuilder.delete).toHaveBeenCalled()
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'session-1')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
  })

  it('propagates Supabase errors with descriptive message when ownership check fails', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'row not found' })

    await expect(deleteSession('nonexistent')).rejects.toThrow(
      'Failed to delete session: row not found'
    )
  })
})

// ==========================================================================
// getMessages
// ==========================================================================

describe('getMessages', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(getMessages(FAKE_SESSION_ID)).rejects.toThrow('Unauthorized')
  })

  it('returns messages ordered by created_at ascending on success', async () => {
    setAuthenticatedUser()
    const messages = [
      { id: 'msg-1', content: 'hello', role: 'user' },
      { id: 'msg-2', content: 'hi', role: 'model' },
    ]
    setQueryResult(messages)

    const result = await getMessages(FAKE_SESSION_ID)

    expect(result).toEqual(messages)
    expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('verifies session ownership before fetching messages', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getMessages(FAKE_SESSION_ID)

    // eq called with session id and user_id during ownership check
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', FAKE_SESSION_ID)
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
    // eq also called with session_id for messages query
    expect(queryBuilder.eq).toHaveBeenCalledWith('session_id', FAKE_SESSION_ID)
  })

  it('propagates ownership check error with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'session not found' })

    await expect(getMessages('bad-session')).rejects.toThrow(
      'Failed to fetch messages: session not found'
    )
  })
})

// ==========================================================================
// addMessage
// ==========================================================================

describe('addMessage', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    const input: CreateMessageInput = {
      session_id: FAKE_SESSION_ID,
      role: 'user',
      content: 'Hello',
    }
    await expect(addMessage(input)).rejects.toThrow('Unauthorized')
  })

  it('inserts message with correct fields', async () => {
    setAuthenticatedUser()
    const msg = { id: 'msg-1', content: 'Hello', role: 'user' }
    setQueryResult(msg)

    const input: CreateMessageInput = {
      session_id: FAKE_SESSION_ID,
      role: 'user',
      content: 'Hello',
    }
    await addMessage(input)

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: FAKE_SESSION_ID,
        role: 'user',
        content: 'Hello',
        actions: null,
      })
    )
  })

  it('passes actions array when provided', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 'msg-1' })

    const actions = [{ type: 'LOG_DATA' as const, trackerId: 't-1', trackerName: 'Nutrition', fields: {}, date: '2026-03-10', source: 'chat' as const }]
    const input: CreateMessageInput = {
      session_id: FAKE_SESSION_ID,
      role: 'model',
      content: 'Logged!',
      actions,
    }
    await addMessage(input)

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ actions })
    )
  })

  it('verifies session ownership before inserting message', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 'msg-1' })

    await addMessage({ session_id: FAKE_SESSION_ID, role: 'user', content: 'Hi' })

    expect(queryBuilder.eq).toHaveBeenCalledWith('id', FAKE_SESSION_ID)
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
  })

  it('propagates ownership check error with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'session not found' })

    await expect(
      addMessage({ session_id: 'bad-id', role: 'user', content: 'Hi' })
    ).rejects.toThrow('Failed to add message: session not found')
  })
})

// ==========================================================================
// getRecentMessagesForAI
// ==========================================================================

describe('getRecentMessagesForAI', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(getRecentMessagesForAI(FAKE_SESSION_ID)).rejects.toThrow('Unauthorized')
  })

  it('applies default limit of 20', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getRecentMessagesForAI(FAKE_SESSION_ID)

    expect(queryBuilder.limit).toHaveBeenCalledWith(20)
  })

  it('applies custom limit when provided', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getRecentMessagesForAI(FAKE_SESSION_ID, 10)

    expect(queryBuilder.limit).toHaveBeenCalledWith(10)
  })

  it('orders by created_at descending to fetch latest messages', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getRecentMessagesForAI(FAKE_SESSION_ID)

    expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('reverses results to restore chronological order for AI context', async () => {
    setAuthenticatedUser()
    const messages = [
      { id: 'msg-3', created_at: '2026-03-10T03:00:00Z' },
      { id: 'msg-2', created_at: '2026-03-10T02:00:00Z' },
      { id: 'msg-1', created_at: '2026-03-10T01:00:00Z' },
    ]
    setQueryResult(messages)

    const result = await getRecentMessagesForAI(FAKE_SESSION_ID)

    // Reversed: oldest first
    expect(result[0].id).toBe('msg-1')
    expect(result[1].id).toBe('msg-2')
    expect(result[2].id).toBe('msg-3')
  })

  it('verifies session ownership before fetching messages', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getRecentMessagesForAI(FAKE_SESSION_ID)

    expect(queryBuilder.eq).toHaveBeenCalledWith('id', FAKE_SESSION_ID)
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
  })

  it('propagates ownership check error with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'session not found' })

    await expect(getRecentMessagesForAI('bad-session')).rejects.toThrow(
      'Failed to fetch messages for AI: session not found'
    )
  })
})
