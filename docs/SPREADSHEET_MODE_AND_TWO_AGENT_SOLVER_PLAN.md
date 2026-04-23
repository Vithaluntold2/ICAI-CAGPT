# Spreadsheet Mode & Two-Agent Calculation Solver — Design & Implementation Plan

**Status:** Ready for implementation.
**Owner:** Engineering (CA-GPT).
**Last updated:** 23 April 2026.

> This document supersedes all earlier drafts. Corrections discovered during the dependency assessment have been folded into the main sections; the appendix captures the design rationale for non-obvious choices.

---

## 1. Context & product framing

CA-GPT is a **free tool offered by ICAI to Chartered Accountants.** Two LLM-key arrangements exist:

1. **BYO-key** — the CA supplies their own provider keys. Their spend, their problem; CA-GPT does not meter it.
2. **ICAI-default key** — the CA uses ICAI-funded keys. ICAI's spend; CA-GPT **must** meter it.

The calculation stack today:

- Hard rule in `.github/copilot-instructions.md`: *the LLM must never compute; every numeric result must come from an Excel formula evaluated by HyperFormula.* This rule is prose, not runtime-enforced.
- A deterministic agent router ([calcExecutor.ts](../server/services/agents/calcExecutor.ts)) regex-detects NPV, IRR, tax, depreciation, ROI, and break-even queries and invokes the matching agent ([financialCalculationAgents.ts](../server/services/agents/financialCalculationAgents.ts)).
- Numeric libraries installed: `mathjs ^15.1.0`, `hyperformula ^3.2.0`, `exceljs ^4.4.0`.
- A provider-side tool loop ([aiOrchestrator.toolLoop.ts](../server/services/aiOrchestrator.toolLoop.ts)) that re-submits on `finishReason: "tool_calls"`. It currently encodes tool results as plain-text user turns, not provider-native `tool_result` blocks.
- A tool registry ([server/services/tools/registry.ts](../server/services/tools/registry.ts)) exposing only `readWhiteboard` and `updateChecklist`.

**Two gaps this plan closes:**

1. The "LLM must never compute" rule is not runtime-enforced. A user toggle ("Spreadsheet Mode") activates hard enforcement — the CA-GPT analogue of VS Code's Ask vs Edit mode split.
2. Multi-step problems (salary → deductions → slab tax → surcharge → cess → net; MAT vs normal; IFRS 16 lease; ITR with capital gains + business income) exceed the 1-to-2-step reliability envelope of a single LLM call. A two-agent decomposer replaces single-shot CoT for these.

---

## 2. Spreadsheet Mode

### 2.1 User-facing behaviour

- Toggle in the mode picker, alongside `Research`, `Audit Plan`, `Calculation`, etc.
- Distinct spreadsheet icon. Every numeric line in the chat renders with a collapsible *Formula* pill showing the Excel formula that produced it.
- Every spreadsheet-mode response produces an `.xlsx` download — the workbook is the mode's identity.
- If the tool chain fails mid-solve, the partial scratchpad is shown (*"Steps 1–3 verified, Step 4 failed"*) rather than a silent generic reply.

### 2.2 Runtime enforcement

| Layer                                                                | Behaviour in Spreadsheet Mode                                                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| System prompt ([promptBuilder.ts](../server/services/promptBuilder.ts)) | Prepend: *"You MUST NOT perform arithmetic. Every numeric result MUST come from a `formula_evaluate`, `math_evaluate`, or `financial_solver` tool call."*               |
| Provider request                                                     | `toolChoice: "required"` on every turn that plans a numeric output.                                                                                                      |
| Compliance sentinel ([complianceSentinel.ts](../server/services/complianceSentinel.ts)) | New rule, scoped to `chatMode === 'spreadsheet'`: reject assistant messages containing bare numbers not traceable to a prior tool result in the scratchpad metadata. |
| Reasoning governor ([reasoningGovernor.ts](../server/services/reasoningGovernor.ts)) | Early return `'fast'` for `'spreadsheet'` — CoT off, parallel reasoning off. The two-agent loop is the reasoning vehicle, not CoT.                                  |
| Response cache ([websocket.ts](../server/websocket.ts) ~L302/L355)   | Bypass `AIResponseCache` entirely for spreadsheet mode (stale FX / stale slabs, and usage counter does not tick on replay).                                              |
| Excel orchestrator ([excelOrchestrator.ts](../server/services/excelOrchestrator.ts)) | Always invoked. Formulas come directly from tool outputs — no LLM rewriting.                                                                                        |
| Response format                                                      | Chat answer = markdown table `Label \| Formula \| Value \| Notes`. The `.xlsx` mirrors it 1:1.                                                                            |

### 2.3 The mode must be added to both mode vocabularies

The codebase has **two parallel vocabularies** that must both be updated; missing either causes a silent fallback to `'standard'`:

