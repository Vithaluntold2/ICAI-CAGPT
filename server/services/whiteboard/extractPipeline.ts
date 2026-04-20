import { extractFlowcharts } from "./extractors/flowchart";
import { extractChecklist } from "./extractors/checklist";
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
  ): string {
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
      state: (initialState ?? {}) as any,
      canvasX: position.canvasX,
      canvasY: position.canvasY,
      width: size.width,
      height: size.height,
    });
    return id;
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
    const id = place("spreadsheet", title, summarize(title, "spreadsheet"), precomputed.spreadsheet);
    updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}" />`;
  }

  const flowcharts = extractFlowcharts(updatedContent);
  for (const fc of flowcharts) {
    const id = place("flowchart", fc.title, fc.summary, { source: fc.source });
    updatedContent = updatedContent.replace(fc.rawMatch, `<artifact id="${id}" />`);
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
        updatedContent = updatedContent.replace(checklist.rawMatch, `<artifact id="${id}" />`);
      } else {
        updatedContent = `${updatedContent.trimEnd()}\n<artifact id="${id}" />`;
      }
    }
  }

  return { updatedContent, artifacts, layoutState, generatedIds };
}
