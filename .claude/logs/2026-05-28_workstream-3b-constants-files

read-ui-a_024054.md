# Work Unit Log: workstream-3b-constants-files

read-ui-a

Started: 2026-05-28T02:40:54+00:00
Session: 1e0f20f9-2a81-4d6a-8292-8a1b6ef58604

---


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/buttons.ts` (1995 chars written)

_2026-05-28T02:41:58+00:00_


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/buttons.css` (268 chars written)

_2026-05-28T02:42:02+00:00_


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/inputs.ts` (1441 chars written)

_2026-05-28T02:42:10+00:00_


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/inputs.css` (433 chars written)

_2026-05-28T02:42:15+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (47→69 chars)

_2026-05-28T02:42:19+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (46→68 chars)

_2026-05-28T02:42:22+00:00_


## #PROMPT

_2026-05-28T02:42:28+00:00_

```
~initprompt~ workstream-3b-constants-files

Read ui-audit/08-claim-b-plan.md section one for the constants files plan. Read ui-audit/05-claim-c-deferral.md to confirm exclusions.

Goal: create the constants files exactly as planned. Do not promote components in this prompt. Do not migrate consumers in this prompt. Constants files only.

For each constants file in the plan:
1. Create the file at the location specified in the plan.
2. Define the constants with the values specified in the plan.
3. Add comments referencing the comparison file rows that justify each value.
4. Do not add constants beyond what the plan specifies. If you encounter a styling decision that seems like it should be captured but isn't in the plan, add it to ui-audit/08-claim-b-plan.md section six as a deferred candidate rather than adding it to the file.
5. Do not migrate any consumer files in this prompt. The constants files should be additions only.

For any plan entry where you find the planned value cannot be implemented as specified (e.g. the value would conflict with an existing token from Claim A, or the planned API does not match how consumers actually use the styling), stop and ask rather than improvising.

Update ui-audit/08-claim-b-plan.md by marking each completed constants file with a status flag and the date.

When done print: count of constants files created, the file paths, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the plan and exclusions files before starting.


## #ASSISTANT

Now I'll verify token existence in `index.css` per the L7 requirement before writing anything.


## #BASH
_Verify button token definitions in index.css_

```bash
grep -E "(--io-accent|--io-accent-foreground|--io-text-secondary|--io-border|--io-danger|--io-radius):" /home/io/io-dev/io/frontend/src/index.css
```


## #BASH
_Verify input token definitions in index.css_

```bash
grep -E "(--io-surface-sunken|--io-input-bg|--io-text-primary):" /home/io/io-dev/io/frontend/src/index.css
```


## #ASSISTANT

All tokens confirmed. `--io-input-bg` is an alias for `--io-surface-sunken` across all themes. Now checking the directory structure.


## #BASH
_Check if shared/styles directory exists_

```bash
ls /home/io/io-dev/io/frontend/src/shared/styles/ 2>/dev/null && echo "EXISTS" || echo "NOT FOUND"
```


## #BASH
_List shared directory contents_

```bash
ls /home/io/io-dev/io/frontend/src/shared/
```


## #BASH
_Find settingsStyles.ts for pattern reference_

```bash
find /home/io/io-dev/io/frontend/src -name "settingsStyles.ts" | head -5
```


## #ASSISTANT

All tokens confirmed. `--io-input-bg` is an alias for `--io-surface-sunken` in every theme. Now creating the four constants files.


## #ASSISTANT

The LSP diagnostic is pre-existing and unrelated to these new files. Creating the final companion CSS file.


## #ASSISTANT

Now updating the plan file to mark both constants files complete.


## #TURN_END

_2026-05-28T02:42:29+00:00_

---


## #PROMPT

_2026-05-28T03:25:16+00:00_

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
# Work Unit Log: workstream-3b-constants-files

read-ui-a

Started: 2026-05-28T02:40:54+00:00
Session: 1e0f20f9-2a81-4d6a-8292-8a1b6ef58604

---


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/buttons.ts` (1995 chars written)

_2026-05-28T02:41:58+00:00_


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/buttons.css` (268 chars written)

_2026-05-28T02:42:02+00:00_


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/inputs.ts` (1441 chars written)

_2026-05-28T02:42:10+00:00_


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/inputs.css` (433 chars written)

_2026-05-28T02:42:15+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (47→69 chars)

_2026-05-28T02:42:19+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (46→68 chars)

_2026-05-28T02:42:22+00:00_


## #PROMPT

_2026-05-28T02:42:28+00:00_

```
~initprompt~ workstream-3b-constants-files

Read ui-audit/08-claim-b-plan.md section one for the constants files plan. Read ui-audit/05-claim-c-deferral.md to confirm exclusions.

Goal: create the constants files exactly as planned. Do not promote components in this prompt. Do not migrate consumers in this prompt. Constants files only.

For each constants file in the plan:
1. Create the file at the location specified in the plan.
2. Define the constants with the values specified in the plan.
3. Add comments referencing the comparison file rows that justify each value.
4. Do not add constants beyond what the plan specifies. If you encounter a styling decision that seems like it should be captured but isn't in the plan, add it to ui-audit/08-claim-b-plan.md section six as a deferred candidate rather than adding it to the file.
5. Do not migrate any consumer files in this prompt. The constants files should be additions only.

For any plan entry where you find the planned value cannot be implemented as specified (e.g. the value would conflict with an existing token from Claim A, or the planned API does not match how consumers actually use the styling), stop and ask rather than improvising.

Update ui-audit/08-claim-b-plan.md by marking each completed constants file with a status flag and the date.

When done print: count of constants files created, the file paths, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the plan and exclusions files before starting.


## #ASSISTANT

Now I'll verify token existence in `index.css` per the L7 requirement before writing anything.


## #BASH
_Verify button token definitions in index.css_

```bash
grep -E "(--io-accent|--io-accent-foreground|--io-text-secondary|--io-border|--io-danger|--io-radius):" /home/io/io-dev/io/frontend/src/index.css
```


## #BASH
_Verify input token definitions in index.css_

```bash
grep -E "(--io-surface-sunken|--io-input-bg|--io-text-primary):" /home/io/io-dev/io/frontend/src/index.css
```


## #ASSISTANT

All tokens confirmed. `--io-input-bg` is an alias for `--io-surface-sunken` across all themes. Now checking the directory structure.


## #BASH
_Check if shared/styles directory exists_

```bash
ls /home/io/io-dev/io/frontend/src/shared/styles/ 2>/dev/null && echo "EXISTS" || echo "NOT FOUND"
```


## #BASH
_List shared directory contents_

```bash
ls /home/io/io-dev/io/frontend/src/shared/
```


## #BASH
_Find settingsStyles.ts for pattern reference_

```bash
find /home/io/io-dev/io/frontend/src -name "settingsStyles.ts" | head -5
```


## #ASSISTANT

All tokens confirmed. `--io-input-bg` is an alias for `--io-surface-sunken` in every theme. Now creating the four constants files.


## #ASSISTANT

The LSP diagnostic is pre-existing and unrelated to these new files. Creating the final companion CSS file.


## #ASSISTANT

Now updating the plan file to mark both constants files complete.


## #TURN_END

_2026-05-28T02:42:29+00:00_

---
---



DIFF OF CHANGES:
---
diff --git a/ui-audit/08-claim-b-plan.md b/ui-audit/08-claim-b-plan.md
index dfd62294..1803a2db 100644
--- a/ui-audit/08-claim-b-plan.md
+++ b/ui-audit/08-claim-b-plan.md
@@ -9,7 +9,7 @@
 
 ## Section 1 — Constants Files Plan
 
-### 1.1 `frontend/src/shared/styles/buttons.ts`
+### 1.1 `frontend/src/shared/styles/buttons.ts` — **DONE 2026-05-28**
 
 **Goal:** Replace the per-module button style systems with a single importable constants file. No React component; style objects only.
 
@@ -112,7 +112,7 @@ Also export a `buttonBaseClass = "io-btn"` string constant pairing with a compan
 
 ---
 
-### 1.2 `frontend/src/shared/styles/inputs.ts`
+### 1.2 `frontend/src/shared/styles/inputs.ts` — **DONE 2026-05-28**
 
 **Goal:** Single importable input style object replacing per-module duplicates. No React component.
 
---

FULL FILE CONTENTS (for surrounding-code analysis):
---

--- File: /home/io/io-dev/io/frontend/src/shared/styles/buttons.css ---
/* Companion to shared/styles/buttons.ts */
/* Cat 6, Deviations: hover and focus-visible rules cannot be expressed as inline style objects */

.io-btn:hover {
  opacity: 0.85;
}

.io-btn:focus-visible {
  outline: 2px solid var(--io-accent);
  outline-offset: 2px;
}

--- File: /home/io/io-dev/io/frontend/src/shared/styles/buttons.ts ---
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
  borderRadius: "var(--io-radius)",     // Cat 6, Deviations: Settings + Designer IconBtn agree; Console integers corrected
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

export const btnSecondary: CSSProperties = {
  padding: "8px 16px",
  background: "transparent",            // Cat 6, Deviations: BulkUpdate non-standard var(--io-surface-sunken) corrected
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,                       // Cat 6, Deviations: align with primary for visual consistency at same type size
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

--- File: /home/io/io-dev/io/frontend/src/shared/styles/inputs.css ---
/* Companion to shared/styles/inputs.ts */
/* Cat 7, Deviations: replaces outline:none pattern used across all three modules */
/* Applies styled :focus-visible ring; browser default is suppressed only when a visible replacement is shown */

input.io-input:focus-visible,
select.io-input:focus-visible,
textarea.io-input:focus-visible {
  outline: 2px solid var(--io-accent);
  outline-offset: 0;
  border-color: var(--io-accent);
}

--- File: /home/io/io-dev/io/frontend/src/shared/styles/inputs.ts ---
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
  borderRadius: "var(--io-radius)",        // Cat 7, Deviations: Settings canonical token; BulkUpdate "6px" string corrected
  color: "var(--io-text-primary)",         // Cat 7, Deviations: canonical token
  fontSize: "13px",
  boxSizing: "border-box",                 // Cat 7, Settings: prevents width overflow; not always set in Console/Designer
  // No outline:none — use inputClassName + inputs.css for an accessible :focus-visible ring
};

// Spread className={inputClassName} to get the :focus-visible rule from companion inputs.css
export const inputClassName = "io-input";

--- File: /home/io/io-dev/io/ui-audit/08-claim-b-plan.md ---
# Claim B Work Plan — Module Framework Layer Convergence

**Derived from:** `ui-audit/02-comparison.md` (post-reconciliation), `ui-audit/04-recommendations.md`, `ui-audit/05-claim-c-deferral.md`, `ui-audit/06-claim-a-plan.md`  
**Scope:** `shared/styles/` constants files (buttons, inputs); four promoted components (FieldLabel, StatusBadge, Dialog, ConfirmDialog). Excludes Claim C canvas layer.  
**Date:** 2026-05-28  
**Status:** Planning  

---

## Section 1 — Constants Files Plan

### 1.1 `frontend/src/shared/styles/buttons.ts` — **DONE 2026-05-28**

**Goal:** Replace the per-module button style systems with a single importable constants file. No React component; style objects only.

#### Comparison rows establishing converged values

| Row | Evidence |
|-----|----------|
| Cat 6, Shared column | "All three use `var(--io-accent)` for primary action button backgrounds; all three use `1px solid var(--io-border)` for secondary/outline borders" |
| Cat 6, List 3 Item 3 | "Settings `settingsStyles.ts` named-variant pattern is the starting point. `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall` are named, exported constants with clear semantic intent." |
| Cat 6, List 1 Item 6 | "All three modules ignore the six `--io-btn-*` tokens" — confirms the right approach is named style objects, not migrating to those tokens |
| Cat 6, Deviations, Settings | After Claim A (A5), `--io-text-on-accent` is now a valid alias for `var(--io-accent-foreground)` — `btnPrimary` now resolves correctly |
| 04-recommendations Cat 6 | Explicit variant definitions with corrected token references |

#### Decisions where modules have converged — capture as-is

| Property | Value | Basis |
|----------|-------|-------|
| Primary background | `var(--io-accent)` | All three agree (Cat 6 Shared) |
| Secondary/danger border | `1px solid var(--io-border)` / `1px solid var(--io-danger)` | All three agree on secondary border pattern |
| Padding (primary/secondary) | `8px 16px` | Settings canonical |
| Base font size | `13px` | Settings canonical (Console also 13px on some buttons; Designer text-actions 13px) |
| Cursor | `pointer` | Universal |

#### Decisions where modules diverge — recommended standardization

| Property | Console | Designer | Settings | Recommended | Reasoning |
|----------|---------|----------|----------|-------------|-----------|
| Primary text color | `#fff` hardcoded | `#09090b` or `#fff` hardcoded | `var(--io-text-on-accent)` (alias for `var(--io-accent-foreground)`) | `var(--io-accent-foreground)` | The canonical token; `--io-text-on-accent` is a Claim A alias for it. Both names work, canonical is preferred. |
| borderRadius | 3–6 (inconsistent integers) | `var(--io-radius)` on IconBtn, `6` integer on text-actions | `var(--io-radius)` | `var(--io-radius)` | Settings and Designer IconBtn agree; Console inconsistency is the gap to close. `var(--io-radius)` = 6px currently. |
| Secondary fontWeight | Not set (browser default 400) | Not set | Not set | `600` | The audit notes btnSecondary in Settings lacks fontWeight (Cat 6 Deviations). Should match primary for visual consistency at the same type size. Align all variants: 600. |
| Hover state | None on any variant | IconBtn has `transition: background 0.1s, color 0.1s` | None | `transition: opacity 0.1s` or `:focus-visible` outline | Inline styles cannot express CSS pseudo-classes; constants file exports base style objects; hover requires a companion CSS file or Tailwind class. Plan: export `buttonHoverClass = "io-btn"` to pair with a minimal `shared/styles/buttons.css` that sets `:hover { opacity: 0.85 }` and `:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 2px }`. Defer full DOM-mutation hover removal to consumer migration. |
| BulkUpdate.tsx BTN_SECONDARY background | `var(--io-surface-sunken)` | — | `transparent` (canonical) | `transparent` | BulkUpdate's secondary uses a surface bg instead of transparent; non-standard. Migrate to shared constants. |

#### Variant specifications for `buttons.ts`

```ts
btnPrimary: {
  padding: "8px 16px",
  background: "var(--io-accent)",
  color: "var(--io-accent-foreground)",
  border: "none",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

btnSecondary: {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

btnDanger: {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--io-danger)",
  border: "1px solid var(--io-danger)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

btnSmall: {
  padding: "4px 10px",
  background: "transparent",
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "12px",
  cursor: "pointer",
}
```

Also export a `buttonBaseClass = "io-btn"` string constant pairing with a companion `buttons.css` that adds the `:hover` opacity and `:focus-visible` outline. The CSS is two rules; the constant signals to consumers they should also spread the className.

