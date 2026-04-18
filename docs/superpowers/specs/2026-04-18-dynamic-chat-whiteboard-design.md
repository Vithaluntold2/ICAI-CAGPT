# Dynamic Chat + Whiteboard — Design

**Date:** 2026-04-18
**Status:** Approved design, pending implementation plan
**Scope:** `client/src/pages/Chat.tsx`, `client/src/pages/ForensicIntelligence.tsx`

## 1. Summary

Replace the current persistent right-side `OutputPane` with a toggled **view mode**. Each chat message renders rich content inline (markdown, GFM tables, code with syntax highlighting, math, and full-size diagrammatic artifacts). A segmented `[Chat | Whiteboard]` pill in the chat header switches to a 2D pan/zoom canvas that holds every diagrammatic artifact produced in the conversation, auto-laid-out and pre-expanded. In whiteboard view, a draggable Chat PIP keeps the conversation — including its composer — continuously accessible so the user never has to toggle back to ask a question. The agent is aware of the whiteboard through a manifest injected each turn, a `read_whiteboard(artifact_id)` tool, and a selection-context preamble.

## 2. Goals

- Every diagrammatic agent output appears at full size inline in the chat bubble that produced it.
- The whiteboard view is a single cumulative, navigable canvas of every artifact in the conversation.
- The agent can reference and reuse prior artifacts by id without re-sending their full payload every turn.
- The user can reference one or many artifacts (or a text highlight from within one) in their next message without leaving the whiteboard view.
- Full-board export to PDF, PPTX, and (for chart/graph data) XLSX.

## 3. Non-goals

- Minimap, user-driven freeform annotation, drag-to-rearrange artifacts.
- Real-time collaboration across users.
- Migrating other chat surfaces (`Roundtable`, `ScenarioSimulator`, `DeliverableComposer`). Those stay on the existing layout until separately migrated.
- Vision/screenshot-based agent awareness. Reconsider only if the manifest + tool hybrid proves insufficient.

## 4. User experience

### 4.1 Chat view (default)

Each assistant message renders its full content inline:

- Markdown with GFM, KaTeX math, and syntax-highlighted code (single theme per color mode).
- GFM tables map to the shadcn `<Table>` family for consistent styling.
- Code blocks get a hover-to-copy button.
- Diagrammatic artifacts — charts, workflows, mindmaps, spreadsheets, Mermaid flowcharts — render at their natural full size where the model placed them (via `<artifact id="…" />` placeholders the orchestrator inserts into the stored message body).

User messages remain plain text.

### 4.2 Whiteboard view

A 2D pan/zoom canvas scoped to the current conversation.

- **Viewport:** `react-zoom-pan-pinch` CSS-transform pan + wheel/pinch zoom, range 0.25×–3×. Keyboard: `+`/`-` zoom, `0` reset-to-fit, arrow keys pan.
- **Auto-layout:** deterministic row-packed flow into a 2400-px virtual canvas with a 40-px gutter. Each artifact kind has a natural width/height. Positions are persisted to the DB, so layout is stable across reloads and appending a new artifact never shifts prior ones.
- **Artifact cards:** absolute-positioned on the transformed layer. Title bar, kind badge, timestamp, per-card menu (copy / export this / reference). Read-only: no resize, no drag.
- **Selection-to-context:**
  - Click a card background → toggles it as the current selection (blue outline).
  - Highlight text inside a card → the text + its parent artifact become the selection; a floating "Ask about this" tooltip focuses the PIP composer.
  - Cmd/Ctrl-click adds/removes from a **multi-selection** set; Shift-click selects the range by `sequence`; empty-canvas click or Esc clears.
  - A sticky selection bar ("N artifacts selected — [Ask about these] [Export selected] [Clear]") anchors directly above whichever composer is active (PIP in whiteboard view, main composer in chat view).
- **Toolbar (top-right, floating):** zoom %, reset, fit-all, "Export ▾" with PDF / PPTX / XLSX.
- **Empty state:** centered helper text explaining the board will fill as the assistant produces diagrams.

### 4.3 Chat PIP (whiteboard view only)

A draggable, collapsible picture-in-picture card, default bottom-right, approximately 360×480 px. Position and collapsed state persist in `localStorage` per user.

