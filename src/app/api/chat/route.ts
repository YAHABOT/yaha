import { createServerClient } from '@/lib/supabase/server'
import { createSession, getSession, addMessage, updateSession, getRecentMessagesForAI } from '@/lib/db/chat'
import { getTrackersBasic } from '@/lib/db/trackers'
import { getLogsForDay } from '@/lib/db/logs'
import { getRoutine as fetchRoutine } from '@/lib/db/routines'
import { processHealthMessage } from '@/lib/ai/gemini'
import { sanitizeFields } from '@/lib/ai/actions'
import { buildHealthSystemPrompt, buildRoutineSystemPrompt } from '@/lib/ai/prompt-builder'
import { detectRoutineTrigger } from '@/lib/routines/detector'
import { markDayStarted, markDayEnded, getActiveDayState } from '@/lib/db/day-state'
import { getMasterBrainContext } from '@/lib/ai/master-brain'
import type { ChatAttachment, ChatInput, AnyActionCard } from '@/types/action-card'
import type { ChatSession } from '@/types/chat'
import type { Routine } from '@/types/routine'
import type { Agent } from '@/types/agent'

const MAX_MESSAGE_LENGTH = 4000

// Must stay in sync with ALLOWED_MIME_TYPES in src/lib/ai/gemini.ts — only accept types Gemini can process.
// Office formats (docx/xlsx/xls) are removed because Gemini's inlineData API does not support them.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'application/pdf',
  'text/plain',
  'text/csv',
])

type ChatRequestBody = {
  message?: string
  sessionId?: string
  routineId?: string
  attachments?: Array<{
    base64: string
    mimeType: string
    type: 'image' | 'audio' | 'file'
    filename?: string
  }>
  date?: string
  agentId?: string
}

type ChatResponseMessage = {
  id: string          // Real DB UUID — passed to ActionCard so confirmLogAction can persist confirmed:true
  role: 'assistant'
  content: string
  actions: AnyActionCard[]
}

type ChatResponse = {
  message: ChatResponseMessage
  sessionId: string
}

function validateAttachments(
  rawAttachments: ChatRequestBody['attachments']
): ChatAttachment[] | undefined {
  if (!rawAttachments || rawAttachments.length === 0) return undefined

  for (const attachment of rawAttachments) {
    if (!ALLOWED_MIME_TYPES.has(attachment.mimeType)) {
      throw new Error(`Disallowed attachment MIME type: ${attachment.mimeType}`)
    }
  }

  return rawAttachments as ChatAttachment[]
}

