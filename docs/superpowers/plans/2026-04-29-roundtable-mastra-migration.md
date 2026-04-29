# Roundtable Mastra Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the boardroom roundtable runtime from the hand-rolled `roundtableRuntime.ts` to a Mastra-driven workflow + agent architecture, behind a panel-stamped runtime column for safe strangler rollout.

**Architecture:** New panels stamped `runtime: 'mastra'` flow through a Mastra `Workflow` with six phase steps that `suspend()`/`resume()` on chair phase advance. Each per-turn LLM call uses a Mastra `Agent` configured with our existing `aiProviders/` abstraction (preserving cost-tier fallback). Existing relevance-loop selection, abort/retry, side-thread scheduling, and synthesizer dispatch remain in our code. Existing panels continue on the legacy runtime untouched. After soak, the `ROUNDTABLE_DEFAULT_RUNTIME` env defaults flip to `'mastra'`; legacy code stays in the codebase until straggler panels are archived (out of scope here).

**Tech Stack:** TypeScript, Mastra (`@mastra/core`, `@mastra/pg`), Drizzle ORM, PostgreSQL, Bull + ioredis (existing), `aiProviderRegistry` (existing), Vitest, Zod.

---

## Spec reference

Design spec at [docs/superpowers/specs/2026-04-29-roundtable-mastra-migration-design.md](../specs/2026-04-29-roundtable-mastra-migration-design.md). Read it before starting.

## Existing code touchpoints

- `server/services/roundtable/roundtableRuntime.ts` — the legacy runtime. **Frozen during this migration.** No edits.
- `server/services/roundtable/agentPovStore.ts`, `agentSynthesizer.ts`, `synthesizerJob.ts` — synthesizer; **unchanged.** Mastra calls `addSynthesizerJob` after each turn.
- `server/services/roundtable/roundtablePanelService.ts` — panel CRUD; modified in T17 to stamp the `runtime` column.
- `server/services/aiProviders/registry.ts` — provider registry; used inside `modelClient.ts` (T6).
- `shared/schema.ts` — schema additions in T2.
- Routes that currently import `roundtableRuntime.ts` directly — audited and updated in T5.

## Mastra API quick reference (used throughout)

```ts
import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { createTool } from "@mastra/core/tools";
import { PostgresStore } from "@mastra/pg";
import { z } from "zod";
```

Key shapes (verified against Mastra 1.0 docs, April 2026):

- `Agent` constructor: `{ id, name, instructions, model, tools? }`. `model` is a router string like `"openai/gpt-4o"` OR an AI SDK `LanguageModelV2` instance. For our case (custom provider routing), we pass an AI-SDK-instance-shaped wrapper from `modelClient.ts`.
- `createStep({ id, inputSchema, outputSchema, suspendSchema?, resumeSchema?, execute })`. `execute` receives `{ inputData, suspend, resumeData, state, setState, requestContext, abortSignal }`.
- `createTool({ id, description, inputSchema, outputSchema?, execute })`. `execute` receives `(input, { requestContext, abortSignal, agent, workflow })` — input is the FIRST arg.
- `createWorkflow({ id, inputSchema, outputSchema })`...`.then(stepA).then(stepB)...commit()`.
- `mastra.getWorkflow('id').createRun({ runId? })` → `run.start({ inputData })` / `run.resume({ resumeData, step? })`.

If installed types differ slightly from these signatures, adjust per the actual `@mastra/core` types — the structure is correct.

## File structure (locked decomposition)

```
migrations/0008_roundtable_runtime_column.sql               (NEW)
shared/schema.ts                                            (MODIFY: add runtime col)
server/services/roundtable/runtimeInterface.ts              (NEW)
server/services/roundtable/runtimeDispatcher.ts             (NEW)
server/services/roundtable/legacyRuntime.ts                 (NEW: thin wrapper around roundtableRuntime.ts)
server/services/roundtable/buildAgentSystemPrompt.ts        (NEW: extracted shared helper)
server/services/roundtable/askPanelistResolver.ts           (NEW: extracted shared helper)
server/services/roundtable/proposePhaseTransitionResolver.ts (NEW: extracted shared helper)
server/services/roundtable/cedeFloorResolver.ts             (NEW: extracted shared helper)
server/services/roundtable/startSideThreadResolver.ts       (NEW: extracted shared helper)
server/services/roundtable/mastra/instance.ts               (NEW: Mastra singleton)
server/services/roundtable/mastra/runtime.ts                (NEW: MastraRoundtableRuntime)
server/services/roundtable/mastra/turnExecutor.ts           (NEW: runAgentTurnViaMastra — broken out to avoid circular imports)
server/services/roundtable/mastra/workflow.ts               (NEW)
server/services/roundtable/mastra/phaseSteps.ts             (NEW)
server/services/roundtable/mastra/selection.ts              (NEW)
server/services/roundtable/mastra/agentBuilder.ts           (NEW)
server/services/roundtable/mastra/modelClient.ts            (NEW)
server/services/roundtable/mastra/tools/askPanelist.ts      (NEW)
server/services/roundtable/mastra/tools/proposePhaseTransition.ts (NEW)
server/services/roundtable/mastra/tools/cedeFloor.ts        (NEW)
server/services/roundtable/mastra/tools/startSideThread.ts  (NEW)
server/services/roundtable/mastra/__tests__/integration.test.ts (NEW)
server/services/roundtable/roundtablePanelService.ts        (MODIFY: read ROUNDTABLE_DEFAULT_RUNTIME)
server/routes/<roundtable routes>                           (MODIFY: call dispatcher, not runtime directly)
.env.example                                                (MODIFY: document new env var)
```

**Import-cycle note:** `phaseSteps.ts` needs to call into per-turn execution; `runtime.ts` (the public API) holds workflow + agent state. To avoid `phaseSteps → runtime → workflow → phaseSteps`, the per-turn helper lives in its own file `turnExecutor.ts`. Both `phaseSteps.ts` and `runtime.ts` import from `turnExecutor.ts`; nothing imports from `runtime.ts` except the dispatcher.

Each file ≤300 LOC, single responsibility.

---

## Task 1: Install Mastra dependencies + Mastra singleton

**Files:**
- Modify: `package.json`
- Create: `server/services/roundtable/mastra/instance.ts` (the singleton)
- Modify: `.env.example` (add new env var)

- [ ] **Step 1: Install packages**

```bash
npm install @mastra/core @mastra/pg
```

Verify they install without conflicts and the project still builds:

```bash
npx tsc --noEmit 2>&1 | grep -v "schema-pg-backup" | grep "error TS" | wc -l
```

