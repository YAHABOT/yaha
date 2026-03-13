'use server'

import { revalidatePath } from 'next/cache'
import { createRoutine, updateRoutine, deleteRoutine } from '@/lib/db/routines'
import type { CreateRoutineInput, UpdateRoutineInput } from '@/types/routine'

const MAX_NAME_LENGTH = 50
const MAX_TRIGGER_LENGTH = 100

export async function createRoutineAction(
  input: CreateRoutineInput
): Promise<{ success?: boolean; error?: string }> {
  try {
    if (!input.name?.trim()) return { error: 'Name is required.' }
    if (input.name.trim().length > MAX_NAME_LENGTH) {
      return { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }
    }
    if (!input.trigger_phrase?.trim()) return { error: 'Trigger phrase is required.' }
    if (input.trigger_phrase.trim().length > MAX_TRIGGER_LENGTH) {
      return { error: `Trigger phrase must be ${MAX_TRIGGER_LENGTH} characters or fewer.` }
    }

    await createRoutine(input)
    revalidatePath('/routines')
    return { success: true }
  } catch {
    return { error: 'Failed to create routine' }
  }
}

export async function updateRoutineAction(
  id: string,
  input: UpdateRoutineInput
): Promise<{ success?: boolean; error?: string }> {
  try {
    if (input.name !== undefined && !input.name.trim()) {
      return { error: 'Name is required.' }
    }
    if (input.name !== undefined && input.name.trim().length > MAX_NAME_LENGTH) {
      return { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }
    }
    if (input.trigger_phrase !== undefined && !input.trigger_phrase.trim()) {
      return { error: 'Trigger phrase is required.' }
    }
    if (
      input.trigger_phrase !== undefined &&
      input.trigger_phrase.trim().length > MAX_TRIGGER_LENGTH
    ) {
      return { error: `Trigger phrase must be ${MAX_TRIGGER_LENGTH} characters or fewer.` }
    }

    await updateRoutine(id, input)
    revalidatePath('/routines')
    return { success: true }
  } catch {
    return { error: 'Failed to update routine' }
  }
}

export async function deleteRoutineAction(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    await deleteRoutine(id)
    revalidatePath('/routines')
    return { success: true }
  } catch {
    return { error: 'Failed to delete routine' }
  }
}
