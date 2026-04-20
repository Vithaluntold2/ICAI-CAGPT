import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleDashed, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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
}

/**
 * Interactive checklist. Optimistic UI: clicks toggle immediately in local
 * state, then debounce-save to the server via PATCH .../state. Keeps the
 * whiteboard React Query cache in sync so re-renders reflect the saved state
 * without a round-trip. Agent-driven updates (via update_checklist tool) also
 * flow through the same cache on the next manifest refresh / SSE end event.
 */
export function ChecklistArtifact({ artifactId, conversationId, payload, state }: Props) {
  const items = payload?.items ?? [];
  const sections = useMemo(() => groupBySection(items), [items]);

  const [checked, setChecked] = useState<Set<string>>(new Set(state?.checkedIds ?? []));
  const [saving, setSaving] = useState(false);
  const queuedRef = useRef<Set<string> | null>(null);
  const timerRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

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

  return (
    <div className="w-full h-full overflow-auto" data-testid={`checklist-artifact-${artifactId}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b text-xs bg-muted/40">
        <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{checkedCount}/{totalCount}</span>
        <span className="text-muted-foreground">complete</span>
        {saving && (
          <span className="ml-auto flex items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            saving…
          </span>
        )}
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
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={cn(
                        "w-full text-left flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/60 transition-colors",
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
