import type { WidgetConfig as LegacyWidgetConfig } from "../../api/dashboards";
import type {
  GraphicDocument,
  LayerDefinition,
  Transform,
  WidgetConfig,
  WidgetNode,
  WidgetType,
} from "../../shared/types/graphics";

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

const WIDGET_TYPE_MAP: Record<string, WidgetType> = {
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

function mapWidgetType(legacyType: string): WidgetType {
  return WIDGET_TYPE_MAP[legacyType.toLowerCase()] ?? "kpi_card";
}

// ---------------------------------------------------------------------------
// Minimal widget config builders
// ---------------------------------------------------------------------------

function buildWidgetConfig(
  legacyType: string,
  legacyConfig: Record<string, unknown>,
): WidgetConfig {
  const widgetType = mapWidgetType(legacyType);
  const title =
    typeof legacyConfig.title === "string" ? legacyConfig.title : "";

  switch (widgetType) {
    case "trend":
      return {
        widgetType: "trend",
        title,
        series: [],
        timeRange: { mode: "relative", relativeSeconds: 3600 },
        liveMode: true,
        refreshMs: 5000,
        yAxis: { autoScale: true, logScale: false },
        showQuality: false,
        showEvents: false,
      };
    case "table":
      return {
        widgetType: "table",
        title,
        columns: [],
        pageSize: 20,
      };
    case "gauge":
      return {
        widgetType: "gauge",
        title,
        binding: {},
        gaugeStyle: "radial",
        rangeLo: 0,
        rangeHi: 100,
        showValue: true,
        valueFormat: ".2f",
      };
    case "bar_chart":
      return {
        widgetType: "bar_chart",
        title,
        series: [],
        orientation: "vertical",
        showLegend: true,
      };
    case "pie_chart":
      return {
        widgetType: "pie_chart",
        title,
        slices: [],
        donut: false,
        showLegend: true,
      };
    case "alarm_list":
      return {
        widgetType: "alarm_list",
        title,
        maxRows: 50,
        showAcknowledged: false,
      };
    case "muster_point":
      return {
        widgetType: "muster_point",
        title,
        musterPointId:
          typeof legacyConfig.musterPointId === "string"
            ? legacyConfig.musterPointId
            : "",
        showHeadcount: true,
        showMissing: true,
      };
    default:
      return {
        widgetType: "kpi_card",
        title,
        binding: {},
        valueFormat: ".2f",
        showSparkline: false,
        showTrendArrow: false,
      };
  }
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

  const children: WidgetNode[] = widgets.map((w) => ({
    id: w.id,
    type: "widget" as const,
    name: w.type,
    transform: identityTransform(w.x * GRID_PX, w.y * GRID_PX),
    visible: true,
    locked: false,
    opacity: 1,
    layerId,
    widgetType: mapWidgetType(w.type),
    width: w.w * GRID_PX,
    height: w.h * GRID_PX,
    config: buildWidgetConfig(w.type, w.config),
    gridSpan: { cols: w.w, rows: w.h },
  }));

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
