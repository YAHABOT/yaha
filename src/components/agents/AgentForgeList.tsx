'use client'

import { useState } from 'react'
import { Plus, Bot, Terminal, Pencil, Trash2 } from 'lucide-react'
import type { Agent } from '@/types/agent'
import { DesignAgentForm } from './DesignAgentForm'
import { deleteAgentAction } from '@/app/actions/agents'

type Props = {
  initialAgents: Agent[]
}

export function AgentForgeList({ initialAgents }: Props) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents)
  const [isDesigning, setIsDesigning] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to dismantle this agent?')) return
    const res = await deleteAgentAction(id)
    if (res.success) {
      setAgents(prev => prev.filter(a => a.id !== id))
    }
  }

  return (
    <div className="space-y-12">
      {/* Action Bar */}
      <div className="flex justify-end">
        <button
          onClick={() => setIsDesigning(true)}
          className="flex items-center gap-2 rounded-2xl bg-nutrition px-6 py-3 text-sm font-black uppercase tracking-widest text-nutrition-foreground transition-all hover:scale-[1.05] active:scale-95 shadow-xl shadow-nutrition/20"
        >
          <Plus className="h-4 w-4 stroke-[3px]" />
          New Agent
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agents.map((agent) => (
          <div 
            key={agent.id}
            className="group relative rounded-[32px] border border-white/5 bg-white/[0.02] p-8 transition-all hover:border-white/10 hover:bg-white/[0.04] shadow-2xl overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute -top-12 -right-12 h-24 w-24 blur-[60px] pointer-events-none opacity-20" style={{ backgroundColor: agent.color }} />

            <div className="relative space-y-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div 
                    className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
                    style={{ backgroundColor: `${agent.color}15`, border: `1px solid ${agent.color}30` }}
                  >
                    <Bot className="h-6 w-6" style={{ color: agent.color }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">{agent.name}</h3>
                    <div className="flex gap-2 mt-1">
                      <span className="rounded-full bg-nutrition/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-nutrition border border-nutrition/20">
                        ON: {agent.trigger}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-textMuted border border-white/10">
                        OFF: {agent.exit_trigger}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditingAgent(agent)
                      setIsDesigning(true)
                    }}
                    className="p-2 rounded-lg bg-white/5 text-textMuted hover:text-white hover:bg-white/10 transition-all"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(agent.id)}
                    className="p-2 rounded-lg bg-white/5 text-textMuted hover:text-red-500 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                 <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-textMuted opacity-30">
                   <Terminal size={10} />
                   System Prompt
                 </div>
                 <div className="rounded-2xl bg-black/40 p-4 border border-white/5 line-clamp-3 text-sm font-medium text-textMuted/80 italic leading-relaxed">
                   &ldquo;{agent.system_prompt}&rdquo;
                 </div>
              </div>
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="md:col-span-2 rounded-[40px] border border-dashed border-white/5 p-20 text-center space-y-4">
             <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5 text-textMuted">
               <Bot className="h-8 w-8 opacity-20" />
             </div>
             <p className="text-sm font-bold text-textMuted uppercase tracking-widest opacity-40">No personas forged yet.</p>
          </div>
        )}
      </div>

      {isDesigning && (
        <DesignAgentForm 
          agent={editingAgent} 
          onClose={() => {
            setIsDesigning(false)
            setEditingAgent(null)
          }}
          onSuccess={(agent) => {
            if (editingAgent) {
              setAgents(prev => prev.map(a => a.id === agent.id ? agent : a))
            } else {
              setAgents(prev => [...prev, agent])
            }
            setIsDesigning(false)
            setEditingAgent(null)
          }}
        />
      )}
    </div>
  )
}
