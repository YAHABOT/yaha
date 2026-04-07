export const dynamic = 'force-dynamic'

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
      routineParam ? getRoutine(routineParam).catch(() => null) : Promise.resolve(null),
    ])

    return (
      <div className="flex min-h-0 overflow-hidden">
        <ChatSidebar sessions={sessions} />
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden bg-background">
          <ChatInterface
            initialMessages={[]}
            sessionId="new"
            session={null}
            initialRoutine={initialRoutine}
            sessions={sessions}
          />
        </div>
      </div>
    )
  }

  // Two-phase parallel fetch:
  // Phase 1: fire getSessions early (it doesn't need session data) while also
  //   fetching session metadata + messages simultaneously.
  // Phase 2: join getSessions with getRoutine (which needs active_routine_id from phase 1).
  //   This eliminates any case where a slow getSessions delays the final render.
  const sessionsPromise = getSessions()

  const [session, messages] = await Promise.all([
    getSession(sessionId).catch(() => null),
    getMessages(sessionId).catch(() => [] as Awaited<ReturnType<typeof getMessages>>),
  ])

  if (!session) notFound()

  const [sessions, routine] = await Promise.all([
    sessionsPromise,
    session.active_routine_id
      ? getRoutine(session.active_routine_id).catch(() => null)
      : Promise.resolve(null),
  ])

  const sessionData = { session, messages, routine }

  return (
    <div className="flex min-h-0 overflow-hidden">
      <ChatSidebar sessions={sessions} currentSessionId={sessionId} />
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden bg-background">
        <ChatInterface
          initialMessages={sessionData.messages}
          sessionId={sessionId}
          session={sessionData.session}
          initialRoutine={sessionData.routine}
          sessions={sessions}
        />
      </div>
    </div>
  )
}