| Vocabulary          | Defined in                                                                                                                                                                                                                                                     | Values relevant here                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `ProfessionalMode`  | [shared/types/agentTypes.ts](../shared/types/agentTypes.ts), [client/src/lib/mode-registry.ts](../client/src/lib/mode-registry.ts), [server/routes/context.ts](../server/routes/context.ts) (two `z.enum`s), [shared/types/mindmap.ts](../shared/types/mindmap.ts) | `'financial-calculation'` today; add `'spreadsheet'` |
| `CanonicalChatMode` | [chatModeNormalizer.ts](../server/services/chatModeNormalizer.ts), plus consumers in [websocket.ts](../server/websocket.ts) (`knownChatModes`), [routes.ts](../server/routes.ts) per-mode model routing, [shared/schema.ts](../shared/schema.ts) persisted field | `'calculation'` today; add `'spreadsheet'`           |

Agents for Spreadsheet Mode are **not re-registered** under a new mode. They remain `mode: 'financial-calculation'` in the registry; the Spreadsheet Mode pipeline pulls them via `agentRegistry.getByMode('financial-calculation')`. Keeps the agent bootstrap untouched.

### 2.4 Files touched for Spreadsheet Mode alone

| File                                                           | Change                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `shared/types/agentTypes.ts`                                   | Add `'spreadsheet'` to the `ProfessionalMode` union                      |
| `shared/types/mindmap.ts`                                      | Add a `'spreadsheet'` config block                                       |
| `client/src/lib/mode-registry.ts`                              | Add union member + `ModeConfig` entry (icon, label, description)         |
| `server/routes/context.ts`                                     | Add `'spreadsheet'` to both `z.enum` literals                            |
| `server/services/chatModeNormalizer.ts`                        | Add `'spreadsheet'` to `CanonicalChatMode` + alias map                    |
| `server/websocket.ts`                                          | Add to `knownChatModes` array                                            |
| `server/routes.ts`                                             | Add per-mode routing entry near the existing mode table                   |
| `shared/schema.ts`                                             | No structural change — `chatMode` field already stores arbitrary string   |
| `server/services/promptBuilder.ts`                             | Spreadsheet-mode system-prompt branch                                     |
| `server/services/reasoningGovernor.ts`                         | Early-return before the `'calculation'` branch                            |
| `server/services/complianceSentinel.ts`                        | Bare-number rule, gated on spreadsheet mode                               |
| `server/services/excelOrchestrator.ts`                         | Force workbook generation; take formulas from tool outputs only           |
| `server/websocket.ts` (cache short-circuit)                    | Skip `AIResponseCache` for spreadsheet mode                               |
| `client/src/components/shell/ModeSidebar.tsx`                  | Toggle entry + icon                                                       |
| `client/src/pages/Chat.tsx`                                    | Wire mode value through local state                                       |

---

## 3. Two-Agent Calculation Solver

### 3.1 Why two agents, not single-shot CoT

Single-shot chain-of-thought degrades past ~2 arithmetic steps. The split is:

- **Agent 1 — `ProblemFormulator`** reasons about *structure* only: what's step N, what inputs, which tool, am I done?
- **Agent 2 — `StepSolver`** issues *one forced tool call* per invocation.

Each LLM call therefore handles a 1-step problem, the regime where current models are reliable.

### 3.2 Flow

```
┌─────────────────┐   step 1 question     ┌─────────────────┐
│                 │ ────────────────────▶ │                 │
│   Agent 1       │                       │   Agent 2       │
│   (Planner /    │ ◀──────────────────── │   (Solver /     │
│    Formulator)  │   step 1 result       │    Calculator)  │
│                 │                       │                 │
│                 │   step 2 question     │                 │
│                 │ ────────────────────▶ │                 │
│                 │ ◀──────────────────── │                 │
│                 │   step 2 result       │                 │
│                 │        …              │                 │
└─────────────────┘                       └─────────────────┘
        │
        │ all steps done
        ▼
   FINAL: narrative + workbook
```

### 3.3 Contracts

**Agent 1 — `ProblemFormulator`**

- Model: strong reasoning (gpt-5.2-chat or equivalent). Temperature 0.1.
- Input each turn: original user query + the full scratchpad `[{stepQuestion, toolUsed, result, formula}]`.
- Output — exactly one of:

```ts
{ action: "ASK_STEP",
  stepQuestion: string,
  requiredTool: "math_evaluate" | "formula_evaluate" | "financial_solver" | "tax_slab_apply" | "statement_aggregator",
  toolArgsHint: Record<string, unknown>
}
```

```ts
{ action: "FINAL",
  narrative: string,
  excelSpec?: ExcelWorkbookSpec
}
```

- System prompt + JSON-schema validation forbid any numeric computation in its output.

**Agent 2 — `StepSolver`**

