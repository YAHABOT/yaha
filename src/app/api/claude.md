# Security Rules — YAHA

## Authentication — Defense in Depth

NEVER rely on middleware alone for auth. Verify identity at every data access point.

```typescript
// src/lib/db/trackers.ts — Data Access Layer pattern (mandatory)
import { createServerClient } from '@/lib/supabase/server'

export async function getTrackers() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  // Supabase RLS also enforces this — defense in depth
  const { data, error } = await supabase.from('trackers').select()
  if (error) throw new Error(`DB error: ${error.message}`)
  return data
}
```

- **`middleware.ts`**: Session refresh only — NOT a security boundary.
- **Data Access Layer** (`src/lib/db/`): Every function calls `getUser()` before query.
- **Server Actions**: Verify auth before executing any mutation.
- **Route Handlers**: Extract session from cookies — never trust request body for user ID.

## Supabase Row Level Security (RLS)

Every table MUST have RLS enabled and a policy. No exceptions.

```sql
-- Required pattern for every table
ALTER TABLE trackers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their trackers"
ON trackers FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

- **Never use service role key** in client-side code or in components.
- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`): Only in server-side code, only for
  admin operations (e.g., Telegram webhook creating logs for a user).
- **Anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`): Safe for client-side — RLS protects data.

## Telegram Webhook Validation

Every request to `/api/telegram/webhook` MUST validate the secret token header.

```typescript
// src/app/api/telegram/webhook/route.ts
export async function POST(req: Request) {
  const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }
  // ... process webhook
}
```

- **Sender whitelist**: Check `update.message.from.username` against
  `TELEGRAM_ALLOWED_HANDLES` env var before processing any message.
- **No file downloads from unknown sources**: Only download files via Telegram's CDN
  using a valid `file_id` returned by the Telegram API.

## Input Validation + AI Output Sanitization

Never trust AI output directly. Validate before writing to database.

```typescript
// Validate AI action card before logging
function validateActionCard(card: unknown): ActionCard {
  if (!card || typeof card !== 'object') throw new Error('Invalid action card')
  const c = card as Record<string, unknown>
  if (!c.trackerId || typeof c.trackerId !== 'string') throw new Error('Missing trackerId')
  if (!c.fields || typeof c.fields !== 'object') throw new Error('Missing fields')
  // Validate field values against tracker schema
  return c as ActionCard
}
```

- **Sanitize numeric fields**: Reject values > 10x expected range (e.g., weight > 500kg).
- **Sanitize duration fields**: Values > 24 treated as minutes, auto-convert to hours.
- **Strip unknown fields**: Only persist fields that exist in the tracker schema.

## Secrets Management

- **`.env.local`**: All secrets here. Never `.env` (could be committed).
- **Never log secrets**: No `console.log(process.env.*)` for secret keys.
- **Never expose in client**: `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`,
  `GEMINI_API_KEY` must NEVER have `NEXT_PUBLIC_` prefix.
- **`.env.example`**: Always maintained. No real values — placeholder descriptions only.
- **`.gitignore`**: Confirms `.env.local` is excluded before first commit.

## OWASP Top 10 Checklist (per feature)

Before code-reviewer PASS, coding-agent must verify:
- [ ] No SQL injection — using Supabase client (parameterized), never raw SQL strings
- [ ] No XSS — React auto-escapes, no `dangerouslySetInnerHTML` without sanitization
- [ ] No path traversal — file operations use validated paths only
- [ ] No broken auth — auth checked in DAL, not just middleware
- [ ] No sensitive data exposure — secrets in env, not in logs or responses
- [ ] No SSRF — no user-controlled URLs used in server-side fetch calls