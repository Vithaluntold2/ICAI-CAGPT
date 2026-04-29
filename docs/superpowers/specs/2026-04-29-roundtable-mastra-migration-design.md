# Roundtable Mastra migration — design spec

Date: 2026-04-29
Owner: Mohammed
Status: Draft (awaiting user review)

## Context

The hand-rolled `server/services/roundtable/roundtableRuntime.ts` (~2k LOC) owns the boardroom roundtable's phase machine, agent loop, prompt assembly, tool dispatch, and streaming. It works, but the phase machine has a long history of subtle bugs: silence-on-resolution, infinite loops on the same answer, unawaited chair questions, ad-hoc pause flags, manual phase kickers. Mastra (TS-native agent + workflow framework, hit 1.0 January 2026) has a `Workflow` primitive with native `suspend()`/`resume()` that maps cleanly onto our chair-clicked phase transitions, and an `Agent` primitive that gives streaming + tool-use + memory hooks for free.

This spec covers migrating the roundtable runtime to Mastra. The migration is scoped to roundtable only — `aiOrchestrator.ts` and other chat modes (chat, voice, mermaid, whiteboard, Excel) are not touched.

## Goals

- Replace `roundtableRuntime.ts`'s phase machine and per-turn LLM call with Mastra primitives (`Workflow` + `Agent`).
- Preserve every existing guarantee: cost-tier provider fallback, abort/cancel, budget enforcement, side-thread scheduling, ask_panelist routing, simulated streaming, optimistic-locked synthesizer.
- Strangler migration: legacy and Mastra runtimes coexist. Existing panels continue on legacy forever; new panels go Mastra after a soak period.
- API surface unchanged: routes, UI, websocket events, response shapes — all identical to today. The runtime swap is invisible to the frontend.
- Synthesizer stays on `agentPovStore` (untouched). Its dispatch hooks into the Mastra workflow via `addSynthesizerJob`.

## Non-goals (v1)

- One-shot migration of existing `legacy` panels to Mastra. Existing panels stay legacy; cleanup is a future spec.
- Real streaming via Mastra's `agent.stream()`. We keep simulated word-level chunking.
- Mastra OTel observability. Existing Sentry + manual logs continue.
- Porting the synthesizer to Mastra Memory.
- Any change to other chat modes.
- Vercel AI SDK adoption. `aiProviders/` stays as the model layer.
- Mastra workflow versioning (handling deployed workflow definition changes while threads are suspended).

## Architecture

```
                                   ┌─────────────────────────────────────┐
                                   │  roundtable_panels                  │
                                   │    + runtime: 'legacy' | 'mastra'   │  (new col)
                                   └────────────────┬────────────────────┘
                                                    │
                          ┌─────────────────────────┴──────────────────────┐
                          │ runtime === 'legacy'        runtime === 'mastra'│
                          ▼                                                 ▼
                ┌─────────────────────┐                     ┌─────────────────────────────────┐
                │ roundtableRuntime.ts│                     │ MastraRoundtableRuntime         │
                │ (existing, frozen)  │                     │  - Mastra Workflow per thread   │
                └─────────────────────┘                     │  - 6 steps + suspend()/resume() │
                                                            │  - per-step: relevance loop     │
                                                            │  - per-turn: Mastra Agent       │
                                                            └─────────────┬───────────────────┘
                                                                          │
                                                  ┌───────────────────────┼─────────────────────┐
                                                  ▼                       ▼                     ▼
                                       Mastra Agent (LLM call)   Our scheduleRelevanceLoop  agentSynthesizer
                                       - tool emission           - propose-then-pick         (UNCHANGED)
                                       - configured w/             - abort/retry              + addSynthesizerJob
                                         our aiProviders/                                       after each turn
                                       - cost_micros captured
                                         via usage callback
```

### Five core decisions

1. **Strangler with panel-stamped runtime.** New column `roundtable_panels.runtime VARCHAR(16) NOT NULL DEFAULT 'legacy'`. Once the new runtime soaks, default flips to `'mastra'`. Existing panels retain `'legacy'` forever (or until a one-shot migration script is written, out of scope here).
2. **Hybrid agent layer.** Mastra owns the phase workflow + per-turn LLM call (`Agent.generate()`). Our existing relevance-loop selection + abort/retry/cost wraps around Mastra Agent calls. `aiProviders/` stays — Mastra Agent is configured with an OpenAI-compatible client that delegates to our registry.
3. **Synthesizer untouched.** The Mastra workflow's after-turn step calls `addSynthesizerJob`. `agentPovStore` + Bull queue + cache contracts unchanged. POV docs read at turn start exactly as today.
4. **Mastra storage = same Postgres.** Mastra workflow state and any internal Mastra tables live in the same DB as `roundtable_*`. New tables prefixed `mastra_*`. No separate DB.
5. **API surface unchanged.** All existing routes (`/api/roundtable/threads/:id/turn`, phase advance, side-thread, etc.) keep their shapes. The runtime swap is invisible to `BoardroomThread.tsx` / `PanelBuilder.tsx`.

