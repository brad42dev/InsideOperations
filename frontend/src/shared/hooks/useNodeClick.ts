import { useCallback } from "react";

export interface NodeHit {
  nodeId: string;
  nodeEl: Element;
}

interface Options {
  /** Container element to scope the DOM walk. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Called when a node is hit. Receives the hit and whether Ctrl/Meta was held. */
  onHit: (hit: NodeHit, additive: boolean) => void;
  /** Called when the click lands on no node (background click). */
  onMiss: () => void;
}

/**
 * Walks from a click target up to the nearest [data-node-id] ancestor, with an
 * 8-point ±4px radius probe to handle fill="none" SVG paths.
 *
 * Canonical behavior defined in docs/decisions/selection-behavior.md.
 *
 * Usage:
 *   const { handleClick } = useNodeClick({ containerRef, onHit, onMiss });
 *   // Attach handleClick to the container div's onClick.
 */
export function useNodeClick({ containerRef, onHit, onMiss }: Options) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const root = containerRef.current;

      function walkToNodeId(target: Element | null): NodeHit | null {
        let el = target as HTMLElement | null;
        while (el && el !== root) {
          const id = el.getAttribute("data-node-id");
          if (id) return { nodeId: id, nodeEl: el };
          el = el.parentElement;
        }
        return null;
      }

      let found = walkToNodeId(e.target as Element);

      if (!found) {
        const OFFSETS = [
          [-4, 0],
          [4, 0],
          [0, -4],
          [0, 4],
          [-3, -3],
          [3, -3],
          [-3, 3],
          [3, 3],
        ] as const;
        outer: for (const [dx, dy] of OFFSETS) {
          for (const el of document.elementsFromPoint(
            e.clientX + dx,
            e.clientY + dy,
          )) {
            found = walkToNodeId(el);
            if (found) break outer;
          }
        }
      }

      if (!found) {
        onMiss();
        return;
      }

      onHit(found, e.ctrlKey || e.metaKey);
    },
    [containerRef, onHit, onMiss],
  );

  return { handleClick };
}
