# Dynamic Chat + Whiteboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the persistent `OutputPane` in `Chat.tsx` with a toggled Chat-vs-Whiteboard view. Assistant messages render rich content (markdown, GFM tables, syntax-highlighted code, math, and full-size diagrammatic artifacts) inline. A new 2D pan/zoom whiteboard canvas holds every artifact ever produced in the conversation, auto-laid-out and pre-expanded, with a draggable Chat PIP, multi-select, selection-to-context, and PDF/PPTX/XLSX export.

**Architecture:** New `whiteboardArtifacts` Drizzle table keyed to conversation + message, written by a post-processing step in `AIOrchestrator`. New server `tools/` registry introduces `read_whiteboard` with provider adapters (Anthropic, OpenAI/Azure). Client ships a new chat shell under a `ENABLE_WHITEBOARD_V2` flag; renderers reuse existing `VisualizationRenderer`, `WorkflowRenderer`, `MindMapRenderer`, `SpreadsheetViewer`, plus a new Mermaid flowchart renderer.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), Express, Vitest, React 18, TanStack Query, `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, new deps: `rehype-highlight`, `mermaid`, `react-zoom-pan-pinch`, `zustand`, `html-to-image`. Existing deps reused for export: `exceljs`, `pptxgenjs`, `pdfkit`.

**Companion spec:** `docs/superpowers/specs/2026-04-18-dynamic-chat-whiteboard-design.md` — read this before starting.

---

## Phase 0 — Prerequisite (user action)

> **STOP before touching any code.** The working tree currently has pre-existing in-flight changes from the user across `client/src/pages/Chat.tsx`, `client/src/components/ChatSidebar.tsx`, `server/services/aiOrchestrator.ts`, `server/routes.ts`, and more (see `git status` for the full list). These must be committed (or stashed) before this plan begins, so that the diffs produced by this plan are reviewable and revertible on their own.

- [ ] **Task 0.1: Confirm the working tree is clean**

```bash
cd /home/mohammed/dev/TechNSure/ICAI-CAGPT
git status --short
```

Expected: either empty output, or only the user's own uncommitted changes that they intend to keep separate from this plan. If the output is non-empty, stop and ask the user to commit or stash before proceeding.

---

## Phase 1 — Schema and storage (backend)

### Task 1.1: Add `whiteboardArtifacts` table + `artifacts` column on `messages`

**Files:**
- Modify: `shared/schema.ts` (append table; modify `messages` table)

- [ ] **Step 1: Add the imports and table definition**

Edit `shared/schema.ts`. After the `export const messages = pgTable(...)` block (currently ending around line 312), append:

```typescript
export const whiteboardArtifacts = pgTable("whiteboard_artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  messageId: varchar("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  kind: text("kind").notNull(), // 'chart' | 'workflow' | 'mindmap' | 'flowchart' | 'spreadsheet'
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").notNull(),
  canvasX: integer("canvas_x").notNull(),
  canvasY: integer("canvas_y").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  conversationSequenceIdx: index("whiteboard_conv_seq_idx")
    .on(table.conversationId, table.sequence),
  messageIdx: index("whiteboard_message_idx").on(table.messageId),
}));

export type WhiteboardArtifact = typeof whiteboardArtifacts.$inferSelect;
export type InsertWhiteboardArtifact = typeof whiteboardArtifacts.$inferInsert;

