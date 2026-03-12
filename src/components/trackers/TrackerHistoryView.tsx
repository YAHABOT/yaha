import Link from 'next/link'
import { ArrowLeft, ClipboardList, Pencil } from 'lucide-react'
import type { Tracker } from '@/types/tracker'
import type { TrackerLog } from '@/types/log'
import { LogEntryCard } from '@/components/trackers/LogEntryCard'

type Props = {
  tracker: Tracker
  logs: TrackerLog[]
}

type GroupedLogs = {
  heading: string
  date: string
  entries: TrackerLog[]
}

function formatDateHeading(isoDate: string): string {
  const date = new Date(isoDate)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const sameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  }).format(date)
}

function groupLogsByDate(logs: TrackerLog[]): GroupedLogs[] {
  const groups = new Map<string, TrackerLog[]>()

  for (const log of logs) {
    const date = log.logged_at.slice(0, 10) // YYYY-MM-DD
    const existing = groups.get(date)
    if (existing) {
      existing.push(log)
    } else {
      groups.set(date, [log])
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
    .map(([date, entries]) => ({
      heading: formatDateHeading(entries[0].logged_at),
      date,
      entries: entries.sort(
        (a, b) =>
          new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
      ),
    }))
}

export function TrackerHistoryView({ tracker, logs }: Props): React.ReactElement {
  const groups = groupLogsByDate(logs)

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/trackers"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-textMuted transition-colors hover:text-textPrimary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Trackers
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: tracker.color }}
            />
            <h1 className="text-2xl font-bold text-textPrimary">{tracker.name}</h1>
            <span className="rounded-md bg-surfaceHighlight px-2 py-0.5 text-xs font-medium text-textMuted">
              {tracker.type}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/trackers/${tracker.id}/log`}
              className="flex items-center gap-1.5 rounded-lg bg-surfaceHighlight px-3 py-1.5 text-sm font-medium text-textPrimary transition-colors hover:bg-white/10"
            >
              <ClipboardList className="h-4 w-4" />
              Log
            </Link>
            <Link
              href={`/trackers/${tracker.id}/schema`}
              className="flex items-center gap-1.5 rounded-lg bg-surfaceHighlight px-3 py-1.5 text-sm font-medium text-textMuted transition-colors hover:bg-white/10"
            >
              <Pencil className="h-3.5 w-3.5" />
              Schema
            </Link>
          </div>
        </div>

        <p className="mt-1 text-sm text-textMuted">
          {tracker.schema.length} {tracker.schema.length === 1 ? 'field' : 'fields'} ·{' '}
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      {/* Log History */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-textMuted">No entries yet.</p>
          <Link
            href={`/trackers/${tracker.id}/log`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-nutrition hover:underline"
          >
            <ClipboardList className="h-4 w-4" />
            Log your first entry
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.date}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-textMuted">
                {group.heading}
              </h2>
              <div className="space-y-2">
                {group.entries.map((log) => (
                  <LogEntryCard
                    key={log.id}
                    log={log}
                    schema={tracker.schema}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
