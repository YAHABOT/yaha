import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayView } from '@/components/journal/DayView'
import { TrackerDayGroup } from '@/components/journal/TrackerDayGroup'
import type { Tracker } from '@/types/tracker'
import type { TrackerLog } from '@/types/log'

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronLeft: ({ className }: { className?: string }) => (
    <span data-testid="icon-chevron-left" className={className} />
  ),
  ChevronRight: ({ className }: { className?: string }) => (
    <span data-testid="icon-chevron-right" className={className} />
  ),
  GitBranch: ({ className }: { className?: string }) => (
    <span data-testid="icon-git-branch" className={className} />
  ),
  Eye: ({ className }: { className?: string }) => (
    <span data-testid="icon-eye" className={className} />
  ),
  Plus: ({ className }: { className?: string }) => (
    <span data-testid="icon-plus" className={className} />
  ),
}))

// Mock next/navigation for DateNav (client component)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

const MOCK_TRACKER_NUTRITION: Tracker = {
  id: 'tracker-001',
  user_id: 'user-abc',
  name: 'Daily Nutrition',
  type: 'nutrition',
  color: '#10b981',
  schema: [
    { fieldId: 'fld_001', label: 'Calories', type: 'number', unit: 'kcal' },
    { fieldId: 'fld_002', label: 'Protein', type: 'number', unit: 'g' },
  ],
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

const MOCK_TRACKER_SLEEP: Tracker = {
  id: 'tracker-002',
  user_id: 'user-abc',
  name: 'Sleep Log',
  type: 'sleep',
  color: '#3b82f6',
  schema: [
    { fieldId: 'fld_010', label: 'Duration', type: 'number', unit: 'hrs' },
  ],
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

const MOCK_LOG_NUTRITION: TrackerLog = {
  id: 'log-001',
  tracker_id: 'tracker-001',
  user_id: 'user-abc',
  fields: { fld_001: 350, fld_002: 28 },
  logged_at: '2026-03-10T14:30:00.000Z',
  source: 'manual',
  created_at: '2026-03-10T14:30:00.000Z',
}

const MOCK_LOG_SLEEP: TrackerLog = {
  id: 'log-002',
  tracker_id: 'tracker-002',
  user_id: 'user-abc',
  fields: { fld_010: 7.5 },
  logged_at: '2026-03-10T08:00:00.000Z',
  source: 'web',
  created_at: '2026-03-10T08:00:00.000Z',
}

const TEST_DATE = '2026-03-10'

describe('DayView', () => {
  it('renders empty state when no logs for the day', () => {
    render(
      <DayView
        date={TEST_DATE}
        trackers={[MOCK_TRACKER_NUTRITION]}
        logs={[]}
        loggedDates={[TEST_DATE]}
        correlations={[]}
      />
    )
    expect(screen.getByText('No logs for this day')).toBeInTheDocument()
  })

  it('renders TrackerDayGroup for each tracker that has logs', () => {
    render(
      <DayView
        date={TEST_DATE}
        trackers={[MOCK_TRACKER_NUTRITION, MOCK_TRACKER_SLEEP]}
        logs={[MOCK_LOG_NUTRITION, MOCK_LOG_SLEEP]}
        loggedDates={[TEST_DATE]}
        correlations={[]}
      />
    )
    expect(screen.getByText('Daily Nutrition')).toBeInTheDocument()
    expect(screen.getByText('Sleep Log')).toBeInTheDocument()
  })

  it('does not render groups for trackers with no logs', () => {
    render(
      <DayView
        date={TEST_DATE}
        trackers={[MOCK_TRACKER_NUTRITION, MOCK_TRACKER_SLEEP]}
        logs={[MOCK_LOG_NUTRITION]}
        loggedDates={[TEST_DATE]}
        correlations={[]}
      />
    )
    expect(screen.getByText('Daily Nutrition')).toBeInTheDocument()
    expect(screen.queryByText('Sleep Log')).not.toBeInTheDocument()
  })

  it('renders DateNav with the current date visible', () => {
    render(
      <DayView
        date={TEST_DATE}
        trackers={[MOCK_TRACKER_NUTRITION]}
        logs={[]}
        loggedDates={[TEST_DATE]}
        correlations={[]}
      />
    )
    // Header will display the formatted date — check for year at minimum
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('renders multiple logs for the same tracker in one group', () => {
    const secondLog: TrackerLog = {
      ...MOCK_LOG_NUTRITION,
      id: 'log-001b',
      fields: { fld_001: 500, fld_002: 40 },
      logged_at: '2026-03-10T19:00:00.000Z',
    }
    render(
      <DayView
        date={TEST_DATE}
        trackers={[MOCK_TRACKER_NUTRITION]}
        logs={[MOCK_LOG_NUTRITION, secondLog]}
        loggedDates={[TEST_DATE]}
        correlations={[]}
      />
    )
    // Tracker name appears once (one group)
    const headings = screen.getAllByText('Daily Nutrition')
    expect(headings).toHaveLength(1)
    // Two log entries — shows "2 entries"
    expect(screen.getByText('2 entries')).toBeInTheDocument()
  })
})

describe('TrackerDayGroup', () => {
  it('shows the tracker name', () => {
    render(
      <TrackerDayGroup tracker={MOCK_TRACKER_NUTRITION} logs={[MOCK_LOG_NUTRITION]} />
    )
    expect(screen.getByText('Daily Nutrition')).toBeInTheDocument()
  })

  it('maps fieldId to label using tracker schema', () => {
    render(
      <TrackerDayGroup tracker={MOCK_TRACKER_NUTRITION} logs={[MOCK_LOG_NUTRITION]} />
    )
    expect(screen.getByText('Calories')).toBeInTheDocument()
    expect(screen.getByText('Protein')).toBeInTheDocument()
  })

  it('shows field values with units', () => {
    render(
      <TrackerDayGroup tracker={MOCK_TRACKER_NUTRITION} logs={[MOCK_LOG_NUTRITION]} />
    )
    expect(screen.getByText('350 kcal')).toBeInTheDocument()
    expect(screen.getByText('28 g')).toBeInTheDocument()
  })

  it('falls back to fieldId when field not in schema', () => {
    const logWithUnknownField: TrackerLog = {
      ...MOCK_LOG_NUTRITION,
      fields: { unknown_field_xyz: 99 },
    }
    render(
      <TrackerDayGroup tracker={MOCK_TRACKER_NUTRITION} logs={[logWithUnknownField]} />
    )
    // Should show the raw fieldId as label
    expect(screen.getByText('unknown_field_xyz')).toBeInTheDocument()
  })

  it('shows null field values as ---', () => {
    const logWithNullField: TrackerLog = {
      ...MOCK_LOG_NUTRITION,
      fields: { fld_001: null, fld_002: 28 },
    }
    render(
      <TrackerDayGroup tracker={MOCK_TRACKER_NUTRITION} logs={[logWithNullField]} />
    )
    expect(screen.getByText('---')).toBeInTheDocument()
  })

  it('shows logged_at time for each log entry', () => {
    render(
      <TrackerDayGroup tracker={MOCK_TRACKER_NUTRITION} logs={[MOCK_LOG_NUTRITION]} />
    )
    // Time should be present (formatted as e.g. "2:30 PM")
    // We check for AM or PM to avoid timezone-specific matching
    const timeEl = screen.getByText(/[AP]M/)
    expect(timeEl).toBeInTheDocument()
  })

  it('shows correct entry count label (singular)', () => {
    render(
      <TrackerDayGroup tracker={MOCK_TRACKER_NUTRITION} logs={[MOCK_LOG_NUTRITION]} />
    )
    expect(screen.getByText('1 entry')).toBeInTheDocument()
  })

  it('shows correct entry count label (plural)', () => {
    const secondLog: TrackerLog = {
      ...MOCK_LOG_NUTRITION,
      id: 'log-999',
    }
    render(
      <TrackerDayGroup
        tracker={MOCK_TRACKER_NUTRITION}
        logs={[MOCK_LOG_NUTRITION, secondLog]}
      />
    )
    expect(screen.getByText('2 entries')).toBeInTheDocument()
  })

  it('shows source badge for each log', () => {
    render(
      <TrackerDayGroup tracker={MOCK_TRACKER_NUTRITION} logs={[MOCK_LOG_NUTRITION]} />
    )
    expect(screen.getByText('manual')).toBeInTheDocument()
  })

  it('shows the color dot with the tracker color', () => {
    render(
      <TrackerDayGroup tracker={MOCK_TRACKER_NUTRITION} logs={[MOCK_LOG_NUTRITION]} />
    )
    const dot = screen.getByTestId('tracker-color-dot')
    expect(dot).toHaveStyle({ backgroundColor: '#10b981' })
  })
})
