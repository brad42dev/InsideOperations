import type { CSSProperties } from "react";

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--io-surface-sunken)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
};

export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--io-text-secondary)",
  marginBottom: "5px",
};

export const btnPrimary: CSSProperties = {
  padding: "8px 16px",
  background: "var(--io-accent)",
  color: "var(--io-text-on-accent)",
  border: "none",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

export const btnSecondary: CSSProperties = {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  cursor: "pointer",
};

export const btnDanger: CSSProperties = {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--io-danger)",
  border: "1px solid var(--io-danger)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

export const btnSmall: CSSProperties = {
  padding: "4px 10px",
  fontSize: "12px",
  borderRadius: "var(--io-radius)",
  cursor: "pointer",
  border: "1px solid var(--io-border)",
  background: "transparent",
  color: "var(--io-text-secondary)",
};

export const cellStyle: CSSProperties = {
  padding: "12px 14px",
  fontSize: "13px",
  color: "var(--io-text-secondary)",
  verticalAlign: "middle",
};
