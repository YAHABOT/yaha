export type FieldType = 'number' | 'text' | 'rating' | 'time' | 'select'

export type SelectFieldDef = {
  type: 'select'
  options: string[]
  multiSelect?: boolean
}

export type SchemaField = {
  fieldId: string   // "fld_001" — stable ID, never changes
  label: string     // "Calories" — display name
  type: FieldType
  unit?: string     // "kcal", "hrs"
  selectOptions?: string[]  // for type='select': array of option strings
  multiSelect?: boolean     // for type='select': whether to allow multiple selections
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