#### Consumer files to migrate (deferred to execution unless part of initial scope)

| File | What to change |
|------|----------------|
| `pages/settings/BulkUpdate.tsx` | Replace local `BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_DANGER` constants with shared imports |
| `pages/settings/Import.tsx` | Any inline button styles not using settingsStyles |
| `pages/settings/Sessions.tsx` | Local `BTN_PRIMARY`/`BTN_SECONDARY`/`BTN_DANGER`/`BTN_DANGER` (slightly non-canonical variants) |
| `pages/console/index.tsx` | Toolbar and modal buttons using inline styles |
| `pages/console/PaneConfigModal.tsx` | Modal action buttons |
| `pages/console/PaneWrapper.tsx` | Pane action buttons |
| `pages/console/AlarmListPane.tsx` | Ack/action buttons |
| `pages/console/PointTablePane.tsx` | Action buttons |
| `pages/designer/DesignerToolbar.tsx` | Text-action buttons (lines 1618–1693) using `borderRadius: 6` integers |
| `pages/designer/DesignerImport.tsx` | Primary button with `#3b82f6` fallback (line 65) |
| `pages/designer/DesignerGraphicsList.tsx` | Action buttons |

**Note:** Designer's `IconBtn` is a module-local primitive (`DesignerToolbar.tsx:904–948`) and is not in scope for migration to buttons.ts. It already has good hover/transition behavior. Leave it as-is.

---

### 1.2 `frontend/src/shared/styles/inputs.ts` — **DONE 2026-05-28**

**Goal:** Single importable input style object replacing per-module duplicates. No React component.

#### Comparison rows establishing converged values

| Row | Evidence |
|-----|----------|
| Cat 7, Shared column | "All three: `border: 1px solid var(--io-border)`; `outline: none`" — border converged; outline:none is the pattern to fix |
| Cat 7, List 3 Item 1 | "Settings `settingsStyles.ts` defines a single named `inputStyle` object that propagates automatically to all pages that import it. The `settingsStyles` approach is the pattern most easily extended across other modules." |
| Cat 7, Notes | "`settingsStyles.ts inputStyle` is the closest to a shared pattern; divergence in `Import`/`BulkUpdate`/`Sessions` is a maintenance liability" |
| 04-recommendations Cat 7 | "Standard input object: `background: var(--io-surface-sunken)`, `border: 1px solid var(--io-border)`, `borderRadius: var(--io-radius)`, `padding: 8px 10px`, `fontSize: 13px`, `color: var(--io-text-primary)`" |

#### Decisions where modules have converged — capture as-is

| Property | Value | Basis |
|----------|-------|-------|
| Border | `1px solid var(--io-border)` | All three agree (Cat 7 Shared) |
| Checkbox accent | `accentColor: "var(--io-accent)"` | Settings consensus; Console uses it in some places |

#### Decisions where modules diverge — recommended standardization

| Property | Console | Designer | Settings canonical | Recommended | Reasoning |
|----------|---------|----------|-------------------|-------------|-----------|
| Background | `--io-surface-secondary` or `--io-surface-elevated` (inconsistent) | `--io-surface` (RightPanel), `--io-input-bg` (ShapePointSelector), `--io-surface-sunken` (PointPickerModal) | `--io-surface-sunken` | `var(--io-surface-sunken)` | Settings canonical is the deepest inset surface, appropriate for inputs embedded in forms. Three-module divergence; `--io-surface-sunken` is the most semantically correct choice and aligns with `--io-input-bg` (registered at index.css:131 — same visual value). |
| borderRadius | `6` or `4` (inconsistent integers) | `var(--io-radius)` or `4` integer (mixed) | `var(--io-radius)` | `var(--io-radius)` | Settings canonical uses the token; all others should match. |
| Padding | `4px 7px` (Designer RightPanel smaller for compact panels) | `4px 7px` or `8px 10px` | `8px 10px` | `8px 10px` | Settings canonical; matches the 13px font size. Designer RightPanel inputs at 4px 7px are intentionally compact for the inspector; those should NOT be migrated — that's a module-local exception (see scope note below). |
| fontSize | `12px` (Designer RightPanel) or `13px` | `13px` | `13px` | `13px` | |
| color | `var(--io-text)` (undefined, now alias via A2) | not always set | `var(--io-text-primary)` | `var(--io-text-primary)` | Canonical token; `--io-text` alias also works but use canonical |
| outline | `none` everywhere | `none` | `none` | Remove `outline: none` from inputStyle; rely on companion CSS | `outline: none` removes accessibility. The constant itself should not suppress the focus ring. Export a companion `inputs.css` with `input.io-input:focus-visible, select.io-input:focus-visible, textarea.io-input:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 0; border-color: var(--io-accent); }` — and export `inputClassName = "io-input"` for consumers to add. This fixes the focus ring in one place. |
| boxSizing | `border-box` in Settings | not always set | `border-box` | `border-box` | Prevents width overflow; all inputs should have it. |

**Scope note on Designer RightPanel:** `DesignerRightPanel.tsx` uses a compact `inputStyle` (`padding: "4px 7px"`, `fontSize: 12`) for the inspector panel where vertical space is at a premium. Do NOT migrate these to the shared inputStyle — the different size is intentional. The shared inputs.ts targets form-style inputs in modals, settings pages, and palette search boxes, not inspector panel fields. Flag this in migration tracking.

#### Variant specifications for `inputs.ts`

```ts
inputStyle: {
  width: "100%",
  padding: "8px 10px",
  background: "var(--io-surface-sunken)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  boxSizing: "border-box",
  // No outline:none — use inputClassName + inputs.css for focus ring
}

inputClassName = "io-input"  // pair with companion inputs.css
```

#### Consumer files to migrate

| File | What to change |
|------|----------------|
| `pages/settings/Import.tsx` | Own `inputStyle` constant (diverges from settingsStyles) |
| `pages/settings/BulkUpdate.tsx` | `borderRadius: "6px"` string instead of `var(--io-radius)`; local SELECT constant |
| `pages/settings/Sessions.tsx` | Local inline input styles |
| `pages/console/PaneConfigModal.tsx` | Multiple inline `outline: none` inputs (lines 79, 319, 369) |
| `pages/console/PaneWrapper.tsx` | Inline input (line 1054) |
| `pages/console/ConsolePalette.tsx` | Search input (line 419) |
| `pages/console/index.tsx` | Inline inputs (lines 3540, 3569) |
| `pages/designer/PointPickerModal.tsx` | Local inputStyle (different bg token) |

**Not in scope for migration:** `DesignerRightPanel.tsx` local `inputStyle` (compact panel inputs — intentionally different), `ShapePointSelector.tsx` (already uses `--io-input-bg` and `--io-input-border` correctly — leave as-is), `AuthProviders.tsx` `<style>` tag for checkbox accent-color (separate cleanup item).

---

## Section 2 — Component Promotions Plan

### 2.1 FieldLabel

#### Source-of-truth location

`frontend/src/pages/designer/DesignerRightPanel.tsx:201–217` — function `FieldLabel({ children })`. This is the only reusable label primitive using correct HTML semantics (`<label>` element) in any of the three modules (Cat 9, List 3 Item 6). Settings `labelStyle` uses a different convention (12px/500/no-uppercase) and is distributed as a style constant, not a component. Console has no label component.

Use Designer DesignerRightPanel as the base; make one size adjustment per the Cat 2 convergence table.

#### API surface for the promoted component

```tsx
interface FieldLabelProps {
  children: React.ReactNode;
  htmlFor?: string;  // passes through to <label> for="..." association
}
```

No additional props. `display: block`, `fontSize: 11`, `fontWeight: 600`, `textTransform: "uppercase"`, `letterSpacing: "0.05em"`, `color: "var(--io-text-muted)"`, `marginBottom: 3`.

The only change from the source: `fontSize: 10` → `fontSize: 11` per the Cat 2 table recommendation ("Form field label: 11px / 600 / uppercase / 0.05em / `--io-text-muted`"). All other properties preserved exactly.

#### Target location

`frontend/src/shared/components/FieldLabel.tsx`

#### Consumer files to migrate

| File | Current state | Migration action |
|------|---------------|-----------------|
| `pages/designer/DesignerRightPanel.tsx` | Defines and uses FieldLabel locally (14+ usages at lines 240, 513, 542, 1837, 2274, 2301, 2366, 4038, 4614, 4670, 4798, 4840, 4924, and more) | Remove local definition; add import from shared. **This is the primary migration — zero call-site changes, only change the definition location and import path.** |
| `pages/console/PaneConfigModal.tsx` | Inline `<div>` elements with label-like styles | Replace inline divs with `<FieldLabel>`. Light refactoring; no substantive risk. |
| Settings pages using inline label divs | Various; `labelStyle` constant gives a different visual treatment | These pages use 12px/500/no-uppercase labels via `labelStyle`. The promoted FieldLabel is 11px/600/uppercase. Do not force-migrate settings pages — the Settings form-label convention is visually distinct and internally consistent. **Do NOT migrate Settings `labelStyle` usages to FieldLabel in this workstream.** Revisit in a typography-alignment pass (Phase 5 in recommendations). |

**Risk items:** None for the DesignerRightPanel migration (mechanical import change). PaneConfigModal migration is light but requires verifying each `<div>` label is semantically equivalent to a `<label>` and has a corresponding input target for `htmlFor`.

---

### 2.2 StatusBadge

#### Source-of-truth location

**Base: `frontend/src/pages/settings/Import.tsx:72–110`** — function `StatusBadge({ status })` using token-pair lookup (`bg: "var(--io-success-subtle)", color: "var(--io-success)"` etc.). This is the cleanest implementation: no color math, no string interpolation, adapts to themes automatically (Cat 8, List 3 Item 2).

The `OpcSources.tsx:156–185` post-fix version adds a dot indicator and `color-mix()` for dynamic color, which is useful for status contexts where the exact color is runtime-determined. The shared component should adopt the token-pair approach from Import.tsx (for named status values) as the primary pattern; the dot indicator from OpcSources is a valuable addition as the default visual treatment.

The `SystemHealth.tsx` version also uses `color-mix()` but is tightly coupled to `ServiceStatus` type values — not a good base for a general-purpose shared component.

#### API surface for the promoted component

```tsx
interface StatusBadgeProps {
  status: string;
  label?: string;  // display text; defaults to status string
}
```

No `variant` prop. The promoted component always renders a pill (dot + text). The dot size and pill shape are the `OpcSources` pattern; the color resolution is the `Import.tsx` token-pair lookup. This is the combination of the best elements of both implementations.

Status-to-token-pair mapping (extends Import.tsx, adds OpcSources states):

| Status string(s) | bg token | color token |
|------------------|----------|-------------|
| connected, active, ok, completed, healthy | `--io-success-subtle` | `--io-success` |
| running | `--io-accent-subtle` | `--io-accent` |
| warning, partial, pending, connecting | `--io-warning-subtle` | `--io-warning` |
| error, disconnected, inactive, failed, unhealthy | `--io-danger-subtle` | `--io-danger` |
| cancelled, stopped, unknown | `--io-surface-tertiary` | `--io-text-muted` |
| (default / unrecognized) | `--io-surface-tertiary` | `--io-text-muted` |

Visual: pill with `borderRadius: "9999px"`, `padding: "2px 8px"`, `fontSize: 11`, `fontWeight: 600`, `textTransform: "capitalize"`, dot `6×6px circle` with `background: color`. This matches OpcSources post-fix layout.

#### Target location

`frontend/src/shared/components/StatusBadge.tsx`

#### Consumer files to migrate

| File | Current implementation | Migration risk |
|------|----------------------|----------------|
| `pages/settings/Import.tsx:72–110` | Token-pair — cleanest; direct migration to shared component (same API) | Low |
| `pages/settings/OpcSources.tsx:156–185` | `color-mix()` + dot; closely matches proposed component design | Low |
| `pages/settings/SystemHealth.tsx:41` | `color-mix()` tied to `ServiceStatus` type; will need status string mapping adjustment | Medium — the ServiceStatus enum values (healthy/unhealthy/warning) must map to the shared status strings |
| `pages/settings/Email.tsx` | Dot-only 7px, token-based | Low — migrate to shared dot+pill pattern; slight visual change (adds label) |
| `pages/settings/PointManagement.tsx:209` | `ActiveBadge({ active: boolean })` — boolean API not string | **Risk item:** API mismatch; `active ? "active" : "inactive"` is a one-line adapter but the component has a different prop signature. Do not force this migration; migrate separately or leave as-is. |
| `pages/settings/Users.tsx:99–115` | `Badge({ label, color })` using hex-alpha concatenation bug | **Risk item:** dynamic color input, not a named-status pattern. Cannot migrate directly to StatusBadge. Needs separate fix (replace `${color}20` with `color-mix(in srgb, ${color} 12%, transparent)` matching the OpcSources fix pattern). **Not a StatusBadge migration; a separate bug fix.** |
| `pages/settings/Roles.tsx:51–53` | Same hex-alpha bug as Users.tsx | Same as above — separate bug fix, not StatusBadge migration |
| `pages/settings/CameraStreams.tsx:785–787` | Same hex-alpha bug | Same — separate bug fix |
| `pages/settings/MaintenanceTicketsPanel.tsx:52` | Same hex-alpha bug | Same — separate bug fix |
| Console priority/state/quality badges | Hardcoded rgba/hex, semantically different (alarm priority vs. connection status) | **Risk item:** alarm-domain badges (PriorityBadge, StateBadge, QualityBadge) have different semantic vocabulary and hardcoded alarm-specific colors. Not a StatusBadge concern. Flag for Claim C / alarm token work, not here. |

---

### 2.3 Dialog

#### Source-of-truth location

No shared Dialog wrapper exists today. The existing `shared/components/ConfirmDialog.tsx` uses Radix Dialog and is the implementation model. The promoted Dialog component is a general-purpose wrapper that ConfirmDialog itself can be refactored to use internally (optional; not required for Claim B completion).

**Build new at:** `frontend/src/shared/components/Dialog.tsx`

Radix Dialog is already a project dependency (used by ConfirmDialog, PointManagement, AuthProviders, Email in Settings). Use it as the primitive.

#### API surface for the promoted component

```tsx
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: number;       // default 480
  footer?: React.ReactNode;  // action buttons area; optional
}
```

Visual spec derived from `04-recommendations.md` Cat 11:
- Overlay: `background: var(--io-modal-backdrop)`, `zIndex: var(--io-z-modal)` (= 1000)
- Content: `background: var(--io-surface-elevated)`, `borderRadius: var(--io-radius-lg)` (= 9px), `border: 1px solid var(--io-border)`, `padding: 24px`, `zIndex: calc(var(--io-z-modal) + 1)`
- Title: 16px / 600 / `var(--io-text-primary)`
- Description: 13px / `var(--io-text-secondary)` / `lineHeight: 1.5`
- ARIA: Radix Dialog provides `role="dialog"` and `aria-modal` automatically; no manual attributes needed
- Position: `position: fixed`, centered via `top: 50%; left: 50%; transform: translate(-50%, -50%)`

