'use server'

import { revalidatePath } from 'next/cache'
import { createTracker, updateTracker, deleteTracker } from '@/lib/db/trackers'
import type { CreateTrackerInput, UpdateTrackerInput } from '@/types/tracker'

const MAX_NAME_LENGTH = 50
const MAX_SCHEMA_FIELDS = 20

export async function createTrackerAction(
  input: CreateTrackerInput
): Promise<{ error?: string }> {
  try {
    if (!input.name?.trim()) return { error: 'Tracker name is required.' }
    if (input.name.trim().length > MAX_NAME_LENGTH) {
      return { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }
    }
    if (input.schema && input.schema.length > MAX_SCHEMA_FIELDS) {
      return { error: `Maximum ${MAX_SCHEMA_FIELDS} fields per tracker.` }
    }
    await createTracker(input)
    revalidatePath('/trackers')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to create tracker' }
  }
}

export async function updateTrackerAction(
  id: string,
  input: UpdateTrackerInput
): Promise<{ error?: string }> {
  try {
    if (input.name !== undefined && !input.name.trim()) {
      return { error: 'Tracker name is required.' }
    }
    if (input.name && input.name.trim().length > MAX_NAME_LENGTH) {
      return { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }
    }
    if (input.schema && input.schema.length > MAX_SCHEMA_FIELDS) {
      return { error: `Maximum ${MAX_SCHEMA_FIELDS} fields per tracker.` }
    }
    await updateTracker(id, input)
    revalidatePath('/trackers')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to update tracker' }
  }
}

export async function deleteTrackerAction(
  id: string
): Promise<{ error?: string }> {
  try {
    await deleteTracker(id)
    revalidatePath('/trackers')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to delete tracker' }
  }
}
