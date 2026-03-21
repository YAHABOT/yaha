'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus, MessageSquare, Trash2, Check, X, Pencil } from 'lucide-react'
import type { ChatSession } from '@/types/chat'
import { deleteSessionAction, renameSessionAction } from '@/app/actions/chat'

const SESSION_TITLE_MAX_LENGTH = 30

type Props = {
  sessions: ChatSession[]
  currentSessionId?: string
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

export function ChatSidebar({ sessions, currentSessionId }: Props): React.ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const router = useRouter()

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null)
      return
    }
    const res = await renameSessionAction(id, editTitle.trim())
    if (res.success) {
      setEditingId(null)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this conversation?')) return

    setIsDeleting(id)
    const res = await deleteSessionAction(id)
    if (res.success && id === currentSessionId) {
      router.push('/chat')
    }
    setIsDeleting(null)
  }

  return (
    <aside className="hidden md:flex h-full w-72 flex-col border-r border-white/[0.06] bg-card/50 backdrop-blur-xl">
      {/* Header */}
      <div className="p-4 space-y-4 border-b border-white/[0.04]">
        <Link
          href="/chat"
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-nutrition px-4 py-3 text-sm font-black text-black transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-[0.98] shadow-[0_4px_16px_rgba(16,185,129,0.2)]"
        >
          <Plus className="h-4 w-4 stroke-[3px]" />
          New Chat
        </Link>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 px-1">
          My Sessions
        </p>
      </div>

      {/* Session list */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-hide" aria-label="Chat sessions">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.02] border border-white/[0.04]">
              <MessageSquare className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">
                Empty Archives
              </p>
              <p className="text-[10px] text-muted-foreground/25 font-medium">
                Start a new conversation
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((session) => {
              const isActive = session.id === currentSessionId
              const isProcessing = isDeleting === session.id

              if (editingId === session.id) {
                return (
                  <li
                    key={session.id}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5"
                  >
                    <input
                      autoFocus
                      className="flex-1 bg-transparent text-xs font-bold text-foreground outline-none"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(session.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleRename(session.id)}
                        className="p-1 rounded-lg text-nutrition hover:bg-nutrition/10 transition-colors"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </li>
                )
              }

              return (
                <li key={session.id} className="group relative">
                  <Link
                    href={`/chat/${session.id}`}
                    className={`flex flex-col gap-1 rounded-xl px-3.5 py-3 transition-all duration-200 ${
                      isActive
                        ? 'bg-nutrition/[0.08] border border-nutrition/20 text-foreground shadow-[0_0_16px_rgba(16,185,129,0.08)]'
                        : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground border border-transparent'
                    } ${isProcessing ? 'opacity-40 pointer-events-none' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-opacity ${
                        isActive ? 'text-nutrition opacity-100' : 'opacity-25 group-hover:opacity-60'
                      }`}>
                        {session.active_agent_id ? 'Agent' : 'Neutral'}
                      </span>
                      <span className={`text-[10px] font-medium tabular-nums transition-opacity ${
                        isActive ? 'text-muted-foreground opacity-70' : 'opacity-25 group-hover:opacity-50'
                      }`}>
                        {formatRelativeTime(session.updated_at)}
                      </span>
                    </div>
                    <span className={`truncate text-sm font-bold tracking-tight pr-12 ${
                      isActive ? 'text-foreground' : 'text-foreground/70'
                    }`}>
                      {session.title}
                    </span>
                  </Link>

                  {/* Action buttons — visible on hover or active */}
                  <div className={`absolute right-2.5 bottom-2.5 flex items-center gap-1 transition-all duration-200 ${
                    isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0'
                  }`}>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        setEditingId(session.id)
                        setEditTitle(session.title)
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-lg bg-background/60 text-muted-foreground/50 hover:text-foreground hover:bg-white/10 transition-all duration-150"
                      title="Rename Chat"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(session.id, e)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg bg-background/60 text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
                      title="Delete Chat"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </nav>
    </aside>
  )
}
