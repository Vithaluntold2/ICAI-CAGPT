# POV-Driven Roundtable — Step-by-Step Implementation Plan

**System**: ICAI CAGPT · Boardroom Runtime  
**Date**: April 2026  
**Current baseline**: `roundtableRuntime.ts` (1,883 lines, Phase 2 shipped)  
**Goal**: Add POV synthesis, convergence detection, and structured belief tracking on top of the existing runtime — no rewrite.

---

## Mental model before you start

```
TODAY (Phase 2)
────────────────────────────────────────────────────────────
  Chair prompt
       ↓
  loadRecentThreadContext()  ← same raw thread injected into EVERY agent
       ↓
  buildAgentSystemPrompt()   ← agent sees everything everyone said
       ↓
  LLM call → agent turn

AFTER THIS PLAN (Phase 3+)
────────────────────────────────────────────────────────────
  Chair prompt
       ↓
  synthesizeAgentPOV()       ← per-agent compressed, filtered context
       ↓
  buildAgentSystemPrompt()   ← agent sees its OWN view + cue card of others
       ↓
  LLM call → agent turn
```

The entire upgrade is: replace one function call. Everything else (tool loop, KB retrieval, streaming, budget guardrail, question cards, abort) stays exactly as-is.

---

## Priority order (execute top-to-bottom)

| # | Step | Effort | Impact | Risk |
|---|------|--------|--------|------|
| 1 | V1 Synthesizer — POV text injection | 3–4 days | Eliminates ~70% repetition | Low |
| 2 | Semantic convergence gate | 1 day | Fixes infinite loop | Low |
| 3 | Structured OtherAgentsSummary (cue card) | 1 day | Prevents cross-copying | Low |
| 4 | Belief + contradiction tracking (SynthState V2) | 1 week | Core IP | Medium |
| 5 | Event-driven synthesizer (cost optimisation) | 2–3 days | ~60% fewer synth calls | Medium |
| 6 | Mastra integration | Defer | Suspend/resume at scale | High |

---

## Step 1 — V1 Synthesizer: POV text injection

### What it is

After every completed agent turn, a small LLM call runs for the *next* agent that's about to speak and produces a compressed personal context. That compressed context replaces the raw thread dump in `buildAgentSystemPrompt`.

### Where it lives in the code

All changes are confined to `server/services/roundtable/roundtableRuntime.ts`.

### Data structure (in-memory, no migration needed for V1)

Add to `ThreadRuntime`:

```typescript
// Per-agent POV: agentId → compressed personal context text
agentPOVs: Map<string, string>;
```

### New function: `synthesizeAgentPOV()`

```
INPUT:
  agent            — the agent whose POV we're building
  globalDelta      — the last N turns (raw text, compact)
  previousPOV      — string from agentPOVs.get(agentId) or ''
  openQuestions    — open question cards directed at or from this agent
  otherAgents      — other panel members (name + last-stated position)

SYSTEM PROMPT:
  You are a context synthesizer for [agentName].
  Your job is to update their personal working context.
  Output format (strictly):
    ## Current Understanding
    [2–3 sentences on the overall situation]
    ## My Position
    [1–2 sentences — what I currently argue]
    ## Key Disagreements
    [bullet list — who disagrees and what their claim is. Empty if none.]
    ## Open Questions
    [bullet list — questions asked of me or that I asked, still unanswered]
    ## What I Need Next
    [1 sentence on what information or answer would change my position]

USER PROMPT:
  Previous context: <previousPOV>
  New exchanges since last update: <globalDelta>
  Open question cards: <openQuestions>
  Other agents' last-stated stances: <otherAgentsSummary>
  Update the context now.

OUTPUT: 300–400 tokens max. Strictly the five-section format above.
MODEL TIER: mini (cheap, fast)
```

### Integration point in `runAgentTurn()`

Current code (around line 1350):
```typescript
const threadContext = await loadRecentThreadContext(threadId, 12);
```

Replace with:
```typescript
const threadContext = await loadOrSynthesizePOV(
  userId, threadId, agent, allAgents, owned.thread
);
```

Where `loadOrSynthesizePOV()`:
1. Calls `loadRecentThreadContext()` (still needed for the raw delta)
2. Passes the delta + previous POV + open cards to `synthesizeAgentPOV()`
3. Writes the result back to `runtime.agentPOVs.set(agentId, newPOV)`
4. Returns the POV text (used in `buildAgentSystemPrompt` instead of raw thread)

### What changes in `buildAgentSystemPrompt()`

