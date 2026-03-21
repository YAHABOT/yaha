import { createServerClient } from '@/lib/supabase/server'
import type { Agent, CreateAgentInput, UpdateAgentInput } from '@/types/agent'

const AGENT_COLUMNS = 'id, user_id, name, trigger, exit_trigger, system_prompt, color, schema, created_at, updated_at'

export async function getAgents(): Promise<Agent[]> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('agents')
    .select(AGENT_COLUMNS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch agents: ${error.message}`)
  return (data ?? []) as Agent[]
}

export async function getAgent(id: string): Promise<Agent> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('agents')
    .select(AGENT_COLUMNS)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) throw new Error(`Failed to fetch agent: ${error.message}`)
  return data as Agent
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('agents')
    .insert({
      user_id: user.id,
      name: input.name,
      trigger: input.trigger,
      exit_trigger: input.exit_trigger,
      system_prompt: input.system_prompt,
      color: input.color,
      schema: input.schema,
    })
    .select(AGENT_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to create agent: ${error.message}`)
  return data as Agent
}

export async function updateAgent(id: string, input: UpdateAgentInput): Promise<Agent> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('agents')
    .update(input)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(AGENT_COLUMNS)
    .single()

  if (error) throw new Error(`Failed to update agent: ${error.message}`)
  return data as Agent
}

export async function deleteAgent(id: string): Promise<void> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to delete agent: ${error.message}`)
}
