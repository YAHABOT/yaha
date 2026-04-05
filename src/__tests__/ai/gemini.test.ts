import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// vi.hoisted runs before ALL imports — the only safe place to set env vars
// that guard module-level code (gemini.ts throws if GEMINI_API_KEY is missing)
// ---------------------------------------------------------------------------
const { mockGenerateContent, mockGenerateContentStream, mockGetGenerativeModel } = vi.hoisted(() => {
  process.env.GEMINI_API_KEY = 'test-api-key'
  const mockGenerateContent = vi.fn()
  const mockGenerateContentStream = vi.fn()
  const mockGetGenerativeModel = vi.fn(() => ({
    generateContent: mockGenerateContent,
    generateContentStream: mockGenerateContentStream,
  }))
  return { mockGenerateContent, mockGenerateContentStream, mockGetGenerativeModel }
})

// Mock the correct package: @google/generative-ai, not @google/genai
// API shape: new GoogleGenerativeAI(key) → { getGenerativeModel() → model }
// model.generateContent({ contents }) → { response: { text: () => string } }
// model.generateContentStream({ contents }) → { stream: AsyncIterable<{ text: () => string }> }
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}))

import { processHealthMessage, streamHealthMessage, extractFromImage, GEMINI_MODEL } from '@/lib/ai/gemini'
import type { ChatInput } from '@/types/action-card'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(text: string) {
  return { response: { text: () => text } }
}

function makeStreamResponse(chunks: string[]) {
  return {
    stream: (async function* () {
      for (const chunk of chunks) {
        yield { text: () => chunk }
      }
    })(),
  }
}

const BASE_INPUT: ChatInput = {
  text: 'I had 350 calories of chicken',
  sessionId: 'session-abc',
}

beforeEach(() => {
  mockGenerateContent.mockResolvedValue(makeResponse('I have logged your meal.'))
  mockGenerateContentStream.mockReturnValue(makeStreamResponse(['chunk']))
})

// --- processHealthMessage ---

describe('processHealthMessage', () => {
  it('returns GeminiResponse shape with text and actions array', async () => {
    const result = await processHealthMessage(BASE_INPUT, 'You are a health assistant.')
    expect(result).toHaveProperty('text')
    expect(result).toHaveProperty('actions')
    expect(Array.isArray(result.actions)).toBe(true)
  })

  it('returns text string from mock response', async () => {
    const result = await processHealthMessage(BASE_INPUT, 'system prompt')
    expect(typeof result.text).toBe('string')
    expect(result.text.length).toBeGreaterThan(0)
  })

  it('returns empty actions array when response has no JSON block', async () => {
    const result = await processHealthMessage(BASE_INPUT, 'system prompt')
    expect(result.actions).toEqual([])
  })

  it('does not throw when attachment is provided in input', async () => {
    const inputWithAttachment: ChatInput = {
      ...BASE_INPUT,
      attachments: [
        {
          type: 'image',
          base64: 'abc123==',
          mimeType: 'image/jpeg',
          filename: 'meal.jpg',
        },
      ],
    }
    await expect(
      processHealthMessage(inputWithAttachment, 'system prompt')
    ).resolves.toHaveProperty('text')
  })

  it('throws for disallowed attachment MIME type', async () => {
    const inputWithBadMime: ChatInput = {
      ...BASE_INPUT,
      attachments: [{ type: 'file', base64: 'abc', mimeType: 'application/x-executable' }],
    }
    await expect(
      processHealthMessage(inputWithBadMime, 'system prompt')
    ).rejects.toThrow('Unsupported attachment MIME type')
  })

  it('parses action cards from response text when JSON block is present', async () => {
    const actionCard = {
      type: 'LOG_DATA',
      trackerId: 'tracker-1',
      trackerName: 'Nutrition',
      fields: { fld_cal: 350 },
      date: '2026-03-10',
      source: 'chat',
    }
    const responseWithJson = `Logged!\n\`\`\`json\n${JSON.stringify([actionCard])}\n\`\`\``
    mockGenerateContent.mockResolvedValueOnce(makeResponse(responseWithJson))

    const result = await processHealthMessage(BASE_INPUT, 'system')
    expect(result.actions.length).toBeGreaterThanOrEqual(1)
    if (result.actions.length > 0) {
      expect(result.actions[0].trackerId).toBe('tracker-1')
    }
  })
})

// --- streamHealthMessage ---

describe('streamHealthMessage', () => {
  it('yields text chunks from the stream', async () => {
    const chunks: string[] = []
    for await (const chunk of streamHealthMessage(BASE_INPUT, 'system prompt')) {
      chunks.push(chunk)
    }
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks).toContain('chunk')
  })

  it('does not throw when iterating the async generator', async () => {
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of streamHealthMessage(BASE_INPUT, 'system')) {
        // consume
      }
    }).not.toThrow()
  })
})

// --- extractFromImage ---

describe('extractFromImage', () => {
  it('returns a string from generateContent response', async () => {
    const result = await extractFromImage('base64data==', 'image/png', 'What is in this image?')
    expect(typeof result).toBe('string')
  })

  it('does not throw when called with jpeg mime type', async () => {
    await expect(
      extractFromImage('imgdata==', 'image/jpeg', 'Describe this meal.')
    ).resolves.toBeDefined()
  })
})

// --- GEMINI_MODEL constant ---

describe('GEMINI_MODEL', () => {
  it('equals gemini-2.5-flash', () => {
    expect(GEMINI_MODEL).toBe('gemini-2.5-flash')
  })
})
