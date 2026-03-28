'use server'

import { revalidatePath } from 'next/cache'
import { createLog, updateLog, deleteLog, getLog } from '@/lib/db/logs'
import { createServerClient } from '@/lib/supabase/server'
import type { LogFields, LogSource } from '@/types/log'

export async function createLogAction(
  trackerId: string,
  fields: LogFields,
  loggedAt?: string,
  source?: LogSource
): Promise<{ error?: string }> {
  try {
    if (!trackerId) return { error: 'Tracker ID is required' }
    if (!fields || Object.keys(fields).length === 0) {
      return { error: 'At least one field is required' }
    }

    // Validate that the tracker belongs to the current user before inserting.
    // This prevents the raw FK constraint error when the AI hallucinates a UUID.
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: trackerRow } = await supabase
      .from('trackers')
      .select('id')
      .eq('id', trackerId)
      .eq('user_id', user.id)
      .single()

    if (!trackerRow) {
      return { error: 'Tracker not found. The AI may have used an incorrect ID — please try sending your message again.' }
    }

    await createLog({
      tracker_id: trackerId,
      fields,
      logged_at: loggedAt,
      source,
    })
    revalidatePath(`/trackers/${trackerId}/log`)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to create log' }
  }
}

export async function updateLogAction(
  logId: string,
  trackerId: string,
  fields: LogFields,
  loggedAt?: string
): Promise<{ error?: string }> {
  try {
    if (!logId) return { error: 'Log ID is required' }
    if (!fields || Object.keys(fields).length === 0) {
      return { error: 'At least one field is required' }
    }

    await updateLog(logId, { fields, logged_at: loggedAt })
    revalidatePath(`/trackers/${trackerId}/log`)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to update log' }
  }
}

export async function deleteLogAction(
  logId: string,
  trackerId: string
): Promise<{ error?: string }> {
  try {
    if (!logId) return { error: 'Log ID is required' }

    await deleteLog(logId)
    revalidatePath(`/trackers/${trackerId}/log`)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to delete log' }
  }
}
