# Code Style Rules — YAHA

## TypeScript

- **Strict mode always**: `strict: true` in tsconfig. No exceptions.
- **No `any`**: Use `unknown` + type narrowing, or define proper types.
- **No implicit returns**: All functions must have explicit return types.
- **Named constants**: No magic strings or magic numbers — use `const NAME = value`.
- **Functions under 40 lines**: If longer, extract to named helpers.
- **Pure functions preferred**: Isolate side effects to the edges (API routes, Server Actions).

```typescript
// BAD
const process = (data: any) => { ... }

// GOOD
type HealthLog = { fields: Record<string, unknown>; loggedAt: Date }
const processHealthLog = (log: HealthLog): ProcessedLog => { ... }
```

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `TrackerCard.tsx` |
| Functions | camelCase | `getTrackerLogs()` |
| Constants | SCREAMING_SNAKE | `MAX_LOG_ENTRIES` |
| Types/Interfaces | PascalCase | `TrackerSchema` |
| Database tables | snake_case | `tracker_logs` |
| Files (non-component) | kebab-case | `health-logging.ts` |
| CSS classes | Tailwind only | `bg-[#0A0A0A]` |

## React + Next.js

- **Server Components by default**: Every page and component is a Server Component unless
  it needs browser APIs or event handlers.
- **`'use client'` must be justified**: Add a comment explaining why client-side is needed.
- **No prop drilling more than 2 levels**: Use context or pass data at route level.
- **Component file limit**: One component per file. Co-locate types in the same file.
- **No inline styles**: Tailwind utility classes only. Custom values via `bg-[#value]` syntax.

```typescript
// Server Component (default, no directive needed)
export default async function TrackerPage({ params }: { params: { id: string } }) {
  const logs = await getLogs(params.id)
  return <TrackerCard logs={logs} />
}

// Client Component (justified: needs onClick + state)
'use client' // needed for interactive chart controls
import { useState } from 'react'
export function ChartControls({ onRangeChange }: Props) { ... }
```

## Error Handling

- **Always handle errors at boundaries**: API routes and Server Actions catch + return
  structured errors. Never let errors bubble to the user as raw exceptions.
- **Meaningful messages**: Error messages describe what failed and what to do next.
- **No silent failures**: Never swallow errors with empty catch blocks.
- **External calls always wrapped**: Gemini, Telegram, Supabase calls all have try/catch.

```typescript
// BAD
const data = await supabase.from('trackers').select()

// GOOD
const { data, error } = await supabase.from('trackers').select()
if (error) throw new Error(`Failed to fetch trackers: ${error.message}`)
```

## Imports

- **Path aliases**: Use `@/` for all internal imports (`@/lib/db/trackers`).
- **No relative imports beyond 1 level**: `../` is acceptable, `../../` is not.
- **Group imports**: External packages first, then `@/` internal, then relative.
- **No barrel files** (`index.ts` re-exports): Import directly from source files.
