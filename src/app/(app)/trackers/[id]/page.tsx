import { notFound } from 'next/navigation'
import { getTracker } from '@/lib/db/trackers'
import { getLogs } from '@/lib/db/logs'
import { TrackerHistoryView } from '@/components/trackers/TrackerHistoryView'
import type { Tracker } from '@/types/tracker'
import type { TrackerLog } from '@/types/log'

const HISTORY_LIMIT = 100

type Props = {
  params: Promise<{ id: string }>
}

export default async function TrackerDetailPage({ params }: Props): Promise<React.ReactElement> {
  const { id } = await params

  let tracker: Tracker
  try {
    tracker = await getTracker(id)
  } catch {
    notFound()
  }

  let logs: TrackerLog[]
  try {
    logs = await getLogs(id, { limit: HISTORY_LIMIT })
  } catch {
    logs = []
  }

  return <TrackerHistoryView tracker={tracker} logs={logs} />
}
