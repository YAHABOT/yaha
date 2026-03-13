import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getWidgets } from '@/lib/db/dashboard'
import { computeWidgetValue } from '@/lib/db/dashboard-data'
import { getTrackers } from '@/lib/db/trackers'
import { getRoutines } from '@/lib/db/routines'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import type { WidgetValue } from '@/types/widget'

export default async function DashboardPage(): Promise<React.ReactElement> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  try {
    const [widgets, trackers, routines] = await Promise.all([
      getWidgets(),
      getTrackers(),
      getRoutines(),
    ])

    const dayStartRoutine = routines.find(r => r.type === 'day_start') ?? null
    const dayEndRoutine = routines.find(r => r.type === 'day_end') ?? null

    // Compute all widget values in parallel — errors are swallowed per widget
    const widgetValues: WidgetValue[] = await Promise.all(
      widgets.map(w =>
        computeWidgetValue(w).catch(() => ({ value: null, label: w.label }))
      )
    )

    return (
      <DashboardClient
        widgets={widgets}
        widgetValues={widgetValues}
        trackers={trackers}
        dayStartRoutine={dayStartRoutine}
        dayEndRoutine={dayEndRoutine}
      />
    )
  } catch {
    const message = 'Failed to load dashboard. Please refresh the page.'
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-400">{message}</p>
      </div>
    )
  }
}
