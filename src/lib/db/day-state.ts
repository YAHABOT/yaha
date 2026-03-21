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

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export async function getDayState(date?: string, supabaseClient?: SupabaseClient): Promise<UserDayState | null> {
  const supabase = supabaseClient ?? await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const d = date ?? getTodayDate()

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

export async function markDayStarted(): Promise<void> {
  const supabase = await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const today = getTodayDate()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('user_day_state')
    .upsert({
      user_id: user.id,
      date: today,
      day_started_at: now,
      updated_at: now,
    }, { onConflict: 'user_id,date' })

  if (error) throw new Error(`Failed to mark day started: ${error.message}`)
}

export async function markDayEnded(): Promise<void> {
  const supabase = await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const today = getTodayDate()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('user_day_state')
    .upsert({
      user_id: user.id,
      date: today,
      day_ended_at: now,
      updated_at: now,
    }, { onConflict: 'user_id,date' })

  if (error) throw new Error(`Failed to mark day ended: ${error.message}`)
}
