# TECHNICAL_LOG — 2026-03-21 Session

## Mission
Fix three regressions: Routine Flow (premature Step 2 prompt), Edit functionality, Navigation Latency.

---

## Fix #1 — Routine Execution: Premature Step 2 Request

**File**: `src/lib/ai/prompt-builder.ts` — `buildRoutineSystemPrompt`, line 172

**Root Cause**: The previous session changed FLOW RULE 4c to instruct the AI to
"IMMEDIATELY, in the same response, transition to Step N+1 and ask for its fields."
This caused the AI to dump all Step 2 field requests in the same response as the Step 1
action card — before the user had clicked Confirm.

**Evidence**: `evidence/media__1774090173437.png` — screenshot shows the Weight action card
(Step 1, unconfirmed) with a full block of text below it asking for all Sleep fields (Step 2).

**Fix**: Updated FLOW RULE 4c to restore the correct wait-for-confirm behaviour:

```
// Before (broken — premature)
Then IMMEDIATELY, in the same response, transition to Step N+1:
"<trackerName>" — ask for the fields: <fields>.
Do NOT wait for user confirmation between steps.

// After (correct — wait for confirm)
Let Armaan know the card is ready to confirm, and that Step N+1 (<trackerName>)
will follow once he confirms. Do NOT ask for Step N+1 data yet — wait for him
to confirm the card above first.
```

**How the step-advance actually works**: `route.ts` advances `current_step_index` on the
server as soon as the AI produces an action card for the current step's tracker. So by the
time the user confirms the card and sends any follow-up message, the session is already on
the next step — the AI will ask for it naturally. No "say next" friction, no premature prompt.

---

## Fix #2 — Edit Functionality (Already Present — No Change Needed)

**Handoff claim**: "Users cannot edit AI-extracted data before logging."

**Audit result**: `src/components/chat/ActionCard.tsx` lines 191–197 already render every
field as an `<input type="text">` with an `onChange` handler wired to `editableFields` state.
On Confirm, the **edited** values (not the original AI values) are sent to `confirmLogAction`.

The handoff was written against an older version of the code. No change required.

---

## Fix #3 — Navigation Latency: Unbounded Data Fetches

**File**: `src/lib/db/chat.ts`

**Root Cause**: Two functions had no `LIMIT` clause:

| Function | Problem |
|----------|---------|
| `getSessions()` | Fetched ALL sessions — every chat page load pulled the entire session list |
| `getMessages(sessionId)` | Fetched ALL messages with no cap — a session with 200+ messages sent every `actions` JSONB blob to the browser on every navigation |

Both fire on every `[sessionId]/page.tsx` render (they run in parallel via `Promise.all`,
but `getMessages` also has a sequential dependency on `getSession` completing first, creating
a two-round-trip waterfall per navigation).

**Fix**: Added two named constants and applied limits to both queries:

```typescript
const SESSIONS_SIDEBAR_LIMIT = 30   // sidebar only needs recent sessions
const MESSAGES_DISPLAY_LIMIT = 100  // cap chat history sent to browser
```

- `getSessions()`: `.limit(SESSIONS_SIDEBAR_LIMIT)` — capped at 30 most-recent sessions
- `getMessages()`: fetches newest 100 messages descending, then reverses to chronological
  order for display (mirrors the existing pattern in `getRecentMessagesForAI`)

Note: `getRecentMessagesForAI` (called inside the chat API route for AI context) already
had its own separate `limit` of 10–20 — this was not changed.

---

## Handoff File Mapping (Incorrect Paths → Actual Files)

The handoff referenced `src/pages/Chat.tsx` and `src/pages/Logger.tsx` — these don't exist.
YAHA uses Next.js 15 App Router. Correct file mapping:

| Handoff Reference | Actual File |
|-------------------|-------------|
| `src/pages/Chat.tsx` (routineContextInjection) | `src/lib/ai/prompt-builder.ts` |
| `src/pages/Chat.tsx` (limit(300) fetch) | `src/lib/db/chat.ts` |
| `src/pages/Logger.tsx` (Edit button) | `src/components/chat/ActionCard.tsx` (already done) |
| `navigate('/containers/:id/log')` | N/A — inline editing already present in ActionCard |

---

## Verification

- `npx tsc --noEmit`: zero errors in production source; all failures are pre-existing test
  file stubs (`__tests__/`) not caused by these changes
- Preview server: loaded at `localhost:49927`, dashboard renders, zero console errors
- OLED theme: intact

## Files Changed

```
src/lib/ai/prompt-builder.ts   (modified — Fix #1: routine flow prompt)
src/lib/db/chat.ts             (modified — Fix #3: SESSIONS_SIDEBAR_LIMIT + MESSAGES_DISPLAY_LIMIT)
```
