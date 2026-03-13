import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getRoutine } from '@/lib/db/routines'
import { getTrackers } from '@/lib/db/trackers'
import { RoutineForm } from '@/components/routines/RoutineForm'
import { updateRoutineAction } from '@/app/actions/routines'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EditRoutinePage({ params }: Props) {
  const { id } = await params

  let routine
  let trackers
  try {
    ;[routine, trackers] = await Promise.all([getRoutine(id), getTrackers()])
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load routine'
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-400">{message}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/routines"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-textMuted transition-colors hover:text-textPrimary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Routines
        </Link>
        <h1 className="text-2xl font-bold text-textPrimary">Edit Routine</h1>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <RoutineForm
          trackers={trackers}
          initialValues={routine}
          onSubmit={updateRoutineAction.bind(null, id)}
        />
      </div>
    </div>
  )
}
