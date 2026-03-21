# Claude Code Handoff: YAHA Resumption V2 (2026-03-21)

Hello Claude Code! You are taking over the YAHA Health Tracker project. Here is the distilled context and mission for this session based on the Architect's research and the failure of the previous build.

## 🎯 Mission
Fix the specific regressions in **Routine Flow** (auto-advance), implement a dedicated **Edit** button for action cards, restore the **Smart Mapper** for data extraction, and resolve **Navigation Performance** waterfalls.

> [!IMPORTANT]
> **Post-Fix Requirement**: Once you have completed the fixes and verified the build, you **MUST** create a comprehensive `TECHNICAL_LOG.md` detailing the root causes, file changes, and validation results. **CLEAR out any existing `TECHNICAL_LOG.md` first** to ensure zero confusion.

## 🚨 Priority Fix List

### 1. Routine Flow: Auto-Advance Failure
- **Issue**: After the user confirms a log (e.g., Weight), the AI stops and does not ask for the next step (e.g., Sleep).
- **Task**: 
  - Add an `onConfirmed` callback to `ActionCard.tsx`.
  - In `ChatInterface.tsx`, when a card is confirmed, if a routine is active, **programmatically send** a hidden "continue routine" trigger to the AI.
- **Files**: `src/components/chat/ActionCard.tsx`, `src/components/chat/ChatInterface.tsx`.

### 2. Dedicated "Edit" Button
- **Issue**: The current "inline" editing is not prominent enough, and users cannot "re-edit" a successfully logged card.
- **Task**: Add a dedicated "Edit" button next to "Log Entry".
- **Logic**: Clicking "Edit" should put the card back into an interactive state (editable text fields) even if it was previously marked as "Logged Successfully".
- **Files**: `src/components/chat/ActionCard.tsx`.

### 3. Data Extraction: Smart Mapper & Fuzzy Mapping
- **Issue**: 8 out of 12 fields (Deep Sleep, REM, etc.) are missed during AI extraction because the labels don't match IDs exactly.
- **Task**: Restore the **Smart Mapper** logic in `sanitizeFields`.
- **Logic**: Implement case-insensitive fuzzy matching, synonym grouping (e.g., "Deep Sleep" -> `fld_deep_sleep`), and deduplication.
- **Files**: `src/lib/ai/actions.ts`.

### 4. Navigation Latency: Data Fetching Waterfalls
- **Issue**: Switching between chat sessions is still throttled by server waterfalls.
- **Task**: Flatten the data-fetching logic in `ChatSessionPage`.
- **Logic**: Run `getSession`, `getMessages`, and `getSessions` in a single top-level `Promise.all`.
- **Files**: `src/app/(app)/chat/[sessionId]/page.tsx`.

## 🛠️ Proof of Bug (Session Evidentiary Log)
All reference evidence is located in Claude's working directory: `evidence/`

### Current Regression Evidence:
- **Routine Flow (Fail)**: [media__1774090173437.png](file:///c:/Users/the--/Documents/Projects/yaha/evidence/media__1774090173437.png) - AI stalls after confirm.
- **Edit Missing**: [media__1774090485335.png](file:///c:/Users/the--/Documents/Projects/yaha/evidence/media__1774090485335.png) - Action card lacks clear Edit trigger.
- **Data Mapping**: [media__1774090965072.jpg](file:///c:/Users/the--/Documents/Projects/yaha/evidence/media__1774090965072.jpg) - Missing sleep field mapping requirement.

**Make it happen!**
