import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useIOClipboardStore } from "./clipboardStore";

export default function ClipboardInspector() {
  const [open, setOpen] = useState(false);
  const current = useIOClipboardStore((s) => s.current);
  const previous = useIOClipboardStore((s) => s.previous);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 99999,
        width: 480,
        maxHeight: "80vh",
        overflowY: "auto",
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        fontFamily: "monospace",
        fontSize: 11,
        color: "var(--io-text-primary)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid var(--io-border)",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "inherit",
        }}
      >
        <span>Clipboard Inspector</span>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: "none",
            border: "none",
            color: "var(--io-text-muted)",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
            padding: "0 2px",
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <Slot label="Current" payload={current} />
        <Slot label="Previous" payload={previous} />
      </div>
    </div>,
    document.body,
  );
}

function Slot({ label, payload }: { label: string; payload: unknown }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--io-text-muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <pre
        style={{
          margin: 0,
          padding: "8px 10px",
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          fontSize: 10,
          lineHeight: 1.5,
          color: payload ? "var(--io-text-primary)" : "var(--io-text-muted)",
        }}
      >
        {payload ? JSON.stringify(payload, null, 2) : "(empty)"}
      </pre>
    </div>
  );
}
