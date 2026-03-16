export type BindingAttribute = 'fill' | 'stroke' | 'opacity' | 'transform' | 'visibility' | 'text' | 'class'

export interface LinearColorMapping {
  type: 'linear'
  min: number
  max: number
  color_scale: string[]  // hex colors, evenly distributed
}

export interface ThresholdStop {
  value: number  // activates at >= this value
  color: string  // hex
}

export interface ThresholdColorMapping {
  type: 'threshold'
  thresholds: ThresholdStop[]
  default_color: string
}

export interface RotationMapping {
  type: 'rotation'
  min_value: number
  max_value: number
  min_angle: number
  max_angle: number
  cx: number
  cy: number
}

export interface TranslationMapping {
  type: 'translation'
  min_value: number
  max_value: number
  dx: [number, number]  // [min_dx, max_dx]
  dy: [number, number]  // [min_dy, max_dy]
}

export interface ScaleMapping {
  type: 'scale'
  min_value: number
  max_value: number
  min_scale: number
  max_scale: number
  cx: number
  cy: number
}

export interface VisibilityMapping {
  type: 'visibility'
  visible_when: 'nonzero' | 'zero' | 'above' | 'below'
  threshold?: number
}

export interface TextMapping {
  type: 'text'
  format?: string      // e.g. "{value:.1f} {unit}"
  unit?: string
  decimal_places?: number
}

export interface StateClassMapping {
  type: 'state_class'
  states: Record<string, string>  // value string → CSS class
  default_class?: string
}

export interface AnalogBarMapping {
  type: 'analog_bar'
  min: number
  max: number
  low_low?: number
  low?: number
  high?: number
  high_high?: number
  unit?: string
  label?: string
}

export interface FillGaugeMapping {
  type: 'fill_gauge'
  min: number
  max: number
  fill_direction?: 'bottom_up' | 'top_down' | 'left_right' | 'right_left'
  unit?: string
}

export interface SparklineMapping {
  type: 'sparkline'
  duration_minutes?: number  // default 60
  color?: string
}

export interface AlarmIndicatorMapping {
  type: 'alarm_indicator'
  priority?: 'critical' | 'high' | 'medium' | 'low'
}

export type BindingMapping =
  | LinearColorMapping
  | ThresholdColorMapping
  | RotationMapping
  | TranslationMapping
  | ScaleMapping
  | VisibilityMapping
  | TextMapping
  | StateClassMapping
  | AnalogBarMapping
  | FillGaugeMapping
  | SparklineMapping
  | AlarmIndicatorMapping

export interface ElementBinding {
  point_id: string          // UUID
  attribute: BindingAttribute
  mapping: BindingMapping
  point_state_id?: string   // optional second point for state class
  point_state_attr?: 'class'
}

export type GraphicBindings = Record<string, ElementBinding>

export interface GraphicDocument {
  id: string
  name: string
  type: 'graphic' | 'template' | 'symbol'
  svg_data: string
  bindings: GraphicBindings
  metadata: {
    width: number
    height: number
    viewBox?: string
    description?: string
  }
  created_at: string
  created_by: string
}
