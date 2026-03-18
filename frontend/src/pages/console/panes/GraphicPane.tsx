import { useQuery } from '@tanstack/react-query'
import { graphicsApi } from '../../../api/graphics'
import { SceneRenderer } from '../../../shared/graphics/SceneRenderer'

interface Props {
  graphicId: string
  onNavigate?: (targetGraphicId: string) => void
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
      onNavigate={onNavigate}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
