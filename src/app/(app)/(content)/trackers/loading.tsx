export default function TrackersLoading(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 rounded-lg bg-white/[0.05]" />
        <div className="h-9 w-32 rounded-full bg-white/[0.03]" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-white/[0.03] border border-white/5" />
        ))}
      </div>
    </div>
  )
}
