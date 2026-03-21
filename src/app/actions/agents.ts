'use server'

import { revalidatePath } from 'next/cache'
import { getAgents, createAgent, updateAgent, deleteAgent } from '@/lib/db/agents'
import type { Agent, CreateAgentInput, UpdateAgentInput } from '@/types/agent'

export async function getAgentsAction(): Promise<Agent[]> {
  try {
    return await getAgents()
  } catch (e) {
    console.error('getAgentsAction error:', e)
    return []
  }
}

export async function createAgentAction(input: CreateAgentInput): Promise<{ success: boolean; agent?: Agent; error?: string }> {
  try {
    const agent = await createAgent(input)
    revalidatePath('/settings/agent-forge')
    return { success: true, agent }
  } catch (err: unknown) {
    console.error('createAgentAction error:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function updateAgentAction(id: string, input: UpdateAgentInput): Promise<{ success: boolean; agent?: Agent; error?: string }> {
  try {
    const agent = await updateAgent(id, input)
    revalidatePath('/settings/agent-forge')
    return { success: true, agent }
  } catch (err: unknown) {
    console.error('updateAgentAction error:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function deleteAgentAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteAgent(id)
    revalidatePath('/settings/agent-forge')
    return { success: true }
  } catch (err: unknown) {
    console.error('deleteAgentAction error:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
