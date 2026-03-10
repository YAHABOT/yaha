import { createServerClient } from '@/lib/supabase/server'
import type { TrackerLog, CreateLogInput, UpdateLogInput } from '@/types/log'

const DEFAULT_LIMIT = 50
const DEFAULT_SOURCE = 'manual'

const LOG_COLUMNS = 'id, tracker_id, user_id, fields, logged_at, source, created_at'

type GetLogsOptions = {
  limit?: number
  offset?: number
  startDate?: string
  endDate?: string
}

export async function createLog(input: CreateLogInput): Promise<TrackerLog> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('tracker_logs')
    .insert({
      tracker_id: input.tracker_id,
      user_id: user.id,
      fields: input.fields,
      logged_at: input.logged_at ?? new Date().toISOString(),
      source: input.source ?? DEFAULT_SOURCE,
    })
    .select(LOG_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to create log: ${error.message}`)
  return data as TrackerLog
}

export async function getLogs(
  trackerId: string,
  options?: GetLogsOptions
): Promise<TrackerLog[]> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const limit = options?.limit ?? DEFAULT_LIMIT
  const offset = options?.offset ?? 0

  let query = supabase
    .from('tracker_logs')
    .select(LOG_COLUMNS)
    .eq('tracker_id', trackerId)
    .order('logged_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (options?.startDate) {
    query = query.gte('logged_at', options.startDate)
  }
  if (options?.endDate) {
    query = query.lte('logged_at', options.endDate)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch logs: ${error.message}`)
  return data as TrackerLog[]
}

export async function getLogsForDay(date: string): Promise<TrackerLog[]> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const dayStart = `${date}T00:00:00.000Z`
  const nextDay = new Date(date)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  const dayEnd = nextDay.toISOString().split('T')[0] + 'T00:00:00.000Z'

  const { data, error } = await supabase
    .from('tracker_logs')
    .select(LOG_COLUMNS)
    .gte('logged_at', dayStart)
    .lt('logged_at', dayEnd)
    .order('logged_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch logs for day: ${error.message}`)
  return data as TrackerLog[]
}

export async function getLog(id: string): Promise<TrackerLog> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('tracker_logs')
    .select(LOG_COLUMNS)
    .eq('id', id)
    .single()

  if (error) throw new Error(`Failed to fetch log: ${error.message}`)
  return data as TrackerLog
}

export async function updateLog(
  id: string,
  input: UpdateLogInput
): Promise<TrackerLog> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const updates: Record<string, unknown> = {}
  if (input.fields !== undefined) updates.fields = input.fields
  if (input.logged_at !== undefined) updates.logged_at = input.logged_at

  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update')
  }

  const { data, error } = await supabase
    .from('tracker_logs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(LOG_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to update log: ${error.message}`)
  return data as TrackerLog
}

export async function deleteLog(id: string): Promise<void> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('tracker_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to delete log: ${error.message}`)
}
