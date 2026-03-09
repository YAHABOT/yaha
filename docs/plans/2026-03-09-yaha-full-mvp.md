# YAHA Full MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build YAHA from a blank repo to a fully functional health tracker with AI chat logging, daily journal, routines, customizable dashboard, and Telegram bot.

**Architecture:** Next.js 15 App Router with Supabase for auth + data. All mutations go through Server Actions. AI processing via Gemini 2.5 Flash. Telegram as a second front-end using the same AI pipeline.

**Tech Stack:** Next.js 15 · TypeScript strict · Supabase · Gemini 2.5 Flash · Tailwind CSS OLED · Recharts v3 · Telegram Bot API · Vitest

---

## Pre-flight Checklist (User does these manually before any agent runs)

These cannot be automated — complete them before starting the build loop.

**Step 1: Create Supabase cloud project**
- Go to https://supabase.com → New Project
- Copy: Project URL, anon key, service_role key
- Note the database password

**Step 2: Create `.env.local` at project root**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=your-key-here
TELEGRAM_BOT_TOKEN=placeholder-fill-in-later
TELEGRAM_WEBHOOK_SECRET=generate-a-random-string-32-chars
TELEGRAM_ALLOWED_HANDLES=your_telegram_username
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 3: Install Supabase CLI + log in**
```bash
npm install -g supabase
supabase login
```

**Step 4: Verify Gemini API key**
Test at https://aistudio.google.com — make sure it has access to `gemini-2.5-flash` model.

---

## Build Loop Rules (Orchestrator enforces these)

1. Before each feature: check MEMORY.md Build State — already PASS? Skip.
2. research-agent ONLY for: Gemini 2.5 Flash API, Telegram Bot API, Recharts v3 patterns. Not for known stack (Next.js, Supabase, Tailwind).
3. Every coding-agent dispatch uses the Lean Prompt Template (see each task below).
4. code-reviewer FAIL → re-dispatch coding-agent with exact findings bullet list.
5. security-reviewer only runs after code-reviewer PASS.
6. qa-agent only runs after security-reviewer PASS.
7. Write verdict + date to MEMORY.md after every full PASS cycle.
8. Context > 60%: write state to MEMORY.md → `/compact` → re-read MEMORY.md.

---

## Phase 0: Project Scaffolding

### Task 0.1 — Initialize Next.js Project

**Pre-step (User runs this manually):**
```bash
cd "C:\Users\the--\Documents\Projects\yaha"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

**Then coding-agent handles configuration:**

```
Task: Configure the newly scaffolded Next.js 15 project with strict TypeScript, OLED Tailwind tokens, Vitest, and path aliases
Pattern: N/A (new project — use CLAUDE.md OLED tokens + tsconfig strict mode)
Output:
  - tailwind.config.ts (extend colors with OLED design tokens)
  - tsconfig.json (strict: true, paths: { "@/*": ["./src/*"] })
  - vitest.config.ts (new file — Vitest with jsdom + React Testing Library)
  - package.json (add vitest, @vitest/ui, @testing-library/react, @testing-library/jest-dom)
  - src/app/globals.css (OLED base styles, font-family)
  - .env.example (all env vars with placeholder descriptions, no real values)
  - .gitignore (ensure .env.local is listed)
Rules: .claude/rules/frontend.md, .claude/rules/code-style.md
Validate: npm run lint && npm test
```

**Agent sequence:** coding-agent → code-reviewer → qa-agent (security-reviewer skipped — no business logic yet)

**Checkpoint:** `npm run dev` shows Next.js default page. `npm test` reports 0 tests (pass).

---

### Task 0.2 — Supabase Clients + Initial Migration

**Research needed:** NO — Supabase SSR patterns are documented in `.claude/rules/database.md`

```
Task: Create Supabase server/client wrappers and the initial DB migration for all 9 core tables with RLS
Pattern: .claude/rules/database.md (client setup + migration template)
Output:
  - src/lib/supabase/server.ts (createServerClient using @supabase/ssr + cookies)
  - src/lib/supabase/client.ts (createClient browser client)
  - supabase/migrations/20260309000000_initial_schema.sql (all 9 tables + RLS policies + indexes)
