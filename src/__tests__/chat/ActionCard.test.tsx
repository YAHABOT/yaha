import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { ActionCard } from '@/components/chat/ActionCard'
import type { ActionCard as ActionCardType } from '@/types/action-card'

// lucide-react mock — only icons used by ActionCard
vi.mock('lucide-react', () => ({
  Pencil: ({ className }: { className?: string }) => <span data-testid="icon-pencil" className={className} />,
}))

// Mock the server action
vi.mock('@/app/actions/chat', () => ({
  confirmLogAction: vi.fn(),
}))

import { confirmLogAction } from '@/app/actions/chat'

const MOCK_CARD: ActionCardType = {
  type: 'LOG_DATA',
  trackerId: 'tracker-001',
  trackerName: 'Daily Nutrition',
  fields: {
    fld_001: 350,
    fld_002: 'chicken breast',
  },
  date: '2026-03-10',
  source: 'chat',
}

describe('ActionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders tracker name in the header', () => {
    render(<ActionCard card={MOCK_CARD} />)
    expect(screen.getByText('Daily Nutrition')).toBeInTheDocument()
  })

  it('renders field values from card.fields', () => {
    render(<ActionCard card={MOCK_CARD} />)
    expect(screen.getByText('350')).toBeInTheDocument()
    expect(screen.getByText('chicken breast')).toBeInTheDocument()
  })

  it('renders the date', () => {
    render(<ActionCard card={MOCK_CARD} />)
    expect(screen.getByText('2026-03-10')).toBeInTheDocument()
  })

  it('shows Confirm and Discard buttons in pending state', () => {
    render(<ActionCard card={MOCK_CARD} />)
    expect(screen.getByTestId('action-card-confirm')).toBeInTheDocument()
    expect(screen.getByTestId('action-card-discard')).toBeInTheDocument()
  })

  it('calls confirmLogAction on confirm button click', async () => {
    vi.mocked(confirmLogAction).mockResolvedValueOnce({ success: true })

    render(<ActionCard card={MOCK_CARD} />)
    await act(async () => {
      screen.getByTestId('action-card-confirm').click()
    })

    expect(confirmLogAction).toHaveBeenCalledWith(MOCK_CARD, undefined, undefined)
  })

  it('shows Logged state after successful confirmation', async () => {
    vi.mocked(confirmLogAction).mockResolvedValueOnce({ success: true })

    render(<ActionCard card={MOCK_CARD} />)
    await act(async () => {
      screen.getByTestId('action-card-confirm').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('action-card-confirmed')).toBeInTheDocument()
      expect(screen.getByText('Logged Successfully')).toBeInTheDocument()
    })
  })

  it('shows error message when confirmLogAction returns an error', async () => {
    vi.mocked(confirmLogAction).mockResolvedValueOnce({ error: 'Failed to log entry: DB error' })

    render(<ActionCard card={MOCK_CARD} />)
    await act(async () => {
      screen.getByTestId('action-card-confirm').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('action-card-error')).toHaveTextContent('Failed to log entry: DB error')
    })

    // Should reset to pending — buttons visible again
    expect(screen.getByTestId('action-card-confirm')).toBeInTheDocument()
  })

  it('shows Discarded state after discard button click', async () => {
    render(<ActionCard card={MOCK_CARD} />)
    await act(async () => {
      screen.getByTestId('action-card-discard').click()
    })

    expect(screen.getByTestId('action-card-discarded')).toBeInTheDocument()
    expect(screen.getByText('Log discarded')).toBeInTheDocument()
  })

  it('buttons are disabled during loading state', async () => {
    // Make confirmLogAction hang indefinitely to keep loading state
    vi.mocked(confirmLogAction).mockReturnValue(new Promise(() => {}))

    render(<ActionCard card={MOCK_CARD} />)

    // Start the click but do not await — leave it pending
    act(() => {
      screen.getByTestId('action-card-confirm').click()
    })

    await waitFor(() => {
      // The "Logging..." text appears when status is 'loading'
      expect(screen.getByTestId('action-card-confirm')).toBeDisabled()
    })

    expect(screen.getByTestId('action-card-discard')).toBeDisabled()
  })

  it('calls onConfirm callback after successful confirmation', async () => {
    const onConfirm = vi.fn()
    vi.mocked(confirmLogAction).mockResolvedValueOnce({ success: true })

    render(<ActionCard card={MOCK_CARD} onConfirm={onConfirm} />)
    await act(async () => {
      screen.getByTestId('action-card-confirm').click()
    })

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
  })

  it('calls onDiscard callback after discard', async () => {
    const onDiscard = vi.fn()

    render(<ActionCard card={MOCK_CARD} onDiscard={onDiscard} />)
    await act(async () => {
      screen.getByTestId('action-card-discard').click()
    })

    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it('shows dash for null field values', () => {
    const cardWithNull: ActionCardType = {
      ...MOCK_CARD,
      fields: { fld_001: null },
    }
    render(<ActionCard card={cardWithNull} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
