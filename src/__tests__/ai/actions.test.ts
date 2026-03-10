import { describe, it, expect } from 'vitest'
import { parseActionCards, validateActionCard, sanitizeFields } from '@/lib/ai/actions'
import type { ActionCard } from '@/types/action-card'

const VALID_CARD: ActionCard = {
  type: 'LOG_DATA',
  trackerId: 'tracker-123',
  trackerName: 'Nutrition',
  fields: { fld_001: 350 },
  date: '2026-03-10',
  source: 'chat',
}

// --- parseActionCards ---

describe('parseActionCards', () => {
  it('returns empty array when response has no JSON block', () => {
    const result = parseActionCards('No structured data here.')
    expect(result).toEqual([])
  })

  it('returns empty array for malformed JSON inside code fence', () => {
    const result = parseActionCards('```json\n{ broken json \n```')
    expect(result).toEqual([])
  })

  it('returns ActionCard array for valid JSON block with array', () => {
    const text = `Here is what I logged:\n\`\`\`json\n${JSON.stringify([VALID_CARD])}\n\`\`\``
    const result = parseActionCards(text)
    expect(result).toHaveLength(1)
    expect(result[0].trackerId).toBe('tracker-123')
  })

  it('handles single object (not array) in JSON block', () => {
    const text = `\`\`\`json\n${JSON.stringify(VALID_CARD)}\n\`\`\``
    const result = parseActionCards(text)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('LOG_DATA')
  })

  it('handles multiple ActionCards in array', () => {
    const second: ActionCard = { ...VALID_CARD, trackerId: 'tracker-456', trackerName: 'Sleep' }
    const text = `\`\`\`json\n${JSON.stringify([VALID_CARD, second])}\n\`\`\``
    const result = parseActionCards(text)
    expect(result).toHaveLength(2)
  })

  it('silently drops invalid cards in a mixed array', () => {
    const invalid = { type: 'LOG_DATA', trackerId: 123 }
    const text = `\`\`\`json\n${JSON.stringify([VALID_CARD, invalid])}\n\`\`\``
    const result = parseActionCards(text)
    expect(result).toHaveLength(1)
  })
})

// --- validateActionCard ---

describe('validateActionCard', () => {
  it('returns null for non-object', () => {
    expect(validateActionCard(null)).toBeNull()
    expect(validateActionCard('string')).toBeNull()
    expect(validateActionCard(42)).toBeNull()
  })

  it('returns null for missing trackerId', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { trackerId: _t, ...rest } = VALID_CARD
    expect(validateActionCard(rest)).toBeNull()
  })

  it('returns null for non-string trackerId', () => {
    expect(validateActionCard({ ...VALID_CARD, trackerId: 123 })).toBeNull()
  })

  it('returns null for missing trackerName', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { trackerName: _tn, ...rest } = VALID_CARD
    expect(validateActionCard(rest)).toBeNull()
  })

  it('returns null for missing fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fields: _f, ...rest } = VALID_CARD
    expect(validateActionCard(rest)).toBeNull()
  })

  it('returns null for wrong type string', () => {
    expect(validateActionCard({ ...VALID_CARD, type: 'WRONG_TYPE' })).toBeNull()
  })

  it('returns null for missing date', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { date: _d, ...rest } = VALID_CARD
    expect(validateActionCard(rest)).toBeNull()
  })

  it('returns ActionCard for fully valid input', () => {
    const result = validateActionCard(VALID_CARD)
    expect(result).not.toBeNull()
    expect(result?.trackerId).toBe('tracker-123')
    expect(result?.type).toBe('LOG_DATA')
  })
})

// --- sanitizeFields ---

describe('sanitizeFields', () => {
  const schema = [
    { fieldId: 'fld_cal', label: 'Calories', type: 'number', unit: 'kcal' },
    { fieldId: 'fld_sleep', label: 'Sleep Duration', type: 'number', unit: 'hrs' },
    { fieldId: 'fld_weight', label: 'Body Weight', type: 'number', unit: 'kg' },
    { fieldId: 'fld_mood', label: 'Mood', type: 'rating' },
    { fieldId: 'fld_note', label: 'Notes', type: 'text' },
  ]

  it('strips unknown fields not present in schema', () => {
    const fields = { fld_cal: 350, unknown_field: 'garbage' }
    const result = sanitizeFields(fields, schema)
    expect(result).not.toHaveProperty('unknown_field')
    expect(result).toHaveProperty('fld_cal', 350)
  })

  it('converts string numbers to numbers for number fields', () => {
    const result = sanitizeFields({ fld_cal: '2000' }, schema)
    expect(result.fld_cal).toBe(2000)
    expect(typeof result.fld_cal).toBe('number')
  })

  it('returns null for NaN values in number fields', () => {
    const result = sanitizeFields({ fld_cal: 'not-a-number' }, schema)
    expect(result.fld_cal).toBeNull()
  })

  it('converts minutes to hours when unit is hrs and value > 24', () => {
    const result = sanitizeFields({ fld_sleep: 480 }, schema)
    expect(result.fld_sleep).toBe(8)
  })

  it('does not convert sleep value when it is <= 24', () => {
    const result = sanitizeFields({ fld_sleep: 7.5 }, schema)
    expect(result.fld_sleep).toBe(7.5)
  })

  it('returns null for weight > 500', () => {
    const result = sanitizeFields({ fld_weight: 600 }, schema)
    expect(result.fld_weight).toBeNull()
  })

  it('keeps weight value when <= 500', () => {
    const result = sanitizeFields({ fld_weight: 80 }, schema)
    expect(result.fld_weight).toBe(80)
  })

  it('converts string values to strings for text fields', () => {
    const result = sanitizeFields({ fld_note: 42 }, schema)
    expect(result.fld_note).toBe('42')
  })

  it('preserves null for text fields with null value', () => {
    const result = sanitizeFields({ fld_note: null }, schema)
    expect(result.fld_note).toBeNull()
  })

  it('handles rating fields the same as number fields', () => {
    const result = sanitizeFields({ fld_mood: '7' }, schema)
    expect(result.fld_mood).toBe(7)
    expect(typeof result.fld_mood).toBe('number')
  })

  it('skips fields that are undefined in input', () => {
    const result = sanitizeFields({ fld_cal: 500 }, schema)
    expect(result).not.toHaveProperty('fld_sleep')
    expect(result).not.toHaveProperty('fld_note')
  })
})
