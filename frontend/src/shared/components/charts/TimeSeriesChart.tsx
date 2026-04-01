import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { ResolvedSeriesScale } from "./chart-config-types";
import type { EnumLabel } from "../../../api/points";

export interface Series {
  label: string;
  data: (number | null)[];
  color?: string;
  strokeWidth?: number;
}

export interface TimeSeriesChartProps {
  timestamps: number[];
  series: Series[];
  /** Force the x-axis to this range (Unix seconds). Prevents auto-fit to data extent. */
  xRange?: { min: number; max: number };
  /** Explicit height in px. Omit to fill the parent container (requires parent to have a determined height). */
  height?: number;
  /** Explicit width in px. Omit to fill the parent container width. */
  width?: number;
  className?: string;
  /**
   * Set of series labels that are currently highlighted.
   * When non-empty: highlighted series get 1.8× stroke width + alpha=1;
   * non-highlighted series get alpha=0.15 (dimmed).
   */
  highlighted?: Set<string>;
  /**
   * Called when the user clicks a line on the chart canvas.
   * `multi` is true when Ctrl or Meta was held during the click.
   */
  onSeriesClick?: (label: string, multi: boolean) => void;
  /** Called when the user clicks empty space on the chart (no series within proximity). */
  onClearHighlight?: () => void;
  /** Whether to render grid lines. Defaults to true. */
  showGrid?: boolean;
  /**
   * Per-series scale assignments produced by resolveSeriesScales().
   * When provided, each series is tied to its own uPlot scale with the
   * specified range (undefined = auto-range for that series).
   * When omitted, all series share the default "y" scale (auto-range).
   */
  seriesScales?: ResolvedSeriesScale[];
  /**
   * Enum label map: pointId → EnumLabel[]. When provided, the Y-axis tick
   * formatter will resolve numeric values to their named labels (e.g. 0 → "Stopped").
   * Only the first point's labels are used (step charts are typically single-series
   * when discrete). Falls back to numeric display for values not in the map.
   */
  enumLabels?: Map<string, EnumLabel[]>;
}

const DEFAULT_HEIGHT = 300;
const DEFAULT_COLOR = "#4A9EFF";

// Read the current chart grid/axis color from CSS custom properties.
// Called by uPlot stroke functions on every draw — CSS vars update synchronously
// on theme switch so the next draw always uses the correct color.
function readGridColor(): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--io-chart-grid")
    .trim();
}
function readAxisColor(): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--io-chart-axis")
    .trim();
}

// Format a Unix-second timestamp for the tooltip header
function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Format a numeric value with appropriate precision
function fmtVal(v: number): string {
  if (Math.abs(v) >= 1000)
    return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return v.toPrecision(4).replace(/\.?0+$/, "");
}

// Build tooltip DOM safely (no innerHTML — avoids XSS from API-sourced labels)
function buildTooltipDOM(
  container: HTMLDivElement,
  ts: number,
  rows: Array<{ label: string; color: string; value: string; stale: boolean }>,
) {
  container.textContent = "";

  // Header: timestamp
  const header = document.createElement("div");
  header.style.cssText =
    "font-size:10px;color:var(--io-text-muted);margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid var(--io-border)";
  header.textContent = fmtTime(ts);
  container.appendChild(header);

  // Rows: one per series
  const body = document.createElement("div");
  body.style.fontSize = "11px";

  for (const row of rows) {
    const rowEl = document.createElement("div");
    rowEl.style.cssText =
      "display:flex;align-items:center;gap:6px;padding:2px 0";

    const dot = document.createElement("span");
    dot.style.cssText = `flex-shrink:0;width:8px;height:8px;border-radius:50%;background:${row.color}`;
    rowEl.appendChild(dot);

    const lbl = document.createElement("span");
    lbl.style.cssText =
      "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--io-text-secondary)";
    lbl.textContent = row.label;
    rowEl.appendChild(lbl);

    const val = document.createElement("span");
    val.style.cssText = `font-variant-numeric:tabular-nums;font-weight:500;color:${row.stale ? "var(--io-text-muted)" : "var(--io-text)"}`;

    if (row.stale) {
      const tilde = document.createElement("span");
      tilde.title = "Last known value before this time";
      tilde.style.cssText = "opacity:0.6;font-size:9px;margin-right:2px";
      tilde.textContent = "~";
      val.appendChild(tilde);
    }

    val.appendChild(document.createTextNode(row.value));
    rowEl.appendChild(val);

    body.appendChild(rowEl);
  }

  container.appendChild(body);
}

