import { useState, useCallback } from "react";

interface Modifiers { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; }

export function useMultiSelection(orderedIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);

  const click = useCallback((id: string, mods: Modifiers) => {
    setSelected(prev => {
      const next = new Set(prev);
      const toggle = mods.metaKey || mods.ctrlKey;
      if (mods.shiftKey && anchor) {
        const a = orderedIds.indexOf(anchor);
        const b = orderedIds.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(orderedIds[i]);
          return next;
        }
      }
      if (toggle) {
        if (next.has(id)) next.delete(id); else next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
    if (!mods.shiftKey) setAnchor(id);
  }, [anchor, orderedIds]);

  const clear = useCallback(() => { setSelected(new Set()); setAnchor(null); }, []);

  return { selected, click, clear };
}
