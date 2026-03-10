import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { ChatInterface } from '@/components/chat/ChatInterface'
import type { ChatMessage } from '@/types/chat'
import type { ActionCard } from '@/types/action-card'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Paperclip: ({ className }: { className?: string }) => (
    <span data-testid="icon-paperclip" className={className} />
  ),
  Send: ({ className }: { className?: string }) => (
    <span data-testid="icon-send" className={className} />
  ),
  X: ({ className }: { className?: string }) => (
    <span data-testid="icon-x" className={className} />
  ),
}))

// Mock ActionCard component
vi.mock('@/components/chat/ActionCard', () => ({
  ActionCard: ({ card }: { card: ActionCard }) => (
    <div data-testid="action-card-mock">
      Action: {card.trackerName}
    </div>
  ),
}))

const MOCK_USER_MESSAGE: ChatMessage = {
  id: 'msg-001',
  session_id: 'session-abc',
  role: 'user',
  content: 'I ate 350 calories for breakfast',
  actions: null,
  created_at: '2026-03-10T08:00:00Z',
}

const MOCK_MODEL_MESSAGE: ChatMessage = {
  id: 'msg-002',
  session_id: 'session-abc',
  role: 'model',
  content: 'Got it! I found a log entry for your breakfast.',
  actions: null,
  created_at: '2026-03-10T08:00:05Z',
}

const MOCK_ACTION_CARD: ActionCard = {
  type: 'LOG_DATA',
  trackerId: 'tracker-001',
  trackerName: 'Daily Nutrition',
  fields: { fld_001: 350 },
  date: '2026-03-10',
  source: 'chat',
}

const MOCK_MODEL_WITH_ACTION: ChatMessage = {
  id: 'msg-003',
  session_id: 'session-abc',
  role: 'model',
  content: 'Here is what I found:',
  actions: [MOCK_ACTION_CARD],
  created_at: '2026-03-10T08:00:10Z',
}

const SESSION_ID = 'session-abc'

describe('ChatInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom does not implement scrollIntoView — mock it globally for these tests
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('renders initial messages', () => {
    render(
      <ChatInterface
        initialMessages={[MOCK_USER_MESSAGE, MOCK_MODEL_MESSAGE]}
        sessionId={SESSION_ID}
      />
    )

    expect(screen.getByText('I ate 350 calories for breakfast')).toBeInTheDocument()
    expect(screen.getByText('Got it! I found a log entry for your breakfast.')).toBeInTheDocument()
  })

  it('user messages appear on the right side', () => {
    render(
      <ChatInterface initialMessages={[MOCK_USER_MESSAGE]} sessionId={SESSION_ID} />
    )

    const messageDivs = screen.getAllByTestId('message-user')
    expect(messageDivs.length).toBeGreaterThan(0)
    expect(messageDivs[0]).toHaveClass('items-end')
  })

  it('model messages appear on the left side', () => {
    render(
      <ChatInterface initialMessages={[MOCK_MODEL_MESSAGE]} sessionId={SESSION_ID} />
    )

    const messageDivs = screen.getAllByTestId('message-model')
    expect(messageDivs.length).toBeGreaterThan(0)
    expect(messageDivs[0]).toHaveClass('items-start')
  })

  it('renders the message input field', () => {
    render(<ChatInterface initialMessages={[]} sessionId={SESSION_ID} />)
    expect(screen.getByTestId('message-input')).toBeInTheDocument()
  })

  it('renders ActionCard when message has actions', () => {
    render(
      <ChatInterface
        initialMessages={[MOCK_MODEL_WITH_ACTION]}
        sessionId={SESSION_ID}
      />
    )

    expect(screen.getByTestId('action-card-mock')).toBeInTheDocument()
    expect(screen.getByText('Action: Daily Nutrition')).toBeInTheDocument()
  })

  it('does not render ActionCard when message has no actions', () => {
    render(
      <ChatInterface initialMessages={[MOCK_MODEL_MESSAGE]} sessionId={SESSION_ID} />
    )

    expect(screen.queryByTestId('action-card-mock')).not.toBeInTheDocument()
  })

  it('calls fetch /api/chat on form submit', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          role: 'model',
          content: 'Response from AI',
          actions: [],
        },
        sessionId: SESSION_ID,
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ChatInterface initialMessages={[]} sessionId={SESSION_ID} />)

    const input = screen.getByTestId('message-input')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hello!' } })
    })

    await act(async () => {
      fireEvent.submit(screen.getByTestId('chat-form'))
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(callBody.message).toBe('Hello!')
    expect(callBody.sessionId).toBe(SESSION_ID)

    vi.unstubAllGlobals()
  })

  it('adds user message immediately on submit (optimistic update)', async () => {
    let resolvePromise!: () => void
    const hangingFetch = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = () =>
          resolve({
            ok: true,
            json: async () => ({
              message: { role: 'model', content: 'ok', actions: [] },
              sessionId: SESSION_ID,
            }),
          })
      })
    )
    vi.stubGlobal('fetch', hangingFetch)

    render(<ChatInterface initialMessages={[]} sessionId={SESSION_ID} />)

    const input = screen.getByTestId('message-input')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Quick message' } })
    })

    // Do not await — let it be optimistic
    act(() => {
      fireEvent.submit(screen.getByTestId('chat-form'))
    })

    // User message should appear immediately (optimistic)
    expect(screen.getByText('Quick message')).toBeInTheDocument()

    // Resolve hanging fetch to clean up
    resolvePromise()
    vi.unstubAllGlobals()
  })

  it('shows empty state placeholder when no messages', () => {
    render(<ChatInterface initialMessages={[]} sessionId={SESSION_ID} />)
    expect(screen.getByText('Send a message to get started.')).toBeInTheDocument()
  })

  it('shows error message when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    render(<ChatInterface initialMessages={[]} sessionId={SESSION_ID} />)

    const input = screen.getByTestId('message-input')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Test' } })
    })

    await act(async () => {
      fireEvent.submit(screen.getByTestId('chat-form'))
    })

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })
})
