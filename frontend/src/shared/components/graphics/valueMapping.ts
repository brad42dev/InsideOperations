import type { BindingMapping, BindingAttribute } from '../../types/graphics'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function lerp(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMax === inMin) return outMin
  const t = Math.max(0, Math.min(1, (v - inMin) / (inMax - inMin)))
  return outMin + t * (outMax - outMin)
}

/** Parse hex color string (#rrggbb or #rgb) to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    return [r, g, b]
  }
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return [r, g, b]
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Interpolate across a color_scale array using a 0-1 progress value.
 * Evenly distributes stops across the 0-1 range.
 */
export function interpolateColorScale(colorScale: string[], progress: number): string {
  if (colorScale.length === 0) return '#808080'
  if (colorScale.length === 1) return colorScale[0]

  const t = Math.max(0, Math.min(1, progress))
  const segments = colorScale.length - 1
  const scaled = t * segments
  const idx = Math.min(Math.floor(scaled), segments - 1)
  const localT = scaled - idx

  const [r1, g1, b1] = hexToRgb(colorScale[idx])
  const [r2, g2, b2] = hexToRgb(colorScale[idx + 1])

  return rgbToHex(
    r1 + localT * (r2 - r1),
    g1 + localT * (g2 - g1),
    b1 + localT * (b2 - b1),
  )
}

// ---------------------------------------------------------------------------
// Main mapping function
// ---------------------------------------------------------------------------

export function mapValueToAttributeValue(
  value: number,
  _attribute: BindingAttribute,
  mapping: BindingMapping,
): string | null {
  switch (mapping.type) {
    case 'linear': {
      const progress = mapping.min === mapping.max
        ? 0
        : Math.max(0, Math.min(1, (value - mapping.min) / (mapping.max - mapping.min)))
      return interpolateColorScale(mapping.color_scale, progress)
    }

    case 'threshold': {
      // Find the highest threshold whose value <= the point value
      const sorted = [...mapping.thresholds].sort((a, b) => b.value - a.value)
      const match = sorted.find((stop) => value >= stop.value)
      return match ? match.color : mapping.default_color
    }

    case 'rotation': {
      const angle = lerp(
        value,
        mapping.min_value,
        mapping.max_value,
        mapping.min_angle,
        mapping.max_angle,
      )
      return `rotate(${angle} ${mapping.cx} ${mapping.cy})`
    }

    case 'translation': {
      const dx = lerp(value, mapping.min_value, mapping.max_value, mapping.dx[0], mapping.dx[1])
      const dy = lerp(value, mapping.min_value, mapping.max_value, mapping.dy[0], mapping.dy[1])
      return `translate(${dx} ${dy})`
    }

    case 'scale': {
      const s = lerp(
        value,
        mapping.min_value,
        mapping.max_value,
        mapping.min_scale,
        mapping.max_scale,
      )
      // Scale around (cx, cy): translate to origin, scale, translate back
      return `translate(${mapping.cx} ${mapping.cy}) scale(${s} ${s}) translate(${-mapping.cx} ${-mapping.cy})`
    }

    case 'visibility': {
      switch (mapping.visible_when) {
        case 'nonzero':
          return value !== 0 ? 'visible' : 'hidden'
        case 'zero':
          return value === 0 ? 'visible' : 'hidden'
        case 'above':
          return value > (mapping.threshold ?? 0) ? 'visible' : 'hidden'
        case 'below':
          return value < (mapping.threshold ?? 0) ? 'visible' : 'hidden'
        default:
          return 'visible'
      }
    }

    case 'text': {
      const dp = mapping.decimal_places ?? 2
      const formatted = value.toFixed(dp)
      if (mapping.format) {
        return mapping.format
          .replace('{value}', formatted)
          .replace(`{value:.${dp}f}`, formatted)
          .replace('{unit}', mapping.unit ?? '')
      }
      return mapping.unit ? `${formatted} ${mapping.unit}` : formatted
    }

    case 'state_class': {
      const key = String(value)
      return mapping.states[key] ?? mapping.default_class ?? null
    }

    // Composite/overlay types — handled by dedicated React components
    case 'analog_bar':
    case 'fill_gauge':
    case 'sparkline':
    case 'alarm_indicator':
      return null

    default:
      return null
  }
}
