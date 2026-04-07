import { useQuery } from "@tanstack/react-query";
import EChart from "../../../shared/components/charts/EChart";
import type { EChartsOption } from "echarts";
import { api } from "../../../api/client";
import type { WidgetConfig } from "../../../api/dashboards";
import { usePointValues } from "../../../shared/hooks/usePointValues";
import PointContextMenu from "../../../shared/components/PointContextMenu";
import { useUomStore, convertUom } from "../../../store/uomStore";

interface GaugeConfig {
  title: string;
  pointId: string;
  min: number;
  max: number;
  unit?: string;
  thresholds: { warning: number; critical: number };
}

interface PointCurrentResponse {
  value: number;
  quality: string;
  timestamp: string;
  engineering_unit?: string | null;
}

interface Props {
  config: WidgetConfig;
  variables: Record<string, string[]>;
}

/** Resolve a CSS custom property to its computed value for use in ECharts options.
 *  ECharts configuration objects do not support CSS variable strings — they require
 *  resolved color values. This reads from the document root at render time so the
 *  chart reflects the currently active theme.
 */
function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}

export default function GaugeWidget({ config }: Props) {
  const cfg = config.config as unknown as GaugeConfig;
  const { pointId, min = 0, max = 100, unit = "", thresholds } = cfg;
  const uomCatalog = useUomStore((s) => s.catalog);

  const query = useQuery({
    queryKey: ["point-current", pointId],
    queryFn: async () => {
      const result = await api.get<PointCurrentResponse>(
        `/api/points/${encodeURIComponent(pointId)}/current`,
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 5000,
    enabled: !!pointId,
  });

  // Real-time WebSocket subscription — overrides the API-fetched value when available
  const liveValues = usePointValues(pointId ? [pointId] : []);
  const livePoint = pointId ? liveValues.get(pointId) : undefined;

  const rawValue = livePoint?.value ?? query.data?.value ?? min;

  // Client-side UOM conversion for real-time gauge reading.
  // spec: design-docs/10_DASHBOARDS_MODULE.md §UOM Conversion
  // Falls through to rawValue when no display unit is configured or the pair
  // is not in the catalog (never throws).
  const sourceUnit = query.data?.engineering_unit ?? null;
  const displayUnit = unit || null;
  const convertedRaw =
    sourceUnit && displayUnit && sourceUnit !== displayUnit
      ? convertUom(rawValue, sourceUnit, displayUnit, uomCatalog)
      : rawValue;

  const clampedValue = Math.min(max, Math.max(min, convertedRaw));
  const quality = livePoint?.quality ?? query.data?.quality ?? "unknown";
  const isStale =
    livePoint?.stale === true || quality === "uncertain" || quality === "bad";

  function getColor(val: number): string {
    if (!thresholds) return resolveToken("--io-accent");
    if (val >= thresholds.critical) return resolveToken("--io-alarm-urgent");
    if (val >= thresholds.warning) return resolveToken("--io-alarm-high");
    return resolveToken("--io-alarm-normal");
  }

  const color = getColor(clampedValue);

  const axisLineData: [number, string][] = thresholds
    ? [
        [thresholds.warning / max, resolveToken("--io-alarm-normal")],
        [thresholds.critical / max, resolveToken("--io-alarm-high")],
        [1, resolveToken("--io-alarm-urgent")],
      ]
    : [[1, resolveToken("--io-accent")]];

  const option: EChartsOption = {
    backgroundColor: "transparent",
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        min,
        max,
        radius: "85%",
        center: ["50%", "55%"],
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 12,
            color: axisLineData,
          },
        },
        pointer: {
          itemStyle: { color },
          length: "55%",
          width: 4,
        },
        axisTick: { show: false },
        splitLine: {
          length: 8,
          lineStyle: { color: resolveToken("--io-border-strong"), width: 1 },
        },
        axisLabel: {
          color: resolveToken("--io-text-muted"),
          fontSize: 10,
          distance: 14,
        },
        detail: {
          valueAnimation: true,
          formatter: (v: number) => `${v.toFixed(1)}${unit ? " " + unit : ""}`,
          color,
          fontSize: 18,
          fontWeight: 600,
          offsetCenter: [0, "30%"],
        },
        data: [{ value: clampedValue, name: "" }],
        title: { show: false },
      },
    ],
  };

  if (query.isLoading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: "12px",
        }}
      >
        Loading...
      </div>
    );
  }

  if (query.isError) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-danger)",
          fontSize: "12px",
        }}
      >
        Error loading value
      </div>
    );
  }

  return (
    // Right-click (desktop) or long-press (mobile — TODO) opens PointContextMenu
    <PointContextMenu
      pointId={pointId ?? ""}
      tagName={pointId ?? ""}
      isAlarm={false}
      isAlarmElement={false}
    >
      <div style={{ height: "100%", minHeight: 0, position: "relative" }}>
        <EChart option={option} />
        {isStale && (
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 8,
              display: "flex",
              alignItems: "center",
              gap: "3px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background:
                  quality === "bad" ? "var(--io-danger)" : "var(--io-warning)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "9px",
                color: "var(--io-text-muted)",
                letterSpacing: "0.05em",
              }}
            >
              {quality === "bad" ? "BAD" : "STALE"}
            </span>
          </div>
        )}
      </div>
    </PointContextMenu>
  );
}
