'use client'
// needed for interactive delete button handler + Recharts client rendering

import { X } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts'
import type { Widget } from '@/types/widget'
import type { WidgetValue } from '@/types/widget'

const SPARKLINE_HEIGHT = 32
const DEFAULT_BORDER_COLOR = '#1E1E1E'

type Props = {
  widget: Widget
  value: WidgetValue
  editMode: boolean
  onDelete: () => void
}

function Sparkline({ trend, color }: { trend: number[]; color: string }): React.ReactElement | null {
  if (trend.length < 2) return null

  try {
    const chartData = trend.map((v, i) => ({ i, v }))
    return (
      <div className="mt-3">
        <ResponsiveContainer width="100%" height={SPARKLINE_HEIGHT}>
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
            />
            <Tooltip
              contentStyle={{ background: '#0A0A0A', border: '1px solid #1E1E1E', fontSize: 11 }}
              itemStyle={{ color: '#F5F5F5' }}
              labelFormatter={() => ''}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  } catch {
    return null
  }
}

export function WidgetCard({ widget, value, editMode, onDelete }: Props): React.ReactElement {
  const color = widget.color ?? DEFAULT_BORDER_COLOR
  const borderHex = `${color}4D` // 30% opacity

  const displayValue = value.value !== null && value.value !== undefined
    ? String(value.value)
    : null

  return (
    <div
      className="relative flex min-h-[120px] flex-col rounded-xl border bg-surface p-4"
      style={{ borderColor: borderHex }}
    >
      {/* Header row */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="truncate text-xs font-medium text-textMuted">{value.label}</span>
        </div>
        {editMode && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${value.label} widget`}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surfaceHighlight text-textMuted transition-colors hover:bg-red-500/20 hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Value */}
      <div className="flex-1">
        {displayValue !== null ? (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-textPrimary">{displayValue}</span>
            {value.unit && (
              <span className="text-sm text-textMuted">{value.unit}</span>
            )}
          </div>
        ) : (
          <span className="text-3xl font-bold text-textMuted">—</span>
        )}
      </div>

      {/* Sparkline */}
      {value.trend && value.trend.length > 1 && (
        <Sparkline trend={value.trend} color={color} />
      )}
    </div>
  )
}