export default function TimeSeriesChart({
  timestamps,
  series,
  xRange,
  height,
  width,
  className,
  highlighted,
  onSeriesClick,
  seriesScales,
  onClearHighlight,
  showGrid = true,
  enumLabels,
}: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(width ?? 0);
  const [containerHeight, setContainerHeight] = useState<number>(
    height ?? DEFAULT_HEIGHT,
  );

  // Track controlled vs auto dimensions
  const isAutoWidth = width === undefined;
  const isAutoHeight = height === undefined;

  // Always-current x range — updated on every render so the scale range function
  // never uses a stale value, even though the chart isn't rebuilt on every tick.
  const xRangeRef = useRef(xRange);
  xRangeRef.current = xRange;

  // Always-current snapshot of data and series config — uPlot hooks read these
  // refs so they never use a stale closure.
  const latestDataRef = useRef<uPlot.AlignedData>([
    timestamps,
    ...series.map((s) => s.data),
  ]);
  latestDataRef.current = [timestamps, ...series.map((s) => s.data)];
  const latestSeriesRef = useRef(series);
  latestSeriesRef.current = series;

  // Always-current ref for the onSeriesClick callback (set in build effect, reads latest value)
  const onSeriesClickRef = useRef(onSeriesClick);
  onSeriesClickRef.current = onSeriesClick;
  const onClearHighlightRef = useRef(onClearHighlight);
  onClearHighlightRef.current = onClearHighlight;

  // Always-current highlighted set — read in the rebuild effect so the new
  // chart instance inherits the current highlight state immediately.
  const highlightedRef = useRef(highlighted);
  highlightedRef.current = highlighted;

  // Measure container dimensions via ResizeObserver when not explicitly provided
  useEffect(() => {
    if (!isAutoWidth && !isAutoHeight) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        if (isAutoWidth) setContainerWidth(entry.contentRect.width);
        if (isAutoHeight) setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isAutoWidth, isAutoHeight]);

  // When explicit dimensions change, sync state
  useEffect(() => {
    if (!isAutoWidth && width !== undefined) setContainerWidth(width);
  }, [isAutoWidth, width]);
  useEffect(() => {
    if (!isAutoHeight && height !== undefined) setContainerHeight(height);
  }, [isAutoHeight, height]);

  const resolvedWidth = isAutoWidth ? containerWidth : (width ?? 0);
  const resolvedHeight = isAutoHeight
    ? containerHeight
    : (height ?? DEFAULT_HEIGHT);

  // Number of Y series — used as a build dep so the chart rebuilds when
  // series are added or removed (uPlot doesn't support adding/removing
  // series after creation).
  const seriesCount = series.length;

  // Stable serialised key for the seriesScales prop — triggers a chart rebuild
  // only when scale assignments or ranges actually change.
  const seriesScalesKey = seriesScales
    ? seriesScales.map((s) => `${s.scaleKey}:${s.range?.join(",") ?? ""}`).join("|")
    : "";

  // Stable key for enumLabels — triggers a chart rebuild only when labels change.
  const enumLabelsKey = enumLabels
    ? Array.from(enumLabels.entries())
        .map(([pid, lbls]) => `${pid}:${lbls.map((l) => `${l.idx}=${l.label}`).join(",")}`)
        .join("|")
    : "";

  // Build (or rebuild) the uPlot instance.
  // Re-runs when dimensions, theme, or series count changes.
  useEffect(() => {
    if (!containerRef.current || resolvedWidth === 0) return;

    const data = latestDataRef.current;

    // Build per-series scale map from seriesScales prop.
    // Unique scale keys → their fixed range (undefined = auto).
    const uniqueScales = new Map<string, [number, number] | undefined>();
    if (seriesScales) {
      for (const ss of seriesScales) {
        if (!uniqueScales.has(ss.scaleKey)) uniqueScales.set(ss.scaleKey, ss.range);
      }
    } else {
      uniqueScales.set("y", undefined);
    }

    const uplotSeries: uPlot.Series[] = [
      {}, // x axis (time)
      ...series.map((s, i) => ({
        label: s.label,
        stroke: s.color ?? DEFAULT_COLOR,
        width: s.strokeWidth ?? 1.5,
        spanGaps: true,
        points: { show: false },
        scale: seriesScales ? seriesScales[i].scaleKey : "y",
      })),
    ];

    // Build scales config: x always present, y scales from uniqueScales.
    const scalesConfig: uPlot.Scales = {
      x: {
        time: true,
        // Force x-axis to the requested window rather than auto-fitting to data
        // extent — essential when data is sparse (e.g. first load of a 24h window).
        range: (_u, dataMin, dataMax) => {
          const r = xRangeRef.current;
          return [r ? r.min : dataMin, r ? r.max : dataMax];
        },
      },
    };
    for (const [key, range] of uniqueScales) {
      if (range) {
        const r = range; // capture for closure
        scalesConfig[key] = { range: () => r };
      } else {
        scalesConfig[key] = {};
      }
    }

    // Build a flat numeric → label map from enumLabels (first series wins).
    // Used to format Y-axis ticks as named state labels for discrete points.
    let enumLabelMap: Map<number, string> | null = null;
    if (enumLabels && enumLabels.size > 0) {
      const firstLabels = enumLabels.values().next().value;
      if (firstLabels && firstLabels.length > 0) {
        enumLabelMap = new Map(firstLabels.map((el: EnumLabel) => [el.idx, el.label]));
      }
    }

    // Build axes: x axis always first, then one y axis per unique scale.
    // The first scale's axis goes on the left; subsequent ones on the right.
    const axesConfig: uPlot.Axis[] = [
      {
        stroke: readAxisColor,
        ticks: { stroke: readGridColor },
        grid: { show: showGrid, stroke: readGridColor, width: 1 },
      },
    ];
    let isFirst = true;
    for (const key of uniqueScales.keys()) {
      // Find the first series that uses this scale to inherit its color.
      const seriesIdx = seriesScales
        ? seriesScales.findIndex((ss) => ss.scaleKey === key)
        : 0;
      const axisColor =
        seriesIdx >= 0 && series[seriesIdx]
          ? (series[seriesIdx].color ?? DEFAULT_COLOR)
          : DEFAULT_COLOR;
      const axisEntry: uPlot.Axis = {
        scale: key,
        side: isFirst ? 3 : 1, // left for first, right for others
        stroke: axisColor,
        ticks: { stroke: readGridColor },
        grid: { show: isFirst && showGrid, stroke: readGridColor, width: 1 },
      };
      // When enum labels are provided, replace numeric tick values with state names.
      if (enumLabelMap && isFirst) {
        const labelMap = enumLabelMap;
        axisEntry.values = (_u, vals) =>
          vals.map((v) => {
            if (v == null) return "";
            const label = labelMap.get(Math.round(v));
            return label ?? String(Math.round(v));
          });
      }
      axesConfig.push(axisEntry);
      isFirst = false;
    }

    const opts: uPlot.Options = {
      width: resolvedWidth,
      height: resolvedHeight,
      series: uplotSeries,
      legend: { show: false },
      focus: { alpha: 0.2 },
      axes: axesConfig,
      scales: scalesConfig,
      cursor: {
        drag: { x: true, y: false },
      },
      hooks: {
        setCursor: [
          (u) => {
            const tt = tooltipRef.current;
            if (!tt) return;

            const idx = u.cursor.idx;
            if (idx == null || idx < 0) {
              tt.style.display = "none";
              return;
            }

            const d = latestDataRef.current;
            const srcs = latestSeriesRef.current;
            const ts = d[0][idx];
            if (ts == null) {
              tt.style.display = "none";
              return;
            }

            // Build row data for each series
            const rows: Array<{
              label: string;
              color: string;
              value: string;
              stale: boolean;
            }> = [];
            for (let i = 0; i < srcs.length; i++) {
              const yData = d[i + 1] as (number | null | undefined)[];
              if (!yData) continue;
              const val = yData[idx];
              const color = srcs[i].color ?? DEFAULT_COLOR;

              let value: string;
              let stale = false;

              if (val != null && !isNaN(val)) {
                value = fmtVal(val);
              } else {
                // Walk back to find the last known good value
                let j = idx - 1;
                while (
                  j >= 0 &&
                  (yData[j] == null || isNaN(yData[j] as number))
                )
                  j--;
                if (j >= 0 && yData[j] != null) {
                  value = fmtVal(yData[j] as number);
                  stale = true;
                } else {
                  value = "—";
                }
              }

              rows.push({ label: srcs[i].label, color, value, stale });
            }

            buildTooltipDOM(tt, ts, rows);

            // Position tooltip: 30px right + 30px up by default.
            // Flip right→left when near the window's right edge.
            // Flip up→down when tooltip would overlap the top nav bar.
            // Tooltip uses position:fixed so coordinates are viewport-relative and
            // it escapes any overflow:hidden parent (neighboring panes, etc.)
            const curLeft = u.cursor.left ?? 0;
            const curTop = u.cursor.top ?? 0;

            // Convert cursor to viewport coordinates via u.over's position
            const overRect = u.over.getBoundingClientRect();
            const vpX = overRect.left + curLeft;
            const vpY = overRect.top + curTop;

            // Temporarily render off-screen to measure tooltip dimensions
            tt.style.display = "block";
            tt.style.visibility = "hidden";
            tt.style.left = "0px";
            tt.style.top = "-9999px";

            const ttW = tt.offsetWidth;
            const ttH = tt.offsetHeight;

            // Top boundary: bottom edge of the top nav bar (not raw y=0)
            const navBottom =
              document.querySelector("header")?.getBoundingClientRect()
                .bottom ?? 0;

            // Flip X if tooltip overflows window right edge
            const flipX = vpX + 30 + ttW > window.innerWidth;
            // Flip Y if tooltip would go above (or behind) the nav bar
            const flipY = vpY - 30 - ttH < navBottom;

            tt.style.left = `${flipX ? vpX - ttW - 30 : vpX + 30}px`;
            tt.style.top = `${flipY ? vpY + 30 : vpY - ttH - 30}px`;
            tt.style.visibility = "visible";
          },
        ],
        ready: [
          (u) => {
            u.over.addEventListener("mouseleave", () => {
              if (tooltipRef.current) tooltipRef.current.style.display = "none";
            });

            // Click-to-highlight: find the series whose Y value is closest to click pos.
            // stopPropagation prevents the pane selection handler from firing on chart clicks.
            u.over.addEventListener("click", (e) => {
              e.stopPropagation();
              if (!onSeriesClickRef.current) return;

              // Use posToVal to find the data index nearest to the click X position.
              // cursor.idx can be stale or null at click time (cursor moves after mousedown).
              const xVal = u.posToVal(e.offsetX, "x");
              const tsArr = latestDataRef.current[0] as number[];
              let nearestIdx = -1;
              let minDiff = Infinity;
              for (let j = 0; j < tsArr.length; j++) {
                const diff = Math.abs(tsArr[j] - xVal);
                if (diff < minDiff) {
                  minDiff = diff;
                  nearestIdx = j;
                }
              }
              if (nearestIdx < 0) return;

              const clickY = e.offsetY;
              let closestSeries = -1;
              let minDist = 50; // px proximity threshold

              const data = latestDataRef.current;
              const srcs = latestSeriesRef.current;

              for (let i = 0; i < srcs.length; i++) {
                const val = (data[i + 1] as (number | null)[])[nearestIdx];
                if (val == null) continue;
                const yPos = u.valToPos(val, "y");
                const dist = Math.abs(yPos - clickY);
                if (dist < minDist) {
                  minDist = dist;
                  closestSeries = i;
                }
              }

              if (closestSeries >= 0) {
                onSeriesClickRef.current(
                  srcs[closestSeries].label,
                  e.ctrlKey || e.metaKey,
                );
              } else {
                onClearHighlightRef.current?.();
              }
            });
          },
        ],
      },
    };

    if (uplotRef.current) {
      uplotRef.current.destroy();
      uplotRef.current = null;
    }

    const u = new uPlot(opts, data, containerRef.current);
    uplotRef.current = u;

    // Re-apply highlight state so the rebuilt chart matches the legend after
    // dimension changes (e.g. entering or exiting fullscreen).
    const h = highlightedRef.current;
    if (h && h.size > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ux = u as any;
      latestSeriesRef.current.forEach((s, i) => {
        const uSeries = ux.series[i + 1];
        if (!uSeries) return;
        uSeries._focus = h.has(s.label);
        uSeries.alpha = h.has(s.label) ? 1 : 0.3;
      });
      u.redraw(false);
    }

    return () => {
      u.destroy();
      uplotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedWidth, resolvedHeight, seriesCount, seriesScalesKey, enumLabelsKey]);

  // Update data without rebuilding the chart (hot path — runs on every tick).
  useEffect(() => {
    if (!uplotRef.current) return;
    const data = latestDataRef.current;
    if (data[0].length === 0) return;
    uplotRef.current.setData(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timestamps, series]);

  // Resize when dimensions change but chart already exists
  useEffect(() => {
    if (!uplotRef.current || resolvedWidth === 0) return;
    uplotRef.current.setSize({ width: resolvedWidth, height: resolvedHeight });
  }, [resolvedWidth, resolvedHeight]);

  // Apply highlight dimming via uPlot's focus system when highlighted set changes.
  // uPlot's setSeries only handles 'focus' and 'show' — stroke/width are ignored.
  // For multi-select we set _focus and alpha directly then call redraw(false).
  useEffect(() => {
    const u = uplotRef.current;
    if (!u) return;
    const h = highlighted ?? new Set<string>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ux = u as any;
    if (h.size === 0) {
      // Reset manually-set alpha values before calling setSeries so the
      // subsequent redraw uses full opacity for all series.
      ux.series.forEach((uSeries: any) => {
        if (uSeries) uSeries.alpha = 1;
      });
      (u as any).setSeries(null, { focus: true });
    } else {
      // Multi-highlight: set _focus + alpha per-series then redraw
      series.forEach((s, i) => {
        const uSeries = ux.series[i + 1];
        if (!uSeries) return;
        const isActive = h.has(s.label);
        uSeries._focus = isActive;
        uSeries.alpha = isActive ? 1 : 0.3;
      });
      u.redraw(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted]);

  // Track the active fullscreen element so we can portal the tooltip into it.
  // When a pane uses requestFullscreen(), the pane enters the browser top-layer;
  // elements in document.body render behind it. Portalling into document.fullscreenElement
  // keeps the tooltip visible in both normal and fullscreen modes.
  const [tooltipPortalTarget, setTooltipPortalTarget] = useState<Element>(
    document.body,
  );
  useEffect(() => {
    function onFSChange() {
      setTooltipPortalTarget(document.fullscreenElement ?? document.body);
    }
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, []);

  const showNoData = timestamps.length === 0;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: isAutoWidth ? "100%" : resolvedWidth,
        height: isAutoHeight ? "100%" : resolvedHeight,
        position: "relative",
      }}
    >
      {showNoData && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--io-text-muted)",
            fontSize: "13px",
            pointerEvents: "none",
          }}
        >
          No data
        </div>
      )}

      {/* Tooltip — portalled into the active fullscreen element (if any) or document.body.
          When a pane uses requestFullscreen(), the pane enters the browser top-layer and
          document.body children are rendered behind it. Portalling into the fullscreen
          element ensures the tooltip remains visible in both normal and fullscreen modes. */}
      {createPortal(
        <div
          ref={tooltipRef}
          style={{
            display: "none",
            position: "fixed",
            zIndex: 9999,
            pointerEvents: "none",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: 6,
            padding: "7px 10px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            minWidth: 140,
            maxWidth: 220,
          }}
        />,
        tooltipPortalTarget,
      )}
    </div>
  );
}
