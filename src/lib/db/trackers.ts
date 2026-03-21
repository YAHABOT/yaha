import { createServerClient } from '@/lib/supabase/server'
import { getSafeUser } from '@/lib/supabase/auth'
import type { Tracker, CreateTrackerInput, UpdateTrackerInput } from '@/types/tracker'
import { getTrackerLogSummaries } from './logs'
import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_COLOR = '#10b981'
const DEFAULT_TYPE = 'custom'

const TRACKER_COLUMNS = 'id, user_id, name, type, color, schema, created_at, updated_at'

export async function getTrackersBasic(supabaseClient?: SupabaseClient): Promise<Tracker[]> {
  const supabase = supabaseClient ?? await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('trackers')
    .select(TRACKER_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch basic trackers: ${error.message}`)
  return data as Tracker[]
}

export async function getTrackers(supabaseClient?: SupabaseClient): Promise<Tracker[]> {
  const supabase = supabaseClient ?? await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString().split('T')[0]

  // Parallel fetch — was 3 sequential DB round-trips, now concurrent
  const [trackersResult, logsResult, summaries] = await Promise.all([
    supabase
      .from('trackers')
      .select(TRACKER_COLUMNS)
      .order('created_at', { ascending: false }),
    supabase
      .from('tracker_logs')
      .select('id, tracker_id, fields, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', todayISO)
      .order('logged_at', { ascending: false }),
    getTrackerLogSummaries(supabase),
  ])

  const { data, error } = trackersResult
  const { data: logs, error: logsError } = logsResult

  if (error) throw new Error(`Failed to fetch trackers: ${error.message}`)
  if (logsError) console.error('Failed to fetch today\'s logs:', logsError.message)

  const trackers = data as Tracker[]

  return trackers.map(t => {
    const summary = summaries.find(s => s.tracker_id === t.id)
    const trackerLogs = logs?.filter(l => l.tracker_id === t.id) || []
    const latestLog = trackerLogs[0]

    // Calculate Today's Stats (Legacy Style)
    const stats: Record<string, { sum: number, count: number, label: string, unit: string, type: 'sum' | 'avg' }> = {}
    trackerLogs.forEach(log => {
      Object.entries(log.fields).forEach(([fId, val]) => {
        if (typeof val !== 'number') return
        const field = t.schema.find(f => f.fieldId === fId)
        if (!field) return

        if (!stats[fId]) {
          let aggType: 'sum' | 'avg' = 'sum'
          const l = field.label.toLowerCase()
          if (l.includes('hr') || l.includes('rate') || l.includes('avg') || l.includes('score') || l.includes('weight')) aggType = 'avg'
          stats[fId] = { sum: 0, count: 0, label: field.label, unit: field.unit || '', type: aggType }
        }
        stats[fId].sum += val
        stats[fId].count += 1
      })
    })

    const todayStats = Object.values(stats).slice(0, 3).map(s => ({
      label: s.label,
      value: s.type === 'avg' ? (s.sum / s.count).toFixed(1) : s.sum.toFixed(0),
      unit: s.unit
    }))

    // Create a snippet from the first field in the log
    let snippet = 'No entries today'
    if (latestLog) {
      const fieldValues = Object.entries(latestLog.fields)
      if (fieldValues.length > 0) {
        const [fId, val] = fieldValues[0]
        const fieldMeta = t.schema.find(f => f.fieldId === fId)
        snippet = `${fieldMeta?.label ?? 'Value'}: ${val}${fieldMeta?.unit ? ' ' + fieldMeta.unit : ''}`
      }
    }

    return {
      ...t,
      logCount: summary?.count ?? 0,
      todayStats, // New field for card display
      lastLog: latestLog ? {
        content: snippet,
        date: latestLog.logged_at as string
      } : undefined
    }
  })
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
