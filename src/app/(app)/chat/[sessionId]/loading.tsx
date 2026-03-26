export default function ChatSessionLoading(): React.ReactElement {
  return (
    <div className="flex h-full">
      {/* Sidebar skeleton */}
      <aside className="hidden md:flex h-full w-72 flex-col border-r border-white/[0.06] bg-card/50">
        <div className="p-4 space-y-4 border-b border-white/[0.04]">
          <div className="h-11 w-full rounded-2xl bg-white/[0.04] animate-pulse" />
          <div className="h-3 w-20 rounded bg-white/[0.03] animate-pulse" />
        </div>
        <div className="flex-1 px-2 py-3 space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/[0.02] animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      </aside>

      {/* Chat area skeleton */}
      <div className="flex flex-1 flex-col bg-background">
        <div className="flex-1 overflow-hidden px-4 py-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              <div
                className="h-10 rounded-2xl bg-white/[0.03] animate-pulse"
                style={{ width: `${40 + (i * 15) % 30}%` }}
              />
            </div>
          ))}
        </div>
        {/* Input skeleton */}
        <div className="border-t border-white/[0.04] p-4">
          <div className="h-12 w-full rounded-2xl bg-white/[0.03] animate-pulse" />
        </div>
      </div>
    </div>
  )
}
