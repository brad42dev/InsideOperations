import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { GraphicBindings } from '../../types/graphics'
import { useWebSocket } from '../../hooks/useWebSocket'
import { mapValueToAttributeValue } from './valueMapping'
import TextReadout from './displayElements/TextReadout'
import AnalogBar from './displayElements/AnalogBar'
import FillGauge from './displayElements/FillGauge'
import AlarmIndicator from './displayElements/AlarmIndicator'
import TimeSeriesChart from '../charts/TimeSeriesChart'
import type { TextMapping, AnalogBarMapping, FillGaugeMapping, SparklineMapping, AlarmIndicatorMapping } from '../../types/graphics'

interface PointBindingLayerProps {
  svgRef: React.RefObject<SVGSVGElement>
  bindings: GraphicBindings
  viewBox?: string
  width?: number
  height?: number
  onPointClick?: (pointId: string, position: { x: number; y: number }) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getElementSVGCenter(
  el: Element,
  svgRoot: SVGSVGElement,
): { x: number; y: number } {
  try {
    const rect = el.getBoundingClientRect()
    const pt = svgRoot.createSVGPoint()
    pt.x = rect.left + rect.width / 2
    pt.y = rect.top + rect.height / 2
    const ctm = svgRoot.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const svgPt = pt.matrixTransform(ctm.inverse())
    return { x: svgPt.x, y: svgPt.y }
  } catch {
    return { x: 0, y: 0 }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PointBindingLayer({
  svgRef,
  bindings,
  viewBox,
  width,
  height,
  onPointClick,
}: PointBindingLayerProps) {
  const pointIds = useMemo(
    () => Array.from(new Set(Object.values(bindings).filter((b) => b?.point_id).map((b) => b.point_id))),
    [bindings],
  )

  const { values } = useWebSocket(pointIds)

  // Resolve SVG element positions after the main SVG has been painted.
  // getBBox() returns zeros during the render phase, so we read positions in
  // useLayoutEffect (post-DOM-mutation, pre-paint) and store them in state.
  // A sentinel counter lets us re-measure when the SVG content changes.
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})

  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const next: Record<string, { x: number; y: number }> = {}
    for (const elementId of Object.keys(bindings)) {
      const el = svg.getElementById(elementId)
      if (el) next[elementId] = getElementSVGCenter(el, svg)
    }
    setPositions(next)
  }, [svgRef, bindings])

  // Direct DOM attribute updates for non-overlay bindings
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    for (const [elementId, binding] of Object.entries(bindings)) {
      const { attribute, mapping, point_id } = binding
      if (!mapping) continue
      const pointValue = values.get(point_id)
      const numValue = pointValue?.value ?? 0

      // Overlay types are rendered via JSX below — skip DOM manipulation
      if (
        mapping.type === 'text' ||
        mapping.type === 'analog_bar' ||
        mapping.type === 'fill_gauge' ||
        mapping.type === 'sparkline' ||
        mapping.type === 'alarm_indicator'
      ) {
        continue
      }

      const el = svg.getElementById(elementId)
      if (!el) continue

      const attrValue = mapValueToAttributeValue(numValue, attribute, mapping)
      if (attrValue === null) continue

      if (attribute === 'transform') {
        el.setAttribute('transform', attrValue)
      } else if (attribute === 'class') {
        el.setAttribute('class', attrValue)
      } else {
        el.setAttribute(attribute, attrValue)
      }

      // Attach click handler
      if (onPointClick) {
        const existingHandler = (el as SVGElement & { _ioClickHandler?: EventListener })
          ._ioClickHandler
        if (existingHandler) {
          el.removeEventListener('click', existingHandler)
        }
        const handler: EventListener = () => {
          const pos = getElementSVGCenter(el, svg)
          onPointClick(point_id, pos)
        }
        ;(el as SVGElement & { _ioClickHandler?: EventListener })._ioClickHandler = handler
        el.addEventListener('click', handler)
        ;(el as SVGElement).style.cursor = 'pointer'
      }
    }
  }, [svgRef, bindings, values, onPointClick])

  // Collect overlay bindings to render as SVG children
  const overlays: React.ReactNode[] = []

  for (const [elementId, binding] of Object.entries(bindings)) {
    const { mapping, point_id } = binding
    if (!mapping) continue
    const pointValue = values.get(point_id)
    const numValue = pointValue?.value ?? null
    const quality = pointValue?.quality
    const stale = pointValue?.stale

    const key = `${elementId}-${mapping.type}`

    // Positions are resolved via useLayoutEffect after the SVG is painted.
    // Skip this element until its position is known to avoid piling at (0,0).
    const pos = positions[elementId]
    if (!pos) continue
    const { x: bx, y: by } = pos

    // Don't render text overlays when no data has arrived yet — avoids covering
    // the graphic with N/C placeholders before the WebSocket delivers values.
    // Other overlay types (bars, gauges, alarms) also suppress when no data.
    const hasData = pointValue !== undefined

    if (mapping.type === 'text') {
      if (!hasData) continue
      const m = mapping as TextMapping
      overlays.push(
        <TextReadout
          key={key}
          x={bx}
          y={by}
          value={numValue}
          unit={m.unit}
          decimalPlaces={m.decimal_places}
          quality={quality}
          stale={stale}
          background
          onPointClick={
            onPointClick ? () => onPointClick(point_id, { x: bx, y: by }) : undefined
          }
        />,
      )
    } else if (mapping.type === 'analog_bar') {
      if (!hasData) continue
      const m = mapping as AnalogBarMapping
      overlays.push(
        <AnalogBar
          key={key}
          x={bx}
          y={by}
          value={numValue}
          min={m.min}
          max={m.max}
          lowLow={m.low_low}
          low={m.low}
          high={m.high}
          highHigh={m.high_high}
          unit={m.unit}
          label={m.label}
          quality={quality}
          stale={stale}
        />,
      )
    } else if (mapping.type === 'fill_gauge') {
      if (!hasData) continue
      const m = mapping as FillGaugeMapping
      overlays.push(
        <FillGauge
          key={key}
          x={bx}
          y={by}
          width={60}
          height={80}
          value={numValue}
          min={m.min}
          max={m.max}
          fillDirection={m.fill_direction}
          unit={m.unit}
          quality={quality}
          stale={stale}
        />,
      )
    } else if (mapping.type === 'sparkline') {
      const m = mapping as SparklineMapping
      overlays.push(
        <foreignObject key={key} x={bx} y={by} width={120} height={40}>
          <TimeSeriesChart
            timestamps={[]}
            series={[{ label: elementId, data: [], color: m.color ?? '#4A9EFF' }]}
            height={40}
            width={120}
          />
        </foreignObject>,
      )
    } else if (mapping.type === 'alarm_indicator') {
      const m = mapping as AlarmIndicatorMapping
      overlays.push(
        <AlarmIndicator
          key={key}
          x={bx}
          y={by}
          priority={m.priority}
          active={numValue !== null && numValue !== 0}
          quality={quality}
        />,
      )
    }
  }

  if (overlays.length === 0) return null

  // Overlay elements are SVG primitives (g, rect, text…) and must live inside an
  // SVG element.  PointBindingLayer is intentionally a sibling of the main SVG
  // (so we can use dangerouslySetInnerHTML on the main SVG without conflicts), so
  // we create a second SVG that covers the same coordinate space as an overlay.
  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {overlays}
    </svg>
  )
}
