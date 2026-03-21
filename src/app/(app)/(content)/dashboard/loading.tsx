export default function DashboardLoading(): React.ReactElement {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 animate-pulse">
      {/* Banner skeleton */}
      <div className="h-28 rounded-3xl bg-white/[0.03] border border-white/5" />
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded-lg bg-white/[0.05]" />
          <div className="h-3 w-24 rounded-lg bg-white/[0.03]" />
        </div>
        <div className="h-8 w-24 rounded-full bg-white/[0.03]" />
      </div>
      {/* Widget grid skeleton */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/[0.03] border border-white/5" />
        ))}
      </div>
    </div>
  )
}
