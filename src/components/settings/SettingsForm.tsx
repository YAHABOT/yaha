'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  saveSettingsAction,
  updateConfirmOnRefreshAction
} from '@/app/actions/settings'
import { signOut } from '@/app/actions/auth'
import type { User } from '@/lib/db/users'
import {
  Bot,
  Workflow,
  Webhook,
  FlaskConical,
  ShieldCheck,
  Zap,
  Clock,
  Droplets,
  Footprints,
  Calculator,
  Download,
  Trash2,
  Save,
  CheckCircle2,
  LogOut
} from 'lucide-react'

const SAVE_RESET_DELAY_MS = 2000

type Props = {
  initialValues: User | null
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[32px] border border-white/5 bg-white/[0.02] p-8 backdrop-blur-3xl shadow-2xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-textPrimary tracking-tight">{title}</h2>
        {description && <p className="text-sm text-textMuted opacity-60">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function DeveloperButton({ 
  icon: Icon, 
  label, 
  href, 
  colorClass 
}: { 
  icon: React.ElementType; 
  label: string; 
  href: string; 
  colorClass: string 
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 transition-all hover:scale-[1.02] active:scale-98 shadow-lg group ${colorClass}`}
    >
      <Icon className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
      <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
    </Link>
  )
}

export function SettingsForm({ initialValues }: Props): React.ReactElement {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [isPending, startTransition] = useTransition()
  const [confirmOnRefresh, setConfirmOnRefresh] = useState<boolean>(
    initialValues?.stats?.confirmOnRefresh ?? true
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    setSaveState('saving')

    startTransition(async () => {
      const result = await saveSettingsAction(formData)
      if (result.error) {
        setSaveState('error')
      } else {
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), SAVE_RESET_DELAY_MS)
      }
    })
  }

  function handleClearLocalData(): void {
    const confirmed = window.confirm('Clear all local data? This will reset any unsaved preferences in your browser.')
    if (!confirmed) return
    localStorage.clear()
    sessionStorage.clear()
    alert('Local data cleared.')
  }

  function handleConfirmOnRefreshToggle(enabled: boolean): void {
    setConfirmOnRefresh(enabled)
    startTransition(async () => {
      await updateConfirmOnRefreshAction(enabled)
    })
  }

  function handleExportJson(): void {
    if (!initialValues) return
    const blob = new Blob([JSON.stringify(initialValues, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'yaha-profile.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const isSaving = isPending || saveState === 'saving'

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* Identity & System */}
      <Section title="Identity & System" description="Manage your persona and developer access.">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-40 mb-2 block">Alias</label>
            <input
              name="alias"
              defaultValue={initialValues?.alias ?? ''}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-bold text-textPrimary placeholder:text-textMuted/20 focus:border-nutrition/50 focus:outline-none focus:ring-1 focus:ring-nutrition/20 transition-all duration-300"
              placeholder="Unknown"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-40 mb-2 block">Developer Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <DeveloperButton 
                icon={FlaskConical} 
                label="Mock Mode" 
                href="#" 
                colorClass="hover:border-red-500/30 hover:shadow-red-500/5 text-red-400/80 hover:text-red-400" 
              />
              <DeveloperButton 
                icon={Webhook} 
                label="Webhook" 
                href="#" 
                colorClass="hover:border-nutrition/30 hover:shadow-nutrition/5 text-nutrition/80 hover:text-nutrition" 
              />
              <DeveloperButton
                icon={Bot}
                label="Agent Forge"
                href="/settings/agent-forge"
                colorClass="hover:border-sleep/30 hover:shadow-sleep/5 text-sleep/80 hover:text-sleep"
              />
              <DeveloperButton 
                icon={Workflow} 
                label="Routines" 
                href="/settings/routines" 
                colorClass="hover:border-purple-500/30 hover:shadow-purple-500/5 text-purple-400/80 hover:text-purple-400" 
              />
            </div>
          </div>
        </div>
      </Section>

      {/* System Status */}
      <Section title="System Status">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-5 py-4">
            <span className="text-xs font-bold text-textMuted">Supabase Cloud</span>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-nutrition shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-nutrition">Online</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-5 py-4">
            <span className="text-xs font-bold text-textMuted">Gemini AI</span>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-nutrition shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-nutrition">Ready</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Daily Targets */}
      <Section title="Daily Targets">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { id: 'calories', label: 'Calories', unit: 'kcal', icon: Calculator, color: 'text-orange-400' },
            { id: 'sleep', label: 'Sleep Goal', unit: 'hrs', icon: Clock, color: 'text-sleep' },
            { id: 'water', label: 'Water Goal', unit: 'L', icon: Droplets, color: 'text-blue-400' },
            { id: 'steps', label: 'Steps Goal', unit: 'steps', icon: Footprints, color: 'text-nutrition' },
          ].map((target) => (
            <div key={target.id}>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-40 mb-2 block">
                {target.label} <span className="normal-case opacity-40">({target.unit})</span>
              </label>
              <div className="relative">
                <input
                  name={target.id}
                  type="number"
                  defaultValue={(initialValues?.targets as Record<string, number | undefined>)?.[target.id]}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 pl-4 pr-10 py-3 text-sm font-bold text-textPrimary focus:border-nutrition/50 focus:outline-none focus:ring-1 focus:ring-nutrition/20 transition-all duration-300"
                />
                <target.icon className={`absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 ${target.color} opacity-40`} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Preferences */}
      <Section title="Preferences" description="Behaviour and safety settings.">
        <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-textPrimary">Confirm on page refresh</p>
            <p className="text-xs text-textMuted opacity-60 mt-0.5">
              Show a warning before refreshing while a routine is active
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={confirmOnRefresh}
            onClick={() => handleConfirmOnRefreshToggle(!confirmOnRefresh)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              confirmOnRefresh ? 'bg-nutrition' : 'bg-white/10'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200 ${
                confirmOnRefresh ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </Section>

      {/* Communication Channels */}
      <Section title="Communication Channels" description="Sync with your external messenger handles.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="group rounded-2xl border border-white/5 bg-black/20 p-4 transition-all hover:border-nutrition/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-nutrition/10 text-nutrition">
                <Bot className="h-4 w-4" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-textPrimary">WhatsApp</span>
            </div>
            <div className="text-[10px] font-bold text-textMuted opacity-40 mb-4 px-1">PROVIDER STATUS: INACTIVE</div>
            <input
              name="whatsapp"
              placeholder="+1234567890"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-textPrimary placeholder:text-textMuted/30 focus:border-nutrition/50 focus:outline-none focus:ring-1 focus:ring-nutrition/20 transition-all duration-300"
            />
          </div>
          <div className="group rounded-2xl border border-white/5 bg-black/20 p-4 opacity-40 grayscale pointer-events-none">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-textMuted">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-textPrimary">Telegram</span>
            </div>
            <div className="text-[10px] font-bold text-textMuted opacity-40 mb-4 px-1">COMING SOON</div>
          </div>
        </div>
      </Section>

      {/* Action Bar */}
      <div className="sticky bottom-6 z-10 px-4">
        <div className="mx-auto max-w-lg rounded-3xl bg-nutrition p-2 shadow-[0_20px_40px_-15px_rgba(34,197,94,0.4)] transition-transform hover:scale-[1.02] active:scale-95 duration-500">
           <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-sm font-black uppercase tracking-[0.2em] text-background"
          >
            {saveState === 'saved' ? (
              <>
                <CheckCircle2 className="h-5 w-5" />
                Changes Applied
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                {isSaving ? 'Syncing Profile...' : 'Save All Changes'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="flex items-center justify-center gap-8 py-8">
        <button
          type="button"
          onClick={handleExportJson}
          className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-textMuted hover:text-textPrimary transition-colors"
        >
          <Download className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
          Export JSON
        </button>
        <button
          type="button"
          className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-40 hover:opacity-100 hover:text-textPrimary transition-opacity"
        >
          <Zap className="h-4 w-4" />
          Import JSON
        </button>
        <button
          type="button"
          onClick={handleClearLocalData}
          className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-500/50 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
          Clear Local Data
        </button>
      </div>

      {/* Logout — type="button" prevents submitting the outer settings form */}
      <div className="flex items-center justify-center pb-4">
        <button
          type="button"
          onClick={() => void signOut()}
          className="group flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-6 py-3 text-[11px] font-black uppercase tracking-widest text-red-400/70 transition-all duration-200 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity" />
          Sign Out
        </button>
      </div>

    </form>
  )
}
