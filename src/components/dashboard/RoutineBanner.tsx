import Link from 'next/link'
import { Sunrise, Moon } from 'lucide-react'
import type { Routine } from '@/types/routine'

type Props = {
  routine: Routine
  type: 'day_start' | 'day_end'
}

export function RoutineBanner({ routine, type }: Props): React.ReactElement {
  const isDayStart = type === 'day_start'

  if (isDayStart) {
    return (
      <div className="rounded-2xl border border-amber-800/30 bg-gradient-to-br from-amber-900/40 via-yellow-900/20 to-transparent p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/20 p-2">
            <Sunrise className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-textPrimary">{routine.name}</h2>
            <p className="text-sm text-textMuted">Ready to start your day with intention?</p>
          </div>
        </div>
        <Link
          href={`/chat?routine=${routine.id}`}
          className="block w-full rounded-xl bg-nutrition py-3 text-center text-sm font-bold uppercase tracking-widest text-[#050505]"
        >
          START DAY
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-indigo-800/30 bg-gradient-to-br from-indigo-900/40 via-slate-900/20 to-transparent p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-indigo-500/20 p-2">
          <Moon className="h-6 w-6 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-textPrimary">{routine.name}</h2>
          <p className="text-sm text-textMuted">Time to wind down and reflect.</p>
        </div>
      </div>
      <Link
        href={`/chat?routine=${routine.id}`}
        className="block w-full rounded-xl bg-sleep py-3 text-center text-sm font-bold uppercase tracking-widest text-white"
      >
        END DAY
      </Link>
    </div>
  )
}
