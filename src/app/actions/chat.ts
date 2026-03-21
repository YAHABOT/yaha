'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import type { ActionCard } from '@/types/action-card'

export async function confirmLogAction(
  card: ActionCard
): Promise<{ success?: boolean; error?: string }> {
  try {
    if (!card.trackerId) return { error: 'Tracker ID is required' }
    if (!card.fields || Object.keys(card.fields).length === 0) {
      return { error: 'Fields are required' }
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    // Validate date format before constructing Date object to avoid Invalid Date throws
    if (!/^\d{4}-\d{2}-\d{2}$/.test(card.date)) {
      return { error: 'Invalid date format — expected YYYY-MM-DD' }
    }
    // Use the actual confirmation time (wall-clock) so entries are not stuck at midnight UTC.
    // Only use card.date for the calendar date — the time component comes from right now.
    const now = new Date()
    const nowDateStr = now.toISOString().split('T')[0]
    const loggedAt = card.date === nowDateStr
      ? now.toISOString()                           // today: use exact confirmation time
      : new Date(card.date + 'T12:00:00Z').toISOString() // backdated: use noon UTC to avoid day-boundary issues

    const { error } = await supabase
      .from('tracker_logs')
      .insert({
        tracker_id: card.trackerId,
        user_id: user.id,
        fields: card.fields,
        logged_at: loggedAt,
        source: 'chat',
      })

    if (error) return { error: `Failed to log entry: ${error.message}` }

    revalidatePath('/journal')
    revalidatePath('/dashboard')

    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to confirm log' }
  }
}

export async function deleteSessionAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { deleteSession } = await import('@/lib/db/chat')
    await deleteSession(id)
    revalidatePath('/chat')
    return { success: true }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function renameSessionAction(id: string, title: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { updateSession } = await import('@/lib/db/chat')
    await updateSession(id, { title })
    revalidatePath('/chat')
    return { success: true }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
