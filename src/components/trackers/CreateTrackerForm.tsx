'use client' // Needed: form state, schema builder interactions, redirect on success

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createTrackerAction } from '@/app/actions/trackers'
import { SchemaFieldRow } from '@/components/trackers/SchemaFieldRow'
import type { SchemaField, TrackerType } from '@/types/tracker'

const TYPE_OPTIONS: { value: TrackerType; label: string }[] = [
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'workout', label: 'Workout' },
  { value: 'mood', label: 'Mood' },
  { value: 'water', label: 'Water' },
  { value: 'custom', label: 'Custom' },
]

const TYPE_COLORS: Record<TrackerType, string> = {
  nutrition: '#10b981',
  sleep: '#3b82f6',
  workout: '#f97316',
  mood: '#a855f7',
  water: '#06b6d4',
  custom: '#6b7280',
}

const MAX_SCHEMA_FIELDS = 20

function generateFieldId(): string {
  return `fld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function createEmptyField(): SchemaField {
  return {
    fieldId: generateFieldId(),
    label: '',
    type: 'number',
  }
}

export function CreateTrackerForm(): React.ReactElement {
  const router = useRouter()
  const [name, setName] = useState<string>('')
  const [type, setType] = useState<TrackerType>('custom')
  const [color, setColor] = useState<string>(TYPE_COLORS.custom)
  const [schema, setSchema] = useState<SchemaField[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)

  function handleTypeChange(newType: TrackerType): void {
    setType(newType)
    setColor(TYPE_COLORS[newType])
  }

  function handleAddField(): void {
    if (schema.length >= MAX_SCHEMA_FIELDS) return
    setSchema((prev) => [...prev, createEmptyField()])
  }

  function handleFieldChange(index: number, updated: SchemaField): void {
    setSchema((prev) => prev.map((f, i) => (i === index ? updated : f)))
  }

  function handleFieldRemove(index: number): void {
    setSchema((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const result = await createTrackerAction({
        name,
        type,
        color,
        schema: schema.filter((f) => f.label.trim() !== ''),
      })

      if (result.error) {
        setError(result.error)
      } else {
        router.push('/trackers')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="tracker-name" className="mb-1 block text-sm text-textMuted">
          Name
        </label>
        <input
          id="tracker-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={50}
          placeholder="e.g. Daily Nutrition"
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-textPrimary placeholder-textMuted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Type */}
      <div>
        <label htmlFor="tracker-type" className="mb-1 block text-sm text-textMuted">
          Type
        </label>
        <select
          id="tracker-type"
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as TrackerType)}
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Color */}
      <div>
        <label htmlFor="tracker-color" className="mb-1 block text-sm text-textMuted">
          Color
        </label>
        <div className="flex items-center gap-3">
          <input
            id="tracker-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-background"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            pattern="^#[0-9a-fA-F]{6}$"
            placeholder="#10b981"
            className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm text-textPrimary placeholder-textMuted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Hex color value"
          />
        </div>
      </div>

      {/* Schema Fields */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm text-textMuted">
            Fields ({schema.length}/{MAX_SCHEMA_FIELDS})
          </label>
          <button
            type="button"
            onClick={handleAddField}
            disabled={schema.length >= MAX_SCHEMA_FIELDS}
            className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-1.5 text-xs font-medium text-textPrimary transition-colors hover:bg-black/[0.06] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Field
          </button>
        </div>

        {schema.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-textMuted">
            No fields yet. Add fields to define what data this tracker collects.
          </p>
        ) : (
          <div className="space-y-2">
            {schema.map((field, index) => (
              <SchemaFieldRow
                key={field.fieldId}
                field={field}
                onChange={(updated) => handleFieldChange(index, updated)}
                onRemove={() => handleFieldRemove(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Tracker'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/trackers')}
          className="rounded-lg bg-surfaceHighlight px-6 py-2.5 text-sm font-medium text-textMuted transition-colors hover:bg-black/[0.06] hover:text-textPrimary"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
