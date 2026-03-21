import Link from 'next/link'
import { Sunrise, Moon, ArrowRight } from 'lucide-react'
import type { Routine } from '@/types/routine'

type Props = {
  routine: Routine
  type: 'day_start' | 'day_end'
}

export function RoutineBanner({ routine, type }: Props): React.ReactElement {
  const isDayStart = type === 'day_start'

  if (isDayStart) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-900/40 via-yellow-900/15 to-transparent p-6 backdrop-blur-sm shadow-[0_0_40px_rgba(245,158,11,0.08)]">
        {/* Ambient glow blob */}
        <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/15 p-2.5 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <Sunrise className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight text-textPrimary">{routine.name}</h2>
            <p className="mt-0.5 text-[11px] font-medium text-textMuted">
              Start strong — your morning protocol is ready
            </p>
          </div>
        </div>
        <Link
          href={`/chat/new?routine=${routine.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/15 py-4 text-center text-[11px] font-black uppercase tracking-widest text-amber-400 transition-all duration-300 hover:border-amber-500/50 hover:bg-amber-500/25 hover:shadow-[0_0_24px_rgba(245,158,11,0.2)]"
        >
          Start Day
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-900/40 via-slate-900/15 to-transparent p-6 backdrop-blur-sm shadow-[0_0_40px_rgba(99,102,241,0.08)]">
      {/* Ambient glow blob */}
      <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl" />
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/15 p-2.5 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
          <Moon className="h-6 w-6 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-black tracking-tight text-textPrimary">{routine.name}</h2>
          <p className="mt-0.5 text-[11px] font-medium text-textMuted">
            Wind down — reflect and close out your day
          </p>
        </div>
      </div>
      <Link
        href={`/chat/new?routine=${routine.id}`}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/15 py-4 text-center text-[11px] font-black uppercase tracking-widest text-indigo-400 transition-all duration-300 hover:border-indigo-500/50 hover:bg-indigo-500/25 hover:shadow-[0_0_24px_rgba(99,102,241,0.2)]"
      >
        End Day
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