Note the count — should equal the pre-install count (no new errors from Mastra's types).

- [ ] **Step 2: Create the Mastra singleton stub**

Create `server/services/roundtable/mastra/instance.ts`:

```ts
/**
 * Mastra runtime singleton for the roundtable feature.
 * Storage is wired on the Mastra constructor (not per-workflow).
 * Workflows + agents are registered lazily via setupMastra() once
 * the workflow + agent factories exist (see Tasks 14, 15).
 */
import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";

let mastraInstance: Mastra | null = null;

export function getMastra(): Mastra {
  if (!mastraInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL required for Mastra storage");
    }
    mastraInstance = new Mastra({
      storage: new PostgresStore({
        connectionString: process.env.DATABASE_URL,
      }),
      // workflows + agents registered later via setupMastra()
    });
  }
  return mastraInstance;
}

// Set by mastra/runtime.ts once workflows + agents are defined.
export function registerWorkflows(workflows: Record<string, any>) {
  const m = getMastra();
  for (const [id, wf] of Object.entries(workflows)) {
    (m as any).workflows ??= {};
    (m as any).workflows[id] = wf;
  }
}
```

- [ ] **Step 3: Document new env var in `.env.example`**

Append to `.env.example`:

```
# Default runtime for new roundtable panels. 'legacy' (today) or 'mastra'
# (after Mastra migration soak). Old panels keep whatever runtime they
# were created with; this only affects new panel creation.
ROUNDTABLE_DEFAULT_RUNTIME=legacy
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "mastra/instance\.ts|^Error" | head
```

Expected: no errors in the new file.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json server/services/roundtable/mastra/instance.ts .env.example
git commit -m "feat(roundtable): install Mastra deps + Postgres storage singleton"
```

---

## Task 2: Schema + migration for `runtime` column

**Files:**
- Modify: `shared/schema.ts` (add `runtime` to `roundtablePanels`)
- Create: `migrations/0008_roundtable_runtime_column.sql`

- [ ] **Step 1: Find the `roundtablePanels` table in `shared/schema.ts`**

Search for `export const roundtablePanels = pgTable("roundtable_panels"`. Add a new column inside the table block (place it next to `userId` or `name` — anywhere in the column list works):

```ts
  runtime: varchar("runtime", { length: 16 }).notNull().default("legacy"),
```

Add an index in the table's third arg (the index map):

```ts
  runtimeIdx: index("roundtable_panels_runtime_idx").on(table.runtime),
```

- [ ] **Step 2: Create the SQL migration**

Write to `migrations/0008_roundtable_runtime_column.sql`:

```sql
-- ============================================================================
-- Roundtable runtime column.
-- Strangler migration: existing panels stay 'legacy' forever; new panels
-- use whatever ROUNDTABLE_DEFAULT_RUNTIME stamps. The runtime dispatcher
-- routes by this column.
-- ============================================================================

ALTER TABLE roundtable_panels
  ADD COLUMN IF NOT EXISTS runtime VARCHAR(16) NOT NULL DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS roundtable_panels_runtime_idx
  ON roundtable_panels(runtime);
```

- [ ] **Step 3: Apply the migration via psql (project's migration runner is broken — use psql directly)**

```bash
set -a && . ./.env && set +a && \
  psql "$DATABASE_URL" -f migrations/0008_roundtable_runtime_column.sql
```

Expected output:

```
ALTER TABLE
CREATE INDEX
```

- [ ] **Step 4: Verify the column exists**

```bash
set -a && . ./.env && set +a && \
  psql "$DATABASE_URL" -c "\d roundtable_panels" | grep runtime
```

Expected: a line showing `runtime | character varying(16) | | not null | 'legacy'::character varying`.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "shared/schema.ts" | head
```

Expected: empty.

- [ ] **Step 6: Commit**

```bash
git add shared/schema.ts migrations/0008_roundtable_runtime_column.sql
git commit -m "feat(roundtable): add runtime column to roundtable_panels"
```

---

## Task 3: Define `RoundtableRuntime` interface

**Files:**
- Create: `server/services/roundtable/runtimeInterface.ts`

- [ ] **Step 1: Audit what the routes actually call on `roundtableRuntime.ts`**

Run:

```bash
grep -rn "from.*roundtable/roundtableRuntime'" server/routes/ server/services/ | grep -v node_modules
```

For each match, note which exported functions are used. The set of called functions is the interface. Common ones likely: `setPhase`, `subscribe`, `cancelTurn`, `startThread`, `submitChairMessage`, `acceptPhaseProposal`, `rejectPhaseProposal`, `pause`, `resume`. Build the actual list by inspection.

- [ ] **Step 2: Create the interface file**

Write to `server/services/roundtable/runtimeInterface.ts` (adjust method list based on Step 1's audit; this is the canonical shape):

```ts
/**
 * Public interface that BOTH the legacy runtime and the new Mastra runtime
 * implement. The dispatcher (runtimeDispatcher.ts) returns the right impl
 * per panel.runtime.
 */

import type { RoundtableThread } from "@shared/schema";

export type RoundtablePhase =
  | "opening"
  | "independent-views"
  | "cross-examination"
  | "user-qa"
  | "synthesis"
  | "resolution";

export interface RoundtableRuntime {
  // Lifecycle
  startThread(args: {
    userId: string;
    panelId: string;
    conversationId?: string | null;
    title?: string;
    initialChairMessage?: string;
  }): Promise<RoundtableThread>;

  // Phase control
  setPhase(threadId: string, phase: RoundtablePhase, userId: string): Promise<void>;
  acceptPhaseProposal(threadId: string, cardId: string, userId: string): Promise<void>;
  rejectPhaseProposal(threadId: string, cardId: string, userId: string): Promise<void>;

  // Chair interaction
  submitChairMessage(threadId: string, content: string, userId: string): Promise<void>;
  answerOpenQuestion(threadId: string, cardId: string, content: string, userId: string): Promise<void>;
  cancelTurn(threadId: string, userId: string): Promise<void>;

  // Pause/resume
  pause(threadId: string, userId: string): Promise<void>;
  resume(threadId: string, userId: string): Promise<void>;

  // Event subscription
  subscribe(threadId: string, listener: (event: string, data: any) => void): () => void;
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep runtimeInterface.ts || echo "✓ clean"
```

- [ ] **Step 4: Commit**

```bash
git add server/services/roundtable/runtimeInterface.ts
git commit -m "feat(roundtable): define RoundtableRuntime interface (the seam)"
```

---

## Task 4: Legacy runtime wrapper + dispatcher

**Files:**
- Create: `server/services/roundtable/legacyRuntime.ts`
- Create: `server/services/roundtable/runtimeDispatcher.ts`
- Test: `server/services/roundtable/__tests__/runtimeDispatcher.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/services/roundtable/__tests__/runtimeDispatcher.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../db", () => ({
  db: { select: vi.fn() },
}));
vi.mock("../legacyRuntime", () => ({
  legacyRuntime: { __kind: "legacy" },
}));
// Mastra runtime placeholder until Task 18 wires it in.
vi.mock("../mastra/runtime", () => ({
  mastraRuntime: { __kind: "mastra" },
}));

import { db } from "../../../db";
import { getRuntimeForPanel } from "../runtimeDispatcher";

describe("getRuntimeForPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns legacy runtime for legacy panel", async () => {
    (db.select as any).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ runtime: "legacy" }]) }),
      }),
    });
    const r = await getRuntimeForPanel("p1");
    expect((r as any).__kind).toBe("legacy");
  });

  it("returns mastra runtime for mastra panel", async () => {
    (db.select as any).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ runtime: "mastra" }]) }),
      }),
    });
    const r = await getRuntimeForPanel("p1");
    expect((r as any).__kind).toBe("mastra");
  });

  it("throws when panel not found", async () => {
    (db.select as any).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    });
    await expect(getRuntimeForPanel("missing")).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run server/services/roundtable/__tests__/runtimeDispatcher.test.ts
```

Expected: FAIL — modules `../legacyRuntime`, `../mastra/runtime`, `../runtimeDispatcher` not found.

- [ ] **Step 3: Create `legacyRuntime.ts` (a thin wrapper around the existing runtime)**

Write to `server/services/roundtable/legacyRuntime.ts`:

```ts
/**
 * Adapter that exposes the existing roundtableRuntime as a RoundtableRuntime.
 * The legacy runtime exports each method as a free function; this just
 * gathers them into an object that satisfies the interface. The legacy
 * implementation is NOT modified.
 */
import * as legacy from "./roundtableRuntime";
import type { RoundtableRuntime } from "./runtimeInterface";

// IMPORTANT: the property names must match Step 1's audit of the routes.
// If a legacy export is named differently, adjust here. Do NOT rename or
// re-implement the legacy functions themselves.
export const legacyRuntime: RoundtableRuntime = {
  startThread: legacy.startThread,
  setPhase: legacy.setPhase,
  acceptPhaseProposal: legacy.acceptPhaseProposal,
  rejectPhaseProposal: legacy.rejectPhaseProposal,
  submitChairMessage: legacy.submitChairMessage,
  answerOpenQuestion: legacy.answerOpenQuestion,
  cancelTurn: legacy.cancelTurn,
  pause: legacy.pause,
  resume: legacy.resume,
  subscribe: legacy.subscribe,
};
```

If a method named in the interface doesn't exist on the legacy module, either (a) add a tiny shim function here that maps the call, or (b) update the interface to match what the legacy module actually exports. **Do NOT modify `roundtableRuntime.ts` itself.**

- [ ] **Step 4: Create a stub `mastra/runtime.ts` (will be filled out in Task 15)**

Write to `server/services/roundtable/mastra/runtime.ts`:

```ts
/**
 * MastraRoundtableRuntime — public RoundtableRuntime implementation backed
 * by Mastra Workflow + Agent. This is a stub; methods are implemented in
 * Task 15 once the workflow + agents are built.
 */
import type { RoundtableRuntime } from "../runtimeInterface";

const notYetImplemented = () => {
  throw new Error("Mastra runtime not yet implemented — see Task 15");
};

export const mastraRuntime: RoundtableRuntime = {
  startThread: notYetImplemented as any,
  setPhase: notYetImplemented as any,
  acceptPhaseProposal: notYetImplemented as any,
  rejectPhaseProposal: notYetImplemented as any,
  submitChairMessage: notYetImplemented as any,
  answerOpenQuestion: notYetImplemented as any,
  cancelTurn: notYetImplemented as any,
  pause: notYetImplemented as any,
  resume: notYetImplemented as any,
  subscribe: notYetImplemented as any,
};
```

- [ ] **Step 5: Create the dispatcher**

Write to `server/services/roundtable/runtimeDispatcher.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { roundtablePanels } from "@shared/schema";
import type { RoundtableRuntime } from "./runtimeInterface";
import { legacyRuntime } from "./legacyRuntime";
import { mastraRuntime } from "./mastra/runtime";

export async function getRuntimeForPanel(panelId: string): Promise<RoundtableRuntime> {
  const rows = await db
    .select({ runtime: roundtablePanels.runtime })
    .from(roundtablePanels)
    .where(eq(roundtablePanels.id, panelId))
    .limit(1);
  if (rows.length === 0) {
    throw new Error(`Panel ${panelId} not found`);
  }
  return rows[0].runtime === "mastra" ? mastraRuntime : legacyRuntime;
}

/**
 * Convenience for routes that already have the panelId from a thread lookup.
 * Use getRuntimeForPanel directly when you only have a thread.
 */
export async function getRuntimeForThread(threadId: string): Promise<RoundtableRuntime> {
  // Look up the panel via the thread.
  const { roundtableThreads } = await import("@shared/schema");
  const rows = await db
    .select({ panelId: roundtableThreads.panelId })
    .from(roundtableThreads)
    .where(eq(roundtableThreads.id, threadId))
    .limit(1);
  if (rows.length === 0) {
    throw new Error(`Thread ${threadId} not found`);
  }
  return getRuntimeForPanel(rows[0].panelId);
}
```

- [ ] **Step 6: Run tests, verify pass**

```bash
npx vitest run server/services/roundtable/__tests__/runtimeDispatcher.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/services/roundtable/legacyRuntime.ts \
        server/services/roundtable/mastra/runtime.ts \
        server/services/roundtable/runtimeDispatcher.ts \
        server/services/roundtable/__tests__/runtimeDispatcher.test.ts
git commit -m "feat(roundtable): add runtime dispatcher + legacy wrapper"
```

---

## Task 5: Modify routes to use the dispatcher

**Files:**
- Modify: every route file that imports from `roundtable/roundtableRuntime` directly.

- [ ] **Step 1: List every direct importer**

```bash
grep -rln "from.*roundtable/roundtableRuntime'" server/routes/ server/services/ | grep -v node_modules
```

Examples likely include `server/routes/roundtableBoardroomRoutes.ts`. Each file is one edit.

- [ ] **Step 2: For each file, replace direct calls with dispatcher calls**

Pattern: replace

```ts
import * as runtime from "../services/roundtable/roundtableRuntime";
// ...
await runtime.setPhase(threadId, phase, userId);
```

with:

```ts
import { getRuntimeForThread } from "../services/roundtable/runtimeDispatcher";
// ...
const runtime = await getRuntimeForThread(threadId);
await runtime.setPhase(threadId, phase, userId);
```

For routes that already have the panelId (e.g., creating a thread from a panel), use `getRuntimeForPanel` instead.

`subscribe()` is special — it's called from the SSE/websocket route. The pattern is the same: resolve the runtime first, then call `runtime.subscribe(threadId, listener)`.

- [ ] **Step 3: Run typecheck after each file edit**

```bash
npx tsc --noEmit 2>&1 | grep "server/routes" | head -20
```

Expected: no errors in route files after the edits.

- [ ] **Step 4: Run all tests to confirm no regressions**

```bash
set -a && . ./.env && set +a && npx vitest run server/services/roundtable/ server/routes/
```

Expected: existing tests still pass; new dispatcher tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/  # whichever route files changed
git commit -m "feat(roundtable): route all runtime calls through dispatcher"
```

---

## Task 6: `modelClient.ts` — OpenAI-compatible adapter wrapping `aiProviders/`

**Files:**
- Create: `server/services/roundtable/mastra/modelClient.ts`
- Test: `server/services/roundtable/mastra/__tests__/modelClient.test.ts`

**Important:** Mastra `Agent` accepts a model in two forms — a router string (`"openai/gpt-4o"`) or an AI SDK `LanguageModelV2` instance. We need to plug in our own provider routing. Build a minimal `LanguageModelV2`-shaped wrapper that delegates `doGenerate` to `aiProviderRegistry`. If, when implementing, the installed Mastra/AI-SDK types reject our wrapper (the V2 interface has many fields we don't need), fall back to: register an OpenAI client with custom `baseURL` pointing at our own provider proxy. For now, write the V2 wrapper.

- [ ] **Step 1: Write failing test**

Create `server/services/roundtable/mastra/__tests__/modelClient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const generateCompletion = vi.fn();
vi.mock("../../../aiProviders/registry", () => ({
  aiProviderRegistry: {
    getProvider: vi.fn(() => ({ generateCompletion })),
  },
}));

import { buildModelClient } from "../modelClient";

describe("buildModelClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to first available provider in PROVIDER_ORDER", async () => {
    generateCompletion.mockResolvedValueOnce({
      content: "hello",
      tokensUsed: { input: 10, output: 5, total: 15 },
      model: "gpt-4o-mini",
      provider: "azure-openai",
      finishReason: "stop",
    });
    const model = buildModelClient("mini");
    const res = await model.doGenerate({
      inputFormat: "messages",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    } as any);
    expect(res.text).toBe("hello");
    expect(res.usage.promptTokens).toBe(10);
    expect(res.usage.completionTokens).toBe(5);
  });

  it("falls through providers on first failure", async () => {
    generateCompletion
      .mockRejectedValueOnce(new Error("azure down"))
      .mockResolvedValueOnce({
        content: "fallback",
        tokensUsed: { input: 10, output: 5, total: 15 },
        model: "gpt-4o-mini",
        provider: "openai",
        finishReason: "stop",
      });
    const model = buildModelClient("mini");
    const res = await model.doGenerate({
      inputFormat: "messages",
      mode: { type: "regular" },
      prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    } as any);
    expect(res.text).toBe("fallback");
    expect(generateCompletion).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run server/services/roundtable/mastra/__tests__/modelClient.test.ts
```

Expected: FAIL — `buildModelClient` not found.

- [ ] **Step 3: Implement `modelClient.ts`**

Write to `server/services/roundtable/mastra/modelClient.ts`:

```ts
/**
 * LanguageModelV2-shaped adapter that delegates to our aiProviderRegistry,
 * preserving the cost-tier provider fallback (Azure → OpenAI → Claude → Gemini).
 *
 * Mastra Agent accepts either a model router string or an AI SDK V2 model
 * instance. We pass an instance of this adapter so Mastra goes through OUR
 * provider chain instead of the AI SDK's default OpenAI client.
 */
import { aiProviderRegistry } from "../../aiProviders/registry";
import { AIProviderName } from "../../aiProviders/types";
import type { CompletionMessage } from "../../aiProviders/types";

const STRONG_MODELS: Partial<Record<AIProviderName, string>> = {
  [AIProviderName.AZURE_OPENAI]: "gpt-4o",
  [AIProviderName.OPENAI]: "gpt-4o",
  [AIProviderName.CLAUDE]: "claude-3-5-sonnet-20241022",
  [AIProviderName.GEMINI]: "gemini-1.5-pro",
};
const MINI_MODELS: Partial<Record<AIProviderName, string>> = {
  [AIProviderName.AZURE_OPENAI]: "gpt-4o-mini",
  [AIProviderName.OPENAI]: "gpt-4o-mini",
  [AIProviderName.CLAUDE]: "claude-3-5-haiku-20241022",
  [AIProviderName.GEMINI]: "gemini-1.5-flash",
};

const PROVIDER_ORDER: AIProviderName[] = [
  AIProviderName.AZURE_OPENAI,
  AIProviderName.OPENAI,
  AIProviderName.CLAUDE,
  AIProviderName.GEMINI,
];

export interface ModelTier {
  tier: "strong" | "mini";
}

export function buildModelClient(tier: "strong" | "mini") {
  return {
    specificationVersion: "v2" as const,
    provider: "icai-aiproviders",
    modelId: tier,

    async doGenerate(options: any) {
      // Convert AI SDK V2 prompt → our CompletionMessage[]
      const messages: CompletionMessage[] = (options.prompt ?? []).map((m: any) => ({
        role: m.role,
        content: typeof m.content === "string"
          ? m.content
          : (m.content ?? []).map((p: any) => p.text ?? "").join(""),
      }));

      const errors: string[] = [];
      const map = tier === "mini" ? MINI_MODELS : STRONG_MODELS;
      for (const providerName of PROVIDER_ORDER) {
        try {
          const provider = aiProviderRegistry.getProvider(providerName);
          const model = map[providerName] ?? "gpt-4o-mini";
          const res = await provider.generateCompletion({
            model,
            messages,
            maxTokens: options.maxOutputTokens ?? options.maxTokens ?? 1200,
            temperature: options.temperature ?? 0.6,
          });
          return {
            text: res.content,
            usage: {
              promptTokens: res.tokensUsed?.input ?? 0,
              completionTokens: res.tokensUsed?.output ?? 0,
            },
            finishReason: (res.finishReason ?? "stop") as any,
            providerMetadata: {
              icaiProvider: { name: providerName, model },
            },
          };
        } catch (err) {
          errors.push(`${providerName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      throw new Error(`Synthesizer model: all providers failed: ${errors.join(" | ")}`);
    },

    // doStream is required by V2 but we don't stream from this adapter
    // (we keep simulated streaming at the runtime layer per spec).
    async doStream(): Promise<never> {
      throw new Error("modelClient: streaming not implemented in v1; use doGenerate");
    },
  };
}
```

If installed `@mastra/core` and `@ai-sdk/provider` types reject this shape (e.g., missing `defaultObjectGenerationMode`, `supportsImageUrls`, etc.), add the required fields with sensible defaults and report DONE_WITH_CONCERNS so the controller can verify.

- [ ] **Step 4: Run test, expect pass**

```bash
npx vitest run server/services/roundtable/mastra/__tests__/modelClient.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/mastra/modelClient.ts \
        server/services/roundtable/mastra/__tests__/modelClient.test.ts
git commit -m "feat(roundtable): modelClient adapter wrapping aiProviders for Mastra"
```

---

## Task 7: `agentBuilder.ts` — Mastra Agent factory

**Files:**
- Create: `server/services/roundtable/mastra/agentBuilder.ts`
- Test: `server/services/roundtable/mastra/__tests__/agentBuilder.test.ts`

- [ ] **Step 1: Write failing test**

Create `server/services/roundtable/mastra/__tests__/agentBuilder.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@mastra/core/agent", () => ({
  Agent: class {
    constructor(public config: any) {}
  },
}));
vi.mock("../modelClient", () => ({
  buildModelClient: (tier: string) => ({ __kind: "modelClient", tier }),
}));
vi.mock("../tools/askPanelist", () => ({ askPanelistTool: { id: "ask_panelist" } }));
vi.mock("../tools/proposePhaseTransition", () => ({ proposePhaseTransitionTool: { id: "propose_phase_transition" } }));
vi.mock("../tools/cedeFloor", () => ({ cedeFloorTool: { id: "cede_floor" } }));
vi.mock("../tools/startSideThread", () => ({ startSideThreadTool: { id: "start_side_thread" } }));

import { buildMastraAgent } from "../agentBuilder";

describe("buildMastraAgent", () => {
  it("creates an agent with name, instructions, model tier, and 4 tools", () => {
    const agent = buildMastraAgent({
      agentRow: {
        id: "a1",
        name: "Auditor",
        systemPrompt: "audit",
        model: "mini",
      } as any,
      kbSnippets: "kb context here",
      povCueCard: "perspective",
      allAgents: [{ id: "a1", name: "Auditor" }, { id: "a2", name: "Compliance" }] as any,
    });
    const cfg = (agent as any).config;
    expect(cfg.name).toBe("Auditor");
    expect(cfg.instructions).toContain("Auditor");  // built via buildAgentSystemPrompt
    expect(cfg.model.__kind).toBe("modelClient");
    expect(cfg.model.tier).toBe("mini");
    expect(Object.keys(cfg.tools)).toEqual(
      expect.arrayContaining(["ask_panelist", "propose_phase_transition", "cede_floor", "start_side_thread"]),
    );
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run server/services/roundtable/mastra/__tests__/agentBuilder.test.ts
```

Expected: FAIL — `buildMastraAgent` not found.

- [ ] **Step 3: Implement `agentBuilder.ts`**

The system prompt rendering must reuse the existing `buildAgentSystemPrompt` logic (currently in `roundtableRuntime.ts`). Since we don't want to import from the legacy file, copy the function to a small shared helper OR re-export it. Simplest: re-export from legacy via a new path. Read the legacy function (it's pure given its inputs) and copy it into a new file `server/services/roundtable/buildAgentSystemPrompt.ts`, then have BOTH legacy and Mastra import from there — but we said legacy is frozen. Pragmatic alternative: re-export the legacy function:

Actually cleanest: extract `buildAgentSystemPrompt` from `roundtableRuntime.ts` into its own file in this task. **Exception to the "legacy is frozen" rule for this single function** because both runtimes need it. Acceptable carve-out.

Sub-step 3a: Create `server/services/roundtable/buildAgentSystemPrompt.ts` containing the existing function copied verbatim from `roundtableRuntime.ts:1380-1440` (approximate line range — find the actual `function buildAgentSystemPrompt(...)` declaration). Update `roundtableRuntime.ts` to import the function from the new file instead of defining it inline. **Run all roundtable tests after this carve-out to confirm zero behavior change.**

Sub-step 3b: Write `server/services/roundtable/mastra/agentBuilder.ts`:

```ts
import { Agent } from "@mastra/core/agent";
import { buildAgentSystemPrompt } from "../buildAgentSystemPrompt";
import { buildModelClient } from "./modelClient";
import { askPanelistTool } from "./tools/askPanelist";
import { proposePhaseTransitionTool } from "./tools/proposePhaseTransition";
import { cedeFloorTool } from "./tools/cedeFloor";
import { startSideThreadTool } from "./tools/startSideThread";
import type { RoundtablePanelAgent } from "@shared/schema";

export interface BuildMastraAgentArgs {
  agentRow: RoundtablePanelAgent;
  kbSnippets: string;
  povCueCard: string;
  allAgents: RoundtablePanelAgent[];
}

export function buildMastraAgent(args: BuildMastraAgentArgs): Agent {
  const tier = args.agentRow.model === "mini" ? "mini" : "strong";
  const instructions = buildAgentSystemPrompt(
    args.agentRow,
    args.kbSnippets,
    args.allAgents,
    args.povCueCard,
  );
  return new Agent({
    id: args.agentRow.id,
    name: args.agentRow.name,
    instructions,
    model: buildModelClient(tier) as any,
    tools: {
      ask_panelist: askPanelistTool,
      propose_phase_transition: proposePhaseTransitionTool,
      cede_floor: cedeFloorTool,
      start_side_thread: startSideThreadTool,
    },
  });
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx vitest run server/services/roundtable/mastra/__tests__/agentBuilder.test.ts
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/buildAgentSystemPrompt.ts \
        server/services/roundtable/roundtableRuntime.ts \
        server/services/roundtable/mastra/agentBuilder.ts \
        server/services/roundtable/mastra/__tests__/agentBuilder.test.ts
git commit -m "feat(roundtable): agentBuilder + extract buildAgentSystemPrompt for sharing"
```

---

## Tasks 8–11: Tools (askPanelist, proposePhaseTransition, cedeFloor, startSideThread)

These four tasks share the same shape: a Mastra `createTool({...})` that wraps existing logic.

For each, find the existing tool-resolver function in `roundtableRuntime.ts` (look for `case 'ask_panelist':` etc. inside the tool-call loop, around line 1730+). Extract that resolver to a shared helper file, then have both legacy and Mastra call it. Same carve-out rule as Task 7 — extracting a pure helper is allowed.

For brevity, the structure of all four is:

### Common pattern

**Files (per tool):**
- Create helper: `server/services/roundtable/<toolName>Resolver.ts` (extract from `roundtableRuntime.ts`)
- Modify: `roundtableRuntime.ts` to import from the new helper
- Create: `server/services/roundtable/mastra/tools/<toolName>.ts` (Mastra wrapper)
- Test: `server/services/roundtable/mastra/__tests__/tools.<toolName>.test.ts`

### Task 8: askPanelist

- [ ] **Step 1: Failing test**

```ts
// server/services/roundtable/mastra/__tests__/tools.askPanelist.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const resolveAskPanelist = vi.fn();
vi.mock("../../askPanelistResolver", () => ({ resolveAskPanelist }));

import { askPanelistTool } from "../tools/askPanelist";

describe("askPanelistTool", () => {
  beforeEach(() => vi.clearAllMocks());
  it("delegates to resolveAskPanelist with input + context", async () => {
    resolveAskPanelist.mockResolvedValue({ cardId: "c1" });
    const result = await (askPanelistTool as any).execute(
      { to_agent_name: "Compliance", question: "Cite Reg 30" },
      { requestContext: { threadId: "t1", speakerId: "a1" } },
    );
    expect(resolveAskPanelist).toHaveBeenCalledWith({
      threadId: "t1",
      fromAgentId: "a1",
      toAgentName: "Compliance",
      question: "Cite Reg 30",
    });
    expect(result.cardId).toBe("c1");
  });
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Extract resolver to `server/services/roundtable/askPanelistResolver.ts`**

Find the inline `ask_panelist` handler in `roundtableRuntime.ts` (around line 1730+ in the tool-call loop). Copy its body into a new pure function:

```ts
// server/services/roundtable/askPanelistResolver.ts
import { db } from "../../db";
import { roundtableQuestionCards, roundtablePanelAgents } from "@shared/schema";
// ...
export async function resolveAskPanelist(args: {
  threadId: string;
  fromAgentId: string;
  toAgentName: string;
  question: string;
}): Promise<{ cardId: string }> {
  // Body copied from roundtableRuntime.ts's existing ask_panelist case.
  // The implementation already validates roster, creates the card, etc.
  // ... actual extracted code here ...
}
```

Then in `roundtableRuntime.ts`, find the `case 'ask_panelist':` block and replace its body with `await resolveAskPanelist({ ... })`.

- [ ] **Step 4: Implement Mastra wrapper**

```ts
// server/services/roundtable/mastra/tools/askPanelist.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resolveAskPanelist } from "../../askPanelistResolver";

export const askPanelistTool = createTool({
  id: "ask_panelist",
  description:
    "Ask a specific panelist or the chair a question. Creates an open question card; the relevance loop routes the addressed party as the next speaker.",
  inputSchema: z.object({
    to_agent_name: z.string().describe('Target panelist display name, or "chair" for the human user.'),
    question: z.string().min(5),
  }),
  outputSchema: z.object({ cardId: z.string() }),
  execute: async (input, ctx) => {
    return resolveAskPanelist({
      threadId: (ctx?.requestContext as any)?.threadId,
      fromAgentId: (ctx?.requestContext as any)?.speakerId,
      toAgentName: input.to_agent_name,
      question: input.question,
    });
  },
});
```

- [ ] **Step 5: Run, expect pass**
- [ ] **Step 6: Commit**

```bash
git add server/services/roundtable/askPanelistResolver.ts \
        server/services/roundtable/roundtableRuntime.ts \
        server/services/roundtable/mastra/tools/askPanelist.ts \
        server/services/roundtable/mastra/__tests__/tools.askPanelist.test.ts
git commit -m "feat(roundtable): askPanelist tool for Mastra + shared resolver"
```

### Task 9: proposePhaseTransition

Same five steps. Differences:
- Resolver name: `resolvePhaseProposal` (creates a phase-proposal card AND signals workflow context).
- Tool inputSchema: `z.object({ to_phase: z.enum([...]), rationale: z.string() })`.
- Tool execute also sets `ctx.requestContext.pendingPhaseProposal = { cardId, toPhase }` so the phase step's after-turn check sees it.

### Task 10: cedeFloor

Same shape. Tool inputSchema: `z.object({ reason: z.string() })`. Resolver marks the turn as ceded.

### Task 11: startSideThread

Same shape. Tool inputSchema: `z.object({ to_agent_name: z.string(), question: z.string() })`. Resolver schedules a side-thread agent turn (parentTurnId set).

(Each task gets its own commit using the pattern from Task 8.)

---

## Task 12: `selection.ts` — proposal round + speaker pick

**Files:**
- Create: `server/services/roundtable/mastra/selection.ts`
- Test: `server/services/roundtable/mastra/__tests__/selection.test.ts`

This ports the existing relevance-loop selection logic to a small standalone module that the Mastra phase step can call.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi } from "vitest";

const generate = vi.fn();
vi.mock("../agentBuilder", () => ({
  buildMastraAgent: () => ({ generate }),
}));

import { runProposalRound, pickSpeaker } from "../selection";

describe("runProposalRound", () => {
  it("returns one proposal per agent", async () => {
    generate.mockResolvedValue({
      text: '{"shouldSpeak": true, "draftHeadline": "I have a point"}',
      usage: { promptTokens: 0, completionTokens: 0 },
    });
    const proposals = await runProposalRound([
      { agentRow: { id: "a1", name: "Auditor" } as any, mastraAgent: { generate } as any },
      { agentRow: { id: "a2", name: "Compliance" } as any, mastraAgent: { generate } as any },
    ], { phase: "opening", threadContext: "" });
    expect(proposals).toHaveLength(2);
    expect(proposals.every((p) => p.shouldSpeak)).toBe(true);
  });
});

describe("pickSpeaker", () => {
  it("returns null when no agent wants to speak", () => {
    expect(pickSpeaker([
      { agentId: "a1", agentName: "X", shouldSpeak: false },
      { agentId: "a2", agentName: "Y", shouldSpeak: false },
    ] as any)).toBeNull();
  });

  it("picks the first agent who wants to speak (deterministic)", () => {
    const winner = pickSpeaker([
      { agentId: "a1", agentName: "X", shouldSpeak: false },
      { agentId: "a2", agentName: "Y", shouldSpeak: true, draftHeadline: "h2" },
      { agentId: "a3", agentName: "Z", shouldSpeak: true, draftHeadline: "h3" },
    ] as any);
    expect(winner?.agentId).toBe("a2");
  });
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Implement `selection.ts`**

```ts
import type { RoundtablePanelAgent } from "@shared/schema";
import type { Agent } from "@mastra/core/agent";

export interface PanelMember {
  agentRow: RoundtablePanelAgent;
  mastraAgent: Agent;
}

export interface Proposal {
  agentId: string;
  agentName: string;
  shouldSpeak: boolean;
  draftHeadline?: string;
}

const PROPOSAL_PROMPT = (phase: string, threadContext: string) =>
  `You are deciding whether you have something USEFUL and NEW to add right now.
Current phase: ${phase}.
Recent thread (last few turns):
${threadContext || "(empty — first turn)"}

Answer ONLY with valid JSON matching this schema:
  { "shouldSpeak": boolean, "draftHeadline": string (max 80 chars, omit if shouldSpeak is false) }

Rules:
- If you have nothing new beyond what others already said: shouldSpeak=false.
- If your specialty is irrelevant to the current topic: shouldSpeak=false.
- If you would just repeat your prior position: shouldSpeak=false.
- Otherwise: shouldSpeak=true with a 1-line headline.`;

export async function runProposalRound(
  members: PanelMember[],
  ctx: { phase: string; threadContext: string },
): Promise<Proposal[]> {
  const proposals = await Promise.all(members.map(async (m) => {
    try {
      const res = await m.mastraAgent.generate([
        { role: "user", content: PROPOSAL_PROMPT(ctx.phase, ctx.threadContext) },
      ]);
      const parsed = JSON.parse(res.text);
      return {
        agentId: m.agentRow.id,
        agentName: m.agentRow.name,
        shouldSpeak: !!parsed.shouldSpeak,
        draftHeadline: parsed.draftHeadline,
      };
    } catch {
      return {
        agentId: m.agentRow.id,
        agentName: m.agentRow.name,
        shouldSpeak: false,
      };
    }
  }));
  return proposals;
}

export function pickSpeaker(proposals: Proposal[]): Proposal | null {
  const willing = proposals.filter((p) => p.shouldSpeak);
  if (willing.length === 0) return null;
  // For now, deterministic first-wins. The legacy runtime has more complex
  // ranking (relevance score); port that later if needed for parity.
  return willing[0];
}
```

- [ ] **Step 4: Run, expect pass**
- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/mastra/selection.ts \
        server/services/roundtable/mastra/__tests__/selection.test.ts
git commit -m "feat(roundtable): selection module for Mastra (proposal round + speaker pick)"
```

---

## Task 13: `phaseSteps.ts` — phase step factory

**Files:**
- Create: `server/services/roundtable/mastra/phaseSteps.ts`
- Test: `server/services/roundtable/mastra/__tests__/phaseSteps.test.ts`

This is the centerpiece of the migration. The phase step factory creates a Mastra `Step` for a given phase id; all six phases use the same factory with different ids.

- [ ] **Step 1: Failing test**

```ts
// Tests the loop logic inside a phase step. Mocks selection + agent.generate
// to drive the loop deterministically.
import { describe, it, expect, vi, beforeEach } from "vitest";

const runProposalRound = vi.fn();
const pickSpeaker = vi.fn();
vi.mock("../selection", () => ({ runProposalRound, pickSpeaker }));

const addSynthesizerJob = vi.fn();
vi.mock("../../../hybridJobQueue", () => ({ addSynthesizerJob }));

import { createPhaseStep } from "../phaseSteps";

describe("createPhaseStep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exits the inner loop when nobody opts in", async () => {
    runProposalRound.mockResolvedValue([{ shouldSpeak: false }, { shouldSpeak: false }]);
    pickSpeaker.mockReturnValue(null);

    const step = createPhaseStep("opening");
    const suspend = vi.fn().mockResolvedValue({ phase: "independent-views" });
    const setState = vi.fn();
    await step.execute({
      inputData: { threadId: "t", panelId: "p", panelMembers: [] as any },
      suspend,
      resumeData: undefined,
      state: { pendingChairAdvance: false, pendingPhaseProposal: null },
      setState,
      requestContext: {},
      abortSignal: new AbortController().signal,
    } as any);
    // Loop exits without speaker → step suspends with manual-advance
    expect(suspend).toHaveBeenCalledWith(expect.objectContaining({ awaitingChair: "manual-advance" }));
  });
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Implement `phaseSteps.ts`**

```ts
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { runProposalRound, pickSpeaker, type PanelMember } from "./selection";
import { runAgentTurnViaMastra } from "./turnExecutor";  // see Task 15
import { addSynthesizerJob } from "../../hybridJobQueue";

const PhaseStepInput = z.object({
  threadId: z.string(),
  panelId: z.string(),
  panelMembers: z.array(z.any()),
});

const PhaseStepOutput = z.object({
  endedAt: z.string(),
});

const PhaseStepResume = z.object({
  phase: z.string(),  // next phase id
});

export type PhaseId =
  | "opening"
  | "independent-views"
  | "cross-examination"
  | "user-qa"
  | "synthesis"
  | "resolution";

export function createPhaseStep(phase: PhaseId) {
  return createStep({
    id: phase,
    inputSchema: PhaseStepInput,
    outputSchema: PhaseStepOutput,
    resumeSchema: PhaseStepResume,
    execute: async ({ inputData, suspend, state, setState, abortSignal }) => {
      const { threadId, panelId, panelMembers } = inputData;
      const members = panelMembers as PanelMember[];

      // Helper: phaseShouldEnd reads workflow state for cooperative chair advance.
      const phaseShouldEnd = () =>
        Boolean(state?.pendingChairAdvance) ||
        Boolean(state?.pendingPhaseProposal);

      while (!phaseShouldEnd()) {
        if (abortSignal?.aborted) break;

        const proposals = await runProposalRound(members, {
          phase,
          threadContext: state?.threadContext ?? "",
        });
        const speaker = pickSpeaker(proposals);
        if (!speaker) break;  // nobody opted in

        const speakerMember = members.find((m) => m.agentRow.id === speaker.agentId);
        if (!speakerMember) break;

        await runAgentTurnViaMastra({
          threadId,
          panelId,
          phase,
          speaker: speakerMember,
          allMembers: members,
          abortSignal,
        });

        // Synthesizer dispatch for ALL panel members (speaker included).
        for (const m of members) {
          addSynthesizerJob({
            threadId,
            agentId: m.agentRow.id,
            agentName: m.agentRow.name,
            panelId,
          });
        }

        // After-turn: if a phase proposal was raised, suspend awaiting chair.
        if (state?.pendingPhaseProposal) {
          const decision = await suspend({
            awaitingChair: "phase-proposal",
            proposal: state.pendingPhaseProposal,
          });
          if ((decision as any).accepted) {
            return { endedAt: new Date().toISOString() };
          }
          // Rejected — clear and continue this phase
          setState?.({ ...state, pendingPhaseProposal: null });
        }
      }

      // Loop exited without an accepted proposal → wait for manual chair advance.
      const decision = await suspend({ awaitingChair: "manual-advance" });
      // decision.phase is the next phase id (workflow advances to next step)
      return { endedAt: new Date().toISOString() };
    },
  });
}
```

- [ ] **Step 4: Run, expect pass**
- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/mastra/phaseSteps.ts \
        server/services/roundtable/mastra/__tests__/phaseSteps.test.ts
git commit -m "feat(roundtable): phaseSteps factory for Mastra workflow"
```

---

## Task 14: `workflow.ts` — assemble the 6-step workflow

**Files:**
- Create: `server/services/roundtable/mastra/workflow.ts`

- [ ] **Step 1: Implement (no separate test — covered by integration test in Task 19)**

```ts
import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { createPhaseStep, type PhaseId } from "./phaseSteps";

const PHASE_ORDER: PhaseId[] = [
  "opening",
  "independent-views",
  "cross-examination",
  "user-qa",
  "synthesis",
  "resolution",
];

export function createRoundtableWorkflow() {
  const steps = PHASE_ORDER.map((p) => createPhaseStep(p));

  let wf = createWorkflow({
    id: "roundtable",
    inputSchema: z.object({
      threadId: z.string(),
      panelId: z.string(),
      panelMembers: z.array(z.any()),
    }),
    outputSchema: z.object({
      finalMemoTurnId: z.string().optional(),
    }),
  }) as any;

  for (const step of steps) {
    wf = wf.then(step);
  }
  return wf.commit();
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "mastra/workflow.ts" | head
```

Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add server/services/roundtable/mastra/workflow.ts
git commit -m "feat(roundtable): assemble 6-step Mastra workflow"
```

---

## Task 15: `turnExecutor.ts` + `runtime.ts` — Mastra public API

**Files:**
- Create: `server/services/roundtable/mastra/turnExecutor.ts` (per-turn helper)
- Modify: `server/services/roundtable/mastra/runtime.ts` (replacing the stub from Task 4)
- Create: side-table migration `migrations/0009_mastra_thread_runs.sql` (maps thread → workflow run)

**Why split:** Mastra's installed version may not expose `getRunsByMetadata`. Maintaining our own thread→run mapping in a side table is the safer default. `phaseSteps.ts` imports per-turn execution from `turnExecutor.ts`; `runtime.ts` uses the side table to resolve runs for resume operations. This breaks the circular import flagged in the file structure section.

- [ ] **Step 1: Create the side-table migration**

Write to `migrations/0009_mastra_thread_runs.sql`:

```sql
CREATE TABLE IF NOT EXISTS mastra_thread_runs (
  thread_id  VARCHAR PRIMARY KEY REFERENCES roundtable_threads(id) ON DELETE CASCADE,
  run_id     VARCHAR NOT NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'running',  -- running | suspended | completed | failed
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mastra_thread_runs_run_idx ON mastra_thread_runs(run_id);
```

Apply:

```bash
set -a && . ./.env && set +a && \
  psql "$DATABASE_URL" -f migrations/0009_mastra_thread_runs.sql
```

Add to `shared/schema.ts` (near other roundtable tables):

```ts
export const mastraThreadRuns = pgTable("mastra_thread_runs", {
  threadId: varchar("thread_id").primaryKey().references(() => roundtableThreads.id, { onDelete: "cascade" }),
  runId: varchar("run_id").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("running"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  runIdx: index("mastra_thread_runs_run_idx").on(table.runId),
}));
```

- [ ] **Step 2: Implement `turnExecutor.ts`**

Write to `server/services/roundtable/mastra/turnExecutor.ts`:

```ts
/**
 * Per-turn execution: take a selected speaker, call their Mastra Agent,
 * persist the turn, emit events, handle abort. Imported by phaseSteps.ts
 * (so the workflow step can drive turns) and by runtime.ts (so the public
 * API can fire ad-hoc turns if needed).
 */
import { eq } from "drizzle-orm";
import { EventEmitter } from "events";
import { db } from "../../../db";
import { roundtableTurns, roundtableThreads } from "@shared/schema";
import { buildMastraAgent } from "./agentBuilder";
import * as agentPovStore from "../agentPovStore";
import type { PanelMember } from "./selection";

// Per-thread emitters (shared with runtime.ts via this module's exports).
const emitters = new Map<string, EventEmitter>();
export function getEmitter(threadId: string): EventEmitter {
  let e = emitters.get(threadId);
  if (!e) {
    e = new EventEmitter();
    e.setMaxListeners(50);
    emitters.set(threadId, e);
  }
  return e;
}

// Per-thread abort controllers for active turns.
const aborts = new Map<string, AbortController>();
export function getActiveAbort(threadId: string): AbortController | undefined {
  return aborts.get(threadId);
}

function phaseUserPrompt(phase: string): string {
  return `Current phase: ${phase}. Contribute your turn now. Use tools where appropriate.`;
}

export async function runAgentTurnViaMastra(args: {
  threadId: string;
  panelId: string;
  phase: string;
  speaker: PanelMember;
  allMembers: PanelMember[];
  abortSignal?: AbortSignal;
}): Promise<void> {
  const { threadId, panelId, speaker, allMembers, abortSignal } = args;

  // Insert turn shell with status 'streaming'
  const [turn] = await db.insert(roundtableTurns).values({
    threadId,
    panelId,
    speakerKind: "agent",
    agentId: speaker.agentRow.id,
    content: "",
    status: "streaming",
  }).returning();

  const ctrl = new AbortController();
  aborts.set(threadId, ctrl);
  const combinedSignal = abortSignal ?? ctrl.signal;

  try {
    // Just-in-time POV cue card (synthesizer may have updated since panel start)
    const povDoc = await agentPovStore.get(threadId, speaker.agentRow.id);
    const povCueCard = povDoc ? agentPovStore.renderForPrompt(povDoc) : "";

    const freshAgent = buildMastraAgent({
      agentRow: speaker.agentRow,
      kbSnippets: "",  // KB retrieval to be plugged in via gatherKbContext from legacy
      povCueCard,
      allAgents: allMembers.map((m) => m.agentRow),
    });

    const result = await freshAgent.generate(
      [{ role: "user", content: phaseUserPrompt(args.phase) }],
      { abortSignal: combinedSignal } as any,
    );

    await db.update(roundtableTurns)
      .set({ content: result.text, status: "completed", completedAt: new Date() })
      .where(eq(roundtableTurns.id, turn.id));

    getEmitter(threadId).emit("event", "turn-completed", {
      turnId: turn.id,
      agentId: speaker.agentRow.id,
      content: result.text,
    });
  } catch (err) {
    await db.update(roundtableTurns)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(roundtableTurns.id, turn.id));
    throw err;
  } finally {
    aborts.delete(threadId);
  }
}
```

- [ ] **Step 3: Replace the stub `mastra/runtime.ts` with real implementation**

Write to `server/services/roundtable/mastra/runtime.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  roundtableThreads,
  roundtableTurns,
  roundtablePanelAgents,
  roundtableQuestionCards,
  mastraThreadRuns,
} from "@shared/schema";
import type { RoundtableRuntime } from "../runtimeInterface";
import { registerWorkflows } from "./instance";
import { createRoundtableWorkflow } from "./workflow";
import { buildMastraAgent } from "./agentBuilder";
import { getEmitter, getActiveAbort } from "./turnExecutor";
import type { PanelMember } from "./selection";

// Lazy: register workflow once at first use.
let workflow: ReturnType<typeof createRoundtableWorkflow> | null = null;
function getWorkflow() {
  if (!workflow) {
    workflow = createRoundtableWorkflow();
    registerWorkflows({ roundtable: workflow });
  }
  return workflow;
}

// ============================================================================
// Run resolution: thread_id → Mastra run via mastra_thread_runs side table
// ============================================================================

async function recordRun(threadId: string, runId: string, status = "running") {
  await db.insert(mastraThreadRuns)
    .values({ threadId, runId, status })
    .onConflictDoUpdate({
      target: mastraThreadRuns.threadId,
      set: { runId, status, updatedAt: new Date() },
    });
}

async function getRunForThread(threadId: string): Promise<{ runId: string; status: string } | null> {
  const rows = await db.select().from(mastraThreadRuns)
    .where(eq(mastraThreadRuns.threadId, threadId)).limit(1);
  return rows[0] ? { runId: rows[0].runId, status: rows[0].status } : null;
}

async function resumeRunWith(threadId: string, resumeData: any): Promise<void> {
  const mapping = await getRunForThread(threadId);
  if (!mapping) throw new Error(`No Mastra run for thread ${threadId}`);
  const wf = getWorkflow();
  const run = await (wf as any).getRun?.(mapping.runId) ?? await wf.createRun({ runId: mapping.runId });
  await run.resume({ resumeData });
  await db.update(mastraThreadRuns)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(mastraThreadRuns.threadId, threadId));
}

// ============================================================================
// RoundtableRuntime implementation
// ============================================================================

export const mastraRuntime: RoundtableRuntime = {
  async startThread({ userId, panelId, conversationId, title, initialChairMessage }) {
    const [thread] = await db.insert(roundtableThreads).values({
      panelId,
      conversationId: conversationId ?? null,
      title: title ?? "Boardroom session",
      phase: "opening",
    }).returning();

    if (initialChairMessage) {
      await db.insert(roundtableTurns).values({
        threadId: thread.id,
        panelId,
        speakerKind: "user",
        content: initialChairMessage,
        status: "completed",
      });
    }

    const agentRows = await db.select().from(roundtablePanelAgents)
      .where(eq(roundtablePanelAgents.panelId, panelId));
    const members: PanelMember[] = agentRows.map((row) => ({
      agentRow: row,
      mastraAgent: buildMastraAgent({
        agentRow: row,
        kbSnippets: "",
        povCueCard: "",
        allAgents: agentRows,
      }),
    }));

    const wf = getWorkflow();
    const run = await wf.createRun({});
    await recordRun(thread.id, (run as any).runId ?? (run as any).id);

    run.start({
      inputData: { threadId: thread.id, panelId, panelMembers: members },
    }).catch((err) => {
      console.error("[MastraRuntime] workflow run errored:", err);
      db.update(mastraThreadRuns)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(mastraThreadRuns.threadId, thread.id))
        .catch(() => {});
    });

    return thread;
  },

  async setPhase(threadId, phase, userId) {
    await resumeRunWith(threadId, { phase });
  },

  async acceptPhaseProposal(threadId, cardId, userId) {
    await db.update(roundtableQuestionCards)
      .set({ status: "accepted", updatedAt: new Date() } as any)
      .where(eq(roundtableQuestionCards.id, cardId));
    await resumeRunWith(threadId, { accepted: true });
  },

  async rejectPhaseProposal(threadId, cardId, userId) {
    await db.update(roundtableQuestionCards)
      .set({ status: "rejected", updatedAt: new Date() } as any)
      .where(eq(roundtableQuestionCards.id, cardId));
    await resumeRunWith(threadId, { accepted: false });
  },

  async submitChairMessage(threadId, content, userId) {
    const [thread] = await db.select().from(roundtableThreads)
      .where(eq(roundtableThreads.id, threadId)).limit(1);
    if (!thread) throw new Error("thread not found");
    await db.insert(roundtableTurns).values({
      threadId,
      panelId: thread.panelId,
      speakerKind: "user",
      content,
      status: "completed",
    });
    getEmitter(threadId).emit("event", "chair-message", { content });
  },

  async answerOpenQuestion(threadId, cardId, content, userId) {
    // Persist the answer on the question card.
    await db.update(roundtableQuestionCards)
      .set({
        answerContent: content,
        answeredAt: new Date(),
        answeredByUserId: userId,
        status: "answered",
      } as any)
      .where(eq(roundtableQuestionCards.id, cardId));

    // Also surface as a chair message turn so the agent loop sees it
    // in threadContext on the next proposal round.
    const [thread] = await db.select().from(roundtableThreads)
      .where(eq(roundtableThreads.id, threadId)).limit(1);
    if (!thread) throw new Error("thread not found");
    await db.insert(roundtableTurns).values({
      threadId,
      panelId: thread.panelId,
      speakerKind: "user",
      content,
      status: "completed",
    });
    getEmitter(threadId).emit("event", "open-question-answered", { cardId, content });
  },

  async cancelTurn(threadId, userId) {
    const ctrl = getActiveAbort(threadId);
    ctrl?.abort();
  },

  async pause(threadId, userId) {
    // Set a workflow state flag via Mastra's state-update mechanism.
    // For v1, signal pause through the side table; phaseSteps' inner loop
    // exits on next iteration when it observes the flag.
    await db.update(mastraThreadRuns)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(mastraThreadRuns.threadId, threadId));
  },

  async resume(threadId, userId) {
    await db.update(mastraThreadRuns)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(mastraThreadRuns.threadId, threadId));
  },

  subscribe(threadId, listener) {
    const emitter = getEmitter(threadId);
    const onAny = (event: string, data: any) => listener(event, data);
    emitter.on("event", onAny);
    return () => emitter.off("event", onAny);
  },
};
```

- [ ] **Step 4: Typecheck + run all tests**

```bash
npx tsc --noEmit 2>&1 | grep -E "mastra/(runtime|turnExecutor)\.ts" | head
set -a && . ./.env && set +a && npx vitest run server/services/roundtable/
```

Expected: typecheck clean for new files; tests still pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/mastra/turnExecutor.ts \
        server/services/roundtable/mastra/runtime.ts \
        migrations/0009_mastra_thread_runs.sql \
        shared/schema.ts
git commit -m "feat(roundtable): MastraRoundtableRuntime + turnExecutor + thread→run side table"
```

**Implementer notes:**
- The Mastra run-resolution code (`(wf as any).getRun?.(...)`) accommodates two possible Mastra APIs. If the installed version exposes a different name, adjust accordingly. The side table is the durable mapping; the Mastra-side run object is just the resume target.
- The columns `roundtable_question_cards.status`, `answer_content`, `answered_at`, `answered_by_user_id` are referenced — verify they exist in the current schema. If they don't, fall back to the existing answered/closed semantics in that table (whichever names actually exist).
- If the implementer hits real divergence vs. the snippets above (e.g., Mastra `Workflow.createRun` signature differs), report DONE_WITH_CONCERNS rather than guessing.

---

## Task 16: `persistence.ts` — already covered by Task 1's Mastra constructor

(No separate file needed; the `PostgresStore` was wired in Task 1's `instance.ts`. This task slot is reserved if the implementer finds Mastra needs additional persistence wiring — e.g., a side table for thread→run mapping. If so, create `mastra/persistence.ts` here for the side table + helpers.)

---

## Task 17: `createPanel` reads `ROUNDTABLE_DEFAULT_RUNTIME`

**Files:**
- Modify: `server/services/roundtable/roundtablePanelService.ts`

- [ ] **Step 1: Find `createPanel` in `roundtablePanelService.ts`**

```bash
grep -n "function createPanel\|export.*createPanel" server/services/roundtable/roundtablePanelService.ts
```

- [ ] **Step 2: Modify the insert to set `runtime`**

Inside `createPanel`, find the `db.insert(roundtablePanels).values({...})` call. Add:

```ts
const defaultRuntime = process.env.ROUNDTABLE_DEFAULT_RUNTIME === "mastra" ? "mastra" : "legacy";
// Then in the values:
const [panel] = await db.insert(roundtablePanels).values({
  // ... existing fields ...
  runtime: defaultRuntime,
}).returning();
```

- [ ] **Step 3: Run all tests**

```bash
set -a && . ./.env && set +a && npx vitest run server/services/roundtable/
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add server/services/roundtable/roundtablePanelService.ts
git commit -m "feat(roundtable): createPanel stamps runtime from ROUNDTABLE_DEFAULT_RUNTIME"
```

---

## Task 18: Integration test — full Mastra panel run

**Files:**
- Create: `server/services/roundtable/mastra/__tests__/integration.test.ts`

This test exercises the full Mastra runtime against a real Postgres + mocked LLM.

- [ ] **Step 1: Write the integration test**

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../../../../db";
import {
  roundtablePanels,
  roundtablePanelAgents,
  roundtableThreads,
  roundtableTurns,
} from "@shared/schema";
import { eq } from "drizzle-orm";

// Mock the model client to return deterministic responses.
vi.mock("../modelClient", () => ({
  buildModelClient: () => ({
    specificationVersion: "v2",
    provider: "test",
    modelId: "test",
    async doGenerate(opts: any) {
      // Inspect last user message; return JSON for proposal calls,
      // a normal response otherwise.
      const last = opts.prompt?.slice(-1)[0]?.content ?? "";
      const text = String(last).includes("shouldSpeak")
        ? '{"shouldSpeak":true,"draftHeadline":"I have a point"}'
        : "Test agent response.";
      return {
        text,
        usage: { promptTokens: 10, completionTokens: 10 },
        finishReason: "stop",
      };
    },
    doStream: () => { throw new Error("not implemented"); },
  }),
}));

import { mastraRuntime } from "../runtime";

describe("Mastra runtime integration", () => {
  let panelId: string;
  let auditorId: string;
  let modId: string;
  let threadId: string;
  const userId = "test-user-mastra-integration";

  beforeAll(async () => {
    // Insert a throwaway user (FK target for roundtable_panels.user_id).
    // The existing synthesizer integration test does the same dance.
    const { users } = await import("@shared/schema");
    await db.insert(users).values({
      id: userId,
      email: `${userId}@test.local`,
      passwordHash: "test",
    } as any).onConflictDoNothing();

    const [panel] = await db.insert(roundtablePanels)
      .values({ userId, name: "mastra-test", description: "", isTemplate: false, runtime: "mastra" })
      .returning();
    panelId = panel.id;
    const [auditor] = await db.insert(roundtablePanelAgents)
      .values({ panelId, name: "Auditor", systemPrompt: "audit", model: "mini",
               useBaseKnowledge: true, position: 0 }).returning();
    const [mod] = await db.insert(roundtablePanelAgents)
      .values({ panelId, name: "Moderator", systemPrompt: "mod", model: "mini",
               useBaseKnowledge: true, position: 1, createdFromTemplate: "moderator-bot" }).returning();
    auditorId = auditor.id;
    modId = mod.id;
  });

  afterAll(async () => {
    if (threadId) await db.delete(roundtableTurns).where(eq(roundtableTurns.threadId, threadId));
    if (threadId) await db.delete(roundtableThreads).where(eq(roundtableThreads.id, threadId));
    await db.delete(roundtablePanelAgents).where(eq(roundtablePanelAgents.panelId, panelId));
    await db.delete(roundtablePanels).where(eq(roundtablePanels.id, panelId));
  });

  it("starts a thread, runs at least one turn, and persists it", async () => {
    const thread = await mastraRuntime.startThread({
      userId, panelId,
      title: "test thread",
      initialChairMessage: "Discuss demerger tax implications.",
    });
    threadId = thread.id;
    expect(thread.id).toBeTruthy();

    // Wait briefly for the workflow to run a turn (or two).
    await new Promise((r) => setTimeout(r, 5000));

    const turns = await db.select().from(roundtableTurns)
      .where(eq(roundtableTurns.threadId, threadId));
    // At least the chair message + one agent turn
    expect(turns.length).toBeGreaterThanOrEqual(2);
    const agentTurns = turns.filter((t) => t.speakerKind === "agent");
    expect(agentTurns.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the integration test**

```bash
set -a && . ./.env && set +a && \
  npx vitest run server/services/roundtable/mastra/__tests__/integration.test.ts
```

Expected: passes. If Mastra workflow run resolution isn't working (Task 15 gap), this test will fail with a clear error pointing at the missing API. Implementer addresses then re-runs.

- [ ] **Step 3: Commit**

```bash
git add server/services/roundtable/mastra/__tests__/integration.test.ts
git commit -m "test(roundtable): Mastra integration test (real DB, mocked LLM)"
```

---

## Task 19: Smoke test — both runtimes start a thread

**Files:**
- Create: `server/services/roundtable/__tests__/dispatcher.smoke.test.ts`

Full memo-level parity testing requires too much scripted scaffolding to specify line-by-line; defer to manual E2E for that. What we CAN test mechanically: both runtimes implement the interface, the dispatcher routes correctly per `panel.runtime`, and a thread can be started on each.

- [ ] **Step 1: Implement the smoke test**

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../../../db";
import {
  roundtablePanels,
  roundtablePanelAgents,
  roundtableThreads,
  roundtableTurns,
} from "@shared/schema";
import { eq } from "drizzle-orm";

vi.mock("../mastra/modelClient", () => ({
  buildModelClient: () => ({
    specificationVersion: "v2",
    provider: "test",
    modelId: "test",
    async doGenerate() {
      return {
        text: '{"shouldSpeak":false}',
        usage: { promptTokens: 0, completionTokens: 0 },
        finishReason: "stop",
      };
    },
    doStream: () => { throw new Error("not implemented"); },
  }),
}));

import { getRuntimeForPanel } from "../runtimeDispatcher";

describe("dispatcher smoke", () => {
  const userId = "test-user-dispatcher-smoke";
  let legacyPanelId: string;
  let mastraPanelId: string;

  beforeAll(async () => {
    const { users } = await import("@shared/schema");
    await db.insert(users).values({
      id: userId, email: `${userId}@test.local`, passwordHash: "test",
    } as any).onConflictDoNothing();

    const [legacy] = await db.insert(roundtablePanels).values({
      userId, name: "legacy-smoke", description: "", isTemplate: false, runtime: "legacy",
    }).returning();
    legacyPanelId = legacy.id;
    await db.insert(roundtablePanelAgents).values({
      panelId: legacyPanelId, name: "Auditor", systemPrompt: "audit", model: "mini",
      useBaseKnowledge: true, position: 0,
    });

    const [mastra] = await db.insert(roundtablePanels).values({
      userId, name: "mastra-smoke", description: "", isTemplate: false, runtime: "mastra",
    }).returning();
    mastraPanelId = mastra.id;
    await db.insert(roundtablePanelAgents).values({
      panelId: mastraPanelId, name: "Auditor", systemPrompt: "audit", model: "mini",
      useBaseKnowledge: true, position: 0,
    });
  });

  afterAll(async () => {
    for (const pid of [legacyPanelId, mastraPanelId]) {
      const threadIds = (await db.select({ id: roundtableThreads.id })
        .from(roundtableThreads).where(eq(roundtableThreads.panelId, pid))).map(r => r.id);
      for (const tid of threadIds) {
        await db.delete(roundtableTurns).where(eq(roundtableTurns.threadId, tid));
      }
      await db.delete(roundtableThreads).where(eq(roundtableThreads.panelId, pid));
      await db.delete(roundtablePanelAgents).where(eq(roundtablePanelAgents.panelId, pid));
      await db.delete(roundtablePanels).where(eq(roundtablePanels.id, pid));
    }
  });

  it("dispatcher returns the legacy runtime for legacy panel", async () => {
    const r = await getRuntimeForPanel(legacyPanelId);
    expect(r).toBeDefined();
    expect(typeof r.startThread).toBe("function");
    expect(typeof r.setPhase).toBe("function");
  });

  it("dispatcher returns the Mastra runtime for mastra panel", async () => {
    const r = await getRuntimeForPanel(mastraPanelId);
    expect(r).toBeDefined();
    expect(typeof r.startThread).toBe("function");
    expect(typeof r.setPhase).toBe("function");
  });

  it("Mastra runtime can start a thread without erroring", async () => {
    const r = await getRuntimeForPanel(mastraPanelId);
    const thread = await r.startThread({
      userId, panelId: mastraPanelId, title: "smoke",
    });
    expect(thread.id).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
set -a && . ./.env && set +a && \
  npx vitest run server/services/roundtable/__tests__/dispatcher.smoke.test.ts
```

Expected: 3 tests pass. If the third (Mastra startThread) fails, that's a real issue with Task 15's runtime — fix iteratively.

- [ ] **Step 3: Commit**

```bash
git add server/services/roundtable/__tests__/dispatcher.smoke.test.ts
git commit -m "test(roundtable): dispatcher smoke test (both runtimes start cleanly)"
```

**Note on full memo-level parity:** Scripting both runtimes through six phases with deterministic chair advances and asserting structural memo parity is genuinely complex (depends on Mastra's run-resolution APIs, real chair-advance timing, etc.). Manual E2E by Mohammed + Sai on the corporate-demerger scenario covers this empirically and is the documented verification gate in the spec. Adding an automated parity test is a follow-up after the manual E2E gives confidence.

---

## Task 20: Documentation update

**Files:**
- Modify: `docs/superpowers/specs/2026-04-29-roundtable-mastra-migration-design.md` — flip status

- [ ] **Step 1: Update spec status**

```bash
sed -i 's/^Status: Draft.*$/Status: Implemented (flag-gated; see plan 2026-04-29-roundtable-mastra-migration.md)/' \
  docs/superpowers/specs/2026-04-29-roundtable-mastra-migration-design.md
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-29-roundtable-mastra-migration-design.md
git commit -m "docs(roundtable): mark Mastra migration spec as implemented"
```

---

## Spec coverage check

| Spec section | Implementation task |
|---|---|
| `runtime` column on `roundtable_panels` | Task 2 |
| `RoundtableRuntime` interface (the seam) | Task 3 |
| `legacyRuntime.ts` wrapper | Task 4 |
| `runtimeDispatcher.ts` | Task 4 |
| Routes use dispatcher | Task 5 |
| `modelClient.ts` (preserves cost-tier fallback) | Task 6 |
| `agentBuilder.ts` | Task 7 |
| Tools (askPanelist, proposePhaseTransition, cedeFloor, startSideThread) | Tasks 8–11 |
| `selection.ts` | Task 12 |
| `phaseSteps.ts` (loop + suspend/resume + chair-mid-loop cooperation) | Task 13 |
| `workflow.ts` (6-step assembly) | Task 14 |
| `runtime.ts` (`MastraRoundtableRuntime`) | Task 15 |
| Mastra storage adapter | Task 1 + 16 |
| `createPanel` stamps `runtime` from env | Task 17 |
| Integration test | Task 18 |
| Parity test (full memo-level) | Manual E2E only — automated parity is a follow-up. Task 19 covers a smoke test (dispatcher + startThread). |
| Spec status update | Task 20 |
| Synthesizer dispatch (`addSynthesizerJob` after each turn) | Task 13 (in phase step body) |
| Chair-mid-loop cooperative advance | Task 13 (`phaseShouldEnd` reads workflow state) |
| Recovery endpoint (`/api/roundtable/threads/:id/recover`) | Out of scope per spec; optional follow-up |
| Real streaming via `agent.stream()` | Out of scope per spec |
| One-shot legacy panel migration | Out of scope per spec |

## Notes for the executor

- **Carve-outs for shared helpers (Tasks 7, 8–11) are intentional** — extracting `buildAgentSystemPrompt` and the four tool resolvers from the legacy runtime is acceptable because both runtimes need them. This is the only legacy-runtime modification permitted.
- **Mastra API drift is the largest single risk.** If the installed `@mastra/core` types differ from the snippets in this plan (possible — Mastra is at 1.0 + 3 months), adapt to actual installed signatures and report any deviations as DONE_WITH_CONCERNS.
- **Task 15 is the most complex.** If `getRunsByMetadata` (or its installed-version equivalent) isn't available, add a side table `mastra_thread_runs(thread_id, run_id, status)` and helpers in `mastra/persistence.ts` (Task 16's reserved slot).
- **Integration test (Task 18) failures probably indicate a real bug in Task 15** — don't paper over with mocks; iterate on `runtime.ts` until the integration test runs an end-to-end turn.
- **TDD discipline applies to Tasks 4, 6, 7, 8–12 (red phase before green)**. Tasks 13–15 are integration-heavy; lean on the integration test in Task 18 rather than per-task unit tests.
- All commits use the convention `feat(roundtable): ...`, `test(roundtable): ...`, `docs(roundtable): ...`. No Co-Authored-By trailer (per the user's repo memory).
