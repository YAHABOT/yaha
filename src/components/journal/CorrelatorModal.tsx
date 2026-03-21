'use client'

import { useState, useTransition } from 'react'
import { X, GitBranch, Plus, Trash2, Pencil, ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Tracker } from '@/types/tracker'
import type { Correlation, FormulaNode } from '@/types/correlator'
import {
  createCorrelationAction,
  deleteCorrelationAction,
  updateCorrelationAction,
} from '@/app/actions/correlations'

type Props = {
  trackers: Tracker[]
  correlations: Correlation[]
  onClose: () => void
}

type VariableRow = {
  id: string
  operator: '+' | '-' | '*' | '/'
  trackerId: string
  fieldId: string
}

const OPERATORS: Array<{ value: '+' | '-' | '*' | '/'; label: string }> = [
  { value: '+', label: '+' },
  { value: '-', label: '−' },
  { value: '*', label: '×' },
  { value: '/', label: '÷' },
]

const DEFAULT_ROWS: VariableRow[] = [
  { id: '1', operator: '+', trackerId: '', fieldId: '' },
  { id: '2', operator: '+', trackerId: '', fieldId: '' },
]

function buildFormula(rows: VariableRow[]): FormulaNode | null {
  if (rows.length === 0) return null

  const valid = rows.filter(r => r.trackerId && r.fieldId)
  if (valid.length === 0) return null

  let tree: FormulaNode = { type: 'field', trackerId: valid[0].trackerId, fieldId: valid[0].fieldId }

  for (let i = 1; i < valid.length; i++) {
    tree = {
      type: 'op',
      operator: valid[i].operator,
      left: tree,
      right: { type: 'field', trackerId: valid[i].trackerId, fieldId: valid[i].fieldId },
    }
  }

  return tree
}

function formulaToRows(formula: FormulaNode): VariableRow[] {
  const rows: VariableRow[] = []

  function traverse(node: FormulaNode, operator: VariableRow['operator'] = '+'): void {
    if (node.type === 'field') {
      rows.push({ id: String(Date.now() + rows.length), operator, trackerId: node.trackerId, fieldId: node.fieldId })
    } else if (node.type === 'op') {
      traverse(node.left, '+')
      traverse(node.right, node.operator)
    }
  }

  traverse(formula)
  return rows.length > 0 ? rows : [
    { id: '1', operator: '+', trackerId: '', fieldId: '' },
    { id: '2', operator: '+', trackerId: '', fieldId: '' },
  ]
}

function getFieldOptions(trackers: Tracker[]): Array<{ label: string; trackerId: string; fieldId: string }> {
  const opts: Array<{ label: string; trackerId: string; fieldId: string }> = []
  for (const t of trackers) {
    for (const f of t.schema) {
      if (f.type === 'number' || f.type === 'rating' || f.type === 'time') {
        opts.push({ label: `${t.name}: ${f.label}`, trackerId: t.id, fieldId: f.fieldId })
      }
    }
  }
  return opts
}

