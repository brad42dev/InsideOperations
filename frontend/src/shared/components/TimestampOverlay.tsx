export function formatExportTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface Props {
  timestamp: number;
}

export function TimestampOverlay({ timestamp }: Props) {
  const label = formatExportTimestamp(timestamp);
  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "6px 14px",
        background: "rgba(0,0,0,0.6)",
        color: "white",
        font: '600 18px ui-monospace, "SF Mono", "Cascadia Mono", monospace',
        borderRadius: 4,
        pointerEvents: "none",
        zIndex: 9999,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}
