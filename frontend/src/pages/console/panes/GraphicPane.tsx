import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { graphicsApi } from '../../../api/graphics'
import { SceneRenderer } from '../../../shared/graphics/SceneRenderer'
import type { PointValue as ScenePointValue } from '../../../shared/graphics/SceneRenderer'
import { useWebSocket, detectDeviceType } from '../../../shared/hooks/useWebSocket'
import { useHistoricalValues } from '../../../shared/hooks/useHistoricalValues'
import { usePlaybackStore } from '../../../store/playback'
import TileGraphicViewer from '../../../shared/components/TileGraphicViewer'
import type { SceneNode, GraphicDocument } from '../../../shared/types/graphics'

interface Props {
  graphicId: string
  onNavigate?: (targetGraphicId: string) => void
}

/** Walk a SceneNode tree and collect every bound pointId. */
function extractPointIds(nodes: SceneNode[]): string[] {
  const ids = new Set<string>()

  function walk(n: SceneNode) {
    // Direct binding (DisplayElement, TextBlock, AnalogBar, etc.)
    if ('binding' in n && n.binding && typeof n.binding === 'object') {
      const pid = (n.binding as { pointId?: string }).pointId
      if (pid) ids.add(pid)
    }
    // Series bindings (TrendWidget)
    if ('series' in n && Array.isArray(n.series)) {
      for (const s of n.series as { binding?: { pointId?: string } }[]) {
        if (s.binding?.pointId) ids.add(s.binding.pointId)
      }
    }
    // Slice bindings (PieChart)
    if ('slices' in n && Array.isArray(n.slices)) {
      for (const s of n.slices as { binding?: { pointId?: string } }[]) {
        if (s.binding?.pointId) ids.add(s.binding.pointId)
      }
    }
    // Recurse into child nodes
    if ('children' in n && Array.isArray(n.children)) {
      for (const child of n.children) walk(child as SceneNode)
    }
  }

  for (const n of nodes) walk(n)
  return Array.from(ids)
}

const isPhone = detectDeviceType() === 'phone'

/** Extract point bindings with fractional positions for TileGraphicViewer overlays. */
function extractTileBindings(doc: GraphicDocument) {
  const { width, height } = doc.canvas
  const out: Array<{ pointId: string; label?: string; x: number; y: number }> = []

  function walk(n: SceneNode) {
    if ('binding' in n && n.binding && typeof n.binding === 'object') {
      const pid = (n.binding as { pointId?: string }).pointId
      if (pid) {
        out.push({
          pointId: pid,
          label: n.name,
          x: n.transform.position.x / width,
          y: n.transform.position.y / height,
        })
      }
    }
    if ('children' in n && Array.isArray(n.children)) {
      for (const child of n.children) walk(child as SceneNode)
    }
  }

  for (const n of doc.children) walk(n)
  return out
}

export default function GraphicPane({ graphicId, onNavigate }: Props) {
  const [statusView, setStatusView] = useState(false)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['graphic', graphicId],
    queryFn: async () => {
      const result = await graphicsApi.get(graphicId)
      if (result.success) return result.data.data
      throw new Error('Failed to load graphic')
    },
    staleTime: 30_000,
  })

  // Derive the list of point IDs once the graphic is loaded
  const pointIds = useMemo(
    () => (data ? extractPointIds(data.scene_data.children ?? []) : []),
    [data],
  )

  const { mode: playbackMode, timestamp: playbackTs } = usePlaybackStore()
  const isHistorical = playbackMode === 'historical'

  // Subscribe to live values for all bound points (only when in live mode)
  const { values: wsValues } = useWebSocket(isHistorical ? [] : pointIds)

  // Fetch historical values at playback timestamp (only when in historical mode)
  const historicalValues = useHistoricalValues(isHistorical ? pointIds : [], isHistorical ? playbackTs : undefined)

  // Adapt wire-format PointValue → SceneRenderer PointValue
  const pointValues = useMemo(() => {
    const source = isHistorical ? historicalValues : wsValues
    const out = new Map<string, ScenePointValue>()
    for (const [id, pv] of source) {
      out.set(id, {
        pointId: pv.pointId,
        value: pv.value,
        quality: (pv.quality === 'good' || pv.quality === 'bad' || pv.quality === 'uncertain')
          ? pv.quality
          : undefined,
      })
    }
    return out
  }, [isHistorical, wsValues, historicalValues])

  // Phone: derive tile overlay bindings from scene node positions
  const tileBindings = useMemo(
    () => (isPhone && data ? extractTileBindings(data.scene_data) : []),
    [data],
  )

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090B', color: '#71717A', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090B', color: '#71717A', fontSize: 13 }}>
        Failed to load graphic
      </div>
    )
  }

  // Phone: render tile-based viewer with status view toggle
  if (isPhone) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Status/Tile toggle bar */}
        <div style={{ display: 'flex', gap: 1, padding: '4px 8px', background: 'var(--io-surface-secondary)', borderBottom: '1px solid var(--io-border)', flexShrink: 0 }}>
          <button
            onClick={() => setStatusView(false)}
            style={{ padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: !statusView ? 'var(--io-accent)' : 'transparent', color: !statusView ? '#fff' : 'var(--io-text-muted)' }}
          >
            Map
          </button>
          <button
            onClick={() => setStatusView(true)}
            style={{ padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: statusView ? 'var(--io-accent)' : 'transparent', color: statusView ? '#fff' : 'var(--io-text-muted)' }}
          >
            Status
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TileGraphicViewer
            graphicId={graphicId}
            graphicWidth={data.scene_data.canvas.width}
            graphicHeight={data.scene_data.canvas.height}
            pointValues={pointValues}
            pointBindings={tileBindings}
            statusView={statusView}
          />
        </div>
      </div>
    )
  }

  return (
    <SceneRenderer
      document={data.scene_data}
      pointValues={pointValues}
      onNavigate={onNavigate}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
