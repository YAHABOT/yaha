export type FieldType = 'number' | 'text' | 'rating' | 'time'

export type SchemaField = {
  fieldId: string   // "fld_001" — stable ID, never changes
  label: string     // "Calories" — display name
  type: FieldType
  unit?: string     // "kcal", "hrs"
}

export type TrackerType = 'nutrition' | 'sleep' | 'workout' | 'mood' | 'water' | 'custom'

export type Tracker = {
  id: string
  user_id: string
  name: string
  type: TrackerType
  color: string
  schema: SchemaField[]
  created_at: string
  updated_at: string
}

export type CreateTrackerInput = {
  name: string
  type?: TrackerType
  color?: string
  schema?: SchemaField[]
}

export type UpdateTrackerInput = {
  name?: string
  type?: TrackerType
  color?: string
  schema?: SchemaField[]
}