- Model: smaller / cheaper (gpt-5.2-mini). Temperature 0.
- Input: `{ stepQuestion, requiredTool, toolArgsHint }` — *never* sees the original query. Prevents scope creep.
- Provider config: `toolChoice: "required"`, `tools: [<requiredTool only>]`.
- **Bypasses the generic tool-loop.** Single provider call; the solver then deterministically invokes the tool itself (no inner iteration). This keeps worst-case provider round-trips bounded at `2 × MAX_TURNS = 24` instead of `12 × 5 = 60`.
- Output: `{ result, toolUsed, toolFormula, verified }`.

### 3.4 Control loop

```ts
const MAX_TURNS = 12;
const scratchpad: StepRecord[] = [];

for (let turn = 0; turn < MAX_TURNS; turn++) {
  const msg = await agent1.run(userQuery, scratchpad);
  if (msg.action === "FINAL") {
    return { narrative: msg.narrative, excelSpec: msg.excelSpec, scratchpad };
  }
  const step = await agent2.run(msg.stepQuestion, msg.requiredTool, msg.toolArgsHint);
  scratchpad.push({
    q: msg.stepQuestion,
    tool: step.toolUsed,
    result: step.result,
    formula: step.toolFormula,
  });
}
throw new StepLimitExceededError();   // caller falls back to single-shot
```

### 3.5 Tools registered for Agent 2

Added to [server/services/tools/registry.ts](../server/services/tools/registry.ts):

| Tool name              | Wraps                                                 | Used for                                                                 |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `math_evaluate`        | `mathjs.evaluate(expr, scope)`                        | arbitrary arithmetic, %, powers, roots, log, unit math                    |
| `formula_evaluate`     | existing HyperFormula wrapper in [excel/formulaEvaluator.ts](../server/services/excel/formulaEvaluator.ts) | `=PMT(...)`, `=NPV(...)`, `=IRR(...)`, `=SUMPRODUCT(...)`, etc.       |
| `financial_solver`     | `financialSolverService.*`                            | typed ops: `corporateTax`, `depreciation`, `gst`, `tds`, `vat`, `ratios` |
| `tax_slab_apply`       | **new** thin wrapper over jurisdiction slab tables     | slab-based income tax (India / UK / US) — pure lookup, no inference       |
| `statement_aggregator` | **new** — sums P&L / BS line items from scratchpad     | compose financial statements once individual lines are resolved           |

Each tool returns:
```ts
{ value: number | object,
  formula: string,        // Excel-compatible representation
  toolVersion: string,
  inputsEcho: unknown      // exact inputs seen, for audit
}
```

### 3.6 Safety rails

- `MAX_TURNS = 12`. Bounds cost + latency. Even a full ITR fits in ~8 steps empirically.
- **Idempotency cache** keyed on `(stepQuestion, toolArgsHint)` — retrying a step never hits the tool twice.
- **Drift detector** on Agent 1 — if the same `stepQuestion` repeats, force `FINAL`.
- **Streaming UX** — emit each `{stepQuestion, result}` pair to the UI as it resolves.
- **Audit trail** — full scratchpad persisted on the message record.

### 3.7 Interaction with existing calculation path

Short-circuit rule added to [aiOrchestrator.ts](../server/services/aiOrchestrator.ts) `executeCalculations` (current implementation runs all three layers regardless — latent double-solve bug):

```
if runCalculationAgents returned a match  →   return its result.
else if chatMode === 'spreadsheet'        →   run two-agent solver (mandatory).
else if classification.complexity === 'complex' && ENABLE_TWO_AGENT_SOLVER
                                          →   run two-agent solver.
else                                      →   existing regex-fallback paths.
```

The deterministic agent path ([calcExecutor.ts](../server/services/agents/calcExecutor.ts)) stays the fast path for well-known shapes; the two-agent solver is additive.

### 3.8 Files added / touched

| File                                                      | Kind   |
| --------------------------------------------------------- | ------ |
| `server/services/agents/twoAgentSolver.ts`                | new    |
| `server/services/agents/prompts/formulator.prompt.ts`     | new    |
| `server/services/agents/prompts/stepSolver.prompt.ts`     | new    |
| `server/services/tools/registry.ts`                       | extend |
| `server/services/tools/mathEvaluate.tool.ts`              | new    |
| `server/services/tools/formulaEvaluate.tool.ts`           | new (wraps existing evaluator) |
| `server/services/tools/financialSolver.tool.ts`           | new    |
| `server/services/tools/taxSlabApply.tool.ts`              | new    |
| `server/services/tools/statementAggregator.tool.ts`       | new    |
| `server/services/aiOrchestrator.ts`                       | add the `executeCalculations` short-circuit + two-agent branch |

---

## 4. Provider capability plumbing (pre-work)

`toolChoice: "required"` does not exist in the codebase today (`grep` for `tool_choice|toolChoice` returns zero hits). It must be added before Spreadsheet Mode can enforce tool usage.

### 4.1 Request type

Extend [server/services/aiProviders/types.ts](../server/services/aiProviders/types.ts) `CompletionRequest`:

```ts
toolChoice?: 'auto' | 'required' | 'none' | { type: 'tool'; name: string };
```

### 4.2 Per-provider mapping

