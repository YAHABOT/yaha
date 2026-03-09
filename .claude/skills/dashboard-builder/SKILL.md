---
name: dashboard-builder
description: Invoke when implementing the customizable dashboard — widget creation, data fetching, layout management, and widget type calculations.
---

# Skill: Dashboard Builder

## What This Skill Covers

The Dashboard is fully customizable. Users choose what data widgets to display.
Widgets are persistent per user (saved to Supabase). The dashboard is the first screen
after login.

---

## Widget Types

```typescript
type WidgetType =
  | 'field_latest'    // Latest value of a specific field in a tracker
  | 'field_average'   // Average of a field over N days
  | 'field_total'     // Sum of a field over a date range
  | 'correlator'      // Result of a correlation formula over a date range

type Widget = {
  id: string
  user_id: string
  type: WidgetType
  label: string                // User-defined display name
  trackerId?: string           // For field_* types
  fieldId?: string             // For field_* types
  correlationId?: string       // For correlator type
  days?: number                // N-day window (default: 7)
  position: number             // Display order (0-indexed)
  color?: string               // Override color (defaults to tracker type color)
}
```

---

## Execution Checklist

### Step 1: Widget Data Layer

```typescript
// src/lib/db/dashboard.ts
export async function getWidgets(userId: string): Promise<Widget[]>
export async function createWidget(userId: string, data: Omit<Widget, 'id' | 'user_id'>): Promise<Widget>
export async function updateWidget(id: string, userId: string, data: Partial<Widget>): Promise<Widget>
export async function deleteWidget(id: string, userId: string): Promise<void>
export async function reorderWidgets(userId: string, orderedIds: string[]): Promise<void>
```

### Step 2: Widget Value Computation

```typescript
// src/lib/db/dashboard-data.ts
type WidgetValue = {
  value: number | string | null
  unit?: string
  trend?: number[]  // last N values for sparkline
  label: string
}

export async function computeWidgetValue(
  widget: Widget,
  userId: string
): Promise<WidgetValue> {
  const supabase = await createServerClient()
  const now = new Date()
  const daysAgo = new Date(now)
  daysAgo.setDate(now.getDate() - (widget.days ?? 7))

  switch (widget.type) {
    case 'field_latest': {
      const { data } = await supabase
        .from('tracker_logs')
        .select('fields, logged_at')
        .eq('user_id', userId)
        .eq('tracker_id', widget.trackerId!)
        .order('logged_at', { ascending: false })
        .limit(1)
        .single()
      return {
        value: data?.fields?.[widget.fieldId!] ?? null,
        label: widget.label,
        trend: await getSparklineData(widget, userId, 7)
      }
    }

    case 'field_average': {
      const { data } = await supabase
        .from('tracker_logs')
        .select('fields')
        .eq('user_id', userId)
        .eq('tracker_id', widget.trackerId!)
        .gte('logged_at', daysAgo.toISOString())
      const values = data?.map(r => r.fields?.[widget.fieldId!]).filter(Number.isFinite) ?? []
      return {
        value: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null,
        label: widget.label
      }
    }

    case 'field_total': {
      const { data } = await supabase
        .from('tracker_logs')
        .select('fields')
        .eq('user_id', userId)
        .eq('tracker_id', widget.trackerId!)
        .gte('logged_at', daysAgo.toISOString())
      const values = data?.map(r => r.fields?.[widget.fieldId!]).filter(Number.isFinite) ?? []
      return {
        value: values.reduce((a, b) => a + b, 0),
        label: widget.label
      }
    }

    case 'correlator': {
      // Fetch the correlation formula, evaluate over date range
      const correlation = await getCorrelation(widget.correlationId!, userId)
      if (!correlation) return { value: null, label: widget.label }
      const result = await evaluateCorrelation(correlation, userId, daysAgo, now)
      return { value: result, unit: correlation.unit, label: widget.label }
    }
  }
}
```

### Step 3: Dashboard UI

```typescript
// src/app/(app)/dashboard/page.tsx
export default async function DashboardPage() {
  const [widgets, trackers, routines] = await Promise.all([
    getWidgets(userId),
    getTrackers(userId),
    getDayRoutines(userId),   // day_start + day_end routines for buttons
  ])

  // Fetch all widget values in parallel
  const widgetValues = await Promise.all(
    widgets.map(w => computeWidgetValue(w, userId))
  )

  return <DashboardClient widgets={widgets} values={widgetValues} routines={routines} />
}
```

### Step 4: Widget Card Component

```
┌─────────────────────────────┐
│ 🟢 Avg Sleep Score          │  ← label (user-defined)
│                             │
│         7.4                 │  ← computed value
│         / 10                │  ← unit from schema field
│                             │
│ ▁▂▄▆▅▇▄▅  last 7 days      │  ← sparkline (if trend data exists)
└─────────────────────────────┘
```

Visual rules:
- Card border color: tracker type color at 30% opacity
- Value font: large, `text-textPrimary`
- Unit: small, `text-textMuted`
- Null value: show `—` centered, `text-textMuted`

### Step 5: "Add Widget" Flow

When user clicks "+ Add Widget":
1. Modal opens: "What type of widget?"
   - Latest value, N-day average, Total, Correlation
2. Based on type:
   - **field types**: select tracker → select field → set N days → set label
   - **correlator**: select correlation formula → set N days → set label
3. Preview shows a mock card with placeholder value
4. "Add" → `createWidget` Server Action → `revalidatePath('/dashboard')`

### Step 6: Edit Mode

Toggle edit mode on dashboard:
- Drag handles appear on each widget card
- Delete (×) button appears
- "Add Widget" button always visible
- Drag to reorder → calls `reorderWidgets` Server Action on drop

---

## Day Start / Day End Buttons

These appear at the top of the dashboard when the user has routines of those types.

```typescript
// Shown when: has day_start routine AND isDayStartComplete() === false
<RoutineButton
  routine={dayStartRoutine}
  href={`/chat?routine=${dayStartRoutine.id}`}
  label="Start Day"
  color="#3b82f6"
/>
```

Button disappears once the day start routine has been completed (detected by checking
`isDayStartComplete()` in the page Server Component).

---

## Caching Strategy

Widget values are computed on every page load (fresh data). For expensive correlations:
- Results auto-saved to `daily_stats` table by the journal correlator
- Dashboard reads from `daily_stats` first, falls back to live computation
- Stale if `daily_stats` entry is >1 hour old → recompute + update

---

## Edge Cases

| Situation | Behavior |
|-----------|----------|
| No widgets added yet | Empty state: "Add your first widget →" button centered |
| Widget tracker deleted | Show widget as "Tracker removed" with delete button |
| No data in date range | Show `—` (not 0, which implies logged zero) |
| Correlator missing data | Show `—` same as journal (not partial result) |
| All widgets loading | Skeleton cards (OLED-themed: `bg-surfaceHighlight` pulse) |
