/**
 * TileGraphicViewer — Leaflet-based tile viewer for phone graphics (doc 20 §Phone Graphics)
 *
 * Used when `detectDeviceType() === 'phone'` in Console/Process panes. The server
 * pre-renders graphics into 256×256 tile pyramids via resvg. This component loads those
 * tiles via Leaflet (BSD-2-Clause) and overlays live point values as positioned markers.
 *
 * Tile URL pattern: /api/v1/design-objects/{graphicId}/tiles/{z}/{x}/{y}.png
 * Point overlay:    bindings from GraphicDocument provide {x, y} as % of full graphic size.
 */

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PointValue } from '../graphics/SceneRenderer'

export interface TileGraphicViewerProps {
  graphicId: string
  /** Width of the source graphic in pixels (from scene_data.canvas.width) */
  graphicWidth: number
  /** Height of the source graphic in pixels (from scene_data.canvas.height) */
  graphicHeight: number
  /** Live point value map: pointId → value */
  pointValues?: Map<string, PointValue>
  /** Bindings: maps elementId to pointId, with position {x, y} as fraction [0,1] of graphic size */
  pointBindings?: Array<{
    pointId: string
    label?: string
    x: number // 0–1 fraction of graphic width
    y: number // 0–1 fraction of graphic height
  }>
  /** When true, show the simplified status view (colored dots, no tile map) */
  statusView?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a graphic pixel coordinate to Leaflet CRS.Simple latLng.
 *  Leaflet CRS.Simple maps: lat = -y, lng = x */
function toLatLng(
  xFraction: number,
  yFraction: number,
  width: number,
  height: number,
): L.LatLng {
  return L.latLng(-yFraction * height, xFraction * width)
}

function alarmColor(value: PointValue | undefined): string {
  if (!value) return 'var(--io-text-muted)'
  if (value.quality === 'bad') return '#EF4444'
  return '#22C55E'
}

// ---------------------------------------------------------------------------
// StatusView — simplified schematic with colored status dots
// ---------------------------------------------------------------------------

function StatusView({
  pointBindings,
  pointValues,
}: {
  pointBindings: TileGraphicViewerProps['pointBindings']
  pointValues: Map<string, PointValue> | undefined
}) {
  if (!pointBindings?.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--io-text-muted)', fontSize: 13 }}>
        No bindings configured
      </div>
    )
  }

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: 12,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignContent: 'flex-start',
      }}
    >
      {pointBindings.map((b) => {
        const pv = pointValues?.get(b.pointId)
        const color = alarmColor(pv)
        return (
          <div
            key={b.pointId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              background: 'var(--io-surface)',
              border: '1px solid var(--io-border)',
              borderRadius: 8,
              minWidth: 120,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--io-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {b.label ?? b.pointId}
            </span>
            {pv !== undefined && (
              <span style={{ fontSize: 11, color: 'var(--io-text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                {typeof pv.value === 'number' ? pv.value.toFixed(2) : String(pv.value)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TileGraphicViewer
// ---------------------------------------------------------------------------

export default function TileGraphicViewer({
  graphicId,
  graphicWidth,
  graphicHeight,
  pointValues,
  pointBindings,
  statusView = false,
}: TileGraphicViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const [leafletError, setLeafletError] = useState(false)

  // Initialize Leaflet map
  useEffect(() => {
    if (statusView || !containerRef.current || mapRef.current) return

    const bounds = L.latLngBounds(
      L.latLng(-graphicHeight, 0),
      L.latLng(0, graphicWidth),
    )

    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -5,
      maxZoom: 2,
      zoomControl: true,
      attributionControl: false,
      maxBounds: bounds.pad(0.2),
    })

    // Tile layer pointing to API tile pyramid
    const tileUrl = `/api/v1/design-objects/${graphicId}/tiles/{z}/{x}/{y}.png`
    const tileLayer = L.tileLayer(tileUrl, {
      tileSize: 256,
      noWrap: true,
      bounds,
      errorTileUrl: '', // silently ignore missing tiles
    })

    tileLayer.on('tileerror', () => setLeafletError(true))
    tileLayer.addTo(map)

    map.fitBounds(bounds)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  // Intentionally only on mount / graphicId change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphicId, statusView])

  // Update / create point value markers
  useEffect(() => {
    const map = mapRef.current
    if (!map || statusView || !pointBindings?.length) return

    for (const binding of pointBindings) {
      const pv = pointValues?.get(binding.pointId)
      const pos = toLatLng(binding.x, binding.y, graphicWidth, graphicHeight)
      const displayValue = pv !== undefined
        ? (typeof pv.value === 'number' ? pv.value.toFixed(2) : String(pv.value))
        : '—'
      const color = alarmColor(pv)

      const html = `
        <div style="background:var(--io-surface,#1e1e2e);border:1px solid ${color};border-radius:4px;padding:2px 5px;font-size:11px;font-weight:600;color:${color};white-space:nowrap;pointer-events:none">
          ${displayValue}
        </div>`

      const icon = L.divIcon({ html, className: '', iconAnchor: [0, 0] })

      const existing = markersRef.current.get(binding.pointId)
      if (existing) {
        existing.setIcon(icon)
      } else {
        const marker = L.marker(pos, { icon, interactive: false }).addTo(map)
        markersRef.current.set(binding.pointId, marker)
      }
    }
  }, [pointValues, pointBindings, graphicWidth, graphicHeight, statusView])

  if (statusView) {
    return (
      <div style={{ height: '100%', background: 'var(--io-bg)' }}>
        <StatusView pointBindings={pointBindings} pointValues={pointValues} />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', position: 'relative', background: 'var(--io-bg)' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {leafletError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            fontSize: 13,
            pointerEvents: 'none',
          }}
        >
          Tile rendering unavailable
        </div>
      )}
    </div>
  )
}
