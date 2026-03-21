import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getTrackers } from '@/lib/db/trackers'
import { getRoutine } from '@/lib/db/routines'
import { RoutineForm } from '@/components/routines/RoutineForm'
import { notFound } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EditRoutinePage({ params }: Props) {
  const { id } = await params
  
  const [trackers, routine] = await Promise.all([
    getTrackers(),
    getRoutine(id)
  ])

  if (!routine) {
    notFound()
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
        <h1 className="text-4xl font-black tracking-tighter text-textPrimary">Edit Protocol</h1>
        <p className="text-sm font-medium text-textMuted opacity-60">
          Modify the automation sequence for &ldquo;{routine.name}&rdquo;.
        </p>
      </div>

      <div className="rounded-[40px] border border-white/5 bg-black/40 p-10 backdrop-blur-xl shadow-2xl">
        <RoutineForm 
          trackers={trackers} 
          initialValues={routine} 
        />
      </div>
    </div>
  )
}
