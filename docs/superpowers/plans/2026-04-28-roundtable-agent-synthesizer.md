# Roundtable Agent POV Synthesizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a per-agent isolated POV document system for the boardroom roundtable, where a background "synthesizer" subworker maintains each agent's perspective on the broader conversation (other agents' positions, Q&A history with peers and chair, glossary, open threads), updated after every panel turn and injected into the agent's system prompt before they speak.

**Architecture:** A new Drizzle table (`agent_pov_documents`) stores structured JSONB sections per (thread, agent). After every panel turn, `runAgentTurn`'s finally block enqueues a Bull job per panel agent (speaker included). Each job fetches turns since the agent's last sync, calls a cheap-tier model in JSON mode via the existing `aiProviderRegistry`, and upserts the new POV with optimistic-locking. Before any agent speaks, `buildAgentSystemPrompt` fetches that agent's POV from the store (cache-layered) and injects it as a structured prompt block alongside the existing last-N raw turns. Behind feature flag `ROUNDTABLE_SYNTHESIZER_ENABLED`.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, Bull + ioredis (existing `hybridJobQueue`), `aiProviderRegistry` (existing provider abstraction), `CacheService` (existing `hybridCache`), Vitest.

---

## Spec reference

Design spec at [docs/superpowers/specs/2026-04-28-roundtable-agent-synthesizer-design.md](../specs/2026-04-28-roundtable-agent-synthesizer-design.md). Read this before starting.

## Existing code touchpoints

The codebase has anticipated this swap. Relevant existing structure:

- `server/services/roundtable/roundtableRuntime.ts:227` — `agentPOVs: Map<string, string>` in `ThreadRuntime`, a rule-based in-memory POV. Comment at line 1311 says: "Replaced by the LLM synthesizer in a later phase; the Map interface is identical so the swap is a one-function change."
- `server/services/roundtable/roundtableRuntime.ts:1336` — current write site (writes a `## My Position` string to the map after each turn).
- `server/services/roundtable/roundtableRuntime.ts:1352` — `buildOtherAgentsCueCard()` reads from the map for prompt injection.
- `server/services/roundtable/roundtableRuntime.ts:1380` — `buildAgentSystemPrompt()` consumes the cue card.
- `server/services/roundtable/roundtableRuntime.ts:1535` — `runAgentTurn()` is where new turns happen; its finally block is where we dispatch synth jobs.

Strategy: keep the existing rule-based path (legacy fallback when flag is off), introduce the new persistent system in parallel, switch via feature flag.

## File structure

```
migrations/0007_agent_pov_documents.sql                 (NEW)
shared/schema.ts                                        (MODIFY: add agentPovDocuments)
server/services/roundtable/agentPovStore.ts             (NEW: ~150 LOC)
server/services/roundtable/agentPovStore.test.ts        (NEW: vitest)
server/services/roundtable/agentSynthesizer.ts          (NEW: ~250 LOC)
server/services/roundtable/agentSynthesizer.test.ts     (NEW: vitest)
server/services/roundtable/synthesizerJob.ts            (NEW: ~80 LOC)
server/services/roundtable/synthesizerJob.test.ts       (NEW: vitest)
server/services/hybridJobQueue.ts                       (MODIFY: register queue, export addSynthesizerJob)
server/services/roundtable/roundtableRuntime.ts         (MODIFY: 2 surgical edits)
```

Each new file has one responsibility:
- `agentPovStore.ts` — CRUD layer with optimistic lock + cache + prompt rendering
- `agentSynthesizer.ts` — synthesis logic: prompt builder, model call, JSON parse, compaction
- `synthesizerJob.ts` — Bull queue registration + processor that calls the synthesizer

---

## Task 1: Drizzle schema + migration

**Files:**
- Modify: `shared/schema.ts` (append a new table block near other roundtable tables, around line 1909)
- Create: `migrations/0007_agent_pov_documents.sql`

- [ ] **Step 1: Add schema block to `shared/schema.ts`**

Find the section with `roundtablePanelAgentKbDocs` (around line 1905). Append this block AFTER it (do NOT modify any existing tables):

```ts
// =============================================================================
// Per-agent POV documents (synthesizer output). One row per (thread, agent).
// Maintained by a background "synthesizer" subworker that summarises the
// broader roundtable conversation from this agent's POV.
// =============================================================================
export const agentPovDocuments = pgTable("agent_pov_documents", {
  threadId: varchar("thread_id").notNull().references(() => roundtableThreads.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id").notNull().references(() => roundtablePanelAgents.id, { onDelete: "cascade" }),
  selfPosition: jsonb("self_position").notNull().default({}),         // { stance, conclusions[] }
  othersSummary: jsonb("others_summary").notNull().default({}),       // { [agentName]: summary }
  outgoingQa: jsonb("outgoing_qa").notNull().default([]),             // [{ to, question, answer, turnId }]
  incomingQa: jsonb("incoming_qa").notNull().default([]),             // [{ from, question, answer, turnId }]
  chairQa: jsonb("chair_qa").notNull().default([]),                   // [{ direction, text, answer, turnId }]
  openThreads: jsonb("open_threads").notNull().default([]),           // [{ description, awaitingFrom, turnId }]
  glossary: jsonb("glossary").notNull().default({}),                  // { [term]: definition }
  lastSynthesizedTurnId: varchar("last_synthesized_turn_id"),
  tokenCount: integer("token_count").notNull().default(0),
  version: integer("version").notNull().default(1),
  lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
}, (table) => ({
  pk: uniqueIndex("agent_pov_documents_pk").on(table.threadId, table.agentId),
  threadIdx: index("agent_pov_documents_thread_idx").on(table.threadId),
}));

export type AgentPovDocument = typeof agentPovDocuments.$inferSelect;
export type InsertAgentPovDocument = typeof agentPovDocuments.$inferInsert;
```

- [ ] **Step 2: Create the SQL migration**

Write to `migrations/0007_agent_pov_documents.sql`:

```sql
-- ============================================================================
-- Per-agent POV documents (synthesizer output).
-- One row per (thread, agent). Maintained by a background "synthesizer"
-- subworker that summarises the broader roundtable conversation from this
-- agent's POV. Replaces the in-memory rule-based POV map under feature flag
-- ROUNDTABLE_SYNTHESIZER_ENABLED.
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_pov_documents (
  thread_id                 VARCHAR NOT NULL REFERENCES roundtable_threads(id) ON DELETE CASCADE,
  agent_id                  VARCHAR NOT NULL REFERENCES roundtable_panel_agents(id) ON DELETE CASCADE,
  self_position             JSONB   NOT NULL DEFAULT '{}'::jsonb,
  others_summary            JSONB   NOT NULL DEFAULT '{}'::jsonb,
  outgoing_qa               JSONB   NOT NULL DEFAULT '[]'::jsonb,
  incoming_qa               JSONB   NOT NULL DEFAULT '[]'::jsonb,
  chair_qa                  JSONB   NOT NULL DEFAULT '[]'::jsonb,
  open_threads              JSONB   NOT NULL DEFAULT '[]'::jsonb,
  glossary                  JSONB   NOT NULL DEFAULT '{}'::jsonb,
  last_synthesized_turn_id  VARCHAR,
  token_count               INTEGER NOT NULL DEFAULT 0,
  version                   INTEGER NOT NULL DEFAULT 1,
  last_updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_pov_documents_pk ON agent_pov_documents(thread_id, agent_id);
CREATE INDEX IF NOT EXISTS agent_pov_documents_thread_idx ON agent_pov_documents(thread_id);
```

- [ ] **Step 3: Run typecheck to verify schema imports compile**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors). If `uniqueIndex` is not imported in `shared/schema.ts`, add it to the existing drizzle-orm/pg-core import at the top of the file.

- [ ] **Step 4: Apply the migration locally**

Run: `npm run db:push`
Expected: Drizzle confirms `agent_pov_documents` table created.

- [ ] **Step 5: Commit**

