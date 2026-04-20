export interface ExtractedMindmap {
  payload: any;
  rawMatch: string;
  title: string;
  summary: string;
}

// Matches ```mindmap\n{...}\n``` fenced blocks. The chat renderer also dispatches
// this fence to MindmapArtifact inline, but once the extractor replaces the fence
// with an <artifact /> placeholder the inline path no longer fires — preventing
// double rendering.
const MINDMAP_FENCE_RE = /```mindmap\n([\s\S]*?)\n```/g;

function summariseFromPayload(p: any): { title: string; summary: string } {
  const title = typeof p?.title === "string" && p.title.trim() ? p.title.trim() : "Mindmap";
  const subtitle = typeof p?.subtitle === "string" ? p.subtitle.trim() : "";
  const nodeCount = Array.isArray(p?.nodes) ? p.nodes.length : 0;
  const base = subtitle || `${nodeCount} node${nodeCount === 1 ? "" : "s"}`;
  const summary = base.length > 100 ? base.slice(0, 97) + "…" : base;
  return { title, summary };
}

export function extractMindmaps(content: string): ExtractedMindmap[] {
  const results: ExtractedMindmap[] = [];
  for (const match of content.matchAll(MINDMAP_FENCE_RE)) {
    const raw = match[1].trim();
    try {
      const payload = JSON.parse(raw);
      // Only accept blocks that actually look like a mindmap — a `nodes` array is
      // the minimum. Skip malformed blocks so they render as an error inline.
      if (!payload || !Array.isArray(payload.nodes)) continue;
      const { title, summary } = summariseFromPayload(payload);
      results.push({ payload, rawMatch: match[0], title, summary });
    } catch {
      // Invalid JSON — leave the fence in place so the chat inline renderer can
      // surface the parse error to the user.
      continue;
    }
  }
  return results;
}
