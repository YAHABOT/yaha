---
name: health-logging
description: Invoke when implementing the health data logging pipeline — processing text, images, audio, and files through Gemini and producing ActionCards for user confirmation.
---

# Skill: Health Logging (Multimodal Pipeline)

## What This Skill Covers

Any health data logging goes through this pipeline:
**User input → Gemini 2.5 Flash → ActionCard[] → User confirms → Supabase**

Input modalities: plain text · images (nutrition labels, food photos, screenshots) ·
audio (voice memos, voice messages) · files (documents, PDFs).

---

## Execution Checklist

### Step 1: Receive Input

```typescript
type ChatInput = {
  text?: string
  attachments?: {
    type: 'image' | 'audio' | 'file'
    base64: string
    mimeType: string
    filename?: string
  }[]
  sessionId: string
  userId: string
  date?: string  // Optional backdate: "2026-03-08" (user said "log for yesterday")
}
```

### Step 2: Build Gemini System Prompt

Inject ALL of the following into the system prompt before processing:

```typescript
const systemPrompt = `
You are a health logging assistant for YAHA.

## Today's Date
${new Date().toISOString().split('T')[0]}
${userDate ? `## User requested date: ${userDate}` : ''}

## User Profile
Alias: ${user.alias}
Daily targets: ${JSON.stringify(user.targets)}
TDEE: ${user.tdee} kcal

## Available Trackers and Their Schemas
${trackers.map(t => `
### ${t.name} (id: ${t.id}, type: ${t.type})
Fields: ${t.schema.map(f => `${f.fieldId}: ${f.label} (${f.type}${f.unit ? ', ' + f.unit : ''})`).join(' | ')}
`).join('\n')}

## Recent Logs (last 1000 entries for context)
${recentLogs.map(l => `[${l.loggedAt}] ${l.trackerName}: ${JSON.stringify(l.fields)}`).join('\n')}

## Output Rules
Respond conversationally first, then output a JSON action block:
\`\`\`json
[
  {
    "type": "LOG_DATA",
    "trackerId": "uuid-here",
    "trackerName": "Nutrition",
    "fields": { "fld_001": 350, "fld_002": "chicken breast" },
    "date": "2026-03-09",
    "source": "chat"
  }
]
\`\`\`
Multiple actions allowed in one array. Only output JSON for data explicitly mentioned.
`
```

### Step 3: Process with Gemini

```typescript
// src/lib/ai/gemini.ts
export async function processHealthMessage(
  input: ChatInput,
  systemPrompt: string
): Promise<{ text: string; actions: ActionCard[] }> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const parts = []
  if (input.text) parts.push({ text: input.text })
  if (input.attachments) {
    for (const att of input.attachments) {
      parts.push({ inlineData: { mimeType: att.mimeType, data: att.base64 } })
    }
  }

  const result = await model.generateContent({
    systemInstruction: systemPrompt,
    contents: [{ role: 'user', parts }]
  })

  const responseText = result.response.text()
  const actions = parseActionCards(responseText)
  return { text: responseText, actions }
}
```

### Step 4: Parse ActionCards

```typescript
// src/lib/ai/actions.ts
export function parseActionCards(responseText: string): ActionCard[] {
  // Extract JSON from ```json ... ``` block
  const match = responseText.match(/```json\s*([\s\S]*?)\s*```/)
  if (!match) return []

  try {
    const parsed = JSON.parse(match[1])
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    return arr.map(validateActionCard).filter(Boolean)
  } catch {
    return []
  }
}

function validateActionCard(card: unknown): ActionCard | null {
  if (!card || typeof card !== 'object') return null
  const c = card as Record<string, unknown>
  if (!c.trackerId || typeof c.trackerId !== 'string') return null
  if (!c.fields || typeof c.fields !== 'object') return null
  // Sanitize: reject weight > 500, duration > 1440 minutes, etc.
  return sanitizeActionCard(c as ActionCard)
}
```

### Step 5: Sanitize ActionCard Fields

Critical bugs from the previous build — these MUST be applied:

```typescript
function sanitizeActionCard(card: ActionCard): ActionCard {
  const tracker = getTrackerById(card.trackerId)
  if (!tracker) return card

  const sanitized: Record<string, unknown> = {}
  for (const [fieldId, value] of Object.entries(card.fields)) {
    // Only keep fields that exist in the tracker schema
    const schemaField = tracker.schema.find(f => f.fieldId === fieldId)
    if (!schemaField) continue  // strip unknown fields

    if (schemaField.type === 'number' && typeof value === 'number') {
      // Duration sanitation: >24 AND field unit is 'hrs' → assume minutes, convert
      if (schemaField.unit === 'hrs' && value > 24) {
        sanitized[fieldId] = Math.round(value / 60 * 10) / 10  // minutes → hours
        continue
      }
      // Weight sanitation: reject > 500
      if (schemaField.label.toLowerCase().includes('weight') && value > 500) continue
    }
    sanitized[fieldId] = value
  }
  return { ...card, fields: sanitized }
}
```

### Step 6: Present ActionCard to User

Render as a confirmation card in the chat UI:
```
┌─────────────────────────────────────┐
│ 📝 Log to Nutrition Tracker          │
│                                     │
│ Calories:  350 kcal                 │
│ Protein:   32g                      │
│ Food:      chicken breast           │
│                                     │
│ [✓ Confirm]          [✗ Discard]   │
└─────────────────────────────────────┘
```

### Step 7: On User Confirm → Write to Supabase

```typescript
// src/app/actions/logs.ts
export async function confirmLogAction(card: ActionCard) {
  'use server'
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('tracker_logs').insert({
    tracker_id: card.trackerId,
    user_id: user.id,
    fields: card.fields,
    logged_at: card.date ? new Date(card.date) : new Date(),
    source: card.source ?? 'chat',
  })
  if (error) return { error: error.message }
  revalidatePath('/journal')
  revalidatePath('/dashboard')
  return { success: true }
}
```

---

## Backdating Logic

When user says "log for yesterday", "last night", "this morning at 7am":
- Gemini outputs a `date` field in the ActionCard: `"date": "2026-03-08"`
- System uses this date as `logged_at` instead of `new Date()`
- Logical Day rule: entries logged between midnight and 4am belong to the previous day
  (configurable, default 4am cutoff)

---

## File Type Handling

| File type | Gemini input | Notes |
|-----------|-------------|-------|
| JPEG/PNG image | `inlineData` with `image/jpeg` | Nutrition labels, food photos |
| WebP/GIF | `inlineData` with `image/webp` | Screenshots |
| MP3/M4A audio | `inlineData` with `audio/mp3` | Voice memos (max 9.5 hours) |
| OGG audio | `inlineData` with `audio/ogg` | Telegram voice messages |
| PDF | `inlineData` with `application/pdf` | Lab reports, nutrition plans |
| Text file | Extract text, send as text part | `.txt`, `.csv` logs |
