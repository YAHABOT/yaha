# TECHNICAL_LOG — 2026-03-20/21 Sprint

Documents every architectural decision, file change, and logic refactor made during this polishing sprint.

---

## Priority #1 — Routine Auto-Advance Friction

**Problem**: During multi-step routines (e.g., Morning Check-in), the AI asked the user to explicitly type "next" before moving to the next step.

**Root Cause**: `buildRoutineSystemPrompt` in `prompt-builder.ts` had two explicit guards:
- `"Confirm the card above, then say **next** when you're ready for Step X"`
- `"Do NOT ask for Step X+1 data in this response. Wait for the user to confirm first."`

The backend (`route.ts`) **already** advances `current_step_index` server-side as soon as an action card is produced for the current step's tracker — the waiting instruction was purely a prompt-level constraint.

**Fix**: Modified FLOW RULES step 4 in `buildRoutineSystemPrompt`:

```
// Before
- Tell the user to say "next" before step N+1.
- Do NOT ask for step N+1 data. Wait for user confirmation.

// After
- Then IMMEDIATELY, in the same response, transition to Step N+1 — ask for its fields.
  Do NOT wait for user confirmation between steps.
```

**File**: `src/lib/ai/prompt-builder.ts`

---

## Priority #2 — Global Units Missing in History & Journal

**Problem**: Fields with units (kg, kcal, g, etc.) displayed as bare numbers ("65") in Tracker History and Journal Day view. Units only appeared in Chat Action Cards.

**Root Cause**: In `src/lib/utils/format.ts`, the generic numeric formatter returned `String(rounded)` without appending the unit — the unit parameter was received but silently dropped.

**Fix**:
```typescript
// Before
return String(rounded)

// After
return unit ? `${String(rounded)} ${unit}` : String(rounded)
```

**File**: `src/lib/utils/format.ts`

---

## Priority #3 — Vision-Only Submission Block

**Problem**: Sending an image with no text caused `400 Message is required`.

**Root Cause**: `route.ts` validated `message` unconditionally before checking for attachments. Also: `message.substring(0, 50)` would fail if message was undefined.

**Fixes**:
1. `message` in `ChatRequestBody` changed to `string | undefined`
2. Validation guard relaxed — message only required when `attachments.length === 0`:
   ```typescript
   const hasAttachments = Array.isArray(rawAttachments) && rawAttachments.length > 0
   if (!hasAttachments && (!message || ...)) return 400
   ```
3. Log preview: `message ? message.substring(0, 50) : '[image-only]'`
4. Length check: `if (message && message.length > MAX_MESSAGE_LENGTH)`
5. Downstream null-guards: `message || ''` for Gemini input, `detectRoutineTrigger`, `normalizedMsg`

**File**: `src/app/api/chat/route.ts`

---

## Priority #4a — Correlator Edit Mode

**Problem**: Correlator modal only supported create and delete — no way to edit an existing metric.

**Solution**:

### Server Action (`src/app/actions/correlations.ts`)
Added `updateCorrelationAction(id, input)`. The DAL `updateCorrelation` already existed. New action applies same validation as create before calling DB. Revalidates `/journal/correlations` and `/dashboard`.

### Modal UI (`src/components/journal/CorrelatorModal.tsx`)
- `view` extended to `'list' | 'new' | 'edit'`
- `editingId: string | null` tracks which correlation is being edited
- `formulaToRows(formula)`: recursive tree traversal to reconstruct `VariableRow[]` from a `FormulaNode` for the formula builder UI
- `handleEdit(correlation)`: populates form fields → `view = 'edit'`
- `handleSave` branches on `view === 'edit'` to call `updateCorrelationAction`
- List view: `Pencil` icon button beside each metric's delete button
- Header: `ChevronLeft` back button in edit view; title changes to "Edit Metric"
- Footer: button label "Update Metric" in edit mode

---

## Priority #4b — Tracker History Entry Edit Button

**Problem**: `LogEntryCard.tsx` (used in `TrackerHistoryView`) only had a delete button. No way to edit logged entries from the history page.

**Solution** (`src/components/trackers/LogEntryCard.tsx`):
- Added `isEditing`, `editValues`, `editError` state
- `startEdit()`: pre-populates `editValues` from `log.fields` for all schema fields
- `cancelEdit()` / `saveEdit()`: coerces values by field type, calls `updateLogAction`
- Header row: `Pencil` + `Trash2` (both `opacity-0`, shown on `group-hover`) when not editing; `Check` + `X` when editing
- Delete hidden during edit mode
- `EditFieldInput` sub-component: type-aware inputs (`number`, `text`, `rating`, `time`) with OLED focus styles (`focus:border-white/30 focus:ring-white/20`)

---

## Previous Sprint — Pro Max UI/UX Redesign

Full-app OLED glassmorphism pass across all pages and components:

| Area | Changes |
|------|---------|
| Navigation | Glass sidebar/mobile-nav, nutrition active glow, left accent bar |
| Dashboard | Glass widgets, per-tracker gradient glow dots, glass empty state |
| Chat | Nutrition gradient user bubbles, glass AI bubbles, bouncing dots loader |
| Journal | Glass pill nav, premium empty states |
| Trackers | Glass cards, tracker-color icon badges + glow, top accent lines |
| Analytics | Glass tracker rows, `font-black` headers |
| Routines/Settings | Glass inputs, nutrition save buttons |

---

## Previous Sprint — Bug Fixes (Session State, Routing, Formatting)

| Bug | Fix |
|-----|-----|
| Session State Blindness | `SESSION_COLUMNS` expanded to include all 7 fields so `active_routine_id` and `current_step_index` persist across turns |
| AI escaping JSON mandate | Unconditional `🔴 MANDATORY OUTPUT RULE` header added to routine prompt |
| Decimal time display | `formatFieldValue` called with `label` arg; time fields now show `6h 22m` not `6.37` |
| UUID placeholder crash | Migration `20260316000000_fix_sleep_tracker_placeholder.sql` fixes invalid UUIDs in `routines.steps` JSONB |
| Routine step leak | Removed `getFullSchema()` call that leaked unrelated tracker fields into routine context |
| `updateSession` TypeScript error | Extended `updates` type to include all session state fields |
| `card.trackerType` undefined | Changed to `card.trackerName`; `getTypeColors` lowercases for lookup |
| Empty chat session pollution | Migration `20260319000000_cleanup_empty_chat_sessions.sql` |
| Page transition skeletons | `loading.tsx` added for dashboard, journal, analytics, trackers, chat routes |
| Force Reset dev button | Flask icon button in `RoutineBanner.tsx` to bypass "already completed" check during testing |

---

## Summary — Files Changed This Sprint

```
src/lib/ai/prompt-builder.ts          — P1 auto-advance, JSON mandate, field leak fix
src/lib/utils/format.ts               — P2 units fix
src/app/api/chat/route.ts             — P3 vision-only, session state, routine advance
src/app/actions/correlations.ts       — P4a updateCorrelationAction
src/components/journal/CorrelatorModal.tsx — P4a edit mode
src/components/trackers/LogEntryCard.tsx   — P4b inline edit
src/lib/db/chat.ts                    — SESSION_COLUMNS fix, updateSession type
supabase/migrations/                  — 3 new migrations
src/components/** (all)               — Pro Max UI/UX redesign
src/app/(app)/** (all pages)          — Pro Max UI/UX redesign
```
