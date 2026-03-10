import { createServerClient } from '@/lib/supabase/server'
import type { Tracker, CreateTrackerInput, UpdateTrackerInput } from '@/types/tracker'

const DEFAULT_COLOR = '#10b981'
const DEFAULT_TYPE = 'custom'

const TRACKER_COLUMNS = 'id, user_id, name, type, color, schema, created_at, updated_at'

export async function getTrackers(): Promise<Tracker[]> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('trackers')
    .select(TRACKER_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch trackers: ${error.message}`)
  return data as Tracker[]
}

export async function getTracker(id: string): Promise<Tracker> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('trackers')
    .select(TRACKER_COLUMNS)
    .eq('id', id)
    .single()

  if (error) throw new Error(`Failed to fetch tracker: ${error.message}`)
  return data as Tracker
}

export async function createTracker(input: CreateTrackerInput): Promise<Tracker> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const trimmedName = input.name.trim()
  if (!trimmedName) throw new Error('Tracker name is required')

  const { data, error } = await supabase
    .from('trackers')
    .insert({
      user_id: user.id,
      name: trimmedName,
      type: input.type ?? DEFAULT_TYPE,
      color: input.color ?? DEFAULT_COLOR,
      schema: input.schema ?? [],
    })
    .select(TRACKER_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to create tracker: ${error.message}`)
  return data as Tracker
}

export async function updateTracker(
  id: string,
  input: UpdateTrackerInput
): Promise<Tracker> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.type !== undefined) updates.type = input.type
  if (input.color !== undefined) updates.color = input.color
  if (input.schema !== undefined) updates.schema = input.schema

  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update')
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('trackers')
    .update(updates)
    .eq('id', id)
    .select(TRACKER_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to update tracker: ${error.message}`)
  return data as Tracker
}

export async function deleteTracker(id: string): Promise<void> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('trackers')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to delete tracker: ${error.message}`)
}
