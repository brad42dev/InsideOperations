import { Dialog } from "../../../shared/components/Dialog";

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
    <Dialog
      open={true}
      onOpenChange={(o) => !o && onCancel()}
      title="Unsaved Changes"
      description={
        <>
          Save changes to{" "}
          <strong style={{ color: "var(--io-text-primary)" }}>
            &ldquo;{graphicName}&rdquo;
          </strong>
          ?
        </>
      }
      width={380}
      footer={
        <>
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
            {isSaving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      {null}
    </Dialog>
  );
}
