import { createServerClient } from '@/lib/supabase/server'
import { getSafeUser } from '@/lib/supabase/auth'
import type { SupabaseClient } from '@supabase/supabase-js'

export type UserDayState = {
  id: string
  user_id: string
  date: string
  day_started_at: string | null
  day_ended_at: string | null
}

export async function getDayState(date?: string, supabaseClient?: SupabaseClient): Promise<UserDayState | null> {
  const supabase = supabaseClient ?? await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  // If no date given, fall back to UTC server date
  const d = date ?? new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('user_day_state')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', d)
    .single()

  if (error && error.code === 'PGRST116') return null // no row = not started
  if (error) throw new Error(`Failed to fetch day state: ${error.message}`)
  return data as UserDayState
}

/**
 * Returns the currently open day session — a day that was started but not yet ended.
 * This is the authoritative "active logging date" for all chat messages.
 * Returns null when no session is open (neutral state).
 */
export async function getActiveDayState(supabaseClient?: SupabaseClient): Promise<UserDayState | null> {
  const supabase = supabaseClient ?? await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('user_day_state')
    .select('*')
    .eq('user_id', user.id)
    .not('day_started_at', 'is', null)
    .is('day_ended_at', null)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch active day state: ${error.message}`)
  return data as UserDayState | null
}

/**
 * Called when the Start Day routine is TRIGGERED (not completed).
 * date: the client's local YYYY-MM-DD (not UTC server date).
 * Also closes any other open sessions so there is never more than one active session.
 * This means starting 8/3 automatically closes the lingering 7/3 session.
 */
export async function markDayStarted(date: string): Promise<void> {
  const supabase = await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const now = new Date().toISOString()

  // Close any previously open sessions (different date) — prevents stale sessions
  // accumulating when the user skips End Day and starts a new day
  await supabase
    .from('user_day_state')
    .update({ day_ended_at: now, updated_at: now })
    .eq('user_id', user.id)
    .is('day_ended_at', null)
    .neq('date', date)

  const { error } = await supabase
    .from('user_day_state')
    .upsert({
      user_id: user.id,
      date,
      day_started_at: now,
      updated_at: now,
    }, { onConflict: 'user_id,date' })

  if (error) throw new Error(`Failed to mark day started: ${error.message}`)
}

/**
 * Called when the End Day routine completes.
 * Closes the currently open session (started but not ended) rather than
 * assuming it's today's UTC date — which would break for UTC+ users
 * finishing a session that started the previous local day.
 */
export async function markDayEnded(activeDate: string): Promise<void> {
  const supabase = await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const now = new Date().toISOString()

  const { error } = await supabase
    .from('user_day_state')
    .upsert({
      user_id: user.id,
      date: activeDate,
      day_ended_at: now,
      updated_at: now,
    }, { onConflict: 'user_id,date' })

  if (error) throw new Error(`Failed to mark day ended: ${error.message}`)
}
