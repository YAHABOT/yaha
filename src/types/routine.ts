export type RoutineType = 'standard' | 'day_start' | 'day_end'

export type RoutineStep = {
  trackerId: string
  trackerName: string
  trackerColor: string // hex color
  targetFields: string[] // fieldIds
}

export type Routine = {
  id: string
  user_id: string
  name: string
  trigger_phrase: string
  type: RoutineType
  steps: RoutineStep[]
  created_at: string
}

export type CreateRoutineInput = Omit<Routine, 'id' | 'user_id' | 'created_at'>
export type UpdateRoutineInput = Partial<CreateRoutineInput>
