'use client'

import { Trash2, ChevronUp, ChevronDown } from 'lucide-react'
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
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}

export function SchemaFieldRow({ 
  field, 
  onChange, 
  onRemove, 
  onMoveUp, 
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true
}: Props): React.ReactElement {
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
    <div className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.01] p-2 transition-all hover:bg-white/[0.03] hover:border-white/10">
      {/* Reorder controls */}
      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="rounded-lg p-1 text-textMuted transition-colors hover:bg-white/10 hover:text-textPrimary disabled:opacity-0"
          aria-label="Move field up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="rounded-lg p-1 text-textMuted transition-colors hover:bg-white/10 hover:text-textPrimary disabled:opacity-0"
          aria-label="Move field down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <input
        type="text"
        value={field.label}
        onChange={(e) => handleLabelChange(e.target.value)}
        placeholder="Field label"
        className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm font-bold text-textPrimary placeholder-textMuted/20 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all"
        aria-label="Field label"
      />
      
      <select
        value={field.type}
        onChange={(e) => handleTypeChange(e.target.value)}
        className="h-[46px] w-32 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-textPrimary focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/10 appearance-none cursor-pointer hover:bg-black/60 transition-all"
        aria-label="Field type"
      >
        {FIELD_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-sidebar font-sans normal-case">
            {opt.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={field.unit ?? ''}
        onChange={(e) => handleUnitChange(e.target.value)}
        placeholder="Unit"
        className="h-[46px] w-24 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs font-bold text-textPrimary placeholder-textMuted/20 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all text-center"
        aria-label="Field unit"
      />

      <button
        type="button"
        onClick={onRemove}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-textMuted transition-all hover:bg-red-500/10 hover:text-red-500 active:scale-90"
        aria-label="Remove field"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
