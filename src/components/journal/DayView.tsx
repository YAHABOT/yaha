'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, GitBranch, Eye, Plus, Menu, X } from 'lucide-react'
import type { Tracker } from '@/types/tracker'
import type { TrackerLog } from '@/types/log'
import type { Correlation } from '@/types/correlator'
import { TrackerDayGroup } from '@/components/journal/TrackerDayGroup'
import { CorrelationCard } from '@/components/journal/CorrelationCard'
import { CorrelatorModal } from '@/components/journal/CorrelatorModal'

type Props = {
  date: string
  trackers: Tracker[]
  logs: TrackerLog[]
  loggedDates: string[]
  correlations: Correlation[]
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

function formatSidebarDate(dateStr: string): { day: string; date: string; label: string } {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dayName = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  const dateNum = d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' })
  const monthStr = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })

  return { day: dayName, date: dateNum, label: monthStr }
}

function formatHeaderDateParts(dateStr: string): { weekday: string; date: string } {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
  const date = d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return { weekday, date }
}

function addDays(dateStr: string, n: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

export function DayView({ date, trackers, logs, loggedDates, correlations }: Props): React.ReactElement {
  const router = useRouter()
  const [correlatorOpen, setCorrelatorOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const isToday = date >= today

  const grouped = groupLogsByTracker(logs)
  const trackersWithLogs = trackers.filter((t) => grouped.has(t.id))

  // Merge today into loggedDates if not already present
  const allDates = loggedDates.includes(today)
    ? loggedDates
    : [today, ...loggedDates]

  function goTo(d: string) {
    router.push(`/journal?date=${d}`)
  }

  // Shared date list — rendered in both desktop sidebar and mobile drawer
  const dateList = (
    <>
      <div className="px-3 pb-2 pt-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-textMuted">Log Days</p>
        <p className="mt-0.5 text-xs text-textMuted">{loggedDates.length} days</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {allDates.map((d) => {
          const { day, date: dateNum, label } = formatSidebarDate(d)
          const isActive = d === date
          const isCurrentDay = d === today
          return (
            <button
              key={d}
              onClick={() => { goTo(d); setMobileSidebarOpen(false) }}
              className={`w-full border-b border-white/[0.03] px-3 py-2.5 text-left transition-all duration-300 ${
                isActive
                  ? 'bg-white/[0.04] border-l-2 border-l-primary shadow-[inset_0_0_12px_rgba(163,230,53,0.04)]'
                  : 'hover:bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-primary' : 'text-textMuted'}`}>
                  {day}
                </span>
                {isCurrentDay && (
                  <span className="rounded-full bg-primary/20 px-1 py-0.5 text-[8px] font-black uppercase tracking-widest text-primary">
                    Today
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold leading-tight ${isActive ? 'text-primary' : 'text-textPrimary'}`}>
                  {dateNum}
                </span>
                <span className="text-[10px] text-textMuted">{label}</span>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )

  return (
    <div className="flex h-full min-h-0">
      {/* ── Mobile Drawer Overlay ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          {/* Visual backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-none" />
          {/* Drawer panel */}
          <div
            className="absolute left-0 top-0 z-10 h-full w-56 flex flex-col bg-surface border-r border-white/5 animate-in slide-in-from-left-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header: action buttons + close */}
            <div className="flex items-center justify-between border-b border-white/[0.04] px-3 py-3">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-textMuted transition-all duration-300 hover:bg-white/[0.05] hover:text-textPrimary">
                  <Eye className="h-3 w-3" />
                  View
                </button>
                <button
                  onClick={() => { setCorrelatorOpen(true); setMobileSidebarOpen(false) }}
                  className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all duration-300 hover:bg-primary/20"
                >
                  <GitBranch className="h-3 w-3" />
                  Cor.
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-textMuted hover:bg-white/[0.06] hover:text-textPrimary transition-colors"
                aria-label="Close day list"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {dateList}
          </div>
        </div>
      )}

      {/* ── Left Sidebar: Date List (desktop only) ── */}
      <aside className="hidden w-44 flex-shrink-0 overflow-y-auto border-r border-white/5 bg-surface md:flex md:flex-col">
        {dateList}
      </aside>

      {/* ── Main Content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header bar — flex-shrink-0 keeps it fixed-height inside the flex-col while content scrolls below */}
        <div className="z-10 flex flex-shrink-0 items-center justify-between border-b border-white/5 bg-surface/60 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            {/* Mobile hamburger — hidden on desktop */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.03] text-textMuted transition-all duration-200 hover:bg-white/[0.06] hover:text-textPrimary border border-white/5 md:hidden"
              aria-label="Open day list"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              onClick={() => goTo(addDays(date, -1))}
              className="rounded-xl bg-white/[0.03] p-1.5 text-textMuted transition-all duration-300 hover:bg-white/[0.06] hover:text-textPrimary border border-white/5"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0 px-2 flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-textMuted/60 leading-none">{formatHeaderDateParts(date).weekday}</span>
              <span className="text-sm font-semibold text-textPrimary leading-tight whitespace-nowrap">{formatHeaderDateParts(date).date}</span>
            </div>
            <button
              onClick={() => goTo(addDays(date, 1))}
              disabled={isToday}
              className="rounded-xl bg-white/[0.03] p-1.5 text-textMuted transition-all duration-300 hover:bg-white/[0.06] hover:text-textPrimary border border-white/5 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Desktop-only action buttons — hidden on mobile (moved to drawer) */}
          <div className="hidden md:flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-textMuted backdrop-blur-md transition-all duration-300 hover:bg-white/[0.05] hover:text-textPrimary">
              <Eye className="h-3 w-3" />
              View
            </button>
            <button
              onClick={() => setCorrelatorOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all duration-300 hover:bg-primary/20 hover:shadow-[0_0_12px_rgba(163,230,53,0.15)]"
            >
              <GitBranch className="h-3 w-3" />
              Correlator
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {/* Correlations row */}
          {correlations.length > 0 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-textMuted">Correlations</p>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/5 to-transparent w-16" />
                </div>
                <button
                  onClick={() => setCorrelatorOpen(true)}
                  className="flex items-center gap-1 text-[10px] font-medium text-primary transition-colors hover:text-primary/80"
                >
                  <Plus className="h-3 w-3" /> New
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {correlations.map((c) => (
                  <CorrelationCard key={c.id} correlation={c} logs={logs} />
                ))}
              </div>
            </div>
          )}

          {/* Tracker entries section header */}
          {trackersWithLogs.length > 0 && (
            <div className="mb-4 flex items-center gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-textMuted">Entries</p>
              <div className="h-px flex-1 bg-gradient-to-r from-white/5 to-transparent" />
              <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-textMuted border border-white/5">
                {trackersWithLogs.length} tracker{trackersWithLogs.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Tracker entries */}
          {trackersWithLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.02] p-14 text-center backdrop-blur-md">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/5">
                <GitBranch className="h-5 w-5 text-textMuted" />
              </div>
              <p className="text-sm font-semibold text-textPrimary">No logs for this day</p>
              {!isToday && (
                <p className="mt-1.5 text-xs text-textMuted">Try selecting a different day from the sidebar.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
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

          {/* Add correlator CTA if none exist */}
          {correlations.length === 0 && (
            <div className="mt-8 rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.02] p-6 text-center backdrop-blur-md">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.08] border border-primary/20">
                <GitBranch className="h-4 w-4 text-primary/60" />
              </div>
              <p className="text-sm font-semibold text-textPrimary">No correlations yet</p>
              <p className="mt-1 text-xs text-textMuted">Create formula metrics that combine fields across trackers.</p>
              <button
                onClick={() => setCorrelatorOpen(true)}
                className="mt-4 rounded-xl border border-primary/20 bg-primary/10 px-5 py-2 text-xs font-semibold text-primary transition-all duration-300 hover:bg-primary/20 hover:shadow-[0_0_12px_rgba(163,230,53,0.15)]"
              >
                + New Correlation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Correlator Modal */}
      {correlatorOpen && (
        <CorrelatorModal
          trackers={trackers}
          correlations={correlations}
          onClose={() => setCorrelatorOpen(false)}
        />
      )}
    </div>
  )
}
