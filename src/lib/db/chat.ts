import { createServerClient } from '@/lib/supabase/server'
import type { ChatSession, ChatMessage, CreateSessionInput, CreateMessageInput } from '@/types/chat'

const DEFAULT_SESSION_TITLE = 'New Chat'
const DEFAULT_AI_CONTEXT_LIMIT = 20

const SESSION_COLUMNS = 'id, user_id, title, active_routine_id, current_step_index, active_agent_id, updated_at'
const MESSAGE_COLUMNS = 'id, session_id, role, content, actions, created_at'

export async function getSessions(): Promise<ChatSession[]> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('chat_sessions')
    .select(SESSION_COLUMNS)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch sessions: ${error.message}`)
  return data as ChatSession[]
}

export async function getSession(id: string): Promise<ChatSession> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('chat_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) throw new Error(`Failed to fetch session: ${error.message}`)
  return data as ChatSession
}

export async function createSession(input?: CreateSessionInput): Promise<ChatSession> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

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
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`)
  return data as ChatMessage[]
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

export async function getRecentMessagesForAI(
  sessionId: string,
  limit: number = DEFAULT_AI_CONTEXT_LIMIT
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

  const { data, error } = await supabase
    .from('chat_messages')
    .select(MESSAGE_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to fetch messages for AI: ${error.message}`)

  // Reverse to restore chronological order for AI context
  return (data as ChatMessage[]).reverse()
}
