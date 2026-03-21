import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getTrackers } from '@/lib/db/trackers'
import { RoutineForm } from '@/components/routines/RoutineForm'

export default async function NewRoutinePage() {
  let trackers
  try {
    trackers = await getTrackers()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load trackers'
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center italic font-bold text-red-100">
          !! {message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <Link
        href="/settings/routines"
        className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-textMuted transition-colors hover:text-textPrimary"
      >
        <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Routines
      </Link>

      <div className="space-y-4">
        <h1 className="text-4xl font-black tracking-tighter text-textPrimary">New Protocol</h1>
        <p className="text-sm font-medium text-textMuted opacity-60">
          Configure a multi-step sequence triggered by a voice or text phrase.
        </p>
      </div>

      <div className="rounded-[40px] border border-white/5 bg-black/40 p-10 backdrop-blur-xl shadow-2xl">
        <RoutineForm trackers={trackers} />
      </div>
    </div>
  )
}
