import { evaluateFormula, buildFieldValueMap } from '@/lib/correlator/formula-engine'
import type { Widget, WidgetValue } from '@/types/widget'
import type { TrackerLog } from '@/types/log'
import type { FormulaNode } from '@/types/correlator'
import type { SupabaseClient } from '@supabase/supabase-js'

export type CorrelationRecord = { id: string; formula: FormulaNode; unit: string }

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

  // Extract values and handle potential non-numeric fields gracefully
  const values = data
    .map(row => {
      const raw = (row.fields as Record<string, unknown>)?.[widget.field_id!]
      return typeof raw === 'number' ? raw : null
    })
    .filter((v): v is number => v !== null && Number.isFinite(v))

  return values
}

/**
 * Optimized computation that accepts pre-fetched supabase client and userId
 * to avoid redundant network calls during batch processing.
 */
export async function computeWidgetValue(
  widget: Widget, 
  supabase: SupabaseClient, 
  userId: string
): Promise<WidgetValue> {
  const nDays = widget.days ?? SPARKLINE_DEFAULT_DAYS
  const since = getNDaysAgo(nDays)

  switch (widget.type) {
    case 'field_latest': {
      if (!widget.tracker_id || !widget.field_id) {
        return { value: null, label: widget.label }
      }

      // Latest value and Sparkline are fetched in parallel
      const [latestRes, trend] = await Promise.all([
        supabase
          .from('tracker_logs')
          .select('fields')
          .eq('user_id', userId)
          .eq('tracker_id', widget.tracker_id)
          .order('logged_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        getSparklineData(widget, SPARKLINE_DEFAULT_DAYS, supabase, userId)
      ])

      const raw = (latestRes.data?.fields as Record<string, unknown> | null)?.[widget.field_id] ?? null
      const value = raw !== null && (typeof raw === 'number' || typeof raw === 'string') ? raw : null

      return { value, label: widget.label, trend }
    }

    case 'field_average': {
      if (!widget.tracker_id || !widget.field_id) {
        return { value: null, label: widget.label }
      }

      const { data } = await supabase
        .from('tracker_logs')
        .select('fields')
        .eq('user_id', userId)
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
        .eq('user_id', userId)
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

      const [{ data: correlation }, { data: logs }] = await Promise.all([
        supabase
          .from('correlations')
          .select('formula, unit')
          .eq('id', widget.correlation_id)
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('tracker_logs')
          .select('id, tracker_id, user_id, fields, logged_at, source, created_at')
          .eq('user_id', userId)
          .gte('logged_at', since)
      ])

      if (!correlation) return { value: null, label: widget.label }

      const fieldMap = buildFieldValueMap((logs ?? []) as TrackerLog[])
      const result = evaluateFormula(correlation.formula, fieldMap)

      return {
        value: result !== null ? Math.round(result * 10) / 10 : null,
        unit: correlation.unit as string | undefined,
        label: widget.label,
      }
    }
    default:
      return { value: null, label: widget.label }
  }
}


export function computeWidgetValueOptimized(
  widget: Widget,
  allLogs: TrackerLog[],
  correlations: CorrelationRecord[]
): WidgetValue {
  const nDays = widget.days ?? SPARKLINE_DEFAULT_DAYS
  const cutoff = new Date(Date.now() - nDays * 24 * 60 * 60 * 1000)

  // Filter logs for this widget's tracker and timeframe
  const widgetLogs = allLogs.filter(l => 
    l.tracker_id === widget.tracker_id && 
    new Date(l.logged_at) >= cutoff
  )

  switch (widget.type) {
    case 'field_latest': {
      if (!widget.tracker_id || !widget.field_id) return { value: null, label: widget.label }

      // Latest log (logs are ordered desc)
      const latestLog = allLogs.find(l => l.tracker_id === widget.tracker_id)
      const raw = (latestLog?.fields as Record<string, unknown> | null)?.[widget.field_id] ?? null
      const value = raw !== null && (typeof raw === 'number' || typeof raw === 'string') ? raw : null

      // Trend (Sparkline) - use 7 days specifically as per current design
      const sparklineCutoff = new Date(Date.now() - SPARKLINE_DEFAULT_DAYS * 24 * 60 * 60 * 1000)
      const trend = allLogs
        .filter(l => l.tracker_id === widget.tracker_id && new Date(l.logged_at) >= sparklineCutoff)
        .reverse() // chronological
        .map(l => (l.fields as Record<string, unknown>)?.[widget.field_id!])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

      return { value, label: widget.label, trend }
    }

    case 'field_average': {
      if (!widget.tracker_id || !widget.field_id) return { value: null, label: widget.label }
      
      const values = widgetLogs
        .map(l => (l.fields as Record<string, unknown>)?.[widget.field_id!])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

      const avg = values.length > 0
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : null

      return { value: avg, label: widget.label }
    }

    case 'field_total': {
      if (!widget.tracker_id || !widget.field_id) return { value: null, label: widget.label }

      const values = widgetLogs
        .map(l => (l.fields as Record<string, unknown>)?.[widget.field_id!])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

      const total = values.length > 0
        ? values.reduce((a, b) => a + b, 0)
        : null

      return { value: total, label: widget.label }
    }

    case 'correlator': {
      if (!widget.correlation_id) return { value: null, label: widget.label }
      const correlation = correlations.find(c => c.id === widget.correlation_id)
      if (!correlation) return { value: null, label: widget.label }

      const fieldMap = buildFieldValueMap(widgetLogs)
      const result = evaluateFormula(correlation.formula, fieldMap)

      return {
        value: result !== null ? Math.round(result * 10) / 10 : null,
        unit: correlation.unit,
        label: widget.label,
      }
    }

    default:
      return { value: null, label: widget.label }
  }
}
