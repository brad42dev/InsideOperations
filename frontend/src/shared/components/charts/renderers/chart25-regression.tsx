// ---------------------------------------------------------------------------
// Chart 25 — Regression Overlay
// Fetches historical data for each series, fits a regression model, and
// overlays the regression line on the original data in TimeSeriesChart.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import TimeSeriesChart, { type Series } from "../TimeSeriesChart";
import { type ChartConfig, autoColor, makeSlotLabeler } from "../chart-config-types";
import { ChartLegendLayout, type LegendItem } from "../ChartLegend";
import { pointsApi } from "../../../../api/points";
import { useHighlight } from "../hooks/useHighlight";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type RegressionModel =
  | "linear"
  | "polynomial"
  | "exponential"
  | "logarithmic"
  | "power";

function computeR2(
  x: number[],
  y: number[],
  predict: (xi: number) => number,
): number {
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  const ssRes = y.reduce((a, v, i) => a + (v - predict(x[i])) ** 2, 0);
  const ssTot = y.reduce((a, v) => a + (v - my) ** 2, 0);
  return ssTot ? 1 - ssRes / ssTot : 0;
}

function linearRegression(
  x: number[],
  y: number[],
): {
  slope: number;
  intercept: number;
  r2: number;
  predict: (xi: number) => number;
} {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    den += (x[i] - mx) ** 2;
  }
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  const predict = (xi: number) => intercept + slope * xi;
  const r2 = computeR2(x, y, predict);
  return { slope, intercept, r2, predict };
}

function exponentialRegression(
  x: number[],
  y: number[],
): { r2: number; predict: (xi: number) => number; label: string } {
  // Fit log(y) = log(a) + b*x using linear regression on log-transformed y
  const validPairs = x
    .map((xi, i) => ({ xi, yi: y[i] }))
    .filter((p) => p.yi > 0);
  if (validPairs.length < 2) {
    return { r2: 0, predict: () => 0, label: "y = 0" };
  }
  const lx = validPairs.map((p) => p.xi);
  const ly = validPairs.map((p) => Math.log(p.yi));
  const { slope, intercept, r2 } = linearRegression(lx, ly);
  const a = Math.exp(intercept);
  const b = slope;
  const predict = (xi: number) => a * Math.exp(b * xi);
  return {
    r2,
    predict,
    label: `y = ${a.toFixed(3)}e^(${b.toFixed(4)}x)`,
  };
}

function logarithmicRegression(
  x: number[],
  y: number[],
): { r2: number; predict: (xi: number) => number; label: string } {
  const validPairs = x
    .map((xi, i) => ({ xi, yi: y[i] }))
    .filter((p) => p.xi > 0);
  if (validPairs.length < 2) {
    return { r2: 0, predict: () => 0, label: "y = 0" };
  }
  const lx = validPairs.map((p) => Math.log(p.xi));
  const ly = validPairs.map((p) => p.yi);
  const { slope, intercept, r2 } = linearRegression(lx, ly);
  const predict = (xi: number) =>
    xi > 0 ? intercept + slope * Math.log(xi) : intercept;
  return {
    r2,
    predict,
    label: `y = ${intercept.toFixed(3)} + ${slope.toFixed(3)}ln(x)`,
  };
}

