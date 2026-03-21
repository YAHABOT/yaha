import Link from 'next/link'
import { Plus, ChevronLeft, Workflow } from 'lucide-react'
import { getRoutines } from '@/lib/db/routines'
import { RoutineCard } from '@/components/routines/RoutineCard'

export default async function RoutinesPage(): Promise<React.ReactElement> {
  let routines
  try {
    routines = await getRoutines()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load routines'
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center italic font-bold text-red-100">
          !! {message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Breadcrumb */}
      <Link
        href="/settings"
        className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-textMuted transition-colors hover:text-textPrimary"
      >
        <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Settings
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
             <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 shadow-lg shadow-purple-500/10">
               <Workflow className="h-6 w-6" />
             </div>
             <h1 className="text-5xl font-black tracking-tighter text-textPrimary">Routines</h1>
          </div>
          <p className="text-sm font-medium text-textMuted opacity-60">
            Define automated sequences for logging and system events.
          </p>
        </div>

        <Link
          href="/settings/routines/new"
          className="flex items-center gap-2 rounded-2xl bg-nutrition px-6 py-3 text-sm font-black uppercase tracking-widest text-nutrition-foreground transition-all hover:scale-[1.05] active:scale-95 shadow-xl shadow-nutrition/20"
        >
          <Plus className="h-4 w-4 stroke-[3px]" />
          New Routine
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
        {routines.map((routine) => (
          <RoutineCard key={routine.id} routine={routine} />
        ))}

        {routines.length === 0 && (
          <div className="md:col-span-2 rounded-[40px] border border-dashed border-white/5 p-20 text-center space-y-4">
             <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5 text-textMuted">
               <Workflow className="h-8 w-8 opacity-20" />
             </div>
             <p className="text-sm font-bold text-textMuted uppercase tracking-widest opacity-40">No routine protocols active.</p>
          </div>
        )}
      </div>
    </div>
  )
}
