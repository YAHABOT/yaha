import { describe, it, expect } from 'vitest'
import { buildHealthSystemPrompt, buildRoutineSystemPrompt } from '@/lib/ai/prompt-builder'
import type { Routine } from '@/types/routine'
import type { Tracker } from '@/types/tracker'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const FAKE_TRACKER: Tracker = {
  id: 'tracker-1',
  user_id: 'user-abc',
  name: 'Nutrition',
  type: 'custom',
  color: '#10b981',
  schema: [
    { fieldId: 'fld_001', label: 'Calories', type: 'number', unit: 'kcal' },
    { fieldId: 'fld_002', label: 'Protein', type: 'number', unit: 'g' },
  ],
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

const FAKE_ROUTINE: Routine = {
  id: 'routine-1',
  user_id: 'user-abc',
  name: 'Morning Check-In',
  trigger_phrase: 'start day',
  type: 'day_start',
  steps: [
    {
      trackerId: 'tracker-sleep',
      trackerName: 'Sleep',
      trackerColor: '#3b82f6',
      targetFields: ['fld_hours', 'fld_quality'],
    },
    {
      trackerId: 'tracker-mood',
      trackerName: 'Mood',
      trackerColor: '#a855f7',
      targetFields: ['fld_rating'],
    },
  ],
  created_at: '2026-03-11T00:00:00Z',
}

// ---------------------------------------------------------------------------
// buildHealthSystemPrompt
// ---------------------------------------------------------------------------

describe('buildHealthSystemPrompt', () => {
  it('returns a string containing tracker names', () => {
    const result = buildHealthSystemPrompt({ trackers: [FAKE_TRACKER] })
    expect(result).toContain('Nutrition')
  })

  it('returns fallback text when no trackers are available', () => {
    const result = buildHealthSystemPrompt({ trackers: [] })
    expect(result).toContain('No trackers available')
  })

  it('includes today date in the output', () => {
    const today = new Date().toISOString().split('T')[0]
    const result = buildHealthSystemPrompt({ trackers: [] })
    expect(result).toContain(today)
  })

  it('includes user-requested date when provided', () => {
    const result = buildHealthSystemPrompt({ trackers: [], date: '2026-03-01' })
    expect(result).toContain('2026-03-01')
  })
})

// ---------------------------------------------------------------------------
// buildRoutineSystemPrompt
// ---------------------------------------------------------------------------

describe('buildRoutineSystemPrompt', () => {
  it('returns a string containing the routine name', () => {
    const result = buildRoutineSystemPrompt(FAKE_ROUTINE, [FAKE_TRACKER])
    expect(result).toContain('Morning Check-In')
  })

  it('returns a string containing each step tracker name', () => {
    const result = buildRoutineSystemPrompt(FAKE_ROUTINE, [FAKE_TRACKER])
    expect(result).toContain('Sleep')
    expect(result).toContain('Mood')
  })

  it('numbers each step sequentially starting at 1', () => {
    const result = buildRoutineSystemPrompt(FAKE_ROUTINE, [FAKE_TRACKER])
    expect(result).toContain('CURRENT STEP: 1 of 2')
  })

  it('lists target fields for each step', () => {
    const result = buildRoutineSystemPrompt(FAKE_ROUTINE, [FAKE_TRACKER])
    expect(result).toContain('fld_hours')
    expect(result).toContain('fld_quality')
    expect(result).toContain('fld_rating')
  })

  it('returns a string (not null or undefined)', () => {
    const result = buildRoutineSystemPrompt(FAKE_ROUTINE, [FAKE_TRACKER])
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('handles a routine with a single step', () => {
    const singleStepRoutine: Routine = {
      ...FAKE_ROUTINE,
      steps: [FAKE_ROUTINE.steps[0]],
    }
    const result = buildRoutineSystemPrompt(singleStepRoutine, [FAKE_TRACKER])
    expect(result).toContain('CURRENT STEP: 1 of 1')
  })

  it('handles a routine with no steps without throwing', () => {
    const emptyRoutine: Routine = { ...FAKE_ROUTINE, steps: [] }
    expect(() => buildRoutineSystemPrompt(emptyRoutine, [])).not.toThrow()
  })
})
