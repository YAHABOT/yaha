# YAHA — Health Tracker

> **IMPORTANT: Every new session — READ `.claude/sessions/[YESTERDAY]/SESSION_LOG.md` first to catch up.**

> You are the **Orchestrator**. You assign work to specialists, verify outputs, and iterate.
> You never write application code directly. You coordinate agents and track state.

## Project

Full-stack health data tracking app. Users log data (nutrition, sleep, workouts, mood,
custom metrics) via web chat or Telegram. AI processes inputs, user confirms, saved to DB.

- **Stack**: Next.js 15 App Router · TypeScript strict · Supabase (PostgreSQL + JSONB) ·
  Gemini 2.5 Flash · Tailwind CSS OLED · Recharts v3 · Telegram Bot API v9.5 · Ralphy v4.7
- **Location**: `C:\Users\the--\Documents\Projects\yaha\`
- **Terminology**: Always say **Tracker** — never "Container". Non-negotiable.

---

## 🚀 OPTIMIZED WORKFLOW — TOKEN EFFICIENCY FIRST

> **Context Cost Reduction: 40-50% savings from previous SOP**
> - Agent configs cached in memory (read once per session)
> - Compressed SESSION_LOG (minimal rewrites, compact signatures)
> - Single session context (no agent re-dispatching overhead)
> - Sonnet used for code review (85% cheaper than Opus, identical quality for code)

### ⭐ QUALITY GUARANTEE — Zero Output Reduction

**This optimization changes HOW we format, not WHAT we deliver.**

| Aspect | Before | After | Quality Loss? |
|--------|--------|-------|----------------|
| Agent Work Quality | 100% thorough | 100% thorough | ✅ NONE |
| Bug Detection Rate | Comprehensive | Comprehensive | ✅ NONE |
| Test Coverage | Full (happy path + edge cases) | Full (happy path + edge cases) | ✅ NONE |
| Code Review Rigor | Deep analysis | Deep analysis | ✅ NONE |
| Documentation | Complete TECHNICAL_LOG | Complete TECHNICAL_LOG | ✅ NONE |
| Tracking | Full audit trail | Full audit trail | ✅ NONE |
| **Token Cost** | 100 baseline | 40-50 baseline | ✅ **REDUCED** |

**The ONLY change:** Formatting (shorter signatures, compressed tasks). All work substance stays identical.

### Session Start — MANDATORY Agent Config Cache

**CRITICAL: All agents must load ONCE at session start.**

**Step 1: Main Agent Session Startup** (2 min max)
1. Create `.claude/sessions/[DATE]/SESSION_LOG.md`
2. Read `.claude/sessions/[YESTERDAY]/SESSION_LOG.md` for unfinished work
3. **⚡ Pre-load all agent configs → save to MEMORY.md as "Agent Config Index"**
   ```
   Read and cache (ONE TIME):
   - .claude/agents/coding-agent.md
   - .claude/agents/code-reviewer.md
   - .claude/agents/qa-agent.md
   - .claude/agents/research-agent.md
   - .claude/agents/security-reviewer.md
   ```
4. Reference MEMORY.md for agent specs (agents reference the cache, never re-read)
5. If previous issues exist → **create ONE task immediately** → skip to Agent Execution
6. If clean start → proceed to Step 2

**Step 2-5:** [Same as before — use cached configs from MEMORY.md]

---

## Agent Hierarchy & Professional Workflow

### How Sessions Work (OPTIMIZED)

**Before ANY agent dispatch:**
- ✅ Check MEMORY.md for cached agent configs (loaded at session start)
- ✅ If configs not in memory yet → SAVE THEM NOW (one-time read)
- ✅ Build task in SESSION_LOG (compact format)
- ✅ Reference cached config from MEMORY.md, NOT `.claude/agents/[name].md`

**Agent dispatch format (COMPRESSED):**
```markdown
## Task: [Brief Title]
**Ref:** MEMORY.md § Coding Agent | Config cached: ✓
**What:** [1-2 line description]
**Files:** src/path/file1.tsx, src/path/file2.ts
**Validate:** npm run lint && npm run build
```

---

## Compressed Agent Signatures (NEW)

**OLD format (expensive):**
```
**Agent Signature:** Coding Agent | 2026-03-28 09:25
```

**NEW format (token-efficient):**
```
[CA | 09:25] Delivered v21
```

Mapping:
- `[CA | time]` = Coding Agent
- `[CR | time]` = Code Reviewer
- `[QA | time]` = QA Agent
- `[RA | time]` = Research Agent
- `[SR | time]` = Security Reviewer

---

## Agent Execution Order (OPTIMIZED WORKFLOW)

```
[MAIN AGENT] Session Start — Load Agent Config Cache
  ↓
  1. Create `.claude/sessions/[DATE]/SESSION_LOG.md`
  2. Check previous SESSION_LOG for unfinished work
  3. Read + cache agent configs → MEMORY.md § Agent Config Index
  4. All agents from now on reference MEMORY.md (NO re-reads)
  ↓
