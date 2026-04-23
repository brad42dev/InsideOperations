import type {
  SceneNode,
  GraphicExpression,
  ClipboardData,
} from "../types/graphics";
import type { ChartConfig } from "../components/charts/chart-config-types";
import type { PaneConfig } from "../../pages/console/types";
import type { ExpressionTile } from "../types/expression";

export type OriginContext =
  | "designer"
  | "console-pane"
  | "chart"
  | "table"
  | "alarm-list"
  | "logbook"
  | "forensics"
  | "expression-builder"
  | "external";

export type PasteMode =
  | "native"
  | "points"
  | "shapes"
  | "style"
  | "style+layout"
  | "table"
  | "text"
  | "new-graphic"
  | "temporary-graphic"
  | "most-recent-alarms";

export interface PortablePointRef {
  tagname: string;
  displayName?: string;
  unit?: string;
  dataType?: string;
  pointCategory?: string;
  euRangeLow?: number;
  euRangeHigh?: number;
}

export interface PortableAlarmRef {
  tagname: string;
  severity?: string;
  priority?: number;
  lastEventAt?: string;
}

export interface TableRowSnapshot {
  columns: string[];
  values: (string | number | null)[];
  sourceRefs?: { tagname?: string; rowId?: string };
}

export interface LogEntrySnapshot {
  id: string;
  timestamp: string;
  tagname: string;
  value: string | number | null;
  unit?: string;
  createdBy?: string;
  notes?: string;
}

export interface ExpressionTileClip {
  tiles: ExpressionTile[];
  connectorHints?: Array<{ fromTileId: string; toTileId: string }>;
}

export interface StyleSnapshot {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  opacity?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  borderRadius?: number;
  backgroundColor?: string;
}

export interface LayoutSnapshot {
  sidecarPositions?: Record<
    string,
    { x: number; y: number; rotation?: number }
  >;
  displayElementConfigs?: Record<string, unknown>;
}

export interface IOClipboardContents {
  nodes?: SceneNode[];
  expressions?: Record<string, GraphicExpression>;
  points?: PortablePointRef[];
  alarms?: PortableAlarmRef[];
  chartConfigs?: ChartConfig[];
  paneConfigs?: PaneConfig[];
  tableRows?: TableRowSnapshot[];
  logEntries?: LogEntrySnapshot[];
  expressionTiles?: ExpressionTileClip[];
  style?: StyleSnapshot;
  layout?: LayoutSnapshot;
  textRepresentation: string;
  originalBounds?: { x: number; y: number; width: number; height: number };
}

export interface IOClipboardPayload {
  source: "io-clipboard";
  version: "2.0";
  createdAt: string;
  originContext: OriginContext;
  originGraphicId?: string;
  originPaneId?: string;
  contents: IOClipboardContents;
}

// ----- Selection types -----

export type SelectionZoneId =
  | "designer"
  | "console"
  | `console/pane/${string}`
  | "alarm-list"
  | "logbook"
  | "forensics"
  | "reports"
  | "expression-builder";

export type SelectableEntityKind =
  | "scene-node"
  | "pane"
  | "chart-series-row"
  | "table-cell"
  | "table-row"
  | "alarm-row"
  | "log-entry"
  | "expression-tile"
  | "forensics-hit";

export interface SelectableEntity {
  id: string;
  zoneId: SelectionZoneId;
  kind: SelectableEntityKind;
  payload?: unknown;
}

export type SelectionIndicatorStyle = "soft-glow" | "selection-box";

export interface SelectionZoneConfig {
  zoneId: SelectionZoneId;
  indicatorStyle: SelectionIndicatorStyle;
  supportsSelectAll: boolean;
}

// ----- Paste target registry types -----

export interface PasteTarget {
  id: string;
  zoneId: SelectionZoneId;
  priority: number;
  accepts(payload: IOClipboardPayload | null): PasteMode[];
  applyPaste(
    payload: IOClipboardPayload,
    mode: PasteMode,
  ): Promise<void> | void;
  describeRejection?(payload: IOClipboardPayload | null): string;
}

// ----- Legacy compatibility helpers -----

/** Detect v1 designer clipboard shape. */
export function isLegacyDesignerClipboard(
  value: unknown,
): value is ClipboardData {
  const v = value as Record<string, unknown> | null | undefined;
  return (
    !!v &&
    v.source === "io-designer" &&
    Array.isArray(v.nodes) &&
    typeof v.expressions === "object" &&
    v.expressions !== null
  );
}

/** Narrow unknown → IOClipboardPayload v2. */
export function isIOClipboardPayload(
  value: unknown,
): value is IOClipboardPayload {
  const v = value as IOClipboardPayload | null | undefined;
  return (
    !!v &&
    v.source === "io-clipboard" &&
    v.version === "2.0" &&
    !!v.contents &&
    typeof v.contents.textRepresentation === "string"
  );
}
