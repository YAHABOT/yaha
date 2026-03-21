export default function AnalyticsLoading(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 animate-pulse">
      <div className="h-10 w-48 rounded-xl bg-white/[0.05]" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-white/[0.03] border border-white/5" />
        ))}
      </div>
      <div className="h-5 w-32 rounded-lg bg-white/[0.04]" />
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-14 rounded-2xl bg-white/[0.03] border border-white/5" />
        ))}
      </div>
    </div>
  )
}
