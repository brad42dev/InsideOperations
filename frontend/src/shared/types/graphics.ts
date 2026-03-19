// Full file content — write exactly this

export type NodeId = string // UUID v7

export interface Point2D {
  x: number
  y: number
}

export interface Transform {
  position: Point2D
  rotation: number
  scale: Point2D
  mirror: 'none' | 'horizontal' | 'vertical' | 'both'
}

export interface PointBinding {
  pointId?: string
  expressionId?: string
  pointAttribute?: string
}

export interface PortablePointBinding {
  pointTag?: string
  sourceHint?: string
  expressionKey?: string
  pointAttribute?: string
}

export type Color = string

export type SceneNodeType =
  | 'graphic_document'
  | 'symbol_instance'
  | 'display_element'
  | 'primitive'
  | 'pipe'
  | 'text_block'
  | 'stencil'
  | 'group'
  | 'annotation'
  | 'image'
  | 'widget'
  | 'embedded_svg'

export interface NavigationLink {
  targetGraphicId?: string
  targetGraphicName?: string
  targetViewport?: { x: number; y: number; zoom: number }
  targetUrl?: string
}

export interface SceneNodeBase {
  id: NodeId
  type: SceneNodeType
  name?: string
  transform: Transform
  visible: boolean
  locked: boolean
  opacity: number
  layerId?: NodeId
  navigationLink?: NavigationLink
  /** Level-of-detail threshold: element is hidden when viewport zoom < threshold.
   *  1 = always visible, 2 = visible at zoom ≥ 0.3, 3 = visible at zoom ≥ 0.7 */
  lodLevel?: 1 | 2 | 3
}

export interface LayerDefinition {
  id: NodeId
  name: string
  visible: boolean
  locked: boolean
  order: number
}

export interface GraphicExpression {
  ast: object
  description?: string
}

export interface GraphicDocument extends SceneNodeBase {
  type: 'graphic_document'
  canvas: {
    width: number
    height: number
    backgroundColor: Color
  }
  metadata: {
    description?: string
    tags: string[]
    designMode: 'graphic' | 'dashboard' | 'report'
    graphicScope: 'console' | 'process'
    gridSize: number
    gridVisible: boolean
    snapToGrid: boolean
  }
  layers: LayerDefinition[]
  expressions: Record<string, GraphicExpression>
  children: SceneNode[]
}

// ---- SymbolInstance ----

export interface ComposablePart {
  partId: string
  attachment: string
}

export interface TextZoneOverride {
  staticText?: string
  visible?: boolean
  fontSize?: number
}

export interface SymbolInstance extends SceneNodeBase {
  type: 'symbol_instance'
  shapeRef: {
    shapeId: string
    variant: string
    configuration?: string
    version?: string
  }
  composableParts: ComposablePart[]
  textZoneOverrides: Record<string, TextZoneOverride>
  children: DisplayElement[]
  stateBinding?: PointBinding
  propertyOverrides: Record<string, unknown>
}

// ---- DisplayElement ----

export type DisplayElementType =
  | 'text_readout'
  | 'analog_bar'
  | 'fill_gauge'
  | 'sparkline'
  | 'alarm_indicator'
  | 'digital_status'

export interface TextReadoutConfig {
  displayType: 'text_readout'
  showBox: boolean
  showLabel: boolean
  labelText?: string
  showUnits: boolean
  valueFormat: string
  minWidth: number
}

export interface AnalogBarConfig {
  displayType: 'analog_bar'
  orientation: 'vertical' | 'horizontal'
  barWidth: number
  barHeight: number
  rangeLo: number
  rangeHi: number
  showZoneLabels: boolean
  showPointer: boolean
  showSetpoint: boolean
  setpointBinding?: PointBinding
  showNumericReadout: boolean
  showSignalLine: boolean
  thresholds?: {
    hh?: number
    h?: number
    l?: number
    ll?: number
  }
}

export interface FillGaugeConfig {
  displayType: 'fill_gauge'
  mode: 'vessel_overlay' | 'standalone'
  clipToInstanceId?: NodeId
  fillDirection: 'up' | 'down' | 'left' | 'right'
  rangeLo: number
  rangeHi: number
  barWidth?: number
  barHeight?: number
  showLevelLine: boolean
  showValue: boolean
  valueFormat: string
}

