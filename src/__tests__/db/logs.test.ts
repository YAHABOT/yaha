import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CreateLogInput, UpdateLogInput } from '@/types/log'

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
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.lt = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.single = vi.fn(() => builder)
  builder.range = vi.fn(() => builder)

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
  createLog,
  getLogs,
  getLogsForDay,
  getLog,
  updateLog,
  deleteLog,
} from '@/lib/db/logs'

// --- Tests ----------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  queryBuilder = createQueryBuilder()
  mockFrom.mockReturnValue(queryBuilder)
})

describe('createLog', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    const input: CreateLogInput = {
      tracker_id: 'tracker-1',
      fields: { fld_001: 350 },
    }
    await expect(createLog(input)).rejects.toThrow('Unauthorized')
  })

  it('uses default source "manual" when not provided', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 'log-1', source: 'manual' })

    await createLog({ tracker_id: 'tracker-1', fields: { fld_001: 350 } })

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tracker_id: 'tracker-1',
        user_id: FAKE_USER.id,
        fields: { fld_001: 350 },
        source: 'manual',
      })
    )
  })

  it('uses provided source and logged_at when given', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 'log-1' })

    const loggedAt = '2026-03-09T10:00:00.000Z'
    await createLog({
      tracker_id: 'tracker-1',
      fields: { fld_001: 200 },
      logged_at: loggedAt,
      source: 'telegram',
    })

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        logged_at: loggedAt,
        source: 'telegram',
      })
    )
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'foreign key violation' })

    await expect(
      createLog({ tracker_id: 'bad-id', fields: {} })
    ).rejects.toThrow('Failed to create log: foreign key violation')
  })
})

describe('getLogs', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(getLogs('tracker-1')).rejects.toThrow('Unauthorized')
  })

  it('applies default pagination (limit 50, offset 0)', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getLogs('tracker-1')

    expect(queryBuilder.range).toHaveBeenCalledWith(0, 49)
  })

  it('applies custom pagination when provided', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getLogs('tracker-1', { limit: 10, offset: 20 })

    expect(queryBuilder.range).toHaveBeenCalledWith(20, 29)
  })

  it('applies date range filters when provided', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    const startDate = '2026-03-01T00:00:00.000Z'
    const endDate = '2026-03-09T23:59:59.999Z'

    await getLogs('tracker-1', { startDate, endDate })

    expect(queryBuilder.gte).toHaveBeenCalledWith('logged_at', startDate)
    expect(queryBuilder.lte).toHaveBeenCalledWith('logged_at', endDate)
  })

  it('does not apply date filters when not provided', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getLogs('tracker-1')

    expect(queryBuilder.gte).not.toHaveBeenCalled()
    expect(queryBuilder.lte).not.toHaveBeenCalled()
  })

  it('orders by logged_at descending', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getLogs('tracker-1')

    expect(queryBuilder.order).toHaveBeenCalledWith('logged_at', { ascending: false })
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'connection timeout' })

    await expect(getLogs('tracker-1')).rejects.toThrow(
      'Failed to fetch logs: connection timeout'
    )
  })
})

describe('getLogsForDay', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(getLogsForDay('2026-03-09')).rejects.toThrow('Unauthorized')
  })

  it('filters by date range correctly (start of day to start of next day)', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getLogsForDay('2026-03-09')

    expect(queryBuilder.gte).toHaveBeenCalledWith('logged_at', '2026-03-09T00:00:00.000Z')
    expect(queryBuilder.lt).toHaveBeenCalledWith('logged_at', '2026-03-10T00:00:00.000Z')
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'table not found' })

    await expect(getLogsForDay('2026-03-09')).rejects.toThrow(
      'Failed to fetch logs for day: table not found'
    )
  })
})

describe('getLog', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(getLog('log-1')).rejects.toThrow('Unauthorized')
  })

  it('fetches a single log by id', async () => {
    setAuthenticatedUser()
    const log = { id: 'log-1', fields: { fld_001: 350 } }
    setQueryResult(log)

    const result = await getLog('log-1')

    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'log-1')
    expect(queryBuilder.single).toHaveBeenCalled()
    expect(result).toEqual(log)
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'row not found' })

    await expect(getLog('nonexistent')).rejects.toThrow(
      'Failed to fetch log: row not found'
    )
  })
})

describe('updateLog', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    const input: UpdateLogInput = { fields: { fld_001: 400 } }
    await expect(updateLog('log-1', input)).rejects.toThrow('Unauthorized')
  })

  it('throws "No fields to update" when given empty input', async () => {
    setAuthenticatedUser()
    await expect(updateLog('log-1', {})).rejects.toThrow('No fields to update')
  })

  it('only sends defined fields in update payload', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 'log-1', fields: { fld_001: 500 } })

    await updateLog('log-1', { fields: { fld_001: 500 } })

    const updateCall = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>
    expect(updateCall).toHaveProperty('fields', { fld_001: 500 })
    expect(updateCall).not.toHaveProperty('logged_at')
  })

  it('includes user_id filter for defense in depth', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 'log-1' })

    await updateLog('log-1', { fields: { fld_001: 500 } })

    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'log-1')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'row not found' })

    await expect(
      updateLog('log-1', { fields: { fld_001: 999 } })
    ).rejects.toThrow('Failed to fetch log for merge: row not found')
  })
})

describe('deleteLog', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(deleteLog('log-1')).rejects.toThrow('Unauthorized')
  })

  it('includes user_id filter for defense in depth', async () => {
    setAuthenticatedUser()
    setQueryResult(null)

    await deleteLog('log-1')

    expect(queryBuilder.delete).toHaveBeenCalled()
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'log-1')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'constraint violation' })

    await expect(deleteLog('log-1')).rejects.toThrow(
      'Failed to delete log: constraint violation'
    )
  })
})