### Why hybrid (not full Mastra)

Mastra's `agent.network()` does LLM-based routing only — there is no custom-selector hook and no documented "zero speakers / skip turn" outcome. Our relevance-loop pattern (every agent self-assesses via `proposeTurn`, a selector picks among opt-ins, and "nobody opts in → loop pauses") is not natively expressible in Mastra. Verified via Mastra docs (April 2026): https://mastra.ai/docs/agents/networks, https://mastra.ai/blog/agent-network. Wrapping our existing selection + orchestration around Mastra `Agent.generate()` for the per-turn LLM call gives us Mastra's value (workflow + agent abstractions) without losing the battle-tested edge-case behavior.

## Phase workflow and per-turn helper

One Mastra `Workflow` per thread. Six sequential steps map to the six phases (`opening`, `independent-views`, `cross-examination`, `user-qa`, `synthesis`, `resolution`). Each step has the same shape:

```ts
createStep({
  id: 'cross-examination',
  execute: async ({ context, suspend }) => {
    while (!phaseShouldEnd(context)) {
      const proposals = await runProposalRound(panelAgents);
      const speaker = pickSpeaker(proposals);
      if (!speaker) { emit('loop-idle'); break; }

      await runAgentTurnViaMastra(speaker, mastraAgents.get(speaker.id), context);

      if (hasPendingPhaseProposal(context)) {
        const decision = await suspend({
          awaitingChair: 'phase-proposal',
          proposal: { fromAgentId, toPhase, rationale },
        });
        if (decision.accepted) return;          // workflow advances to next step
        clearPendingProposal(context);          // rejected — phase continues
      }

      for (const a of panelAgents) addSynthesizerJob({ threadId, agentId: a.id, ... });
    }

    await suspend({ awaitingChair: 'manual-advance' });  // chair-clicked path
  },
});
```

The chair has two ways to advance the phase, both translating to `workflow.resume({ phase: next })`:

1. Agent-proposed: agent calls `propose_phase_transition` mid-turn → tool creates a chair-targeted Accept/Reject card → workflow suspends → chair clicks Accept → resume into next step.
2. Chair-clicked: chair clicks the phase stepper directly without waiting for a proposal → workflow suspends from `manual-advance` → resume.

**Chair-mid-loop semantics.** If the chair clicks advance while the workflow's inner relevance loop is mid-iteration (a turn is generating), the click is cooperative, not preemptive: the chair handler sets `context.pendingChairAdvance = true`; `phaseShouldEnd(context)` returns `true` on the next loop iteration; the in-flight turn completes normally; loop exits; step suspends; chair's same handler then calls `workflow.resume(runId, { phase: requested })`. This preserves the in-flight turn's content (it's not aborted) and matches today's behavior where `r.paused` is also checked between iterations.

This collapses the legacy code's ad-hoc `r.paused` boolean + complicated re-entry logic into Mastra's natural suspended state.

### Agent layer

Each panel agent gets a Mastra `Agent` instance built once at workflow start:

```ts
const mastraAgent = new Agent({
  name: agent.name,
  instructions: buildAgentSystemPrompt(agent, kbSnippets, allAgents, povCueCard),
  model: openAICompatibleAdapter(modelTier),     // wraps our aiProviders/
  tools: { ask_panelist, propose_phase_transition, cede_floor, start_side_thread },
});

const result = await mastraAgent.generate({
  messages: [{ role: 'user', content: phaseUserPrompt(phase, agent) }],
  signal: r.activeAbort.signal,
});
// result.usage → cost_micros via existing computeCostMicros
// result.toolCalls → already executed by Mastra; we observe outcomes
```

System prompt assembly is unchanged. The POV cue card from `agentPovStore.get(threadId, agentId)` is rendered into `instructions` exactly as today. Roster, KB snippets, base-knowledge gate — all reused.

### Tools

Each tool is a Mastra `Tool` whose `execute()` is a thin wrapper around our existing tool-resolver logic:

```ts
const askPanelistTool = createTool({
  id: 'ask_panelist',
  description: '…',
  inputSchema: z.object({ to_agent_name: z.string(), question: z.string() }),
  execute: async ({ context, input }) => {
    const card = await createOpenQuestionCard({
      threadId: context.threadId,
      fromAgentId: context.speakerId,
      toAgentName: input.to_agent_name,
      question: input.question,
    });
    return { cardId: card.id };
  },
});
```

