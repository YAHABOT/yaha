import { getAgents } from '@/lib/db/agents'
import { AgentForgeList } from '@/components/agents/AgentForgeList'
import { Plus, Bot, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default async function AgentForgePage() {
  const agents = await getAgents()

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Breadcrumb */}
      <Link
        href="/settings"
        className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-textMuted transition-colors hover:text-textPrimary"
      >
        <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Settings
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
             <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/10">
               <Bot className="h-6 w-6" />
             </div>
             <h1 className="text-5xl font-black tracking-tighter text-textPrimary">Agent Forge</h1>
          </div>
          <p className="text-sm font-medium text-textMuted opacity-60">
            Create custom personas to automate your chat experience.
          </p>
        </div>
        
        {/* We'll handle "New Agent" via a stateful component inside AgentForgeList or a separate button */}
      </div>

      <div className="pt-8">
        <AgentForgeList initialAgents={agents} />
      </div>
    </div>
  )
}
