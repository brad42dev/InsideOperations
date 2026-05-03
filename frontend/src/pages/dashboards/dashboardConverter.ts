import type { WidgetConfig as LegacyWidgetConfig } from "../../api/dashboards";
import type {
  GraphicDocument,
  LayerDefinition,
  Transform,
  WidgetNode,
} from "../../shared/types/graphics";
import type { ChartTypeId } from "../../shared/components/charts/chart-config-types";
import { makeDefaultChartConfig } from "../../shared/components/charts/chart-defaults";
import type { LegacyDashboardWidgetType } from "./legacy-widget-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pixels per grid unit. 24 columns × 80 px = 1920 px (standard 1080p width). */
const GRID_PX = 80;
const MIN_CANVAS_W = 1920;
const MIN_CANVAS_H = 1080;

// ---------------------------------------------------------------------------
// Widget type mapping
// ---------------------------------------------------------------------------

const WIDGET_TYPE_MAP: Record<string, LegacyDashboardWidgetType> = {
  trend: "trend",
  chart: "trend",
  timeseries: "trend",
  table: "table",
  gauge: "gauge",
  kpi: "kpi_card",
  kpi_card: "kpi_card",
  stat: "kpi_card",
  bar_chart: "bar_chart",
  bar: "bar_chart",
  pie_chart: "pie_chart",
  pie: "pie_chart",
  donut: "pie_chart",
  alarm_list: "alarm_list",
  alarms: "alarm_list",
  muster_point: "muster_point",
  muster: "muster_point",
};

// Maps legacy string widget types to numeric ChartTypeId placeholders.
// Phase 04 will wire this up properly when the palette is rebuilt.
const LEGACY_TYPE_TO_CHART_ID: Record<LegacyDashboardWidgetType, ChartTypeId> =
  {
    trend: 1,
    table: 15,
    gauge: 8,
    kpi_card: 7,
    bar_chart: 5,
    pie_chart: 6,
    alarm_list: 12,
    muster_point: 7, // no native equivalent — placeholder KPI card
  };

function mapChartTypeId(legacyType: string): ChartTypeId {
  const wt = WIDGET_TYPE_MAP[legacyType.toLowerCase()];
  if (!wt) {
    console.warn(
      `dashboardConverter: unknown legacy widget type "${legacyType}", falling back to kpi_card`,
    );
    return LEGACY_TYPE_TO_CHART_ID["kpi_card"];
  }
  if (wt === "muster_point") {
    console.warn(
      `dashboardConverter: muster_point has no native chart equivalent, using kpi_card placeholder`,
    );
  }
  return LEGACY_TYPE_TO_CHART_ID[wt];
}

// ---------------------------------------------------------------------------
// Identity transform helpers
// ---------------------------------------------------------------------------

function identityTransform(x = 0, y = 0): Transform {
  return {
    position: { x, y },
    rotation: 0,
    scale: { x: 1, y: 1 },
    mirror: "none",
  };
}

// ---------------------------------------------------------------------------
// Main conversion function
// ---------------------------------------------------------------------------

/**
 * Converts a flat legacy `WidgetConfig[]` array (from the dashboards table)
 * into a `GraphicDocument` scene graph suitable for the Designer.
 *
 * Pure function — no API calls, no side effects.
 */
export function convertDashboardToGraphicDocument(
  name: string,
  widgets: LegacyWidgetConfig[],
): GraphicDocument {
  // Derive canvas dimensions from widget bounding box (min 1920×1080)
  let maxRight = 0;
  let maxBottom = 0;
  for (const w of widgets) {
    maxRight = Math.max(maxRight, (w.x + w.w) * GRID_PX);
    maxBottom = Math.max(maxBottom, (w.y + w.h) * GRID_PX);
  }
  const canvasWidth = Math.max(maxRight, MIN_CANVAS_W);
  const canvasHeight = Math.max(maxBottom, MIN_CANVAS_H);

  const layerId = crypto.randomUUID();

  const layer: LayerDefinition = {
    id: layerId,
    name: "Default",
    visible: true,
    locked: false,
    order: 0,
  };

  const children: WidgetNode[] = widgets.map((w) => {
    const chartType = mapChartTypeId(w.type);
    return {
      id: w.id,
      type: "widget" as const,
      name: w.type,
      transform: identityTransform(w.x * GRID_PX, w.y * GRID_PX),
      visible: true,
      locked: false,
      opacity: 1,
      layerId,
      chartType,
      width: w.w * GRID_PX,
      height: w.h * GRID_PX,
      config: makeDefaultChartConfig(chartType),
      gridSpan: { cols: w.w, rows: w.h },
    };
  });

  const doc: GraphicDocument = {
    id: crypto.randomUUID(),
    type: "graphic_document",
    name,
    transform: identityTransform(),
    visible: true,
    locked: false,
    opacity: 1,
    canvas: {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: "#0d0d0d",
    },
    metadata: {
      tags: [],
      designMode: "dashboard",
      graphicScope: "process",
      gridSize: GRID_PX,
      gridVisible: true,
      snapToGrid: true,
    },
    layers: [layer],
    expressions: {},
    children,
  };

  return doc;
}
