import Link from 'next/link'
import { TrendingUp, FlaskConical } from 'lucide-react'
import { getTrackersBasic } from '@/lib/db/trackers'
import { getCorrelations } from '@/lib/db/correlations'
import { getTrackerLogSummaries } from '@/lib/db/logs'
import { createServerClient } from '@/lib/supabase/server'
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
      className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md px-5 py-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] group"
    >
      <div className="flex items-center gap-4">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_8px_currentColor]"
          style={{ backgroundColor: tracker.color, color: tracker.color }}
        />
        <div>
          <p className="text-sm font-bold text-textPrimary group-hover:text-white transition-colors duration-300">{tracker.name}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-textMuted opacity-50 mt-0.5">{tracker.type}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-textPrimary">
          {count} <span className="text-textMuted font-medium">{count === 1 ? 'entry' : 'entries'}</span>
        </p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-textMuted opacity-50 mt-0.5">{formatRelativeDate(lastLogged)}</p>
      </div>
    </Link>
  )
}

type CorrelationRowProps = {
  correlation: Correlation
}

function CorrelationRow({ correlation }: CorrelationRowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md px-5 py-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]">
      <div className="flex items-center gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mood/10 shadow-[0_0_12px_rgba(168,85,247,0.15)]">
          <FlaskConical className="h-4 w-4 text-mood" />
        </div>
        <div>
          <p className="text-sm font-bold text-textPrimary">{correlation.name}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-textMuted opacity-50 mt-0.5">{correlation.unit || 'no unit'}</p>
        </div>
      </div>
    </div>
  )
}

export default async function AnalyticsPage(): Promise<React.ReactElement> {
  const supabase = await createServerClient()
  let trackers: Tracker[] = []
  let correlations: Correlation[] = []
  let summaries: TrackerLogSummary[] = []

  try {
    ;[trackers, correlations, summaries] = await Promise.all([
      getTrackersBasic(supabase),
      getCorrelations(supabase),
      getTrackerLogSummaries(supabase),
    ])
  } catch {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md p-10 text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-textMuted opacity-30 mb-3" />
          <p className="text-sm font-bold text-textMuted">
            Failed to load analytics. Please refresh the page.
          </p>
        </div>
      </div>
    )
  }

  const summaryMap = new Map(summaries.map((s) => [s.tracker_id, s]))
  const totalEntries = summaries.reduce((acc, s) => acc + s.count, 0)
  const activeTrackers = trackers.filter((t) => summaryMap.has(t.id))
  const inactiveTrackers = trackers.filter((t) => !summaryMap.has(t.id))

  return (
    <div className="mx-auto max-w-2xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-nutrition/10 shadow-[0_0_16px_rgba(16,185,129,0.2)]">
            <TrendingUp className="h-4 w-4 text-nutrition" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-textPrimary">Analytics</h1>
        </div>
        <p className="text-sm font-medium text-textMuted opacity-60 pl-12">
          {totalEntries} total {totalEntries === 1 ? 'entry' : 'entries'} across{' '}
          {trackers.length} {trackers.length === 1 ? 'tracker' : 'trackers'}
        </p>
      </div>

      {/* Trackers */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-50">
            Trackers
          </h2>
          <div className="flex-1 border-t border-white/5" />
        </div>

        {trackers.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md p-10 text-center space-y-3">
            <TrendingUp className="mx-auto h-8 w-8 text-textMuted opacity-20" />
            <p className="text-sm font-bold text-textMuted">No trackers yet.</p>
            <Link
              href="/trackers/new"
              className="inline-block text-xs font-black uppercase tracking-widest text-nutrition hover:text-nutrition/80 transition-colors duration-300"
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
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-50">
              Correlations
            </h2>
            <div className="flex-1 border-t border-white/5" />
          </div>
          <Link
            href="/journal"
            className="ml-4 text-[10px] font-black uppercase tracking-widest text-nutrition hover:text-nutrition/80 transition-colors duration-300"
          >
            View journal
          </Link>
        </div>

        {correlations.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md p-10 text-center space-y-2">
            <FlaskConical className="mx-auto h-8 w-8 text-mood opacity-20" />
            <p className="text-sm font-bold text-textMuted">No formula metrics yet.</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-textMuted opacity-40">
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