The function already accepts `kbSnippets` and `allAgents`. Add a third parameter:
```typescript
function buildAgentSystemPrompt(
  agent: RoundtablePanelAgent,
  kbSnippets: string,
  allAgents: RoundtablePanelAgent[],
  agentPOV: string,  // ← NEW
): string
```

In the user-prompt assembly (in `runAgentTurn`), replace:
```typescript
'Recent thread (most recent last):',
threadContext || '(empty)',
```
with:
```typescript
'Your current working context (synthesized):',
agentPOV || '(no prior context)',
```

### Expected outcome

- Each agent reasons from its own narrative instead of a 12-turn raw dump
- Agents stop repeating what others said — they only see summaries
- Cost: +1 mini LLM call per turn per agent that speaks (not per all agents)

---

## Step 2 — Semantic convergence gate

### What it is

Add a termination check at the end of `runRelevanceLoop()`. If all agents returned `wantsToSpeak: false` AND there are no high-priority open question cards, the loop emits `loop-idle` with reason `converged` instead of running the Moderator fallback.

### Current code location

Around line 1100 in `runRelevanceLoop()`:
```typescript
if (!winner) {
  // ── Moderator fallback ──
  const moderator = agents.find(...);
  if (moderator && ...) { ... return; }
  emit(threadId, 'loop-idle', { reason: 'no agent wanted floor' });
  return;
}
```

### Change

Before the moderator fallback block, insert:

```typescript
// ── Semantic convergence check ─────────────────────────────
// If NO agent wants to speak AND there are no open non-user question
// cards with urgency > 0, the panel has converged. Auto-advance to
// the next phase (or terminate at resolution) instead of firing the
// moderator fallback unnecessarily.
const allCeded = valid.every((p) => !p.wantsToSpeak);
const openUrgentCards = openCards.filter(
  (c) => !c.toUser && c.status === 'open'
);
if (allCeded && openUrgentCards.length === 0) {
  const phase = owned.thread.phase;
  const PHASE_ORDER = [
    'opening', 'independent-views', 'cross-examination',
    'user-qa', 'synthesis', 'resolution'
  ];
  const currentIdx = PHASE_ORDER.indexOf(phase);
  if (phase === 'resolution') {
    // Final phase — terminate the session loop entirely.
    emit(threadId, 'session-complete', { reason: 'converged' });
    emit(threadId, 'loop-idle', { reason: 'converged-final' });
    return;
  }
  if (currentIdx >= 0 && currentIdx < PHASE_ORDER.length - 1) {
    // Propose the next phase rather than silently advancing — the chair
    // still has final say (same as agent-initiated propose_phase_transition).
    const nextPhase = PHASE_ORDER[currentIdx + 1];
    emit(threadId, 'convergence-detected', {
      currentPhase: phase,
      proposedNextPhase: nextPhase,
      reason: 'all-agents-ceded-no-open-questions',
    });
    // Don't advance automatically — let the chair accept/reject.
    emit(threadId, 'loop-idle', { reason: 'convergence-proposed' });
    return;
  }
}
```

### Frontend addition

Handle `convergence-detected` in `useBoardroomThread.ts`: show a "Panel converged — advance to [next phase]?" banner with Accept/Reject buttons. Accepting calls `POST /api/roundtable/boardroom/threads/:id/phase`.

---

## Step 3 — Structured OtherAgentsSummary (cue card format)

### What it is

When `synthesizeAgentPOV()` receives `otherAgents`, it builds a cue card — a small structured block injected at the top of the agent's context so they know what their colleagues currently believe without reading the raw transcript.

### Format (injected into synthesizeAgentPOV's user prompt)

```
== What your colleagues currently believe ==
[Tax Expert]
  Position: Input tax credit is available on the procurement.
  Key claim: The supplier invoice satisfies section 16(2) conditions.
  Open question to you: Does the time-of-supply for the advance match the tax period?

[IFRS Specialist]
  Position: Disclosure is triggered under Ind AS 37.
  Key claim: The outflow probability exceeds 50% given the audit finding.
  Conflict with Tax Expert: Disagrees on materiality threshold.
```

### Data source

The cue card is built from `runtime.agentPOVs` of the *other* agents — taking their `## My Position` and `## Key Disagreements` sections. On the first turn (no prior POVs), it falls back to the last completed turn content per agent (first 200 chars).

### Why this matters

Without this, agents default to quoting each other verbatim from the raw thread — which is exactly the repetition the system is designed to prevent. The cue card gives them enough to reference a colleague's position without re-reading the raw turn.

