import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { graphicsApi } from '../../../api/graphics'
import { SceneRenderer } from '../../../shared/graphics/SceneRenderer'
import type { PointValue as ScenePointValue } from '../../../shared/graphics/SceneRenderer'
import { useWebSocket } from '../../../shared/hooks/useWebSocket'
import type { SceneNode } from '../../../shared/types/graphics'

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

export default function GraphicPane({ graphicId, onNavigate }: Props) {
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

  // Subscribe to live values for all bound points
  const { values: wsValues } = useWebSocket(pointIds)

  // Adapt wire-format PointValue → SceneRenderer PointValue
  const pointValues = useMemo(() => {
    const out = new Map<string, ScenePointValue>()
    for (const [id, pv] of wsValues) {
      out.set(id, {
        pointId: pv.pointId,
        value: pv.value,
        quality: (pv.quality === 'good' || pv.quality === 'bad' || pv.quality === 'uncertain')
          ? pv.quality
          : undefined,
      })
    }
    return out
  }, [wsValues])

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

  return (
    <SceneRenderer
      document={data.scene_data}
      pointValues={pointValues}
      onNavigate={onNavigate}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
