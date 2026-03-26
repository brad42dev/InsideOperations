/**
 * useConsoleSectionHeight — persists per-section heights for the Console Assets
 * palette in localStorage.
 *
 * Spec: console-implementation-spec.md §2.3.1 — Section heights are resizable —
 * drag the bottom edge of any section to change its height; heights are persisted.
 *
 * Until a user-preferences API is available, localStorage is used as the
 * persistence layer, matching the pattern of other console pref hooks.
 */

import { useState, useCallback, useRef } from 'react'

const LS_KEY = 'io-console-section-heights'
const MIN_HEIGHT = 80
const MAX_HEIGHT = 600

type HeightMap = Record<string, number>

function loadHeights(): HeightMap {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as HeightMap
    }
    return {}
  } catch {
    return {}
  }
}

function saveHeights(heights: HeightMap): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(heights))
  } catch {
    // ignore quota errors
  }
}

export interface UseConsoleSectionHeightReturn {
  sectionHeight: number | undefined
  /** Attach to the mousedown event of the section's bottom resize handle. */
  onResizeHandleMouseDown: (e: React.MouseEvent) => void
  /** Whether a resize drag is currently in progress for this section. */
  isResizing: boolean
}

/**
 * Returns the persisted height for a named section, a mousedown handler to
 * initiate a drag resize from the bottom edge, and an isResizing flag.
 *
 * @param sectionKey - stable key for the section (e.g. 'workspaces', 'graphics')
 * @param defaultHeight - initial height when no persisted value exists; if
 *   undefined the section uses natural flow height until first resize
 */
export function useConsoleSectionHeight(
  sectionKey: string,
  defaultHeight?: number,
): UseConsoleSectionHeightReturn {
  const [sectionHeight, setSectionHeight] = useState<number | undefined>(() => {
    const stored = loadHeights()
    const val = stored[sectionKey]
    return val !== undefined ? val : defaultHeight
  })
  const [isResizing, setIsResizing] = useState(false)

  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  const onResizeHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      startYRef.current = e.clientY
      startHeightRef.current = sectionHeight ?? defaultHeight ?? MIN_HEIGHT
      setIsResizing(true)

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientY - startYRef.current
        const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeightRef.current + delta))
        setSectionHeight(newHeight)
      }

      const onMouseUp = (upEvent: MouseEvent) => {
        const delta = upEvent.clientY - startYRef.current
        const finalHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeightRef.current + delta))
        setSectionHeight(finalHeight)
        const stored = loadHeights()
        stored[sectionKey] = finalHeight
        saveHeights(stored)
        setIsResizing(false)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [sectionKey, sectionHeight, defaultHeight],
  )

  return { sectionHeight, onResizeHandleMouseDown, isResizing }
}
