import type {
  GraphicDocument,
  SceneNode,
  DisplayElement,
  WidgetNode,
  WidgetConfig,
  TrendWidgetConfig,
  TableWidgetConfig,
  BarChartWidgetConfig,
  PieChartWidgetConfig,
  AnalogBarConfig,
  AlarmIndicatorConfig,
} from '../types/graphics'

/**
 * Walk the entire scene graph and collect all point IDs that need
 * WebSocket subscriptions. O(N) in nodes.
 */
export function extractPointIds(root: GraphicDocument): Set<string> {
  const pointIds = new Set<string>()

  function walk(node: SceneNode): void {
    // DisplayElement direct bindings
    if (node.type === 'display_element') {
      const de = node as DisplayElement
      if (de.binding?.pointId) pointIds.add(de.binding.pointId)

      // Analog bar setpoint
      if (de.config.displayType === 'analog_bar') {
        const cfg = de.config as AnalogBarConfig
        if (cfg.setpointBinding?.pointId) pointIds.add(cfg.setpointBinding.pointId)
      }

      // Alarm indicator multi-bindings
      if (de.config.displayType === 'alarm_indicator') {
        const cfg = de.config as AlarmIndicatorConfig
        if (cfg.additionalBindings) {
          for (const b of cfg.additionalBindings) {
            if (b.pointId) pointIds.add(b.pointId)
          }
        }
      }
    }

    // SymbolInstance state binding
    if (node.type === 'symbol_instance' && node.stateBinding?.pointId) {
      pointIds.add(node.stateBinding.pointId)
    }

    // Widget point references
    if (node.type === 'widget') {
      extractWidgetPointIds((node as WidgetNode).config, pointIds)
    }

    // Recurse into children
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child as SceneNode)
      }
    }
  }

  walk(root as unknown as SceneNode)

  // Resolve expression dependencies
  for (const expr of Object.values(root.expressions)) {
    extractExpressionPointIds(expr.ast, pointIds)
  }

  return pointIds
}

function extractWidgetPointIds(config: WidgetConfig, pointIds: Set<string>): void {
  switch (config.widgetType) {
    case 'trend':
      for (const s of (config as TrendWidgetConfig).series)
        if (s.binding.pointId) pointIds.add(s.binding.pointId)
      break
    case 'table':
      for (const c of (config as TableWidgetConfig).columns)
        if (c.binding.pointId) pointIds.add(c.binding.pointId)
      break
    case 'gauge':
    case 'kpi_card':
      if ((config as { binding?: { pointId?: string } }).binding?.pointId)
        pointIds.add((config as { binding: { pointId: string } }).binding.pointId)
      break
    case 'bar_chart':
      for (const s of (config as BarChartWidgetConfig).series)
        if (s.binding.pointId) pointIds.add(s.binding.pointId)
      break
    case 'pie_chart':
      for (const s of (config as PieChartWidgetConfig).slices)
        if (s.binding.pointId) pointIds.add(s.binding.pointId)
      break
    // alarm_list and muster_point have no direct point bindings
  }
}

function extractExpressionPointIds(ast: object, pointIds: Set<string>): void {
  if (!ast || typeof ast !== 'object') return
  const node = ast as Record<string, unknown>
  if (node.type === 'point_ref' && typeof node.pointId === 'string') {
    pointIds.add(node.pointId)
  }
  for (const key of Object.keys(node)) {
    if (typeof node[key] === 'object' && node[key] !== null) {
      extractExpressionPointIds(node[key] as object, pointIds)
    }
  }
}

/**
 * Get bounding box for a node (approximate — used for viewport-based subscription).
 * Returns null for nodes without a natural bounding box.
 */
export function getNodeBounds(node: SceneNode): { x: number; y: number; width: number; height: number } | null {
  const { x, y } = node.transform.position
  switch (node.type) {
    case 'primitive': {
      const { geometry } = node
      if (geometry.type === 'rect') return { x, y, width: geometry.width, height: geometry.height }
      if (geometry.type === 'circle') return { x: x - geometry.r, y: y - geometry.r, width: geometry.r * 2, height: geometry.r * 2 }
      if (geometry.type === 'ellipse') return { x: x - geometry.rx, y: y - geometry.ry, width: geometry.rx * 2, height: geometry.ry * 2 }
      return { x, y, width: 100, height: 100 }
    }
    case 'image':
      return { x, y, width: node.displayWidth, height: node.displayHeight }
    case 'widget':
      return { x, y, width: node.width, height: node.height }
    case 'embedded_svg':
      return { x, y, width: node.width, height: node.height }
    default:
      return null
  }
}

/**
 * For the Process module: extract only point IDs for nodes visible in the viewport.
 */
export function extractViewportPointIds(
  root: GraphicDocument,
  viewportBounds: { x: number; y: number; width: number; height: number },
  marginPx = 200
): Set<string> {
  const pointIds = new Set<string>()
  const vx = viewportBounds.x - marginPx
  const vy = viewportBounds.y - marginPx
  const vw = viewportBounds.width + marginPx * 2
  const vh = viewportBounds.height + marginPx * 2

  function boundsIntersect(b: { x: number; y: number; width: number; height: number }): boolean {
    return !(b.x + b.width < vx || b.x > vx + vw || b.y + b.height < vy || b.y > vy + vh)
  }

  function walk(node: SceneNode): void {
    const bounds = getNodeBounds(node)
    if (bounds && !boundsIntersect(bounds)) return

    if (node.type === 'display_element') {
      const de = node as DisplayElement
      if (de.binding?.pointId) pointIds.add(de.binding.pointId)
    }
    if (node.type === 'symbol_instance' && node.stateBinding?.pointId) {
      pointIds.add(node.stateBinding.pointId)
    }

    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) walk(child as SceneNode)
    }
  }

  walk(root as unknown as SceneNode)
  return pointIds
}
