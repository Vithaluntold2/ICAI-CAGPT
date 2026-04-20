import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleDashed, Download, Loader2, Quote } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSelectionContext } from "../whiteboard/useSelectionContext";

interface ChecklistItem {
  id: string;
  label: string;
  hint?: string;
  section?: string;
}

interface ChecklistPayload {
  title?: string;
  items: ChecklistItem[];
}

interface ChecklistState {
  checkedIds?: string[];
  updatedAt?: string;
}

interface Props {
  artifactId: string;
  conversationId?: string;
  payload: ChecklistPayload;
  state: ChecklistState;
  /** True when rendered inside the whiteboard ArtifactCard (which owns the
   *  outer border + title). Standalone chat rendering gets its own card. */
  embedded?: boolean;
}

/**
 * Interactive checklist. Optimistic UI: clicks toggle immediately in local
 * state, then debounce-save to the server via PATCH .../state. Keeps the
 * whiteboard React Query cache in sync so re-renders reflect the saved state
 * without a round-trip. Agent-driven updates (via update_checklist tool) also
 * flow through the same cache on the next manifest refresh / SSE end event.
 */
export function ChecklistArtifact({ artifactId, conversationId, payload, state, embedded = false }: Props) {
  const items = payload?.items ?? [];
  const sections = useMemo(() => groupBySection(items), [items]);

  const [checked, setChecked] = useState<Set<string>>(new Set(state?.checkedIds ?? []));
  const [saving, setSaving] = useState(false);
  const queuedRef = useRef<Set<string> | null>(null);
  const timerRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const setHighlight = useSelectionContext(s => s.setHighlight);

  /**
   * Quick-reference: push THIS specific item into the composer's selection
   * context (as `highlightedText`) scoped to this artifact. Stops the row's
   * click handler so it doesn't also toggle the checkbox.
   */
  const referenceItem = useCallback((e: React.MouseEvent, item: ChecklistItem) => {
    e.stopPropagation();
    e.preventDefault();
    const label = item.section ? `${item.section}: ${item.label}` : item.label;
    setHighlight([artifactId], label);
    const input = document.querySelector<HTMLTextAreaElement>('[data-testid="composer-input"]');
    input?.focus();
  }, [artifactId, setHighlight]);

  // Keep local state in sync if the artifact row changes out-of-band (e.g. agent
  // toggles an item via update_checklist — the whiteboard query refetches and
  // this prop updates).
  useEffect(() => {
    setChecked(new Set(state?.checkedIds ?? []));
  }, [state?.checkedIds]);

  const flush = useCallback(async (ids: Set<string>) => {
    if (!conversationId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/whiteboard/${artifactId}/state`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: { checkedIds: Array.from(ids) } }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Invalidate the whiteboard cache so any sibling card reads fresh data.
      queryClient.invalidateQueries({ queryKey: ["whiteboard", conversationId] });
    } catch (err) {
      // Roll back on failure
      setChecked(new Set(state?.checkedIds ?? []));
      console.error("[ChecklistArtifact] save failed", err);
    } finally {
      setSaving(false);
    }
  }, [conversationId, artifactId, queryClient, state?.checkedIds]);

  const toggle = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Debounced save (400 ms idle window)
      queuedRef.current = next;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (queuedRef.current) flush(queuedRef.current);
        queuedRef.current = null;
        timerRef.current = null;
      }, 400) as unknown as number;
      return next;
    });
  }, [flush]);

  // Flush on unmount if something's still queued so clicks never get lost.
  useEffect(() => {
    return () => {
      if (queuedRef.current) void flush(queuedRef.current);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [flush]);

  const totalCount = items.length;
  const checkedCount = checked.size;

  // Serialise the checklist to GitHub-flavored markdown so users can paste it
  // into docs, PRs, or Notion without losing the checked/unchecked state or
  // the section structure. Hints come through as blockquotes under each item.
  const buildMarkdown = useCallback((): string => {
    const lines: string[] = [];
    const title = payload?.title?.trim();
    if (title) {
      lines.push(`# ${title}`);
      lines.push("");
    }
    for (const { name, items: sectionItems } of sections) {
      if (name) {
        lines.push(`## ${name}`);
        lines.push("");
      }
      for (const item of sectionItems) {
        const box = checked.has(item.id) ? "[x]" : "[ ]";
        lines.push(`- ${box} ${item.label}`);
        if (item.hint) {
          lines.push(`  > ${item.hint}`);
        }
      }
      lines.push("");
    }
    return lines.join("\n").trimEnd() + "\n";
  }, [payload?.title, sections, checked]);

  const handleDownload = useCallback(() => {
    const md = buildMarkdown();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const base = (payload?.title || "checklist").replace(/[^a-z0-9_-]+/gi, "_");
    a.download = `${base}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildMarkdown, payload?.title]);

  return (
    <div
      className={
        embedded
          ? "w-full h-full overflow-auto"
          : "w-full bg-card border rounded-lg overflow-auto max-h-[720px]"
      }
      data-testid={`checklist-artifact-${artifactId}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b text-xs bg-muted/40">
        <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{checkedCount}/{totalCount}</span>
        <span className="text-muted-foreground">complete</span>
        {saving && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            saving…
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-6 px-2 text-[11px]"
          onClick={handleDownload}
          title="Download as Markdown"
          data-testid="checklist-download"
        >
          <Download className="h-3 w-3 mr-1" />
          .md
        </Button>
      </div>
      <div className="p-3 space-y-3">
        {sections.map(({ name, items: sectionItems }, idx) => (
          <div key={name ?? `__unsectioned_${idx}`} className="space-y-1">
            {name && (
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mt-1">
                {name}
              </div>
            )}
            <ul className="space-y-1">
              {sectionItems.map(item => {
                const isChecked = checked.has(item.id);
                return (
                  <li key={item.id} className="group/item relative">
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={cn(
                        "w-full text-left flex items-start gap-2 px-2 py-1.5 pr-9 rounded hover:bg-muted/60 transition-colors",
                        isChecked && "opacity-60",
                      )}
                      data-testid={`checklist-item-${item.id}`}
                      data-checked={isChecked}
                    >
                      <span
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center",
                          isChecked
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/50",
                        )}
                      >
                        {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="flex-1 text-sm leading-snug">
                        <span className={cn(isChecked && "line-through")}>{item.label}</span>
                        {item.hint && (
                          <span className="block text-xs text-muted-foreground mt-0.5">{item.hint}</span>
                        )}
                      </span>
                    </button>
                    {/* Quick-reference: push THIS item into the composer's
                        selection context. Hover-revealed so it doesn't clutter
                        the row at rest. Stops propagation so clicking it
                        doesn't also toggle the checkbox. */}
                    <button
                      type="button"
                      onClick={(e) => referenceItem(e, item)}
                      className="absolute right-2 top-1.5 h-6 w-6 rounded inline-flex items-center justify-center text-muted-foreground opacity-0 group-hover/item:opacity-100 hover:bg-muted hover:text-foreground transition-opacity focus-visible:opacity-100"
                      title="Ask about this item"
                      aria-label="Ask about this item"
                      data-testid={`checklist-item-ref-${item.id}`}
                    >
                      <Quote className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupBySection(
  items: ChecklistItem[],
): Array<{ name: string | null; items: ChecklistItem[] }> {
  const out: Array<{ name: string | null; items: ChecklistItem[] }> = [];
  let current: { name: string | null; items: ChecklistItem[] } | null = null;
  for (const it of items) {
    const key = it.section ?? null;
    if (!current || current.name !== key) {
      current = { name: key, items: [] };
      out.push(current);
    }
    current.items.push(it);
  }
  return out;
}
