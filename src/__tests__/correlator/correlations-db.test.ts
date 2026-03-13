import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CreateCorrelationInput, FormulaNode } from '@/types/correlator'

// --- Mock setup -----------------------------------------------------------

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
  builder.order = vi.fn(() => builder)
  builder.single = vi.fn(() => builder)

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

const SAMPLE_FORMULA: FormulaNode = {
  type: 'op',
  operator: '+',
  left: { type: 'field', trackerId: 'tracker-1', fieldId: 'fld_001' },
  right: { type: 'field', trackerId: 'tracker-2', fieldId: 'fld_001' },
}

const SAMPLE_CORRELATION = {
  id: 'corr-1',
  user_id: FAKE_USER.id,
  name: 'Total Calories',
  formula: SAMPLE_FORMULA,
  unit: 'kcal',
  created_at: '2026-03-10T00:00:00.000Z',
}

// --- Import under test (after mocks) --------------------------------------

import {
  getCorrelations,
  getCorrelation,
  createCorrelation,
  updateCorrelation,
  deleteCorrelation,
} from '@/lib/db/correlations'

// --- Tests ----------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  queryBuilder = createQueryBuilder()
  mockFrom.mockReturnValue(queryBuilder)
})

describe('getCorrelations', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(getCorrelations()).rejects.toThrow('Unauthorized')
  })

  it('calls from("correlations") with correct select columns', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getCorrelations()

    expect(mockFrom).toHaveBeenCalledWith('correlations')
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'id, user_id, name, formula, unit, created_at'
    )
  })

  it('orders results by created_at descending', async () => {
    setAuthenticatedUser()
    setQueryResult([])

    await getCorrelations()

    expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('returns correlation data on success', async () => {
    setAuthenticatedUser()
    setQueryResult([SAMPLE_CORRELATION])

    const result = await getCorrelations()

    expect(result).toEqual([SAMPLE_CORRELATION])
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'connection timeout' })

    await expect(getCorrelations()).rejects.toThrow(
      'Failed to fetch correlations: connection timeout'
    )
  })
})

describe('getCorrelation', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(getCorrelation('corr-1')).rejects.toThrow('Unauthorized')
  })

  it('filters by id using .eq()', async () => {
    setAuthenticatedUser()
    setQueryResult(SAMPLE_CORRELATION)

    await getCorrelation('corr-1')

    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'corr-1')
  })

  it('calls .single() to expect exactly one row', async () => {
    setAuthenticatedUser()
    setQueryResult(SAMPLE_CORRELATION)

    await getCorrelation('corr-1')

    expect(queryBuilder.single).toHaveBeenCalled()
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'row not found' })

    await expect(getCorrelation('nonexistent')).rejects.toThrow(
      'Failed to fetch correlation: row not found'
    )
  })
})

describe('createCorrelation', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    const input: CreateCorrelationInput = {
      name: 'Total Calories',
      formula: SAMPLE_FORMULA,
      unit: 'kcal',
    }
    await expect(createCorrelation(input)).rejects.toThrow('Unauthorized')
  })

  it('inserts with correct fields including user_id', async () => {
    setAuthenticatedUser()
    setQueryResult(SAMPLE_CORRELATION)

    await createCorrelation({
      name: 'Total Calories',
      formula: SAMPLE_FORMULA,
      unit: 'kcal',
    })

    expect(queryBuilder.insert).toHaveBeenCalledWith({
      user_id: FAKE_USER.id,
      name: 'Total Calories',
      formula: SAMPLE_FORMULA,
      unit: 'kcal',
    })
  })

  it('returns the created correlation on success', async () => {
    setAuthenticatedUser()
    setQueryResult(SAMPLE_CORRELATION)

    const result = await createCorrelation({
      name: 'Total Calories',
      formula: SAMPLE_FORMULA,
      unit: 'kcal',
    })

    expect(result).toEqual(SAMPLE_CORRELATION)
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'duplicate key' })

    await expect(
      createCorrelation({ name: 'Test', formula: SAMPLE_FORMULA, unit: '' })
    ).rejects.toThrow('Failed to create correlation: duplicate key')
  })
})

describe('updateCorrelation', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(updateCorrelation('corr-1', { name: 'New Name' })).rejects.toThrow('Unauthorized')
  })

  it('throws "No fields to update" when given empty input', async () => {
    setAuthenticatedUser()
    await expect(updateCorrelation('corr-1', {})).rejects.toThrow('No fields to update')
  })

  it('only includes defined fields in update payload', async () => {
    setAuthenticatedUser()
    setQueryResult({ ...SAMPLE_CORRELATION, name: 'Updated Name' })

    await updateCorrelation('corr-1', { name: 'Updated Name' })

    const updateCall = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>
    expect(updateCall).toHaveProperty('name', 'Updated Name')
    expect(updateCall).not.toHaveProperty('formula')
    expect(updateCall).not.toHaveProperty('unit')
  })

  it('includes user_id filter for defense in depth', async () => {
    setAuthenticatedUser()
    setQueryResult(SAMPLE_CORRELATION)

    await updateCorrelation('corr-1', { unit: 'g' })

    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'corr-1')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'row not found' })

    await expect(updateCorrelation('corr-1', { name: 'X' })).rejects.toThrow(
      'Failed to update correlation: row not found'
    )
  })
})

describe('deleteCorrelation', () => {
  it('throws Unauthorized when no user is authenticated', async () => {
    setUnauthenticatedUser()
    await expect(deleteCorrelation('corr-1')).rejects.toThrow('Unauthorized')
  })

  it('includes both id and user_id filters for defense in depth', async () => {
    setAuthenticatedUser()
    setQueryResult(null)

    await deleteCorrelation('corr-1')

    expect(queryBuilder.delete).toHaveBeenCalled()
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'corr-1')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', FAKE_USER.id)
  })

  it('propagates Supabase errors with descriptive message', async () => {
    setAuthenticatedUser()
    setQueryResult(null, { message: 'foreign key violation' })

    await expect(deleteCorrelation('corr-1')).rejects.toThrow(
      'Failed to delete correlation: foreign key violation'
    )
  })

  it('resolves without error on success', async () => {
    setAuthenticatedUser()
    setQueryResult(null)

    await expect(deleteCorrelation('corr-1')).resolves.toBeUndefined()
  })
})
