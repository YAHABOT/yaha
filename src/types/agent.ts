export type Agent = {
  id: string
  user_id: string
  name: string
  trigger: string
  exit_trigger: string
  system_prompt: string
  color: string
  schema: unknown[]
  created_at: string
  updated_at: string
}

export type CreateAgentInput = Omit<Agent, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type UpdateAgentInput = Partial<CreateAgentInput>
