/**
 * useConsoleSectionFavorites — persists favorited item IDs for a given console palette section.
 *
 * Spec: console-implementation-spec.md §2.3.1 — Favorites group pinned at the top of
 * each section. Starred state is per-user, persisted server-side in user preferences.
 * Until a user-preferences API is available, localStorage is used as the persistence layer.
 *
 * This hook is generic across sections (graphics, widgets, points). Each section has its
 * own localStorage key to avoid collisions.
 */

import { useState, useCallback } from 'react'

function loadFavorites(lsKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(lsKey)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set<string>(parsed as string[])
    return new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(lsKey: string, ids: Set<string>): void {
  try {
    localStorage.setItem(lsKey, JSON.stringify([...ids]))
  } catch {
    // ignore quota errors
  }
}

export interface UseConsoleSectionFavoritesReturn {
  favoriteIds: Set<string>
  isFavorite: (id: string) => boolean
  toggleFavorite: (id: string) => void
  addFavorite: (id: string) => void
  removeFavorite: (id: string) => void
}

export function useConsoleSectionFavorites(lsKey: string): UseConsoleSectionFavoritesReturn {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => loadFavorites(lsKey))

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev: Set<string>) => {
      const next = new Set<string>(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      saveFavorites(lsKey, next)
      return next
    })
  }, [lsKey])

  const addFavorite = useCallback((id: string) => {
    setFavoriteIds((prev: Set<string>) => {
      if (prev.has(id)) return prev
      const next = new Set<string>(prev)
      next.add(id)
      saveFavorites(lsKey, next)
      return next
    })
  }, [lsKey])

  const removeFavorite = useCallback((id: string) => {
    setFavoriteIds((prev: Set<string>) => {
      if (!prev.has(id)) return prev
      const next = new Set<string>(prev)
      next.delete(id)
      saveFavorites(lsKey, next)
      return next
    })
  }, [lsKey])

  const isFavorite = useCallback((id: string) => favoriteIds.has(id), [favoriteIds])

  return { favoriteIds, isFavorite, toggleFavorite, addFavorite, removeFavorite }
}

// ---------------------------------------------------------------------------
// Convenience constants for section keys
// ---------------------------------------------------------------------------

export const CONSOLE_FAVORITES_KEYS = {
  workspaces: 'io-console-workspace-favorites',
  graphics: 'io-console-graphics-favorites',
  widgets: 'io-console-widgets-favorites',
  points: 'io-console-points-favorites',
} as const
