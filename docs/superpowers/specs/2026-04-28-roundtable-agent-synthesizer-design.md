# Roundtable agent POV synthesizer — design spec

Date: 2026-04-28
Owner: Mohammed
Status: Implemented and always-on (legacy rule-based POV path removed; see plan 2026-04-28-roundtable-agent-synthesizer.md)

## Context

The boardroom roundtable feature has a multi-agent panel (Moderator + specialists like Auditor, Compliance, Devil's Advocate) debating a CFO-style decision. Agents currently see the raw shared transcript, which causes three problems:

1. As the conversation grows, prompt cost per turn balloons.
2. Agents drift, repeat each other, or invent phantom specialists ("I'll defer to the Governance Bot" when no such bot exists).
3. There's no notion of an agent's *own ongoing perspective* — every turn is reasoned from scratch over raw history.

The architectural fix (per Sai): give each agent an isolated, narrative POV document, maintained by a "synthesizer" subworker that summarises the broader conversation from that agent's POV after every turn. The agent reads its POV doc + a short raw tail before speaking — never the full raw transcript.

## Goals

- Each agent has a persistent POV document, updated after every panel turn.
- The doc captures: my position, what others have been saying, my outgoing Q&A with other agents, incoming Q&A from other agents, Q&A with the chair (separately tracked), open threads, and a glossary of named entities.
- Synthesis runs in the background per agent, without blocking the next turn.
- Agents fall through cleanly when synthesis fails — last-good POV + raw tail keeps the panel running.
- Always on; the legacy rule-based POV path has been removed.

## Non-goals (v1)

- Mastra migration. Synthesizer is built on existing primitives (`aiProviders`, `hybridJobQueue`, `hybridCache`, `circuitBreaker`); Mastra adoption is a separate, later effort.
- A "chair view" POV the human can read in the UI. The chair reads the raw transcript today; a separate synthesizer for them is v2.
- Vector / semantic recall over POVs. JSONB sections + recursive text compaction are sufficient for v1.
- Cross-thread POV continuity. POVs are scoped to a single roundtable thread.
- Other chat modes. This change is scoped to `server/services/roundtable/`.

## Architecture

```
                                 ┌──────────────────────────┐
                                 │  agent_pov_documents     │  (new Drizzle table)
                                 │  PK: (thread_id, agent_id)│
                                 └──────────▲───────────────┘
                                            │ read/write
┌──────────────────┐  emit job   ┌──────────┴──────────────┐
│ roundtableRuntime│────────────▶│ agentSynthesizer        │  (new service)
│                  │  per agent  │  - synthesizeAgentPOV() │
│ runAgentTurn()   │  on panel   │  - prompt + glossary    │
│  ─ finally ─────▶│             │  - token budget enforce │
│                  │             └──────────┬──────────────┘
│                  │                        │ uses
│ buildAgentSystem │                        ▼
│ Prompt() ────────┼───── read ─▶ agentPovStore (cache layered)
│   inject POV +   │
│   last-N tail    │
└──────────────────┘
                                 ┌─────────────────────────┐
                                 │ hybridJobQueue          │  (existing)
                                 │ + roundtable-synthesizer│
                                 └─────────────────────────┘
```

After every turn, `runAgentTurn`'s `finally` block enqueues a synthesizer job per agent on the panel — **including the speaker** (so their `self_position` picks up what they just said, and any answers they gave land in `incoming_qa`). Jobs run in parallel on the Bull queue; they are non-blocking.

Before any agent speaks, `buildAgentSystemPrompt` reads that agent's latest POV from `agentPovStore.get` and injects it as a structured block alongside the existing last-5 raw turns.

## Components

### Drizzle table — `agent_pov_documents`

JSONB sections allow surgical per-section updates and selective rendering. Optimistic locking via `version` handles concurrent synth jobs for the same agent.

```ts
agent_pov_documents
  thread_id                 uuid      NOT NULL
  agent_id                  uuid      NOT NULL
  self_position             jsonb     NOT NULL DEFAULT '{}'   // { stance, conclusions[] }
  others_summary            jsonb     NOT NULL DEFAULT '{}'   // { [agentName]: summary }
  outgoing_qa               jsonb     NOT NULL DEFAULT '[]'   // [{ to, question, answer, turnId }]
  incoming_qa               jsonb     NOT NULL DEFAULT '[]'   // [{ from, question, answer, turnId }]
  chair_qa                  jsonb     NOT NULL DEFAULT '[]'   // [{ direction, text, answer, turnId }]
  open_threads              jsonb     NOT NULL DEFAULT '[]'   // [{ description, awaiting_from, turnId }]
  glossary                  jsonb     NOT NULL DEFAULT '{}'   // { [term]: definition }
  last_synthesized_turn_id  uuid                               // highwater mark
  token_count               integer   NOT NULL DEFAULT 0
  version                   integer   NOT NULL DEFAULT 1
  last_updated_at           timestamptz NOT NULL DEFAULT now()
  PRIMARY KEY (thread_id, agent_id)
  INDEX        (thread_id)
```

Migration file: `0005_agent_pov_documents.sql`.

### `server/services/roundtable/agentPovStore.ts` (~150 LOC)

- `get(threadId, agentId): Promise<AgentPovDoc | null>` — reads through `hybridCache` (Redis primary, Postgres fallback), TTL 60s.
- `getOrInit(threadId, agentId): Promise<AgentPovDoc>` — lazy-creates an empty POV row on first read.
- `upsert(threadId, agentId, doc, expectedVersion): Promise<AgentPovDoc>` — atomic update with version check; throws `StaleVersionError` on conflict.
- `renderForPrompt(doc): string` — converts JSONB sections to a single labelled text block matching the format under "Render shape" below.

### `server/services/roundtable/agentSynthesizer.ts` (~250 LOC)

Public API:

```ts
synthesizeAgentPOV(opts: {
  threadId: string;
  agentId: string;
  tokenBudget?: number;  // default 1800
}): Promise<{ version: number; tokenCount: number }>
```

Steps:

1. `agentPovStore.getOrInit(threadId, agentId)` → `{ doc, version }`
2. Fetch turns where `turn.id > doc.last_synthesized_turn_id` (or all turns if null).
3. Load roster: `loadAgents(panelId)` + chair metadata.
4. Render synthesizer prompt (template below).
5. Pick provider via `aiProviderRegistry.getProvider(...)` — mini tier; JSON mode on; `withTimeout(15s)`; wrapped in `circuitBreaker`.
6. Parse response → new POV; if `JSON.parse` throws, treat as failure.
7. Compute `tokenCount` via existing tokenizer; if > `tokenBudget`, recursive-compact the oldest entries in `outgoing_qa`/`incoming_qa`/`chair_qa` (collapse 5 oldest into a single summary line) and re-count.
8. `upsert` with `expectedVersion`; on `StaleVersionError`, re-load + re-merge once; second failure is logged + accepted.
9. `hybridCache.set(\`pov:${threadId}:${agentId}\`, newDoc, 60)`.
10. `orchestrationBroadcaster.send(...)` with `phase: 'synthesizing', agentId`.

### `server/services/roundtable/synthesizerJob.ts` (~80 LOC)

- Registers a Bull queue `roundtable-synthesizer` in `hybridJobQueue.ts`.
- Processor calls `synthesizeAgentPOV` with retry: 2 attempts, exponential backoff (5s, 30s).
- Hard failures are logged to Sentry with tag `synthesizer.failure`; the panel never blocks on a failed synth.

### Synthesizer prompt template

```
You are a synthesis assistant maintaining {agentName}'s perspective on a roundtable.

CURRENT POV (compact JSON):
{prior_pov_as_json}

NEW TURNS SINCE LAST SYNTHESIS:
{turns_verbatim_with_speaker_labels}

ROSTER (other panelists + chair):
{roster_with_one_line_descriptions}

Your job: produce an UPDATED POV as JSON matching this schema:
  { self_position, others_summary, outgoing_qa, incoming_qa,
    chair_qa, open_threads, glossary }

Rules:
- Preserve all named entities (people, companies, amounts, dates, regulations) in glossary.
- For outgoing_qa/incoming_qa/chair_qa: APPEND new Q&As with their turnId; do not rewrite history.
- Update open_threads: close resolved ones, add new pending ones.
- Compress others_summary aggressively but preserve quantitative claims and citations.
- Keep total POV under {tokenBudget} tokens.
- Output ONLY valid JSON, no prose.
```

### Integration points (modify, not rewrite)

| File | Change |
|---|---|
| `shared/schema.ts` + new migration `0005_agent_pov_documents.sql` | Define table |
| `server/services/hybridJobQueue.ts` | Register `roundtable-synthesizer` queue + processor; export `addSynthesizerJob` |
| `server/services/roundtable/roundtableRuntime.ts` | Two surgical edits: (a) in `runAgentTurn`'s `finally`, dispatch synth jobs for **all** panel agents (speaker included); (b) in `buildAgentSystemPrompt`, fetch POV via `agentPovStore.get` + `renderForPrompt` and inject as a labelled block alongside the existing last-N raw turns. Legacy `agentPOVs` map + `buildOtherAgentsCueCard` + `updateRuleBasedPOV` removed. |

Total net-new code: ~480 LOC across three files + one migration.

## Render shape

The format injected into each agent's system prompt before they speak. Last-5 raw turns are appended after the perspective block as a separate, clearly delimited section.

```
=== YOUR PERSPECTIVE (synced through turn N) ===

YOUR POSITION: ...

WHAT OTHERS HAVE SAID:
- Auditor: ...
- Compliance Bot: ...

QUESTIONS YOU ASKED OTHERS:
- To Auditor: "..." → "..."

QUESTIONS ASKED OF YOU:
- From Compliance: "..." → You: "..."

CHAIR Q&A:
- Chair → You: "..." → You: "..."
- You → Chair: "..." → Chair: "..."

OPEN THREADS:
- Awaiting DA's revised VIU calc (asked turn 12)

KEY FACTS:
- Entity: NovaPlast Ltd · Asset: Plant 3 · Amount: ₹2.4cr
- Standard: Ind AS 36

=== END YOUR PERSPECTIVE ===

=== RECENT TURNS (verbatim, last 5) ===
[T10 Auditor]: ...
[T11 Devil's Advocate]: ...
...
=== END RECENT TURNS ===
```

## Failure modes

| Failure | Behaviour |
|---|---|
| Synth model times out (15s) | Bull retries 2× w/ exp backoff. If all fail, last-good POV stays. Agent uses stale POV + last-5 raw turns. Logged to Sentry with `synthesizer.failure`. |
| Synth returns invalid JSON | Caught at parse step, treated as failure; same retry + fallback. |
| `StaleVersionError` on upsert | Re-load + re-merge once; second conflict logged + accepted (lossy but converges next turn). |
| `agent_pov_documents` row missing | `getOrInit` creates a default empty doc. |
| Bull queue down | Jobs not enqueued; agents continue with whatever POV is in DB (will go stale). Surfaced via existing queue health endpoint. |

Synthesis failures **must never block panel progress.** The panel runs with stale POVs rather than blocking on a synth that won't complete.

## Testing strategy

### Unit (vitest, mocked provider)

- `agentPovStore.test.ts`: lazy init creates v1; upsert version conflict throws; cache consulted before DB; cache invalidated on upsert; renderForPrompt stable format.
- `agentSynthesizer.test.ts`: prompt assembly with prior POV + new turns + roster; valid JSON → upsert with version bump; invalid JSON → throws (no upsert); recursive compaction triggers when tokenCount > budget; speaker's self_position updates from their own turn; stale version retried once.
- `synthesizerJob.test.ts`: processor calls synth with correct args; rethrows on failure so Bull retries per queue config.

### Integration (real Postgres, mocked LLM)

- 4-agent panel runs 5 turns; after each turn, all 4 POV doc versions advance within 10s.
- Glossary entries preserved across 10 turns; no entity loss.
- Concurrent synth jobs for same agent: one wins, other retries, no data loss.
- Synth timeout → POV stays at last-good; agent reads stale POV + raw tail.

### E2E (real model)

- NovaPlast impairment scenario; assert each agent's POV has non-empty self_position + others_summary by turn 5; assert no agent invents a phantom specialist.

## Verification once shipped

- POV docs update within ~5s per turn (query `last_updated_at`).
- Token-cost regression < 30% over baseline (compare per-thread `cost_micros`).
- Senior CA reads 5 finished sessions, grades each agent's POV on accuracy + missing facts.
- Silence-on-resolution bug does not recur on 5 trial panels.
- No phantom-specialist deferrals across 20 spot-checked sessions.

## Rollout

- Always-on. Legacy rule-based POV path removed; the synthesizer is the only POV mechanism.
- Bull retries 3× with exponential backoff (5s base) per `roundtable-synthesizer` queue config.
- Synth failures captured to Sentry via `captureError` with `feature: 'roundtable-synthesizer'` context.
- Existing `cost_micros` accounting captures synthesizer spend through the standard provider call path.

## Out of scope / follow-ups

- Mastra migration of the roundtable workflow (separate plan).
- Chair-view POV doc + UI (v2).
- Vector recall over POV history (v2 if needed).
- Cross-thread POV carry-over for repeat panels (v2+).
- Self-hosted model migration (Phase 2-4 staged plan, separate doc).
