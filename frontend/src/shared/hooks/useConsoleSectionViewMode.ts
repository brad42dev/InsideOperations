/**
 * useConsoleSectionViewMode — persists per-section view mode selection in localStorage.
 *
 * Spec: console-implementation-spec.md §2.3.1 — Three small icons at the top-right of each
 * section header: List, Thumbnails + Name, Grid/Palette. Each section remembers its last
 * chosen view mode (persisted in user preferences).
 *
 * Until a user-preferences API is available, localStorage is used as the persistence layer,
 * following the same pattern as useConsoleWorkspaceFavorites.
 */

import { useState, useCallback } from "react";

export type SectionViewMode = "list" | "thumbnails" | "grid";

const LS_KEY = "io-console-section-view-modes";

type ViewModeMap = Record<string, SectionViewMode>;

function loadViewModes(): ViewModeMap {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ViewModeMap;
    }
    return {};
  } catch {
    return {};
  }
}

function saveViewModes(modes: ViewModeMap): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(modes));
  } catch {
    // ignore quota errors
  }
}

export interface UseConsoleSectionViewModeReturn {
  viewMode: SectionViewMode;
  setViewMode: (mode: SectionViewMode) => void;
}

/**
 * Returns the persisted view mode for a named section, and a setter that
 * both updates React state and writes through to localStorage.
 *
 * @param sectionKey - stable key for the section (e.g. 'workspaces', 'graphics')
 * @param defaultMode - the mode to use when no persisted value exists
 */
export function useConsoleSectionViewMode(
  sectionKey: string,
  defaultMode: SectionViewMode = "list",
): UseConsoleSectionViewModeReturn {
  const [viewMode, setViewModeState] = useState<SectionViewMode>(() => {
    const stored = loadViewModes();
    return stored[sectionKey] ?? defaultMode;
  });

  const setViewMode = useCallback(
    (mode: SectionViewMode) => {
      setViewModeState(mode);
      const stored = loadViewModes();
      stored[sectionKey] = mode;
      saveViewModes(stored);
    },
    [sectionKey],
  );

  return { viewMode, setViewMode };
}
