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
  artifacts: Array<CreateArtifactInput & { id: string }>;
  layoutState: LayoutState;
  generatedIds: string[];
}

function summarize(title: string, kindHint: string): string {
  return `${kindHint} · ${title}`.slice(0, 120);
}

export function buildArtifactsForMessage(input: BuildArtifactsInput): BuildArtifactsOutput {
  const { content, conversationId, messageId, precomputed, idFactory } = input;
  let layoutState = input.layoutState;
  const artifacts: Array<CreateArtifactInput & { id: string }> = [];
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

  return { updatedContent, artifacts, layoutState, generatedIds };
}
