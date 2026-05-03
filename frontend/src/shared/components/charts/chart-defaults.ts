import type { ChartConfig, ChartTypeId } from "./chart-config-types";

export function makeDefaultChartConfig(id: ChartTypeId): ChartConfig {
  const base: ChartConfig = {
    chartType: id,
    points: [],
    durationMinutes: 60,
    legend: { show: true, mode: "fixed", position: "top" },
    scaling: { type: "auto" },
    xAxisLabels: "full",
    yAxisLabels: "full",
  };

  switch (id) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 16:
    case 22:
      return { ...base, interpolation: id === 4 ? "step" : "linear" };

    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 17:
    case 23:
      return {
        ...base,
        legend: { show: false, mode: "fixed", position: "top" },
      };

    case 15:
      return {
        ...base,
        legend: { show: false, mode: "fixed", position: "top" },
      };

    case 20:
      return { ...base, extras: { displayMode: "histogram", binCount: 20 } };

    case 40:
      return { ...base, extras: { resetPeriod: "shift" } };

    case 41:
      return { ...base, extras: { cols: 4, colorRules: [] } };

    case 50:
      return {
        ...base,
        extras: { text: "Edit this text", format: "plain", align: "left" },
      };

    case 51:
      return { ...base, extras: { text: "Section", level: 2, align: "left" } };

    case 52:
      return { ...base, extras: { mode: "clock", format: "HH:mm:ss" } };

    case 53:
      return {
        ...base,
        extras: { source: "alarms", maxRows: 25, autoScroll: true },
      };

    case 54:
      return { ...base, extras: { url: "" } };

    case 55:
      return { ...base, extras: { streamId: "" } };

    default:
      return base;
  }
}