export interface SparklineConfig {
  displayType: 'sparkline'
  timeWindowMinutes: number
  scaleMode: 'auto' | 'fixed'
  fixedRangeLo?: number
  fixedRangeHi?: number
  dataPoints: number
  width: 110
  height: 18
}

export interface AlarmIndicatorConfig {
  displayType: 'alarm_indicator'
  mode: 'single' | 'multi'
  additionalBindings?: PointBinding[]
}

export interface DigitalStatusConfig {
  displayType: 'digital_status'
  stateLabels: Record<string, string>
  normalStates: string[]
  abnormalPriority: 1 | 2 | 3 | 4 | 5
}

export type DisplayElementConfig =
  | TextReadoutConfig
  | AnalogBarConfig
  | FillGaugeConfig
  | SparklineConfig
  | AlarmIndicatorConfig
  | DigitalStatusConfig

export interface DisplayElement extends SceneNodeBase {
  type: 'display_element'
  displayType: DisplayElementType
  binding: PointBinding
  config: DisplayElementConfig
}

// ---- Primitive ----

export type PrimitiveType = 'line' | 'polyline' | 'polygon' | 'rect' | 'circle' | 'ellipse' | 'path'

export type PrimitiveGeometry =
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'polyline'; points: Point2D[] }
  | { type: 'polygon'; points: Point2D[] }
  | { type: 'rect'; width: number; height: number; rx?: number; ry?: number }
  | { type: 'circle'; r: number }
  | { type: 'ellipse'; rx: number; ry: number }
  | { type: 'path'; d: string }

export interface PrimitiveStyle {
  fill: Color | 'none'
  fillOpacity: number
  stroke: Color | 'none'
  strokeWidth: number
  strokeDasharray?: string
  strokeLinecap?: 'butt' | 'round' | 'square'
  strokeLinejoin?: 'miter' | 'round' | 'bevel'
}

export interface Primitive extends SceneNodeBase {
  type: 'primitive'
  primitiveType: PrimitiveType
  geometry: PrimitiveGeometry
  style: PrimitiveStyle
}

// ---- Pipe ----

export type PipeServiceType =
  | 'process'
  | 'gas_vapor'
  | 'steam'
  | 'water'
  | 'fuel_gas'
  | 'chemical'
  | 'instrument_air'
  | 'drain'

export interface PipeConnection {
  instanceId: NodeId
  connectionId: string
}

export interface Pipe extends SceneNodeBase {
  type: 'pipe'
  serviceType: PipeServiceType
  pathData: string
  strokeWidth: number
  label?: string
  routingMode: 'auto' | 'manual'
  startConnection?: PipeConnection
  endConnection?: PipeConnection
  waypoints: Point2D[]
  /** Insulated pipe — renders as double line with hatching per ISA P&ID convention */
  insulated?: boolean
  /** SVG stroke-dasharray value. undefined = solid, '8 4' = dashed, '2 4' = dotted */
  dashPattern?: string
}

// ---- TextBlock ----

export interface TextBlock extends SceneNodeBase {
  type: 'text_block'
  content: string
  fontFamily: 'Inter' | 'JetBrains Mono'
  fontSize: number
  fontWeight: 300 | 400 | 500 | 600 | 700
  fontStyle: 'normal' | 'italic'
  textAnchor: 'start' | 'middle' | 'end'
  fill: Color
  background?: {
    fill: Color
    stroke: Color
    strokeWidth: number
    padding: number
    borderRadius: number
  }
  maxWidth?: number
}

// ---- Stencil ----

export interface Stencil extends SceneNodeBase {
  type: 'stencil'
  stencilRef: {
    stencilId: string
    version?: string
  }
  size?: {
    width: number
    height: number
  }
}

// ---- Group ----

export interface Group extends SceneNodeBase {
  type: 'group'
  children: SceneNode[]
}

// ---- Annotation ----

export type AnnotationType = 'callout' | 'dimension_line' | 'north_arrow' | 'legend' | 'border' | 'section_break' | 'page_break' | 'header' | 'footer'

