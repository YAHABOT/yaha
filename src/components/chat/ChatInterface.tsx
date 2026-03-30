'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Paperclip, Send, X, Bot, Zap, CheckCircle2, ChevronRight, Menu, Image, FileText, Camera } from 'lucide-react'
import { ActionCard } from '@/components/chat/ActionCard'
import { CreateTrackerCard } from '@/components/chat/CreateTrackerCard'
import { AgentSelector } from '@/components/chat/AgentSelector'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import type { ChatMessage, ChatSession } from '@/types/chat'
import type { ChatAttachment } from '@/types/action-card'
import type { Agent } from '@/types/agent'
import type { Routine } from '@/types/routine'
import { getAgentsAction } from '@/app/actions/agents'
import { renameSessionAction } from '@/app/actions/chat'

// Returns YYYY-MM-DD in the user's LOCAL timezone — avoids UTC midnight boundary issues
// where UTC+7 users in the early morning would get yesterday's UTC date as "today".
function getLocalDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MAX_TEXTAREA_ROWS = 6
// Routine trigger TTL: 30 minutes. Prevents re-firing on page reload when the
// routine is still in progress. Legitimate re-starts work after the TTL expires.
const ROUTINE_TRIGGER_TTL_MS = 30 * 60 * 1000
const ACCEPTED_IMAGE_TYPES = 'image/*'
// Gemini inlineData only supports text/plain, text/csv, and application/pdf — Office formats excluded
const ACCEPTED_FILE_TYPES = '.txt,.pdf,.csv,application/pdf,text/plain,text/csv'
const ALLOWED_MIME_PREFIXES = ['image/', 'audio/']
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
])

function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p)) || ALLOWED_MIME_EXACT.has(mimeType)
}

const MAX_IMAGE_PX = 1280
const IMAGE_QUALITY = 0.8

async function compressImage(file: File): Promise<string> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, MAX_IMAGE_PX / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', IMAGE_QUALITY).split(',')[1]
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
  confirmOnRefresh?: boolean
}

