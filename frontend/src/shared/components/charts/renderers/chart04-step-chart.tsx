// ---------------------------------------------------------------------------
// Chart 04 — Step Chart
// Same as live trend but forces step interpolation. A "Step" label is
// overlaid at the top-left to indicate the rendering mode.
// ---------------------------------------------------------------------------

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTimeSeriesBuffer } from "../hooks/useTimeSeriesBuffer";
import { useHighlight } from "../hooks/useHighlight";
import TimeSeriesChart, { type Series } from "../TimeSeriesChart";
import {
  type ChartConfig,
  autoColor,
  makeSlotLabeler,
  resolveSeriesScales,
} from "../chart-config-types";
import { ChartLegendLayout, type LegendItem } from "../ChartLegend";
import type { EnumLabel } from "../../../../api/points";
import { pointsApi } from "../../../../api/points";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
  /** Optional enum label map: pointId → EnumLabel[]. When provided, Y-axis ticks show state names. */
  enumLabels?: Map<string, EnumLabel[]>;
}

export default function Chart04StepChart({
  config,
  bufferKey,
  enumLabels,
}: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const { highlighted, toggle } = useHighlight();
  const durationMinutes = config.durationMinutes ?? 60;
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const pointIds = seriesSlots.map((p) => p.pointId);

  const { data: msiMap } = useQuery({
    queryKey: ["point-msi-batch", pointIds.join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        pointIds.map((id) => pointsApi.getMeta(id)),
      );
      const map = new Map<string, number | null>();
      results.forEach((r, i) => {
        map.set(
          pointIds[i],
          r.success ? (r.data.minimum_sampling_interval_ms ?? null) : null,
        );
      });
      return map;
    },
    enabled: pointIds.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Step charts always force step interpolation regardless of config.interpolation.
  const { timestamps, seriesData, isFetching } = useTimeSeriesBuffer({
    bufferKey,
    pointIds,
    durationMinutes,
    interpolation: "step",
    bucketSeconds: config.aggregateSize,
    aggregateType: config.aggregateType,
    msiMap,
  });

  const xRangeRef = useRef<{ min: number; max: number }>({ min: 0, max: 0 });
  const nowSec = Date.now() / 1000;
  xRangeRef.current.min = nowSec - durationMinutes * 60;
  xRangeRef.current.max = nowSec;

  // Step chart type — always render as step; MSI in msiMap drives boundary fill
  // in useTimeSeriesBuffer for slow-update tags (GC analyzers etc.)
  const series: Series[] = seriesSlots.map((slot, i) => ({
    label: slotLabel(slot),
    data: seriesData.get(slot.pointId) ?? [],
    color: slot.color ?? autoColor(i),
    strokeWidth: 1.5,
    step: true,
  }));

  const seriesScales = resolveSeriesScales(
    config.scaling,
    seriesSlots.map((s) => s.slotId),
  );

  const legendItems: LegendItem[] = seriesSlots.map((slot, i) => ({
    label: slotLabel(slot),
    color: slot.color ?? autoColor(i),
  }));

  return (
    <ChartLegendLayout
      legend={config.legend}
      items={legendItems}
      highlighted={highlighted}
      onHighlight={toggle}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          position: "relative",
        }}
      >
        {/* Step mode badge — top-left overlay */}
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 8,
            fontSize: 10,
            fontWeight: 600,
            color: "var(--io-text-muted)",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: 4,
            padding: "1px 6px",
            zIndex: 10,
            pointerEvents: "none",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Step
        </div>

        {/* Loading indicator */}
        {isFetching && (
          <div
            style={{
              position: "absolute",
              top: 4,
              right: 8,
              fontSize: 11,
              color: "var(--io-text-muted)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            Loading…
          </div>
        )}

        {/* Empty state */}
        {pointIds.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--io-text-muted)",
              fontSize: 13,
            }}
          >
            No points configured
          </div>
        )}

        {pointIds.length > 0 && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <TimeSeriesChart
              timestamps={timestamps}
              series={series}
              xRange={xRangeRef.current}
              highlighted={highlighted}
              onSeriesClick={toggle}
              seriesScales={seriesScales}
              enumLabels={enumLabels}
            />
          </div>
        )}
      </div>
    </ChartLegendLayout>
  );
}
