import { createServerClient } from '@/lib/supabase/server'

const DEFAULT_SESSION_TITLE = 'New Chat'
// Sessions that were started but never messaged expire after 2 hours of inactivity.
// The clock resets on every message — updated_at is bumped in addMessage().
const CLEANUP_IDLE_MINUTES = 120
// Sessions WITH messages: only expire after 24 hours idle.
const CLEANUP_WITH_MESSAGES_HOURS = 24
// Sessions mid-routine get a full 24h grace period before expiry.
const CLEANUP_ROUTINE_HOURS = 24

/**
 * Deletes "New Chat" sessions that have been inactive for too long.
 * "Temporary mode" = session was never renamed by the user.
 *
 * - No active routine + no messages + updated_at older than 2h → deleted
 * - No active routine + has messages + updated_at older than 24h → deleted
 * - Active routine + updated_at older than 24h → deleted
 *
 * Renamed sessions (title !== 'New Chat') are never touched here.
 *
 * Returns: Set of deleted session IDs (for filtering sidebar results)
 */
export async function cleanupStaleTemporarySessions(): Promise<Set<string>> {
  const deletedIds = new Set<string>()
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return deletedIds

  const now = new Date()
  const idleCutoff = new Date(now.getTime() - CLEANUP_IDLE_MINUTES * 60 * 1000).toISOString()
  const withMessagesCutoff = new Date(now.getTime() - CLEANUP_WITH_MESSAGES_HOURS * 60 * 60 * 1000).toISOString()
  const routineCutoff = new Date(now.getTime() - CLEANUP_ROUTINE_HOURS * 60 * 60 * 1000).toISOString()

  console.log(`[cleanup] idleCutoff=${idleCutoff} withMessagesCutoff=${withMessagesCutoff}`)

  // Fetch all untitled, non-routine sessions that are past the idle cutoff
  const { data: staleSessions, error: fetchErr } = await supabase
    .from('chat_sessions')
    .select('id, updated_at')
    .eq('title', DEFAULT_SESSION_TITLE)
    .eq('user_id', user.id)
    .is('active_routine_id', null)
    .lt('updated_at', idleCutoff)

  if (fetchErr) {
    console.error('[cleanup] fetch error:', fetchErr.message)
    return deletedIds
  }

  const candidateSessions = staleSessions ?? []
  if (candidateSessions.length === 0) {
    return deletedIds
  }

  const candidateIds = candidateSessions.map((r: { id: string }) => r.id)

  // Count messages per candidate session — only delete sessions with 0 messages
  const { data: messageCounts, error: countErr } = await supabase
    .from('chat_messages')
    .select('session_id')
    .in('session_id', candidateIds)

  if (countErr) {
    console.error('[cleanup] message count error:', countErr.message)
    return deletedIds
  }

  const sessionsWithMessages = new Set(
    (messageCounts ?? []).map((r: { session_id: string }) => r.session_id)
  )

  // Sessions with 0 messages: delete after 2h idle
  const emptyStaleIds = candidateIds.filter((id: string) => !sessionsWithMessages.has(id))

  // Sessions WITH messages that are older than 24h: also safe to delete
  const withMessagesStaleIds = candidateIds.filter((id: string) => {
    if (!sessionsWithMessages.has(id)) return false
    const session = candidateSessions.find((r: { id: string }) => r.id === id)
    return session && session.updated_at < withMessagesCutoff
  })

  const staleIds = [...emptyStaleIds, ...withMessagesStaleIds]
  console.log(`[cleanup] empty=${emptyStaleIds.length} withMessages=${withMessagesStaleIds.length} total=${staleIds.length}`)

  if (staleIds.length > 0) {
    const { error: deleteErr } = await supabase
      .from('chat_sessions')
      .delete()
      .in('id', staleIds)
      .eq('user_id', user.id)

    console.log(`[cleanup] deleted=${staleIds.length} error=${deleteErr ? deleteErr.message : 'none'}`)
    staleIds.forEach((id: string) => deletedIds.add(id))
  }

  // Routine sessions: "New Chat" with an active routine → 24h cutoff
  const { data: routineCandidates } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('title', DEFAULT_SESSION_TITLE)
    .eq('user_id', user.id)
    .not('active_routine_id', 'is', null)
    .lt('updated_at', routineCutoff)

  const staleRoutineIds = (routineCandidates ?? []).map((r: { id: string }) => r.id)

  if (staleRoutineIds.length > 0) {
    await supabase.from('chat_sessions').delete().in('id', staleRoutineIds).eq('user_id', user.id)
    console.log(`[cleanup] routine deleted=${staleRoutineIds.length}`)
    staleRoutineIds.forEach((id: string) => deletedIds.add(id))
  }

  return deletedIds
}
