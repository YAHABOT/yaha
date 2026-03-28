'use client' // needed for confirm/discard state management and server action calls

import { useState } from 'react'
import { confirmCreateTrackerAction } from '@/app/actions/chat'
import type { CreateTrackerCard as CreateTrackerCardType } from '@/types/action-card'

type ActionCardStatus = 'pending' | 'confirmed' | 'discarded' | 'loading'

type Props = {
  card: CreateTrackerCardType
  messageId?: string
  cardIndex?: number
  onConfirm?: () => void
  onDiscard?: () => void
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

export function CreateTrackerCard({ card, messageId, cardIndex, onConfirm, onDiscard }: Props): React.ReactElement {
  const [status, setStatus] = useState<ActionCardStatus>(card.confirmed ? 'confirmed' : 'pending')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const typeColors = getTypeColors(card.trackerType)

  async function handleConfirm(): Promise<void> {
    setStatus('loading')
    setErrorMessage(null)

    const result = await confirmCreateTrackerAction(card, messageId, cardIndex)

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
      <div
        className="animate-in fade-in zoom-in-95 duration-500 rounded-2xl bg-nutrition/[0.06] border border-nutrition/25 p-5 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
        data-testid="create-tracker-card-confirmed"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-nutrition/20 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-nutrition"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div>
            <p className="text-sm font-black text-nutrition">Tracker Created</p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{card.name}</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'discarded') {
    return (
      <div
        className="animate-out fade-out zoom-out-95 duration-500 rounded-2xl bg-white/[0.02] border border-white/5 p-5"
        data-testid="create-tracker-card-discarded"
      >
        <p className="text-sm font-medium text-muted-foreground/50">Tracker creation cancelled</p>
      </div>
    )
  }

  return (
    <div
      className={`animate-in slide-in-from-bottom-4 duration-500 relative flex flex-col gap-4 rounded-3xl border-l-4 border border-white/[0.06] p-6 backdrop-blur-md transition-all overflow-visible ${typeColors.border} ${typeColors.bg} ${typeColors.glow}`}
      data-testid="create-tracker-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: card.color }}
          />
          <h3 className="text-base font-black tracking-tight text-foreground">
            {card.name}
          </h3>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${typeColors.text} border-current/20 bg-current/5`}>
          New Tracker
        </span>
      </div>

      {/* Schema preview */}
      {card.schema.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {card.schema.map((field) => (
            <div
              key={field.fieldId}
              className="flex flex-col gap-0.5 rounded-xl bg-white/[0.03] p-3 border border-white/[0.05]"
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {field.label}
              </span>
              <span className="text-xs font-bold text-muted-foreground/40">
                {field.type}{field.unit ? ` · ${field.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {errorMessage && (
        <p className="rounded-2xl bg-red-500/[0.08] border border-red-500/20 p-3.5 text-xs font-medium text-red-400" data-testid="create-tracker-card-error">
          {errorMessage}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2.5">
        <button
          onClick={() => void handleConfirm()}
          disabled={status === 'loading'}
          className="flex-1 rounded-2xl bg-nutrition px-4 py-3 text-sm font-black text-black transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-[0.98] disabled:opacity-40 disabled:shadow-none disabled:scale-100"
          data-testid="create-tracker-card-confirm"
        >
          {status === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-black/60 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-black/60 animate-bounce [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-black/60 animate-bounce [animation-delay:240ms]" />
            </span>
          ) : 'Create Tracker'}
        </button>
        <button
          onClick={handleDiscard}
          disabled={status === 'loading'}
          className="rounded-2xl bg-white/[0.04] border border-white/[0.06] px-4 py-3 text-sm font-bold text-muted-foreground/60 transition-all duration-200 hover:bg-white/[0.07] hover:text-muted-foreground active:scale-[0.98] disabled:opacity-30"
          data-testid="create-tracker-card-discard"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
