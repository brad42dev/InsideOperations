import { useIOClipboardStore } from "./clipboardStore";
import type { IOClipboardPayload } from "./types";

function summarize(p: IOClipboardPayload | null): string {
  if (!p) return "empty";
  const c = p.contents;
  if (c.nodes?.length) return `${c.nodes.length} shape(s)`;
  if (c.points?.length) return `${c.points.length} point(s)`;
  if (c.paneConfigs?.length) return `${c.paneConfigs.length} pane(s)`;
  if (c.tableRows?.length) return `${c.tableRows.length} row(s)`;
  if (c.alarms?.length) return `${c.alarms.length} alarm(s)`;
  return c.textRepresentation ? "text" : "data";
}

export function ClipboardStatusIndicator() {
  const current = useIOClipboardStore((s) => s.current);
  const previous = useIOClipboardStore((s) => s.previous);

  const curLabel = summarize(current);
  const prevLabel = summarize(previous);
  const isEmpty = !current && !previous;

  return (
    <div
      className="io-clipboard-status"
      title={`Current: ${curLabel}\nPrevious: ${prevLabel}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        color: isEmpty ? "var(--io-text-disabled)" : "var(--io-text-muted)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        padding: "4px 8px",
        fontFamily: "var(--io-font-mono, monospace)",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ opacity: 0.5 }}>CB</span>
      <span
        data-slot="current"
        style={{ color: current ? "var(--io-text-secondary)" : undefined }}
      >
        {curLabel}
      </span>
      <span style={{ opacity: 0.3 }}>|</span>
      <span
        data-slot="previous"
        style={{ color: previous ? "var(--io-text-secondary)" : undefined }}
      >
        {prevLabel}
      </span>
    </div>
  );
}
