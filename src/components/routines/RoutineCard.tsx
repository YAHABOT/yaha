import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { deleteRoutineAction } from '@/app/actions/routines'
import type { Routine, RoutineType } from '@/types/routine'

const TYPE_LABELS: Record<RoutineType, string> = {
  standard: 'Standard',
  day_start: 'Day Start',
  day_end: 'Day End',
}

type Props = {
  routine: Routine
}

export function RoutineCard({ routine }: Props) {
  const stepCount = routine.steps.length

  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-white/10">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-textPrimary">{routine.name}</h3>
        <span className="rounded-md bg-surfaceHighlight px-2 py-0.5 text-xs font-medium text-textMuted">
          {TYPE_LABELS[routine.type]}
        </span>
      </div>

      <p className="mb-1 text-sm text-textMuted">
        Trigger:{' '}
        <span className="font-mono text-xs text-textPrimary">
          &quot;{routine.trigger_phrase}&quot;
        </span>
      </p>
      <p className="mb-4 text-xs text-textMuted">
        {stepCount} {stepCount === 1 ? 'step' : 'steps'}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/routines/${routine.id}/edit`}
          className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-surfaceHighlight px-3 py-2.5 text-xs font-medium text-textPrimary transition-colors hover:bg-white/10"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Link>
        <form action={deleteRoutineAction.bind(null, routine.id)}>
          <button
            type="submit"
            className="min-h-[44px] rounded-lg bg-surfaceHighlight px-3 py-2.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            Delete
          </button>
        </form>
      </div>
    </div>
  )
}