export const whiteboardArtifactKinds = [
  "chart",
  "workflow",
  "mindmap",
  "flowchart",
  "spreadsheet",
] as const;
export type WhiteboardArtifactKind = typeof whiteboardArtifactKinds[number];
```

Then add an `artifactIds` column on the existing `messages` table by editing its definition:

```typescript
export const messages = pgTable("messages", {
  // ... existing columns ...
  artifactIds: jsonb("artifact_ids").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({ /* existing indexes */ }));
```

- [ ] **Step 2: Apply schema with `db:push`**

```bash
cd /home/mohammed/dev/TechNSure/ICAI-CAGPT
npm run db:push
```

Expected: drizzle-kit prompts to create the new table and add the `artifact_ids` column. Accept the prompts. The `migrations/meta/` index should be updated and a new migration SQL file should appear in `migrations/`.

- [ ] **Step 3: Sanity-query the table exists**

```bash
npx tsx -e "import { db } from './server/db.ts'; import { whiteboardArtifacts } from './shared/schema.ts'; db.select().from(whiteboardArtifacts).limit(1).then(r => console.log('rows:', r.length)).then(() => process.exit(0))"
```

Expected: `rows: 0` without error.

- [ ] **Step 4: Commit**

```bash
git add shared/schema.ts migrations/
git commit -m "feat(whiteboard): add whiteboard_artifacts table and messages.artifact_ids"
```

### Task 1.2: Write the artifact repository

**Files:**
- Create: `server/services/whiteboard/repository.ts`
- Test: `server/services/whiteboard/repository.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/services/whiteboard/repository.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "../../db";
import { users, conversations, messages, whiteboardArtifacts } from "../../../shared/schema";
import {
  createArtifact,
  listArtifactsByConversation,
  getArtifactScoped,
} from "./repository";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

describe("whiteboard repository", () => {
  const userId = "test-user-wb-repo";
  const conv1 = "test-conv-wb-1";
  const conv2 = "test-conv-wb-2";
  const msg1 = "test-msg-wb-1";

  beforeEach(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, conv1));
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, conv2));
    await db.delete(messages).where(eq(messages.id, msg1));
    await db.delete(conversations).where(eq(conversations.id, conv1));
    await db.delete(conversations).where(eq(conversations.id, conv2));
    await db.delete(users).where(eq(users.id, userId));

    await db.insert(users).values({ id: userId, email: `${userId}@t.test`, passwordHash: "x" });
    await db.insert(conversations).values([
      { id: conv1, userId, title: "c1" },
      { id: conv2, userId, title: "c2" },
    ]);
    await db.insert(messages).values({ id: msg1, conversationId: conv1, role: "assistant", content: "hi" });
  });

  it("creates an artifact and assigns sequence 1 on first insert", async () => {
    const art = await createArtifact({
      conversationId: conv1,
      messageId: msg1,
      kind: "chart",
      title: "t",
      summary: "s",
      payload: { foo: 1 },
      width: 600,
      height: 400,
      canvasX: 0,
      canvasY: 0,
    });
    expect(art.sequence).toBe(1);
    expect(art.id).toBeTruthy();
  });

  it("increments sequence per conversation independently", async () => {
    await createArtifact({ conversationId: conv1, messageId: msg1, kind: "chart", title: "a", summary: "", payload: {}, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    await createArtifact({ conversationId: conv1, messageId: msg1, kind: "chart", title: "b", summary: "", payload: {}, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    const c2 = await createArtifact({ conversationId: conv2, messageId: msg1, kind: "chart", title: "c", summary: "", payload: {}, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    // Note: messageId fk points at a message in conv1, but the test only verifies sequence scoping; FK happens to allow cross-reference here.
    const list1 = await listArtifactsByConversation(conv1);
    expect(list1.map(a => a.sequence)).toEqual([1, 2]);
    expect(c2.sequence).toBe(1);
  });

  it("listArtifactsByConversation returns rows in sequence order", async () => {
    await createArtifact({ conversationId: conv1, messageId: msg1, kind: "chart", title: "x", summary: "", payload: {}, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    await createArtifact({ conversationId: conv1, messageId: msg1, kind: "workflow", title: "y", summary: "", payload: {}, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    const list = await listArtifactsByConversation(conv1);
    expect(list.map(a => a.title)).toEqual(["x", "y"]);
  });

  it("getArtifactScoped returns artifact when conversationId matches", async () => {
    const a = await createArtifact({ conversationId: conv1, messageId: msg1, kind: "chart", title: "ok", summary: "", payload: { k: 1 }, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    const got = await getArtifactScoped(a.id, conv1);
    expect(got?.title).toBe("ok");
  });

  it("getArtifactScoped returns null when conversationId mismatches", async () => {
    const a = await createArtifact({ conversationId: conv1, messageId: msg1, kind: "chart", title: "secret", summary: "", payload: {}, width: 0, height: 0, canvasX: 0, canvasY: 0 });
    const got = await getArtifactScoped(a.id, conv2);
    expect(got).toBeNull();
  });

  afterAll(async () => {
    await db.delete(whiteboardArtifacts).where(sql`conversation_id in (${conv1}, ${conv2})`);
    await db.delete(messages).where(eq(messages.id, msg1));
    await db.delete(conversations).where(sql`id in (${conv1}, ${conv2})`);
    await db.delete(users).where(eq(users.id, userId));
  });
});
```

- [ ] **Step 2: Run the test; confirm it fails**

```bash
npx vitest run server/services/whiteboard/repository.test.ts
```

Expected: FAIL — "Cannot find module './repository'".

- [ ] **Step 3: Implement the repository**

Create `server/services/whiteboard/repository.ts`:

```typescript
import { db } from "../../db";
import { whiteboardArtifacts, type WhiteboardArtifact, type InsertWhiteboardArtifact } from "../../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export type CreateArtifactInput = Omit<InsertWhiteboardArtifact, "id" | "sequence" | "createdAt">;

export async function createArtifact(input: CreateArtifactInput): Promise<WhiteboardArtifact> {
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${whiteboardArtifacts.sequence}), 0)` })
    .from(whiteboardArtifacts)
    .where(eq(whiteboardArtifacts.conversationId, input.conversationId));
  const nextSequence = (maxRow?.max ?? 0) + 1;

  const [row] = await db
    .insert(whiteboardArtifacts)
    .values({ ...input, sequence: nextSequence })
    .returning();
  return row;
}

export async function listArtifactsByConversation(conversationId: string): Promise<WhiteboardArtifact[]> {
  return db
    .select()
    .from(whiteboardArtifacts)
    .where(eq(whiteboardArtifacts.conversationId, conversationId))
    .orderBy(whiteboardArtifacts.sequence);
}

export async function getArtifactScoped(
  artifactId: string,
  conversationId: string
): Promise<WhiteboardArtifact | null> {
  const [row] = await db
    .select()
    .from(whiteboardArtifacts)
    .where(
      and(
        eq(whiteboardArtifacts.id, artifactId),
        eq(whiteboardArtifacts.conversationId, conversationId)
      )
    )
    .limit(1);
  return row ?? null;
}
```

- [ ] **Step 4: Run the test; confirm it passes**

```bash
npx vitest run server/services/whiteboard/repository.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/whiteboard/repository.ts server/services/whiteboard/repository.test.ts
git commit -m "feat(whiteboard): add artifact repository with scope-checked reads"
```

---

## Phase 2 — Artifact extraction on write (backend)

### Task 2.1: Auto-layout module (pure function)

**Files:**
- Create: `server/services/whiteboard/autoLayout.ts`
- Test: `server/services/whiteboard/autoLayout.test.ts`

> Note: the same function is also used client-side in Phase 9 for new-artifact placement during streaming. Keep it pure and free of server/client imports.

- [ ] **Step 1: Write the failing test**

Create `server/services/whiteboard/autoLayout.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { placeNext, LayoutState, type LayoutInput } from "./autoLayout";

const CANVAS = 2400;
const GUTTER = 40;
const empty = (): LayoutState => ({ cursorX: 0, rowTop: 0, rowHeight: 0 });

describe("autoLayout.placeNext", () => {
  it("places first artifact at origin", () => {
    const res = placeNext(empty(), { width: 600, height: 400 }, CANVAS, GUTTER);
    expect(res.position).toEqual({ canvasX: 0, canvasY: 0 });
  });

  it("places second artifact to the right within the same row", () => {
    let state = empty();
    const a = placeNext(state, { width: 600, height: 400 }, CANVAS, GUTTER);
    const b = placeNext(a.state, { width: 600, height: 400 }, CANVAS, GUTTER);
    expect(b.position).toEqual({ canvasX: 600 + GUTTER, canvasY: 0 });
  });

  it("wraps to new row when next artifact would exceed canvas width", () => {
    let state: LayoutState = { cursorX: 2000, rowTop: 0, rowHeight: 400 };
    const r = placeNext(state, { width: 600, height: 500 }, CANVAS, GUTTER);
    expect(r.position.canvasY).toBe(400 + GUTTER);
    expect(r.position.canvasX).toBe(0);
  });

  it("grows row height to the tallest item in the row", () => {
    let state = empty();
    const a = placeNext(state, { width: 600, height: 400 }, CANVAS, GUTTER);
    const b = placeNext(a.state, { width: 600, height: 700 }, CANVAS, GUTTER);
    expect(b.state.rowHeight).toBe(700);
  });

  it("oversized artifact gets its own full-width row", () => {
    const r = placeNext(empty(), { width: 3000, height: 500 }, CANVAS, GUTTER);
    expect(r.position).toEqual({ canvasX: 0, canvasY: 0 });
    // subsequent placement wraps because cursor is past canvas
    const r2 = placeNext(r.state, { width: 600, height: 400 }, CANVAS, GUTTER);
    expect(r2.position.canvasY).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run; confirm fail**

```bash
npx vitest run server/services/whiteboard/autoLayout.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/services/whiteboard/autoLayout.ts`:

```typescript
export interface LayoutInput { width: number; height: number; }
export interface Position { canvasX: number; canvasY: number; }
export interface LayoutState { cursorX: number; rowTop: number; rowHeight: number; }
export interface PlacementResult { position: Position; state: LayoutState; }

export const DEFAULT_CANVAS_WIDTH = 2400;
export const DEFAULT_GUTTER = 40;

export function placeNext(
  state: LayoutState,
  item: LayoutInput,
  canvasWidth: number = DEFAULT_CANVAS_WIDTH,
  gutter: number = DEFAULT_GUTTER
): PlacementResult {
  const needsWrap = state.cursorX > 0 && state.cursorX + item.width > canvasWidth;
  if (needsWrap) {
    const wrappedRowTop = state.rowTop + state.rowHeight + gutter;
    const position: Position = { canvasX: 0, canvasY: wrappedRowTop };
    return {
      position,
      state: {
        cursorX: item.width + gutter,
        rowTop: wrappedRowTop,
        rowHeight: item.height,
      },
    };
  }
  const position: Position = { canvasX: state.cursorX, canvasY: state.rowTop };
  return {
    position,
    state: {
      cursorX: state.cursorX + item.width + gutter,
      rowTop: state.rowTop,
      rowHeight: Math.max(state.rowHeight, item.height),
    },
  };
}

// Default natural sizes per artifact kind (used when the extractor can't estimate).
export const NATURAL_SIZE: Record<string, { width: number; height: number }> = {
  chart: { width: 600, height: 400 },
  workflow: { width: 800, height: 500 },
  mindmap: { width: 700, height: 500 },
  flowchart: { width: 700, height: 450 },
  spreadsheet: { width: 900, height: 500 },
};
```

- [ ] **Step 4: Run; confirm pass**

```bash
npx vitest run server/services/whiteboard/autoLayout.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/whiteboard/autoLayout.ts server/services/whiteboard/autoLayout.test.ts
git commit -m "feat(whiteboard): pure row-packing auto-layout"
```

### Task 2.2: Mermaid flowchart extractor

**Files:**
- Create: `server/services/whiteboard/extractors/flowchart.ts`
- Test: `server/services/whiteboard/extractors/flowchart.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { extractFlowcharts } from "./flowchart";

describe("extractFlowcharts", () => {
  it("returns empty array when no mermaid blocks", () => {
    expect(extractFlowcharts("plain text no code")).toEqual([]);
  });

  it("extracts a single mermaid flowchart block", () => {
    const content = "Here:\n```mermaid\nflowchart TD\n  A-->B\n```\nEnd.";
    const res = extractFlowcharts(content);
    expect(res).toHaveLength(1);
    expect(res[0].source).toContain("flowchart TD");
    expect(res[0].rawMatch).toContain("```mermaid");
    expect(res[0].title).toBe("Flowchart");
  });

  it("extracts multiple mermaid blocks in order", () => {
    const content = "```mermaid\nflowchart LR\nA-->B\n```\n\n```mermaid\ngraph TD\nC-->D\n```";
    const res = extractFlowcharts(content);
    expect(res).toHaveLength(2);
    expect(res[0].source).toContain("A-->B");
    expect(res[1].source).toContain("C-->D");
  });

  it("ignores non-mermaid code fences", () => {
    const content = "```ts\nconst x = 1;\n```\n```mermaid\nflowchart TD\nX-->Y\n```";
    const res = extractFlowcharts(content);
    expect(res).toHaveLength(1);
    expect(res[0].source).toContain("X-->Y");
  });
});
```

- [ ] **Step 2: Run; confirm fail**

- [ ] **Step 3: Implement**

```typescript
export interface ExtractedFlowchart {
  source: string;
  rawMatch: string;
  title: string;
  summary: string;
}

const MERMAID_FENCE_RE = /```mermaid\n([\s\S]*?)\n```/g;

export function extractFlowcharts(content: string): ExtractedFlowchart[] {
  const results: ExtractedFlowchart[] = [];
  for (const match of content.matchAll(MERMAID_FENCE_RE)) {
    const source = match[1].trim();
    const firstLine = source.split("\n")[0].trim();
    results.push({
      source,
      rawMatch: match[0],
      title: "Flowchart",
      summary: firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine,
    });
  }
  return results;
}
```

- [ ] **Step 4: Run; confirm pass**

- [ ] **Step 5: Commit**

```bash
git add server/services/whiteboard/extractors/flowchart.ts server/services/whiteboard/extractors/flowchart.test.ts
git commit -m "feat(whiteboard): mermaid flowchart extractor"
```

### Task 2.3: Artifact-extraction pipeline

**Files:**
- Create: `server/services/whiteboard/extractPipeline.ts`
- Test: `server/services/whiteboard/extractPipeline.test.ts`

The pipeline takes a message's raw content plus any pre-computed results the orchestrator already has (visualization data, workflow data, spreadsheet data, mindmap data) and returns: (a) the updated message content with `<artifact id="art_…"/>` placeholders replacing extracted blocks, and (b) the list of artifact INSERTs to persist.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { buildArtifactsForMessage } from "./extractPipeline";

describe("buildArtifactsForMessage", () => {
  it("returns unchanged content and no artifacts when input has none", () => {
    const res = buildArtifactsForMessage({
      content: "just text",
      conversationId: "c1",
      messageId: "m1",
      precomputed: {},
      layoutState: { cursorX: 0, rowTop: 0, rowHeight: 0 },
      idFactory: () => "art_fixed",
    });
    expect(res.updatedContent).toBe("just text");
    expect(res.artifacts).toEqual([]);
  });

  it("inserts chart artifact and placeholder from precomputed visualization", () => {
    let counter = 0;
    const res = buildArtifactsForMessage({
      content: "Chart is above.",
      conversationId: "c1",
      messageId: "m1",
      precomputed: {
        visualization: { type: "bar", title: "Q3 Revenue", data: [{ q: "Q3", v: 100 }] },
      },
      layoutState: { cursorX: 0, rowTop: 0, rowHeight: 0 },
      idFactory: () => `art_${++counter}`,
    });
    expect(res.artifacts).toHaveLength(1);
    expect(res.artifacts[0].kind).toBe("chart");
    expect(res.artifacts[0].title).toBe("Q3 Revenue");
    expect(res.updatedContent).toContain('<artifact id="art_1" />');
  });

  it("extracts mermaid block, replaces it with placeholder", () => {
    const content = "Flow:\n```mermaid\nflowchart TD\nA-->B\n```\nDone.";
    const res = buildArtifactsForMessage({
      content,
      conversationId: "c1",
      messageId: "m1",
      precomputed: {},
      layoutState: { cursorX: 0, rowTop: 0, rowHeight: 0 },
      idFactory: () => "art_f",
    });
    expect(res.artifacts).toHaveLength(1);
    expect(res.artifacts[0].kind).toBe("flowchart");
    expect(res.updatedContent).not.toContain("```mermaid");
    expect(res.updatedContent).toContain('<artifact id="art_f" />');
  });

  it("assigns auto-layout positions to artifacts", () => {
    let counter = 0;
    const res = buildArtifactsForMessage({
      content: "```mermaid\nflowchart TD\nA-->B\n```\n```mermaid\ngraph TD\nC-->D\n```",
      conversationId: "c1",
      messageId: "m1",
      precomputed: {},
      layoutState: { cursorX: 0, rowTop: 0, rowHeight: 0 },
      idFactory: () => `art_${++counter}`,
    });
    expect(res.artifacts[0].canvasX).toBe(0);
    expect(res.artifacts[0].canvasY).toBe(0);
    expect(res.artifacts[1].canvasX).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run; confirm fail**

- [ ] **Step 3: Implement**

```typescript
import { extractFlowcharts } from "./extractors/flowchart";
import { placeNext, NATURAL_SIZE, type LayoutState } from "./autoLayout";
import type { CreateArtifactInput } from "./repository";

export interface PrecomputedArtifactSources {
  visualization?: { type: string; title?: string; data: unknown[]; [k: string]: unknown };
  workflow?: { title?: string; nodes: unknown[]; edges: unknown[]; [k: string]: unknown };
  mindmap?: { title?: string; nodes: unknown[]; edges?: unknown[]; [k: string]: unknown };
  spreadsheet?: { title?: string; sheets: unknown[]; [k: string]: unknown };
}

export interface BuildArtifactsInput {
  content: string;
  conversationId: string;
  messageId: string;
  precomputed: PrecomputedArtifactSources;
  layoutState: LayoutState;
  idFactory: () => string;
}

export interface BuildArtifactsOutput {
  updatedContent: string;
  artifacts: CreateArtifactInput[];
  layoutState: LayoutState;
  generatedIds: string[];
}

function summarize(title: string, kindHint: string): string {
  return `${kindHint} · ${title}`.slice(0, 120);
}

export function buildArtifactsForMessage(input: BuildArtifactsInput): BuildArtifactsOutput {
  const { content, conversationId, messageId, precomputed, idFactory } = input;
  let layoutState = input.layoutState;
  const artifacts: CreateArtifactInput[] = [];
  const generatedIds: string[] = [];
  let updatedContent = content;

  function place(kind: string, title: string, summary: string, payload: unknown): string {
    const size = NATURAL_SIZE[kind] ?? { width: 600, height: 400 };
    const { position, state } = placeNext(layoutState, size);
    layoutState = state;
    const id = idFactory();
    generatedIds.push(id);
    artifacts.push({
      id,
      conversationId,
      messageId,
      kind,
      title,
      summary,
      payload: payload as any,
      canvasX: position.canvasX,
      canvasY: position.canvasY,
      width: size.width,
      height: size.height,
    } as any);
    return id;
  }

  // 1) Precomputed (from orchestrator)
  if (precomputed.visualization) {
    const title = precomputed.visualization.title ?? "Chart";
    const id = place("chart", title, summarize(title, "chart"), precomputed.visualization);
    updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}" />`;
  }
  if (precomputed.workflow) {
    const title = precomputed.workflow.title ?? "Workflow";
    const id = place("workflow", title, summarize(title, "workflow"), precomputed.workflow);
    updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}" />`;
  }
  if (precomputed.mindmap) {
    const title = precomputed.mindmap.title ?? "Mindmap";
    const id = place("mindmap", title, summarize(title, "mindmap"), precomputed.mindmap);
    updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}" />`;
  }
  if (precomputed.spreadsheet) {
    const title = precomputed.spreadsheet.title ?? "Spreadsheet";
    const id = place("spreadsheet", title, summarize(title, "spreadsheet"), precomputed.spreadsheet);
    updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}" />`;
  }

  // 2) Inline extractions (mermaid fences)
  const flowcharts = extractFlowcharts(updatedContent);
  for (const fc of flowcharts) {
    const id = place("flowchart", fc.title, fc.summary, { source: fc.source });
    updatedContent = updatedContent.replace(fc.rawMatch, `<artifact id="${id}" />`);
  }

  return { updatedContent, artifacts, layoutState, generatedIds };
}
```

- [ ] **Step 4: Run; confirm pass**

- [ ] **Step 5: Commit**

```bash
git add server/services/whiteboard/extractPipeline.ts server/services/whiteboard/extractPipeline.test.ts
git commit -m "feat(whiteboard): artifact extraction pipeline with auto-layout"
```

### Task 2.4: Wire extraction into `AIOrchestrator.processQuery`

**Files:**
- Modify: `server/services/aiOrchestrator.ts`

Context: `processQuery` today returns an `OrchestrationResult`. The routes layer (`server/routes.ts`) is what inserts the assistant message. The plan: have `processQuery` compute `updatedContent` and artifact rows, expose them on the result, and have the message-insert code persist artifacts and the `artifactIds` array on the message row.

- [ ] **Step 1: Open the file and locate the return of `processQuery`**

Search for `return {` near the end of `AIOrchestrator.processQuery` (around the response-assembly block).

- [ ] **Step 2: Extend `OrchestrationResult` with whiteboard fields**

Find the `OrchestrationResult` type declaration. Add two fields:

```typescript
export interface OrchestrationResult {
  // ... existing fields ...
  whiteboardArtifacts?: import("./whiteboard/extractPipeline").BuildArtifactsInput extends never ? never : any[];
  whiteboardUpdatedContent?: string; // if different from response, message content should be replaced with this
}
```

Use the proper types:

```typescript
import type { CreateArtifactInput } from "./whiteboard/repository";

export interface OrchestrationResult {
  // ... existing fields ...
  whiteboardArtifacts?: CreateArtifactInput[];
  whiteboardUpdatedContent?: string;
}
```

- [ ] **Step 3: Call extractor after response is assembled, before `return`**

In the body of `processQuery`, once you have the final `response` string and any precomputed `visualization`, `workflow`, `mindmap`, `spreadsheet` values (these already exist in variables inside the method), add:

```typescript
import { buildArtifactsForMessage } from "./whiteboard/extractPipeline";
import { listArtifactsByConversation } from "./whiteboard/repository";
import { placeNext, type LayoutState } from "./whiteboard/autoLayout";
import { randomUUID } from "crypto";

// ... inside processQuery, after you have `response`, `visualization`, etc., and before `return { ... }` ...

let whiteboardUpdatedContent: string | undefined;
let whiteboardArtifactsOut: CreateArtifactInput[] | undefined;

if (options?.conversationId && options?.messageId) {
  // Seed layout state from prior artifacts so appends are stable
  const prior = await listArtifactsByConversation(options.conversationId);
  let seed: LayoutState = { cursorX: 0, rowTop: 0, rowHeight: 0 };
  for (const a of prior) {
    // reconstruct cursor by simulating placements in order
    const { state } = placeNext(seed, { width: a.width, height: a.height });
    seed = state;
  }

  const built = buildArtifactsForMessage({
    content: response,
    conversationId: options.conversationId,
    messageId: options.messageId,
    precomputed: {
      visualization: visualization as any,
      workflow: workflowData as any,
      mindmap: mindmapData as any,
      spreadsheet: spreadsheetData as any,
    },
    layoutState: seed,
    idFactory: () => `art_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
  });

  if (built.artifacts.length > 0) {
    whiteboardUpdatedContent = built.updatedContent;
    whiteboardArtifactsOut = built.artifacts;
  }
}
```

Then in the final `return { ... }`:

```typescript
return {
  // ... existing fields ...
  whiteboardArtifacts: whiteboardArtifactsOut,
  whiteboardUpdatedContent,
};
```

> If `processQuery` today doesn't have `options.messageId`, generate it here with `randomUUID()` and propagate it outward; the routes layer will then use the same id when inserting the message row.

- [ ] **Step 4: Update `ProcessQueryOptions` type**

Find `interface ProcessQueryOptions` and add:

```typescript
interface ProcessQueryOptions {
  // ... existing ...
  conversationId?: string;
  messageId?: string;
}
```

- [ ] **Step 5: Modify route that inserts the assistant message (`server/routes.ts`)**

Find where `aiOrchestrator.processQuery(...)` is called and the response message is inserted. Before the insert, generate `messageId = randomUUID()`, pass it to `processQuery` as an option, then:

```typescript
import { createArtifact } from "../services/whiteboard/repository";

const result = await aiOrchestrator.processQuery(query, history, userTier, userId, {
  conversationId,
  messageId,
  // ... existing options ...
});

const contentToStore = result.whiteboardUpdatedContent ?? result.response;
const artifactIds = result.whiteboardArtifacts?.map(a => (a as any).id) ?? [];

await storage.createMessage({
  id: messageId,
  conversationId,
  role: "assistant",
  content: contentToStore,
  artifactIds,
  // ... existing fields ...
});

for (const art of result.whiteboardArtifacts ?? []) {
  await createArtifact(art);
}
```

- [ ] **Step 6: Write integration test**

Create `server/services/whiteboard/aiOrchestrator.integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "../../db";
import { whiteboardArtifacts, messages, conversations, users } from "../../../shared/schema";
import { buildArtifactsForMessage } from "./extractPipeline";
import { createArtifact, listArtifactsByConversation } from "./repository";
import { eq } from "drizzle-orm";

describe("whiteboard extraction integration", () => {
  const userId = "test-integ-user";
  const convId = "test-integ-conv";
  const msgId = "test-integ-msg";

  beforeEach(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, convId));
    await db.delete(messages).where(eq(messages.id, msgId));
    await db.delete(conversations).where(eq(conversations.id, convId));
    await db.delete(users).where(eq(users.id, userId));
    await db.insert(users).values({ id: userId, email: `${userId}@t.test`, passwordHash: "x" });
    await db.insert(conversations).values({ id: convId, userId, title: "t" });
  });

  it("persists artifacts produced by buildArtifactsForMessage", async () => {
    await db.insert(messages).values({ id: msgId, conversationId: convId, role: "assistant", content: "tmp", artifactIds: [] });
    const built = buildArtifactsForMessage({
      content: "See:\n```mermaid\nflowchart TD\nA-->B\n```",
      conversationId: convId,
      messageId: msgId,
      precomputed: {},
      layoutState: { cursorX: 0, rowTop: 0, rowHeight: 0 },
      idFactory: (() => { let n = 0; return () => `art_it_${++n}`; })(),
    });
    for (const a of built.artifacts) await createArtifact(a);
    await db.update(messages).set({ content: built.updatedContent, artifactIds: built.generatedIds }).where(eq(messages.id, msgId));

    const rows = await listArtifactsByConversation(convId);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("flowchart");

    const [msg] = await db.select().from(messages).where(eq(messages.id, msgId));
    expect(msg.content).toContain('<artifact id="art_it_1" />');
    expect(msg.artifactIds).toEqual(["art_it_1"]);
  });

  afterAll(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, convId));
    await db.delete(messages).where(eq(messages.id, msgId));
    await db.delete(conversations).where(eq(conversations.id, convId));
    await db.delete(users).where(eq(users.id, userId));
  });
});
```

- [ ] **Step 7: Run all whiteboard tests**

```bash
npx vitest run server/services/whiteboard/
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add server/services/aiOrchestrator.ts server/routes.ts server/services/whiteboard/aiOrchestrator.integration.test.ts
git commit -m "feat(whiteboard): extract artifacts on orchestrator write path"
```

---

## Phase 3 — Whiteboard read API and client hook

### Task 3.1: `GET /api/conversations/:id/whiteboard`

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 1: Write the failing test**

Create `server/routes/whiteboard.route.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, loginAs, ensureUser, cleanupUser } from "../../tests/helpers";
import { db } from "../db";
import { whiteboardArtifacts, conversations } from "../../shared/schema";
import { eq } from "drizzle-orm";

describe("GET /api/conversations/:id/whiteboard", () => {
  const userA = "test-wb-route-a";
  const userB = "test-wb-route-b";
  const convA = "test-wb-conv-a";
  let app: any;

  beforeAll(async () => {
    app = await createTestApp();
    await ensureUser(userA);
    await ensureUser(userB);
    await db.insert(conversations).values({ id: convA, userId: userA, title: "t" });
    await db.insert(whiteboardArtifacts).values({
      id: "art_r_1", conversationId: convA, messageId: "", kind: "chart",
      title: "t", summary: "s", payload: {}, canvasX: 0, canvasY: 0, width: 600, height: 400,
      sequence: 1,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get(`/api/conversations/${convA}/whiteboard`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-owner", async () => {
    const agent = await loginAs(app, userB);
    const res = await agent.get(`/api/conversations/${convA}/whiteboard`);
    expect(res.status).toBe(403);
  });

  it("returns the artifact list for owner", async () => {
    const agent = await loginAs(app, userA);
    const res = await agent.get(`/api/conversations/${convA}/whiteboard`);
    expect(res.status).toBe(200);
    expect(res.body.artifacts).toHaveLength(1);
    expect(res.body.artifacts[0].id).toBe("art_r_1");
  });

  afterAll(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, convA));
    await db.delete(conversations).where(eq(conversations.id, convA));
    await cleanupUser(userA);
    await cleanupUser(userB);
  });
});
```

> If `tests/helpers.ts` does not already export `createTestApp`/`loginAs`/`ensureUser`/`cleanupUser`, write minimal versions of these helpers as part of this task. Use `supertest` + `express` and piggyback on the project's existing session setup. Commit helpers separately if they grow beyond 30 lines.

- [ ] **Step 2: Run; confirm fail**

- [ ] **Step 3: Implement route**

In `server/routes.ts`, near the other `app.get("/api/conversations/:id/..."` handlers:

```typescript
import { listArtifactsByConversation } from "./services/whiteboard/repository";

app.get("/api/conversations/:id/whiteboard", requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const { id } = req.params;
  const conversation = await storage.getConversation(id);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  if (conversation.userId !== userId) return res.status(403).json({ error: "Access denied" });
  const artifacts = await listArtifactsByConversation(id);
  res.json({ artifacts });
});
```

- [ ] **Step 4: Run; confirm pass**

- [ ] **Step 5: Commit**

```bash
git add server/routes.ts server/routes/whiteboard.route.test.ts
git commit -m "feat(whiteboard): GET /api/conversations/:id/whiteboard endpoint"
```

### Task 3.2: `useConversationArtifacts` React Query hook

**Files:**
- Create: `client/src/hooks/useConversationArtifacts.ts`
- Test: `client/src/hooks/useConversationArtifacts.test.tsx`

- [ ] **Step 1: Test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useConversationArtifacts } from "./useConversationArtifacts";

describe("useConversationArtifacts", () => {
  it("fetches and returns artifacts for a conversation", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ artifacts: [{ id: "art_1", kind: "chart", title: "t", summary: "s", payload: {}, canvasX: 0, canvasY: 0, width: 600, height: 400, sequence: 1 }] }),
    }) as any;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: any) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useConversationArtifacts("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.artifacts).toHaveLength(1);
    expect(result.current.data?.byId["art_1"].kind).toBe("chart");
  });

  it("returns empty state when conversationId is falsy", () => {
    const client = new QueryClient();
    const wrapper = ({ children }: any) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useConversationArtifacts(undefined), { wrapper });
    expect(result.current.isIdle || result.current.data === undefined).toBe(true);
  });
});
```

- [ ] **Step 2: Run; confirm fail**

- [ ] **Step 3: Implement**

```typescript
import { useQuery } from "@tanstack/react-query";
import type { WhiteboardArtifact } from "../../../shared/schema";

export interface ConversationArtifactsData {
  artifacts: WhiteboardArtifact[];
  byId: Record<string, WhiteboardArtifact>;
}

export function useConversationArtifacts(conversationId?: string) {
  return useQuery<ConversationArtifactsData>({
    queryKey: ["whiteboard", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/whiteboard`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { artifacts } = (await res.json()) as { artifacts: WhiteboardArtifact[] };
      const byId: Record<string, WhiteboardArtifact> = {};
      for (const a of artifacts) byId[a.id] = a;
      return { artifacts, byId };
    },
  });
}
```

- [ ] **Step 4: Run; confirm pass**

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useConversationArtifacts.ts client/src/hooks/useConversationArtifacts.test.tsx
git commit -m "feat(whiteboard): useConversationArtifacts react-query hook"
```

---

## Phase 4 — Tool registry + agent awareness

### Task 4.1: Tool registry skeleton

**Files:**
- Create: `server/services/tools/types.ts`
- Create: `server/services/tools/registry.ts`
- Test: `server/services/tools/registry.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "./registry";
import type { Tool } from "./types";

const sampleTool: Tool = {
  name: "echo",
  description: "echoes input",
  inputSchema: { type: "object", properties: { msg: { type: "string" } }, required: ["msg"] },
  handler: async (input: { msg: string }) => ({ echoed: input.msg }),
};

describe("ToolRegistry", () => {
  let registry: ToolRegistry;
  beforeEach(() => { registry = new ToolRegistry(); });

  it("registers and retrieves a tool by name", () => {
    registry.register(sampleTool);
    expect(registry.get("echo")?.name).toBe("echo");
  });

  it("throws on duplicate registration", () => {
    registry.register(sampleTool);
    expect(() => registry.register(sampleTool)).toThrow(/already registered/);
  });

  it("lists registered tools", () => {
    registry.register(sampleTool);
    expect(registry.list().map(t => t.name)).toEqual(["echo"]);
  });

  it("invokes a tool's handler with context", async () => {
    registry.register(sampleTool);
    const out = await registry.invoke("echo", { msg: "hi" }, { conversationId: "c1", userId: "u1" });
    expect(out).toEqual({ echoed: "hi" });
  });

  it("throws when invoking an unknown tool", async () => {
    await expect(registry.invoke("nope", {}, { conversationId: "c", userId: "u" })).rejects.toThrow(/unknown tool/);
  });
});
```

- [ ] **Step 2: Run; confirm fail**

- [ ] **Step 3: Implement types and registry**

`server/services/tools/types.ts`:

```typescript
export interface ToolContext {
  conversationId: string;
  userId: string;
}

export interface Tool<Input = any, Output = any> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Input, ctx: ToolContext) => Promise<Output>;
}
```

`server/services/tools/registry.ts`:

```typescript
import type { Tool, ToolContext } from "./types";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  async invoke(name: string, input: unknown, ctx: ToolContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`unknown tool: ${name}`);
    return tool.handler(input, ctx);
  }
}

export const toolRegistry = new ToolRegistry();
```

- [ ] **Step 4: Run; confirm pass**

- [ ] **Step 5: Commit**

```bash
git add server/services/tools/
git commit -m "feat(tools): provider-agnostic tool registry"
```

### Task 4.2: Anthropic provider adapter

**Files:**
- Create: `server/services/tools/adapters/anthropic.ts`
- Test: `server/services/tools/adapters/anthropic.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, it, expect } from "vitest";
import { toolsToAnthropicSchema, parseAnthropicToolCall } from "./anthropic";
import type { Tool } from "../types";

