import { useEffect, useState } from "react";

interface SelectionSnapshot {
  text: string;
  artifactId: string;
  rect: { top: number; left: number };
}

/**
 * Listen for window text selections that start/end inside an artifact card
 * (`[data-artifact-id]`). When a non-empty selection is detected, expose a
 * snapshot that callers render as a floating "Ask about this" tooltip.
 *
 * Works across ALL artifact kinds because it reads the native browser
 * selection — same mechanism as quoting text from prose in the chat.
 * SVG-rendered diagrams (mermaid flowcharts, recharts, etc.) are also
 * selectable via the browser's native selection range.
 */
export function useSelectionTooltip(): {
  selection: SelectionSnapshot | null;
  clear: () => void;
} {
  const [selection, setSelection] = useState<SelectionSnapshot | null>(null);

  useEffect(() => {
    function handleMouseUp() {
      // Defer slightly so the browser has finalized the selection range.
      window.setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          setSelection(null);
          return;
        }
        const text = sel.toString().trim();
        if (!text) {
          setSelection(null);
          return;
        }
        // Only capture when the selection is anchored inside a card.
        const anchorNode = sel.anchorNode;
        if (!anchorNode) return;
        const el = anchorNode.nodeType === Node.ELEMENT_NODE
          ? (anchorNode as HTMLElement)
          : anchorNode.parentElement;
        if (!el) return;
        const cardEl = el.closest<HTMLElement>("[data-artifact-id]");
        if (!cardEl) {
          setSelection(null);
          return;
        }
        const artifactId = cardEl.dataset.artifactId;
        if (!artifactId) return;
        const range = sel.getRangeAt(0);
        const rects = range.getClientRects();
        const firstRect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
        setSelection({
          text: text.length > 400 ? text.slice(0, 400) + "…" : text,
          artifactId,
          rect: { top: firstRect.top, left: firstRect.left + firstRect.width / 2 },
        });
      }, 10);
    }

    function handleSelectionClear() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setSelection(null);
    }

    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("selectionchange", handleSelectionClear);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("selectionchange", handleSelectionClear);
    };
  }, []);

  return { selection, clear: () => setSelection(null) };
}
