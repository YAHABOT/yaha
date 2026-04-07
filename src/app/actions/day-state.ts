'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSafeUser } from '@/lib/supabase/auth'
import { revalidatePath } from 'next/cache'
import { skipStartDay, skipEndDay } from '@/lib/db/day-state'

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Skip Start Day — opens a session for today without running the morning routine.
 * date: client's local YYYY-MM-DD (must be provided by the calling component).
 */
export async function skipStartDayAction(date: string): Promise<{ error?: string }> {
  try {
    const user = await getSafeUser()
    if (!user) return { error: 'Unauthorized' }

    await skipStartDay(date)
    revalidatePath('/dashboard')
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Skip End Day — closes the currently open session without running the evening routine.
 * activeDate: the date of the currently open session (passed from dashboard state).
 */
export async function skipEndDayAction(activeDate: string): Promise<{ error?: string }> {
  try {
    const user = await getSafeUser()
    if (!user) return { error: 'Unauthorized' }

    await skipEndDay(activeDate)
    revalidatePath('/dashboard')
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Developer action: nulls both day_started_at and day_ended_at for today,
 * allowing Morning Check-in and End Day routines to be re-tested without
 * manually clearing the database.
 */
export async function resetDayStateAction(): Promise<{ error?: string }> {
  try {
    const supabase = await createServerClient()
    const user = await getSafeUser()
    if (!user) return { error: 'Unauthorized' }

    const today = getTodayDate()

    // If no row exists yet, nothing to reset — treat as success
    const { error } = await supabase
      .from('user_day_state')
      .update({ day_started_at: null, day_ended_at: null })
      .eq('user_id', user.id)
      .eq('date', today)

    if (error) return { error: error.message }

    revalidatePath('/dashboard')
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
