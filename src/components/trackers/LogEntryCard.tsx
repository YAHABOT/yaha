import type { TrackerLog } from '@/types/log'
import type { SchemaField } from '@/types/tracker'

type Props = {
  log: TrackerLog
  schema: SchemaField[]
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

function formatFieldValue(value: number | string | null, field: SchemaField): string {
  if (value === null || value === undefined) return '—'

  if (field.type === 'rating') {
    const num = Number(value)
    return `${num}/10`
  }

  if (field.unit) {
    return `${value} ${field.unit}`
  }

  return String(value)
}

export function LogEntryCard({ log, schema }: Props): React.ReactElement {
  const filledFields = schema.filter(
    (field) => log.fields[field.fieldId] !== null && log.fields[field.fieldId] !== undefined
  )

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-textMuted">{formatTime(log.logged_at)}</span>
        {log.source !== 'manual' && (
          <span className="rounded bg-surfaceHighlight px-1.5 py-0.5 text-xs text-textMuted">
            {log.source}
          </span>
        )}
      </div>

      {filledFields.length === 0 ? (
        <p className="text-sm text-textMuted">No fields recorded</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {filledFields.map((field) => (
            <div key={field.fieldId}>
              <dt className="text-xs text-textMuted">{field.label}</dt>
              <dd className="text-sm font-medium text-textPrimary">
                {formatFieldValue(log.fields[field.fieldId] ?? null, field)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
