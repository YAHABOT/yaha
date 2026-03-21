'use client'
// needed for interactive delete button handler + Recharts client rendering

import { X } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts'
import type { Widget } from '@/types/widget'
import type { WidgetValue } from '@/types/widget'

const SPARKLINE_HEIGHT = 36
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
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={SPARKLINE_HEIGHT}>
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2}
              dot={false}
            />
            <Tooltip
              contentStyle={{
                background: '#0A0A0A',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                fontSize: 11,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
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
  const borderHex = `${color}33` // 20% opacity for subtle border
  const glowHex = `${color}1A`   // 10% opacity for glow

  const displayValue = value.value !== null && value.value !== undefined
    ? String(value.value)
    : null

  return (
    <div
      className="group relative flex min-h-[130px] flex-col rounded-2xl border bg-surface p-5 backdrop-blur-sm transition-all duration-300 hover:bg-surfaceHighlight"
      style={{
        borderColor: borderHex,
        background: `linear-gradient(135deg, ${glowHex} 0%, #0A0A0A 60%)`,
      }}
    >
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
          />
          <span className="truncate text-[10px] font-black uppercase tracking-[0.15em] text-textMuted">
            {value.label}
          </span>
        </div>
        {editMode && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${value.label} widget`}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-textMuted transition-all duration-200 hover:border-red-500/40 hover:bg-red-500/20 hover:text-red-400"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Value */}
      <div className="flex-1">
        {displayValue !== null ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-textPrimary leading-none">{displayValue}</span>
            {value.unit && (
              <span className="text-xs font-medium text-textMuted">{value.unit}</span>
            )}
          </div>
        ) : (
          <span className="text-3xl font-black text-textMuted/40 leading-none">—</span>
        )}
      </div>

      {/* Sparkline */}
      {value.trend && value.trend.length > 1 && (
        <Sparkline trend={value.trend} color={color} />
      )}
    </div>
  )
}