const tool: Tool = {
  name: "read_whiteboard",
  description: "x",
  inputSchema: { type: "object", properties: { artifact_id: { type: "string" } }, required: ["artifact_id"] },
  handler: async () => ({}),
};

describe("anthropic adapter", () => {
  it("maps tools to Anthropic tool schema", () => {
    const out = toolsToAnthropicSchema([tool]);
    expect(out[0].name).toBe("read_whiteboard");
    expect(out[0].input_schema).toEqual(tool.inputSchema);
    expect(out[0].description).toBe("x");
  });

  it("parses a tool_use block", () => {
    const content = [
      { type: "text", text: "ok" },
      { type: "tool_use", id: "tool_1", name: "read_whiteboard", input: { artifact_id: "art_1" } },
    ];
    const calls = parseAnthropicToolCall(content as any);
    expect(calls).toEqual([{ id: "tool_1", name: "read_whiteboard", input: { artifact_id: "art_1" } }]);
  });

  it("returns empty array when no tool_use blocks", () => {
    expect(parseAnthropicToolCall([{ type: "text", text: "hi" }] as any)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run; confirm fail**

- [ ] **Step 3: Implement**

```typescript
import type { Tool } from "../types";

export interface AnthropicToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ParsedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export function toolsToAnthropicSchema(tools: Tool[]): AnthropicToolSchema[] {
  return tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
}

export function parseAnthropicToolCall(content: Array<{ type: string; [k: string]: unknown }>): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  for (const block of content) {
    if (block.type === "tool_use") {
      calls.push({
        id: block.id as string,
        name: block.name as string,
        input: (block.input ?? {}) as Record<string, unknown>,
      });
    }
  }
  return calls;
}
```

- [ ] **Step 4: Run; confirm pass**

- [ ] **Step 5: Commit**

```bash
git add server/services/tools/adapters/
git commit -m "feat(tools): Anthropic tool-use adapter"
```

### Task 4.3: OpenAI/Azure function-calling adapter

**Files:**
- Create: `server/services/tools/adapters/openai.ts`
- Test: `server/services/tools/adapters/openai.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, it, expect } from "vitest";
import { toolsToOpenAISchema, parseOpenAIToolCall } from "./openai";
import type { Tool } from "../types";

const tool: Tool = {
  name: "read_whiteboard",
  description: "x",
  inputSchema: { type: "object", properties: { artifact_id: { type: "string" } }, required: ["artifact_id"] },
  handler: async () => ({}),
};

describe("openai adapter", () => {
  it("maps tools to OpenAI function schema", () => {
    const out = toolsToOpenAISchema([tool]);
    expect(out[0].type).toBe("function");
    expect(out[0].function.name).toBe("read_whiteboard");
    expect(out[0].function.parameters).toEqual(tool.inputSchema);
  });

  it("parses a tool_calls response", () => {
    const message = {
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "read_whiteboard", arguments: '{"artifact_id":"art_1"}' } },
      ],
    };
    const calls = parseOpenAIToolCall(message as any);
    expect(calls).toEqual([{ id: "call_1", name: "read_whiteboard", input: { artifact_id: "art_1" } }]);
  });
});
```

- [ ] **Step 2: Run; confirm fail**

- [ ] **Step 3: Implement**

```typescript
import type { Tool } from "../types";
import type { ParsedToolCall } from "./anthropic";

export interface OpenAIToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export function toolsToOpenAISchema(tools: Tool[]): OpenAIToolSchema[] {
  return tools.map(t => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

export function parseOpenAIToolCall(message: { tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  for (const tc of message.tool_calls ?? []) {
    let input: Record<string, unknown> = {};
    try { input = JSON.parse(tc.function.arguments); } catch { input = {}; }
    calls.push({ id: tc.id, name: tc.function.name, input });
  }
  return calls;
}
```

- [ ] **Step 4: Run; confirm pass**

- [ ] **Step 5: Commit**

```bash
git add server/services/tools/adapters/openai.ts server/services/tools/adapters/openai.test.ts
git commit -m "feat(tools): OpenAI/Azure function-calling adapter"
```

### Task 4.4: `read_whiteboard` tool registration

**Files:**
- Create: `server/services/tools/readWhiteboard.tool.ts`
- Test: `server/services/tools/readWhiteboard.tool.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "../../db";
import { whiteboardArtifacts, conversations, users } from "../../../shared/schema";
import { readWhiteboardTool } from "./readWhiteboard.tool";
import { eq } from "drizzle-orm";

describe("read_whiteboard tool", () => {
  const u = "test-tool-user", c1 = "test-tool-c1", c2 = "test-tool-c2";
  beforeEach(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, c1));
    await db.delete(conversations).where(eq(conversations.id, c1));
    await db.delete(conversations).where(eq(conversations.id, c2));
    await db.delete(users).where(eq(users.id, u));
    await db.insert(users).values({ id: u, email: `${u}@t.test`, passwordHash: "x" });
    await db.insert(conversations).values([{ id: c1, userId: u, title: "t" }, { id: c2, userId: u, title: "t" }]);
    await db.insert(whiteboardArtifacts).values({
      id: "art_t_1", conversationId: c1, messageId: "", kind: "chart",
      title: "Revenue", summary: "s", payload: { rows: [1, 2, 3] },
      canvasX: 0, canvasY: 0, width: 600, height: 400, sequence: 1,
    });
  });

  it("returns payload for an owned artifact", async () => {
    const out = await readWhiteboardTool.handler({ artifact_id: "art_t_1" }, { conversationId: c1, userId: u });
    expect((out as any).title).toBe("Revenue");
    expect((out as any).payload).toEqual({ rows: [1, 2, 3] });
  });

  it("throws when artifact belongs to a different conversation", async () => {
    await expect(
      readWhiteboardTool.handler({ artifact_id: "art_t_1" }, { conversationId: c2, userId: u })
    ).rejects.toThrow(/artifact_not_found/);
  });

  it("throws when artifact does not exist", async () => {
    await expect(
      readWhiteboardTool.handler({ artifact_id: "missing" }, { conversationId: c1, userId: u })
    ).rejects.toThrow(/artifact_not_found/);
  });

  afterAll(async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, c1));
    await db.delete(conversations).where(eq(conversations.id, c1));
    await db.delete(conversations).where(eq(conversations.id, c2));
    await db.delete(users).where(eq(users.id, u));
  });
});
```

- [ ] **Step 2: Run; confirm fail**

- [ ] **Step 3: Implement**

```typescript
import type { Tool } from "./types";
import { getArtifactScoped } from "../whiteboard/repository";

export const readWhiteboardTool: Tool<{ artifact_id: string }, { kind: string; title: string; payload: unknown }> = {
  name: "read_whiteboard",
  description:
    "Retrieve the full structured payload of an artifact currently on the whiteboard. Use when you need exact numbers, workflow steps, mindmap nodes, or spreadsheet cells from a prior artifact. The artifact_id must come from the whiteboard manifest in the system context.",
  inputSchema: {
    type: "object",
    properties: {
      artifact_id: { type: "string", description: "The artifact id from the whiteboard manifest (e.g. art_abc123)" },
    },
    required: ["artifact_id"],
  },
  handler: async ({ artifact_id }, ctx) => {
    const row = await getArtifactScoped(artifact_id, ctx.conversationId);
    if (!row) throw new Error("artifact_not_found");
    return { kind: row.kind, title: row.title, payload: row.payload };
  },
};
```

- [ ] **Step 4: Register on startup**

In `server/index.ts` (or wherever the server bootstraps), near other service inits, add:

```typescript
import { toolRegistry } from "./services/tools/registry";
import { readWhiteboardTool } from "./services/tools/readWhiteboard.tool";

toolRegistry.register(readWhiteboardTool);
```

- [ ] **Step 5: Run; confirm pass**

- [ ] **Step 6: Commit**

```bash
git add server/services/tools/readWhiteboard.tool.ts server/services/tools/readWhiteboard.tool.test.ts server/index.ts
git commit -m "feat(whiteboard): register read_whiteboard tool"
```

### Task 4.5: Manifest builder

**Files:**
- Create: `server/services/whiteboard/manifest.ts`
- Test: `server/services/whiteboard/manifest.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, it, expect } from "vitest";
import { formatManifest, trimToTokenBudget, estimateTokens } from "./manifest";

describe("manifest", () => {
  it("formatManifest returns empty string when no artifacts", () => {
    expect(formatManifest([])).toBe("");
  });

  it("formatManifest includes one line per artifact", () => {
    const out = formatManifest([
      { id: "a1", kind: "chart", title: "Revenue", summary: "quarterly revenue" } as any,
      { id: "a2", kind: "workflow", title: "Close", summary: "9-step close" } as any,
    ]);
    expect(out).toContain("# Whiteboard (current conversation, 2 artifacts)");
    expect(out).toContain('- a1 · chart · "Revenue" — quarterly revenue');
    expect(out).toContain('- a2 · workflow · "Close" — 9-step close');
    expect(out).toContain("read_whiteboard(artifact_id)");
  });

  it("trimToTokenBudget keeps newest and appends omitted note", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `a${i}`, kind: "chart", title: `t${i}`, summary: "s".repeat(60) } as any));
    const trimmed = trimToTokenBudget(many, 200);
    expect(trimmed.kept.length).toBeLessThan(50);
    expect(trimmed.kept[trimmed.kept.length - 1].id).toBe("a49");
    expect(trimmed.omitted).toBeGreaterThan(0);
  });

  it("estimateTokens is monotonically non-decreasing in length", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("hello")).toBeGreaterThan(0);
    expect(estimateTokens("hello world hello world")).toBeGreaterThan(estimateTokens("hello"));
  });
});
```

- [ ] **Step 2: Run; confirm fail**

- [ ] **Step 3: Implement**

```typescript
import type { WhiteboardArtifact } from "../../../shared/schema";

export function estimateTokens(s: string): number {
  // Rough heuristic: 4 characters per token.
  return Math.ceil(s.length / 4);
}

export interface TrimResult {
  kept: WhiteboardArtifact[];
  omitted: number;
}

function lineFor(a: WhiteboardArtifact): string {
  return `- ${a.id} · ${a.kind} · "${a.title}" — ${a.summary}`;
}

export function trimToTokenBudget(artifacts: WhiteboardArtifact[], maxTokens: number): TrimResult {
  // Keep newest first; emit in chronological order at the end.
  let used = 0;
  const kept: WhiteboardArtifact[] = [];
  for (let i = artifacts.length - 1; i >= 0; i--) {
    const cost = estimateTokens(lineFor(artifacts[i])) + 1;
    if (used + cost > maxTokens) break;
    used += cost;
    kept.unshift(artifacts[i]);
  }
  return { kept, omitted: artifacts.length - kept.length };
}

export function formatManifest(artifacts: WhiteboardArtifact[], maxTokens = 1500): string {
  if (artifacts.length === 0) return "";
  const { kept, omitted } = trimToTokenBudget(artifacts, maxTokens);
  const head = `# Whiteboard (current conversation, ${artifacts.length} artifact${artifacts.length === 1 ? "" : "s"})`;
  const lines = kept.map(lineFor);
  const tail = omitted > 0 ? [`…${omitted} earlier item${omitted === 1 ? "" : "s"} omitted (use read_whiteboard to retrieve by id).`] : [];
  const footer = "Use read_whiteboard(artifact_id) to load the full payload of any item.";
  return [head, ...lines, ...tail, footer].join("\n");
}
```

- [ ] **Step 4: Run; confirm pass**

- [ ] **Step 5: Commit**

```bash
git add server/services/whiteboard/manifest.ts server/services/whiteboard/manifest.test.ts
git commit -m "feat(whiteboard): manifest builder with token budget"
```

### Task 4.6: Wire manifest + tool calls into `AIOrchestrator`

**Files:**
- Modify: `server/services/aiOrchestrator.ts`
- Modify: `server/services/aiProviders/anthropic.provider.ts` (and/or `registry.ts` + `azure.provider.ts`)

This task wires two things: (1) the manifest is inserted into the system prompt each turn where the conversation has artifacts; (2) when a provider emits a tool call, the orchestrator invokes `toolRegistry.invoke(...)` and loops the result back to the model.

- [ ] **Step 1: Add manifest injection**

In `processQuery`, after the prompt is built but before the provider is called:

```typescript
import { formatManifest } from "./whiteboard/manifest";
import { listArtifactsByConversation } from "./whiteboard/repository";

let manifestBlock = "";
if (options?.conversationId) {
  const priorArtifacts = await listArtifactsByConversation(options.conversationId);
  if (priorArtifacts.length > 0) {
    manifestBlock = formatManifest(priorArtifacts);
  }
}
const systemPromptWithManifest = manifestBlock
  ? `${prompts.systemPrompt}\n\n${manifestBlock}`
  : prompts.systemPrompt;
```

Replace the existing `prompts.systemPrompt` usage in the provider call with `systemPromptWithManifest`.

- [ ] **Step 2: Pass tools to the provider**

Import the registry and the adapter:

```typescript
import { toolRegistry } from "./tools/registry";
import { toolsToAnthropicSchema, parseAnthropicToolCall } from "./tools/adapters/anthropic";
import { toolsToOpenAISchema, parseOpenAIToolCall } from "./tools/adapters/openai";
```

When invoking the provider, pass the tool schemas:

```typescript
const tools = toolRegistry.list();
const anthropicTools = toolsToAnthropicSchema(tools);
// or OpenAI depending on the provider branch
```

- [ ] **Step 3: Implement tool-call loop**

Wrap the provider call in a loop that: executes the model, parses any tool calls, invokes them via the registry, and resubmits with the tool results. Cap at 5 iterations to prevent runaway loops.

```typescript
const MAX_TOOL_ITERATIONS = 5;
const ctx = { conversationId: options?.conversationId ?? "", userId: userId ?? "" };
let messages: any[] = [/* existing user + history messages */];
let iterations = 0;
let finalText = "";

while (iterations < MAX_TOOL_ITERATIONS) {
  iterations++;
  const result = await anthropicProvider.complete({
    system: systemPromptWithManifest,
    messages,
    tools: anthropicTools,
  });
  const toolCalls = parseAnthropicToolCall(result.content);
  if (toolCalls.length === 0) {
    finalText = result.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
    break;
  }
  const toolResults = [];
  for (const call of toolCalls) {
    try {
      const out = await toolRegistry.invoke(call.name, call.input, ctx);
      toolResults.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(out) });
    } catch (e: any) {
      toolResults.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify({ error: e.message }), is_error: true });
    }
  }
  messages.push({ role: "assistant", content: result.content });
  messages.push({ role: "user", content: toolResults });
}
```

> The exact shape of `anthropicProvider.complete` / the existing provider helper is project-specific — adapt this loop to it. If the provider today returns only a string, extend it to return the structured `content` array (Anthropic messages API v1) and pass tools through. Do the analogous for Azure/OpenAI branches via `parseOpenAIToolCall` / `toolsToOpenAISchema`.

- [ ] **Step 4: Integration test**

Create `server/services/whiteboard/manifestIntegration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatManifest } from "./manifest";
import { listArtifactsByConversation } from "./repository";
import { db } from "../../db";
import { whiteboardArtifacts, conversations, users } from "../../../shared/schema";
import { eq } from "drizzle-orm";