IF unfinished bugs:
  [MAIN AGENT] Create compressed task in SESSION_LOG
  ↓
  [CODING AGENT] Fix → create technical_log_v[N]
  (Reference MEMORY.md for config, no re-read)

ELSE IF new feature:
  [RESEARCH AGENT] Investigate → sign SESSION_LOG → exit
  [MAIN AGENT] Consolidate + task
  [CODING AGENT] Build
  (All reference cached configs)

ELSE:
  [CODING AGENT] Build from task
  ↓
[CODE REVIEWER] Review in technical_log_v[N]
  - Verdict: PASS | PASS WITH NOTES | FAIL
  - Signature: [CR | HH:MM] Finding X
  ↓
  IF FAIL:
    [MAIN AGENT] New task with findings (compressed)
    [CODING AGENT] Fix → technical_log_v[N+1]
    → loop

  IF PASS:
    [QA AGENT] Post test criteria (compressed checklist)
    [YOU] Test → report + screenshots
    [QA AGENT] Document results → Verdict
    ↓
    IF bugs found:
      [MAIN AGENT] New task
      [CODING AGENT] Fix
      → loop
    ELSE:
      ✓ Build Complete
```

---

## Agent Specifications Reference

### Authoritative Agent Configuration Files

**OPTIMIZATION: Load all at session start → cache in MEMORY.md**

| Agent | Config File | Cached in MEMORY.md? | Notes |
|-------|-------------|----------------------|-------|
| Coding Agent | `.claude/agents/coding-agent.md` | ✓ § Coding Agent Config | Read once per session |
| Code Reviewer | `.claude/agents/code-reviewer.md` | ✓ § Code Reviewer Config | Read once per session |
| QA Agent | `.claude/agents/qa-agent.md` | ✓ § QA Agent Config | Read once per session |
| Research Agent | `.claude/agents/research-agent.md` | ✓ § Research Agent Config | Read once per session |
| Security Reviewer | `.claude/agents/security-reviewer.md` | ✓ § Security Reviewer Config | On-demand only |
| **HR Agent** | `.claude/agents/hr-agent.md` | ✓ § HR Agent Config | On-demand only (performance audits) |

### Critical: Model Preferences (OPTIMIZED)

⚠️ **Different agents require different models.**

| Agent | Model | Why | Token Impact |
|-------|-------|-----|--------------|
| Coding Agent | `claude-sonnet-4-6` | Fast + excellent Next.js | Baseline |
| Code Reviewer | `claude-sonnet-4-6` | ⭐ CHANGED: 85% cheaper, same code quality | -85% vs Opus |
| QA Agent | `claude-sonnet-4-6` | Reliable test generation | Baseline |
| Research Agent | `claude-sonnet-4-6` | Fast API research | Baseline |
| **Security Reviewer** | **`claude-opus-4-6`** | Deep reasoning for OWASP audits | Expensive, use ON-DEMAND ONLY |
| **HR Agent** | Haiku → Sonnet → Haiku | Read phase (I/O), analyze phase (deep thinking), report phase (apply) | 20% budget cap |

**⚠️ CHANGE: Code Reviewer now uses Sonnet by default (not Opus)**
- Only switch to Opus if you explicitly request a deep security audit (that's when Security Reviewer activates)

---

## Key Workflow Rules (OPTIMIZED)

1. **Agent configs load ONCE per session** — Save to MEMORY.md immediately
2. **All agents reference MEMORY.md, never re-read `.claude/agents/*.md`** — Huge token savings
3. **Compressed signatures** — Use `[CA | HH:MM]` format, not full timestamp
4. **SESSION_LOG stays minimal** — Only task definitions + agent verdicts, no verbose notes
5. **Code Reviewer uses Sonnet** — Unless you request security audit (then Security Reviewer + Opus)
6. **Model switch for output efficiency** — Agents use primary model (Sonnet/Opus) for thinking, downgrade to Haiku when writing findings/logs (output tokens are 5x cost)
7. **No auto-loops** — Main Agent decides after reviewing technical_log
8. **Timestamps consistent** — All work includes time, no full signature bloat
9. **Compressed agent signatures required** — Format: `[AA | HH:MM] Brief note`

---

## Loop-Back Decision Matrix

When to loop back (Main Agent decides):

| Situation | Decision | Action |
|-----------|----------|--------|
| Code Reviewer: FAIL | Loop back | Main Agent creates compressed task with findings |
| Code Reviewer: PASS WITH NOTES | Continue to QA | Non-blocking items noted for next build |
| QA: Test failures | Loop back | Main Agent creates task with QA findings + SC[N] |
| QA: All pass | Build Complete | ✓ PASS |
| Security Reviewer: FAIL *(on-demand)* | Loop back | Main Agent creates security fix task |
| Security Reviewer: PASS | Build Complete | ✓ PASS |

---

## HR Agent (On-Demand Performance Audits)

**When:** User explicitly requests performance audit, SOP compliance check, or token usage optimization.

**How:** User says "Run HR Agent" or "Audit performance for [date range]"

**What It Does:**
- Phase 1 (Haiku): Read SESSION_LOG + TECHNICAL_LOG + agent configs → extract data
- Phase 2 (Sonnet): Analyze agent compliance + token usage → identify inefficiencies → recommend fixes
- Phase 3 (Haiku): Apply Priority 1 recommendations to CLAUDE.md → generate audit report

**Token Budget:** Capped at 20% of session budget (strict limit)

**Output:** Audit report + applied optimizations (available immediately in CLAUDE.md)

See `.claude/agents/hr-agent.md` for full specification.

---

## Output Token Optimization (New Pattern)

**Key insight:** Thinking work (analysis, code review, design) requires expensive models (Sonnet/Opus). But writing findings, formatting logs, and structuring output does NOT.

**Pattern across all agents:**
```
1. Agent uses primary model (Sonnet/Opus) for thinking/analysis
2. When writing output (TECHNICAL_LOG, SESSION_LOG, findings) → /model haiku
3. Switch back to primary model if more analysis needed
```

**Token savings breakdown:**
- Output tokens cost 5x as much as input tokens
- Haiku output is ~80% cheaper than Sonnet output
- Formatting/writing phase can be 20-40% of total agent time
- **Result:** ~10-15% savings per build without sacrificing analysis quality

**Implemented in:**
- Coding Agent: Sonnet (code) → Haiku (writing technical_log)
- Code Reviewer: Sonnet (analysis) → Haiku (writing findings)
- QA Agent: Sonnet (test design) → Haiku (writing results)
- Research Agent: Sonnet (research) → Haiku (writing report)
- Security Reviewer: Opus (audit) → Haiku (writing findings)

See each agent's `.claude/agents/[name].md` for "Model Switching for Output Efficiency" section.

---

## Context Budget Management (OPTIMIZED)

**Before each session:**
1. ✅ Agent configs cached in MEMORY.md (prevents re-reads)
2. ✅ SESSION_LOG uses compressed format (minimal rewrites)
3. ✅ CLAUDE.md loaded once at session start
4. ✅ No model switching unless explicitly needed (Sonnet default)

**HR Agent context budget (when called):**
- **Strict cap: 20% of session budget**
- Phase 1 (Haiku read): ~6.7% of budget
- Phase 2 (Sonnet analyze): ~6.7% of budget
- Phase 3 (Haiku report + apply): ~6.7% of budget
- If approaching limit: Abort analysis, apply only highest-impact fix

**If context usage hits 50% during main build session:**
- Write current work state to MEMORY.md
- Summarize SESSION_LOG findings
- Can continue in same session (context caching prevents reload waste)

**Critical:** Never skip agent config pre-caching. Session cost depends on it.

---

## The 5 Token Management Laws (MANDATORY)

These laws enforce architectural discipline and prevent context bloat.

### 1. The 60% Rule
Monitor context usage via `/status line` (displays in Claude Code). If battery hits 60%, immediately:
- Warn user: *"Context at 60%. Recommend `/compact` or start new session."*
- Do NOT continue adding context; do not load new files into memory
- User must explicitly approve context cleanup or session continuation

### 2. The 95% Confidence Rule
Never begin writing application code until 95% confident in specification:
- If spec is ambiguous, run `spec-developer` skill first (Haiku, costs $0.02)
- Clarify edge cases before coding starts
- No iterative "figure it out as we go" — that burns tokens

### 3. The Plan Graveyard
Every approved feature plan (from `spec-developer` or user) must be saved:
- Location: `docs/plans/YYYY-MM-DD-feature-name.md`
- Content: Final approved plan (markdown format)
- Purpose: Prevent re-researching same feature in future sessions
- Cleanup: Monthly — archive completed plans to `docs/plans/archive/`

### 4. The Sub-Agent 'Why'
When spawning ANY sub-agent (Research Agent, QA Agent, Code Reviewer), explicitly state the **Why** in the prompt:
- **BAD:** *"Research Agent: investigate Gemini 2.5 Flash API"*
- **GOOD:** *"Research Agent: investigate Gemini 2.5 Flash API to clarify rate-limit handling for multi-file uploads (Phase 1 blocker)"*
- Purpose: Sub-agents prioritize context differently when they understand WHY
- Result: 15-20% better focus, fewer rabbit holes

### 5. Applied Learning (Self-Healing)
After every recurring bug or context drop incident, append a **15-word maximum** bullet to CLAUDE.md:
- Format: `- [INCIDENT] [Root cause] → [Fix applied] (date: YYYY-MM-DD)`
- Example: `- [Context Drop] Agent configs not cached at session start → Pre-load to MEMORY.md on day 1 (date: 2026-03-28)`
- Review quarterly — remove fixes that have not recurred in 3+ builds
- Purpose: Prevent the same issue from burning tokens twice

---

## Session Folder Structure & Screenshot Management

```
.claude/sessions/[DATE]/
├── SESSION_LOG.md          ← Compressed: tasks only, minimal signatures
├── technical_log_v1.md     ← Full work details, agent signatures
├── MEMORY.md               ← ⭐ Agent Config Index (read once, reused all session)
├── SC1_description.png     ← Screenshots (embedded in technical_log)
└── SC2_description.png
```

**MEMORY.md must include:**
```markdown
## Agent Config Index
**Loaded:** 2026-03-28 08:30 (session start)
**Status:** Cached — all agents reference these, no re-reads

### Coding Agent Config
[Summary of key requirements from .claude/agents/coding-agent.md]

### Code Reviewer Config
[Summary of key requirements from .claude/agents/code-reviewer.md]

[... etc for all 5 agents ...]
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

---

## Scoped Rules (Folder-Level Auto-Discovery)

Rules are now distributed to their respective working directories. No centralized `.claude/rules/` directory — agents load rules naturally as they work:

| Concern | Location |
|---------|----------|
| TypeScript + component patterns | `src/components/claude.md` |
| Auth, RLS, OWASP, secrets | `src/app/api/claude.md` |
| Supabase, JSONB, migrations | `src/lib/db/claude.md` |
| Next.js App Router, Tailwind OLED | `src/components/claude.md` |

**Coding Agent behavior:** Agents auto-discover and load rules from folder-level `claude.md` as they work. No explicit reads required. See `.claude/agents/coding-agent.md` → "Rules auto-discovery" section.

---

## Discovery & Audit Gatekeepers (Haiku Skills)

Two new Haiku-based skills provide cost-effective discovery and validation **before** expensive Sonnet implementation:

| Skill | Purpose | Model | When to Use |
|-------|---------|-------|------------|
| `spec-developer` | Ask clarifying questions + generate implementation plan | Haiku | Before ANY code is written |
| `visual-auditor` | Generate Mermaid diagrams + validate against specification | Haiku | After implementation, BEFORE QA |

**Why Haiku for gatekeepers?**
- Exploration is I/O-heavy (reading, asking questions) — doesn't need expensive reasoning
- **Cost savings:** 5x cheaper than Sonnet for same output quality on discovery tasks
- **Token impact:** -40% per discovery cycle vs. old Sonnet-only approach

See `.claude/skills/spec-developer/SKILL.md` and `.claude/skills/visual-auditor/SKILL.md`.

---

## Skills (load when feature matches)

| Feature | Skill |
|---------|-------|
| Creating / modifying trackers | `.claude/skills/tracker-creation/SKILL.md` |
| Logging health data (any modality) | `.claude/skills/health-logging/SKILL.md` |
| Telegram webhook + message handling | `.claude/skills/telegram-bot/SKILL.md` |
| Morning / evening routine flows | `.claude/skills/daily-routine/SKILL.md` |
| Dashboard widget management | `.claude/skills/dashboard-builder/SKILL.md` |
| Premium UI/UX Design System | `.claude/skills/ui-ux-pro-max/SKILL.md` |

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

---

## Known Gotchas (V25 Learnings)

- **Relative dates → actual device date, not session date** — `"yesterday"` / `"today"` in `prompt-builder.ts` must resolve against `params.date` (client's real date). Only fall back to active session date when the user specifies NO explicit date. Bug manifests in active-session state only.
- **End Day enforced before Start Day** — `chat/route.ts` must check `getActiveDayState()` and reject a Start Day trigger if a session is already open. Error message: *"Start day for [date] already complete. End yesterday's session first."*
- **Routine state must survive page reload** — `activeDayState` + `currentRoutineStep` must be persisted to DB (not memory-only). On load, resume from DB state; never re-fire the trigger phrase. Corrupts AI context if missed.
- **CSS sticky: never `overflow-hidden` above a `sticky` child** — Any wrapper with `overflow-hidden` silently breaks `position: sticky` on descendants. Chat header + input + journal header all require the full parent chain to use `overflow-auto` (or no overflow) on the scrollable container, with `overflow-hidden` only on the non-scrolling shell.
