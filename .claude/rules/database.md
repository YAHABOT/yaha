# Database Rules — YAHA (Supabase + PostgreSQL)

## Client Setup

Two clients — use the right one for the context:

```typescript
// src/lib/supabase/server.ts — for Server Components, Server Actions, Route Handlers
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerClient() {
  const cookieStore = await cookies()
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
}

// src/lib/supabase/client.ts — for Client Components only
import { createBrowserClient } from '@supabase/ssr'
export const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

## JSONB Schema Patterns

Health logs use a polymorphic `fields` JSONB column. This preserves schema flexibility
while keeping all logs in one queryable table.

```typescript
// Type definitions for JSONB fields
type FieldValue = number | string | null
type LogFields = Record<string, FieldValue>  // { "fld_001": 350, "fld_002": "chicken" }

type TrackerSchema = {
  fieldId: string       // "fld_001" — stable ID, never changes
  label: string         // "Calories" — display name, can change
  type: 'number' | 'text' | 'rating' | 'time'
  unit?: string         // "kcal", "hrs", "kg"
}[]
```

```sql
-- Querying JSONB fields in PostgreSQL
SELECT
  id,
  fields->>'fld_001' AS calories,
  (fields->>'fld_001')::numeric AS calories_num,
  logged_at
FROM tracker_logs
WHERE user_id = auth.uid()
  AND fields ? 'fld_001'   -- has this field
  AND logged_at >= NOW() - INTERVAL '7 days';
```

## Migrations

- **Location**: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- **Never edit applied migrations**: Create a new migration for changes.
- **Local dev**: `npx supabase db reset` applies all migrations from scratch.
- **Production**: `npx supabase db push` applies pending migrations.

```sql
-- Migration template
-- supabase/migrations/20260309000000_create_trackers.sql

CREATE TABLE trackers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'custom',
  color       TEXT NOT NULL DEFAULT '#10b981',
  schema      JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE trackers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their trackers" ON trackers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX trackers_user_id_idx ON trackers(user_id);
```

## Data Access Layer Patterns

All DB calls live in `src/lib/db/`. One file per domain. Pattern:

```typescript
// src/lib/db/logs.ts
import { createServerClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'  // generated types

export async function createLog(
  trackerId: string,
  fields: Record<string, unknown>,
  source?: string
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('tracker_logs')
    .insert({ tracker_id: trackerId, user_id: user.id, fields, source })
    .select()
    .single()

  if (error) throw new Error(`Failed to create log: ${error.message}`)
  return data
}
```

## Real-Time Subscriptions

For chat messages and dashboard live updates:

```typescript
// Client Component — real-time chat messages
useEffect(() => {
  const channel = supabase
    .channel(`chat-${sessionId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `session_id=eq.${sessionId}`,
    }, (payload) => setMessages(prev => [...prev, payload.new as ChatMessage]))
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [sessionId])
```

## Query Performance Rules

- **Always index `user_id`** on every table.
- **Index `logged_at`** on `tracker_logs` for date-range queries.
- **Index `session_id`** on `chat_messages`.
- **Use `.select('specific,columns')` not `.select('*')`** — avoid over-fetching.
- **Paginate logs**: Default limit 50 per page. Last 1000 for AI context (separate query).
- **Use Supabase RPC** for aggregate queries (sums, averages) — push computation to DB.

```typescript
// Aggregate via RPC (define in migration as PostgreSQL function)
const { data } = await supabase.rpc('get_daily_totals', {
  p_user_id: user.id,
  p_date: '2026-03-09',
  p_tracker_id: trackerId,
  p_field_id: 'fld_001'
})
```
