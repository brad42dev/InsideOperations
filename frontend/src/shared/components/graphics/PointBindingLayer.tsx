import { useEffect, useMemo } from 'react'
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
  onPointClick?: (pointId: string, position: { x: number; y: number }) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getElementBBoxCenter(
  el: Element,
): { x: number; y: number } {
  if (el instanceof SVGGraphicsElement) {
    try {
      const bbox = el.getBBox()
      return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 }
    } catch {
      // getBBox may fail on hidden elements
    }
  }
  return { x: 0, y: 0 }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PointBindingLayer({
  svgRef,
  bindings,
  onPointClick,
}: PointBindingLayerProps) {
  const pointIds = useMemo(
    () => Array.from(new Set(Object.values(bindings).filter((b) => b?.point_id).map((b) => b.point_id))),
    [bindings],
  )

  const { values } = useWebSocket(pointIds)

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
          const pos = getElementBBoxCenter(el)
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

    // Need element position — derive from element ID and a data attribute or
    // fall back to a positioned foreignObject.  We store the target SVG element
    // id so the overlay reads position at render time via getBBox.
    const key = `${elementId}-${mapping.type}`

    // Resolve x/y from SVG element bounding box (best-effort; 0,0 when svg not mounted)
    let bx = 0
    let by = 0
    if (svgRef.current) {
      const el = svgRef.current.getElementById(elementId)
      if (el) {
        const pos = getElementBBoxCenter(el)
        bx = pos.x
        by = pos.y
      }
    }

    if (mapping.type === 'text') {
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

  return <>{overlays}</>
}
