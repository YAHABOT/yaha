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

    const loggedAt = new Date(card.date + 'T00:00:00').toISOString()

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