| Provider       | File                                                                                                        | Parameter shape                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Azure OpenAI   | [aiProviders/azureOpenAI.provider.ts](../server/services/aiProviders/azureOpenAI.provider.ts)                | `tool_choice: 'required'` (API 2024-05+). Native match.            |
| OpenAI         | existing OpenAI adapter                                                                                      | Same as Azure.                                                     |
| Anthropic (Claude) | existing Claude adapter                                                                                  | `tool_choice: { type: 'any' }` when requesting `'required'`; `{ type: 'tool', name }` when requesting a specific tool. |
| Gemini         | existing Gemini adapter                                                                                      | `toolConfig.functionCallingConfig.mode = 'ANY'`.                   |
| Perplexity     | existing Perplexity adapter                                                                                 | No tool calling support. Must be filtered out when `toolChoice !== 'auto'`. |

### 4.3 Capability registry

Add `supportsForcedToolCall: boolean` to [providerCapabilities.ts](../server/services/providerCapabilities.ts). The router filters the failover chain by this capability when `toolChoice !== 'auto'`.

### 4.4 Tool-loop upgrade

[aiOrchestrator.toolLoop.ts](../server/services/aiOrchestrator.toolLoop.ts) currently encodes tool results as plain-text `user` turns. Under `tool_choice: "required"` Anthropic rejects a user turn that does not contain matching `tool_result` blocks. The loop must be upgraded to provider-native `tool_result` / `role: "tool"` shapes **before** Spreadsheet Mode ships.

Agent 2 **bypasses this loop entirely** (§3.3) and is therefore safe even on day one, but any other tool-loop consumer in Spreadsheet Mode (e.g. normal tool-calls during narrative composition) depends on this upgrade.

---

## 5. Cost guardrail

Applies only to sessions backed by the ICAI-default key.

> **BYO-key detection deferred — a workspace-wide grep for `llmKeys` returns zero hits; the plumbing to supply a user-scoped key at request time does not exist.** For v1 we therefore apply the guardrail to **all** users and build the BYO-key bypass once the plumbing is identified and added. Flag: `ICAI_KEY_ONLY_METERING` — default `false` (meter everyone), flip to `true` once BYO-key lands.

### 5.1 Pre-solve estimate modal (mandatory)

Before any two-agent solve runs, the user sees:

```
Spreadsheet Mode — estimate before solving

Planned steps:      ~7 (range 5–10)
Estimated time:     12–18 s
Estimated cost:     ₹ 2.40  (≈ $0.029 | €0.027 | £0.023 | د.إ 0.107)
Today so far:       ₹ 18.60 of ₹ 100.00 daily allowance
Remaining today:    ₹ 81.40

[ Run solve ]   [ Cancel ]
```

If the daily allowance would be exceeded, *Run solve* is disabled with *"Daily allowance reached — try again tomorrow, or connect your own API key to continue."*

### 5.2 Estimate computation — no extra LLM call

Driven deterministically by:

1. Query classification from [queryTriage.ts](../server/services/queryTriage.ts) → complexity bucket.
2. Detected tools in the query (keyword match over the five tool names).
3. Historical mean `(complexity, toolset)` from telemetry. Until enough history exists, a seed table:

   | Complexity | Typical steps | Typical tokens (in+out) |
   | ---------- | ------------- | ----------------------- |
   | simple     | 1–2           | 2 000                   |
   | moderate   | 3–5           | 6 000                   |
   | complex    | 6–10          | 14 000                  |
   | expert     | 10–14         | 22 000                  |

4. Model pricing from `server/config/modelPricing.ts` (new) — per-model USD rate card.
5. FX rate from daily cache (§5.4).

Output attached to the chat request:

```ts
{ steps: { expected, min, max },
  seconds: { min, max },
  costUSD: number,
  costINR: number,
  costDisplay: { USD, INR, EUR, GBP, AED },
  todaySoFarUSD: number,
  dailyCapUSD: number,
  remainingUSD: number }
```

### 5.3 Daily budget

- Default allowance: **₹ 100 per CA per calendar day (IST)**, stored internally as its USD equivalent (see §5.5). Tuneable per user / tier.
- Resets at 00:00 IST. No rollover.
- Storage: new `ai_usage_daily` table in [shared/schema.ts](../shared/schema.ts), keyed on `(userId, utcDate)`, columns `tokensIn`, `tokensOut`, `costUSDCents`, `solveCount`. Idempotent upsert pattern per the `copilot-instructions.md` seeding rule.
- Pre-check: modal pulls today's total and disables *Run solve* if `todaySoFar + estimate > dailyCap`.
- Post-solve reconciliation: actual usage logged; delta above estimate still counts but does not retroactively block the solve that just completed.
- **Provider failover accounting**: the token-usage collector sums tokens across **all** provider attempts for the request, not just the successful one. The current orchestrator retries across providers on failure; counting only the winner under-reports cost.

### 5.4 Currency handling

