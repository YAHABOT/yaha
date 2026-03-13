import { describe, it, expect } from 'vitest'
import {
  evaluateFormula,
  buildFieldValueMap,
  formatResult,
} from '@/lib/correlator/formula-engine'
import type { FormulaNode, FieldValueMap } from '@/types/correlator'
import type { TrackerLog } from '@/types/log'

// --- evaluateFormula -----------------------------------------------------------

describe('evaluateFormula', () => {
  describe('constant node', () => {
    it('returns the constant value', () => {
      const node: FormulaNode = { type: 'constant', value: 42 }
      expect(evaluateFormula(node, new Map())).toBe(42)
    })

    it('returns zero for a zero constant', () => {
      const node: FormulaNode = { type: 'constant', value: 0 }
      expect(evaluateFormula(node, new Map())).toBe(0)
    })

    it('returns negative constants correctly', () => {
      const node: FormulaNode = { type: 'constant', value: -5 }
      expect(evaluateFormula(node, new Map())).toBe(-5)
    })
  })

  describe('field node', () => {
    it('returns the value from the map when present', () => {
      const values: FieldValueMap = new Map([['tracker-1:fld_001', 350]])
      const node: FormulaNode = { type: 'field', trackerId: 'tracker-1', fieldId: 'fld_001' }
      expect(evaluateFormula(node, values)).toBe(350)
    })

    it('returns null when the key is not in the map', () => {
      const node: FormulaNode = { type: 'field', trackerId: 'tracker-1', fieldId: 'fld_001' }
      expect(evaluateFormula(node, new Map())).toBeNull()
    })

    it('returns null when the value in the map is null', () => {
      const values: FieldValueMap = new Map([['tracker-1:fld_001', null]])
      const node: FormulaNode = { type: 'field', trackerId: 'tracker-1', fieldId: 'fld_001' }
      expect(evaluateFormula(node, values)).toBeNull()
    })
  })

  describe('op node — addition', () => {
    it('adds two constants', () => {
      const node: FormulaNode = {
        type: 'op',
        operator: '+',
        left: { type: 'constant', value: 10 },
        right: { type: 'constant', value: 5 },
      }
      expect(evaluateFormula(node, new Map())).toBe(15)
    })

    it('adds a field and a constant', () => {
      const values: FieldValueMap = new Map([['tracker-1:fld_001', 300]])
      const node: FormulaNode = {
        type: 'op',
        operator: '+',
        left: { type: 'field', trackerId: 'tracker-1', fieldId: 'fld_001' },
        right: { type: 'constant', value: 200 },
      }
      expect(evaluateFormula(node, values)).toBe(500)
    })
  })

  describe('op node — subtraction', () => {
    it('subtracts right from left', () => {
      const node: FormulaNode = {
        type: 'op',
        operator: '-',
        left: { type: 'constant', value: 100 },
        right: { type: 'constant', value: 40 },
      }
      expect(evaluateFormula(node, new Map())).toBe(60)
    })
  })

  describe('op node — multiplication', () => {
    it('multiplies two values', () => {
      const node: FormulaNode = {
        type: 'op',
        operator: '*',
        left: { type: 'constant', value: 7 },
        right: { type: 'constant', value: 3 },
      }
      expect(evaluateFormula(node, new Map())).toBe(21)
    })
  })

  describe('op node — division', () => {
    it('divides left by right', () => {
      const node: FormulaNode = {
        type: 'op',
        operator: '/',
        left: { type: 'constant', value: 10 },
        right: { type: 'constant', value: 4 },
      }
      expect(evaluateFormula(node, new Map())).toBe(2.5)
    })

    it('returns null when dividing by zero', () => {
      const node: FormulaNode = {
        type: 'op',
        operator: '/',
        left: { type: 'constant', value: 10 },
        right: { type: 'constant', value: 0 },
      }
      expect(evaluateFormula(node, new Map())).toBeNull()
    })
  })

  describe('null propagation', () => {
    it('returns null when left operand is null (missing field)', () => {
      const node: FormulaNode = {
        type: 'op',
        operator: '+',
        left: { type: 'field', trackerId: 'missing', fieldId: 'fld_001' },
        right: { type: 'constant', value: 100 },
      }
      expect(evaluateFormula(node, new Map())).toBeNull()
    })

    it('returns null when right operand is null (missing field)', () => {
      const values: FieldValueMap = new Map([['tracker-1:fld_001', 200]])
      const node: FormulaNode = {
        type: 'op',
        operator: '+',
        left: { type: 'field', trackerId: 'tracker-1', fieldId: 'fld_001' },
        right: { type: 'field', trackerId: 'missing', fieldId: 'fld_002' },
      }
      expect(evaluateFormula(node, values)).toBeNull()
    })

    it('propagates null through nested operations', () => {
      const node: FormulaNode = {
        type: 'op',
        operator: '*',
        left: {
          type: 'op',
          operator: '+',
          left: { type: 'field', trackerId: 'missing', fieldId: 'fld_001' },
          right: { type: 'constant', value: 10 },
        },
        right: { type: 'constant', value: 2 },
      }
      expect(evaluateFormula(node, new Map())).toBeNull()
    })
  })

  describe('maximum depth guard', () => {
    it('returns null when recursion exceeds MAX_DEPTH', () => {
      // Build a deeply nested op tree (21 levels deep — one beyond the limit of 20)
      let node: FormulaNode = { type: 'constant', value: 1 }
      for (let i = 0; i < 21; i++) {
        node = {
          type: 'op',
          operator: '+',
          left: node,
          right: { type: 'constant', value: 0 },
        }
      }
      expect(evaluateFormula(node, new Map())).toBeNull()
    })

    it('evaluates correctly at exactly MAX_DEPTH', () => {
      // Build a tree exactly 20 levels deep — should succeed
      let node: FormulaNode = { type: 'constant', value: 1 }
      for (let i = 0; i < 20; i++) {
        node = {
          type: 'op',
          operator: '+',
          left: node,
          right: { type: 'constant', value: 0 },
        }
      }
      expect(evaluateFormula(node, new Map())).toBe(1)
    })
  })
})

