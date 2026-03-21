export type LogSource = 'manual' | 'web' | 'telegram' | 'chat'

export type LogFields = Record<string, number | string | null>

export type TrackerLog = {
  id: string
  tracker_id: string
  user_id: string
  fields: LogFields
  logged_at: string
  source: LogSource
  created_at: string
}

export type CreateLogInput = {
  tracker_id: string
  fields: LogFields
  logged_at?: string
  source?: LogSource
}

export type UpdateLogInput = {
  fields?: LogFields
  logged_at?: string
}