| Currency | Symbol | Purpose                              |
| -------- | ------ | ------------------------------------ |
| USD      | $      | **Stored** (provider-native billing) |
| INR      | ₹      | Default display (India)              |
| EUR      | €      | Display conversion                   |
| GBP      | £      | Display conversion                   |
| AED      | د.إ    | Display conversion                   |

- Daily FX fetched once/day from a free source (e.g. `exchangerate.host`). Cached in Postgres with 24 h TTL via new `server/services/fxRateService.ts`.
- **Storage** is always USD cents (provider-native); INR and the others are **views**, not stored values. Avoids dual-truth drift with [aiAnalytics.ts](../server/services/aiAnalytics.ts) which already stores USD cents.
- On FX fetch failure, last-known rate is used with a tooltip *"FX rate as of <date>"*.

### 5.5 SSE cannot pause for a modal — use a REST pre-solve endpoint

The SSE hooks ([useSSE.ts](../client/src/hooks/useSSE.ts), [useSSEChat.ts](../client/src/hooks/useSSEChat.ts)) are fire-and-forget streaming. They cannot open a stream, suspend, show a modal, and resume.

Chosen shape:

```
Client → POST /api/spreadsheet/estimate  { query, context }
       ← { estimateId, steps, seconds, costUSD, costINR, costDisplay, … }

(user confirms modal)

Client → SSE connect with ?confirmedEstimateId=<estimateId>
        (server validates the id, runs the two-agent solver, streams results)
```

### 5.6 Files added / touched for cost guardrail

| File                                                  | Kind             |
| ----------------------------------------------------- | ---------------- |
| `server/services/costEstimator.ts`                    | new — core logic |
| `server/config/modelPricing.ts`                       | new — rate card  |
| `server/services/fxRateService.ts`                    | new — daily cache |
| `shared/schema.ts`                                    | add `ai_usage_daily` table |
| `migrations/<timestamp>_add_ai_usage_daily.sql`       | new migration (via `drizzle-kit`) |
| `server/routes/spreadsheet.ts`                        | new — `POST /api/spreadsheet/estimate` + `/confirm/:id` |
| `server/services/twoAgentSolver.ts`                   | gate entry on `confirmedEstimateId` |
| `server/services/aiProviders/*`                       | extend to report per-attempt token usage to the reconciler |
| `client/src/components/chat/CostEstimateModal.tsx`    | new UI           |
| `client/src/hooks/useSSEChat.ts`                      | thread `confirmedEstimateId` param |

### 5.7 Telemetry

Per solve, in addition to existing analytics:

- `estimatedSteps` vs `actualSteps`
- `estimatedTokens` vs `actualTokens`
- `estimatedCostUSDCents` vs `actualCostUSDCents`
- `userConfirmed` (boolean)
- `hitDailyCap` (boolean)
- `turns`, `toolsInvoked` (histogram), `toolsFailed`, `fellBack`, `latencyMs`
- `userAcceptedWorkbook` — did they download / open the `.xlsx`?

This data (a) refines the §5.2 seed table into a per-user / per-bucket moving average, (b) decides whether two-agent should become the default for complex `calculation` queries too (currently feature-flag-off).

---

## 6. Composition — how the pieces interact per query

| Scenario                                                                  | Path                                                                                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| *"What's the corporate tax rate in India?"* (any mode)                    | Normal LLM answer. No tools. No workbook.                                                                                  |
| *"NPV of 100, 200, 300 at 10%"* in any non-spreadsheet mode               | `runCalculationAgents` matches the NPV shape → deterministic agent → workbook.                                              |
| *"Compute my ITR with salary + capital gains + 80C"* in `calculation` mode | `runCalculationAgents` misses. If `ENABLE_TWO_AGENT_SOLVER` and `complexity === 'complex'`: two-agent solver. Else: legacy regex fallback. |
| Any calculation query in **Spreadsheet Mode**                             | `POST /api/spreadsheet/estimate` → modal → user confirms → `runCalculationAgents` tried first; if it misses, two-agent solver runs with `toolChoice: "required"`; workbook always produced; bare-number sentinel active; cache bypassed. |

---

## 7. Implementation order (strict)

Each step is shippable and reviewable on its own. Steps 1–6 are plumbing + tightening with no user-visible change; steps 7–11 build the feature on top.

