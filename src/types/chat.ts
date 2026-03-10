import type { ActionCard } from '@/types/action-card'

export type MessageRole = 'user' | 'model'

export type ChatMessage = {
  id: string
  session_id: string
  role: MessageRole
  content: string
  actions: ActionCard[] | null
  created_at: string
}

export type ChatSession = {
  id: string
  user_id: string
  title: string
  updated_at: string
}

export type CreateMessageInput = {
  session_id: string
  role: MessageRole
  content: string
  actions?: ActionCard[] | null
}

export type CreateSessionInput = {
  title?: string
}