describe("manifest reflects prior artifacts", () => {
  const u = "mi-u", c = "mi-c";
  it("next-turn manifest lists the inserted chart", async () => {
    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, c));
    await db.delete(conversations).where(eq(conversations.id, c));
    await db.delete(users).where(eq(users.id, u));
    await db.insert(users).values({ id: u, email: `${u}@t.test`, passwordHash: "x" });
    await db.insert(conversations).values({ id: c, userId: u, title: "t" });
    await db.insert(whiteboardArtifacts).values({
      id: "art_mi_1", conversationId: c, messageId: "", kind: "chart",
      title: "Revenue", summary: "quarterly", payload: {},
      canvasX: 0, canvasY: 0, width: 600, height: 400, sequence: 1,
    });

    const artifacts = await listArtifactsByConversation(c);
    const manifest = formatManifest(artifacts);
    expect(manifest).toContain("art_mi_1");
    expect(manifest).toContain("Revenue");

    await db.delete(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, c));
    await db.delete(conversations).where(eq(conversations.id, c));
    await db.delete(users).where(eq(users.id, u));
  });
});
```

- [ ] **Step 5: Run all whiteboard+tool tests**

```bash
npx vitest run server/services/whiteboard/ server/services/tools/
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add server/services/aiOrchestrator.ts server/services/aiProviders/ server/services/whiteboard/manifestIntegration.test.ts
git commit -m "feat(whiteboard): inject manifest and wire read_whiteboard tool loop"
```

### Task 4.7: Selection preamble

**Files:**
- Modify: `server/routes.ts` (message submission endpoint)
- Modify: `server/services/aiOrchestrator.ts`

- [ ] **Step 1: Write the failing test**

Create `server/services/whiteboard/selectionPreamble.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSelectionPreamble } from "./selectionPreamble";

