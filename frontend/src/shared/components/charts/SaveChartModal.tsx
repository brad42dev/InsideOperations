import { useState } from "react";

interface SaveChartModalProps {
  /** Pre-fill the name field (e.g. when re-saving an existing chart) */
  initialName?: string;
  initialDescription?: string;
  /** When true the confirm button reads "Save and Publish" instead of "Save" */
  publish?: boolean;
  onConfirm: (name: string, description: string) => void;
  onCancel: () => void;
}

export default function SaveChartModal({
  initialName = "",
  initialDescription = "",
  publish = false,
  onConfirm,
  onCancel,
}: SaveChartModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && name.trim())
      onConfirm(name.trim(), description.trim());
    if (e.key === "Escape") onCancel();
  }

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: 4,
    color: "var(--io-text)",
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: 8,
          padding: "20px 24px",
          minWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--io-text)" }}>
          {publish ? "Save and Publish Chart" : "Save Chart"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              fontWeight: 500,
            }}
          >
            Name
          </label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Chart name"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              fontWeight: 500,
            }}
          >
            Description <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancel();
            }}
            placeholder="Brief description of this chart"
            rows={3}
            style={{
              ...inputStyle,
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>

        {publish && (
          <div
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              background: "var(--io-surface-elevated)",
              borderRadius: 4,
              padding: "6px 10px",
              lineHeight: 1.5,
            }}
          >
            Publishing makes this chart visible to all users in the Charts
            palette.
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "5px 14px",
              background: "transparent",
              border: "1px solid var(--io-border)",
              borderRadius: 4,
              color: "var(--io-text-muted)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (name.trim()) onConfirm(name.trim(), description.trim());
            }}
            disabled={!name.trim()}
            style={{
              padding: "5px 14px",
              background: "var(--io-accent)",
              border: "none",
              borderRadius: 4,
              color: "#fff",
              fontSize: 12,
              cursor: name.trim() ? "pointer" : "not-allowed",
              opacity: name.trim() ? 1 : 0.5,
            }}
          >
            {publish ? "Save and Publish" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
