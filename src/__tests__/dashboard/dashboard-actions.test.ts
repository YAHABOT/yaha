import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock setup -----------------------------------------------------------

const mockCreateWidget = vi.fn()
const mockDeleteWidget = vi.fn()
const mockReorderWidgets = vi.fn()

vi.mock('@/lib/db/dashboard', () => ({
  createWidget: (...args: unknown[]) => mockCreateWidget(...args),
  deleteWidget: (...args: unknown[]) => mockDeleteWidget(...args),
  reorderWidgets: (...args: unknown[]) => mockReorderWidgets(...args),
}))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

// --- Import under test (after mocks) --------------------------------------

import {
  createWidgetAction,
  deleteWidgetAction,
  reorderWidgetsAction,
} from '@/app/actions/dashboard'
import type { CreateWidgetInput } from '@/types/widget'

// --- Fixtures -------------------------------------------------------------

const validInput: CreateWidgetInput = {
  type: 'field_latest',
  label: 'Calories',
  position: 0,
  tracker_id: 'tracker-uuid',
  field_id: 'fld_001',
  days: 7,
}

// --- Tests ----------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createWidgetAction', () => {
  it('returns error when label is empty', async () => {
    const result = await createWidgetAction({ ...validInput, label: '' })
    expect(result.error).toBe('Label is required.')
    expect(mockCreateWidget).not.toHaveBeenCalled()
  })

  it('returns error when label is only whitespace', async () => {
    const result = await createWidgetAction({ ...validInput, label: '   ' })
    expect(result.error).toBe('Label is required.')
    expect(mockCreateWidget).not.toHaveBeenCalled()
  })

  it('returns error when label exceeds 50 characters', async () => {
    const result = await createWidgetAction({ ...validInput, label: 'A'.repeat(51) })
    expect(result.error).toBe('Label must be 50 characters or fewer.')
    expect(mockCreateWidget).not.toHaveBeenCalled()
  })

  it('returns error when type is invalid', async () => {
    const result = await createWidgetAction({
      ...validInput,
      type: 'invalid_type' as 'field_latest',
    })
    expect(result.error).toBe('Invalid widget type.')
    expect(mockCreateWidget).not.toHaveBeenCalled()
  })

  it('calls createWidget and revalidates on valid input', async () => {
    mockCreateWidget.mockResolvedValue({ id: 'w-1', ...validInput })

    const result = await createWidgetAction(validInput)

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(mockCreateWidget).toHaveBeenCalledWith({ ...validInput, label: 'Calories', days: 7 })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it('clamps days to lower bound (0 → 1)', async () => {
    mockCreateWidget.mockResolvedValue({ id: 'w-1' })

    await createWidgetAction({ ...validInput, days: 0 })

    expect(mockCreateWidget).toHaveBeenCalledWith(
      expect.objectContaining({ days: 1 })
    )
  })

  it('clamps days to upper bound (500 → 365)', async () => {
    mockCreateWidget.mockResolvedValue({ id: 'w-1' })

    await createWidgetAction({ ...validInput, days: 500 })

    expect(mockCreateWidget).toHaveBeenCalledWith(
      expect.objectContaining({ days: 365 })
    )
  })

  it('accepts all valid widget types', async () => {
    mockCreateWidget.mockResolvedValue({ id: 'w-1' })

    for (const type of ['field_latest', 'field_average', 'field_total', 'correlator'] as const) {
      vi.clearAllMocks()
      const result = await createWidgetAction({ ...validInput, type })
      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
    }
  })

  it('returns generic error on DAL failure', async () => {
    mockCreateWidget.mockRejectedValue(new Error('db constraint'))

    const result = await createWidgetAction(validInput)

    expect(result.error).toBe('Failed to create widget.')
    expect(result.success).toBeUndefined()
  })

  it('returns generic error for non-Error exceptions', async () => {
    mockCreateWidget.mockRejectedValue('string error')

    const result = await createWidgetAction(validInput)

    expect(result.error).toBe('Failed to create widget.')
  })
})

describe('deleteWidgetAction', () => {
  it('returns error when id is empty string', async () => {
    const result = await deleteWidgetAction('')
    expect(result.error).toBe('Widget ID is required.')
    expect(mockDeleteWidget).not.toHaveBeenCalled()
  })

  it('calls deleteWidget and revalidates on success', async () => {
    mockDeleteWidget.mockResolvedValue(undefined)

    const result = await deleteWidgetAction('w-1')

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(mockDeleteWidget).toHaveBeenCalledWith('w-1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it('returns generic error on DAL failure', async () => {
    mockDeleteWidget.mockRejectedValue(new Error('not found'))

    const result = await deleteWidgetAction('w-1')

    expect(result.error).toBe('Failed to delete widget.')
    expect(result.success).toBeUndefined()
  })

  it('returns generic error for non-Error exceptions', async () => {
    mockDeleteWidget.mockRejectedValue('string error')

    const result = await deleteWidgetAction('w-1')

    expect(result.error).toBe('Failed to delete widget.')
  })
})

describe('reorderWidgetsAction', () => {
  it('returns error for empty array', async () => {
    const result = await reorderWidgetsAction([])
    expect(result.error).toBe('orderedIds must be a non-empty array.')
    expect(mockReorderWidgets).not.toHaveBeenCalled()
  })

  it('returns error when IDs contain non-string values', async () => {
    const result = await reorderWidgetsAction([1, 2, 3] as unknown as string[])
    expect(result.error).toBe('All widget IDs must be strings.')
    expect(mockReorderWidgets).not.toHaveBeenCalled()
  })

  it('calls reorderWidgets and revalidates on success', async () => {
    mockReorderWidgets.mockResolvedValue(undefined)

    const ids = ['w-3', 'w-1', 'w-2']
    const result = await reorderWidgetsAction(ids)

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(mockReorderWidgets).toHaveBeenCalledWith(ids)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it('returns generic error on DAL failure', async () => {
    mockReorderWidgets.mockRejectedValue(new Error('timeout'))

    const result = await reorderWidgetsAction(['w-1', 'w-2'])

    expect(result.error).toBe('Failed to reorder widgets.')
    expect(result.success).toBeUndefined()
  })
})
