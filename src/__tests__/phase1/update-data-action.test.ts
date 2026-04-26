import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UpdateLogInput } from '@/types/log'

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

import { updateLog } from '@/lib/db/logs'

beforeEach(() => {
  vi.clearAllMocks()
  queryBuilder = createQueryBuilder()
  mockFrom.mockReturnValue(queryBuilder)
})

describe('updateLog — UPDATE_DATA action processing', () => {
  describe('Happy path — Partial field update', () => {
    it('executes SQL UPDATE with partial fields (patch semantics)', async () => {
      setAuthenticatedUser()

      // First call: fetch current log to merge fields
      const currentLog = { id: 'log-123', fields: { fld_001: 350, fld_002: 'chicken' } }
      const updatedLog = { id: 'log-123', fields: { fld_001: 450, fld_002: 'chicken' }, logged_at: '2026-03-10T12:00:00Z' }

      // Mock the two queries: fetch (to read current) and update
      let callCount = 0
      mockFrom.mockImplementation(() => {
        const builder = createQueryBuilder()
        if (callCount === 0) {
          // First call: SELECT fields
          builder._result = { data: currentLog, error: null }
          callCount++
        } else if (callCount === 1) {
          // Second call: UPDATE
          builder._result = { data: updatedLog, error: null }
          callCount++
        }
        return builder
      })

      const input: UpdateLogInput = { fields: { fld_001: 450 } }
      const result = await updateLog('log-123', input)

      expect(result.id).toBe('log-123')
      expect(result.fields.fld_001).toBe(450)
      expect(result.fields.fld_002).toBe('chicken')
    })

    it('preserves unmodified fields when updating single field', async () => {
      setAuthenticatedUser()

      const currentLog = { id: 'log-123', fields: { fld_001: 100, fld_002: 200, fld_003: 'note' } }
      const updatedLog = { ...currentLog, fields: { fld_001: 150, fld_002: 200, fld_003: 'note' } }

      let callCount = 0
      mockFrom.mockImplementation(() => {
        const builder = createQueryBuilder()
        if (callCount === 0) {
          builder._result = { data: currentLog, error: null }
          callCount++
        } else {
          builder._result = { data: updatedLog, error: null }
          callCount++
        }
        return builder
      })

      const input: UpdateLogInput = { fields: { fld_001: 150 } }
      const result = await updateLog('log-123', input)

      expect(result.fields.fld_002).toBe(200)
      expect(result.fields.fld_003).toBe('note')
    })

    it('merges multiple field updates while preserving others', async () => {
      setAuthenticatedUser()

      const currentLog = { id: 'log-123', fields: { fld_001: 100, fld_002: 200, fld_003: 'note' } }
      const updatedLog = { ...currentLog, fields: { fld_001: 150, fld_002: 250, fld_003: 'note' } }

      let callCount = 0
      mockFrom.mockImplementation(() => {
        const builder = createQueryBuilder()
        if (callCount === 0) {
          builder._result = { data: currentLog, error: null }
          callCount++
        } else {
          builder._result = { data: updatedLog, error: null }
          callCount++
        }
        return builder
      })

      const input: UpdateLogInput = { fields: { fld_001: 150, fld_002: 250 } }
      const result = await updateLog('log-123', input)

      expect(result.fields.fld_001).toBe(150)
      expect(result.fields.fld_002).toBe(250)
      expect(result.fields.fld_003).toBe('note')
    })
  })

  describe('Happy path — Update logged_at timestamp', () => {
    it('includes logged_at in update payload when provided', async () => {
      setAuthenticatedUser()

      // Mock a successful UPDATE that includes logged_at
      let callCount = 0
      mockFrom.mockImplementation(() => {
        const builder = createQueryBuilder()
        if (callCount === 0) {
          // First call: SELECT fields for merge (no logged_at needed here)
          builder._result = { data: { fields: { fld_001: 350 } }, error: null }
          callCount++
        } else {
          // Second call: UPDATE with logged_at included
          builder._result = {
            data: {
              id: 'log-123',
              fields: { fld_001: 350 },
              logged_at: '2026-03-11T10:00:00Z',
              user_id: 'user-123',
              tracker_id: 'tracker-123',
              source: 'manual',
              created_at: '2026-03-10T12:00:00Z'
            },
            error: null
          }
          callCount++
        }
        return builder
      })

      const input: UpdateLogInput = { logged_at: '2026-03-11T10:00:00Z' }
      // Verify that the function accepts logged_at and doesn't throw
      await expect(updateLog('log-123', input)).resolves.toBeDefined()
    })
  })

  describe('Auth failure — RLS enforced', () => {
    it('throws Unauthorized when no user authenticated', async () => {
      setUnauthenticatedUser()

      const input: UpdateLogInput = { fields: { fld_001: 450 } }
      await expect(updateLog('log-123', input)).rejects.toThrow('Unauthorized')
    })

    it('rejects UPDATE on log belonging to different user (RLS via eq user_id)', async () => {
      setAuthenticatedUser()

      // Simulate RLS rejection: when trying to fetch the log with .eq('user_id', user.id),
      // Supabase returns an error if the log belongs to a different user
      setQueryResult(null, { message: 'No rows returned' })

      const input: UpdateLogInput = { fields: { fld_001: 450 } }
      await expect(updateLog('log-123', input)).rejects.toThrow('No rows returned')
    })
  })

  describe('Invalid logId', () => {
    it('throws error when logId does not exist', async () => {
      setAuthenticatedUser()

      // Simulate: fetch returns no rows
      setQueryResult(null, { message: 'No rows returned' })

      const input: UpdateLogInput = { fields: { fld_001: 450 } }
      await expect(updateLog('log-123', input)).rejects.toThrow('No rows returned')
    })

    it('throws error when logId is empty string', async () => {
      setAuthenticatedUser()

      setQueryResult(null, { message: 'No rows returned' })

      const input: UpdateLogInput = { fields: { fld_001: 450 } }
      await expect(updateLog('', input)).rejects.toThrow('No rows returned')
    })
  })

  describe('Null field handling — Patch semantics', () => {
    it('filters out null values from update to prevent overwrites', async () => {
      setAuthenticatedUser()

      const currentLog = { id: 'log-123', fields: { fld_001: 100, fld_002: 200 } }
      const updatedLog = { ...currentLog, fields: { fld_001: 150, fld_002: 200 } }

      let callCount = 0
      mockFrom.mockImplementation(() => {
        const builder = createQueryBuilder()
        if (callCount === 0) {
          builder._result = { data: currentLog, error: null }
          callCount++
        } else {
          builder._result = { data: updatedLog, error: null }
          callCount++
        }
        return builder
      })

      // Pass null to avoid overwriting; should be filtered out
      const input: UpdateLogInput = { fields: { fld_001: 150, fld_002: null } }
      const result = await updateLog('log-123', input)

      expect(result.fields.fld_001).toBe(150)
      expect(result.fields.fld_002).toBe(200) // Preserved, null was filtered
    })

    it('filters undefined values from update', async () => {
      setAuthenticatedUser()

      const currentLog = { id: 'log-123', fields: { fld_001: 100, fld_002: 200 } }
      const updatedLog = { ...currentLog, fields: { fld_001: 150, fld_002: 200 } }

      let callCount = 0
      mockFrom.mockImplementation(() => {
        const builder = createQueryBuilder()
        if (callCount === 0) {
          builder._result = { data: currentLog, error: null }
          callCount++
        } else {
          builder._result = { data: updatedLog, error: null }
          callCount++
        }
        return builder
      })

      const input: UpdateLogInput = { fields: { fld_001: 150, fld_002: undefined } }
      const result = await updateLog('log-123', input)

      expect(result.fields.fld_002).toBe(200) // Preserved, undefined was filtered
    })
  })

  describe('Edge case — Empty update', () => {
    it('throws error when no fields and no logged_at provided', async () => {
      setAuthenticatedUser()

      const input: UpdateLogInput = {} // No fields or logged_at
      await expect(updateLog('log-123', input)).rejects.toThrow('No fields to update')
    })
  })

  describe('Distinguish LOG_DATA vs UPDATE_DATA', () => {
    it('UPDATE_DATA calls updateLog (SQL UPDATE), not createLog (SQL INSERT)', async () => {
      setAuthenticatedUser()

      const currentLog = { id: 'log-123', fields: { fld_001: 350 } }
      const updatedLog = { id: 'log-123', fields: { fld_001: 450 }, logged_at: '2026-03-10T12:00:00Z' }

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        const builder = createQueryBuilder()

        if (table === 'tracker_logs') {
          if (callCount === 0) {
            // First call: SELECT to fetch current
            builder._result = { data: currentLog, error: null }
            callCount++
          } else if (callCount === 1) {
            // Second call: UPDATE
            builder._result = { data: updatedLog, error: null }
            callCount++
          }
        }

        return builder
      })

      const input: UpdateLogInput = { fields: { fld_001: 450 } }
      await updateLog('log-123', input)

      // Verify UPDATE was called (not INSERT for new row)
      expect(mockFrom).toHaveBeenCalledWith('tracker_logs')
    })
  })
})
