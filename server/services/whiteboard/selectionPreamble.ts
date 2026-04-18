export interface SelectionInput {
  artifactIds?: string[];
  highlightedText?: string;
}

export function buildSelectionPreamble(selection: SelectionInput | undefined): string {
  if (!selection) return "";
  const ids = selection.artifactIds ?? [];
  if (ids.length === 0 && !selection.highlightedText) return "";
  const parts: string[] = [];
  if (ids.length === 1) parts.push(`[User has selected artifact ${ids[0]}.]`);
  else if (ids.length > 1) parts.push(`[User has selected artifacts ${ids.join(", ")}.]`);
  if (selection.highlightedText) parts.push(`[Highlighted excerpt: "${selection.highlightedText}"]`);
  return parts.join("\n");
}
