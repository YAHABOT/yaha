import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ChatInput, GeminiResponse } from '@/types/action-card'
import { parseActionCards } from './actions'

export const GEMINI_MODEL = 'gemini-2.0-flash'

let genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

// Must stay in sync with ALLOWED_MIME_TYPES in src/app/api/chat/route.ts — only types Gemini can process via inlineData.
// Office formats (docx/xlsx/xls) are intentionally excluded — Gemini does not support binary Office formats as inlineData.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'application/pdf',
  'text/plain',
  'text/csv',
])

type ContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

function buildParts(input: ChatInput): ContentPart[] {
  const parts: ContentPart[] = []

  if (input.text) {
    parts.push({ text: input.text })
  }

  if (input.attachments) {
    for (const attachment of input.attachments) {
      if (!ALLOWED_MIME_TYPES.has(attachment.mimeType)) {
        throw new Error(`Unsupported attachment MIME type: ${attachment.mimeType}`)
      }
      parts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.base64,
        },
      })
    }
  }

  return parts
}

export async function processHealthMessage(
  input: ChatInput,
  systemPrompt: string,
  history: Array<{ role: 'user' | 'model'; parts: ContentPart[] }> = []
): Promise<GeminiResponse> {
  console.log(`[Gemini] Calling ${GEMINI_MODEL} with input:`, input.text)
  
  try {
    const model = getGenAI().getGenerativeModel({ 
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt
    })

    const currentParts = buildParts(input)
    const contents = [
      ...history,
      { role: 'user' as const, parts: currentParts }
    ]

    const result = await model.generateContent({ contents })

    const response = await result.response
    const text = response.text()
    console.log(`[Gemini] Response received:`, text.substring(0, 100) + '...')
    
    const actions = parseActionCards(text)
    return { text, actions }
  } catch (error: unknown) {
    console.error(`[Gemini] Error calling ${GEMINI_MODEL}:`, error instanceof Error ? error.message : error)
    throw error
  }
}

export async function* streamHealthMessage(
  input: ChatInput,
  systemPrompt: string,
  history: Array<{ role: 'user' | 'model'; parts: ContentPart[] }> = []
): AsyncGenerator<string> {
  console.log(`[Gemini] Streaming ${GEMINI_MODEL}...`)
  
  try {
    const model = getGenAI().getGenerativeModel({ 
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt
    })

    const currentParts = buildParts(input)
    const contents = [
      ...history,
      { role: 'user' as const, parts: currentParts }
    ]

    const result = await model.generateContentStream({ contents })

    for await (const chunk of result.stream) {
      const text = chunk.text()
      yield text
    }
  } catch (error: unknown) {
    console.error(`[Gemini] Streaming error for ${GEMINI_MODEL}:`, error instanceof Error ? error.message : error)
    throw error
  }
}

export async function extractFromImage(
  base64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const model = getGenAI().getGenerativeModel({ model: GEMINI_MODEL })

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
  })

  const response = await result.response
  return response.text()
}
