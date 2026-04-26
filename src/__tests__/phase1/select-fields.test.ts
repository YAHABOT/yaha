import { describe, it, expect, beforeEach, vi } from 'vitest'
import { sanitizeFields } from '@/lib/ai/actions'
import type { SchemaField } from '@/lib/ai/actions'

describe('SELECT Field Type — sanitizeFields()', () => {
  const selectFieldSchema: SchemaField[] = [
    {
      fieldId: 'fld_meal',
      label: 'Meal Type',
      type: 'select',
      selectOptions: ['breakfast', 'lunch', 'dinner', 'snack'],
      multiSelect: false,
    },
    {
      fieldId: 'fld_mood',
      label: 'Mood',
      type: 'select',
      selectOptions: ['happy', 'neutral', 'sad'],
      multiSelect: false,
    },
    {
      fieldId: 'fld_symptoms',
      label: 'Symptoms',
      type: 'select',
      selectOptions: ['headache', 'nausea', 'fatigue', 'dizziness'],
      multiSelect: true,
    },
  ]

  describe('Single-select — valid input', () => {
    it('stores single-select value when it matches options', () => {
      const fields = { fld_meal: 'lunch' }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_meal).toBe('lunch')
    })

    it('trims whitespace from single-select values', () => {
      const fields = { fld_meal: '  breakfast  ' }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_meal).toBe('breakfast')
    })

    it('preserves case sensitivity — rejects mismatched case', () => {
      const fields = { fld_meal: 'Lunch' }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_meal).toBeNull()
    })

    it('handles all valid options correctly', () => {
      const validOptions = ['breakfast', 'lunch', 'dinner', 'snack']
      validOptions.forEach(opt => {
        const result = sanitizeFields({ fld_meal: opt }, selectFieldSchema)
        expect(result.fld_meal).toBe(opt)
      })
    })
  })

  describe('Single-select — invalid input', () => {
    it('returns null when value does not match any option', () => {
      const fields = { fld_meal: 'pizza' }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_meal).toBeNull()
    })

    it('returns null for empty string', () => {
      const fields = { fld_meal: '' }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_meal).toBeNull()
    })

    it('returns null for null, skips undefined', () => {
      expect(sanitizeFields({ fld_meal: null }, selectFieldSchema).fld_meal).toBeNull()
      // undefined values skip field entirely (don't add to result object)
      expect(sanitizeFields({ fld_meal: undefined }, selectFieldSchema)).not.toHaveProperty('fld_meal')
    })

    it('returns null for numeric input', () => {
      const fields = { fld_meal: 123 }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_meal).toBeNull()
    })
  })

  describe('Multi-select — valid input', () => {
    it('stores array of values when all match options', () => {
      const fields = { fld_symptoms: ['headache', 'fatigue'] }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_symptoms).toEqual(['headache', 'fatigue'])
    })

    it('trims whitespace from multi-select array items', () => {
      const fields = { fld_symptoms: ['  headache  ', ' nausea '] }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_symptoms).toEqual(['headache', 'nausea'])
    })

    it('filters out invalid options from array', () => {
      const fields = { fld_symptoms: ['headache', 'invalid', 'fatigue'] }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_symptoms).toEqual(['headache', 'fatigue'])
    })

    it('returns null when all array items are invalid', () => {
      const fields = { fld_symptoms: ['invalid1', 'invalid2'] }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_symptoms).toBeNull()
    })

    it('returns null for empty array', () => {
      const fields = { fld_symptoms: [] }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_symptoms).toBeNull()
    })

    it('handles single-item array as multi-select', () => {
      const fields = { fld_symptoms: ['headache'] }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_symptoms).toEqual(['headache'])
    })
  })

  describe('Multi-select — edge cases', () => {
    it('does not deduplicate (preserves duplicates from AI)', () => {
      const fields = { fld_symptoms: ['headache', 'headache', 'fatigue'] }
      const result = sanitizeFields(fields, selectFieldSchema)
      // Duplicates are preserved as-is from AI response
      expect(result.fld_symptoms).toEqual(['headache', 'headache', 'fatigue'])
    })

    it('preserves array order', () => {
      const fields = { fld_symptoms: ['dizziness', 'headache', 'nausea'] }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_symptoms).toEqual(['dizziness', 'headache', 'nausea'])
    })

    it('converts non-string array items to strings', () => {
      const fields = { fld_symptoms: [123, 'headache'] }
      const result = sanitizeFields(fields, selectFieldSchema)
      expect(result.fld_symptoms).toEqual(['headache'])
    })
  })

  describe('Select with empty options array', () => {
    it('accepts any value when options array is empty (single-select)', () => {
      const schema: SchemaField[] = [
        {
          fieldId: 'fld_custom',
          label: 'Custom',
          type: 'select',
          selectOptions: [],
          multiSelect: false,
        },
      ]
      const fields = { fld_custom: 'anyvalue' }
      const result = sanitizeFields(fields, schema)
      expect(result.fld_custom).toBe('anyvalue')
    })

    it('accepts any array items when options array is empty (multi-select)', () => {
      const schema: SchemaField[] = [
        {
          fieldId: 'fld_custom',
          label: 'Custom',
          type: 'select',
          selectOptions: [],
          multiSelect: true,
        },
      ]
      const fields = { fld_custom: ['item1', 'item2'] }
      const result = sanitizeFields(fields, schema)
      expect(result.fld_custom).toEqual(['item1', 'item2'])
    })
  })

  describe('Missing selectOptions field', () => {
    it('treats undefined selectOptions as empty array (allows any value)', () => {
      const schema: SchemaField[] = [
        {
          fieldId: 'fld_test',
          label: 'Test',
          type: 'select',
          // selectOptions intentionally omitted
          multiSelect: false,
        },
      ]
      const fields = { fld_test: 'anyvalue' }
      const result = sanitizeFields(fields, schema)
      expect(result.fld_test).toBe('anyvalue')
    })
  })
})
