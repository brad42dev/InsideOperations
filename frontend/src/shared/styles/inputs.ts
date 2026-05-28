import type { CSSProperties } from "react";

// Source: ui-audit/08-claim-b-plan.md Section 1.2
// Cat 7, Shared: all three modules use border:1px solid var(--io-border) and outline:none
// Cat 7, List 3 Item 1: settingsStyles.ts inputStyle is the canonical base
// 04-recommendations Cat 7: standard input object with corrected token references

// NOTE: DesignerRightPanel compact inputs (padding:4px 7px, fontSize:12) are intentionally
// excluded from migration — inspector panel inputs where vertical space is at a premium.
// This shared inputStyle targets form inputs in modals, settings pages, and search boxes only.

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--io-surface-sunken)", // Cat 7, Deviations: deepest inset surface; --io-input-bg is alias
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)", // Cat 7, Deviations: Settings canonical token; BulkUpdate "6px" string corrected
  color: "var(--io-text-primary)", // Cat 7, Deviations: canonical token
  fontSize: "13px",
  boxSizing: "border-box", // Cat 7, Settings: prevents width overflow; not always set in Console/Designer
  // No outline:none — use inputClassName + inputs.css for an accessible :focus-visible ring
};

// Spread className={inputClassName} to get the :focus-visible rule from companion inputs.css
export const inputClassName = "io-input";
