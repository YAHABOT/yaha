'use client'
// needed for modal open/close state, step navigation, and form submission

import { useState } from 'react'
import { X } from 'lucide-react'
import { createWidgetAction } from '@/app/actions/dashboard'
import { WIDGET_TYPES } from '@/types/widget'
import type { WidgetType, CreateWidgetInput } from '@/types/widget'
import type { Tracker } from '@/types/tracker'

const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  field_latest: 'Latest Value',
  field_average: 'N-Day Average',
  field_total: 'N-Day Total',
  correlator: 'Correlator Formula',
}

const WIDGET_TYPE_DESCRIPTIONS: Record<WidgetType, string> = {
  field_latest: 'Show the most recent logged value for a field.',
  field_average: 'Show the average of a field over N days.',
  field_total: 'Show the sum of a field over N days.',
  correlator: 'Show the result of a saved correlation formula.',
}

const DEFAULT_DAYS = 7
const MAX_LABEL_LENGTH = 50

type Step = 'type' | 'config'

type Props = {
  trackers: Tracker[]
  onClose: () => void
}

export function AddWidgetModal({ trackers, onClose }: Props): React.ReactElement {
  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null)
  const [selectedTrackerId, setSelectedTrackerId] = useState('')
  const [selectedFieldId, setSelectedFieldId] = useState('')
  const [label, setLabel] = useState('')
  const [days, setDays] = useState(DEFAULT_DAYS)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTracker = trackers.find(t => t.id === selectedTrackerId) ?? null
  const isFieldType = selectedType === 'field_latest'
    || selectedType === 'field_average'
    || selectedType === 'field_total'

  function handleSelectType(type: WidgetType): void {
    setSelectedType(type)
    setStep('config')
    setError(null)
  }

  function handleBack(): void {
    setStep('type')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!selectedType) return

    setSubmitting(true)
    setError(null)

    try {
      const input: CreateWidgetInput = {
        type: selectedType,
        label: label.trim() || WIDGET_TYPE_LABELS[selectedType],
        days,
        position: 0,
        tracker_id: isFieldType && selectedTrackerId ? selectedTrackerId : undefined,
        field_id: isFieldType && selectedFieldId ? selectedFieldId : undefined,
      }

      const result = await createWidgetAction(input)
      if (result.error) {
        setError(result.error)
        setSubmitting(false)
        return
      }

      onClose()
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6 shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black tracking-tight text-textPrimary">
              {step === 'type' ? 'Add Widget' : 'Configure Widget'}
            </h2>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-textMuted">
              {step === 'type' ? 'Choose a widget type' : 'Set up your widget'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-textMuted transition-all duration-200 hover:border-white/20 hover:text-textPrimary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {step === 'type' && (
          <div className="grid grid-cols-2 gap-3">
            {WIDGET_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => handleSelectType(type)}
                className="flex flex-col gap-1.5 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left transition-all duration-200 hover:border-nutrition/30 hover:bg-nutrition/5 active:scale-[0.97]"
              >
                <span className="text-[11px] font-black uppercase tracking-widest text-textPrimary">
                  {WIDGET_TYPE_LABELS[type]}
                </span>
                <span className="text-[10px] leading-relaxed text-textMuted">
                  {WIDGET_TYPE_DESCRIPTIONS[type]}
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 'config' && selectedType && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Tracker selector — only for field types */}
            {isFieldType && (
              <>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-textMuted" htmlFor="tracker-select">
                    Tracker
                  </label>
                  <select
                    id="tracker-select"
                    value={selectedTrackerId}
                    onChange={e => {
                      setSelectedTrackerId(e.target.value)
                      setSelectedFieldId('')
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-textPrimary backdrop-blur-sm transition-colors focus:border-nutrition/40 focus:outline-none"
                  >
                    <option value="">Select a tracker…</option>
                    {trackers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {selectedTracker && (
                  <div>
                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-textMuted" htmlFor="field-select">
                      Field
                    </label>
                    <select
                      id="field-select"
                      value={selectedFieldId}
                      onChange={e => setSelectedFieldId(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-textPrimary backdrop-blur-sm transition-colors focus:border-nutrition/40 focus:outline-none"
                    >
                      <option value="">Select a field…</option>
                      {selectedTracker.schema.map(f => (
                        <option key={f.fieldId} value={f.fieldId}>
                          {f.label}{f.unit ? ` (${f.unit})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Days input — not shown for field_latest */}
            {selectedType !== 'field_latest' && selectedType !== 'correlator' && (
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-textMuted" htmlFor="days-input">
                  Days window
                </label>
                <input
                  id="days-input"
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={e => setDays(Math.max(1, parseInt(e.target.value, 10) || DEFAULT_DAYS))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-textPrimary backdrop-blur-sm transition-colors focus:border-nutrition/40 focus:outline-none"
                />
              </div>
            )}

            {/* Label */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-textMuted" htmlFor="label-input">
                Label <span className="font-medium normal-case tracking-normal text-textMuted/50">(optional)</span>
              </label>
              <input
                id="label-input"
                type="text"
                maxLength={MAX_LABEL_LENGTH}
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder={WIDGET_TYPE_LABELS[selectedType]}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-textPrimary placeholder-textMuted/30 backdrop-blur-sm transition-colors focus:border-nutrition/40 focus:outline-none"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[11px] font-black uppercase tracking-widest text-textMuted transition-all duration-200 hover:border-white/20 hover:text-textPrimary"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl border border-nutrition/30 bg-nutrition/15 py-2.5 text-[11px] font-black uppercase tracking-widest text-nutrition transition-all duration-200 hover:border-nutrition/50 hover:bg-nutrition/25 hover:shadow-[0_0_16px_rgba(16,185,129,0.15)] disabled:opacity-40"
              >
                {submitting ? 'Adding…' : 'Add Widget'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
