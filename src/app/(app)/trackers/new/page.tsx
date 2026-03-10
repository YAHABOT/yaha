import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CreateTrackerForm } from '@/components/trackers/CreateTrackerForm'

export default function NewTrackerPage(): React.ReactElement {
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
        <h1 className="text-2xl font-bold text-textPrimary">New Tracker</h1>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <CreateTrackerForm />
      </div>
    </div>
  )
}
