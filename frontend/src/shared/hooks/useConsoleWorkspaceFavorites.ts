/**
 * useConsoleWorkspaceFavorites — persists favorited workspace IDs server-side.
 *
 * Spec: console-implementation-spec.md §2.3.1 — Favorites group pinned at the top of
 * each section. Starred state is per-user, persisted server-side in user preferences
 * via PATCH /api/user/preferences.
 *
 * Implementation:
 * - Initial state loaded from localStorage for instant render
 * - On mount: fetches GET /api/user/preferences and reconciles with local state
 * - Toggles: update localStorage immediately (optimistic), debounce-PATCH to server
 * - Offline fallback: localStorage provides persistence if API unavailable
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../../api/client'

const LS_KEY = 'io-console-workspace-favorites'
const PREF_KEY = 'console_workspace_favorites'

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadFromStorage(): Set<string> {
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

function saveToStorage(ids: Set<string>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore quota errors
  }
}

// ---------------------------------------------------------------------------
// Server-side preferences helpers
// ---------------------------------------------------------------------------

interface UserPreferencesData {
  user_id: string
  preferences: Record<string, unknown>
}

async function fetchServerFavorites(): Promise<string[] | null> {
  try {
    const result = await api.get<UserPreferencesData>('/api/user/preferences')
    if (!result.success) return null
    const raw = result.data.preferences[PREF_KEY]
    if (Array.isArray(raw)) return raw as string[]
    return null
  } catch {
    return null
  }
}

async function saveServerFavorites(ids: Set<string>): Promise<void> {
  try {
    await api.patch<UserPreferencesData>('/api/user/preferences', {
      preferences: { [PREF_KEY]: [...ids] },
    })
  } catch {
    // ignore — localStorage remains as fallback
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseConsoleWorkspaceFavoritesReturn {
  favoriteIds: Set<string>
  isFavorite: (id: string) => boolean
  toggleFavorite: (id: string) => void
  addFavorite: (id: string) => void
  removeFavorite: (id: string) => void
}

export function useConsoleWorkspaceFavorites(): UseConsoleWorkspaceFavoritesReturn {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => loadFromStorage())

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch from server on mount and reconcile
  useEffect(() => {
    let cancelled = false
    fetchServerFavorites().then((serverIds) => {
      if (cancelled || serverIds === null) return
      setFavoriteIds((_prev: Set<string>) => {
        const next = serverIds.length > 0 ? new Set<string>(serverIds) : new Set<string>()
        saveToStorage(next)
        return next
      })
    })
    return () => { cancelled = true }
  }, [])

  const scheduleServerSave = useCallback((ids: Set<string>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void saveServerFavorites(ids)
    }, 400)
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((prev: Set<string>) => {
      const next = new Set<string>(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      saveToStorage(next)
      scheduleServerSave(next)
      return next
    })
  }, [scheduleServerSave])

  const addFavorite = useCallback((id: string) => {
    setFavoriteIds((prev: Set<string>) => {
      if (prev.has(id)) return prev
      const next = new Set<string>(prev)
      next.add(id)
      saveToStorage(next)
      scheduleServerSave(next)
      return next
    })
  }, [scheduleServerSave])

  const removeFavorite = useCallback((id: string) => {
    setFavoriteIds((prev: Set<string>) => {
      if (!prev.has(id)) return prev
      const next = new Set<string>(prev)
      next.delete(id)
      saveToStorage(next)
      scheduleServerSave(next)
      return next
    })
  }, [scheduleServerSave])

  const isFavorite = useCallback((id: string) => favoriteIds.has(id), [favoriteIds])

  return { favoriteIds, isFavorite, toggleFavorite, addFavorite, removeFavorite }
}
