import { useState, useEffect, useRef } from "react";

export const UPDATE_FLASH_DURATION_MS = 150;
export const UPDATE_FLASH_COOLDOWN_MS = 2000;

/**
 * Returns true for 150ms after the value changes, then false.
 * Respects a 2s cooldown between flashes to avoid rapid-fire strobing.
 * Always returns false when isInAlarm=true (alarm state communicates via
 * the alarm indicator, not the value flash).
 */
export function useValueUpdateFlash(
  value: unknown,
  isInAlarm: boolean,
): boolean {
  const [flashing, setFlashing] = useState(false);
  const prevRef = useRef<unknown>(value);
  const lastFlashRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isInAlarm) {
      setFlashing(false);
      return;
    }
    if (value !== prevRef.current) {
      prevRef.current = value;
      const now = Date.now();
      if (now - lastFlashRef.current >= UPDATE_FLASH_COOLDOWN_MS) {
        lastFlashRef.current = now;
        setFlashing(true);
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(
          () => setFlashing(false),
          UPDATE_FLASH_DURATION_MS,
        );
      }
    }
  }, [value, isInAlarm]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  return flashing;
}
