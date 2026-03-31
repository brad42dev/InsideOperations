/**
 * useUserPreference — persistent user preference backed by the server.
 *
 * Loads the initial value from GET /api/user/preferences on first mount.
 * On change, writes the new value to PATCH /api/user/preferences with a
 * debounce of 500 ms so rapid toggles produce only one network request.
 *
 * Falls back to the provided `defaultValue` while loading or on network error.
 * Uses localStorage as a "last-seen" cache so the UI snaps to the known state
 * immediately on mount, then the server value takes precedence once it arrives.
 *
 * Spec: process-implementation-spec.md §4.2 — minimap collapsed state persisted
 * in user preferences; §3.3 — sidebar state persisted in user preferences.
 *
 * Usage: always pass an explicit type parameter to avoid literal-type narrowing:
 *   const [visible, setVisible] = useUserPreference<boolean>('minimap_visible', true)
 *
 * @param key           - A stable key inside the preferences JSON object
 * @param defaultValue  - Value to use when no persisted value exists
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { preferencesApi } from "../../api/preferences";

type Primitive = boolean | number | string | null;

export function useUserPreference<T extends Primitive>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const LS_KEY = `io-pref-${key}`;

  // Seed state from localStorage so UI shows last-known value immediately
  const [value, setValueState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw === null) return defaultValue;
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === typeof defaultValue || parsed === null)
        return parsed as T;
      return defaultValue;
    } catch {
      return defaultValue;
    }
  });

  // Track whether the server value has been loaded
  const serverLoadedRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load server value on mount — override localStorage once we have it
  useEffect(() => {
    let cancelled = false;
    preferencesApi
      .get()
      .then((result) => {
        if (cancelled || serverLoadedRef.current) return;
        serverLoadedRef.current = true;
        if (result.success) {
          const serverValue = (result.data as Record<string, unknown>)[key];
          if (
            serverValue !== undefined &&
            serverValue !== null &&
            typeof serverValue === typeof defaultValue
          ) {
            const typed = serverValue as T;
            setValueState(typed);
            try {
              localStorage.setItem(LS_KEY, JSON.stringify(typed));
            } catch {
              /* ignore */
            }
          }
        }
      })
      .catch(() => {
        /* network error — keep localStorage/default */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = useCallback(
    (newValue: T): void => {
      setValueState(newValue);
      // Write to localStorage immediately for persistence across hard reloads
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(newValue));
      } catch {
        /* ignore */
      }
      // Debounce server write to avoid one request per keystroke / rapid toggle
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        preferencesApi.patch({ [key]: newValue }).catch(() => {
          /* best-effort */
        });
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, LS_KEY],
  );

  // Cleanup pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return [value, setValue];
}