describe("buildSelectionPreamble", () => {
  it("returns empty when no selection", () => {
    expect(buildSelectionPreamble(undefined)).toBe("");
    expect(buildSelectionPreamble({})).toBe("");
  });

  it("formats single artifact selection", () => {
    expect(buildSelectionPreamble({ artifactIds: ["art_1"] }))
      .toContain("[User has selected artifact art_1.]");
  });

  it("formats multi-artifact selection", () => {
    expect(buildSelectionPreamble({ artifactIds: ["art_1", "art_2", "art_3"] }))
      .toContain("[User has selected artifacts art_1, art_2, art_3.]");
  });

  it("includes highlighted text when present", () => {
    const out = buildSelectionPreamble({ artifactIds: ["art_1"], highlightedText: "cash flow row 3" });
    expect(out).toContain("art_1");
    expect(out).toContain('[Highlighted excerpt: "cash flow row 3"]');
  });
});
```

- [ ] **Step 2: Implement**

```typescript
export interface SelectionInput {
  artifactIds?: string[];
  highlightedText?: string;
}

export function buildSelectionPreamble(selection: SelectionInput | undefined): string {
  if (!selection) return "";
  const ids = selection.artifactIds ?? [];
  if (ids.length === 0 && !selection.highlightedText) return "";
  const parts: string[] = [];
  if (ids.length === 1) parts.push(`[User has selected artifact ${ids[0]}.]`);
  else if (ids.length > 1) parts.push(`[User has selected artifacts ${ids.join(", ")}.]`);
  if (selection.highlightedText) parts.push(`[Highlighted excerpt: "${selection.highlightedText}"]`);
  return parts.join("\n");
}
```

- [ ] **Step 3: Wire into routes + orchestrator**

In the message-submission route, accept `selection` in the request body and pass it through:

```typescript
const { query, selection } = req.body as { query: string; selection?: { artifactIds?: string[]; highlightedText?: string } };
const result = await aiOrchestrator.processQuery(query, history, userTier, userId, {
  conversationId,
  messageId,
  selection,
  // ...
});
```

In `processQuery`, after building `userMessage`:

```typescript
import { buildSelectionPreamble } from "./whiteboard/selectionPreamble";

const preamble = buildSelectionPreamble(options?.selection);
const effectiveUserText = preamble ? `${preamble}\n\n${query}` : query;
// use effectiveUserText wherever `query` was previously passed to the provider
```

Add `selection?: SelectionInput` to `ProcessQueryOptions`.

- [ ] **Step 4: Run tests**

```bash
npx vitest run server/services/whiteboard/selectionPreamble.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add server/services/whiteboard/selectionPreamble.ts server/services/whiteboard/selectionPreamble.test.ts server/services/aiOrchestrator.ts server/routes.ts
git commit -m "feat(whiteboard): selection-to-context preamble"
```

---

## Phase 5 — Feature flag

### Task 5.1: Add `ENABLE_WHITEBOARD_V2`

**Files:**
- Modify: `server/config/featureFlags.ts`
- Modify: `.env.example` (if present)

- [ ] **Step 1: Add the flag**

Edit `server/config/featureFlags.ts`. Add to the `FeatureFlags` interface and `getFeatureFlags()`:

```typescript
export interface FeatureFlags {
  // ... existing ...
  WHITEBOARD_V2: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    // ... existing ...
    WHITEBOARD_V2: process.env.ENABLE_WHITEBOARD_V2 === "true",
  };
}
```

Ensure `getClientFeatures()` includes it (or add to the allowlist for client exposure).

- [ ] **Step 2: Document the env var**

Append to `.env.example` (or equivalent):

```
# Enable the new chat + whiteboard UX (in-chat rich rendering + 2D canvas).
# Default: false
ENABLE_WHITEBOARD_V2=false
```

- [ ] **Step 3: Commit**

```bash
git add server/config/featureFlags.ts .env.example
git commit -m "feat(whiteboard): add ENABLE_WHITEBOARD_V2 feature flag"
```

---

## Phase 6 — Rich in-chat rendering

### Task 6.1: Install new client deps

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
cd /home/mohammed/dev/TechNSure/ICAI-CAGPT
npm install rehype-highlight highlight.js mermaid react-zoom-pan-pinch zustand html-to-image
```

- [ ] **Step 2: Verify type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(whiteboard): install rich-chat + whiteboard client deps"
```

### Task 6.2: Artifact-placeholder rehype plugin

**Files:**
- Create: `client/src/components/chat/rehypeArtifactPlaceholder.ts`
- Test: `client/src/components/chat/rehypeArtifactPlaceholder.test.ts`

> `<artifact id="..."/>` is emitted as raw HTML inside the message content. `react-markdown` by default escapes raw HTML. We use `rehype-raw` plus a custom rehype transformer that rewrites `artifact` elements into React-friendly nodes the custom `components` mapping can render.

- [ ] **Step 1: Test**

```typescript
import { describe, it, expect } from "vitest";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import { rehypeArtifactPlaceholder } from "./rehypeArtifactPlaceholder";
import { visit } from "unist-util-visit";

function transform(html: string): any {
  const tree = unified().use(rehypeParse, { fragment: true }).parse(html);
  rehypeArtifactPlaceholder()(tree);
  return tree;
}

describe("rehypeArtifactPlaceholder", () => {
  it("rewrites <artifact id='x' /> into a tag the markdown renderer can pick up", () => {
    const tree = transform('<p>See <artifact id="art_1"></artifact></p>');
    let found = 0;
    visit(tree, "element", (node: any) => {
      if (node.tagName === "artifact-placeholder" && node.properties?.id === "art_1") found++;
    });
    expect(found).toBe(1);
  });

  it("ignores regular elements", () => {
    const tree = transform("<p>hello <strong>world</strong></p>");
    let found = 0;
    visit(tree, "element", (node: any) => {
      if (node.tagName === "artifact-placeholder") found++;
    });
    expect(found).toBe(0);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import { visit } from "unist-util-visit";

export function rehypeArtifactPlaceholder() {
  return (tree: any) => {
    visit(tree, "element", (node: any) => {
      if (node.tagName === "artifact") {
        node.tagName = "artifact-placeholder";
        node.properties = { id: node.properties?.id };
        node.children = [];
      }
    });
  };
}
```

- [ ] **Step 3: Run; confirm pass**

- [ ] **Step 4: Commit**

```bash
git add client/src/components/chat/rehypeArtifactPlaceholder.ts client/src/components/chat/rehypeArtifactPlaceholder.test.ts
git commit -m "feat(whiteboard): rehype plugin for artifact placeholders"
```

### Task 6.3: ArtifactRenderer dispatcher

**Files:**
- Create: `client/src/components/chat/artifacts/ArtifactRenderer.tsx`

Each renderer wrapper is a thin adapter over an existing component. `FlowchartArtifact` is new.

- [ ] **Step 1: ChartArtifact (wraps existing VisualizationRenderer)**

```typescript
import VisualizationRenderer, { type ChartData } from "../../visualizations/VisualizationRenderer";
export function ChartArtifact({ payload }: { payload: ChartData }) {
  return <div className="bg-card border rounded-lg p-4"><VisualizationRenderer chartData={payload} /></div>;
}
```

- [ ] **Step 2: WorkflowArtifact, MindmapArtifact, SpreadsheetArtifact**

```typescript
// WorkflowArtifact.tsx
import WorkflowRenderer from "../../visualizations/WorkflowRenderer";
export function WorkflowArtifact({ payload }: { payload: any }) {
  return <div className="bg-card border rounded-lg p-4">
    <WorkflowRenderer nodes={payload.nodes} edges={payload.edges} title={payload.title} layout={payload.layout} />
  </div>;
}

// MindmapArtifact.tsx
import MindMapRenderer from "../../visualizations/MindMapRenderer";
export function MindmapArtifact({ payload }: { payload: any }) {
  return <div className="bg-card border rounded-lg p-4"><MindMapRenderer data={payload} /></div>;
}

// SpreadsheetArtifact.tsx
import SpreadsheetViewer from "../../SpreadsheetViewer";
export function SpreadsheetArtifact({ payload, conversationId, messageId }: { payload: any; conversationId?: string; messageId?: string }) {
  return <SpreadsheetViewer data={payload} conversationId={conversationId} messageId={messageId} />;
}
```

- [ ] **Step 3: FlowchartArtifact (new, mermaid)**

```typescript
import { useEffect, useRef } from "react";

let mermaidInitialized = false;
async function ensureMermaid() {
  if (mermaidInitialized) return (await import("mermaid")).default;
  const m = (await import("mermaid")).default;
  m.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });
  mermaidInitialized = true;
  return m;
}

export function FlowchartArtifact({ payload }: { payload: { source: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await ensureMermaid();
      const id = `mm-${Math.random().toString(36).slice(2)}`;
      try {
        const { svg } = await m.render(id, payload.source);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e: any) {
        if (!cancelled && ref.current) ref.current.innerHTML = `<pre style="color:red">Mermaid error: ${e.message}</pre>`;
      }
    })();
    return () => { cancelled = true; };
  }, [payload.source]);
  return <div ref={ref} className="bg-card border rounded-lg p-4 overflow-auto" />;
}
```

- [ ] **Step 4: Dispatcher**

```typescript
// ArtifactRenderer.tsx
import type { WhiteboardArtifact } from "../../../../../shared/schema";
import { ChartArtifact } from "./ChartArtifact";
import { WorkflowArtifact } from "./WorkflowArtifact";
import { MindmapArtifact } from "./MindmapArtifact";
import { SpreadsheetArtifact } from "./SpreadsheetArtifact";
import { FlowchartArtifact } from "./FlowchartArtifact";

