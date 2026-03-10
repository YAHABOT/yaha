import Link from 'next/link'
import { Pencil, ClipboardList } from 'lucide-react'
import type { Tracker } from '@/types/tracker'

type Props = {
  tracker: Tracker
}

export function TrackerCard({ tracker }: Props): React.ReactElement {
  const fieldCount = tracker.schema.length

  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-white/10">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: tracker.color }}
          data-testid="tracker-color-dot"
        />
        <h3 className="text-base font-semibold text-textPrimary">
          {tracker.name}
        </h3>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-md bg-surfaceHighlight px-2 py-0.5 text-xs font-medium text-textMuted">
          {tracker.type}
        </span>
        <span className="text-xs text-textMuted">
          {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={`/trackers/${tracker.id}/log`}
          className="flex items-center gap-1.5 rounded-lg bg-surfaceHighlight px-3 py-1.5 text-xs font-medium text-textPrimary transition-colors hover:bg-white/10"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Log
        </Link>
        <Link
          href={`/trackers/${tracker.id}/schema`}
          className="flex items-center gap-1.5 rounded-lg bg-surfaceHighlight px-3 py-1.5 text-xs font-medium text-textPrimary transition-colors hover:bg-white/10"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit Schema
        </Link>
      </div>
    </div>
  )
}
