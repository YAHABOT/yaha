---
name: telegram-bot
description: Invoke when implementing Telegram Bot integration — webhook setup, file handling, message processing, and response formatting.
---

# Skill: Telegram Bot Integration

## What This Skill Covers

YAHA receives health data via Telegram. Users send text, photos, voice messages, and
documents. The bot processes them through the same Gemini pipeline as web chat and
responds with a confirmation summary. No confirmation buttons required for Telegram —
auto-confirm and report what was logged.

---

## Execution Checklist

### Step 1: Create Telegram Bot (one-time setup)

1. Message @BotFather on Telegram: `/newbot`
2. Choose a name and username (e.g. `@yaha_health_bot`)
3. Copy the bot token → `TELEGRAM_BOT_TOKEN` in `.env.local`
4. Generate a random 32+ char string → `TELEGRAM_WEBHOOK_SECRET`

### Step 2: Implement Webhook Route

```typescript
// src/app/api/telegram/webhook/route.ts
import { NextRequest } from 'next/server'
import { processTelegramUpdate } from '@/lib/telegram/processor'

export async function POST(req: NextRequest) {
  // 1. Validate secret token (MANDATORY — reject all others)
  const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 2. Parse update
  const update = await req.json()

  // 3. Process async (don't block Telegram's 60s timeout)
  processTelegramUpdate(update).catch(console.error)

  // 4. Always respond 200 immediately
  return new Response('OK', { status: 200 })
}
```

### Step 3: Validate Sender

```typescript
// src/lib/telegram/auth.ts
export async function validateSender(username: string): Promise<string | null> {
  const allowedHandles = (process.env.TELEGRAM_ALLOWED_HANDLES ?? '')
    .split(',')
    .map(h => h.trim().replace('@', '').toLowerCase())

  if (!allowedHandles.includes(username.toLowerCase())) return null

  // Find user in DB by telegram_handle
  const supabase = createServiceClient()  // service role for cross-user lookup
  const { data } = await supabase
    .from('users')
    .select('id')
    .ilike('telegram_handle', username)
    .single()

  return data?.id ?? null
}
```

### Step 4: Detect Message Type and Extract Content

```typescript
// src/lib/telegram/parser.ts
export type TelegramContent = {
  text?: string
  fileId?: string
  fileType?: 'photo' | 'voice' | 'audio' | 'document'
  mimeType?: string
}

export function parseTelegramMessage(message: TelegramMessage): TelegramContent {
  if (message.text) return { text: message.text }
  if (message.photo) {
    // photos[] is array of sizes — take the largest
    const largest = message.photo[message.photo.length - 1]
    return { fileId: largest.file_id, fileType: 'photo', mimeType: 'image/jpeg' }
  }
  if (message.voice) return { fileId: message.voice.file_id, fileType: 'voice', mimeType: 'audio/ogg' }
  if (message.audio) return { fileId: message.audio.file_id, fileType: 'audio', mimeType: message.audio.mime_type }
  if (message.document) return { fileId: message.document.file_id, fileType: 'document', mimeType: message.document.mime_type }
  return {}
}
```

### Step 5: Download Telegram File

```typescript
// src/lib/telegram/files.ts
export async function downloadTelegramFile(
  fileId: string,
  botToken: string
): Promise<{ base64: string; mimeType: string }> {
  // 1. Get file path from Telegram
  const fileRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  )
  const fileData = await fileRes.json()
  if (!fileData.ok) throw new Error(`Telegram getFile failed: ${fileData.description}`)

  // 2. Download file from CDN
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`
  const res = await fetch(fileUrl)
  const buffer = await res.arrayBuffer()

  // 3. Check size limit (20MB)
  if (buffer.byteLength > 20 * 1024 * 1024) throw new Error('File exceeds 20MB limit')

  return {
    base64: Buffer.from(buffer).toString('base64'),
    mimeType: res.headers.get('content-type') ?? 'application/octet-stream'
  }
}
```

### Step 6: Process Through Gemini Pipeline

```typescript
// src/lib/telegram/processor.ts
export async function processTelegramUpdate(update: TelegramUpdate) {
  const message = update.message
  if (!message) return

  const username = message.from?.username
  if (!username) return

  const userId = await validateSender(username)
  if (!userId) {
    await sendMessage(message.chat.id, '❌ Unauthorized. Your handle is not on the whitelist.')
    return
  }

  // Extract content
  const content = parseTelegramMessage(message)

  // Download file if needed
  let attachment
  if (content.fileId) {
    const { base64, mimeType } = await downloadTelegramFile(content.fileId, BOT_TOKEN)
    attachment = { type: content.fileType!, base64, mimeType }
  }

  // Get user context + trackers + recent logs (same as web chat)
  const [user, trackers, recentLogs] = await Promise.all([
    getUserProfile(userId),
    getTrackers(userId),
    getRecentLogs(userId, 1000)
  ])

  const systemPrompt = buildSystemPrompt(user, trackers, recentLogs)

  // Process with Gemini
  const { text, actions } = await processHealthMessage(
    { text: content.text, attachments: attachment ? [attachment] : [], sessionId: 'telegram', userId },
    systemPrompt
  )

  // Auto-confirm all actions (no button click on Telegram)
  for (const action of actions) {
    await confirmLog(userId, action)
  }

  // Send response summary
  const summary = actions.length > 0
    ? `✅ Logged:\n${actions.map(a => `• ${a.trackerName}: ${formatFields(a.fields)}`).join('\n')}`
    : text

  await sendMessage(message.chat.id, summary)
}
```

### Step 7: Register Webhook (one-time)

```typescript
// src/app/api/telegram/register/route.ts
export async function GET() {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook`
  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ['message', 'callback_query'],
      }),
    }
  )
  const data = await res.json()
  return Response.json(data)
}
```

---

## Telegram sendMessage Helper

```typescript
// src/lib/telegram/bot.ts
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const API = `https://api.telegram.org/bot${BOT_TOKEN}`

export async function sendMessage(chatId: number, text: string) {
  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}
```

---

## Error Handling

| Error | Response to user |
|-------|-----------------|
| Unauthorized sender | "❌ Your Telegram handle is not whitelisted." |
| File too large (>20MB) | "❌ File too large. Max 20MB." |
| AI processing failed | "❌ Couldn't process your message. Try again." |
| DB write failed | "⚠️ Logged in AI memory but couldn't save. Try again." |
| Unknown message type | "I can handle text, photos, voice messages, and files." |
