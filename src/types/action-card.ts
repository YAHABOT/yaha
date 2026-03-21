export type ActionCardType = 'LOG_DATA'

export type ActionCard = {
  type: ActionCardType
  trackerId: string
  trackerName: string
  fields: Record<string, number | string | null>
  fieldLabels?: Record<string, string>
  fieldUnits?: Record<string, string>
  date: string // ISO date "YYYY-MM-DD"
  source: 'chat' | 'telegram' | 'manual'
}

export type ChatAttachment = {
  type: 'image' | 'audio' | 'file'
  base64: string
  mimeType: string
  filename?: string
}

export type ChatInput = {
  text?: string
  attachments?: ChatAttachment[]
  sessionId: string
  // userId intentionally excluded — always derived from verified session in the DAL, never from caller
  date?: string // Optional backdate "YYYY-MM-DD"
}

export type GeminiResponse = {
  text: string
  actions: ActionCard[]
}