export interface CalloutConfig {
  annotationType: 'callout'
  text: string
  targetPoint: Point2D
  leaderStyle: 'straight' | 'elbow'
  fontSize: number
  fill: Color
  backgroundColor: Color
  borderColor: Color
  borderRadius: number
  padding: number
}

export interface DimensionLineConfig {
  annotationType: 'dimension_line'
  startPoint: Point2D
  endPoint: Point2D
  offset: number
  label?: string
  fontSize: number
  color: Color
}

export interface NorthArrowConfig {
  annotationType: 'north_arrow'
  style: 'simple' | 'compass'
  size: number
  color: Color
}

export interface LegendEntry {
  symbol: 'line' | 'rect' | 'circle'
  color: Color
  label: string
}

export interface LegendConfig {
  annotationType: 'legend'
  entries: LegendEntry[]
  fontSize: number
  backgroundColor: Color
  borderColor: Color
}

export interface BorderConfig {
  annotationType: 'border'
  width: number
  height: number
  strokeColor: Color
  strokeWidth: number
  strokeDasharray?: string
  cornerStyle: 'square' | 'rounded'
  cornerRadius?: number
  titleBlock?: {
    title: string
    drawingNumber: string
    revision: string
    drawnBy: string
    date: string
  }
}

export interface SectionBreakConfig {
  annotationType: 'section_break'
  style: 'line' | 'space' | 'dotted'
  thickness: number
  color: Color
}

export interface PageBreakConfig { annotationType: 'page_break' }

export interface HeaderConfig {
  annotationType: 'header'
  content: string
  height: number
  fontSize: number
  textAlign: 'left' | 'center' | 'right'
}

export interface FooterConfig {
  annotationType: 'footer'
  content: string
  height: number
  fontSize: number
  textAlign: 'left' | 'center' | 'right'
}

export type AnnotationConfig =
  | CalloutConfig
  | DimensionLineConfig
  | NorthArrowConfig
  | LegendConfig
  | BorderConfig
  | SectionBreakConfig
  | PageBreakConfig
  | HeaderConfig
  | FooterConfig

export interface Annotation extends SceneNodeBase {
  type: 'annotation'
  annotationType: AnnotationType
  config: AnnotationConfig
}

// ---- ImageNode ----

export interface ImageNode extends SceneNodeBase {
  type: 'image'
  assetRef: {
    hash: string
    mimeType: string
    originalFilename?: string
    originalWidth: number
    originalHeight: number
    fileSize: number
  }
  displayWidth: number
  displayHeight: number
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
  preserveAspectRatio: boolean
  imageRendering: 'auto' | 'pixelated' | 'crisp-edges'
}

// ---- WidgetNode ----

export type WidgetType =
  | 'trend'
  | 'table'
  | 'gauge'
  | 'kpi_card'
  | 'bar_chart'
  | 'pie_chart'
  | 'alarm_list'
  | 'muster_point'

export interface TrendSeries {
  binding: PointBinding
  label: string
  color: string
  lineStyle: 'solid' | 'dashed' | 'dotted'
  lineWidth: number
}

export interface TrendWidgetConfig {
  widgetType: 'trend'
  title: string
  series: TrendSeries[]
  timeRange: {
    mode: 'relative' | 'absolute'
    relativeSeconds?: number
    absoluteStart?: string
    absoluteEnd?: string
  }
  liveMode: boolean
  refreshMs: number
  yAxis: {
    label?: string
    autoScale: boolean
    min?: number
    max?: number
    logScale: boolean
  }
  showQuality: boolean
  showEvents: boolean
}

export interface TableColumn {
  binding: PointBinding
  label: string
  width?: number
  format?: string
}

export interface TableWidgetConfig {
  widgetType: 'table'
  title: string
  columns: TableColumn[]
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  pageSize: number
}

export interface GaugeWidgetConfig {
  widgetType: 'gauge'
  title: string
  binding: PointBinding
  gaugeStyle: 'radial' | 'linear'
  rangeLo: number
  rangeHi: number
  thresholds?: { value: number; color: string }[]
  showValue: boolean
  valueFormat: string
}

