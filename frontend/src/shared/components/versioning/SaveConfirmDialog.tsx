import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

export interface SaveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (opts: { label?: string }) => void;
  loading?: boolean;
  error?: string | null;
  objectName?: string;
}

function InlineSpinner() {
  return (
    <>
      <style>{`@keyframes io-spin { to { transform: rotate(360deg); } }`}</style>
      <span
        style={{
          display: "inline-block",
          width: 14,
          height: 14,
          border: "2px solid currentColor",
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "io-spin 0.7s linear infinite",
          verticalAlign: "middle",
          marginRight: 6,
        }}
      />
    </>
  );
}

export function SaveConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  error,
  objectName,
}: SaveConfirmDialogProps) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) setNotes("");
  }, [open]);

  const title = objectName ? `Save changes to ${objectName}?` : "Save changes?";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-overlay, rgba(0,0,0,0.5))",
            zIndex: 100,
          }}
        />
        <Dialog.Content
          aria-modal="true"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--io-surface-secondary)",
            border: "1px solid var(--io-border)",
            borderRadius: "10px",
            padding: "24px",
            width: "420px",
            maxWidth: "calc(100vw - 32px)",
            zIndex: 101,
          }}
        >
          <Dialog.Title
            style={{
              margin: "0 0 8px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            {title}
          </Dialog.Title>
          <Dialog.Description
            style={{
              margin: "0 0 16px",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            This will create a new version snapshot.
          </Dialog.Description>
          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              width: "100%",
              minHeight: "60px",
              padding: "8px",
              fontSize: "13px",
              background: "var(--io-surface-primary, var(--io-surface))",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-text-primary)",
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          {error && (
            <p
              style={{
                fontSize: "12px",
                color: "var(--io-danger)",
                marginTop: "8px",
                marginBottom: 0,
              }}
            >
              {error}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
              marginTop: "20px",
            }}
          >
            <button
              disabled={loading}
              style={{
                padding: "8px 16px",
                background: "transparent",
                color: "var(--io-text-secondary)",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                fontSize: "13px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1,
              }}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              disabled={loading}
              style={{
                padding: "8px 16px",
                background: "var(--io-accent)",
                color: "var(--io-text-on-accent)",
                border: "none",
                borderRadius: "var(--io-radius)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.8 : 1,
                display: "flex",
                alignItems: "center",
              }}
              onClick={() => onConfirm({ label: notes.trim() || undefined })}
            >
              {loading && <InlineSpinner />}
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
