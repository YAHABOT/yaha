import { getCorrelations } from '@/lib/db/correlations'
import { deleteCorrelationAction } from '@/app/actions/correlations'
import type { Correlation } from '@/types/correlator'

type DeleteButtonProps = {
  id: string
}

async function DeleteCorrelationButton({ id }: DeleteButtonProps): Promise<React.ReactElement> {
  // Inline server action: wraps deleteCorrelationAction and discards the return value
  // so the form action type satisfies (formData: FormData) => Promise<void>
  async function handleDelete(): Promise<void> {
    'use server'
    await deleteCorrelationAction(id)
  }
  return (
    <form action={handleDelete}>
      <button
        type="submit"
        className="rounded-md px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-400/10 transition-colors"
      >
        Delete
      </button>
    </form>
  )
}

function FormulaDisplay({ formula }: { formula: Correlation['formula'] }): React.ReactElement {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md bg-background p-2 text-xs text-textMuted font-mono whitespace-pre-wrap break-all">
      {JSON.stringify(formula, null, 2)}
    </pre>
  )
}

export default async function CorrelationsPage(): Promise<React.ReactElement> {
  let correlations: Correlation[] = []
  let fetchError: string | null = null

  try {
    correlations = await getCorrelations()
  } catch (e) {
    fetchError = e instanceof Error ? e.message : 'Failed to load correlations'
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-textPrimary">Correlations</h1>
        <p className="mt-2 text-sm text-textMuted">
          Correlations are formula-driven metrics that compute values across multiple tracker
          fields. For example, you can sum calories across separate meal trackers or calculate
          a net energy balance from intake minus expenditure. Results appear in the journal and
          dashboard as a single computed value. Correlations display &quot;---&quot; when any
          required field data is missing for the selected day.
        </p>
      </div>

      {/* Error state */}
      {fetchError && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{fetchError}</p>
        </div>
      )}

      {/* Empty state */}
      {!fetchError && correlations.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-base font-medium text-textPrimary">No correlations yet</p>
          <p className="mt-2 text-sm text-textMuted">
            Correlations let you build formula metrics like &quot;Total Calories&quot; by
            combining fields from one or more trackers using arithmetic. Create one via the
            API or settings once a formula builder UI is available.
          </p>
        </div>
      )}

      {/* Correlation list */}
      {correlations.length > 0 && (
        <div className="space-y-4">
          {correlations.map((correlation) => (
            <div
              key={correlation.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-textPrimary">
                      {correlation.name}
                    </h2>
                    {correlation.unit && (
                      <span className="rounded-md bg-surfaceHighlight px-2 py-0.5 text-xs text-textMuted">
                        {correlation.unit}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-textMuted">
                    ID: {correlation.id}
                  </p>
                  <FormulaDisplay formula={correlation.formula} />
                </div>
                <DeleteCorrelationButton id={correlation.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
