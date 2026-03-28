import type { AnyActionCard } from '@/types/action-card'

export type MessageRole = 'user' | 'assistant' | 'system'

export type ChatMessage = {
  id: string
  session_id: string
  role: MessageRole
  content: string
  actions: AnyActionCard[] | null
  attachments?: unknown[] | null
  created_at: string
}

export type ChatSession = {
  id: string
  user_id: string
  title: string
  active_routine_id: string | null
  current_step_index: number
  active_agent_id: string | null
  updated_at: string
}

export type CreateMessageInput = {
  session_id: string
  role: MessageRole
  content: string
  actions?: AnyActionCard[] | null
  attachments?: unknown[] | null
}

export type CreateSessionInput = {
  title?: string
}
