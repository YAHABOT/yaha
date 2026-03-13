import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock setup -----------------------------------------------------------

const mockCreateRoutine = vi.fn()
const mockUpdateRoutine = vi.fn()
const mockDeleteRoutine = vi.fn()

vi.mock('@/lib/db/routines', () => ({
  createRoutine: (...args: unknown[]) => mockCreateRoutine(...args),
  updateRoutine: (...args: unknown[]) => mockUpdateRoutine(...args),
  deleteRoutine: (...args: unknown[]) => mockDeleteRoutine(...args),
}))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

// --- Import under test (after mocks) --------------------------------------

import {
  createRoutineAction,
  updateRoutineAction,
  deleteRoutineAction,
} from '@/app/actions/routines'
import type { CreateRoutineInput } from '@/types/routine'

// --- Fixtures -------------------------------------------------------------

const validInput: CreateRoutineInput = {
  name: 'Morning Check-In',
  trigger_phrase: 'start day',
  type: 'day_start',
  steps: [],
}

// --- Tests ----------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createRoutineAction', () => {
  it('returns error when name is empty', async () => {
    const result = await createRoutineAction({ ...validInput, name: '' })
    expect(result.error).toBe('Name is required.')
    expect(mockCreateRoutine).not.toHaveBeenCalled()
  })

  it('returns error when name is only whitespace', async () => {
    const result = await createRoutineAction({ ...validInput, name: '   ' })
    expect(result.error).toBe('Name is required.')
    expect(mockCreateRoutine).not.toHaveBeenCalled()
  })

  it('returns error when name exceeds 50 characters', async () => {
    const result = await createRoutineAction({ ...validInput, name: 'A'.repeat(51) })
    expect(result.error).toBe('Name must be 50 characters or fewer.')
    expect(mockCreateRoutine).not.toHaveBeenCalled()
  })

  it('returns error when trigger_phrase is empty', async () => {
    const result = await createRoutineAction({ ...validInput, trigger_phrase: '' })
    expect(result.error).toBe('Trigger phrase is required.')
    expect(mockCreateRoutine).not.toHaveBeenCalled()
  })

  it('returns error when trigger_phrase is only whitespace', async () => {
    const result = await createRoutineAction({ ...validInput, trigger_phrase: '   ' })
    expect(result.error).toBe('Trigger phrase is required.')
    expect(mockCreateRoutine).not.toHaveBeenCalled()
  })

  it('returns error when trigger_phrase exceeds 100 characters', async () => {
    const result = await createRoutineAction({
      ...validInput,
      trigger_phrase: 'x'.repeat(101),
    })
    expect(result.error).toBe('Trigger phrase must be 100 characters or fewer.')
    expect(mockCreateRoutine).not.toHaveBeenCalled()
  })

  it('calls createRoutine and revalidates on success', async () => {
    mockCreateRoutine.mockResolvedValue({ id: 'r-1', name: 'Morning Check-In' })

    const result = await createRoutineAction(validInput)

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(mockCreateRoutine).toHaveBeenCalledWith(validInput)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/routines')
  })

  it('returns generic error for caught exceptions', async () => {
    mockCreateRoutine.mockRejectedValue(new Error('duplicate key'))

    const result = await createRoutineAction(validInput)

    expect(result.error).toBe('Failed to create routine')
    expect(result.success).toBeUndefined()
  })

  it('returns generic error for non-Error exceptions', async () => {
    mockCreateRoutine.mockRejectedValue('string error')

    const result = await createRoutineAction(validInput)

    expect(result.error).toBe('Failed to create routine')
  })
})

describe('updateRoutineAction', () => {
  it('returns error when name is empty string', async () => {
    const result = await updateRoutineAction('r-1', { name: '' })
    expect(result.error).toBe('Name is required.')
    expect(mockUpdateRoutine).not.toHaveBeenCalled()
  })

  it('returns error when name exceeds 50 characters', async () => {
    const result = await updateRoutineAction('r-1', { name: 'A'.repeat(51) })
    expect(result.error).toBe('Name must be 50 characters or fewer.')
    expect(mockUpdateRoutine).not.toHaveBeenCalled()
  })

  it('returns error when trigger_phrase is empty string', async () => {
    const result = await updateRoutineAction('r-1', { trigger_phrase: '' })
    expect(result.error).toBe('Trigger phrase is required.')
    expect(mockUpdateRoutine).not.toHaveBeenCalled()
  })

  it('returns error when trigger_phrase exceeds 100 characters', async () => {
    const result = await updateRoutineAction('r-1', { trigger_phrase: 'x'.repeat(101) })
    expect(result.error).toBe('Trigger phrase must be 100 characters or fewer.')
    expect(mockUpdateRoutine).not.toHaveBeenCalled()
  })

  it('calls updateRoutine and revalidates on success', async () => {
    mockUpdateRoutine.mockResolvedValue({ id: 'r-1', name: 'Updated' })

    const result = await updateRoutineAction('r-1', { name: 'Updated' })

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(mockUpdateRoutine).toHaveBeenCalledWith('r-1', { name: 'Updated' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/routines')
  })

  it('skips name validation when name is not provided', async () => {
    mockUpdateRoutine.mockResolvedValue({ id: 'r-1' })

    const result = await updateRoutineAction('r-1', { type: 'standard' })

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
  })

  it('returns generic error for caught exceptions', async () => {
    mockUpdateRoutine.mockRejectedValue(new Error('not found'))

    const result = await updateRoutineAction('r-1', { name: 'Test' })

    expect(result.error).toBe('Failed to update routine')
  })
})

describe('deleteRoutineAction', () => {
  it('calls deleteRoutine and revalidates on success', async () => {
    mockDeleteRoutine.mockResolvedValue(undefined)

    const result = await deleteRoutineAction('r-1')

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(mockDeleteRoutine).toHaveBeenCalledWith('r-1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/routines')
  })

  it('returns generic error for caught exceptions', async () => {
    mockDeleteRoutine.mockRejectedValue(new Error('foreign key violation'))

    const result = await deleteRoutineAction('r-1')

    expect(result.error).toBe('Failed to delete routine')
    expect(result.success).toBeUndefined()
  })

  it('returns fallback error for non-Error exceptions', async () => {
    mockDeleteRoutine.mockRejectedValue('string error')

    const result = await deleteRoutineAction('r-1')

    expect(result.error).toBe('Failed to delete routine')
  })
})
