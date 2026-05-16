import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

export interface SaveAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (opts: { name: string; label?: string }) => void;
  loading?: boolean;
  error?: string | null;
  defaultName?: string;
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

export function SaveAsDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  error,
  defaultName = "",
}: SaveAsDialogProps) {
  const [name, setName] = useState(defaultName);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setNotes("");
      setTouched(false);
    }
  }, [open, defaultName]);

  const nameEmpty = name.trim() === "";
  const showNameError = touched && nameEmpty;

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
              margin: "0 0 20px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Save As
          </Dialog.Title>
          <Dialog.Description style={{ display: "none" }}>
            Save a copy of this object with a new name.
          </Dialog.Description>
          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: "var(--io-text-secondary)",
                marginBottom: "6px",
              }}
            >
              Name
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Enter a name"
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "13px",
                background: "var(--io-surface-primary, var(--io-surface))",
                border: `1px solid ${showNameError ? "var(--io-danger)" : "var(--io-border)"}`,
                borderRadius: "var(--io-radius)",
                color: "var(--io-text-primary)",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            {showNameError && (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--io-danger)",
                  marginTop: "4px",
                  marginBottom: 0,
                }}
              >
                Name is required
              </p>
            )}
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: "var(--io-text-secondary)",
                marginBottom: "6px",
              }}
            >
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this version"
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
          </div>
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
              disabled={loading || nameEmpty}
              style={{
                padding: "8px 16px",
                background: "var(--io-accent)",
                color: "var(--io-text-on-accent)",
                border: "none",
                borderRadius: "var(--io-radius)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: loading || nameEmpty ? "not-allowed" : "pointer",
                opacity: loading || nameEmpty ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
              }}
              onClick={() => {
                setTouched(true);
                if (!nameEmpty) {
                  onConfirm({
                    name: name.trim(),
                    label: notes.trim() || undefined,
                  });
                }
              }}
            >
              {loading && <InlineSpinner />}
              Save As
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