Same pattern for `propose_phase_transition` (sets `context.pendingPhaseProposal`), `cede_floor` (marks turn as ceded), `start_side_thread` (queues a side-thread agent turn). Mastra's tool-use loop runs `execute()` synchronously, feeds the result back to the LLM, lets it produce a closing statement.

## Preserving existing guarantees

### Persistence

Mastra's PostgreSQL storage adapter points at the **same DB** as `roundtable_*`. Mastra creates tables (`mastra_workflow_runs`, `mastra_workflow_state`, etc.) alongside our schema. Source-of-truth split:

- **Domain state** (threads, turns, panels, question cards, POV docs) → existing `roundtable_*` and `agent_pov_documents` tables, unchanged.
- **Workflow state** (which step a thread is suspended on, suspend payload, run history) → Mastra-managed tables.

Correlation key is `roundtable_threads.id`. When chair advances phase, we look up the active workflow run by thread ID and call `workflow.resume(runId, { phase: next })`.

### Cost & provider fallback

`modelClient.ts` adapter implements Mastra's OpenAI-compatible model interface but internally calls `aiProviderRegistry`. Iterates `PROVIDER_ORDER` (Azure → OpenAI → Claude → Gemini), returns first success. Surfaces `usage` and the succeeding provider name. After each `agent.generate()`, `computeCostMicros(provider, tier, in, out)` writes to `roundtable_turns.cost_micros` exactly as today.

### Budget enforcement

`enforceBudgetOrThrow(conversationId)` is called before `agent.generate()`. On `BudgetExceededError`:

1. Emit `'budget-exhausted'` and `'loop-idle'` events.
2. `await suspend({ awaitingChair: 'budget-exhausted', spent, budget })`.
3. Chair tops up budget → resume; chair archives panel → workflow cancels.

### Streaming

Simulated streaming kept for v1. The Mastra runtime calls `agent.generate()` (non-streaming), then runs existing `chunkContentForStreaming` to emit `turn-token` events. UI behavior is identical. Real `agent.stream()` is a follow-up.

### Abort

`runAgentTurnViaMastra` accepts the `r.activeAbort.signal` from the per-thread runtime state and passes it as `agent.generate({ signal })`. Mastra forwards to the underlying client. Workflow-level cancellation calls `workflow.cancel(runId)` after aborting the active turn.

## Migration mechanics

### Schema change

```sql
ALTER TABLE roundtable_panels
  ADD COLUMN runtime VARCHAR(16) NOT NULL DEFAULT 'legacy';
CREATE INDEX roundtable_panels_runtime_idx ON roundtable_panels(runtime);
```

Default `'legacy'` so existing panels keep current behavior. New panel creation in `roundtablePanelService.createPanel` reads an env var to decide what to stamp.

### Feature flag

```
ROUNDTABLE_DEFAULT_RUNTIME=legacy   # | 'mastra'
```

Controls only the default for **new** panels. Does NOT retroactively migrate existing panels.

| Stage | env var | Effect |
|---|---|---|
| 1 (after merge) | `legacy` | New panels default to legacy. Test by manually setting `runtime: 'mastra'` via admin/DB. |
| 2 (after first soak) | `mastra` | New panels default to Mastra. Old panels keep legacy. |
| 3 (after final soak) | flag removed | Default hardcoded to Mastra. |
| 4 (cleanup) | — | Legacy code deleted; straggler `legacy` panels need a one-shot decision (out of scope). |

### Routing

```ts
// server/services/roundtable/runtimeDispatcher.ts
export async function getRuntimeForPanel(panelId: string): Promise<RoundtableRuntime> {
  const [panel] = await db.select({ runtime: roundtablePanels.runtime })
    .from(roundtablePanels).where(eq(roundtablePanels.id, panelId)).limit(1);
  if (!panel) throw new Error('panel not found');
  return panel.runtime === 'mastra' ? mastraRuntime : legacyRuntime;
}
```

Both runtimes implement the same `RoundtableRuntime` interface. Routes call `getRuntimeForPanel(panelId).setPhase(...)` etc. The dispatcher is the single seam.

## File structure

