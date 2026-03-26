'use client' // Needed: delete confirmation modal state + router.refresh after delete

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
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

export function RoutineCard({ routine }: Props): React.ReactElement {
  const router = useRouter()
  const stepCount = routine.steps.length
  const style = TYPE_STYLES[routine.type]
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false)
  const [deleting, setDeleting] = useState<boolean>(false)

  async function handleDelete(): Promise<void> {
    if (deleting) return
    setDeleting(true)
    const result = await deleteRoutineAction(routine.id)
    if (result.error) {
      setDeleting(false)
      setShowDeleteConfirm(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div
      className={`relative rounded-[32px] border bg-white/[0.02] backdrop-blur-md p-8 transition-all duration-300 shadow-2xl overflow-hidden ${style.cardBorder} ${style.cardHoverBorder} hover:bg-white/[0.04]`}
    >
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-3xl border border-red-500/20 bg-[#0A0A0A] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="mb-1 text-base font-black text-textPrimary">Delete Routine</h3>
            <p className="mb-6 text-xs text-textMuted/60">
              Delete <span className="font-bold text-textPrimary">{routine.name}</span>? This cannot be undone.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-textMuted transition-colors hover:text-textPrimary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background Glow */}
      <div className={`absolute -top-12 -right-12 h-32 w-32 ${style.glowColor} blur-[80px] pointer-events-none opacity-30`} />

      <div className="relative space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl border shadow-lg ${style.iconBg} ${style.iconBorder} ${style.iconText}`}>
              {style.icon}
            </div>
            <div>
              <h3 className="text-xl font-black text-textPrimary break-words">{routine.name}</h3>
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

          {/* Edit/Delete always visible — no hover-only opacity */}
          <div className="flex gap-2">
            <Link
              href={`/routines/${routine.id}/edit`}
              className="p-2 rounded-lg bg-white/5 border border-white/5 text-textMuted hover:text-textPrimary hover:bg-white/10 hover:border-white/10 transition-all duration-200"
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg bg-white/5 border border-white/5 text-textMuted hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-200"
            >
              <Trash2 className="h-4 w-4" />
            </button>
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
