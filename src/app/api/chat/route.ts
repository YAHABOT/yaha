import { createServerClient } from '@/lib/supabase/server'
import { createSession } from '@/lib/db/chat'
import { addMessage } from '@/lib/db/chat'
import { getTrackers } from '@/lib/db/trackers'
import { processHealthMessage } from '@/lib/ai/gemini'
import { buildHealthSystemPrompt } from '@/lib/ai/prompt-builder'
import type { ChatAttachment, ChatInput, ActionCard } from '@/types/action-card'

const MAX_MESSAGE_LENGTH = 4000

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'application/pdf',
])

type ChatRequestBody = {
  message: string
  sessionId?: string
  attachments?: Array<{
    base64: string
    mimeType: string
    type: 'image' | 'audio' | 'file'
    filename?: string
  }>
  date?: string
}

type ChatResponseMessage = {
  role: 'model'
  content: string
  actions: ActionCard[]
}

type ChatResponse = {
  message: ChatResponseMessage
  sessionId: string
}

function validateAttachments(
  rawAttachments: ChatRequestBody['attachments']
): ChatAttachment[] | undefined {
  if (!rawAttachments || rawAttachments.length === 0) return undefined

  for (const attachment of rawAttachments) {
    if (!ALLOWED_MIME_TYPES.has(attachment.mimeType)) {
      throw new Error(`Disallowed attachment MIME type: ${attachment.mimeType}`)
    }
  }

  return rawAttachments as ChatAttachment[]
}

export async function POST(req: Request): Promise<Response> {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: ChatRequestBody
    try {
      body = (await req.json()) as ChatRequestBody
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { message, sessionId, attachments: rawAttachments, date } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return Response.json({ error: 'Message is required' }, { status: 400 })
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return Response.json(
        { error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 }
      )
    }

    let attachments: ChatAttachment[] | undefined
    try {
      attachments = validateAttachments(rawAttachments)
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : 'Invalid attachment' },
        { status: 400 }
      )
    }

    // Get or create chat session
    // Note: createSession verifies auth internally — the sessionId from the request body
    // is NOT used as proof of ownership. The DAL re-verifies the authenticated user.
    const session = sessionId
      ? { id: sessionId }
      : await createSession()

    // Save user message
    await addMessage({
      session_id: session.id,
      role: 'user',
      content: message,
    })

    // Fetch trackers for system prompt context
    const trackers = await getTrackers()

    // Build system prompt with tracker context
    const systemPrompt = buildHealthSystemPrompt({ trackers, date })

    // Build ChatInput (userId intentionally omitted — derived from session in DAL)
    const chatInput: ChatInput = {
      text: message,
      attachments,
      sessionId: session.id,
      date,
    }

    // Process message through Gemini
    const { text, actions } = await processHealthMessage(chatInput, systemPrompt)

    // Save model response
    await addMessage({
      session_id: session.id,
      role: 'model',
      content: text,
      actions,
    })

    const responseBody: ChatResponse = {
      message: {
        role: 'model',
        content: text,
        actions,
      },
      sessionId: session.id,
    }

    return Response.json(responseBody, { status: 200 })
  } catch (e) {
    console.error('[chat/route] Unhandled error:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
