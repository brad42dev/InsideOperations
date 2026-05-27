# Work Unit Log: workstream-2c-shell-drift

read-ui-audit

Started: 2026-05-27T07:27:39+00:00
Session: 6e271c20-7077-46a5-b871-1f4ad3b57324

---


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx` (83→93 chars)

_2026-05-27T07:28:39+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (40→40 chars)

_2026-05-27T07:28:44+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (608→777 chars)

_2026-05-27T07:28:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (339→315 chars)

_2026-05-27T07:29:23+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/06-claim-a-plan.md` (1877→1690 chars)

_2026-05-27T07:29:45+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/06-claim-a-plan.md` (463→551 chars)

_2026-05-27T07:29:53+00:00_


## #PROMPT

_2026-05-27T07:29:59+00:00_

```
~initprompt~ workstream-2c-shell-drift

Read ui-audit/06-claim-a-plan.md section one category (b) for the list of shell drift items. Read ui-audit/06b-claim-a-tokens-checkin.md to confirm token work is clear. Read ui-audit/05-claim-c-deferral.md to confirm exclusions.

Goal: fix the shell drift items in the order recorded in the plan. Each fix should reference tokens added in 2b rather than introducing new hardcoded values.

For each drift item in order:
1. State which item is being addressed and reference the plan entry.
2. Open the affected files and apply the fix. Use existing tokens. Do not refactor unrelated code, do not change behavior beyond visual consistency, do not modify canvas-layer files per the Claim C deferral.
3. If a fix has multi-module implications flagged in section two of the plan, and the implications have not been resolved by user review, stop and ask before applying. Do not unilaterally make decisions that affect the future eight-module rebuild.
4. Verify visually if possible; otherwise verify the code reads as expected.

