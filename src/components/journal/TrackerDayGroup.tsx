import type { Tracker } from '@/types/tracker'
import type { TrackerLog, LogSource } from '@/types/log'
import { formatFieldValue } from '@/lib/utils/format'

type Props = {
  tracker: Tracker
  logs: TrackerLog[]
}

const SOURCE_LABELS: Record<LogSource, string> = {
  manual: 'manual',
  web: 'web',
  telegram: 'telegram',
  chat: 'chat',
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}


function getSourceBadgeClass(source: LogSource): string {
  if (source === 'telegram') return 'bg-sleep/10 text-sleep border border-sleep/20'
  if (source === 'web') return 'bg-nutrition/10 text-nutrition border border-nutrition/20'
  if (source === 'chat') return 'bg-mood/10 text-mood border border-mood/20'
  return 'bg-white/[0.04] text-textMuted border border-white/5'
}

export function TrackerDayGroup({ tracker, logs }: Props): React.ReactElement {
  const logCount = logs.length

  return (
    <div
      className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md transition-all duration-300"
      style={{ boxShadow: `0 0 0 1px ${tracker.color}18, inset 0 0 24px ${tracker.color}06` }}
    >
      {/* Tracker header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Colored icon badge */}
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${tracker.color}18`,
              border: `1px solid ${tracker.color}30`,
              boxShadow: `0 0 10px ${tracker.color}20`,
            }}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: tracker.color }}
              data-testid="tracker-color-dot"
            />
          </div>
          <div>
            <h3 className="text-sm font-bold text-textPrimary leading-tight">
              {tracker.name}
            </h3>
          </div>
        </div>
        {/* Log count badge */}
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
          style={{
            backgroundColor: `${tracker.color}15`,
            color: tracker.color,
            border: `1px solid ${tracker.color}25`,
          }}
        >
          {logCount} {logCount === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Log entries */}
      <div className="space-y-2.5">
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded-xl border border-white/[0.04] bg-background/60 px-4 py-3 transition-all duration-300 hover:bg-background/80 hover:border-white/[0.07]"
          >
            {/* Log entry header */}
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-textMuted">
                {formatTime(log.logged_at)}
              </span>
              <span
                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${getSourceBadgeClass(log.source)}`}
              >
                {SOURCE_LABELS[log.source] ?? log.source}
              </span>
            </div>

            {/* Field values — ordered by tracker schema, not JSONB key order */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {tracker.schema
                .filter((schemaField) => log.fields[schemaField.fieldId] !== undefined)
                .map((schemaField) => {
                  const value = log.fields[schemaField.fieldId]
                  const label = schemaField.label
                  const unit = schemaField.unit

                  return (
                    <div key={schemaField.fieldId}>
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-textMuted">{label}</span>
                      <span className="text-sm font-semibold text-textPrimary">
                        {formatFieldValue(value, unit, label)}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