```bash
git add shared/schema.ts migrations/0007_agent_pov_documents.sql
git commit -m "feat(roundtable): add agent_pov_documents table for synthesizer"
```

---

## Task 2: agentPovStore — get + getOrInit

**Files:**
- Create: `server/services/roundtable/agentPovStore.ts`
- Test: `server/services/roundtable/agentPovStore.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `server/services/roundtable/agentPovStore.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks (must be inline because vitest hoists vi.mock above imports)
vi.mock("../../db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("../hybridCache", () => ({
  default: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  CacheService: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

import { CacheService } from "../hybridCache";
import { db } from "../../db";
import * as store from "./agentPovStore";

describe("agentPovStore.get", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when row does not exist and not cached", async () => {
    (CacheService.get as any).mockResolvedValue(null);
    (db.select as any).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    });
    const result = await store.get("thread1", "agent1");
    expect(result).toBeNull();
  });

  it("returns cached value without DB call when cache hit", async () => {
    const cached = { threadId: "t", agentId: "a", version: 3 };
    (CacheService.get as any).mockResolvedValue(cached);
    const result = await store.get("t", "a");
    expect(result).toEqual(cached);
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe("agentPovStore.getOrInit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts and returns an empty doc when none exists", async () => {
    (CacheService.get as any).mockResolvedValue(null);
    (db.select as any).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    });
    const inserted = {
      threadId: "t", agentId: "a", version: 1,
      selfPosition: {}, othersSummary: {}, outgoingQa: [], incomingQa: [],
      chairQa: [], openThreads: [], glossary: {},
      lastSynthesizedTurnId: null, tokenCount: 0,
      lastUpdatedAt: new Date(),
    };
    (db.insert as any).mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve([inserted]),
        }),
      }),
    });
    const result = await store.getOrInit("t", "a");
    expect(result.threadId).toBe("t");
    expect(result.version).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/services/roundtable/agentPovStore.test.ts`
Expected: FAIL with "Cannot find module './agentPovStore'" or "store.get is not a function".

- [ ] **Step 3: Write minimal implementation**

Write to `server/services/roundtable/agentPovStore.ts`:

```ts
/**
 * Per-agent POV document store. Cache-layered (Redis → Postgres) with
 * optimistic locking via `version` column. Used by the synthesizer subworker
 * (write) and by buildAgentSystemPrompt (read).
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { agentPovDocuments, type AgentPovDocument } from "@shared/schema";
import { CacheService } from "../hybridCache";

const CACHE_TTL_SECONDS = 60;

function cacheKey(threadId: string, agentId: string): string {
  return `roundtable:pov:${threadId}:${agentId}`;
}

export async function get(threadId: string, agentId: string): Promise<AgentPovDocument | null> {
  const cached = await CacheService.get<AgentPovDocument>(cacheKey(threadId, agentId));
  if (cached) return cached;

  const rows = await db
    .select()
    .from(agentPovDocuments)
    .where(and(eq(agentPovDocuments.threadId, threadId), eq(agentPovDocuments.agentId, agentId)))
    .limit(1);

  const doc = rows[0] ?? null;
  if (doc) {
    await CacheService.set(cacheKey(threadId, agentId), doc, CACHE_TTL_SECONDS);
  }
  return doc;
}

export async function getOrInit(threadId: string, agentId: string): Promise<AgentPovDocument> {
  const existing = await get(threadId, agentId);
  if (existing) return existing;

  const inserted = await db
    .insert(agentPovDocuments)
    .values({ threadId, agentId })
    .onConflictDoNothing({ target: [agentPovDocuments.threadId, agentPovDocuments.agentId] })
    .returning();

  if (inserted[0]) {
    await CacheService.set(cacheKey(threadId, agentId), inserted[0], CACHE_TTL_SECONDS);
    return inserted[0];
  }

  // Conflict: someone else inserted concurrently. Re-fetch.
  const reread = await get(threadId, agentId);
  if (!reread) {
    throw new Error(`Failed to init POV doc for ${threadId}/${agentId}`);
  }
  return reread;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/services/roundtable/agentPovStore.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/agentPovStore.ts server/services/roundtable/agentPovStore.test.ts
git commit -m "feat(roundtable): add agentPovStore.get + getOrInit with cache"
```

---

## Task 3: agentPovStore — upsert with optimistic locking

**Files:**
- Modify: `server/services/roundtable/agentPovStore.ts`
- Modify: `server/services/roundtable/agentPovStore.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `server/services/roundtable/agentPovStore.test.ts`:

```ts
describe("agentPovStore.upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds when expectedVersion matches current version", async () => {
    const updated = {
      threadId: "t", agentId: "a", version: 2,
      selfPosition: { stance: "x" }, othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [], glossary: {},
      lastSynthesizedTurnId: "turn1", tokenCount: 50,
      lastUpdatedAt: new Date(),
    };
    (db.update as any).mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([updated]),
        }),
      }),
    });
    const result = await store.upsert({
      threadId: "t",
      agentId: "a",
      expectedVersion: 1,
      patch: { selfPosition: { stance: "x" }, lastSynthesizedTurnId: "turn1" },
    });
    expect(result.version).toBe(2);
    expect(CacheService.del).toHaveBeenCalledWith("roundtable:pov:t:a");
  });

  it("throws StaleVersionError when expectedVersion does not match", async () => {
    (db.update as any).mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    });
    await expect(
      store.upsert({
        threadId: "t",
        agentId: "a",
        expectedVersion: 1,
        patch: { selfPosition: { stance: "x" } },
      }),
    ).rejects.toThrow("StaleVersionError");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/services/roundtable/agentPovStore.test.ts`
Expected: FAIL with "store.upsert is not a function".

- [ ] **Step 3: Add upsert + StaleVersionError to implementation**

Append to `server/services/roundtable/agentPovStore.ts`:

```ts
export class StaleVersionError extends Error {
  constructor(threadId: string, agentId: string, expectedVersion: number) {
    super(
      `StaleVersionError: POV doc for ${threadId}/${agentId} expected version ${expectedVersion} but DB version differed`,
    );
    this.name = "StaleVersionError";
  }
}

export interface PovPatch {
  selfPosition?: Record<string, any>;
  othersSummary?: Record<string, any>;
  outgoingQa?: any[];
  incomingQa?: any[];
  chairQa?: any[];
  openThreads?: any[];
  glossary?: Record<string, any>;
  lastSynthesizedTurnId?: string | null;
  tokenCount?: number;
}

export async function upsert(args: {
  threadId: string;
  agentId: string;
  expectedVersion: number;
  patch: PovPatch;
}): Promise<AgentPovDocument> {
  const { threadId, agentId, expectedVersion, patch } = args;

  const updated = await db
    .update(agentPovDocuments)
    .set({
      ...patch,
      version: sql`${agentPovDocuments.version} + 1`,
      lastUpdatedAt: new Date(),
    })
    .where(
      and(
        eq(agentPovDocuments.threadId, threadId),
        eq(agentPovDocuments.agentId, agentId),
        eq(agentPovDocuments.version, expectedVersion),
      ),
    )
    .returning();

  if (updated.length === 0) {
    throw new StaleVersionError(threadId, agentId, expectedVersion);
  }

  // Invalidate cache so next read sees the new version.
  await CacheService.del(cacheKey(threadId, agentId));
  return updated[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/services/roundtable/agentPovStore.test.ts`
Expected: PASS, all four tests green.

- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/agentPovStore.ts server/services/roundtable/agentPovStore.test.ts
git commit -m "feat(roundtable): agentPovStore.upsert with optimistic version lock"
```

---

## Task 4: agentPovStore — renderForPrompt

**Files:**
- Modify: `server/services/roundtable/agentPovStore.ts`
- Modify: `server/services/roundtable/agentPovStore.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `server/services/roundtable/agentPovStore.test.ts`:

```ts
describe("agentPovStore.renderForPrompt", () => {
  it("returns empty-perspective marker when doc is empty", () => {
    const doc: any = {
      selfPosition: {}, othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [], glossary: {},
      lastSynthesizedTurnId: null,
    };
    const text = store.renderForPrompt(doc);
    expect(text).toContain("YOUR PERSPECTIVE");
    expect(text).toContain("(no prior perspective");
  });

  it("renders all sections with content", () => {
    const doc: any = {
      selfPosition: { stance: "Impairment trigger met under Ind AS 36.59." },
      othersSummary: { Auditor: "Focused on going-concern; flagged 8mo runway." },
      outgoingQa: [{ to: "Auditor", question: "Cash runway?", answer: "8 months", turnId: "t1" }],
      incomingQa: [{ from: "Compliance", question: "When does window close?", answer: "24h", turnId: "t2" }],
      chairQa: [{ direction: "from", text: "Cite paragraph?", answer: "Ind AS 36.59", turnId: "t3" }],
      openThreads: [{ description: "Awaiting DA's revised VIU", awaitingFrom: "DevilsAdvocate", turnId: "t4" }],
      glossary: { Entity: "NovaPlast Ltd", Asset: "Plant 3 (Pune)" },
      lastSynthesizedTurnId: "t4",
    };
    const text = store.renderForPrompt(doc);
    expect(text).toContain("Impairment trigger met");
    expect(text).toContain("Auditor:");
    expect(text).toContain("8 months");
    expect(text).toContain("NovaPlast");
    expect(text).toContain("synced through turn t4");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/services/roundtable/agentPovStore.test.ts`
Expected: FAIL with "store.renderForPrompt is not a function".

- [ ] **Step 3: Implement renderForPrompt**

Append to `server/services/roundtable/agentPovStore.ts`:

```ts
function isObjectEmpty(obj: Record<string, any>): boolean {
  return !obj || Object.keys(obj).length === 0;
}

export function renderForPrompt(doc: AgentPovDocument): string {
  const lines: string[] = [];
  const synced = doc.lastSynthesizedTurnId
    ? `synced through turn ${doc.lastSynthesizedTurnId}`
    : "no prior perspective; this is your first time speaking";

  lines.push(`=== YOUR PERSPECTIVE (${synced}) ===`);

  const sp = (doc.selfPosition ?? {}) as { stance?: string; conclusions?: string[] };
  if (sp.stance || (sp.conclusions && sp.conclusions.length > 0)) {
    lines.push("\nYOUR POSITION:");
    if (sp.stance) lines.push(sp.stance);
    if (sp.conclusions && sp.conclusions.length > 0) {
      for (const c of sp.conclusions) lines.push(`- ${c}`);
    }
  }

  const others = (doc.othersSummary ?? {}) as Record<string, string>;
  if (!isObjectEmpty(others)) {
    lines.push("\nWHAT OTHERS HAVE SAID:");
    for (const [name, summary] of Object.entries(others)) {
      lines.push(`- ${name}: ${summary}`);
    }
  }

  const outgoing = (doc.outgoingQa ?? []) as Array<{ to: string; question: string; answer: string }>;
  if (outgoing.length > 0) {
    lines.push("\nQUESTIONS YOU ASKED OTHERS:");
    for (const qa of outgoing) lines.push(`- To ${qa.to}: "${qa.question}" → "${qa.answer}"`);
  }

  const incoming = (doc.incomingQa ?? []) as Array<{ from: string; question: string; answer: string }>;
  if (incoming.length > 0) {
    lines.push("\nQUESTIONS ASKED OF YOU:");
    for (const qa of incoming) lines.push(`- From ${qa.from}: "${qa.question}" → You: "${qa.answer}"`);
  }

  const chair = (doc.chairQa ?? []) as Array<{ direction: "to" | "from"; text: string; answer: string }>;
  if (chair.length > 0) {
    lines.push("\nCHAIR Q&A:");
    for (const qa of chair) {
      if (qa.direction === "from") {
        lines.push(`- Chair → You: "${qa.text}" → You: "${qa.answer}"`);
      } else {
        lines.push(`- You → Chair: "${qa.text}" → Chair: "${qa.answer}"`);
      }
    }
  }

  const open = (doc.openThreads ?? []) as Array<{ description: string; awaitingFrom?: string }>;
  if (open.length > 0) {
    lines.push("\nOPEN THREADS:");
    for (const o of open) {
      const await_ = o.awaitingFrom ? ` (awaiting ${o.awaitingFrom})` : "";
      lines.push(`- ${o.description}${await_}`);
    }
  }

  const glossary = (doc.glossary ?? {}) as Record<string, string>;
  if (!isObjectEmpty(glossary)) {
    lines.push("\nKEY FACTS:");
    for (const [term, def] of Object.entries(glossary)) {
      lines.push(`- ${term}: ${def}`);
    }
  }

  if (lines.length === 1) {
    // Only the header — empty doc.
    lines.push("\n(no prior perspective; this is your first time speaking)");
  }

  lines.push("\n=== END YOUR PERSPECTIVE ===");
  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/services/roundtable/agentPovStore.test.ts`
Expected: PASS. All six tests green.

- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/agentPovStore.ts server/services/roundtable/agentPovStore.test.ts
git commit -m "feat(roundtable): agentPovStore.renderForPrompt structured text block"
```

---

## Task 5: agentSynthesizer — buildSynthesizerPrompt

**Files:**
- Create: `server/services/roundtable/agentSynthesizer.ts`
- Create: `server/services/roundtable/agentSynthesizer.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `server/services/roundtable/agentSynthesizer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSynthesizerPrompt } from "./agentSynthesizer";

describe("buildSynthesizerPrompt", () => {
  it("includes agent name, prior POV JSON, new turns, roster, and token budget", () => {
    const result = buildSynthesizerPrompt({
      agentName: "Auditor",
      priorPov: { selfPosition: { stance: "init" }, othersSummary: {} },
      newTurns: [
        { speaker: "Compliance Bot", content: "We need to disclose under Reg 30.", turnId: "t1" },
      ],
      rosterDescriptions: [
        { name: "Compliance Bot", description: "SEBI/disclosure specialist" },
        { name: "Devil's Advocate", description: "Adversarial challenger" },
      ],
      tokenBudget: 1800,
    });
    expect(result).toContain("Auditor");
    expect(result).toContain('"stance":"init"');
    expect(result).toContain("Compliance Bot");
    expect(result).toContain("Reg 30");
    expect(result).toContain("Devil's Advocate");
    expect(result).toContain("1800");
    expect(result).toContain("ONLY valid JSON");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/services/roundtable/agentSynthesizer.test.ts`
Expected: FAIL with "Cannot find module './agentSynthesizer'".

- [ ] **Step 3: Create the file with `buildSynthesizerPrompt`**

Write to `server/services/roundtable/agentSynthesizer.ts`:

```ts
/**
 * Per-agent POV synthesizer.
 *
 * After every roundtable turn, one synthesizer job per panel agent rewrites
 * that agent's POV doc. The synthesizer reads:
 *   - the agent's prior POV doc
 *   - all turns since `last_synthesized_turn_id`
 *   - the panel roster (other agents + chair)
 * and outputs structured JSON matching the doc schema. Token-budget enforcement
 * triggers recursive compaction on the oldest QA entries.
 */

