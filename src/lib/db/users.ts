import { createServerClient } from '@/lib/supabase/server'
import { getSafeUser } from '@/lib/supabase/auth'
import type { SupabaseClient } from '@supabase/supabase-js'

const USER_COLUMNS = 'id, alias, targets, stats, telegram_handle'

export type UserTargets = {
  calories?: number
  sleep?: number
  water?: number
  steps?: number
}

export type UserStats = {
  confirmOnRefresh?: boolean
}

export type User = {
  id: string
  alias: string | null
  targets: UserTargets
  stats: UserStats
  telegram_handle: string | null
}

export type UpsertUserInput = {
  alias?: string
  targets?: UserTargets
  stats?: UserStats
  telegram_handle?: string
}

export async function getUser(id?: string, supabaseClient?: SupabaseClient): Promise<User | null> {
  const supabase = supabaseClient ?? await createServerClient()
  let userId = id

  if (!userId) {
    const user = await getSafeUser()
    if (!user) throw new Error('Unauthorized')
    userId = user.id
  }

  const { data, error } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch user: ${error.message}`)
  if (!data) return null

  return {
    id: data.id,
    alias: data.alias ?? null,
    targets: (data.targets as UserTargets) ?? {},
    stats: (data.stats as UserStats) ?? {},
    telegram_handle: data.telegram_handle ?? null,
  }
}

export async function upsertUserProfile(input: UpsertUserInput): Promise<User> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const upsertPayload: Record<string, unknown> = { id: user.id }
  if (input.alias !== undefined) upsertPayload.alias = input.alias
  if (input.targets !== undefined) upsertPayload.targets = input.targets
  if (input.stats !== undefined) upsertPayload.stats = input.stats
  if (input.telegram_handle !== undefined) upsertPayload.telegram_handle = input.telegram_handle

  const { data, error } = await supabase
    .from('users')
    .upsert(upsertPayload, { onConflict: 'id' })
    .select(USER_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to upsert user profile: ${error.message}`)

  return {
    id: data.id,
    alias: data.alias ?? null,
    targets: (data.targets as UserTargets) ?? {},
    stats: (data.stats as UserStats) ?? {},
    telegram_handle: data.telegram_handle ?? null,
  }
}