export async function POST(req: Request): Promise<Response> {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: ChatRequestBody
    try {
      body = (await req.json()) as ChatRequestBody
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { message, sessionId, routineId, attachments: rawAttachments, date } = body
    const hasAttachments = Array.isArray(rawAttachments) && rawAttachments.length > 0
    const msgPreview = message ? message.substring(0, 50) : '[image-only]'
    console.log(`[ChatRoute] Request: session=${sessionId}, routine=${routineId}, msg="${msgPreview}..."`)


    if (!hasAttachments && (!message || typeof message !== 'string' || message.trim().length === 0)) {
      return Response.json({ error: 'Message is required' }, { status: 400 })
    }

    if (message && message.length > MAX_MESSAGE_LENGTH) {
      return Response.json(
        { error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 }
      )
    }

    let attachments: ChatAttachment[] | undefined
    try {
      attachments = validateAttachments(rawAttachments)
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : 'Invalid attachment' },
        { status: 400 }
      )
    }

    // Get or create chat session
    let session: ChatSession
    if (sessionId && sessionId !== 'new') {
      try {
        session = await getSession(sessionId)
      } catch {
        return Response.json({ error: 'Session not found' }, { status: 404 })
      }
    } else {
      session = await createSession()
    }

    // Explicit Agent selection from dropdown
    if (body.agentId !== undefined) {
      await updateSession(session.id, { active_agent_id: body.agentId || null })
      session.active_agent_id = body.agentId || null
    }

    // 1. Detect Routine Trigger (Prioritize explicit routineId)
    // FIX-7: run all independent DB fetches in parallel — routine detection,
    // trackers, agents, brain context, chat history, and day logs all fire at once.
    // This eliminates sequential Supabase round-trips that caused >1 min latency.
    // Prefer the client-supplied local date (YYYY-MM-DD in user's timezone).
    // Falls back to UTC server date only if the client didn't send one.
    const today = (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))
      ? date
      : new Date().toISOString().split('T')[0]

    const [
      trackers,
      agents,
      brainContext,
      historyMessages,
      dayLogs,
      activeRoutineRaw,
      routineMatchResult,
      activeDayState,
    ] = await Promise.all([
      getTrackersBasic(supabase),
      import('@/lib/db/agents').then(m => m.getAgents()),
      getMasterBrainContext(),
      getRecentMessagesForAI(session.id, 10),
      getLogsForDay(today, supabase),
      // Always try to fetch the currently active routine (null if none)
      session.active_routine_id ? fetchRoutine(session.active_routine_id) : Promise.resolve(null),
      // Run NL routine detection in parallel only when there's no active routine and no explicit id
      (!session.active_routine_id && !routineId && message)
        ? detectRoutineTrigger(message)
        : Promise.resolve(null),
      // Fetch the open day session (started but not ended) — determines default logging date
      getActiveDayState(supabase),
    ])

    // The authoritative logging date for this request:
    // 1. If a day session is open → use that session's date (even if physical day has changed)
    // 2. Otherwise → use the client-supplied local date (or UTC fallback)
    const loggingDate = activeDayState?.date ?? today

    let activeRoutine: Routine | null = null

    if (activeRoutineRaw) {
      activeRoutine = activeRoutineRaw
    } else if (routineId) {
      // Direct routine hit from Dashboard button
      const routine = await fetchRoutine(routineId)
      if (routine) {
        // Guard: block Start Day if a session is already open
        if (routine.type === 'day_start' && activeDayState !== null) {
          console.log(`[ChatRoute] Blocked Start Day — session already active for ${activeDayState.date}`)
          await addMessage({ session_id: session.id, role: 'user', content: message || '', attachments: attachments ?? null })
          const blockMsg = `Start day for ${activeDayState.date} is already in progress. Please end yesterday's session first before starting a new one.`
          const savedBlock = await addMessage({ session_id: session.id, role: 'assistant', content: blockMsg, actions: [] })
          return Response.json({
            message: { id: savedBlock.id, role: 'assistant' as const, content: blockMsg, actions: [] },
            sessionId: session.id,
          } satisfies ChatResponse, { status: 200 })
        }
        console.log(`[ChatRoute] Activating routine from ID: ${routine.name}`)
        await updateSession(session.id, {
          active_routine_id: routine.id,
          current_step_index: 0
        })
        session.active_routine_id = routine.id
        session.current_step_index = 0
        activeRoutine = routine
        // Start Day: lock the logging date at TRIGGER time (not at completion)
        if (routine.type === 'day_start') {
          markDayStarted(today).catch(e => console.error('[DayState] markDayStarted (trigger) failed:', e))
        }
      }
    } else if (routineMatchResult) {
      const routineMatch = routineMatchResult
      // Guard: block Start Day if a session is already open
      if (routineMatch.type === 'day_start' && activeDayState !== null) {
        console.log(`[ChatRoute] Blocked Start Day — session already active for ${activeDayState.date}`)
        await addMessage({ session_id: session.id, role: 'user', content: message || '', attachments: attachments ?? null })
        const blockMsg = `Start day for ${activeDayState.date} is already in progress. Please end yesterday's session first before starting a new one.`
        const savedBlock = await addMessage({ session_id: session.id, role: 'assistant', content: blockMsg, actions: [] })
        return Response.json({
          message: { id: savedBlock.id, role: 'assistant' as const, content: blockMsg, actions: [] },
          sessionId: session.id,
        } satisfies ChatResponse, { status: 200 })
      }
      console.log(`[ChatRoute] Detected routine from text: ${routineMatch.name}`)
      await updateSession(session.id, {
        active_routine_id: routineMatch.id,
        current_step_index: 0
      })
      session.active_routine_id = routineMatch.id
      session.current_step_index = 0
      activeRoutine = routineMatch
      // Start Day: lock the logging date at TRIGGER time (not at completion)
      if (routineMatch.type === 'day_start') {
        markDayStarted(today).catch(e => console.error('[DayState] markDayStarted (trigger) failed:', e))
      }
    }

    // Map history for Gemini — include stored image attachments so follow-up
    // messages like "use the photos I just sent" have the images in context.
    type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } }
    const history = historyMessages.map(msg => {
      const parts: ContentPart[] = []
      if (msg.content) parts.push({ text: msg.content })
      if (msg.attachments) {
        const attachArr = msg.attachments as Array<{ mimeType: string; base64: string }>
        for (const att of attachArr) {
          parts.push({ inlineData: { mimeType: att.mimeType, data: att.base64 } })
        }
      }
      if (parts.length === 0) parts.push({ text: '' })
      return {
        role: (msg.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
        parts,
      }
    })

    // 2. Detect Agent Switching
    let activeAgent: Agent | null = null
    const normalizedMsg = message ? message.toLowerCase().trim() : ''

    // Check for exit trigger
    if (session.active_agent_id) {
      const currentAgent = agents.find(a => a.id === session.active_agent_id)
      if (currentAgent && normalizedMsg === currentAgent.exit_trigger.toLowerCase()) {
        await updateSession(session.id, { active_agent_id: null })
        session.active_agent_id = null
      } else {
        activeAgent = currentAgent ?? null
      }
    }

    // Check for new agent trigger (even if one is active, allow switching)
    const agentTrigger = agents.find(a => normalizedMsg.includes(a.trigger.toLowerCase()))
    if (agentTrigger) {
      await updateSession(session.id, { active_agent_id: agentTrigger.id })
      session.active_agent_id = agentTrigger.id
      activeAgent = agentTrigger
    }

    // Save user message
    await addMessage({
      session_id: session.id,
      role: 'user',
      content: message || '',
      attachments: attachments ?? null,
    })

    // 3. Build System Prompt priority
    // daySessionActive: true when an open session exists — AI logs to loggingDate by default
    // daySessionActive: false — neutral state, AI asks user to confirm date
    const daySessionActive = activeDayState !== null
    let systemPrompt: string
    if (activeRoutine) {
      console.log(`[ChatRoute] Using routine prompt: ${activeRoutine.name} (Step ${session.current_step_index + 1})`)
      systemPrompt = buildRoutineSystemPrompt(activeRoutine, trackers, session.current_step_index, brainContext, dayLogs, loggingDate, today)
    } else if (activeAgent) {
      console.log(`[ChatRoute] Using agent prompt: ${activeAgent.name}`)
      const yahaSection = buildHealthSystemPrompt({ trackers, date: loggingDate, actualDate: today, userContext: brainContext, dayLogs, daySessionActive })
      systemPrompt = `${activeAgent.system_prompt}\n\n---\n## YAHA HEALTH LOGGING CAPABILITIES\n${yahaSection}`
    } else {
      console.log(`[ChatRoute] Using standard health prompt. daySession=${daySessionActive ? loggingDate : 'neutral'}`)
      systemPrompt = buildHealthSystemPrompt({ trackers, date: loggingDate, actualDate: today, userContext: brainContext, dayLogs, daySessionActive })
    }

    // Build ChatInput
    const chatInput: ChatInput = {
      text: message || '',
      attachments,
      sessionId: session.id,
      date,
    }

    // 3. Process message through Gemini
    const { text, actions } = await processHealthMessage(chatInput, systemPrompt, history)

    // Sanitize actions against tracker schema — only applies to LOG_DATA cards.
    // CREATE_TRACKER cards pass through as-is; they contain schema definition not logged fields.
    const sanitizedActions: AnyActionCard[] = actions.map(action => {
      if (action.type !== 'LOG_DATA') return action
      const tracker = trackers.find(t => t.id === action.trackerId)
      if (tracker) {
        // Enforce DB schema for labels and units - ignore Gemini's hallucinations
        const schema = tracker.schema
        const fieldLabels: Record<string, string> = {}
        const fieldUnits: Record<string, string> = {}

        // fieldOrder is an array — arrays preserve order in JSONB unlike object keys
        const fieldOrder: string[] = []
        schema.forEach(f => {
          fieldLabels[f.fieldId] = f.label
          fieldOrder.push(f.fieldId)
          if (f.unit) fieldUnits[f.fieldId] = f.unit
          // Handle 'time' type as 'hrs' unit if not specified, for the formatter
          if (f.type === 'time' && !f.unit) fieldUnits[f.fieldId] = 'hrs'
        })

        return {
          ...action,
          fieldLabels,
          fieldUnits,
          fieldOrder,
          fields: sanitizeFields(action.fields, schema)
        }
      }
      return action
    })

    // Detect skip intent so we do NOT attempt to log a skipped step.
    // A skip advances the step counter without writing to tracker_logs.
    const SKIP_KEYWORDS = ['skip', 'pass', 'next step', 'skip this', 'skip that']
    const isSkipIntent = message
      ? SKIP_KEYWORDS.some(kw => message.toLowerCase().includes(kw))
      : false

    // 4. Advance Routine Step?
    // If the model produced actions for the tracker in the current step, advance.
    if (activeRoutine) {
      const currentStep = activeRoutine.steps[session.current_step_index]
      // On skip, advance without logging. Otherwise check if a LOG_DATA action was produced.
      const hasLoggedCurrentStep = isSkipIntent
        ? true
        : sanitizedActions.some(a => a.type === 'LOG_DATA' && a.trackerId === currentStep.trackerId)
      
      if (hasLoggedCurrentStep) {
        const nextStepIndex = session.current_step_index + 1
        if (nextStepIndex >= activeRoutine.steps.length) {
          // Finished routine — mark day state accordingly
          await updateSession(session.id, { 
            active_routine_id: null,
            current_step_index: 0 
          })
          // End Day completion: close the active session by its own locked date
          if (activeRoutine.type === 'day_end') {
            markDayEnded(loggingDate).catch(e => console.error('[DayState] markDayEnded failed:', e))
          }
          // Note: Start Day is handled at TRIGGER time (above), not at completion
        } else {
          // Move to next
          await updateSession(session.id, { 
            current_step_index: nextStepIndex 
          })
        }
      }
    }

    // Save model response — capture the returned row to get the real DB UUID
    const assistantMessage = await addMessage({
      session_id: session.id,
      role: 'assistant',
      content: text,
      actions: sanitizedActions,
    })

    const responseBody: ChatResponse = {
      message: {
        id: assistantMessage.id,  // Real UUID — lets ChatInterface pass it to ActionCard for persistence
        role: 'assistant',
        content: text,
        actions: sanitizedActions,
      },
      sessionId: session.id,
    }

    return Response.json(responseBody, { status: 200 })
  } catch (e: unknown) {
    console.error('[chat/route] CRITICAL ERROR:', e)
    const errorMessage = e instanceof Error ? e.message : String(e)

    return Response.json({
      error: errorMessage,
      status: 500
    }, { status: 500 })
  }
}
