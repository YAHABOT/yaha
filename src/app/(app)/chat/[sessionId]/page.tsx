import { notFound } from 'next/navigation'
import { getSessions, getSession, getMessages } from '@/lib/db/chat'
import { getRoutine } from '@/lib/db/routines'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { ChatInterface } from '@/components/chat/ChatInterface'

type Props = {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ routine?: string }>
}

export default async function ChatSessionPage({ params, searchParams }: Props): Promise<React.ReactElement> {
  const { sessionId } = await params
  const { routine: routineParam } = await searchParams

  if (sessionId === 'new') {
    const [sessions, initialRoutine] = await Promise.all([
      getSessions(),
      routineParam ? getRoutine(routineParam).catch(() => null) : Promise.resolve(null)
    ])

    return (
      <div className="flex h-full">
        <ChatSidebar sessions={sessions} />
        <div className="flex flex-1 flex-col bg-background">
          <ChatInterface 
            initialMessages={[]} 
            sessionId="new" 
            session={null} 
            initialRoutine={initialRoutine}
          />
        </div>
      </div>
    )
  }

  // Flatten the waterfall: fetch sessions, session metadata, and messages all in parallel.
  // getRoutine needs active_routine_id from the session, so it runs in a second microtask —
  // but getMessages no longer waits on getSession, eliminating the main bottleneck.
  const [sessions, session, messages] = await Promise.all([
    getSessions(),
    getSession(sessionId).catch(() => null),
    getMessages(sessionId).catch(() => [] as Awaited<ReturnType<typeof getMessages>>),
  ])

  if (!session) notFound()

  const routine = session.active_routine_id
    ? await getRoutine(session.active_routine_id).catch(() => null)
    : null

  const sessionData = { session, messages, routine }

  return (
    <div className="flex h-full">
      <ChatSidebar sessions={sessions} currentSessionId={sessionId} />
      <div className="flex flex-1 flex-col bg-background">
        <ChatInterface 
          initialMessages={sessionData.messages} 
          sessionId={sessionId} 
          session={sessionData.session} 
          initialRoutine={sessionData.routine}
        />
      </div>
    </div>
  )
}
