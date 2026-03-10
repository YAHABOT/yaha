import { GoogleGenAI } from '@google/genai'
import type { ChatInput, GeminiResponse } from '@/types/action-card'
import { parseActionCards } from './actions'

export const GEMINI_MODEL = 'gemini-2.5-flash'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

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
  systemPrompt: string
): Promise<GeminiResponse> {
  const parts = buildParts(input)

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts }],
    config: { systemInstruction: systemPrompt },
  })

  const text: string = response.text ?? ''
  const actions = parseActionCards(text)

  return { text, actions }
}

export async function* streamHealthMessage(
  input: ChatInput,
  systemPrompt: string
): AsyncGenerator<string> {
  const parts = buildParts(input)

  const stream = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts }],
    config: { systemInstruction: systemPrompt },
  })

  for await (const chunk of stream) {
    yield chunk.text ?? ''
  }
}

export async function extractFromImage(
  base64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
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

  return response.text ?? ''
}