#### Consumer files to migrate

| File | Current state | Migration risk |
|------|---------------|----------------|
| `pages/console/index.tsx:3461–3778` — WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog | Hand-rolled inline JSX, `rgba(0,0,0,0.5)` backdrop, `zIndex: 9999`, no ARIA, `var(--io-surface)` bg | **Medium.** Three separate dialog functions; each needs refactoring to use Dialog wrapper. CloseConfirmDialog has a three-button layout (Save/Discard/Cancel) that doesn't fit a simple footer prop — may need a `footer` slot. No Claim C files touched. |
| `pages/console/PaneConfigModal.tsx` | Already uses Radix Dialog; needs backdrop token + bg/radius token fixes | **Low.** Token fixes only; structural refactor not needed. |
| `pages/settings/RestorePreviewModal.tsx` | Plain-div overlay, no ARIA, destructive-adjacent action | **Low to medium.** High-priority accessibility gap (Cat 11, 04-recommendations). Needs ARIA and token fixes; wrapping in Dialog is the right fix. |
| `pages/settings/Certificates.tsx` | Mix of plain-div and correct ARIA patterns | **Low.** Certificate modals with correct ARIA can stay; incorrect ones can be wrapped. |
| Designer-specific dialogs (`TabClosePrompt.tsx`, `IographicExportDialog.tsx`, etc.) | Individual inline-styled dialogs, `position: fixed` (correct, escape canvas transform) | **Medium.** These are not Claim C files (they are standalone dialog files, not inside DesignerCanvas.tsx). Can be migrated to use Dialog wrapper. The `position: fixed` requirement is already met by the shared Dialog component. |
| Designer dialogs inside `DesignerCanvas.tsx` | Claim C territory | **Out of scope.** Do not touch. |

**Risk item — CloseConfirmDialog:** The Save/Discard/Cancel three-button layout requires either a flexible `footer` prop or a specialized variant. Plan for the `footer?: React.ReactNode` prop to cover this case without over-designing.

---

### 2.4 ConfirmDialog

#### Current location

`frontend/src/shared/components/ConfirmDialog.tsx` — **already exists and already used widely** (15 import sites across Settings, Designer, and profile pages). This is not a new component; the promotion is: fix the existing implementation's token deviations, then migrate remaining `window.confirm()` call sites.

#### Issues to fix in the existing file

| Issue | Current value | Correct value | Source |
|-------|--------------|---------------|--------|
| Overlay z-index | `zIndex: 100` | `var(--io-z-modal)` (1000) | A13; ConfirmDialog at 100 would be rendered below any element with z-index > 100 — a layering regression |
| Content z-index | `zIndex: 101` | `calc(var(--io-z-modal) + 1)` | Same; content must be above overlay |
| Content background | `var(--io-surface-secondary)` | `var(--io-surface-elevated)` | Cat 11 recommendations; modal content bg should be elevated, not secondary |
| Content borderRadius | `"10px"` hardcoded | `var(--io-radius-lg)` (= 9px) | Cat 11 standardization; `--io-radius-lg` is registered |
| Confirm button text | `var(--io-text-on-accent)` | `var(--io-accent-foreground)` | Canonical token; `--io-text-on-accent` is an alias so functionally equivalent after A5, but canonical form preferred |

These are all localized changes within `ConfirmDialog.tsx` — no call-site changes required.

#### window.confirm() replacements

The audit (Cat 11) cited 8 `window.confirm()` calls in Settings. Current codebase grep (2026-05-28) finds 5 calls in different locations:

| File | Line | Call | Notes |
|------|------|------|-------|
| `pages/dashboards/index.tsx` | 674 | Delete dashboard | **Out of scope — dashboards module (see Section 7 Item 8)** |
| `pages/designer/DesignerReportsList.tsx` | 328 | Delete report template | Designer file; safe to migrate |
| `pages/designer/DesignerDashboardsList.tsx` | 334 | Delete dashboard | Designer file; safe to migrate |
| `pages/settings/CameraStreams.tsx` | 1004 | Destructive action | Settings file |
| `pages/dashboards/PlaylistManager.tsx` | 567 | Delete playlist | **Out of scope — dashboards module (see Section 7 Item 8)** |

The 3 OpcSources, 3 Import, and 1 SupplementalConnectorsTab calls cited in the audit doc are not present in current code — likely already addressed before this planning session. **Do not re-audit these files for this plan entry; verify at execution time with a grep before writing.**

**`createPortal` check:** Each `window.confirm()` replacement must verify the calling component is not inside a `react-grid-layout` transform ancestor. If it is, the ConfirmDialog must be rendered via `createPortal(el, document.body)` per the CLAUDE.md invariant. `dashboards/index.tsx` and `PlaylistManager.tsx` are excluded from this workstream (Section 7 Item 8) — do not migrate them here. Document for a future dashboards-module pass.

#### No consolidation needed

There is no second `ConfirmDialog` implementation to merge. `DesignerLeftPalette.tsx:217` defines a local `DeleteConfirmDialog` function but it is module-specific (not a re-implementation of the shared ConfirmDialog); it is a candidate for future migration (see Section 6).

#### Existing consumers — no changes needed

The 15 existing import sites already use the component correctly. After the token fixes, they inherit the corrected values automatically. No call-site migration required for existing consumers.

---

## Section 3 — Sequencing

### Phase 1 — Constants files (pure additions, no consumer changes)

These are new files with no imports to update. They unblock consumer migration but do not require it in the same PR.

1. `shared/styles/buttons.ts` + companion `buttons.css`
2. `shared/styles/inputs.ts` + companion `inputs.css`

**Why first:** Zero risk. Creates the foundation that consumers will later import. Does not modify any existing file.

### Phase 2 — FieldLabel (simplest component; no dependencies on Phase 1)

3. Create `shared/components/FieldLabel.tsx` (promoted from DesignerRightPanel)
4. Migrate `DesignerRightPanel.tsx` — remove local definition, add shared import (mechanical; no call-site changes)

**Why second:** FieldLabel has no dependency on constants files. The migration of DesignerRightPanel is zero-risk (no behavioral change, only import path). Console and Settings consumer migration is deferred to the follow-up pass.

### Phase 3 — StatusBadge (no dependencies; token pairs already in index.css)

5. Create `shared/components/StatusBadge.tsx`
6. Migrate Settings `Import.tsx` and `OpcSources.tsx` StatusBadge (direct replacement; same API shape)
7. Migrate `SystemHealth.tsx` StatusBadge (requires status string mapping adjustment)

**Why third:** StatusBadge has no dependencies on Phase 1 or Phase 2. Token pairs (`--io-success-subtle`, `--io-danger-subtle`, etc.) were already defined before Claim B. Import.tsx and OpcSources.tsx are low-risk. SystemHealth migration is deferred within Phase 3 if it requires more investigation.

### Phase 4 — Dialog (new component; model is ConfirmDialog)

8. Create `shared/components/Dialog.tsx`
9. Migrate `RestorePreviewModal.tsx` (highest-priority ARIA gap; destructive-adjacent path)
10. Migrate Console inline modals (`WorkspaceNameModal`, `CloseConfirmDialog`, `DeleteConfirmDialog` in `index.tsx`)

**Why fourth:** Dialog wrapper needs ConfirmDialog as the implementation model (which exists). The z-index tokens and backdrop token are already defined (Claim A). RestorePreviewModal is the highest-priority accessibility gap from the audit.

### Phase 5 — ConfirmDialog fixes + window.confirm() migration

11. Fix z-index, bg token, radius token in `shared/components/ConfirmDialog.tsx`
12. Replace `window.confirm()` calls in `DesignerReportsList.tsx`, `DesignerDashboardsList.tsx`, `CameraStreams.tsx` with ConfirmDialog (portal check first for dashboards files)

**Why last:** ConfirmDialog token fixes are mechanical but affect all 15 existing consumers (they inherit the changes). Do this after Dialog is stable so the two components are consistent.

### Consumer migration (deferred unless part of initial scope)

All remaining consumers of buttons.ts and inputs.ts (Console toolbar buttons, Settings BulkUpdate, Designer text-actions, etc.) are a follow-up pass after the initial five deliverables are confirmed stable.

---

## Section 4 — Multi-Module Implications and Eight-Module Rebuild Considerations

### buttons.ts

| Decision | Multi-module implication | Flag for user review? |
|----------|-------------------------|-----------------------|
| `var(--io-accent-foreground)` as primary text | All eight rebuilt modules will use this for any primary/accent button text color. Ensures future modules don't re-introduce `#fff` hardcoding. | No — canonical token, clear choice |
| `fontWeight: 600` on secondary | Eight modules will get 600-weight secondary buttons by default. If any rebuilt module wants a lighter secondary, it will be a deliberate override rather than an accident. | No |
| Hover via companion CSS class | Requires consumer code to spread both `style={btnPrimary}` and `className={buttonBaseClass}`. Eight rebuilt modules need to follow this two-part pattern. | **Yes** — the pattern of "constants file + companion CSS" is 

---

Produce the review now.
```


## #ASSISTANT

Reading the new files and the plan to do a precise comparison.


## #GLOB `frontend/src/shared/**/*.{ts,tsx,css}`


## #TURN_END

_2026-05-28T03:25:16+00:00_

---


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (581→580 chars)

_2026-05-28T03:25:31+00:00_


## #PROMPT

_2026-05-28T03:25:34+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
.claude/hooks/scripts/run-review.sh "$(cat .claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #ASSISTANT

## Deep Review Results

**Verdict: Clean.** The four files match the plan spec exactly.

Three notes from the review:

1. **Plan has stale name — no action needed in code.** The divergence table in the plan says `buttonHoverClass` but the formal spec block (authoritative) says `buttonBaseClass`. The file correctly uses `buttonBaseClass`. I should fix the stale mention in the plan.

2. **CSS companions are intentionally inert until consumer migration.** `buttons.css` and `inputs.css` are not imported anywhere yet — Vite won't bundle them, the class rules have no effect. This is by design for this phase. The first consumer migration must import both the `.ts` and `.css` files together.

3. **`btnSmall` omits `fontWeight` — matches the plan spec.** The deviation table says "align all variants: 600" but `btnSmall`'s explicit spec block omits it. The file faithfully follows the spec block. Latent inconsistency is in the plan, not the code.

Fixing the stale `buttonHoverClass` mention now since it's a one-word change in the plan:


## #TURN_END

_2026-05-28T03:25:34+00:00_

---


## #PROMPT

_2026-05-28T03:26:53+00:00_

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
# Work Unit Log: workstream-3b-constants-files

read-ui-a

Started: 2026-05-28T02:40:54+00:00
Session: 1e0f20f9-2a81-4d6a-8292-8a1b6ef58604

---


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/buttons.ts` (1995 chars written)

_2026-05-28T02:41:58+00:00_


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/buttons.css` (268 chars written)

_2026-05-28T02:42:02+00:00_


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/inputs.ts` (1441 chars written)

_2026-05-28T02:42:10+00:00_


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/inputs.css` (433 chars written)

_2026-05-28T02:42:15+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (47→69 chars)

_2026-05-28T02:42:19+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (46→68 chars)

_2026-05-28T02:42:22+00:00_


## #PROMPT

_2026-05-28T02:42:28+00:00_

```
~initprompt~ workstream-3b-constants-files

Read ui-audit/08-claim-b-plan.md section one for the constants files plan. Read ui-audit/05-claim-c-deferral.md to confirm exclusions.

Goal: create the constants files exactly as planned. Do not promote components in this prompt. Do not migrate consumers in this prompt. Constants files only.

For each constants file in the plan:
1. Create the file at the location specified in the plan.
2. Define the constants with the values specified in the plan.
3. Add comments referencing the comparison file rows that justify each value.
4. Do not add constants beyond what the plan specifies. If you encounter a styling decision that seems like it should be captured but isn't in the plan, add it to ui-audit/08-claim-b-plan.md section six as a deferred candidate rather than adding it to the file.
5. Do not migrate any consumer files in this prompt. The constants files should be additions only.

For any plan entry where you find the planned value cannot be implemented as specified (e.g. the value would conflict with an existing token from Claim A, or the planned API does not match how consumers actually use the styling), stop and ask rather than improvising.

Update ui-audit/08-claim-b-plan.md by marking each completed constants file with a status flag and the date.

When done print: count of constants files created, the file paths, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the plan and exclusions files before starting.


## #ASSISTANT

Now I'll verify token existence in `index.css` per the L7 requirement before writing anything.


## #BASH
_Verify button token definitions in index.css_

```bash
grep -E "(--io-accent|--io-accent-foreground|--io-text-secondary|--io-border|--io-danger|--io-radius):" /home/io/io-dev/io/frontend/src/index.css
```


## #BASH
_Verify input token definitions in index.css_

```bash
grep -E "(--io-surface-sunken|--io-input-bg|--io-text-primary):" /home/io/io-dev/io/frontend/src/index.css
```


## #ASSISTANT

All tokens confirmed. `--io-input-bg` is an alias for `--io-surface-sunken` across all themes. Now checking the directory structure.


## #BASH
_Check if shared/styles directory exists_

```bash
ls /home/io/io-dev/io/frontend/src/shared/styles/ 2>/dev/null && echo "EXISTS" || echo "NOT FOUND"
```


## #BASH
_List shared directory contents_

```bash
ls /home/io/io-dev/io/frontend/src/shared/
```


## #BASH
_Find settingsStyles.ts for pattern reference_

```bash
find /home/io/io-dev/io/frontend/src -name "settingsStyles.ts" | head -5
```


## #ASSISTANT

All tokens confirmed. `--io-input-bg` is an alias for `--io-surface-sunken` in every theme. Now creating the four constants files.


## #ASSISTANT

The LSP diagnostic is pre-existing and unrelated to these new files. Creating the final companion CSS file.


## #ASSISTANT

Now updating the plan file to mark both constants files complete.


## #TURN_END

_2026-05-28T02:42:29+00:00_

---


## #PROMPT

_2026-05-28T03:25:16+00:00_

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
# Work Unit Log: workstream-3b-constants-files

read-ui-a

Started: 2026-05-28T02:40:54+00:00
Session: 1e0f20f9-2a81-4d6a-8292-8a1b6ef58604

---


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/buttons.ts` (1995 chars written)

_2026-05-28T02:41:58+00:00_


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/buttons.css` (268 chars written)

_2026-05-28T02:42:02+00:00_


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/inputs.ts` (1441 chars written)

_2026-05-28T02:42:10+00:00_


## #WRITE `/home/io/io-dev/io/frontend/src/shared/styles/inputs.css` (433 chars written)

_2026-05-28T02:42:15+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (47→69 chars)

_2026-05-28T02:42:19+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (46→68 chars)

_2026-05-28T02:42:22+00:00_


## #PROMPT

_2026-05-28T02:42:28+00:00_

```
~initprompt~ workstream-3b-constants-files

