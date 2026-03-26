'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Check, ChevronDown, Zap, Bot } from 'lucide-react'
import type { Agent } from '@/types/agent'

type Props = {
  agents: Agent[]
  activeAgentId: string | null
  onSelect: (agentId: string | null) => void
}

export function AgentSelector({ agents, activeAgentId, onSelect }: Props): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const activeAgent = agents.find(a => a.id === activeAgentId)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 sm:gap-3 rounded-xl sm:rounded-2xl border px-2 py-1.5 sm:px-4 sm:py-2 transition-all outline-none animate-in fade-in duration-500 ${
          activeAgent 
            ? 'border-primary/40 bg-primary/10 text-primary shadow-[0_0_20px_rgba(255,255,255,0.05)]' 
            : 'border-white/10 bg-white/5 text-textMuted hover:bg-white/10 hover:border-white/20'
        }`}
      >
        <div className={`h-1.5 w-1.5 rounded-full ${activeAgent ? 'bg-primary animate-pulse' : 'bg-white/20'}`} />
        <span className="hidden text-[10px] font-black uppercase tracking-[0.2em] sm:inline">
          {activeAgent ? activeAgent.name : 'Quick Log'}
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-4 w-72 origin-bottom-left rounded-[32px] border border-white/10 bg-black/80 p-3 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 z-50">
          <div className="px-4 py-3 mb-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-textMuted opacity-30">Cognitive Layer</h3>
          </div>
          
          <div className="space-y-1.5">
            <button
              onClick={() => {
                onSelect(null)
                setIsOpen(false)
              }}
              className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left transition-all ${
                !activeAgentId 
                  ? 'bg-white/10 text-white shadow-inner' 
                  : 'text-textMuted hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/5 shadow-lg">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Quick Log</p>
                  <p className="text-[10px] opacity-40 font-medium tracking-wide">Ephemeral • Non-persistent</p>
                </div>
              </div>
              {!activeAgentId && <Check className="h-4 w-4 text-primary" strokeWidth={3} />}
            </button>

            <div className="h-px bg-white/5 mx-2 my-2" />

            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => {
                  onSelect(agent.id)
                  setIsOpen(false)
                }}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left transition-all group ${
                  activeAgentId === agent.id 
                    ? 'bg-white/10 text-white shadow-inner' 
                    : 'text-textMuted hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 duration-500 shadow-lg" 
                    style={{ backgroundColor: `${agent.color}15`, border: `1px solid ${agent.color}30` }}
                  >
                    <Bot className="h-5 w-5" style={{ color: agent.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-widest truncate">{agent.name}</p>
                    <p className="text-[10px] opacity-40 font-medium tracking-wide truncate">Trigger: {agent.trigger}</p>
                  </div>
                </div>
                {activeAgentId === agent.id && <Check className="h-4 w-4 text-primary" strokeWidth={3} />}
              </button>
            ))}

            {agents.length === 0 && (
              <div className="px-4 py-8 text-center">
                 <p className="text-[10px] font-black uppercase tracking-widest text-textMuted opacity-20 italic">No agents forged</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
