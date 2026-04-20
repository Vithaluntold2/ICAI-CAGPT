import { extractFlowcharts } from "./extractors/flowchart";
import { extractMindmaps } from "./extractors/mindmap";
import { extractCharts } from "./extractors/chart";
import { extractChecklist } from "./extractors/checklist";
import { placeNext, NATURAL_SIZE, type LayoutState } from "./autoLayout";
import type { CreateArtifactInput } from "./repository";

export interface PrecomputedArtifactSources {
  visualization?: { type: string; title?: string; data: unknown[]; [k: string]: unknown };
  workflow?: { title?: string; nodes: unknown[]; edges: unknown[]; [k: string]: unknown };
  mindmap?: { title?: string; nodes: unknown[]; edges?: unknown[]; [k: string]: unknown };
  spreadsheet?: { title?: string; sheets: unknown[]; [k: string]: unknown };
  /** Long-form markdown deliverable (Deliverable Composer). Rendered as a
   *  selectable, referenceable artifact instead of only flowing through chat. */
  document?: { title?: string; content: string; mode?: string; [k: string]: unknown };
}

export interface BuildArtifactsInput {
  content: string;
  conversationId: string;
  messageId: string;
  precomputed: PrecomputedArtifactSources;
  layoutState: LayoutState;
  idFactory: () => string;
  /** Chat mode gates mode-specific extractors. 'checklist' enables the checklist
   *  extractor; 'workflow' is already gated server-side in WorkflowGenerator. */
  chatMode?: string;
}

export interface BuildArtifactsOutput {
  updatedContent: string;
  artifacts: Array<CreateArtifactInput & { id: string }>;
  layoutState: LayoutState;
  generatedIds: string[];
}

function summarize(title: string, kindHint: string): string {
  return `${kindHint} · ${title}`.slice(0, 120);
}