---

## Step 4 — SynthState V2: belief + contradiction tracking

### When to start

After Step 1–3 are running in production and you've verified (via a 20-turn boardroom session) that:
- Raw repetition is reduced
- Convergence gate fires correctly
- Cue cards appear in agent responses ("as [Tax Expert] notes...")

### Data structure

```typescript
interface Belief {
  statement: string;
  confidence: number;           // 0.0–1.0
  supportingAgentIds: string[];
  opposingAgentIds: string[];
  lastUpdatedTurnId: string;
  createdTurnId: string;
}

interface Conflict {
  claimA: string;               // belief.statement from agent A
  claimB: string;               // belief.statement from agent B
  agentAId: string;
  agentBId: string;
  status: 'unresolved' | 'resolved';
  resolvedByTurnId: string | null;
}

interface SynthState {
  agentId: string;
  threadId: string;
  beliefs: Belief[];
  openQuestions: QuestionRef[];   // references to roundtable_question_cards
  contradictions: Conflict[];
  povText: string;                // the V1 text output (still generated)
  version: number;                // increments on each update
  updatedAt: Date;
}
```

### Storage options

**Option A — in-memory** (no migration): `runtime.agentSynthStates: Map<agentId, SynthState>`. Lost on server restart; acceptable for V2 since sessions are bounded.

**Option B — DB table** (persistent, queryable): Add `roundtable_synth_states` table in a migration. Required if you want:
- Session resumption after server restart
- Cost analytics per belief update
- Debugging tools in admin UI

Start with Option A. Migrate to Option B after validating belief quality.

### Synthesizer upgrade for V2

`synthesizeAgentPOV()` becomes `updateSynthState()`:

```
INPUT:
  previousState: SynthState
  globalDelta: string (last N turns)
  openCards: QuestionCard[]

NEW OUTPUT sections:
  ## Beliefs
  [JSON array: { statement, confidence, supporting, opposing }]
  
  ## Contradictions
  [JSON array: { claimA, claimB, agentA, agentB, status }]
  
  (+ existing 5 sections for the text POV)
```

Parse the JSON sections out and merge into `SynthState`. The text POV sections remain unchanged — they're still what gets injected into `buildAgentSystemPrompt`.

### Confidence decay rule

After each turn where an agent does NOT update a belief, decay its confidence by 0.05. When confidence drops below 0.2, move it to an `archivedBeliefs` array. This prevents stale reasoning from persisting across a 40-turn session.

```typescript
function decayBeliefs(state: SynthState, activeTurnId: string): void {
  for (const belief of state.beliefs) {
    if (belief.lastUpdatedTurnId !== activeTurnId) {
      belief.confidence = Math.max(0, belief.confidence - 0.05);
    }
  }
  const [alive, archived] = state.beliefs.reduce(...)
  state.beliefs = alive;
  state.archivedBeliefs = [...(state.archivedBeliefs ?? []), ...archived];
}
```

### Contradiction → question card pipeline

When V2 detects a new contradiction between agents A and B:

1. Auto-create a question card: `fromAgentId: null (system)`, `toUser: true`, text: `"Conflict detected: [A's claim] vs [B's claim]. Chair: accept, redirect, or skip?"`
2. Emit `conflict-detected` SSE event with both claims and agent names
3. Frontend renders it as a special card with three buttons: "Accept A", "Accept B", "Leave for cross-examination"

This makes contradictions visible to the chair — not just in agent prompts.

---

## Step 5 — Event-driven synthesizer (cost optimisation)

### Current approach (after Step 1)

Synthesizer runs on every completed turn, for every agent. With 5 agents and 30 turns = 150 synth calls.

### Target approach

Run the synthesizer for agent X only when:

```typescript
const shouldSynthesize = (
  event === 'question-card' && card.toAgentId === agentId  // directed question
  || event === 'contradiction-detected' && agentIsInvolved  // belief update needed
  || event === 'phase-changed'                               // full context shift
  || turnsSinceLastSync >= MAX_TURNS_BEFORE_FORCED_SYNC      // staleness guard
);
```

Set `MAX_TURNS_BEFORE_FORCED_SYNC = 4`.

### Implementation

Add a staleness counter to `SynthState`:

```typescript
turnsSinceLastSync: number;  // increments on every turn, resets on synth
```

In `runRelevanceLoop()`, before calling `runAgentTurn()`, check if the winner's synth state needs an update. If yes, run `updateSynthState()`. If not, use the cached `povText`.

