import { useRef, useCallback } from "react";

/**
 * useLongPress — mobile equivalent of right-click.
 *
 * Returns touch event handlers that fire a callback after a 500ms press
 * without movement. Clears if the finger moves more than 10px or lifts
 * before the threshold.
 *
 * Spec reference: DOC 32 §Mobile — long-press (500ms) is the mobile
 * equivalent of right-click and opens the same context menu.
 *
 * @example
 * const longPress = useLongPress(() => openContextMenu());
 *
 * return <div {...longPress}>...</div>;
 */
export function useLongPress(onLongPress: () => void, ms = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      startPosRef.current = { x: touch.clientX, y: touch.clientY };
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        startPosRef.current = null;
        onLongPress();
      }, ms);
    },
    [onLongPress, ms],
  );

  const onTouchEnd = useCallback(() => {
    clear();
  }, [clear]);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startPosRef.current) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startPosRef.current.x);
      const dy = Math.abs(touch.clientY - startPosRef.current.y);
      if (dx > 10 || dy > 10) {
        clear();
      }
    },
    [clear],
  );

  return { onTouchStart, onTouchEnd, onTouchMove };
}
