import type { Tracker } from '@/types/tracker'
import type { TrackerLog, LogSource } from '@/types/log'

type Props = {
  tracker: Tracker
  logs: TrackerLog[]
}

const SOURCE_LABELS: Record<LogSource, string> = {
  manual: 'manual',
  web: 'web',
  telegram: 'telegram',
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatFieldValue(value: number | string | null, unit?: string): string {
  if (value === null || value === undefined || value === '') return '---'
  const display = String(value)
  return unit ? `${display} ${unit}` : display
}

function getSourceBadgeClass(source: LogSource): string {
  if (source === 'telegram') return 'bg-sleep/10 text-sleep'
  if (source === 'web') return 'bg-nutrition/10 text-nutrition'
  return 'bg-surfaceHighlight text-textMuted'
}

export function TrackerDayGroup({ tracker, logs }: Props): React.ReactElement {
  const logCount = logs.length

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {/* Tracker header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
            style={{ backgroundColor: tracker.color }}
            data-testid="tracker-color-dot"
          />
          <h3 className="text-base font-semibold text-textPrimary">
            {tracker.name}
          </h3>
        </div>
        <span className="text-xs text-textMuted">
          {logCount} {logCount === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Log entries */}
      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded-lg border border-border bg-background px-4 py-3"
          >
            {/* Log entry header */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-textMuted">
                {formatTime(log.logged_at)}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${getSourceBadgeClass(log.source)}`}
              >
                {SOURCE_LABELS[log.source] ?? log.source}
              </span>
            </div>

            {/* Field values */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {Object.entries(log.fields).map(([fieldId, value]) => {
                const schemaField = tracker.schema.find((f) => f.fieldId === fieldId)
                const label = schemaField?.label ?? fieldId
                const unit = schemaField?.unit

                return (
                  <div key={fieldId}>
                    <span className="block text-xs text-textMuted">{label}</span>
                    <span className="text-sm font-medium text-textPrimary">
                      {formatFieldValue(value, unit)}
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