function polynomialRegression(
  x: number[],
  y: number[],
  degree: number,
): { r2: number; predict: (xi: number) => number; label: string } {
  // Solve using normal equations via Gaussian elimination
  const n = x.length;
  const d = degree + 1;
  // Build the Vandermonde matrix system A^T A * c = A^T y
  const ata: number[][] = Array.from({ length: d }, () => Array(d).fill(0));
  const aty: number[] = Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    const powers: number[] = [];
    for (let p = 0; p < d; p++) powers.push(x[i] ** p);
    for (let r = 0; r < d; r++) {
      for (let c = 0; c < d; c++) {
        ata[r][c] += powers[r] * powers[c];
      }
      aty[r] += powers[r] * y[i];
    }
  }
  // Gaussian elimination with back-substitution
  const aug = ata.map((row, i) => [...row, aty[i]]);
  for (let col = 0; col < d; col++) {
    let maxRow = col;
    for (let row = col + 1; row < d; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    for (let row = col + 1; row < d; row++) {
      const factor = aug[col][col] ? aug[row][col] / aug[col][col] : 0;
      for (let k = col; k <= d; k++) aug[row][k] -= factor * aug[col][k];
    }
  }
  const coeff = Array(d).fill(0);
  for (let i = d - 1; i >= 0; i--) {
    coeff[i] = aug[i][d];
    for (let j = i + 1; j < d; j++) coeff[i] -= aug[i][j] * coeff[j];
    coeff[i] = aug[i][i] ? coeff[i] / aug[i][i] : 0;
  }
  const predict = (xi: number) =>
    coeff.reduce((sum, c, p) => sum + c * xi ** p, 0);
  const r2 = computeR2(x, y, predict);
  const label = coeff
    .map((c, p) => (p === 0 ? c.toFixed(3) : `${c.toFixed(3)}x^${p}`))
    .join(" + ");
  return { r2, predict, label: `y = ${label}` };
}

function powerRegression(
  x: number[],
  y: number[],
): { r2: number; predict: (xi: number) => number; label: string } {
  const validPairs = x
    .map((xi, i) => ({ xi, yi: y[i] }))
    .filter((p) => p.xi > 0 && p.yi > 0);
  if (validPairs.length < 2) {
    return { r2: 0, predict: () => 0, label: "y = 0" };
  }
  const lx = validPairs.map((p) => Math.log(p.xi));
  const ly = validPairs.map((p) => Math.log(p.yi));
  const { slope, intercept, r2 } = linearRegression(lx, ly);
  const a = Math.exp(intercept);
  const b = slope;
  const predict = (xi: number) => (xi > 0 ? a * xi ** b : 0);
  return {
    r2,
    predict,
    label: `y = ${a.toFixed(3)}x^${b.toFixed(3)}`,
  };
}

