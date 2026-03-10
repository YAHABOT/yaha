'use client' // needed for confirm/discard state management and server action calls

import { useState } from 'react'
import { confirmLogAction } from '@/app/actions/chat'
import type { ActionCard as ActionCardType } from '@/types/action-card'

type ActionCardStatus = 'pending' | 'confirmed' | 'discarded' | 'loading'

type Props = {
  card: ActionCardType
  onConfirm?: () => void
  onDiscard?: () => void
}

function formatFieldValue(value: number | string | null): string {
  if (value === null || value === undefined) return '—'
  return String(value)
}

export function ActionCard({ card, onConfirm, onDiscard }: Props): React.ReactElement {
  const [status, setStatus] = useState<ActionCardStatus>('pending')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleConfirm(): Promise<void> {
    setStatus('loading')
    setErrorMessage(null)

    const result = await confirmLogAction(card)

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
        className="rounded-xl border border-nutrition/20 bg-surfaceHighlight p-4"
        data-testid="action-card-confirmed"
      >
        <p className="text-sm font-medium text-nutrition">Logged</p>
      </div>
    )
  }

  if (status === 'discarded') {
    return (
      <div
        className="rounded-xl border border-border bg-surfaceHighlight p-4"
        data-testid="action-card-discarded"
      >
        <p className="text-sm text-textMuted">Discarded</p>
      </div>
    )
  }

  const fieldEntries = Object.entries(card.fields)

  return (
    <div
      className="rounded-xl border border-border bg-surfaceHighlight p-4"
      data-testid="action-card"
    >
      <p className="mb-3 text-sm font-semibold text-textPrimary">
        Log to {card.trackerName}
      </p>

      <ul className="mb-3 space-y-1">
        {fieldEntries.map(([key, value]) => (
          <li key={key} className="flex items-center gap-2 text-xs">
            <span className="text-textMuted">{key}:</span>
            <span className="text-textPrimary">{formatFieldValue(value)}</span>
          </li>
        ))}
      </ul>

      <p className="mb-4 text-xs text-textMuted">Date: {card.date}</p>

      {errorMessage && (
        <p className="mb-3 text-xs text-red-400" data-testid="action-card-error">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={status === 'loading'}
          className="flex-1 rounded-lg bg-nutrition px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-nutrition/90 disabled:opacity-50"
          data-testid="action-card-confirm"
        >
          {status === 'loading' ? 'Logging...' : 'Confirm'}
        </button>
        <button
          onClick={handleDiscard}
          disabled={status === 'loading'}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-textMuted transition-colors hover:bg-surfaceHighlight disabled:opacity-50"
          data-testid="action-card-discard"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