### Expected cost reduction

From 150 calls (every-turn) to ~50–60 calls (event-driven, 4-turn staleness cap). At mini-model rates ($0.015/1k tokens, ~300 tokens per synth call), that's ~$0.0045 per synth call. 150 → 50 saves ~$0.45 per typical session — meaningful at scale, not critical for V2.

---

## Step 6 — Mastra integration (deferred)

### When to evaluate

After Steps 1–5 are running in production and you encounter at least ONE of these:
- Session resumption after server restart is a user-reported pain point
- You need suspend/resume for async workflows (e.g., overnight sessions)
- Multi-tenant concurrency causes the in-memory `runtimes` Map to become unwieldy

### What Mastra buys

- Durable workflow state (persisted between restarts)
- Native suspend/resume (`workflow.suspend()` / `workflow.resume()`)
- Step-level retries with backoff (replacing the manual retry loop in `callLLM`)
- TypeScript-native workflow definition

### What Mastra does NOT replace

- The Synthesizer logic (entirely custom)
- KB retrieval (`gatherKbContext`)
- Budget guardrail
- Question card state machine
- SSE event bridge

### Integration strategy (when you decide to do it)

Do NOT rewrite `runRelevanceLoop`. Instead:

1. Wrap each `runAgentTurn()` call as a Mastra **step**
2. Wrap the loop itself as a Mastra **workflow** with `phaseId` as state
3. Use Mastra's storage adapter to persist `SynthState` between steps
4. Keep the `EventEmitter`-based SSE bridge — just emit events from within steps

This is a wrapping, not a replacement.

---

## Testing checkpoints per step

### Step 1 tests
- Start a 5-agent session with a controversial accounting question
- After 10 turns, verify no agent turn content is a verbatim copy of a previous turn
- Check that POV sections appear in agent prompts (add a debug flag that logs the constructed `userPrompt`)

### Step 2 tests
- Create a session where all agents are `cede_floor` bots (always cede)
- Verify `convergence-detected` fires within 2 loop passes
- Verify the loop does NOT fire `moderator-fallback` after `convergence-detected`

### Step 3 tests
- After 3 agent turns, inspect the cue card injected into the 4th agent's prompt
- Verify it contains the other agents' positions, NOT raw turn text
- Verify it fits within the token budget (< 400 tokens)

### Step 4 tests
- Unit test `decayBeliefs()` with a state that has 3 beliefs, 2 of which are not updated
- Unit test contradiction detection: inject two turns with directly opposing claims
- Verify a system question card is created with the correct two-agent conflict text

### Step 5 tests
- Instrument `updateSynthState()` with a call counter
- Run a 20-turn session, verify call count ≤ 60 (not 100 for 5×20)
- Verify that a directed question always triggers a synth call for the addressed agent

---

## File change summary

| File | Change type | New lines (approx) |
|------|-------------|-------------------|
| `server/services/roundtable/roundtableRuntime.ts` | Extend | +350 (Steps 1–3), +250 (Steps 4–5) |
| `server/services/roundtable/synthState.ts` | New file | ~200 (Step 4, SynthState types + helpers) |
| `client/src/hooks/useBoardroomThread.ts` | Extend | +60 (Step 2 convergence event handler) |
| `client/src/components/roundtable/BoardroomThread.tsx` | Extend | +80 (Step 2 convergence banner, Step 4 conflict cards) |
| `migrations/000X_roundtable_synth_state.sql` | New file | ~25 (Step 4 Option B only) |

No existing tests broken. All changes are additive to the Phase 2 runtime.

---

## What this system becomes after all steps

```
Agent POV Context (per agent, per turn)
──────────────────────────────────────────────────────────
## Current Understanding      ← synthesized from raw thread
## My Position                ← agent's own evolving stance
## Key Disagreements          ← tracked contradictions
## Open Questions             ← structured question objects
## What I Need Next           ← intent signal for routing

Injected into buildAgentSystemPrompt() INSTEAD of raw thread.
──────────────────────────────────────────────────────────

Cue Card (other agents' stances, compressed)
──────────────────────────────────────────────────────────
== What your colleagues currently believe ==
[Agent A]  Position: ...   Key claim: ...
[Agent B]  Position: ...   Conflict with you: ...
──────────────────────────────────────────────────────────
```

The agent reasons from its own narrative. It knows what others believe without reading their turns. Contradictions are first-class objects, not buried in a 12-turn dump. The loop terminates when convergence is real, not when providers exhaust.

That is the moat.