Rules: .claude/rules/database.md, .claude/rules/security.md
Validate: npm run lint && npm test
```

**Tables to create (from CLAUDE.md schema):**
```sql
users, trackers, tracker_logs, chat_sessions, chat_messages,
routines, correlations, daily_stats, telegram_events
```

Each needs: `id UUID PRIMARY KEY`, `user_id UUID REFERENCES auth.users`, `RLS ENABLE`, policy `auth.uid() = user_id`, index on `user_id`.

**After coding-agent:** Apply migration manually:
```bash
npx supabase db push
```

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

### Task 0.3 — Auth (Login Page + Middleware + Server Actions)

```
Task: Implement Supabase email/password auth — login page, session middleware, and auth Server Actions
Pattern: .claude/rules/frontend.md (App Router structure, Server Components, Server Actions)
Output:
  - src/middleware.ts (session refresh on all routes, protect /app/* routes)
  - src/app/(auth)/login/page.tsx (email + password form, OLED styled)
  - src/app/actions/auth.ts (signIn, signUp, signOut Server Actions — return {error} or {success})
  - src/app/(app)/layout.tsx (shared layout shell: sidebar nav + main content area)
Rules: .claude/rules/frontend.md, .claude/rules/security.md, .claude/rules/code-style.md
Validate: npm run lint && npm test
```

**Note:** Google OAuth skipped — no credentials yet. Can add later via Settings.

**Tests to write:**
```typescript
// src/__tests__/auth.test.ts
// - signIn returns {error} when credentials wrong
// - signUp returns {success} when valid email + password
// - signOut clears session
```

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

## Phase 1: Core Data Layer

### Task 1.1 — Tracker Data Layer

```
Task: Create the Tracker data access layer with typed CRUD functions that enforce auth and RLS
Pattern: .claude/rules/database.md (DAL pattern — getUser() first, then query)
Output:
  - src/lib/db/trackers.ts (getTrackers, createTracker, updateTracker, deleteTracker)
  - src/types/tracker.ts (Tracker, SchemaField, TrackerType types)
  - src/__tests__/db/trackers.test.ts (mock Supabase, test each function)
Rules: .claude/rules/database.md, .claude/rules/security.md, .claude/rules/code-style.md
Validate: npm run lint && npm test
```

**Types to define:**
```typescript
type SchemaField = {
  fieldId: string   // "fld_001" — stable, never changes
  label: string     // "Calories" — display name
  type: 'number' | 'text' | 'rating' | 'time'
  unit?: string     // "kcal", "hrs"
}

type Tracker = {
  id: string
  user_id: string
  name: string
  type: 'nutrition' | 'sleep' | 'workout' | 'mood' | 'water' | 'custom'
  color: string   // hex
  schema: SchemaField[]
  created_at: string
  updated_at: string
}
```

**Test pattern:**
```typescript
// Mock @supabase/ssr, test that:
// - getTrackers() calls auth.getUser() before query
// - createTracker() throws 'Unauthorized' if no user
// - deleteTracker() only deletes user's own records
```

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

### Task 1.2 — Tracker CRUD UI

**Skill to use:** `.claude/skills/tracker-creation/SKILL.md`

```
Task: Build the Tracker CRUD UI — tracker list page, new tracker form, and schema editor
Pattern: src/lib/db/trackers.ts (data layer just created), .claude/rules/frontend.md
Output:
  - src/app/(app)/trackers/page.tsx (grid of tracker cards — Server Component)
  - src/app/(app)/trackers/new/page.tsx (create form — name, type, color, add schema fields)
  - src/app/(app)/trackers/[id]/schema/page.tsx (schema editor — add/remove/reorder fields)
  - src/components/trackers/TrackerCard.tsx (color dot, name, type badge, log + edit links)
  - src/components/trackers/SchemaFieldRow.tsx (field label, type, unit inputs)
  - src/app/actions/trackers.ts (createTrackerAction, updateTrackerAction, deleteTrackerAction)
  - src/__tests__/trackers/TrackerCard.test.tsx
Rules: .claude/rules/frontend.md, .claude/rules/code-style.md
Skills: .claude/skills/tracker-creation/SKILL.md
Validate: npm run lint && npm test
```

**OLED styling requirements:**
- Card: `bg-surface border border-border rounded-xl p-4`
- Color dot: inline `style={{ backgroundColor: tracker.color }}` (dynamic, Tailwind can't do this)
- Type badge: use named color tokens (text-nutrition, text-sleep, etc.)
- Empty state: "No trackers yet. Create your first one."

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

### Task 1.3 — Logs Data Layer

```
Task: Create the tracker_logs data access layer with JSONB field storage
Pattern: src/lib/db/trackers.ts (same auth + error handling pattern)
Output:
  - src/lib/db/logs.ts (createLog, getLogs, updateLog, deleteLog, getLogsForDay)
  - src/types/log.ts (TrackerLog type with JSONB fields)
  - src/__tests__/db/logs.test.ts
Rules: .claude/rules/database.md, .claude/rules/security.md, .claude/rules/code-style.md
Validate: npm run lint && npm test
```

**Types:**
```typescript
type TrackerLog = {
  id: string
  tracker_id: string
  user_id: string
  fields: Record<string, number | string | null>  // { "fld_001": 350, "fld_002": "chicken" }
  logged_at: string
  source: 'web' | 'telegram' | 'manual'
  created_at: string
}
```

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

### Task 1.4 — Manual Logger UI

```
Task: Build the manual log entry page — dynamic form generated from tracker schema
Pattern: src/app/(app)/trackers/new/page.tsx (form pattern), src/lib/db/logs.ts
Output:
  - src/app/(app)/trackers/[id]/log/page.tsx (dynamic form + recent entries list)
  - src/components/trackers/LogForm.tsx (client component — generates inputs from schema)
  - src/components/trackers/LogEntry.tsx (displays a single log entry with edit/delete)
  - src/app/actions/logs.ts (createLogAction, updateLogAction, deleteLogAction)
  - src/__tests__/trackers/LogForm.test.tsx
Rules: .claude/rules/frontend.md, .claude/rules/code-style.md
Validate: npm run lint && npm test
```

**Input type mapping:**
```
SchemaField.type 'number'  → <input type="number">
SchemaField.type 'text'    → <input type="text">
SchemaField.type 'rating'  → <input type="range" min="1" max="10">
SchemaField.type 'time'    → <input type="time">
```

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

## Phase 2: AI Chat + Health Logging

### Task 2.1 — Research: Gemini 2.5 Flash API

**Trigger research-agent for this task only.**

```
Task (research-agent): Document the Gemini 2.5 Flash API for:
  1. Text chat with system prompt injection
  2. Multimodal inputs (base64 image, audio file, document)
  3. Structured JSON output (response_mime_type: application/json)
  4. Streaming responses
  5. Audio transcription (voice messages)
Output: report only — include exact SDK method names, request shapes, response shapes
```

**Research informs Task 2.2.**

---

### Task 2.2 — Gemini AI Client

**Skill to use:** `.claude/skills/health-logging/SKILL.md`

```
Task: Build the Gemini 2.5 Flash wrapper with multimodal support and structured ActionCard output
Pattern: N/A (new — use research-agent report from Task 2.1)
Output:
  - src/lib/ai/gemini.ts (processHealthMessage, extractFromImage)
  - src/types/action-card.ts (ActionCard type)
  - src/__tests__/ai/gemini.test.ts (mock @google/generative-ai, test output structure)
Rules: .claude/rules/code-style.md, .claude/rules/security.md
Skills: .claude/skills/health-logging/SKILL.md
Validate: npm run lint && npm test
```

**ActionCard type:**
```typescript
type ActionCard = {
  type: 'log'
  trackerId: string
  trackerName: string
  fields: Record<string, number | string | null>
  date?: string    // ISO date — for backdated entries
  source: 'web' | 'telegram'
  confidence: number   // 0-1 — AI confidence in extraction
}
```

**System prompt must inject:**
1. User profile (alias, targets)
2. All tracker schemas (name + field definitions)
3. Last 1000 log entries as JSON context

**Security — validate before DB write:**
```typescript
// Strip fields not in tracker schema
// Reject numeric values > 10x expected range
// Reject duration values > 24 (treat as minutes, convert to hours)
```

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

### Task 2.3 — Chat Data Layer

```
Task: Create the chat_sessions + chat_messages data access layer
Pattern: src/lib/db/trackers.ts (DAL pattern)
Output:
  - src/lib/db/chat.ts (createSession, getSessions, getMessages, addMessage, updateSession, deleteSession)
  - src/types/chat.ts (ChatSession, ChatMessage types)
  - src/__tests__/db/chat.test.ts
Rules: .claude/rules/database.md, .claude/rules/security.md
Validate: npm run lint && npm test
```

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

### Task 2.4 — Chat API Route

```
Task: Build the POST /api/chat route — receives message + optional attachments, calls Gemini, returns streaming response + ActionCards
Pattern: src/lib/ai/gemini.ts, src/lib/db/chat.ts, src/lib/db/logs.ts
Output:
  - src/app/api/chat/route.ts (POST handler — validate auth, inject context, stream Gemini, return ActionCards)
  - src/__tests__/api/chat.test.ts (mock Gemini + Supabase, test auth guard, test ActionCard structure)
Rules: .claude/rules/security.md, .claude/rules/code-style.md
Validate: npm run lint && npm test
```

**Request shape:**
```typescript
{
  sessionId: string
  message: string
  attachments?: Array<{
    type: 'image' | 'audio' | 'document'
    base64: string
    mimeType: string
  }>
}
```

**Response:** streaming text + final JSON block `{ actions: ActionCard[] }`

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

### Task 2.5 — Chat UI

```
Task: Build the multi-session chat UI with message bubbles, file upload, and ActionCard confirmation flow
Pattern: src/app/(app)/trackers/page.tsx (OLED layout), src/app/api/chat/route.ts
Output:
  - src/app/(app)/chat/page.tsx (redirect to most recent session or create new)
  - src/app/(app)/chat/[sessionId]/page.tsx (main chat view — Server Component shell)
  - src/components/chat/ChatSidebar.tsx (session list, new chat button)
  - src/components/chat/ChatWindow.tsx (client — message list, real-time via Supabase)
  - src/components/chat/MessageBubble.tsx (user / assistant styling, OLED)
  - src/components/chat/ActionCard.tsx (confirmable card — fields + Accept/Discard)
  - src/components/chat/FileUpload.tsx (image/audio/document button)
  - src/components/chat/ChatInput.tsx (textarea + send, handles Enter key)
  - src/__tests__/chat/ActionCard.test.tsx
Rules: .claude/rules/frontend.md, .claude/rules/code-style.md
Validate: npm run lint && npm test
```

**Streaming:** fetch() with `ReadableStream`, display text as it arrives. ActionCards appear after stream ends.

**Real-time:** Supabase Postgres changes subscription on `chat_messages` for live session updates.

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

## Phase 3: Journal + Correlator

### Task 3.1 — Daily Journal View

```
Task: Build the daily journal page — date navigation, per-tracker log cards, daily totals
Pattern: src/app/(app)/trackers/page.tsx (grid layout), src/lib/db/logs.ts (getLogsForDay)
Output:
  - src/app/(app)/journal/page.tsx (Server Component — today's date default, date param)
  - src/components/journal/DaySelector.tsx (client — navigate prev/next day, date picker)
  - src/components/journal/TrackerDayCard.tsx (logs for one tracker, daily totals footer)
  - src/components/journal/LogRow.tsx (single log entry row — fields + timestamp)
  - src/__tests__/journal/TrackerDayCard.test.tsx
Rules: .claude/rules/frontend.md, .claude/rules/code-style.md
Validate: npm run lint && npm test
```

**Totals logic:**
- `number` fields: sum all entries for the day
- `rating` fields: average of all entries
- `text` fields: count of entries
- `time` fields: sum (as total duration)

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

### Task 3.2 — Correlator

```
Task: Build the Correlator — formula manager modal + formula evaluation against daily logs
Pattern: src/lib/db/logs.ts, src/app/(app)/journal/page.tsx
Output:
  - src/lib/db/correlations.ts (CRUD for correlations, saveDaily computedResult to daily_stats)
  - src/types/correlation.ts (Correlation, FormulaVariable types)
  - src/components/journal/CorrelatorBox.tsx (formula list, computed values or "---")
  - src/components/journal/CorrelatorModal.tsx (client — create/edit/delete formula, pick variables)
  - src/app/actions/correlations.ts (createCorrelationAction, updateCorrelationAction, deleteCorrelationAction)
  - src/__tests__/journal/correlator.test.ts (formula evaluation — test "---" when missing, test math)
Rules: .claude/rules/frontend.md, .claude/rules/code-style.md, .claude/rules/database.md
Validate: npm run lint && npm test
```

**Formula structure:**
```typescript
type FormulaVariable = {
  fieldRef: string     // "tracker_id:field_id"
  operator?: '+' | '-' | '*' | '/'
}
type Correlation = {
  id: string
  user_id: string
  name: string           // "Net Calories"
  formula: FormulaVariable[]
  unit?: string          // "kcal"
}
```

**Display rule:** If ANY variable has no data for the selected day → show `---`. Never show partial results.

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

## Phase 4: Daily Routines

### Task 4.1 — Routines Data Layer + CRUD UI

**Skill to use:** `.claude/skills/daily-routine/SKILL.md`

```
Task: Build routines CRUD — data layer, list page, create/edit modal with step builder
Pattern: src/lib/db/trackers.ts, src/app/(app)/trackers/page.tsx
Output:
  - src/lib/db/routines.ts (getRoutines, createRoutine, updateRoutine, deleteRoutine)
  - src/types/routine.ts (Routine, RoutineStep types)
  - src/app/(app)/routines/page.tsx (list routines with type badge + trigger phrase)
  - src/components/routines/RoutineCard.tsx
  - src/components/routines/RoutineModal.tsx (client — step builder: pick tracker → pick fields)
  - src/app/actions/routines.ts
  - src/__tests__/routines/RoutineModal.test.tsx
Rules: .claude/rules/frontend.md, .claude/rules/code-style.md, .claude/rules/database.md
Skills: .claude/skills/daily-routine/SKILL.md
Validate: npm run lint && npm test
```

**Routine type:** `'standard' | 'day_start' | 'day_end'`

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

### Task 4.2 — Routine Execution via Chat

```
Task: Extend the chat API to detect routine trigger phrases and walk users through steps conversationally
Pattern: src/app/api/chat/route.ts, src/lib/db/routines.ts, src/lib/ai/gemini.ts
Output:
  - src/app/api/chat/route.ts (modified — detect trigger phrases, inject routine context into system prompt)
  - src/lib/ai/routines.ts (detectRoutineTrigger, buildRoutineSystemPrompt)
  - src/__tests__/ai/routines.test.ts (test trigger detection, test day_start deduplication)
Rules: .claude/rules/code-style.md, .claude/rules/security.md
Skills: .claude/skills/daily-routine/SKILL.md
Validate: npm run lint && npm test
```

**Day Start deduplication:** Check if any logs exist for today in the routine's tracked fields. If already logged → tell user "Already logged this morning. Want to update?"

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

## Phase 5: Customizable Dashboard

### Task 5.1 — Dashboard Data Layer

**Skill to use:** `.claude/skills/dashboard-builder/SKILL.md`

```
Task: Build the dashboard widget data layer — widget CRUD and data computation functions
Pattern: src/lib/db/trackers.ts, src/lib/db/logs.ts
Output:
  - src/lib/db/dashboard.ts (getWidgets, createWidget, updateWidget, deleteWidget, updateWidgetPositions)
  - src/lib/db/dashboard-data.ts (computeWidgetValue — field_value, average, total, correlator)
  - src/types/dashboard.ts (Widget, WidgetType types)
  - src/__tests__/db/dashboard-data.test.ts (test each widget computation type)
Rules: .claude/rules/database.md, .claude/rules/code-style.md
Skills: .claude/skills/dashboard-builder/SKILL.md
Validate: npm run lint && npm test
```

**Widget type → computation:**
```
field_value  → latest log entry's value for fieldId in last 24h
average      → mean of all fieldId values over last N days
total        → sum of all fieldId values over date range
correlator   → evaluate correlation formula for date range
```

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

### Task 5.2 — Dashboard UI

```
Task: Build the customizable dashboard — widget grid, add/remove/reorder, sparklines
Pattern: src/lib/db/dashboard-data.ts, .claude/rules/frontend.md (Recharts pattern)
Output:
  - src/app/(app)/dashboard/page.tsx (Server Component — load widgets + computed values)
  - src/components/dashboard/WidgetGrid.tsx (client — 2-col mobile, 4-col desktop, edit mode)
  - src/components/dashboard/WidgetCard.tsx (label, value, sparkline via Recharts SparkLine)
  - src/components/dashboard/AddWidgetFlow.tsx (multi-step: type → tracker/field → range → preview)
  - src/components/ui/SparkLine.tsx (Recharts ResponsiveContainer + LineChart)
  - src/app/actions/dashboard.ts (createWidgetAction, updateWidgetAction, deleteWidgetAction, reorderWidgetsAction)
  - src/__tests__/dashboard/WidgetCard.test.tsx
Rules: .claude/rules/frontend.md, .claude/rules/code-style.md
Skills: .claude/skills/dashboard-builder/SKILL.md
Validate: npm run lint && npm test
```

**Recharts pattern (from frontend.md):** SparkLine component — `ResponsiveContainer`, `LineChart`, custom tooltip with OLED colors.

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

## Phase 6: Telegram Bot

> **Prerequisite:** `TELEGRAM_BOT_TOKEN` must be set in `.env.local` before starting this phase.
> If not set → skip Phase 6, continue to Phase 7, return here when token is available.

### Task 6.1 — Research: Telegram Bot API

```
Task (research-agent): Document Telegram Bot API v9.5:
  1. setWebhook with secret token header
  2. Update object structure (message, photo, voice, document)
  3. getFile + file download URL pattern
  4. sendMessage with inline keyboard
  5. answerCallbackQuery
  6. File size limits + supported MIME types
Output: report only
```

---

### Task 6.2 — Telegram Webhook + File Handler

**Skill to use:** `.claude/skills/telegram-bot/SKILL.md`

```
Task: Build the Telegram webhook route, file downloader, and bot helper functions
Pattern: .claude/rules/security.md (webhook validation pattern)
Output:
  - src/app/api/telegram/webhook/route.ts (POST — validate secret header, parse Update, check whitelist)
  - src/app/api/telegram/register/route.ts (GET — call setWebhook API)
  - src/lib/telegram/bot.ts (sendMessage, sendPhoto, answerCallbackQuery)
  - src/lib/telegram/files.ts (downloadTelegramFile — getFile API → CDN download → base64)
  - src/__tests__/telegram/webhook.test.ts (test auth guard, test whitelist check)
Rules: .claude/rules/security.md, .claude/rules/code-style.md
Skills: .claude/skills/telegram-bot/SKILL.md
Validate: npm run lint && npm test
```

**Security (non-negotiable):**
```typescript
const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
  return new Response('Unauthorized', { status: 401 })
}
// Then check username whitelist
const username = update.message?.from?.username
const allowed = process.env.TELEGRAM_ALLOWED_HANDLES?.split(',') ?? []
if (!allowed.includes(username)) {
  return new Response('Forbidden', { status: 403 })
}
```

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

### Task 6.3 — Telegram AI Pipeline

```
Task: Route Telegram messages through the Gemini pipeline and auto-confirm logs
Pattern: src/lib/ai/gemini.ts, src/lib/db/logs.ts, src/lib/telegram/bot.ts
Output:
  - src/lib/telegram/processor.ts (processUpdate — text/photo/voice/document → ActionCard[] → auto-save → reply)
  - src/__tests__/telegram/processor.test.ts (mock Gemini + bot.sendMessage, test each message type)
Rules: .claude/rules/code-style.md, .claude/rules/security.md
Skills: .claude/skills/telegram-bot/SKILL.md
Validate: npm run lint && npm test
```

**Auto-confirm flow (no manual confirmation via Telegram):**
1. Process message → ActionCard[]
2. For each ActionCard: call createLog()
3. Reply with summary message: "Logged: [tracker] — [field: value, ...]\nTotal today: [running total]"

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

## Phase 7: Settings

### Task 7.1 — Settings Page

```
Task: Build the settings page — profile, Telegram config, data export/import
Pattern: src/app/(app)/trackers/page.tsx (page layout), src/app/actions/auth.ts (Server Actions pattern)
Output:
  - src/app/(app)/settings/page.tsx (Server Component — load user profile)
  - src/lib/db/users.ts (getUserProfile, updateUserProfile)
  - src/components/settings/ProfileSection.tsx (alias, targets: calories/sleep/water/steps)
  - src/components/settings/TelegramSection.tsx (handle input, register webhook button, test button)
  - src/components/settings/DataSection.tsx (export JSON button, import JSON file input)
  - src/app/actions/settings.ts (updateProfileAction, exportDataAction, importDataAction)
  - src/__tests__/settings/ProfileSection.test.tsx
Rules: .claude/rules/frontend.md, .claude/rules/code-style.md, .claude/rules/security.md
Validate: npm run lint && npm test
```

**Export:** Bundle all user's trackers + logs + correlations + routines as single JSON. Download as `yaha-export-YYYY-MM-DD.json`.

**Agent sequence:** coding-agent → code-reviewer → security-reviewer → qa-agent

---

## Phase 8: Navigation + Polish

### Task 8.1 — Sidebar Navigation

```
Task: Wire up the sidebar navigation linking all app routes
Pattern: src/app/(app)/layout.tsx
Output:
  - src/components/layout/Sidebar.tsx (client — links to dashboard, chat, journal, routines, trackers, settings)
  - src/components/layout/NavItem.tsx (active state via usePathname, OLED hover states)
  - src/__tests__/layout/Sidebar.test.tsx
Rules: .claude/rules/frontend.md, .claude/rules/code-style.md
Validate: npm run lint && npm test
```

**Nav items:** Dashboard · Chat · Journal · Routines · Trackers · Settings

**Agent sequence:** coding-agent → code-reviewer → qa-agent (security-reviewer skipped — pure nav)

---

## Milestone Summary

| Phase | Features | Blocker |
|-------|----------|---------|
| 0 | Scaffolding + Auth | User creates Supabase project + .env.local |
| 1 | Tracker CRUD + Manual Logging | Phase 0 complete |
| 2 | AI Chat + Health Logging | Gemini API key in .env |
| 3 | Journal + Correlator | Phase 1 + 2 complete |
| 4 | Daily Routines | Phase 2 complete |
| 5 | Dashboard | Phase 1 + 3 complete |
| 6 | Telegram Bot | Telegram bot token available |
| 7 | Settings | Phase 1 complete |
| 8 | Nav + Polish | All phases complete |

---

## MEMORY.md Update Template

After each feature reaches full PASS, append to MEMORY.md Build State:

```markdown
| Tracker CRUD | PASS | code-reviewer ✓, security ✓, qa ✓ | 2026-03-09 |
```

---

## Context Hygiene Reminder

- After Phase 2 (AI Chat): likely at 60%+ context. Write state → `/compact`.
- After Phase 4 (Routines): second likely compact point.
- Never pass full file contents to subagents — file paths only.
