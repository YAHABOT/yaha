'use client' // needed for confirm/discard state management and server action calls

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { confirmLogAction, updateLogAction } from '@/app/actions/chat'
import type { ActionCard as ActionCardType, UpdateDataCard } from '@/types/action-card'

type ActionCardStatus = 'pending' | 'confirmed' | 'discarded' | 'loading'

type Props = {
  card: ActionCardType
  messageId?: string       // DB message ID — used to persist confirmed: true on the message's JSONB
  cardIndex?: number       // Position in message.actions array — used for exact JSONB match
  onConfirm?: () => void
  onDiscard?: () => void
  onConfirmed?: () => void  // fires after the card is confirmed — used by ChatInterface to advance routine
}

const TRACKER_TYPE_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  nutrition: {
    border: 'border-l-nutrition',
    bg: 'bg-nutrition/[0.05]',
    text: 'text-nutrition',
    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.12)]',
  },
  sleep: {
    border: 'border-l-sleep',
    bg: 'bg-sleep/[0.05]',
    text: 'text-sleep',
    glow: 'shadow-[0_0_24px_rgba(59,130,246,0.12)]',
  },
  workout: {
    border: 'border-l-workout',
    bg: 'bg-workout/[0.05]',
    text: 'text-workout',
    glow: 'shadow-[0_0_24px_rgba(249,115,22,0.12)]',
  },
  mood: {
    border: 'border-l-mood',
    bg: 'bg-mood/[0.05]',
    text: 'text-mood',
    glow: 'shadow-[0_0_24px_rgba(168,85,247,0.12)]',
  },
  water: {
    border: 'border-l-water',
    bg: 'bg-water/[0.05]',
    text: 'text-water',
    glow: 'shadow-[0_0_24px_rgba(6,182,212,0.12)]',
  },
}

const DEFAULT_TYPE_COLORS = {
  border: 'border-l-white/10',
  bg: 'bg-white/[0.02]',
  text: 'text-muted-foreground',
  glow: 'shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
}

function getTypeColors(trackerType?: string) {
  if (!trackerType) return DEFAULT_TYPE_COLORS
  return TRACKER_TYPE_COLORS[trackerType.toLowerCase()] ?? DEFAULT_TYPE_COLORS
}

