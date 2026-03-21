import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTrackers } from '@/lib/db/trackers'
import { RoutineForm } from '@/components/routines/RoutineForm'

export default async function NewRoutinePage() {
  let trackers
  try {
    trackers = await getTrackers()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load trackers'
    return (
      <div className="rounded-[32px] border border-red-500/20 bg-red-500/[0.06] backdrop-blur-md p-8 text-center">
        <p className="text-sm font-bold text-red-400">{message}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/routines"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-textMuted transition-colors duration-200 hover:text-textPrimary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Routines
        </Link>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-textPrimary">
          New Routine
        </h1>
        <p className="mt-1 text-xs font-medium text-textMuted opacity-50 uppercase tracking-wider">
          Define a new automated protocol
        </p>
      </div>

      {/* Glass form container */}
      <div className="relative rounded-[32px] border border-white/5 bg-white/[0.02] backdrop-blur-md p-8 shadow-2xl overflow-hidden">
        <div className="absolute -top-16 -right-16 h-40 w-40 bg-nutrition/5 blur-[100px] pointer-events-none" />
        <div className="relative">
          <RoutineForm trackers={trackers} />
        </div>
      </div>
    </div>
  )
}
