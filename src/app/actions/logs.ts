'use server'

import { revalidatePath } from 'next/cache'
import { createLog, updateLog, deleteLog, getLog } from '@/lib/db/logs'
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
