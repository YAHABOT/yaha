import type { Tracker } from '@/types/tracker'
import type { TrackerLog } from '@/types/log'
import { DateNav } from '@/components/journal/DateNav'
import { TrackerDayGroup } from '@/components/journal/TrackerDayGroup'

type Props = {
  date: string
  trackers: Tracker[]
  logs: TrackerLog[]
}

type GroupedLogs = Map<string, TrackerLog[]>

function groupLogsByTracker(logs: TrackerLog[]): GroupedLogs {
  const grouped: GroupedLogs = new Map()
  for (const log of logs) {
    const existing = grouped.get(log.tracker_id) ?? []
    grouped.set(log.tracker_id, [...existing, log])
  }
  return grouped
}

export function DayView({ date, trackers, logs }: Props): React.ReactElement {
  const grouped = groupLogsByTracker(logs)

  // Only include trackers that have at least one log for this day
  const trackersWithLogs = trackers.filter((t) => grouped.has(t.id))

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-0">
      <DateNav currentDate={date} />

      {trackersWithLogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-sm text-textMuted">No logs for this day.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {trackersWithLogs.map((tracker) => {
            const trackerLogs = grouped.get(tracker.id) ?? []
            return (
              <TrackerDayGroup
                key={tracker.id}
                tracker={tracker}
                logs={trackerLogs}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
