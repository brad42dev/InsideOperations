import * as Dialog from "@radix-ui/react-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: "danger" | "default";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "default",
}: ConfirmDialogProps) {
  const confirmStyle =
    variant === "danger"
      ? {
          padding: "8px 16px",
          background: "transparent",
          color: "var(--io-danger)",
          border: "1px solid var(--io-danger)",
          borderRadius: "var(--io-radius)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        }
      : {
          padding: "8px 16px",
          background: "var(--io-accent)",
          color: "var(--io-text-on-accent)",
          border: "none",
          borderRadius: "var(--io-radius)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        };

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
          role="alertdialog"
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
              margin: "0 0 24px",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {description}
          </Dialog.Description>
          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
            }}
          >
            <button
              style={{
                padding: "8px 16px",
                background: "transparent",
                color: "var(--io-text-secondary)",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                fontSize: "13px",
                cursor: "pointer",
              }}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </button>
            <button
              style={confirmStyle}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
