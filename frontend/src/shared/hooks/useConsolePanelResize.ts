/**
 * useConsolePanelResize — persists Console Assets palette panel width in localStorage.
 *
 * Spec: console-implementation-spec.md §2.3.1 — Panel width: 280px default,
 * resizable 200–400px, width persisted in user preferences.
 *
 * Until a user-preferences API is available, localStorage is used as the
 * persistence layer, matching the pattern of other console pref hooks.
 */

import { useState, useCallback, useRef } from 'react'

const LS_KEY = 'io-console-palette-panel-width'
const MIN_WIDTH = 200
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 280

function loadWidth(): number {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_WIDTH
    const n = Number(raw)
    if (isNaN(n)) return DEFAULT_WIDTH
    return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n))
  } catch {
    return DEFAULT_WIDTH
  }
}

function saveWidth(width: number): void {
  try {
    localStorage.setItem(LS_KEY, String(width))
  } catch {
    // ignore quota errors
  }
}

export interface UseConsolePanelResizeReturn {
  panelWidth: number
  /** Attach to the mousedown event of the resize handle element. */
  onResizeHandleMouseDown: (e: React.MouseEvent) => void
  /** Whether a resize drag is currently in progress. */
  isResizing: boolean
}

/**
 * Returns the persisted panel width (clamped 200–400px), a mousedown handler
 * to initiate a drag resize from the right edge, and a boolean indicating
 * whether a drag is currently active.
 */
export function useConsolePanelResize(): UseConsolePanelResizeReturn {
  const [panelWidth, setPanelWidth] = useState<number>(loadWidth)
  const [isResizing, setIsResizing] = useState(false)

  // Refs for drag calculation — avoids stale closures in event listeners
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const onResizeHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    startXRef.current = e.clientX
    startWidthRef.current = panelWidth
    setIsResizing(true)

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startXRef.current
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidthRef.current + delta))
      setPanelWidth(newWidth)
    }

    const onMouseUp = (upEvent: MouseEvent) => {
      const delta = upEvent.clientX - startXRef.current
      const finalWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidthRef.current + delta))
      setPanelWidth(finalWidth)
      saveWidth(finalWidth)
      setIsResizing(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [panelWidth])

  return { panelWidth, onResizeHandleMouseDown, isResizing }
}
