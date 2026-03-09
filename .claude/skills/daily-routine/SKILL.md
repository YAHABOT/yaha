---
name: daily-routine
description: Invoke when implementing daily routine creation, management, and conversational execution via chat.
---

# Skill: Daily Routines

## What This Skill Covers

Routines are named multi-step protocols (e.g., "Morning Check-In", "Evening Log").
Each step targets specific fields in a specific tracker. Routines execute conversationally
via chat — the AI walks the user through each step, collecting field values.

---

## Data Model

```typescript
type Routine = {
  id: string
  user_id: string
  name: string               // "Morning Check-In"
  trigger_phrase: string     // "start day", "morning" — detected in chat input
  type: 'standard' | 'day_start' | 'day_end'
  steps: RoutineStep[]
}

type RoutineStep = {
  trackerId: string
  trackerName: string
  trackerColor: string       // hex — used to style the step UI
  targetFields: string[]     // fieldIds to ask about in this step
}
```

---

## Execution Checklist

### Routine CRUD (Management UI)

1. **List view** (`/routines`): Cards showing routine name, type badge, trigger phrase,
   step count. Edit and delete buttons per card.

2. **Create/Edit form**:
   - Name input (required)
   - Trigger phrase input (e.g. "start day", "morning check-in")
   - Type selector (Standard / Day Start / Day End)
   - Step builder:
     - Select tracker from dropdown
     - Checkboxes for which fields to include (shows schema field labels)
     - Drag to reorder steps

3. **Server Actions**: `createRoutineAction`, `updateRoutineAction`, `deleteRoutineAction`
   in `src/app/actions/routines.ts`. All call `revalidatePath('/routines')`.

### Trigger Detection in Chat

```typescript
// src/lib/routines/detector.ts
export async function detectRoutineTrigger(
  message: string,
  userId: string
): Promise<Routine | null> {
  const routines = await getRoutines(userId)
  const normalized = message.toLowerCase().trim()

  return routines.find(r =>
    normalized.includes(r.trigger_phrase.toLowerCase())
  ) ?? null
}
```

Called in the chat API route BEFORE sending to Gemini. If a routine is detected, inject
it into the Gemini system prompt.

### Routine Execution via Chat

When a routine is detected, inject this into the system prompt:

```typescript
const routineContext = `
## Active Routine: ${routine.name}

You are now guiding the user through their "${routine.name}" routine.
Walk them through each step in order. For each step:
1. Ask for the specific fields listed (by their label names, not fieldIds)
2. When the user responds, create an ActionCard for that step's tracker
3. Move to the next step once confirmed

Steps to complete:
${routine.steps.map((step, i) => `
Step ${i + 1}: ${step.trackerName}
Fields to collect: ${step.targetFields.map(fid => {
  const tracker = trackers.find(t => t.id === step.trackerId)
  return tracker?.schema.find(f => f.fieldId === fid)?.label ?? fid
}).join(', ')}
`).join('\n')}

Complete all ${routine.steps.length} steps before ending the routine.
After all steps: summarize what was logged and say "Routine complete ✓"
`
```

### Day Start Detection

For `type: 'day_start'` routines — check if the morning log already exists:

```typescript
// src/lib/routines/day-check.ts
export async function isDayStartComplete(userId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]
  const logicalDayStart = new Date()
  logicalDayStart.setHours(4, 0, 0, 0)  // 4am cutoff

  // Find the sleep tracker (or first day_start routine's first step tracker)
  const { count } = await supabase
    .from('tracker_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('logged_at', logicalDayStart.toISOString())

  return (count ?? 0) > 0
}
```

If day already started: tell user "You've already completed your morning check-in today."

### Dashboard Routine Buttons

The Dashboard shows "Start Day" and "End Day" buttons when routines of those types exist.
Clicking navigates to `/chat` with a URL param: `/chat?routine=[routineId]`. The chat
page reads this param, looks up the routine, and starts execution immediately.

```typescript
// src/app/(app)/chat/page.tsx
const routineId = searchParams.routine
if (routineId) {
  // Auto-send trigger message to start routine
  const routine = await getRoutine(routineId, userId)
  if (routine) initialMessage = routine.trigger_phrase
}
```

---

## Step Execution States

Track progress in React state (not persisted — session only):

```typescript
type RoutineState = {
  routine: Routine
  currentStep: number           // 0-indexed
  completedSteps: number[]      // step indices that have been logged
  status: 'in_progress' | 'complete' | 'abandoned'
}
```

---

## Edge Cases

| Situation | Behavior |
|-----------|----------|
| User says "skip" | Move to next step, mark current as skipped (no log) |
| User says "stop" | End routine, log what was collected so far |
| Day Start already done | Show "Already logged today" — offer to view journal |
| Routine has no steps | Show error: "This routine has no steps. Edit it to add steps." |
| Tracker deleted (step orphaned) | Skip that step, notify user the tracker was removed |