export default function Chart25Regression({ config }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const { highlighted, toggle } = useHighlight();
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const legendItems: LegendItem[] = seriesSlots.map((slot, i) => ({
    label: slotLabel(slot),
    color: slot.color ?? autoColor(i),
  }));
  const pointIds = seriesSlots.map((s) => s.pointId);

  const model = (config.extras?.model as RegressionModel) ?? "linear";
  const degree =
    typeof config.extras?.degree === "number" ? config.extras.degree : 2;
  const showEquation = config.extras?.showEquation !== false;

  const durationMinutes = config.durationMinutes ?? 120;
  const nowISO = new Date().toISOString();
  const startISO = new Date(
    Math.floor((Date.now() - durationMinutes * 60_000) / 60_000) * 60_000,
  ).toISOString();

  const { data: histResults, isFetching } = useQuery({
    queryKey: [
      "chart25-regression",
      pointIds.join(","),
      startISO,
      model,
      degree,
    ],
    queryFn: async () => {
      if (pointIds.length === 0) return [];
      const results = await Promise.all(
        pointIds.map((id) =>
          pointsApi.history(id, {
            start: startISO,
            end: nowISO,
            resolution: "auto",
            limit: 500,
          }),
        ),
      );
      return results.map((r, i) => ({
        pointId: pointIds[i],
        rows: r.success && r.data?.rows ? r.data.rows : [],
      }));
    },
    enabled: pointIds.length > 0,
    staleTime: 30_000,
  });

  const { timestamps, series, equations } = useMemo(() => {
    if (!histResults || histResults.length === 0) {
      return { timestamps: [], series: [], equations: [] };
    }

    // Union timestamps from all series
    const allTsSet = new Set<number>();
    const seriesDataMap = new Map<string, Map<number, number | null>>();

    for (const { pointId, rows } of histResults) {
      const ptMap = new Map<number, number | null>();
      for (const row of rows) {
        const ts = new Date(row.timestamp).getTime() / 1000;
        const v = (row.value ?? row.avg ?? null) as number | null;
        allTsSet.add(ts);
        ptMap.set(ts, v);
      }
      seriesDataMap.set(pointId, ptMap);
    }

    const sortedTs = Array.from(allTsSet).sort((a, b) => a - b);
    if (sortedTs.length === 0)
      return { timestamps: [], series: [], equations: [] };

    const t0 = sortedTs[0];
    const built: Series[] = [];
    const eqs: { label: string; r2: number; color: string }[] = [];

    seriesDataMap.forEach((ptMap, pid) => {
      const idx = pointIds.indexOf(pid);
      const color = seriesSlots[idx]?.color ?? autoColor(idx);

      const dataArr = sortedTs.map((ts) => ptMap.get(ts) ?? null);

      const slotLabelStr = seriesSlots[idx] ? slotLabel(seriesSlots[idx]) : pid;
      built.push({
        label: slotLabelStr,
        data: dataArr,
        color,
        strokeWidth: 1.5,
      });

      // Build regression on non-null values
      const pairs: { x: number; y: number }[] = [];
      sortedTs.forEach((ts, i) => {
        const v = dataArr[i];
        if (v !== null) pairs.push({ x: ts - t0, y: v });
      });

      if (pairs.length < 3) return;

      const xArr = pairs.map((p) => p.x);
      const yArr = pairs.map((p) => p.y);

      let predict: (xi: number) => number;
      let label = "";
      let r2 = 0;

      if (model === "linear") {
        const res = linearRegression(xArr, yArr);
        predict = res.predict;
        r2 = res.r2;
        label = `y = ${res.intercept.toFixed(3)} + ${res.slope.toFixed(4)}x`;
      } else if (model === "exponential") {
        const res = exponentialRegression(xArr, yArr);
        predict = res.predict;
        r2 = res.r2;
        label = res.label;
      } else if (model === "logarithmic") {
        const res = logarithmicRegression(xArr, yArr);
        predict = res.predict;
        r2 = res.r2;
        label = res.label;
      } else if (model === "polynomial") {
        const res = polynomialRegression(xArr, yArr, degree);
        predict = res.predict;
        r2 = res.r2;
        label = res.label;
      } else if (model === "power") {
        const res = powerRegression(xArr, yArr);
        predict = res.predict;
        r2 = res.r2;
        label = res.label;
      } else {
        const res = linearRegression(xArr, yArr);
        predict = res.predict;
        r2 = res.r2;
        label = `y = ${res.intercept.toFixed(3)} + ${res.slope.toFixed(4)}x`;
      }

      const regData = sortedTs.map((ts) => {
        try {
          const v = predict(ts - t0);
          return isFinite(v) ? v : null;
        } catch {
          return null;
        }
      });

      built.push({
        label: `${slotLabelStr} (fit)`,
        data: regData,
        color,
        strokeWidth: 1,
      });

      eqs.push({
        label: `${slotLabelStr}: ${label}  R²=${r2.toFixed(3)}`,
        r2,
        color,
      });
    });

    return {
      timestamps: sortedTs,
      series: built,
      equations: eqs,
      xRange: { min: sortedTs[0], max: sortedTs[sortedTs.length - 1] },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histResults, model, degree]);

  if (seriesSlots.length === 0) {
    return (
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
    );
  }

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

        {showEquation && equations.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              background: "var(--io-surface)",
              border: "1px solid var(--io-border)",
              borderRadius: 4,
              padding: "4px 8px",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            {equations.map((eq) => (
              <div
                key={eq.label}
                style={{
                  fontSize: 10,
                  color: eq.color,
                  fontFamily: "monospace",
                }}
              >
                {eq.label}
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0 }}>
          <TimeSeriesChart
            timestamps={timestamps}
            series={series}
            xRange={
              timestamps.length > 0
                ? { min: timestamps[0], max: timestamps[timestamps.length - 1] }
                : undefined
            }
          />
        </div>
      </div>
    </ChartLegendLayout>
  );
}
