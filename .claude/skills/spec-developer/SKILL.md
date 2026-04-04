---
name: spec-developer
description: Discovery phase gatekeeper. Run before any code is written.
model: claude-3-5-haiku-20241022
disable model invocation: true
---

# Spec Developer Skill — YAHA

**Purpose:** Explore the codebase and identify edge cases before any implementation begins.

**When to use:** Invoked at the START of a feature task, BEFORE coding-agent writes any code.

**Output:** Detailed implementation plan in markdown format.

## Workflow

### Step 1: Ask Clarifying Questions

Use the `AskUserQuestion` tool to ask up to 20 clarifying questions about the feature. Focus on:

- **Data mapping**: How does input data flow? What transformations occur?
- **UI states**: What are all the UI states (loading, success, error, empty)?
- **Edge cases**: What happens with invalid input? Network failures? Missing data?
- **User flows**: What are the exact steps a user takes?
- **Boundary conditions**: Min/max values? Empty arrays? Null fields?
- **Integration points**: What systems does this touch (Supabase, Gemini, Telegram)?

Example questions:
- "When a user logs health data with missing fields, should the action card show placeholders or skip those fields?"
- "If the AI response is malformed, do we retry or fail gracefully?"
- "Should the routine step UI show a loading indicator during API calls?"

### Step 2: Analyze Codebase

Read relevant files to understand:
- Existing patterns in similar features
- Database schema for affected tables
- Related components and their structure
- Error handling patterns used elsewhere
- API integration patterns (especially Gemini, Telegram, Supabase)

Search for:
- Similar feature implementations
- Test examples in `src/__tests__/`
- Pattern references in `.claude/rules/` → `src/*/claude.md`

### Step 3: Generate Implementation Plan

Create a detailed markdown plan with:

**📋 Feature Specification**
- Feature name and purpose
- User-facing behavior
- Success criteria

**🏗️ Architecture**
- Data flow diagram (in prose, not code)
- Components to create/modify
- Database changes needed
- API integrations required

**⚠️ Edge Cases & Validation**
- Input validation rules
- Error scenarios and recovery
- Boundary conditions
- Security considerations

**📝 Implementation Steps** (in order)
1. [Step title] — [why this step]
2. [Step title] — [why this step]
...

**🧪 Test Strategy**
- Happy path test scenario
- At least 3 edge case tests
- Error recovery scenarios

**🔗 Pattern References**
- Link to existing patterns in codebase
- Link to relevant rules (now in folder-level `claude.md`)

**⏱️ Estimated Complexity**
- "Low: 1-2 files, <100 lines net code"
- "Medium: 3-4 files, 100-300 lines net code"
- "High: 5+ files, 300+ lines or complex logic"

### Step 4: Return Plan

Output the plan in markdown format. Do NOT write application code.

---

## Example Output Format

```markdown
# Implementation Plan: Daily Routine Step Progress Persistence

## Feature Specification
- Feature: Save and resume routine step progress across page reloads
- User behavior: User starts routine → completes some steps → navigates away → returns → resumes from same step
- Success criteria: currentRoutineStep persists to DB; page load resumes from DB state

## Architecture

**Data Flow:**
1. User clicks "Start Routine" in chat
2. `activateDailyRoutine` action triggered
3. DB stores: user_id, routine_id, current_step, triggered_at
4. On page load: fetch active routine state from DB
5. Resume UI from persisted step

**Components to Create/Modify:**
- `src/components/chat/RoutineStep.tsx` (new) — step display + navigation
- `src/lib/db/routines.ts` (modify) — add getActiveRoutine(), updateRoutineProgress()
- `src/app/actions/routines.ts` (modify) — add saveRoutineProgress()
- `src/__tests__/routines/routine-actions.test.ts` (create)

**Database Changes:**
- Add column `current_step` to `routines` table (type: integer, nullable)
- Add column `routine_active_at` to track session start time

## Edge Cases & Validation
- Routine completes all steps → clear active state
- User starts two routines → only latest is active (overwrite)
- Stale routine (started >24h ago) → clear and treat as new
- Invalid step index → reset to step 0

## Implementation Steps
1. **Create DB functions** — Add getActiveRoutine, updateRoutineProgress, clearActiveRoutine
2. **Modify routine actions** — Hook saveRoutineProgress into step navigation
3. **Create RoutineStep component** — UI to display current step with progress indicator
4. **Add page load hook** — Fetch active routine on component mount
5. **Write tests** — Happy path + edge cases
6. **Verify persistence** — Manual test reload during routine

## Test Strategy
- Happy path: Start routine → complete step 1 → reload → verify on step 1
- Edge case: Complete all steps → verify active state cleared
- Edge case: Stale routine (>24h) → verify reset
- Error: DB error during save → verify graceful fallback

## Pattern References
- DAL pattern: `src/lib/db/logs.ts` (auth + single operation)
- Action pattern: `src/app/actions/chat.ts` (error handling, revalidatePath)
- Test pattern: `src/__tests__/routines/routine-actions.test.ts` (existing tests)

## Estimated Complexity
Medium: 3-4 files, ~180 lines net code (DAL functions, action, component, tests)
```

---

## Key Rules for Spec Developer

- **Do not write code** — this skill only produces a plan
- **Ask clarifying questions first** — questions inform the architecture
- **Be thorough** — edge cases discovered now prevent rework later
- **Reference existing patterns** — copy from the codebase, don't invent new patterns
- **Output only markdown** — return to orchestrator with a plan, nothing else
