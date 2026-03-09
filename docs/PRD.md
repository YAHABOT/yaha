# YAHA — Product Requirements Document

> Ralphy task source. Each numbered task is independently executable.
> Run: `ralphy --prd docs/PRD.md --parallel --max-parallel 3`

---

## Phase 0: Project Scaffolding

### Task 0.1 — Initialize Next.js project
Initialize a Next.js 15 App Router project with TypeScript strict mode, Tailwind CSS v4,
ESLint, and Vitest. Configure `tailwind.config.ts` with the OLED design token palette
(see CLAUDE.md OLED Design Tokens). Configure `tsconfig.json` with strict: true and
path aliases (`@/*` → `src/*`). Add `.gitignore` that includes `.env.local`.

### Task 0.2 — Initialize Supabase
Install `@supabase/supabase-js` and `@supabase/ssr`. Create `src/lib/supabase/client.ts`
(browser client) and `src/lib/supabase/server.ts` (server client using cookies). Create
`supabase/migrations/` directory. Write the initial migration SQL creating all 9 core
tables with RLS enabled (see CLAUDE.md Supabase Schema). Each table needs a policy:
`auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE.

### Task 0.3 — Initialize Supabase Auth
Set up Supabase Auth with email/password and Google OAuth. Create `src/middleware.ts` for
session refresh on all routes. Create `src/app/(auth)/login/page.tsx` with email/password
form and Google sign-in button. Style with OLED theme. Create `src/app/actions/auth.ts`
with signIn, signOut, signUp Server Actions.

---

## Phase 1: Core Data Layer

### Task 1.1 — Tracker CRUD (data layer)
Create `src/lib/db/trackers.ts` with typed functions: `getTrackers(userId)`,
`createTracker(userId, data)`, `updateTracker(id, userId, data)`,
`deleteTracker(id, userId)`. All functions verify auth via Supabase server client.
Tracker schema type: `{ id, user_id, name, type, color, schema: SchemaField[] }`.
SchemaField type: `{ fieldId, label, type: 'number'|'text'|'rating'|'time', unit? }`.

### Task 1.2 — Tracker CRUD (UI)
Create `src/app/(app)/trackers/page.tsx` — grid of tracker cards with color, name, type.
Create `src/app/(app)/trackers/new/page.tsx` — form to create tracker (name, type, color,
add schema fields). Create `src/app/(app)/trackers/[id]/schema/page.tsx` — schema editor
(add/remove/reorder fields). Use Server Actions for mutations. OLED theme throughout.

### Task 1.3 — Tracker Logs (data layer)
Create `src/lib/db/logs.ts` with: `createLog(trackerId, userId, fields, source?)`,
`getLogs(trackerId, userId, dateRange?)`, `updateLog(id, userId, fields)`,
`deleteLog(id, userId)`, `getLogsForDay(userId, date)`. Fields stored as JSONB.

### Task 1.4 — Manual Logger (UI)
Create `src/app/(app)/trackers/[id]/log/page.tsx` — dynamic form from tracker schema.
Shows schema fields as inputs. On submit, calls createLog Server Action. Displays recent
log entries below the form with edit/delete. Date/time picker for backdating entries.

---

## Phase 2: AI Chat + Health Logging

### Task 2.1 — Gemini AI client
Create `src/lib/ai/gemini.ts` — Gemini 2.5 Flash wrapper. Functions:
`processHealthMessage(content, userContext, attachments?)` — handles text, base64 images,
audio files. Returns structured `ActionCard[]`. `extractFromImage(base64, mimeType)` —
OCR for nutrition labels and screenshots. System prompt injects: user profile, tracker
schemas, last 1000 log entries as context.

### Task 2.2 — Chat data layer
Create `src/lib/db/chat.ts`: `createSession(userId, title?)`, `getSessions(userId)`,
`getMessages(sessionId, userId)`, `addMessage(sessionId, role, content, actions?)`,
`updateSession(id, userId, data)`, `deleteSession(id, userId)`.

### Task 2.3 — Chat API route
Create `src/app/api/chat/route.ts` — POST endpoint. Receives: `{ sessionId, message,
attachments? }`. Validates auth. Injects user context + tracker schemas + last 1000 logs
into Gemini system prompt. Returns streaming response with ActionCard JSON at end.
ActionCard schema: `{ type, trackerId, trackerName, fields, date?, source }`.

### Task 2.4 — Chat UI
Create `src/app/(app)/chat/page.tsx` and `src/app/(app)/chat/[sessionId]/page.tsx`.
Sidebar: list of chat sessions, new chat button. Main area: message bubbles (OLED styled),
file/image/audio upload button, text input. Action cards appear as confirmable cards:
"Log [tracker] — [field values]. Confirm?" with Accept/Discard buttons. Accepting calls
createLog Server Action. Multiple sessions, persistent history via Supabase real-time.

---

## Phase 3: Journal + Correlator

### Task 3.1 — Daily journal view
Create `src/app/(app)/journal/page.tsx`. Day-selector sidebar (navigate by date). Main
area: cards per tracker showing logs for selected day. Each card shows schema field labels
with their logged values. Daily totals footer: sum for numbers, average for ratings.
"View all entries" toggle per tracker card.

### Task 3.2 — Correlator
Add Correlator box to journal page. Correlations stored in `correlations` table:
`{ id, user_id, name, formula: [{variableId, operator?}][], unit? }`. Create
`src/lib/db/correlations.ts`. UI: Correlator manager modal (create/edit/delete formulas).
Formula renderer: evaluate formula against logged day's data. If ANY variable has no data
for the day: display "---". If all variables have data: compute and display result.
Auto-save computed results to `daily_stats` table.

---

## Phase 4: Daily Routines

### Task 4.1 — Routines data layer
Create `src/lib/db/routines.ts`: CRUD for routines. Routine schema:
`{ id, user_id, name, trigger_phrase, type: 'standard'|'day_start'|'day_end',
  steps: [{ trackerId, trackerName, trackerColor, targetFields: string[] }] }`.

### Task 4.2 — Routine CRUD UI
Create `src/app/(app)/routines/page.tsx` — list routines. Create/edit modal with step
builder: choose tracker, select specific fields to prompt. Assign trigger phrase and type.

### Task 4.3 — Routine execution via chat
Extend `src/app/api/chat/route.ts` to detect routine trigger phrases in user messages.
When triggered: inject routine context into Gemini system prompt. AI walks user through
each step conversationally, prompting for the targetFields of each tracker. Results become
ActionCards for user confirmation. Day Start routine detects if already logged for today.

---

## Phase 5: Customizable Dashboard

### Task 5.1 — Dashboard widget types
Create `src/lib/db/dashboard.ts`. Widget schema:
`{ id, user_id, type: 'field_value'|'average'|'total'|'correlator', trackerId?,
  fieldId?, correlationId?, days?, label, position }`.
Widget types: field_value (latest value), average (N-day average of a field),
total (sum over date range), correlator (correlation formula result for date range).

### Task 5.2 — Dashboard data fetching
Create `src/lib/db/dashboard-data.ts` with functions to compute widget values from
Supabase. Use PostgreSQL aggregate functions via Supabase RPC where possible. Cache
results with 5-minute TTL in daily_stats table.

### Task 5.3 — Dashboard UI
Create `src/app/(app)/dashboard/page.tsx`. Widget grid (responsive, 2-col mobile, 4-col
desktop). Each widget card: label, computed value, sparkline for time series. Edit mode:
drag to reorder, click + to add widget, X to remove. "Add Widget" flow: select type →
select tracker/field/correlation → select date range → preview → save. OLED theme.

---

## Phase 6: Telegram Bot

### Task 6.1 — Telegram bot setup
Create `src/app/api/telegram/webhook/route.ts`. POST handler: validate
`X-Telegram-Bot-Api-Secret-Token` header. Parse Telegram Update object. Extract:
sender `username`, message `text`, photo `file_id[]`, voice `file_id`, document `file_id`.
Check sender username against `TELEGRAM_ALLOWED_HANDLES` env var. Reject unauthorized.

### Task 6.2 — Telegram file handling
Create `src/lib/telegram/files.ts`. `downloadTelegramFile(fileId, botToken)` — calls
Telegram getFile API, downloads file from CDN, returns base64 + mimeType. Max 20MB.
Handles: photos (JPEG), voice messages (OGG/MP3), documents (any MIME type).

### Task 6.3 — Telegram AI pipeline
Create `src/lib/telegram/processor.ts`. Routes Telegram messages through same Gemini
pipeline as web chat. Text → processHealthMessage. Photo → extractFromImage then
processHealthMessage. Voice → Gemini audio transcription then processHealthMessage.
Returns ActionCard[]. Auto-confirms actions (no manual confirmation via Telegram — send
confirmation summary message instead). Saves logs to Supabase. Responds via Telegram
sendMessage with inline keyboard showing what was logged.

### Task 6.4 — Telegram webhook registration
Create `src/app/api/telegram/register/route.ts` — GET endpoint that calls Telegram
setWebhook API with `{NEXT_PUBLIC_APP_URL}/api/telegram/webhook` and the secret token.
Add registration instructions to docs/. Create `src/lib/telegram/bot.ts` with sendMessage,
sendPhoto, answerCallbackQuery helper functions.

---

## Phase 7: Settings

### Task 7.1 — Settings page
Create `src/app/(app)/settings/page.tsx`. Sections:
- Profile: alias, targets (calories, sleep, water, steps), BMR/TDEE inputs
- Telegram: handle whitelist input, webhook registration button, test message button
- Data: export all data as JSON, import from JSON backup
- App: theme preview (OLED tokens displayed)
All settings persist to `users` table via Server Actions.
