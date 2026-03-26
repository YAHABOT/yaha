import Link from 'next/link'
import { Plus, ChevronLeft } from 'lucide-react'
import { getRoutines } from '@/lib/db/routines'
import { RoutineCard } from '@/components/routines/RoutineCard'

export default async function RoutinesPage(): Promise<React.ReactElement> {
  let routines
  try {
    routines = await getRoutines()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load routines'
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-400">{message}</p>
      </div>
    )
  }

  return (
    <div>
      <Link
        href="/dashboard"
        className="group mb-6 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-textMuted transition-colors hover:text-textPrimary"
      >
        <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-textPrimary">Routines</h1>
        <Link
          href="/routines/new"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          New Routine
        </Link>
      </div>

      {routines.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <p className="text-textMuted">
            No routines yet. Create your first routine.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {routines.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} />
          ))}
        </div>
      )}
    </div>
  )
}
