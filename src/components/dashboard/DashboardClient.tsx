'use client'
// needed for edit mode toggle state + add widget modal state

import { useState, useTransition } from 'react'
import { Plus, Pencil, Check } from 'lucide-react'
import { RoutineBanner } from '@/components/dashboard/RoutineBanner'
import { WidgetCard } from '@/components/dashboard/WidgetCard'
import { AddWidgetModal } from '@/components/dashboard/AddWidgetModal'
import { deleteWidgetAction } from '@/app/actions/dashboard'
import type { Widget, WidgetValue } from '@/types/widget'
import type { Tracker } from '@/types/tracker'
import type { Routine } from '@/types/routine'

type Props = {
  widgets: Widget[]
  widgetValues: WidgetValue[]
  trackers: Tracker[]
  dayStartRoutine: Routine | null
  dayEndRoutine: Routine | null
}

export function DashboardClient({
  widgets,
  widgetValues,
  trackers,
  dayStartRoutine,
  dayEndRoutine,
}: Props): React.ReactElement {
  const [editMode, setEditMode] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isPending, startTransition] = useTransition()

  const hasWidgets = widgets.length > 0

  function handleDelete(id: string): void {
    startTransition(async () => {
      await deleteWidgetAction(id)
    })
  }

  function handleCloseModal(): void {
    setShowAddModal(false)
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Routine banners */}
      {dayStartRoutine && (
        <RoutineBanner routine={dayStartRoutine} type="day_start" />
      )}
      {dayEndRoutine && (
        <RoutineBanner routine={dayEndRoutine} type="day_end" />
      )}

      {/* Dashboard header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-textPrimary">Dashboard</h1>
        <div className="flex items-center gap-2">
          {(editMode || hasWidgets) && (
            <button
              type="button"
              onClick={() => setEditMode(prev => !prev)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-textMuted transition-colors hover:border-black/10 hover:text-textPrimary"
            >
              {editMode ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Done
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </>
              )}
            </button>
          )}
          {(editMode || !hasWidgets) && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-surfaceHighlight px-3 py-1.5 text-xs font-medium text-textPrimary transition-colors hover:bg-black/[0.06]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Widget
            </button>
          )}
        </div>
      </div>

      {/* Widget grid or empty state */}
      {!hasWidgets ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="mb-4 text-sm text-textMuted">
            No widgets yet. Add your first widget.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-xl bg-surfaceHighlight px-4 py-2.5 text-sm font-medium text-textPrimary transition-colors hover:bg-black/[0.06]"
          >
            <Plus className="h-4 w-4" />
            Add Widget
          </button>
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

      {/* Pending overlay (subtle) */}
      {isPending && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-surfaceHighlight px-3 py-1.5 text-xs text-textMuted">
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
