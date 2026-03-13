import { createServerClient } from '@/lib/supabase/server'
import { evaluateFormula, buildFieldValueMap } from '@/lib/correlator/formula-engine'
import type { Widget, WidgetValue } from '@/types/widget'
import type { TrackerLog } from '@/types/log'
import type { SupabaseClient } from '@supabase/supabase-js'

const SPARKLINE_DEFAULT_DAYS = 7

function getNDaysAgo(nDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - nDays)
  return d.toISOString()
}

async function getSparklineData(
  widget: Widget,
  nDays: number,
  supabase: SupabaseClient,
  userId: string,
): Promise<number[]> {
  if (!widget.tracker_id || !widget.field_id) return []

  const since = getNDaysAgo(nDays)

  const { data } = await supabase
    .from('tracker_logs')
    .select('fields, logged_at')
    .eq('user_id', userId)
    .eq('tracker_id', widget.tracker_id)
    .gte('logged_at', since)
    .order('logged_at', { ascending: true })

  if (!data) return []

  const values = data
    .map(row => {
      const raw = (row.fields as Record<string, unknown>)?.[widget.field_id!]
      return typeof raw === 'number' ? raw : null
    })
    .filter((v): v is number => v !== null && Number.isFinite(v))

  return values
}

export async function computeWidgetValue(widget: Widget): Promise<WidgetValue> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const nDays = widget.days ?? SPARKLINE_DEFAULT_DAYS
  const since = getNDaysAgo(nDays)

  switch (widget.type) {
    case 'field_latest': {
      if (!widget.tracker_id || !widget.field_id) {
        return { value: null, label: widget.label }
      }

      const { data } = await supabase
        .from('tracker_logs')
        .select('fields')
        .eq('user_id', user.id)
        .eq('tracker_id', widget.tracker_id)
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const raw = (data?.fields as Record<string, unknown> | null)?.[widget.field_id] ?? null
      const value = raw !== null && (typeof raw === 'number' || typeof raw === 'string') ? raw : null
      const trend = await getSparklineData(widget, SPARKLINE_DEFAULT_DAYS, supabase, user.id)

      return { value, label: widget.label, trend }
    }

    case 'field_average': {
      if (!widget.tracker_id || !widget.field_id) {
        return { value: null, label: widget.label }
      }

      const { data } = await supabase
        .from('tracker_logs')
        .select('fields')
        .eq('user_id', user.id)
        .eq('tracker_id', widget.tracker_id)
        .gte('logged_at', since)

      const values = (data ?? [])
        .map(row => {
          const raw = (row.fields as Record<string, unknown>)?.[widget.field_id!]
          return typeof raw === 'number' ? raw : null
        })
        .filter((v): v is number => v !== null && Number.isFinite(v))

      const avg = values.length > 0
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : null

      return { value: avg, label: widget.label }
    }

    case 'field_total': {
      if (!widget.tracker_id || !widget.field_id) {
        return { value: null, label: widget.label }
      }

      const { data } = await supabase
        .from('tracker_logs')
        .select('fields')
        .eq('user_id', user.id)
        .eq('tracker_id', widget.tracker_id)
        .gte('logged_at', since)

      const values = (data ?? [])
        .map(row => {
          const raw = (row.fields as Record<string, unknown>)?.[widget.field_id!]
          return typeof raw === 'number' ? raw : null
        })
        .filter((v): v is number => v !== null && Number.isFinite(v))

      const total = values.length > 0
        ? values.reduce((a, b) => a + b, 0)
        : null

      return { value: total, label: widget.label }
    }

    case 'correlator': {
      if (!widget.correlation_id) {
        return { value: null, label: widget.label }
      }

      const { data: correlation, error: corrErr } = await supabase
        .from('correlations')
        .select('formula, unit')
        .eq('id', widget.correlation_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (corrErr || !correlation) return { value: null, label: widget.label }

      const { data: logs } = await supabase
        .from('tracker_logs')
        .select('id, tracker_id, user_id, fields, logged_at, source, created_at')
        .eq('user_id', user.id)
        .gte('logged_at', since)

      const fieldMap = buildFieldValueMap((logs ?? []) as TrackerLog[])
      const result = evaluateFormula(correlation.formula, fieldMap)

      return {
        value: result !== null ? Math.round(result * 10) / 10 : null,
        unit: correlation.unit as string | undefined,
        label: widget.label,
      }
    }

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustive: never = widget.type
      return { value: null, label: widget.label }
    }
  }
}
