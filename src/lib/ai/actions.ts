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

  // Validate and default source
  const source = VALID_SOURCES.has(c.source as string)
    ? (c.source as ActionCard['source'])
    : 'chat'

  return { ...c, source } as ActionCard
}

type SchemaField = {
  fieldId: string
  label: string
  type: string
  unit?: string
}

const WEIGHT_SANITY_MAX = 500
const HOURS_MAX = 24
const MINUTES_TO_HOURS_DIVISOR = 60
const DURATION_ROUND_FACTOR = 10

export function sanitizeFields(
  fields: Record<string, unknown>,
  schema: SchemaField[]
): Record<string, number | string | null> {
  const result: Record<string, number | string | null> = {}

  for (const schemaDef of schema) {
    const raw = fields[schemaDef.fieldId]

    if (raw === undefined) continue

    if (schemaDef.type === 'number' || schemaDef.type === 'rating') {
      const num = Number(raw)

      if (Number.isNaN(num)) {
        result[schemaDef.fieldId] = null
        continue
      }

      if (
        (schemaDef.unit === 'kg' || schemaDef.unit === 'lbs') &&
        num > WEIGHT_SANITY_MAX
      ) {
        result[schemaDef.fieldId] = null
        continue
      }

      if (schemaDef.unit === 'hrs' && num > HOURS_MAX) {
        const converted =
          Math.round((num / MINUTES_TO_HOURS_DIVISOR) * DURATION_ROUND_FACTOR) /
          DURATION_ROUND_FACTOR
        result[schemaDef.fieldId] = converted
        continue
      }

      result[schemaDef.fieldId] = num
    } else {
      result[schemaDef.fieldId] = raw !== null ? String(raw) : null
    }
  }

  return result
}
