import { createServerClient } from '@/lib/supabase/server'
import type { ChatSession, ChatMessage, CreateSessionInput, CreateMessageInput } from '@/types/chat'

const DEFAULT_SESSION_TITLE = 'New Chat'
const DEFAULT_AI_CONTEXT_LIMIT = 20
const SESSIONS_SIDEBAR_LIMIT = 30
const MESSAGES_DISPLAY_LIMIT = 100
// Reuse a very recent default session instead of spawning a new one.
// Prevents 6x ghost sessions from React StrictMode remounts + rapid navigation.
const SESSION_REUSE_WINDOW_MS = 10_000

const SESSION_COLUMNS = 'id, user_id, title, active_routine_id, current_step_index, active_agent_id, updated_at'
const MESSAGE_COLUMNS = 'id, session_id, role, content, actions, attachments, created_at'

export async function getSessions(): Promise<ChatSession[]> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Run cleanup synchronously BEFORE fetch so sidebar filters out deleted sessions.
  // Use timeout to prevent blocking if cleanup is slow.
  const { cleanupStaleTemporarySessions } = await import('@/lib/db/chat-cleanup')
  const cleanupPromise = cleanupStaleTemporarySessions()
  const cleanupWithTimeout = Promise.race([
    cleanupPromise,
    new Promise<Set<string>>(resolve => {
      const timeout = setTimeout(() => resolve(new Set()), 2000)
      cleanupPromise.then(ids => {
        clearTimeout(timeout)
        resolve(ids)
      }).catch(() => resolve(new Set()))
    })
  ])
  const deletedSessionIds = await cleanupWithTimeout

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('chat_sessions')
    .select(SESSION_COLUMNS)
    .eq('user_id', user.id)
    .or(`title.neq.${DEFAULT_SESSION_TITLE},updated_at.gte.${tenMinutesAgo}`)
    .order('updated_at', { ascending: false })
    .limit(SESSIONS_SIDEBAR_LIMIT)

  if (error) throw new Error(`Failed to fetch sessions: ${error.message}`)
  // Filter out any sessions that were deleted in cleanup
  const filtered = (data as ChatSession[]).filter(s => !deletedSessionIds.has(s.id))
  return filtered
}

export async function getSession(id: string): Promise<ChatSession> {
  const start = Date.now()
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('chat_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  console.log(`[getSession] took ${Date.now() - start}ms`)
  if (error) throw new Error(`Failed to fetch session: ${error.message}`)
  return data as ChatSession
}

export async function createSession(input?: CreateSessionInput): Promise<ChatSession> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Idempotency guard: for default "New Chat" sessions, reuse any session
  // created/touched in the last SESSION_REUSE_WINDOW_MS. This blocks ghost
  // spawning when rapid navigation or React StrictMode fires the effect twice.
  if (!input?.title) {
    const windowStart = new Date(Date.now() - SESSION_REUSE_WINDOW_MS).toISOString()
    const { data: recent } = await supabase
      .from('chat_sessions')
      .select(SESSION_COLUMNS)
      .eq('user_id', user.id)
      .eq('title', DEFAULT_SESSION_TITLE)
      .gte('updated_at', windowStart)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recent) return recent as ChatSession
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: user.id,
      title: input?.title ?? DEFAULT_SESSION_TITLE,
    })
    .select(SESSION_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to create session: ${error.message}`)
  return data as ChatSession
}

export async function updateSession(
  id: string,
  updates: { title?: string; active_agent_id?: string | null; active_routine_id?: string | null; current_step_index?: number }
): Promise<ChatSession> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('chat_sessions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select(SESSION_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to update session: ${error.message}`)
  return data as ChatSession
}

export async function deleteSessions(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .in('id', ids)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to delete sessions: ${error.message}`)
}

export async function deleteSession(id: string): Promise<void> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Verify ownership before deletion (cascade handles messages via FK)
  const { error: fetchError } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError) throw new Error(`Failed to delete session: ${fetchError.message}`)

  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to delete session: ${error.message}`)
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const start = Date.now()
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Verify session belongs to user before fetching messages
  const { error: sessionError } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessionError) throw new Error(`Failed to fetch messages: ${sessionError.message}`)

  const { data, error } = await supabase
    .from('chat_messages')
    .select(MESSAGE_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_DISPLAY_LIMIT)

  console.log(`[getMessages] took ${Date.now() - start}ms for ${data?.length ?? 0} messages`)
  if (error) throw new Error(`Failed to fetch messages: ${error.message}`)
  // Reverse to restore chronological order for display
  return (data as ChatMessage[]).reverse()
}

export async function addMessage(input: CreateMessageInput): Promise<ChatMessage> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Verify session belongs to user before inserting message
  const { error: sessionError } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', input.session_id)
    .eq('user_id', user.id)
    .single()

  if (sessionError) throw new Error(`Failed to add message: ${sessionError.message}`)

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: input.session_id,
      role: input.role,
      content: input.content,
      actions: input.actions ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to add message: ${error.message}`)

  // Bump session updated_at after successful message insert
  const { error: bumpError } = await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.session_id)
    .eq('user_id', user.id)

  if (bumpError) throw new Error(`Failed to update session timestamp: ${bumpError.message}`)

  return data as ChatMessage
}

/**
 * Persist the current routine step index to the DB.
 * Call whenever the step advances so page reload can resume at the correct step.
 * Pass null to clear (routine complete or cancelled).
 */
export async function updateRoutineStep(sessionId: string, step: number | null): Promise<void> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('chat_sessions')
    .update({ current_step_index: step, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to update routine step: ${error.message}`)
}

export async function getRecentMessagesForAI(
  sessionId: string,
  limit: number = DEFAULT_AI_CONTEXT_LIMIT,
  filterDate?: string  // Optional: filter to only messages from this date (YYYY-MM-DD)
): Promise<ChatMessage[]> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Verify session belongs to user before fetching messages
  const { error: sessionError } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessionError) throw new Error(`Failed to fetch messages for AI: ${sessionError.message}`)

  let query = supabase
    .from('chat_messages')
    .select(MESSAGE_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Optional: filter to messages created on a specific date (prevents cross-day pollution)
  if (filterDate && /^\d{4}-\d{2}-\d{2}$/.test(filterDate)) {
    // Calculate start and end of day in UTC (created_at is always UTC in the DB)
    const dateStart = new Date(`${filterDate}T00:00:00.000Z`).toISOString()
    const dateEnd = new Date(`${filterDate}T23:59:59.999Z`).toISOString()
    query = query
      .gte('created_at', dateStart)
      .lt('created_at', dateEnd)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch messages for AI: ${error.message}`)

  // Reverse to restore chronological order for AI context
  return (data as ChatMessage[]).reverse()
}
