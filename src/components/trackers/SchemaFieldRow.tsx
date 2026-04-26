'use client'

import { Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import type { SchemaField, FieldType } from '@/types/tracker'

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' },
  { value: 'rating', label: 'Rating' },
  { value: 'time', label: 'Time' },
  { value: 'select', label: 'Select' },
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
    const newType = value as FieldType
    if (newType !== 'select') {
      // Clear stale select-only properties when switching away from select
      const { selectOptions: _so, multiSelect: _ms, ...rest } = field
      void _so; void _ms
      onChange({ ...rest, type: newType })
    } else {
      onChange({ ...field, type: newType })
    }
  }

  function handleUnitChange(value: string): void {
    onChange({ ...field, unit: value || undefined })
  }

  return (
    <div className="group flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.01] p-2 transition-all hover:bg-white/[0.03] hover:border-white/10 sm:flex-row sm:items-center sm:gap-3">
      {/* Line 1 (mobile): label input — full width on mobile */}
      <div className="flex items-center gap-2 sm:contents">
        {/* Reorder controls — always visible on mobile, hover-only on desktop */}
        <div className="flex flex-col gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
      </div>

      {/* Line 2 (mobile): type + unit + delete — grouped row, indented with left border for visual grouping */}
      <div className="flex items-center gap-2 border-l-2 border-white/10 pl-2 sm:border-l-0 sm:pl-0">
        <select
          value={field.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="h-[46px] flex-1 sm:flex-none sm:w-32 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-textPrimary focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/10 appearance-none cursor-pointer hover:bg-black/60 transition-all"
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
          className="h-[46px] w-20 sm:w-24 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs font-bold text-textPrimary placeholder-textMuted/20 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all text-center"
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

      {/* Select-type extras — only shown when type === 'select' */}
      {field.type === 'select' && (
        <div className="flex flex-col gap-2 border-l-2 border-white/10 pl-2 sm:pl-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-textMuted">
              Options (one per line)
            </label>
            <textarea
              value={field.selectOptions?.join('\n') ?? ''}
              onChange={(e) => {
                const parsed = e.target.value
                  .split('\n')
                  .map(o => o.trim())
                  .filter(o => o.length > 0)
                onChange({ ...field, selectOptions: parsed })
              }}
              rows={3}
              placeholder={"Great\nGood\nOkay\nBad"}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-textPrimary placeholder-textMuted/20 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all resize-none"
              aria-label="Select options"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={field.multiSelect ?? false}
              onChange={() => onChange({ ...field, multiSelect: !(field.multiSelect ?? false) })}
              className="h-4 w-4 rounded border border-white/20 bg-black/40 accent-nutrition cursor-pointer"
              aria-label="Allow multiple selections"
            />
            <span className="text-xs font-bold text-textMuted">Allow multiple selections</span>
          </label>
        </div>
      )}
    </div>
  )
}
