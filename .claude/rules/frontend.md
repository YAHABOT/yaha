# Frontend Rules — YAHA (Next.js 15 App Router + Tailwind OLED)

## Next.js App Router Structure

```
src/
├── app/
│   ├── (auth)/           # Auth routes — no layout wrapper
│   │   └── login/
│   │       └── page.tsx
│   ├── (app)/            # Authenticated routes — shared layout
│   │   ├── layout.tsx    # Sidebar + main content shell
│   │   ├── dashboard/
│   │   ├── chat/
│   │   ├── trackers/
│   │   ├── journal/
│   │   ├── routines/
│   │   └── settings/
│   └── api/              # Route Handlers (webhooks, public API)
│       └── telegram/
├── components/           # Shared UI components
│   ├── ui/               # Primitive components (Button, Input, Card)
│   └── [feature]/        # Feature-specific components
├── lib/
│   ├── supabase/         # Supabase clients (server.ts, client.ts)
│   ├── db/               # Data Access Layer (one file per domain)
│   ├── ai/               # Gemini client
│   └── telegram/         # Telegram helpers
├── app/actions/          # Server Actions (one file per domain)
└── types/                # Shared TypeScript types
```

## Server vs Client Components

```typescript
// SERVER COMPONENT — default, no directive (fetches data, no interactivity)
export default async function JournalPage() {
  const logs = await getLogsForDay(today)  // Direct DB call, no API round-trip
  return <DayView logs={logs} />
}

// CLIENT COMPONENT — only when required (interactivity, browser APIs, state)
'use client'  // Needed: manages chart zoom state + window resize listener
import { useState, useEffect } from 'react'
export function AnalyticsChart({ data }: { data: ChartData[] }) {
  const [zoom, setZoom] = useState<ZoomRange>(DEFAULT_ZOOM)
  ...
}
```

**Rules:**
- Pages (`page.tsx`) are Server Components — they fetch data and pass it as props.
- Leaf components that need `onClick`, `useState`, `useEffect` are Client Components.
- Never put async/await in Client Components — pass pre-fetched data as props.

## Server Actions (all mutations)

```typescript
// src/app/actions/trackers.ts
'use server'
import { revalidatePath } from 'next/cache'
import { createTracker } from '@/lib/db/trackers'

export async function createTrackerAction(formData: FormData) {
  const name = formData.get('name') as string
  if (!name?.trim()) return { error: 'Name is required' }

  try {
    await createTracker({ name, type: 'custom', color: '#10b981', schema: [] })
    revalidatePath('/trackers')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
```

- **`'use server'`** at top of file — NOT inline in components.
- **Return `{ error }` or `{ success, data }`** — never throw from Server Actions.
- **Call `revalidatePath()`** after mutations that affect page data.

## OLED Theme — Tailwind Config

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        background: '#050505',
        surface: '#0A0A0A',
        surfaceHighlight: '#121212',
        border: '#1E1E1E',
        textPrimary: '#F5F5F5',
        textMuted: '#6B7280',
        nutrition: '#10b981',
        sleep: '#3b82f6',
        workout: '#f97316',
        mood: '#a855f7',
        water: '#06b6d4',
      }
    }
  }
}
```

**Usage rules:**
- Background: always `bg-background` (`#050505`).
- Cards/panels: `bg-surface` (`#0A0A0A`) or `bg-surfaceHighlight` (`#121212`).
- Borders: `border-border` (`#1E1E1E`) or `border-white/5`.
- Text: `text-textPrimary` for body, `text-textMuted` for labels.
- Tracker type colors: use the named tokens (`text-nutrition`, `bg-sleep/10`, etc.).
- **Never**: `bg-white`, `bg-gray-*`, `text-black`. OLED only.

## Recharts Usage

```typescript
// Standard chart wrapper pattern
'use client'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

export function SparkLine({ data, color }: { data: DataPoint[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        <XAxis hide />
        <YAxis hide />
        <Tooltip contentStyle={{ background: '#0A0A0A', border: '1px solid #1E1E1E' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

## Component Patterns

```typescript
// Card primitive (reuse everywhere)
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-4 ${className ?? ''}`}>
      {children}
    </div>
  )
}
```

- **Shared primitives in `components/ui/`**: Button, Card, Input, Modal, Badge.
- **Feature components in `components/[feature]/`**: TrackerCard, ChatBubble, LogEntry.
- **Props interface always named**: `type Props = { ... }` not anonymous inline.
- **Lucide React for icons**: `import { Plus, Trash2, ChevronRight } from 'lucide-react'`.
