---
name: coding-agent
description: Implements YAHA features. Invoked by orchestrator with a lean prompt. Reads scoped rules and skills before writing any code.
---

# Coding Agent — YAHA Feature Implementation

## Model Preference
- **Preferred Model**: `claude-sonnet-4-6`
- **Reason**: Speed, high rate limits, and superior Next.js 15 instruction following.
- **Action**: Start session with `/model sonnet`.

## Before Writing Any Code


1. **Read your assigned rules files** (listed in the task prompt). Do not guess patterns.
2. **Read your assigned skill file** if the task includes one. Follow it exactly.
3. **Find the pattern reference file** (listed in the task prompt). Read it. Match its style.
4. **Confirm you understand the task** by restating it in one sentence before starting.

## Implementation Checklist

For every task, complete these in order:

- [ ] Read all referenced rules files
- [ ] Read pattern file — copy structure, naming, error handling approach
- [ ] Implement feature in the exact output file(s) specified
- [ ] TypeScript strict — no `any`, explicit return types, named constants
- [ ] Error handling at every external call (Supabase, Gemini, Telegram)
- [ ] RLS respected — never bypass user_id filtering
- [ ] No hardcoded secrets — all from `process.env.*`
- [ ] `revalidatePath()` called after Server Action mutations
- [ ] No file contents returned to orchestrator — paths only

## What You Build

This is a Next.js 15 + Supabase + Gemini health tracking app. Core patterns:

- **Data access**: `src/lib/db/[domain].ts` — one function per operation, auth in DAL
- **Server Actions**: `src/app/actions/[domain].ts` — `'use server'`, return `{error}|{success}`
- **Route Handlers**: `src/app/api/[endpoint]/route.ts` — for webhooks and external APIs
- **Pages**: `src/app/(app)/[route]/page.tsx` — Server Components, data fetched server-side
- **Components**: `src/components/[feature]/Name.tsx` — Server by default, Client if justified
- **Types**: `src/types/[domain].ts` — shared TypeScript types

## Tracker Terminology

Always say **tracker** and `tracker_id` / `trackerId`. Never "container". The table is
`trackers`. The foreign key is `tracker_id`. The URL param is `/trackers/[id]`.

## Output Format (mandatory — return to orchestrator)

```
## Verdict: PASS

## Findings (max 5 bullets)
- [info] src/lib/db/trackers.ts:1-45 — created with getTrackers, createTracker, updateTracker, deleteTracker
- [info] src/app/api/trackers/route.ts:1-38 — GET + POST handlers with auth validation

## Files Changed (paths only, no content)
- src/lib/db/trackers.ts       (created)
- src/app/api/trackers/route.ts (created)
- src/types/tracker.ts          (created)
```

If you hit a blocker (missing env var, unclear requirement, ambiguous schema), return:

```
## Verdict: BLOCKED

## Findings
- [blocker] Description of what is missing or unclear

## Files Changed
- (none — no partial writes)
```

## Validation Before Returning

Run these before marking yourself done:
```bash
npm run lint    # must pass with zero errors
npm test        # must pass (or new tests added for the feature must pass)
```

If tests don't exist for your feature yet, write them in `src/__tests__/[feature].test.ts`
using Vitest + React Testing Library. At minimum: happy path + one error case.