// --- buildFieldValueMap -------------------------------------------------------

describe('buildFieldValueMap', () => {
  const makeLog = (
    trackerId: string,
    fields: Record<string, number | string | null>
  ): TrackerLog => ({
    id: `log-${Math.random()}`,
    tracker_id: trackerId,
    user_id: 'user-1',
    fields,
    logged_at: new Date().toISOString(),
    source: 'manual',
    created_at: new Date().toISOString(),
  })

  it('returns an empty map when given no logs', () => {
    const map = buildFieldValueMap([])
    expect(map.size).toBe(0)
  })

  it('maps a single numeric field correctly', () => {
    const log = makeLog('tracker-1', { fld_001: 350 })
    const map = buildFieldValueMap([log])
    expect(map.get('tracker-1:fld_001')).toBe(350)
  })

  it('sums numeric values across multiple logs for the same tracker and field', () => {
    const log1 = makeLog('tracker-1', { fld_001: 300 })
    const log2 = makeLog('tracker-1', { fld_001: 200 })
    const map = buildFieldValueMap([log1, log2])
    expect(map.get('tracker-1:fld_001')).toBe(500)
  })

  it('keeps fields from different trackers separate', () => {
    const log1 = makeLog('tracker-1', { fld_001: 300 })
    const log2 = makeLog('tracker-2', { fld_001: 150 })
    const map = buildFieldValueMap([log1, log2])
    expect(map.get('tracker-1:fld_001')).toBe(300)
    expect(map.get('tracker-2:fld_001')).toBe(150)
  })

  it('skips string field values', () => {
    const log = makeLog('tracker-1', { fld_001: 'chicken breast', fld_002: 350 })
    const map = buildFieldValueMap([log])
    expect(map.has('tracker-1:fld_001')).toBe(false)
    expect(map.get('tracker-1:fld_002')).toBe(350)
  })

  it('skips null field values', () => {
    const log = makeLog('tracker-1', { fld_001: null, fld_002: 100 })
    const map = buildFieldValueMap([log])
    expect(map.has('tracker-1:fld_001')).toBe(false)
    expect(map.get('tracker-1:fld_002')).toBe(100)
  })

  it('handles multiple fields per log correctly', () => {
    const log = makeLog('tracker-1', { fld_001: 350, fld_002: 25, fld_003: 10 })
    const map = buildFieldValueMap([log])
    expect(map.get('tracker-1:fld_001')).toBe(350)
    expect(map.get('tracker-1:fld_002')).toBe(25)
    expect(map.get('tracker-1:fld_003')).toBe(10)
  })
})

// --- formatResult -------------------------------------------------------------

describe('formatResult', () => {
  it('returns "---" when value is null', () => {
    expect(formatResult(null, 'kcal')).toBe('---')
  })

  it('returns "---" for null even when unit is empty', () => {
    expect(formatResult(null, '')).toBe('---')
  })

  it('formats a whole number without decimal places', () => {
    expect(formatResult(1850, 'kcal')).toBe('1850 kcal')
  })

  it('formats a decimal to 1 decimal place', () => {
    expect(formatResult(1850.567, 'kcal')).toBe('1850.6 kcal')
  })

  it('formats a number that rounds to a whole number', () => {
    expect(formatResult(7.04, 'hrs')).toBe('7 hrs')
  })

  it('appends the unit with a space', () => {
    expect(formatResult(8, 'hrs')).toBe('8 hrs')
  })

  it('handles zero value correctly', () => {
    expect(formatResult(0, 'kcal')).toBe('0 kcal')
  })

  it('handles negative values', () => {
    expect(formatResult(-200, 'kcal')).toBe('-200 kcal')
  })

  it('preserves one decimal for values like 1850.5', () => {
    expect(formatResult(1850.5, 'kcal')).toBe('1850.5 kcal')
  })
})
