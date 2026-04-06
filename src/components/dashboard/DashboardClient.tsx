'use client'
// needed for edit mode toggle state + add widget modal state

import { useState, useTransition } from 'react'
import { Plus, Pencil, Check, RotateCcw, FlaskConical } from 'lucide-react'
import { RoutineBanner } from '@/components/dashboard/RoutineBanner'
import { WidgetCard } from '@/components/dashboard/WidgetCard'
import { AddWidgetModal } from '@/components/dashboard/AddWidgetModal'
import { deleteWidgetAction } from '@/app/actions/dashboard'
import { resetDayStateAction } from '@/app/actions/day-state'
import type { Widget, WidgetValue } from '@/types/widget'
import type { Tracker } from '@/types/tracker'
import type { Routine } from '@/types/routine'
import type { UserDayState } from '@/lib/db/day-state'

type Props = {
  widgets: Widget[]
  widgetValues: WidgetValue[]
  trackers: Tracker[]
  dayStartRoutine: Routine | null
  dayEndRoutine: Routine | null
  dayState: UserDayState | null
}

export function DashboardClient({
  widgets,
  widgetValues,
  trackers,
  dayStartRoutine,
  dayEndRoutine,
  dayState,
}: Props): React.ReactElement {
  const [editMode, setEditMode] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [devMode, setDevMode] = useState(false)
  const [isPending, startTransition] = useTransition()

  const hasWidgets = widgets.length > 0

  // Derive explicit session state from dayState prop.
  // dayState comes from getActiveDayState() which only returns rows with
  // day_started_at IS NOT NULL AND day_ended_at IS NULL.
  // So: dayState !== null  ⟺  ACTIVE state.
  //     dayState === null   ⟺  NEUTRAL state (never started, or already ended).
  // ENDED rows are never returned by getActiveDayState(), so ENDED === NEUTRAL for display.
  const sessionIsActive = dayState !== null
  const sessionIsNeutral = dayState === null

  function handleDelete(id: string): void {
    startTransition(async () => {
      await deleteWidgetAction(id)
    })
  }

  function handleResetDayState(): void {
    startTransition(async () => {
      await resetDayStateAction()
    })
  }

  function handleCloseModal(): void {
    setShowAddModal(false)
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      {/* Routine banners — driven by explicit state constants (single source of truth).
          Start Day: show only in NEUTRAL state (no open session).
          End Day:   show only in ACTIVE state (session open, not yet ended). */}
      {dayStartRoutine && sessionIsNeutral && (
        <RoutineBanner routine={dayStartRoutine} type="day_start" />
      )}
      {dayEndRoutine && sessionIsActive && (
        <RoutineBanner routine={dayEndRoutine} type="day_end" />
      )}

      {/* Dev Mode strip — force-reset routine state for testing */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDevMode(prev => !prev)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] border transition-all duration-300 ${
            devMode
              ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'
              : 'border-white/5 bg-transparent text-white/10 hover:text-white/20 hover:border-white/10'
          }`}
          title="Toggle Developer Mode"
        >
          <FlaskConical className="h-2.5 w-2.5" />
          Dev
        </button>

        {devMode && (
          <>
            <button
              type="button"
              onClick={handleResetDayState}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-400 transition-all duration-300 hover:border-amber-500/50 hover:bg-amber-500/20 disabled:opacity-40"
              title="Clear day_started_at — makes Morning banner reappear"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Reset Morning
            </button>
            <button
              type="button"
              onClick={handleResetDayState}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 transition-all duration-300 hover:border-indigo-500/50 hover:bg-indigo-500/20 disabled:opacity-40"
              title="Clear day_ended_at — makes End Day banner reappear"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Reset End Day
            </button>
          </>
        )}
      </div>

      {/* Dashboard header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-textPrimary">Dashboard</h1>
          <p className="mt-0.5 text-[11px] font-medium text-textMuted">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          {(editMode || hasWidgets) && (
            <button
              type="button"
              onClick={() => setEditMode(prev => !prev)}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-textMuted backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:text-textPrimary"
            >
              {editMode ? (
                <>
                  <Check className="h-3 w-3" />
                  Done
                </>
              ) : (
                <>
                  <Pencil className="h-3 w-3" />
                  Edit
                </>
              )}
            </button>
          )}
          {(editMode || !hasWidgets) && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-full border border-nutrition/30 bg-nutrition/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-nutrition transition-all duration-300 hover:border-nutrition/50 hover:bg-nutrition/20 hover:shadow-[0_0_16px_rgba(16,185,129,0.15)]"
            >
              <Plus className="h-3 w-3" />
              Add Widget
            </button>
          )}
        </div>
      </div>

      {/* Widget grid or empty state */}
      {!hasWidgets ? (
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] py-20 text-center backdrop-blur-sm">
          {/* Subtle gradient background */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-nutrition/[0.03] via-transparent to-transparent" />
          <div className="relative flex flex-col items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-nutrition/20 bg-nutrition/10">
              <Plus className="h-7 w-7 text-nutrition" />
            </div>
            <div>
              <p className="text-sm font-bold text-textPrimary">No widgets yet</p>
              <p className="mt-1 text-xs text-textMuted">Pin your most important health metrics here</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-2xl border border-nutrition/30 bg-nutrition/10 px-5 py-2.5 text-sm font-bold text-nutrition transition-all duration-300 hover:border-nutrition/50 hover:bg-nutrition/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
            >
              <Plus className="h-4 w-4" />
              Add your first widget
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {widgets.map((widget, index) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              value={widgetValues[index] ?? { value: null, label: widget.label }}
              editMode={editMode}
              onDelete={() => handleDelete(widget.id)}
            />
          ))}
        </div>
      )}

      {/* Pending overlay (glass toast) */}
      {isPending && (
        <div className="fixed bottom-4 right-4 z-50 rounded-2xl border border-white/10 bg-surfaceHighlight/90 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-textMuted backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          Saving…
        </div>
      )}

      {/* Add widget modal */}
      {showAddModal && (
        <AddWidgetModal
          trackers={trackers}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}
