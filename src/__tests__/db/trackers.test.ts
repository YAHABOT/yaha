import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CreateTrackerInput, UpdateTrackerInput, SchemaField } from '@/types/tracker'

const mockGetSafeUser = vi.hoisted(() => vi.fn())

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
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.or = vi.fn(() => builder)
  builder.is = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => builder)

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

vi.mock('@/lib/supabase/auth', () => ({
  getSafeUser: mockGetSafeUser,
}))

vi.mock('@/lib/db/logs', () => ({
  getTrackerLogSummaries: vi.fn().mockResolvedValue([]),
}))

// --- Helpers ---------------------------------------------------------------

const FAKE_USER = { id: 'user-123', email: 'test@example.com' }

function setAuthenticatedUser(): void {
  mockGetUser.mockResolvedValue({ data: { user: FAKE_USER }, error: null })
  mockGetSafeUser.mockResolvedValue(FAKE_USER)
}

function setUnauthenticatedUser(): void {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
  mockGetSafeUser.mockResolvedValue(null)
}

/**
 * Set the result that the query builder will resolve to when awaited.
 * Since the builder is thenable via its `.then` property, any `await` on
 * the chain will pick up this result.
 */
function setQueryResult(data: unknown, error: { message: string } | null = null): void {
  queryBuilder._result = { data, error }
}

// --- Import under test (after mocks) --------------------------------------

import {
  getTrackers,
  getTracker,
  createTracker,
  updateTracker,
  deleteTracker,
} from '@/lib/db/trackers'

// --- Tests ----------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  queryBuilder = createQueryBuilder()
  mockFrom.mockReturnValue(queryBuilder)
})

describe('getTrackers', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(getTrackers()).rejects.toThrow('Unauthorized')
  })

  it('calls from("trackers") with correct select columns', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getTrackers()

    expect(mockFrom).toHaveBeenCalledWith('trackers')
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'id, user_id, name, type, color, schema, created_at, updated_at'
    )
  })

  it('orders results by created_at descending', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getTrackers()

    expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'connection timeout' })

    await expect(getTrackers()).rejects.toThrow(
      'Failed to fetch trackers: connection timeout'
    )
  })

  it('returns tracker data on success', async () => {
    setAuthenticatedUser()
    const trackers = [{ id: 't-1', name: 'Nutrition', schema: [] }]
    setQueryResult(trackers)

    const result = await getTrackers()

    // getTrackers augments trackers with today_stats and summary data
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 't-1', name: 'Nutrition' }),
    ]))
  })
})

describe('getTracker', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(getTracker('t-1')).rejects.toThrow('Unauthorized')
  })

  it('filters by id using .eq()', async () => {
    setAuthenticatedUser()
    const tracker = { id: 't-1', name: 'Sleep' }
    setQueryResult(tracker)

    await getTracker('t-1')

    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 't-1')
  })

  it('calls .single() to expect exactly one row', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 't-1', name: 'Sleep' })

    await getTracker('t-1')

    expect(queryBuilder.single).toHaveBeenCalled()
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'row not found' })

    await expect(getTracker('nonexistent')).rejects.toThrow(
      'Failed to fetch tracker: row not found'
    )
  })
})

describe('createTracker', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    const input: CreateTrackerInput = { name: 'Test' }
    await expect(createTracker(input)).rejects.toThrow('Unauthorized')
  })

  it('uses defaults when optional fields not provided', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 't-1', name: 'Calories' })

    await createTracker({ name: 'Calories' })

    expect(queryBuilder.insert).toHaveBeenCalledWith({
      user_id: FAKE_USER.id,
      name: 'Calories',
      type: 'custom',
      color: '#10b981',
      schema: [],
    })
  })

  it('trims whitespace from name', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 't-1', name: 'Calories' })

    await createTracker({ name: '  Calories  ' })

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Calories' })
    )
  })

  it('throws when name is empty after trimming', async () => {
    setAuthenticatedUser()

    await expect(createTracker({ name: '   ' })).rejects.toThrow(
      'Tracker name is required'
    )
  })

  it('passes provided optional fields through', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 't-1' })

    const schema: SchemaField[] = [
      { fieldId: 'fld_001', label: 'Calories', type: 'number', unit: 'kcal' },
    ]

    await createTracker({
      name: 'Nutrition',
      type: 'nutrition',
      color: '#10b981',
      schema,
    })

    expect(queryBuilder.insert).toHaveBeenCalledWith({
      user_id: FAKE_USER.id,
      name: 'Nutrition',
      type: 'nutrition',
      color: '#10b981',
      schema,
    })
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'duplicate key' })

    await expect(createTracker({ name: 'Test' })).rejects.toThrow(
      'Failed to create tracker: duplicate key'
    )
  })
})

describe('updateTracker', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    const input: UpdateTrackerInput = { name: 'New Name' }
    await expect(updateTracker('t-1', input)).rejects.toThrow('Unauthorized')
  })

  it('throws "No fields to update" when given empty input', async () => {
    setAuthenticatedUser()

    await expect(updateTracker('t-1', {})).rejects.toThrow('No fields to update')
  })

  it('only includes defined fields in update payload', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 't-1', name: 'Updated' })

    await updateTracker('t-1', { name: 'Updated' })

    const updateCall = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>
    expect(updateCall).toHaveProperty('name', 'Updated')
    expect(updateCall).toHaveProperty('updated_at')
    expect(updateCall).not.toHaveProperty('type')
    expect(updateCall).not.toHaveProperty('color')
    expect(updateCall).not.toHaveProperty('schema')
  })

  it('trims whitespace from name when updating', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 't-1', name: 'Trimmed' })

    await updateTracker('t-1', { name: '  Trimmed  ' })

    const updateCall = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.name).toBe('Trimmed')
  })

  it('includes updated_at in the payload', async () => {
    setAuthenticatedUser()
    setQueryResult({ id: 't-1' })

    await updateTracker('t-1', { color: '#ff0000' })

    const updateCall = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>
    expect(updateCall).toHaveProperty('updated_at')
    expect(typeof updateCall.updated_at).toBe('string')
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'row not found' })

    await expect(updateTracker('t-1', { name: 'X' })).rejects.toThrow(
      'Failed to update tracker: row not found'
    )
  })
})

describe('deleteTracker', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(deleteTracker('t-1')).rejects.toThrow('Unauthorized')
  })

  it('includes user_id filter for defense in depth', async () => {
    setAuthenticatedUser()
    setQueryResult(null)

    await deleteTracker('t-1')

    expect(queryBuilder.delete).toHaveBeenCalled()
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 't-1')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'foreign key violation' })

    await expect(deleteTracker('t-1')).rejects.toThrow(
      'Failed to delete tracker: foreign key violation'
    )
  })
})
