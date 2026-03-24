/**
 * useConsoleWorkspaceFavorites — persists favorited workspace IDs in localStorage.
 *
 * Spec: console-implementation-spec.md §2.3.1 — Favorites group pinned at the top of
 * each section. Starred state is per-user, persisted server-side in user preferences.
 * Until a user-preferences API is available, localStorage is used as the persistence layer.
 */

import { useState, useCallback } from 'react'

const LS_KEY = 'io-console-workspace-favorites'

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set<string>(parsed as string[])
    return new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(ids: Set<string>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore quota errors
  }
}

export interface UseConsoleWorkspaceFavoritesReturn {
  favoriteIds: Set<string>
  isFavorite: (id: string) => boolean
  toggleFavorite: (id: string) => void
  addFavorite: (id: string) => void
  removeFavorite: (id: string) => void
}

export function useConsoleWorkspaceFavorites(): UseConsoleWorkspaceFavoritesReturn {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => loadFavorites())

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      saveFavorites(next)
      return next
    })
  }, [])

  const addFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      saveFavorites(next)
      return next
    })
  }, [])

  const removeFavorite = useCallback((id: string) => {
    setFavoriteIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      saveFavorites(next)
      return next
    })
  }, [])

  const isFavorite = useCallback((id: string) => favoriteIds.has(id), [favoriteIds])

  return { favoriteIds, isFavorite, toggleFavorite, addFavorite, removeFavorite }
}