export function buildArtifactsForMessage(input: BuildArtifactsInput): BuildArtifactsOutput {
  const { content, conversationId, messageId, precomputed, idFactory, chatMode } = input;
  let layoutState = input.layoutState;
  const artifacts: Array<CreateArtifactInput & { id: string }> = [];
  const generatedIds: string[] = [];
  let updatedContent = content;

  function place(
    kind: string,
    title: string,
    summary: string,
    payload: unknown,
    initialState?: Record<string, unknown>,
    sizeOverride?: { width: number; height: number },
  ): string {
    const size = sizeOverride ?? NATURAL_SIZE[kind] ?? { width: 600, height: 400 };
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
      state: (initialState ?? {}) as any,
      canvasX: position.canvasX,
      canvasY: position.canvasY,
      width: size.width,
      height: size.height,
    });
    return id;
  }

  // Estimate a spreadsheet tile size that actually fits the content instead of
  // using the blanket 900×500 default. Matches the real SpreadsheetViewer layout
  // — header row + data rows + optional "Excel Formulas" + "Applied Calculations"
  // sections — and clamps between min/max so tiles stay layout-friendly.
  function computeSpreadsheetSize(payload: any): { width: number; height: number } {
    const sheets: any[] = payload?.sheets ?? [];
    if (sheets.length === 0) return NATURAL_SIZE.spreadsheet;

    // Per-row pixel budgets — calibrated against SpreadsheetViewer's real
    // rendered cell heights. Earlier constants over-allocated and left
    // 100-200px of dead space below the last row in the card.
    const COL_PX = 110;
    const ROW_PX = 28;                  // was 34; actual rendered rows are ~28px
    const HEADER_ROW_PX = 32;           // was 38
    const CHROME_PX = 90;               // title + description + toolbar — was 140
    const TAB_PX = sheets.length > 1 ? 30 : 0;
    const FORMULAS_PX = (payload?.metadata?.calculations?.length ?? 0) > 0 ? 180 : 0;
    const BOTTOM_PAD_PX = 12;
    const MIN_W = 900, MAX_W = 2000;
    const MIN_H = 320, MAX_H = 1600;    // was 500; let short sheets be short

    let maxCols = 0;
    let dataRows = 0;
    for (const sheet of sheets) {
      const rows: any[][] = sheet.data ?? [];
      dataRows += Math.max(rows.length - 1, 0); // exclude header
      for (const row of rows) {
        if (Array.isArray(row) && row.length > maxCols) maxCols = row.length;
      }
    }

    const width  = Math.max(MIN_W, Math.min(MAX_W, maxCols * COL_PX + 40));
    const height = Math.max(MIN_H, Math.min(MAX_H,
      CHROME_PX + TAB_PX + HEADER_ROW_PX + dataRows * ROW_PX + FORMULAS_PX + BOTTOM_PAD_PX));
    return { width, height };
  }

  // Workflow cards need to scale with node count or ReactFlow's fitView
  // compresses a tall vertical flow into an unreadable 7% scale. Chat mode
  // already does this via `containerHeight = nodes.length > 40 ? 900 : ...`
  // — we match that logic for the whiteboard card so embedded workflows stay
  // at a readable zoom. Width stays at the default unless the layout is
  // horizontal (future work).
  function computeWorkflowSize(payload: any): { width: number; height: number } {
    const nodes: any[] = payload?.nodes ?? payload?.config?.nodes ?? [];
    const layout: string = (payload?.layout ?? payload?.config?.layout ?? "").toLowerCase();
    const count = nodes.length;
    if (count === 0) return NATURAL_SIZE.workflow;

    // Horizontal layouts (dagre-lr) grow wider, not taller — keep the default
    // height but widen the card proportionally. For now, only the vertical
    // case is optimised because that's where fitView's over-compression bites.
    if (layout.includes("lr") || layout.includes("horizontal")) {
      return {
        width: Math.min(2400, 400 + count * 220),
        height: 600,
      };
    }

    // Vertical flow: each step node renders at ~130px tall with ~80px gap
    // (ReactFlow dagre-tb default). Plus ~100px for the toolbar header.
    const HEADER_PX = 100;
    const STEP_PX = 200;           // 130 node + 70 gap
    const MIN_H = 500;
    const MAX_H = 2400;            // cap so a 40-step workflow doesn't produce a 8000px card
    const height = Math.max(MIN_H, Math.min(MAX_H, HEADER_PX + count * STEP_PX));
    return { width: 800, height };
  }

  // Mindmap cards follow the same fitView-shrinks-to-unreadable pattern as
  // workflows. MindMapRenderer's radial algorithm places nodes at
  // `level * 250px` radius, so a 4-level tree spans ~2000px in both
  // dimensions. Tree layouts depend on breadth instead. We estimate the
  // bounding box from node count + edge-graph depth and size the card so
  // fitView doesn't compress past a readable zoom (~0.5+).
  function computeMindmapSize(payload: any): { width: number; height: number } {
    const nodes: any[] = payload?.nodes ?? [];
    const edges: any[] = payload?.edges ?? [];
    const count = nodes.length;
    if (count === 0) return NATURAL_SIZE.mindmap;

    // Build child adjacency and BFS from root (or first node) to get depth.
    const children = new Map<string, string[]>();
    for (const e of edges) {
      const src = e?.source;
      const tgt = e?.target;
      if (!src || !tgt) continue;
      const arr = children.get(src) ?? [];
      arr.push(tgt);
      children.set(src, arr);
    }
    const root = nodes.find(n => n?.type === "root") ?? nodes[0];
    let maxDepth = 0;
    let maxBreadth = 1;
    if (root?.id) {
      const queue: Array<[string, number]> = [[root.id, 0]];
      const seen = new Set<string>([root.id]);
      const byLevel = new Map<number, number>();
      while (queue.length) {
        const [id, d] = queue.shift()!;
        maxDepth = Math.max(maxDepth, d);
        byLevel.set(d, (byLevel.get(d) ?? 0) + 1);
        for (const c of children.get(id) ?? []) {
          if (!seen.has(c)) {
            seen.add(c);
            queue.push([c, d + 1]);
          }
        }
      }
      for (const n of byLevel.values()) maxBreadth = Math.max(maxBreadth, n);
    }

    const layout: string = (payload?.layout ?? "radial").toString().toLowerCase();
    const MIN_W = 700, MAX_W = 2200, MIN_H = 500, MAX_H = 1800;

    let width: number, height: number;
    if (layout === "tree-vertical") {
      // width = breadth * node spacing; height = depth * rank separation
      width = Math.max(MIN_W, Math.min(MAX_W, maxBreadth * 220 + 200));
      height = Math.max(MIN_H, Math.min(MAX_H, (maxDepth + 1) * 200 + 200));
    } else if (layout === "tree-horizontal" || layout === "timeline") {
      width = Math.max(MIN_W, Math.min(MAX_W, (maxDepth + 1) * 280 + 300));
      height = Math.max(MIN_H, Math.min(MAX_H, maxBreadth * 140 + 200));
    } else {
      // radial / organic: roughly a square box 2 * radius * depth
      const diameter = 2 * (maxDepth + 1) * 250 + 300;
      width = Math.max(MIN_W, Math.min(MAX_W, diameter));
      height = Math.max(MIN_H, Math.min(MAX_H, diameter));
    }
    return { width, height };
  }

  if (precomputed.visualization) {
    const title = precomputed.visualization.title ?? "Chart";
    const id = place("chart", title, summarize(title, "chart"), precomputed.visualization);
    updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}"></artifact>`;
  }
  if (precomputed.workflow) {
    const title = precomputed.workflow.title ?? "Workflow";
    // WorkflowGenerator emits the visualization as { type, title, data, config:
    // { nodes, edges, layout, isLargeWorkflow } } — nodes/edges nested inside
    // `config`. But WorkflowArtifact reads `payload.nodes` / `payload.edges` /
    // `payload.layout` at the TOP LEVEL. Without flattening, the client gets
    // undefined, falls back to [], and shows the "No workflow to display"
    // empty-state card even though the data is there.
    const rawWorkflow = precomputed.workflow as any;
    const config = rawWorkflow.config ?? {};
    const flatPayload = {
      title: rawWorkflow.title,
      nodes: rawWorkflow.nodes ?? config.nodes ?? [],
      edges: rawWorkflow.edges ?? config.edges ?? [],
      layout: rawWorkflow.layout ?? config.layout,
      isLargeWorkflow: rawWorkflow.isLargeWorkflow ?? config.isLargeWorkflow,
    };
    const workflowSize = computeWorkflowSize(flatPayload);
    const id = place(
      "workflow",
      title,
      summarize(title, "workflow"),
      flatPayload,
      undefined,
      workflowSize,
    );
    updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}"></artifact>`;
  }
  if (precomputed.mindmap) {
    const title = precomputed.mindmap.title ?? "Mindmap";
    const mindmapSize = computeMindmapSize(precomputed.mindmap);
    const id = place(
      "mindmap",
      title,
      summarize(title, "mindmap"),
      precomputed.mindmap,
      undefined,
      mindmapSize,
    );
    updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}"></artifact>`;
  }
  if (precomputed.spreadsheet) {
    const title = precomputed.spreadsheet.title ?? "Spreadsheet";
    const sizeOverride = computeSpreadsheetSize(precomputed.spreadsheet);
    const id = place(
      "spreadsheet",
      title,
      summarize(title, "spreadsheet"),
      precomputed.spreadsheet,
      undefined,
      sizeOverride,
    );
    updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}"></artifact>`;
  }
  if (precomputed.document) {
    const title = precomputed.document.title ?? "Document";
    // Deliberately NOT appending an <artifact /> placeholder for documents —
    // the document's content is already the chat prose, so inlining the
    // artifact would render the same text twice. The artifact still exists on
    // the whiteboard (selectable, referenceable, downloadable) — it's just
    // not echoed inline in the chat stream.
    place(
      "document",
      title,
      summarize(title, "document"),
      precomputed.document,
    );
  }

  const flowcharts = extractFlowcharts(updatedContent);
  for (const fc of flowcharts) {
    const id = place("flowchart", fc.title, fc.summary, { source: fc.source });
    updatedContent = updatedContent.replace(fc.rawMatch, `<artifact id="${id}"></artifact>`);
  }

  // Inline ```mindmap fenced blocks: promote to persisted whiteboard artifacts
  // so they survive refresh, are selectable, and become visible to the agent's
  // manifest on the next turn. Replacing the fence with an <artifact /> stops
  // the chat code-component dispatcher from also rendering the raw block.
  const mindmapFences = extractMindmaps(updatedContent);
  for (const mm of mindmapFences) {
    const id = place("mindmap", mm.title, mm.summary, mm.payload);
    updatedContent = updatedContent.replace(mm.rawMatch, `<artifact id="${id}"></artifact>`);
  }

  // Strip any remaining ```mindmap``` fences — these are malformed or empty
  // blocks the AI emitted alongside a structured mindmap artifact. Leaving them
  // causes the chat markdown renderer to fire a "JSON invalid" banner next to
  // the already-rendered mindmap. If the mindmap came through precomputed or a
  // valid fence, this strip is a no-op on its raw text (already replaced with
  // <artifact />). If it was junk, we silently drop it.
  updatedContent = updatedContent.replace(/```mindmap\s*[\s\S]*?```/g, "");

  // Inline chart JSON: ```chart / ```json fenced blocks OR bare chart-shaped
  // JSON objects in prose get promoted to chart artifacts. Before this
  // extractor existed, audit-plan / deep-research queries that asked the AI
  // to "generate a chart for that" got a pretty-printed JSON blob in chat
  // instead of a rendered chart — no server-side code recognised the format.
  const chartSpecs = extractCharts(updatedContent);
  for (const c of chartSpecs) {
    const id = place("chart", c.title, c.summary, c.payload);
    updatedContent = updatedContent.replace(c.rawMatch, `<artifact id="${id}"></artifact>`);
  }

  // Mode-gated: checklist artifacts are only extracted in checklist mode.
  // Other modes that happen to contain "- [ ]" lines just keep them as text.
  if (chatMode === "checklist") {
    const checklist = extractChecklist(updatedContent);
    if (checklist) {
      const summary = summarize(checklist.title, "checklist");
      const payload = {
        title: checklist.title,
        items: checklist.items.map(i => ({ id: i.id, label: i.label, hint: i.hint, section: i.section })),
      };
      const initialCheckedIds = checklist.items.filter(i => i.defaultChecked).map(i => i.id);
      const id = place(
        "checklist",
        checklist.title,
        summary,
        payload,
        { checkedIds: initialCheckedIds, updatedAt: new Date().toISOString() },
      );
      if (checklist.rawMatch) {
        updatedContent = updatedContent.replace(checklist.rawMatch, `<artifact id="${id}"></artifact>`);
      } else {
        updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}"></artifact>`;
      }
    }
  }

  return { updatedContent, artifacts, layoutState, generatedIds };
}
