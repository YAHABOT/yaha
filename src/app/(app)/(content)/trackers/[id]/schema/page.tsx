import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getTracker } from '@/lib/db/trackers'
import { SchemaEditor } from '@/components/trackers/SchemaEditor'

type Props = {
  params: Promise<{ id: string }>
}

export default async function SchemaEditorPage({ params }: Props): Promise<React.ReactElement> {
  const { id } = await params

  let tracker
  try {
    tracker = await getTracker(id)
  } catch {
    notFound()
  }

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
        <h1 className="text-2xl font-bold text-textPrimary">Edit Schema</h1>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <SchemaEditor tracker={tracker} />
      </div>
    </div>
  )
}
