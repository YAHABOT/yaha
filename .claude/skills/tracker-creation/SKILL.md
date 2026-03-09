---
name: tracker-creation
description: Invoke when creating or modifying trackers — both manual UI creation and AI chat-driven creation where Claude detects unknown fields.
---

# Skill: Tracker Creation

## What This Skill Covers

Two creation paths exist. Both must result in the same Supabase row in `trackers` table.

**Path A: Manual UI** — User navigates to `/trackers/new`, fills in a form.
**Path B: Chat-driven** — User logs data for a field that doesn't exist yet. AI detects
this and asks: "This field doesn't exist yet. Would you like to add it to [existing tracker]
or create a new tracker?"

---

## Execution Checklist

### Path A: Manual Tracker Creation

1. **Form fields required**:
   - `name` (text, required, min 1 char, max 50 chars)
   - `type` (select: nutrition | sleep | workout | mood | water | custom — default: custom)
   - `color` (color picker — defaults to tracker type color token)
   - `schema` (dynamic field list — see Schema Builder below)

2. **Schema Builder UI**:
   Each field row has: label (text input), type (number | text | rating | time), unit (text, optional).
   Add field button appends a new row. Drag to reorder. Click X to remove.
   Each field gets a stable `fieldId`: `fld_` + `Date.now()` on creation.

3. **Server Action**:
   ```typescript
   // src/app/actions/trackers.ts
   export async function createTrackerAction(formData: FormData) {
     const name = formData.get('name') as string
     const type = formData.get('type') as string
     const color = formData.get('color') as string
     const schema = JSON.parse(formData.get('schema') as string) as SchemaField[]
     // validate → createTracker(userId, {name, type, color, schema}) → revalidatePath
   }
   ```

4. **After creation**: Navigate to `/trackers/[id]/log` so user can start logging immediately.

### Path B: Chat-Driven Tracker Creation

1. **Detection**: Gemini AI parses user input and finds a field reference that doesn't
   match any existing tracker schema. Example: "Just finished a 45-min yoga session" but
   no workout tracker exists.

2. **AI prompt injection**: When unknown field detected, inject into Gemini system prompt:
   ```
   The user mentioned data that doesn't match any existing tracker.
   Ask them: "I don't have a tracker for [type] yet. Should I:
   a) Add this to your [closest existing tracker] as a new field, or
   b) Create a new [type] tracker?"
   Do not log anything yet. Wait for their choice.
   ```

3. **User choice A — Add to existing**:
   - Present list of existing trackers as inline buttons
   - On selection: add new SchemaField to that tracker's `schema` JSONB array
   - `fieldId`: `fld_` + `Date.now()`
   - Then proceed with logging the original data

4. **User choice B — Create new tracker**:
   - AI suggests a name and type based on context
   - User confirms or edits
   - Tracker created with AI-inferred schema fields
   - Then proceed with logging the original data

5. **No double-ask**: Once user answers, do not ask again. Store the decision and proceed.

---

## Tracker Type → Default Color Mapping

```typescript
const TYPE_COLORS: Record<string, string> = {
  nutrition: '#10b981',  // nutrition green
  sleep:     '#3b82f6',  // sleep blue
  workout:   '#f97316',  // workout orange
  mood:      '#a855f7',  // mood purple
  water:     '#06b6d4',  // water cyan
  custom:    '#6b7280',  // neutral gray
}
```

## Tracker Type → Synonym Detection (for chat-driven path)

```typescript
const TYPE_SYNONYMS: Record<string, string[]> = {
  nutrition: ['food', 'meal', 'diet', 'eating', 'calories', 'macros'],
  sleep:     ['sleep', 'rest', 'nap', 'bedtime', 'wake'],
  workout:   ['workout', 'exercise', 'training', 'gym', 'run', 'yoga', 'swim'],
  mood:      ['mood', 'feeling', 'emotion', 'stress', 'anxiety', 'energy'],
  water:     ['water', 'hydration', 'drink', 'fluid'],
}
```

---

## Validation Rules

- Tracker name: 1–50 characters, trimmed, unique per user (case-insensitive check)
- Schema: maximum 20 fields per tracker
- FieldId: must start with `fld_`, must be unique within the tracker
- Color: must be valid hex string (`#RRGGBB`)
- Type: must be one of the 6 allowed values

---

## Error States

| Error | User-facing message |
|-------|---------------------|
| Duplicate name | "You already have a tracker called [name]. Choose a different name." |
| Empty name | "Tracker name is required." |
| Too many fields | "Maximum 20 fields per tracker." |
| Auth failure | "Please sign in to create a tracker." |
