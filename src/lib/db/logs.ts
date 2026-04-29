import { createServerClient } from '@/lib/supabase/server'
import { getSafeUser } from '@/lib/supabase/auth'
import type { TrackerLog, CreateLogInput, UpdateLogInput } from '@/types/log'
import type { SupabaseClient } from '@supabase/supabase-js'

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
  const user = await getSafeUser()
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
  const user = await getSafeUser()
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

export async function getLogsForDay(date: string, supabaseClient?: SupabaseClient): Promise<TrackerLog[]> {
  const supabase = supabaseClient ?? await createServerClient()
  const user = await getSafeUser()
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

export async function getLoggedDates(limit = 90, supabaseClient?: SupabaseClient): Promise<string[]> {
  const supabase = supabaseClient ?? await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('logged_dates_summary')
    .select('log_date')
    .eq('user_id', user.id)
    .order('log_date', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to fetch logged dates: ${error.message}`)

  return (data ?? []).map(row => row.log_date)
}

export async function getLog(id: string): Promise<TrackerLog> {
  const supabase = await createServerClient()
  const user = await getSafeUser()
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
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const updates: Record<string, unknown> = {}

  if (input.fields !== undefined) {
    // Patch semantics: fetch current fields first, then merge only non-null changes.
    // Sending only the changed keys via .update() would overwrite the entire JSONB column,
    // destroying all other fields. This read-modify-write prevents data loss.
    const { data: current, error: fetchError } = await supabase
      .from('tracker_logs')
      .select('fields')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !current) throw new Error(`Failed to fetch log for merge: ${fetchError?.message ?? 'Log not found'}`)

    const patchFields = Object.fromEntries(
      Object.entries(input.fields).filter(([, v]) => v !== null && v !== undefined)
    )
    updates.fields = { ...(current.fields as Record<string, unknown>), ...patchFields }
  }

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
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('tracker_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to delete log: ${error.message}`)
}

export type TrackerLogWithName = {
  tracker_id: string
  tracker_name: string
  fields: Record<string, unknown>
  logged_at: string
}

const HISTORICAL_LOG_LIMIT = 200

export async function getLogsForDateRange(
  startDate: string,
  endDate: string,
  supabaseClient: SupabaseClient,
  trackers: Array<{ id: string; name: string }>
): Promise<TrackerLogWithName[]> {
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const rangeStart = `${startDate}T00:00:00.000Z`
  const endNext = new Date(endDate)
  endNext.setUTCDate(endNext.getUTCDate() + 1)
  const rangeEnd = endNext.toISOString().split('T')[0] + 'T00:00:00.000Z'

  const { data, error } = await supabaseClient
    .from('tracker_logs')
    .select('tracker_id, fields, logged_at')
    .gte('logged_at', rangeStart)
    .lt('logged_at', rangeEnd)
    .order('logged_at', { ascending: false })
    .limit(HISTORICAL_LOG_LIMIT)

  if (error) throw new Error(`Failed to fetch logs for date range: ${error.message}`)

  const trackerMap = new Map(trackers.map(t => [t.id, t.name]))

  return (data ?? []).map(row => ({
    tracker_id: row.tracker_id as string,
    tracker_name: trackerMap.get(row.tracker_id as string) ?? 'Unknown Tracker',
    fields: row.fields as Record<string, unknown>,
    logged_at: row.logged_at as string,
  }))
}

export async function searchLogsByFieldText(
  query: string,
  supabaseClient: SupabaseClient,
  trackers: Array<{ id: string; name: string }>,
  limit: number = 10
): Promise<TrackerLogWithName[]> {
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  // Sanitize query to prevent injection via ILIKE pattern — only allow safe characters
  const safeQuery = query.replace(/[%_\\]/g, char => `\\${char}`)

  const { data, error } = await supabaseClient
    .from('tracker_logs')
    .select('tracker_id, fields, logged_at')
    .ilike('fields::text', `%${safeQuery}%`)
    .order('logged_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to search logs by field text: ${error.message}`)

  const trackerMap = new Map(trackers.map(t => [t.id, t.name]))

  return (data ?? []).map(row => ({
    tracker_id: row.tracker_id as string,
    tracker_name: trackerMap.get(row.tracker_id as string) ?? 'Unknown Tracker',
    fields: row.fields as Record<string, unknown>,
    logged_at: row.logged_at as string,
  }))
}

export type TrackerLogSummary = {
  tracker_id: string
  count: number
  last_logged_at: string | null
}

export async function getTrackerLogSummaries(supabaseClient?: SupabaseClient): Promise<TrackerLogSummary[]> {
  const supabase = supabaseClient ?? await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('tracker_summaries')
    .select('tracker_id, count, last_logged_at')
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to fetch log summaries: ${error.message}`)

  return (data ?? []) as TrackerLogSummary[]
}
