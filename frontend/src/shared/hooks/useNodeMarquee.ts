import { useState, useRef, useCallback } from "react";

export interface MarqueeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Options {
  /** Called on release when the marquee is large enough. Receives IDs of hit nodes. */
  onSelect: (nodeIds: string[]) => void;
  /** Container ref whose [data-node-id] children are tested against the marquee. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Minimum box dimension (each side) to trigger a selection. Default 6. */
  minSize?: number;
  /** Movement threshold before marquee activates and pointer capture is acquired. Default 3. */
  dragThreshold?: number;
}

interface MarqueeHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  /** True immediately after a marquee completes — consume in onClick to suppress the
   *  synthesized click that fires after pointer-capture release. */
  consumeClick: () => boolean;
  /** Current marquee rect for rendering the overlay, or null when inactive. */
  marqueeRect: MarqueeRect | null;
}

/**
 * Rubber-band marquee selection for Mode A (view) canvas surfaces.
 *
 * Canonical behavior defined in docs/decisions/selection-behavior.md.
 *
 * Usage:
 *   const marquee = useNodeMarquee({ containerRef, onSelect: handleMarqueeSelect });
 *   // Spread handlers onto the container div, render overlay when marquee.marqueeRect != null.
 */
export function useNodeMarquee({
  onSelect,
  containerRef,
  minSize = 6,
  dragThreshold = 3,
}: Options): MarqueeHandlers {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const rectRef = useRef<MarqueeRect | null>(null);
  const hasCaptureRef = useRef(false);
  const completedRef = useRef(false);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);

  const clear = useCallback(() => {
    startRef.current = null;
    rectRef.current = null;
    hasCaptureRef.current = false;
    setMarqueeRect(null);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!e.isPrimary || e.button !== 0) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      startRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      hasCaptureRef.current = false;
    },
    [containerRef],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current || !e.isPrimary) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - startRef.current.x;
      const dy = y - startRef.current.y;
      if (!hasCaptureRef.current) {
        if (Math.abs(dx) < dragThreshold && Math.abs(dy) < dragThreshold)
          return;
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        hasCaptureRef.current = true;
      }
      const mr: MarqueeRect = {
        x: Math.min(x, startRef.current.x),
        y: Math.min(y, startRef.current.y),
        w: Math.abs(dx),
        h: Math.abs(dy),
      };
      rectRef.current = mr;
      setMarqueeRect(mr);
    },
    [containerRef, dragThreshold],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      const mr = rectRef.current;
      clear();

      if (!mr || mr.w < minSize || mr.h < minSize) return;

      completedRef.current = true;

      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const selLeft = containerRect.left + mr.x;
      const selTop = containerRect.top + mr.y;
      const selRight = selLeft + mr.w;
      const selBottom = selTop + mr.h;

      const hits: string[] = [];
      containerRef.current
        ?.querySelectorAll<Element>("[data-node-id]")
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          if (
            r.left < selRight &&
            r.right > selLeft &&
            r.top < selBottom &&
            r.bottom > selTop
          ) {
            const id = el.getAttribute("data-node-id");
            if (id) hits.push(id);
          }
        });

      onSelect(hits);
    },
    [clear, containerRef, minSize, onSelect],
  );

  const onPointerCancel = useCallback(
    (_e: React.PointerEvent) => {
      clear();
    },
    [clear],
  );

  const consumeClick = useCallback(() => {
    if (completedRef.current) {
      completedRef.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    consumeClick,
    marqueeRect,
  };
}