- **Transcript:** last N message exchanges (user messages + assistant **text-only** content). Where an assistant message produced a diagrammatic artifact, the transcript shows a chip ("📊 Q3 revenue — see board") instead of rendering the artifact — the artifact is already on the canvas.
- **Composer:** the same `<Composer>` primitive as the main chat-view composer, mounted inside the PIP. Submitting sends a new user message without leaving whiteboard view.
- **Live updates:** assistant responses stream into the PIP transcript; any new artifact from that response is placed on the canvas in real time (auto-layout picks a position, the card animates in) and the PIP transcript shows its chip.
- **Selection bar:** sits directly above the PIP composer when a selection is active.

### 4.4 View switcher

A segmented pill `[Chat | Whiteboard]` in the chat header, beside the conversation title. State reflected in the URL (`?view=chat|board`) so deep links and reloads are honored.

## 5. Data model

New table `whiteboard_artifacts`:

```ts
whiteboard_artifacts {
  id                uuid        primary key
  conversation_id   uuid        fk -> conversations(id) on delete cascade
  message_id        uuid        fk -> messages(id)      on delete cascade
  sequence          int         order of insertion within the conversation
  kind              enum('chart' | 'workflow' | 'mindmap' | 'flowchart' | 'spreadsheet')
  title             text
  summary           text        one-line description, used in the manifest
  payload           jsonb       full typed payload: ChartData | WorkflowData | MindmapData | FlowchartSource | SpreadsheetData
  canvas_x          int         auto-layout position
  canvas_y          int
  width             int         natural render size (used for layout)
  height            int
  created_at        timestamptz default now()
}
-- indexes: (conversation_id, sequence), (message_id)
```

Assistant messages continue to be stored in `messages`. Their body includes inline `<artifact id="art_…"/>` placeholders; a lightweight `artifacts: string[]` array on the message row enumerates the ids so the chat-view renderer can resolve them without reparsing.

**Write path.** When `aiOrchestrator` finishes a message, the existing artifact-extraction logic (`spreadsheet detector`, `parseWorkflowContent`, visualization extractor, new Mermaid extractor) runs, INSERTs one row per artifact, and inserts the placeholder tokens into the persisted message body.

**Derivation on reload.** The board view calls `GET /api/conversations/:id/whiteboard`, which returns the ordered artifact list with positions already computed.

## 6. Frontend component structure

```
client/src/components/chat/
├── ChatViewSwitcher.tsx            [Chat | Whiteboard] pill; reads/writes ?view= param
├── ChatMessageRich.tsx             replaces plain ChatMessage on the two target pages
├── Composer.tsx                    shared composer primitive (textarea + send + attachments)
├── artifacts/
│   ├── ArtifactRenderer.tsx        dispatcher by kind, given artifact_id or inline payload
│   ├── ChartArtifact.tsx           wraps VisualizationRenderer
│   ├── WorkflowArtifact.tsx        wraps WorkflowRenderer
│   ├── MindmapArtifact.tsx         wraps MindMapRenderer
│   ├── FlowchartArtifact.tsx       NEW — mermaid-based, async-imported
│   └── SpreadsheetArtifact.tsx     wraps SpreadsheetViewer
├── pip/
│   ├── ChatPIP.tsx                 draggable, collapsible PIP card
│   ├── PIPTranscript.tsx           text-only transcript with artifact chips
│   └── PIPComposer.tsx             mounts <Composer>
└── whiteboard/
    ├── Whiteboard.tsx              top-level container (toolbar + canvas + PIP + selection bar)
    ├── WhiteboardCanvas.tsx        react-zoom-pan-pinch viewport
    ├── WhiteboardToolbar.tsx       zoom %, reset, fit-all, Export ▾
    ├── ArtifactCard.tsx            absolute-positioned wrapper, reuses ArtifactRenderer
    ├── ExportMenu.tsx              shared export menu (board + per-card)
    ├── autoLayout.ts               pure row-packing layout function
    ├── useMultiSelection.ts        hook for selection set (cmd/ctrl/shift/Esc)
    └── useSelectionContext.ts      zustand store for pinned selection → composer
```

