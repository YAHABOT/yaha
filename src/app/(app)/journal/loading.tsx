export default function JournalLoading(): React.ReactElement {
  return (
    <div className="flex h-full overflow-hidden animate-pulse">
      {/* Date sidebar skeleton */}
      <div className="hidden w-48 shrink-0 border-r border-white/5 md:flex flex-col gap-2 p-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-9 rounded-xl bg-white/[0.03]" />
        ))}
      </div>
      {/* Main content skeleton */}
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 overflow-auto">
        <div className="h-7 w-40 rounded-lg bg-white/[0.05]" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
              <div className="h-5 w-32 rounded-lg bg-white/[0.05]" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-12 rounded-xl bg-white/[0.03]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
