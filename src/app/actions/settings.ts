'use server'

import { revalidatePath } from 'next/cache'
import { upsertUserProfile } from '@/lib/db/users'
import type { UserTargets } from '@/lib/db/users'

const MAX_ALIAS_LENGTH = 50
const MAX_TELEGRAM_LENGTH = 50
const MAX_CALORIES = 10000
const MAX_SLEEP = 24
const MAX_WATER = 20
const MAX_STEPS = 100000
const MIN_TARGET_VALUE = 0

function parseOptionalPositiveInt(
  raw: string | null,
  max: number
): number | undefined {
  if (!raw || raw.trim() === '') return undefined
  const n = Number(raw)
  if (!Number.isFinite(n)) return undefined
  if (n < MIN_TARGET_VALUE || n > max) return undefined
  return Math.floor(n)
}

function parseOptionalPositiveFloat(
  raw: string | null,
  max: number
): number | undefined {
  if (!raw || raw.trim() === '') return undefined
  const n = Number(raw)
  if (!Number.isFinite(n)) return undefined
  if (n < MIN_TARGET_VALUE || n > max) return undefined
  return n
}

function stripLeadingAt(handle: string): string {
  return handle.startsWith('@') ? handle.slice(1) : handle
}

export async function saveSettingsAction(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  try {
    const rawAlias = formData.get('alias') as string | null
    const rawCalories = formData.get('calories') as string | null
    const rawSleep = formData.get('sleep') as string | null
    const rawWater = formData.get('water') as string | null
    const rawSteps = formData.get('steps') as string | null
    const rawTelegramHandle = formData.get('telegram_handle') as string | null

    // Validate alias
    const alias = rawAlias?.trim() ?? ''
    if (alias.length > MAX_ALIAS_LENGTH) {
      return { error: `Alias must be ${MAX_ALIAS_LENGTH} characters or fewer.` }
    }

    // Validate telegram handle
    const rawHandle = rawTelegramHandle?.trim() ?? ''
    const telegramHandle = stripLeadingAt(rawHandle)
    if (telegramHandle.length > MAX_TELEGRAM_LENGTH) {
      return { error: `Telegram handle must be ${MAX_TELEGRAM_LENGTH} characters or fewer.` }
    }

    // Parse numeric targets
    const calories = parseOptionalPositiveInt(rawCalories, MAX_CALORIES)
    const sleep = parseOptionalPositiveFloat(rawSleep, MAX_SLEEP)
    const water = parseOptionalPositiveFloat(rawWater, MAX_WATER)
    const steps = parseOptionalPositiveInt(rawSteps, MAX_STEPS)

    const targets: UserTargets = {}
    if (calories !== undefined) targets.calories = calories
    if (sleep !== undefined) targets.sleep = sleep
    if (water !== undefined) targets.water = water
    if (steps !== undefined) targets.steps = steps

    await upsertUserProfile({
      alias: alias || undefined,
      targets,
      telegram_handle: telegramHandle || undefined,
    })

    revalidatePath('/settings')
    return { success: true }
  } catch {
    return { error: 'Failed to save settings' }
  }
}
