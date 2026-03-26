'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import type { ActionCard } from '@/types/action-card'

export async function confirmLogAction(
  card: ActionCard,
  messageId?: string,
  cardIndex?: number
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

    // Duplicate guard — only blocks re-confirming the SAME card (same messageId + cardIndex).
    // Checks if this specific message's action card is already marked confirmed in the DB.
    // Does NOT block multiple entries for the same tracker on the same day (e.g. two meals).
    let alreadyConfirmed = false
    if (messageId && cardIndex !== undefined) {
      const { data: msgCheck } = await supabase
        .from('chat_messages')
        .select('actions')
        .eq('id', messageId)
        .single()
      if (msgCheck) {
        const actions = msgCheck.actions as ActionCard[] ?? []
        alreadyConfirmed = actions[cardIndex]?.confirmed === true
      }
    }

    if (!alreadyConfirmed) {
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
    }

    // Persist confirmed: true onto the matching action card in the message's JSONB so the
    // card initialises as confirmed after a page refresh instead of reverting to pending.
    console.log('[confirmLogAction] called — messageId:', messageId, 'cardIndex:', cardIndex)
    if (messageId) {
      const { data: msg } = await supabase
        .from('chat_messages')
        .select('actions, session_id')
        .eq('id', messageId)
        .single()

      if (msg) {
        // Verify the message belongs to this user via session ownership
        const { error: sessErr } = await supabase
          .from('chat_sessions')
          .select('id')
          .eq('id', msg.session_id as string)
          .eq('user_id', user.id)
          .single()

        if (!sessErr) {
          const rawActions = msg.actions as ActionCard[] ?? []
          // Index-based match is exact — avoids tracker+date collisions and string diff bugs.
          // Fall back to trackerId+date matching for messages that predate cardIndex.
          const actions = rawActions.map((a: ActionCard, i: number) => {
            const matches = cardIndex !== undefined
              ? i === cardIndex
              : a.trackerId === card.trackerId && a.date === card.date
            return matches ? { ...a, confirmed: true } : a
          })
          console.log('[confirmLogAction] Persisting confirmed=true to message', messageId, 'at index', cardIndex, 'matching actions:', actions.filter(a => a.confirmed))
          const { error: updateErr } = await supabase
            .from('chat_messages')
            .update({ actions })
            .eq('id', messageId)
          if (updateErr) {
            console.error('[confirmLogAction] Failed to persist confirmed state:', updateErr.message)
          } else {
            console.log('[confirmLogAction] ✓ Successfully persisted confirmed state')
          }
        }
      }
    }

    revalidatePath('/journal')
    revalidatePath('/dashboard')
    revalidatePath('/trackers', 'layout')

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

export async function deleteSessionsAction(ids: string[]): Promise<{ success?: boolean; error?: string }> {
  try {
    if (ids.length === 0) return { success: true }
    const { deleteSessions } = await import('@/lib/db/chat')
    await deleteSessions(ids)
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
    revalidatePath('/chat', 'layout')
    return { success: true }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
