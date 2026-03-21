import { createServerClient } from '@/lib/supabase/server'
import { getSafeUser } from '@/lib/supabase/auth'
import type { Widget, CreateWidgetInput } from '@/types/widget'
import type { SupabaseClient } from '@supabase/supabase-js'

const WIDGET_COLUMNS = 'id, user_id, type, label, tracker_id, field_id, correlation_id, days, position, color'

export async function getWidgets(supabaseClient?: SupabaseClient): Promise<Widget[]> {
  const supabase = supabaseClient ?? await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('widgets')
    .select(WIDGET_COLUMNS)
    .eq('user_id', user.id)
    .order('position', { ascending: true })

  if (error) throw new Error(`Failed to fetch widgets: ${error.message}`)
  return (data ?? []) as Widget[]
}

export async function createWidget(input: CreateWidgetInput): Promise<Widget> {
  const supabase = await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  // Determine next position (max + 1)
  const { data: existing } = await supabase
    .from('widgets')
    .select('position')
    .eq('user_id', user.id)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0
    ? (existing[0].position as number) + 1
    : 0

  const { data, error } = await supabase
    .from('widgets')
    .insert({
      user_id: user.id,
      type: input.type,
      label: input.label,
      tracker_id: input.tracker_id ?? null,
      field_id: input.field_id ?? null,
      correlation_id: input.correlation_id ?? null,
      days: input.days ?? 7,
      position: nextPosition,
      color: input.color ?? null,
    })
    .select(WIDGET_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to create widget: ${error.message}`)
  return data as Widget
}

export async function updateWidget(
  id: string,
  data: Partial<CreateWidgetInput>
): Promise<Widget> {
  const supabase = await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const updates: Record<string, unknown> = {}
  if (data.type !== undefined) updates.type = data.type
  if (data.label !== undefined) updates.label = data.label
  if (data.tracker_id !== undefined) updates.tracker_id = data.tracker_id
  if (data.field_id !== undefined) updates.field_id = data.field_id
  if (data.correlation_id !== undefined) updates.correlation_id = data.correlation_id
  if (data.days !== undefined) updates.days = data.days
  if (data.position !== undefined) updates.position = data.position
  if (data.color !== undefined) updates.color = data.color

  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update')
  }

  const { data: updated, error } = await supabase
    .from('widgets')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(WIDGET_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to update widget: ${error.message}`)
  return updated as Widget
}

export async function deleteWidget(id: string): Promise<void> {
  const supabase = await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('widgets')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to delete widget: ${error.message}`)
}

export async function reorderWidgets(orderedIds: string[]): Promise<void> {
  const supabase = await createServerClient()
  const user = await getSafeUser()
  if (!user) throw new Error('Unauthorized')

  // Update each widget's position in sequence
  const updates = orderedIds.map((id, index) =>
    supabase
      .from('widgets')
      .update({ position: index })
      .eq('id', id)
      .eq('user_id', user.id)
  )

  const results = await Promise.all(updates)
  const failed = results.find(r => r.error)
  if (failed?.error) throw new Error(`Failed to reorder widgets: ${failed.error.message}`)
}
