import type { CSSProperties } from "react";

// Source: ui-audit/08-claim-b-plan.md Section 1.1
// Cat 6, Shared: all three modules use var(--io-accent) for primary and var(--io-border) for secondary borders
// Cat 6, List 3 Item 3: settingsStyles.ts named-variant pattern is the canonical base
// Cat 6, List 1 Item 6: modules ignore --io-btn-* tokens; named style objects is the correct approach

export const btnPrimary: CSSProperties = {
  padding: "8px 16px",
  background: "var(--io-accent)",
  color: "var(--io-accent-foreground)", // Cat 6, Deviations: canonical token; --io-text-on-accent is alias via A5
  border: "none",
  borderRadius: "var(--io-radius)", // Cat 6, Deviations: Settings + Designer IconBtn agree; Console integers corrected
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

export const btnSecondary: CSSProperties = {
  padding: "8px 16px",
  background: "transparent", // Cat 6, Deviations: BulkUpdate non-standard var(--io-surface-sunken) corrected
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600, // Cat 6, Deviations: align with primary for visual consistency at same type size
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
  background: "transparent",
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "12px",
  cursor: "pointer",
};

// Spread className={buttonBaseClass} alongside style={btnPrimary/Secondary/etc} to get
// :hover and :focus-visible rules from companion buttons.css
export const buttonBaseClass = "io-btn";
