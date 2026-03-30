// ---------------------------------------------------------------------------
// Chart aggregate configuration — per-chart valid aggregates, bucket size
// options, and helper functions shared between ChartToolbar and ChartOptionsForm.
// ---------------------------------------------------------------------------

import type { AggregateType, ChartTypeId } from './chart-config-types'

// ---------------------------------------------------------------------------
// Per-chart-type valid aggregates (ordered: most natural first)
// Absence from this map = chart does not support aggregate selection.
// ---------------------------------------------------------------------------

export const CHART_AGGREGATE_TYPES: Partial<Record<ChartTypeId, AggregateType[]>> = {
  1:  ['avg', 'min', 'max', 'first', 'last', 'median', 'sum'],   // Live Trend
  2:  ['avg', 'min', 'max', 'first', 'last', 'median', 'sum'],   // Historical Trend
  3:  ['avg', 'min', 'max', 'first', 'last', 'median', 'sum'],   // Multi-Axis Trend
  4:  ['last', 'first', 'avg', 'min', 'max'],                     // Step Chart (discrete — no median)
  5:  ['sum', 'avg', 'max', 'min', 'count'],                      // Bar / Column
  17: ['avg', 'sum', 'count'],                                    // Heatmap
  22: ['sum', 'avg', 'min', 'max', 'first', 'last'],             // Stacked Area
  36: ['avg', 'min', 'max', 'sum', 'count', 'first', 'last'],   // Scorecard Table
}

// ---------------------------------------------------------------------------
// Charts that show the duration (time window) control in the toolbar.
// Does NOT imply aggregate selector — use CHART_AGGREGATE_TYPES for that.
// ---------------------------------------------------------------------------

export const CHART_HAS_DURATION = new Set<ChartTypeId>([
  1, 2, 3, 4, 5, 13, 14, 16, 17, 19, 20, 22,
  24, 25, 26, 29, 30, 31, 35, 36, 37, 38, 39,
])

// ---------------------------------------------------------------------------
// Bucket size options
// ---------------------------------------------------------------------------

export interface BucketOption {
  seconds: number
  label: string      // full label shown in wider layouts and in the dropdown list
  labelShort: string // abbreviated label for narrow toolbar trigger
}

export const BUCKET_OPTIONS: BucketOption[] = [
  { seconds: 1,     label: '1 sec',  labelShort: '1s'  },
  { seconds: 5,     label: '5 sec',  labelShort: '5s'  },
  { seconds: 10,    label: '10 sec', labelShort: '10s' },
  { seconds: 30,    label: '30 sec', labelShort: '30s' },
  { seconds: 60,    label: '1 min',  labelShort: '1m'  },
  { seconds: 300,   label: '5 min',  labelShort: '5m'  },
  { seconds: 900,   label: '15 min', labelShort: '15m' },
  { seconds: 3600,  label: '1 hr',   labelShort: '1h'  },
  { seconds: 86400, label: '1 day',  labelShort: '1d'  },
]

/**
 * Return only the bucket options that produce a reasonable number of data
 * points for the given duration.
 * Rule: 10 ≤ (durationSeconds / bucketSeconds) ≤ 3000
 */
export function getValidBuckets(durationMinutes: number): BucketOption[] {
  const durationSeconds = durationMinutes * 60
  return BUCKET_OPTIONS.filter((b) => {
    const points = durationSeconds / b.seconds
    return points >= 10 && points <= 3000
  })
}

/**
 * Pick the best default bucket size for a given duration.
 * Targets ~300 data points, using the smallest BUCKET_OPTION that keeps
 * the point count ≤ 3000 (same upper bound as getValidBuckets so Auto
 * always picks an option that would appear in the toolbar dropdown).
 */
export function defaultBucketSeconds(durationMinutes: number): number {
  const durationSeconds = durationMinutes * 60
  const target = 300 // aim for roughly this many data points
  const idealBucketSeconds = durationSeconds / target
  // Walk backwards through options (largest first) to find the biggest bucket
  // that is still at or below the ideal bucket size — i.e. the one that gives
  // at least ~300 points without exceeding 3000.
  for (let i = BUCKET_OPTIONS.length - 1; i >= 0; i--) {
    if (BUCKET_OPTIONS[i].seconds <= idealBucketSeconds) {
      return BUCKET_OPTIONS[i].seconds
    }
  }
  return BUCKET_OPTIONS[0].seconds // 1s minimum
}

/**
 * Map a bucket size in seconds to the nearest precomputed resolution string
 * for the legacy API path. Used only when bucket_seconds is not directly
 * supported by the endpoint.
 */
export function bucketToResolution(bucketSeconds: number): string {
  if (bucketSeconds < 60)   return 'raw'
  if (bucketSeconds < 300)  return '1m'
  if (bucketSeconds < 900)  return '5m'
  if (bucketSeconds < 3600) return '15m'
  if (bucketSeconds < 86400) return '1h'
  return '1d'
}

// ---------------------------------------------------------------------------
// Aggregate display labels
// ---------------------------------------------------------------------------

export const AGGREGATE_LABELS: Record<AggregateType, { full: string; short: string }> = {
  avg:    { full: 'Average',         short: 'Avg'   },
  min:    { full: 'Minimum',         short: 'Min'   },
  max:    { full: 'Maximum',         short: 'Max'   },
  sum:    { full: 'Sum',             short: 'Sum'   },
  count:  { full: 'Count',           short: 'Cnt'   },
  first:  { full: 'First',           short: 'First' },
  last:   { full: 'Last',            short: 'Last'  },
  median: { full: 'Median',          short: 'Med'   },
  stddev: { full: 'Std Deviation',   short: 'σ'     },
  range:  { full: 'Range (max−min)', short: 'Rng'   },
}
