import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Routine } from '@/types/routine'

// --- Mock setup -----------------------------------------------------------

const mockGetRoutines = vi.fn()

vi.mock('@/lib/db/routines', () => ({
  getRoutines: () => mockGetRoutines(),
}))

// --- Import under test (after mocks) --------------------------------------

import { detectRoutineTrigger } from '@/lib/routines/detector'

// --- Fixtures -------------------------------------------------------------

const makeRoutine = (overrides: Partial<Routine> = {}): Routine => ({
  id: 'r-1',
  user_id: 'u-1',
  name: 'Morning Check-In',
  trigger_phrase: 'start day',
  type: 'day_start',
  steps: [],
  created_at: '2026-03-10T00:00:00Z',
  ...overrides,
})

// --- Tests ----------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('detectRoutineTrigger', () => {
  it('returns null when no routines exist', async () => {
    mockGetRoutines.mockResolvedValue([])

    const result = await detectRoutineTrigger('start day please')

    expect(result).toBeNull()
  })

  it('returns null when no routines match the message', async () => {
    mockGetRoutines.mockResolvedValue([makeRoutine({ trigger_phrase: 'evening log' })])

    const result = await detectRoutineTrigger('start day please')

    expect(result).toBeNull()
  })

  it('returns the matching routine when message contains trigger phrase', async () => {
    const routine = makeRoutine({ trigger_phrase: 'start day' })
    mockGetRoutines.mockResolvedValue([routine])

    const result = await detectRoutineTrigger("let's start day now")

    expect(result).toEqual(routine)
  })

  it('matches case-insensitively', async () => {
    const routine = makeRoutine({ trigger_phrase: 'Start Day' })
    mockGetRoutines.mockResolvedValue([routine])

    const result = await detectRoutineTrigger('start day please')

    expect(result).toEqual(routine)
  })

  it('matches message case-insensitively', async () => {
    const routine = makeRoutine({ trigger_phrase: 'start day' })
    mockGetRoutines.mockResolvedValue([routine])

    const result = await detectRoutineTrigger('START DAY please')

    expect(result).toEqual(routine)
  })

  it('returns first match when multiple routines could match', async () => {
    const firstRoutine = makeRoutine({ id: 'r-1', trigger_phrase: 'start' })
    const secondRoutine = makeRoutine({ id: 'r-2', trigger_phrase: 'start day' })
    mockGetRoutines.mockResolvedValue([firstRoutine, secondRoutine])

    const result = await detectRoutineTrigger('start day')

    expect(result?.id).toBe('r-1')
  })

  it('returns null when message is empty', async () => {
    const routine = makeRoutine({ trigger_phrase: 'start day' })
    mockGetRoutines.mockResolvedValue([routine])

    const result = await detectRoutineTrigger('')

    expect(result).toBeNull()
  })

  it('returns null when message is only whitespace', async () => {
    const routine = makeRoutine({ trigger_phrase: 'start day' })
    mockGetRoutines.mockResolvedValue([routine])

    const result = await detectRoutineTrigger('   ')

    expect(result).toBeNull()
  })

  it('calls getRoutines without arguments (auth is internal)', async () => {
    mockGetRoutines.mockResolvedValue([])

    await detectRoutineTrigger('some message')

    expect(mockGetRoutines).toHaveBeenCalledTimes(1)
    expect(mockGetRoutines).toHaveBeenCalledWith()
  })
})
