import type { ActionCard } from '@/types/action-card'

const VALID_SOURCES = new Set(['chat', 'telegram', 'manual'])

export function parseActionCards(responseText: string): ActionCard[] {
  const cards: ActionCard[] = []
  const regex = /```json\s*([\s\S]*?)```/g

  let match: RegExpExecArray | null
  while ((match = regex.exec(responseText)) !== null) {
    const raw = match[1].trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const card = validateActionCard(item)
        if (card !== null) {
          cards.push(card)
        }
      }
    } else {
      const card = validateActionCard(parsed)
      if (card !== null) {
        cards.push(card)
      }
    }
  }

  return cards
}

export function validateActionCard(card: unknown): ActionCard | null {
  if (!card || typeof card !== 'object') return null

  const c = card as Record<string, unknown>

  if (typeof c.trackerId !== 'string' || c.trackerId.length === 0) return null
  if (typeof c.trackerName !== 'string' || c.trackerName.length === 0) return null
  if (c.type !== 'LOG_DATA') return null
  if (!c.fields || typeof c.fields !== 'object' || Array.isArray(c.fields)) return null
  if (typeof c.date !== 'string' || c.date.length === 0) return null

  // Validate and default source — never spread raw AI object to prevent prototype pollution
  const source: ActionCard['source'] = VALID_SOURCES.has(c.source as string)
    ? (c.source as ActionCard['source'])
    : 'chat'

  return {
    type: 'LOG_DATA',
    trackerId: c.trackerId as string,
    trackerName: c.trackerName as string,
    fields: c.fields as Record<string, number | string | null>,
    fieldLabels: (c.fieldLabels as Record<string, string>) || undefined,
    fieldUnits: (c.fieldUnits as Record<string, string>) || undefined,
    date: c.date as string,
    source,
  }
}

type SchemaField = {
  fieldId: string
  label: string
  type: string
  unit?: string
}

const WEIGHT_SANITY_MAX = 500
const HOURS_MAX = 24
const MINUTES_MAX = 1440 // 24 hours in minutes — reject hallucinated values above this
const MINUTES_TO_HOURS_DIVISOR = 60
const DURATION_ROUND_FACTOR = 10

export function sanitizeFields(
  fields: Record<string, unknown>,
  schema: SchemaField[]
): Record<string, number | string | null> {
  const result: Record<string, number | string | null> = {}

  for (const schemaDef of schema) {
    let raw = fields[schemaDef.fieldId]

    if (raw === undefined) continue

    // Handle duration strings like "06:08", "7h 13m", "1:05"
    if (typeof raw === 'string' && (raw.includes(':') || raw.toLowerCase().includes('h') || raw.toLowerCase().includes('m'))) {
      const match = raw.match(/(\d+)\s*h?[:\s]\s*(\d+)\s*m?/)
      if (match) {
        const h = parseInt(match[1], 10)
        const m = parseInt(match[2], 10)
        raw = h + m / 60
      } else {
        // Try single number match for "7h" or "13m"
        const hMatch = raw.match(/(\d+)\s*h/)
        const mMatch = raw.match(/(\d+)\s*m/)
        if (hMatch || mMatch) {
          raw = (hMatch ? parseInt(hMatch[1], 10) : 0) + (mMatch ? parseInt(mMatch[1], 10) / 60 : 0)
        }
      }
    }

    if (schemaDef.type === 'number' || schemaDef.type === 'rating' || schemaDef.type === 'time') {
      const num = Number(raw)

      if (Number.isNaN(num)) {
        result[schemaDef.fieldId] = raw !== null ? String(raw) : null
        continue
      }

      // Round to 2 decimal places for storage
      const rounded = Math.round(num * 100) / 100

      if (
        (schemaDef.unit === 'kg' || schemaDef.unit === 'lbs') &&
        rounded > WEIGHT_SANITY_MAX
      ) {
        result[schemaDef.fieldId] = null
        continue
      }

      result[schemaDef.fieldId] = rounded
    } else {
      result[schemaDef.fieldId] = raw !== null ? String(raw) : null
    }
  }

  // --- SMART SWAPPER ---
  // 1. Score vs Duration Flip
  const scoreField = schema.find(f => f.label.toLowerCase().includes('score') || f.label.toLowerCase().includes('rating'))
  const durationField = schema.find(f => f.unit === 'hrs' || f.label.toLowerCase().includes('time in') || f.label.toLowerCase().includes('actual sleep'))

  if (scoreField && durationField) {
    const scoreVal = result[scoreField.fieldId]
    const durationVal = result[durationField.fieldId]

    if (typeof scoreVal === 'number' && typeof durationVal === 'number') {
      // If score is small (like a duration) and duration is large (like a score), swap them
      // We assume score is meant to be 0-100 and duration 0-24
      if (scoreVal < 24 && durationVal > 10) {
        result[scoreField.fieldId] = durationVal
        result[durationField.fieldId] = scoreVal
      }
    }
  }

  // 2. Bed vs Actual Sleep Flip (Bed must be >= Actual)
  const bedField = schema.find(f => f.label.toLowerCase().includes('time in bed'))
  const actualField = schema.find(f => f.label.toLowerCase().includes('actual sleep time') || f.label.toLowerCase().includes('total sleep time'))
  if (bedField && actualField) {
    const bedVal = result[bedField.fieldId]
    const actualVal = result[actualField.fieldId]
    if (typeof bedVal === 'number' && typeof actualVal === 'number' && actualVal > bedVal) {
      result[bedField.fieldId] = actualVal
      result[actualField.fieldId] = bedVal
    }
  }

  return result
}
