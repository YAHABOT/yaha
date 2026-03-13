import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock setup -----------------------------------------------------------

const mockUpsertUserProfile = vi.fn()

vi.mock('@/lib/db/users', () => ({
  upsertUserProfile: (...args: unknown[]) => mockUpsertUserProfile(...args),
}))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

// --- Import under test (after mocks) --------------------------------------

import { saveSettingsAction } from '@/app/actions/settings'

// --- Helpers --------------------------------------------------------------

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value)
  }
  return fd
}

// --- Tests ----------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('saveSettingsAction', () => {
  it('returns success and calls upsertUserProfile on valid input', async () => {
    mockUpsertUserProfile.mockResolvedValue({ id: 'u-1', alias: 'Alex', targets: {}, telegram_handle: null })

    const fd = makeFormData({
      alias: 'Alex',
      calories: '2000',
      sleep: '8',
      water: '2.5',
      steps: '10000',
      telegram_handle: 'alexhandle',
    })

    const result = await saveSettingsAction(fd)

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(mockUpsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        alias: 'Alex',
        targets: expect.objectContaining({ calories: 2000 }),
        telegram_handle: 'alexhandle',
      })
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings')
  })

  it('strips leading @ from telegram_handle', async () => {
    mockUpsertUserProfile.mockResolvedValue({ id: 'u-1', alias: null, targets: {}, telegram_handle: 'alexhandle' })

    const fd = makeFormData({ telegram_handle: '@alexhandle' })

    await saveSettingsAction(fd)

    expect(mockUpsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({ telegram_handle: 'alexhandle' })
    )
  })

  it('returns error when alias exceeds 50 characters', async () => {
    const fd = makeFormData({ alias: 'A'.repeat(51) })

    const result = await saveSettingsAction(fd)

    expect(result.error).toBe('Alias must be 50 characters or fewer.')
    expect(mockUpsertUserProfile).not.toHaveBeenCalled()
  })

  it('returns error when telegram_handle exceeds 50 characters after stripping @', async () => {
    const fd = makeFormData({ telegram_handle: 'a'.repeat(51) })

    const result = await saveSettingsAction(fd)

    expect(result.error).toBe('Telegram handle must be 50 characters or fewer.')
    expect(mockUpsertUserProfile).not.toHaveBeenCalled()
  })

  it('returns generic error on DAL failure — never the original message', async () => {
    mockUpsertUserProfile.mockRejectedValue(new Error('internal db constraint violation'))

    const fd = makeFormData({ alias: 'Alex' })
    const result = await saveSettingsAction(fd)

    expect(result.error).toBe('Failed to save settings')
    expect(result.error).not.toContain('internal db constraint violation')
    expect(result.success).toBeUndefined()
  })

  it('returns generic error for non-Error thrown values', async () => {
    mockUpsertUserProfile.mockRejectedValue('string thrown')

    const fd = makeFormData({ alias: 'Alex' })
    const result = await saveSettingsAction(fd)

    expect(result.error).toBe('Failed to save settings')
  })

  it('handles empty form data gracefully — all fields optional', async () => {
    mockUpsertUserProfile.mockResolvedValue({ id: 'u-1', alias: null, targets: {}, telegram_handle: null })

    const fd = makeFormData({})
    const result = await saveSettingsAction(fd)

    expect(result.success).toBe(true)
    expect(mockUpsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({ targets: {} })
    )
  })

  it('omits out-of-range numeric targets rather than persisting invalid values', async () => {
    mockUpsertUserProfile.mockResolvedValue({ id: 'u-1', alias: null, targets: {}, telegram_handle: null })

    const fd = makeFormData({
      calories: '99999',   // exceeds MAX_CALORIES of 10000
      sleep: '-5',         // below minimum
      water: '2',
      steps: '5000',
    })

    await saveSettingsAction(fd)

    const callArg = mockUpsertUserProfile.mock.calls[0][0]
    expect(callArg.targets).not.toHaveProperty('calories')
    expect(callArg.targets).not.toHaveProperty('sleep')
    expect(callArg.targets).toHaveProperty('water', 2)
    expect(callArg.targets).toHaveProperty('steps', 5000)
  })

  it('exact alias of 50 characters is accepted', async () => {
    mockUpsertUserProfile.mockResolvedValue({ id: 'u-1', alias: 'A'.repeat(50), targets: {}, telegram_handle: null })

    const fd = makeFormData({ alias: 'A'.repeat(50) })
    const result = await saveSettingsAction(fd)

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
  })
})