If a drift item in the plan turns out not to be a real drift (e.g. the comparison file's claim was wrong, or the drift was fixed by some other change since the audit), note the discrepancy and skip it.

Update ui-audit/06-claim-a-plan.md by marking each completed drift item with a status flag and the date.

When done print: count of drift items addressed, count skipped with reasons, count blocked by multi-module implications awaiting user review, and the file path of the updated plan. Stop.
```


## #ASSISTANT

Reading the three reference files in parallel.


## #ASSISTANT

Tokens confirmed clear, exclusions noted (no canvas-layer files). Reading the two affected files now.


## #BASH
_Find background token usage in DesignerLeftPalette_

```bash
grep -n 'background\|io-surface' /home/io/io-dev/io/frontend/src/designer/DesignerLeftPalette.tsx | head -30
```


## #BASH
_Find nav item active styles and letter spacing in Settings_

```bash
grep -n 'borderLeft\|paddingLeft\|letterSpacing\|navItem\|activeItem\|navGroup\|sectionLabel\|active.*nav\|nav.*active' /home/io/io-dev/io/frontend/src/settings/index.tsx | head -40
```


## #BASH
_Locate actual file paths for designer palette and settings_

```bash
find /home/io/io-dev/io/frontend/src -name "DesignerLeftPalette*" -o -name "DesignerPalette*" 2>/dev/null; find /home/io/io-dev/io/frontend/src -path "*/settings/index*" -o -path "*/settings/Settings*" 2>/dev/null | head -10
```


## #BASH
_Find background token in DesignerLeftPalette_

```bash
grep -n 'background\|io-surface' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | head -20
```


## #BASH
_Find nav styles in Settings index_

```bash
grep -n 'borderLeft\|paddingLeft\|letterSpacing\|isActive\|active\|navGroup\|sectionLabel' /home/io/io-dev/io/frontend/src/pages/settings/index.tsx | head -40
```


## #BASH
_Find surface token references in DesignerLeftPalette_

```bash
grep -n 'io-surface\b\|background.*surface\|surface.*background' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | head -20
```


## #ASSISTANT

That `var(--io-surface)` at line 245 is a Dialog.Content, not the palette panel. Let me find the actual panel container.


## #BASH
_Find palette container with background and width_

```bash
grep -n 'background\|aside\|palette\|panel\|sidebar\|width.*220\|io-sidebar' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | head -30
```


## #BASH
_Find exact --io-surface (bare) references in DesignerLeftPalette_

```bash
grep -n 'background\|io-surface\|width\|border' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | grep -E '(surface[^-]|surface-secondary|surface-primary|surface\b)' | head -20
```


## #ASSISTANT

Found both targets. Applying all three changes now.

**B1** — `DesignerLeftPalette.tsx:2436`: `var(--io-surface)` → `var(--io-surface-secondary)`


## #ASSISTANT

**B2 + B4** — both in `Settings/index.tsx`. Applying letterSpacing fix first, then the active nav border.


## #ASSISTANT

Diagnostic is in an unrelated file — ignore it. Now applying B2.


## #ASSISTANT

Wait — the inactive case has `padding: "7px 10px"` (left: 10px) plus a transparent 2px border = 12px from edge, but active has padding 8px + border 2px = 10px. Text positions don't align. Fixing to always-reserve the 2px with consistent padding.


## #ASSISTANT

Good. Now verifying all three changes read correctly.


## #BASH
_Verify B1 change_

```bash
grep -n 'background.*surface\|letterSpacing\|borderLeft\|padding.*7px' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | grep -E '(2436|surface-secondary)'
```


## #BASH
_Verify B2 and B4 changes_

```bash
grep -n 'letterSpacing\|borderLeft\|padding.*7px' /home/io/io-dev/io/frontend/src/pages/settings/index.tsx | head -10
```


## #ASSISTANT

All three changes verified. Now updating the plan with completion status.


## #ASSISTANT

Also updating Pass 4 in Section 3 to mark the items done.


## #TURN_END

_2026-05-27T07:30:00+00:00_

---


## #PROMPT

_2026-05-27T07:35:00+00:00_

```
You are performing a DEEP verification review of a Claude Code work unit.

Your job is to compare what was asked (the initial prompt and any work-unit
summary) against what was actually built (the diff and the surrounding code).

Be skeptical and direct. Look for:
- The diff does something different from what was asked
- The diff regresses previously working behavior
- The diff expands scope beyond the prompt
- The diff has integration concerns with surrounding code that aren't addressed
- The diff appears to invert architectural decisions (e.g., the prompt asked
  to move from X to Y, but the diff actually reinforces X)

Output format (markdown):

## Summary
One paragraph: does the diff appear to match intent, or are there concerns?

## Concerns
If concerns exist, list them as numbered items with:
- What the concern is
- Specifically where in the code (file and line)
- Why this might be a divergence from intent

If no concerns, write "No concerns identified."

## Verification Notes
Anything else useful to know about what was built.

DO NOT include preamble. Start directly with "## Summary".
DO NOT speculate about things outside the diff. Stay grounded in what's there.

WORK UNIT LOG:
---
# Work Unit Log: workstream-2c-shell-drift

read-ui-audit

Started: 2026-05-27T07:27:39+00:00
Session: 6e271c20-7077-46a5-b871-1f4ad3b57324

---


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx` (83→93 chars)

_2026-05-27T07:28:39+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (40→40 chars)

_2026-05-27T07:28:44+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (608→777 chars)

_2026-05-27T07:28:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (339→315 chars)

_2026-05-27T07:29:23+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/06-claim-a-plan.md` (1877→1690 chars)

_2026-05-27T07:29:45+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/06-claim-a-plan.md` (463→551 chars)

_2026-05-27T07:29:53+00:00_


## #PROMPT

_2026-05-27T07:29:59+00:00_

```
~initprompt~ workstream-2c-shell-drift

Read ui-audit/06-claim-a-plan.md section one category (b) for the list of shell drift items. Read ui-audit/06b-claim-a-tokens-checkin.md to confirm token work is clear. Read ui-audit/05-claim-c-deferral.md to confirm exclusions.

Goal: fix the shell drift items in the order recorded in the plan. Each fix should reference tokens added in 2b rather than introducing new hardcoded values.

For each drift item in order:
1. State which item is being addressed and reference the plan entry.
2. Open the affected files and apply the fix. Use existing tokens. Do not refactor unrelated code, do not change behavior beyond visual consistency, do not modify canvas-layer files per the Claim C deferral.
3. If a fix has multi-module implications flagged in section two of the plan, and the implications have not been resolved by user review, stop and ask before applying. Do not unilaterally make decisions that affect the future eight-module rebuild.
4. Verify visually if possible; otherwise verify the code reads as expected.

If a drift item in the plan turns out not to be a real drift (e.g. the comparison file's claim was wrong, or the drift was fixed by some other change since the audit), note the discrepancy and skip it.

Update ui-audit/06-claim-a-plan.md by marking each completed drift item with a status flag and the date.

When done print: count of drift items addressed, count skipped with reasons, count blocked by multi-module implications awaiting user review, and the file path of the updated plan. Stop.
```


## #ASSISTANT

Reading the three reference files in parallel.


## #ASSISTANT

Tokens confirmed clear, exclusions noted (no canvas-layer files). Reading the two affected files now.


## #BASH
_Find background token usage in DesignerLeftPalette_

```bash
grep -n 'background\|io-surface' /home/io/io-dev/io/frontend/src/designer/DesignerLeftPalette.tsx | head -30
```


## #BASH
_Find nav item active styles and letter spacing in Settings_

```bash
grep -n 'borderLeft\|paddingLeft\|letterSpacing\|navItem\|activeItem\|navGroup\|sectionLabel\|active.*nav\|nav.*active' /home/io/io-dev/io/frontend/src/settings/index.tsx | head -40
```


## #BASH
_Locate actual file paths for designer palette and settings_

```bash
find /home/io/io-dev/io/frontend/src -name "DesignerLeftPalette*" -o -name "DesignerPalette*" 2>/dev/null; find /home/io/io-dev/io/frontend/src -path "*/settings/index*" -o -path "*/settings/Settings*" 2>/dev/null | head -10
```


## #BASH
_Find background token in DesignerLeftPalette_

```bash
grep -n 'background\|io-surface' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | head -20
```


## #BASH
_Find nav styles in Settings index_

```bash
grep -n 'borderLeft\|paddingLeft\|letterSpacing\|isActive\|active\|navGroup\|sectionLabel' /home/io/io-dev/io/frontend/src/pages/settings/index.tsx | head -40
```


## #BASH
_Find surface token references in DesignerLeftPalette_

```bash
grep -n 'io-surface\b\|background.*surface\|surface.*background' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | head -20
```


## #ASSISTANT

That `var(--io-surface)` at line 245 is a Dialog.Content, not the palette panel. Let me find the actual panel container.


## #BASH
_Find palette container with background and width_

```bash
grep -n 'background\|aside\|palette\|panel\|sidebar\|width.*220\|io-sidebar' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | head -30
```


## #BASH
_Find exact --io-surface (bare) references in DesignerLeftPalette_

```bash
grep -n 'background\|io-surface\|width\|border' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | grep -E '(surface[^-]|surface-secondary|surface-primary|surface\b)' | head -20
```


## #ASSISTANT

Found both targets. Applying all three changes now.

**B1** — `DesignerLeftPalette.tsx:2436`: `var(--io-surface)` → `var(--io-surface-secondary)`


## #ASSISTANT

**B2 + B4** — both in `Settings/index.tsx`. Applying letterSpacing fix first, then the active nav border.


## #ASSISTANT

Diagnostic is in an unrelated file — ignore it. Now applying B2.


## #ASSISTANT

Wait — the inactive case has `padding: "7px 10px"` (left: 10px) plus a transparent 2px border = 12px from edge, but active has padding 8px + border 2px = 10px. Text positions don't align. Fixing to always-reserve the 2px with consistent padding.


## #ASSISTANT

Good. Now verifying all three changes read correctly.


## #BASH
_Verify B1 change_

```bash
grep -n 'background.*surface\|letterSpacing\|borderLeft\|padding.*7px' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | grep -E '(2436|surface-secondary)'
```


## #BASH
_Verify B2 and B4 changes_

```bash
grep -n 'letterSpacing\|borderLeft\|padding.*7px' /home/io/io-dev/io/frontend/src/pages/settings/index.tsx | head -10
```


## #ASSISTANT

All three changes verified. Now updating the plan with completion status.


## #ASSISTANT

Also updating Pass 4 in Section 3 to mark the items done.


## #TURN_END

_2026-05-27T07:30:00+00:00_

---
---



DIFF OF CHANGES:
---
diff --git a/frontend/src/pages/designer/DesignerLeftPalette.tsx b/frontend/src/pages/designer/DesignerLeftPalette.tsx
index 32db8895..be82bccc 100644
--- a/frontend/src/pages/designer/DesignerLeftPalette.tsx
+++ b/frontend/src/pages/designer/DesignerLeftPalette.tsx
@@ -2433,7 +2433,7 @@ export default function DesignerLeftPalette({
     display: "flex",
     flexDirection: "column",
     overflow: "hidden",
-    background: "var(--io-surface)",
+    background: "var(--io-surface-secondary)",
     borderRight: "1px solid var(--io-border)",
   };
 
diff --git a/frontend/src/pages/settings/index.tsx b/frontend/src/pages/settings/index.tsx
index 74ed05bb..4be5dfd0 100644
--- a/frontend/src/pages/settings/index.tsx
+++ b/frontend/src/pages/settings/index.tsx
@@ -195,7 +195,7 @@ export default function SettingsShell() {
                 fontWeight: 600,
                 color: "var(--io-text-muted)",
                 textTransform: "uppercase",
-                letterSpacing: "0.08em",
+                letterSpacing: "0.06em",
                 padding: `${groupIndex === 0 ? "4px" : "12px"} 8px 6px`,
                 userSelect: "none",
               }}
@@ -208,7 +208,10 @@ export default function SettingsShell() {
                 to={item.path}
                 style={({ isActive }) => ({
                   display: "block",
-                  padding: "7px 10px",
+                  padding: "7px 10px 7px 8px",
+                  borderLeft: isActive
+                    ? "2px solid var(--io-accent)"
+                    : "2px solid transparent",
                   borderRadius: "var(--io-radius)",
                   marginBottom: "2px",
                   textDecoration: "none",
diff --git a/ui-audit/06-claim-a-plan.md b/ui-audit/06-claim-a-plan.md
index 2fa57076..657ffcc5 100644
--- a/ui-audit/06-claim-a-plan.md
+++ b/ui-audit/06-claim-a-plan.md
@@ -45,10 +45,10 @@ Changes to module component files in the sidebar and left-nav layer.
 
 | # | Change | File(s) | Description | Source |
 |---|---|---|---|---|
-| B1 | Designer left palette background | `frontend/src/designer/DesignerLeftPalette.tsx` | Change `background: var(--io-surface)` → `background: var(--io-surface-secondary)`. Console and Settings both use `var(--io-surface-secondary)` for their side panels; Designer is one surface tier lighter, creating a visible inconsistency at the module-boundary seam. | 02 Cat 5 Designer Deviations; 04 Cat 5 "Fix: Align Designer left palette background" |
-| B2 | Settings active nav item — left-border accent | `frontend/src/settings/index.tsx` (nav item active-state styles) | Add `borderLeft: '2px solid var(--io-accent)'` and reduce `paddingLeft` by 2px to maintain alignment. The AppShell implements this indicator; Settings omits it. Audit Cat 5 Notes: "Missing active left-border accent is the most visible deviation from AppShell nav pattern." | 02 Cat 5 Settings Deviations; 04 Cat 5 "Fix: Settings active nav item" |
-| B3 | Sidebar width — align code to decided value | Conditional on A14 decision | If 220px chosen (Option A): no code changes needed beyond A14 token update. If 240px chosen (Option B): update `ConsolePalette.tsx` (220px hardcode), `Settings/index.tsx` aside width (220px hardcode), and `DesignerLeftPalette.tsx` width (220px hardcode) to 240px. Change `var(--io-sidebar-width)` references if any exist, not raw integers. | 02 Cat 5 Console+Settings+Designer Deviations; 04 Cat 5 |
-| B4 | Settings nav group header — letterSpacing | `frontend/src/settings/index.tsx` (nav group label styles) | Change `letterSpacing` from 0.08em to 0.06em. Console palette section labels use 0.06em; Designer `SectionHeader` uses 0.06em; Settings nav group header drifts to 0.08em. Font size (11px), weight (600), and transform (uppercase) are already consistent. | 02 Cat 2 Settings Deviations; 02 Cat 5; 04 Cat 2 typography table; 04 Cat 5 "Fix: Section label typography" |
+| B1 | ✅ Done 2026-05-27 — Designer left palette background | `frontend/src/pages/designer/DesignerLeftPalette.tsx` | Changed `background: "var(--io-surface)"` → `"var(--io-surface-secondary)"` at `containerStyle` (line 2436). Console and Settings both use `var(--io-surface-secondary)` for their side panels; Designer is one surface tier lighter, creating a visible inconsistency at the module-boundary seam. | 02 Cat 5 Designer Deviations; 04 Cat 5 "Fix: Align Designer left palette background" |
+| B2 | ✅ Done 2026-05-27 — Settings active nav item — left-border accent | `frontend/src/pages/settings/index.tsx` (nav item active-state styles) | Added `borderLeft: isActive ? "2px solid var(--io-accent)" : "2px solid transparent"` and set uniform `padding: "7px 10px 7px 8px"` (left padding reduced from 10px to 8px; transparent border reserves the 2px on inactive items so text stays at 10px from edge in both states). | 02 Cat 5 Settings Deviations; 04 Cat 5 "Fix: Settings active nav item" |
+| B3 | ✅ Done 2026-05-27 — Sidebar width — 0 file changes | n/a — A14 decided 220px; all module hardcodes already match | No code changes needed. Token `--io-sidebar-width: 220px` is consistent with all hardcodes in Console, Settings, and Designer. | 02 Cat 5 Console+Settings+Designer Deviations; 04 Cat 5 |
+| B4 | ✅ Done 2026-05-27 — Settings nav group header — letterSpacing | `frontend/src/pages/settings/index.tsx` (nav group label styles) | Changed `letterSpacing` from `"0.08em"` to `"0.06em"` (line 198). Matches Console palette section labels and Designer `SectionHeader`. | 02 Cat 2 Settings Deviations; 02 Cat 5; 04 Cat 2 typography table; 04 Cat 5 "Fix: Section label typography" |
 
 **Category B total: 4 changes (B3 expands to 3 additional file edits if 240px is chosen in A14; 0 file changes if 220px chosen)**
 
@@ -122,10 +122,10 @@ Resolve values, then add in a second `index.css` commit.
 
 Independent of each other; can be in one PR.
 
-15. **B1** — Designer palette background: `var(--io-surface)` → `var(--io-surface-secondary)` in `DesignerLeftPalette.tsx`.
-16. **B2** — Settings active nav indicator: add `borderLeft: '2px solid var(--io-accent)'` + padding adjustment in `Settings/index.tsx`.
-17. **B3** — Sidebar width code: **0 file changes** (220px decided in A14 — token update only, no module edits).
-18. **B4** — Settings nav group `letterSpacing`: 0.08em → 0.06em in `Settings/index.tsx`.
+15. ✅ **B1** — Designer palette background: `var(--io-surface)` → `var(--io-surface-secondary)` in `DesignerLeftPalette.tsx`. Done 2026-05-27.
+16. ✅ **B2** — Settings active nav indicator: added `borderLeft` (accent/transparent) + uniform `padding: "7px 10px 7px 8px"` in `Settings/index.tsx`. Done 2026-05-27.
+17. ✅ **B3** — Sidebar width code: **0 file changes** (220px decided in A14 — token update only, no module edits). Done 2026-05-27.
+18. ✅ **B4** — Settings nav group `letterSpacing`: 0.08em → 0.06em in `Settings/index.tsx`. Done 2026-05-27.
 
 ### Natural PR boundaries
 
---

FULL FILE CONTENTS (for surrounding-code analysis):
---

--- File: /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx ---
/**
 * DesignerLeftPalette.tsx
 *
 * Left sidebar palette. Content is mode-dependent:
 *  - Graphic mode: Equipment, Stencils, Display Elements, Widgets, Points
 *  - Dashboard mode: Widgets, Equipment, Stencils, Display Elements
 *  - Report mode: Widgets, Report Elements, Equipment, Stencils, Display Elements
 *
 * Layers belong in the right panel only (spec §15).
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";
import { useLibraryStore, useSceneStore } from "../../store/designer";
import type { DisplayElementType } from "../../shared/types/graphics";
import type { ChartTypeId } from "../../shared/components/charts/chart-config-types";
import { graphicsApi } from "../../api/graphics";
import PointsBrowserPanel from "../../shared/components/PointsBrowserPanel";
import { ShapeThumbnail } from "./components/ShapeThumbnail";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerLeftPaletteProps {
  collapsed: boolean;
  width: number;
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform 0.15s",
      }}
    >
      <path
        d="M4 2L8 6L4 10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        padding: "6px 10px",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--io-border)",
        color: "var(--io-text-muted)",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        cursor: "pointer",
        textAlign: "left",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--io-surface-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <IconChevron open={open} />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Resizable palette section — header + scrollable content + bottom drag handle
// ---------------------------------------------------------------------------

interface PaletteSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Controlled height of the scrollable content area in px. Omit for flexible. */
  height?: number;
  /** If true, fills remaining flex space instead of using a fixed height. */
  flexible?: boolean;
  onHeightChange?: (dy: number) => void;
  children: React.ReactNode;
}

function PaletteSection({
  title,
  open,
  onToggle,
  height,
  flexible = false,
  onHeightChange,
  children,
}: PaletteSectionProps) {
  const startY = useRef(0);
  const activeRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  const canResize = !flexible && !!onHeightChange;

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    activeRef.current = true;
    startY.current = e.clientY;
    setIsResizing(true);

    const onMove = (ev: MouseEvent) => {
      if (!activeRef.current) return;
      const dy = ev.clientY - startY.current;
      startY.current = ev.clientY;
      onHeightChange!(dy);
    };
    const onUp = () => {
      activeRef.current = false;
      setIsResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
        ...(flexible && open ? { flex: "1 1 0", minHeight: 80 } : {}),
      }}
    >
      <SectionHeader label={title} open={open} onToggle={onToggle} />
      {open && (
        <>
          <div
            style={{
              overflowY: "auto",
              overflowX: "hidden",
              ...(flexible ? { flex: 1 } : { height: height ?? "auto" }),
            }}
          >
            {children}
          </div>
          {canResize && (
            <div
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onMouseDown={handleResizeMouseDown}
              style={{
                height: 4,
                flexShrink: 0,
                cursor: "ns-resize",
                background: isResizing ? "var(--io-accent)" : "transparent",
                transition: "background 0.1s",
                borderBottom: "1px solid var(--io-border)",
                userSelect: "none",
              }}
              onMouseEnter={(e) => {
                if (!isResizing)
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--io-surface-elevated)";
              }}
              onMouseLeave={(e) => {
                if (!isResizing)
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// (SkeletonTile and SvgThumbnail removed — equipment section now uses category tiles)

// ---------------------------------------------------------------------------
// Delete confirmation dialog (Radix Dialog, no window.confirm)
// ---------------------------------------------------------------------------

function DeleteConfirmDialog({
  open,
  onOpenChange,
  label,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9998,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            padding: "20px 24px",
            width: 360,
            zIndex: 9999,
            fontSize: 13,
            color: "var(--io-text-primary)",
          }}
        >
          <Dialog.Title
            style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}
          >
            Delete &ldquo;{label}&rdquo;?
          </Dialog.Title>
          <Dialog.Description
            style={{
              fontSize: 12,
              color: "var(--io-text-muted)",
              marginBottom: 20,
            }}
          >
            This action cannot be undone.
          </Dialog.Description>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Dialog.Close asChild>
              <button
                style={{
                  padding: "6px 14px",
                  background: "var(--io-surface-elevated)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-primary)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              style={{
                padding: "6px 14px",
                background: "var(--io-danger, #ef4444)",
                border: "none",
                borderRadius: "var(--io-radius)",
                color: "#fff",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Display element types
// ---------------------------------------------------------------------------

const DISPLAY_ELEMENT_TYPES: Array<{
  type: DisplayElementType;
  label: string;
}> = [
  { type: "text_readout", label: "Text Readout" },
  { type: "text_readout_array", label: "Text Readout Array" },
  { type: "analog_bar", label: "Analog Bar" },
  { type: "fill_gauge", label: "Fill Gauge" },
  { type: "sparkline", label: "Sparkline" },
  { type: "alarm_indicator", label: "Alarm Indicator" },
  { type: "digital_status", label: "Digital Status" },
];

// Spec-accurate mini SVG previews for each display element type
function DisplayElementPreview({
  type,
  size,
}: {
  type: DisplayElementType;
  size: number;
}) {
  const s = size;
  switch (type) {
    case "text_readout_array":
      // Two stacked boxes to distinguish from single text_readout
      return (
        <svg
          width={s}
          height={Math.round(s * 0.7)}
          viewBox="0 0 60 30"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="0"
            y="0"
            width="60"
            height="13"
            rx="2"
            fill="#27272A"
            stroke="#3F3F46"
            strokeWidth="1"
          />
          <text
            x="30"
            y="9"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="8"
            fill="#A1A1AA"
          >
            123.4
          </text>
          <rect
            x="0"
            y="17"
            width="60"
            height="13"
            rx="2"
            fill="#27272A"
            stroke="#3F3F46"
            strokeWidth="1"
          />
          <text
            x="30"
            y="26"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="8"
            fill="#A1A1AA"
          >
            456.7
          </text>
        </svg>
      );
    case "text_readout":
      // Box with "123.4" value text
      return (
        <svg
          width={s}
          height={Math.round(s * 0.5)}
          viewBox="0 0 60 22"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="0"
            y="0"
            width="60"
            height="22"
            rx="2"
            fill="#27272A"
            stroke="#3F3F46"
            strokeWidth="1"
          />
          <text
            x="30"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="10"
            fill="#A1A1AA"
          >
            123.4
          </text>
          <text
            x="50"
            y="14"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize="8"
            fill="#71717A"
          >
            °F
          </text>
        </svg>
      );
    case "analog_bar":
      // Vertical bar with zones and pointer
      return (
        <svg
          width={Math.round(s * 0.45)}
          height={s}
          viewBox="0 0 20 46"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="2"
            y="0"
            width="14"
            height="46"
            fill="#27272A"
            stroke="#52525B"
            strokeWidth="0.5"
          />
          <rect x="3" y="1" width="12" height="7" fill="#5C3A3A" />
          <rect x="3" y="8" width="12" height="10" fill="#5C4A32" />
          <rect x="3" y="18" width="12" height="14" fill="#404048" />
          <rect x="3" y="32" width="12" height="7" fill="#32445C" />
          <rect x="3" y="39" width="12" height="6" fill="#2E3A5C" />
          <polygon points="16,21 22,24 16,27" fill="#A1A1AA" />
          <line
            x1="3"
            y1="24"
            x2="15"
            y2="24"
            stroke="#A1A1AA"
            strokeWidth="0.8"
          />
        </svg>
      );
    case "fill_gauge":
      // Vertical bar with fill
      return (
        <svg
          width={Math.round(s * 0.45)}
          height={s}
          viewBox="0 0 20 46"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="2"
            y="0"
            width="14"
            height="46"
            rx="1"
            fill="none"
            stroke="#52525B"
            strokeWidth="0.5"
          />
          <rect
            x="3"
            y="16"
            width="12"
            height="29"
            rx="0.5"
            fill="#475569"
            opacity="0.6"
          />
          <line
            x1="3"
            y1="16"
            x2="15"
            y2="16"
            stroke="#64748B"
            strokeWidth="0.8"
            strokeDasharray="3 2"
          />
        </svg>
      );
    case "sparkline":
      // Sparkline chart
      return (
        <svg
          width={s}
          height={Math.round(s * 0.4)}
          viewBox="0 0 60 16"
          style={{ pointerEvents: "none" }}
        >
          <rect x="0" y="0" width="60" height="16" rx="1" fill="#27272A" />
          <polyline
            points="3,12 10,9 17,11 24,6 31,8 38,4 45,9 52,7 59,10"
            fill="none"
            stroke="#A1A1AA"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      );
    case "alarm_indicator":
      // ISA-101 alarm shapes
      return (
        <svg
          width={s}
          height={Math.round(s * 0.6)}
          viewBox="0 0 52 24"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="1"
            y="3"
            width="16"
            height="12"
            rx="1.5"
            fill="none"
            stroke="#EF4444"
            strokeWidth="1.5"
          />
          <text
            x="9"
            y="11"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="7"
            fontWeight="600"
            fill="#EF4444"
          >
            1
          </text>
          <polygon
            points="27,2 37,18 17,18"
            fill="none"
            stroke="#F97316"
            strokeWidth="1.5"
          />
          <text
            x="27"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="7"
            fontWeight="600"
            fill="#F97316"
          >
            2
          </text>
          <ellipse
            cx="46"
            cy="12"
            rx="5"
            ry="4"
            fill="none"
            stroke="#06B6D4"
            strokeWidth="1.5"
          />
          <text
            x="46"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="7"
            fontWeight="600"
            fill="#06B6D4"
          >
            4
          </text>
        </svg>
      );
    case "digital_status":
      // Pill with RUN / STOP
      return (
        <svg
          width={s}
          height={Math.round(s * 0.55)}
          viewBox="0 0 56 24"
          style={{ pointerEvents: "none" }}
        >
          <rect x="1" y="5" width="24" height="14" rx="2" fill="#3F3F46" />
          <text
            x="13"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="8"
            fill="#A1A1AA"
          >
            OPEN
          </text>
          <rect x="29" y="5" width="26" height="14" rx="2" fill="#059669" />
          <text
            x="42"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="8"
            fill="#F9FAFB"
          >
            RUN
          </text>
        </svg>
      );
    default:
      return (
        <span
          style={{
            fontSize: Math.round(s * 0.4),
            color: "var(--io-text-muted)",
          }}
        >
          ⊞
        </span>
      );
  }
}

function DisplayElementTile({
  type,
  label,
  collapsed,
}: {
  type: DisplayElementType;
  label: string;
  collapsed: boolean;
}) {
  const [isFavorited, setIsFavorited] = useState(() => {
    try {
      const raw = localStorage.getItem("io:palette-favorites") ?? "{}";
      const favs = JSON.parse(raw) as Record<string, string[]>;
      return (favs["display-elements"] ?? []).includes(type);
    } catch {
      return false;
    }
  });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left-click drags; right-clicks go to the context menu
      if (e.button !== 0) return;
      e.preventDefault();
      const ghost = document.createElement("div");
      ghost.id = "io-canvas-drag-ghost";
      ghost.setAttribute("data-drag-ghost", "true");
      ghost.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:9999",
        "opacity:0.7",
        "padding:4px 8px",
        "background:var(--io-accent)",
        "color:#09090b",
        "border-radius:4px",
        "font-size:11px",
        "font-weight:600",
        "transform:translate(-50%,-50%)",
        `left:${e.clientX}px`,
        `top:${e.clientY}px`,
        "display:block",
        "visibility:visible",
      ].join(";");
      ghost.textContent = label;
      document.body.appendChild(ghost);

      const onMove = (ev: MouseEvent) => {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
        document.dispatchEvent(
          new CustomEvent("io:display-element-drag-move", {
            detail: { elementType: type, x: ev.clientX, y: ev.clientY },
          }),
        );
      };
      const onUp = (ev: MouseEvent) => {
        ghost.remove();
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.dispatchEvent(
          new CustomEvent("io:display-element-drop", {
            detail: { elementType: type, x: ev.clientX, y: ev.clientY },
          }),
        );
      };
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ghost.remove();
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseup", onUp, true);
          document.removeEventListener("keydown", onKeyDown, true);
        }
      };
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
      document.addEventListener("keydown", onKeyDown, true);
    },
    [type, label],
  );

  function handlePlaceAtCenter() {
    const canvasEl = document.querySelector('[data-designer-canvas="true"]');
    const rect = canvasEl?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    document.dispatchEvent(
      new CustomEvent("io:display-element-drop", {
        detail: { elementType: type, x: cx, y: cy },
      }),
    );
  }

  function handleToggleFavorite() {
    try {
      const raw = localStorage.getItem("io:palette-favorites") ?? "{}";
      const favs = JSON.parse(raw) as Record<string, string[]>;
      if (!favs["display-elements"]) favs["display-elements"] = [];
      if (isFavorited) {
        favs["display-elements"] = favs["display-elements"].filter(
          (t) => t !== type,
        );
        setIsFavorited(false);
      } else {
        if (!favs["display-elements"].includes(type)) {
          favs["display-elements"].push(type);
        }
        setIsFavorited(true);
      }
      localStorage.setItem("io:palette-favorites", JSON.stringify(favs));
    } catch {
      // localStorage may be blocked — silently ignore
    }
  }

  const { menuState, handleContextMenu, closeMenu } = useContextMenu();

  const displayElemMenuItems = [
    { label: "Place at Center", onClick: handlePlaceAtCenter },
    {
      label: isFavorited ? "Remove from Favorites" : "Add to Favorites",
      onClick: handleToggleFavorite,
    },
  ];

  if (collapsed) {
    return (
      <>
        <div
          onMouseDown={handleMouseDown}
          onContextMenu={handleContextMenu}
          title={label}
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            cursor: "grab",
            overflow: "hidden",
            userSelect: "none",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--io-accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--io-border)";
          }}
        >
          <DisplayElementPreview type={type} size={26} />
        </div>
        {menuState && (
          <ContextMenu
            x={menuState.x}
            y={menuState.y}
            items={displayElemMenuItems}
            onClose={closeMenu}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        title={label}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          width: 72,
          height: 64,
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          cursor: "grab",
          overflow: "hidden",
          userSelect: "none",
          padding: 4,
          textAlign: "center",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--io-accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--io-border)";
        }}
      >
        <DisplayElementPreview type={type} size={40} />
        <span
          style={{
            fontSize: 9,
            color: "var(--io-text-muted)",
            lineHeight: 1.2,
            textAlign: "center",
          }}
        >
          {label.length > 12 ? label.slice(0, 11) + "…" : label}
        </span>
      </div>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={displayElemMenuItems}
          onClose={closeMenu}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Equipment section
// ---------------------------------------------------------------------------

/** Equipment category tiles — one tile per equipment family. */
const EQUIPMENT_CATEGORIES: Array<{
  id: string;
  label: string;
  defaultId: string;
}> = [
  { id: "valves", label: "Valve", defaultId: "valve-gate" },
  { id: "pumps", label: "Pump", defaultId: "pump-centrifugal-opt1" },
  { id: "rotating", label: "Rotating", defaultId: "compressor-opt1" },
  {
    id: "heat-transfer",
    label: "Heat Transfer",
    defaultId: "heat-exchanger-shell-tube",
  },
  { id: "vessels", label: "Vessel", defaultId: "vessel-vertical-welded" },
  { id: "tanks", label: "Tank", defaultId: "tank-storage-cone-roof" },
  { id: "reactors", label: "Reactor", defaultId: "reactor-base" },
  {
    id: "columns",
    label: "Column",
    defaultId: "column-distillation-standard-plain",
  },
  { id: "filters", label: "Filter", defaultId: "filter-vacuum" },
  { id: "instrumentation", label: "Instrument", defaultId: "instrument-field" },
  { id: "mixers", label: "Mixer", defaultId: "mixer-agitator" },
];

interface EquipmentCategoryTileProps {
  id: string;
  label: string;
  defaultId: string;
  collapsed: boolean;
}

function EquipmentCategoryTile({
  id,
  label,
  defaultId,
  collapsed,
}: EquipmentCategoryTileProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();

      const ghost = document.createElement("div");
      ghost.id = "io-canvas-drag-ghost";
      ghost.setAttribute("data-drag-ghost", "true");
      ghost.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:9999",
        "opacity:0.85",
        "padding:4px 10px",
        "background:var(--io-accent)",
        "color:#09090b",
        "border-radius:4px",
        "font-size:11px",
        "font-weight:600",
        "white-space:nowrap",
        "transform:translate(-50%,-50%)",
        `left:${e.clientX}px`,
        `top:${e.clientY}px`,
      ].join(";");
      ghost.textContent = label;
      document.body.appendChild(ghost);

      const onMove = (ev: MouseEvent) => {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
      };

      const onUp = (ev: MouseEvent) => {
        ghost.remove();
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.dispatchEvent(
          new CustomEvent("io:category-drop", {
            detail: {
              categoryId: id,
              defaultShapeId: defaultId,
              x: ev.clientX,
              y: ev.clientY,
            },
          }),
        );
      };

      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ghost.remove();
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseup", onUp, true);
          document.removeEventListener("keydown", onKeyDown, true);
        }
      };

      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
      document.addEventListener("keydown", onKeyDown, true);
    },
    [id, label, defaultId],
  );

  if (collapsed) {
    return (
      <button
        onMouseDown={handleMouseDown}
        title={label}
        style={{
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--io-surface-sunken)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          cursor: "grab",
          padding: 2,
          overflow: "hidden",
        }}
      >
        <ShapeThumbnail shapeId={defaultId} size={28} />
      </button>
    );
  }

  return (
    <button
      onMouseDown={handleMouseDown}
      title={`Drag to place ${label}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        padding: "8px 4px",
        background: "var(--io-surface-sunken)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        cursor: "grab",
        width: "calc(50% - 4px)",
        transition: "border-color 0.1s, background 0.1s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--io-accent)";
        (e.currentTarget as HTMLElement).style.background =
          "color-mix(in srgb, var(--io-accent) 8%, var(--io-surface-sunken))";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--io-border)";
        (e.currentTarget as HTMLElement).style.background =
          "var(--io-surface-sunken)";
      }}
    >
      <div
        style={{
          width: 52,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <ShapeThumbnail shapeId={defaultId} size={44} />
      </div>
      <span
        style={{
          fontSize: 10,
          color: "var(--io-text-secondary)",
          textAlign: "center",
          lineHeight: 1.2,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </button>
  );
}

function EquipmentSection({ collapsed }: { collapsed: boolean }) {
  const loadIndex = useLibraryStore((s) => s.loadIndex);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  if (collapsed) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "8px 4px",
          alignItems: "center",
        }}
      >
        {EQUIPMENT_CATEGORIES.map((cat) => (
          <EquipmentCategoryTile key={cat.id} {...cat} collapsed />
        ))}
      </div>
    );
  }

  return (
    <div sty

--- File: /home/io/io-dev/io/frontend/src/pages/settings/index.tsx ---
import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/auth";

interface NavItem {
  path: string;
  label: string;
  permission?: string;
}

interface NavGroup {
  header: string;
  items: NavItem[];
}

// Nav structure: 7 groups, 18 items total.
// Temporary paths: "Users & Roles" → /settings/users (Phase 3 creates /settings/identity)
//                  "Archive & Backup" → /settings/archive (Phase 6 creates /settings/system)
const NAV_GROUPS: NavGroup[] = [
  {
    header: "Identity & Access",
    items: [
      {
        path: "/settings/identity",
        label: "Users & Roles",
        permission: "system:manage_users",
      },
    ],
  },
  {
    header: "Authentication",
    items: [
      {
        path: "/settings/auth-providers",
        label: "Auth Providers",
        permission: "auth:configure",
      },
      {
        path: "/settings/mfa",
        label: "MFA Policy",
        permission: "auth:configure",
      },
      {
        path: "/settings/scim",
        label: "SCIM Provisioning",
        permission: "auth:configure",
      },
    ],
  },
  {
    header: "Media",
    items: [
      {
        path: "/settings/camera-streams",
        label: "Camera Streams",
        permission: "video_streams:manage",
      },
    ],
  },
  {
    header: "Data Sources",
    items: [
      {
        path: "/settings/opc-sources",
        label: "OPC Sources",
        permission: "system:opc_config",
      },
      {
        path: "/settings/points",
        label: "Point Management",
        permission: "system:point_config",
      },
      {
        path: "/settings/expressions",
        label: "Expressions",
        permission: "system:expression_manage",
      },
      {
        path: "/settings/import",
        label: "Import & Streaming",
        permission: "system:import_connections",
      },
    ],
  },
  {
    header: "Notifications",
    items: [
      {
        path: "/settings/email",
        label: "Email",
        permission: "email:configure",
      },
      {
        path: "/settings/sms-providers",
        label: "SMS Providers",
        permission: "sms:configure",
      },
    ],
  },
  {
    header: "System",
    items: [
      {
        path: "/settings/system-health",
        label: "System Health",
        permission: "system:monitor",
      },
      {
        path: "/settings/system",
        label: "Archive & Backup",
        permission: "system:backup",
      },
      {
        path: "/settings/certificates",
        label: "Certificates",
        permission: "system:admin",
      },
    ],
  },
  {
    header: "Content & Export",
    items: [
      {
        path: "/settings/report-scheduling",
        label: "Report Scheduling",
        permission: "reports:schedule_manage",
      },
      {
        path: "/settings/export-presets",
        label: "Export Presets",
        permission: "system:admin",
      },
      {
        path: "/settings/my-exports",
        label: "My Exports",
      },
      {
        path: "/settings/bulk-update",
        label: "Bulk Update",
        permission: "system:bulk_update",
      },
      {
        path: "/settings/snapshots",
        label: "Change Snapshots",
        permission: "system:change_backup",
      },
      {
        path: "/settings/recognition",
        label: "Recognition",
        permission: "recognition:manage",
      },
    ],
  },
  {
    header: "About",
    items: [
      { path: "/settings/eula", label: "EULA" },
      { path: "/settings/about", label: "About" },
    ],
  },
];

function hasPermission(permissions: string[], permission?: string): boolean {
  if (!permission) return true;
  return permissions.includes("*") || permissions.includes(permission);
}

export default function SettingsShell() {
  const { user } = useAuthStore();
  const permissions = user?.permissions ?? [];

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      hasPermission(permissions, item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <aside
        style={{
          width: "220px",
          borderRight: "1px solid var(--io-border)",
          background: "var(--io-surface-secondary)",
          flexShrink: 0,
          padding: "8px",
          overflowY: "auto",
        }}
      >
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.header}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--io-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: `${groupIndex === 0 ? "4px" : "12px"} 8px 6px`,
                userSelect: "none",
              }}
            >
              {group.header}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: "block",
                  padding: "7px 10px 7px 8px",
                  borderLeft: isActive
                    ? "2px solid var(--io-accent)"
                    : "2px solid transparent",
                  borderRadius: "var(--io-radius)",
                  marginBottom: "2px",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? "var(--io-accent)"
                    : "var(--io-text-secondary)",
                  background: isActive
                    ? "var(--io-accent-subtle)"
                    : "transparent",
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        <Outlet />
      </div>
    </div>
  );
}

