import { getTrackers } from '@/lib/db/trackers'
import { getLogsForDay } from '@/lib/db/logs'
import { DayView } from '@/components/journal/DayView'

type Props = {
  searchParams: Promise<{ date?: string }>
}

export default async function JournalPage({ searchParams }: Props): Promise<React.ReactElement> {
  const { date: dateParam } = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const date = dateParam ?? today

  try {
    const [trackers, logs] = await Promise.all([
      getTrackers(),
      getLogsForDay(date),
    ])

    return <DayView date={date} trackers={trackers} logs={logs} />
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load journal'
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-400">{message}</p>
      </div>
    )
  }
}
