import { createServerClient } from '@/lib/supabase/server'
import type { Correlation, CreateCorrelationInput } from '@/types/correlator'

const CORRELATION_COLUMNS = 'id, user_id, name, formula, unit, created_at'

export async function getCorrelations(): Promise<Correlation[]> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('correlations')
    .select(CORRELATION_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch correlations: ${error.message}`)
  return data as Correlation[]
}

export async function getCorrelation(id: string): Promise<Correlation> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('correlations')
    .select(CORRELATION_COLUMNS)
    .eq('id', id)
    .single()

  if (error) throw new Error(`Failed to fetch correlation: ${error.message}`)
  return data as Correlation
}

export async function createCorrelation(input: CreateCorrelationInput): Promise<Correlation> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('correlations')
    .insert({
      user_id: user.id,
      name: input.name,
      formula: input.formula,
      unit: input.unit,
    })
    .select(CORRELATION_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to create correlation: ${error.message}`)
  return data as Correlation
}

export async function updateCorrelation(
  id: string,
  input: Partial<CreateCorrelationInput>
): Promise<Correlation> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.formula !== undefined) updates.formula = input.formula
  if (input.unit !== undefined) updates.unit = input.unit

  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update')
  }

  const { data, error } = await supabase
    .from('correlations')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(CORRELATION_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to update correlation: ${error.message}`)
  return data as Correlation
}

export async function deleteCorrelation(id: string): Promise<void> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('correlations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to delete correlation: ${error.message}`)
}
