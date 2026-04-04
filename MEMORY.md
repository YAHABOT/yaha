# MEMORY.md — Agent Config Cache + Session State

> **Token Optimization: Load ALL agent configs ONCE at session start. Reference here, never re-read `.claude/agents/*.md`**

## Session Context

- **Date:** 2026-03-28
- **Status:** Active
- **Configs Cached:** ✅ YES (loaded at session start)
- **Last Updated:** 2026-03-28 09:00

---

## Agent Config Index (Load Once Per Session)

**Read these ONCE at session start, then all agents reference this section.**

### Coding Agent Config

**Location:** `.claude/agents/coding-agent.md`

**Key Requirements:**
- Read task description completely
- Read `.claude/rules/code-style.md` + relevant skill files
- Validate: `npm run lint && npm run build` (EXIT 0 expected)
- Create `TECHNICAL_LOG_v[N].md` with full implementation details
- Announce "Build [N] Released" in SESSION_LOG

**Before Writing Code Checklist:**
1. Confirm understanding by restating task in one sentence
2. Read assignment + rules files
3. Check for existing patterns
4. Start implementation only after above complete

---

### Code Reviewer Config

**Location:** `.claude/agents/code-reviewer.md`

**Key Requirements:**
- ⭐ **Review code with ZERO context bias** (read code independently, not PR description)
- Check: Correctness, Performance, Code Quality, OLED compliance
- Verdict: PASS | PASS WITH NOTES | FAIL
- Sign with compressed format: `[CR | HH:MM] Finding X`
- Update TECHNICAL_LOG_v[N] (NOT SESSION_LOG)

**Review Checklist:**
- Logic correctness + edge cases
- Performance implications
- Code quality + maintainability
- OLED colors/design compliance

---

### QA Agent Config

**Location:** `.claude/agents/qa-agent.md`

**Key Requirements:**
- Write tests covering: happy path + auth failure + invalid input + edge case
- Post test criteria checklist in SESSION_LOG
- Document results in TECHNICAL_LOG_v[N]
- Verdict: PASS | PASS WITH NOTES | FAIL
- Embed screenshots in technical_log
- Sign: `[QA | HH:MM] Results summary`

**Test Coverage (Mandatory):**
- ✅ Happy path — valid inputs produce expected output
- ✅ Auth failure — unauthenticated requests return 401/error
- ✅ Invalid input — malformed data returns clear error (not 500)
- ✅ Edge case — at least one (empty list, zero value, missing optional field)

---

### Research Agent Config

**Location:** `.claude/agents/research-agent.md`

**Key Requirements:**
- Dispatch ONLY for: new APIs, new packages, unclear constraints
- Return structured findings (NO code)
- Sign SESSION_LOG with research summary
- Exit after findings delivered

**Research Areas:**
- API docs + rate limits + auth requirements
- Package maintenance + bundle size + alternatives
- Security surface + known CVEs

---

### Security Reviewer Config

**Location:** `.claude/agents/security-reviewer.md`

**Key Requirements:**
- ⚠️ ON-DEMAND ONLY (dispatched by explicit user request)
- Check OWASP Top 10 + auth + RLS + secrets + Telegram webhook validation
- Verdict: PASS | FAIL (with detailed findings)
- Sign SESSION_LOG: `[SR | HH:MM] Audit verdict`

**Audit Checklist (20+ items):**
- SQL injection prevention
- XSS prevention
- Authentication verification
- RLS policy enforcement
- Secret management
- Input validation
- Telegram webhook secret validation
- AI output sanitization

---

### HR Agent Config

**Location:** `.claude/agents/hr-agent.md`

**Key Requirements:**
- ⚠️ ON-DEMAND ONLY (dispatched by explicit user request: "Run HR Agent")
- **Model switching:** Haiku (read) → Sonnet (analyze) → Haiku (apply + report)
- **Token budget:** Strict 20% of session budget cap
- **Date range:** User provides at startup (e.g., 2026-03-27 to 2026-03-28)

**What It Does:**
- Phase 1 (Haiku): Read SESSION_LOG + TECHNICAL_LOG + agent configs → extract agent activity + SOP compliance data
- Phase 2 (Sonnet): Analyze compliance scores + token usage + identify inefficiencies
- Phase 3 (Haiku): Apply Priority 1 recommendations to CLAUDE.md → generate audit report

**Audit Output:**
- Agent scorecards (SOP compliance %)
- Token consumption breakdown
- Optimization recommendations (Priority 1, 2, 3)
- Applied changes (immediately active in CLAUDE.md)

**Dispatch Format:**
```
User: "Run HR Agent — audit 2026-03-27 to 2026-03-28"
[HR Agent asks for confirmation]
/model haiku → Phase 1 (read)
/model sonnet → Phase 2 (analyze)
/model haiku → Phase 3 (apply + report)
```

---

## Model Preferences (Session-Wide)

**Default for this session:** `claude-sonnet-4-6` (all agents except Security Reviewer & HR Agent)

| Agent | Model | When to Override |
|-------|-------|------------------|
| Coding Agent | Sonnet | Never (Sonnet excellent for Next.js) |
| Code Reviewer | Sonnet | Never (Sonnet = Opus for code quality) |
| QA Agent | Sonnet | Never (Sonnet reliable for tests) |
| Research Agent | Sonnet | Never (Sonnet fast for API research) |
| Security Reviewer | **Opus** | ON-DEMAND ONLY (when user requests security audit) |
| **HR Agent** | **Haiku → Sonnet → Haiku** | ON-DEMAND ONLY (when user requests performance audit) |

---

## Session Rules & Conventions

### Compressed Signature Format

Use this format for ALL agent signatures in SESSION_LOG:

```
[AA | HH:MM] Brief note
```

| Code | Agent |
|------|-------|
| CA | Coding Agent |
| CR | Code Reviewer |
| QA | QA Agent |
| RA | Research Agent |
| SR | Security Reviewer |
| HR | HR Agent |
| MA | Main Agent |

**Examples:**
- `[CA | 09:15] Build v21 complete, 3 files changed`
- `[CR | 09:30] PASS — no issues found`
- `[QA | 10:00] FAIL — 2 tests failing, see SC1`

### Compressed Task Format

Tasks in SESSION_LOG should be minimal but complete:

```markdown
## Task: [Brief Title]
**Ref:** MEMORY.md § [Agent Config] | Cache: ✓
**What:** [1-2 line description of the problem/feature]
**Root cause:** [If bug fix — why it failed]
**Files:** src/path/file1.tsx, src/path/file2.ts
**Validation:** npm run lint && npm run build
**Screenshots:** SC1 — [description], SC2 — [description]
```

---

## No-Reread Rules (Token Optimization)

❌ **NEVER:**
- Read `.claude/agents/*.md` files multiple times in one session
- Re-read CLAUDE.md per agent dispatch
- Reload this MEMORY.md without good reason

✅ **ALWAYS:**
- Reference this section for agent requirements
- Assume configs loaded at session start stay in context
- Use compressed signatures to save tokens

---

## Session Tracking (Update as Work Progresses)

### Build Status

| Build | Status | Code Reviewer | QA | Notes |
|-------|--------|---------------|----|-------|
| v1 | - | - | - | [Add rows as builds progress] |

### Known Issues

[List any blocking issues found during session]

### Decisions Made

[Document key architectural or workflow decisions]

---

## End-of-Session Cleanup

When session is complete:
1. Update git status (commit or PR)
2. Note unfinished work in SESSION_LOG (if any)
3. Keep this MEMORY.md for next session's reference
4. Clear unnecessary lines to keep context tight
