import Link from 'next/link'
import { Pencil, Trash2, Terminal, Sunrise, Moon, Zap } from 'lucide-react'
import { deleteRoutineAction } from '@/app/actions/routines'
import type { Routine, RoutineType } from '@/types/routine'

const TYPE_LABELS: Record<RoutineType, string> = {
  standard: 'Standard',
  day_start: 'Day Start',
  day_end: 'Day End',
}

type TypeStyle = {
  icon: React.ReactElement
  badgeBg: string
  badgeBorder: string
  badgeText: string
  iconBg: string
  iconBorder: string
  iconText: string
  glowColor: string
  cardBorder: string
  cardHoverBorder: string
}

const TYPE_STYLES: Record<RoutineType, TypeStyle> = {
  day_start: {
    icon: <Sunrise className="h-6 w-6" />,
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/20',
    badgeText: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    iconBorder: 'border-amber-500/20',
    iconText: 'text-amber-400',
    glowColor: 'bg-amber-500/10',
    cardBorder: 'border-amber-500/10',
    cardHoverBorder: 'hover:border-amber-500/20',
  },
  day_end: {
    icon: <Moon className="h-6 w-6" />,
    badgeBg: 'bg-indigo-500/10',
    badgeBorder: 'border-indigo-500/20',
    badgeText: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10',
    iconBorder: 'border-indigo-500/20',
    iconText: 'text-indigo-400',
    glowColor: 'bg-indigo-500/10',
    cardBorder: 'border-indigo-500/10',
    cardHoverBorder: 'hover:border-indigo-500/20',
  },
  standard: {
    icon: <Zap className="h-6 w-6" />,
    badgeBg: 'bg-nutrition/10',
    badgeBorder: 'border-nutrition/20',
    badgeText: 'text-nutrition',
    iconBg: 'bg-nutrition/10',
    iconBorder: 'border-nutrition/20',
    iconText: 'text-nutrition',
    glowColor: 'bg-nutrition/10',
    cardBorder: 'border-nutrition/10',
    cardHoverBorder: 'hover:border-nutrition/20',
  },
}

type Props = {
  routine: Routine
}

export async function RoutineCard({ routine }: Props): Promise<React.ReactElement> {
  const stepCount = routine.steps.length
  const style = TYPE_STYLES[routine.type]

  async function handleDelete(): Promise<void> {
    'use server'
    await deleteRoutineAction(routine.id)
  }

  return (
    <div
      className={`group relative rounded-[32px] border bg-white/[0.02] backdrop-blur-md p-8 transition-all duration-300 shadow-2xl overflow-hidden ${style.cardBorder} ${style.cardHoverBorder} hover:bg-white/[0.04]`}
    >
      {/* Background Glow */}
      <div className={`absolute -top-12 -right-12 h-32 w-32 ${style.glowColor} blur-[80px] pointer-events-none opacity-30`} />

      <div className="relative space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl border shadow-lg ${style.iconBg} ${style.iconBorder} ${style.iconText}`}>
              {style.icon}
            </div>
            <div>
              <h3 className="text-xl font-black text-textPrimary">{routine.name}</h3>
              <div className="flex gap-2 mt-1">
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${style.badgeBg} ${style.badgeBorder} ${style.badgeText}`}>
                  {TYPE_LABELS[routine.type]}
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-textMuted border border-white/10">
                  {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Link
              href={`/routines/${routine.id}/edit`}
              className="p-2 rounded-lg bg-white/5 border border-white/5 text-textMuted hover:text-textPrimary hover:bg-white/10 hover:border-white/10 transition-all duration-200"
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <form action={handleDelete}>
              <button
                type="submit"
                className="p-2 rounded-lg bg-white/5 border border-white/5 text-textMuted hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-200"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-textMuted opacity-30">
            <Terminal size={10} />
            Trigger Phrase
          </div>
          <div className="rounded-2xl bg-black/40 p-4 border border-white/5 text-sm font-medium text-textMuted/80 italic leading-relaxed">
            &quot;{routine.trigger_phrase}&quot;
          </div>
        </div>
      </div>
    </div>
  )
}
