import React from "react";

interface SettingsPageLayoutProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  maxWidth?: number;
  /** 'form' = 960px (default), 'list' = 1200px */
  variant?: "form" | "list";
  children: React.ReactNode;
}

export default function SettingsPageLayout({
  title,
  description,
  action,
  maxWidth,
  variant = "form",
  children,
}: SettingsPageLayoutProps) {
  const resolvedMax = maxWidth ?? (variant === "list" ? 1200 : 960);
  return (
    <div style={{ maxWidth: resolvedMax, marginRight: "auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h2
            style={{
              margin: "0 0 4px",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            {title}
          </h2>
          {description && (
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "var(--io-text-muted)",
              }}
            >
              {description}
            </p>
          )}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
      {children}
    </div>
  );
}
