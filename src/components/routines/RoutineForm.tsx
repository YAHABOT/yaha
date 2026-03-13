'use client' // Needed: form state, step builder interactions, router navigation

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import type { Routine, CreateRoutineInput, RoutineStep, RoutineType } from '@/types/routine'
import type { Tracker } from '@/types/tracker'

const MAX_NAME_LENGTH = 50
const MAX_TRIGGER_LENGTH = 100

const TYPE_OPTIONS: { value: RoutineType; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'day_start', label: 'Day Start' },
  { value: 'day_end', label: 'Day End' },
]

type Props = {
  trackers: Tracker[]
  initialValues?: Routine
  onSubmit: (input: CreateRoutineInput) => Promise<{ error?: string } | void>
}

type StepDraft = {
  trackerId: string
  selectedFieldIds: Set<string>
}

function buildStepsFromDrafts(drafts: StepDraft[], trackers: Tracker[]): RoutineStep[] {
  return drafts
    .map((draft) => {
      const tracker = trackers.find((t) => t.id === draft.trackerId)
      if (!tracker) return null
      return {
        trackerId: tracker.id,
        trackerName: tracker.name,
        trackerColor: tracker.color,
        targetFields: Array.from(draft.selectedFieldIds),
      } satisfies RoutineStep
    })
    .filter((s): s is RoutineStep => s !== null)
}

function initDraftsFromRoutine(routine: Routine): StepDraft[] {
  return routine.steps.map((step) => ({
    trackerId: step.trackerId,
    selectedFieldIds: new Set(step.targetFields),
  }))
}

export function RoutineForm({ trackers, initialValues, onSubmit }: Props) {
  const router = useRouter()
  const isEdit = initialValues !== undefined

  const [name, setName] = useState<string>(initialValues?.name ?? '')
  const [triggerPhrase, setTriggerPhrase] = useState<string>(
    initialValues?.trigger_phrase ?? ''
  )
  const [type, setType] = useState<RoutineType>(initialValues?.type ?? 'standard')
  const [stepDrafts, setStepDrafts] = useState<StepDraft[]>(
    isEdit ? initDraftsFromRoutine(initialValues) : []
  )
  const [showTrackerPicker, setShowTrackerPicker] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)

  function handleAddStep(trackerId: string): void {
    setStepDrafts((prev) => [...prev, { trackerId, selectedFieldIds: new Set() }])
    setShowTrackerPicker(false)
  }

  function handleRemoveStep(index: number): void {
    setStepDrafts((prev) => prev.filter((_, i) => i !== index))
  }

  function handleFieldToggle(stepIndex: number, fieldId: string): void {
    setStepDrafts((prev) =>
      prev.map((draft, i) => {
        if (i !== stepIndex) return draft
        const next = new Set(draft.selectedFieldIds)
        if (next.has(fieldId)) {
          next.delete(fieldId)
        } else {
          next.add(fieldId)
        }
        return { ...draft, selectedFieldIds: next }
      })
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const steps = buildStepsFromDrafts(stepDrafts, trackers)
      const result = await onSubmit({ name: name.trim(), trigger_phrase: triggerPhrase.trim(), type, steps })
      if (result && result.error) {
        setError(result.error)
        return
      }
      router.push('/routines')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="routine-name" className="mb-1 block text-sm text-textMuted">
          Name
        </label>
        <input
          id="routine-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Morning Check-In"
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-textPrimary placeholder-textMuted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Trigger phrase */}
      <div>
        <label htmlFor="routine-trigger" className="mb-1 block text-sm text-textMuted">
          Trigger Phrase
        </label>
        <input
          id="routine-trigger"
          type="text"
          value={triggerPhrase}
          onChange={(e) => setTriggerPhrase(e.target.value)}
          required
          maxLength={MAX_TRIGGER_LENGTH}
          placeholder="e.g. start day, morning"
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-textPrimary placeholder-textMuted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-xs text-textMuted">
          Detected in chat messages to start this routine automatically.
        </p>
      </div>

      {/* Type */}
      <div>
        <label htmlFor="routine-type" className="mb-1 block text-sm text-textMuted">
          Type
        </label>
        <select
          id="routine-type"
          value={type}
          onChange={(e) => setType(e.target.value as RoutineType)}
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-textPrimary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Step builder */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-textMuted">
            Steps ({stepDrafts.length})
          </span>
          <button
            type="button"
            onClick={() => setShowTrackerPicker((v) => !v)}
            disabled={trackers.length === 0}
            className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2.5 text-xs font-medium text-textPrimary transition-colors hover:bg-black/[0.06] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Step
          </button>
        </div>

        {/* Tracker picker dropdown */}
        {showTrackerPicker && (
          <div className="mb-3 rounded-lg border border-border bg-surfaceHighlight p-2">
            {trackers.length === 0 ? (
              <p className="px-2 py-1 text-sm text-textMuted">No trackers available.</p>
            ) : (
              <ul className="space-y-1">
                {trackers.map((tracker) => (
                  <li key={tracker.id}>
                    <button
                      type="button"
                      onClick={() => handleAddStep(tracker.id)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-textPrimary transition-colors hover:bg-black/[0.04]"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: tracker.color }}
                      />
                      {tracker.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Step list */}
        {stepDrafts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-textMuted">
            No steps yet. Add steps to define what trackers this routine covers.
          </p>
        ) : (
          <ol className="space-y-3">
            {stepDrafts.map((draft, stepIndex) => {
              const tracker = trackers.find((t) => t.id === draft.trackerId)
              if (!tracker) return null
              const selectedCount = draft.selectedFieldIds.size

              return (
                <li
                  key={`${draft.trackerId}-${stepIndex}`}
                  className="rounded-lg border border-border bg-surfaceHighlight p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: tracker.color }}
                      />
                      <span className="text-sm font-medium text-textPrimary">
                        {tracker.name}
                      </span>
                      <span className="text-xs text-textMuted">
                        {selectedCount} {selectedCount === 1 ? 'field' : 'fields'} selected
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(stepIndex)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-textMuted transition-colors hover:text-red-400"
                      aria-label={`Remove step ${stepIndex + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {tracker.schema.length === 0 ? (
                    <p className="text-xs text-textMuted">
                      This tracker has no fields defined.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {tracker.schema.map((field) => {
                        const checked = draft.selectedFieldIds.has(field.fieldId)
                        const checkboxId = `step-${stepIndex}-field-${field.fieldId}`
                        return (
                          <label
                            key={field.fieldId}
                            htmlFor={checkboxId}
                            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-black/[0.04]"
                          >
                            <input
                              id={checkboxId}
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleFieldToggle(stepIndex, field.fieldId)}
                              className="h-4 w-4 rounded border-border accent-nutrition"
                            />
                            <span className="text-sm text-textPrimary">{field.label}</span>
                            {field.unit && (
                              <span className="text-xs text-textMuted">({field.unit})</span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {/* Submit */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {submitting ? (isEdit ? 'Saving...' : 'Creating...') : isEdit ? 'Save Changes' : 'Create Routine'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/routines')}
          className="min-h-[44px] rounded-lg bg-surfaceHighlight px-6 py-2.5 text-sm font-medium text-textMuted transition-colors hover:bg-black/[0.06] hover:text-textPrimary"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
