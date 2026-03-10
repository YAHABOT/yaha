'use client' // Needed: input change handlers, remove button click

import { Trash2 } from 'lucide-react'
import type { SchemaField, FieldType } from '@/types/tracker'

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' },
  { value: 'rating', label: 'Rating' },
  { value: 'time', label: 'Time' },
]

type Props = {
  field: SchemaField
  onChange: (updated: SchemaField) => void
  onRemove: () => void
}

export function SchemaFieldRow({ field, onChange, onRemove }: Props): React.ReactElement {
  function handleLabelChange(value: string): void {
    onChange({ ...field, label: value })
  }

  function handleTypeChange(value: string): void {
    onChange({ ...field, type: value as FieldType })
  }

  function handleUnitChange(value: string): void {
    onChange({ ...field, unit: value || undefined })
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={field.label}
        onChange={(e) => handleLabelChange(e.target.value)}
        placeholder="Field label"
        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-textPrimary placeholder-textMuted/50 focus:border-nutrition focus:outline-none focus:ring-1 focus:ring-nutrition"
        aria-label="Field label"
      />
      <select
        value={field.type}
        onChange={(e) => handleTypeChange(e.target.value)}
        className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm text-textPrimary focus:border-nutrition focus:outline-none focus:ring-1 focus:ring-nutrition"
        aria-label="Field type"
      >
        {FIELD_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={field.unit ?? ''}
        onChange={(e) => handleUnitChange(e.target.value)}
        placeholder="Unit"
        className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-textPrimary placeholder-textMuted/50 focus:border-nutrition focus:outline-none focus:ring-1 focus:ring-nutrition"
        aria-label="Field unit"
      />
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg p-2 text-textMuted transition-colors hover:bg-red-500/10 hover:text-red-400"
        aria-label="Remove field"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
