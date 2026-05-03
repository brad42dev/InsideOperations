// ---------------------------------------------------------------------------
// Chart 52 — Clock / Elapsed Timer
// "clock" mode: current time, optional IANA timezone, configurable format.
// "elapsed" mode: time since points[0] value (interpreted as epoch ms).
// Updates every second via setInterval.
//
// Note: requiresPoints=false hides the Points tab in the right panel, but
// elapsed mode needs a start-time point — that picker lives in the Options tab.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../../../hooks/useWebSocket";
import type { ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type Mode = "clock" | "elapsed";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatTime(ms: number, format: string, tz?: string): string {
  if (tz) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(ms));
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "00";
    return format
      .replace("HH", get("hour") === "24" ? "00" : get("hour"))
      .replace("mm", get("minute"))
      .replace("ss", get("second"))
      .replace("YYYY", get("year"))
      .replace("MM", get("month"))
      .replace("DD", get("day"));
  }
  const d = new Date(ms);
  return format
    .replace("HH", pad(d.getHours()))
    .replace("mm", pad(d.getMinutes()))
    .replace("ss", pad(d.getSeconds()))
    .replace("YYYY", String(d.getFullYear()))
    .replace("MM", pad(d.getMonth() + 1))
    .replace("DD", pad(d.getDate()));
}

function formatElapsed(ms: number): string {
  if (ms < 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export default function Chart52ClockTimer({ config }: RendererProps) {
  const mode = (config.extras?.mode as Mode | undefined) ?? "clock";
  const format = (config.extras?.format as string | undefined) ?? "HH:mm:ss";
  const tz = config.extras?.timezone as string | undefined;

  const startPointId =
    mode === "elapsed" ? config.points[0]?.pointId : undefined;
  const { values } = useWebSocket(startPointId ? [startPointId] : []);
  const startMs = startPointId ? values.get(startPointId)?.value : undefined;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    queueMicrotask(() => {
      wrapperRef.current?.setAttribute("data-chart-ready", "true");
    });
  }, []);

  const display = (() => {
    if (mode === "clock") return formatTime(Date.now(), format, tz);
    if (typeof startMs !== "number" || !Number.isFinite(startMs))
      return "—:—:—";
    return formatElapsed(Date.now() - startMs);
  })();

  // tick referenced to ensure re-render fires each second
  void tick;

  return (
    <div
      ref={wrapperRef}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: 28,
        fontWeight: 600,
        color: "var(--io-text)",
        letterSpacing: 1,
      }}
    >
      {display}
    </div>
  );
}