export function ActionCard({ card, messageId, cardIndex, onConfirm, onDiscard, onConfirmed }: Props): React.ReactElement {
  // Initialize as confirmed if the DB already has confirmed: true — survives page refresh
  const [status, setStatus] = useState<ActionCardStatus>(card.confirmed ? 'confirmed' : 'pending')
  const [isEditExpanded, setIsEditExpanded] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editableFields, setEditableFields] = useState<Record<string, string | number | null>>(() => {
    // Include ALL fields from schema (fieldLabels), not just logged ones
    // Unlogged fields initialize as empty strings
    const allSchemaKeys = card.fieldLabels ? Object.keys(card.fieldLabels) : Object.keys(card.fields)

    return Object.fromEntries(
      allSchemaKeys.map((key) => {
        // Get the logged value if it exists, otherwise undefined (will be empty string)
        const value = card.fields?.[key]

        if (value === null || value === undefined || value === '') return [key, '']
        // Multi-select array: join as comma-separated string for editing
        if (Array.isArray(value)) return [key, value.join(', ')]
        const unit = card.fieldUnits?.[key]
        // Duration fields (unit = HRS): convert decimal hours to HH:MM for the input.
        // The unit pill is outside the input so we never embed "HRS" in the value string.
        if (unit && unit.toLowerCase() === 'hrs' && typeof value === 'number') {
          const totalMinutes = Math.round(value * 60)
          const h = Math.floor(totalMinutes / 60) % 24
          const m = totalMinutes % 60
          return [key, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`]
        }
        // All other fields: raw value only — unit pill handles the suffix display
        return [key, value]
      })
    )
  })

  const typeColors = getTypeColors(card.trackerName)

  async function handleConfirm(): Promise<void> {
    setStatus('loading')
    setErrorMessage(null)

    console.log('[ActionCard] handleConfirm — messageId:', messageId, 'cardIndex:', cardIndex)

    // Strip fields with no value — only persist what the user actually provided
    const confirmedFields = Object.fromEntries(
      Object.entries(editableFields).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    )

    const result = await confirmLogAction({
      ...card,
      fields: confirmedFields
    }, messageId, cardIndex)

    if (result.error) {
      setErrorMessage(result.error)
      setStatus('pending')
      return
    }

    setStatus('confirmed')
    onConfirm?.()
    onConfirmed?.()
  }

  function handleDiscard(): void {
    setStatus('discarded')
    onDiscard?.()
  }

  const handleFieldChange = (key: string, value: string) => {
    setEditableFields(prev => ({
      ...prev,
      [key]: value
    }))
  }

  if (status === 'confirmed') {
    return (
      <div
        className="animate-in fade-in zoom-in-95 duration-500 rounded-2xl bg-nutrition/[0.06] border border-nutrition/25 p-5 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
        data-testid="action-card-confirmed"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-nutrition/20 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-nutrition"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div>
            <p className="text-sm font-black text-nutrition">Logged Successfully</p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{card.trackerName}</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'discarded') {
    return (
      <div
        className="animate-out fade-out zoom-out-95 duration-500 rounded-2xl bg-white/[0.02] border border-white/5 p-5"
        data-testid="action-card-discarded"
      >
        <p className="text-sm font-medium text-muted-foreground/50">Log discarded</p>
      </div>
    )
  }

  // fieldOrder is an explicit array — survives JSONB round-trip without alphabetical reordering.
  // Fall back: fieldLabels keys (may be alphabetical after JSONB), then raw editableFields order.
  const orderedKeys = card.fieldOrder
    ?? (card.fieldLabels ? Object.keys(card.fieldLabels) : Object.keys(editableFields))
  const fieldEntries = orderedKeys.map((key) => [key, editableFields[key]] as [string, string | number | null])

  return (
    <div
      className={`animate-in slide-in-from-bottom-4 duration-500 relative flex flex-col gap-4 rounded-3xl border-l-4 border border-white/[0.06] p-6 backdrop-blur-md transition-all overflow-visible ${typeColors.border} ${typeColors.bg} ${typeColors.glow}`}
      data-testid="action-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full ${typeColors.text.replace('text-', 'bg-')} opacity-80`} />
          <h3 className="text-base font-black tracking-tight text-foreground">
            {card.trackerName}
          </h3>
        </div>
        <div className="flex items-center gap-2.5">
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${typeColors.text} border-current/20 bg-current/5`}>
            {isEditExpanded ? 'Editing' : 'Pending Log'}
          </span>
          <button
            type="button"
            onClick={() => setIsEditExpanded(!isEditExpanded)}
            className="rounded-lg p-1 text-muted-foreground/60 transition-all hover:bg-white/[0.08] hover:text-muted-foreground"
            aria-label="Edit entry"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Fields Grid */}
      <div className={`grid gap-2.5 transition-all duration-200 w-full overflow-visible ${isEditExpanded ? 'rounded-2xl ring-1 ring-blue-500/30 p-1' : ''}`} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))' }}>
        {fieldEntries.map(([key, value]) => {
          // Text fields and descriptions should take full width to avoid awkward wrapping
          const fieldLabel = card.fieldLabels?.[key] || key
          const isTextField = fieldLabel.toLowerCase().includes('name') ||
                              fieldLabel.toLowerCase().includes('item') ||
                              fieldLabel.toLowerCase().includes('notes') ||
                              fieldLabel.toLowerCase().includes('description')
          const isStringValue = typeof value === 'string' && value !== '' && isNaN(Number(value)) && !String(value).match(/^\d{2}:\d{2}$/)
          const isLarge = isTextField || isStringValue || String(value || '').length > 15 || (fieldLabel.length ?? 0) > 16
          const label = fieldLabel
          const unit = card.fieldUnits?.[key]

          return (
            <div
              key={key}
              className={`flex flex-col gap-1.5 rounded-2xl bg-white/[0.03] p-3.5 border transition-all duration-200 overflow-visible ${isEditExpanded ? 'border-blue-500/20 bg-blue-500/[0.03]' : 'border-white/[0.05]'} focus-within:border-blue-500/40 focus-within:bg-white/[0.05] ${isLarge ? 'col-span-full' : ''}`}
            >
              <div className="flex flex-wrap items-start gap-1 min-w-0">
                <span className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {label}
                </span>
              </div>

              {isEditExpanded ? (
                <input
                  type="text"
                  value={value ?? ''}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  className="bg-transparent text-sm font-bold text-foreground w-full placeholder:text-muted-foreground/20 leading-snug focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded"
                  placeholder="..."
                />
              ) : (
                <p className="text-sm font-bold text-foreground w-full leading-snug break-words whitespace-pre-wrap flex items-baseline gap-1.5 flex-wrap">
                  {value !== null && value !== undefined && value !== ''
                    ? (
                      <>
                        <span>{String(value)}</span>
                        {unit && (
                          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/40 select-none">
                            {unit}
                          </span>
                        )}
                      </>
                    )
                    : <span className="text-muted-foreground/20">—</span>}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Date row */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-medium text-muted-foreground/50">
          {card.date}
        </span>
      </div>

      {/* Error */}
      {errorMessage && (
        <p className="rounded-2xl bg-red-500/[0.08] border border-red-500/20 p-3.5 text-xs font-medium text-red-400" data-testid="action-card-error">
          {errorMessage}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2.5">
        <button
          onClick={handleConfirm}
          disabled={status === 'loading'}
          className="flex-1 rounded-2xl bg-nutrition px-4 py-3 text-sm font-black text-black transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-[0.98] disabled:opacity-40 disabled:shadow-none disabled:scale-100"
          data-testid="action-card-confirm"
        >
          {status === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-black/60 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-black/60 animate-bounce [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-black/60 animate-bounce [animation-delay:240ms]" />
            </span>
          ) : 'Log Entry'}
        </button>
        <button
          onClick={handleDiscard}
          disabled={status === 'loading'}
          className="rounded-2xl bg-white/[0.04] border border-white/[0.06] px-4 py-3 text-sm font-bold text-muted-foreground/60 transition-all duration-200 hover:bg-white/[0.07] hover:text-muted-foreground active:scale-[0.98] disabled:opacity-30"
          data-testid="action-card-discard"
        >
          Discard
        </button>
      </div>
    </div>
  )
}

type UpdateDataCardProps = {
  card: UpdateDataCard
  messageId?: string
  cardIndex?: number
  onConfirm?: () => void
  onDiscard?: () => void
}

export function UpdateDataCardComponent({ card, messageId, cardIndex, onConfirm, onDiscard }: UpdateDataCardProps): React.ReactElement {
  const [status, setStatus] = useState<ActionCardStatus>(card.confirmed ? 'confirmed' : 'pending')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editableFields, setEditableFields] = useState<Record<string, string | number | null>>(() =>
    Object.fromEntries(
      Object.entries(card.fields).map(([key, val]) => {
        if (val === null || val === undefined) return [key, '']
        if (Array.isArray(val)) return [key, val.join(', ')]
        return [key, val]
      })
    )
  )

  const typeColors = getTypeColors(card.trackerName)

  async function handleConfirm(): Promise<void> {
    setStatus('loading')
    setErrorMessage(null)
    const confirmedFields = Object.fromEntries(
      Object.entries(editableFields).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    )
    const result = await updateLogAction({ ...card, fields: confirmedFields }, messageId, cardIndex)
    if (result.error) {
      setErrorMessage(result.error)
      setStatus('pending')
      return
    }
    setStatus('confirmed')
    onConfirm?.()
  }

  function handleDiscard(): void {
    setStatus('discarded')
    onDiscard?.()
  }

  if (status === 'confirmed') {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-500 rounded-2xl bg-sleep/[0.06] border border-sleep/25 p-5 shadow-[0_0_20px_rgba(59,130,246,0.1)]" data-testid="update-card-confirmed">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sleep/20 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-sleep"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div>
            <p className="text-sm font-black text-sleep">Updated Successfully</p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{card.trackerName}</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'discarded') {
    return (
      <div className="animate-out fade-out zoom-out-95 duration-500 rounded-2xl bg-white/[0.02] border border-white/5 p-5">
        <p className="text-sm font-medium text-muted-foreground/50">Update discarded</p>
      </div>
    )
  }

  const orderedKeys = card.fieldOrder ?? (card.fieldLabels ? Object.keys(card.fieldLabels) : Object.keys(editableFields))
  const fieldEntries = orderedKeys.map((key) => [key, editableFields[key]] as [string, string | number | null])

  return (
    <div
      className={`animate-in slide-in-from-bottom-4 duration-500 relative flex flex-col gap-4 rounded-3xl border-l-4 border border-white/[0.06] p-6 backdrop-blur-md transition-all overflow-visible ${typeColors.border} ${typeColors.bg} ${typeColors.glow}`}
      data-testid="update-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full ${typeColors.text.replace('text-', 'bg-')} opacity-80`} />
          <h3 className="text-base font-black tracking-tight text-foreground">{card.trackerName}</h3>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${typeColors.text} border-current/20 bg-current/5`}>
          Pending Update
        </span>
      </div>

      <div className="grid gap-2.5 w-full overflow-visible" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))' }}>
        {fieldEntries.map(([key, value]) => {
          const fieldLabel = card.fieldLabels?.[key] || key
          const unit = card.fieldUnits?.[key]
          const isStringValue = typeof value === 'string' && value !== '' && isNaN(Number(value)) && !String(value).match(/^\d{2}:\d{2}$/)
          const isLarge = isStringValue || String(value || '').length > 15 || (fieldLabel.length ?? 0) > 16
          return (
            <div key={key} className={`flex flex-col gap-1.5 rounded-2xl bg-white/[0.03] p-3.5 border border-white/[0.05] overflow-visible ${isLarge ? 'col-span-full' : ''}`}>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{fieldLabel}</span>
              <input
                type="text"
                value={value ?? ''}
                onChange={(e) => setEditableFields(prev => ({ ...prev, [key]: e.target.value }))}
                className="bg-transparent text-sm font-bold text-foreground w-full placeholder:text-muted-foreground/20 leading-snug focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded"
                placeholder="..."
              />
              {unit && <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/40">{unit}</span>}
            </div>
          )
        })}
      </div>

      {errorMessage && (
        <p className="rounded-2xl bg-red-500/[0.08] border border-red-500/20 p-3.5 text-xs font-medium text-red-400">{errorMessage}</p>
      )}

      <div className="flex gap-2.5">
        <button
          onClick={handleConfirm}
          disabled={status === 'loading'}
          className="flex-1 rounded-2xl bg-sleep px-4 py-3 text-sm font-black text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] active:scale-[0.98] disabled:opacity-40 disabled:shadow-none disabled:scale-100"
          data-testid="update-card-confirm"
        >
          {status === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:240ms]" />
            </span>
          ) : 'Update Entry'}
        </button>
        <button
          onClick={handleDiscard}
          disabled={status === 'loading'}
          className="rounded-2xl bg-white/[0.04] border border-white/[0.06] px-4 py-3 text-sm font-bold text-muted-foreground/60 transition-all duration-200 hover:bg-white/[0.07] hover:text-muted-foreground active:scale-[0.98] disabled:opacity-30"
          data-testid="update-card-discard"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
