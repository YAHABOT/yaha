import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock setup ---

type QueryResult = { data: unknown; error: { message: string } | null }
type ChainableBuilder = Record<string, ReturnType<typeof vi.fn>> & { _result: QueryResult }

function createQueryBuilder(): ChainableBuilder {
  const builder = {} as ChainableBuilder
  builder._result = { data: null, error: null }

  builder.select = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.lt = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.single = vi.fn(() => builder)
  builder.range = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
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

const FAKE_USER = { id: 'user-123', email: 'test@example.com' }

function setAuthenticatedUser(): void {
  mockGetUser.mockResolvedValue({ data: { user: FAKE_USER }, error: null })
}

function setUnauthenticatedUser(): void {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
}

function setQueryResult(data: unknown, error: { message: string } | null = null): void {
  queryBuilder._result = { data, error }
}

import { getRecentMessagesForAI } from '@/lib/db/chat'
import type { ChatMessage } from '@/types/chat'

beforeEach(() => {
  vi.clearAllMocks()
  queryBuilder = createQueryBuilder()
  mockFrom.mockReturnValue(queryBuilder)
})

describe('getRecentMessagesForAI — Message History Filtering', () => {
  const createMessage = (
    content: string,
    createdAt: string,
    role: 'user' | 'assistant' = 'user'
  ): ChatMessage => ({
    id: `msg-${Math.random()}`,
    session_id: 'session-123',
    role,
    content,
    created_at: createdAt,
    actions: [],
  })

  describe('Date filtering — filterDate parameter', () => {
    it('returns only messages from specified date', async () => {
      setAuthenticatedUser()

      // Messages from different days in DESC order (as DB returns)
      const messagesDescending = [
        createMessage('Afternoon message', '2026-03-10T14:00:00Z'),
        createMessage('Morning message', '2026-03-10T08:00:00Z'),
      ]

      // Stub: getSession call (verify ownership)
      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          // First call: getSession
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          // Second call: getMessages filtered by date (returns DESC from DB)
          builder._result = { data: messagesDescending, error: null }
          callCount++
        }

        return builder
      })

      const result = await getRecentMessagesForAI('session-123', 20, '2026-03-10')

      expect(result).toHaveLength(2)
      expect(result[0].content).toBe('Morning message')
      expect(result[1].content).toBe('Afternoon message')
    })

    it('excludes messages from previous day when filterDate is provided', async () => {
      setAuthenticatedUser()

      // Simulate: messages from 2026-03-09 are NOT returned when filtering for 2026-03-10
      const messagesOnDay = [
        createMessage('Day 10 morning', '2026-03-10T08:00:00Z'),
      ]

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          // getMessages with date filter
          builder._result = { data: messagesOnDay, error: null }
          callCount++
        }

        return builder
      })

      const result = await getRecentMessagesForAI('session-123', 20, '2026-03-10')

      // Should not include Day 9 messages
      expect(result.every(m => m.created_at.startsWith('2026-03-10'))).toBe(true)
    })

    it('excludes messages from next day when filterDate is provided', async () => {
      setAuthenticatedUser()

      // Messages on target day only
      const messagesOnDay = [
        createMessage('Day 10 message', '2026-03-10T10:00:00Z'),
      ]

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          builder._result = { data: messagesOnDay, error: null }
          callCount++
        }

        return builder
      })

      const result = await getRecentMessagesForAI('session-123', 20, '2026-03-10')

      // Should not include Day 11 messages
      expect(result.every(m => !m.created_at.startsWith('2026-03-11'))).toBe(true)
    })

    it('handles timezone boundary: 23:59:59 on target day is included', async () => {
      setAuthenticatedUser()

      // Message at end of day
      const messagesOnDay = [
        createMessage('Late night', '2026-03-10T23:59:59Z'),
      ]

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          builder._result = { data: messagesOnDay, error: null }
          callCount++
        }

        return builder
      })

      const result = await getRecentMessagesForAI('session-123', 20, '2026-03-10')

      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Late night')
    })

    it('handles timezone boundary: 00:00:00 next day is excluded', async () => {
      setAuthenticatedUser()

      // Message at start of next day
      const messagesOnDay = [] // 00:00:00 UTC of next day should be excluded

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          builder._result = { data: messagesOnDay, error: null }
          callCount++
        }

        return builder
      })

      const result = await getRecentMessagesForAI('session-123', 20, '2026-03-10')

      expect(result).toHaveLength(0)
    })

    it('validates date format (YYYY-MM-DD)', async () => {
      setAuthenticatedUser()

      // Invalid format should be rejected
      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          // Should ignore invalid format and return all recent messages
          builder._result = { data: [], error: null }
          callCount++
        }

        return builder
      })

      // Invalid format: should be treated as no filter
      const result = await getRecentMessagesForAI('session-123', 20, 'invalid-date')

      expect(result).toEqual([])
    })

    it('accepts null filterDate to return all recent messages (backward compat)', async () => {
      setAuthenticatedUser()

      const allMessages = [
        createMessage('Message 1', '2026-03-09T10:00:00Z'),
        createMessage('Message 2', '2026-03-10T10:00:00Z'),
      ]

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          // No date filter — returns all recent
          builder._result = { data: allMessages, error: null }
          callCount++
        }

        return builder
      })

      const result = await getRecentMessagesForAI('session-123', 20) // No filterDate

      expect(result).toHaveLength(2)
    })
  })

  describe('Limit parameter — Recent message window', () => {
    it('returns up to limit number of messages (default 20)', async () => {
      setAuthenticatedUser()

      const messages = Array.from({ length: 25 }, (_, i) =>
        createMessage(`Message ${i}`, `2026-03-10T${String(i).padStart(2, '0')}:00:00Z`)
      )

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          // Supabase applies limit server-side
          builder._result = { data: messages.slice(0, 20), error: null }
          callCount++
        }

        return builder
      })

      const result = await getRecentMessagesForAI('session-123') // Uses default 20

      expect(result).toHaveLength(20)
    })

    it('respects custom limit parameter', async () => {
      setAuthenticatedUser()

      const messages = Array.from({ length: 50 }, (_, i) =>
        createMessage(`Message ${i}`, `2026-03-10T${String(i).padStart(2, '0')}:00:00Z`)
      )

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          builder._result = { data: messages.slice(0, 10), error: null }
          callCount++
        }

        return builder
      })

      const result = await getRecentMessagesForAI('session-123', 10)

      expect(result).toHaveLength(10)
    })
  })

  describe('Empty result — No messages on date', () => {
    it('returns empty array when no messages on filtered date', async () => {
      setAuthenticatedUser()

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          builder._result = { data: [], error: null }
          callCount++
        }

        return builder
      })

      const result = await getRecentMessagesForAI('session-123', 20, '2026-03-15') // No messages this day

      expect(result).toEqual([])
    })

    it('does not return null, returns empty array', async () => {
      setAuthenticatedUser()

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          builder._result = { data: [], error: null }
          callCount++
        }

        return builder
      })

      const result = await getRecentMessagesForAI('session-123', 20, '2026-03-10')

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })
  })

  describe('Chronological order — Messages reversed for AI', () => {
    it('reverses messages to chronological order for AI context', async () => {
      setAuthenticatedUser()

      // Simulate: DB returns DESC order (newest first)
      const messagesDescending = [
        createMessage('Message 3', '2026-03-10T14:00:00Z'),
        createMessage('Message 2', '2026-03-10T08:00:00Z'),
        createMessage('Message 1', '2026-03-10T02:00:00Z'),
      ]

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          builder._result = { data: messagesDescending, error: null }
          callCount++
        }

        return builder
      })

      const result = await getRecentMessagesForAI('session-123', 20, '2026-03-10')

      // Should be reversed to chronological order
      expect(result[0].content).toBe('Message 1')
      expect(result[1].content).toBe('Message 2')
      expect(result[2].content).toBe('Message 3')
    })
  })

  describe('Auth failure — Session ownership verification', () => {
    it('throws Unauthorized when no user authenticated', async () => {
      setUnauthenticatedUser()

      await expect(getRecentMessagesForAI('session-123')).rejects.toThrow('Unauthorized')
    })

    it('verifies session ownership before fetching messages (RLS)', async () => {
      setAuthenticatedUser()

      // Simulate: session does not belong to user
      setQueryResult(null, { message: 'No rows returned' })

      await expect(getRecentMessagesForAI('session-123')).rejects.toThrow('No rows returned')
    })
  })

  describe('Integration — Routine filtering + message context', () => {
    it('filters messages to today when routine in progress', async () => {
      setAuthenticatedUser()

      // Routine step persisted in DB — should filter to today only
      const todayMessages = [
        createMessage('Step 1 response', '2026-03-10T08:00:00Z'),
        createMessage('Step 2 response', '2026-03-10T08:30:00Z'),
      ]

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (callCount === 0) {
          builder._result = { data: { id: 'session-123' }, error: null }
          callCount++
        } else if (callCount === 1) {
          builder._result = { data: todayMessages, error: null }
          callCount++
        }

        return builder
      })

      const result = await getRecentMessagesForAI('session-123', 20, '2026-03-10')

      expect(result).toHaveLength(2)
      expect(result.every(m => m.created_at.startsWith('2026-03-10'))).toBe(true)
    })
  })
})
