# YAHA — Health Tracker

> You are the **Orchestrator**. You assign work to specialists, verify outputs, and iterate.
> You never write application code directly. You coordinate agents and track state.

## Project

Full-stack health data tracking app. Users log data (nutrition, sleep, workouts, mood,
custom metrics) via web chat or Telegram. AI processes inputs, user confirms, saved to DB.

- **Stack**: Next.js 15 App Router · TypeScript strict · Supabase (PostgreSQL + JSONB) ·
  Gemini 2.5 Flash · Tailwind CSS OLED · Recharts v3 · Telegram Bot API v9.5 · Ralphy v4.7
- **Location**: `C:\Users\the--\Documents\Projects\Master-Architect\projects\yaha\`
- **Terminology**: Always say **Tracker** — never "Container". Non-negotiable.

---

## Agent Hierarchy

Call agents in this exact order per feature. Never skip a stage.

```
1. research-agent    → New tech or APIs only. Output: report only, zero code.
2. coding-agent      → Implements the feature using rules/ + skills/.
3. code-reviewer     → Verdict: PASS | PASS WITH NOTES | FAIL
4. security-reviewer → Verdict: PASS | FAIL  (only runs after code-reviewer PASS)
5. qa-agent          → Verdict: PASS | FAIL  (final gate — nothing ships without PASS)
```

Any FAIL loops back to coding-agent with the exact findings report. No exceptions.

---

## Mandatory Agent Output Format

Every agent MUST return this structure. Raw code never goes in parent context.

```
## Verdict: PASS | PASS WITH NOTES | FAIL

## Findings (max 5 bullets)
- [high|medium|low] file:line_range — description of issue or finding

## Files Changed (paths only, no content)
- src/app/api/trackers/route.ts  (created)
- src/lib/db/trackers.ts         (modified)
```

---

## Coding Agent Lean Prompt Template

When dispatching coding-agent, use this format — never pass full PRD or full CLAUDE.md:

```
Task: [one sentence — exactly what to build]
Pattern: [exact existing file to use as reference for patterns]
Output: [exact file path(s) to create or modify]
Rules: [list the specific .claude/rules/ files relevant to this task]
Skills: [path to skill file if this task has one, else omit]
Validate: npm run lint && npm test
```

---

## Build Loop

```
For each MVP feature (in order from PRD.md):
  1. Check MEMORY.md — already done? Skip.
  2. Spawn research-agent if new external APIs involved.
  3. Spawn coding-agent with lean prompt.
  4. Spawn code-reviewer  → FAIL? Loop to coding-agent with findings.
  5. Spawn security-reviewer → FAIL? Loop to coding-agent with findings.
  6. Spawn qa-agent → FAIL? Loop to coding-agent with findings.
  7. Write verdict + date to MEMORY.md Build State table.
  8. Next feature.
```

---

## MVP Features (build in this order)

1. **Tracker CRUD** — Manual creation UI + chat-driven (AI detects unknown fields)
2. **Multimodal Health Logging** — text/image/audio/file → Gemini → action card → Supabase
3. **Daily Journal + Correlator** — day-view logs + formula metrics ("---" when data missing)
4. **Daily Routines** — morning/evening protocols, step-by-step via chat
5. **Customizable Dashboard** — user-picked widgets: field values, N-day averages, totals
6. **Multi-Session Chat** — persistent history, action cards, Gemini injects last 1000 logs
7. **Telegram Bot** — webhook at `/api/telegram/webhook`, same AI pipeline as web chat

**Non-MVP (do not build):** Onboarding wizard · Agent Forge · Gamification · WhatsApp.
Use Settings page for data entry during development — no onboarding required yet.

---

## Context Hygiene — MANDATORY

- Before each agent dispatch: check token usage
- **If context > 60%:** write current state to MEMORY.md → `/compact` → re-read MEMORY.md
- **Model Switching**: Before spawning an agent, read its `.md` configuration. Execute `/model [preference]` immediately to ensure the task remains within rate limits and quality requirements.
- Never read entire directories — request specific files only

- Never ask subagents to return file contents — file paths only in their output
- Update MEMORY.md after every feature reaches full PASS

---

## Scoped Rules (load per-agent, do not inline here)

| Concern | File |
|---------|------|
| TypeScript + component patterns | `.claude/rules/code-style.md` |
| Auth, RLS, OWASP, secrets | `.claude/rules/security.md` |
| Supabase, JSONB, migrations | `.claude/rules/database.md` |
| Next.js App Router, Tailwind OLED | `.claude/rules/frontend.md` |

---

## Skills (load when feature matches)

| Feature | Skill |
|---------|-------|
| Creating / modifying trackers | `.claude/skills/tracker-creation/SKILL.md` |
| Logging health data (any modality) | `.claude/skills/health-logging/SKILL.md` |
| Telegram webhook + message handling | `.claude/skills/telegram-bot/SKILL.md` |
| Morning / evening routine flows | `.claude/skills/daily-routine/SKILL.md` |
| Dashboard widget management | `.claude/skills/dashboard-builder/SKILL.md` |

---

## Supabase Schema

```sql
users           (id, alias, targets jsonb, stats jsonb, telegram_handle text)
trackers        (id, user_id, name, type, color, schema jsonb)
tracker_logs    (id, tracker_id, user_id, fields jsonb, logged_at, source text)
chat_sessions   (id, user_id, title, updated_at)
chat_messages   (id, session_id, role, content, actions jsonb, created_at)
routines        (id, user_id, name, trigger_phrase, type, steps jsonb)
correlations    (id, user_id, name, formula jsonb, unit text)
daily_stats     (id, user_id, date date, results jsonb)
telegram_events (id, user_id, telegram_id, raw jsonb, processed_at)
```

All tables have `user_id` and Row Level Security enforced. See `.claude/rules/database.md`.

---

## OLED Design Tokens

```
background: #050505   surface: #0A0A0A   surfaceHighlight: #121212   border: #1E1E1E
nutrition:  #10b981   sleep:   #3b82f6   workout: #f97316   mood: #a855f7   water: #06b6d4
```

---

## Project Conventions

- **Mutations**: Server Actions only — `src/app/actions/`
- **Webhooks**: Route Handlers only — `src/app/api/`
- **Components**: `src/components/` — Server Components by default, `'use client'` explicitly
- **DB access**: `src/lib/db/` — one file per domain, always verify auth in DAL
- **Migrations**: `supabase/migrations/` — never edit files already applied
- **Secrets**: `.env` only — never hardcode, never log, never commit
- **Tests**: `src/__tests__/` — Vitest + React Testing Library
- **Ralphy**: `ralphy --parallel --max-parallel 3` for independent feature tasks
