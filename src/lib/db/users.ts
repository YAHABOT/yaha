import { createServerClient } from '@/lib/supabase/server'

const USER_COLUMNS = 'id, alias, targets, telegram_handle'

export type UserTargets = {
  calories?: number
  sleep?: number
  water?: number
  steps?: number
}

export type User = {
  id: string
  alias: string | null
  targets: UserTargets
  telegram_handle: string | null
}

export type UpsertUserInput = {
  alias?: string
  targets?: UserTargets
  telegram_handle?: string
}

export async function getUser(): Promise<User | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch user: ${error.message}`)
  if (!data) return null

  return {
    id: data.id,
    alias: data.alias ?? null,
    targets: (data.targets as UserTargets) ?? {},
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
    telegram_handle: data.telegram_handle ?? null,
  }
}
