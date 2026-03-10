import type { ActionCard } from '@/types/action-card'

const JSON_FENCE_REGEX = /```json\s*([\s\S]*?)```/g

export function parseActionCards(responseText: string): ActionCard[] {
  const cards: ActionCard[] = []

  let match: RegExpExecArray | null
  JSON_FENCE_REGEX.lastIndex = 0

  while ((match = JSON_FENCE_REGEX.exec(responseText)) !== null) {
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

  return c as ActionCard
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
        schemaDef.label.toLowerCase().includes('weight') &&
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
