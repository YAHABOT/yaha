import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getTrackers } from '@/lib/db/trackers'
import { TrackerCard } from '@/components/trackers/TrackerCard'

export default async function TrackersPage(): Promise<React.ReactElement> {
  const trackers = await getTrackers()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-textPrimary">Trackers</h1>
        <Link
          href="/trackers/new"
          className="flex items-center gap-1.5 rounded-lg bg-nutrition px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-nutrition/90"
        >
          <Plus className="h-4 w-4" />
          New Tracker
        </Link>
      </div>

      {trackers.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <p className="text-textMuted">
            No trackers yet. Create your first one to start logging.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trackers.map((tracker) => (
            <TrackerCard key={tracker.id} tracker={tracker} />
          ))}
        </div>
      )}
    </div>
  )
}
