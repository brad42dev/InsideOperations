import { useEffect, useRef } from "react";
import type { ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type Level = 1 | 2 | 3;

export default function Chart51HeaderDivider({ config }: RendererProps) {
  const text = (config.extras?.text as string | undefined) ?? "Section";
  const level = (config.extras?.level as Level | undefined) ?? 2;
  const color =
    (config.extras?.color as string | undefined) ?? "var(--io-text)";
  const align =
    (config.extras?.align as "left" | "center" | "right" | undefined) ?? "left";

  const fontSize = level === 1 ? 22 : level === 2 ? 18 : 14;
  const fontWeight = level === 1 ? 700 : 600;

  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    queueMicrotask(() => {
      wrapperRef.current?.setAttribute("data-chart-ready", "true");
    });
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{
        flex: 1,
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: align,
        borderBottom: "1px solid var(--io-border)",
      }}
    >
      <div style={{ fontSize, fontWeight, color }}>{text}</div>
    </div>
  );
}