Read ui-audit/08-claim-b-plan.md section one for the constants files plan. Read ui-audit/05-claim-c-deferral.md to confirm exclusions.

Goal: create the constants files exactly as planned. Do not promote components in this prompt. Do not migrate consumers in this prompt. Constants files only.

For each constants file in the plan:
1. Create the file at the location specified in the plan.
2. Define the constants with the values specified in the plan.
3. Add comments referencing the comparison file rows that justify each value.
4. Do not add constants beyond what the plan specifies. If you encounter a styling decision that seems like it should be captured but isn't in the plan, add it to ui-audit/08-claim-b-plan.md section six as a deferred candidate rather than adding it to the file.
5. Do not migrate any consumer files in this prompt. The constants files should be additions only.

For any plan entry where you find the planned value cannot be implemented as specified (e.g. the value would conflict with an existing token from Claim A, or the planned API does not match how consumers actually use the styling), stop and ask rather than improvising.

Update ui-audit/08-claim-b-plan.md by marking each completed constants file with a status flag and the date.

When done print: count of constants files created, the file paths, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the plan and exclusions files before starting.


## #ASSISTANT

Now I'll verify token existence in `index.css` per the L7 requirement before writing anything.


## #BASH
_Verify button token definitions in index.css_

```bash
grep -E "(--io-accent|--io-accent-foreground|--io-text-secondary|--io-border|--io-danger|--io-radius):" /home/io/io-dev/io/frontend/src/index.css
```


## #BASH
_Verify input token definitions in index.css_

```bash
grep -E "(--io-surface-sunken|--io-input-bg|--io-text-primary):" /home/io/io-dev/io/frontend/src/index.css
```


## #ASSISTANT

All tokens confirmed. `--io-input-bg` is an alias for `--io-surface-sunken` across all themes. Now checking the directory structure.


## #BASH
_Check if shared/styles directory exists_

```bash
ls /home/io/io-dev/io/frontend/src/shared/styles/ 2>/dev/null && echo "EXISTS" || echo "NOT FOUND"
```


## #BASH
_List shared directory contents_

```bash
ls /home/io/io-dev/io/frontend/src/shared/
```


## #BASH
_Find settingsStyles.ts for pattern reference_

```bash
find /home/io/io-dev/io/frontend/src -name "settingsStyles.ts" | head -5
```


## #ASSISTANT

All tokens confirmed. `--io-input-bg` is an alias for `--io-surface-sunken` in every theme. Now creating the four constants files.


## #ASSISTANT

The LSP diagnostic is pre-existing and unrelated to these new files. Creating the final companion CSS file.


## #ASSISTANT

Now updating the plan file to mark both constants files complete.


## #TURN_END

_2026-05-28T02:42:29+00:00_

---
---



DIFF OF CHANGES:
---
diff --git a/ui-audit/08-claim-b-plan.md b/ui-audit/08-claim-b-plan.md
index dfd62294..1803a2db 100644
--- a/ui-audit/08-claim-b-plan.md
+++ b/ui-audit/08-claim-b-plan.md
@@ -9,7 +9,7 @@
 
 ## Section 1 — Constants Files Plan
 
-### 1.1 `frontend/src/shared/styles/buttons.ts`
+### 1.1 `frontend/src/shared/styles/buttons.ts` — **DONE 2026-05-28**
 
 **Goal:** Replace the per-module button style systems with a single importable constants file. No React component; style objects only.
 
@@ -112,7 +112,7 @@ Also export a `buttonBaseClass = "io-btn"` string constant pairing with a compan
 
 ---
 
-### 1.2 `frontend/src/shared/styles/inputs.ts`
+### 1.2 `frontend/src/shared/styles/inputs.ts` — **DONE 2026-05-28**
 
 **Goal:** Single importable input style object replacing per-module duplicates. No React component.
 
---

FULL FILE CONTENTS (for surrounding-code analysis):
---

--- File: /home/io/io-dev/io/frontend/src/shared/styles/buttons.css ---
/* Companion to shared/styles/buttons.ts */
/* Cat 6, Deviations: hover and focus-visible rules cannot be expressed as inline style objects */

.io-btn:hover {
  opacity: 0.85;
}

.io-btn:focus-visible {
  outline: 2px solid var(--io-accent);
  outline-offset: 2px;
}

--- File: /home/io/io-dev/io/frontend/src/shared/styles/buttons.ts ---
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
  borderRadius: "var(--io-radius)",     // Cat 6, Deviations: Settings + Designer IconBtn agree; Console integers corrected
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

export const btnSecondary: CSSProperties = {
  padding: "8px 16px",
  background: "transparent",            // Cat 6, Deviations: BulkUpdate non-standard var(--io-surface-sunken) corrected
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,                       // Cat 6, Deviations: align with primary for visual consistency at same type size
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

--- File: /home/io/io-dev/io/frontend/src/shared/styles/inputs.css ---
/* Companion to shared/styles/inputs.ts */
/* Cat 7, Deviations: replaces outline:none pattern used across all three modules */
/* Applies styled :focus-visible ring; browser default is suppressed only when a visible replacement is shown */

input.io-input:focus-visible,
select.io-input:focus-visible,
textarea.io-input:focus-visible {
  outline: 2px solid var(--io-accent);
  outline-offset: 0;
  border-color: var(--io-accent);
}

--- File: /home/io/io-dev/io/frontend/src/shared/styles/inputs.ts ---
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
  borderRadius: "var(--io-radius)",        // Cat 7, Deviations: Settings canonical token; BulkUpdate "6px" string corrected
  color: "var(--io-text-primary)",         // Cat 7, Deviations: canonical token
  fontSize: "13px",
  boxSizing: "border-box",                 // Cat 7, Settings: prevents width overflow; not always set in Console/Designer
  // No outline:none — use inputClassName + inputs.css for an accessible :focus-visible ring
};

// Spread className={inputClassName} to get the :focus-visible rule from companion inputs.css
export const inputClassName = "io-input";

--- File: /home/io/io-dev/io/ui-audit/08-claim-b-plan.md ---
# Claim B Work Plan — Module Framework Layer Convergence

**Derived from:** `ui-audit/02-comparison.md` (post-reconciliation), `ui-audit/04-recommendations.md`, `ui-audit/05-claim-c-deferral.md`, `ui-audit/06-claim-a-plan.md`  
**Scope:** `shared/styles/` constants files (buttons, inputs); four promoted components (FieldLabel, StatusBadge, Dialog, ConfirmDialog). Excludes Claim C canvas layer.  
**Date:** 2026-05-28  
**Status:** Planning  

---

## Section 1 — Constants Files Plan

### 1.1 `frontend/src/shared/styles/buttons.ts` — **DONE 2026-05-28**

**Goal:** Replace the per-module button style systems with a single importable constants file. No React component; style objects only.

#### Comparison rows establishing converged values

| Row | Evidence |
|-----|----------|
| Cat 6, Shared column | "All three use `var(--io-accent)` for primary action button backgrounds; all three use `1px solid var(--io-border)` for secondary/outline borders" |
| Cat 6, List 3 Item 3 | "Settings `settingsStyles.ts` named-variant pattern is the starting point. `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall` are named, exported constants with clear semantic intent." |
| Cat 6, List 1 Item 6 | "All three modules ignore the six `--io-btn-*` tokens" — confirms the right approach is named style objects, not migrating to those tokens |
| Cat 6, Deviations, Settings | After Claim A (A5), `--io-text-on-accent` is now a valid alias for `var(--io-accent-foreground)` — `btnPrimary` now resolves correctly |
| 04-recommendations Cat 6 | Explicit variant definitions with corrected token references |

#### Decisions where modules have converged — capture as-is

| Property | Value | Basis |
|----------|-------|-------|
| Primary background | `var(--io-accent)` | All three agree (Cat 6 Shared) |
| Secondary/danger border | `1px solid var(--io-border)` / `1px solid var(--io-danger)` | All three agree on secondary border pattern |
| Padding (primary/secondary) | `8px 16px` | Settings canonical |
| Base font size | `13px` | Settings canonical (Console also 13px on some buttons; Designer text-actions 13px) |
| Cursor | `pointer` | Universal |

#### Decisions where modules diverge — recommended standardization

| Property | Console | Designer | Settings | Recommended | Reasoning |
|----------|---------|----------|----------|-------------|-----------|
| Primary text color | `#fff` hardcoded | `#09090b` or `#fff` hardcoded | `var(--io-text-on-accent)` (alias for `var(--io-accent-foreground)`) | `var(--io-accent-foreground)` | The canonical token; `--io-text-on-accent` is a Claim A alias for it. Both names work, canonical is preferred. |
| borderRadius | 3–6 (inconsistent integers) | `var(--io-radius)` on IconBtn, `6` integer on text-actions | `var(--io-radius)` | `var(--io-radius)` | Settings and Designer IconBtn agree; Console inconsistency is the gap to close. `var(--io-radius)` = 6px currently. |
| Secondary fontWeight | Not set (browser default 400) | Not set | Not set | `600` | The audit notes btnSecondary in Settings lacks fontWeight (Cat 6 Deviations). Should match primary for visual consistency at the same type size. Align all variants: 600. |
| Hover state | None on any variant | IconBtn has `transition: background 0.1s, color 0.1s` | None | `transition: opacity 0.1s` or `:focus-visible` outline | Inline styles cannot express CSS pseudo-classes; constants file exports base style objects; hover requires a companion CSS file or Tailwind class. Plan: export `buttonHoverClass = "io-btn"` to pair with a minimal `shared/styles/buttons.css` that sets `:hover { opacity: 0.85 }` and `:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 2px }`. Defer full DOM-mutation hover removal to consumer migration. |
| BulkUpdate.tsx BTN_SECONDARY background | `var(--io-surface-sunken)` | — | `transparent` (canonical) | `transparent` | BulkUpdate's secondary uses a surface bg instead of transparent; non-standard. Migrate to shared constants. |

#### Variant specifications for `buttons.ts`

```ts
btnPrimary: {
  padding: "8px 16px",
  background: "var(--io-accent)",
  color: "var(--io-accent-foreground)",
  border: "none",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

btnSecondary: {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

btnDanger: {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--io-danger)",
  border: "1px solid var(--io-danger)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

btnSmall: {
  padding: "4px 10px",
  background: "transparent",
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "12px",
  cursor: "pointer",
}
```

Also export a `buttonBaseClass = "io-btn"` string constant pairing with a companion `buttons.css` that adds the `:hover` opacity and `:focus-visible` outline. The CSS is two rules; the constant signals to consumers they should also spread the className.

#### Consumer files to migrate (deferred to execution unless part of initial scope)

| File | What to change |
|------|----------------|
| `pages/settings/BulkUpdate.tsx` | Replace local `BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_DANGER` constants with shared imports |
| `pages/settings/Import.tsx` | Any inline button styles not using settingsStyles |
| `pages/settings/Sessions.tsx` | Local `BTN_PRIMARY`/`BTN_SECONDARY`/`BTN_DANGER`/`BTN_DANGER` (slightly non-canonical variants) |
| `pages/console/index.tsx` | Toolbar and modal buttons using inline styles |
| `pages/console/PaneConfigModal.tsx` | Modal action buttons |
| `pages/console/PaneWrapper.tsx` | Pane action buttons |
| `pages/console/AlarmListPane.tsx` | Ack/action buttons |
| `pages/console/PointTablePane.tsx` | Action buttons |
| `pages/designer/DesignerToolbar.tsx` | Text-action buttons (lines 1618–1693) using `borderRadius: 6` integers |
| `pages/designer/DesignerImport.tsx` | Primary button with `#3b82f6` fallback (line 65) |
| `pages/designer/DesignerGraphicsList.tsx` | Action buttons |

**Note:** Designer's `IconBtn` is a module-local primitive (`DesignerToolbar.tsx:904–948`) and is not in scope for migration to buttons.ts. It already has good hover/transition behavior. Leave it as-is.

---

### 1.2 `frontend/src/shared/styles/inputs.ts` — **DONE 2026-05-28**

**Goal:** Single importable input style object replacing per-module duplicates. No React component.

#### Comparison rows establishing converged values

| Row | Evidence |
|-----|----------|
| Cat 7, Shared column | "All three: `border: 1px solid var(--io-border)`; `outline: none`" — border converged; outline:none is the pattern to fix |
| Cat 7, List 3 Item 1 | "Settings `settingsStyles.ts` defines a single named `inputStyle` object that propagates automatically to all pages that import it. The `settingsStyles` approach is the pattern most easily extended across other modules." |
| Cat 7, Notes | "`settingsStyles.ts inputStyle` is the closest to a shared pattern; divergence in `Import`/`BulkUpdate`/`Sessions` is a maintenance liability" |
| 04-recommendations Cat 7 | "Standard input object: `background: var(--io-surface-sunken)`, `border: 1px solid var(--io-border)`, `borderRadius: var(--io-radius)`, `padding: 8px 10px`, `fontSize: 13px`, `color: var(--io-text-primary)`" |

#### Decisions where modules have converged — capture as-is

| Property | Value | Basis |
|----------|-------|-------|
| Border | `1px solid var(--io-border)` | All three agree (Cat 7 Shared) |
| Checkbox accent | `accentColor: "var(--io-accent)"` | Settings consensus; Console uses it in some places |

#### Decisions where modules diverge — recommended standardization

| Property | Console | Designer | Settings canonical | Recommended | Reasoning |
|----------|---------|----------|-------------------|-------------|-----------|
| Background | `--io-surface-secondary` or `--io-surface-elevated` (inconsistent) | `--io-surface` (RightPanel), `--io-input-bg` (ShapePointSelector), `--io-surface-sunken` (PointPickerModal) | `--io-surface-sunken` | `var(--io-surface-sunken)` | Settings canonical is the deepest inset surface, appropriate for inputs embedded in forms. Three-module divergence; `--io-surface-sunken` is the most semantically correct choice and aligns with `--io-input-bg` (registered at index.css:131 — same visual value). |
| borderRadius | `6` or `4` (inconsistent integers) | `var(--io-radius)` or `4` integer (mixed) | `var(--io-radius)` | `var(--io-radius)` | Settings canonical uses the token; all others should match. |
| Padding | `4px 7px` (Designer RightPanel smaller for compact panels) | `4px 7px` or `8px 10px` | `8px 10px` | `8px 10px` | Settings canonical; matches the 13px font size. Designer RightPanel inputs at 4px 7px are intentionally compact for the inspector; those should NOT be migrated — that's a module-local exception (see scope note below). |
| fontSize | `12px` (Designer RightPanel) or `13px` | `13px` | `13px` | `13px` | |
| color | `var(--io-text)` (undefined, now alias via A2) | not always set | `var(--io-text-primary)` | `var(--io-text-primary)` | Canonical token; `--io-text` alias also works but use canonical |
| outline | `none` everywhere | `none` | `none` | Remove `outline: none` from inputStyle; rely on companion CSS | `outline: none` removes accessibility. The constant itself should not suppress the focus ring. Export a companion `inputs.css` with `input.io-input:focus-visible, select.io-input:focus-visible, textarea.io-input:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 0; border-color: var(--io-accent); }` — and export `inputClassName = "io-input"` for consumers to add. This fixes the focus ring in one place. |
| boxSizing | `border-box` in Settings | not always set | `border-box` | `border-box` | Prevents width overflow; all inputs should have it. |

