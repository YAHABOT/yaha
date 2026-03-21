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

  // Fetch session data in parallel
  const [sessions, sessionData] = await Promise.all([
    getSessions(),
    (async () => {
      try {
        const s = await getSession(sessionId)
        const [m, r] = await Promise.all([
          getMessages(sessionId),
          s.active_routine_id ? getRoutine(s.active_routine_id).catch(() => null) : Promise.resolve(null)
        ])
        return { session: s, messages: m, routine: r }
      } catch {
        return null
      }
    })()
  ])

  if (!sessionData) notFound()

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