export interface KpiCardWidgetConfig {
  widgetType: 'kpi_card'
  title: string
  binding: PointBinding
  valueFormat: string
  showSparkline: boolean
  showTrendArrow: boolean
  sparklineMinutes?: number
}

export interface BarChartWidgetConfig {
  widgetType: 'bar_chart'
  title: string
  series: { binding: PointBinding; label: string; color: string }[]
  orientation: 'vertical' | 'horizontal'
  showLegend: boolean
}

export interface PieChartWidgetConfig {
  widgetType: 'pie_chart'
  title: string
  slices: { binding: PointBinding; label: string; color: string }[]
  donut: boolean
  showLegend: boolean
}

export interface AlarmListWidgetConfig {
  widgetType: 'alarm_list'
  title: string
  filterPriority?: number[]
  filterArea?: string[]
  maxRows: number
  showAcknowledged: boolean
}

export interface MusterPointWidgetConfig {
  widgetType: 'muster_point'
  title: string
  musterPointId: string
  showHeadcount: boolean
  showMissing: boolean
}

export type WidgetConfig =
  | TrendWidgetConfig
  | TableWidgetConfig
  | GaugeWidgetConfig
  | KpiCardWidgetConfig
  | BarChartWidgetConfig
  | PieChartWidgetConfig
  | AlarmListWidgetConfig
  | MusterPointWidgetConfig

export interface WidgetNode extends SceneNodeBase {
  type: 'widget'
  widgetType: WidgetType
  width: number
  height: number
  config: WidgetConfig
  gridSpan?: { cols: number; rows: number }
  phonePriority?: number
}

// ---- EmbeddedSvgNode ----

export interface EmbeddedSvgNode extends SceneNodeBase {
  type: 'embedded_svg'
  svgContent: string
  source?: {
    importedFrom: string
    importDate: string
    originalFilename?: string
  }
  width: number
  height: number
  viewBox: string
}

// ---- Union Types ----

export type SceneNode =
  | GraphicDocument
  | SymbolInstance
  | DisplayElement
  | Primitive
  | Pipe
  | TextBlock
  | Stencil
  | Group
  | Annotation
  | ImageNode
  | WidgetNode
  | EmbeddedSvgNode

export type ContainerNode = GraphicDocument | Group | SymbolInstance

// ---- Viewport State ----

export interface ViewportState {
  panX: number
  panY: number
  zoom: number
  canvasWidth: number
  canvasHeight: number
  screenWidth: number
  screenHeight: number
}

export function canvasToScreen(point: Point2D, viewport: ViewportState): Point2D {
  return {
    x: (point.x - viewport.panX) * viewport.zoom,
    y: (point.y - viewport.panY) * viewport.zoom,
  }
}

export function screenToCanvas(point: Point2D, viewport: ViewportState): Point2D {
  return {
    x: point.x / viewport.zoom + viewport.panX,
    y: point.y / viewport.zoom + viewport.panY,
  }
}

// ---- Pipe Service Colors ----

export const PIPE_SERVICE_COLORS: Record<PipeServiceType, string> = {
  process:        '#6B8CAE',
  gas_vapor:      '#B8926A',
  steam:          '#9CA3AF',
  water:          '#5B9EA6',
  fuel_gas:       '#C4A95A',
  chemical:       '#9B7CB8',
  instrument_air: '#7A9B7A',
  drain:          '#8B7355',
}

// ---- Alarm Colors ----

export const ALARM_COLORS: Record<number, string> = {
  1: '#EF4444', // Critical
  2: '#F97316', // High
  3: '#EAB308', // Medium
  4: '#06B6D4', // Advisory
  5: '#7C3AED', // Custom
}

// ---- Clipboard ----

export interface ClipboardData {
  source: 'io-designer'
  version: '1.0'
  sourceGraphicId: string
  nodes: SceneNode[]
  expressions: Record<string, GraphicExpression>
  originalBounds: { x: number; y: number; width: number; height: number }
}

// ---- Summary for list views ----

export interface GraphicSummary {
  id: string
  name: string
  graphicScope: 'console' | 'process'
  designMode: 'graphic' | 'dashboard' | 'report'
  description?: string
  tags: string[]
  thumbnailUrl?: string
  createdAt: string
  updatedAt: string
  version: number
}
