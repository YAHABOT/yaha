'use client'

import Link from 'next/link'
import { ArrowLeft, ClipboardList, TrendingUp } from 'lucide-react'
import type { Tracker, SchemaField } from '@/types/tracker'
import type { TrackerLog } from '@/types/log'
import { LogEntryCard } from '@/components/trackers/LogEntryCard'
import { formatFieldValue } from '@/lib/utils/format'

type Props = {
  tracker: Tracker
  logs: TrackerLog[]
}

type DailyStats = {
  [fieldId: string]: {
    sum: number
    count: number
    label: string
    unit?: string
    type: 'sum' | 'avg'
  }
}

function calculateDailyStats(logs: TrackerLog[], schema: SchemaField[]): DailyStats {
  const stats: DailyStats = {}

  logs.forEach(log => {
    Object.entries(log.fields).forEach(([fId, val]) => {
      if (typeof val !== 'number') return
      
      const field = schema.find(s => s.fieldId === fId)
      if (!field) return

      if (!stats[fId]) {
        let aggType: 'sum' | 'avg' = 'sum'
        const labelL = field.label.toLowerCase()
        if (labelL.includes('hr') || labelL.includes('rate') || labelL.includes('avg') || labelL.includes('score') || labelL.includes('weight')) {
          aggType = 'avg'
        }

        stats[fId] = {
          sum: 0,
          count: 0,
          label: field.label,
          unit: field.unit,
          type: aggType
        }
      }

      stats[fId].sum += val
      stats[fId].count += 1
    })
  })

  return stats
}

type GroupedLogs = {
  heading: string
  date: string
  entries: TrackerLog[]
  stats: DailyStats
}

function formatDateHeading(isoDate: string): string {
  // Always compare UTC date strings — isoDate is a full ISO timestamp whose UTC date
  // (slice 0-10) matches the groupLogsByDate key. Using local-time Date arithmetic
  // would shift the label for UTC+ users whose early-morning UTC timestamps fall on
  // the previous local day (or vice versa).
  const utcDate = isoDate.slice(0, 10)
  const todayUTC = new Date().toISOString().slice(0, 10)
  const yesterdayUTC = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  if (utcDate === todayUTC) return 'Today'
  if (utcDate === yesterdayUTC) return 'Yesterday'

  // Build a Date at UTC noon to avoid any DST / day-boundary oddities in the formatter
  const [year, month, day] = utcDate.split('-').map(Number)
  const currentYear = new Date().getUTCFullYear()
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
    ...(year !== currentYear ? { year: 'numeric' } : {}),
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function groupLogsByDate(logs: TrackerLog[], schema: SchemaField[]): GroupedLogs[] {
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
      stats: calculateDailyStats(entries, schema)
    }))
}

export function TrackerHistoryView({ tracker, logs }: Props): React.ReactElement {
  const groups = groupLogsByDate(logs, tracker.schema)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-10">
        <Link
          href="/trackers"
          className="mb-6 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-textMuted transition-colors duration-300 hover:text-textPrimary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Trackers
        </Link>

        <div className="mt-6 flex items-end justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300"
                style={{
                  backgroundColor: `${tracker.color}18`,
                  border: `1px solid ${tracker.color}35`,
                  boxShadow: `0 0 20px -5px ${tracker.color}50`,
                  color: tracker.color,
                }}
              >
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-textPrimary">
                  {tracker.name}
                </h1>
                <p className="mt-0.5 text-xs font-black uppercase tracking-widest text-textMuted/50">
                  {logs.length} total entries · {tracker.schema.length} fields
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/trackers/${tracker.id}/log`}
              className="flex items-center gap-2 rounded-full px-6 py-2.5 text-[11px] font-black uppercase tracking-widest text-background transition-all duration-300 hover:scale-[1.03] hover:opacity-90 active:scale-[0.97]"
              style={{
                backgroundColor: tracker.color,
                boxShadow: `0 4px 20px -4px ${tracker.color}60`,
              }}
            >
              <ClipboardList className="h-4 w-4" />
              Log Entry
            </Link>
          </div>
        </div>
      </div>

      {/* Log History */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02] p-16 text-center">
          <div
            className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: `${tracker.color}15`,
              border: `1px solid ${tracker.color}30`,
              color: tracker.color,
            }}
          >
            <ClipboardList className="h-7 w-7" />
          </div>
          <p className="mb-2 text-lg font-black text-textPrimary">No entries yet</p>
          <p className="mb-8 text-sm text-textMuted/60">Start tracking to see your history here.</p>
          <Link
            href={`/trackers/${tracker.id}/log`}
            className="rounded-full border border-white/10 bg-white/[0.04] px-8 py-2.5 text-[11px] font-black uppercase tracking-widest text-textPrimary transition-all duration-300 hover:bg-white/[0.08] hover:border-white/20"
          >
            Create first entry
          </Link>
        </div>
      ) : (
        <div className="space-y-12">
          {groups.map((group) => (
            <section key={group.date} className="relative">
              <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-white/5 bg-background/80 px-4 py-2.5 backdrop-blur-md">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-textMuted/60">
                  {group.heading}
                </h2>
              </div>

              <div className="space-y-3">
                {group.entries.map((log) => (
                  <LogEntryCard
                    key={log.id}
                    log={log}
                    schema={tracker.schema}
                  />
                ))}
              </div>

              {/* Daily Stats Footer */}
              {Object.keys(group.stats).length > 0 && (group.entries.length > 1 || tracker.name.toLowerCase().includes('food') || tracker.name.toLowerCase().includes('weight')) && (
                <div
                  className="mt-4 rounded-2xl p-5"
                  style={{
                    backgroundColor: `${tracker.color}08`,
                    border: `1px solid ${tracker.color}20`,
                  }}
                >
                  <h3
                    className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                    style={{ color: `${tracker.color}99` }}
                  >
                    <TrendingUp className="h-3 w-3" />
                    Daily Totals & Averages
                  </h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {Object.values(group.stats).map((stat) => (
                      <div key={stat.label} className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-textMuted/50">{stat.label}</span>
                        <span className="text-sm font-black text-textPrimary">
                          {formatFieldValue(stat.type === 'avg' ? stat.sum / stat.count : stat.sum, stat.unit, stat.label)}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-textMuted/30">
                          {stat.type === 'avg' ? 'Average' : 'Total'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

