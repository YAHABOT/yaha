'use client' // Needed: controlled inputs, optimistic save state, window.confirm for danger actions

import { useState, useTransition } from 'react'
import { saveSettingsAction } from '@/app/actions/settings'
import type { User } from '@/lib/db/users'

const SAVE_RESET_DELAY_MS = 2000

type Props = {
  initialValues: User | null
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function StatusPill({
  color,
  label,
}: {
  color: 'green' | 'red'
  label: string
}): React.ReactElement {
  const dotColor = color === 'green' ? 'bg-nutrition' : 'bg-red-500'
  const textColor = color === 'green' ? 'text-nutrition' : 'text-red-400'
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border bg-surfaceHighlight px-3 py-1 text-xs font-medium">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <span className={textColor}>{label}</span>
    </span>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-textMuted">
        {title}
      </h2>
      {children}
    </div>
  )
}

function TargetInput({
  id,
  label,
  unit,
  name,
  defaultValue,
  placeholder,
  max,
  step,
}: {
  id: string
  label: string
  unit: string
  name: string
  defaultValue: number | undefined
  placeholder: string
  max: number
  step?: number
}): React.ReactElement {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium uppercase tracking-wider text-textMuted">
        {label}
        <span className="ml-1 normal-case text-textMuted/60">({unit})</span>
      </label>
      <input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={step ?? 1}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surfaceHighlight px-3 py-2.5 text-textPrimary placeholder-textMuted/40 focus:border-nutrition focus:outline-none focus:ring-1 focus:ring-nutrition"
      />
    </div>
  )
}

export function SettingsForm({ initialValues }: Props): React.ReactElement {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    setSaveState('saving')
    setErrorMessage(null)

    startTransition(async () => {
      const result = await saveSettingsAction(formData)
      if (result.error) {
        setSaveState('error')
        setErrorMessage(result.error)
      } else {
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), SAVE_RESET_DELAY_MS)
      }
    })
  }

  function handleClearLocalData(): void {
    const confirmed = window.confirm(
      'Clear all local data? This will reset any unsaved preferences in your browser.'
    )
    if (!confirmed) return
    localStorage.clear()
    sessionStorage.clear()
  }

  function handleExportJson(): void {
    if (!initialValues) return
    const blob = new Blob([JSON.stringify(initialValues, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'yaha-profile.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const isSaving = isPending || saveState === 'saving'

  let saveButtonLabel = 'Save All Changes'
  if (isSaving) saveButtonLabel = 'Saving...'
  else if (saveState === 'saved') saveButtonLabel = 'Saved!'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Identity & System */}
      <SectionCard title="Identity & System">
        <div className="mb-4">
          <label
            htmlFor="alias"
            className="mb-1 block text-xs font-medium uppercase tracking-wider text-textMuted"
          >
            Alias
          </label>
          <input
            id="alias"
            name="alias"
            type="text"
            maxLength={50}
            defaultValue={initialValues?.alias ?? ''}
            placeholder="Your name"
            className="w-full rounded-lg border border-border bg-surfaceHighlight px-3 py-2.5 text-textPrimary placeholder-textMuted/40 focus:border-nutrition focus:outline-none focus:ring-1 focus:ring-nutrition"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill color="green" label="SUPABASE ONLINE" />
          <StatusPill color="green" label="GEMINI READY" />
        </div>
      </SectionCard>

      {/* Daily Targets */}
      <SectionCard title="Daily Targets">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <TargetInput
            id="calories"
            label="Calories"
            unit="kcal"
            name="calories"
            defaultValue={initialValues?.targets?.calories}
            placeholder="2000"
            max={10000}
          />
          <TargetInput
            id="sleep"
            label="Sleep Goal"
            unit="hrs"
            name="sleep"
            defaultValue={initialValues?.targets?.sleep}
            placeholder="8"
            max={24}
            step={0.5}
          />
          <TargetInput
            id="water"
            label="Water Goal"
            unit="L"
            name="water"
            defaultValue={initialValues?.targets?.water}
            placeholder="2.5"
            max={20}
            step={0.1}
          />
          <TargetInput
            id="steps"
            label="Steps Goal"
            unit="steps"
            name="steps"
            defaultValue={initialValues?.targets?.steps}
            placeholder="10000"
            max={100000}
          />
        </div>
      </SectionCard>

      {/* Communication Channels */}
      <SectionCard title="Communication Channels">
        <label
          htmlFor="telegram_handle"
          className="mb-1 block text-xs font-medium uppercase tracking-wider text-textMuted"
        >
          Telegram Handle
        </label>
        <div className="flex items-center rounded-lg border border-border bg-surfaceHighlight focus-within:border-nutrition focus-within:ring-1 focus-within:ring-nutrition">
          <span className="pl-3 text-sm text-textMuted">@</span>
          <input
            id="telegram_handle"
            name="telegram_handle"
            type="text"
            maxLength={50}
            defaultValue={
              initialValues?.telegram_handle
                ? initialValues.telegram_handle.replace(/^@/, '')
                : ''
            }
            placeholder="username"
            className="w-full rounded-lg bg-transparent px-2 py-2.5 text-textPrimary placeholder-textMuted/40 focus:outline-none"
          />
        </div>
        <p className="mt-1.5 text-xs text-textMuted">
          Used for Telegram bot integration
        </p>
      </SectionCard>

      {/* Save button */}
      {errorMessage && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="w-full rounded-xl bg-nutrition py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saveButtonLabel}
      </button>

      {/* Data Management */}
      <SectionCard title="Data Management">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportJson}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-textMuted transition-colors hover:border-white/20 hover:text-textPrimary"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={handleClearLocalData}
            className="rounded-lg border border-red-900 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-500/10"
          >
            Clear Local Data
          </button>
        </div>
      </SectionCard>
    </form>
  )
}
