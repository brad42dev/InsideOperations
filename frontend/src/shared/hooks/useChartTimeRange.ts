/**
 * useChartTimeRange — returns the effective time window for a chart in the current playback mode.
 *
 * Live mode: end = Date.now(), start = end − durationMinutes.
 * Historical mode: end = scrub-bar timestamp (snapped), start = end − durationMinutes.
 *
 * Used by chart renderers that query their own data (not via useTimeSeriesBuffer).
 */
import { usePlaybackStore } from "../../store/playback";

export interface ChartTimeRange {
  startMs: number;
  endMs: number;
  isHistorical: boolean;
}

export function useChartTimeRange(
  durationMinutes: number,
  bucketSeconds?: number,
): ChartTimeRange {
  const { mode, timestamp } = usePlaybackStore((s) => ({
    mode: s.mode,
    timestamp: s.timestamp,
  }));
  const isHistorical = mode === "historical";

  // Snap to bucket boundaries so the chart window advances at the same
  // resolution as the data. Falls back to duration-scaled snap (capped at 30s)
  // for charts without an explicit bucket size.
  const snapMs = bucketSeconds
    ? bucketSeconds * 1_000
    : Math.min(30_000, durationMinutes * 1_000);
  const endMs = isHistorical
    ? Math.floor(timestamp / snapMs) * snapMs
    : Date.now();

  return {
    startMs: endMs - durationMinutes * 60 * 1_000,
    endMs,
    isHistorical,
  };
}
