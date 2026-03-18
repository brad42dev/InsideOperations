import { create } from 'zustand'
import type { ClipboardData, SceneNode } from '../types/graphics'

interface ClipboardState {
  data: ClipboardData | null
  copy: (nodes: SceneNode[], sourceGraphicId: string) => void
  clear: () => void
}

function computeBounds(nodes: SceneNode[]): { x: number; y: number; width: number; height: number } {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    const { x, y } = n.transform.position
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  data: null,

  copy(nodes, sourceGraphicId) {
    const data: ClipboardData = {
      version: '1.0',
      sourceGraphicId,
      nodes: JSON.parse(JSON.stringify(nodes)),
      originalBounds: computeBounds(nodes),
    }
    set({ data })

    // Also write to system clipboard as JSON (best effort)
    try {
      navigator.clipboard.writeText(JSON.stringify(data)).catch(() => {/* ignore */})
    } catch {/* ignore */}
  },

  clear() {
    set({ data: null })
  },
}))

/**
 * Read clipboard data — try system clipboard first, fall back to Zustand store.
 */
export async function readClipboard(fallback: ClipboardData | null): Promise<ClipboardData | null> {
  try {
    const text = await navigator.clipboard.readText()
    const parsed = JSON.parse(text) as ClipboardData
    if (parsed.version === '1.0' && Array.isArray(parsed.nodes)) {
      return parsed
    }
  } catch {/* ignore */}
  return fallback
}
