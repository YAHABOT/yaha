import Link from 'next/link'
import { Pencil, ClipboardList, Activity } from 'lucide-react'
import type { Tracker } from '@/types/tracker'

type Props = {
  tracker: Tracker
}

export function TrackerCard({ tracker }: Props): React.ReactElement {
  const fieldCount = tracker.schema.length

  return (
    <div
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5"
      data-testid="tracker-card"
    >
      {/* Top gradient accent line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${tracker.color}60, transparent)`,
        }}
      />
      {/* Corner ambient glow */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10 blur-3xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ backgroundColor: tracker.color }}
      />

      <Link href={`/trackers/${tracker.id}`} className="relative mb-4 block">
        {/* Icon + Name row */}
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110"
            style={{
              backgroundColor: `${tracker.color}18`,
              border: `1px solid ${tracker.color}35`,
              boxShadow: `0 0 14px -4px ${tracker.color}50`,
              color: tracker.color,
            }}
            data-testid="tracker-color-dot"
          >
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-textPrimary">
              {tracker.name}
            </h3>
          </div>
        </div>

        {/* Badges */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest"
            style={{
              backgroundColor: `${tracker.color}18`,
              color: tracker.color,
              border: `1px solid ${tracker.color}30`,
            }}
          >
            {tracker.type}
          </span>
          <span className="rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-textMuted">
            {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
          </span>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-textMuted/40">
            View History
          </span>
          <div className="text-textMuted opacity-20 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100">
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 9L5 5L1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </Link>

      {/* Action buttons */}
      <div className="relative flex items-center gap-2">
        <Link
          href={`/trackers/${tracker.id}/log`}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-textPrimary transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]"
        >
          <ClipboardList className="h-3 w-3" />
          Log
        </Link>
        <Link
          href={`/trackers/${tracker.id}/schema`}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-textPrimary transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]"
        >
          <Pencil className="h-3 w-3" />
          Edit Schema
        </Link>
      </div>
    </div>
  )
}
