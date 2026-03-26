'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Paperclip, Send, X, Bot, Zap, CheckCircle2, ChevronRight, Menu } from 'lucide-react'
import { ActionCard } from '@/components/chat/ActionCard'
import { AgentSelector } from '@/components/chat/AgentSelector'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import type { ChatMessage, ChatSession } from '@/types/chat'
import type { ChatAttachment } from '@/types/action-card'
import type { Agent } from '@/types/agent'
import type { Routine } from '@/types/routine'
import { getAgentsAction } from '@/app/actions/agents'
import { renameSessionAction } from '@/app/actions/chat'

const MAX_TEXTAREA_ROWS = 6
const ACCEPTED_FILE_TYPES = 'image/*,audio/*,application/pdf'
const ALLOWED_MIME_PREFIXES = ['image/', 'audio/']
const ALLOWED_MIME_EXACT = new Set(['application/pdf'])

function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p)) || ALLOWED_MIME_EXACT.has(mimeType)
}

type AttachedFile = {
  file: File
  attachment: ChatAttachment
}

type Props = {
  initialMessages: ChatMessage[]
  sessionId: string
  session: ChatSession | null
  initialRoutine?: Routine | null
  sessions?: ChatSession[]
  currentSessionId?: string
}

export function ChatInterface({ initialMessages, sessionId, session: initialSession, initialRoutine, sessions = [] }: Props): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<ChatSession | null>(initialSession)
  const [agents, setAgents] = useState<Agent[]>([])
  const [activeAgentId, setActiveAgentId] = useState<string | null>(initialSession?.active_agent_id ?? null)
  const [currentRoutine, setCurrentRoutine] = useState<Routine | null>(initialRoutine ?? null)
  // BUG 6 fix: internal session ID state so URL updates don't remount the component
  const [currentSessionId, setCurrentSessionId] = useState<string>(sessionId)
  // BUG 3: mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false)
  // BUG 4: save chat modal state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false)
  const [saveTitle, setSaveTitle] = useState<string>('')
  const [isSaving, setIsSaving] = useState<boolean>(false)

  const [isHydrated, setIsHydrated] = useState<boolean>(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const triggerSent = useRef(false)

  // Mark hydrated after first client paint so the messages area doesn't flash unstyled
  useEffect(() => { setIsHydrated(true) }, [])

  // Fetch Agents
  useEffect(() => {
    getAgentsAction().then(setAgents)
  }, [])

  // Auto-trigger ritual if routine param is provided.
  // Double-locked: triggerSent.current (per-instance) + sessionStorage (survives
  // React StrictMode remounts) with a 5s TTL to allow legitimate re-starts.
  useEffect(() => {
    if (triggerSent.current) return
    const routineId = searchParams.get('routine')
    if (!routineId || sessionId !== 'new' || messages.length > 0) return

    const storageKey = `yaha_trigger_${routineId}`
    const lastTs = sessionStorage.getItem(storageKey)
    if (lastTs && Date.now() - Number(lastTs) < 5_000) return

    triggerSent.current = true
    sessionStorage.setItem(storageKey, String(Date.now()))

    const trigger = currentRoutine?.trigger_phrase || 'start ritual'
    handleSendInternal(trigger, routineId)
  }, [searchParams, sessionId, messages.length, currentRoutine])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleAgentSelect = async (agentId: string | null) => {
    setActiveAgentId(agentId)
    if (currentSessionId !== 'new') {
      // Update session explicitly
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId, agentId: agentId || null, message: "Switching agent..." })
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, {
          id: `sw-${Date.now()}`,
          session_id: currentSessionId,
          role: 'assistant',
          content: data.message.content,
          actions: null,
          attachments: null,
          created_at: new Date().toISOString()
        }])
      }
    }
  }

  // Silent variant — sends a message to the API without adding a visible user bubble.
  // Used by the routine auto-advance flow so the UI doesn't show an awkward hidden prompt.
  // Also refreshes session + routine state so the step badge advances correctly (Fix 5).
  async function handleSendSilent(text: string): Promise<void> {
    if (isLoading) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: currentSessionId, agentId: activeAgentId })
      })
      if (!res.ok) return
      const data = await res.json()
      setMessages((prev) => [...prev, {
        id: data.message?.id ?? `mod-${Date.now()}`,
        session_id: data.sessionId,
        role: 'assistant',
        content: data.message.content,
        actions: data.message.actions,
        created_at: new Date().toISOString()
      }])

      // Refresh session state so the routine step badge reflects the newly advanced step
      const sessRes = await fetch(`/api/chat/sessions/${data.sessionId}`)
      if (sessRes.ok) {
        const nextSession = await sessRes.json()
        setSession(nextSession)
        if (nextSession.active_routine_id) {
          const routRes = await fetch(`/api/routines/${nextSession.active_routine_id}`)
          if (routRes.ok) setCurrentRoutine(await routRes.json())
        } else {
          setCurrentRoutine(null)
        }
      }
    } catch {
      // Silent — don't surface errors from auto-advance
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSendInternal(text: string, routineId?: string) {
    if (isLoading) return
    setIsLoading(true)

    // User message is optimistic
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      session_id: currentSessionId,
      role: 'user',
      content: text,
      actions: null,
      created_at: new Date().toISOString()
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: currentSessionId, routineId, agentId: activeAgentId })
      })
      if (!res.ok) {
// ... rest of error handling ...
        let errorMessage = 'Failed to initiate ritual'
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Server Error (${res.status})`
        }
        throw new Error(errorMessage)
      }
      const data = await res.json()

      setMessages((prev) => [...prev, {
        // Use the real DB-assigned UUID so ActionCard can pass it to confirmLogAction
        // and persist confirmed:true onto the correct chat_messages row.
        id: data.message?.id ?? `mod-${Date.now()}`,
        session_id: data.sessionId,
        role: 'assistant',
        content: data.message.content,
        actions: data.message.actions,
        created_at: new Date().toISOString()
      }])

      // BUG 6 fix: use internal state + History API to avoid Next.js page remount
      if (data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.sessionId)
        window.history.replaceState(null, '', `/chat/${data.sessionId}${routineId ? `?routine=${routineId}` : ''}`)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 24
    const maxHeight = lineHeight * MAX_TEXTAREA_ROWS
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
  }, [input])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const disallowed = files.find((f) => !isAllowedMimeType(f.type))
    if (disallowed) {
      setError(`File type not supported: ${disallowed.type}`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const converted = await Promise.all(
      files.map(async (file): Promise<AttachedFile> => {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.readAsDataURL(file)
        })
        return {
          file,
          attachment: {
            type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
            base64,
            mimeType: file.type,
            filename: file.name
          }
        }
      })
    )

    setAttachedFiles((prev) => [...prev, ...converted])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed && attachedFiles.length === 0) return
    if (isLoading) return

    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      session_id: currentSessionId,
      role: 'user',
      content: trimmed || (attachedFiles.length > 0 ? '' : '[Empty]'),
      actions: null,
      attachments: attachedFiles.map(af => af.attachment),
      created_at: new Date().toISOString()
    }

    setMessages((prev) => [...prev, optimistic])
    setInput('')
    setAttachedFiles([])
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId: currentSessionId,
          agentId: activeAgentId,
          attachments: attachedFiles.map(af => af.attachment)
        })
      })

      if (!res.ok) {
        let errorMessage = 'Failed to send message'
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Server Error (${res.status})`
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()
      setMessages((prev) => [...prev, {
        id: `mod-${Date.now()}`,
        session_id: data.sessionId,
        role: 'assistant',
        content: data.message.content,
        actions: data.message.actions,
        attachments: data.message.attachments || null,
        created_at: new Date().toISOString()
      }])

      setAttachedFiles([]) // Clear attachments after success

      // Update session state (routine progress etc.)
      const sessRes = await fetch(`/api/chat/sessions/${data.sessionId}`)
      if (sessRes.ok) {
        const nextSession = await sessRes.json()
        setSession(nextSession)

        if (nextSession.active_routine_id) {
          const routRes = await fetch(`/api/routines/${nextSession.active_routine_id}`)
          if (routRes.ok) setCurrentRoutine(await routRes.json())
        } else {
          setCurrentRoutine(null)
        }
      }

      // BUG 6 fix: use internal state + History API to avoid Next.js page remount
      if (data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.sessionId)
        const routineParam = searchParams.get('routine')
        window.history.replaceState(
          null,
          '',
          `/chat/${data.sessionId}${routineParam ? `?routine=${routineParam}` : ''}`
        )
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsLoading(false)
    }
  }

  // BUG 4: Save Chat handler
  async function handleSaveChat(): Promise<void> {
    if (!saveTitle.trim() || currentSessionId === 'new') return
    setIsSaving(true)
    try {
      const res = await renameSessionAction(currentSessionId, saveTitle.trim())
      if (res.success) {
        setSession(prev => prev ? { ...prev, title: saveTitle.trim() } : prev)
        setIsSaveModalOpen(false)
        setSaveTitle('')
        router.refresh()
      }
    } finally {
      setIsSaving(false)
    }
  }

  const activeAgent = agents.find(a => a.id === activeAgentId)

  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      {/* BUG 3: Mobile sidebar overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          {/* Sidebar panel */}
          <div className="absolute left-0 top-0 h-full w-72 animate-in slide-in-from-left-4 duration-300">
            <ChatSidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              onMobileClose={() => setIsMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* BUG 4: Save Chat Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsSaveModalOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0A0A0A] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="mb-1 text-base font-black tracking-tight text-textPrimary">Save Chat</h3>
            <p className="mb-4 text-xs text-textMuted/60">Give this conversation a name to save it permanently.</p>
            <input
              autoFocus
              type="text"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveChat()
                if (e.key === 'Escape') setIsSaveModalOpen(false)
              }}
              placeholder="Chat name..."
              className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-textPrimary placeholder-textMuted/20 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/10"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSaveChat()}
                disabled={isSaving || !saveTitle.trim()}
                className="flex-1 rounded-xl bg-nutrition px-4 py-2.5 text-xs font-black uppercase tracking-widest text-black transition-all hover:scale-[1.02] disabled:opacity-40"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-textMuted transition-colors hover:text-textPrimary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Header */}
      <div className="bg-card/60 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          {/* BUG 3: Hamburger button — mobile only */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-textMuted transition-colors hover:bg-white/[0.06] hover:text-textPrimary md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300 ${
            currentRoutine
              ? 'bg-nutrition/10 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
              : activeAgent
              ? 'bg-primary/10 shadow-[0_0_16px_rgba(168,85,247,0.2)]'
              : 'bg-white/[0.03]'
          }`}>
            {activeAgent
              ? <Zap className="h-5 w-5 text-primary" />
              : <Bot className="h-5 w-5 text-muted-foreground/60" />
            }
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-foreground">
              {currentRoutine ? currentRoutine.name : activeAgent ? activeAgent.name : 'YAHA Assistant'}
            </h2>
            <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${
              currentRoutine ? 'text-nutrition' : activeAgent ? 'text-primary' : 'text-muted-foreground/40'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                currentRoutine ? 'bg-nutrition animate-pulse' : activeAgent ? 'bg-primary animate-pulse' : 'bg-muted-foreground/20'
              }`} />
              {currentRoutine ? 'Ritual Active' : activeAgent ? 'Agent Active' : 'Neutral Protocol'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* BUG 4: Save Chat button — shown when session is unnamed */}
          {(!session || session.title === 'New Chat') && currentSessionId !== 'new' && (
            <button
              type="button"
              onClick={() => {
                const suggestion = messages.find(m => m.role === 'user')?.content?.slice(0, 30) ?? 'My Chat'
                setSaveTitle(suggestion)
                setIsSaveModalOpen(true)
              }}
              className="rounded-full border border-nutrition/30 bg-nutrition/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-nutrition/80 transition-all hover:bg-nutrition/20 hover:text-nutrition"
            >
              Save Chat
            </button>
          )}
          {activeAgentId ? (
            <div className="hidden rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary shadow-[0_0_12px_rgba(168,85,247,0.15)] sm:block">
              Persistent Mode
            </div>
          ) : (
            <div className="hidden rounded-full bg-white/[0.03] border border-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 sm:block">
              Temporary Mode
            </div>
          )}

          {session?.active_routine_id && (
            <div className="hidden items-center gap-2 rounded-2xl bg-nutrition/5 border border-nutrition/20 pl-3 pr-2 py-1.5 md:flex shadow-[0_0_12px_rgba(16,185,129,0.1)]">
              <span className="text-[10px] font-black text-nutrition/70 uppercase tracking-widest truncate max-w-[100px]">
                {currentRoutine?.name || 'Ritual'}
              </span>
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-nutrition text-black">
                <span className="text-[9px] font-black">{session.current_step_index + 1}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages — invisible until hydrated to prevent first-paint flash */}
      <div className={`flex-1 overflow-y-auto px-4 py-10 space-y-6 lg:px-12 ${!isHydrated ? 'invisible' : ''}`}>
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-2xl bg-red-500/[0.08] border border-red-500/20 px-4 py-3 text-sm text-red-300 animate-in slide-in-from-top-2 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Zap className="h-4 w-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)} className="ml-3 shrink-0 text-red-500/50 hover:text-red-400 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-nutrition/20 via-primary/10 to-transparent border border-white/5 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              <Bot className="h-9 w-9 text-nutrition/80" />
            </div>
            <div className="space-y-2">
              <p className="text-base font-black tracking-widest uppercase text-foreground/80">YAHA Assistant</p>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">Log health data, start a ritual, or ask anything about your wellbeing.</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex w-full animate-in fade-in slide-in-from-bottom-3 duration-500 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="mr-2.5 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] border border-white/5">
                <Bot className="h-3.5 w-3.5 text-muted-foreground/60" />
              </div>
            )}

            <div className={`flex max-w-[82%] flex-col gap-3 lg:max-w-[68%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`rounded-3xl px-5 py-3.5 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-nutrition/90 to-nutrition/70 text-black font-medium shadow-[0_4px_24px_rgba(16,185,129,0.25)] rounded-br-lg'
                    : 'bg-white/[0.03] backdrop-blur-md border border-white/[0.06] text-foreground rounded-bl-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)]'
                }`}
              >
                <MarkdownText content={message.content.replace(/```json\s*[\s\S]*?```/g, '').trim()} />
              </div>

              {/* Attachments Display */}
              {message.attachments && message.attachments.length > 0 && (
                <div className={`flex flex-wrap gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.attachments.map((attachment, i: number) => {
                    const at = attachment as ChatAttachment
                    if (at.type === 'image') {
                      return (
                        <div key={i} className="relative group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                          <img
                            src={`data:${at.mimeType};base64,${at.base64}`}
                            alt={at.filename || 'Attachment'}
                            className="max-h-60 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        </div>
                      )
                    }
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-bold text-muted-foreground shadow-md">
                        <Paperclip className="h-3 w-3 text-muted-foreground/60" />
                        <span className="max-w-[150px] truncate">{at.filename || 'File'}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {message.actions && message.actions.length > 0 && (
                <div className="mt-1 w-full space-y-3">
                  {message.actions.map((card, idx) => (
                    <ActionCard
                      key={idx}
                      card={card}
                      messageId={message.id}
                      cardIndex={idx}
                      onConfirmed={
                        // When a routine is active, silently send a continue signal so the
                        // AI immediately prompts for the next step without user typing "next".
                        session?.active_routine_id
                          ? () => handleSendSilent('continue')
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-3 ml-2 animate-in fade-in duration-300">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] border border-white/5">
              <Bot className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <div className="flex items-center gap-1.5 rounded-3xl rounded-bl-lg bg-white/[0.03] border border-white/[0.06] px-5 py-3.5">
              <span className="h-1.5 w-1.5 rounded-full bg-nutrition/60 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-nutrition/60 animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-nutrition/60 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Active Ritual Banner */}
      {session?.active_routine_id && (
        <div className="mx-6 mb-4 flex items-center gap-4 rounded-3xl bg-nutrition/[0.06] border border-nutrition/20 p-4 animate-in slide-in-from-bottom-5 backdrop-blur-sm shadow-[0_0_20px_rgba(16,185,129,0.08)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-nutrition/20 shadow-[0_0_16px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="h-5 w-5 text-nutrition" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-nutrition/70">Active Ritual</p>
            <h4 className="text-sm font-black text-foreground">Step {session.current_step_index + 1} In Progress</h4>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
        </div>
      )}

      {/* Input — shrink-0 keeps it always visible above mobile bottom nav; no sticky needed inside flex column */}
      <div className="shrink-0 bg-card/60 backdrop-blur-xl border-t border-white/5 p-4 md:p-5 lg:px-12">
        <form onSubmit={handleSubmit} className="relative mx-auto max-w-4xl">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="relative flex items-end gap-2 rounded-[28px] bg-white/[0.03] border border-white/[0.08] p-2 pl-3 transition-all duration-300 focus-within:border-nutrition/30 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_24px_rgba(16,185,129,0.08)]">
            <div className="mb-1 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground/50 transition-all duration-200 hover:bg-white/[0.06] hover:text-muted-foreground"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <AgentSelector
                agents={agents || []}
                activeAgentId={activeAgentId}
                onSelect={handleAgentSelect}
              />
            </div>

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder="Speak to YAHA..."
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none md:text-base resize-none"
            />

            <button
              type="submit"
              disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nutrition text-black transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95 disabled:opacity-30 disabled:shadow-none disabled:scale-100"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {attachedFiles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachedFiles.map((af, i) => (
                <div key={i} className="flex items-center gap-2 rounded-full border border-nutrition/20 bg-nutrition/[0.06] py-1.5 pl-3 pr-2 text-[11px] font-bold text-nutrition/80 transition-all duration-200">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="max-w-[150px] truncate">{af.file.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedFiles(f => f.filter((_, idx) => idx !== i))}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-nutrition/20 hover:text-nutrition transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

function MarkdownText({ content }: { content: string }) {
  // Simple markdown-lite renderer for a "premium" feel without a heavy library
  const lines = content.split('\n')

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        // Handle Bullet Points
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          const text = line.trim().substring(2)
          return (
            <div key={i} className="flex gap-2.5 pl-1">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-nutrition/60" />
              <span className="leading-relaxed">{renderBold(text)}</span>
            </div>
          )
        }

        // Regular Paragraphs
        return <p key={i} className="leading-relaxed">{renderBold(line)}</p>
      })}
    </div>
  )
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-black text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}
