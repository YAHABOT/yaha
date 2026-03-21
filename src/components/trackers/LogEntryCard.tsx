'use client'

import { useState, useTransition } from 'react'
import { Trash2, Loader2, Pencil, Check, X } from 'lucide-react'
import { deleteLogAction, updateLogAction } from '@/app/actions/logs'
import { formatFieldValue } from '@/lib/utils/format'
import type { TrackerLog, LogFields } from '@/types/log'
import type { SchemaField } from '@/types/tracker'

type Props = {
  log: TrackerLog
  schema: SchemaField[]
}

const RATING_MIN = 1
const RATING_MAX = 10

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

function getSourceBadgeStyle(source: string): string {
  if (source === 'telegram') return 'bg-sleep/10 text-sleep border border-sleep/20'
  if (source === 'web') return 'bg-nutrition/10 text-nutrition border border-nutrition/20'
  if (source === 'chat') return 'bg-mood/10 text-mood border border-mood/20'
  return 'bg-white/[0.04] text-textMuted border border-white/5'
}

export function LogEntryCard({ log, schema }: Props): React.ReactElement {
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isSaving, startSaveTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editError, setEditError] = useState<string | null>(null)

  const filledFields = schema.filter(
    (field) => log.fields[field.fieldId] !== null && log.fields[field.fieldId] !== undefined
  )

  const handleDelete = (): void => {
    if (!confirm('Are you sure you want to delete this entry?')) return
    startDeleteTransition(async () => {
      await deleteLogAction(log.id, log.tracker_id)
    })
  }

  function startEdit(): void {
    const raw: Record<string, string> = {}
    for (const field of schema) {
      const val = log.fields[field.fieldId]
      raw[field.fieldId] = val !== null && val !== undefined ? String(val) : ''
    }
    setEditValues(raw)
    setIsEditing(true)
    setEditError(null)
  }

  function cancelEdit(): void {
    setIsEditing(false)
    setEditValues({})
    setEditError(null)
  }

  function saveEdit(): void {
    setEditError(null)
    startSaveTransition(async () => {
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
      const result = await updateLogAction(log.id, log.tracker_id, fields)
      if (result.error) {
        setEditError(result.error)
      } else {
        setIsEditing(false)
        setEditValues({})
      }
    })
  }

  return (
    <div
      className={`group rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3.5 backdrop-blur-md transition-all duration-300 hover:border-white/[0.08] hover:bg-white/[0.04] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] ${isDeleting ? 'opacity-50 scale-[0.99]' : ''}`}
    >
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-medium text-textMuted">{formatTime(log.logged_at)}</span>
          {log.source !== 'manual' && (
            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${getSourceBadgeStyle(log.source)}`}>
              {log.source}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={saveEdit}
                disabled={isSaving}
                className="rounded-lg p-1 text-nutrition transition-all duration-300 hover:bg-nutrition/10 disabled:opacity-50"
                aria-label="Save edit"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isSaving}
                className="rounded-lg p-1 text-textMuted transition-all duration-300 hover:bg-white/[0.04] hover:text-textPrimary disabled:opacity-50"
                aria-label="Cancel edit"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startEdit}
                className="rounded-lg p-1 text-textMuted opacity-0 transition-all duration-300 group-hover:opacity-100 hover:bg-white/[0.04] hover:text-textPrimary"
                aria-label="Edit entry"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg p-1 text-textMuted opacity-0 transition-all duration-300 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 hover:shadow-[0_0_8px_rgba(239,68,68,0.2)] disabled:opacity-50"
                title="Delete entry"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit error */}
      {isEditing && editError && (
        <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {editError}
        </div>
      )}

      {/* Field display / edit */}
      {isEditing ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
          {schema.map((field) => (
            <EditFieldInput
              key={field.fieldId}
              field={field}
              value={editValues[field.fieldId] ?? ''}
              onChange={(val) =>
                setEditValues((prev) => ({ ...prev, [field.fieldId]: val }))
              }
            />
          ))}
        </dl>
      ) : filledFields.length === 0 ? (
        <p className="text-sm text-textMuted">No fields recorded</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
          {filledFields.map((field) => (
            <div key={field.fieldId}>
              <dt className="text-[10px] font-medium uppercase tracking-wider text-textMuted">{field.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-textPrimary">
                {formatFieldValue(log.fields[field.fieldId] ?? null, field.unit, field.label)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

// --- Inline edit input sub-component ---

type EditFieldInputProps = {
  field: SchemaField
  value: string
  onChange: (value: string) => void
}

function EditFieldInput({ field, value, onChange }: EditFieldInputProps): React.ReactElement {
  const inputId = `edit-${field.fieldId}`
  const inputClasses =
    'w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-textPrimary focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20'

  return (
    <div>
      <label htmlFor={inputId} className="block text-[10px] font-medium uppercase tracking-wider text-textMuted">
        {field.label}
        {field.unit && <span className="ml-1 normal-case text-textMuted/60">({field.unit})</span>}
      </label>

      {field.type === 'number' && (
        <input
          id={inputId}
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        />
      )}

      {field.type === 'text' && (
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        />
      )}

      {field.type === 'rating' && (
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

      {field.type === 'time' && (
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
