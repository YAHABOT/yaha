import type { ActionCard, CreateTrackerCard, AnyActionCard } from '@/types/action-card'

const VALID_SOURCES = new Set(['chat', 'telegram', 'manual'])
const VALID_TRACKER_TYPES = new Set(['nutrition', 'sleep', 'workout', 'mood', 'water', 'custom'])
const VALID_FIELD_TYPES = new Set(['number', 'text', 'rating', 'time'])

export function parseActionCards(responseText: string): AnyActionCard[] {
  const cards: AnyActionCard[] = []
  const regex = /```json\s*([\s\S]*?)```/g

  let match: RegExpExecArray | null
  while ((match = regex.exec(responseText)) !== null) {
    const raw = match[1].trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      console.warn('[parseActionCards] JSON parse failed for block:', raw.substring(0, 100), e)
      continue
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const card = validateAnyCard(item)
        if (card !== null) {
          cards.push(card)
        }
      }
    } else {
      const card = validateAnyCard(parsed)
      if (card !== null) {
        cards.push(card)
      }
    }
  }

  // Fallback: if no JSON blocks found, try to find raw JSON at the end of the response
  // This handles cases where Gemini outputs JSON without markdown fencing
  if (cards.length === 0) {
    const jsonMatch = responseText.match(/\[\s*\{[\s\S]*?\}\s*\](?!.*\[)/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const card = validateAnyCard(item)
            if (card !== null) {
              cards.push(card)
            }
          }
        }
        if (cards.length > 0) {
          console.log('[parseActionCards] Recovered action cards from unfenced JSON')
        }
      } catch (e) {
        console.warn('[parseActionCards] Fallback JSON extraction failed:', e)
      }
    }
  }

  return cards
}

function validateAnyCard(card: unknown): AnyActionCard | null {
  if (!card || typeof card !== 'object') return null
  const c = card as Record<string, unknown>
  if (c.type === 'CREATE_TRACKER') return validateCreateTrackerCard(c)
  return validateActionCard(card)
}

export function validateCreateTrackerCard(c: Record<string, unknown>): CreateTrackerCard | null {
  if (typeof c.name !== 'string' || c.name.trim().length === 0) return null
  const trackerType = VALID_TRACKER_TYPES.has(c.trackerType as string)
    ? (c.trackerType as CreateTrackerCard['trackerType'])
    : 'custom'
  const color = typeof c.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.color)
    ? c.color
    : '#10b981'

  const rawSchema = Array.isArray(c.schema) ? c.schema : []
  const schema: CreateTrackerCard['schema'] = rawSchema
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map(f => ({
      fieldId: typeof f.fieldId === 'string' ? f.fieldId : `fld_${Math.random().toString(36).slice(2, 7)}`,
      label: typeof f.label === 'string' ? f.label : 'Field',
      type: VALID_FIELD_TYPES.has(f.type as string) ? (f.type as 'number' | 'text' | 'rating' | 'time') : 'text',
      ...(typeof f.unit === 'string' ? { unit: f.unit } : {}),
    }))

  return {
    type: 'CREATE_TRACKER',
    name: c.name.trim(),
    trackerType,
    color,
    schema,
  }
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

// Normalize a string to a slug for fuzzy comparison: lowercase, strip non-alphanumeric
function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Build a map from normalized label slug → fieldId for fuzzy lookup
function buildLabelIndex(schema: SchemaField[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const f of schema) {
    index.set(toSlug(f.label), f.fieldId)
    // Also index the fieldId itself (without fld_ prefix) for partial matches
    index.set(toSlug(f.fieldId.replace(/^fld_/, '')), f.fieldId)
  }
  return index
}

// Find the value for a schema field by trying: exact fieldId → fuzzy label → fuzzy key slug
function resolveField(
  fieldId: string,
  label: string,
  fields: Record<string, unknown>,
  labelIndex: Map<string, string>
): unknown {
  // 1. Exact match by fieldId
  if (fields[fieldId] !== undefined) return fields[fieldId]

  // 2. Fuzzy: find a key in fields whose slug matches this field's label slug or fieldId slug
  const targetSlugs = new Set([toSlug(label), toSlug(fieldId.replace(/^fld_/, ''))])
  for (const [key, val] of Object.entries(fields)) {
    if (targetSlugs.has(toSlug(key))) return val
  }

  return undefined
}

export function sanitizeFields(
  fields: Record<string, unknown>,
  schema: SchemaField[]
): Record<string, number | string | null> {
  const result: Record<string, number | string | null> = {}
  const labelIndex = buildLabelIndex(schema)

  // Track which incoming field keys have been consumed to prevent double-logging
  const consumed = new Set<string>()

  for (const schemaDef of schema) {
    let raw = resolveField(schemaDef.fieldId, schemaDef.label, fields, labelIndex)

    // Track which key was matched so we don't re-use it
    if (raw !== undefined) {
      for (const key of Object.keys(fields)) {
        const slugKey = toSlug(key)
        const targetSlugs = new Set([toSlug(schemaDef.label), toSlug(schemaDef.fieldId.replace(/^fld_/, '')), schemaDef.fieldId])
        if (targetSlugs.has(key) || targetSlugs.has(slugKey)) {
          consumed.add(key)
          break
        }
      }
    }

    if (raw === undefined) continue

    // Handle duration strings like "06:08", "7h 13m", "1:05" — ONLY for time fields.
    // Never run on text fields: "500ml", "morning", etc. all contain 'm' or 'h' and
    // would otherwise get corrupted into decimal hours.
    if (schemaDef.type === 'time' && typeof raw === 'string' && (raw.includes(':') || /\d+\s*h/i.test(raw) || /\d+\s*m(?!l)/i.test(raw))) {
      const match = raw.match(/(\d+)\s*h?[:\s]\s*(\d+)\s*m?/)
      if (match) {
        const h = parseInt(match[1], 10)
        const m = parseInt(match[2], 10)
        raw = h + m / 60
      } else {
        const hMatch = raw.match(/(\d+)\s*h/i)
        const mMatch = raw.match(/(\d+)\s*m(?!l)/i)
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
