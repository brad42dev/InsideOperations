/**
 * useConsoleFavorites — generic favorites hook for Console left-nav sections.
 *
 * Spec: console-implementation-spec.md §2.3.1 — Favorites group pinned at the
 * top of each section. Starred state is per-user, persisted server-side in user
 * preferences. Until a user-preferences API is available, localStorage is used.
 *
 * Each section uses a distinct localStorage key so that workspace, graphic,
 * widget, and point favorites are stored independently.
 */

import { useState, useCallback } from 'react'

function loadFavorites(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set<string>(parsed as string[])
    return new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]))
  } catch {
    // ignore quota errors
  }
}

export interface UseConsoleFavoritesReturn {
  favoriteIds: Set<string>
  isFavorite: (id: string) => boolean
  toggleFavorite: (id: string) => void
  addFavorite: (id: string) => void
  removeFavorite: (id: string) => void
}

export function useConsoleFavorites(lsKey: string): UseConsoleFavoritesReturn {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => loadFavorites(lsKey))

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev)
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
    setFavoriteIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      saveFavorites(lsKey, next)
      return next
    })
  }, [lsKey])

  const removeFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      saveFavorites(lsKey, next)
      return next
    })
  }, [lsKey])

  const isFavorite = useCallback((id: string) => favoriteIds.has(id), [favoriteIds])

  return { favoriteIds, isFavorite, toggleFavorite, addFavorite, removeFavorite }
}

// Convenience constants for each Console section
export const CONSOLE_FAVORITES_KEYS = {
  workspaces: 'io-console-workspace-favorites',
  graphics: 'io-console-graphic-favorites',
  widgets: 'io-console-widget-favorites',
  points: 'io-console-point-favorites',
} as const
