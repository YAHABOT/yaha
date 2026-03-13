'use client' // needed for message state, optimistic updates, auto-scroll, file upload

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip, Send, X } from 'lucide-react'
import { ActionCard } from '@/components/chat/ActionCard'
import type { ChatMessage } from '@/types/chat'
import type { ChatAttachment } from '@/types/action-card'

const MAX_TEXTAREA_ROWS = 6
const ACCEPTED_FILE_TYPES = 'image/*,audio/*,application/pdf'

// Client-side allowlist mirrors the server-side set for early UX feedback
const ALLOWED_MIME_PREFIXES = ['image/', 'audio/']
const ALLOWED_MIME_EXACT = new Set(['application/pdf'])

function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p)) || ALLOWED_MIME_EXACT.has(mimeType)
}

type AttachedFile = {
  file: File
  attachment: ChatAttachment
}

type ChatApiResponse = {
  message: {
    role: 'model'
    content: string
    actions: import('@/types/action-card').ActionCard[]
  }
  sessionId: string
}

type Props = {
  initialMessages: ChatMessage[]
  sessionId: string
}

function buildOptimisticMessage(content: string): ChatMessage {
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    session_id: '',
    role: 'user',
    content,
    actions: null,
    created_at: new Date().toISOString(),
  }
}

function buildModelMessage(response: ChatApiResponse['message'], sessionId: string): ChatMessage {
  return {
    id: `model-${crypto.randomUUID()}`,
    session_id: sessionId,
    role: 'model',
    content: response.content,
    actions: response.actions ?? null,
    created_at: new Date().toISOString(),
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data URL prefix — keep only base64 content
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function resolveAttachmentType(mimeType: string): 'image' | 'audio' | 'file' {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'file'
}

export function ChatInterface({ initialMessages, sessionId }: Props): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [error, setError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 24
    const maxHeight = lineHeight * MAX_TEXTAREA_ROWS
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
  }, [input])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const files = Array.from(e.target.files ?? [])
      if (files.length === 0) return

      // Client-side MIME guard — provides early UX feedback before server rejects
      const disallowed = files.find((f) => !isAllowedMimeType(f.type))
      if (disallowed) {
        setError(`File type not supported: ${disallowed.type}`)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      const converted = await Promise.all(
        files.map(async (file): Promise<AttachedFile> => {
          const base64 = await fileToBase64(file)
          const attachment: ChatAttachment = {
            type: resolveAttachmentType(file.type),
            base64,
            mimeType: file.type,
            filename: file.name,
          }
          return { file, attachment }
        })
      )

      setAttachedFiles((prev) => [...prev, ...converted])
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    []
  )

  function removeAttachment(index: number): void {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed && attachedFiles.length === 0) return
    if (isLoading) return

    const optimistic = buildOptimisticMessage(trimmed || '[Attachment]')
    setMessages((prev) => [...prev, optimistic])
    setInput('')
    setAttachedFiles([])
    setError(null)
    setIsLoading(true)

    try {
      const body = {
        message: trimmed || '(see attachment)',
        sessionId,
        attachments: attachedFiles.map((af) => af.attachment),
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = (await res.json()) as { error?: string }
        throw new Error(errData.error ?? `Request failed: ${res.status}`)
      }

      const data = (await res.json()) as ChatApiResponse
      const modelMsg = buildModelMessage(data.message, data.sessionId)
      setMessages((prev) => [...prev, modelMsg])

      // If this was a new session, navigate to the persisted sessionId
      if (data.sessionId !== sessionId) {
        router.push(`/chat/${data.sessionId}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message')
      // Remove the optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const form = e.currentTarget.closest('form')
      if (form) form.requestSubmit()
    }
  }

  return (
    <div className="flex h-full flex-col" data-testid="chat-interface">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-textMuted">Send a message to get started.</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col gap-2 ${
              message.role === 'user' ? 'items-end' : 'items-start'
            }`}
            data-testid={`message-${message.role}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-textPrimary ${
                message.role === 'user'
                  ? 'rounded-tr-sm bg-surfaceHighlight'
                  : 'rounded-tl-sm bg-surface border border-border'
              }`}
            >
              {message.content}
            </div>

            {message.actions && message.actions.length > 0 && (
              <div className="w-full max-w-sm space-y-2">
                {message.actions.map((card, idx) => (
                  <ActionCard key={`${message.id}-action-${idx}`} card={card} />
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start" data-testid="loading-indicator">
            <div className="rounded-2xl rounded-tl-sm bg-surface border border-border px-4 py-2.5">
              <span className="text-xs text-textMuted">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Attachment chips */}
      {attachedFiles.length > 0 && (
        <div className="mx-4 mb-2 flex flex-wrap gap-2" data-testid="attachment-chips">
          {attachedFiles.map((af, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surfaceHighlight px-2 py-1 text-xs text-textMuted"
            >
              <span className="max-w-[120px] truncate">{af.file.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="text-textMuted hover:text-textPrimary"
                aria-label={`Remove ${af.file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-border bg-surface p-4"
        data-testid="chat-form"
      >
        <div className="flex items-end gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            onChange={handleFileChange}
            className="hidden"
            data-testid="file-input"
            aria-label="Attach files"
          />

          {/* Attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 rounded-lg border border-border p-2 text-textMuted transition-colors hover:bg-surfaceHighlight hover:text-textPrimary"
            aria-label="Attach file"
            data-testid="attach-button"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message YAHA... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-textPrimary placeholder-textMuted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="message-input"
            aria-label="Message input"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
            className="flex-shrink-0 rounded-lg bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
            aria-label="Send message"
            data-testid="send-button"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
