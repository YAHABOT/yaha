'use client'

import { useState } from 'react'
import { X, Save, Check } from 'lucide-react'
import type { Agent } from '@/types/agent'
import { createAgentAction, updateAgentAction } from '@/app/actions/agents'

type Props = {
  agent?: Agent | null
  onClose: () => void
  onSuccess: (agent: Agent) => void
}

const COLORS = [
  '#22C55E', // Nutrition Green
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
]

export function DesignAgentForm({ agent, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState(agent?.color ?? COLORS[0])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      trigger: formData.get('trigger') as string,
      exit_trigger: formData.get('exit_trigger') as string,
      system_prompt: formData.get('system_prompt') as string,
      color: selectedColor,
      schema: [], // Initially empty or based on needs
    }

    try {
      let result
      if (agent) {
        result = await updateAgentAction(agent.id, data)
      } else {
        result = await createAgentAction(data)
      }

      if (result.success && result.agent) {
        onSuccess(result.agent)
      } else {
        setError(result.error || 'Failed to save agent')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-12">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl rounded-[40px] border border-white/10 bg-[#0A0A0A] p-1 shadow-2xl animate-in zoom-in-95 fade-in duration-300">
        <div className="p-8 md:p-10 space-y-10">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black tracking-tight text-white">Design New Persona</h2>
            <button onClick={onClose} className="p-2 text-textMuted hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
              !! {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Left Column */}
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-40 mb-3 block">Agent Name</label>
                <input
                  name="name"
                  autoFocus
                  required
                  defaultValue={agent?.name}
                  placeholder="e.g. Drill Sergeant"
                  className="w-full rounded-2xl border border-white/10 bg-black px-6 py-4 text-sm font-bold text-white placeholder:text-white/10 focus:border-primary/50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-40 mb-3 block">Trigger Phrase</label>
                  <input
                    name="trigger"
                    required
                    defaultValue={agent?.trigger}
                    placeholder="BOOTCAMP"
                    className="w-full rounded-2xl border border-white/10 bg-black px-6 py-4 text-xs font-black uppercase tracking-widest text-white placeholder:text-white/10 focus:border-primary/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-40 mb-3 block">Exit Phrase</label>
                  <input
                    name="exit_trigger"
                    required
                    defaultValue={agent?.exit_trigger}
                    placeholder="AT EASE"
                    className="w-full rounded-2xl border border-white/10 bg-black px-6 py-4 text-xs font-black uppercase tracking-widest text-white placeholder:text-white/10 focus:border-primary/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-40 mb-3 block">Theme Color</label>
                <div className="flex gap-4">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`h-8 w-8 rounded-full transition-all flex items-center justify-center ${selectedColor === c ? 'scale-125 shadow-lg' : 'opacity-40 hover:opacity-100'}`}
                      style={{ backgroundColor: c, boxShadow: selectedColor === c ? `0 0 20px -5px ${c}` : 'none' }}
                    >
                      {selectedColor === c && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-textMuted opacity-40 mb-3 block">System Prompt / Instructions</label>
              <textarea
                name="system_prompt"
                required
                defaultValue={agent?.system_prompt}
                placeholder="You are a strict trainer. You never accept excuses. You demand pushups..."
                className="flex-1 rounded-3xl border border-white/10 bg-black px-6 py-5 text-sm font-medium leading-relaxed text-white/80 placeholder:text-white/5 focus:border-primary/50 focus:outline-none resize-none min-h-[220px]"
              />
            </div>

            {/* Bottom Actions */}
            <div className="md:col-span-2 flex items-center justify-end gap-6 pt-6 border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-black uppercase tracking-widest text-textMuted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-2xl bg-nutrition px-10 py-4 text-sm font-black uppercase tracking-widest text-nutrition-foreground transition-all hover:scale-[1.05] active:scale-95 shadow-xl shadow-nutrition/20 disabled:opacity-50"
              >
                <Save size={18} strokeWidth={3} />
                {loading ? 'Forging...' : agent ? 'Update Persona' : 'Create Agent'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