--- File: /home/io/io-dev/io/ui-audit/06-claim-a-plan.md ---
# Claim A Work Plan — App Shell Convergence

**Derived from:** `ui-audit/02-comparison.md` (post-reconciliation), `ui-audit/04-recommendations.md`, `ui-audit/05-claim-c-deferral.md`
**Scope:** `index.css` token registry, left nav (sidebar), top-bar styling. Excludes Claim B (shared style constants, shared components) and Claim C (canvas/work-surface containers, shared graphics CSS).
**Date:** 2026-05-27
**Status:** Token registry gaps in progress — see Section 1.1 for per-item status

---

## Section 1 — Scope: Concrete Changes Required

### 1.1 Category A — Token Registry Gaps

All changes are additions or value corrections to `index.css`. No existing tokens are deleted.

| # | Token | Status | Proposed Fix | Source |
|---|---|---|---|---|
| A1 | `--io-bg` | ✅ Done 2026-05-27 | `--io-bg: var(--io-surface-primary)` | 02 Cat 1 Console Deviations; 04 Cat 1 |
| A2 | `--io-text` | ✅ Done 2026-05-27 | `--io-text: var(--io-text-primary)` | 02 Cat 1 Console+Designer Deviations; 02 Cat 9 Console+Designer Deviations; 04 Cat 1 |
| A3 | `--io-surface-hover` | ✅ Done 2026-05-27 | `--io-surface-hover: var(--io-surface-elevated)` | 02 Cat 4 Designer Deviations; 04 Cat 1 |
| A4 | `--io-font-sans` | ✅ Done 2026-05-27 | `--io-font-sans: "InterVariable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif` — matched body selector font stack. Defined in `:root` only (static across themes, same pattern as `--io-font-mono`). | 02 Cat 1 Designer Deviations; 02 Cat 4 Designer Deviations; 04 Cat 1 |
| A5 | `--io-text-on-accent` | ✅ Done 2026-05-27 | `--io-text-on-accent: var(--io-accent-foreground)` | 02 Cat 1 Settings Deviations; 02 Cat 6 Settings Deviations; 04 Cat 1 |
| A6 | `--io-error` | ✅ Done 2026-05-27 | `--io-error: var(--io-danger)` | 02 Cat 10 Designer Deviations; 02 List 2 #7; 04 Cat 1 |
| A7 | `--io-surface-raised` | ✅ Done 2026-05-27 | `--io-surface-raised: var(--io-surface-elevated)` | 02 Cat 7 Designer Deviations; 02 List 2 #7 |
| A8 | `--io-accent-muted` | ⚠ Skipped — consumer fix preferred over new token | Only usage: `PromoteToShapeWizard.tsx:2168` — stepper progress bars, completed-step color, with fallback `#3b82f6` (info blue). No other wizard uses this token. `RecognitionWizard` uses hardcoded greens for completed steps; no shared pattern exists. User direction: change `PromoteToShapeWizard.tsx:2168` to use an existing token instead of defining a one-off `--io-accent-muted`. Candidate: `var(--io-accent-subtle)` (rgba(45,212,191,0.1)) — readable teal tint for a completed bar. **Action required in a consumer-file pass:** update `PromoteToShapeWizard.tsx:2168` from `"var(--io-accent-muted, #3b82f6)"` to `"var(--io-accent-subtle)"`. Do NOT define `--io-accent-muted` in index.css. | 02 List 2 #7 |
| A9 | `--io-overlay` | ✅ Done 2026-05-27 | `--io-overlay: var(--io-modal-backdrop)`. Pre-condition verified: `--io-modal-backdrop → --io-surface-overlay` chain is complete in all three themes. | 02 Cat 11 Settings Deviations; 02 List 2 #7 |
| A10 | `--io-accent-rgb` | ✅ Done 2026-05-27 | Added per-theme: dark=`45 212 191` (#2dd4bf), light=`13 148 136` (#0d9488), hphmi=`20 184 166` (#14b8a6). Comment added in dark theme pointing to light/hphmi values. | 02 List 2 #7 |
| A11 | `--io-alarm-inactive` | ✅ Done 2026-05-27 | `--io-alarm-inactive: #808080` — added to all three themes with identical value. | 04 Cat 8 actions; 05 Section 3.1 |
| A12 | `--io-text-inverse` | ⚠ Skipped — already defined; audit claim was incorrect | Token IS defined in all three theme blocks: dark=#09090b (line 34), light=#ffffff (line 235), hphmi=#0f172a (line 431). Plan entry "Not yet defined" was wrong. No action needed. | 04 Cat 10 actions; 05 Section 3.4 |
| A13 | `--io-z-modal` | ✅ Done 2026-05-27 | Updated per Option B decision: `--io-z-dropdown: 500` (was 200), `--io-z-modal: 1000` (was 300), `--io-z-toast: 2000` (was 700), `--io-z-visual-lock: 1500` (was 500), `--io-z-emergency: 3000` (was 800). Applied to all three theme blocks. Remaining Claim B item: `--io-z-command: 400` and `--io-z-kiosk-auth: 600` are unused in components (CommandPalette hardcodes 3000/3001); adopt tokens + reconcile in Claim B. | 04 Cat 11 actions; 04 Risk R1; 02 List 2 #11 |
| A14 | `--io-sidebar-width` | ✅ Done 2026-05-27 | Updated to 220px in all three theme blocks per Option A decision. No module code changes needed. | 02 Cat 5 Console+Settings+Designer Deviations; 04 Cat 5 |

**Category A total: 14 changes in `index.css`**

Items A1–A3, A5–A7, A9, A11, A12 can be executed unilaterally — target values are clear.
Items A4, A8 require a research step (read index.css root / grep Designer) before writing.
Items A10 requires confirming the dark-theme accent hex before writing.
Items A13, A14 require explicit user decisions before executing.

---

### 1.2 Category B — Shell Drift

Changes to module component files in the sidebar and left-nav layer.

| # | Change | File(s) | Description | Source |
|---|---|---|---|---|
| B1 | ✅ Done 2026-05-27 — Designer left palette background | `frontend/src/pages/designer/DesignerLeftPalette.tsx` | Changed `background: "var(--io-surface)"` → `"var(--io-surface-secondary)"` at `containerStyle` (line 2436). Console and Settings both use `var(--io-surface-secondary)` for their side panels; Designer is one surface tier lighter, creating a visible inconsistency at the module-boundary seam. | 02 Cat 5 Designer Deviations; 04 Cat 5 "Fix: Align Designer left palette background" |
| B2 | ✅ Done 2026-05-27 — Settings active nav item — left-border accent | `frontend/src/pages/settings/index.tsx` (nav item active-state styles) | Added `borderLeft: isActive ? "2px solid var(--io-accent)" : "2px solid transparent"` and set uniform `padding: "7px 10px 7px 8px"` (left padding reduced from 10px to 8px; transparent border reserves the 2px on inactive items so text stays at 10px from edge in both states). | 02 Cat 5 Settings Deviations; 04 Cat 5 "Fix: Settings active nav item" |
| B3 | ✅ Done 2026-05-27 — Sidebar width — 0 file changes | n/a — A14 decided 220px; all module hardcodes already match | No code changes needed. Token `--io-sidebar-width: 220px` is consistent with all hardcodes in Console, Settings, and Designer. | 02 Cat 5 Console+Settings+Designer Deviations; 04 Cat 5 |
| B4 | ✅ Done 2026-05-27 — Settings nav group header — letterSpacing | `frontend/src/pages/settings/index.tsx` (nav group label styles) | Changed `letterSpacing` from `"0.08em"` to `"0.06em"` (line 198). Matches Console palette section labels and Designer `SectionHeader`. | 02 Cat 2 Settings Deviations; 02 Cat 5; 04 Cat 2 typography table; 04 Cat 5 "Fix: Section label typography" |

**Category B total: 4 changes (B3 expands to 3 additional file edits if 240px is chosen in A14; 0 file changes if 220px chosen)**

---

## Section 2 — Multi-Module Implications

### Shell-layer changes (inherited by all 11 modules)

| Change | Scope | Flag for user review? | Reasoning |
|---|---|---|---|
| **A13 — `--io-z-modal` value** | Shell layer; all current and future modules that render dialogs | **Yes** | Every modal in all three modules currently uses z-index values between 1000 and 9999, with no code referencing the existing 300-value token. Choosing the z-index scale now sets a convention inherited by all 11 modules. Risk R1 from `04-recommendations.md`: a full z-index audit across all `zIndex` values in the frontend is recommended before setting definitive scale values, because uncoordinated layer ordering can cause dialogs to appear behind other dialogs or overlapping dropdowns in edge cases. The Claim B dialog work will migrate code to use these tokens; a partial or incorrect scale is harder to fix after migration than before. |
| **A14 — `--io-sidebar-width` decision** | Shell layer; all current and future modules with a side panel | **Yes** | The 8 future modules will be built to this width from day one. Retrofitting after the fact would require touching all 11 modules. The choice between 220px and 240px is a visual design question, not a technical one. 220px is the current practice; 240px is the AppShell reference value. Neither is obviously correct — which is why this needs an explicit decision, not a unilateral call. |
| **A11, A12 — new tokens** | Shell layer (index.css), consumed by Claim C | No | Purely additive. No effect on code that does not reference these tokens. Defined now so Claim C can reference them without revisiting the token layer. |
| **A1–A10 — alias tokens** | Shell layer; resolve broken references globally | No (individually clear) | Additive. Code referencing these undefined tokens will start rendering correctly once the token is defined. No new breakage is possible since undefined tokens already degrade to no-value or browser fallback. Exception: A4 (`--io-font-sans`) must be verified against the document root font-family to avoid introducing a font-stack inconsistency — the implementer must read the root selector before writing this value. |

### Single-module changes (do not affect convention inheritance)

| Change | Module | Flag for user review? | Reasoning |
|---|---|---|---|
| **B1 — Designer palette background** | Designer only | No | Changes one `background` token reference in one file to match what Console and Settings already do. The target value (`--io-surface-secondary`) is already registered and in use by both other modules. |
| **B2 — Settings active nav indicator** | Settings only | No | The AppShell pattern is unambiguous (`borderLeft: 2px solid var(--io-accent)` + padding adjustment). This aligns Settings to the established pattern. |
| **B3 — Sidebar width code changes** | 0–3 modules, conditional on A14 | Depends on A14 decision | The code changes themselves are mechanical once the width value is decided. No separate review needed beyond the A14 decision. |
| **B4 — Settings nav group typography** | Settings only | No | Changes `letterSpacing` from 0.08em to 0.06em in one location. Small typographic alignment to the value that Console and Designer already use. No functional impact. |

---

## Section 3 — Sequencing

Token registry work must precede shell drift work because some drift fixes reference tokens that do not yet exist (e.g., `--io-surface-secondary` and `--io-accent` ARE registered, so B1–B4 are not blocked — but as a general rule, any drift fix that adds a new token reference depends on that token existing in index.css first).

Within token work, independent gaps go first; research-gated or decision-gated items go second and third.

### Pass 1 — Unblocked aliases (no research, no decision needed)

All are `index.css` only. Can land in a single commit.

1. ✅ **A1** — `--io-bg: var(--io-surface-primary)` — Done 2026-05-27
2. ✅ **A2** — `--io-text: var(--io-text-primary)` — Done 2026-05-27
3. ✅ **A3** — `--io-surface-hover: var(--io-surface-elevated)` — Done 2026-05-27
4. ✅ **A5** — `--io-text-on-accent: var(--io-accent-foreground)` — Done 2026-05-27
5. ✅ **A6** — `--io-error: var(--io-danger)` — Done 2026-05-27
6. ✅ **A7** — `--io-surface-raised: var(--io-surface-elevated)` — Done 2026-05-27
7. ✅ **A9** — `--io-overlay: var(--io-modal-backdrop)` — Done 2026-05-27; alias chain verified
8. ✅ **A11** — `--io-alarm-inactive: #808080` — Done 2026-05-27
9. ~~**A12** — `--io-text-inverse: #ffffff`~~ — **SKIPPED**: already defined in all three themes (dark=#09090b, light=#ffffff, hphmi=#0f172a). Plan claim was incorrect.

### Pass 2 — Research-gated tokens (grep / read index.css before writing)

Resolve values, then add in a second `index.css` commit.

10. ✅ **A4** — `--io-font-sans` — Done 2026-05-27; matched `body` selector font stack (`:root` only, same pattern as `--io-font-mono`)
11. ~~**A8** — `--io-accent-muted`~~ — **SKIPPED**: token used in one place only (`PromoteToShapeWizard.tsx:2168`); no shared pattern; fix is to update that consumer to use `var(--io-accent-subtle)` instead. Do not define this token.
12. ✅ **A10** — `--io-accent-rgb` — Done 2026-05-27; per-theme values confirmed and added with inline comment

### Pass 3 — Decision-gated tokens (decisions recorded 2026-05-27)

13. ✅ **A13** — Done 2026-05-27. **Decision: Option B — full z-index scale.**
    - `--io-z-dropdown: 500` (was 200)
    - `--io-z-modal: 1000` (was 300)
    - `--io-z-toast: 2000` (was 700)
    - Applied to all three theme blocks.
    - ✅ **Emergency/toast inversion resolved 2026-05-27:** `--io-z-emergency` raised 800→3000; `--io-z-visual-lock` raised 500→1500 (above modal at 1000, below toast). Both applied in all three themes.
    - ⚠ **Remaining Claim B items:** `--io-z-command: 400` and `--io-z-kiosk-auth: 600` tokens exist only in `tokens.ts`; no component references them. CommandPalette hardcodes `z-index: 3000/3001`. Full token adoption + value reconciliation deferred to Claim B z-index migration.

14. ✅ **A14** — Done 2026-05-27. **Decision: 220px (Option A).**
    - `--io-sidebar-width: 220px` in all three theme blocks. No module code changes.
    - 220px is the official convention.

### Pass 4 — Shell drift fixes (after Passes 1–3 are committed)

Independent of each other; can be in one PR.

15. ✅ **B1** — Designer palette background: `var(--io-surface)` → `var(--io-surface-secondary)` in `DesignerLeftPalette.tsx`. Done 2026-05-27.
16. ✅ **B2** — Settings active nav indicator: added `borderLeft` (accent/transparent) + uniform `padding: "7px 10px 7px 8px"` in `Settings/index.tsx`. Done 2026-05-27.
17. ✅ **B3** — Sidebar width code: **0 file changes** (220px decided in A14 — token update only, no module edits). Done 2026-05-27.
18. ✅ **B4** — Settings nav group `letterSpacing`: 0.08em → 0.06em in `Settings/index.tsx`. Done 2026-05-27.

### Natural PR boundaries

- **PR 1:** Pass 1 + Pass 2 results — pure `index.css` token additions. Minimal review burden; no component code changes.
- **PR 2:** Pass 3 decisions + Pass 4 drift — after user sign-off on A13/A14. Includes 2–5 component file edits.

B3 may be folded into PR 1 if the 220px decision is confirmed before that PR is authored (only updates the token value, no file edits needed).

### Changes that cannot be done as isolated PRs

None of the 18 changes require coordination that prevents isolation. B3 (if 240px) touches 3 files but they are independent of each other. The dependency chain (token before drift) is satisfied by the PR sequence above.

---

## Section 4 — Definition of Done for Claim A

Claim A is complete when all of the following are verifiable:

1. **Zero undefined token references in shell-layer code.** Each token in the set {`--io-bg`, `--io-text`, `--io-surface-hover`, `--io-font-sans`, `--io-text-on-accent`, `--io-error`, `--io-surface-raised`, `--io-overlay`, `--io-accent-rgb`} is defined in `index.css`. Grep confirms no remaining unresolved references in the shell-layer files. Note: `--io-accent-muted` was removed from this set — its single usage in `PromoteToShapeWizard.tsx` was redirected to `var(--io-accent-subtle)`; the token is intentionally not defined.

2. **One new token defined.** `--io-alarm-inactive` exists in `index.css` with value `#808080`. (`--io-text-inverse` was already defined before this workstream began — A12 was skipped; see table.)

3. **`--io-z-modal` is at a realistic value.** Token is ≥1000 and consistent with the chosen z-index scale (whether single-token or full scale per A13 decision).

4. **`--io-sidebar-width` matches code.** Token value and hardcoded widths in all three modules are identical — either all 220px or all 240px, per A14 decision. No module contradicts the token.

5. **Designer left palette background matches Console and Settings.** Visual inspection in the running app confirms `DesignerLeftPalette` renders at the same surface tier as `ConsolePalette` and the Settings sidebar.

6. **Settings active nav item shows left-border accent.** Visual inspection confirms a 2px teal left border (`var(--io-accent)`) on the active nav item in Settings, matching the AppShell reference.

7. **Settings nav group header letterSpacing is 0.06em.** Matches Console palette section labels and Designer `SectionHeader` per the Cat 2 typography table in `04-recommendations.md`.

8. **`02-comparison.md` Claim A rows annotated.** The following rows in the comparison file are updated with `Fixed [date]: [commit/PR]` notes:
   - Cat 1: Console/Designer/Settings undefined-token rows
   - Cat 5: sidebar-width deviation rows (Console, Settings, Designer)
   - Cat 5: Settings active-indicator deviation row

---

## Section 5 — Implications for Future Work

### 5.1 Implications for the Claim C Revisit (Workstream 5)

Per `05-claim-c-deferral.md` Section 5, Claim C reopens only after Claim A and Claim B are both complete and reviewed. The following Claim A items have direct downstream effects on Claim C scope:

- **A11 and A12 are consumed by Claim C.** `--io-alarm-inactive` enables `alarmFlash.css` hex migration (05 Section 3.1). `--io-text-inverse` enables the DesignerCanvas resize handle fix (05 Section 3.4). Defining them now means Claim C can reference them immediately without re-entering the token layer.

- **A6 (`--io-error` alias) and A1 (`--io-bg` alias) resolve Claim C imperfections automatically.** Once the aliases exist in `index.css`, DesignerCanvas's context menu destructive color (05 Section 3.5) and WorkspaceGrid's container background (05 Section 3.2) start rendering correctly without any code change in those Claim C files. This reduces the minimum touch-point count inside the high-risk 12,067-line `DesignerCanvas.tsx`.

- **A13 (z-index scale) is a prerequisite for Claim C z-index work.** DesignerCanvas uses internal `zIndex` values in the 300–2000 range. When Claim C touches DesignerCanvas, those values must be coordinated with the scale established in A13. The scale decision is a dependency, not a blocker — Claim C should not begin its z-index work until A13 is decided and committed.

- **A14 (sidebar width) does not directly affect the canvas seam.** The canvas containers (WorkspaceGrid, DesignerCanvas) span the remaining viewport width after the sidebar. The canvas-to-sidebar boundary is clean regardless of which value (220px or 240px) is chosen, as long as the token and code are consistent.

### 5.2 Conventions Established for the Eight-Module Rebuild

The eight modules being rebuilt around the converged Console/Designer foundation will inherit the shell conventions locked in by Claim A. The following must be treated as non-negotiable constraints for all rebuilt modules:

| Convention | Value | Applies to |
|---|---|---|
| Side panel background | `var(--io-surface-secondary)` | Any rebuilt module with a left or right panel. Designer's drift to `var(--io-surface)` is being corrected in B1 to establish this as the unambiguous standard. |
| Active nav item indicator | `borderLeft: 2px solid var(--io-accent)` + adjusted padding | Any rebuilt module with a sidebar nav list. |
| Sidebar width | `var(--io-sidebar-width)` (value per A14 decision) | All side panels in rebuilt modules must use this token, not a hardcoded integer. The value may not be known until A14 is decided — this token must be resolved before any rebuilt module's panel layout is coded. |
| Nav group header typography | 11px / 600 / uppercase / 0.06em / `var(--io-text-muted)` | All section-group labels within sidebar nav panels. |
| Toolbar surface | `var(--io-surface)` + `borderBottom: 1px solid var(--io-border)` | Module toolbars. This is the Console+Designer convention adopted in `04-recommendations.md` Cat 3 — not `var(--io-surface-primary)` (which is the AppShell reference but is not the adopted target for module toolbars). |
| Token hygiene | No token reference may be used that is not defined in `index.css` | Treat any undefined token reference in a rebuilt module as a blocking defect. The token list cleared by Claim A is the authoritative registry; nothing outside it may be referenced. |

**One Claim A item must be resolved before any of the eight modules begins panel-layout work:** A14 (`--io-sidebar-width` value). Building any panel at a hardcoded width and later discovering the chosen value was different requires an eleven-module edit. Decide it once, enforce it everywhere.

---

Produce the review now.
```


## #TURN_END

_2026-05-27T07:35:00+00:00_

---


## #PROMPT

_2026-05-27T07:35:05+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
bash /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #TURN_END

_2026-05-27T07:35:05+00:00_

---


## #PROMPT

_2026-05-27T07:37:28+00:00_

```
You are producing a work-unit summary from a Claude Code work-unit log.

Below is the log of a single work unit. It contains the initial prompt, tagged
sections showing what tools were used and what files were modified, and the
assistant's responses during the turn(s).

Produce a structured summary covering ONLY what is in the log:

1. **Work unit purpose**: 1-2 sentence statement of what this work unit was about.
   Derive from the initial prompt and the work that was done.

2. **Key decisions made**: bulleted list of significant decisions or approaches
   taken. Only include decisions that are visible in the log. Do not speculate.

3. **What was built or changed**: bulleted list of concrete outcomes — files
   modified, features implemented, bugs fixed, tests added.

4. **What was deliberately not done**: anything the log indicates was explicitly
   out of scope, deferred, or rejected. If nothing was explicitly deferred,
   omit this section.

5. **Open questions or follow-ups**: anything the log indicates needs to be
   revisited or resolved later. If none, omit this section.

6. **Files modified**: a clean list of file paths that were edited/written.

Constraints on your output:
- Be terse. Each section should be a few bullets, not paragraphs.
- Do NOT speculate about intent beyond what's in the log.
- Do NOT comment on code quality or make recommendations.
- Do NOT include preamble like "Here's the summary" — start directly with section 1.
- Output is markdown. Use ## headers for each section.

Here is the log:

---

# Work Unit Log: workstream-2c-shell-drift

read-ui-audit

Started: 2026-05-27T07:27:39+00:00
Session: 6e271c20-7077-46a5-b871-1f4ad3b57324

---


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx` (83→93 chars)

_2026-05-27T07:28:39+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (40→40 chars)

_2026-05-27T07:28:44+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (608→777 chars)

_2026-05-27T07:28:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (339→315 chars)

_2026-05-27T07:29:23+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/06-claim-a-plan.md` (1877→1690 chars)

_2026-05-27T07:29:45+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/06-claim-a-plan.md` (463→551 chars)

_2026-05-27T07:29:53+00:00_


## #PROMPT

_2026-05-27T07:29:59+00:00_

```
~initprompt~ workstream-2c-shell-drift

Read ui-audit/06-claim-a-plan.md section one category (b) for the list of shell drift items. Read ui-audit/06b-claim-a-tokens-checkin.md to confirm token work is clear. Read ui-audit/05-claim-c-deferral.md to confirm exclusions.

Goal: fix the shell drift items in the order recorded in the plan. Each fix should reference tokens added in 2b rather than introducing new hardcoded values.

For each drift item in order:
1. State which item is being addressed and reference the plan entry.
2. Open the affected files and apply the fix. Use existing tokens. Do not refactor unrelated code, do not change behavior beyond visual consistency, do not modify canvas-layer files per the Claim C deferral.
3. If a fix has multi-module implications flagged in section two of the plan, and the implications have not been resolved by user review, stop and ask before applying. Do not unilaterally make decisions that affect the future eight-module rebuild.
4. Verify visually if possible; otherwise verify the code reads as expected.

If a drift item in the plan turns out not to be a real drift (e.g. the comparison file's claim was wrong, or the drift was fixed by some other change since the audit), note the discrepancy and skip it.

Update ui-audit/06-claim-a-plan.md by marking each completed drift item with a status flag and the date.

When done print: count of drift items addressed, count skipped with reasons, count blocked by multi-module implications awaiting user review, and the file path of the updated plan. Stop.
```


## #ASSISTANT

Reading the three reference files in parallel.


## #ASSISTANT

Tokens confirmed clear, exclusions noted (no canvas-layer files). Reading the two affected files now.


## #BASH
_Find background token usage in DesignerLeftPalette_

```bash
grep -n 'background\|io-surface' /home/io/io-dev/io/frontend/src/designer/DesignerLeftPalette.tsx | head -30
```


## #BASH
_Find nav item active styles and letter spacing in Settings_

```bash
grep -n 'borderLeft\|paddingLeft\|letterSpacing\|navItem\|activeItem\|navGroup\|sectionLabel\|active.*nav\|nav.*active' /home/io/io-dev/io/frontend/src/settings/index.tsx | head -40
```


## #BASH
_Locate actual file paths for designer palette and settings_

```bash
find /home/io/io-dev/io/frontend/src -name "DesignerLeftPalette*" -o -name "DesignerPalette*" 2>/dev/null; find /home/io/io-dev/io/frontend/src -path "*/settings/index*" -o -path "*/settings/Settings*" 2>/dev/null | head -10
```


## #BASH
_Find background token in DesignerLeftPalette_

```bash
grep -n 'background\|io-surface' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | head -20
```


## #BASH
_Find nav styles in Settings index_

```bash
grep -n 'borderLeft\|paddingLeft\|letterSpacing\|isActive\|active\|navGroup\|sectionLabel' /home/io/io-dev/io/frontend/src/pages/settings/index.tsx | head -40
```


## #BASH
_Find surface token references in DesignerLeftPalette_

```bash
grep -n 'io-surface\b\|background.*surface\|surface.*background' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | head -20
```


## #ASSISTANT

That `var(--io-surface)` at line 245 is a Dialog.Content, not the palette panel. Let me find the actual panel container.


## #BASH
_Find palette container with background and width_

```bash
grep -n 'background\|aside\|palette\|panel\|sidebar\|width.*220\|io-sidebar' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | head -30
```


## #BASH
_Find exact --io-surface (bare) references in DesignerLeftPalette_

```bash
grep -n 'background\|io-surface\|width\|border' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | grep -E '(surface[^-]|surface-secondary|surface-primary|surface\b)' | head -20
```


## #ASSISTANT

Found both targets. Applying all three changes now.

**B1** — `DesignerLeftPalette.tsx:2436`: `var(--io-surface)` → `var(--io-surface-secondary)`


## #ASSISTANT

**B2 + B4** — both in `Settings/index.tsx`. Applying letterSpacing fix first, then the active nav border.


## #ASSISTANT

Diagnostic is in an unrelated file — ignore it. Now applying B2.


## #ASSISTANT

Wait — the inactive case has `padding: "7px 10px"` (left: 10px) plus a transparent 2px border = 12px from edge, but active has padding 8px + border 2px = 10px. Text positions don't align. Fixing to always-reserve the 2px with consistent padding.


## #ASSISTANT

Good. Now verifying all three changes read correctly.


## #BASH
_Verify B1 change_

```bash
grep -n 'background.*surface\|letterSpacing\|borderLeft\|padding.*7px' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | grep -E '(2436|surface-secondary)'
```


## #BASH
_Verify B2 and B4 changes_

```bash
grep -n 'letterSpacing\|borderLeft\|padding.*7px' /home/io/io-dev/io/frontend/src/pages/settings/index.tsx | head -10
```


## #ASSISTANT

All three changes verified. Now updating the plan with completion status.


## #ASSISTANT

Also updating Pass 4 in Section 3 to mark the items done.


## #TURN_END

_2026-05-27T07:30:00+00:00_

---


## #PROMPT

_2026-05-27T07:35:00+00:00_

```
You are performing a DEEP verification review of a Claude Code work unit.

Your job is to compare what was asked (the initial prompt and any work-unit
summary) against what was actually built (the diff and the surrounding code).

Be skeptical and direct. Look for:
- The diff does something different from what was asked
- The diff regresses previously working behavior
- The diff expands scope beyond the prompt
- The diff has integration concerns with surrounding code that aren't addressed
- The diff appears to invert architectural decisions (e.g., the prompt asked
  to move from X to Y, but the diff actually reinforces X)

Output format (markdown):

## Summary
One paragraph: does the diff appear to match intent, or are there concerns?

## Concerns
If concerns exist, list them as numbered items with:
- What the concern is
- Specifically where in the code (file and line)
- Why this might be a divergence from intent

If no concerns, write "No concerns identified."

## Verification Notes
Anything else useful to know about what was built.

DO NOT include preamble. Start directly with "## Summary".
DO NOT speculate about things outside the diff. Stay grounded in what's there.

WORK UNIT LOG:
---
# Work Unit Log: workstream-2c-shell-drift

read-ui-audit

Started: 2026-05-27T07:27:39+00:00
Session: 6e271c20-7077-46a5-b871-1f4ad3b57324

---


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx` (83→93 chars)

_2026-05-27T07:28:39+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (40→40 chars)

_2026-05-27T07:28:44+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (608→777 chars)

_2026-05-27T07:28:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (339→315 chars)

_2026-05-27T07:29:23+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/06-claim-a-plan.md` (1877→1690 chars)

_2026-05-27T07:29:45+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/06-claim-a-plan.md` (463→551 chars)

_2026-05-27T07:29:53+00:00_


## #PROMPT

_2026-05-27T07:29:59+00:00_

```
~initprompt~ workstream-2c-shell-drift

Read ui-audit/06-claim-a-plan.md section one category (b) for the list of shell drift items. Read ui-audit/06b-claim-a-tokens-checkin.md to confirm token work is clear. Read ui-audit/05-claim-c-deferral.md to confirm exclusions.

Goal: fix the shell drift items in the order recorded in the plan. Each fix should reference tokens added in 2b rather than introducing new hardcoded values.

For each drift item in order:
1. State which item is being addressed and reference the plan entry.
2. Open the affected files and apply the fix. Use existing tokens. Do not refactor unrelated code, do not change behavior beyond visual consistency, do not modify canvas-layer files per the Claim C deferral.
3. If a fix has multi-module implications flagged in section two of the plan, and the implications have not been resolved by user review, stop and ask before applying. Do not unilaterally make decisions that affect the future eight-module rebuild.
4. Verify visually if possible; otherwise verify the code reads as expected.

If a drift item in the plan turns out not to be a real drift (e.g. the comparison file's claim was wrong, or the drift was fixed by some other change since the audit), note the discrepancy and skip it.

Update ui-audit/06-claim-a-plan.md by marking each completed drift item with a status flag and the date.

When done print: count of drift items addressed, count skipped with reasons, count blocked by multi-module implications awaiting user review, and the file path of the updated plan. Stop.
```


## #ASSISTANT

Reading the three reference files in parallel.


## #ASSISTANT

Tokens confirmed clear, exclusions noted (no canvas-layer files). Reading the two affected files now.


## #BASH
_Find background token usage in DesignerLeftPalette_

```bash
grep -n 'background\|io-surface' /home/io/io-dev/io/frontend/src/designer/DesignerLeftPalette.tsx | head -30
```


## #BASH
_Find nav item active styles and letter spacing in Settings_

```bash
grep -n 'borderLeft\|paddingLeft\|letterSpacing\|navItem\|activeItem\|navGroup\|sectionLabel\|active.*nav\|nav.*active' /home/io/io-dev/io/frontend/src/settings/index.tsx | head -40
```


## #BASH
_Locate actual file paths for designer palette and settings_

```bash
find /home/io/io-dev/io/frontend/src -name "DesignerLeftPalette*" -o -name "DesignerPalette*" 2>/dev/null; find /home/io/io-dev/io/frontend/src -path "*/settings/index*" -o -path "*/settings/Settings*" 2>/dev/null | head -10
```


## #BASH
_Find background token in DesignerLeftPalette_

```bash
grep -n 'background\|io-surface' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | head -20
```


## #BASH
_Find nav styles in Settings index_

```bash
grep -n 'borderLeft\|paddingLeft\|letterSpacing\|isActive\|active\|navGroup\|sectionLabel' /home/io/io-dev/io/frontend/src/pages/settings/index.tsx | head -40
```


## #BASH
_Find surface token references in DesignerLeftPalette_

```bash
grep -n 'io-surface\b\|background.*surface\|surface.*background' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | head -20
```


## #ASSISTANT

That `var(--io-surface)` at line 245 is a Dialog.Content, not the palette panel. Let me find the actual panel container.


## #BASH
_Find palette container with background and width_

```bash
grep -n 'background\|aside\|palette\|panel\|sidebar\|width.*220\|io-sidebar' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | head -30
```


## #BASH
_Find exact --io-surface (bare) references in DesignerLeftPalette_

```bash
grep -n 'background\|io-surface\|width\|border' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | grep -E '(surface[^-]|surface-secondary|surface-primary|surface\b)' | head -20
```


## #ASSISTANT

Found both targets. Applying all three changes now.

**B1** — `DesignerLeftPalette.tsx:2436`: `var(--io-surface)` → `var(--io-surface-secondary)`


## #ASSISTANT

**B2 + B4** — both in `Settings/index.tsx`. Applying letterSpacing fix first, then the active nav border.


## #ASSISTANT

Diagnostic is in an unrelated file — ignore it. Now applying B2.


## #ASSISTANT

Wait — the inactive case has `padding: "7px 10px"` (left: 10px) plus a transparent 2px border = 12px from edge, but active has padding 8px + border 2px = 10px. Text positions don't align. Fixing to always-reserve the 2px with consistent padding.


## #ASSISTANT

Good. Now verifying all three changes read correctly.


## #BASH
_Verify B1 change_

```bash
grep -n 'background.*surface\|letterSpacing\|borderLeft\|padding.*7px' /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx | grep -E '(2436|surface-secondary)'
```


## #BASH
_Verify B2 and B4 changes_

```bash
grep -n 'letterSpacing\|borderLeft\|padding.*7px' /home/io/io-dev/io/frontend/src/pages/settings/index.tsx | head -10
```


## #ASSISTANT

All three changes verified. Now updating the plan with completion status.


## #ASSISTANT

Also updating Pass 4 in Section 3 to mark the items done.


## #TURN_END

_2026-05-27T07:30:00+00:00_

---
---



DIFF OF CHANGES:
---
diff --git a/frontend/src/pages/designer/DesignerLeftPalette.tsx b/frontend/src/pages/designer/DesignerLeftPalette.tsx
index 32db8895..be82bccc 100644
--- a/frontend/src/pages/designer/DesignerLeftPalette.tsx
+++ b/frontend/src/pages/designer/DesignerLeftPalette.tsx
@@ -2433,7 +2433,7 @@ export default function DesignerLeftPalette({
     display: "flex",
     flexDirection: "column",
     overflow: "hidden",
-    background: "var(--io-surface)",
+    background: "var(--io-surface-secondary)",
     borderRight: "1px solid var(--io-border)",
   };
 
diff --git a/frontend/src/pages/settings/index.tsx b/frontend/src/pages/settings/index.tsx
index 74ed05bb..4be5dfd0 100644
--- a/frontend/src/pages/settings/index.tsx
+++ b/frontend/src/pages/settings/index.tsx
@@ -195,7 +195,7 @@ export default function SettingsShell() {
                 fontWeight: 600,
                 color: "var(--io-text-muted)",
                 textTransform: "uppercase",
-                letterSpacing: "0.08em",
+                letterSpacing: "0.06em",
                 padding: `${groupIndex === 0 ? "4px" : "12px"} 8px 6px`,
                 userSelect: "none",
               }}
@@ -208,7 +208,10 @@ export default function SettingsShell() {
                 to={item.path}
                 style={({ isActive }) => ({
                   display: "block",
-                  padding: "7px 10px",
+                  padding: "7px 10px 7px 8px",
+                  borderLeft: isActive
+                    ? "2px solid var(--io-accent)"
+                    : "2px solid transparent",
                   borderRadius: "var(--io-radius)",
                   marginBottom: "2px",
                   textDecoration: "none",
diff --git a/ui-audit/06-claim-a-plan.md b/ui-audit/06-claim-a-plan.md
index 2fa57076..657ffcc5 100644
--- a/ui-audit/06-claim-a-plan.md
+++ b/ui-audit/06-claim-a-plan.md
@@ -45,10 +45,10 @@ Changes to module component files in the sidebar and left-nav layer.
 
 | # | Change | File(s) | Description | Source |
 |---|---|---|---|---|
-| B1 | Designer left palette background | `frontend/src/designer/DesignerLeftPalette.tsx` | Change `background: var(--io-surface)` → `background: var(--io-surface-secondary)`. Console and Settings both use `var(--io-surface-secondary)` for their side panels; Designer is one surface tier lighter, creating a visible inconsistency at the module-boundary seam. | 02 Cat 5 Designer Deviations; 04 Cat 5 "Fix: Align Designer left palette background" |
-| B2 | Settings active nav item — left-border accent | `frontend/src/settings/index.tsx` (nav item active-state styles) | Add `borderLeft: '2px solid var(--io-accent)'` and reduce `paddingLeft` by 2px to maintain alignment. The AppShell implements this indicator; Settings omits it. Audit Cat 5 Notes: "Missing active left-border accent is the most visible deviation from AppShell nav pattern." | 02 Cat 5 Settings Deviations; 04 Cat 5 "Fix: Settings active nav item" |
-| B3 | Sidebar width — align code to decided value | Conditional on A14 decision | If 220px chosen (Option A): no code changes needed beyond A14 token update. If 240px chosen (Option B): update `ConsolePalette.tsx` (220px hardcode), `Settings/index.tsx` aside width (220px hardcode), and `DesignerLeftPalette.tsx` width (220px hardcode) to 240px. Change `var(--io-sidebar-width)` references if any exist, not raw integers. | 02 Cat 5 Console+Settings+Designer Deviations; 04 Cat 5 |
-| B4 | Settings nav group header — letterSpacing | `frontend/src/settings/index.tsx` (nav group label styles) | Change `letterSpacing` from 0.08em to 0.06em. Console palette section labels use 0.06em; Designer `SectionHeader` uses 0.06em; Settings nav group header drifts to 0.08em. Font size (11px), weight (600), and transform (uppercase) are already consistent. | 02 Cat 2 Settings Deviations; 02 Cat 5; 04 Cat 2 typography table; 04 Cat 5 "Fix: Section label typography" |
+| B1 | ✅ Done 2026-05-27 — Designer left palette background | `frontend/src/pages/designer/DesignerLeftPalette.tsx` | Changed `background: "var(--io-surface)"` → `"var(--io-surface-secondary)"` at `containerStyle` (line 2436). Console and Settings both use `var(--io-surface-secondary)` for their side panels; Designer is one surface tier lighter, creating a visible inconsistency at the module-boundary seam. | 02 Cat 5 Designer Deviations; 04 Cat 5 "Fix: Align Designer left palette background" |
+| B2 | ✅ Done 2026-05-27 — Settings active nav item — left-border accent | `frontend/src/pages/settings/index.tsx` (nav item active-state styles) | Added `borderLeft: isActive ? "2px solid var(--io-accent)" : "2px solid transparent"` and set uniform `padding: "7px 10px 7px 8px"` (left padding reduced from 10px to 8px; transparent border reserves the 2px on inactive items so text stays at 10px from edge in both states). | 02 Cat 5 Settings Deviations; 04 Cat 5 "Fix: Settings active nav item" |
+| B3 | ✅ Done 2026-05-27 — Sidebar width — 0 file changes | n/a — A14 decided 220px; all module hardcodes already match | No code changes needed. Token `--io-sidebar-width: 220px` is consistent with all hardcodes in Console, Settings, and Designer. | 02 Cat 5 Console+Settings+Designer Deviations; 04 Cat 5 |
+| B4 | ✅ Done 2026-05-27 — Settings nav group header — letterSpacing | `frontend/src/pages/settings/index.tsx` (nav group label styles) | Changed `letterSpacing` from `"0.08em"` to `"0.06em"` (line 198). Matches Console palette section labels and Designer `SectionHeader`. | 02 Cat 2 Settings Deviations; 02 Cat 5; 04 Cat 2 typography table; 04 Cat 5 "Fix: Section label typography" |
 
 **Category B total: 4 changes (B3 expands to 3 additional file edits if 240px is chosen in A14; 0 file changes if 220px chosen)**
 
@@ -122,10 +122,10 @@ Resolve values, then add in a second `index.css` commit.
 
 Independent of each other; can be in one PR.
 
-15. **B1** — Designer palette background: `var(--io-surface)` → `var(--io-surface-secondary)` in `DesignerLeftPalette.tsx`.
-16. **B2** — Settings active nav indicator: add `borderLeft: '2px solid var(--io-accent)'` + padding adjustment in `Settings/index.tsx`.
-17. **B3** — Sidebar width code: **0 file changes** (220px decided in A14 — token update only, no module edits).
-18. **B4** — Settings nav group `letterSpacing`: 0.08em → 0.06em in `Settings/index.tsx`.
+15. ✅ **B1** — Designer palette background: `var(--io-surface)` → `var(--io-surface-secondary)` in `DesignerLeftPalette.tsx`. Done 2026-05-27.
+16. ✅ **B2** — Settings active nav indicator: added `borderLeft` (accent/transparent) + uniform `padding: "7px 10px 7px 8px"` in `Settings/index.tsx`. Done 2026-05-27.
+17. ✅ **B3** — Sidebar width code: **0 file changes** (220px decided in A14 — token update only, no module edits). Done 2026-05-27.
+18. ✅ **B4** — Settings nav group `letterSpacing`: 0.08em → 0.06em in `Settings/index.tsx`. Done 2026-05-27.
 
 ### Natural PR boundaries
 
---

FULL FILE CONTENTS (for surrounding-code analysis):
---

--- File: /home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx ---
/**
 * DesignerLeftPalette.tsx
 *
 * Left sidebar palette. Content is mode-dependent:
 *  - Graphic mode: Equipment, Stencils, Display Elements, Widgets, Points
 *  - Dashboard mode: Widgets, Equipment, Stencils, Display Elements
 *  - Report mode: Widgets, Report Elements, Equipment, Stencils, Display Elements
 *
 * Layers belong in the right panel only (spec §15).
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";
import { useLibraryStore, useSceneStore } from "../../store/designer";
import type { DisplayElementType } from "../../shared/types/graphics";
import type { ChartTypeId } from "../../shared/components/charts/chart-config-types";
import { graphicsApi } from "../../api/graphics";
import PointsBrowserPanel from "../../shared/components/PointsBrowserPanel";
import { ShapeThumbnail } from "./components/ShapeThumbnail";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerLeftPaletteProps {
  collapsed: boolean;
  width: number;
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform 0.15s",
      }}
    >
      <path
        d="M4 2L8 6L4 10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        padding: "6px 10px",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--io-border)",
        color: "var(--io-text-muted)",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        cursor: "pointer",
        textAlign: "left",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--io-surface-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <IconChevron open={open} />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Resizable palette section — header + scrollable content + bottom drag handle
// ---------------------------------------------------------------------------

interface PaletteSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Controlled height of the scrollable content area in px. Omit for flexible. */
  height?: number;
  /** If true, fills remaining flex space instead of using a fixed height. */
  flexible?: boolean;
  onHeightChange?: (dy: number) => void;
  children: React.ReactNode;
}

function PaletteSection({
  title,
  open,
  onToggle,
  height,
  flexible = false,
  onHeightChange,
  children,
}: PaletteSectionProps) {
  const startY = useRef(0);
  const activeRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  const canResize = !flexible && !!onHeightChange;

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    activeRef.current = true;
    startY.current = e.clientY;
    setIsResizing(true);

    const onMove = (ev: MouseEvent) => {
      if (!activeRef.current) return;
      const dy = ev.clientY - startY.current;
      startY.current = ev.clientY;
      onHeightChange!(dy);
    };
    const onUp = () => {
      activeRef.current = false;
      setIsResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
        ...(flexible && open ? { flex: "1 1 0", minHeight: 80 } : {}),
      }}
    >
      <SectionHeader label={title} open={open} onToggle={onToggle} />
      {open && (
        <>
          <div
            style={{
              overflowY: "auto",
              overflowX: "hidden",
              ...(flexible ? { flex: 1 } : { height: height ?? "auto" }),
            }}
          >
            {children}
          </div>
          {canResize && (
            <div
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onMouseDown={handleResizeMouseDown}
              style={{
                height: 4,
                flexShrink: 0,
                cursor: "ns-resize",
                background: isResizing ? "var(--io-accent)" : "transparent",
                transition: "background 0.1s",
                borderBottom: "1px solid var(--io-border)",
                userSelect: "none",
              }}
              onMouseEnter={(e) => {
                if (!isResizing)
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--io-surface-elevated)";
              }}
              onMouseLeave={(e) => {
                if (!isResizing)
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// (SkeletonTile and SvgThumbnail removed — equipment section now uses category tiles)

// ---------------------------------------------------------------------------
// Delete confirmation dialog (Radix Dialog, no window.confirm)
// ---------------------------------------------------------------------------

function DeleteConfirmDialog({
  open,
  onOpenChange,
  label,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9998,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            padding: "20px 24px",
            width: 360,
            zIndex: 9999,
            fontSize: 13,
            color: "var(--io-text-primary)",
          }}
        >
          <Dialog.Title
            style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}
          >
            Delete &ldquo;{label}&rdquo;?
          </Dialog.Title>
          <Dialog.Description
            style={{
              fontSize: 12,
              color: "var(--io-text-muted)",
              marginBottom: 20,
            }}
          >
            This action cannot be undone.
          </Dialog.Description>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Dialog.Close asChild>
              <button
                style={{
                  padding: "6px 14px",
                  background: "var(--io-surface-elevated)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-primary)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              style={{
                padding: "6px 14px",
                background: "var(--io-danger, #ef4444)",
                border: "none",
                borderRadius: "var(--io-radius)",
                color: "#fff",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Display element types
// ---------------------------------------------------------------------------

const DISPLAY_ELEMENT_TYPES: Array<{
  type: DisplayElementType;
  label: string;
}> = [
  { type: "text_readout", label: "Text Readout" },
  { type: "text_readout_array", label: "Text Readout Array" },
  { type: "analog_bar", label: "Analog Bar" },
  { type: "fill_gauge", label: "Fill Gauge" },
  { type: "sparkline", label: "Sparkline" },
  { type: "alarm_indicator", label: "Alarm Indicator" },
  { type: "digital_status", label: "Digital Status" },
];

// Spec-accurate mini SVG previews for each display element type
function DisplayElementPreview({
  type,
  size,
}: {
  type: DisplayElementType;
  size: number;
}) {
  const s = size;
  switch (type) {
    case "text_readout_array":
      // Two stacked boxes to distinguish from single text_readout
      return (
        <svg
          width={s}
          height={Math.round(s * 0.7)}
          viewBox="0 0 60 30"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="0"
            y="0"
            width="60"
            height="13"
            rx="2"
            fill="#27272A"
            stroke="#3F3F46"
            strokeWidth="1"
          />
          <text
            x="30"
            y="9"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="8"
            fill="#A1A1AA"
          >
            123.4
          </text>
          <rect
            x="0"
            y="17"
            width="60"
            height="13"
            rx="2"
            fill="#27272A"
            stroke="#3F3F46"
            strokeWidth="1"
          />
          <text
            x="30"
            y="26"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="8"
            fill="#A1A1AA"
          >
            456.7
          </text>
        </svg>
      );
    case "text_readout":
      // Box with "123.4" value text
      return (
        <svg
          width={s}
          height={Math.round(s * 0.5)}
          viewBox="0 0 60 22"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="0"
            y="0"
            width="60"
            height="22"
            rx="2"
            fill="#27272A"
            stroke="#3F3F46"
            strokeWidth="1"
          />
          <text
            x="30"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="10"
            fill="#A1A1AA"
          >
            123.4
          </text>
          <text
            x="50"
            y="14"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize="8"
            fill="#71717A"
          >
            °F
          </text>
        </svg>
      );
    case "analog_bar":
      // Vertical bar with zones and pointer
      return (
        <svg
          width={Math.round(s * 0.45)}
          height={s}
          viewBox="0 0 20 46"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="2"
            y="0"
            width="14"
            height="46"
            fill="#27272A"
            stroke="#52525B"
            strokeWidth="0.5"
          />
          <rect x="3" y="1" width="12" height="7" fill="#5C3A3A" />
          <rect x="3" y="8" width="12" height="10" fill="#5C4A32" />
          <rect x="3" y="18" width="12" height="14" fill="#404048" />
          <rect x="3" y="32" width="12" height="7" fill="#32445C" />
          <rect x="3" y="39" width="12" height="6" fill="#2E3A5C" />
          <polygon points="16,21 22,24 16,27" fill="#A1A1AA" />
          <line
            x1="3"
            y1="24"
            x2="15"
            y2="24"
            stroke="#A1A1AA"
            strokeWidth="0.8"
          />
        </svg>
      );
    case "fill_gauge":
      // Vertical bar with fill
      return (
        <svg
          width={Math.round(s * 0.45)}
          height={s}
          viewBox="0 0 20 46"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="2"
            y="0"
            width="14"
            height="46"
            rx="1"
            fill="none"
            stroke="#52525B"
            strokeWidth="0.5"
          />
          <rect
            x="3"
            y="16"
            width="12"
            height="29"
            rx="0.5"
            fill="#475569"
            opacity="0.6"
          />
          <line
            x1="3"
            y1="16"
            x2="15"
            y2="16"
            stroke="#64748B"
            strokeWidth="0.8"
            strokeDasharray="3 2"
          />
        </svg>
      );
    case "sparkline":
      // Sparkline chart
      return (
        <svg
          width={s}
          height={Math.round(s * 0.4)}
          viewBox="0 0 60 16"
          style={{ pointerEvents: "none" }}
        >
          <rect x="0" y="0" width="60" height="16" rx="1" fill="#27272A" />
          <polyline
            points="3,12 10,9 17,11 24,6 31,8 38,4 45,9 52,7 59,10"
            fill="none"
            stroke="#A1A1AA"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      );
    case "alarm_indicator":
      // ISA-101 alarm shapes
      return (
        <svg
          width={s}
          height={Math.round(s * 0.6)}
          viewBox="0 0 52 24"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="1"
            y="3"
            width="16"
            height="12"
            rx="1.5"
            fill="none"
            stroke="#EF4444"
            strokeWidth="1.5"
          />
          <text
            x="9"
            y="11"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="7"
            fontWeight="600"
            fill="#EF4444"
          >
            1
          </text>
          <polygon
            points="27,2 37,18 17,18"
            fill="none"
            stroke="#F97316"
            strokeWidth="1.5"
          />
          <text
            x="27"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="7"
            fontWeight="600"
            fill="#F97316"
          >
            2
          </text>
          <ellipse
            cx="46"
            cy="12"
            rx="5"
            ry="4"
            fill="none"
            stroke="#06B6D4"
            strokeWidth="1.5"
          />
          <text
            x="46"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="7"
            fontWeight="600"
            fill="#06B6D4"
          >
            4
          </text>
        </svg>
      );
    case "digital_status":
      // Pill with RUN / STOP
      return (
        <svg
          width={s}
          height={Math.round(s * 0.55)}
          viewBox="0 0 56 24"
          style={{ pointerEvents: "none" }}
        >
          <rect x="1" y="5" width="24" height="14" rx="2" fill="#3F3F46" />
          <text
            x="13"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="8"
            fill="#A1A1AA"
          >
            OPEN
          </text>
          <rect x="29" y="5" width="26" height="14" rx="2" fill="#059669" />
          <text
            x="42"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="8"
            fill="#F9FAFB"
          >
            RUN
          </text>
        </svg>
      );
    default:
      return (
        <span
          style={{
            fontSize: Math.round(s * 0.4),
            color: "var(--io-text-muted)",
          }}
        >
          ⊞
        </span>
      );
  }
}

function DisplayElementTile({
  type,
  label,
  collapsed,
}: {
  type: DisplayElementType;
  label: string;
  collapsed: boolean;
}) {
  const [isFavorited, setIsFavorited] = useState(() => {
    try {
      const raw = localStorage.getItem("io:palette-favorites") ?? "{}";
      const favs = JSON.parse(raw) as Record<string, string[]>;
      return (favs["display-elements"] ?? []).includes(type);
    } catch {
      return false;
    }
  });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left-click drags; right-clicks go to the context menu
      if (e.button !== 0) return;
      e.preventDefault();
      const ghost = document.createElement("div");
      ghost.id = "io-canvas-drag-ghost";
      ghost.setAttribute("data-drag-ghost", "true");
      ghost.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:9999",
        "opacity:0.7",
        "padding:4px 8px",
        "background:var(--io-accent)",
        "color:#09090b",
        "border-radius:4px",
        "font-size:11px",
        "font-weight:600",
        "transform:translate(-50%,-50%)",
        `left:${e.clientX}px`,
        `top:${e.clientY}px`,
        "display:block",
        "visibility:visible",
      ].join(";");
      ghost.textContent = label;
      document.body.appendChild(ghost);

      const onMove = (ev: MouseEvent) => {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
        document.dispatchEvent(
          new CustomEvent("io:display-element-drag-move", {
            detail: { elementType: type, x: ev.clientX, y: ev.clientY },
          }),
        );
      };
      const onUp = (ev: MouseEvent) => {
        ghost.remove();
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.dispatchEvent(
          new CustomEvent("io:display-element-drop", {
            detail: { elementType: type, x: ev.clientX, y: ev.clientY },
          }),
        );
      };
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ghost.remove();
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseup", onUp, true);
          document.removeEventListener("keydown", onKeyDown, true);
        }
      };
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
      document.addEventListener("keydown", onKeyDown, true);
    },
    [type, label],
  );

  function handlePlaceAtCenter() {
    const canvasEl = document.querySelector('[data-designer-canvas="true"]');
    const rect = canvasEl?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    document.dispatchEvent(
      new CustomEvent("io:display-element-drop", {
        detail: { elementType: type, x: cx, y: cy },
      }),
    );
  }

  function handleToggleFavorite() {
    try {
      const raw = localStorage.getItem("io:palette-favorites") ?? "{}";
      const favs = JSON.parse(raw) as Record<string, string[]>;
      if (!favs["display-elements"]) favs["display-elements"] = [];
      if (isFavorited) {
        favs["display-elements"] = favs["display-elements"].filter(
          (t) => t !== type,
        );
        setIsFavorited(false);
      } else {
        if (!favs["display-elements"].includes(type)) {
          favs["display-elements"].push(type);
        }
        setIsFavorited(true);
      }
      localStorage.setItem("io:palette-favorites", JSON.stringify(favs));
    } catch {
      // localStorage may be blocked — silently ignore
    }
  }

  const { menuState, handleContextMenu, closeMenu } = useContextMenu();

  const displayElemMenuItems = [
    { label: "Place at Center", onClick: handlePlaceAtCenter },
    {
      label: isFavorited ? "Remove from Favorites" : "Add to Favorites",
      onClick: handleToggleFavorite,
    },
  ];

  if (collapsed) {
    return (
      <>
        <div
          onMouseDown={handleMouseDown}
          onContextMenu={handleContextMenu}
          title={label}
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            cursor: "grab",
            overflow: "hidden",
            userSelect: "none",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--io-accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--io-border)";
          }}
        >
          <DisplayElementPreview type={type} size={26} />
        </div>
        {menuState && (
          <ContextMenu
            x={menuState.x}
            y={menuState.y}
            items={displayElemMenuItems}
            onClose={closeMenu}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        title={label}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          width: 72,
          height: 64,
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          cursor: "grab",
          overflow: "hidden",
          userSelect: "none",
          padding: 4,
          textAlign: "center",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--io-accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--io-border)";
        }}
      >
        <DisplayElementPreview type={type} size={40} />
        <span
          style={{
            fontSize: 9,
            color: "var(--io-text-muted)",
            lineHeight: 1.2,
            textAlign: "center",
          }}
        >
          {label.length > 12 ? label.slice(0, 11) + "…" : label}
        </span>
      </div>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={displayElemMenuItems}
          onClose={closeMenu}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Equipment section
// ---------------------------------------------------------------------------

/** Equipment category tiles — one tile per equipment family. */
const EQUIPMENT_CATEGORIES: Array<{
  id: string;
  label: string;
  defaultId: string;
}> = [
  { id: "valves", label: "Valve", defaultId: "valve-gate" },
  { id: "pumps", label: "Pump", defaultId: "pump-centrifugal-opt1" },
  { id: "rotating", label: "Rotating", defaultId: "compressor-opt1" },
  {
    id: "heat-transfer",
    label: "Heat Transfer",
    defaultId: "heat-exchanger-shell-tube",
  },
  { id: "vessels", label: "Vessel", defaultId: "vessel-vertical-welded" },
  { id: "tanks", label: "Tank", defaultId: "tank-storage-cone-roof" },
  { id: "reactors", label: "Reactor", defaultId: "reactor-base" },
  {
    id: "columns",
    label: "Column",
    defaultId: "column-distillation-standard-plain",
  },
  { id: "filters", label: "Filter", defaultId: "filter-vacuum" },
  { id: "instrumentation", label: "Instrument", defaultId: "instrument-field" },
  { id: "mixers", label: "Mixer", defaultId: "mixer-agitator" },
];

interface EquipmentCategoryTileProps {
  id: string;
  label: string;
  defaultId: string;
  collapsed: boolean;
}

function EquipmentCategoryTile({
  id,
  label,
  defaultId,
  collapsed,
}: EquipmentCategoryTileProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();

      const ghost = document.createElement("div");
      ghost.id = "io-canvas-drag-ghost";
      ghost.setAttribute("data-drag-ghost", "true");
      ghost.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:9999",
        "opacity:0.85",
        "padding:4px 10px",
        "background:var(--io-accent)",
        "color:#09090b",
        "border-radius:4px",
        "font-size:11px",
        "font-weight:600",
        "white-space:nowrap",
        "transform:translate(-50%,-50%)",
        `left:${e.clientX}px`,
        `top:${e.clientY}px`,
      ].join(";");
      ghost.textContent = label;
      document.body.appendChild(ghost);

      const onMove = (ev: MouseEvent) => {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
      };

      const onUp = (ev: MouseEvent) => {
        ghost.remove();
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.dispatchEvent(
          new CustomEvent("io:category-drop", {
            detail: {
              categoryId: id,
              defaultShapeId: defaultId,
              x: ev.clientX,
              y: ev.clientY,
            },
          }),
        );
      };

      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ghost.remove();
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseup", onUp, true);
          document.removeEventListener("keydown", onKeyDown, true);
        }
      };

      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
      document.addEventListener("keydown", onKeyDown, true);
    },
    [id, label, defaultId],
  );

  if (collapsed) {
    return (
      <button
        onMouseDown={handleMouseDown}
        title={label}
        style={{
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--io-surface-sunken)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          cursor: "grab",
          padding: 2,
          overflow: "hidden",
        }}
      >
        <ShapeThumbnail shapeId={defaultId} size={28} />
      </button>
    );
  }

  return (
    <button
      onMouseDown={handleMouseDown}
      title={`Drag to place ${label}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        padding: "8px 4px",
        background: "var(--io-surface-sunken)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        cursor: "grab",
        width: "calc(50% - 4px)",
        transition: "border-color 0.1s, background 0.1s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--io-accent)";
        (e.currentTarget as HTMLElement).style.background =
          "color-mix(in srgb, var(--io-accent) 8%, var(--io-surface-sunken))";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--io-border)";
        (e.currentTarget as HTMLElement).style.background =
          "var(--io-surface-sunken)";
      }}
    >
      <div
        style={{
          width: 52,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <ShapeThumbnail shapeId={defaultId} size={44} />
      </div>
      <span
        style={{
          fontSize: 10,
          color: "var(--io-text-secondary)",
          textAlign: "center",
          lineHeight: 1.2,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </button>
  );
}

function EquipmentSection({ collapsed }: { collapsed: boolean }) {
  const loadIndex = useLibraryStore((s) => s.loadIndex);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  if (collapsed) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "8px 4px",
          alignItems: "center",
        }}
      >
        {EQUIPMENT_CATEGORIES.map((cat) => (
          <EquipmentCategoryTile key={cat.id} {...cat} collapsed />
        ))}
      </div>
    );
  }

  return (
    <div sty

--- File: /home/io/io-dev/io/frontend/src/pages/settings/index.tsx ---
import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/auth";

interface NavItem {
  path: string;
  label: string;
  permission?: string;
}

interface NavGroup {
  header: string;
  items: NavItem[];
}

// Nav structure: 7 groups, 18 items total.
// Temporary paths: "Users & Roles" → /settings/users (Phase 3 creates /settings/identity)
//                  "Archive & Backup" → /settings/archive (Phase 6 creates /settings/system)
const NAV_GROUPS: NavGroup[] = [
  {
    header: "Identity & Access",
    items: [
      {
        path: "/settings/identity",
        label: "Users & Roles",
        permission: "system:manage_users",
      },
    ],
  },
  {
    header: "Authentication",
    items: [
      {
        path: "/settings/auth-providers",
        label: "Auth Providers",
        permission: "auth:configure",
      },
      {
        path: "/settings/mfa",
        label: "MFA Policy",
        permission: "auth:configure",
      },
      {
        path: "/settings/scim",
        label: "SCIM Provisioning",
        permission: "auth:configure",
      },
    ],
  },
  {
    header: "Media",
    items: [
      {
        path: "/settings/camera-streams",
        label: "Camera Streams",
        permission: "video_streams:manage",
      },
    ],
  },
  {
    header: "Data Sources",
    items: [
      {
        path: "/settings/opc-sources",
        label: "OPC Sources",
        permission: "system:opc_config",
      },
      {
        path: "/settings/points",
        label: "Point Management",
        permission: "system:point_config",
      },
      {
        path: "/settings/expressions",
        label: "Expressions",
        permission: "system:expression_manage",
      },
      {
        path: "/settings/import",
        label: "Import & Streaming",
        permission: "system:import_connections",
      },
    ],
  },
  {
    header: "Notifications",
    items: [
      {
        path: "/settings/email",
        label: "Email",
        permission: "email:configure",
      },
      {
        path: "/settings/sms-providers",
        label: "SMS Providers",
        permission: "sms:configure",
      },
    ],
  },
  {
    header: "System",
    items: [
      {
        path: "/settings/system-health",
        label: "System Health",
        permission: "system:monitor",
      },
      {
        path: "/settings/system",
        label: "Archive & Backup",
        permission: "system:backup",
      },
      {
        path: "/settings/certificates",
        label: "Certificates",
        permission: "system:admin",
      },
    ],
  },
  {
    header: "Content & Export",
    items: [
      {
        path: "/settings/report-scheduling",
        label: "Report Scheduling",
        permission: "reports:schedule_manage",
      },
      {
        path: "/settings/export-presets",
        label: "Export Presets",
        permission: "system:admin",
      },
      {
        path: "/settings/my-exports",
        label: "My Exports",
      },
      {
        path: "/settings/bulk-update",
        label: "Bulk Update",
        permission: "system:bulk_update",
      },
      {
        path: "/settings/snapshots",
        label: "Change Snapshots",
        permission: "system:change_backup",
      },
      {
        path: "/settings/recognition",
        label: "Recognition",
        permission: "recognition:manage",
      },
    ],
  },
  {
    header: "About",
    items: [
      { path: "/settings/eula", label: "EULA" },
      { path: "/settings/about", label: "About" },
    ],
  },
];

function hasPermission(permissions: string[], permission?: string): boolean {
  if (!permission) return true;
  return permissions.includes("*") || permissions.includes(permission);
}

export default function SettingsShell() {
  const { user } = useAuthStore();
  const permissions = user?.permissions ?? [];

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      hasPermission(permissions, item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <aside
        style={{
          width: "220px",
          borderRight: "1px solid var(--io-border)",
          background: "var(--io-surface-secondary)",
          flexShrink: 0,
          padding: "8px",
          overflowY: "auto",
        }}
      >
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.header}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--io-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: `${groupIndex === 0 ? "4px" : "12px"} 8px 6px`,
                userSelect: "none",
              }}
            >
              {group.header}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: "block",
                  padding: "7px 10px 7px 8px",
                  borderLeft: isActive
                    ? "2px solid var(--io-accent)"
                    : "2px solid transparent",
                  borderRadius: "var(--io-radius)",
                  marginBottom: "2px",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? "var(--io-accent)"
                    : "var(--io-text-secondary)",
                  background: isActive
                    ? "var(--io-accent-subtle)"
                    : "transparent",
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        <Outlet />
      </div>
    </div>
  );
}

