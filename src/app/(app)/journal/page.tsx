import { getTrackersBasic } from '@/lib/db/trackers'
import { getLogsForDay, getLoggedDates } from '@/lib/db/logs'
import { getCorrelations } from '@/lib/db/correlations'
import { DayView } from '@/components/journal/DayView'
import { createServerClient } from '@/lib/supabase/server'

type Props = {
  searchParams: Promise<{ date?: string }>
}

export default async function JournalPage({ searchParams }: Props): Promise<React.ReactElement> {
  const { date: dateParam } = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const date = dateParam ?? today

  const supabase = await createServerClient()

  try {
    const [trackers, logs, loggedDates, correlations] = await Promise.all([
      getTrackersBasic(supabase),
      getLogsForDay(date, supabase),
      getLoggedDates(undefined, supabase),
      getCorrelations(supabase),
    ])

    return <DayView date={date} trackers={trackers} logs={logs} loggedDates={loggedDates} correlations={correlations} />
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load journal'
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-400">{message}</p>
      </div>
    )
  }
}