export function ChatInterface({ initialMessages, sessionId, session: initialSession, initialRoutine, sessions = [], confirmOnRefresh = true }: Props): React.ReactElement {
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
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState<boolean>(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileDocInputRef = useRef<HTMLInputElement>(null)
  const fileCameraInputRef = useRef<HTMLInputElement>(null)
  // FIX-4: abort in-flight chat request on unmount to prevent ghost/duplicate responses
  const abortControllerRef = useRef<AbortController | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const triggerSent = useRef(false)

  // Mark hydrated after first client paint so the messages area doesn't flash unstyled
  useEffect(() => { setIsHydrated(true) }, [])

  // Warn before page refresh/close when a routine is actively in progress
  useEffect(() => {
    if (!confirmOnRefresh || !currentRoutine || !session?.active_routine_id) return
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      e.returnValue = ''  // Required for Chrome to show the native dialog
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [confirmOnRefresh, currentRoutine, session?.active_routine_id])

  // FIX-4: track mount state to prevent state updates after unmount (e.g. app switch)
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  // Close attachment menu when clicking outside
  useEffect(() => {
    if (!isAttachMenuOpen) return
    function handleOutsideClick(): void {
      setIsAttachMenuOpen(false)
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [isAttachMenuOpen])

  // Fetch Agents
  useEffect(() => {
    getAgentsAction().then(setAgents)
  }, [])

  // Auto-trigger ritual if routine param is provided.
  // Triple-locked: triggerSent.current (per-instance) + sessionStorage TTL (survives
  // React StrictMode remounts + short navigations) + active_routine_id DB state (survives
  // full page reloads by redirecting to the real session URL).
  useEffect(() => {
    if (triggerSent.current) return
    const routineId = searchParams.get('routine')
    if (!routineId || sessionId !== 'new' || messages.length > 0) return

    // If a routine is already active in the current session state, skip re-trigger.
    // This handles the case where session state was refreshed after initial trigger.
    if (session?.active_routine_id) return

    const storageKey = `yaha_trigger_${routineId}`
    const sessionKey = `yaha_trigger_session_${routineId}`
    const lastTs = sessionStorage.getItem(storageKey)

    // If we previously triggered this routine and have a real session ID stored,
    // redirect to that session so the DB state (active_routine_id, current_step_index)
    // is loaded on next mount — preventing a re-start from step 0.
    const savedSessionId = sessionStorage.getItem(sessionKey)
    if (lastTs && savedSessionId && Date.now() - Number(lastTs) < ROUTINE_TRIGGER_TTL_MS) {
      router.replace(`/chat/${savedSessionId}`)
      return
    }

    // Clear stale session key if TTL expired
    if (!lastTs || Date.now() - Number(lastTs) >= ROUTINE_TRIGGER_TTL_MS) {
      sessionStorage.removeItem(sessionKey)
    }

    triggerSent.current = true
    sessionStorage.setItem(storageKey, String(Date.now()))

    const trigger = currentRoutine?.trigger_phrase || 'start ritual'
    handleSendInternal(trigger, routineId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, sessionId, messages.length, currentRoutine, session?.active_routine_id, router])

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
        if (!isMountedRef.current) return
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
        body: JSON.stringify({ message: text, sessionId: currentSessionId, agentId: activeAgentId, date: getLocalDateStr() }),
        signal: abortControllerRef.current?.signal
      })
      if (!res.ok) return
      const data = await res.json()
      if (!isMountedRef.current) return
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
        if (!isMountedRef.current) return
        setSession(nextSession)
        if (nextSession.active_routine_id) {
          const routRes = await fetch(`/api/routines/${nextSession.active_routine_id}`)
          if (routRes.ok) {
            if (!isMountedRef.current) return
            setCurrentRoutine(await routRes.json())
          }
        } else {
          setCurrentRoutine(null)
          // Routine completed via silent auto-advance — clear the session storage
          // entry so the next trigger starts fresh rather than redirecting here.
          const routineParam = searchParams.get('routine')
          if (routineParam) {
            sessionStorage.removeItem(`yaha_trigger_${routineParam}`)
            sessionStorage.removeItem(`yaha_trigger_session_${routineParam}`)
          }
        }
      }
    } catch {
      // Silent — don't surface errors from auto-advance
    } finally {
      if (isMountedRef.current) setIsLoading(false)
    }
  }

  async function handleSendInternal(text: string, routineId?: string) {
    if (isLoading) return
    setIsLoading(true)

    // User message is optimistic
    const optimisticId = `opt-${Date.now()}`
    const optimistic: ChatMessage = {
      id: optimisticId,
      session_id: currentSessionId,
      role: 'user',
      content: text,
      actions: null,
      created_at: new Date().toISOString()
    }
    setMessages((prev) => [...prev, optimistic])

    // FIX-4: cancel any previous in-flight request; create fresh controller
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: currentSessionId, routineId, agentId: activeAgentId, date: getLocalDateStr() }),
        signal: controller.signal,
      })
      if (!res.ok) {
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

      if (!isMountedRef.current) return
      const newMsgId = data.message?.id ?? `mod-${Date.now()}`
      setMessages((prev) => {
        // FIX-4: deduplicate — skip if message with this id already exists
        if (prev.some(m => m.id === newMsgId)) return prev
        return [...prev, {
          // Use the real DB-assigned UUID so ActionCard can pass it to confirmLogAction
          // and persist confirmed:true onto the correct chat_messages row.
          id: newMsgId,
          session_id: data.sessionId,
          role: 'assistant',
          content: data.message.content,
          actions: data.message.actions,
          created_at: new Date().toISOString()
        }]
      })

      // Track the real session UUID in state for subsequent API calls.
      // Do NOT update the URL — Next.js 15 intercepts window.history.replaceState
      // and triggers a full page remount when the path segment changes.
      // The URL stays as /chat/new for the lifetime of this unsaved chat.
      if (data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.sessionId)
      }

      // Persist the real session ID for active routine so page refresh can redirect
      // to /chat/[sessionId] instead of re-triggering the routine from step 0.
      if (routineId && data.sessionId) {
        sessionStorage.setItem(`yaha_trigger_session_${routineId}`, data.sessionId)
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return // navigated away
      if (!isMountedRef.current) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (isMountedRef.current) setIsLoading(false)
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
      if (fileDocInputRef.current) fileDocInputRef.current.value = ''
      if (fileCameraInputRef.current) fileCameraInputRef.current.value = ''
      return
    }

    const converted = await Promise.all(
      files.map(async (file): Promise<AttachedFile> => {
        const isImage = file.type.startsWith('image/')
        let base64: string
        let mimeType: string
        if (isImage) {
          base64 = await compressImage(file)
          mimeType = 'image/jpeg'
        } else {
          base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve((reader.result as string).split(',')[1])
            reader.readAsDataURL(file)
          })
          mimeType = file.type
        }
        return {
          file,
          attachment: {
            type: isImage ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
            base64,
            mimeType,
            filename: file.name
          }
        }
      })
    )

    setAttachedFiles((prev) => [...prev, ...converted])
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (fileDocInputRef.current) fileDocInputRef.current.value = ''
    if (fileCameraInputRef.current) fileCameraInputRef.current.value = ''
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed && attachedFiles.length === 0) return
    if (isLoading) return

    // Snapshot attachments before clearing state
    const snapshotAttachments = attachedFiles.map(af => af.attachment)

    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      session_id: currentSessionId,
      role: 'user',
      content: trimmed || (attachedFiles.length > 0 ? '' : '[Empty]'),
      actions: null,
      attachments: snapshotAttachments,
      created_at: new Date().toISOString()
    }

    setMessages((prev) => [...prev, optimistic])
    setInput('')
    setAttachedFiles([])
    setIsLoading(true)

    // FIX-4: cancel any previous in-flight request; create fresh controller
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId: currentSessionId,
          agentId: activeAgentId,
          attachments: snapshotAttachments,
          date: getLocalDateStr(),
        }),
        signal: controller.signal,
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
      if (!isMountedRef.current) return
      const assistantMsgId = data.message?.id ?? `mod-${Date.now()}`
      setMessages((prev) => {
        // FIX-4: deduplicate — skip if this message id already exists in state
        if (prev.some(m => m.id === assistantMsgId)) return prev
        return [...prev, {
          id: assistantMsgId,
          session_id: data.sessionId,
          role: 'assistant',
          content: data.message.content,
          actions: data.message.actions,
          attachments: data.message.attachments || null,
          created_at: new Date().toISOString()
        }]
      })

      setAttachedFiles([]) // Clear attachments after success

      // Update session state (routine progress etc.)
      const sessRes = await fetch(`/api/chat/sessions/${data.sessionId}`)
      if (sessRes.ok) {
        const nextSession = await sessRes.json()
        if (!isMountedRef.current) return
        setSession(nextSession)

        if (nextSession.active_routine_id) {
          const routRes = await fetch(`/api/routines/${nextSession.active_routine_id}`)
          if (routRes.ok) {
            if (!isMountedRef.current) return
            setCurrentRoutine(await routRes.json())
          }
        } else {
          setCurrentRoutine(null)
          // Routine completed — clear the session storage entry so the next start
          // of the same routine creates a fresh session rather than redirecting to
          // this completed one.
          const routineParam = searchParams.get('routine')
          if (routineParam) {
            sessionStorage.removeItem(`yaha_trigger_${routineParam}`)
            sessionStorage.removeItem(`yaha_trigger_session_${routineParam}`)
          }
        }
      }

      // Track the real session UUID in state for subsequent API calls.
      // Do NOT update the URL — Next.js 15 intercepts window.history.replaceState
      // and triggers a full page remount when the path segment changes.
      // The URL stays as /chat/new for the lifetime of this unsaved chat.
      if (data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.sessionId)
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return // navigated away
      if (!isMountedRef.current) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (isMountedRef.current) setIsLoading(false)
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
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      {/* BUG 3: Mobile sidebar overlay */}
      {isMobileSidebarOpen && (
        // Outer div handles close-on-backdrop-click. pointer-events-none on the visual
        // backdrop prevents iOS Safari from creating a stacking context that traps touches.
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setIsMobileSidebarOpen(false)}>
          {/* Visual backdrop — pointer-events-none so it never intercepts touch events */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-none" />
          {/* Sidebar panel — stopPropagation prevents close when clicking inside */}
          <div
            className="absolute left-0 top-0 z-10 h-full w-72 animate-in slide-in-from-left-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
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

      {/* Dynamic Header — shrink-0 keeps it pinned at top while messages scroll */}
      <div className="shrink-0 bg-card/60 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 py-3 md:px-6">
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

      {/* Messages — min-h-0 is critical: without it a flex child won't shrink below content height,
           causing the whole page to scroll instead of just this element */}
      <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-10 space-y-6 lg:px-12 ${!isHydrated ? 'invisible' : ''}`}>
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
                  {message.actions.map((card, idx) => {
                    if (card.type === 'CREATE_TRACKER') {
                      return (
                        <CreateTrackerCard
                          key={idx}
                          card={card}
                          messageId={message.id}
                          cardIndex={idx}
                          onConfirm={() => {
                            setMessages(prev => prev.map(msg => {
                              if (msg.id !== message.id || !msg.actions) return msg
                              const updatedActions = msg.actions.map((a, i) =>
                                i === idx ? { ...a, confirmed: true } : a
                              )
                              return { ...msg, actions: updatedActions }
                            }))
                          }}
                        />
                      )
                    }
                    return (
                      <ActionCard
                        key={idx}
                        card={card}
                        messageId={message.id}
                        cardIndex={idx}
                        onConfirm={() => {
                          // FIX-5: persist confirmed=true into in-memory messages state so
                          // subsequent renders in the same session don't revert to pending
                          setMessages(prev => prev.map(msg => {
                            if (msg.id !== message.id || !msg.actions) return msg
                            const updatedActions = msg.actions.map((a, i) =>
                              i === idx ? { ...a, confirmed: true } : a
                            )
                            return { ...msg, actions: updatedActions }
                          }))
                        }}
                        onConfirmed={
                          // When a routine is active, silently send a continue signal so the
                          // AI immediately prompts for the next step without user typing "next".
                          session?.active_routine_id
                            ? () => handleSendSilent('continue')
                            : undefined
                        }
                      />
                    )
                  })}
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
      <div className="shrink-0 bg-card/60 backdrop-blur-xl border-t border-white/5 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:p-5 lg:px-12">
        <form onSubmit={handleSubmit} className="relative mx-auto max-w-4xl">
          {/* Image file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          {/* Camera capture input */}
          <input
            ref={fileCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          {/* Document/file input */}
          <input
            ref={fileDocInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="relative flex items-end gap-2 rounded-[28px] bg-white/[0.03] border border-white/[0.08] p-2 pl-3 transition-all duration-300 focus-within:border-nutrition/30 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_24px_rgba(16,185,129,0.08)]">
            <div className="mb-1 flex items-center gap-0.5 relative">
              {/* Attach menu popover */}
              {isAttachMenuOpen && (
                <div className="absolute bottom-11 left-0 z-20 flex flex-col gap-1 rounded-2xl border border-white/10 bg-[#0A0A0A] p-2 shadow-2xl animate-in slide-in-from-bottom-2 duration-150">
                  <button
                    type="button"
                    onClick={() => { setIsAttachMenuOpen(false); fileCameraInputRef.current?.click() }}
                    className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-textPrimary/80 transition-all hover:bg-white/[0.06] hover:text-textPrimary whitespace-nowrap"
                  >
                    <Camera className="h-4 w-4 text-mood shrink-0" />
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsAttachMenuOpen(false); fileInputRef.current?.click() }}
                    className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-textPrimary/80 transition-all hover:bg-white/[0.06] hover:text-textPrimary whitespace-nowrap"
                  >
                    <Image className="h-4 w-4 text-sleep shrink-0" />
                    Photo Library
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAttachMenuOpen(false)
                      // Delay click by one tick — closing the menu triggers a re-render that
                      // can swallow the click event on mobile before the input fires.
                      setTimeout(() => fileDocInputRef.current?.click(), 0)
                    }}
                    className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-textPrimary/80 transition-all hover:bg-white/[0.06] hover:text-textPrimary whitespace-nowrap"
                  >
                    <FileText className="h-4 w-4 text-workout shrink-0" />
                    Attach File
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsAttachMenuOpen(v => !v)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground/50 transition-all duration-200 hover:bg-white/[0.06] hover:text-muted-foreground"
                aria-label="Attach file or image"
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
                // Shift+Enter sends — plain Enter inserts a newline (textarea default)
                if (e.key === 'Enter' && e.shiftKey) {
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
