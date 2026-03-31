/**
 * useConsoleFavorites — generic favorites hook for Console left-nav sections.
 *
 * Spec: console-implementation-spec.md §2.3.1 — Favorites group pinned at the
 * top of each section. Starred state is per-user, persisted server-side in user
 * preferences via PATCH /api/user/preferences.
 *
 * Implementation:
 * - Initial state is loaded from localStorage (fast, synchronous)
 * - On mount, the hook fetches GET /api/user/preferences and merges the
 *   server-side favorites into the local set (server wins for cross-device sync)
 * - Toggles update localStorage immediately (optimistic) and debounce-write to
 *   the server via PATCH /api/user/preferences
 * - If the API is unavailable, localStorage provides offline fallback so the
 *   user still gets persistence within the same browser
 *
 * Each section uses a distinct preference key so workspace, graphic, widget,
 * and point favorites are stored independently.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "../../api/client";

// ---------------------------------------------------------------------------
// localStorage helpers (optimistic cache + offline fallback)
// ---------------------------------------------------------------------------

function loadFromStorage(lsKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(lsKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set<string>(parsed as string[]);
    return new Set();
  } catch {
    return new Set();
  }
}

function saveToStorage(lsKey: string, ids: Set<string>): void {
  try {
    localStorage.setItem(lsKey, JSON.stringify([...ids]));
  } catch {
    // ignore quota errors
  }
}

// ---------------------------------------------------------------------------
// Server-side preferences helpers
// ---------------------------------------------------------------------------

interface UserPreferencesData {
  user_id: string;
  preferences: Record<string, unknown>;
}

async function fetchServerFavorites(prefKey: string): Promise<string[] | null> {
  try {
    const result = await api.get<UserPreferencesData>("/api/user/preferences");
    if (!result.success) return null;
    const raw = result.data.preferences[prefKey];
    if (Array.isArray(raw)) return raw as string[];
    return null;
  } catch {
    return null;
  }
}

async function saveServerFavorites(
  prefKey: string,
  ids: Set<string>,
): Promise<void> {
  try {
    await api.patch<UserPreferencesData>("/api/user/preferences", {
      preferences: { [prefKey]: [...ids] },
    });
  } catch {
    // ignore — localStorage remains as fallback
  }
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface UseConsoleFavoritesReturn {
  favoriteIds: Set<string>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
}

export function useConsoleFavorites(lsKey: string): UseConsoleFavoritesReturn {
  // Seed from localStorage for instant initial render
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() =>
    loadFromStorage(lsKey),
  );

  // Preference key for the server-side JSONB column (e.g. "console_workspace_favorites")
  const prefKey = `console_${lsKey.replace("io-console-", "").replace(/-/g, "_")}`;

  // Debounce timer ref for server writes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch from server on mount and reconcile
  useEffect(() => {
    let cancelled = false;
    fetchServerFavorites(prefKey).then((serverIds) => {
      if (cancelled || serverIds === null) return;
      setFavoriteIds((prev: Set<string>) => {
        // Union of local and server — server wins for items in both
        const merged = new Set<string>([...prev, ...serverIds]);
        // Trim to server set if server is definitive (non-empty server response)
        // Use server list as truth but keep local additions not yet synced
        const next = serverIds.length > 0 ? new Set<string>(serverIds) : merged;
        saveToStorage(lsKey, next);
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [lsKey, prefKey]);

  const scheduleServerSave = useCallback(
    (ids: Set<string>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void saveServerFavorites(prefKey, ids);
      }, 400);
    },
    [prefKey],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavoriteIds((prev: Set<string>) => {
        const next = new Set<string>(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        saveToStorage(lsKey, next);
        scheduleServerSave(next);
        return next;
      });
    },
    [lsKey, scheduleServerSave],
  );

  const addFavorite = useCallback(
    (id: string) => {
      setFavoriteIds((prev: Set<string>) => {
        if (prev.has(id)) return prev;
        const next = new Set<string>(prev);
        next.add(id);
        saveToStorage(lsKey, next);
        scheduleServerSave(next);
        return next;
      });
    },
    [lsKey, scheduleServerSave],
  );

  const removeFavorite = useCallback(
    (id: string) => {
      setFavoriteIds((prev: Set<string>) => {
        if (!prev.has(id)) return prev;
        const next = new Set<string>(prev);
        next.delete(id);
        saveToStorage(lsKey, next);
        scheduleServerSave(next);
        return next;
      });
    },
    [lsKey, scheduleServerSave],
  );

  const isFavorite = useCallback(
    (id: string) => favoriteIds.has(id),
    [favoriteIds],
  );

  return {
    favoriteIds,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
  };
}

// Convenience constants for each Console section
export const CONSOLE_FAVORITES_KEYS = {
  workspaces: "io-console-workspace-favorites",
  graphics: "io-console-graphic-favorites",
  widgets: "io-console-widget-favorites",
  points: "io-console-point-favorites",
} as const;
