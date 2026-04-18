import type { WhiteboardArtifact } from "../../../shared/schema";

export function estimateTokens(s: string): number {
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
