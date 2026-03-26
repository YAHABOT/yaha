import { createServerClient } from '@/lib/supabase/server'
import { createSession, getSession, addMessage, updateSession, getRecentMessagesForAI } from '@/lib/db/chat'
import { getTrackersBasic } from '@/lib/db/trackers'
import { getLogsForDay } from '@/lib/db/logs'
import { getRoutine as fetchRoutine, getRoutines } from '@/lib/db/routines'
import { processHealthMessage } from '@/lib/ai/gemini'
import { sanitizeFields } from '@/lib/ai/actions'
import { buildHealthSystemPrompt, buildRoutineSystemPrompt } from '@/lib/ai/prompt-builder'
import { detectRoutineTrigger } from '@/lib/routines/detector'
import { markDayStarted, markDayEnded } from '@/lib/db/day-state'
import { getMasterBrainContext } from '@/lib/ai/master-brain'
import type { ChatAttachment, ChatInput, ActionCard } from '@/types/action-card'
import type { ChatSession } from '@/types/chat'
import type { Routine } from '@/types/routine'
import type { Agent } from '@/types/agent'

const MAX_MESSAGE_LENGTH = 4000

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
  actions: ActionCard[]
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
    let activeRoutine: Routine | null = null

    if (session.active_routine_id) {
       activeRoutine = await fetchRoutine(session.active_routine_id)
    } else if (routineId) {
      // Direct routine hit from Dashboard button
      const routine = await fetchRoutine(routineId)
      if (routine) {
        console.log(`[ChatRoute] Activating routine from ID: ${routine.name}`)
        await updateSession(session.id, { 
          active_routine_id: routine.id,
          current_step_index: 0 
        })
        session.active_routine_id = routine.id
        session.current_step_index = 0
        activeRoutine = routine
      }
    } else {
      // Natural language detection
      const routineMatch = message ? await detectRoutineTrigger(message) : null
      if (routineMatch) {
        console.log(`[ChatRoute] Detected routine from text: ${routineMatch.name}`)
        await updateSession(session.id, { 
          active_routine_id: routineMatch.id,
          current_step_index: 0 
        })
        session.active_routine_id = routineMatch.id
        session.current_step_index = 0
        activeRoutine = routineMatch
      }
    }

    // Parallel fetch for speed
    const today = new Date().toISOString().split('T')[0]
    const [trackers, agents, brainContext, historyMessages, dayLogs] = await Promise.all([
      getTrackersBasic(supabase),
      import('@/lib/db/agents').then(m => m.getAgents()),
      getMasterBrainContext(),
      getRecentMessagesForAI(session.id, 10),
      getLogsForDay(today, supabase)
    ])

    // Map history for Gemini
    const history = historyMessages.map(msg => ({
      role: (msg.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
      parts: [{ text: msg.content }]
    }))

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
    let systemPrompt: string
    if (activeRoutine) {
      console.log(`[ChatRoute] Using routine prompt: ${activeRoutine.name} (Step ${session.current_step_index + 1})`)
      systemPrompt = buildRoutineSystemPrompt(activeRoutine, trackers, session.current_step_index, brainContext, dayLogs)
    } else if (activeAgent) {
      console.log(`[ChatRoute] Using agent prompt: ${activeAgent.name}`)
      systemPrompt = activeAgent.system_prompt
    } else {
      console.log(`[ChatRoute] Using standard health prompt.`)
      systemPrompt = buildHealthSystemPrompt({ trackers, date, userContext: brainContext, dayLogs })
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

    // Sanitize actions against tracker schema
    const sanitizedActions = actions.map(action => {
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

    // 4. Advance Routine Step?
    // If the model produced actions for the tracker in the current step, advance.
    if (activeRoutine) {
      const currentStep = activeRoutine.steps[session.current_step_index]
      const hasLoggedCurrentStep = sanitizedActions.some(a => a.trackerId === currentStep.trackerId)
      
      if (hasLoggedCurrentStep) {
        const nextStepIndex = session.current_step_index + 1
        if (nextStepIndex >= activeRoutine.steps.length) {
          // Finished routine — mark day state accordingly
          await updateSession(session.id, { 
            active_routine_id: null,
            current_step_index: 0 
          })
          // Fire-and-forget day state update based on routine type
          if (activeRoutine.type === 'day_start') {
            markDayStarted().catch(e => console.error('[DayState] markDayStarted failed:', e))
          } else if (activeRoutine.type === 'day_end') {
            markDayEnded().catch(e => console.error('[DayState] markDayEnded failed:', e))
          }
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
    const errorStack = e instanceof Error ? e.stack : 'No stack trace'
    
    return Response.json({ 
      error: errorMessage, 
      details: errorStack,
      status: 500
    }, { status: 500 })
  }
}
