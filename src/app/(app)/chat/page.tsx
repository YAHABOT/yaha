import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MessageSquare, Plus } from 'lucide-react'
import { getSessions } from '@/lib/db/chat'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import type { ChatSession } from '@/types/chat'

type Props = {
  searchParams: Promise<{ routine?: string }>
}

function MobileSessionList({ sessions }: { sessions: ChatSession[] }): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background md:hidden">
      {/* Mobile header — shrink-0 so it never scrolls away */}
      <div className="shrink-0 border-b border-white/[0.06] p-4">
        <Link
          href="/chat/new"
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-nutrition px-4 py-3 text-sm font-black text-black transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-[0.98] shadow-[0_4px_16px_rgba(16,185,129,0.2)]"
        >
          <Plus className="h-4 w-4 stroke-[3px]" />
          New Chat
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-nutrition/20 bg-nutrition/10">
            <MessageSquare className="h-7 w-7 text-nutrition" />
          </div>
          <div>
            <p className="text-base font-black tracking-tight text-textPrimary">No conversations yet</p>
            <p className="mt-1 text-xs text-textMuted">
              Start your first conversation to log health data via chat.
            </p>
          </div>
        </div>
      ) : (
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Chat sessions">
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.25em] text-textMuted/40">
            My Sessions
          </p>
          <ul className="space-y-0.5">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/chat/${session.id}`}
                  className="flex flex-col gap-1 rounded-xl px-3.5 py-3 text-textMuted hover:bg-white/[0.03] hover:text-textPrimary border border-transparent transition-all duration-200"
                >
                  <span className="truncate text-sm font-bold tracking-tight text-textPrimary/80">
                    {session.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}

export default async function ChatPage({ searchParams }: Props): Promise<React.ReactElement> {
  const { routine } = await searchParams

  if (routine) {
    redirect(`/chat/new?routine=${routine}`)
  }

  const sessions = await getSessions()

  return (
    <div className="flex h-full">
      {/* Mobile: full-page session list — hidden on md+ */}
      <MobileSessionList sessions={sessions} />

      {/* Desktop: sidebar + main content split — hidden on mobile */}
      <ChatSidebar sessions={sessions} />

      {/* Desktop main content area — hidden on mobile */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-6 bg-background">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-nutrition/20 bg-nutrition/10">
              <MessageSquare className="h-7 w-7 text-nutrition" />
            </div>
            <div>
              <p className="text-base font-black tracking-tight text-textPrimary">No conversations yet</p>
              <p className="mt-1 text-xs text-textMuted">
                Start your first conversation to log health data via chat.
              </p>
            </div>
            <Link
              href="/chat/new"
              className="flex items-center gap-2 rounded-2xl border border-nutrition/30 bg-nutrition/10 px-5 py-2.5 text-sm font-bold text-nutrition transition-all duration-300 hover:border-nutrition/50 hover:bg-nutrition/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02]">
              <MessageSquare className="h-6 w-6 text-textMuted/50" />
            </div>
            <p className="text-xs text-textMuted">Select a conversation or start a new one.</p>
            <Link
              href="/chat/new"
              className="flex items-center gap-2 rounded-2xl border border-nutrition/30 bg-nutrition/10 px-5 py-2.5 text-sm font-bold text-nutrition transition-all duration-300 hover:border-nutrition/50 hover:bg-nutrition/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