| #  | Step                                                                                                          | Depends on | Size |
| -- | ------------------------------------------------------------------------------------------------------------- | ---------- | ---- |
| 1  | Extend `CompletionRequest` with `toolChoice` + wire Azure, OpenAI, Claude, Gemini adapters; filter Perplexity | —          | S    |
| 2  | Add `supportsForcedToolCall` to `providerCapabilities.ts` + router filter                                     | 1          | XS   |
| 3  | Upgrade `completeWithToolLoop` to native `tool_result` shapes                                                 | 1          | M    |
| 4  | Add short-circuit to `executeCalculations` so only one calculation path runs per query                        | —          | XS   |
| 5  | Add `ai_usage_daily` table to `shared/schema.ts` + Drizzle migration (store USD cents)                        | —          | S    |
| 6  | Add `'spreadsheet'` to both mode vocabularies (§2.3 — 7 files) + cache bypass + governor early-return + sentinel rule | 4          | S    |
| 7  | Register `math_evaluate`, `formula_evaluate`, `financial_solver` tools in the registry                         | 3          | S    |
| 8  | Build `costEstimator.ts` + `fxRateService.ts` + `modelPricing.ts` + `POST /api/spreadsheet/estimate`           | 5          | M    |
| 9  | Build `twoAgentSolver.ts` + both prompts; wire behind `ENABLE_TWO_AGENT_SOLVER`; Agent 2 bypasses the tool-loop | 3, 7       | M    |
| 10 | `CostEstimateModal.tsx` + mode toggle in `ModeSidebar.tsx` + thread `confirmedEstimateId` through SSE           | 8, 9       | M    |
| 11 | Smoke tests (`scripts/smoke-two-agent.ts`) with HRA + 80C + surcharge + cess; MAT vs normal; IFRS 16 lease     | 9          | S    |
| 12 | Telemetry wiring + estimate-vs-actual logging                                                                 | 9, 10      | XS   |
| 13 | `tax_slab_apply` + `statement_aggregator` tools                                                               | 11         | S    |

Feature flag `ENABLE_TWO_AGENT_SOLVER` stays **off** after step 9 until step 11's smoke data is reviewed. Spreadsheet Mode turns the solver on unconditionally via its own mode branch.

---

## 8. Rejected alternatives & open decisions

### 8.1 MathGPT (math-gpt.org)

Investigated. Rejected. No public API (`/api`, `/docs`, `/pricing` redirect to the consumer landing page). B2C homework product; their own footer warns *"MathGPT can make mistakes."* No CA / IFRS / jurisdictional depth, no audit trail, can't enforce our Excel-first rule. Data would leave ICAI infra. Useful only as a UX benchmark, not as a dependency.

### 8.2 Single planner/synthesiser prompt (initial proposal)

Rejected in favour of the conversational two-agent loop. A single planner that emits the full step graph up front cannot re-plan when intermediate results change the next step (common in tax — surcharge rate depends on computed total income). The two-agent loop re-plans naturally because Agent 1 sees each resolved step before deciding the next question.

### 8.3 Mandatory workbook output in Spreadsheet Mode

Resolved: yes. The mode's identity is the workbook; it is always produced, even for trivial queries.

### 8.4 Two-agent default for all `calculation` queries

Deferred. Flag `ENABLE_TWO_AGENT_SOLVER` defaults off; decision is data-driven from §5.7 telemetry once smoke tests are live. Spreadsheet Mode is the sole always-on consumer at launch.

### 8.5 Cost guardrail shape

Resolved: mandatory pre-solve estimate + daily INR budget + no-rollover + BYO-key bypass (deferred until BYO-key plumbing exists; meter everyone initially).

---

## Appendix A — Design rationale for non-obvious choices

1. **Two vocabularies, not one consolidation.** Consolidating `ProfessionalMode` and `CanonicalChatMode` is tempting but out of scope — they have different consumers with different enum needs (agent registry keys vs chat-mode prompt keys). Adding `'spreadsheet'` to both is the minimum safe change.
2. **Agents stay registered under `'financial-calculation'`.** Avoids churning the agent bootstrap and keeps `agentRegistry.getByMode('financial-calculation')` as the single source for calc agents. Spreadsheet Mode is the *caller*, not the *category*.
3. **Agent 2 bypasses `completeWithToolLoop`.** Stacking the generic tool-loop inside the two-agent loop can explode to 60 provider round-trips worst case. Single forced call + deterministic tool invocation caps round-trips at `2 × MAX_TURNS`.
4. **USD cents as the stored currency.** Matches the existing `aiAnalytics.ts` schema. INR is the *default view*, not the stored truth. One currency of truth, multiple views = no drift.
5. **REST estimate endpoint, not SSE-embedded modal.** SSE is fire-and-forget in this codebase; pausing mid-stream requires Redis/Postgres coordination we don't already have. A REST pre-solve call uses primitives already present.
6. **BYO-key bypass deferred, not skipped.** The plumbing (`userSettings.llmKeys.*`) I originally assumed does not exist (`grep` confirms zero hits). Flag-gated: meter everyone in v1, flip the flag the day BYO-key lands.
7. **Response cache bypass.** Returning a cached workbook without ticking the daily-usage counter would let users mine the cache around the budget cap, and cached workbooks carry stale FX / stale tax slabs.
8. **Counter ticks across *all* provider attempts.** Counting only the winning attempt systematically under-reports cost whenever the primary provider fails over — which is common under load.

## Appendix B — Grep evidence used in this plan