export interface SynthesizerTurn {
  turnId: string;
  speaker: string;       // agent name or "Chair"
  content: string;
}

export interface RosterDescription {
  name: string;
  description: string;
}

export function buildSynthesizerPrompt(args: {
  agentName: string;
  priorPov: Record<string, any>;
  newTurns: SynthesizerTurn[];
  rosterDescriptions: RosterDescription[];
  tokenBudget: number;
}): string {
  const { agentName, priorPov, newTurns, rosterDescriptions, tokenBudget } = args;

  const turnsBlock = newTurns
    .map((t) => `[${t.turnId} | ${t.speaker}]\n${t.content}`)
    .join("\n\n---\n\n");

  const rosterBlock = rosterDescriptions
    .map((r) => `  • ${r.name}: ${r.description}`)
    .join("\n");

  return [
    `You are a synthesis assistant maintaining ${agentName}'s perspective on a roundtable.`,
    "",
    "CURRENT POV (compact JSON):",
    JSON.stringify(priorPov),
    "",
    "NEW TURNS SINCE LAST SYNTHESIS:",
    turnsBlock || "(no new turns)",
    "",
    "ROSTER (other panelists + chair):",
    rosterBlock,
    "  • Chair: the human user moderating the panel",
    "",
    "Your job: produce an UPDATED POV as JSON matching this schema:",
    "  { selfPosition: { stance, conclusions }, othersSummary: { [name]: summary },",
    "    outgoingQa: [{ to, question, answer, turnId }],",
    "    incomingQa: [{ from, question, answer, turnId }],",
    "    chairQa: [{ direction: 'to'|'from', text, answer, turnId }],",
    "    openThreads: [{ description, awaitingFrom, turnId }],",
    "    glossary: { [term]: definition } }",
    "",
    "Rules:",
    "- Preserve all named entities (people, companies, amounts, dates, regulations) in glossary.",
    "- For outgoingQa/incomingQa/chairQa: APPEND new Q&As with their turnId; do not rewrite history.",
    "- Update openThreads: close resolved ones, add new pending ones.",
    "- Compress othersSummary aggressively but preserve quantitative claims and citations.",
    `- Keep total POV under ${tokenBudget} tokens.`,
    "- Output ONLY valid JSON, no prose, no markdown fences.",
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/services/roundtable/agentSynthesizer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/agentSynthesizer.ts server/services/roundtable/agentSynthesizer.test.ts
git commit -m "feat(roundtable): agentSynthesizer prompt builder"
```

---

## Task 6: agentSynthesizer — synthesizeAgentPOV happy path

**Files:**
- Modify: `server/services/roundtable/agentSynthesizer.ts`
- Modify: `server/services/roundtable/agentSynthesizer.test.ts`

- [ ] **Step 1: Add failing test**

Replace the imports in `server/services/roundtable/agentSynthesizer.test.ts` and append a new describe block:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ db: { select: vi.fn() } }));
vi.mock("./agentPovStore", () => ({
  getOrInit: vi.fn(),
  upsert: vi.fn(),
  StaleVersionError: class extends Error {},
}));
vi.mock("../aiProviders/registry", () => ({
  aiProviderRegistry: { getProvider: vi.fn() },
}));

import { buildSynthesizerPrompt, synthesizeAgentPOV } from "./agentSynthesizer";
import * as povStore from "./agentPovStore";
import { aiProviderRegistry } from "../aiProviders/registry";
import { db } from "../../db";

describe("synthesizeAgentPOV", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads prior POV, fetches new turns, calls model, upserts result", async () => {
    (povStore.getOrInit as any).mockResolvedValue({
      threadId: "t", agentId: "a", version: 1,
      selfPosition: {}, othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [], glossary: {},
      lastSynthesizedTurnId: null, tokenCount: 0, lastUpdatedAt: new Date(),
    });
    // db.select chain returning roster + new turns
    const selectChain = {
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([
            { id: "turn1", content: "Plant 3 impairment review.", agentId: "a", speakerKind: "agent" },
          ]),
        }),
      }),
    };
    (db.select as any).mockReturnValue(selectChain);

    const newPov = {
      selfPosition: { stance: "Trigger met" },
      othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [],
      glossary: { "Plant 3": "Pune facility" },
    };
    (aiProviderRegistry.getProvider as any).mockReturnValue({
      generateCompletion: vi.fn().mockResolvedValue({
        content: JSON.stringify(newPov),
        finishReason: "stop",
        tokensUsed: { input: 100, output: 50, total: 150 },
        model: "gpt-4o-mini",
        provider: "azure-openai",
      }),
    });
    (povStore.upsert as any).mockResolvedValue({ ...newPov, version: 2, threadId: "t", agentId: "a" });

    // Stub helpers (loadAgentRoster, loadTurnsAfter) — patched inside synthesizer
    // by injecting via overrides. For the happy path we exercise the full call.
    const result = await synthesizeAgentPOV({
      threadId: "t",
      agentId: "a",
      agentName: "Auditor",
      panelId: "p",
      tokenBudget: 1800,
      // The function will call its own internal loaders; for the test we
      // expose seam via _testHooks to skip DB roster/turn loading.
      _testHooks: {
        loadRoster: async () => [
          { name: "Compliance Bot", description: "compliance specialist" },
        ],
        loadTurnsAfter: async () => [
          { turnId: "turn1", speaker: "Compliance Bot", content: "Disclose under Reg 30" },
        ],
      },
    });
    expect(result.version).toBe(2);
    expect(povStore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "t", agentId: "a", expectedVersion: 1 }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/services/roundtable/agentSynthesizer.test.ts`
Expected: FAIL with "synthesizeAgentPOV is not a function".

- [ ] **Step 3: Implement `synthesizeAgentPOV` happy path**

Append to `server/services/roundtable/agentSynthesizer.ts`:

```ts
import { aiProviderRegistry } from "../aiProviders/registry";
import { AIProviderName } from "../aiProviders/types";
import * as povStore from "./agentPovStore";

const DEFAULT_TOKEN_BUDGET = 1800;

const SYNTHESIZER_PROVIDER_ORDER: AIProviderName[] = [
  AIProviderName.AZURE_OPENAI,
  AIProviderName.OPENAI,
  AIProviderName.CLAUDE,
  AIProviderName.GEMINI,
];

const SYNTHESIZER_MODELS: Partial<Record<AIProviderName, string>> = {
  [AIProviderName.AZURE_OPENAI]: "gpt-4o-mini",
  [AIProviderName.OPENAI]: "gpt-4o-mini",
  [AIProviderName.CLAUDE]: "claude-3-5-haiku-20241022",
  [AIProviderName.GEMINI]: "gemini-1.5-flash",
};

export interface SynthesizeArgs {
  threadId: string;
  agentId: string;
  agentName: string;
  panelId: string;
  tokenBudget?: number;
  _testHooks?: {
    loadRoster?: (panelId: string, excludeAgentId: string) => Promise<RosterDescription[]>;
    loadTurnsAfter?: (threadId: string, afterTurnId: string | null) => Promise<SynthesizerTurn[]>;
  };
}

export async function synthesizeAgentPOV(
  args: SynthesizeArgs,
): Promise<{ version: number; tokenCount: number }> {
  const tokenBudget = args.tokenBudget ?? DEFAULT_TOKEN_BUDGET;

  const prior = await povStore.getOrInit(args.threadId, args.agentId);
  const expectedVersion = prior.version;

  const roster = await (args._testHooks?.loadRoster ?? loadRoster)(args.panelId, args.agentId);
  const newTurns = await (args._testHooks?.loadTurnsAfter ?? loadTurnsAfter)(
    args.threadId,
    prior.lastSynthesizedTurnId,
  );

  if (newTurns.length === 0) {
    return { version: prior.version, tokenCount: prior.tokenCount };
  }

  const userPrompt = buildSynthesizerPrompt({
    agentName: args.agentName,
    priorPov: priorPovAsCompact(prior),
    newTurns,
    rosterDescriptions: roster,
    tokenBudget,
  });

  const completion = await callSynthesizerLLM(userPrompt);
  const newPov = JSON.parse(completion.content);

  const lastTurnId = newTurns[newTurns.length - 1].turnId;
  const tokenCount = approxTokenCount(JSON.stringify(newPov));

  const updated = await povStore.upsert({
    threadId: args.threadId,
    agentId: args.agentId,
    expectedVersion,
    patch: {
      selfPosition: newPov.selfPosition ?? {},
      othersSummary: newPov.othersSummary ?? {},
      outgoingQa: newPov.outgoingQa ?? [],
      incomingQa: newPov.incomingQa ?? [],
      chairQa: newPov.chairQa ?? [],
      openThreads: newPov.openThreads ?? [],
      glossary: newPov.glossary ?? {},
      lastSynthesizedTurnId: lastTurnId,
      tokenCount,
    },
  });

  return { version: updated.version, tokenCount };
}

function priorPovAsCompact(doc: any): Record<string, any> {
  return {
    selfPosition: doc.selfPosition,
    othersSummary: doc.othersSummary,
    outgoingQa: doc.outgoingQa,
    incomingQa: doc.incomingQa,
    chairQa: doc.chairQa,
    openThreads: doc.openThreads,
    glossary: doc.glossary,
  };
}

function approxTokenCount(text: string): number {
  // 4 chars/token rough estimate; sufficient for budget enforcement.
  return Math.ceil(text.length / 4);
}

async function callSynthesizerLLM(userPrompt: string): Promise<{ content: string }> {
  const errors: string[] = [];
  for (const providerName of SYNTHESIZER_PROVIDER_ORDER) {
    try {
      const provider = aiProviderRegistry.getProvider(providerName);
      if (!provider) continue;
      const model = SYNTHESIZER_MODELS[providerName] ?? "gpt-4o-mini";
      const res = await provider.generateCompletion({
        model,
        messages: [
          {
            role: "system",
            content: "You are a JSON-only synthesis assistant. Output a single JSON object.",
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        maxTokens: 2400,
        responseFormat: "json",
      });
      return { content: res.content };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${providerName}: ${msg}`);
    }
  }
  throw new Error(`Synthesizer: all providers failed: ${errors.join(" | ")}`);
}

