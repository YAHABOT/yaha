import { createServerClient } from '@/lib/supabase/server'
import type { Routine, CreateRoutineInput, UpdateRoutineInput } from '@/types/routine'

const ROUTINE_COLUMNS = 'id, user_id, name, trigger_phrase, type, steps, created_at'

export async function getRoutines(): Promise<Routine[]> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('routines')
    .select(ROUTINE_COLUMNS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch routines: ${error.message}`)
  return (data ?? []) as Routine[]
}

export async function getRoutine(id: string): Promise<Routine> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('routines')
    .select(ROUTINE_COLUMNS)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) throw new Error(`Failed to fetch routine: ${error.message}`)
  return data as Routine
}

export async function createRoutine(input: CreateRoutineInput): Promise<Routine> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('routines')
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      trigger_phrase: input.trigger_phrase.trim(),
      type: input.type,
      steps: input.steps,
    })
    .select(ROUTINE_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to create routine: ${error.message}`)
  return data as Routine
}

export async function updateRoutine(
  id: string,
  input: UpdateRoutineInput
): Promise<Routine> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.trigger_phrase !== undefined) updates.trigger_phrase = input.trigger_phrase.trim()
  if (input.type !== undefined) updates.type = input.type
  if (input.steps !== undefined) updates.steps = input.steps

  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update')
  }

  const { data, error } = await supabase
    .from('routines')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(ROUTINE_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to update routine: ${error.message}`)
  return data as Routine
}

export async function deleteRoutine(id: string): Promise<void> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('routines')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to delete routine: ${error.message}`)
}