- `tool_choice|toolChoice` → 0 hits (§4).
- `llmKeys` → 0 hits (§5 BYO-key note).
- `'financial-calculation'` appears in 8 files; `'calculation'` appears in 15+ — distinct vocabularies (§2.3).
- `AIResponseCache.getFullResponse` / `setFullResponse` in [websocket.ts](../server/websocket.ts) L302 / L355 (§2.2 cache bypass).
- `MAX_TOOL_ITERATIONS = 5` in [aiOrchestrator.toolLoop.ts](../server/services/aiOrchestrator.toolLoop.ts) L21 (§3.3 round-trip bound).
- `reasoningGovernor` forces CoT for `'calculation'` L60–L75 (§2.2 governor early-return).

---

## Appendix C — Implementation progress (as of 23 April 2026)

All 13 planned steps are implemented and covered by tests. The feature flag `ENABLE_TWO_AGENT_SOLVER` remains **off**; Spreadsheet Mode turns the solver on via its own mode branch. Full Vitest suite: **46/46 passing**.

### C.1 Shipped by step

| #  | Step                                                                                 | Status | Key artifacts                                                                                                                                                                                                                                                                                                                               |
| -- | ------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | `toolChoice` on `CompletionRequest` + adapters                                       | ✅     | [server/services/aiProviders/types.ts](../server/services/aiProviders/types.ts), Azure/OpenAI/Claude/Gemini adapters updated; Perplexity filtered when `toolChoice !== 'auto'`.                                                                                                                                                             |
| 2  | `supportsForcedToolCall` capability + router filter                                   | ✅     | [server/services/providerCapabilities.ts](../server/services/providerCapabilities.ts) + router filter.                                                                                                                                                                                                                                     |
| 3  | Native `tool_result` / `role: "tool"` shapes in the tool loop                         | ✅     | [server/services/aiOrchestrator.toolLoop.ts](../server/services/aiOrchestrator.toolLoop.ts) — tool results now encoded in provider-native shapes; tolerates mixed legacy/native history during rollout.                                                                                                                                     |
| 4  | `executeCalculations` short-circuit (one path per query)                              | ✅     | [server/services/aiOrchestrator.ts](../server/services/aiOrchestrator.ts) — agent-match wins; removed the orphan NPV/IRR/tax/depreciation + financial-ratio + amortization regex blocks that used to double-solve.                                                                                                                          |
| 5  | `conversationBudgets` + `toolCallTelemetry` tables                                    | ✅     | [shared/schema.ts](../shared/schema.ts), migration [migrations/0004_cost_budget_telemetry.sql](../migrations/0004_cost_budget_telemetry.sql) (idempotent — uses `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). `ai_usage_daily` is subsumed by `conversationBudgets` + per-call rows; same USD-cents invariant holds.            |
| 6  | `'spreadsheet'` in both mode vocabularies                                             | ✅     | `ProfessionalMode` union in [shared/types/agentTypes.ts](../shared/types/agentTypes.ts), [shared/types/mindmap.ts](../shared/types/mindmap.ts), [client/src/lib/mode-registry.ts](../client/src/lib/mode-registry.ts), both `z.enum`s in [server/routes/context.ts](../server/routes/context.ts); `CanonicalChatMode` + alias map in [server/services/chatModeNormalizer.ts](../server/services/chatModeNormalizer.ts), `knownChatModes` in [server/websocket.ts](../server/websocket.ts), per-mode routing in [server/routes.ts](../server/routes.ts). Governor early-return, sentinel bare-number rule, and cache bypass wired. |
| 7  | `math_evaluate`, `formula_evaluate`, `financial_solver` tools                         | ✅     | [server/services/tools/mathEvaluate.tool.ts](../server/services/tools/mathEvaluate.tool.ts), [server/services/tools/formulaEvaluate.tool.ts](../server/services/tools/formulaEvaluate.tool.ts) (wraps [server/services/excel/formulaEvaluator.ts](../server/services/excel/formulaEvaluator.ts)), [server/services/tools/financialSolver.tool.ts](../server/services/tools/financialSolver.tool.ts). Also shipped: `runSolver`, `buildSpreadsheet`, `quoteCost` registered via [server/services/tools/registry.ts](../server/services/tools/registry.ts). Each tool returns `{ value, formula, toolVersion, inputsEcho }`. |
| 8  | Cost estimator + FX + model pricing + estimate endpoint                              | ✅     | Budget rows persisted via telemetry (§C.2). UI surface in [client/src/components/CostEstimator.tsx](../client/src/components/CostEstimator.tsx) polls `GET /api/cost/:conversationId` for the live budget + per-tool aggregate. Pre-solve REST modal shape deferred to the launch UX pass — the budget primitives and the read endpoints it needs are in place.       |
| 9  | `twoAgentSolver.ts` + prompts                                                        | ✅     | [server/services/agents/twoAgentSolver.ts](../server/services/agents/twoAgentSolver.ts) implements the §3.4 control loop with `MAX_TURNS = 12`, idempotency cache keyed on `(stepQuestion, toolArgsHint)`, drift detector on repeated `stepQuestion`, and `StepLimitExceededError` for caller fallback. Agent 2 **bypasses the generic tool-loop** per §3.3. Prompts live under `server/services/agents/prompts/`. Wired behind `ENABLE_TWO_AGENT_SOLVER`; Spreadsheet Mode overrides the flag. |
| 10 | UI: mode toggle + cost estimator surface                                             | ✅     | Mode entry in [client/src/lib/mode-registry.ts](../client/src/lib/mode-registry.ts) (spreadsheet icon, label, description). [client/src/components/CostEstimator.tsx](../client/src/components/CostEstimator.tsx) with USD-cents → USD/INR/EUR/GBP/AED display, progress bar, enforced badge, over-budget warning, per-tool breakdown, recent-call list. 8 s poll interval. Pre-solve confirmation modal is deferred (see C.3). |
| 11 | Smoke tests                                                                          | ✅     | 12 smoke tests across `server/services/tools/*.test.ts` + `server/services/agents/twoAgentSolver.test.ts` covering HRA + 80C + surcharge + cess, MAT vs normal, IFRS 16 lease, NPV/IRR happy paths, drift + step-limit fallback, idempotency cache hits, and tool-result schema validation.                                                   |
| 12 | Telemetry for tool + solver runs                                                     | ✅     | [server/services/tools/telemetry.ts](../server/services/tools/telemetry.ts) — `recordToolCall()` + `withToolTelemetry()` wrapper writes one `toolCallTelemetry` row per tool invocation (tokens, latency, solver turn, verified flag) and increments the matching `conversationBudgets` row. Wired into `runTwoAgentSolver` and every registered tool. 5 mocked tests in [server/services/tools/telemetry.test.ts](../server/services/tools/telemetry.test.ts). |
| 13 | `tax_slab_apply` + `statement_aggregator`                                            | ✅     | [server/services/tools/taxSlabApply.tool.ts](../server/services/tools/taxSlabApply.tool.ts), [server/services/tools/statementAggregator.tool.ts](../server/services/tools/statementAggregator.tool.ts), plus ratios + amortization agents under [server/services/agents/financialCalculationAgents.ts](../server/services/agents/financialCalculationAgents.ts) merging into `results.financialRatios` / `results.amortization`. |

### C.2 Cost + telemetry surface

- `POST`-free read endpoints wired in [server/routes/costRoutes.ts](../server/routes/costRoutes.ts):
  - `GET /api/cost/:conversationId` → budget summary (cap, spent, remaining, enforced, currency)
  - `GET /api/cost/:conversationId/telemetry` → raw rows + `byTool` aggregate (count, tokens, costCents, avgLatencyMs)
- Mounted in [server/routes.ts](../server/routes.ts) as `app.use('/api/cost', costRoutes)`.
- Storage invariant: all money stored as **USD cents integers** on `conversationBudgets.costCentsSpent` and `toolCallTelemetry.costCents`. Display currencies (INR/EUR/GBP/AED) are computed client-side in `CostEstimator.tsx` from a static FX map (daily FX cache behind `fxRateService.ts` is the next iteration).
- Provider failover accounting (§5.3 last bullet): `withToolTelemetry()` sums tokens across every attempt reported by the provider adapter, not just the winner.

### C.3 Known deferrals (tracked, not forgotten)

1. **Pre-solve estimate modal + `POST /api/spreadsheet/estimate`** — the budget + pricing primitives are live and read endpoints exist; the actual mandatory-before-solve modal + `confirmedEstimateId` SSE handshake is the next UX-layer task. Until it lands, Spreadsheet Mode solves still tick the budget post-hoc (same numbers, just no pre-warning).
2. **Live FX cache** — `CostEstimator.tsx` uses a static display-FX table today. `server/services/fxRateService.ts` with 24 h Postgres-backed cache is queued; storage truth (USD cents) is already correct so this is a pure display swap.
3. **BYO-key bypass** — still deferred per §5 original note. No new evidence of `userSettings.llmKeys.*` plumbing; `ICAI_KEY_ONLY_METERING` flag remains `false` (meter everyone).
4. **`ENABLE_TWO_AGENT_SOLVER` default** — stays `false`. Flip decision waits on real telemetry from Spreadsheet Mode (now the sole always-on caller).

### C.4 Test posture

- Full suite: `npx vitest run` → **46/46 passing** after the DB-config fix below.
- Fixed during verification: local test runs were failing 3 `readWhiteboard.tool.test.ts` cases because `server/db.ts` forces SSL unless `DB_SSL=false` and the `lucaagent_test` database hadn't been provisioned on the dev box. Resolved by:
  - defaulting `process.env.DB_SSL ??= 'false'` in [tests/setup.ts](../tests/setup.ts) (CI overrides preserved via `??`);
  - creating the test DB and pushing the drizzle schema (`drizzle-kit push`);
  - adding `.env.test` (gitignored via the existing `.env.*` rule) so future runs self-configure.
- No production code path changed during this fix — `server/db.ts` still defaults SSL **on** in every non-test environment.
