import Link from 'next/link'
import { TrendingUp, FlaskConical } from 'lucide-react'
import { getTrackers } from '@/lib/db/trackers'
import { getCorrelations } from '@/lib/db/correlations'
import { getTrackerLogSummaries } from '@/lib/db/logs'
import type { Tracker } from '@/types/tracker'
import type { Correlation } from '@/types/correlator'
import type { TrackerLogSummary } from '@/lib/db/logs'

function formatRelativeDate(iso: string | null): string {
  if (!iso) return 'No entries'
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

type TrackerRowProps = {
  tracker: Tracker
  summary: TrackerLogSummary | undefined
}

function TrackerRow({ tracker, summary }: TrackerRowProps): React.ReactElement {
  const count = summary?.count ?? 0
  const lastLogged = summary?.last_logged_at ?? null

  return (
    <Link
      href={`/trackers/${tracker.id}`}
      className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-black/10"
    >
      <div className="flex items-center gap-3">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: tracker.color }}
        />
        <div>
          <p className="text-sm font-medium text-textPrimary">{tracker.name}</p>
          <p className="text-xs text-textMuted">{tracker.type}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-textPrimary">
          {count} {count === 1 ? 'entry' : 'entries'}
        </p>
        <p className="text-xs text-textMuted">{formatRelativeDate(lastLogged)}</p>
      </div>
    </Link>
  )
}

type CorrelationRowProps = {
  correlation: Correlation
}

function CorrelationRow({ correlation }: CorrelationRowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mood/10">
          <FlaskConical className="h-4 w-4 text-mood" />
        </div>
        <div>
          <p className="text-sm font-medium text-textPrimary">{correlation.name}</p>
          <p className="text-xs text-textMuted">{correlation.unit || 'no unit'}</p>
        </div>
      </div>
    </div>
  )
}

export default async function AnalyticsPage(): Promise<React.ReactElement> {
  let trackers: Tracker[] = []
  let correlations: Correlation[] = []
  let summaries: TrackerLogSummary[] = []

  try {
    ;[trackers, correlations, summaries] = await Promise.all([
      getTrackers(),
      getCorrelations(),
      getTrackerLogSummaries(),
    ])
  } catch {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-center text-textMuted">
          Failed to load analytics. Please refresh the page.
        </p>
      </div>
    )
  }

  const summaryMap = new Map(summaries.map((s) => [s.tracker_id, s]))
  const totalEntries = summaries.reduce((acc, s) => acc + s.count, 0)
  const activeTrackers = trackers.filter((t) => summaryMap.has(t.id))
  const inactiveTrackers = trackers.filter((t) => !summaryMap.has(t.id))

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-nutrition" />
          <h1 className="text-2xl font-bold text-textPrimary">Analytics</h1>
        </div>
        <p className="mt-1 text-sm text-textMuted">
          {totalEntries} total {totalEntries === 1 ? 'entry' : 'entries'} across{' '}
          {trackers.length} {trackers.length === 1 ? 'tracker' : 'trackers'}
        </p>
      </div>

      {/* Trackers */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-textMuted">
          Trackers
        </h2>

        {trackers.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-6 text-center">
            <p className="text-sm text-textMuted">No trackers yet.</p>
            <Link
              href="/trackers/new"
              className="mt-2 inline-block text-sm font-medium text-nutrition hover:underline"
            >
              Create your first tracker
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {activeTrackers.map((tracker) => (
              <TrackerRow
                key={tracker.id}
                tracker={tracker}
                summary={summaryMap.get(tracker.id)}
              />
            ))}
            {inactiveTrackers.map((tracker) => (
              <TrackerRow
                key={tracker.id}
                tracker={tracker}
                summary={undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* Correlations */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-textMuted">
            Correlations
          </h2>
          <Link
            href="/journal"
            className="text-xs font-medium text-nutrition hover:underline"
          >
            View journal
          </Link>
        </div>

        {correlations.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-6 text-center">
            <p className="text-sm text-textMuted">No formula metrics yet.</p>
            <p className="mt-1 text-xs text-textMuted">
              Add correlations via the daily journal to compute derived metrics.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {correlations.map((c) => (
              <CorrelationRow key={c.id} correlation={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