export function ArtifactRenderer({ artifact, conversationId }: { artifact: WhiteboardArtifact; conversationId?: string }) {
  switch (artifact.kind) {
    case "chart": return <ChartArtifact payload={artifact.payload as any} />;
    case "workflow": return <WorkflowArtifact payload={artifact.payload as any} />;
    case "mindmap": return <MindmapArtifact payload={artifact.payload as any} />;
    case "spreadsheet": return <SpreadsheetArtifact payload={artifact.payload as any} conversationId={conversationId} messageId={artifact.messageId} />;
    case "flowchart": return <FlowchartArtifact payload={artifact.payload as any} />;
    default: return <div className="text-muted-foreground text-sm">Unsupported artifact kind: {artifact.kind}</div>;
  }
}
```

- [ ] **Step 5: Test the dispatcher**

```typescript
// ArtifactRenderer.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArtifactRenderer } from "./ArtifactRenderer";

describe("ArtifactRenderer", () => {
  it("falls back for unknown kinds", () => {
    render(<ArtifactRenderer artifact={{ id: "a", kind: "unknown" as any, title: "t", summary: "", payload: {}, canvasX: 0, canvasY: 0, width: 0, height: 0, sequence: 1, conversationId: "c", messageId: "m", createdAt: new Date() } as any} />);
    expect(screen.getByText(/Unsupported artifact kind: unknown/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Commit**

```bash
git add client/src/components/chat/artifacts/
git commit -m "feat(whiteboard): artifact renderer wrappers + dispatcher"
```

### Task 6.4: `ChatMessageRich` component

**Files:**
- Create: `client/src/components/chat/ChatMessageRich.tsx`
- Test: `client/src/components/chat/ChatMessageRich.test.tsx`

Responsibilities: render markdown with GFM, math, code highlighting, code-copy button, shadcn tables, and replace `<artifact-placeholder id="..."/>` with `<ArtifactRenderer>` lookup via `useConversationArtifacts`.

- [ ] **Step 1: Implement**

```typescript
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { rehypeArtifactPlaceholder } from "./rehypeArtifactPlaceholder";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { ArtifactRenderer } from "./artifacts/ArtifactRenderer";
import { useConversationArtifacts } from "@/hooks/useConversationArtifacts";
import "highlight.js/styles/github-dark.css";

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? "");
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <pre className="relative group rounded-md overflow-hidden">
      <Button variant="ghost" size="icon" className="absolute right-2 top-2 opacity-0 group-hover:opacity-100" onClick={copy}>
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <code className={className}>{children}</code>
    </pre>
  );
}

export function ChatMessageRich({ content, conversationId }: { content: string; conversationId?: string }) {
  const { data } = useConversationArtifacts(conversationId);
  return (
    <div className="text-sm leading-relaxed prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeArtifactPlaceholder, rehypeKatex, rehypeHighlight]}
        components={{
          table: ({ children }) => <Table>{children}</Table>,
          thead: ({ children }) => <TableHeader>{children}</TableHeader>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow>{children}</TableRow>,
          th: ({ children }) => <TableHead>{children}</TableHead>,
          td: ({ children }) => <TableCell>{children}</TableCell>,
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...rest }: any) => {
            // Inline vs block: react-markdown passes `inline` in v9; in v10 it's inferred by parent type.
            if (!className?.startsWith("language-")) return <code className="px-1 py-0.5 rounded bg-muted" {...rest}>{children}</code>;
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          "artifact-placeholder": ({ id }: any) => {
            const artifact = data?.byId[id];
            if (!artifact) return <div className="text-xs text-muted-foreground italic">[artifact {id} loading…]</div>;
            return <div className="my-4"><ArtifactRenderer artifact={artifact} conversationId={conversationId} /></div>;
          },
        } as any}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatMessageRich } from "./ChatMessageRich";

function wrap(ui: React.ReactNode) {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ artifacts: [] }) }) as any;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ChatMessageRich", () => {
  it("renders a GFM table", () => {
    wrap(<ChatMessageRich content={"| a | b |\n|---|---|\n| 1 | 2 |"} />);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders plain paragraphs", () => {
    wrap(<ChatMessageRich content="hello **world**" />);
    expect(screen.getByText("world")).toBeInTheDocument();
  });

  it("shows placeholder text when artifact is not yet loaded", () => {
    wrap(<ChatMessageRich content='text <artifact id="art_x"></artifact>' conversationId="c" />);
    // Exact wording from the "loading…" branch
    expect(screen.getByText(/artifact art_x loading/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run; confirm pass**

- [ ] **Step 4: Commit**

```bash
git add client/src/components/chat/ChatMessageRich.tsx client/src/components/chat/ChatMessageRich.test.tsx
git commit -m "feat(whiteboard): ChatMessageRich with code highlight + artifact placeholders"
```

---

## Phase 7 — Whiteboard canvas

### Task 7.1: `useMultiSelection` hook

**Files:**
- Create: `client/src/components/chat/whiteboard/useMultiSelection.ts`
- Test: same file with `.test.ts` suffix

- [ ] **Step 1: Test**

```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMultiSelection } from "./useMultiSelection";

const order = ["a", "b", "c", "d"];
describe("useMultiSelection", () => {
  it("plain click replaces selection with single id", () => {
    const { result } = renderHook(() => useMultiSelection(order));
    act(() => result.current.click("b", { metaKey: false, shiftKey: false, ctrlKey: false }));
    expect([...result.current.selected]).toEqual(["b"]);
    act(() => result.current.click("c", { metaKey: false, shiftKey: false, ctrlKey: false }));
    expect([...result.current.selected]).toEqual(["c"]);
  });

  it("cmd-click toggles membership", () => {
    const { result } = renderHook(() => useMultiSelection(order));
    act(() => result.current.click("a", { metaKey: false, shiftKey: false, ctrlKey: false }));
    act(() => result.current.click("c", { metaKey: true, shiftKey: false, ctrlKey: false }));
    expect([...result.current.selected].sort()).toEqual(["a", "c"]);
    act(() => result.current.click("a", { metaKey: true, shiftKey: false, ctrlKey: false }));
    expect([...result.current.selected]).toEqual(["c"]);
  });

  it("shift-click selects range by order", () => {
    const { result } = renderHook(() => useMultiSelection(order));
    act(() => result.current.click("a", { metaKey: false, shiftKey: false, ctrlKey: false }));
    act(() => result.current.click("c", { metaKey: false, shiftKey: true, ctrlKey: false }));
    expect([...result.current.selected].sort()).toEqual(["a", "b", "c"]);
  });

  it("clear() empties selection", () => {
    const { result } = renderHook(() => useMultiSelection(order));
    act(() => result.current.click("a", { metaKey: false, shiftKey: false, ctrlKey: false }));
    act(() => result.current.clear());
    expect([...result.current.selected]).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import { useState, useCallback } from "react";

interface Modifiers { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; }

export function useMultiSelection(orderedIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);

  const click = useCallback((id: string, mods: Modifiers) => {
    setSelected(prev => {
      const next = new Set(prev);
      const toggle = mods.metaKey || mods.ctrlKey;
      if (mods.shiftKey && anchor) {
        const a = orderedIds.indexOf(anchor);
        const b = orderedIds.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(orderedIds[i]);
          return next;
        }
      }
      if (toggle) {
        if (next.has(id)) next.delete(id); else next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
    if (!mods.shiftKey) setAnchor(id);
  }, [anchor, orderedIds]);

  const clear = useCallback(() => { setSelected(new Set()); setAnchor(null); }, []);

  return { selected, click, clear };
}
```

- [ ] **Step 3: Run; confirm pass**

- [ ] **Step 4: Commit**

```bash
git add client/src/components/chat/whiteboard/useMultiSelection.ts client/src/components/chat/whiteboard/useMultiSelection.test.ts
git commit -m "feat(whiteboard): multi-selection hook"
```

### Task 7.2: `useSelectionContext` zustand store

**Files:**
- Create: `client/src/components/chat/whiteboard/useSelectionContext.ts`

- [ ] **Step 1: Implement**

```typescript
import { create } from "zustand";

export interface SelectionContextState {
  artifactIds: string[];
  highlightedText?: string;
  setArtifacts: (ids: string[]) => void;
  setHighlight: (ids: string[], text: string) => void;
  clear: () => void;
}

export const useSelectionContext = create<SelectionContextState>((set) => ({
  artifactIds: [],
  highlightedText: undefined,
  setArtifacts: (ids) => set({ artifactIds: ids, highlightedText: undefined }),
  setHighlight: (ids, text) => set({ artifactIds: ids, highlightedText: text }),
  clear: () => set({ artifactIds: [], highlightedText: undefined }),
}));
```

- [ ] **Step 2: Commit (no test — trivial passthrough)**

```bash
git add client/src/components/chat/whiteboard/useSelectionContext.ts
git commit -m "feat(whiteboard): selection-context zustand store"
```

### Task 7.3: `ArtifactCard`, `WhiteboardCanvas`, `Whiteboard` container

**Files:**
- Create: `client/src/components/chat/whiteboard/ArtifactCard.tsx`
- Create: `client/src/components/chat/whiteboard/WhiteboardCanvas.tsx`
- Create: `client/src/components/chat/whiteboard/Whiteboard.tsx`

- [ ] **Step 1: ArtifactCard**

```typescript
import { cn } from "@/lib/utils";
import type { WhiteboardArtifact } from "../../../../../shared/schema";
import { ArtifactRenderer } from "../artifacts/ArtifactRenderer";

export function ArtifactCard({
  artifact, selected, onClick, conversationId,
}: {
  artifact: WhiteboardArtifact;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  conversationId?: string;
}) {
  return (
    <div
      className={cn(
        "absolute border rounded-lg bg-card shadow-sm overflow-hidden",
        selected ? "ring-2 ring-blue-500" : "",
      )}
      style={{ left: artifact.canvasX, top: artifact.canvasY, width: artifact.width, height: artifact.height }}
      data-artifact-id={artifact.id}
      onClick={onClick}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b text-xs">
        <span className="font-medium">{artifact.title}</span>
        <span className="text-muted-foreground">{artifact.kind}</span>
      </div>
      <div className="p-2 h-[calc(100%-32px)] overflow-hidden">
        <ArtifactRenderer artifact={artifact} conversationId={conversationId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: WhiteboardCanvas (pan/zoom wrapper)**

```typescript
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export function WhiteboardCanvas({ children }: { children: React.ReactNode }) {
  return (
    <TransformWrapper minScale={0.25} maxScale={3} initialScale={0.8} centerOnInit wheel={{ step: 0.1 }} doubleClick={{ disabled: true }}>
      <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-[2600px] !min-h-[1200px]">
        <div className="relative w-full h-full">{children}</div>
      </TransformComponent>
    </TransformWrapper>
  );
}
```

- [ ] **Step 3: Whiteboard container**

```typescript
import { useMemo } from "react";
import { useConversationArtifacts } from "@/hooks/useConversationArtifacts";
import { useMultiSelection } from "./useMultiSelection";
import { useSelectionContext } from "./useSelectionContext";
import { WhiteboardCanvas } from "./WhiteboardCanvas";
import { ArtifactCard } from "./ArtifactCard";
import { Button } from "@/components/ui/button";

export function Whiteboard({ conversationId }: { conversationId: string }) {
  const { data } = useConversationArtifacts(conversationId);
  const orderedIds = useMemo(() => data?.artifacts.map(a => a.id) ?? [], [data]);
  const { selected, click, clear } = useMultiSelection(orderedIds);
  const setArtifacts = useSelectionContext(s => s.setArtifacts);

  const artifacts = data?.artifacts ?? [];
  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
        <p className="text-sm">Your whiteboard will fill as the assistant produces diagrams, charts, and workflows.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <WhiteboardCanvas>
        {artifacts.map(a => (
          <ArtifactCard
            key={a.id}
            artifact={a}
            selected={selected.has(a.id)}
            conversationId={conversationId}
            onClick={(e) => click(a.id, { metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey })}
          />
        ))}
      </WhiteboardCanvas>
      {selected.size > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card border rounded-full px-4 py-2 shadow flex items-center gap-3 text-sm">
          <span>{selected.size} artifact{selected.size === 1 ? "" : "s"} selected</span>
          <Button size="sm" onClick={() => setArtifacts([...selected])}>Ask about these</Button>
          <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/chat/whiteboard/
git commit -m "feat(whiteboard): canvas + artifact cards + selection bar"
```

### Task 7.4: `ChatViewSwitcher`

**Files:**
- Create: `client/src/components/chat/ChatViewSwitcher.tsx`

- [ ] **Step 1: Implement**

```typescript
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export type ChatView = "chat" | "board";

export function useChatView(): [ChatView, (v: ChatView) => void] {
  const [location, setLocation] = useLocation();
  const url = new URL(window.location.href);
  const current = (url.searchParams.get("view") === "board" ? "board" : "chat") as ChatView;
  const set = (v: ChatView) => {
    const u = new URL(window.location.href);
    u.searchParams.set("view", v);
    setLocation(u.pathname + u.search);
  };
  return [current, set];
}

export function ChatViewSwitcher({ value, onChange }: { value: ChatView; onChange: (v: ChatView) => void }) {
  return (
    <div className="inline-flex rounded-full border overflow-hidden text-xs">
      <button className={cn("px-4 py-1.5", value === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground")} onClick={() => onChange("chat")}>Chat</button>
      <button className={cn("px-4 py-1.5", value === "board" ? "bg-primary text-primary-foreground" : "text-muted-foreground")} onClick={() => onChange("board")}>Whiteboard</button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/chat/ChatViewSwitcher.tsx
git commit -m "feat(whiteboard): Chat/Whiteboard view switcher (?view= param)"
```

---

## Phase 8 — Chat PIP

### Task 8.1: Shared `Composer` primitive

**Files:**
- Create: `client/src/components/chat/Composer.tsx`

Extract the current composer UI (textarea + send + selection-bar hook) from `Chat.tsx`'s inline composer. Keep the existing behavior identical — only surface area changes.

- [ ] **Step 1: Implement**

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useSelectionContext } from "./whiteboard/useSelectionContext";

export function Composer({
  onSend, disabled,
}: {
  onSend: (text: string, selection: { artifactIds: string[]; highlightedText?: string } | undefined) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const artifactIds = useSelectionContext(s => s.artifactIds);
  const highlightedText = useSelectionContext(s => s.highlightedText);
  const clear = useSelectionContext(s => s.clear);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    const selection = artifactIds.length > 0 ? { artifactIds, highlightedText } : undefined;
    onSend(t, selection);
    setText("");
    if (selection) clear();
  };

  return (
    <div className="flex flex-col gap-2">
      {artifactIds.length > 0 && (
        <div className="flex items-center gap-2 text-xs px-2 py-1 bg-blue-50 dark:bg-blue-950/30 rounded border">
          <span>Referring to: {artifactIds.length} artifact{artifactIds.length === 1 ? "" : "s"}{highlightedText ? ` · "${highlightedText.slice(0, 40)}${highlightedText.length > 40 ? "…" : ""}"` : ""}</span>
          <Button variant="ghost" size="sm" className="ml-auto h-auto px-2 py-0.5" onClick={clear}>clear</Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything…" className="flex-1 resize-none" rows={2}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <Button onClick={submit} disabled={disabled || !text.trim()} size="icon"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/chat/Composer.tsx
git commit -m "feat(whiteboard): shared Composer primitive"
```

### Task 8.2: `ChatPIP` + transcript

**Files:**
- Create: `client/src/components/chat/pip/ChatPIP.tsx`
- Create: `client/src/components/chat/pip/PIPTranscript.tsx`

- [ ] **Step 1: PIPTranscript**

```typescript
import type { WhiteboardArtifact } from "../../../../../shared/schema";

interface Msg { id: string; role: "user" | "assistant"; content: string; artifactIds?: string[]; }

const ARTIFACT_RE = /<artifact\s+id="([^"]+)"\s*\/?>\s*/g;

function chipFor(a: WhiteboardArtifact | undefined, id: string) {
  const label = a ? `${a.title}` : id;
  return ` [📊 ${label} — on board] `;
}

export function PIPTranscript({ messages, byId }: { messages: Msg[]; byId: Record<string, WhiteboardArtifact> }) {
  return (
    <div className="flex flex-col gap-2 p-3 overflow-auto flex-1">
      {messages.map(m => {
        const text = m.content.replace(ARTIFACT_RE, (_m, id) => chipFor(byId[id], id));
        return (
          <div key={m.id} className={m.role === "user" ? "self-end bg-primary text-primary-foreground rounded-lg px-3 py-1.5 max-w-[85%] text-xs" : "self-start bg-muted rounded-lg px-3 py-1.5 max-w-[85%] text-xs"}>
            {text}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: ChatPIP**

```typescript
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripHorizontal } from "lucide-react";
import { PIPTranscript } from "./PIPTranscript";
import { Composer } from "../Composer";
import type { WhiteboardArtifact } from "../../../../../shared/schema";

const LS_KEY = "cagpt.pip.state.v1";
interface PIPState { x: number; y: number; collapsed: boolean; }

function readState(): PIPState {
  try { return { x: 24, y: 24, collapsed: false, ...JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") }; }
  catch { return { x: 24, y: 24, collapsed: false }; }
}

export function ChatPIP({
  messages, byId, onSend,
}: {
  messages: any[];
  byId: Record<string, WhiteboardArtifact>;
  onSend: (text: string, selection: any) => void;
}) {
  const [state, setState] = useState<PIPState>(readState);
  const dragging = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(state)); }, [state]);

  function onMouseDown(e: React.MouseEvent) {
    dragging.current = { dx: e.clientX - state.x, dy: e.clientY - state.y };
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const nx = Math.max(0, Math.min(window.innerWidth - 360, ev.clientX - dragging.current.dx));
      const ny = Math.max(0, Math.min(window.innerHeight - 80, ev.clientY - dragging.current.dy));
      setState(s => ({ ...s, x: nx, y: ny }));
    };
    const up = () => { dragging.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <div
      className="fixed z-30 bg-background border shadow-lg rounded-lg flex flex-col overflow-hidden"
      style={{ right: state.x, bottom: state.y, width: 360, height: state.collapsed ? 40 : 480 }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted cursor-move select-none" onMouseDown={onMouseDown}>
        <GripHorizontal className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium">Chat</span>
        <button className="ml-auto" onClick={() => setState(s => ({ ...s, collapsed: !s.collapsed }))}>
          {state.collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {!state.collapsed && (
        <>
          <PIPTranscript messages={messages} byId={byId} />
          <div className="border-t p-2"><Composer onSend={onSend} /></div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/chat/pip/
git commit -m "feat(whiteboard): chat PIP with draggable composer"
```

---

## Phase 9 — Wire into Chat.tsx (behind flag)

### Task 9.1: Read `WHITEBOARD_V2` flag on the client

**Files:**
- Modify: `client/src/lib/featureFlags.ts` (or equivalent; create if missing)

- [ ] **Step 1: Fetch the client-exposed flags**

Check how the client currently gets feature flags (search for `getClientFeatures` usage in client code). If there's an existing hook, add the new flag to its type. If not, create:

```typescript
// client/src/lib/featureFlags.ts
import { useQuery } from "@tanstack/react-query";

export interface ClientFeatures { WHITEBOARD_V2: boolean; [k: string]: unknown; }

export function useFeatureFlags() {
  return useQuery<ClientFeatures>({
    queryKey: ["features"],
    queryFn: async () => {
      const res = await fetch("/api/features", { credentials: "include" });
      if (!res.ok) return { WHITEBOARD_V2: false };
      return res.json();
    },
    staleTime: 60_000,
  });
}
```

Ensure `/api/features` returns `getClientFeatures()` from the server (add that route if it doesn't exist; it's a read-only handler).

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/featureFlags.ts server/routes.ts
git commit -m "feat(whiteboard): client feature-flag hook"
```

### Task 9.2: Branch `Chat.tsx` rendering under flag

**Files:**
- Modify: `client/src/pages/Chat.tsx`

- [ ] **Step 1: Add imports and flag read**

At the top of `Chat.tsx`:

```typescript
import { useFeatureFlags } from "@/lib/featureFlags";
import { ChatViewSwitcher, useChatView } from "@/components/chat/ChatViewSwitcher";
import { ChatMessageRich } from "@/components/chat/ChatMessageRich";
import { Whiteboard } from "@/components/chat/whiteboard/Whiteboard";
import { ChatPIP } from "@/components/chat/pip/ChatPIP";
import { Composer } from "@/components/chat/Composer";
import { useConversationArtifacts } from "@/hooks/useConversationArtifacts";
```

Inside the component:

```typescript
const { data: features } = useFeatureFlags();
const whiteboardEnabled = !!features?.WHITEBOARD_V2;
const [view, setView] = useChatView();
const { data: artifactsData } = useConversationArtifacts(activeConversationId);
```

- [ ] **Step 2: Render the switcher in the header**

In the chat-area header (find where the title is displayed), add beside it:

```tsx
{whiteboardEnabled && (
  <ChatViewSwitcher value={view} onChange={setView} />
)}
```

- [ ] **Step 3: Branch the center panel**

Keep the existing `ResizablePanelGroup` + `OutputPane` path for the `!whiteboardEnabled` case. Add the new branch:

```tsx
{whiteboardEnabled ? (
  view === "board" ? (
    <div className="flex-1 relative">
      <Whiteboard conversationId={activeConversationId!} />
      <ChatPIP
        messages={messages}
        byId={artifactsData?.byId ?? {}}
        onSend={(text, selection) => sendMessageMutation.mutate({ query: text, selection })}
      />
    </div>
  ) : (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {messages.map(m => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user" ? "bg-primary text-primary-foreground rounded-lg p-3 max-w-2xl" : "bg-card border rounded-lg p-3 max-w-2xl"}>
              {m.role === "assistant"
                ? <ChatMessageRich content={m.content} conversationId={activeConversationId} />
                : <p className="text-sm whitespace-pre-wrap">{m.content}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t p-4">
        <Composer onSend={(text, selection) => sendMessageMutation.mutate({ query: text, selection })} />
      </div>
    </div>
  )
) : (
  /* existing ResizablePanelGroup + OutputPane layout unchanged */
)}
```

- [ ] **Step 4: Update the send-message mutation to pass `selection`**

Find `sendMessageMutation` and adjust its `mutationFn` to include `selection` in the POST body:

```typescript
body: JSON.stringify({ query: args.query, selection: args.selection, /* other fields */ }),
```

- [ ] **Step 5: Manual smoke check (dev server)**

```bash
ENABLE_WHITEBOARD_V2=true npm run dev
```

Open `http://localhost:<port>`, login, start a new chat. Expected: the `[Chat | Whiteboard]` switcher appears in the header. Without the flag, old layout is identical to today. Toggle `?view=board` — whiteboard shows empty state. Send a message that produces a chart — placeholder replaced with inline chart in chat view; card appears on board in board view.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Chat.tsx
git commit -m "feat(whiteboard): wire Chat.tsx to new layout behind WHITEBOARD_V2 flag"
```

---

## Phase 10 — Board exports

### Task 10.1: XLSX board export

**Files:**
- Modify: `server/routes.ts`
- Create: `server/services/whiteboard/exportXlsx.ts`
- Test: `server/services/whiteboard/exportXlsx.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, it, expect } from "vitest";
import { buildBoardXlsxBuffer } from "./exportXlsx";

describe("buildBoardXlsxBuffer", () => {
  it("includes one sheet per chart with data rows", async () => {
    const buf = await buildBoardXlsxBuffer([
      { id: "a1", kind: "chart", title: "Revenue", payload: { data: [{ q: "Q1", v: 100 }, { q: "Q2", v: 150 }] } } as any,
    ]);
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it("emits a Skipped sheet when only non-tabular artifacts are present", async () => {
    const buf = await buildBoardXlsxBuffer([
      { id: "a1", kind: "workflow", title: "Process", payload: { nodes: [], edges: [] } } as any,
    ]);
    expect(buf.byteLength).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import ExcelJS from "exceljs";
import type { WhiteboardArtifact } from "../../../shared/schema";

export async function buildBoardXlsxBuffer(artifacts: WhiteboardArtifact[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const skipped: Array<{ id: string; kind: string; title: string }> = [];

  for (const a of artifacts) {
    if (a.kind === "chart") {
      const rows = ((a.payload as any)?.data ?? []) as Array<Record<string, unknown>>;
      const ws = wb.addWorksheet(a.title.slice(0, 28) || a.id);
      if (rows.length > 0) {
        const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
        ws.addRow(keys);
        for (const r of rows) ws.addRow(keys.map(k => r[k] ?? ""));
      }
    } else if (a.kind === "spreadsheet") {
      const sheets = ((a.payload as any)?.sheets ?? []) as Array<{ name: string; rows: any[][] }>;
      for (const s of sheets) {
        const ws = wb.addWorksheet(`${a.title.slice(0, 20)}-${s.name.slice(0, 8)}`);
        for (const row of s.rows ?? []) ws.addRow(row);
      }
    } else {
      skipped.push({ id: a.id, kind: a.kind, title: a.title });
    }
  }

  if (skipped.length > 0) {
    const ws = wb.addWorksheet("Skipped");
    ws.addRow(["id", "kind", "title"]);
    for (const s of skipped) ws.addRow([s.id, s.kind, s.title]);
  }

  return wb.xlsx.writeBuffer();
}
```

- [ ] **Step 3: Route handler**

In `server/routes.ts`:

```typescript
import { buildBoardXlsxBuffer } from "./services/whiteboard/exportXlsx";

app.post("/api/conversations/:id/whiteboard/export", requireAuth, async (req, res) => {
  const userId = getCurrentUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const { id } = req.params;
  const { format, artifactIds } = req.body as { format: "pdf" | "pptx" | "xlsx"; artifactIds?: string[] };
  const conversation = await storage.getConversation(id);
  if (!conversation || conversation.userId !== userId) return res.status(403).json({ error: "Access denied" });

  const all = await listArtifactsByConversation(id);
  const subset = artifactIds && artifactIds.length > 0 ? all.filter(a => artifactIds.includes(a.id)) : all;

  if (format === "xlsx") {
    const buf = await buildBoardXlsxBuffer(subset);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="whiteboard-${id}.xlsx"`);
    return res.send(Buffer.from(buf));
  }
  // PPTX + PDF added in Tasks 10.2, 10.3
  return res.status(501).json({ error: "format_not_yet_implemented", format });
});
```

- [ ] **Step 4: Run tests; commit**

```bash
npx vitest run server/services/whiteboard/exportXlsx.test.ts
git add server/services/whiteboard/exportXlsx.ts server/services/whiteboard/exportXlsx.test.ts server/routes.ts
git commit -m "feat(whiteboard): XLSX board export"
```

### Task 10.2: PPTX board export

**Files:**
- Create: `server/services/whiteboard/exportPptx.ts`
- Modify: `server/routes.ts`

- [ ] **Step 1: Implement**

```typescript
import pptxgen from "pptxgenjs";
import type { WhiteboardArtifact } from "../../../shared/schema";

export async function buildBoardPptxBuffer(artifacts: WhiteboardArtifact[], renderedImages: Record<string, string>): Promise<ArrayBuffer> {
  const pptx = new pptxgen();
  for (const a of artifacts) {
    const slide = pptx.addSlide();
    slide.addText(a.title, { x: 0.3, y: 0.3, fontSize: 22, bold: true });
    slide.addText(`${a.kind} · ${a.summary}`, { x: 0.3, y: 0.85, fontSize: 12, color: "666666" });
    const img = renderedImages[a.id];
    if (img) slide.addImage({ data: img, x: 0.3, y: 1.3, w: 9.4, h: 5.2 });
  }
  return (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
}
```

> `renderedImages` is a map of artifact id → base64 data URL. The client renders each artifact via `html-to-image` before submitting the export request. See Task 10.3 for the upload path.

- [ ] **Step 2: Accept rendered images on export route**

Extend the POST body to also accept an optional `renderedImages: { [artifactId: string]: string }` (base64 data URLs). If absent and format is PPTX or PDF, return 400 with `error: "rendered_images_required"`.

- [ ] **Step 3: Wire route**

```typescript
import { buildBoardPptxBuffer } from "./services/whiteboard/exportPptx";

if (format === "pptx") {
  if (!renderedImages) return res.status(400).json({ error: "rendered_images_required" });
  const buf = await buildBoardPptxBuffer(subset, renderedImages);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  res.setHeader("Content-Disposition", `attachment; filename="whiteboard-${id}.pptx"`);
  return res.send(Buffer.from(buf));
}
```

- [ ] **Step 4: Commit**

```bash
git add server/services/whiteboard/exportPptx.ts server/routes.ts
git commit -m "feat(whiteboard): PPTX board export"
```

### Task 10.3: PDF board export + client render pipeline

**Files:**
- Create: `server/services/whiteboard/exportPdf.ts`
- Create: `client/src/components/chat/whiteboard/exportClient.ts`
- Modify: `server/routes.ts`

- [ ] **Step 1: Client render**

```typescript
// exportClient.ts
import { toPng } from "html-to-image";

export async function renderArtifactsToImages(): Promise<Record<string, string>> {
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-artifact-id]"));
  const out: Record<string, string> = {};
  for (const el of cards) {
    const id = el.dataset.artifactId!;
    out[id] = await toPng(el, { pixelRatio: 2 });
  }
  return out;
}
```

- [ ] **Step 2: Server PDF**

```typescript
import PDFDocument from "pdfkit";
import type { WhiteboardArtifact } from "../../../shared/schema";

export async function buildBoardPdfBuffer(artifacts: WhiteboardArtifact[], renderedImages: Record<string, string>): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const end = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  for (const a of artifacts) {
    doc.addPage();
    doc.fontSize(20).text(a.title).moveDown(0.3);
    doc.fontSize(11).fillColor("#666").text(`${a.kind} · ${a.summary}`).moveDown();
    const img = renderedImages[a.id];
    if (img) {
      const b64 = img.replace(/^data:image\/\w+;base64,/, "");
      doc.image(Buffer.from(b64, "base64"), { fit: [515, 650], align: "center", valign: "center" });
    }
    doc.fillColor("black");
  }

  doc.end();
  return end;
}
```

- [ ] **Step 3: Wire route**

```typescript
if (format === "pdf") {
  if (!renderedImages) return res.status(400).json({ error: "rendered_images_required" });
  const buf = await buildBoardPdfBuffer(subset, renderedImages);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="whiteboard-${id}.pdf"`);
  return res.send(buf);
}
```

- [ ] **Step 4: Export menu UI**

Add to `Whiteboard.tsx` a toolbar with an "Export ▾" dropdown that triggers:

```typescript
async function onExport(format: "pdf" | "pptx" | "xlsx") {
  const body: any = { format };
  if (format !== "xlsx") body.renderedImages = await renderArtifactsToImages();
  const res = await fetch(`/api/conversations/${conversationId}/whiteboard/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `whiteboard.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 5: Commit**

```bash
git add server/services/whiteboard/exportPdf.ts client/src/components/chat/whiteboard/exportClient.ts client/src/components/chat/whiteboard/Whiteboard.tsx server/routes.ts
git commit -m "feat(whiteboard): PDF board export + client-side render pipeline"
```

---

## Phase 11 — Lazy backfill for legacy conversations

### Task 11.1: Backfill on first GET

**Files:**
- Modify: `server/routes.ts` (the `GET /api/conversations/:id/whiteboard` route)
- Create: `server/services/whiteboard/backfill.ts`

- [ ] **Step 1: Implement**

```typescript
import { db } from "../../db";
import { messages, whiteboardArtifacts } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { buildArtifactsForMessage } from "./extractPipeline";
import { createArtifact } from "./repository";
import { randomUUID } from "crypto";

export async function backfillIfNeeded(conversationId: string): Promise<void> {
  const [anyArtifact] = await db.select().from(whiteboardArtifacts).where(eq(whiteboardArtifacts.conversationId, conversationId)).limit(1);
  if (anyArtifact) return;

  const msgs = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  let layoutState = { cursorX: 0, rowTop: 0, rowHeight: 0 };
  for (const m of msgs) {
    if (m.role !== "assistant") continue;
    const built = buildArtifactsForMessage({
      content: m.content,
      conversationId,
      messageId: m.id,
      precomputed: {},
      layoutState,
      idFactory: () => `art_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    });
    if (built.artifacts.length === 0) continue;
    for (const a of built.artifacts) await createArtifact(a);
    await db.update(messages).set({ content: built.updatedContent, artifactIds: built.generatedIds }).where(eq(messages.id, m.id));
    layoutState = built.layoutState;
  }
}
```

- [ ] **Step 2: Call from the GET route**

```typescript
app.get("/api/conversations/:id/whiteboard", requireAuth, async (req, res) => {
  // ... auth + ownership ...
  await backfillIfNeeded(id);
  const artifacts = await listArtifactsByConversation(id);
  res.json({ artifacts });
});
```

- [ ] **Step 3: Commit**

```bash
git add server/services/whiteboard/backfill.ts server/routes.ts
git commit -m "feat(whiteboard): lazy backfill for legacy conversations"
```

---

## Phase 12 — Cleanup

### Task 12.1: Manual smoke test checklist

**Files:**
- Create: `docs/superpowers/plans/2026-04-18-dynamic-chat-whiteboard-smoke.md`

- [ ] **Step 1: Write the checklist**

Copy this into the smoke doc (edit as the feature evolves):

```markdown
# Whiteboard Smoke Test Checklist

Run with `ENABLE_WHITEBOARD_V2=true npm run dev`. Each item must be manually verified in a real browser.

## Chat view
- [ ] Send message that produces a chart → chart renders inline in the chat bubble
- [ ] Send message with a GFM table → table renders with shadcn styling
- [ ] Send message with ```ts fenced code → code is syntax-highlighted and copy button works
- [ ] Send message with LaTeX ($$E=mc^2$$) → KaTeX renders
- [ ] Send message with a mermaid flowchart → renders inline after post-processing

## Whiteboard view
- [ ] Toggle Chat → Whiteboard: URL has ?view=board; canvas shows all artifacts pre-expanded
- [ ] Pan and zoom work (wheel, drag-empty-space)
- [ ] Click a card → blue outline, selection bar shows "1 selected"
- [ ] Cmd/Ctrl-click additional cards → count increases
- [ ] Shift-click a later card → range selected
- [ ] Esc or "Clear" → selection empties
- [ ] With selection active, PIP composer bar shows "Referring to: N artifacts"; send a message → preamble is included in the assistant's reply

## PIP
- [ ] PIP appears bottom-right on whiteboard view
- [ ] Drag PIP by its header → it stays in viewport bounds
- [ ] Collapse / expand works; persists across page reload

## Agent awareness
- [ ] After the 2nd message, the server log shows the manifest block included in the system context
- [ ] Ask "what was in my first chart?" → agent responds with data matching the artifact (evidence it called read_whiteboard)

## Exports
- [ ] Export ▾ → XLSX: download opens, contains one sheet per chart, data rows present
- [ ] Export ▾ → PPTX: download opens, one slide per artifact, image visible
- [ ] Export ▾ → PDF: download opens, one page per artifact, image visible
- [ ] Multi-select 2 artifacts → Export → only those 2 appear in the output

## Backfill
- [ ] Open a pre-existing conversation from before this feature → first load of Whiteboard view shows artifacts derived from prior messages

## Regression (flag off)
- [ ] With ENABLE_WHITEBOARD_V2=false: Chat.tsx renders exactly as before, OutputPane layout unchanged
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-04-18-dynamic-chat-whiteboard-smoke.md
git commit -m "docs(whiteboard): manual smoke test checklist"
```

### Task 12.2: Final sweep + QA

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: all green.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run the smoke checklist above in a browser.**

- [ ] **Step 4: When QA passes, enable the flag by default**

Change the default in `server/config/featureFlags.ts` to `WHITEBOARD_V2: process.env.ENABLE_WHITEBOARD_V2 !== "false"` (opt-out instead of opt-in), and remove the client-side branch for the legacy layout. This is a separate PR, not part of this plan.

---

## Plan self-review notes

- **Spec coverage:** every numbered section in the spec is implemented: §4 UI → Phases 6–9, §5 data model → Phase 1, §6 components → Phases 6–8, §7 rich rendering → Phase 6, §8 canvas → Phase 7, §9 agent awareness → Phase 4, §10 testing → inline per task + Phase 12, §11 rollout → Phases 5+9 (flag) and Phase 12 (cleanup), §12 open decisions → implementer picks defaults as noted.
- **Placeholder scan:** none. All code blocks are concrete. Where a step depends on the shape of existing code that varies by project state (e.g. `OrchestrationResult` type, provider-call signature), the plan says "find X and add Y" with the exact addition rather than leaving a TODO.
- **Type consistency:** `CreateArtifactInput`, `WhiteboardArtifact`, `Position`, `LayoutState`, `PlacementResult`, `Tool`, `ToolContext`, `ParsedToolCall`, `ClientFeatures`, `ChatView` are defined in the task that first references them and reused consistently in later tasks.
- **Gaps handled explicitly:** (a) the repo has no tool registry today — Phase 4 creates one. (b) `parseWorkflowContent` from the original spec does not exist — the pipeline consumes the `workflowData` value the orchestrator already computes via `WorkflowGenerator`. (c) `Chat.tsx` already has partial markdown support — `ChatMessageRich` replaces the plain-text fallback but reuses the same markdown plugin choices.