**Scope note on Designer RightPanel:** `DesignerRightPanel.tsx` uses a compact `inputStyle` (`padding: "4px 7px"`, `fontSize: 12`) for the inspector panel where vertical space is at a premium. Do NOT migrate these to the shared inputStyle — the different size is intentional. The shared inputs.ts targets form-style inputs in modals, settings pages, and palette search boxes, not inspector panel fields. Flag this in migration tracking.

#### Variant specifications for `inputs.ts`

```ts
inputStyle: {
  width: "100%",
  padding: "8px 10px",
  background: "var(--io-surface-sunken)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  boxSizing: "border-box",
  // No outline:none — use inputClassName + inputs.css for focus ring
}

inputClassName = "io-input"  // pair with companion inputs.css
```

#### Consumer files to migrate

| File | What to change |
|------|----------------|
| `pages/settings/Import.tsx` | Own `inputStyle` constant (diverges from settingsStyles) |
| `pages/settings/BulkUpdate.tsx` | `borderRadius: "6px"` string instead of `var(--io-radius)`; local SELECT constant |
| `pages/settings/Sessions.tsx` | Local inline input styles |
| `pages/console/PaneConfigModal.tsx` | Multiple inline `outline: none` inputs (lines 79, 319, 369) |
| `pages/console/PaneWrapper.tsx` | Inline input (line 1054) |
| `pages/console/ConsolePalette.tsx` | Search input (line 419) |
| `pages/console/index.tsx` | Inline inputs (lines 3540, 3569) |
| `pages/designer/PointPickerModal.tsx` | Local inputStyle (different bg token) |

**Not in scope for migration:** `DesignerRightPanel.tsx` local `inputStyle` (compact panel inputs — intentionally different), `ShapePointSelector.tsx` (already uses `--io-input-bg` and `--io-input-border` correctly — leave as-is), `AuthProviders.tsx` `<style>` tag for checkbox accent-color (separate cleanup item).

---

## Section 2 — Component Promotions Plan

### 2.1 FieldLabel

#### Source-of-truth location

`frontend/src/pages/designer/DesignerRightPanel.tsx:201–217` — function `FieldLabel({ children })`. This is the only reusable label primitive using correct HTML semantics (`<label>` element) in any of the three modules (Cat 9, List 3 Item 6). Settings `labelStyle` uses a different convention (12px/500/no-uppercase) and is distributed as a style constant, not a component. Console has no label component.

Use Designer DesignerRightPanel as the base; make one size adjustment per the Cat 2 convergence table.

#### API surface for the promoted component

```tsx
interface FieldLabelProps {
  children: React.ReactNode;
  htmlFor?: string;  // passes through to <label> for="..." association
}
```

No additional props. `display: block`, `fontSize: 11`, `fontWeight: 600`, `textTransform: "uppercase"`, `letterSpacing: "0.05em"`, `color: "var(--io-text-muted)"`, `marginBottom: 3`.

The only change from the source: `fontSize: 10` → `fontSize: 11` per the Cat 2 table recommendation ("Form field label: 11px / 600 / uppercase / 0.05em / `--io-text-muted`"). All other properties preserved exactly.

#### Target location

`frontend/src/shared/components/FieldLabel.tsx`

#### Consumer files to migrate

| File | Current state | Migration action |
|------|---------------|-----------------|
| `pages/designer/DesignerRightPanel.tsx` | Defines and uses FieldLabel locally (14+ usages at lines 240, 513, 542, 1837, 2274, 2301, 2366, 4038, 4614, 4670, 4798, 4840, 4924, and more) | Remove local definition; add import from shared. **This is the primary migration — zero call-site changes, only change the definition location and import path.** |
| `pages/console/PaneConfigModal.tsx` | Inline `<div>` elements with label-like styles | Replace inline divs with `<FieldLabel>`. Light refactoring; no substantive risk. |
| Settings pages using inline label divs | Various; `labelStyle` constant gives a different visual treatment | These pages use 12px/500/no-uppercase labels via `labelStyle`. The promoted FieldLabel is 11px/600/uppercase. Do not force-migrate settings pages — the Settings form-label convention is visually distinct and internally consistent. **Do NOT migrate Settings `labelStyle` usages to FieldLabel in this workstream.** Revisit in a typography-alignment pass (Phase 5 in recommendations). |

**Risk items:** None for the DesignerRightPanel migration (mechanical import change). PaneConfigModal migration is light but requires verifying each `<div>` label is semantically equivalent to a `<label>` and has a corresponding input target for `htmlFor`.

---

### 2.2 StatusBadge

#### Source-of-truth location

**Base: `frontend/src/pages/settings/Import.tsx:72–110`** — function `StatusBadge({ status })` using token-pair lookup (`bg: "var(--io-success-subtle)", color: "var(--io-success)"` etc.). This is the cleanest implementation: no color math, no string interpolation, adapts to themes automatically (Cat 8, List 3 Item 2).

The `OpcSources.tsx:156–185` post-fix version adds a dot indicator and `color-mix()` for dynamic color, which is useful for status contexts where the exact color is runtime-determined. The shared component should adopt the token-pair approach from Import.tsx (for named status values) as the primary pattern; the dot indicator from OpcSources is a valuable addition as the default visual treatment.

The `SystemHealth.tsx` version also uses `color-mix()` but is tightly coupled to `ServiceStatus` type values — not a good base for a general-purpose shared component.

#### API surface for the promoted component

```tsx
interface StatusBadgeProps {
  status: string;
  label?: string;  // display text; defaults to status string
}
```

No `variant` prop. The promoted component always renders a pill (dot + text). The dot size and pill shape are the `OpcSources` pattern; the color resolution is the `Import.tsx` token-pair lookup. This is the combination of the best elements of both implementations.

Status-to-token-pair mapping (extends Import.tsx, adds OpcSources states):

| Status string(s) | bg token | color token |
|------------------|----------|-------------|
| connected, active, ok, completed, healthy | `--io-success-subtle` | `--io-success` |
| running | `--io-accent-subtle` | `--io-accent` |
| warning, partial, pending, connecting | `--io-warning-subtle` | `--io-warning` |
| error, disconnected, inactive, failed, unhealthy | `--io-danger-subtle` | `--io-danger` |
| cancelled, stopped, unknown | `--io-surface-tertiary` | `--io-text-muted` |
| (default / unrecognized) | `--io-surface-tertiary` | `--io-text-muted` |

Visual: pill with `borderRadius: "9999px"`, `padding: "2px 8px"`, `fontSize: 11`, `fontWeight: 600`, `textTransform: "capitalize"`, dot `6×6px circle` with `background: color`. This matches OpcSources post-fix layout.

#### Target location

`frontend/src/shared/components/StatusBadge.tsx`

#### Consumer files to migrate

| File | Current implementation | Migration risk |
|------|----------------------|----------------|
| `pages/settings/Import.tsx:72–110` | Token-pair — cleanest; direct migration to shared component (same API) | Low |
| `pages/settings/OpcSources.tsx:156–185` | `color-mix()` + dot; closely matches proposed component design | Low |
| `pages/settings/SystemHealth.tsx:41` | `color-mix()` tied to `ServiceStatus` type; will need status string mapping adjustment | Medium — the ServiceStatus enum values (healthy/unhealthy/warning) must map to the shared status strings |
| `pages/settings/Email.tsx` | Dot-only 7px, token-based | Low — migrate to shared dot+pill pattern; slight visual change (adds label) |
| `pages/settings/PointManagement.tsx:209` | `ActiveBadge({ active: boolean })` — boolean API not string | **Risk item:** API mismatch; `active ? "active" : "inactive"` is a one-line adapter but the component has a different prop signature. Do not force this migration; migrate separately or leave as-is. |
| `pages/settings/Users.tsx:99–115` | `Badge({ label, color })` using hex-alpha concatenation bug | **Risk item:** dynamic color input, not a named-status pattern. Cannot migrate directly to StatusBadge. Needs separate fix (replace `${color}20` with `color-mix(in srgb, ${color} 12%, transparent)` matching the OpcSources fix pattern). **Not a StatusBadge migration; a separate bug fix.** |
| `pages/settings/Roles.tsx:51–53` | Same hex-alpha bug as Users.tsx | Same as above — separate bug fix, not StatusBadge migration |
| `pages/settings/CameraStreams.tsx:785–787` | Same hex-alpha bug | Same — separate bug fix |
| `pages/settings/MaintenanceTicketsPanel.tsx:52` | Same hex-alpha bug | Same — separate bug fix |
| Console priority/state/quality badges | Hardcoded rgba/hex, semantically different (alarm priority vs. connection status) | **Risk item:** alarm-domain badges (PriorityBadge, StateBadge, QualityBadge) have different semantic vocabulary and hardcoded alarm-specific colors. Not a StatusBadge concern. Flag for Claim C / alarm token work, not here. |

---

### 2.3 Dialog

#### Source-of-truth location

No shared Dialog wrapper exists today. The existing `shared/components/ConfirmDialog.tsx` uses Radix Dialog and is the implementation model. The promoted Dialog component is a general-purpose wrapper that ConfirmDialog itself can be refactored to use internally (optional; not required for Claim B completion).

**Build new at:** `frontend/src/shared/components/Dialog.tsx`

Radix Dialog is already a project dependency (used by ConfirmDialog, PointManagement, AuthProviders, Email in Settings). Use it as the primitive.

#### API surface for the promoted component

```tsx
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: number;       // default 480
  footer?: React.ReactNode;  // action buttons area; optional
}
```

Visual spec derived from `04-recommendations.md` Cat 11:
- Overlay: `background: var(--io-modal-backdrop)`, `zIndex: var(--io-z-modal)` (= 1000)
- Content: `background: var(--io-surface-elevated)`, `borderRadius: var(--io-radius-lg)` (= 9px), `border: 1px solid var(--io-border)`, `padding: 24px`, `zIndex: calc(var(--io-z-modal) + 1)`
- Title: 16px / 600 / `var(--io-text-primary)`
- Description: 13px / `var(--io-text-secondary)` / `lineHeight: 1.5`
- ARIA: Radix Dialog provides `role="dialog"` and `aria-modal` automatically; no manual attributes needed
- Position: `position: fixed`, centered via `top: 50%; left: 50%; transform: translate(-50%, -50%)`

#### Consumer files to migrate

| File | Current state | Migration risk |
|------|---------------|----------------|
| `pages/console/index.tsx:3461–3778` — WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog | Hand-rolled inline JSX, `rgba(0,0,0,0.5)` backdrop, `zIndex: 9999`, no ARIA, `var(--io-surface)` bg | **Medium.** Three separate dialog functions; each needs refactoring to use Dialog wrapper. CloseConfirmDialog has a three-button layout (Save/Discard/Cancel) that doesn't fit a simple footer prop — may need a `footer` slot. No Claim C files touched. |
| `pages/console/PaneConfigModal.tsx` | Already uses Radix Dialog; needs backdrop token + bg/radius token fixes | **Low.** Token fixes only; structural refactor not needed. |
| `pages/settings/RestorePreviewModal.tsx` | Plain-div overlay, no ARIA, destructive-adjacent action | **Low to medium.** High-priority accessibility gap (Cat 11, 04-recommendations). Needs ARIA and token fixes; wrapping in Dialog is the right fix. |
| `pages/settings/Certificates.tsx` | Mix of plain-div and correct ARIA patterns | **Low.** Certificate modals with correct ARIA can stay; incorrect ones can be wrapped. |
| Designer-specific dialogs (`TabClosePrompt.tsx`, `IographicExportDialog.tsx`, etc.) | Individual inline-styled dialogs, `position: fixed` (correct, escape canvas transform) | **Medium.** These are not Claim C files (they are standalone dialog files, not inside DesignerCanvas.tsx). Can be migrated to use Dialog wrapper. The `position: fixed` requirement is already met by the shared Dialog component. |
| Designer dialogs inside `DesignerCanvas.tsx` | Claim C territory | **Out of scope.** Do not touch. |

**Risk item — CloseConfirmDialog:** The Save/Discard/Cancel three-button layout requires either a flexible `footer` prop or a specialized variant. Plan for the `footer?: React.ReactNode` prop to cover this case without over-designing.

---

### 2.4 ConfirmDialog

#### Current location

`frontend/src/shared/components/ConfirmDialog.tsx` — **already exists and already used widely** (15 import sites across Settings, Designer, and profile pages). This is not a new component; the promotion is: fix the existing implementation's token deviations, then migrate remaining `window.confirm()` call sites.

#### Issues to fix in the existing file

| Issue | Current value | Correct value | Source |
|-------|--------------|---------------|--------|
| Overlay z-index | `zIndex: 100` | `var(--io-z-modal)` (1000) | A13; ConfirmDialog at 100 would be rendered below any element with z-index > 100 — a layering regression |
| Content z-index | `zIndex: 101` | `calc(var(--io-z-modal) + 1)` | Same; content must be above overlay |
| Content background | `var(--io-surface-secondary)` | `var(--io-surface-elevated)` | Cat 11 recommendations; modal content bg should be elevated, not secondary |
| Content borderRadius | `"10px"` hardcoded | `var(--io-radius-lg)` (= 9px) | Cat 11 standardization; `--io-radius-lg` is registered |
| Confirm button text | `var(--io-text-on-accent)` | `var(--io-accent-foreground)` | Canonical token; `--io-text-on-accent` is an alias so functionally equivalent after A5, but canonical form preferred |

These are all localized changes within `ConfirmDialog.tsx` — no call-site changes required.

#### window.confirm() replacements

The audit (Cat 11) cited 8 `window.confirm()` calls in Settings. Current codebase grep (2026-05-28) finds 5 calls in different locations:

| File | Line | Call | Notes |
|------|------|------|-------|
| `pages/dashboards/index.tsx` | 674 | Delete dashboard | **Out of scope — dashboards module (see Section 7 Item 8)** |
| `pages/designer/DesignerReportsList.tsx` | 328 | Delete report template | Designer file; safe to migrate |
| `pages/designer/DesignerDashboardsList.tsx` | 334 | Delete dashboard | Designer file; safe to migrate |
| `pages/settings/CameraStreams.tsx` | 1004 | Destructive action | Settings file |
| `pages/dashboards/PlaylistManager.tsx` | 567 | Delete playlist | **Out of scope — dashboards module (see Section 7 Item 8)** |

