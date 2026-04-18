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
