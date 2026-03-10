import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock setup -----------------------------------------------------------

const mockCreateTracker = vi.fn()
const mockUpdateTracker = vi.fn()
const mockDeleteTracker = vi.fn()

vi.mock('@/lib/db/trackers', () => ({
  createTracker: (...args: unknown[]) => mockCreateTracker(...args),
  updateTracker: (...args: unknown[]) => mockUpdateTracker(...args),
  deleteTracker: (...args: unknown[]) => mockDeleteTracker(...args),
}))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

// --- Import under test (after mocks) --------------------------------------

import {
  createTrackerAction,
  updateTrackerAction,
  deleteTrackerAction,
} from '@/app/actions/trackers'

// --- Tests ----------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createTrackerAction', () => {
  it('returns error when name is empty', async () => {
    const result = await createTrackerAction({ name: '' })
    expect(result.error).toBe('Tracker name is required.')
    expect(mockCreateTracker).not.toHaveBeenCalled()
  })

  it('returns error when name is only whitespace', async () => {
    const result = await createTrackerAction({ name: '   ' })
    expect(result.error).toBe('Tracker name is required.')
  })

  it('returns error when name exceeds 50 characters', async () => {
    const longName = 'A'.repeat(51)
    const result = await createTrackerAction({ name: longName })
    expect(result.error).toBe('Name must be 50 characters or fewer.')
  })

  it('returns error when schema exceeds 20 fields', async () => {
    const schema = Array.from({ length: 21 }, (_, i) => ({
      fieldId: `fld_${i}`,
      label: `Field ${i}`,
      type: 'number' as const,
    }))
    const result = await createTrackerAction({ name: 'Test', schema })
    expect(result.error).toBe('Maximum 20 fields per tracker.')
  })

  it('calls createTracker and revalidates on success', async () => {
    mockCreateTracker.mockResolvedValue({ id: 't-1', name: 'Test' })

    const result = await createTrackerAction({ name: 'Test', type: 'nutrition' })

    expect(result.error).toBeUndefined()
    expect(mockCreateTracker).toHaveBeenCalledWith({
      name: 'Test',
      type: 'nutrition',
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/trackers')
  })

  it('returns error message from caught exceptions', async () => {
    mockCreateTracker.mockRejectedValue(new Error('duplicate key'))

    const result = await createTrackerAction({ name: 'Test' })

    expect(result.error).toBe('duplicate key')
  })

  it('returns fallback error for non-Error exceptions', async () => {
    mockCreateTracker.mockRejectedValue('string error')

    const result = await createTrackerAction({ name: 'Test' })

    expect(result.error).toBe('Failed to create tracker')
  })
})

describe('updateTrackerAction', () => {
  it('returns error when name is empty string', async () => {
    const result = await updateTrackerAction('t-1', { name: '' })
    expect(result.error).toBe('Tracker name is required.')
    expect(mockUpdateTracker).not.toHaveBeenCalled()
  })

  it('returns error when name exceeds 50 characters', async () => {
    const result = await updateTrackerAction('t-1', { name: 'A'.repeat(51) })
    expect(result.error).toBe('Name must be 50 characters or fewer.')
  })

  it('calls updateTracker and revalidates on success', async () => {
    mockUpdateTracker.mockResolvedValue({ id: 't-1', name: 'Updated' })

    const result = await updateTrackerAction('t-1', { name: 'Updated' })

    expect(result.error).toBeUndefined()
    expect(mockUpdateTracker).toHaveBeenCalledWith('t-1', { name: 'Updated' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/trackers')
  })

  it('returns error message from caught exceptions', async () => {
    mockUpdateTracker.mockRejectedValue(new Error('not found'))

    const result = await updateTrackerAction('t-1', { name: 'X' })

    expect(result.error).toBe('not found')
  })
})

describe('deleteTrackerAction', () => {
  it('calls deleteTracker and revalidates on success', async () => {
    mockDeleteTracker.mockResolvedValue(undefined)

    const result = await deleteTrackerAction('t-1')

    expect(result.error).toBeUndefined()
    expect(mockDeleteTracker).toHaveBeenCalledWith('t-1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/trackers')
  })

  it('returns error message from caught exceptions', async () => {
    mockDeleteTracker.mockRejectedValue(new Error('foreign key violation'))

    const result = await deleteTrackerAction('t-1')

    expect(result.error).toBe('foreign key violation')
  })
})
