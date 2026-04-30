'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Save, Shield, Terminal, Target, Check } from 'lucide-react'
import type { Routine, RoutineStep, RoutineType } from '@/types/routine'
import type { Tracker } from '@/types/tracker'
import { createRoutineAction, updateRoutineAction } from '@/app/actions/routines'

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

export function RoutineForm({ trackers, initialValues }: Props) {
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
    if (submitting) return
    setError(null)
    setSubmitting(true)

    try {
      const steps = buildStepsFromDrafts(stepDrafts, trackers)
      const input = { name: name.trim(), trigger_phrase: triggerPhrase.trim(), type, steps }

      let result
      if (initialValues?.id) {
        result = await updateRoutineAction(initialValues.id, input)
      } else {
        result = await createRoutineAction(input)
      }

      if (result && result.error) {
        setError(result.error)
        setSubmitting(false)
        return
      }
      router.push('/routines')
      // Do NOT reset submitting — let component unmount to prevent double-submit
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100 italic">
          !! {error}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {/* Name */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-40 block ml-1">Protocol Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={MAX_NAME_LENGTH}
            placeholder="e.g. Morning Check-In"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-sm font-bold text-textPrimary placeholder-textMuted/20 focus:border-nutrition/40 focus:outline-none focus:ring-1 focus:ring-nutrition/10 transition-all duration-200"
          />
        </div>

        {/* Type */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-40 block ml-1">Sequence Type</label>
          <div className="relative">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as RoutineType)}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-sm font-bold text-textPrimary focus:border-nutrition/40 focus:outline-none appearance-none cursor-pointer transition-all duration-200"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0A0A0A] font-sans">
                  {opt.label}
                </option>
              ))}
            </select>
            <Shield className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-textMuted opacity-30 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Trigger phrase */}
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-40 block ml-1">Execution Trigger</label>
        <div className="relative">
          <input
            type="text"
            value={triggerPhrase}
            onChange={(e) => setTriggerPhrase(e.target.value)}
            required
            maxLength={MAX_TRIGGER_LENGTH}
            placeholder="e.g. start day, morning"
            className="w-full rounded-2xl border border-white/10 bg-black/40 pl-12 pr-5 py-4 text-xs font-black uppercase tracking-widest text-textPrimary placeholder-textMuted/20 focus:border-nutrition/40 focus:outline-none transition-all duration-200"
          />
          <Terminal className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-textMuted opacity-30" />
        </div>
        <p className="text-[10px] text-textMuted opacity-40 px-2 italic font-medium">
          Detection of this phrase in chat will initialize the sequence.
        </p>
      </div>

      {/* Step builder */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-textMuted opacity-30">
            Operation Steps ({stepDrafts.length})
          </h3>
          {/* FIX-9: Deploy Protocol moved here as secondary outlined button */}
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-xl border border-nutrition/30 bg-nutrition/[0.06] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-nutrition/80 transition-all hover:bg-nutrition/20 hover:text-nutrition active:scale-95 disabled:opacity-30"
          >
            <Save className="h-3.5 w-3.5 stroke-[3px]" />
            {submitting ? 'Syncing...' : isEdit ? 'Update Protocol' : 'Deploy Protocol'}
          </button>
        </div>

        {/* Tracker picker dropdown */}
        {showTrackerPicker && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-in slide-in-from-top-2 duration-300">
            {trackers.map((tracker) => (
              <button
                key={tracker.id}
                type="button"
                onClick={() => handleAddStep(tracker.id)}
                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/40 p-4 text-left transition-all hover:border-white/20 hover:bg-black/60 active:scale-95 group"
              >
                <div 
                  className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: `${tracker.color}15`, border: `1px solid ${tracker.color}30` }}
                >
                  <Target size={14} style={{ color: tracker.color }} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-textPrimary break-words">{tracker.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step list */}
        {stepDrafts.length === 0 ? (
          <div className="rounded-[32px] border border-dashed border-white/10 p-12 text-center text-sm font-bold text-textMuted bg-white/[0.01]">
            No operations defined.
          </div>
        ) : (
          <div className="space-y-4">
            {stepDrafts.map((draft, stepIndex) => {
              const tracker = trackers.find((t) => t.id === draft.trackerId)
              if (!tracker) return null
              const selectedCount = draft.selectedFieldIds.size

              return (
                <div
                  key={`${draft.trackerId}-${stepIndex}`}
                  className="rounded-[32px] border border-white/5 bg-white/[0.02] p-5 md:p-8 space-y-6 relative group animate-in slide-in-from-bottom-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div
                        className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${tracker.color}15`, border: `1px solid ${tracker.color}30` }}
                      >
                         <Target size={18} style={{ color: tracker.color }} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black uppercase tracking-widest text-textPrimary truncate">{tracker.name}</h4>
                        <p className="text-[10px] font-bold text-textMuted opacity-40">
                          {selectedCount} Metrics Selected
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(stepIndex)}
                      className="p-3 text-textMuted opacity-20 hover:opacity-100 hover:text-red-500 transition-all active:scale-90"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {tracker.schema.map((field) => {
                      const checked = draft.selectedFieldIds.has(field.fieldId)
                      return (
                        <button
                          key={field.fieldId}
                          type="button"
                          onClick={() => handleFieldToggle(stepIndex, field.fieldId)}
                          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all active:scale-95 ${
                            checked
                              ? 'border-nutrition/30 bg-nutrition/10 text-nutrition'
                              : 'border-white/5 bg-black/40 text-textMuted hover:border-white/10 hover:text-textPrimary'
                          }`}
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest shrink-0">{field.label}</span>
                          <div className={`h-4 w-4 shrink-0 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${checked ? 'border-nutrition bg-nutrition' : 'border-white/10 bg-transparent'}`}>
                            {checked && <Check size={10} className="text-[#050505] stroke-[4px]" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer — FIX-9: Add Tracker is now the primary CTA at the bottom */}
      <div className="flex items-center justify-between gap-6 pt-10 border-t border-white/5">
        <button
          type="button"
          onClick={() => router.push('/routines')}
          className="text-xs font-black uppercase tracking-widest text-textMuted transition-colors hover:text-textPrimary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => setShowTrackerPicker((v) => !v)}
          disabled={trackers.length === 0}
          className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-nutrition px-12 py-4 text-sm font-black uppercase tracking-widest text-[#050505] transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-xl shadow-nutrition/30 disabled:opacity-50 transition-all"
        >
          <Plus className="h-5 w-5 stroke-[3px]" />
          Add Tracker
        </button>
      </div>
    </form>
  )
}
