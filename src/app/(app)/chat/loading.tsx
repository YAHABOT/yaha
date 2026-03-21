export default function ChatLoading(): React.ReactElement {
  return (
    <div className="flex h-full animate-pulse">
      {/* Sidebar skeleton */}
      <div className="hidden w-64 shrink-0 border-r border-white/5 md:flex flex-col gap-2 p-3">
        <div className="h-9 rounded-xl bg-white/[0.05] mb-1" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-white/[0.03]" />
        ))}
      </div>
      {/* Main area skeleton */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-white/[0.04]" />
        <div className="h-4 w-40 rounded-lg bg-white/[0.03]" />
      </div>
    </div>
  )
}
