'use client' // Needed: manages edit/delete state, inline editing interactions

import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { updateLogAction, deleteLogAction } from '@/app/actions/logs'
import type { TrackerLog, LogFields } from '@/types/log'
import type { SchemaField } from '@/types/tracker'

type Props = {
  logs: TrackerLog[]
  schema: SchemaField[]
  trackerId: string
}

const RATING_MIN = 1
const RATING_MAX = 10

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getFieldLabel(schema: SchemaField[], fieldId: string): string {
  const field = schema.find((f) => f.fieldId === fieldId)
  return field?.label ?? fieldId
}

function getFieldUnit(schema: SchemaField[], fieldId: string): string | undefined {
  const field = schema.find((f) => f.fieldId === fieldId)
  return field?.unit
}

function getFieldType(schema: SchemaField[], fieldId: string): string {
  const field = schema.find((f) => f.fieldId === fieldId)
  return field?.type ?? 'text'
}

function formatFieldValue(value: number | string | null, unit?: string): string {
  if (value === null || value === '') return '---'
  const display = String(value)
  return unit ? `${display} ${unit}` : display
}

export function LogEntryList({ logs, schema, trackerId }: Props): React.ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<boolean>(false)

  if (logs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-textMuted">
        No entries yet. Log your first entry above.
      </p>
    )
  }

  function startEdit(log: TrackerLog): void {
    const raw: Record<string, string> = {}
    for (const field of schema) {
      const val = log.fields[field.fieldId]
      raw[field.fieldId] = val !== null && val !== undefined ? String(val) : ''
    }
    setEditValues(raw)
    setEditingId(log.id)
    setError(null)
  }

  function cancelEdit(): void {
    setEditingId(null)
    setEditValues({})
    setError(null)
  }

  async function saveEdit(logId: string): Promise<void> {
    setError(null)
    setSaving(true)

    try {
      const fields: LogFields = {}
      for (const field of schema) {
        const raw = editValues[field.fieldId]
        if (raw === '' || raw === undefined) {
          fields[field.fieldId] = null
          continue
        }
        if (field.type === 'number' || field.type === 'rating') {
          const parsed = Number(raw)
          fields[field.fieldId] = Number.isNaN(parsed) ? null : parsed
        } else {
          fields[field.fieldId] = raw
        }
      }

      const result = await updateLogAction(logId, trackerId, fields)
      if (result.error) {
        setError(result.error)
      } else {
        setEditingId(null)
        setEditValues({})
      }
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete(logId: string): Promise<void> {
    setError(null)
    setSaving(true)

    try {
      const result = await deleteLogAction(logId, trackerId)
      if (result.error) {
        setError(result.error)
      } else {
        setDeletingId(null)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {logs.map((log) => {
        const isEditing = editingId === log.id
        const isDeleting = deletingId === log.id

        return (
          <div
            key={log.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            {/* Header row */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-textMuted">
                {formatTimestamp(log.logged_at)}
              </span>
              <div className="flex items-center gap-1">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => saveEdit(log.id)}
                      disabled={saving}
                      className="rounded-md p-1.5 text-nutrition transition-colors hover:bg-nutrition/10 disabled:opacity-50"
                      aria-label="Save edit"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      className="rounded-md p-1.5 text-textMuted transition-colors hover:bg-black/[0.04] disabled:opacity-50"
                      aria-label="Cancel edit"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(log)}
                      className="rounded-md p-1.5 text-textMuted transition-colors hover:bg-black/[0.04] hover:text-textPrimary"
                      aria-label="Edit entry"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {isDeleting ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => confirmDelete(log.id)}
                          disabled={saving}
                          className="rounded-md px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          disabled={saving}
                          className="rounded-md px-2 py-1 text-xs font-medium text-textMuted transition-colors hover:bg-black/[0.04]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(log.id)}
                        className="rounded-md p-1.5 text-textMuted transition-colors hover:bg-red-500/10 hover:text-red-400"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Field values */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {schema.map((field) => {
                const value = log.fields[field.fieldId]

                if (isEditing) {
                  return (
                    <EditFieldInput
                      key={field.fieldId}
                      field={field}
                      value={editValues[field.fieldId] ?? ''}
                      onChange={(val) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [field.fieldId]: val,
                        }))
                      }
                    />
                  )
                }

                return (
                  <div key={field.fieldId}>
                    <span className="block text-xs text-textMuted">
                      {getFieldLabel(schema, field.fieldId)}
                    </span>
                    <span className="text-sm font-medium text-textPrimary">
                      {formatFieldValue(value, getFieldUnit(schema, field.fieldId))}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- Inline edit input ---

type EditFieldInputProps = {
  field: SchemaField
  value: string
  onChange: (value: string) => void
}

function EditFieldInput({ field, value, onChange }: EditFieldInputProps): React.ReactElement {
  const inputId = `edit-${field.fieldId}`
  const fieldType = getFieldType([field], field.fieldId)
  const inputClasses =
    'w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div>
      <label htmlFor={inputId} className="block text-xs text-textMuted">
        {field.label}
        {field.unit && <span className="ml-1 text-textMuted/60">({field.unit})</span>}
      </label>

      {fieldType === 'number' && (
        <input
          id={inputId}
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        />
      )}

      {fieldType === 'text' && (
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        />
      )}

      {fieldType === 'rating' && (
        <input
          id={inputId}
          type="number"
          min={RATING_MIN}
          max={RATING_MAX}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        />
      )}

      {fieldType === 'time' && (
        <input
          id={inputId}
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        />
      )}
    </div>
  )
}
