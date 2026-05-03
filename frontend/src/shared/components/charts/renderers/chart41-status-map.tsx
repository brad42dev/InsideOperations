// ---------------------------------------------------------------------------
// Chart 41 — Status Map / Fleet Status Grid
// CSS-grid layout of equipment items colored by current value via configurable
// color rules. Live updates bypass React via direct DOM mutation by data-point-id.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useMemo } from "react";
import { wsManager } from "../../../hooks/useWebSocket";
import type { ChartConfig, ChartPointSlot } from "../chart-config-types";
import { makeSlotLabeler } from "../chart-config-types";

export interface ColorRule {
  min: number;
  max: number;
  color: string;
  label?: string;
}

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

function ruleColor(
  rules: ColorRule[],
  value: number | null | undefined,
): { color: string; label: string } {
  if (value == null || !Number.isFinite(value)) {
    return { color: "var(--io-surface-muted, #2A2A2E)", label: "—" };
  }
  for (const r of rules) {
    if (value >= r.min && value < r.max) {
      return { color: r.color, label: r.label ?? String(value) };
    }
  }
  return { color: "var(--io-surface-muted, #2A2A2E)", label: String(value) };
}

export default function Chart41StatusMap({ config }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const items: ChartPointSlot[] = useMemo(
    () => config.points.filter((p) => p.role === "item"),
    [config.points],
  );

  const cols =
    (config.extras?.cols as number | undefined) ??
    Math.max(1, Math.ceil(Math.sqrt(items.length)));
  const rules: ColorRule[] =
    (config.extras?.colorRules as ColorRule[] | undefined) ?? [];

  const containerRef = useRef<HTMLDivElement>(null);

  // Stable handler ref so subscribe/unsubscribe get the same function reference
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  useEffect(() => {
    if (items.length === 0) return;

    const handler = (pv: {
      pointId: string;
      value: number;
      quality: string;
    }) => {
      const cell = containerRef.current?.querySelector<HTMLElement>(
        `[data-point-id="${CSS.escape(pv.pointId)}"]`,
      );
      if (!cell) return;
      const { color, label } = ruleColor(rulesRef.current, pv.value);
      cell.style.backgroundColor = color;
      const valueEl = cell.querySelector<HTMLElement>("[data-role='value']");
      if (valueEl) valueEl.textContent = label;
      cell.style.opacity =
        pv.quality === "bad" || pv.quality === "comm_fail" ? "0.5" : "1";
    };

    items.forEach((s) => wsManager.subscribe(s.pointId, handler));
    return () => {
      items.forEach((s) => wsManager.unsubscribe(s.pointId, handler));
    };
  }, [items]);

  useEffect(() => {
    queueMicrotask(() => {
      containerRef.current?.setAttribute("data-chart-ready", "true");
    });
  }, []);

  if (items.length === 0) {
    return (
      <div
        data-chart-ready="true"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: 12,
        }}
      >
        Add equipment items
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 4,
        padding: 4,
        overflow: "auto",
      }}
    >
      {items.map((s) => (
        <div
          key={s.slotId}
          data-point-id={s.pointId}
          title={s.tagname ?? s.label ?? s.pointId}
          style={{
            backgroundColor: "var(--io-surface-muted, #2A2A2E)",
            borderRadius: 4,
            padding: 6,
            fontSize: 11,
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minHeight: 48,
          }}
        >
          <div style={{ fontWeight: 600 }}>{slotLabel(s)}</div>
          <div data-role="value" style={{ fontSize: 10, opacity: 0.85 }}>
            —
          </div>
        </div>
      ))}
    </div>
  );
}