`ChatMessage.tsx` and the `ResizablePanelGroup` + `OutputPane` usages in `Chat.tsx` and `ForensicIntelligence.tsx` are removed from those two pages. `OutputPane.tsx` remains in the repo because other pages still depend on it.

## 7. In-chat rich rendering

- **Renderer:** `react-markdown` with `remark-gfm`, `remark-math`, `rehype-katex`, and the newly added `rehype-highlight` (single theme per color mode, ~15 kB).
- **Tables:** `components.table` / `thead` / `tbody` / `tr` / `th` / `td` map to shadcn `<Table>` primitives.
- **Code:** hover-to-copy button, pre-wrap behavior preserved.
- **Artifacts:** a custom rehype plugin rewrites `<artifact id="…"/>` placeholders to a React element that calls `ArtifactRenderer`. The artifact payloads come from `useConversationArtifacts(conversationId)`, a React Query hook invalidated when a new assistant message completes.
- **Streaming:** while a message is streaming, text/code/tables/math render progressively; artifact placeholders remain invisible until the orchestrator's post-processing finishes and inserts them, then artifacts appear in one tick. No partially-rendered charts.
- **User messages:** plain text, unchanged.

## 8. Whiteboard canvas details

### 8.1 Auto-layout

`autoLayout.ts` is a pure function taking `(artifacts[], canvasWidth = 2400, gutter = 40)` and returning the same list with `canvas_x` / `canvas_y` filled. Row-packed flow:

- Iterate artifacts in `sequence` order.
- Maintain a current row: `x` cursor, `rowTop`, `rowHeight`.
- If the next artifact's width exceeds the remaining row, wrap to a new row (`rowTop += rowHeight + gutter`).
- Once positioned, an artifact's coordinates are persisted and never recomputed, so appending is stable.

First render of a legacy conversation whose artifacts have no positions runs a one-time layout pass on the server and writes the results back.

### 8.2 Selection

`useMultiSelection` owns a `Set<ArtifactId>`:

- Plain click → single-select (replaces the set).
- Cmd/Ctrl-click → toggle one id in/out of the set.
- Shift-click → select the inclusive range between the anchor and the clicked id in `sequence` order.
- Empty-canvas click or Esc → clear.

`useSelectionContext` is a small zustand store with `{ artifactIds, highlightedText? }`. The composer subscribes and, on submit, attaches it to the mutation payload, then clears.

### 8.3 Export

New endpoint `POST /api/conversations/:id/whiteboard/export?format=pdf|pptx|xlsx` (server-side, scope-checked by session user). Optional body `{ artifactIds?: string[] }` for "export selected"; when omitted the entire board is exported.