The 3 OpcSources, 3 Import, and 1 SupplementalConnectorsTab calls cited in the audit doc are not present in current code — likely already addressed before this planning session. **Do not re-audit these files for this plan entry; verify at execution time with a grep before writing.**

**`createPortal` check:** Each `window.confirm()` replacement must verify the calling component is not inside a `react-grid-layout` transform ancestor. If it is, the ConfirmDialog must be rendered via `createPortal(el, document.body)` per the CLAUDE.md invariant. `dashboards/index.tsx` and `PlaylistManager.tsx` are excluded from this workstream (Section 7 Item 8) — do not migrate them here. Document for a future dashboards-module pass.

#### No consolidation needed

There is no second `ConfirmDialog` implementation to merge. `DesignerLeftPalette.tsx:217` defines a local `DeleteConfirmDialog` function but it is module-specific (not a re-implementation of the shared ConfirmDialog); it is a candidate for future migration (see Section 6).

#### Existing consumers — no changes needed

The 15 existing import sites already use the component correctly. After the token fixes, they inherit the corrected values automatically. No call-site migration required for existing consumers.

---

## Section 3 — Sequencing

### Phase 1 — Constants files (pure additions, no consumer changes)

These are new files with no imports to update. They unblock consumer migration but do not require it in the same PR.

1. `shared/styles/buttons.ts` + companion `buttons.css`
2. `shared/styles/inputs.ts` + companion `inputs.css`

**Why first:** Zero risk. Creates the foundation that consumers will later import. Does not modify any existing file.

### Phase 2 — FieldLabel (simplest component; no dependencies on Phase 1)

3. Create `shared/components/FieldLabel.tsx` (promoted from DesignerRightPanel)
4. Migrate `DesignerRightPanel.tsx` — remove local definition, add shared import (mechanical; no call-site changes)

**Why second:** FieldLabel has no dependency on constants files. The migration of DesignerRightPanel is zero-risk (no behavioral change, only import path). Console and Settings consumer migration is deferred to the follow-up pass.

### Phase 3 — StatusBadge (no dependencies; token pairs already in index.css)

5. Create `shared/components/StatusBadge.tsx`
6. Migrate Settings `Import.tsx` and `OpcSources.tsx` StatusBadge (direct replacement; same API shape)
7. Migrate `SystemHealth.tsx` StatusBadge (requires status string mapping adjustment)

**Why third:** StatusBadge has no dependencies on Phase 1 or Phase 2. Token pairs (`--io-success-subtle`, `--io-danger-subtle`, etc.) were already defined before Claim B. Import.tsx and OpcSources.tsx are low-risk. SystemHealth migration is deferred within Phase 3 if it requires more investigation.

### Phase 4 — Dialog (new component; model is ConfirmDialog)

8. Create `shared/components/Dialog.tsx`
9. Migrate `RestorePreviewModal.tsx` (highest-priority ARIA gap; destructive-adjacent path)
10. Migrate Console inline modals (`WorkspaceNameModal`, `CloseConfirmDialog`, `DeleteConfirmDialog` in `index.tsx`)

**Why fourth:** Dialog wrapper needs ConfirmDialog as the implementation model (which exists). The z-index tokens and backdrop token are already defined (Claim A). RestorePreviewModal is the highest-priority accessibility gap from the audit.

### Phase 5 — ConfirmDialog fixes + window.confirm() migration

11. Fix z-index, bg token, radius token in `shared/components/ConfirmDialog.tsx`
12. Replace `window.confirm()` calls in `DesignerReportsList.tsx`, `DesignerDashboardsList.tsx`, `CameraStreams.tsx` with ConfirmDialog (portal check first for dashboards files)

**Why last:** ConfirmDialog token fixes are mechanical but affect all 15 existing consumers (they inherit the changes). Do this after Dialog is stable so the two components are consistent.

### Consumer migration (deferred unless part of initial scope)

All remaining consumers of buttons.ts and inputs.ts (Console toolbar buttons, Settings BulkUpdate, Designer text-actions, etc.) are a follow-up pass after the initial five deliverables are confirmed stable.

---

## Section 4 — Multi-Module Implications and Eight-Module Rebuild Considerations

### buttons.ts

| Decision | Multi-module implication | Flag for user review? |
|----------|-------------------------|-----------------------|
| `var(--io-accent-foreground)` as primary text | All eight rebuilt modules will use this for any primary/accent button text color. Ensures future modules don't re-introduce `#fff` hardcoding. | No — canonical token, clear choice |
| `fontWeight: 600` on secondary | Eight modules will get 600-weight secondary buttons by default. If any rebuilt module wants a lighter secondary, it will be a deliberate override rather than an accident. | No |
| Hover via companion CSS class | Requires consumer code to spread both `style={btnPrimary}` and `className={buttonBaseClass}`. Eight rebuilt modules need to follow this two-part pattern. | **Yes** — the pattern of "constants file + companion CSS" is 

---

Produce the review now.
```


## #ASSISTANT

Reading the new files and the plan to do a precise comparison.


## #GLOB `frontend/src/shared/**/*.{ts,tsx,css}`


## #TURN_END

_2026-05-28T03:25:16+00:00_

---


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (581→580 chars)

_2026-05-28T03:25:31+00:00_


## #PROMPT

_2026-05-28T03:25:34+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
.claude/hooks/scripts/run-review.sh "$(cat .claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #ASSISTANT

## Deep Review Results

**Verdict: Clean.** The four files match the plan spec exactly.

Three notes from the review:

1. **Plan has stale name — no action needed in code.** The divergence table in the plan says `buttonHoverClass` but the formal spec block (authoritative) says `buttonBaseClass`. The file correctly uses `buttonBaseClass`. I should fix the stale mention in the plan.

2. **CSS companions are intentionally inert until consumer migration.** `buttons.css` and `inputs.css` are not imported anywhere yet — Vite won't bundle them, the class rules have no effect. This is by design for this phase. The first consumer migration must import both the `.ts` and `.css` files together.

3. **`btnSmall` omits `fontWeight` — matches the plan spec.** The deviation table says "align all variants: 600" but `btnSmall`'s explicit spec block omits it. The file faithfully follows the spec block. Latent inconsistency is in the plan, not the code.

Fixing the stale `buttonHoverClass` mention now since it's a one-word change in the plan:


## #TURN_END

_2026-05-28T03:25:34+00:00_

---
---



DIFF OF CHANGES:
---
diff --git a/ui-audit/08-claim-b-plan.md b/ui-audit/08-claim-b-plan.md
index dfd62294..af43683b 100644
--- a/ui-audit/08-claim-b-plan.md
+++ b/ui-audit/08-claim-b-plan.md
@@ -9,7 +9,7 @@
 
 ## Section 1 — Constants Files Plan
 
-### 1.1 `frontend/src/shared/styles/buttons.ts`
+### 1.1 `frontend/src/shared/styles/buttons.ts` — **DONE 2026-05-28**
 
 **Goal:** Replace the per-module button style systems with a single importable constants file. No React component; style objects only.
 
@@ -40,7 +40,7 @@
 | Primary text color | `#fff` hardcoded | `#09090b` or `#fff` hardcoded | `var(--io-text-on-accent)` (alias for `var(--io-accent-foreground)`) | `var(--io-accent-foreground)` | The canonical token; `--io-text-on-accent` is a Claim A alias for it. Both names work, canonical is preferred. |
 | borderRadius | 3–6 (inconsistent integers) | `var(--io-radius)` on IconBtn, `6` integer on text-actions | `var(--io-radius)` | `var(--io-radius)` | Settings and Designer IconBtn agree; Console inconsistency is the gap to close. `var(--io-radius)` = 6px currently. |
 | Secondary fontWeight | Not set (browser default 400) | Not set | Not set | `600` | The audit notes btnSecondary in Settings lacks fontWeight (Cat 6 Deviations). Should match primary for visual consistency at the same type size. Align all variants: 600. |
-| Hover state | None on any variant | IconBtn has `transition: background 0.1s, color 0.1s` | None | `transition: opacity 0.1s` or `:focus-visible` outline | Inline styles cannot express CSS pseudo-classes; constants file exports base style objects; hover requires a companion CSS file or Tailwind class. Plan: export `buttonHoverClass = "io-btn"` to pair with a minimal `shared/styles/buttons.css` that sets `:hover { opacity: 0.85 }` and `:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 2px }`. Defer full DOM-mutation hover removal to consumer migration. |
+| Hover state | None on any variant | IconBtn has `transition: background 0.1s, color 0.1s` | None | `transition: opacity 0.1s` or `:focus-visible` outline | Inline styles cannot express CSS pseudo-classes; constants file exports base style objects; hover requires a companion CSS file or Tailwind class. Plan: export `buttonBaseClass = "io-btn"` to pair with a minimal `shared/styles/buttons.css` that sets `:hover { opacity: 0.85 }` and `:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 2px }`. Defer full DOM-mutation hover removal to consumer migration. |
 | BulkUpdate.tsx BTN_SECONDARY background | `var(--io-surface-sunken)` | — | `transparent` (canonical) | `transparent` | BulkUpdate's secondary uses a surface bg instead of transparent; non-standard. Migrate to shared constants. |
 
 #### Variant specifications for `buttons.ts`
@@ -112,7 +112,7 @@ Also export a `buttonBaseClass = "io-btn"` string constant pairing with a compan
 
 ---
 
-### 1.2 `frontend/src/shared/styles/inputs.ts`
+### 1.2 `frontend/src/shared/styles/inputs.ts` — **DONE 2026-05-28**
 
 **Goal:** Single importable input style object replacing per-module duplicates. No React component.
 
---

FULL FILE CONTENTS (for surrounding-code analysis):
---

--- File: /home/io/io-dev/io/frontend/src/shared/styles/buttons.css ---
/* Companion to shared/styles/buttons.ts */
/* Cat 6, Deviations: hover and focus-visible rules cannot be expressed as inline style objects */

.io-btn:hover {
  opacity: 0.85;
}

.io-btn:focus-visible {
  outline: 2px solid var(--io-accent);
  outline-offset: 2px;
}

--- File: /home/io/io-dev/io/frontend/src/shared/styles/buttons.ts ---
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
  borderRadius: "var(--io-radius)",     // Cat 6, Deviations: Settings + Designer IconBtn agree; Console integers corrected
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

export const btnSecondary: CSSProperties = {
  padding: "8px 16px",
  background: "transparent",            // Cat 6, Deviations: BulkUpdate non-standard var(--io-surface-sunken) corrected
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,                       // Cat 6, Deviations: align with primary for visual consistency at same type size
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

--- File: /home/io/io-dev/io/frontend/src/shared/styles/inputs.css ---
/* Companion to shared/styles/inputs.ts */
/* Cat 7, Deviations: replaces outline:none pattern used across all three modules */
/* Applies styled :focus-visible ring; browser default is suppressed only when a visible replacement is shown */

input.io-input:focus-visible,
select.io-input:focus-visible,
textarea.io-input:focus-visible {
  outline: 2px solid var(--io-accent);
  outline-offset: 0;
  border-color: var(--io-accent);
}

--- File: /home/io/io-dev/io/frontend/src/shared/styles/inputs.ts ---
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
  borderRadius: "var(--io-radius)",        // Cat 7, Deviations: Settings canonical token; BulkUpdate "6px" string corrected
  color: "var(--io-text-primary)",         // Cat 7, Deviations: canonical token
  fontSize: "13px",
  boxSizing: "border-box",                 // Cat 7, Settings: prevents width overflow; not always set in Console/Designer
  // No outline:none — use inputClassName + inputs.css for an accessible :focus-visible ring
};

// Spread className={inputClassName} to get the :focus-visible rule from companion inputs.css
export const inputClassName = "io-input";

--- File: /home/io/io-dev/io/ui-audit/08-claim-b-plan.md ---
# Claim B Work Plan — Module Framework Layer Convergence

**Derived from:** `ui-audit/02-comparison.md` (post-reconciliation), `ui-audit/04-recommendations.md`, `ui-audit/05-claim-c-deferral.md`, `ui-audit/06-claim-a-plan.md`  
**Scope:** `shared/styles/` constants files (buttons, inputs); four promoted components (FieldLabel, StatusBadge, Dialog, ConfirmDialog). Excludes Claim C canvas layer.  
**Date:** 2026-05-28  
**Status:** Planning  

---

## Section 1 — Constants Files Plan

### 1.1 `frontend/src/shared/styles/buttons.ts` — **DONE 2026-05-28**

**Goal:** Replace the per-module button style systems with a single importable constants file. No React component; style objects only.

#### Comparison rows establishing converged values

| Row | Evidence |
|-----|----------|
| Cat 6, Shared column | "All three use `var(--io-accent)` for primary action button backgrounds; all three use `1px solid var(--io-border)` for secondary/outline borders" |
| Cat 6, List 3 Item 3 | "Settings `settingsStyles.ts` named-variant pattern is the starting point. `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall` are named, exported constants with clear semantic intent." |
| Cat 6, List 1 Item 6 | "All three modules ignore the six `--io-btn-*` tokens" — confirms the right approach is named style objects, not migrating to those tokens |
| Cat 6, Deviations, Settings | After Claim A (A5), `--io-text-on-accent` is now a valid alias for `var(--io-accent-foreground)` — `btnPrimary` now resolves correctly |
| 04-recommendations Cat 6 | Explicit variant definitions with corrected token references |

#### Decisions where modules have converged — capture as-is

| Property | Value | Basis |
|----------|-------|-------|
| Primary background | `var(--io-accent)` | All three agree (Cat 6 Shared) |
| Secondary/danger border | `1px solid var(--io-border)` / `1px solid var(--io-danger)` | All three agree on secondary border pattern |
| Padding (primary/secondary) | `8px 16px` | Settings canonical |
| Base font size | `13px` | Settings canonical (Console also 13px on some buttons; Designer text-actions 13px) |
| Cursor | `pointer` | Universal |

#### Decisions where modules diverge — recommended standardization

| Property | Console | Designer | Settings | Recommended | Reasoning |
|----------|---------|----------|----------|-------------|-----------|
| Primary text color | `#fff` hardcoded | `#09090b` or `#fff` hardcoded | `var(--io-text-on-accent)` (alias for `var(--io-accent-foreground)`) | `var(--io-accent-foreground)` | The canonical token; `--io-text-on-accent` is a Claim A alias for it. Both names work, canonical is preferred. |
| borderRadius | 3–6 (inconsistent integers) | `var(--io-radius)` on IconBtn, `6` integer on text-actions | `var(--io-radius)` | `var(--io-radius)` | Settings and Designer IconBtn agree; Console inconsistency is the gap to close. `var(--io-radius)` = 6px currently. |
| Secondary fontWeight | Not set (browser default 400) | Not set | Not set | `600` | The audit notes btnSecondary in Settings lacks fontWeight (Cat 6 Deviations). Should match primary for visual consistency at the same type size. Align all variants: 600. |
| Hover state | None on any variant | IconBtn has `transition: background 0.1s, color 0.1s` | None | `transition: opacity 0.1s` or `:focus-visible` outline | Inline styles cannot express CSS pseudo-classes; constants file exports base style objects; hover requires a companion CSS file or Tailwind class. Plan: export `buttonBaseClass = "io-btn"` to pair with a minimal `shared/styles/buttons.css` that sets `:hover { opacity: 0.85 }` and `:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 2px }`. Defer full DOM-mutation hover removal to consumer migration. |
| BulkUpdate.tsx BTN_SECONDARY background | `var(--io-surface-sunken)` | — | `transparent` (canonical) | `transparent` | BulkUpdate's secondary uses a surface bg instead of transparent; non-standard. Migrate to shared constants. |

