import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getTracker } from '@/lib/db/trackers'
import { getLogs } from '@/lib/db/logs'
import { LogForm } from '@/components/trackers/LogForm'
import { LogEntryList } from '@/components/trackers/LogEntryList'

type Props = {
  params: Promise<{ id: string }>
}

export default async function LogPage({ params }: Props): Promise<React.ReactElement> {
  const { id } = await params

  let tracker
  try {
    tracker = await getTracker(id)
  } catch {
    notFound()
  }

  const logs = await getLogs(id)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/trackers"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-textMuted transition-colors hover:text-textPrimary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Trackers
        </Link>
        <h1 className="text-2xl font-bold text-textPrimary">
          Log — {tracker.name}
        </h1>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <LogForm tracker={tracker} />
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-textPrimary">Recent Entries</h2>
        <LogEntryList logs={logs} schema={tracker.schema} trackerId={tracker.id} />
      </div>
    </div>
  )
}
