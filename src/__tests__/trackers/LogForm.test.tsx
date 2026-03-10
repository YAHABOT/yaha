import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LogForm } from '@/components/trackers/LogForm'
import type { Tracker } from '@/types/tracker'

// Mock server action
vi.mock('@/app/actions/logs', () => ({
  createLogAction: vi.fn().mockResolvedValue({}),
}))

// Mock next/link
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
  id: 'tracker-test-001',
  user_id: 'user-001',
  name: 'Daily Nutrition',
  type: 'nutrition',
  color: '#10b981',
  schema: [
    { fieldId: 'fld_001', label: 'Calories', type: 'number', unit: 'kcal' },
    { fieldId: 'fld_002', label: 'Notes', type: 'text' },
    { fieldId: 'fld_003', label: 'Mood', type: 'rating' },
    { fieldId: 'fld_004', label: 'Bedtime', type: 'time' },
  ],
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

const EMPTY_TRACKER: Tracker = {
  ...MOCK_TRACKER,
  id: 'tracker-empty-001',
  name: 'Empty Tracker',
  schema: [],
}

describe('LogForm', () => {
  it('renders correct input types for each schema field type', () => {
    render(<LogForm tracker={MOCK_TRACKER} />)

    // Number field
    const caloriesInput = screen.getByLabelText(/Calories/i)
    expect(caloriesInput).toHaveAttribute('type', 'number')

    // Text field
    const notesInput = screen.getByLabelText(/Notes/i)
    expect(notesInput).toHaveAttribute('type', 'text')

    // Rating field — renders as a range slider
    const moodInput = screen.getByLabelText(/Mood/i)
    expect(moodInput).toHaveAttribute('type', 'range')

    // Time field
    const bedtimeInput = screen.getByLabelText(/Bedtime/i)
    expect(bedtimeInput).toHaveAttribute('type', 'time')
  })

  it('shows empty state when schema is empty', () => {
    render(<LogForm tracker={EMPTY_TRACKER} />)

    expect(
      screen.getByText('Add fields to this tracker first.')
    ).toBeInTheDocument()

    const editLink = screen.getByText('Edit Schema')
    expect(editLink.closest('a')).toHaveAttribute(
      'href',
      '/trackers/tracker-empty-001/schema'
    )
  })

  it('shows unit labels when schema fields have units', () => {
    render(<LogForm tracker={MOCK_TRACKER} />)

    const unitLabel = screen.getByTestId('unit-fld_001')
    expect(unitLabel).toHaveTextContent('(kcal)')
  })

  it('does not show unit label when field has no unit', () => {
    render(<LogForm tracker={MOCK_TRACKER} />)

    // Notes field has no unit — should not render a unit test id
    expect(screen.queryByTestId('unit-fld_002')).not.toBeInTheDocument()
  })

  it('shows the datetime-local input for backdating', () => {
    render(<LogForm tracker={MOCK_TRACKER} />)

    const datetimeInput = screen.getByLabelText(/Date & Time/i)
    expect(datetimeInput).toHaveAttribute('type', 'datetime-local')
  })

  it('renders the submit button with correct text', () => {
    render(<LogForm tracker={MOCK_TRACKER} />)

    const submitButton = screen.getByRole('button', { name: /Log Entry/i })
    expect(submitButton).toBeInTheDocument()
    expect(submitButton).not.toBeDisabled()
  })

  it('shows default rating value of 5', () => {
    render(<LogForm tracker={MOCK_TRACKER} />)

    const ratingDisplay = screen.getByTestId('rating-value-fld_003')
    expect(ratingDisplay).toHaveTextContent('5')
  })
})
