import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MessageSquare, Plus } from 'lucide-react'
import { getSessions } from '@/lib/db/chat'
import { ChatSidebar } from '@/components/chat/ChatSidebar'

type Props = {
  searchParams: Promise<{ routine?: string }>
}

export default async function ChatPage({ searchParams }: Props): Promise<React.ReactElement> {
  const { routine } = await searchParams
  
  if (routine) {
    redirect(`/chat/new?routine=${routine}`)
  }

  const sessions = await getSessions()

  return (
    <div className="flex h-full">
      <ChatSidebar sessions={sessions} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background">
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
