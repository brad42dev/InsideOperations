/**
 * TabClosePrompt.tsx
 *
 * Small modal dialog shown when closing a modified tab.
 * Presents Save / Discard / Cancel options.
 */

interface TabClosePromptProps {
  graphicName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function TabClosePrompt({
  graphicName,
  onSave,
  onDiscard,
  onCancel,
  isSaving = false,
}: TabClosePromptProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          padding: "20px 24px",
          maxWidth: 380,
          width: "90%",
          boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          Unsaved Changes
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--io-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Save changes to{" "}
          <strong style={{ color: "var(--io-text-primary)" }}>
            &ldquo;{graphicName}&rdquo;
          </strong>
          ?
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={isSaving}
            style={{
              padding: "7px 16px",
              background: "transparent",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-text-secondary)",
              fontSize: 13,
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            disabled={isSaving}
            style={{
              padding: "7px 16px",
              background: "transparent",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-text-secondary)",
              fontSize: 13,
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            style={{
              padding: "7px 16px",
              background: isSaving ? "var(--io-surface)" : "var(--io-accent)",
              border: "none",
              borderRadius: "var(--io-radius)",
              color: isSaving ? "var(--io-text-muted)" : "#09090b",
              fontSize: 13,
              fontWeight: 600,
              cursor: isSaving ? "not-allowed" : "pointer",
            }}
          >
            {isSaving ? "Saving\u2026" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
