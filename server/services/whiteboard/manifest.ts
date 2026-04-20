import type { WhiteboardArtifact } from "../../../shared/schema";

export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export interface TrimResult {
  kept: WhiteboardArtifact[];
  omitted: number;
}

/**
 * For checklist artifacts, enumerate the checked (or unchecked) item labels
 * inline in the manifest so the agent can answer "which items have I ticked?"
 * without needing an extra tool call. Truncated to avoid blowing the token
 * budget on long checklists.
 */
const MAX_ITEMS_EACH = 15;
const LABEL_CAP = 80;

function cap(s: string, max: number): string {
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function checklistDetail(a: WhiteboardArtifact): string {
  const items = ((a.payload as any)?.items ?? []) as Array<{ id: string; label?: string; section?: string }>;
  if (items.length === 0) return "";
  const checkedIds = new Set<string>((((a.state ?? {}) as any).checkedIds ?? []) as string[]);
  const checked = items.filter(i => checkedIds.has(i.id));
  const unchecked = items.filter(i => !checkedIds.has(i.id));

  const renderList = (rows: Array<{ id: string; label?: string; section?: string }>, take: number) => {
    const take_ = rows.slice(0, take);
    const lines = take_.map(i => {
      const label = cap(i.label || i.id, LABEL_CAP);
      return i.section
        ? `    • [${i.id}] ${label}  (section: ${i.section})`
        : `    • [${i.id}] ${label}`;
    });
    if (rows.length > take) lines.push(`    …and ${rows.length - take} more`);
    return lines;
  };

  const parts: string[] = [];
  if (checked.length > 0) {
    parts.push(`  Checked (${checked.length}):`);
    parts.push(...renderList(checked, MAX_ITEMS_EACH));
  }
  if (unchecked.length > 0) {
    parts.push(`  Outstanding (${unchecked.length}):`);
    parts.push(...renderList(unchecked, MAX_ITEMS_EACH));
  }
  return parts.join("\n");
}

function lineFor(a: WhiteboardArtifact): string {
  const base = `- ${a.id} · ${a.kind} · "${a.title}" — ${a.summary}`;
  // For checklists, append a progress indicator AND the actual item labels so
  // the agent can answer questions about checked/unchecked state without an
  // additional tool call. Bounded to keep the manifest compact.
  if (a.kind === "checklist") {
    const total = ((a.payload as any)?.items ?? []).length;
    const checked = (((a.state ?? {}) as any).checkedIds ?? []).length;
    const header = total > 0 ? `${base} [${checked}/${total} checked]` : base;
    const detail = checklistDetail(a);
    return detail ? `${header}\n${detail}` : header;
  }
  return base;
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

export function formatManifest(artifacts: WhiteboardArtifact[], maxTokens = 2500): string {
  if (artifacts.length === 0) return "";
  const { kept, omitted } = trimToTokenBudget(artifacts, maxTokens);
  const head = `# Whiteboard (current conversation, ${artifacts.length} artifact${artifacts.length === 1 ? "" : "s"})`;
  const lines = kept.map(lineFor);
  const tail = omitted > 0 ? [`…${omitted} earlier item${omitted === 1 ? "" : "s"} omitted (use read_whiteboard to retrieve by id).`] : [];
  const footer = [
    "",
    "When the user asks about checklist state — \"what did I check?\", \"what's left?\", \"am I done?\" — answer directly from the Checked / Outstanding lists above. Those ARE the current state; you do NOT need a tool call for that.",
    "For payloads that aren't listed above (charts, workflows, full mindmap data, spreadsheet cells), use read_whiteboard(artifact_id).",
    "To mark a checklist item done/undone, use update_checklist(artifact_id, item_id, checked).",
  ].join("\n");
  return [head, ...lines, ...tail, footer].join("\n");
}