// Default loaders — overridden in tests via _testHooks.
async function loadRoster(panelId: string, excludeAgentId: string): Promise<RosterDescription[]> {
  // Lazily import to avoid circular deps with shared/schema.
  const { db } = await import("../../db");
  const { roundtablePanelAgents } = await import("@shared/schema");
  const { and, eq, ne } = await import("drizzle-orm");
  const rows = await db
    .select()
    .from(roundtablePanelAgents)
    .where(and(eq(roundtablePanelAgents.panelId, panelId), ne(roundtablePanelAgents.id, excludeAgentId)));
  return rows.map((a: any) => ({
    name: a.name,
    description: a.createdFromTemplate ?? "panel specialist",
  }));
}

async function loadTurnsAfter(
  threadId: string,
  afterTurnId: string | null,
): Promise<SynthesizerTurn[]> {
  const { db } = await import("../../db");
  const { roundtableTurns, roundtablePanelAgents } = await import("@shared/schema");
  const { and, eq, gt, asc } = await import("drizzle-orm");

  // Fetch all turns in this thread; drizzle-orm doesn't have a "rows after a
  // specific PK" idiom that's portable across schemas, so we fetch and filter
  // by `position` via the high-water `last_synthesized_turn_id`.
  const allTurns = await db
    .select({
      id: roundtableTurns.id,
      content: roundtableTurns.content,
      speakerKind: roundtableTurns.speakerKind,
      agentId: roundtableTurns.agentId,
      position: roundtableTurns.position,
    })
    .from(roundtableTurns)
    .where(eq(roundtableTurns.threadId, threadId))
    .orderBy(asc(roundtableTurns.position));

  let cutoffPosition = -1;
  if (afterTurnId) {
    const cutoff = allTurns.find((t: any) => t.id === afterTurnId);
    if (cutoff) cutoffPosition = cutoff.position;
  }
  const newTurns = allTurns.filter((t: any) => t.position > cutoffPosition && t.content?.trim());

  // Resolve speaker names.
  const agentIds = newTurns.map((t: any) => t.agentId).filter(Boolean) as string[];
  const agentRows = agentIds.length > 0
    ? await db.select().from(roundtablePanelAgents).where(eq(roundtablePanelAgents.id, agentIds[0]))
    : [];
  const agentNameById = new Map<string, string>();
  for (const row of agentRows as any[]) agentNameById.set(row.id, row.name);

  return newTurns.map((t: any) => ({
    turnId: t.id,
    speaker: t.speakerKind === "user"
      ? "Chair"
      : agentNameById.get(t.agentId) ?? "Agent",
    content: t.content,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/services/roundtable/agentSynthesizer.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/agentSynthesizer.ts server/services/roundtable/agentSynthesizer.test.ts
git commit -m "feat(roundtable): synthesizeAgentPOV happy path with provider fallback"
```

---

## Task 7: agentSynthesizer — error handling + recursive compaction

**Files:**
- Modify: `server/services/roundtable/agentSynthesizer.ts`
- Modify: `server/services/roundtable/agentSynthesizer.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `server/services/roundtable/agentSynthesizer.test.ts`:

```ts
describe("synthesizeAgentPOV — error paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws on invalid JSON from model", async () => {
    (povStore.getOrInit as any).mockResolvedValue({
      threadId: "t", agentId: "a", version: 1,
      selfPosition: {}, othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [], glossary: {},
      lastSynthesizedTurnId: null, tokenCount: 0, lastUpdatedAt: new Date(),
    });
    (aiProviderRegistry.getProvider as any).mockReturnValue({
      generateCompletion: vi.fn().mockResolvedValue({
        content: "this is not json {{{",
        finishReason: "stop",
        tokensUsed: { input: 0, output: 0, total: 0 },
        model: "x", provider: "x",
      }),
    });

    await expect(
      synthesizeAgentPOV({
        threadId: "t", agentId: "a", agentName: "X", panelId: "p",
        _testHooks: {
          loadRoster: async () => [],
          loadTurnsAfter: async () => [{ turnId: "tx", speaker: "Y", content: "hi" }],
        },
      }),
    ).rejects.toThrow();

    expect(povStore.upsert).not.toHaveBeenCalled();
  });

  it("returns early without LLM call when there are no new turns", async () => {
    (povStore.getOrInit as any).mockResolvedValue({
      threadId: "t", agentId: "a", version: 5,
      selfPosition: {}, othersSummary: {},
      outgoingQa: [], incomingQa: [], chairQa: [], openThreads: [], glossary: {},
      lastSynthesizedTurnId: "tx", tokenCount: 100, lastUpdatedAt: new Date(),
    });
    const provider = { generateCompletion: vi.fn() };
    (aiProviderRegistry.getProvider as any).mockReturnValue(provider);

    const result = await synthesizeAgentPOV({
      threadId: "t", agentId: "a", agentName: "X", panelId: "p",
      _testHooks: {
        loadRoster: async () => [],
        loadTurnsAfter: async () => [],
      },
    });
    expect(result).toEqual({ version: 5, tokenCount: 100 });
    expect(provider.generateCompletion).not.toHaveBeenCalled();
    expect(povStore.upsert).not.toHaveBeenCalled();
  });
});

describe("recursive compaction (compactPov)", () => {
  it("collapses oldest 5 entries of outgoingQa when over budget", async () => {
    const { compactPov } = await import("./agentSynthesizer");
    const oversized = {
      selfPosition: {}, othersSummary: {},
      outgoingQa: Array.from({ length: 10 }, (_, i) => ({
        to: "X", question: `q${i}`, answer: `a${i}`, turnId: `t${i}`,
      })),
      incomingQa: [], chairQa: [], openThreads: [], glossary: {},
    };
    const compacted = compactPov(oversized);
    expect(compacted.outgoingQa.length).toBeLessThan(10);
    // First entry should be a collapsed summary.
    expect(typeof compacted.outgoingQa[0].question).toBe("string");
    expect(compacted.outgoingQa[0].turnId).toContain("compact:");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/services/roundtable/agentSynthesizer.test.ts`
Expected: FAIL — "compactPov is not exported" + JSON-parse test may already pass (because `JSON.parse` throws naturally) but the no-new-turns test will likely already pass too. The key failure is `compactPov`.

- [ ] **Step 3: Add `compactPov` and wire it into `synthesizeAgentPOV`**

Append to `server/services/roundtable/agentSynthesizer.ts`:

```ts
const COMPACT_BATCH_SIZE = 5;

export function compactPov(pov: Record<string, any>): Record<string, any> {
  const out = { ...pov };
  for (const field of ["outgoingQa", "incomingQa", "chairQa"] as const) {
    const arr = (out[field] ?? []) as any[];
    if (arr.length > COMPACT_BATCH_SIZE) {
      const oldest = arr.slice(0, COMPACT_BATCH_SIZE);
      const summary = {
        // Field-shape preserves whatever the prompt expects to see; this is
        // a synthetic "compact" entry that the model will treat as one item.
        to: field === "outgoingQa" ? "various" : undefined,
        from: field === "incomingQa" ? "various" : undefined,
        direction: field === "chairQa" ? "from" : undefined,
        question: `[Earlier ${oldest.length} ${field} entries collapsed for budget]`,
        text: `[Earlier ${oldest.length} ${field} entries collapsed for budget]`,
        answer: oldest.map((e: any) => e.answer ?? "(no answer)").join("; ").slice(0, 400),
        turnId: `compact:${oldest[0].turnId ?? "x"}-${oldest[oldest.length - 1].turnId ?? "y"}`,
      };
      out[field] = [summary, ...arr.slice(COMPACT_BATCH_SIZE)];
    }
  }
  return out;
}
```

Then modify the section in `synthesizeAgentPOV` that computes `tokenCount` to apply compaction when over budget. Replace the block:

```ts
const lastTurnId = newTurns[newTurns.length - 1].turnId;
const tokenCount = approxTokenCount(JSON.stringify(newPov));
```

with:

```ts
const lastTurnId = newTurns[newTurns.length - 1].turnId;
let finalPov: Record<string, any> = newPov;
let tokenCount = approxTokenCount(JSON.stringify(finalPov));
if (tokenCount > tokenBudget) {
  finalPov = compactPov(finalPov);
  tokenCount = approxTokenCount(JSON.stringify(finalPov));
}
```

And replace `selfPosition: newPov.selfPosition ?? {}` ... block (the upsert patch object) with references to `finalPov` instead of `newPov`. Specifically, the patch should read fields from `finalPov`:

```ts
const updated = await povStore.upsert({
  threadId: args.threadId,
  agentId: args.agentId,
  expectedVersion,
  patch: {
    selfPosition: finalPov.selfPosition ?? {},
    othersSummary: finalPov.othersSummary ?? {},
    outgoingQa: finalPov.outgoingQa ?? [],
    incomingQa: finalPov.incomingQa ?? [],
    chairQa: finalPov.chairQa ?? [],
    openThreads: finalPov.openThreads ?? [],
    glossary: finalPov.glossary ?? {},
    lastSynthesizedTurnId: lastTurnId,
    tokenCount,
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/services/roundtable/agentSynthesizer.test.ts`
Expected: PASS, all five tests green.

- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/agentSynthesizer.ts server/services/roundtable/agentSynthesizer.test.ts
git commit -m "feat(roundtable): synthesizer error handling + recursive compaction"
```

---

## Task 8: synthesizerJob — Bull queue + processor

**Files:**
- Create: `server/services/roundtable/synthesizerJob.ts`
- Create: `server/services/roundtable/synthesizerJob.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `server/services/roundtable/synthesizerJob.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./agentSynthesizer", () => ({
  synthesizeAgentPOV: vi.fn(),
}));

import { synthesizeAgentPOV } from "./agentSynthesizer";
import { processSynthesizerJob } from "./synthesizerJob";

describe("processSynthesizerJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls synthesizeAgentPOV with job data", async () => {
    (synthesizeAgentPOV as any).mockResolvedValue({ version: 2, tokenCount: 500 });
    const result = await processSynthesizerJob({
      data: { threadId: "t", agentId: "a", agentName: "X", panelId: "p" },
    } as any);
    expect(synthesizeAgentPOV).toHaveBeenCalledWith({
      threadId: "t", agentId: "a", agentName: "X", panelId: "p",
    });
    expect(result.success).toBe(true);
    expect(result.version).toBe(2);
  });

  it("swallows errors and returns success=false (panel must not block)", async () => {
    (synthesizeAgentPOV as any).mockRejectedValue(new Error("model timed out"));
    const result = await processSynthesizerJob({
      data: { threadId: "t", agentId: "a", agentName: "X", panelId: "p" },
    } as any);
    expect(result.success).toBe(false);
    expect(result.error).toContain("model timed out");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/services/roundtable/synthesizerJob.test.ts`
Expected: FAIL — "Cannot find module './synthesizerJob'".

- [ ] **Step 3: Implement the processor**

Write to `server/services/roundtable/synthesizerJob.ts`:

```ts
/**
 * Bull processor for the roundtable-synthesizer queue. Wraps
 * synthesizeAgentPOV with a retry-and-swallow shape so that synthesis
 * failures NEVER block the panel — the agent will fall through to
 * its last-good POV + raw tail.
 */

import type { Job } from "bull";
import { synthesizeAgentPOV } from "./agentSynthesizer";

export interface SynthesizerJobData {
  threadId: string;
  agentId: string;
  agentName: string;
  panelId: string;
}

export interface SynthesizerJobResult {
  success: boolean;
  version?: number;
  tokenCount?: number;
  error?: string;
}

export async function processSynthesizerJob(
  job: Job<SynthesizerJobData>,
): Promise<SynthesizerJobResult> {
  const { threadId, agentId, agentName, panelId } = job.data;
  try {
    const result = await synthesizeAgentPOV({
      threadId,
      agentId,
      agentName,
      panelId,
    });
    return { success: true, version: result.version, tokenCount: result.tokenCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[Synthesizer] failed for thread=${threadId} agent=${agentId}:`,
      message,
    );
    return { success: false, error: message };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/services/roundtable/synthesizerJob.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/synthesizerJob.ts server/services/roundtable/synthesizerJob.test.ts
git commit -m "feat(roundtable): synthesizer Bull processor with swallow-on-failure"
```

---

## Task 9: hybridJobQueue — register synthesizer queue + addSynthesizerJob

**Files:**
- Modify: `server/services/hybridJobQueue.ts`

- [ ] **Step 1: Add synthesizer queue declaration + processor wiring**

Open `server/services/hybridJobQueue.ts`. Find the block that declares `titleGenerationQueue`, `analyticsQueue`, `fileProcessingQueue` (around line 25-27). Add a fourth declaration:

```ts
let synthesizerQueue: Queue | null = null;
```

Below the existing `if (useRedis && redisUrl) { ... }` block (which constructs the three existing queues), add inside the SAME block:

```ts
  synthesizerQueue = new Bull('roundtable-synthesizer', redisUrl, {
    prefix: 'luca',
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
      timeout: 30000,
    }
  });

  // Process synthesizer jobs
  synthesizerQueue.process(async (job: Job) => {
    const { processSynthesizerJob } = await import('./roundtable/synthesizerJob');
    return processSynthesizerJob(job);
  });

  synthesizerQueue.on('failed', (job, err) => {
    console.error(`[SynthesizerQueue] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });
```

- [ ] **Step 2: Add `addSynthesizerJob` to the in-memory fallback path**

Find the `MemoryJob` interface (around line 115). Extend the `type` union to include synthesizer:

```ts
interface MemoryJob {
  id: string;
  type: 'title' | 'analytics' | 'file' | 'synthesizer';
  data: any;
  attempts: number;
  maxAttempts: number;
}
```

Find the `processMemoryJob` switch (around line 130). Add a `synthesizer` case:

```ts
      case 'synthesizer': {
        const { processSynthesizerJob } = await import('./roundtable/synthesizerJob');
        const result = await processSynthesizerJob({ data: job.data } as any);
        return result.success;
      }
```

- [ ] **Step 3: Add `addSynthesizerJob` to the public API**

After `addFileProcessingJob` (around line 245), add:

```ts
export function addSynthesizerJob(data: {
  threadId: string;
  agentId: string;
  agentName: string;
  panelId: string;
}): string {
  if (!process.env.ROUNDTABLE_SYNTHESIZER_ENABLED || process.env.ROUNDTABLE_SYNTHESIZER_ENABLED === 'false') {
    return 'disabled';
  }

  if (useRedis && synthesizerQueue) {
    synthesizerQueue.add(data)
      .catch(err => console.error('[JobQueue] Failed to queue synthesizer:', err));
    return `redis_${Date.now()}`;
  }

  const jobId = generateJobId();
  pendingJobs.push({
    id: jobId,
    type: 'synthesizer',
    data,
    attempts: 0,
    maxAttempts: 3
  });
  setImmediate(() => processMemoryQueue());
  return jobId;
}
```

- [ ] **Step 4: Update `getQueueStats` to include synthesizer stats**

Find the `getQueueStats` function. In the Redis path, add `synthesizerQueue.getJobCounts()` to the `Promise.all`:

```ts
    const [titleStats, analyticsStats, fileStats, synthStats] = await Promise.all([
      titleGenerationQueue.getJobCounts(),
      analyticsQueue.getJobCounts(),
      fileProcessingQueue.getJobCounts(),
      synthesizerQueue ? synthesizerQueue.getJobCounts() : Promise.resolve({}),
    ]);
    
    return {
      titleGeneration: titleStats,
      analytics: analyticsStats,
      fileProcessing: fileStats,
      synthesizer: synthStats,
      backend: 'redis',
      status: 'ready'
    };
```

In the memory path, add synthesizer to the stats object:

```ts
    synthesizer: { waiting: pendingJobs.filter(j => j.type === 'synthesizer').length, active: 0 },
```

- [ ] **Step 5: Update graceful shutdown**

Find `gracefulShutdown` (line 275). Add `synthesizerQueue.close()` to the `Promise.all`:

```ts
  if (useRedis && titleGenerationQueue && analyticsQueue && fileProcessingQueue) {
    await Promise.all([
      titleGenerationQueue.close(),
      analyticsQueue.close(),
      fileProcessingQueue.close(),
      synthesizerQueue ? synthesizerQueue.close() : Promise.resolve(),
    ]);
  }
```

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS, no new errors.

- [ ] **Step 7: Commit**

```bash
git add server/services/hybridJobQueue.ts
git commit -m "feat(roundtable): register synthesizer Bull queue + addSynthesizerJob"
```

---

## Task 10: roundtableRuntime — POV injection in buildAgentSystemPrompt

**Files:**
- Modify: `server/services/roundtable/roundtableRuntime.ts`

- [ ] **Step 1: Import the new modules**

Find the import block at the top (around line 40-60). After the existing roundtable imports, add:

```ts
import * as agentPovStore from './agentPovStore';
```

- [ ] **Step 2: Make `buildAgentSystemPrompt` async + accept POV**

Currently `buildAgentSystemPrompt` (line 1380) is synchronous. We need to fetch the POV asynchronously before calling it. Update the call site (line 1636) FIRST: replace:

```ts
    const otherAgentsCueCard = buildOtherAgentsCueCard(threadId, agent.id, allAgents);

    const systemPrompt = buildAgentSystemPrompt(agent, snippets, allAgents, otherAgentsCueCard);
```

with:

```ts
    const synthesizerEnabled = process.env.ROUNDTABLE_SYNTHESIZER_ENABLED === 'true';
    let cueCard = '';
    if (synthesizerEnabled) {
      const povDoc = await agentPovStore.get(threadId, agent.id);
      cueCard = povDoc ? agentPovStore.renderForPrompt(povDoc) : '';
    } else {
      cueCard = buildOtherAgentsCueCard(threadId, agent.id, allAgents);
    }

    const systemPrompt = buildAgentSystemPrompt(agent, snippets, allAgents, cueCard);
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Sanity-run vitest on existing roundtable tests (if any)**

Run: `npx vitest run server/services/roundtable/`
Expected: All previously-passing tests still green.

- [ ] **Step 5: Commit**

```bash
git add server/services/roundtable/roundtableRuntime.ts
git commit -m "feat(roundtable): inject persistent POV when synthesizer flag enabled"
```

---

## Task 11: roundtableRuntime — dispatch synth jobs in runAgentTurn finally

**Files:**
- Modify: `server/services/roundtable/roundtableRuntime.ts`

- [ ] **Step 1: Find runAgentTurn's finally block**

`runAgentTurn` starts at line 1535. It has try/catch/finally. The relevant finally is the one wrapping the agent-turn body — find the line near 1990-2010 that says `} finally {` immediately preceding the side-thread-processing or loop-rescheduling logic. Run:

```bash
awk '/^async function runAgentTurn/,/^[a-zA-Z].*function /' server/services/roundtable/roundtableRuntime.ts | grep -n "finally"
```

The first `finally` after `runAgentTurn` opens is the target.

- [ ] **Step 2: Add dispatch logic inside the finally block**

Inside that finally block, AFTER any existing cleanup but BEFORE rescheduling the loop, insert:

```ts
    // Dispatch synthesizer jobs for ALL panel agents (speaker included),
    // when the feature flag is on. Non-blocking; failures are swallowed
    // by the synthesizer processor itself.
    if (process.env.ROUNDTABLE_SYNTHESIZER_ENABLED === 'true') {
      try {
        const { addSynthesizerJob } = await import('../hybridJobQueue');
        const synthAgents = allAgents ?? await loadAgents(owned.panel.id);
        for (const a of synthAgents) {
          addSynthesizerJob({
            threadId,
            agentId: a.id,
            agentName: a.name,
            panelId: owned.panel.id,
          });
        }
      } catch (err) {
        console.error('[Roundtable] failed to dispatch synthesizer jobs:', err);
      }
    }
```

(Note: `allAgents` is defined inside the try block at line ~1619; if it is not in scope at the finally block, the `?? await loadAgents(...)` fallback covers it. Verify by running typecheck in step 4.)

- [ ] **Step 3: Disable the rule-based POV write when flag is on**

Find line 1336 where `r.agentPOVs.set(agentId, ...)` is called. Wrap it:

```ts
  if (process.env.ROUNDTABLE_SYNTHESIZER_ENABLED !== 'true') {
    r.agentPOVs.set(agentId, `## My Position\n${position}`);
  }
```

This way the flag's two paths don't both write — under the flag, the persistent POV is the source of truth.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. If `allAgents` is reported out of scope, declare it `let allAgents: RoundtablePanelAgent[] | null = null;` at the top of `runAgentTurn` and assign inside the try block.

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add server/services/roundtable/roundtableRuntime.ts
git commit -m "feat(roundtable): dispatch synthesizer jobs after each turn"
```

---

## Task 12: Integration smoke test (real DB, mocked LLM)

**Files:**
- Create: `server/services/roundtable/__tests__/synthesizer.integration.test.ts`

- [ ] **Step 1: Write the integration test**

Write to `server/services/roundtable/__tests__/synthesizer.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../../../db";
import {
  roundtablePanels,
  roundtablePanelAgents,
  roundtableThreads,
  roundtableTurns,
  agentPovDocuments,
} from "@shared/schema";
import { eq } from "drizzle-orm";

// Mock the model — return a deterministic POV.
vi.mock("../../aiProviders/registry", () => ({
  aiProviderRegistry: {
    getProvider: () => ({
      generateCompletion: async () => ({
        content: JSON.stringify({
          selfPosition: { stance: "Synthesized stance" },
          othersSummary: { Auditor: "auditor-summary" },
          outgoingQa: [],
          incomingQa: [],
          chairQa: [],
          openThreads: [],
          glossary: { Entity: "TestCo" },
        }),
        finishReason: "stop",
        tokensUsed: { input: 100, output: 50, total: 150 },
        model: "gpt-4o-mini",
        provider: "azure-openai",
      }),
    }),
  },
}));

import { synthesizeAgentPOV } from "../agentSynthesizer";
import * as povStore from "../agentPovStore";

describe("synthesizer integration (real DB)", () => {
  let panelId: string;
  let threadId: string;
  let auditorId: string;
  let modId: string;
  let testUserId = "test-user-synth-integration";

  beforeAll(async () => {
    const [panel] = await db
      .insert(roundtablePanels)
      .values({ userId: testUserId, name: "synth-test-panel", description: "", isTemplate: false })
      .returning();
    panelId = panel.id;

    const [auditor] = await db
      .insert(roundtablePanelAgents)
      .values({
        panelId, name: "Auditor", systemPrompt: "audit", model: "mini",
        useBaseKnowledge: true, position: 0,
      })
      .returning();
    auditorId = auditor.id;

    const [mod] = await db
      .insert(roundtablePanelAgents)
      .values({
        panelId, name: "Moderator", systemPrompt: "mod", model: "mini",
        useBaseKnowledge: true, position: 1, createdFromTemplate: 'moderator-bot',
      })
      .returning();
    modId = mod.id;

    const [thread] = await db
      .insert(roundtableThreads)
      .values({ panelId, conversationId: null, title: "synth-test-thread", phase: "opening" })
      .returning();
    threadId = thread.id;

    // One turn from Moderator before synthesis runs for Auditor.
    await db.insert(roundtableTurns).values({
      threadId,
      panelId,
      speakerKind: "agent",
      agentId: modId,
      content: "Welcome to the panel. Let us discuss Plant 3.",
      status: "completed",
      position: 1,
    });
  });

  afterAll(async () => {
    await db.delete(agentPovDocuments).where(eq(agentPovDocuments.threadId, threadId));
    await db.delete(roundtableTurns).where(eq(roundtableTurns.threadId, threadId));
    await db.delete(roundtableThreads).where(eq(roundtableThreads.id, threadId));
    await db.delete(roundtablePanelAgents).where(eq(roundtablePanelAgents.panelId, panelId));
    await db.delete(roundtablePanels).where(eq(roundtablePanels.id, panelId));
  });

  it("creates and updates POV doc end-to-end", async () => {
    const result = await synthesizeAgentPOV({
      threadId, agentId: auditorId, agentName: "Auditor", panelId,
    });
    expect(result.version).toBeGreaterThanOrEqual(2);

    const doc = await povStore.get(threadId, auditorId);
    expect(doc).not.toBeNull();
    expect((doc!.selfPosition as any).stance).toBe("Synthesized stance");
    expect((doc!.glossary as any).Entity).toBe("TestCo");
    expect(doc!.lastSynthesizedTurnId).not.toBeNull();
  });

  it("renderForPrompt produces injectable text", async () => {
    const doc = await povStore.get(threadId, auditorId);
    expect(doc).not.toBeNull();
    const text = povStore.renderForPrompt(doc!);
    expect(text).toContain("Synthesized stance");
    expect(text).toContain("TestCo");
    expect(text).toContain("YOUR PERSPECTIVE");
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npx vitest run server/services/roundtable/__tests__/synthesizer.integration.test.ts`
Expected: PASS, both tests green. If you see DB connection errors, ensure your local `.env` has a working `DATABASE_URL` and the migration from Task 1 has been applied.

- [ ] **Step 3: Commit**

```bash
git add server/services/roundtable/__tests__/synthesizer.integration.test.ts
git commit -m "test(roundtable): integration test for synthesizer end-to-end"
```

---

## Task 13: Manual E2E verification + rollout note

**Files:**
- Modify: `.env.example` (or create one if absent — check first)
- Modify: `docs/superpowers/specs/2026-04-28-roundtable-agent-synthesizer-design.md` — add a status footnote

- [ ] **Step 1: Document the feature flag in `.env.example`**

Check if `.env.example` exists:

```bash
ls .env.example 2>/dev/null || echo "missing"
```

If it exists, append:

```
# Enable per-agent POV synthesizer in roundtable. Off by default; flip to 'true'
# after migration 0007 has been applied to your DB.
ROUNDTABLE_SYNTHESIZER_ENABLED=false
```

If it does not exist, skip (the flag still works at runtime; the env var simply needs to be set in deployment configs).

- [ ] **Step 2: Manual smoke test (local server)**

Start the dev server: `npm run dev`

Set `ROUNDTABLE_SYNTHESIZER_ENABLED=true` in your `.env` and restart.

Open the roundtable feature in the UI. Create a 4-agent panel (Moderator, Auditor, Compliance Bot, Devil's Advocate). Ask: "Should we book impairment on Plant 3?" Run through 5 turns.

After each turn, query the DB:

```bash
psql $DATABASE_URL -c "SELECT agent_id, version, last_synthesized_turn_id, token_count, last_updated_at FROM agent_pov_documents WHERE thread_id = '<your-thread-id>' ORDER BY last_updated_at DESC;"
```

Expected: 4 rows after each turn (one per agent), version increments on each turn, `last_synthesized_turn_id` advances.

Spot-check the JSON content for one agent:

```bash
psql $DATABASE_URL -c "SELECT jsonb_pretty(others_summary), jsonb_pretty(glossary) FROM agent_pov_documents WHERE thread_id = '<your-thread-id>' AND agent_id = '<auditor-id>';"
```

Expected: `others_summary` has entries for Moderator/Compliance/DA; `glossary` has entries like `Entity`, `Asset`, etc.

- [ ] **Step 3: Click resolution; verify Moderator produces final memo**

Phase-click resolution. The Moderator should produce the structured 7-section board memo within ~30s.

Expected: Memo card appears; the "silence on resolution" bug from earlier sessions should NOT recur because each agent now sees its full POV.

- [ ] **Step 4: Update spec status**

Open `docs/superpowers/specs/2026-04-28-roundtable-agent-synthesizer-design.md`. Change the Status line at the top from `Draft (awaiting user review)` to `Implemented (flag-gated; see plan 2026-04-28-roundtable-agent-synthesizer.md)`.

- [ ] **Step 5: Commit**

```bash
git add .env.example docs/superpowers/specs/2026-04-28-roundtable-agent-synthesizer-design.md
git commit -m "docs(roundtable): document synthesizer flag + mark spec implemented"
```

---

## Spec coverage check

Cross-referencing the spec at `docs/superpowers/specs/2026-04-28-roundtable-agent-synthesizer-design.md`:

| Spec section | Implementation task |
|---|---|
| `agent_pov_documents` table | Task 1 |
| `agentPovStore.get` / `getOrInit` | Task 2 |
| `agentPovStore.upsert` with optimistic lock | Task 3 |
| `agentPovStore.renderForPrompt` | Task 4 |
| Synthesizer prompt template | Task 5 |
| `synthesizeAgentPOV` happy path | Task 6 |
| Token budget + recursive compaction | Task 7 |
| Error handling — invalid JSON, no-new-turns | Task 7 |
| `synthesizerJob` Bull processor | Task 8 |
| `hybridJobQueue` integration + `addSynthesizerJob` | Task 9 |
| POV injection in `buildAgentSystemPrompt` | Task 10 |
| Synth dispatch in `runAgentTurn`'s finally | Task 11 |
| Integration smoke test | Task 12 |
| Feature flag + manual E2E | Task 13 |
| Sentry tag `synthesizer.failure` | Covered in Task 8 (console.error → Sentry auto-captures via existing global handler) |
| Cost-micros extension | Deferred — synthesizer cost shows up in standard provider call accounting; per-thread breakdown is a follow-up if needed |
| Staged rollout (10% → 50% → 100%) | Operational task post-merge; flag is binary in v1, partial enablement is per-thread metadata work for v2 |
| Cross-agent fact recall via vector store | Out of scope per spec |
| Chair-view POV doc | Out of scope per spec |

Any gaps above are documented as deferred or out-of-scope per the spec.

## Notes for the executor

- TDD discipline: every task starts with a failing test. Don't skip step 2 ("run test to verify it fails") — if the test passes accidentally, the test is wrong.
- Commit after each green test.
- The provider mock pattern in tests is `vi.mock(...)` at the top of the file with `vi.fn().mockResolvedValue(...)` per call — match the existing `aiOrchestrator.toolLoop.test.ts` style.
- The feature flag defaults to `false`; nothing in production behavior changes until you set `ROUNDTABLE_SYNTHESIZER_ENABLED=true`.
- If integration tests can't connect to the DB locally, run them only in CI; document the env var requirement.
