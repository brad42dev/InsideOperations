import { useState, useCallback } from "react";

/**
 * Manages the set of "highlighted" series keys for a chart.
 * Keys match the legend item labels (= slotLabel(slot) in most renderers).
 *
 * Single click   → select only this key (deselects if it was the only one)
 * Ctrl/Meta click → add/remove from multi-selection
 */
export function useHighlight() {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  const toggle = useCallback((key: string, multi: boolean) => {
    setHighlighted((prev) => {
      const next = new Set(prev);
      if (multi) {
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }
      // Single click: clear everything if anything is selected, otherwise select this one
      if (next.size > 0) return new Set();
      return new Set([key]);
    });
  }, []);

  const clear = useCallback(() => setHighlighted(new Set()), []);

  return { highlighted, toggle, clear };
}
