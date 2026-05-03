import type { AggregateType } from "./chart-config-types";

export function applyAggregate(type: AggregateType, samples: number[]): number {
  if (samples.length === 0) return NaN;
  switch (type) {
    case "avg":
      return samples.reduce((a, b) => a + b, 0) / samples.length;
    case "sum":
      return samples.reduce((a, b) => a + b, 0);
    case "last":
      return samples[samples.length - 1];
    case "first":
      return samples[0];
    case "max":
      return samples.reduce((a, b) => (a > b ? a : b));
    case "min":
      return samples.reduce((a, b) => (a < b ? a : b));
    case "count":
      return samples.length;
    case "median": {
      const sorted = [...samples].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    case "range":
      return (
        samples.reduce((a, b) => (a > b ? a : b)) -
        samples.reduce((a, b) => (a < b ? a : b))
      );
    case "stddev": {
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      const variance =
        samples.reduce((s, x) => s + (x - mean) ** 2, 0) / samples.length;
      return Math.sqrt(variance);
    }
    default:
      return NaN;
  }
}
