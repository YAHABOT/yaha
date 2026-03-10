'use client' // needed for router navigation on date changes

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  currentDate: string // YYYY-MM-DD
}

function addDays(dateStr: string, n: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + n)
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function DateNav({ currentDate }: Props): React.ReactElement {
  const router = useRouter()
  const today = getTodayStr()
  const isToday = currentDate >= today
  const prevDate = addDays(currentDate, -1)
  const nextDate = addDays(currentDate, 1)

  function goTo(date: string): void {
    router.push(`/journal?date=${date}`)
  }

  function goToToday(): void {
    router.push('/journal')
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => goTo(prevDate)}
        className="rounded-lg p-2 text-textMuted transition-colors hover:bg-surfaceHighlight hover:text-textPrimary"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-medium text-textPrimary">
          {formatDisplayDate(currentDate)}
        </span>
        {!isToday && (
          <button
            type="button"
            onClick={goToToday}
            className="text-xs text-textMuted underline underline-offset-2 transition-colors hover:text-textPrimary"
          >
            Today
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => goTo(nextDate)}
        disabled={isToday}
        className="rounded-lg p-2 text-textMuted transition-colors hover:bg-surfaceHighlight hover:text-textPrimary disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Next day"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}