export function CorrelatorModal({ trackers, correlations, onClose }: Props): React.ReactElement {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [view, setView] = useState<'list' | 'new' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [rows, setRows] = useState<VariableRow[]>(DEFAULT_ROWS)
  const [error, setError] = useState<string | null>(null)

  const fieldOptions = getFieldOptions(trackers)

  function addRow(): void {
    setRows(prev => [...prev, { id: String(Date.now()), operator: '+', trackerId: '', fieldId: '' }])
  }

  function removeRow(id: string): void {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function updateRow(id: string, patch: Partial<VariableRow>): void {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function handleEdit(correlation: Correlation): void {
    setEditingId(correlation.id)
    setName(correlation.name)
    setUnit(correlation.unit ?? '')
    setRows(formulaToRows(correlation.formula))
    setView('edit')
    setError(null)
  }

  function handleCancelEdit(): void {
    setView('list')
    setEditingId(null)
    setError(null)
  }

  function resetForm(): void {
    setName('')
    setUnit('')
    setRows([
      { id: '1', operator: '+', trackerId: '', fieldId: '' },
      { id: '2', operator: '+', trackerId: '', fieldId: '' },
    ])
    setError(null)
  }

  function handleSave(): void {
    setError(null)
    const formula = buildFormula(rows)
    if (!formula) { setError('Add at least one valid variable.'); return }
    if (!name.trim()) { setError('Name is required.'); return }

    startTransition(async () => {
      if (view === 'edit' && editingId) {
        const res = await updateCorrelationAction(editingId, { name: name.trim(), formula, unit: unit.trim() })
        if (res.error) {
          setError(res.error)
        } else {
          setEditingId(null)
          setView('list')
          resetForm()
          router.refresh()
        }
      } else {
        const res = await createCorrelationAction({ name: name.trim(), formula, unit: unit.trim() })
        if (res.error) {
          setError(res.error)
        } else {
          router.refresh()
          onClose()
        }
      }
    })
  }

  function handleDelete(id: string): void {
    startTransition(async () => {
      await deleteCorrelationAction(id)
      router.refresh()
    })
  }

  const isFormView = view === 'new' || view === 'edit'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative mx-4 w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            {view === 'edit' && (
              <button
                onClick={handleCancelEdit}
                className="rounded-lg p-1 text-textMuted transition-colors hover:bg-surfaceHighlight hover:text-textPrimary"
                aria-label="Back to list"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <GitBranch className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-textPrimary">
              {view === 'edit' ? 'Edit Metric' : 'Correlator'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <button
                onClick={() => { resetForm(); setView('new') }}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition-all hover:scale-[1.02]"
              >
                <Plus className="h-3 w-3" /> New Metric
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-textMuted hover:bg-surfaceHighlight">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {view === 'list' ? (
            /* List view */
            <div className="divide-y divide-border">
              {correlations.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-textMuted">No correlations yet. Create one!</p>
                </div>
              ) : (
                correlations.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-textPrimary">{c.name}</p>
                      {c.unit && <p className="text-xs text-textMuted">{c.unit}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(c)}
                        className="rounded-lg p-1.5 text-textMuted transition-colors hover:bg-white/[0.05] hover:text-textPrimary"
                        aria-label={`Edit ${c.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={isPending}
                        className="rounded-lg p-1.5 text-textMuted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* New / Edit correlation form */
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-textMuted">
                    Metric Name
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Net Calories"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary placeholder:text-textMuted/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-textMuted">
                    Unit
                  </label>
                  <input
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="e.g. kcal"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary placeholder:text-textMuted/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-textMuted">Formula</label>
                <div className="space-y-2">
                  {rows.map((row, idx) => (
                    <div key={row.id} className="flex items-center gap-2">
                      {idx > 0 && (
                        <div className="flex gap-1">
                          {OPERATORS.map(op => (
                            <button
                              key={op.value}
                              onClick={() => updateRow(row.id, { operator: op.value })}
                              className={`min-w-[28px] rounded-lg px-2 py-1.5 text-sm font-bold transition-colors ${
                                row.operator === op.value
                                  ? 'bg-primary text-white'
                                  : 'bg-surfaceHighlight text-textMuted hover:bg-primary/20 hover:text-primary'
                              }`}
                            >
                              {op.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {idx === 0 && <div className="w-[88px] flex-shrink-0" />}

                      <select
                        value={`${row.trackerId}::${row.fieldId}`}
                        onChange={e => {
                          const [tid, fid] = e.target.value.split('::')
                          updateRow(row.id, { trackerId: tid, fieldId: fid })
                        }}
                        className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-textPrimary focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      >
                        <option value="::">Select field...</option>
                        {fieldOptions.map(opt => (
                          <option key={`${opt.trackerId}::${opt.fieldId}`} value={`${opt.trackerId}::${opt.fieldId}`}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      {rows.length > 1 && (
                        <button onClick={() => removeRow(row.id)} className="p-1.5 text-textMuted hover:text-red-400">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addRow}
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add Variable
                </button>
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {isFormView && (
          <div className="flex gap-2 border-t border-border px-5 py-4">
            <button
              onClick={view === 'edit' ? handleCancelEdit : () => { setView('list'); setError(null) }}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-textMuted transition-colors hover:bg-surfaceHighlight"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              {isPending ? 'Saving...' : view === 'edit' ? 'Update Metric' : 'Save Metric'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
