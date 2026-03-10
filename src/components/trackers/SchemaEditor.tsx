'use client' // Needed: manages schema field state, add/remove/edit interactions

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { updateTrackerAction, deleteTrackerAction } from '@/app/actions/trackers'
import { SchemaFieldRow } from '@/components/trackers/SchemaFieldRow'
import type { SchemaField, Tracker } from '@/types/tracker'

const MAX_SCHEMA_FIELDS = 20

type Props = {
  tracker: Tracker
}

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

export function SchemaEditor({ tracker }: Props): React.ReactElement {
  const router = useRouter()
  const [schema, setSchema] = useState<SchemaField[]>(tracker.schema)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<boolean>(false)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false)

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

  async function handleSave(): Promise<void> {
    setError(null)
    setSaving(true)

    try {
      const filteredSchema = schema.filter((f) => f.label.trim() !== '')
      const result = await updateTrackerAction(tracker.id, { schema: filteredSchema })

      if (result.error) {
        setError(result.error)
      } else {
        router.push('/trackers')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    setError(null)
    setDeleting(true)

    try {
      const result = await deleteTrackerAction(tracker.id)

      if (result.error) {
        setError(result.error)
      } else {
        router.push('/trackers')
      }
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Tracker Info */}
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-4 w-4 rounded-full"
          style={{ backgroundColor: tracker.color }}
        />
        <h2 className="text-lg font-semibold text-textPrimary">{tracker.name}</h2>
        <span className="rounded-md bg-surfaceHighlight px-2 py-0.5 text-xs font-medium text-textMuted">
          {tracker.type}
        </span>
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
            className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-1.5 text-xs font-medium text-textPrimary transition-colors hover:bg-white/10 disabled:opacity-40"
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

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border pt-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-nutrition px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-nutrition/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Schema'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/trackers')}
            className="rounded-lg bg-surfaceHighlight px-6 py-2.5 text-sm font-medium text-textMuted transition-colors hover:bg-white/10 hover:text-textPrimary"
          >
            Cancel
          </button>
        </div>

        {/* Delete */}
        {showDeleteConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-400">Delete this tracker?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-lg bg-surfaceHighlight px-4 py-2 text-sm font-medium text-textMuted transition-colors hover:bg-white/10"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            Delete Tracker
          </button>
        )}
      </div>
    </div>
  )
}
