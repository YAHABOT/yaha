'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSafeUser } from '@/lib/supabase/auth'
import { revalidatePath } from 'next/cache'

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
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
