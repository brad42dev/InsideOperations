import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TileInfo {
  tile_base_url: string
  max_zoom: number
  tile_size: number
  width: number
  height: number
}

interface Props {
  graphicId: string
  tileInfo: TileInfo
  style?: React.CSSProperties
}

// Minimal interface for the Leaflet Map instance.
// We avoid any static `import … from 'leaflet'` so tsc does not require
// @types/leaflet at check-time.  The package + types are declared in
// package.json and will be resolved after `pnpm install`.
interface LeafletMapHandle {
  fitBounds(bounds: [[number, number], [number, number]]): void
  remove(): void
}

// ---------------------------------------------------------------------------
// TileGraphicViewer
//
// Renders a tiled SVG graphic using Leaflet's CRS.Simple (pixel-space) map.
// Tiles are served from nginx at /tiles/graphics/{id}/z{z}/r{y}_c{x}.png.
// Activated by GraphicViewer when element_count >= 3000 and a tile pyramid
// is available for the graphic.
//
// Leaflet is dynamically imported (code-split) at runtime; all typing goes
// through the `unknown` cast to avoid a compile-time dependency on
// @types/leaflet.
// ---------------------------------------------------------------------------

export function TileGraphicViewer({ graphicId, tileInfo, style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMapHandle | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Dynamic import — Leaflet is bundled as a separate async chunk.
    // Cast to unknown then to a loose shape to avoid compile-time module dep.
    import(/* webpackChunkName: "leaflet" */ 'leaflet' as string).then((rawL) => {
      if (!containerRef.current || mapRef.current) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = rawL as any

      const { width, height, tile_size, max_zoom, tile_base_url } = tileInfo

      // CRS.Simple maps pixel coordinates directly without geo-projection
      const map: LeafletMapHandle = L.map(containerRef.current, {
        crs: L.CRS.Simple,
        minZoom: 0,
        maxZoom: max_zoom,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        attributionControl: false,
        zoomControl: true,
      })

      mapRef.current = map

      // In Leaflet CRS.Simple, [lat, lng] maps to [y, x] in pixel space.
      // Bounds span from [0, 0] (top-left) to [height, width].
      const bounds: [[number, number], [number, number]] = [
        [0, 0],
        [height, width],
      ]

      L.tileLayer(`${tile_base_url}z{z}/r{y}_c{x}.png`, {
        tileSize: tile_size,
        minZoom: 0,
        maxZoom: max_zoom,
        bounds,
        noWrap: true,
        attribution: '',
        keepBuffer: 2,
      }).addTo(map)

      map.fitBounds(bounds)
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  // Only re-run when the graphic identity or tile spec changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphicId, tileInfo.tile_base_url, tileInfo.max_zoom, tileInfo.tile_size])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#1a1a1a',
        ...style,
      }}
    />
  )
}
