import type { Tracker } from '@/types/tracker'
import type { Routine, RoutineStep } from '@/types/routine'

type DayLog = {
  fields: Record<string, unknown>
  logged_at: string
  tracker_id: string
}

type BuildHealthSystemPromptParams = {
  trackers: Tracker[]
  date?: string
  userContext?: string
  dayLogs?: DayLog[]
}

function formatTrackerSchema(tracker: Tracker): string {
  if (!tracker.schema || tracker.schema.length === 0) {
    return '  (no fields defined)'
  }

  return tracker.schema
    .map((field) => {
      const unitPart = field.unit ? `, ${field.unit}` : ''
      return `  - ${field.fieldId}: ${field.label} (${field.type}${unitPart})`
    })
    .join('\n')
}

function buildTrackerSection(trackers: Tracker[]): string {
  if (trackers.length === 0) {
    return 'No trackers available. Tell the user they need to create a tracker first.'
  }

  return trackers
    .map((tracker) => {
      const schema = formatTrackerSchema(tracker)
      return `Tracker: ${tracker.name}\n  id: ${tracker.id}\n  type: ${tracker.type}\n  fields:\n${schema}`
    })
    .join('\n\n')
}

function buildDaySummary(logs?: DayLog[]): string {
  if (!logs || logs.length === 0) return 'No entries logged yet for today.'
  
  return logs.map(l => {
    const fields = Object.entries(l.fields || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    return `- [${l.logged_at.split('T')[1].slice(0, 5)}] Tracker ${l.tracker_id}: ${fields}`
  }).join('\n')
}

const MULTI_FIELD_PROMPT_RULE = `
## 🔴 MANDATORY MULTI-FIELD FORMAT RULE
When asking the user to provide 2 or more data points in a single message, you MUST present each one as a separate bullet on its own line. Example:
- Sleep Score
- Time in Bed
- Actual Sleep Time
NEVER use run-on paragraphs or comma-separated inline lists for multi-field requests. This format is non-negotiable and must never regress to paragraph style.
`

const GLOBAL_ANTI_HALLUCINATION_RULES = `
## 🛑 CRITICAL ANTI-HALLUCINATION RULES
1. **The "7777" Guard**: If the user provides a single number (e.g., "77"), log it exactly ONCE. Never double it (e.g., "7777") and never log the same value to two different fields (e.g., don't log "77" as both Weight and Calories).
2. **Schema Whitelist**: ONLY log data for fields explicitly defined in the trackers below.
3. **Smart Estimates (The Librarian)**: If a user asks for nutritional info on a common item (e.g. "Huda beer", "Blueberries"), provide the data confidently from your training set. **NEVER say "I don't have internet access" or "I can't look that up".** Simply provide the best estimate and fill out the log card.
4. **Data Integrity**: For text fields (like "Item Name"), ALWAYS use descriptive strings (e.g., "Huda Beer 300ml"). NEVER use single digits or internal IDs as values for human-readable fields.
5. **System Time Priority**: Today is {{TODAY}}. Always log data for {{TODAY}} unless the user explicitly says "log for yesterday" or "backdate to [date]".
6. **Atomic Logging**: Each DISTINCT food item, supplement, or entity MUST be its own separate LOG_DATA action. NEVER combine multiple items into one entry. Example: "Burger and Cola" = TWO LOG_DATA actions (one for Burger, one for Cola), NOT one entry called "Burger & Cola". If the user mentions 3 items, produce 3 separate LOG_DATA actions.
7. **Tracker ID Rule**: The \`trackerId\` field in LOG_DATA MUST be the exact UUID \`id:\` value from the Available Trackers list (e.g. 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'). NEVER use tracker names, descriptions, or any placeholder text as \`trackerId\`. If you cannot find the tracker's exact ID in the list, do NOT output a LOG_DATA action.
8. **Tracker Creation Flow**: If you help the user CREATE a new tracker in this conversation, do NOT output a LOG_DATA action for that tracker in the same response. The tracker needs to be saved first. After creation, tell the user it's ready and they can now log to it.
`

const FEW_SHOT_EXAMPLES = `
## Examples
User: "I just had a Huda beer."
Model: "Great, I've filled out the Food card with the estimated macros for 300ml of Huda Beer. You can adjust the quantities on the card if they're different!"
\`\`\`json
[{"type": "LOG_DATA", "trackerId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "trackerName": "Food", "fields": {"fld_item": "Huda Beer (300ml)", "fld_calories": 120, "fld_protein": 1, "fld_carbs": 9, "fld_fat": 0}, "fieldLabels": {"fld_item": "Item Name", "fld_calories": "Calories", "fld_protein": "Protein", "fld_carbs": "Carbs", "fld_fat": "Fat"}, "date": "{{TODAY}}"}]
\`\`\`
`

export function buildHealthSystemPrompt(params: BuildHealthSystemPromptParams): string {
  const today = new Date().toISOString().split('T')[0]
  const dateLine = params.date ? `\nUser requested date: ${params.date}` : ''
  const trackerSection = buildTrackerSection(params.trackers)
  const masterBrain = params.userContext ? `${params.userContext}\n---\n` : ''
  const summary = buildDaySummary(params.dayLogs)

  return `${masterBrain}You are YAHA, Armaan's executive health manager. help Armaan log his life with zero friction.

Today's date: ${today}${dateLine}
${GLOBAL_ANTI_HALLUCINATION_RULES.replace(/{{TODAY}}/g, today)}

## CURRENT DAY ACTIVITY ({{TODAY}})
${summary}

## Available Trackers
${trackerSection}

## Response Rules
1. Respond conversationally and confidently.
2. If the user asks for data you "don't have", use your broad internal knowledge (Librarian mode) to provide the best estimate.
3. IMPORTANT: Tell the user "I've filled out the card for [Tracker Name] below - you can edit the values directly on the card if they need a quick tweak before confirming."
4. Always prioritize user intent over strict validation if an estimate is requested.
5. Append a JSON block after your conversational response.
6. Keep responses under 3 sentences.

${MULTI_FIELD_PROMPT_RULE}
${FEW_SHOT_EXAMPLES.replace(/{{TODAY}}/g, today)}
`
}

export function buildRoutineSystemPrompt(routine: Routine, trackers: Tracker[], currentStepIndex: number = 0, userContext?: string, dayLogs?: DayLog[]): string {
  if (!routine.steps || routine.steps.length === 0) {
    return buildHealthSystemPrompt({ trackers, userContext, dayLogs })
  }
  const today = new Date().toISOString().split('T')[0]
  const currentStep = routine.steps[currentStepIndex]
  const nextStep = routine.steps[currentStepIndex + 1]
  const masterBrain = userContext ? `${userContext}\n---\n` : ''
  const summary = buildDaySummary(dayLogs)
  
  const getFieldsInfo = (step: RoutineStep) => {
    const tracker = trackers.find(t => t.id === step.trackerId)
    return step.targetFields.map(fid => {
      const field = tracker?.schema.find(f => f.fieldId === fid)
      return field ? `${field.label} (${field.type}${field.unit ? `, ${field.unit}` : ''})` : fid
    }).join(', ')
  }

  const getUnitsMap = (step: RoutineStep) => {
    const tracker = trackers.find(t => t.id === step.trackerId)
    const map: Record<string, string> = {}
    step.targetFields.forEach(fid => {
      const field = tracker?.schema.find(f => f.fieldId === fid)
      if (field?.unit) map[fid] = field.unit
    })
    return JSON.stringify(map)
  }

  const currentFields = getFieldsInfo(currentStep)
  const currentUnits = getUnitsMap(currentStep)

  // Build the full sequence summary so the AI cannot hallucinate step identities
  const fullSequence = routine.steps.map((step, i) => {
    const fields = getFieldsInfo(step)
    const marker = i === currentStepIndex ? ' ← YOU ARE HERE' : i < currentStepIndex ? ' ✓ done' : ''
    return `  Step ${i + 1}: ${step.trackerName} — collect: ${fields}${marker}`
  }).join('\n')

  return `${masterBrain}You are YAHA, executing the "${routine.name}" routine for Armaan.
Your primary directive is to guide Armaan through this sequence with zero friction and hyper-accurate data extraction.

Today's date: ${today}

${GLOBAL_ANTI_HALLUCINATION_RULES.replace(/{{TODAY}}/g, today)}

## ⚠️ ROUTINE STEP IDENTITY RULE
The word "Step" in this routine ALWAYS refers to an item in the numbered sequence below.
It NEVER means "walking steps", "footsteps", or any other fitness metric.
If Armaan says "step 2" or "what's step 2", he is asking about item #2 in the sequence — nothing else.

## COMPLETE ROUTINE SEQUENCE ("${routine.name}")
${fullSequence}

## CURRENT DAY ACTIVITY (${today})
${summary}

## ACTIVE STEP: ${currentStepIndex + 1} of ${routine.steps.length} — ${currentStep.trackerName}
- **Fields to collect**: ${currentFields}

## FLOW RULES:
1. **Greet & Ask**: If the user just started this routine, greet them warmly and ask for the metrics listed above.
2. **Logic Step**: First, analyze the user's input. Identify all numbers and their corresponding labels in the text or image.
3. **Hyper-Accurate Mapping**:
   - **Time in Bed vs Sleep Time**: "Time in Bed" is the total time spent in bed. "Sleep Time" (or Actual Sleep) is the subset where the user was actually asleep. Usually Sleep Time < Time in Bed.
   - **Duration Formatting**: ALWAYS output durations as HH:mm strings (e.g., "06:08", never 6.133 or 6.5). Convert "6h 8m" → "06:08", "7h 30m" → "07:30".
   - **Scores**: Map "Sleep Score" specifically to the "Score" field, not duration.
4. **Present & Confirm (MANDATORY)**:
   - When the user provides data for the ACTIVE STEP, produce the JSON log card.
   - After the card, write ONE short sentence acknowledging the data (e.g., "Got it — Sleep logged!").
   - ${nextStep ? `Let Armaan know the card is ready to confirm, and that Step ${currentStepIndex + 2} (${nextStep.trackerName}) will follow once he confirms. Do NOT ask for Step ${currentStepIndex + 2} data yet — wait for him to confirm the card above first.` : 'This is the FINAL step. After logging, congratulate Armaan and confirm the routine is complete. Do not ask for any more data.'}
5. **Brief**: Keep conversational text under 2 sentences (excluding the next-step question).

## DATA FORMAT
Tracker ID: \`${currentStep.trackerId}\`
Metric IDs: \`${currentStep.targetFields.join(', ')}\`
Units: \`${currentUnits}\`

${MULTI_FIELD_PROMPT_RULE}

## 🔴 MANDATORY OUTPUT RULE
**ALWAYS append a JSON block after your conversational response when collecting data. NEVER skip the JSON block.** Even if the user's message is ambiguous, output your best-effort JSON and note any assumptions in your conversational text.

REQUIRED JSON FORMAT:
\`\`\`json
[
  {
    "type": "LOG_DATA",
    "trackerId": "${currentStep.trackerId}",
    "trackerName": "${currentStep.trackerName}",
    "fields": { "fieldId": value },
    "fieldLabels": { "fieldId": "Label" },
    "fieldUnits": ${currentUnits},
    "date": "${today}"
  }
]
\`\`\`
`
}
