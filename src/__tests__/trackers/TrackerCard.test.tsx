import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrackerCard } from '@/components/trackers/TrackerCard'
import type { Tracker } from '@/types/tracker'

// Mock lucide-react icons to avoid SVG rendering in tests
vi.mock('lucide-react', () => ({
  Pencil: ({ className }: { className?: string }) => (
    <span data-testid="icon-pencil" className={className} />
  ),
  ClipboardList: ({ className }: { className?: string }) => (
    <span data-testid="icon-clipboard" className={className} />
  ),
  Activity: ({ className }: { className?: string }) => (
    <span data-testid="icon-activity" className={className} />
  ),
}))

// Mock next/link to render as a plain anchor
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const MOCK_TRACKER: Tracker = {
  id: 'tracker-abc-123',
  user_id: 'user-456',
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

describe('TrackerCard', () => {
  it('renders the tracker name', () => {
    render(<TrackerCard tracker={MOCK_TRACKER} />)
    expect(screen.getByText('Daily Nutrition')).toBeInTheDocument()
  })

  it('renders the color dot with the correct color', () => {
    render(<TrackerCard tracker={MOCK_TRACKER} />)
    const dot = screen.getByTestId('tracker-color-dot')
    // Component applies tracker.color as `color` (icon color) and `${tracker.color}18` as background
    expect(dot).toHaveStyle({ color: '#10b981' })
  })

  it('renders the type badge', () => {
    render(<TrackerCard tracker={MOCK_TRACKER} />)
    expect(screen.getByText('nutrition')).toBeInTheDocument()
  })

  it('renders the field count with correct pluralization', () => {
    render(<TrackerCard tracker={MOCK_TRACKER} />)
    expect(screen.getByText('2 fields')).toBeInTheDocument()
  })

  it('renders singular "field" when there is one field', () => {
    const singleFieldTracker: Tracker = {
      ...MOCK_TRACKER,
      schema: [{ fieldId: 'fld_001', label: 'Weight', type: 'number', unit: 'kg' }],
    }
    render(<TrackerCard tracker={singleFieldTracker} />)
    expect(screen.getByText('1 field')).toBeInTheDocument()
  })

  it('has a Log link pointing to the correct URL', () => {
    render(<TrackerCard tracker={MOCK_TRACKER} />)
    const logLink = screen.getByText('Log').closest('a')
    expect(logLink).toHaveAttribute('href', '/trackers/tracker-abc-123/log')
  })

  it('has an Edit Schema link pointing to the correct URL', () => {
    render(<TrackerCard tracker={MOCK_TRACKER} />)
    const editLink = screen.getByText('Edit Schema').closest('a')
    expect(editLink).toHaveAttribute('href', '/trackers/tracker-abc-123/schema')
  })

  it('handles trackers with zero fields', () => {
    const emptyTracker: Tracker = {
      ...MOCK_TRACKER,
      schema: [],
    }
    render(<TrackerCard tracker={emptyTracker} />)
    expect(screen.getByText('0 fields')).toBeInTheDocument()
  })

  it('renders a different color for non-nutrition trackers', () => {
    const sleepTracker: Tracker = {
      ...MOCK_TRACKER,
      name: 'Sleep Log',
      type: 'sleep',
      color: '#3b82f6',
    }
    render(<TrackerCard tracker={sleepTracker} />)
    const dot = screen.getByTestId('tracker-color-dot')
    expect(dot).toHaveStyle({ color: '#3b82f6' })
    expect(screen.getByText('sleep')).toBeInTheDocument()
  })
})
