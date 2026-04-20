import { extractFlowcharts } from "./extractors/flowchart";
import { extractMindmaps } from "./extractors/mindmap";
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

    // Per-row pixel budgets — matched to SpreadsheetViewer's rendered cells.
    const COL_PX = 110;
    const ROW_PX = 34;
    const HEADER_ROW_PX = 38;
    const CHROME_PX = 140;              // title + description + toolbar
    const TAB_PX = sheets.length > 1 ? 36 : 0;
    const FORMULAS_PX = (payload?.metadata?.calculations?.length ?? 0) > 0 ? 220 : 0;
    const MIN_W = 900, MAX_W = 2000;
    const MIN_H = 500, MAX_H = 1600;

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
      CHROME_PX + TAB_PX + HEADER_ROW_PX + dataRows * ROW_PX + FORMULAS_PX + 40));
    return { width, height };
  }

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
    const sizeOverride = computeSpreadsheetSize(precomputed.spreadsheet);
    const id = place(
      "spreadsheet",
      title,
      summarize(title, "spreadsheet"),
      precomputed.spreadsheet,
      undefined,
      sizeOverride,
    );
    updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}" />`;
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
    updatedContent = updatedContent.replace(fc.rawMatch, `<artifact id="${id}" />`);
  }

  // Inline ```mindmap fenced blocks: promote to persisted whiteboard artifacts
  // so they survive refresh, are selectable, and become visible to the agent's
  // manifest on the next turn. Replacing the fence with an <artifact /> stops
  // the chat code-component dispatcher from also rendering the raw block.
  const mindmapFences = extractMindmaps(updatedContent);
  for (const mm of mindmapFences) {
    const id = place("mindmap", mm.title, mm.summary, mm.payload);
    updatedContent = updatedContent.replace(mm.rawMatch, `<artifact id="${id}" />`);
  }

  // Strip any remaining ```mindmap``` fences — these are malformed or empty
  // blocks the AI emitted alongside a structured mindmap artifact. Leaving them
  // causes the chat markdown renderer to fire a "JSON invalid" banner next to
  // the already-rendered mindmap. If the mindmap came through precomputed or a
  // valid fence, this strip is a no-op on its raw text (already replaced with
  // <artifact />). If it was junk, we silently drop it.
  updatedContent = updatedContent.replace(/```mindmap\s*[\s\S]*?```/g, "");

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
        updatedContent = updatedContent.replace(checklist.rawMatch, `<artifact id="${id}" />`);
      } else {
        updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}" />`;
      }
    }
  }

  return { updatedContent, artifacts, layoutState, generatedIds };
}
