'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronLeft, Target, Save } from 'lucide-react'
import { updateTrackerAction, deleteTrackerAction } from '@/app/actions/trackers'
import { SchemaFieldRow } from '@/components/trackers/SchemaFieldRow'
import type { SchemaField, Tracker } from '@/types/tracker'

const MAX_SCHEMA_FIELDS = 20

type Props = {
  tracker: Tracker
}

function generateFieldId(): string {
  return `fld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function createEmptyField(): SchemaField {
  return {
    fieldId: generateFieldId(),
    label: '',
    type: 'number',
  }
}

export function SchemaEditor({ tracker }: Props): React.ReactElement {
  const router = useRouter()
  const [schema, setSchema] = useState<SchemaField[]>(tracker.schema)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<boolean>(false)
  const [deleting, setDeleting] = useState<boolean>(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false)
  const [deleteInput, setDeleteInput] = useState<string>('')

  function handleAddField(): void {
    if (schema.length >= MAX_SCHEMA_FIELDS) return
    setSchema((prev) => [...prev, createEmptyField()])
  }

  function handleFieldChange(index: number, updated: SchemaField): void {
    setSchema((prev) => prev.map((f, i) => (i === index ? updated : f)))
  }

  function handleFieldRemove(index: number): void {
    setSchema((prev) => prev.filter((_, i) => i !== index))
  }

  function handleMoveUp(index: number): void {
    if (index === 0) return
    setSchema(prev => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  function handleMoveDown(index: number): void {
    if (index === schema.length - 1) return
    setSchema(prev => {
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  async function handleSave(): Promise<void> {
    if (saving) return
    setError(null)
    setSaving(true)

    const filteredSchema = schema.filter((f) => f.label.trim() !== '')
    const result = await updateTrackerAction(tracker.id, { schema: filteredSchema })

    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      router.push('/trackers')
      // Do NOT reset saving — let component unmount to prevent double-submit
    }
  }

  async function handleDelete(): Promise<void> {
    if (deleteInput !== tracker.name) return
    setError(null)
    setDeleting(true)

    const result = await deleteTrackerAction(tracker.id)

    if (result.error) {
      setError(result.error)
      setDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteInput('')
    } else {
      router.push('/trackers')
      // Do NOT reset deleting — let component unmount to prevent double-submit
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }} />
          <div className="relative w-full max-w-sm rounded-3xl border border-red-500/20 bg-[#0A0A0A] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="mb-1 text-base font-black text-textPrimary">Delete Tracker</h3>
            <p className="mb-4 text-xs text-textMuted/60">
              Type <span className="font-bold text-textPrimary">{tracker.name}</span> to confirm deletion. This cannot be undone.
            </p>
            <input
              autoFocus
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={tracker.name}
              className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-textPrimary placeholder-textMuted/20 focus:border-red-500/40 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteInput !== tracker.name || deleting}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-textMuted transition-colors hover:text-textPrimary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-textMuted transition-colors hover:text-textPrimary"
      >
        <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Trackers
      </button>

      <div className="space-y-1">
        <h1 className="text-4xl font-black tracking-tight text-textPrimary">Edit Schema</h1>
        <p className="text-sm text-textMuted/60">Define the internal structure and metrics for your tracker.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100 italic">
          !! {error}
        </div>
      )}

      {/* Main Container */}
      <div className="rounded-2xl md:rounded-[40px] border border-white/5 bg-black/40 p-4 md:p-8 backdrop-blur-xl shadow-2xl relative group/container">
        {/* Glow effect — overflow-hidden scoped here so it never clips child content */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl md:rounded-[40px]">
          <div className="absolute -top-24 -right-24 h-48 w-48 blur-[100px] opacity-10" style={{ backgroundColor: tracker.color }} />
        </div>
        
        <div className="relative space-y-8">
          {/* Header Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div 
                className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner transition-transform group-hover/container:scale-110 active:scale-95 duration-500"
                style={{ 
                  backgroundColor: `${tracker.color}15`, 
                  border: `1px solid ${tracker.color}30`,
                  boxShadow: `0 0 20px -5px ${tracker.color}40`
                }}
              >
                <Target className="h-7 w-7" style={{ color: tracker.color }} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-textPrimary">{tracker.name}</h2>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddField}
              disabled={schema.length >= MAX_SCHEMA_FIELDS}
              className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-textPrimary transition-all hover:bg-white/10 active:scale-95 disabled:opacity-20 shadow-md"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3px]" />
              Add Field
            </button>
          </div>

          {/* Fields List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-textMuted opacity-30">
                Data Schema Map ({schema.length}/{MAX_SCHEMA_FIELDS})
              </h3>
            </div>

            {schema.length === 0 ? (
              <div className="rounded-[32px] border border-dashed border-white/10 p-12 text-center text-sm font-bold text-textMuted bg-white/[0.01]">
                No active fields.
              </div>
            ) : (
              <div className="space-y-3">
                {schema.map((field, index) => (
                  <SchemaFieldRow
                    key={field.fieldId}
                    field={field}
                    canMoveUp={index > 0}
                    canMoveDown={index < schema.length - 1}
                    onChange={(updated) => handleFieldChange(index, updated)}
                    onRemove={() => handleFieldRemove(index)}
                    onMoveUp={() => handleMoveUp(index)}
                    onMoveDown={() => handleMoveDown(index)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col gap-4 border-t border-white/5 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-[20px] px-8 py-3.5 text-xs font-black uppercase tracking-widest text-background transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl disabled:opacity-50"
                style={{
                  backgroundColor: tracker.color,
                  boxShadow: `0 8px 32px -8px ${tracker.color}60`,
                }}
              >
                {saving ? 'Syncing...' : (
                  <>
                    <Save className="h-4 w-4 stroke-[3px]" />
                    Save Schema
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push('/trackers')}
                className="text-xs font-black uppercase tracking-widest text-textMuted transition-colors hover:text-textPrimary px-4"
              >
                Cancel
              </button>
            </div>

            {/* Delete Trigger */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-[10px] font-black uppercase tracking-widest text-red-500/50 transition-colors hover:text-red-500 px-4"
            >
              Delete Tracker
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
