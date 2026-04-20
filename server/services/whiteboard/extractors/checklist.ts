/**
 * Parse a checklist-mode response into structured items.
 *
 * Agent produces either:
 *   1. A <DELIVERABLE> block with markdown checkbox lines (`- [ ] item` / `- [x] item`)
 *   2. Plain markdown checkbox lines anywhere in the response
 *   3. A nested list: section heading + bullet items under it
 *
 * We pick the richest match and return a normalized shape. An empty items array
 * means nothing checklist-shaped was found (caller should not create an artifact).
 */

export interface ChecklistItem {
  id: string;
  label: string;
  /** Optional short hint / note shown under the item. */
  hint?: string;
  /** Section grouping (maps to an H2/H3 heading above the items). */
  section?: string;
  /** Initial checked state derived from `- [x]` markers in the source. */
  defaultChecked: boolean;
}

export interface ExtractedChecklist {
  title: string;
  items: ChecklistItem[];
  rawMatch: string;
}

const DELIVERABLE_RE = /<DELIVERABLE>([\s\S]*?)<\/DELIVERABLE>/i;
const CHECKBOX_LINE_RE = /^\s*[-*+]\s*\[(\s|x|X)\]\s*(.+?)\s*$/;
const HEADING_RE = /^\s*#{1,6}\s+(.+?)\s*$/;

function slug(s: string, index: number): string {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base ? `${base}-${index}` : `item-${index}`;
}

export function extractChecklist(content: string, messageTitle?: string): ExtractedChecklist | null {
  const deliverable = content.match(DELIVERABLE_RE);
  const source = deliverable ? deliverable[1] : content;
  const rawMatch = deliverable ? deliverable[0] : "";

  const lines = source.split("\n");
  const items: ChecklistItem[] = [];
  let currentSection: string | undefined;
  let titleFromContent: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(HEADING_RE);
    if (heading) {
      // The first top-level heading becomes the checklist title; deeper
      // headings are treated as section groupings for items that follow.
      if (!titleFromContent) {
        titleFromContent = heading[1].trim();
      } else {
        currentSection = heading[1].trim();
      }
      continue;
    }
    const box = line.match(CHECKBOX_LINE_RE);
    if (!box) continue;

    const checked = box[1].toLowerCase() === "x";
    const label = box[2].trim();
    if (!label) continue;

    // A continuation line indented under the item becomes its hint.
    let hint: string | undefined;
    const next = lines[i + 1];
    if (next && /^\s{2,}\S/.test(next) && !CHECKBOX_LINE_RE.test(next) && !HEADING_RE.test(next)) {
      hint = next.trim().replace(/^[-*+•]\s*/, "");
      i++;
    }

    items.push({
      id: slug(label, items.length),
      label,
      hint,
      section: currentSection,
      defaultChecked: checked,
    });
  }

  if (items.length === 0) return null;

  return {
    title: titleFromContent || messageTitle || "Checklist",
    items,
    rawMatch,
  };
}
