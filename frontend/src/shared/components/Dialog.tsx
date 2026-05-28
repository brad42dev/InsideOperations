import * as Radix from "@radix-ui/react-dialog";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  width = 480,
  footer,
}: DialogProps) {
  // When no description is provided: explicitly pass aria-describedby={undefined} so
  // Radix suppresses its "missing Description" DevTools warning.
  // When description IS provided: omit the prop so Radix auto-wires aria-describedby
  // from the rendered <Radix.Description> element via its internal context.
  const describedByProp =
    description === undefined
      ? ({ "aria-describedby": undefined } as { "aria-describedby"?: string })
      : {};

  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <Radix.Portal>
        <Radix.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-modal-backdrop)",
            zIndex: 1000, // var(--io-z-modal)
          }}
        />
        <Radix.Content
          {...describedByProp}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius-lg)",
            padding: "24px",
            width,
            maxWidth: "calc(100vw - 32px)",
            zIndex: 1001, // calc(var(--io-z-modal) + 1)
          }}
        >
          <Radix.Title
            style={{
              margin: "0 0 8px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            {title}
          </Radix.Title>
          {description !== undefined && (
            <Radix.Description
              style={{
                margin: "0 0 16px",
                fontSize: "13px",
                color: "var(--io-text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {description}
            </Radix.Description>
          )}
          {children}
          {footer !== undefined && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
                marginTop: "24px",
              }}
            >
              {footer}
            </div>
          )}
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}
