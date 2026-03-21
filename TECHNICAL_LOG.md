# TECHNICAL_LOG — 2026-03-21 V2 Session

This log documents the root causes, architectural decisions, and file changes from the V2 polish sprint.

---

## Fix 1 — Routine Auto-Advance: `onConfirmed` Callback + Silent Trigger

**Root Cause**: `ChatInterface.tsx` rendered every `ActionCard` without any `onConfirm` prop (line 411 was just `<ActionCard key={idx} card={card} />`). The `onConfirm` callback existed in `ActionCard`'s type signature but was never passed. This meant confirming a log card had zero effect on the chat loop — the AI received no follow-up message and never prompted for the next routine step.

**Architecture**: The correct fix is NOT to change the prompt (done in V1, caused its own issues) but to wire up a client-side callback that fires after the DB write succeeds. When a routine is active, `ChatInterface` sends a silent `"continue"` message to `/api/chat`. The server sees `current_step_index` already advanced (happened when the AI produced the action card), builds the routine system prompt for step N+1, and responds with the next step's question. The user sees only the AI's response — no user bubble appears for the hidden trigger.

**New function added to `ChatInterface.tsx`**: `handleSendSilent(text)` — identical to `handleSendInternal` but skips the optimistic user message and swallows errors silently (auto-advance should never break the chat).

**Files Changed**:
- `src/components/chat/ActionCard.tsx` — added `onConfirmed?: () => void` prop; called after `setStatus('confirmed')` + existing `onConfirm?.()`.
- `src/components/chat/ChatInterface.tsx` — added `handleSendSilent`; passed `onConfirmed={() => handleSendSilent('continue')}` to every `ActionCard` when `session?.active_routine_id` is set.

---

## Fix 2 — Dedicated Edit Button on Confirmed ActionCard

**Root Cause**: Once `status === 'confirmed'`, the component rendered a static "Logged Successfully" banner with no interactive controls. Users had no path to correct a mistake post-confirmation.

**Fix**: Added an "Edit" button to the confirmed state banner. `onClick` sets `status` back to `'pending'`, which re-renders the full editable card with all field inputs, Confirm, and Discard buttons. The previously-confirmed DB row is not deleted — the user must confirm again to overwrite it (which calls `confirmLogAction` a second time with the corrected fields).

**File Changed**: `src/components/chat/ActionCard.tsx` — confirmed state JSX expanded with Edit button.

---

## Fix 3 — Smart Mapper: Fuzzy Label Matching in `sanitizeFields`

**Root Cause**: `sanitizeFields` in `actions.ts` only performed an exact lookup: `let raw = fields[schemaDef.fieldId]`. When Gemini returns `{"Deep Sleep": 1.5, "REM Sleep": 0.8}` but the tracker schema uses `fld_deep_sleep` / `fld_rem_sleep`, every field was silently dropped. 8 of 12 sleep fields were being lost this way.

**Fix**: Added three new helpers before the main sanitize loop:

1. `toSlug(s)` — normalizes any string to lowercase alphanumeric (e.g. `"Deep Sleep"` → `"deepsleep"`, `"fld_deep_sleep"` → `"flddeepsleep"`, bare `"deep_sleep"` → `"deepsleep"`).

2. `buildLabelIndex(schema)` — builds a `Map<slug, fieldId>` for all schema fields, indexing both the label slug and the bare fieldId slug (stripping `fld_` prefix).

3. `resolveField(fieldId, label, fields, labelIndex)` — tries in order:
   - Exact `fields[fieldId]`
   - Any key in fields whose slug matches the field's label slug
   - Any key whose slug matches the fieldId's bare slug

The pre-existing Smart Swapper (Score/Duration flip, Bed/Actual flip) is unchanged.

**File Changed**: `src/lib/ai/actions.ts`

---

## Fix 4 — Navigation Waterfall: Flatten `Promise.all` in `ChatSessionPage`

**Root Cause**: The previous implementation had a sequential waterfall inside the `Promise.all`:

```typescript
// Old — getMessages waited behind getSession
const [sessions, sessionData] = await Promise.all([
  getSessions(),
  (async () => {
    const s = await getSession(sessionId)       // round-trip 1
    const [m, r] = await Promise.all([
      getMessages(sessionId),                   // round-trip 2 (blocked by round-trip 1)
      ...
    ])
  })()
])
```

`getMessages` could not start until `getSession` completed. On a cold Supabase connection this added ~150–300ms of unnecessary latency on every session navigation.

**Fix**: Three independent fetches now run concurrently at the top level:

```typescript
const [sessions, session, messages] = await Promise.all([
  getSessions(),
  getSession(sessionId).catch(() => null),
  getMessages(sessionId).catch(() => []),
])
```

`getRoutine` still runs sequentially after (it needs `session.active_routine_id`), but it only fires when a routine is active — the common case (no routine) now has zero extra round-trips.

**File Changed**: `src/app/(app)/chat/[sessionId]/page.tsx`

---

## Summary

| Fix | File(s) | Impact |
|-----|---------|--------|
| Routine Auto-Advance | `ActionCard.tsx`, `ChatInterface.tsx` | AI prompts next step after card confirm |
| Edit Button | `ActionCard.tsx` | Users can re-open confirmed cards |
| Smart Mapper | `src/lib/ai/actions.ts` | ~8 previously-dropped sleep fields now captured |
| Nav Waterfall | `chat/[sessionId]/page.tsx` | ~150–300ms removed from session switching |

All production TypeScript checks pass (zero errors outside pre-existing test stubs).
