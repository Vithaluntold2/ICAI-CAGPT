import { useEffect } from "react";
import { create } from "zustand";

interface VisibleArtifactsState {
  visibleIds: Set<string>;
  setVisible: (id: string, visible: boolean) => void;
  reset: () => void;
}

/**
 * Global store of which artifact cards are currently in the whiteboard
 * viewport. Updated by IntersectionObserver attached to every ArtifactCard
 * (via useReportArtifactVisibility). Read by the reference resolver to bias
 * ambiguous pronouns toward artifacts the user is actually looking at.
 *
 * Why a store and not component state: ArtifactCards are rendered inside
 * a pan/zoom transform on the canvas, but the composer that cares about
 * visibility lives outside it. Lifting this into a tiny zustand store is
 * simpler than context + prop drilling and avoids re-rendering the whole
 * whiteboard tree on every intersection change.
 */
export const useVisibleArtifactsStore = create<VisibleArtifactsState>((set) => ({
  visibleIds: new Set<string>(),
  setVisible: (id, visible) =>
    set((state) => {
      const next = new Set(state.visibleIds);
      if (visible) next.add(id);
      else next.delete(id);
      if (next.size === state.visibleIds.size) {
        // Avoid spurious state churn when a card reports the same status twice.
        let same = true;
        for (const v of next) if (!state.visibleIds.has(v)) { same = false; break; }
        if (same) return state;
      }
      return { visibleIds: next };
    }),
  reset: () => set({ visibleIds: new Set<string>() }),
}));

/** Read-only accessor for consumers that only need the current ids. */
export function useVisibleArtifactIds(): string[] {
  return Array.from(useVisibleArtifactsStore((s) => s.visibleIds));
}

/**
 * Mount this hook inside each ArtifactCard. It observes the card's root DOM
 * element and reports its visibility (>= 40% in view) to the global store.
 * The threshold is intentionally loose so partially-scrolled cards still
 * count as "looking at this".
 */
export function useReportArtifactVisibility(
  id: string,
  ref: React.RefObject<HTMLElement | null>,
): void {
  const setVisible = useVisibleArtifactsStore((s) => s.setVisible);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // IntersectionObserver is available in every modern browser we support.
    // rootMargin is negative so a card only counts as "visible" once its
    // centre is comfortably in view — avoids false positives from cards
    // that are barely peeking at the top/bottom edge.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setVisible(id, entry.isIntersecting && entry.intersectionRatio >= 0.4);
        }
      },
      { threshold: [0, 0.4, 1], rootMargin: "-10% 0px -10% 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      // On unmount clear our entry so a stale id never lingers.
      setVisible(id, false);
    };
  }, [id, ref, setVisible]);
}
