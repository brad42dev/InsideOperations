# Sanity Sweep — 02-comparison.md

**Produced:** 2026-05-27
**Inputs read:** ui-audit/02-comparison.md, ui-audit/03c-pre-reconciliation.md

---

## Section 1 — Additional Discrepancies

Searched 02-comparison.md for each of the three tokens. Findings per token:

**`--io-surface-sunken`**
- Cat 5, Deviations, Designer: "equipment tiles use `var(--io-surface-sunken)` (registered: index.css:26) vs `var(--io-surface-elevated)` for other tile types — real inconsistency in surface-tier choice"
- Cat 7, Visual Properties, Designer (PointPickerModal entry): "`var(--io-surface-sunken)` bg" — used as a valid token, no qualification
- Cat 10, Visual Properties, Designer: "Container: `background: var(--io-surface-sunken)` (outside canvas bounds)" — used as a valid token
- Reconciliation log entry 17 confirms: "no hedged language about `--io-surface-sunken` was present in the comparison file"
- **No flags.** Token is correctly treated as registered throughout. The "(registered: index.css:26)" annotation in Cat 5 explicitly states its status.

**`--io-accent-subtle`**
- Cat 5, Visual Properties, Settings: "active: `var(--io-accent-subtle)` bg + `var(--io-accent)` text/color" — used as a valid token
- Cat 5, Shared Infrastructure, Deviations: "instead of `var(--io-accent-subtle)` (teal, index.css:42)" — cited with line number, treated as registered
- Reconciliation log entry 18 confirms: hedged claims about this token were only in 01-designer.md; 02-comparison.md did not have hedged language to remove
- **No flags.** Token is correctly treated as registered. The "(teal, index.css:42)" citation in the shared infrastructure section explicitly documents its registration.

**`--io-border-subtle`**
- Cat 1, Visual Properties Applied, Settings: "~15 token references including `--io-border-subtle`, `--io-success`, `--io-status-fg`" — listed as an active token reference with no qualification
- Reconciliation log entry 19 confirms: "appears in Cat 1 Visual Properties (Settings) already treated as a valid token reference. No hedged language present."
- **No flags.** Token is correctly treated as registered.

**Check 1 result: no issues.** All three tokens appear in 02-comparison.md with language that treats them as registered. No hedged language, no "may or may not," no "requires verification," no assertion that the token is undefined or unregistered.

---

## Section 2 — Shared Infrastructure Structure

Examined the structural approach in Category 5, Category 8, and Category 10.

**Category 5:** After the main four-column table, a `### Shared Infrastructure — Category 5` sub-header introduces a standalone two-column table for selection.css + MarqueeLayer.tsx.

**Category 8:** After the main four-column table, a `### Shared Infrastructure — Category 8` sub-header introduces two standalone two-column tables (alarmFlash.css, then operationalState.css).

**Category 10:** After the main four-column table, a `### Shared Infrastructure — Category 10` sub-header introduces four standalone two-column tables (selection.css + MarqueeLayer.tsx, alarmFlash.css, operationalState.css, lod.css).

**Structure in all three:** Dedicated `### Shared Infrastructure — Category N` sub-section beneath the main module table, containing one or more standalone two-column tables (Field | value). Shared infrastructure is not added as a column or row within the main four-column module table.

**Check 2 result: no issues.** All three categories use identical structural approach. No inconsistency.

---

## Section 3 — operationalState.css Framing

**Cat 8 Shared Infrastructure entry (primary):**
- Deviations row: "All colors hardcoded hex with `!important` overrides. **Documented exception — intentional design, not a gap to close:** `!important` is required to override SVG attribute-level fill/stroke set in authored symbol geometry. ISA-101 prescribes specific operational state colors that intentionally differ from project tokens (e.g., `#047857` emerald-700 running vs `--io-alarm-normal: #22c55e` green-500 — different by standard; `#dc2626` fault vs `--io-alarm-urgent: #ef4444` — physically distinct semantic, different value by design). This file is intentionally non-token-driven for ISA-101 compliance."
- Notes row: "The hardcoded ISA-101 colors with `!important` are the correct and intentional implementation. Do not treat as a gap to close in the recommendations phase."

**Cat 10 Shared Infrastructure entry (secondary cross-reference):**
- Deviations row: "**Documented exception — intentional design.** Hardcoded ISA-101 colors with `!important` are required and correct. Do not treat as a gap to close. Full entry in Category 8 Shared Infrastructure."

**Check 3 result: no issues.** The ISA-101 standard and intentional-design framing is preserved in both locations. The explicit "Do not treat as a gap to close" instruction appears in both the primary entry (Category 8) and the cross-reference (Category 10). The language does not read as a deviation, gap, or inconsistency.

---

## Section 4 — Reconciliation Log Meta Entry

The Reconciliation Log section is present at the bottom of 02-comparison.md under the heading `## Reconciliation Log`. Within it, under the `### Meta` sub-header, entry 27 reads:

> **Per-module audit files not updated**: 01-console.md, 01-designer.md, and 01-settings.md retain their original (some incorrect) content. 02-comparison.md is the authoritative source post-reconciliation. All corrections in this log apply to 02-comparison.md only.

This entry is present. It names all three per-module files explicitly, states they were not updated, names 02-comparison.md as the authoritative source, and scopes all corrections to 02-comparison.md only.

**Check 4 result: no issues.** Meta entry exists with the required content.

---

## Overall Status

**clear-to-proceed**