```
server/services/roundtable/
├── runtimeInterface.ts                   # NEW — interface RoundtableRuntime
├── runtimeDispatcher.ts                  # NEW — getRuntimeForPanel(panelId)
├── legacyRuntime.ts                      # NEW — wraps existing roundtableRuntime as a RoundtableRuntime impl
├── roundtableRuntime.ts                  # UNCHANGED (frozen)
├── agentPovStore.ts                      # UNCHANGED
├── agentSynthesizer.ts                   # UNCHANGED
├── synthesizerJob.ts                     # UNCHANGED
└── mastra/                               # NEW — entire Mastra runtime
    ├── runtime.ts                        # MastraRoundtableRuntime — public API
    ├── workflow.ts                       # createRoundtableWorkflow() — 6-step workflow
    ├── phaseSteps.ts                     # one step factory per phase
    ├── selection.ts                      # runProposalRound + pickSpeaker
    ├── agentBuilder.ts                   # buildMastraAgent(agentRow)
    ├── modelClient.ts                    # OpenAI-compatible adapter wrapping aiProviders/
    ├── persistence.ts                    # Mastra storage adapter config
    └── tools/
        ├── askPanelist.ts
        ├── proposePhaseTransition.ts
        ├── cedeFloor.ts
        └── startSideThread.ts
```

Each file ≤200 LOC, single responsibility.

## Testing strategy

### Unit tests (Vitest)

- `selection.ts` — `runProposalRound` returns typed proposals; `pickSpeaker` picks deterministically; returns `null` when no positives.
- `modelClient.ts` — adapter falls through `PROVIDER_ORDER` on first-provider failure, surfaces `usage` correctly.
- `agentBuilder.ts` — built agent has expected `instructions`, `tools` (4 registered), `model` (the adapter).
- Each tool's `execute()` — assert side effects (correct card type, `context.pendingPhaseProposal` set, etc.).
- Phase step factories — exit conditions, `suspend()` payload shapes.
- `runtimeDispatcher.ts` — routes correctly by `panel.runtime`.

### Integration tests (real Postgres, mocked LLM)

- 4-agent panel runs all six phases. Each phase produces ≥1 turn. Memo emitted at resolution.
- Phase proposal accepted: `propose_phase_transition` → suspend → simulated chair Accept → next phase.
- Phase proposal rejected: same path → Reject → re-enter current phase.
- Synthesizer dispatch: `addSynthesizerJob` called for all panel agents (speaker included) after each turn.
- Cost accounting: `cost_micros` > 0 per turn; aggregate matches mocked usage.
- Budget exhausted: pre-turn check → workflow suspends `'budget-exhausted'`.
- Abort: signal mid-turn → turn `'cancelled'`, workflow halts.

### Parity tests (legacy vs Mastra, mocked LLM)

- Same scripted inputs produce same number of turns per phase.
- Both produce 7-section memo at resolution.
- Both handle phase-proposal Accept/Reject cycle.
- Cost-micros within ±5%.

### Manual E2E

- Mohammed + Sai run the corporate-demerger scenario with real LLM. Assert no regressions in: silence-on-resolution, phantom-specialists, infinite loops, unawaited chair questions.

## Failure modes

| Failure | Behavior |
|---|---|
| Mastra workflow crashes mid-step | Run marked failed. Thread state in `roundtable_*` intact. Recovery via `/api/roundtable/threads/:id/recover` (creates fresh workflow run, hydrates from current thread state). |
| `agent.generate()` exhausts all providers | Throws after fallback chain. Turn marked `'failed'`. Loop continues; relevance loop will pick another speaker or idle. |
| Suspend/resume payload corruption | Mastra throws on resume. Workflow marked failed. Chair gets toast; manual recovery path. |
| Tool `execute()` throws | Mastra returns the error in tool-result; agent likely produces "I couldn't do that" turn. Tool resolvers are idempotent. |
| `runtime` column migration fails | Migration is additive + idempotent. Re-run safe. |
| Mastra storage adapter init fails at boot | Server fails startup loudly (Sentry). |
| Race: chair phase-click vs agent's `propose_phase_transition` | Workflow exit condition checked atomically; whichever wins commits. Worst case: chair manual click wins, agent's proposal becomes moot; UI shows it as superseded. |

## Verification once shipped

- 4-agent test panel runs full 6 phases on Mastra runtime; final memo correct.
- Phase-proposal Accept/Reject produces correct workflow resume.
- `cost_micros` parity within 5% vs legacy across 10 trial panels.
- No new errors in Sentry tagged `roundtable-mastra` for first 100 panels.
- `runtime: 'legacy'` panels continue working unchanged (zero regressions).

## Open questions / follow-ups (out of scope here)

- One-shot migration of existing legacy panels to Mastra (separate spec when needed).
- Adopting Mastra's real `agent.stream()` (deferred follow-up).
- Mastra OTel observability wiring.
- Mastra workflow versioning strategy.
- Synthesizer rewrite on Mastra Memory (decided against — see synthesizer spec).