#### Variant specifications for `buttons.ts`

```ts
btnPrimary: {
  padding: "8px 16px",
  background: "var(--io-accent)",
  color: "var(--io-accent-foreground)",
  border: "none",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

btnSecondary: {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

btnDanger: {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--io-danger)",
  border: "1px solid var(--io-danger)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

btnSmall: {
  padding: "4px 10px",
  background: "transparent",
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "12px",
  cursor: "pointer",
}
```

Also export a `buttonBaseClass = "io-btn"` string constant pairing with a companion `buttons.css` that adds the `:hover` opacity and `:focus-visible` outline. The CSS is two rules; the constant signals to consumers they should also spread the className.

#### Consumer files to migrate (deferred to execution unless part of initial scope)

| File | What to change |
|------|----------------|
| `pages/settings/BulkUpdate.tsx` | Replace local `BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_DANGER` constants with shared imports |
| `pages/settings/Import.tsx` | Any inline button styles not using settingsStyles |
| `pages/settings/Sessions.tsx` | Local `BTN_PRIMARY`/`BTN_SECONDARY`/`BTN_DANGER`/`BTN_DANGER` (slightly non-canonical variants) |
| `pages/console/index.tsx` | Toolbar and modal buttons using inline styles |
| `pages/console/PaneConfigModal.tsx` | Modal action buttons |
| `pages/console/PaneWrapper.tsx` | Pane action buttons |
| `pages/console/AlarmListPane.tsx` | Ack/action buttons |
| `pages/console/PointTablePane.tsx` | Action buttons |
| `pages/designer/DesignerToolbar.tsx` | Text-action buttons (lines 1618–1693) using `borderRadius: 6` integers |
| `pages/designer/DesignerImport.tsx` | Primary button with `#3b82f6` fallback (line 65) |
| `pages/designer/DesignerGraphicsList.tsx` | Action buttons |

**Note:** Designer's `IconBtn` is a module-local primitive (`DesignerToolbar.tsx:904–948`) and is not in scope for migration to buttons.ts. It already has good hover/transition behavior. Leave it as-is.

---

### 1.2 `frontend/src/shared/styles/inputs.ts` — **DONE 2026-05-28**

**Goal:** Single importable input style object replacing per-module duplicates. No React component.

#### Comparison rows establishing converged values

| Row | Evidence |
|-----|----------|
| Cat 7, Shared column | "All three: `border: 1px solid var(--io-border)`; `outline: none`" — border converged; outline:none is the pattern to fix |
| Cat 7, List 3 Item 1 | "Settings `settingsStyles.ts` defines a single named `inputStyle` object that propagates automatically to all pages that import it. The `settingsStyles` approach is the pattern most easily extended across other modules." |
| Cat 7, Notes | "`settingsStyles.ts inputStyle` is the closest to a shared pattern; divergence in `Import`/`BulkUpdate`/`Sessions` is a maintenance liability" |
| 04-recommendations Cat 7 | "Standard input object: `background: var(--io-surface-sunken)`, `border: 1px solid var(--io-border)`, `borderRadius: var(--io-radius)`, `padding: 8px 10px`, `fontSize: 13px`, `color: var(--io-text-primary)`" |

#### Decisions where modules have converged — capture as-is

| Property | Value | Basis |
|----------|-------|-------|
| Border | `1px solid var(--io-border)` | All three agree (Cat 7 Shared) |
| Checkbox accent | `accentColor: "var(--io-accent)"` | Settings consensus; Console uses it in some places |

#### Decisions where modules diverge — recommended standardization

| Property | Console | Designer | Settings canonical | Recommended | Reasoning |
|----------|---------|----------|-------------------|-------------|-----------|
| Background | `--io-surface-secondary` or `--io-surface-elevated` (inconsistent) | `--io-surface` (RightPanel), `--io-input-bg` (ShapePointSelector), `--io-surface-sunken` (PointPickerModal) | `--io-surface-sunken` | `var(--io-surface-sunken)` | Settings canonical is the deepest inset surface, appropriate for inputs embedded in forms. Three-module divergence; `--io-surface-sunken` is the most semantically correct choice and aligns with `--io-input-bg` (registered at index.css:131 — same visual value). |
| borderRadius | `6` or `4` (inconsistent integers) | `var(--io-radius)` or `4` integer (mixed) | `var(--io-radius)` | `var(--io-radius)` | Settings canonical uses the token; all others should match. |
| Padding | `4px 7px` (Designer RightPanel smaller for compact panels) | `4px 7px` or `8px 10px` | `8px 10px` | `8px 10px` | Settings canonical; matches the 13px font size. Designer RightPanel inputs at 4px 7px are intentionally compact for the inspector; those should NOT be migrated — that's a module-local exception (see scope note below). |
| fontSize | `12px` (Designer RightPanel) or `13px` | `13px` | `13px` | `13px` | |
| color | `var(--io-text)` (undefined, now alias via A2) | not always set | `var(--io-text-primary)` | `var(--io-text-primary)` | Canonical token; `--io-text` alias also works but use canonical |
| outline | `none` everywhere | `none` | `none` | Remove `outline: none` from inputStyle; rely on companion CSS | `outline: none` removes accessibility. The constant itself should not suppress the focus ring. Export a companion `inputs.css` with `input.io-input:focus-visible, select.io-input:focus-visible, textarea.io-input:focus-visible { outline: 2px solid var(--io-accent); outline-offset: 0; border-color: var(--io-accent); }` — and export `inputClassName = "io-input"` for consumers to add. This fixes the focus ring in one place. |
| boxSizing | `border-box` in Settings | not always set | `border-box` | `border-box` | Prevents width overflow; all inputs should have it. |

**Scope note on Designer RightPanel:** `DesignerRightPanel.tsx` uses a compact `inputStyle` (`padding: "4px 7px"`, `fontSize: 12`) for the inspector panel where vertical space is at a premium. Do NOT migrate these to the shared inputStyle — the different size is intentional. The shared inputs.ts targets form-style inputs in modals, settings pages, and palette search boxes, not inspector panel fields. Flag this in migration tracking.

#### Variant specifications for `inputs.ts`

```ts
inputStyle: {
  width: "100%",
  padding: "8px 10px",
  background: "var(--io-surface-sunken)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  boxSizing: "border-box",
  // No outline:none — use inputClassName + inputs.css for focus ring
}

inputClassName = "io-input"  // pair with companion inputs.css
```

#### Consumer files to migrate

| File | What to change |
|------|----------------|
| `pages/settings/Import.tsx` | Own `inputStyle` constant (diverges from settingsStyles) |
| `pages/settings/BulkUpdate.tsx` | `borderRadius: "6px"` string instead of `var(--io-radius)`; local SELECT constant |
| `pages/settings/Sessions.tsx` | Local inline input styles |
| `pages/console/PaneConfigModal.tsx` | Multiple inline `outline: none` inputs (lines 79, 319, 369) |
| `pages/console/PaneWrapper.tsx` | Inline input (line 1054) |
| `pages/console/ConsolePalette.tsx` | Search input (line 419) |
| `pages/console/index.tsx` | Inline inputs (lines 3540, 3569) |
| `pages/designer/PointPickerModal.tsx` | Local inputStyle (different bg token) |

**Not in scope for migration:** `DesignerRightPanel.tsx` local `inputStyle` (compact panel inputs — intentionally different), `ShapePointSelector.tsx` (already uses `--io-input-bg` and `--io-input-border` correctly — leave as-is), `AuthProviders.tsx` `<style>` tag for checkbox accent-color (separate cleanup item).

---

## Section 2 — Component Promotions Plan

### 2.1 FieldLabel

#### Source-of-truth location

`frontend/src/pages/designer/DesignerRightPanel.tsx:201–217` — function `FieldLabel({ children })`. This is the only reusable label primitive using correct HTML semantics (`<label>` element) in any of the three modules (Cat 9, List 3 Item 6). Settings `labelStyle` uses a different convention (12px/500/no-uppercase) and is distributed as a style constant, not a component. Console has no label component.

Use Designer DesignerRightPanel as the base; make one size adjustment per the Cat 2 convergence table.

#### API surface for the promoted component

```tsx
interface FieldLabelProps {
  children: React.ReactNode;
  htmlFor?: string;  // passes through to <label> for="..." association
}
```

No additional props. `display: block`, `fontSize: 11`, `fontWeight: 600`, `textTransform: "uppercase"`, `letterSpacing: "0.05em"`, `color: "var(--io-text-muted)"`, `marginBottom: 3`.

The only change from the source: `fontSize: 10` → `fontSize: 11` per the Cat 2 table recommendation ("Form field label: 11px / 600 / uppercase / 0.05em / `--io-text-muted`"). All other properties preserved exactly.

#### Target location

`frontend/src/shared/components/FieldLabel.tsx`

#### Consumer files to migrate

| File | Current state | Migration action |
|------|---------------|-----------------|
| `pages/designer/DesignerRightPanel.tsx` | Defines and uses FieldLabel locally (14+ usages at lines 240, 513, 542, 1837, 2274, 2301, 2366, 4038, 4614, 4670, 4798, 4840, 4924, and more) | Remove local definition; add import from shared. **This is the primary migration — zero call-site changes, only change the definition location and import path.** |
| `pages/console/PaneConfigModal.tsx` | Inline `<div>` elements with label-like styles | Replace inline divs with `<FieldLabel>`. Light refactoring; no substantive risk. |
| Settings pages using inline label divs | Various; `labelStyle` constant gives a different visual treatment | These pages use 12px/500/no-uppercase labels via `labelStyle`. The promoted FieldLabel is 11px/600/uppercase. Do not force-migrate settings pages — the Settings form-label convention is visually distinct and internally consistent. **Do NOT migrate Settings `labelStyle` usages to FieldLabel in this workstream.** Revisit in a typography-alignment pass (Phase 5 in recommendations). |

**Risk items:** None for the DesignerRightPanel migration (mechanical import change). PaneConfigModal migration is light but requires verifying each `<div>` label is semantically equivalent to a `<label>` and has a corresponding input target for `htmlFor`.

---

### 2.2 StatusBadge

#### Source-of-truth location

**Base: `frontend/src/pages/settings/Import.tsx:72–110`** — function `StatusBadge({ status })` using token-pair lookup (`bg: "var(--io-success-subtle)", color: "var(--io-success)"` etc.). This is the cleanest implementation: no color math, no string interpolation, adapts to themes automatically (Cat 8, List 3 Item 2).

The `OpcSources.tsx:156–185` post-fix version adds a dot indicator and `color-mix()` for dynamic color, which is useful for status contexts where the exact color is runtime-determined. The shared component should adopt the token-pair approach from Import.tsx (for named status values) as the primary pattern; the dot indicator from OpcSources is a valuable addition as the default visual treatment.

The `SystemHealth.tsx` version also uses `color-mix()` but is tightly coupled to `ServiceStatus` type values — not a good base for a general-purpose shared component.

#### API surface for the promoted component

```tsx
interface StatusBadgeProps {
  status: string;
  label?: string;  // display text; defaults to status string
}
```

No `variant` prop. The promoted component always renders a pill (dot + text). The dot size and pill shape are the `OpcSources` pattern; the color resolution is the `Import.tsx` token-pair lookup. This is the combination of the best elements of both implementations.

Status-to-token-pair mapping (extends Import.tsx, adds OpcSources states):

| Status string(s) | bg token | color token |
|------------------|----------|-------------|
| connected, active, ok, completed, healthy | `--io-success-subtle` | `--io-success` |
| running | `--io-accent-subtle` | `--io-accent` |
| warning, partial, pending, connecting | `--io-warning-subtle` | `--io-warning` |
| error, disconnected, inactive, failed, unhealthy | `--io-danger-subtle` | `--io-danger` |
| cancelled, stopped, unknown | `--io-surface-tertiary` | `--io-text-muted` |
| (default / unrecognized) | `--io-surface-tertiary` | `--io-text-muted` |

Visual: pill with `borderRadius: "9999px"`, `padding: "2px 8px"`, `fontSize: 11`, `fontWeight: 600`, `textTransform: "capitalize"`, dot `6×6px circle` with `background: color`. This matches OpcSources post-fix layout.

#### Target location

`frontend/src/shared/components/StatusBadge.tsx`

#### Consumer files to migrate

| File | Current implementation | Migration risk |
|------|----------------------|----------------|
| `pages/settings/Import.tsx:72–110` | Token-pair — cleanest; direct migration to shared component (same API) | Low |
| `pages/settings/OpcSources.tsx:156–185` | `color-mix()` + dot; closely matches proposed component design | Low |
| `pages/settings/SystemHealth.tsx:41` | `color-mix()` tied to `ServiceStatus` type; will need status string mapping adjustment | Medium — the ServiceStatus enum values (healthy/unhealthy/warning) must map to the shared status strings |
| `pages/settings/Email.tsx` | Dot-only 7px, token-based | Low — migrate to shared dot+pill pattern; slight visual change (adds label) |
| `pages/settings/PointManagement.tsx:209` | `ActiveBadge({ active: boolean })` — boolean API not string | **Risk item:** API mismatch; `active ? "active" : "inactive"` is a one-line adapter but the component has a different prop signature. Do not force this migration; migrate separately or leave as-is. |
| `pages/settings/Users.tsx:99–115` | `Badge({ label, color })` using hex-alpha concatenation bug | **Risk item:** dynamic color input, not a named-status pattern. Cannot migrate directly to StatusBadge. Needs separate fix (replace `${color}20` with `color-mix(in srgb, ${color} 12%, transparent)` matching the OpcSources fix pattern). **Not a StatusBadge migration; a separate bug fix.** |
| `pages/settings/Roles.tsx:51–53` | Same hex-alpha bug as Users.tsx | Same as above — separate bug fix, not StatusBadge migration |
| `pages/settings/CameraStreams.tsx:785–787` | Same hex-alpha bug | Same — separate bug fix |
| `pages/settings/MaintenanceTicketsPanel.tsx:52` | Same hex-alpha bug | Same — separate bug fix |
| Console priority/state/quality badges | Hardcoded rgba/hex, semantically different (alarm priority vs. connection status) | **Risk item:** alarm-domain badges (PriorityBadge, StateBadge, QualityBadge) have different semantic vocabulary and hardcoded alarm-specific colors. Not a StatusBadge concern. Flag for Claim C / alarm token work, not here. |

