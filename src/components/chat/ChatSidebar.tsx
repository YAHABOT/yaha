import Link from 'next/link'
import { Plus, MessageSquare } from 'lucide-react'
import type { ChatSession } from '@/types/chat'

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

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

function truncateTitle(title: string): string {
  if (title.length <= SESSION_TITLE_MAX_LENGTH) return title
  return title.slice(0, SESSION_TITLE_MAX_LENGTH) + '…'
}

export function ChatSidebar({ sessions, currentSessionId }: Props): React.ReactElement {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-sm font-semibold text-textPrimary">Conversations</h2>
        <Link
          href="/chat"
          className="flex items-center gap-1 rounded-lg p-1.5 text-textMuted transition-colors hover:bg-surfaceHighlight hover:text-textPrimary"
          aria-label="New Chat"
          title="New Chat"
        >
          <Plus className="h-4 w-4" />
        </Link>
      </div>

      {/* Session list */}
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Chat sessions">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <MessageSquare className="h-8 w-8 text-textMuted/40" />
            <p className="text-xs text-textMuted">No conversations yet</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((session) => {
              const isActive = session.id === currentSessionId
              return (
                <li key={session.id}>
                  <Link
                    href={`/chat/${session.id}`}
                    className={`flex flex-col gap-0.5 rounded-lg px-3 py-2.5 transition-colors ${
                      isActive
                        ? 'bg-surfaceHighlight text-textPrimary'
                        : 'text-textMuted hover:bg-surfaceHighlight/60 hover:text-textPrimary'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="truncate text-xs font-medium leading-tight">
                      {truncateTitle(session.title)}
                    </span>
                    <span className="text-xs text-textMuted/60">
                      {formatRelativeTime(session.updated_at)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </nav>
    </aside>
  )
}
