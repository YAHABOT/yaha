import { notFound } from 'next/navigation'
import { getSessions, getMessages } from '@/lib/db/chat'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { ChatInterface } from '@/components/chat/ChatInterface'

type Props = {
  params: Promise<{ sessionId: string }>
}

export default async function ChatSessionPage({ params }: Props): Promise<React.ReactElement> {
  const { sessionId } = await params

  // Handle "new" as a special route — no messages, fresh session
  if (sessionId === 'new') {
    const sessions = await getSessions()
    return (
      <div className="flex h-full">
        <ChatSidebar sessions={sessions} />
        <div className="flex flex-1 flex-col bg-background">
          <ChatInterface initialMessages={[]} sessionId="new" />
        </div>
      </div>
    )
  }

  let messages
  try {
    messages = await getMessages(sessionId)
  } catch {
    // getMessages throws when session doesn't exist or doesn't belong to user
    notFound()
  }

  const sessions = await getSessions()

  return (
    <div className="flex h-full">
      <ChatSidebar sessions={sessions} currentSessionId={sessionId} />
      <div className="flex flex-1 flex-col bg-background">
        <ChatInterface initialMessages={messages} sessionId={sessionId} />
      </div>
    </div>
  )
}
