'use client'
// Needed: uses useState, useEffect, useRef, useRouter for interactive session list + new chat input

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  X,
  CheckSquare,
  Square,
  Send,
  Loader2,
  Paperclip,
  Image,
  FileText,
} from 'lucide-react'
import type { ChatSession } from '@/types/chat'
import type { Agent } from '@/types/agent'
import type { ChatAttachment } from '@/types/action-card'
import { AgentSelector } from '@/components/chat/AgentSelector'
import { deleteSessionAction, deleteSessionsAction, renameSessionAction } from '@/app/actions/chat'
import { getAgentsAction } from '@/app/actions/agents'

const SESSION_TITLE_MAX_LENGTH = 30
const ACCEPTED_IMAGE_TYPES = 'image/*'
// Gemini inlineData only supports text/plain, text/csv, and application/pdf — Office formats excluded
const ACCEPTED_FILE_TYPES = '.txt,.pdf,.csv'
const MAX_IMAGE_PX = 1280
const IMAGE_QUALITY = 0.8

async function compressImageMobile(file: File): Promise<string> {
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

type MobileChatHomeProps = {
  sessions: ChatSession[]
}

function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes < 1) return 'now'
  if (diffMinutes < 60) return `${diffMinutes}m`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function MobileChatHome({ sessions }: MobileChatHomeProps): React.ReactElement {
  const [localSessions, setLocalSessions] = useState<ChatSession[]>(sessions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState<string>('')
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false)
  const [input, setInput] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<ChatAttachment[]>([])
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState<boolean>(false)
  // Hydration guard: formatRelativeTime uses new Date() which differs between SSR and client
  const [mounted, setMounted] = useState<boolean>(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileImageInputRef = useRef<HTMLInputElement>(null)
  const fileDocInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    getAgentsAction().then(setAgents)
  }, [])

  // Close attach menu on outside click
  useEffect(() => {
    if (!isAttachMenuOpen) return
    function handleOutsideClick(): void { setIsAttachMenuOpen(false) }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [isAttachMenuOpen])

  // Auto-resize textarea based on content
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  const handleRename = async (id: string): Promise<void> => {
    if (!editTitle.trim()) {
      setEditingId(null)
      return
    }
    const newTitle = editTitle.trim()
    const res = await renameSessionAction(id, newTitle)
    if (res.success) {
      setEditingId(null)
      // Update local sessions immediately so title reflects without waiting for revalidation
      setLocalSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
      )
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this conversation?')) return

    // Snapshot current state BEFORE optimistic removal so renames are preserved on restore
    const snapshot = localSessions
    setLocalSessions((prev) => prev.filter((s) => s.id !== id))
    setIsDeleting(id)
    const res = await deleteSessionAction(id)
    if (!res.success) {
      setLocalSessions(snapshot)
    }
    setIsDeleting(null)
  }

  const toggleSelection = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleBulkDelete = async (): Promise<void> => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} conversation${selectedIds.size > 1 ? 's' : ''}?`)) return

    setIsBulkDeleting(true)
    const ids = Array.from(selectedIds)
    // Snapshot current state BEFORE optimistic removal so renames are preserved on restore
    const snapshot = localSessions
    setLocalSessions((prev) => prev.filter((s) => !ids.includes(s.id)))
    const res = await deleteSessionsAction(ids)
    if (res.success) {
      setIsSelectionMode(false)
      setSelectedIds(new Set())
    } else {
      setLocalSessions(snapshot)
    }
    setIsBulkDeleting(false)
  }

  const exitSelectionMode = (): void => {
    setIsSelectionMode(false)
    setSelectedIds(new Set())
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    const converted = await Promise.all(
      files.map(async (file): Promise<ChatAttachment> => {
        const isImage = file.type.startsWith('image/')
        let base64: string
        let mimeType: string
        if (isImage) {
          base64 = await compressImageMobile(file)
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
          type: isImage ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
          base64,
          mimeType,
          filename: file.name,
        }
      })
    )
    setAttachedFiles((prev) => [...prev, ...converted])
    if (fileImageInputRef.current) fileImageInputRef.current.value = ''
    if (fileDocInputRef.current) fileDocInputRef.current.value = ''
  }, [])

  const handleSend = useCallback(async (): Promise<void> => {
    const trimmed = input.trim()
    if ((!trimmed && attachedFiles.length === 0) || isSubmitting) return
    setIsSubmitting(true)
    const snapshotAttachments = attachedFiles.length > 0 ? attachedFiles : undefined
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId: 'new',
          agentId: activeAgentId,
          attachments: snapshotAttachments,
        }),
      })
      if (!res.ok) throw new Error('Failed to start chat')
      const data = (await res.json()) as { sessionId: string }
      router.push(`/chat/${data.sessionId}`)
    } catch {
      setIsSubmitting(false)
    }
  }, [input, attachedFiles, activeAgentId, isSubmitting, router])

  const allSelected = localSessions.length > 0 && selectedIds.size === localSessions.length

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-background md:hidden">
      {/* Fixed header */}
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-4">
        {!isSelectionMode ? (
          <div className="flex items-center justify-between">
            <h1 className="text-base font-black tracking-tight text-textPrimary">Chat</h1>
            {localSessions.length > 0 && (
              <button
                type="button"
                onClick={() => setIsSelectionMode(true)}
                className="text-[11px] font-black uppercase tracking-widest text-textMuted/40 hover:text-textMuted/70 transition-colors"
              >
                Select
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={allSelected
                  ? () => setSelectedIds(new Set())
                  : () => setSelectedIds(new Set(localSessions.map((s) => s.id)))}
                className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-textMuted/50 hover:text-textMuted transition-colors"
              >
                {allSelected
                  ? <CheckSquare className="h-3.5 w-3.5 text-nutrition" />
                  : <Square className="h-3.5 w-3.5" />
                }
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => void handleBulkDelete()}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-[11px] font-black text-red-400 transition-all duration-200 hover:bg-red-500/20 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete {selectedIds.size}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={exitSelectionMode}
              className="text-[11px] font-black uppercase tracking-widest text-textMuted/40 hover:text-textMuted/70 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Sessions list — flex-1, scrollable */}
      {localSessions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-nutrition/20 bg-nutrition/10">
            <MessageSquare className="h-7 w-7 text-nutrition" />
          </div>
          <div>
            <p className="text-base font-black tracking-tight text-textPrimary">No conversations yet</p>
            <p className="mt-1 text-xs text-textMuted">
              Type a message below to start logging your health data.
            </p>
          </div>
        </div>
      ) : (
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="Chat sessions">
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.25em] text-textMuted/40">
            My Sessions
          </p>
          <ul className="space-y-0.5">
            {localSessions.map((session) => {
              const isProcessing = isDeleting === session.id
              const isSelected = selectedIds.has(session.id)

              // Inline rename mode
              if (!isSelectionMode && editingId === session.id) {
                return (
                  <li
                    key={session.id}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5"
                  >
                    <input
                      autoFocus
                      maxLength={SESSION_TITLE_MAX_LENGTH}
                      className="flex-1 bg-white/[0.04] border border-white/20 rounded-lg px-2 py-0.5 text-xs font-bold text-foreground outline-none focus:border-nutrition/50"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRename(session.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleRename(session.id)}
                        className="p-1 rounded-lg text-nutrition hover:bg-nutrition/10 transition-colors"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded-lg text-textMuted/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </li>
                )
              }

              // Selection mode
              if (isSelectionMode) {
                return (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => toggleSelection(session.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all duration-200 ${
                        isSelected
                          ? 'bg-red-500/[0.08] border border-red-500/20 text-foreground'
                          : 'border border-transparent text-textMuted hover:bg-white/[0.03] hover:text-foreground'
                      }`}
                    >
                      <span className="shrink-0 text-textMuted/40">
                        {isSelected
                          ? <CheckSquare className="h-3.5 w-3.5 text-red-400" />
                          : <Square className="h-3.5 w-3.5" />
                        }
                      </span>
                      <span className="truncate text-sm font-bold tracking-tight">
                        {session.title}
                      </span>
                    </button>
                  </li>
                )
              }

              // Normal mode
              return (
                <li key={session.id} className="group relative">
                  <Link
                    href={`/chat/${session.id}`}
                    className={`flex flex-col gap-1 rounded-xl px-3.5 py-3 border border-transparent text-textMuted hover:bg-white/[0.03] hover:text-foreground transition-all duration-200 ${
                      isProcessing ? 'opacity-40 pointer-events-none' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-25 group-hover:opacity-60 transition-opacity">
                        {session.active_agent_id ? 'Agent' : 'Neutral'}
                      </span>
                      <span className="text-[10px] font-medium tabular-nums opacity-25 group-hover:opacity-50 transition-opacity">
                        {mounted ? formatRelativeTime(session.updated_at) : ''}
                      </span>
                    </div>
                    <span className="truncate text-sm font-bold tracking-tight text-foreground/70 pr-16">
                      {session.title}
                    </span>
                  </Link>

                  {/* Always-visible action buttons */}
                  <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setEditingId(session.id)
                        setEditTitle(session.title)
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/60 text-textMuted/50 hover:text-foreground hover:bg-white/10 transition-all duration-150"
                      title="Rename Chat"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => void handleDelete(session.id, e)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/60 text-textMuted/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
                      title="Delete Chat"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </nav>
      )}

      {/* New chat input — fixed at bottom */}
      <div className="shrink-0 border-t border-white/5 bg-card/60 backdrop-blur-xl px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        {/* Hidden file inputs */}
        <input
          ref={fileImageInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          multiple
          onChange={(e) => void handleFileChange(e)}
          className="hidden"
        />
        <input
          ref={fileDocInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          onChange={(e) => void handleFileChange(e)}
          className="hidden"
        />

        {/* Attached file chips */}
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachedFiles.map((att, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-full border border-nutrition/20 bg-nutrition/[0.06] py-1 pl-2.5 pr-1.5 text-[10px] font-bold text-nutrition/80">
                <span className="max-w-[100px] truncate">{att.filename ?? (att.type === 'image' ? 'Image' : 'File')}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="rounded-full p-0.5 hover:bg-nutrition/20 transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-end gap-2 rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-2 pl-3 focus-within:border-nutrition/30 focus-within:bg-white/[0.05]">
          {/* Left controls: attach + agent selector */}
          <div className="mb-1 flex items-center gap-0.5 relative">
            {/* Attach menu popover */}
            {isAttachMenuOpen && (
              <div className="absolute bottom-11 left-0 z-20 flex flex-col gap-1 rounded-2xl border border-white/10 bg-[#0A0A0A] p-2 shadow-2xl animate-in slide-in-from-bottom-2 duration-150">
                <button
                  type="button"
                  onClick={() => { setIsAttachMenuOpen(false); fileImageInputRef.current?.click() }}
                  className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-textPrimary/80 transition-all hover:bg-white/[0.06] hover:text-textPrimary whitespace-nowrap"
                >
                  <Image className="h-4 w-4 text-sleep shrink-0" />
                  Attach Image
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
              agents={agents}
              activeAgentId={activeAgentId}
              onSelect={(id) => setActiveAgentId(id)}
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
                void handleSend()
              }
            }}
            placeholder="Type here to start a new chat..."
            className="min-w-0 flex-1 resize-none bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={isSubmitting || (!input.trim() && attachedFiles.length === 0)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nutrition text-black transition-all hover:scale-105 disabled:opacity-30 disabled:scale-100"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
