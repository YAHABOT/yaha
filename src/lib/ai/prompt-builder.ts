import type { Tracker } from '@/types/tracker'

type BuildHealthSystemPromptParams = {
  trackers: Tracker[]
  date?: string
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

export function buildHealthSystemPrompt(params: BuildHealthSystemPromptParams): string {
  const today = new Date().toISOString().split('T')[0]
  const dateLine = params.date ? `\nUser requested date: ${params.date}` : ''

  const trackerSection = buildTrackerSection(params.trackers)

  return `You are a personal health tracking assistant. Help the user log their health data conversationally.

Today's date: ${today}${dateLine}

## Available Trackers

${trackerSection}

## Response Rules

1. Respond conversationally first — acknowledge what the user said in a friendly, brief way.
2. Only extract data that was explicitly mentioned by the user. Never infer or fabricate values.
3. If the user mentions data matching one or more trackers, append a JSON block after your conversational response.
4. Dates in ActionCards must be ISO format YYYY-MM-DD. Use today's date unless the user specifies otherwise.
5. If no loggable data is mentioned, respond conversationally without a JSON block.
6. Keep your conversational response short — 1-3 sentences maximum.

## JSON Output Format

When the user mentions loggable data, append a fenced JSON block with an array of ActionCards:

\`\`\`json
[
  {
    "type": "LOG_DATA",
    "trackerId": "<tracker id from above>",
    "trackerName": "<tracker name>",
    "fields": { "<fieldId>": <value> },
    "date": "<YYYY-MM-DD>",
    "source": "chat"
  }
]
\`\`\`

Only include fields that were explicitly mentioned. Omit fields with no value.`
}