- **PDF:** renders the transformed canvas layer to an image (`html-to-image` on the server is not feasible; the render happens client-side, then uploads the rendered bitmap to the export endpoint, which wraps it in a PDF via `pdfkit`). For long canvases, paginate by splitting on row boundaries from `autoLayout`.
- **PPTX:** one slide per artifact. Each artifact is sent as an image + the title + the kind badge. Uses `pptxgenjs` (already present on the export route's dependency set — verify in implementation).
- **XLSX (chart/graph data only):** iterates artifacts. For `kind='chart'`, one sheet per chart named by `title`, rows derived from the chart's underlying `data` array. For `kind='spreadsheet'`, preserve sheets as-is. For `kind in (workflow, mindmap, flowchart)`, skip and append a final "Skipped" sheet listing them.

Per-artifact export (existing `/api/export`) remains unchanged.

## 9. Agent awareness

### 9.1 Manifest

`server/services/whiteboard/manifest.ts` queries `whiteboard_artifacts` for the current conversation and produces a compact system-context block:

```
# Whiteboard (current conversation, 6 artifacts)
- art_01 · chart · "Q3 vs Q4 revenue" — quarterly revenue comparison
- art_02 · workflow · "Month-end close" — 9-step closing process
- art_03 · spreadsheet · "Variance analysis" — 3 sheets, DCF + ratios
…
Use read_whiteboard(artifact_id) to load the full payload of any item.
```

Budget: if the manifest exceeds ~1500 tokens, trim oldest-first and append `"…N earlier items omitted"`. `read_whiteboard` can still retrieve omitted items by id.

`aiOrchestrator.ts` inserts the manifest into the system context on every turn where the conversation has ≥1 artifact.

### 9.2 `read_whiteboard` tool

Registered in `server/services/aiProviders/registry.ts` alongside existing tools:

```ts
{
  name: "read_whiteboard",
  description: "Retrieve the full structured payload of an artifact currently on the whiteboard. Use when you need exact numbers, workflow steps, mindmap nodes, or spreadsheet cells from a prior artifact.",
  input_schema: { artifact_id: string },
  handler: async ({ artifact_id }, { conversationId }) => {
    const row = await db.select().from(whiteboard_artifacts).where(eq(id, artifact_id));
    if (!row || row.conversation_id !== conversationId) throw new Error("artifact_not_found");
    return { kind: row.kind, title: row.title, payload: row.payload };
  }
}
```

The cross-conversation scope check is non-negotiable.

### 9.3 Selection preamble

When the user submits a message with `selection: { artifactIds: [...], highlightedText? }`, the server prepends a short preamble to the user turn before the user's text:

```
[User has selected artifacts art_02, art_04, art_07.]
[Highlighted excerpt: "…text…"]
```

This is prompt injection of context, not a tool call — the agent reads the preamble and decides whether to use `read_whiteboard` for deeper payloads.

## 10. Testing strategy

**Unit tests:**

- `autoLayout.ts` — deterministic packing; appending only touches new rows; empty input → empty output; single oversized artifact gets its own row.
- `manifest.ts` — token-budget trimming keeps newest first; other conversations' artifacts never leak; snapshot test of format stability.
- `read_whiteboard` handler — rejects cross-conversation ids; returns full payload for owned ids.

**Integration tests (Vitest + supertest):**

- Message producing a chart creates a `whiteboard_artifacts` row with correct `message_id` / `conversation_id` and the stored message body contains the `<artifact id="…"/>` placeholder.
- Next turn's prompt includes a manifest entry for that chart.
- Mocked model emits a `read_whiteboard` tool call; response payload matches.
- Board export endpoint returns PDF/PPTX/XLSX successfully and honors `artifactIds` filter.

**Component tests (Vitest + Testing Library):**

- `ChatMessageRich` renders GFM tables, code-copy, math, and replaces `<artifact id="…"/>` with the right renderer.
- `Whiteboard` shows the empty state with zero artifacts and positioned cards for N > 0.
- Multi-selection modifiers: plain, cmd/ctrl, shift, Esc behave per spec.
- PIP: drags, stays in viewport, collapses and persists; composer submits produce a new message and, if applicable, place an artifact on the canvas in the same tick.

**Manual smoke (required before merge):**

On a dev server, exercise both target pages end-to-end for every artifact kind plus markdown table, code, and math. Exercise pan/zoom with a 10+ artifact conversation; exercise PIP drag/collapse; exercise multi-select + board export for all three formats. Type-check and tests passing is necessary but not sufficient — feature must work in a real browser.

## 11. Rollout

1. **Step 0 (prerequisite):** commit the current working tree on `main`. No code edits until this is done.
2. Schema migration: new `whiteboard_artifacts` table and a new `artifacts text[]` column on `messages` (nullable, defaulted to `NULL`). Lazy backfill: on first access of a conversation, if it has assistant messages but no rows, parse them once, insert rows, and set the `artifacts` column on each source message.
3. Ship behind a `WHITEBOARD_V2` feature flag on `Chat.tsx` and `ForensicIntelligence.tsx` to allow per-user QA toggling.
4. New endpoints: `GET /api/conversations/:id/whiteboard`, `POST /api/conversations/:id/whiteboard/export`, and the `read_whiteboard` tool registration in `aiProviders/registry.ts`.
5. `OutputPane.tsx` stays in the codebase; only the two target pages stop mounting it.
6. After a QA pass on both pages, remove the feature flag and treat the new UX as the default.

## 12. Open decisions deferred to implementation

- Exact Mermaid renderer wiring (client-side only vs. server-side render for PDF export).
- Whether PIP transcript shows the entire conversation or the last N exchanges (default: last 20, scroll for more).
- Export pagination threshold for PDF.
- Whether the whiteboard empty state also links to the chat view for first-time users.

None of these block the plan; they are small choices for the implementer to pick sensible defaults on and revisit if the smoke test reveals issues.
