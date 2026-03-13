export type WidgetType = 'field_latest' | 'field_average' | 'field_total' | 'correlator'

export const WIDGET_TYPES: WidgetType[] = [
  'field_latest',
  'field_average',
  'field_total',
  'correlator',
]

export type Widget = {
  id: string
  user_id: string
  type: WidgetType
  label: string
  tracker_id?: string
  field_id?: string
  correlation_id?: string
  days?: number
  position: number
  color?: string
}

export type WidgetValue = {
  value: number | string | null
  unit?: string
  trend?: number[]
  label: string
}

export type CreateWidgetInput = Omit<Widget, 'id' | 'user_id'>