--- File: /home/io/io-dev/io/ui-audit/06-claim-a-plan.md ---
# Claim A Work Plan — App Shell Convergence

**Derived from:** `ui-audit/02-comparison.md` (post-reconciliation), `ui-audit/04-recommendations.md`, `ui-audit/05-claim-c-deferral.md`
**Scope:** `index.css` token registry, left nav (sidebar), top-bar styling. Excludes Claim B (shared style constants, shared components) and Claim C (canvas/work-surface containers, shared graphics CSS).
**Date:** 2026-05-27
**Status:** Token registry gaps in progress — see Section 1.1 for per-item status

---

## Section 1 — Scope: Concrete Changes Required

### 1.1 Category A — Token Registry Gaps

All changes are additions or value corrections to `index.css`. No existing tokens are deleted.

| # | Token | Status | Proposed Fix | Source |
|---|---|---|---|---|
| A1 | `--io-bg` | ✅ Done 2026-05-27 | `--io-bg: var(--io-surface-primary)` | 02 Cat 1 Console Deviations; 04 Cat 1 |
| A2 | `--io-text` | ✅ Done 2026-05-27 | `--io-text: var(--io-text-primary)` | 02 Cat 1 Console+Designer Deviations; 02 Cat 9 Console+Designer Deviations; 04 Cat 1 |
| A3 | `--io-surface-hover` | ✅ Done 2026-05-27 | `--io-surface-hover: var(--io-surface-elevated)` | 02 Cat 4 Designer Deviations; 04 Cat 1 |
| A4 | `--io-font-sans` | ✅ Done 2026-05-27 | `--io-font-sans: "InterVariable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif` — matched body selector font stack. Defined in `:root` only (static across themes, same pattern as `--io-font-mono`). | 02 Cat 1 Designer Deviations; 02 Cat 4 Designer Deviations; 04 Cat 1 |
| A5 | `--io-text-on-accent` | ✅ Done 2026-05-27 | `--io-text-on-accent: var(--io-accent-foreground)` | 02 Cat 1 Settings Deviations; 02 Cat 6 Settings Deviations; 04 Cat 1 |
| A6 | `--io-error` | ✅ Done 2026-05-27 | `--io-error: var(--io-danger)` | 02 Cat 10 Designer Deviations; 02 List 2 #7; 04 Cat 1 |
| A7 | `--io-surface-raised` | ✅ Done 2026-05-27 | `--io-surface-raised: var(--io-surface-elevated)` | 02 Cat 7 Designer Deviations; 02 List 2 #7 |
| A8 | `--io-accent-muted` | ⚠ Skipped — consumer fix preferred over new token | Only usage: `PromoteToShapeWizard.tsx:2168` — stepper progress bars, completed-step color, with fallback `#3b82f6` (info blue). No other wizard uses this token. `RecognitionWizard` uses hardcoded greens for completed steps; no shared pattern exists. User direction: change `PromoteToShapeWizard.tsx:2168` to use an existing token instead of defining a one-off `--io-accent-muted`. Candidate: `var(--io-accent-subtle)` (rgba(45,212,191,0.1)) — readable teal tint for a completed bar. **Action required in a consumer-file pass:** update `PromoteToShapeWizard.tsx:2168` from `"var(--io-accent-muted, #3b82f6)"` to `"var(--io-accent-subtle)"`. Do NOT define `--io-accent-muted` in index.css. | 02 List 2 #7 |
| A9 | `--io-overlay` | ✅ Done 2026-05-27 | `--io-overlay: var(--io-modal-backdrop)`. Pre-condition verified: `--io-modal-backdrop → --io-surface-overlay` chain is complete in all three themes. | 02 Cat 11 Settings Deviations; 02 List 2 #7 |
| A10 | `--io-accent-rgb` | ✅ Done 2026-05-27 | Added per-theme: dark=`45 212 191` (#2dd4bf), light=`13 148 136` (#0d9488), hphmi=`20 184 166` (#14b8a6). Comment added in dark theme pointing to light/hphmi values. | 02 List 2 #7 |
| A11 | `--io-alarm-inactive` | ✅ Done 2026-05-27 | `--io-alarm-inactive: #808080` — added to all three themes with identical value. | 04 Cat 8 actions; 05 Section 3.1 |
| A12 | `--io-text-inverse` | ⚠ Skipped — already defined; audit claim was incorrect | Token IS defined in all three theme blocks: dark=#09090b (line 34), light=#ffffff (line 235), hphmi=#0f172a (line 431). Plan entry "Not yet defined" was wrong. No action needed. | 04 Cat 10 actions; 05 Section 3.4 |
| A13 | `--io-z-modal` | ✅ Done 2026-05-27 | Updated per Option B decision: `--io-z-dropdown: 500` (was 200), `--io-z-modal: 1000` (was 300), `--io-z-toast: 2000` (was 700), `--io-z-visual-lock: 1500` (was 500), `--io-z-emergency: 3000` (was 800). Applied to all three theme blocks. Remaining Claim B item: `--io-z-command: 400` and `--io-z-kiosk-auth: 600` are unused in components (CommandPalette hardcodes 3000/3001); adopt tokens + reconcile in Claim B. | 04 Cat 11 actions; 04 Risk R1; 02 List 2 #11 |
| A14 | `--io-sidebar-width` | ✅ Done 2026-05-27 | Updated to 220px in all three theme blocks per Option A decision. No module code changes needed. | 02 Cat 5 Console+Settings+Designer Deviations; 04 Cat 5 |

**Category A total: 14 changes in `index.css`**

Items A1–A3, A5–A7, A9, A11, A12 can be executed unilaterally — target values are clear.
Items A4, A8 require a research step (read index.css root / grep Designer) before writing.
Items A10 requires confirming the dark-theme accent hex before writing.
Items A13, A14 require explicit user decisions before executing.

---

### 1.2 Category B — Shell Drift

Changes to module component files in the sidebar and left-nav layer.

| # | Change | File(s) | Description | Source |
|---|---|---|---|---|
| B1 | ✅ Done 2026-05-27 — Designer left palette background | `frontend/src/pages/designer/DesignerLeftPalette.tsx` | Changed `background: "var(--io-surface)"` → `"var(--io-surface-secondary)"` at `containerStyle` (line 2436). Console and Settings both use `var(--io-surface-secondary)` for their side panels; Designer is one surface tier lighter, creating a visible inconsistency at the module-boundary seam. | 02 Cat 5 Designer Deviations; 04 Cat 5 "Fix: Align Designer left palette background" |
| B2 | ✅ Done 2026-05-27 — Settings active nav item — left-border accent | `frontend/src/pages/settings/index.tsx` (nav item active-state styles) | Added `borderLeft: isActive ? "2px solid var(--io-accent)" : "2px solid transparent"` and set uniform `padding: "7px 10px 7px 8px"` (left padding reduced from 10px to 8px; transparent border reserves the 2px on inactive items so text stays at 10px from edge in both states). | 02 Cat 5 Settings Deviations; 04 Cat 5 "Fix: Settings active nav item" |
| B3 | ✅ Done 2026-05-27 — Sidebar width — 0 file changes | n/a — A14 decided 220px; all module hardcodes already match | No code changes needed. Token `--io-sidebar-width: 220px` is consistent with all hardcodes in Console, Settings, and Designer. | 02 Cat 5 Console+Settings+Designer Deviations; 04 Cat 5 |
| B4 | ✅ Done 2026-05-27 — Settings nav group header — letterSpacing | `frontend/src/pages/settings/index.tsx` (nav group label styles) | Changed `letterSpacing` from `"0.08em"` to `"0.06em"` (line 198). Matches Console palette section labels and Designer `SectionHeader`. | 02 Cat 2 Settings Deviations; 02 Cat 5; 04 Cat 2 typography table; 04 Cat 5 "Fix: Section label typography" |

**Category B total: 4 changes (B3 expands to 3 additional file edits if 240px is chosen in A14; 0 file changes if 220px chosen)**

---

## Section 2 — Multi-Module Implications

### Shell-layer changes (inherited by all 11 modules)

| Change | Scope | Flag for user review? | Reasoning |
|---|---|---|---|
| **A13 — `--io-z-modal` value** | Shell layer; all current and future modules that render dialogs | **Yes** | Every modal in all three modules currently uses z-index values between 1000 and 9999, with no code referencing the existing 300-value token. Choosing the z-index scale now sets a convention inherited by all 11 modules. Risk R1 from `04-recommendations.md`: a full z-index audit across all `zIndex` values in the frontend is recommended before setting definitive scale values, because uncoordinated layer ordering can cause dialogs to appear behind other dialogs or overlapping dropdowns in edge cases. The Claim B dialog work will migrate code to use these tokens; a partial or incorrect scale is harder to fix after migration than before. |
| **A14 — `--io-sidebar-width` decision** | Shell layer; all current and future modules with a side panel | **Yes** | The 8 future modules will be built to this width from day one. Retrofitting after the fact would require touching all 11 modules. The choice between 220px and 240px is a visual design question, not a technical one. 220px is the current practice; 240px is the AppShell reference value. Neither is obviously correct — which is why this needs an explicit decision, not a unilateral call. |
| **A11, A12 — new tokens** | Shell layer (index.css), consumed by Claim C | No | Purely additive. No effect on code that does not reference these tokens. Defined now so Claim C can reference them without revisiting the token layer. |
| **A1–A10 — alias tokens** | Shell layer; resolve broken references globally | No (individually clear) | Additive. Code referencing these undefined tokens will start rendering correctly once the token is defined. No new breakage is possible since undefined tokens already degrade to no-value or browser fallback. Exception: A4 (`--io-font-sans`) must be verified against the document root font-family to avoid introducing a font-stack inconsistency — the implementer must read the root selector before writing this value. |

### Single-module changes (do not affect convention inheritance)

| Change | Module | Flag for user review? | Reasoning |
|---|---|---|---|
| **B1 — Designer palette background** | Designer only | No | Changes one `background` token reference in one file to match what Console and Settings already do. The target value (`--io-surface-secondary`) is already registered and in use by both other modules. |
| **B2 — Settings active nav indicator** | Settings only | No | The AppShell pattern is unambiguous (`borderLeft: 2px solid var(--io-accent)` + padding adjustment). This aligns Settings to the established pattern. |
| **B3 — Sidebar width code changes** | 0–3 modules, conditional on A14 | Depends on A14 decision | The code changes themselves are mechanical once the width value is decided. No separate review needed beyond the A14 decision. |
| **B4 — Settings nav group typography** | Settings only | No | Changes `letterSpacing` from 0.08em to 0.06em in one location. Small typographic alignment to the value that Console and Designer already use. No functional impact. |

---

## Section 3 — Sequencing

Token registry work must precede shell drift work because some drift fixes reference tokens that do not yet exist (e.g., `--io-surface-secondary` and `--io-accent` ARE registered, so B1–B4 are not blocked — but as a general rule, any drift fix that adds a new token reference depends on that token existing in index.css first).

Within token work, independent gaps go first; research-gated or decision-gated items go second and third.

### Pass 1 — Unblocked aliases (no research, no decision needed)

All are `index.css` only. Can land in a single commit.

1. ✅ **A1** — `--io-bg: var(--io-surface-primary)` — Done 2026-05-27
2. ✅ **A2** — `--io-text: var(--io-text-primary)` — Done 2026-05-27
3. ✅ **A3** — `--io-surface-hover: var(--io-surface-elevated)` — Done 2026-05-27
4. ✅ **A5** — `--io-text-on-accent: var(--io-accent-foreground)` — Done 2026-05-27
5. ✅ **A6** — `--io-error: var(--io-danger)` — Done 2026-05-27
6. ✅ **A7** — `--io-surface-raised: var(--io-surface-elevated)` — Done 2026-05-27
7. ✅ **A9** — `--io-overlay: var(--io-modal-backdrop)` — Done 2026-05-27; alias chain verified
8. ✅ **A11** — `--io-alarm-inactive: #808080` — Done 2026-05-27
9. ~~**A12** — `--io-text-inverse: #ffffff`~~ — **SKIPPED**: already defined in all three themes (dark=#09090b, light=#ffffff, hphmi=#0f172a). Plan claim was incorrect.

### Pass 2 — Research-gated tokens (grep / read index.css before writing)

Resolve values, then add in a second `index.css` commit.

10. ✅ **A4** — `--io-font-sans` — Done 2026-05-27; matched `body` selector font stack (`:root` only, same pattern as `--io-font-mono`)
11. ~~**A8** — `--io-accent-muted`~~ — **SKIPPED**: token used in one place only (`PromoteToShapeWizard.tsx:2168`); no shared pattern; fix is to update that consumer to use `var(--io-accent-subtle)` instead. Do not define this token.
12. ✅ **A10** — `--io-accent-rgb` — Done 2026-05-27; per-theme values confirmed and added with inline comment

### Pass 3 — Decision-gated tokens (decisions recorded 2026-05-27)

13. ✅ **A13** — Done 2026-05-27. **Decision: Option B — full z-index scale.**
    - `--io-z-dropdown: 500` (was 200)
    - `--io-z-modal: 1000` (was 300)
    - `--io-z-toast: 2000` (was 700)
    - Applied to all three theme blocks.
    - ✅ **Emergency/toast inversion resolved 2026-05-27:** `--io-z-emergency` raised 800→3000; `--io-z-visual-lock` raised 500→1500 (above modal at 1000, below toast). Both applied in all three themes.
    - ⚠ **Remaining Claim B items:** `--io-z-command: 400` and `--io-z-kiosk-auth: 600` tokens exist only in `tokens.ts`; no component references them. CommandPalette hardcodes `z-index: 3000/3001`. Full token adoption + value reconciliation deferred to Claim B z-index migration.

14. ✅ **A14** — Done 2026-05-27. **Decision: 220px (Option A).**
    - `--io-sidebar-width: 220px` in all three theme blocks. No module code changes.
    - 220px is the official convention.

### Pass 4 — Shell drift fixes (after Passes 1–3 are committed)

Independent of each other; can be in one PR.

15. ✅ **B1** — Designer palette background: `var(--io-surface)` → `var(--io-surface-secondary)` in `DesignerLeftPalette.tsx`. Done 2026-05-27.
16. ✅ **B2** — Settings active nav indicator: added `borderLeft` (accent/transparent) + uniform `padding: "7px 10px 7px 8px"` in `Settings/index.tsx`. Done 2026-05-27.
17. ✅ **B3** — Sidebar width code: **0 file changes** (220px decided in A14 — token update only, no module edits). Done 2026-05-27.
18. ✅ **B4** — Settings nav group `letterSpacing`: 0.08em → 0.06em in `Settings/index.tsx`. Done 2026-05-27.

### Natural PR boundaries

- **PR 1:** Pass 1 + Pass 2 results — pure `index.css` token additions. Minimal review burden; no component code changes.
- **PR 2:** Pass 3 decisions + Pass 4 drift — after user sign-off on A13/A14. Includes 2–5 component file edits.

B3 may be folded into PR 1 if the 220px decision is confirmed before that PR is authored (only updates the token value, no file edits needed).

### Changes that cannot be done as isolated PRs

None of the 18 changes require coordination that prevents isolation. B3 (if 240px) touches 3 files but they are independent of each other. The dependency chain (token before drift) is satisfied by the PR sequence above.

---

## Section 4 — Definition of Done for Claim A

Claim A is complete when all of the following are verifiable:

1. **Zero undefined token references in shell-layer code.** Each token in the set {`--io-bg`, `--io-text`, `--io-surface-hover`, `--io-font-sans`, `--io-text-on-accent`, `--io-error`, `--io-surface-raised`, `--io-overlay`, `--io-accent-rgb`} is defined in `index.css`. Grep confirms no remaining unresolved references in the shell-layer files. Note: `--io-accent-muted` was removed from this set — its single usage in `PromoteToShapeWizard.tsx` was redirected to `var(--io-accent-subtle)`; the token is intentionally not defined.

2. **One new token defined.** `--io-alarm-inactive` exists in `index.css` with value `#808080`. (`--io-text-inverse` was already defined before this workstream began — A12 was skipped; see table.)

3. **`--io-z-modal` is at a realistic value.** Token is ≥1000 and consistent with the chosen z-index scale (whether single-token or full scale per A13 decision).

4. **`--io-sidebar-width` matches code.** Token value and hardcoded widths in all three modules are identical — either all 220px or all 240px, per A14 decision. No module contradicts the token.

5. **Designer left palette background matches Console and Settings.** Visual inspection in the running app confirms `DesignerLeftPalette` renders at the same surface tier as `ConsolePalette` and the Settings sidebar.

6. **Settings active nav item shows left-border accent.** Visual inspection confirms a 2px teal left border (`var(--io-accent)`) on the active nav item in Settings, matching the AppShell reference.

7. **Settings nav group header letterSpacing is 0.06em.** Matches Console palette section labels and Designer `SectionHeader` per the Cat 2 typography table in `04-recommendations.md`.

8. **`02-comparison.md` Claim A rows annotated.** The following rows in the comparison file are updated with `Fixed [date]: [commit/PR]` notes:
   - Cat 1: Console/Designer/Settings undefined-token rows
   - Cat 5: sidebar-width deviation rows (Console, Settings, Designer)
   - Cat 5: Settings active-indicator deviation row

---

## Section 5 — Implications for Future Work

### 5.1 Implications for the Claim C Revisit (Workstream 5)

Per `05-claim-c-deferral.md` Section 5, Claim C reopens only after Claim A and Claim B are both complete and reviewed. The following Claim A items have direct downstream effects on Claim C scope:

- **A11 and A12 are consumed by Claim C.** `--io-alarm-inactive` enables `alarmFlash.css` hex migration (05 Section 3.1). `--io-text-inverse` enables the DesignerCanvas resize handle fix (05 Section 3.4). Defining them now means Claim C can reference them immediately without re-entering the token layer.

- **A6 (`--io-error` alias) and A1 (`--io-bg` alias) resolve Claim C imperfections automatically.** Once the aliases exist in `index.css`, DesignerCanvas's context menu destructive color (05 Section 3.5) and WorkspaceGrid's container background (05 Section 3.2) start rendering correctly without any code change in those Claim C files. This reduces the minimum touch-point count inside the high-risk 12,067-line `DesignerCanvas.tsx`.

- **A13 (z-index scale) is a prerequisite for Claim C z-index work.** DesignerCanvas uses internal `zIndex` values in the 300–2000 range. When Claim C touches DesignerCanvas, those values must be coordinated with the scale established in A13. The scale decision is a dependency, not a blocker — Claim C should not begin its z-index work until A13 is decided and committed.

- **A14 (sidebar width) does not directly affect the canvas seam.** The canvas containers (WorkspaceGrid, DesignerCanvas) span the remaining viewport width after the sidebar. The canvas-to-sidebar boundary is clean regardless of which value (220px or 240px) is chosen, as long as the token and code are consistent.

### 5.2 Conventions Established for the Eight-Module Rebuild

The eight modules being rebuilt around the converged Console/Designer foundation will inherit the shell conventions locked in by Claim A. The following must be treated as non-negotiable constraints for all rebuilt modules:

| Convention | Value | Applies to |
|---|---|---|
| Side panel background | `var(--io-surface-secondary)` | Any rebuilt module with a left or right panel. Designer's drift to `var(--io-surface)` is being corrected in B1 to establish this as the unambiguous standard. |
| Active nav item indicator | `borderLeft: 2px solid var(--io-accent)` + adjusted padding | Any rebuilt module with a sidebar nav list. |
| Sidebar width | `var(--io-sidebar-width)` (value per A14 decision) | All side panels in rebuilt modules must use this token, not a hardcoded integer. The value may not be known until A14 is decided — this token must be resolved before any rebuilt module's panel layout is coded. |
| Nav group header typography | 11px / 600 / uppercase / 0.06em / `var(--io-text-muted)` | All section-group labels within sidebar nav panels. |
| Toolbar surface | `var(--io-surface)` + `borderBottom: 1px solid var(--io-border)` | Module toolbars. This is the Console+Designer convention adopted in `04-recommendations.md` Cat 3 — not `var(--io-surface-primary)` (which is the AppShell reference but is not the adopted target for module toolbars). |
| Token hygiene | No token reference may be used that is not defined in `index.css` | Treat any undefined token reference in a rebuilt module as a blocking defect. The token list cleared by Claim A is the authoritative registry; nothing outside it may be referenced. |

**One Claim A item must be resolved before any of the eight modules begins panel-layout work:** A14 (`--io-sidebar-width` value). Building any panel at a hardcoded width and later discovering the chosen value was different requires an eleven-module edit. Decide it once, enforce it everywhere.

---

Produce the review now.
```


## #TURN_END

_2026-05-27T07:35:00+00:00_

---


## #PROMPT

_2026-05-27T07:35:05+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
bash /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #TURN_END

_2026-05-27T07:35:05+00:00_

---

---

Produce the summary now.
```


## #TURN_END

_2026-05-27T07:37:28+00:00_

---


## #PROMPT

_2026-05-27T07:38:20+00:00_

```
~wrapup~
```


## #BASH
_Generate work unit summary_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt)
/home/io/io-dev/io/.claude/hooks/scripts/generate-summary.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #BASH
_Generate summary with project dir set_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt)
CLAUDE_PROJECT_DIR=/home/io/io-dev/io /home/io/io-dev/io/.claude/hooks/scripts/generate-summary.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #BASH
_Run shallow review and update docs_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claire/state/current_log.txt 2>/dev/null || cat /home/io/io-dev/io/.claude/state/current_log.txt)
CLAUDE_PROJECT_DIR=/home/io/io-dev/io /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID" "shallow" && CLAUDE_PROJECT_DIR=/home/io/io-dev/io /home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #TURN_END

_2026-05-27T07:38:20+00:00_

---