---

### 2.3 Dialog

#### Source-of-truth location

No shared Dialog wrapper exists today. The existing `shared/components/ConfirmDialog.tsx` uses Radix Dialog and is the implementation model. The promoted Dialog component is a general-purpose wrapper that ConfirmDialog itself can be refactored to use internally (optional; not required for Claim B completion).

**Build new at:** `frontend/src/shared/components/Dialog.tsx`

Radix Dialog is already a project dependency (used by ConfirmDialog, PointManagement, AuthProviders, Email in Settings). Use it as the primitive.

#### API surface for the promoted component

```tsx
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: number;       // default 480
  footer?: React.ReactNode;  // action buttons area; optional
}
```

Visual spec derived from `04-recommendations.md` Cat 11:
- Overlay: `background: var(--io-modal-backdrop)`, `zIndex: var(--io-z-modal)` (= 1000)
- Content: `background: var(--io-surface-elevated)`, `borderRadius: var(--io-radius-lg)` (= 9px), `border: 1px solid var(--io-border)`, `padding: 24px`, `zIndex: calc(var(--io-z-modal) + 1)`
- Title: 16px / 600 / `var(--io-text-primary)`
- Description: 13px / `var(--io-text-secondary)` / `lineHeight: 1.5`
- ARIA: Radix Dialog provides `role="dialog"` and `aria-modal` automatically; no manual attributes needed
- Position: `position: fixed`, centered via `top: 50%; left: 50%; transform: translate(-50%, -50%)`

#### Consumer files to migrate

| File | Current state | Migration risk |
|------|---------------|----------------|
| `pages/console/index.tsx:3461–3778` — WorkspaceNameModal, DeleteConfirmDialog, CloseConfirmDialog | Hand-rolled inline JSX, `rgba(0,0,0,0.5)` backdrop, `zIndex: 9999`, no ARIA, `var(--io-surface)` bg | **Medium.** Three separate dialog functions; each needs refactoring to use Dialog wrapper. CloseConfirmDialog has a three-button layout (Save/Discard/Cancel) that doesn't fit a simple footer prop — may need a `footer` slot. No Claim C files touched. |
| `pages/console/PaneConfigModal.tsx` | Already uses Radix Dialog; needs backdrop token + bg/radius token fixes | **Low.** Token fixes only; structural refactor not needed. |
| `pages/settings/RestorePreviewModal.tsx` | Plain-div overlay, no ARIA, destructive-adjacent action | **Low to medium.** High-priority accessibility gap (Cat 11, 04-recommendations). Needs ARIA and token fixes; wrapping in Dialog is the right fix. |
| `pages/settings/Certificates.tsx` | Mix of plain-div and correct ARIA patterns | **Low.** Certificate modals with correct ARIA can stay; incorrect ones can be wrapped. |
| Designer-specific dialogs (`TabClosePrompt.tsx`, `IographicExportDialog.tsx`, etc.) | Individual inline-styled dialogs, `position: fixed` (correct, escape canvas transform) | **Medium.** These are not Claim C files (they are standalone dialog files, not inside DesignerCanvas.tsx). Can be migrated to use Dialog wrapper. The `position: fixed` requirement is already met by the shared Dialog component. |
| Designer dialogs inside `DesignerCanvas.tsx` | Claim C territory | **Out of scope.** Do not touch. |

**Risk item — CloseConfirmDialog:** The Save/Discard/Cancel three-button layout requires either a flexible `footer` prop or a specialized variant. Plan for the `footer?: React.ReactNode` prop to cover this case without over-designing.

---

### 2.4 ConfirmDialog

#### Current location

`frontend/src/shared/components/ConfirmDialog.tsx` — **already exists and already used widely** (15 import sites across Settings, Designer, and profile pages). This is not a new component; the promotion is: fix the existing implementation's token deviations, then migrate remaining `window.confirm()` call sites.

#### Issues to fix in the existing file

| Issue | Current value | Correct value | Source |
|-------|--------------|---------------|--------|
| Overlay z-index | `zIndex: 100` | `var(--io-z-modal)` (1000) | A13; ConfirmDialog at 100 would be rendered below any element with z-index > 100 — a layering regression |
| Content z-index | `zIndex: 101` | `calc(var(--io-z-modal) + 1)` | Same; content must be above overlay |
| Content background | `var(--io-surface-secondary)` | `var(--io-surface-elevated)` | Cat 11 recommendations; modal content bg should be elevated, not secondary |
| Content borderRadius | `"10px"` hardcoded | `var(--io-radius-lg)` (= 9px) | Cat 11 standardization; `--io-radius-lg` is registered |
| Confirm button text | `var(--io-text-on-accent)` | `var(--io-accent-foreground)` | Canonical token; `--io-text-on-accent` is an alias so functionally equivalent after A5, but canonical form preferred |

These are all localized changes within `ConfirmDialog.tsx` — no call-site changes required.

#### window.confirm() replacements

The audit (Cat 11) cited 8 `window.confirm()` calls in Settings. Current codebase grep (2026-05-28) finds 5 calls in different locations:

| File | Line | Call | Notes |
|------|------|------|-------|
| `pages/dashboards/index.tsx` | 674 | Delete dashboard | **Out of scope — dashboards module (see Section 7 Item 8)** |
| `pages/designer/DesignerReportsList.tsx` | 328 | Delete report template | Designer file; safe to migrate |
| `pages/designer/DesignerDashboardsList.tsx` | 334 | Delete dashboard | Designer file; safe to migrate |
| `pages/settings/CameraStreams.tsx` | 1004 | Destructive action | Settings file |
| `pages/dashboards/PlaylistManager.tsx` | 567 | Delete playlist | **Out of scope — dashboards module (see Section 7 Item 8)** |

The 3 OpcSources, 3 Import, and 1 SupplementalConnectorsTab calls cited in the audit doc are not present in current code — likely already addressed before this planning session. **Do not re-audit these files for this plan entry; verify at execution time with a grep before writing.**

**`createPortal` check:** Each `window.confirm()` replacement must verify the calling component is not inside a `react-grid-layout` transform ancestor. If it is, the ConfirmDialog must be rendered via `createPortal(el, document.body)` per the CLAUDE.md invariant. `dashboards/index.tsx` and `PlaylistManager.tsx` are excluded from this workstream (Section 7 Item 8) — do not migrate them here. Document for a future dashboards-module pass.

#### No consolidation needed

There is no second `ConfirmDialog` implementation to merge. `DesignerLeftPalette.tsx:217` defines a local `DeleteConfirmDialog` function but it is module-specific (not a re-implementation of the shared ConfirmDialog); it is a candidate for future migration (see Section 6).

#### Existing consumers — no changes needed

The 15 existing import sites already use the component correctly. After the token fixes, they inherit the corrected values automatically. No call-site migration required for existing consumers.

---

## Section 3 — Sequencing

### Phase 1 — Constants files (pure additions, no consumer changes)

These are new files with no imports to update. They unblock consumer migration but do not require it in the same PR.

1. `shared/styles/buttons.ts` + companion `buttons.css`
2. `shared/styles/inputs.ts` + companion `inputs.css`

**Why first:** Zero risk. Creates the foundation that consumers will later import. Does not modify any existing file.

### Phase 2 — FieldLabel (simplest component; no dependencies on Phase 1)

3. Create `shared/components/FieldLabel.tsx` (promoted from DesignerRightPanel)
4. Migrate `DesignerRightPanel.tsx` — remove local definition, add shared import (mechanical; no call-site changes)

**Why second:** FieldLabel has no dependency on constants files. The migration of DesignerRightPanel is zero-risk (no behavioral change, only import path). Console and Settings consumer migration is deferred to the follow-up pass.

### Phase 3 — StatusBadge (no dependencies; token pairs already in index.css)

5. Create `shared/components/StatusBadge.tsx`
6. Migrate Settings `Import.tsx` and `OpcSources.tsx` StatusBadge (direct replacement; same API shape)
7. Migrate `SystemHealth.tsx` StatusBadge (requires status string mapping adjustment)

**Why third:** StatusBadge has no dependencies on Phase 1 or Phase 2. Token pairs (`--io-success-subtle`, `--io-danger-subtle`, etc.) were already defined before Claim B. Import.tsx and OpcSources.tsx are low-risk. SystemHealth migration is deferred within Phase 3 if it requires more investigation.

### Phase 4 — Dialog (new component; model is ConfirmDialog)

8. Create `shared/components/Dialog.tsx`
9. Migrate `RestorePreviewModal.tsx` (highest-priority ARIA gap; destructive-adjacent path)
10. Migrate Console inline modals (`WorkspaceNameModal`, `CloseConfirmDialog`, `DeleteConfirmDialog` in `index.tsx`)

**Why fourth:** Dialog wrapper needs ConfirmDialog as the implementation model (which exists). The z-index tokens and backdrop token are already defined (Claim A). RestorePreviewModal is the highest-priority accessibility gap from the audit.

### Phase 5 — ConfirmDialog fixes + window.confirm() migration

11. Fix z-index, bg token, radius token in `shared/components/ConfirmDialog.tsx`
12. Replace `window.confirm()` calls in `DesignerReportsList.tsx`, `DesignerDashboardsList.tsx`, `CameraStreams.tsx` with ConfirmDialog (portal check first for dashboards files)

**Why last:** ConfirmDialog token fixes are mechanical but affect all 15 existing consumers (they inherit the changes). Do this after Dialog is stable so the two components are consistent.

### Consumer migration (deferred unless part of initial scope)

All remaining consumers of buttons.ts and inputs.ts (Console toolbar buttons, Settings BulkUpdate, Designer text-actions, etc.) are a follow-up pass after the initial five deliverables are confirmed stable.

---

## Section 4 — Multi-Module Implications and Eight-Module Rebuild Considerations

### buttons.ts

| Decision | Multi-module implication | Flag for user review? |
|----------|-------------------------|-----------------------|
| `var(--io-accent-foreground)` as primary text | All eight rebuilt modules will use this for any primary/accent button text color. Ensures future modules don't re-introduce `#fff` hardcoding. | No — canonical token, clear choice |
| `fontWeight: 600` on secondary | Eight modules will get 600-weight secondary buttons by default. If any rebuilt module wants a lighter secondary, it will be a deliberate override rather than an accident. | No |
| Hover via companion CSS class | Requires consumer code to spread both `style={btnPrimary}` and `className={buttonBaseClass}`. Eight rebuilt modules need to follow this two-part pattern. | **Yes** — the pattern of "constants file + companion CSS" is n

---

Produce the review now.
```


## #ASSISTANT

I'll read the created files directly to ground the review in what's actually there.


## #ASSISTANT

Let me check the shared directory structure to see if there's a barrel pattern in place.


## #GLOB `frontend/src/shared/**/*`


## #TURN_END

_2026-05-28T03:26:53+00:00_

---


## #WRITE `/home/io/io-dev/io/.claude/docs/interim/claim-b-shared-style-constants.md` (4911 chars written)

_2026-05-28T03:29:30+00:00_


## #PROMPT

_2026-05-28T03:30:04+00:00_

```
~wrapup~
```


## #BASH
_Get current log path_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && echo "$CLAUDE_LOG"
```


## #BASH
_Generate work-unit summary_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/generate-summary.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #BASH
_Generate work-unit summary with project dir set_

```bash
export CLAUDE_PROJECT_DIR=/home/io/io-dev/io && CLAUDE_LOG=$(cat $CLAUDE_PROJECT_DIR/.claude/state/current_log.txt) && $CLAUDE_PROJECT_DIR/.claude/hooks/scripts/generate-summary.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #BASH
_Run shallow review_

```bash
export CLAUDE_PROJECT_DIR=/home/io/io-dev/io && CLAUDE_LOG=$(cat $CLAUDE_PROJECT_DIR/.claude/state/current_log.txt) && $CLAUDE_PROJECT_DIR/.claude/hooks/scripts/run-review.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID" "shallow"
```


## #BASH
_Update interim documentation_

```bash
export CLAUDE_PROJECT_DIR=/home/io/io-dev/io && CLAUDE_LOG=$(cat $CLAUDE_PROJECT_DIR/.claude/state/current_log.txt) && $CLAUDE_PROJECT_DIR/.claude/hooks/scripts/update-docs.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #BASH
_Read summary file_

```bash
cat /home/io/io-dev/io/.claude/summaries/2026-05-28_workstream-3b-constants-files\ $'\n'read-ui-a_024054_summary.md 2>/dev/null || ls /home/io/io-dev/io/.claude/summaries/ | tail -3
```


## #BASH
_List summary and review files_

```bash
ls "/home/io/io-dev/io/.claude/summaries/" | tail -5 && ls "/home/io/io-dev/io/.claude/reviews/" | tail -5
```


## #BASH
_Read summary content_

```bash
cat "/home/io/io-dev/io/.claude/summaries/2026-05-28_workstream-3b-constants-files
read-ui-a_024054_summary.md"
```


## #BASH
_Read shallow review content_

```bash
cat "/home/io/io-dev/io/.claude/reviews/2026-05-28_workstream-3b-constants-files
read-ui-a_024054_review_shallow_032826.md"
```


## #BASH
_Find summary files by pattern_

```bash
find /home/io/io-dev/io/.claude/summaries/ -name "*024054*" -o -name "*workstream-3b*" 2>/dev/null | head -5
```


## #BASH
_Find review files by pattern_

```bash
find /home/io/io-dev/io/.claude/reviews/ -name "*024054*" -o -name "*workstream-3b*" 2>/dev/null | head -5
```


## #ASSISTANT

The filenames contain a literal newline. Reading via find + exec.


## #BASH
_Read summary via find exec_

```bash
find /home/io/io-dev/io/.claude/summaries/ -name "*024054_summary*" -exec cat {} \;
```


## #BASH
_Read shallow review via find exec_

```bash
find /home/io/io-dev/io/.claude/reviews/ -name "*024054_review_shallow*" -exec cat {} \;
```


## #BASH
_Check interim docs output_

```bash
find /home/io/io-dev/io/.claude/docs/interim/ -name "*claim-b*" 2>/dev/null | head -3
```


## #BASH
_Read interim doc proposal_

```bash
cat /home/io/io-dev/io/.claude/docs/interim/claim-b-shared-style-constants.md.update-proposal-032933
```


## #BASH
_Read interim doc content_

```bash
cat /home/io/io-dev/io/.claude/docs/interim/claim-b-shared-style-constants.md
```


## #TURN_END

_2026-05-28T03:30:05+00:00_

---


## #WRITE `/home/io/io-dev/io/.claude/docs/interim/claim-b-style-constants-phase1.md` (4690 chars written)

_2026-05-28T03:31:34+00:00_

