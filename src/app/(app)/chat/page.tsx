import Link from 'next/link'
import { MessageSquare, Plus } from 'lucide-react'
import { getSessions } from '@/lib/db/chat'
import { ChatSidebar } from '@/components/chat/ChatSidebar'

export default async function ChatPage(): Promise<React.ReactElement> {
  const sessions = await getSessions()

  return (
    <div className="flex h-full">
      <ChatSidebar sessions={sessions} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <MessageSquare className="h-12 w-12 text-textMuted/40" />
            <div>
              <p className="text-lg font-semibold text-textPrimary">No conversations yet</p>
              <p className="mt-1 text-sm text-textMuted">
                Start your first conversation to log health data via chat.
              </p>
            </div>
            <Link
              href="/chat/new"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <MessageSquare className="h-10 w-10 text-textMuted/40" />
            <p className="text-sm text-textMuted">Select a conversation or start a new one.</p>
            <Link
              href="/chat/new"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
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
