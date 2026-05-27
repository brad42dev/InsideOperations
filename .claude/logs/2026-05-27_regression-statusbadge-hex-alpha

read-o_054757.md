# Work Unit Log: regression-statusbadge-hex-alpha

read-o

Started: 2026-05-27T05:47:57+00:00
Session: 361ad460-9bf3-4897-b065-aefe183d5610

---


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` (88→158 chars)

_2026-05-27T05:49:17+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/04-recommendations.md` (280→957 chars)

_2026-05-27T05:49:30+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/02-comparison.md` (1068→1632 chars)

_2026-05-27T05:49:47+00:00_


## #PROMPT

_2026-05-27T05:50:22+00:00_

```
~initprompt~ regression-statusbadge-hex-alpha

Read-only investigation first, then fix. Read ui-audit/04-recommendations.md and ui-audit/02-comparison.md to confirm the bug details. Read ui-audit/05-claim-c-deferral.md to confirm this regression is not affected by the Claim C deferral (StatusBadge in OpcSources is in the Settings module, not the canvas layer).

Goal: fix the OpcSources StatusBadge hex-alpha concatenation bug that renders all badge backgrounds as transparent.

Part one, investigation. Open the OpcSources.tsx file in the Settings module and locate the StatusBadge usage. Identify the hex-alpha concatenation pattern that produces transparent backgrounds. The audit suggests the bug is concatenating a hex color value with an alpha suffix in a way that produces an invalid CSS color (likely something like \${color}40 where the resulting string is not a valid color expression). Record the exact current code, the file, and the line numbers.

Confirm whether this bug exists only in OpcSources.tsx or whether the same pattern is used elsewhere in Settings. If StatusBadge itself has the bug internally (rather than the bug being in how OpcSources passes props to it), the fix scope is larger; record this finding.

Part two, fix. Replace the broken hex-alpha concatenation with a correct CSS color expression. Options include using rgba() with explicit values, using a CSS variable that already has the right alpha applied, or using color-mix() if the codebase already uses it elsewhere. Pick the approach that matches the codebase's existing patterns; do not introduce a new pattern just for this fix. If StatusBadge itself has the bug, fix it at the component level so all consumers benefit, not just OpcSources.

Do not change any other behavior. Do not refactor StatusBadge beyond what is needed to fix the bug. Do not modify any unrelated Settings pages.

Part three, update the audit artifacts. Update ui-audit/02-comparison.md to reflect the fix: locate the StatusBadge or OpcSources entry (likely category 8 status indicators) and update the deviations and notes fields with the fix date and corrected approach. Update ui-audit/04-recommendations.md similarly: mark the priority-one regression as resolved.

Do not modify any other audit files. Do not touch any Claim A, Claim B, or other Claim C work.

When done, print: the files modified, the specific code change (before and after), whether the fix was scoped to OpcSources or to StatusBadge itself with rationale, and the audit-file updates applied. Stop.
```


## #ASSISTANT

Starting with the audit docs and source files to understand the bug before touching anything.


## #ASSISTANT

Good. Now let me find OpcSources.tsx and read the relevant sections.


## #BASH
_Find OpcSources.tsx location_

```bash
find /home/io/io-dev/io/frontend -name "OpcSources.tsx" 2>/dev/null
```


## #ASSISTANT

Now let me find the StatusBadge and hex-alpha pattern in OpcSources.tsx.


## #BASH
_Find StatusBadge and hex-alpha concat patterns in OpcSources.tsx_

```bash
grep -n "StatusBadge\|statusBadge\|status_badge\|color}20\|color}40\|color}80\|hex.*alpha\|alpha.*hex\|\${color}" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx | head -60
```


## #BASH
_Find STATUS_COLORS definition_

```bash
grep -n "STATUS_COLORS" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx | head -20
```


## #ASSISTANT

Let me check how SystemHealth.tsx and Import.tsx do their StatusBadge correctly, to match the codebase pattern.


## #BASH
_Find SystemHealth StatusBadge pattern_

```bash
grep -n "color-mix\|success-subtle\|StatusBadge\|statusBadge\|status.*badge" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx | head -20
```


## #BASH
_Find Import.tsx status badge pattern_

```bash
grep -n "success-subtle\|color-mix\|StatusBadge\|status.*badge\|io-success" /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx | head -20
```


## #ASSISTANT

The codebase already uses `color-mix(in srgb, ...)` in SystemHealth.tsx — this is the correct existing pattern to match. Let me verify there are no other files with the same `${color}20` bug.


## #BASH
_Search for hex-alpha concat pattern across frontend_

```bash
grep -rn '${color}20\|${color}40\|${color}80\|`${.*}[0-9a-f][0-9a-f]`' /home/io/io-dev/io/frontend/src/ 2>/dev/null
```


## #BASH
_Search for hex-alpha concat pattern with different quoting_

```bash
grep -rn 'color}20\|color}40\|color}80\|color}10' /home/io/io-dev/io/frontend/src/ 2>/dev/null
```


## #ASSISTANT

Good — the same bug pattern exists in 4 more files. The task asks me to fix OpcSources only and record the finding. Let me verify the color values in Users.tsx and Roles.tsx are also CSS vars:


## #BASH
_Verify Users.tsx color values_

```bash
grep -n "color.*var\|color.*#\|COLORS\[" /home/io/io-dev/io/frontend/src/pages/settings/Users.tsx | head -15
```


## #BASH
_Verify Roles.tsx color values_

```bash
grep -n "color.*var\|color.*#\|COLORS\[" /home/io/io-dev/io/frontend/src/pages/settings/Roles.tsx | head -15
```


## #ASSISTANT

Let me check the SystemHealth StatusBadge implementation in full for the exact border pattern:


## #ASSISTANT

The bug is confirmed in OpcSources.tsx only. The `StatusBadge` is a local function (not shared), and the bug is in lines 168 and 170. The fix uses the `color-mix()` pattern already established by `SystemHealth.tsx`.

Applying the fix:


## #ASSISTANT

Now update the two audit files. Starting with `04-recommendations.md`:


## #ASSISTANT

Now update `02-comparison.md` — the Category 8 entry for Settings OpcSources:


## #ASSISTANT

Now verify the fix compiles cleanly:


## #BASH
_TypeScript check for OpcSources.tsx_

```bash
cd /home/io/io-dev/io/frontend && pnpm tsc --noEmit 2>&1 | grep -i "OpcSources\|error" | head -20
```


## #TURN_END

_2026-05-27T05:50:23+00:00_

---


## #PROMPT

_2026-05-27T05:52:28+00:00_

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
# Work Unit Log: regression-statusbadge-hex-alpha

read-o

Started: 2026-05-27T05:47:57+00:00
Session: 361ad460-9bf3-4897-b065-aefe183d5610

---


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` (88→158 chars)

_2026-05-27T05:49:17+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/04-recommendations.md` (280→957 chars)

_2026-05-27T05:49:30+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/02-comparison.md` (1068→1632 chars)

_2026-05-27T05:49:47+00:00_


## #PROMPT

_2026-05-27T05:50:22+00:00_

```
~initprompt~ regression-statusbadge-hex-alpha

Read-only investigation first, then fix. Read ui-audit/04-recommendations.md and ui-audit/02-comparison.md to confirm the bug details. Read ui-audit/05-claim-c-deferral.md to confirm this regression is not affected by the Claim C deferral (StatusBadge in OpcSources is in the Settings module, not the canvas layer).

Goal: fix the OpcSources StatusBadge hex-alpha concatenation bug that renders all badge backgrounds as transparent.

Part one, investigation. Open the OpcSources.tsx file in the Settings module and locate the StatusBadge usage. Identify the hex-alpha concatenation pattern that produces transparent backgrounds. The audit suggests the bug is concatenating a hex color value with an alpha suffix in a way that produces an invalid CSS color (likely something like \${color}40 where the resulting string is not a valid color expression). Record the exact current code, the file, and the line numbers.

Confirm whether this bug exists only in OpcSources.tsx or whether the same pattern is used elsewhere in Settings. If StatusBadge itself has the bug internally (rather than the bug being in how OpcSources passes props to it), the fix scope is larger; record this finding.

Part two, fix. Replace the broken hex-alpha concatenation with a correct CSS color expression. Options include using rgba() with explicit values, using a CSS variable that already has the right alpha applied, or using color-mix() if the codebase already uses it elsewhere. Pick the approach that matches the codebase's existing patterns; do not introduce a new pattern just for this fix. If StatusBadge itself has the bug, fix it at the component level so all consumers benefit, not just OpcSources.

Do not change any other behavior. Do not refactor StatusBadge beyond what is needed to fix the bug. Do not modify any unrelated Settings pages.

Part three, update the audit artifacts. Update ui-audit/02-comparison.md to reflect the fix: locate the StatusBadge or OpcSources entry (likely category 8 status indicators) and update the deviations and notes fields with the fix date and corrected approach. Update ui-audit/04-recommendations.md similarly: mark the priority-one regression as resolved.

Do not modify any other audit files. Do not touch any Claim A, Claim B, or other Claim C work.

When done, print: the files modified, the specific code change (before and after), whether the fix was scoped to OpcSources or to StatusBadge itself with rationale, and the audit-file updates applied. Stop.
```


## #ASSISTANT

Starting with the audit docs and source files to understand the bug before touching anything.


## #ASSISTANT

Good. Now let me find OpcSources.tsx and read the relevant sections.


## #BASH
_Find OpcSources.tsx location_

```bash
find /home/io/io-dev/io/frontend -name "OpcSources.tsx" 2>/dev/null
```


## #ASSISTANT

Now let me find the StatusBadge and hex-alpha pattern in OpcSources.tsx.


## #BASH
_Find StatusBadge and hex-alpha concat patterns in OpcSources.tsx_

```bash
grep -n "StatusBadge\|statusBadge\|status_badge\|color}20\|color}40\|color}80\|hex.*alpha\|alpha.*hex\|\${color}" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx | head -60
```


## #BASH
_Find STATUS_COLORS definition_

```bash
grep -n "STATUS_COLORS" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx | head -20
```


## #ASSISTANT

Let me check how SystemHealth.tsx and Import.tsx do their StatusBadge correctly, to match the codebase pattern.


## #BASH
_Find SystemHealth StatusBadge pattern_

```bash
grep -n "color-mix\|success-subtle\|StatusBadge\|statusBadge\|status.*badge" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx | head -20
```


## #BASH
_Find Import.tsx status badge pattern_

```bash
grep -n "success-subtle\|color-mix\|StatusBadge\|status.*badge\|io-success" /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx | head -20
```


## #ASSISTANT

The codebase already uses `color-mix(in srgb, ...)` in SystemHealth.tsx — this is the correct existing pattern to match. Let me verify there are no other files with the same `${color}20` bug.


## #BASH
_Search for hex-alpha concat pattern across frontend_

```bash
grep -rn '${color}20\|${color}40\|${color}80\|`${.*}[0-9a-f][0-9a-f]`' /home/io/io-dev/io/frontend/src/ 2>/dev/null
```


## #BASH
_Search for hex-alpha concat pattern with different quoting_

```bash
grep -rn 'color}20\|color}40\|color}80\|color}10' /home/io/io-dev/io/frontend/src/ 2>/dev/null
```


## #ASSISTANT

Good — the same bug pattern exists in 4 more files. The task asks me to fix OpcSources only and record the finding. Let me verify the color values in Users.tsx and Roles.tsx are also CSS vars:


## #BASH
_Verify Users.tsx color values_

```bash
grep -n "color.*var\|color.*#\|COLORS\[" /home/io/io-dev/io/frontend/src/pages/settings/Users.tsx | head -15
```


## #BASH
_Verify Roles.tsx color values_

```bash
grep -n "color.*var\|color.*#\|COLORS\[" /home/io/io-dev/io/frontend/src/pages/settings/Roles.tsx | head -15
```


## #ASSISTANT

Let me check the SystemHealth StatusBadge implementation in full for the exact border pattern:


## #ASSISTANT

The bug is confirmed in OpcSources.tsx only. The `StatusBadge` is a local function (not shared), and the bug is in lines 168 and 170. The fix uses the `color-mix()` pattern already established by `SystemHealth.tsx`.

Applying the fix:


## #ASSISTANT

Now update the two audit files. Starting with `04-recommendations.md`:


## #ASSISTANT

Now update `02-comparison.md` — the Category 8 entry for Settings OpcSources:


## #ASSISTANT

Now verify the fix compiles cleanly:


## #BASH
_TypeScript check for OpcSources.tsx_

```bash
cd /home/io/io-dev/io/frontend && pnpm tsc --noEmit 2>&1 | grep -i "OpcSources\|error" | head -20
```


## #TURN_END

_2026-05-27T05:50:23+00:00_

---
---



DIFF OF CHANGES:
---
diff --git a/frontend/src/pages/settings/OpcSources.tsx b/frontend/src/pages/settings/OpcSources.tsx
index 0807d2ff..89713e31 100644
--- a/frontend/src/pages/settings/OpcSources.tsx
+++ b/frontend/src/pages/settings/OpcSources.tsx
@@ -165,9 +165,9 @@ function StatusBadge({ status }: { status: string }) {
         borderRadius: "9999px",
         fontSize: "11px",
         fontWeight: 600,
-        background: `${color}20`,
+        background: `color-mix(in srgb, ${color} 12%, transparent)`,
         color,
-        border: `1px solid ${color}40`,
+        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
         textTransform: "capitalize",
       }}
     >
diff --git a/ui-audit/02-comparison.md b/ui-audit/02-comparison.md
index afb93f2d..4af88c4e 100644
--- a/ui-audit/02-comparison.md
+++ b/ui-audit/02-comparison.md
@@ -106,7 +106,7 @@
 | **Implementation** | Inline-styles; all hand-drawn `<span>` elements with circle or badge styles; no shared component | Inline-styles; module-local; scattered across `DesignerToolbar` (dirty dot, READ-ONLY badge), `DesignerTabBar` (modified dot), `DesignerStatusBar` (WS dot, binding summary, TEST MODE) | Inline-styles; no shared component; five distinct `StatusBadge` implementations across `OpcSources`, `SystemHealth`, `Import`, `Email`, `PointManagement`; connection dots in `OpcSources` and `SystemHealth` | All three: no shared status indicator component; all three use small circle dots (6–8px) for binary connection/state indicators; all three use `var(--io-success)` / `var(--io-danger)` tokens for the connected/error states | — |
 | **Source-of-truth files** | `index.tsx:59–134` (ConsoleStatusBar); `index.tsx:2026–2052` (tab dots, banners); `AlarmListPane:34–91`; `PointTablePane:26–59` | `DesignerStatusBar:204–371`; `DesignerToolbar:1584–1615`; `DesignerTabBar:181–193` | `OpcSources:156–186`; `SystemHealth:41–70`; `Import:72–106`; `Email:187–212`; `PointManagement:126–232`; `OpcSources` + `SystemHealth` connection dots | — | — |
 | **Visual properties actually applied** | Connection dot: 6×6px circle, `var(--io-success)`/`var(--io-warning)`/`var(--io-danger)`; dirty/playback dot: 6×6 `var(--io-warning)`; published dot: `#10b981` hardcoded; `PriorityBadge`: pill with hardcoded `rgba()` backgrounds per level; `StateBadge`: text-color-coded; `QualityBadge`: 6×6 circle + text, hardcoded colors | WS dot: `●` glyph 8px, `#22c55e`/`#ef4444` hardcoded; dirty indicator: 7×7px div, `#f97316` hardcoded; READ-ONLY badge: `#eab308`/`rgba(234,179,8,*)` hardcoded; modified tab dot: `var(--io-warning, #f59e0b)` — only token-using indicator; TEST MODE: `#4ade80` with CSS keyframe animation injected as inline `<style>` tag | `OpcSources StatusBadge`: hex-alpha concat bug (broken background); `SystemHealth`: `color-mix(in srgb, colorVar 12%, transparent)` (correct); `Import`: `--io-success-subtle`/`--io-success` token pairs (correct); `Email`: dot-only 7px, token-based; `PointManagement CriticalityBadge`: token pairs (correct); connection dots: `var(--io-success)`/`var(--io-danger)` fill + hardcoded `#22c55e` glow shadow | All three use `var(--io-success)`/`var(--io-danger)` as primary fill tokens for connection state dots | — |
-| **Deviations from app shell** | Alarm priority badge colors hardcoded (not `--io-alarm-*` tokens); published dot `#10b981` ≠ `var(--io-success)` (`#22c55e` dark); quality badge colors have no token equivalent; save-failure banner uses `#fff` not `var(--io-status-fg)` | WS dot bypasses tokens (`#22c55e`, `#ef4444`); dirty indicator `#f97316` not a token reference; READ-ONLY badge uses `#eab308` (distinct yellow) not `var(--io-warning)`; TEST MODE fully hardcoded including `<style>` tag injected on every render cycle; only `DesignerTabBar` modified dot uses a token (`var(--io-warning, #f59e0b)`) | `OpcSources StatusBadge` broken by hex-alpha CSS var concat; `--io-info: #3b82f6` IS defined in index.css:72; `AuthProviders TypeBadge` uses it correctly with matching fallback — no visual regression; connection dot glow shadow hardcodes `#22c55e` (not `var(--io-success)`); `--io-text-on-accent` undefined (applies to badge buttons in several pages) | All three: hardcoded `#22c55e` for connection dot glow shadows; none have a shared StatusBadge component | — |
+| **Deviations from app shell** | Alarm priority badge colors hardcoded (not `--io-alarm-*` tokens); published dot `#10b981` ≠ `var(--io-success)` (`#22c55e` dark); quality badge colors have no token equivalent; save-failure banner uses `#fff` not `var(--io-status-fg)` | WS dot bypasses tokens (`#22c55e`, `#ef4444`); dirty indicator `#f97316` not a token reference; READ-ONLY badge uses `#eab308` (distinct yellow) not `var(--io-warning)`; TEST MODE fully hardcoded including `<style>` tag injected on every render cycle; only `DesignerTabBar` modified dot uses a token (`var(--io-warning, #f59e0b)`) | **Fixed 2026-05-27:** `OpcSources StatusBadge` hex-alpha concat bug resolved — `background: \`${color}20\`` → `color-mix(in srgb, ${color} 12%, transparent)`; `border: \`1px solid ${color}40\`` → `1px solid color-mix(in srgb, ${color} 25%, transparent)`. Fix uses the `color-mix` pattern already established in `SystemHealth.tsx`; scoped to the local `StatusBadge` function (OpcSources.tsx:168–170). Remaining: `--io-info: #3b82f6` IS defined in index.css:72; `AuthProviders TypeBadge` uses it correctly with matching fallback — no visual regression; connection dot glow shadow hardcodes `#22c55e` (not `var(--io-success)`); `--io-text-on-accent` undefined (applies to badge buttons in several pages). **Open finding:** same `${color}20`/`${color}40` hex-alpha bug exists in `Users.tsx` (Badge:108/110), `Roles.tsx` (Badge:51/53), `CameraStreams.tsx` (785/787), `MaintenanceTicketsPanel.tsx` (52) — not fixed here. | All three: hardcoded `#22c55e` for connection dot glow shadows; none have a shared StatusBadge component | — |
 | **Notes** | `var(--io-alarm-high)` is used correctly on the save-failure banner — the only alarm token use in Console's status layer | TEST MODE injects a new `<style>` element on every render cycle when test mode is active — a performance concern | `Import.tsx` token-pair pattern (`--io-success-subtle`/`--io-success`) is the cleanest `StatusBadge` implementation across all three modules | — | — |
 
 ### Shared Infrastructure — Category 8
diff --git a/ui-audit/04-recommendations.md b/ui-audit/04-recommendations.md
index f1e6f423..2aabbd25 100644
--- a/ui-audit/04-recommendations.md
+++ b/ui-audit/04-recommendations.md
@@ -308,7 +308,7 @@ No component changes. Pure token additions to `index.css`.
 These are bugs visible at runtime, not polish issues.
 
 1. ~~`selection.css` + `MarqueeLayer.tsx`: `var(--accent)` → `var(--io-accent)`, `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)`. (2-file change.)~~ **Fixed 2026-05-27.**
-2. `OpcSources StatusBadge` hex-alpha concat bug: `${color}20` → `color-mix(...)` or component migration.
+2. ~~`OpcSources StatusBadge` hex-alpha concat bug: `${color}20` → `color-mix(...)` or component migration.~~ **Fixed 2026-05-27.** `background: \`${color}20\`` → `color-mix(in srgb, ${color} 12%, transparent)`; `border: \`1px solid ${color}40\`` → `color-mix(in srgb, ${color} 25%, transparent)`. Fix scoped to the local `StatusBadge` function in `OpcSources.tsx` (lines 168–170); matches the `color-mix` pattern already used by `SystemHealth.tsx`. **Note:** The same `${color}20`/`${color}40` hex-alpha pattern also appears in `Users.tsx` (Badge, line 108/110), `Roles.tsx` (Badge, line 51/53), `CameraStreams.tsx` (line 785/787), and `MaintenanceTicketsPanel.tsx` (line 52) — these were not fixed here and remain broken when CSS variable strings are passed as the color argument.
 3. `alarmFlash.css`: migrate hex to `--io-alarm-*` tokens. (This affects theme support, not current dark-theme functionality, but the hardcoded values are wrong in principle and block HPHMI work.)
 4. Critical ARIA fixes: `RestorePreviewModal` + Console inline modals + Import/OpcSources dialogs. (Accessibility regression on destructive paths.)
 5. Replace 8 `window.confirm()` calls with `ConfirmDialog`.
---

FULL FILE CONTENTS (for surrounding-code analysis):
---

--- File: /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx ---
import React, { useState } from "react";
import ContextMenu from "../../shared/components/ContextMenu";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  pointSourcesApi,
  pointSourceStatsApi,
  historyRecoveryApi,
  PointSource,
  PointSourceStats,
  RecoveryJob,
  CreatePointSourceRequest,
  UpdatePointSourceRequest,
} from "../../api/points";
import { opcCertsApi, OpcServerCert } from "../../api/opcCerts";
import { settingsApi } from "../../api/settings";
import SupplementalConnectorsTab from "./SupplementalConnectorsTab";
import { ExportButton } from "../../shared/components/ExportDialog";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  cellStyle,
} from "./settingsStyles";

// ---------------------------------------------------------------------------
// Column definitions for OPC sources export
// ---------------------------------------------------------------------------
const OPC_SOURCES_COLUMNS = [
  { id: "name", label: "Name" },
  { id: "endpoint_url", label: "Endpoint URL" },
  { id: "status", label: "Status" },
  { id: "enabled", label: "Enabled" },
  { id: "security_policy", label: "Security Policy" },
  { id: "security_mode", label: "Security Mode" },
  { id: "last_connected_at", label: "Last Connected" },
];

const OPC_SOURCES_DEFAULT_VISIBLE = [
  "name",
  "endpoint_url",
  "status",
  "enabled",
  "last_connected_at",
];

// ---------------------------------------------------------------------------
// TableSkeleton — shimmer rows for OPC sources table
// ---------------------------------------------------------------------------
function TableSkeleton({
  rows = 4,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr
          style={{
            borderBottom: "1px solid var(--io-border)",
            background: "var(--io-surface-primary)",
          }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} style={{ padding: "10px 14px", textAlign: "left" }}>
              <div
                style={{
                  height: "10px",
                  borderRadius: "4px",
                  background: "var(--io-border)",
                  width: i === columns - 1 ? "40px" : "120px",
                  animation: "io-shimmer 1.5s ease-in-out infinite",
                }}
              />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, ri) => (
          <tr
            key={ri}
            style={{
              borderBottom:
                ri < rows - 1 ? "1px solid var(--io-border-subtle)" : undefined,
            }}
          >
            {Array.from({ length: columns }).map((_, ci) => (
              <td key={ci} style={{ padding: "12px 14px" }}>
                <div
                  style={{
                    height: "12px",
                    borderRadius: "4px",
                    background: "var(--io-surface-primary)",
                    width:
                      ci === columns - 1
                        ? "40px"
                        : ci === 0
                          ? "120px"
                          : "160px",
                    animation: "io-shimmer 1.5s ease-in-out infinite",
                    animationDelay: `${ri * 0.05}s`,
                  }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Client certificate API (GET /api/certificates?type=client)
// ---------------------------------------------------------------------------

export interface ClientCertificate {
  id: string;
  name: string;
  subject: string | null;
  not_after: string | null;
  expired: boolean;
}

const clientCertsApi = {
  list: () =>
    fetch("/api/certificates?type=client", {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    }).then(async (r) => {
      const json = await r.json();
      return json as {
        success: boolean;
        data: ClientCertificate[];
        error?: { message: string };
      };
    }),
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  active: "var(--io-success)",
  inactive: "var(--io-text-muted)",
  connecting: "var(--io-warning)",
  error: "var(--io-danger)",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "var(--io-text-muted)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 600,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        textTransform: "capitalize",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Source stats — inline chips for the table row
// ---------------------------------------------------------------------------

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function SourceStatsChips({ stats }: { stats: PointSourceStats | undefined }) {
  if (!stats) return null;
  const chips: Array<{ label: string; value: string; color?: string }> = [
    { label: "pts", value: fmtCount(stats.point_count) },
    { label: "active", value: fmtCount(stats.active_subscriptions) },
  ];
  if (stats.updates_per_minute !== null) {
    chips.push({ label: "/min", value: fmtCount(stats.updates_per_minute) });
  }
  if (stats.error_count_24h > 0) {
    chips.push({
      label: "errors",
      value: String(stats.error_count_24h),
      color: "var(--io-danger)",
    });
  }
  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        marginTop: "5px",
        flexWrap: "wrap",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {chips.map((c) => (
        <span
          key={c.label}
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: "3px",
            fontSize: "11px",
            color: c.color ?? "var(--io-text-muted)",
          }}
        >
          <strong
            style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
          >
            {c.value}
          </strong>
          <span style={{ opacity: 0.7 }}>{c.label}</span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source stats — tile grid for the detail panel
// ---------------------------------------------------------------------------

function SourceStatsTiles({ sourceId }: { sourceId: string }) {
  const statsQuery = useQuery({
    queryKey: ["point-source-stats", sourceId],
    queryFn: async () => {
      const r = await pointSourceStatsApi.get(sourceId);
      if (!r.success) throw new Error(r.error.message);
      return r.data as PointSourceStats;
    },
    refetchInterval: 15_000,
  });

  const s = statsQuery.data;
  const tiles: Array<{
    label: string;
    value: string;
    sub?: string;
    accent?: boolean;
    danger?: boolean;
  }> = [
    {
      label: "Total Points",
      value: s ? fmtCount(s.point_count) : "—",
      sub: "configured",
    },
    {
      label: "Active Subs",
      value: s ? fmtCount(s.active_subscriptions) : "—",
      sub: "subscriptions",
      accent: s ? s.active_subscriptions > 0 : false,
    },
    {
      label: "Updates / min",
      value:
        s?.updates_per_minute !== null && s?.updates_per_minute !== undefined
          ? fmtCount(s.updates_per_minute)
          : "—",
      sub: "recording",
    },
    {
      label: "Errors (24 h)",
      value: s ? String(s.error_count_24h) : "—",
      danger: s ? s.error_count_24h > 0 : false,
    },
  ];

  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "10px",
        }}
      >
        Live Statistics
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        {tiles.map((t) => (
          <div
            key={t.label}
            style={{
              background: "var(--io-surface-secondary)",
              border: "1px solid var(--io-border-subtle)",
              borderRadius: "var(--io-radius)",
              padding: "12px 10px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: t.danger
                  ? "var(--io-danger)"
                  : t.accent
                    ? "var(--io-success)"
                    : "var(--io-text-primary)",
                lineHeight: 1.1,
              }}
            >
              {statsQuery.isLoading ? (
                <span style={{ opacity: 0.3 }}>—</span>
              ) : (
                t.value
              )}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--io-text-muted)",
                lineHeight: 1.3,
              }}
            >
              {t.label}
              {t.sub && (
                <span style={{ display: "block", opacity: 0.7 }}>{t.sub}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {s?.last_value_at && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--io-text-muted)",
            marginBottom: "16px",
          }}
        >
          Last value received: {new Date(s.last_value_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal wrapper
// ---------------------------------------------------------------------------

function ModalContent({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
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
        aria-describedby={undefined}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "10px",
          padding: "24px",
          width: "520px",
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto",
          zIndex: 101,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <Dialog.Title
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            {title}
          </Dialog.Title>
          <Dialog.Close asChild>
            <button
              style={{
                background: "none",
                border: "none",
                color: "var(--io-text-muted)",
                cursor: "pointer",
                fontSize: "18px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

// ---------------------------------------------------------------------------
// Source form fields (shared between create and edit)
// ---------------------------------------------------------------------------

interface SourceFormState {
  name: string;
  endpoint_url: string;
  security_policy: string;
  security_mode: string;
  username: string;
  password: string;
  enabled: boolean;
  client_certificate_id: string | null;
  platform: string | null;
  publish_interval_ms: number | null;
  data_category_id: string | null;
}

// ---------------------------------------------------------------------------
// Data categories
// ---------------------------------------------------------------------------

const PREDEFINED_CATEGORIES = [
  { id: "process", label: "Process" },
  { id: "event", label: "Event" },
  { id: "access_control", label: "Access Control" },
  { id: "personnel", label: "Personnel" },
  { id: "financial", label: "Financial" },
  { id: "maintenance", label: "Maintenance" },
  { id: "ticketing", label: "Ticketing" },
  { id: "environmental", label: "Environmental" },
  { id: "general", label: "General" },
];

interface DataCategory {
  id: string;
  label: string;
  predefined: boolean;
}

// Simple in-memory custom categories store (backed by API in production)
function useDataCategories() {
  const query = useQuery<DataCategory[]>({
    queryKey: ["data-categories"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/data-categories");
        if (!res.ok) throw new Error("API unavailable");
        const json = await res.json();
        return json.data ?? json;
      } catch {
        // Fall back to predefined only
        return PREDEFINED_CATEGORIES.map((c) => ({ ...c, predefined: true }));
      }
    },
    staleTime: 60_000,
    initialData: PREDEFINED_CATEGORIES.map((c) => ({ ...c, predefined: true })),
  });
  return query;
}

// ---------------------------------------------------------------------------
// Manage Categories modal
// ---------------------------------------------------------------------------

function ManageCategoriesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const catQuery = useDataCategories();
  const categories = catQuery.data ?? [];

  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/data-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      qc.invalidateQueries({ queryKey: ["data-categories"] });
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create category");
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/data-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      qc.invalidateQueries({ queryKey: ["data-categories"] });
      setEditId(null);
      setEditName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename category");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this custom category?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/data-categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      qc.invalidateQueries({ queryKey: ["data-categories"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete category");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const modalOverlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--io-overlay, rgba(0,0,0,0.5))",
  };

  const modalBox: React.CSSProperties = {
    position: "relative",
    width: "500px",
    maxWidth: "95vw",
    maxHeight: "80vh",
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: "10px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  };

  const catInputStyle: React.CSSProperties = {
    flex: 1,
    padding: "6px 10px",
    background: "var(--io-surface-secondary)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    color: "var(--io-text)",
    fontSize: "13px",
  };

  const smBtn = (
    variant: "primary" | "ghost" | "danger",
  ): React.CSSProperties => ({
    padding: "5px 10px",
    fontSize: "12px",
    border:
      variant === "danger"
        ? "1px solid var(--io-danger)"
        : variant === "ghost"
          ? "1px solid var(--io-border)"
          : "none",
    borderRadius: "var(--io-radius)",
    background: variant === "primary" ? "var(--io-accent)" : "transparent",
    color:
      variant === "primary"
        ? "var(--io-text-on-accent)"
        : variant === "danger"
          ? "var(--io-danger)"
          : "var(--io-text-secondary)",
    cursor: saving ? "not-allowed" : "pointer",
    opacity: saving ? 0.6 : 1,
  });

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--io-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "15px" }}>
            Manage Data Categories
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              fontSize: "18px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              marginBottom: "16px",
              lineHeight: 1.5,
            }}
          >
            Predefined categories cannot be deleted. Custom categories can be
            renamed or deleted.
          </div>

          {error && (
            <div
              style={{
                padding: "8px 12px",
                background: "var(--io-danger-subtle)",
                color: "var(--io-danger)",
                borderRadius: "var(--io-radius)",
                fontSize: "12px",
                marginBottom: "12px",
              }}
            >
              {error}
            </div>
          )}

          {/* Category list */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              marginBottom: "20px",
            }}
          >
            {categories.map((cat) => (
              <div
                key={cat.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  background: "var(--io-surface-secondary)",
                  border: "1px solid var(--io-border-subtle)",
                  borderRadius: "var(--io-radius)",
                }}
              >
                {editId === cat.id ? (
                  <>
                    <input
                      style={catInputStyle}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(cat.id);
                      }}
                      autoFocus
                    />
                    <button
                      style={smBtn("primary")}
                      onClick={() => handleRename(cat.id)}
                      disabled={saving}
                    >
                      Save
                    </button>
                    <button
                      style={smBtn("ghost")}
                      onClick={() => {
                        setEditId(null);
                        setEditName("");
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        flex: 1,
                        fontSize: "13px",
                        color: "var(--io-text-primary)",
                      }}
                    >
                      {cat.label}
                    </span>
                    {cat.predefined ? (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--io-text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        predefined
                      </span>
                    ) : (
                      <>
                        <button
                          style={smBtn("ghost")}
                          onClick={() => {
                            setEditId(cat.id);
                            setEditName(cat.label);
                          }}
                          disabled={saving}
                        >
                          Rename
                        </button>
                        <button
                          style={smBtn("danger")}
                          onClick={() => handleDelete(cat.id)}
                          disabled={saving}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new */}
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "8px",
            }}
          >
            Add Custom Category
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              style={catInputStyle}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <button
              style={smBtn("primary")}
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
            >
              Add
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--io-border)",
            display: "flex",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <button onClick={onClose} style={smBtn("ghost")}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const SECURITY_POLICIES = [
  "None",
  "Basic256Sha256",
  "Aes128Sha256RsaOaep",
  "Aes256Sha256RsaPss",
];
const SECURITY_MODES = ["None", "Sign", "SignAndEncrypt"];

// DCS platform options from doc 17 §Connection Profiles
const DCS_PLATFORMS = [
  { value: "", label: "Unknown / Generic" },
  { value: "siemens_s7_1500", label: "Siemens S7-1500 (TIA Portal)" },
  { value: "siemens_s7_1200", label: "Siemens S7-1200 (TIA Portal)" },
  { value: "siemens_wincc_oa", label: "Siemens WinCC OA" },
  { value: "siemens_wincc_v7", label: "Siemens WinCC V7 / RT Pro" },
  { value: "honeywell_experion", label: "Honeywell Experion PKS" },
  { value: "abb_800xa", label: "ABB 800xA" },
  { value: "emerson_deltav_pk", label: "Emerson DeltaV PK Controller" },
  { value: "emerson_deltav_app", label: "Emerson DeltaV Application Station" },
  { value: "yokogawa_exaopc", label: "Yokogawa Exaopc" },
];

function SourceFormFields({
  form,
  onChange,
  showEnabled,
  clientCerts,
}: {
  form: SourceFormState;
  onChange: (patch: Partial<SourceFormState>) => void;
  showEnabled?: boolean;
  clientCerts?: ClientCertificate[];
}) {
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const catQuery = useDataCategories();
  const categories = catQuery.data ?? [];
  const field = (
    label: string,
    key: keyof SourceFormState,
    type = "text",
    placeholder?: string,
    required?: boolean,
  ) => (
    <div>
      <label style={labelStyle}>
        {label}
        {required && " *"}
      </label>
      <input
        type={type}
        style={inputStyle}
        value={form[key] as string}
        onChange={(e) => onChange({ [key]: e.target.value })}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {field("Name", "name", "text", "OPC-Unit3-Primary", true)}
      {field(
        "Endpoint URL",
        "endpoint_url",
        "text",
        "opc.tcp://hostname:4840",
        true,
      )}

      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Security Policy</label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            value={form.security_policy}
            onChange={(e) => onChange({ security_policy: e.target.value })}
          >
            {SECURITY_POLICIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Security Mode</label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            value={form.security_mode}
            onChange={(e) => onChange({ security_mode: e.target.value })}
          >
            {SECURITY_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Client Certificate dropdown */}
      <div>
        <label style={labelStyle}>Client Certificate</label>
        <select
          style={{ ...inputStyle, cursor: "pointer" }}
          value={form.client_certificate_id ?? ""}
          onChange={(e) =>
            onChange({ client_certificate_id: e.target.value || null })
          }
        >
          <option value="">(none)</option>
          {(clientCerts ?? []).map((cert) => (
            <option key={cert.id} value={cert.id}>
              {cert.name}
              {cert.expired ? " [EXPIRED]" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Platform dropdown */}
      <div>
        <label style={labelStyle}>Platform</label>
        <select
          style={{ ...inputStyle, cursor: "pointer" }}
          value={form.platform ?? ""}
          onChange={(e) => onChange({ platform: e.target.value || null })}
        >
          {DCS_PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Data Category dropdown */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "4px",
          }}
        >
          <label style={labelStyle}>Data Category</label>
          <button
            type="button"
            onClick={() => setManageCatsOpen(true)}
            style={{
              background: "none",
              border: "none",
              color: "var(--io-accent)",
              fontSize: "11px",
              cursor: "p

--- File: /home/io/io-dev/io/ui-audit/02-comparison.md ---
# UI Audit Comparison — Cross-Module Analysis

**Source files:** `ui-audit/01-console.md`, `ui-audit/01-designer.md`, `ui-audit/01-settings.md`
**Date:** 2026-05-27

---

## Category 1 — Color Palette and Theme Tokens

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Shared-component; all colors via CSS custom properties from `index.css`; no module-specific token overrides | Inline-styles; all color references via CSS custom properties from app-shell token registry; no module-specific token declarations | Inline-styles; all color references are CSS custom property calls into app-shell token set defined in `index.css`; no module-specific token definitions | All three: primary color infrastructure is the 138-token registry in `index.css`; no module owns its own token namespace | — |
| **Source-of-truth files** | `index.css:19–295` (138 tokens); hardcoded values in `AlarmListPane.tsx`, `PointTablePane.tsx`, `TrendPane.tsx`, `index.tsx` | `index.css:19–219`; `shared/theme/tokens.ts` (JS mirror); hardcoded overrides in `DesignerToolbar`, `DesignerTabBar`, `DesignerStatusBar`, `DesignerGraphicsList` | `index.css:17–219`; `settingsStyles.ts:1–71` (subset of token aliases); hardcoded overrides in `Users.tsx`, `Roles.tsx`, `Groups.tsx`, `OpcSources.tsx`, `BulkUpdate.tsx` | `index.css` is the canonical token registry for all three | — |
| **Visual properties actually applied** | ~20 token references; hardcoded hex for alarm priority/quality badge colors, TrendPane series palette, published dot | ~15 token references; 9 hardcoded color values in shell components; 2 undefined tokens (`--io-surface-hover`, `--io-font-sans`) | ~15 token references including `--io-border-subtle`, `--io-success`, `--io-status-fg`; undefined `--io-text-on-accent` in `btnPrimary`; hex-alpha badge concatenation bug in OpcSources | All three use `var(--io-accent)`, `var(--io-border)`, `var(--io-text-primary)`, `var(--io-text-muted)`, `var(--io-surface)` family, `var(--io-success)`/`--io-warning`/`--io-danger` | — |
| **Deviations from app shell** | `var(--io-bg)` and `var(--io-text)` referenced but not defined in `index.css`; alarm priority badge colors hardcoded instead of using `--io-alarm-*` tokens; published dot `#10b981` ≠ `var(--io-success)` | `var(--io-surface-hover)` and `var(--io-font-sans)` undefined; 9 hardcoded values bypass tokens; `#09090b` hardcoded for active IconBtn text instead of `var(--io-accent-foreground)` | `--io-text-on-accent` undefined in `btnPrimary` across ~15 files; hex-alpha CSS var concatenation bug (`${color}20`) renders OpcSources StatusBadge backgrounds as invalid; hardcoded modal overlay/shadow values in Users/Roles/Groups | All three reference at least one undefined token; all three have hardcoded hex colors that bypass the token system | Each module references a different set of undefined tokens |
| **Notes** | Console quality badge colors (`#10B981`, `#F59E0B`, `#EF4444`) have no corresponding tokens; hardcoded is the only option for that sub-type | `DesignerGraphicsList` `SCOPE_COLORS`/`MODE_COLORS` are mostly hardcoded rgba; two of six entries use registered tokens: `SCOPE_COLORS.console.text = "var(--io-accent)"` and `MODE_COLORS.report.text = "var(--io-text-secondary)"` (DesignerGraphicsList.tsx:48,55) | OpcSources StatusBadge `${color}20` concatenation bug is a functional regression: backgrounds render as transparent in all browsers | — | — |

---

## Category 2 — Typography

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Inline-styles; no Console-specific CSS classes or shared typography component | Inline-styles; no module-local CSS; `FieldLabel` component in `DesignerRightPanel` is the only reusable label primitive in any Designer file | Inline-styles; no module-specific CSS; `settingsStyles.ts:labelStyle` exports a named label constant used across most pages | All three use inline-styles exclusively; no shared typography component exists across modules | — |
| **Source-of-truth files** | `index.css:179–218` (16 scale tokens + `--io-font-mono`); inline styles scattered across `index.tsx`, `PaneWrapper`, `ConsolePalette`, `PaneConfigModal`, `AlarmListPane` | `index.css:178–218` (same 16 tokens); `DesignerRightPanel:201–217` (`FieldLabel`); `DesignerModeTabs`, `DesignerToolbar`, `DesignerTabBar`, `DesignerStatusBar` | `index.css`; `index.tsx:198–224` (nav group/item); `SettingsPageLayout:36–55` (page title); `settingsStyles.ts:15–21` (labelStyle); `SettingsTabs:60–75` (tab labels) | `index.css` typography token scale is the reference for all three; none actually use it | — |
| **Visual properties actually applied** | Raw px integers 9–18px; `fontFamily: monospace` on alarm tag/time (not `--io-font-mono`); SubGroupLabel at 9px and PaneTypeBadge at 10px are below smallest token (11px) | Raw px integers 9–20px; `var(--io-font-mono)` used correctly for zoom input (only instance); `var(--io-font-sans)` referenced in zoom dropdown but undefined; RightPanel `FieldLabel`: 10px/600/uppercase/0.05em | Raw px integers 11–18px; bare `"monospace"` keyword in `Groups.tsx` (not `--io-font-mono`); `labelStyle`: 12px/500/`--io-text-secondary`; page title 18px/600; table headers 11px/600/uppercase | All three use raw pixel integer literals; none reference the 16 typography scale tokens (`--io-text-4xl` through `--io-text-code-sm`); all inherit the browser sans-serif stack | — |
| **Deviations from app shell** | Zero typography scale tokens used; `fontFamily: monospace` instead of `--io-font-mono`; SubGroupLabel 9px below minimum token; no font sizes map cleanly to token equivalents | Zero typography scale tokens used; `var(--io-font-sans)` undefined; five different `letterSpacing` values for uppercase labels within `DesignerRightPanel` alone (0em, 0.04em, 0.05em, 0.06em, 0.08em) | Nav group header 11px vs AppShell 10px (1px drift); three different `letterSpacing` values across semantically identical uppercase label elements (0.06em, 0.07em, 0.08em); bare `"monospace"` in `Groups.tsx` instead of `--io-font-mono` | All three: zero typography scale tokens used; all three use bare `monospace` or no font-family token for monospace contexts | — |
| **Notes** | None of the inline sizes map cleanly to token equivalents (e.g., 15px, 16px are not defined tokens) | `FieldLabel` (10px/600/uppercase/0.05em) is the only reusable typography primitive in any of the three modules | Typography is most internally consistent in Settings; deviations are minor relative to Console and Designer | — | — |

---

## Category 3 — Toolbars

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Module-local-component; single 48px horizontal header bar defined as inline JSX inside `ConsolePage` | Module-local-component; four stacked dedicated components (`DesignerModeTabs` 36px, `DesignerToolbar` 44px, `DesignerTabBar` 36px, `DesignerStatusBar` 28px) | **Absent.** Per-page action rows above tables are inline flexbox rows, not toolbars. No toolbar container, no icon-button strip found | N/A — Settings has no toolbars; Console and Designer both use module-local components with no shared toolbar primitive | — |
| **Source-of-truth files** | `index.tsx:1942–2826` (full header + tab strip); `index.tsx:247–466` (`LayoutPickerButton`) | `DesignerModeTabs:207–217`; `DesignerToolbar:1159–1169`; `DesignerTabBar:363–376`; `DesignerStatusBar:192–203` | N/A | — | — |
| **Visual properties actually applied** | 48px height; `background: var(--io-surface)`; `borderBottom: 1px solid var(--io-border)`; active tab: `borderBottom: 2px solid var(--io-accent)`; tab labels 13px/600 active/400 inactive; separator dividers `width:1, height:18, background: var(--io-border)` | DesignerToolbar 44px: same bg/border pattern; `IconBtn` 32×32 `var(--io-radius)`, `transition: background 0.1s, color 0.1s`; mode/tab strips with 2px accent underline; StatusBar 28px at bottom with segment dividers | N/A | Console + Designer share: `background: var(--io-surface)`, `borderBottom: 1px solid var(--io-border)`, active tab underline `2px solid var(--io-accent)`, tab labels font-weight active/inactive distinction | — |
| **Deviations from app shell** | `var(--io-surface)` background where app shell topbar uses `var(--io-surface-primary)` (darker); none of 6 `--io-btn-*` tokens used; no toolbar height token; Publish button rendered twice in right controls block (duplicate render) | Toolbar text action buttons use `borderRadius: 6` integer while IconBtn in the same component uses `var(--io-radius)` (both 6px currently but inconsistent); all heights hardcoded (36/44/36/28); loading skeleton uses 40px instead of actual 44px | N/A | Console + Designer: all toolbar heights are hardcoded integers with no token | — |
| **Notes** | `LayoutPickerButton` is module-local with its own custom inline absolute-positioned dropdown (`zIndex: 200`) | Loading skeleton toolbar placeholder uses 40px height vs the actual 44px, producing a brief layout shift on load | N/A | — | — |

---

## Category 4 — Menus

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Mix; right-click context menus use `shared/components/ContextMenu`; export quick-format dropdown is a hand-rolled inline-positioned panel | Mix; three patterns: custom inline dropdown (File menu, `position: absolute`), custom fixed-position dropdown (zoom presets, `getBoundingClientRect`), shared `ContextMenu` (tab right-click) | Shared-component only; `ContextMenu` is the sole menu type; no custom dropdown panels | All three use `shared/components/ContextMenu` for right-click context menus | — |
| **Source-of-truth files** | `index.tsx:3108–3405` (right-click menus); `index.tsx:2591–2654` (export dropdown); `shared/components/ContextMenu.tsx` | `DesignerModeTabs:317–389` (File menu); `DesignerToolbar:1373–1469` (zoom dropdown); `DesignerTabBar:102–253` (tab context menu); `shared/components/ContextMenu.tsx` | `shared/components/ContextMenu.tsx`; `Users:1628–1660`, `Roles`, `Groups` | `shared/components/ContextMenu.tsx` | — |
| **Visual properties actually applied** | ContextMenu: delegated to shared component; Export dropdown: `position: absolute`, `background: var(--io-surface-elevated)`, `border: 1px solid var(--io-border)`, `borderRadius: 6`, `boxShadow: 0 8px 24px rgba(0,0,0,0.3)`, items 13px | ContextMenu: delegated to shared component; File menu: `position: absolute`, `var(--io-surface-elevated)`, `boxShadow: 0 4px 16px rgba(0,0,0,0.35)`, `zIndex: 300`; Zoom dropdown: `position: fixed` (anchored via `getBoundingClientRect`), `zIndex: 2000` | ContextMenu container: `var(--io-surface-elevated)`, `border: 1px solid var(--io-border)`, `borderRadius: var(--io-radius)`, `boxShadow: 0 8px 24px rgba(0,0,0,0.4)`, `zIndex: 1800`; items: `var(--io-alarm-urgent)` for danger (not `--io-danger`) | All three: ContextMenu uses `var(--io-surface-elevated)` bg, `var(--io-border)` border, `var(--io-radius)` radius; hover applied via imperative `onMouseEnter`/`onMouseLeave` DOM mutation | — |
| **Deviations from app shell** | Export dropdown uses direct DOM style mutation (`e.currentTarget.style.background`) for hover rather than shared `ContextMenu`; no CSS class or React state | Zoom dropdown hover uses `var(--io-surface-hover)` (undefined token — no visual feedback); zoom font uses `var(--io-font-sans)` (undefined); box-shadows differ between File menu and zoom dropdown and do not use `--io-shadow-lg`; `zIndex: 300` vs `zIndex: 2000` across two custom dropdowns | None; Settings consumes `ContextMenu` identically to other modules | All three: custom dropdown implementations (where present) do not use `--io-shadow-lg` token | ContextMenu uses `var(--io-alarm-urgent)` for danger items rather than `var(--io-danger)`; same numeric value in dark theme but diverges in light theme |
| **Notes** | Export dropdown backdrop uses `position: fixed` — safe here since toolbar is not inside an RGL transform ancestor | File menu has no Escape key handler; Zoom dropdown uses `position: fixed` to escape toolbar's potential transform context (consistent with CLAUDE.md invariant) | `ConfirmDialog` (shared component) is used correctly for destructive actions; no dropdown menus needed | — | — |

---

## Category 5 — Side Panels

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Module-local-component; `ConsolePalette.tsx` with `useConsolePanelResize` hook; 220px default width, resizable by drag | Module-local-component; four files (`DesignerLeftPalette`, `DesignerRightPanel`, `ShapePointSelector`, `PointPickerModal`); no shared panel primitive | Module-local-component; bespoke `<aside>` in `index.tsx`; not derived from app-shell sidebar infrastructure | None; all three implement side panels independently | — |
| **Source-of-truth files** | `ConsolePalette.tsx:52–537`; `index.tsx:1127–1132` (state); `useConsolePanelResize.ts` | `DesignerLeftPalette:2430–2438`; `DesignerRightPanel:5961–5992`; `ShapePointSelector:378–393`; `PointPickerModal:44–55` | `index.tsx:179–229` (aside); `AppShell.tsx:1327–1516` (comparison baseline) | — | — |
| **Visual properties actually applied** | 220px; `background: var(--io-surface-secondary)`; `borderRight: 1px solid var(--io-border)`; accordion section headers 36px height; section label 11px/700/uppercase/0.06em; `--io-text-muted`; resize handle 5px `ns-resize` | DesignerLeftPalette: `background: var(--io-surface)`, `borderRight: 1px solid var(--io-border)`; `SectionHeader` 11px/600/uppercase/0.06em; 4px resize handle; palette tiles `var(--io-surface-elevated)` bg; DesignerRightPanel: `background: var(--io-surface)`, `borderLeft: 1px solid var(--io-border)`; RightPanel TabBar tabs 10px/uppercase | 220px; `background: var(--io-surface-secondary)`; `borderRight: 1px solid var(--io-border)`; nav items `padding: 7px 10px`, `borderRadius: var(--io-radius)`; active: `var(--io-accent-subtle)` bg + `var(--io-accent)` text/color | Console + Settings: 220px width, `var(--io-surface-secondary)` bg, `borderRight: 1px solid var(--io-border)` | DesignerLeftPalette diverges: uses `var(--io-surface)` not `var(--io-surface-secondary)` |
| **Deviations from app shell** | 220px vs `--io-sidebar-width: 240px`; `var(--io-text)` undefined in section search input; view mode selector hover via DOM mutation (`borderRadius: 3` vs `var(--io-radius)` on list items); `--io-sidebar-bg` token not used | DesignerLeftPalette: equipment tiles use `var(--io-surface-sunken)` (registered: index.css:26) vs `var(--io-surface-elevated)` for other tile types — real inconsistency in surface-tier choice; drag ghost hardcodes `borderRadius: 4px` and `color: "#09090b"`; `CanvasLayerRow` emoji icons (👁/🔒) vs SVG elsewhere; `var(--io-surface-raised)` undefined for `RowSection`; all hover via DOM mutation | 220px vs `--io-sidebar-width: 240px`; active left-border accent missing (AppShell shows `2px solid var(--io-accent)` on active items; Settings shows none); no hover transition (AppShell transitions bg/color); group header 11px vs AppShell 10px | Console + Settings: same width deviation (220px vs 240px token) and same background token (`var(--io-surface-secondary)`) but neither uses `--io-sidebar-width` | — |
| **Notes** | `PointsBrowserPanel` (app-shell) embedded inside the palette Points section; its styles are app-shell-owned | Stencil tile uses ⬜ emoji placeholder thumbnail; equipment tiles use `ShapeThumbnail` SVG; display element tiles use `DisplayElementPreview` SVG — three thumbnail strategies | Missing active left-border accent is the most visible deviation from AppShell nav pattern | — | — |

### Shared Infrastructure — Category 5

| Field | selection.css + MarqueeLayer.tsx |
|---|---|
| **Implementation** | Shared clipboard selection overlay system. `selection.css` applies a selection-box outline and glow effect to `.io-selection-overlay` container child elements via `data-indicator` attribute. `MarqueeLayer.tsx` renders a draggable marquee rectangle during drag operations via mouse events and writes to `globalSelectionStore`. |
| **Source-of-truth files** | `frontend/src/shared/clipboard/selection/selection.css:1-11`; `frontend/src/shared/clipboard/selection/MarqueeLayer.tsx:81-108` (render return), `:101` (token deviation) |
| **Visual properties actually applied** | `selection.css`: `[data-indicator="selection-box"]`: `outline: 2px solid var(--accent)`, `outline-offset: -1px`, `borderRadius: 2px`; `[data-indicator="soft-glow"]`: `box-shadow: 0 0 0 2px rgba(255,255,255,0.15), 0 0 12px 2px var(--accent)`, `borderRadius: 4px`. `MarqueeLayer.tsx`: container `position: absolute, inset: 0`; marquee rect while dragging: `background: rgba(80,180,255,0.08)`, `border: 1px dashed var(--accent)`, `pointerEvents: none` |
| **Deviations from app shell** | **Fixed 2026-05-27.** `var(--accent)` → `var(--io-accent)` in both files (selection.css lines 2 and 9; MarqueeLayer.tsx line 101). `MarqueeLayer.tsx:100` background `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)` (teal, index.css:42). Selection box outline, glow shadow, and marquee border now render with the correct teal accent color. |
| **Notes** | Regression resolved. Selection overlay is now visible. Two-line fix: selection.css (2 token references) + MarqueeLayer.tsx (1 token + 1 hardcoded background). Primary category: Cat 10 (Canvas). Secondary: Cat 5 (Panel/tile multi-select contexts). |

---

## Category 6 — Buttons

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Inline-styles; all native `<button>` elements; no shared Button component | Mix; no shared `<Button>` component; five patterns: primary (filled accent), secondary (bordered), destructive, `IconBtn` primitive, toggle/chip; `IconBtn` is the only reusable button primitive | Module-local-component; four named variants in `settingsStyles.ts` (`btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall`); row action buttons in `Users.tsx` duplicated inline | All three use `var(--io-accent)` for primary action button backgrounds; all three use `1px solid var(--io-border)` for secondary/outline borders; none use the 6 `--io-btn-*` tokens | — |
| **Source-of-truth files** | `index.tsx:2116–2824`; `PaneWrapper:143–619`; `PaneConfigModal:461–492`; `AlarmListPane:176–192`; `PointTablePane:185–270` | `DesignerToolbar:904–948` (IconBtn), `1618–1693` (text actions); `DesignerTabBar:208–238`; `DesignerHome:55–84`; `DesignerGraphicsList:342–955`; `DesignerImport:64–90`; `index.tsx:290–450` | `settingsStyles.ts:23–63`; `Users.tsx:1462–1519`; `Groups.tsx:27–31` | — | — |
| **Visual properties actually applied** | Primary: `var(--io-accent)` bg, `#fff` text, `borderRadius: 6`, `padding: 7–9px 14–20px`; Secondary toolbar: transparent, `var(--io-border)`, `borderRadius: 6`, 12px; Modal buttons: `borderRadius: 4`; Alarm Ack: `borderRadius: 3`; No hover states on toolbar or modal buttons | Primary: `var(--io-accent)` bg, `#fff` or `#09090b` text (hardcoded), `var(--io-radius)`; `IconBtn`: 32×32, `var(--io-radius)`, `transition: background 0.1s, color 0.1s`, hover `var(--io-surface-elevated)`; toolbar text actions: `borderRadius: 6` integer; tab close: `borderRadius: 3`; StatusBar segments are `<div>` not `<button>` | `btnPrimary`: `var(--io-accent)`, `var(--io-text-on-accent)` (undefined), `var(--io-radius)`, 13px/600; `btnSecondary`: transparent, `var(--io-text-secondary)`, `var(--io-border)`, `var(--io-radius)`, 13px; `btnDanger`: transparent, `var(--io-danger)`, `1px solid var(--io-danger)`, `var(--io-radius)`, 13px/600; no hover/focus styles on any variant | All three: primary button uses `var(--io-accent)` bg; secondary uses transparent bg + `var(--io-border)`; none use `--io-btn-*` tokens | — |
| **Deviations from app shell** | None of the 6 `--io-btn-*` tokens used; `borderRadius` inconsistent (6/4/3); `#fff` hardcoded on primary instead of `var(--io-accent-foreground)`; no hover states on any toolbar, pane icon, or modal button; no `:focus-visible` ring on any button | `#fff` or `#09090b` hardcoded on primary (not `var(--io-accent-foreground)`); `DesignerImport` fallback `#3b82f6` (blue) on `btnPrimary` is wrong hue; toolbar text actions use `borderRadius: 6` integer while IconBtn uses `var(--io-radius)`; two incompatible destructive styles (ghost rgba vs solid fill) | `--io-text-on-accent` undefined in `btnPrimary`; `btnSecondary`/`btnSmall` have no `fontWeight` (browser default 400 vs 600 on primary/danger); row action buttons duplicated inline in `Users.tsx`; close icon inconsistency (`✕` vs `x`); no hover or focus styles on any variant | All three: primary button text color is hardcoded (`#fff` or `#09090b`) or uses undefined token (`--io-text-on-accent`) rather than `var(--io-accent-foreground)`; all three suppress or lack hover/focus styles | — |
| **Notes** | No `:focus-visible` ring on any button in Console | StatusBar clickable grid/zoom/binding-summary segments are `<div onClick>` not `<button>` — no keyboard navigation | `BulkUpdate.tsx` defines its own full button set (`BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_DANGER`) independently from `settingsStyles`, introducing a second button system within Settings | — | — |

---

## Category 7 — Form Inputs

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Inline-styles; all form inputs use inline styles; no shared input or select component | Mix; `DesignerRightPanel` defines a reusable `inputStyle` constant + `NumberInput`, `SelectInput`, `ColorInput`, `ThemedColorSelect` helpers; `ShapePointSelector` defines its own `inputStyle` with different tokens; `PointPickerModal` defines its own style constants | Module-local-component; `settingsStyles.ts` exports `inputStyle` and `labelStyle`; most pages import these directly; exceptions: `Import.tsx`, `BulkUpdate.tsx`, `Sessions.tsx` define independent constants | All three suppress the native browser focus ring (`outline: none`) without a CSS replacement; Console and Settings use none of the five `--io-input-*` tokens; Designer's `ShapePointSelector` uses `--io-input-bg` and `--io-input-border`; all use `accentColor: var(--io-accent)` for checkboxes/radios in at least some pages | — |
| **Source-of-truth files** | `PaneConfigModal:65–437`; `index.tsx:3499–3547`; `PaneWrapper:1037–1055`; `ConsolePalette:404–424` | `DesignerRightPanel:219–458`; `ShapePointSelector:363–375`; `PointPickerModal:68–128` | `settingsStyles.ts` (baseline); `OpcSources`, `Certificates`, `AuthProviders`, `PointManagement`, `Email`, `Import`, `BulkUpdate`, `Sessions` | — | — |
| **Visual properties actually applied** | Text inputs: `var(--io-surface-secondary)` or `var(--io-surface-elevated)` bg (inconsistent across structurally identical inputs), `borderRadius: 6` or `4` (inconsistent), 13px, `outline: none`; checkboxes: `accentColor: var(--io-accent)` | `DesignerRightPanel inputStyle`: `var(--io-surface)` bg, `var(--io-radius)`, 12px, `outline: none`; `ShapePointSelector inputStyle`: `var(--io-input-bg)` (registered: index.css:131), `var(--io-input-border)` (registered: index.css:132), `borderRadius: 4` integer; `PointPickerModal`: `var(--io-surface-sunken)` bg, `var(--io-radius)` | `settingsStyles inputStyle`: `var(--io-surface-sunken)`, `1px solid var(--io-border)`, `var(--io-radius)`, `padding: 8px 10px`, 13px; `labelStyle`: 12px/500/`--io-text-secondary`/`marginBottom: 5px` (no `textTransform` or `letterSpacing`) (settingsStyles.ts:15-21); checkboxes via `accentColor: var(--io-accent)` on most pages | All three: `border: 1px solid var(--io-border)`; `outline: none`; native checkboxes/radios with `accentColor: var(--io-accent)` (some pages) | — |
| **Deviations from app shell** | `outline: none` removes focus ring; inconsistent backgrounds (`--io-surface-secondary` vs `--io-surface-elevated`) across structurally identical inputs; `borderRadius: 4` vs `6` across inputs; `var(--io-text)` undefined used in some inputs; no `--io-input-*` tokens | Three different input background tokens across three files (`var(--io-surface)`, `var(--io-input-bg)`, `var(--io-surface-sunken)`); `--io-input-bg` (index.css:131) and `--io-input-border` (index.css:132) in `ShapePointSelector` ARE registered tokens; ShapePointSelector correctly uses two of the five `--io-input-*` tokens; `--io-surface-raised` in `RowSection` unregistered; `RowSection` header is `<div onClick>` not `<button>`; `fontSize: "1em"` (relative) in `ShapePointSelector` vs bare integers elsewhere | `Import.tsx` uses `var(--io-surface-secondary)` not `var(--io-surface-sunken)` for input background; three different input backgrounds within `Import.tsx` alone; `BulkUpdate.tsx` uses `borderRadius: "6px"` string instead of `var(--io-radius)`; `--io-space-0` through `--io-space-48` (17 tokens) ARE defined in index.css:148-164; `BulkUpdate` and `RestorePreviewModal` correctly use registered spacing tokens; `AuthProviders` injects global `<style>` tag for checkbox accent-color; `BulkUpdate`/`RestorePreviewModal` conflict radios have no accent-color | Console and Settings: no `--io-input-*` tokens used; Designer's `ShapePointSelector` uses `--io-input-bg` (index.css:131) and `--io-input-border` (index.css:132); all three suppress focus ring | — |
| **Notes** | `fontFamily: monospace` (not `--io-font-mono`) on point tag labels in search results | `ThemedColorSelect` (restricts to ISA-101 token pairs: primary/secondary/muted) is the most defensible form input pattern in any of the three modules | `settingsStyles.ts inputStyle` is the closest to a shared pattern; divergence in `Import`/`BulkUpdate`/`Sessions` is a maintenance liability | — | — |

---

## Category 8 — Status Indicators

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Inline-styles; all hand-drawn `<span>` elements with circle or badge styles; no shared component | Inline-styles; module-local; scattered across `DesignerToolbar` (dirty dot, READ-ONLY badge), `DesignerTabBar` (modified dot), `DesignerStatusBar` (WS dot, binding summary, TEST MODE) | Inline-styles; no shared component; five distinct `StatusBadge` implementations across `OpcSources`, `SystemHealth`, `Import`, `Email`, `PointManagement`; connection dots in `OpcSources` and `SystemHealth` | All three: no shared status indicator component; all three use small circle dots (6–8px) for binary connection/state indicators; all three use `var(--io-success)` / `var(--io-danger)` tokens for the connected/error states | — |
| **Source-of-truth files** | `index.tsx:59–134` (ConsoleStatusBar); `index.tsx:2026–2052` (tab dots, banners); `AlarmListPane:34–91`; `PointTablePane:26–59` | `DesignerStatusBar:204–371`; `DesignerToolbar:1584–1615`; `DesignerTabBar:181–193` | `OpcSources:156–186`; `SystemHealth:41–70`; `Import:72–106`; `Email:187–212`; `PointManagement:126–232`; `OpcSources` + `SystemHealth` connection dots | — | — |
| **Visual properties actually applied** | Connection dot: 6×6px circle, `var(--io-success)`/`var(--io-warning)`/`var(--io-danger)`; dirty/playback dot: 6×6 `var(--io-warning)`; published dot: `#10b981` hardcoded; `PriorityBadge`: pill with hardcoded `rgba()` backgrounds per level; `StateBadge`: text-color-coded; `QualityBadge`: 6×6 circle + text, hardcoded colors | WS dot: `●` glyph 8px, `#22c55e`/`#ef4444` hardcoded; dirty indicator: 7×7px div, `#f97316` hardcoded; READ-ONLY badge: `#eab308`/`rgba(234,179,8,*)` hardcoded; modified tab dot: `var(--io-warning, #f59e0b)` — only token-using indicator; TEST MODE: `#4ade80` with CSS keyframe animation injected as inline `<style>` tag | `OpcSources StatusBadge`: hex-alpha concat bug (broken background); `SystemHealth`: `color-mix(in srgb, colorVar 12%, transparent)` (correct); `Import`: `--io-success-subtle`/`--io-success` token pairs (correct); `Email`: dot-only 7px, token-based; `PointManagement CriticalityBadge`: token pairs (correct); connection dots: `var(--io-success)`/`var(--io-danger)` fill + hardcoded `#22c55e` glow shadow | All three use `var(--io-success)`/`var(--io-danger)` as primary fill tokens for connection state dots | — |
| **Deviations from app shell** | Alarm priority badge colors hardcoded (not `--io-alarm-*` tokens); published dot `#10b981` ≠ `var(--io-success)` (`#22c55e` dark); quality badge colors have no token equivalent; save-failure banner uses `#fff` not `var(--io-status-fg)` | WS dot bypasses tokens (`#22c55e`, `#ef4444`); dirty indicator `#f97316` not a token reference; READ-ONLY badge uses `#eab308` (distinct yellow) not `var(--io-warning)`; TEST MODE fully hardcoded including `<style>` tag injected on every render cycle; only `DesignerTabBar` modified dot uses a token (`var(--io-warning, #f59e0b)`) | **Fixed 2026-05-27:** `OpcSources StatusBadge` hex-alpha concat bug resolved — `background: \`${color}20\`` → `color-mix(in srgb, ${color} 12%, transparent)`; `border: \`1px solid ${color}40\`` → `1px solid color-mix(in srgb, ${color} 25%, transparent)`. Fix uses the `color-mix` pattern already established in `SystemHealth.tsx`; scoped to the local `StatusBadge` function (OpcSources.tsx:168–170). Remaining: `--io-info: #3b82f6` IS defined in index.css:72; `AuthProviders TypeBadge` uses it correctly with matching fallback — no visual regression; connection dot glow shadow hardcodes `#22c55e` (not `var(--io-success

--- File: /home/io/io-dev/io/ui-audit/04-recommendations.md ---
# UI Audit Recommendations

**Derived from:** `ui-audit/02-comparison.md` (post-reconciliation, authoritative)
**Date:** 2026-05-27

---

## Section 1 — Target Architecture

The user's working hypothesis stated three claims. Each is evaluated against the audit evidence.

### Claim A: App shell (top bar, left nav, routing, theme) should be shared across all modules

**Supported — partially already true, partially aspirational.**

All three modules draw from the same `index.css` 138-token registry (Cat 1, List 1 Item 1). The `shared/components/ContextMenu` component, `VersionRecoveryDialog`/`SaveConfirmDialog`, and `ConfirmDialog` are already cross-module shared infrastructure (Cat 4 List 1 Item 3; Cat 11 notes). The AppShell sidebar design pattern (`--io-sidebar-width: 240px`, active left-border accent) exists and is implemented, but all three modules deviate from it with hardcoded 220px and missing active indicators (Cat 5, Deviations). The token registry is the correct shared foundation; the gap is that modules define their own overrides, reference undefined tokens, and ignore defined tokens for height, modal backdrop, z-index, and button styles.

**Refined target:** The app shell provides the token registry, routing, top bar, sidebar chrome, and a small set of shared primitive components. Modules consume these without redefining them. No module defines its own token namespace; undefined token references are zero; every module uses the same constants for sidebar width, modal backdrop, and z-index stacking.

### Claim B: Each module should share an underlying framework implemented uniformly

**Partially supported — the right framing is a thin shared-constants layer, not a component library.**

The audit found no shared Button component, no shared Input component, no shared Dialog wrapper, and no shared form label component spanning all three modules. However, it also found that the `settingsStyles.ts` approach — a named export from a module-level constants file — is already the closest to a shared standard and is the pattern most easily extended (Cat 7, List 1; Cat 6, List 3 Items 1, 3). Designer's `IconBtn` and `FieldLabel` are module-local reusable primitives that would require minimal adaptation to promote to `shared/components/` (Cat 6; Cat 9, List 3 Item 6).

A heavyweight component library is not warranted given the app's scale. The evidence supports a **thin shared-constants and shared-primitives layer**: a small file of style constant objects (`btnPrimary`, `btnSecondary`, `inputStyle`, `labelStyle`) plus two or three React components (`FieldLabel`, `StatusBadge`, `Dialog`) promoted into `shared/components/`. Hover and focus states should be CSS-driven rather than DOM-mutation-driven (Cat 2 List 1 Item 9), which is achievable with a small `shared/styles/` Tailwind-class or CSS-module approach without a full component system.

**Refined target:** A `shared/styles/` constants file and no more than four new shared components replace the per-module duplicates. No module defines its own button system, input style, or dialog backdrop independently.

### Claim C: The main canvas/work area should share a rendering engine with per-module functionality layered on top

**Partially supported with a critical clarification about what "rendering engine" means.**

The shared graphics layer (`SceneRenderer`, `TimeSeriesChart`/`ChartRenderer`, `DataTable`, and the CSS files `alarmFlash.css`, `operationalState.css`, `lod.css`) is already a shared rendering engine consumed inside Console panes. This is working correctly and should continue (Cat 10, Shared Infrastructure entries). The evidence does NOT support merging the work-surface containers: Console's `WorkspaceGrid` (react-grid-layout tile dashboard) and Designer's `DesignerCanvas.tsx` (12,067-line SVG editor with FSM interaction model) serve fundamentally different work modes and share no meaningful interaction semantics (Cat 10, Implementation). Converging the containers would introduce false coupling without shared benefit.

**Refined target:** The shared rendering engine exists and should be maintained. The work-surface container is intentionally module-specific. The correct convergence work in Cat 10 is fixing bugs in the shared infrastructure (selection token prefix bug, alarmFlash.css theme hardcoding) and ensuring each module's canvas follows the same token conventions for its local chrome — not merging the containers.

---

### Consolidated target architecture statement

When this work is complete:

1. The `index.css` token registry is the sole source for all color, spacing, radius, shadow, and z-index values. No undefined tokens are referenced anywhere in the frontend. No module defines its own token namespace.

2. A `shared/styles/` constants file provides named style objects for buttons, inputs, and field labels used uniformly across Console, Designer, and Settings. No module duplicates a button or input style system independently.

3. Four shared components exist in `shared/components/`: `FieldLabel` (promoted from Designer), `StatusBadge` (promoted from Settings Import pattern), `Dialog` (wrapper with ARIA, `--io-modal-backdrop`, and a coordinated z-index), and `ConfirmDialog` (already exists; usage extended to all modules).

4. The shared graphics rendering layer (`SceneRenderer`, the CSS infrastructure files) is maintained as-is. The work-surface containers (WorkspaceGrid, DesignerCanvas) remain module-specific.

5. All interactive elements have visible focus indicators. DOM-mutation hover (`onMouseEnter`/`onMouseLeave` style writes) is replaced with CSS `:hover` rules or React state.

---

## Section 2 — Per-Element Convergence Recommendations

### Category 1 — Color Palette and Theme Tokens

**Standardize on:** The existing `index.css` 138-token registry. No changes to the registry structure; only fix what is broken in the token graph.

**Actions:**

- **Define missing tokens** — add to `index.css`:
  - `--io-bg` (used in Console but undefined — alias to `--io-surface-primary` or `--io-bg: var(--io-surface-primary)`)
  - `--io-text` (used in Console and Designer — alias to `--io-text-primary`)
  - `--io-surface-hover` (used in Designer zoom dropdown — alias to `--io-surface-elevated`)
  - `--io-font-sans` (used in Designer zoom dropdown — define with the same font stack as the document)
  - `--io-text-on-accent` (used in Settings btnPrimary — alias to `--io-accent-foreground`)
  - `--io-error` (used in DesignerCanvas context menu — alias to `--io-danger`)

- **Replace hardcoded hex with tokens** — highest-value cases:
  - Console published dot `#10b981` → `var(--io-success)`
  - Console alarm priority badges (PriorityBadge hardcoded rgba) → `--io-alarm-urgent`, `--io-alarm-high`, `--io-alarm-low`, etc.
  - Designer WS dot `#22c55e`/`#ef4444` → `var(--io-success)`/`var(--io-danger)`
  - Designer dirty indicator `#f97316` → `var(--io-warning)`
  - Designer READ-ONLY badge `#eab308` → `var(--io-warning)`
  - All modules: connection dot glow shadow `#22c55e` → `var(--io-success)`
  - `alarmFlash.css`: migrate hardcoded hex to `--io-alarm-*` tokens (see Cat 8 and Cat 10 notes)

- **Do not change:** `operationalState.css` hardcoded ISA-101 colors — documented intentional exception.

**Build new vs adopt:** No new infrastructure. Token registry is already the correct approach; this is a fill-the-gaps exercise.

---

### Category 2 — Typography

**Standardize on:** Raw pixel inline styles as the de-facto standard for component-level typography. The 16 `--io-text-*` scale tokens exist but have zero usage across all three modules; mandating adoption is a wide-blast refactor for low functional gain unless font-size theming is a product requirement.

**What to standardize now:** Document a fixed set of semantic size/weight values for recurring label contexts. Adopt these values uniformly rather than letting each module drift:

| Context | Value | Basis |
|---|---|---|
| Page title | 18px / 600 / `--io-text-primary` | Settings `SettingsPageLayout` |
| Section/palette group label | 11px / 600 / uppercase / 0.06em / `--io-text-muted` | Console palette, Designer SectionHeader agree |
| Form field label | 11px / 600 / uppercase / 0.05em / `--io-text-muted` | Designer `FieldLabel` (after minor size alignment) |
| Tab label active / inactive | 13px / 600 / 400 | Console + Designer tab strips agree |
| Table column header | 11px / 600 / uppercase / 0.06em | Console + Settings agree |

**Actions:**
- Fix: `fontFamily: monospace` → `var(--io-font-mono)` in all three modules (after defining `--io-font-sans` unblocks confidence in the font token approach)
- Adopt: Settings `SettingsPageLayout` as the shared page-title component (see Cat 9)
- Adopt: Designer `FieldLabel` as the shared form label component (see Cat 9)
- Eliminate: Sub-minimum font sizes (Console SubGroupLabel 9px, PaneTypeBadge 10px should be raised to 11px minimum)

**Do not attempt now:** Migrating all raw pixels to `--io-text-*` scale tokens. Defer until font-size scaling is a product requirement.

---

### Category 3 — Toolbars

**Standardize on:** Module-local toolbar components remain the right approach — toolbar structure is inherently module-specific. Converge on the *visual properties* shared between Console and Designer.

**Adopt:** The Console/Designer shared visual convention that already exists:
- `background: var(--io-surface)` / `borderBottom: 1px solid var(--io-border)`
- Active tab underline: `2px solid var(--io-accent)`
- Tab label: 13px / 600 active / 400 inactive
- Icon button: 32×32 with `var(--io-radius)` radius and `transition: background 0.1s, color 0.1s`

**Actions:**
- Fix: Duplicate Publish button in Console (two render blocks; remove one)
- Fix: Designer loading skeleton 40px → 44px (layout shift on load)
- Fix: Designer StatusBar segments (`<div onClick>`) → `<button>` for keyboard navigation
- Fix: All toolbar heights hardcoded — not a blocker but add a `--io-toolbar-height` token if/when height theming is needed
- Fix: Designer toolbar text-action buttons use `borderRadius: 6` integer while `IconBtn` uses `var(--io-radius)` — standardize on `var(--io-radius)` throughout

**Build new:** None. Shared constants for the visual convention are sufficient.

---

### Category 4 — Menus

**Standardize on:** `shared/components/ContextMenu` as the sole menu primitive. Settings demonstrates this is sufficient for a complex module (Cat 4, List 3 Item 5).

**Actions:**
- Fix: `ContextMenu` danger item color: `var(--io-alarm-urgent)` → `var(--io-danger)` in `shared/components/ContextMenu.tsx`
- Fix: Designer File menu — add Escape key handler to close
- Fix: Designer zoom dropdown hover — `var(--io-surface-hover)` → `var(--io-surface-elevated)` (after defining `--io-surface-hover` as an alias)
- Fix: Designer zoom dropdown box-shadow → use `--io-shadow-lg` token if defined, or a consistent hardcoded value matching the File menu
- Migrate: Console export quick-format dropdown → replace with `ContextMenu` usage (low-risk; existing pattern is one custom dropdown)
- Evaluate: Designer File menu — if `ContextMenu` can represent a triggered (non-right-click) menu, migrate; otherwise keep but fix the Escape handler and hover state

**Build new:** None.

---

### Category 5 — Side Panels

**Standardize on:** Module-local panel components remain the right approach (panels differ structurally across modules). Converge on visual properties.

**Adopt:** Console + Settings convention: `background: var(--io-surface-secondary)`, `borderRight: 1px solid var(--io-border)`.

**Actions (highest priority first):**
- **Fixed 2026-05-27** (functional regression): `shared/clipboard/selection/selection.css` — `var(--accent)` → `var(--io-accent)` (lines 2 and 9). `MarqueeLayer.tsx` — `var(--accent)` → `var(--io-accent)` (line 101) and `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)` (line 100). Selection highlight and marquee border now render with teal accent color.
- Fix: Align Designer left palette background: `var(--io-surface)` → `var(--io-surface-secondary)` to match Console and Settings
- Fix: Resolve `--io-sidebar-width` discrepancy — either update the token to 220px to match current practice, or update all three modules to 240px. Pick one and be consistent.
- Fix: Settings active nav item — add `borderLeft: 2px solid var(--io-accent)` on active state to match AppShell pattern
- Fix: Replace DOM-mutation hover in Console palette (`e.currentTarget.style.*`) with CSS `:hover` or React state
- Fix: Designer `CanvasLayerRow` `--io-surface-raised` undefined → use `var(--io-surface-elevated)`
- Fix: Section label typography — standardize on 11px/600/uppercase/0.06em per Cat 2 table (Console and Designer already agree; bring Settings nav group into alignment)

**Build new:** None for panel containers. Shared `FieldLabel` (Cat 9) and `StatusBadge` (Cat 8) are the shared components this category depends on.

---

### Category 6 — Buttons

**Standardize on:** `settingsStyles.ts` named-variant pattern as the starting point. Promote to `shared/styles/buttons.ts` accessible across all modules.

**Adopt:** The four named variants `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall` with corrected token references. Do not build a React `<Button>` component — named style constant objects are sufficient and the existing patterns already use this approach.

**Actions:**
- Create: `frontend/src/shared/styles/buttons.ts` with corrected variants:
  - `btnPrimary`: `var(--io-accent)` bg, `var(--io-accent-foreground)` text (replaces `--io-text-on-accent` and hardcoded `#fff`/`#09090b`), `var(--io-radius)`, add hover state via `transition: opacity 0.1s` or `var(--io-btn-hover)` token
  - `btnSecondary`: transparent bg, `var(--io-text-secondary)` text, `1px solid var(--io-border)`, `var(--io-radius)`, matching font-weight (600)
  - `btnDanger`: same structure as secondary but `var(--io-danger)` text and border
  - `btnSmall`: size modifier only
- Migrate: Console toolbar + modal buttons to the shared file
- Migrate: Designer text-action buttons and Stencil/Import primary buttons to the shared file; leave `IconBtn` as-is (it is already a good local primitive)
- Merge: `BulkUpdate.tsx` `BTN_PRIMARY`/etc. → import from shared file
- Fix: Designer StatusBar segments `<div onClick>` → `<button>` (see Cat 3)
- Fix: Add CSS hover states to all button variants; remove all `onMouseEnter`/`onMouseLeave` style mutations on buttons
- Fix: `DesignerImport` fallback `#3b82f6` primary button background → `var(--io-accent)`
- Fix: All destructive button inconsistency in Designer (ghost rgba vs solid fill) → standardize on `btnDanger` solid pattern

**Build new:** `shared/styles/buttons.ts` (constants file, not a component).

---

### Category 7 — Form Inputs

**Standardize on:** `settingsStyles.ts inputStyle` pattern. Same approach as buttons: promote to `shared/styles/inputs.ts`.

**Adopt:** Standard input object: `background: var(--io-surface-sunken)`, `border: 1px solid var(--io-border)`, `borderRadius: var(--io-radius)`, `padding: 8px 10px`, `fontSize: 13px`, `color: var(--io-text-primary)`. Use `--io-input-bg` and `--io-input-border` tokens where applicable (Designer's ShapePointSelector already does this correctly and can serve as validation that the tokens work).

**Actions:**
- Create: `frontend/src/shared/styles/inputs.ts` with `inputStyle` and `labelStyle` objects
- Migrate: Console `PaneConfigModal`, `PaneWrapper`, `ConsolePalette` inputs to shared inputStyle
- Migrate: Designer `DesignerRightPanel inputStyle`, `PointPickerModal` inputs to shared inputStyle
- Migrate: Settings `Import.tsx`, `BulkUpdate.tsx`, `Sessions.tsx` (the current diverging cases) to the shared inputStyle
- Fix (accessibility — all modules): Remove `outline: none` and replace with `outline: 2px solid var(--io-accent)` on `:focus-visible`. This is a wide change; use the shared constants file so it's fixed in one place.
- Fix: `fontFamily: monospace` → `var(--io-font-mono)` in Console `PaneConfigModal` and Settings `Groups.tsx`
- Fix: `AuthProviders.tsx` — remove the `<style>` tag injected for checkbox `accent-color`; use the `accentColor: "var(--io-accent)"` inline style already used by other pages
- Keep: Designer `ThemedColorSelect` as a module-local specialized component (restricts to ISA-101 token pairs — this is domain logic, not a shared concern)

**Build new:** `shared/styles/inputs.ts` (constants file, not a component).

---

### Category 8 — Status Indicators

**Standardize on:** Settings `Import.tsx` token-pair pattern (`background: var(--io-success-subtle)`, `color: var(--io-success)`) as the canonical StatusBadge implementation.

**Build new:** `shared/components/StatusBadge.tsx` — a simple component accepting `status` (connected/disconnected/error/warning/info/running/etc.) and optional `label` props, rendering with the correct token pair for each state. This is the one new component where a React component (not just a constants object) is warranted, because the rendering logic (which token pair, whether to show dot vs pill vs text) is non-trivial and repeated five different ways in Settings alone.

**Actions:**
- Fix (functional regression): `OpcSources StatusBadge` hex-alpha concat bug — `${color}20` → `color-mix(in srgb, ${color} 12%, transparent)` or migrate to shared `StatusBadge` component
- Migrate: All five Settings StatusBadge implementations → shared component
- Migrate: Console connection dots and priority/state/quality badges → shared component or token-based inline styles
- Migrate: Designer WS dot, dirty indicator, READ-ONLY badge → use token colors (minimum); migrate to shared component where appropriate
- Fix: Designer TEST MODE `<style>` tag injection → CSS class + token-based keyframe, remove the inline `<style>` element
- Fix: Console published dot `#10b981` → `var(--io-success)`
- Fix: All connection dot glow shadows `#22c55e` → `var(--io-success)` (or remove glow if it introduces complexity)
- Fix: `alarmFlash.css` — migrate `#ef4444`, `#f97316`, `#eab308`, `#f4f4f5`, `#60a5fa` to `--io-alarm-urgent`, `--io-alarm-high`, `--io-alarm-low`, `--io-alarm-diagnostic`, `--io-alarm-custom` tokens. This is the correct fix for theme adaptation; the off-state `#808080` has no token equivalent and should be defined (`--io-alarm-inactive: #808080`).

**Do not change:** `operationalState.css` — ISA-101 hardcoded colors are intentional and documented.

---

### Category 9 — Labels and Headers

**Standardize on:** Two shared components to promote:
1. `SettingsPageLayout.tsx` for page-level heading (already a shared component within Settings; extend access to Console and Designer views)
2. `FieldLabel` from `DesignerRightPanel` — promote to `shared/components/FieldLabel.tsx`

**Actions:**
- Promote: `DesignerRightPanel.tsx` `FieldLabel` (lines 201–203) → `shared/components/FieldLabel.tsx`. Minimal changes: standardize size to 11px (from 10px) to align with the Cat 2 table convention; keep other properties (`/600/uppercase/0.05em/--io-text-muted`).
- Adopt: `FieldLabel` in Console `PaneConfigModal` and Settings pages to replace inline `<div>`-based form labels
- Adopt: `SettingsPageLayout` pattern — evaluate extending it to Console's `PaneConfigModal` header and Designer's view-level headers as applicable
- Fix: `var(--io-text)` undefined in Console/Designer dialog titles → `var(--io-text-primary)`
- Fix: Inconsistent `letterSpacing` across uppercase labels → standardize on 0.06em
- Fix: Console — no semantic heading elements anywhere; add `<h2>` for page/section titles where appropriate
- Fix: Designer `SymbolLibrary` — `<h2>` elements with inconsistent sizes (15px/600 vs 16px/700 within same file) → pick one and apply consistently
- Do not change: Settings `SettingsPageLayout` `<h2>` page title — correct semantic for a sub-page context

---

### Category 10 — Canvas / Main Work Area

**Standardize on:** Module-specific canvas containers are correct and should not be merged. Shared graphics infrastructure should be the focus.

**Actions (by priority):**

- **Fixed 2026-05-27** (functional regression, was highest priority): `shared/clipboard/selection/selection.css` and `MarqueeLayer.tsx` — `var(--accent)` → `var(--io-accent)` (selection.css lines 2 and 9; MarqueeLayer.tsx line 101). `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)` (MarqueeLayer.tsx line 100). Selection highlight and marquee border now render with teal accent color.
- Fix: `alarmFlash.css` — migrate alarm hex colors to `--io-alarm-*` tokens (see Cat 8). Required for light/HPHMI theme support.
- Fix: Console `WorkspaceGrid` container `var(--io-bg)` (undefined) → `var(--io-surface-primary)` (after defining `--io-bg` alias in Cat 1 token work, this becomes automatic)
- Fix: DesignerCanvas canvas border `rgba(255,255,255,0.08)` → define a token or use `var(--io-border)` with opacity; grid lines `rgba(128,128,128,0.12/0.28)` → acceptable to leave as-is if theme support is not required for the grid appearance
- Fix: DesignerCanvas resize handles `fill="white"` → `fill="var(--io-text-inverse)"` or keep `white` with a formal comment documenting it as intentional in dark-theme-only contexts
- Fix: `--io-error` references in DesignerCanvas → `--io-danger` (after defining `--io-error` alias in Cat 1 token work, this becomes automatic)
- Fix: Guide line colors (`rgba(0,200,255,0.5)`, `rgba(255,160,0,0.5)`) — low priority, canvas-only; acceptable as-is if guide colors are intentional design choices
- Fix: "Paste as…" submenu items for `table`/`temporary-graphic` always render disabled — separate bug, out of scope for UI consistency work but worth a task file

**Do not change:** `lod.css` (no deviations), `operationalState.css` (intentional exception).

---

### Category 11 — Modals and Dialogs

**Standardize on:** Build one shared `Dialog` wrapper component. Radix Dialog (already used in Settings for PointManagement, AuthProviders, Email) is the best implementation and should be the standard for new dialogs. The shared wrapper provides: `--io-modal-backdrop` backdrop, `role="dialog"` + `aria-modal="true"`, `background: var(--io-surface-elevated)`, `borderRadius: var(--io-radius-lg)`, and a coordinated z-index.

**Actions:**

- Fix (token): Standardize z-index values. `--io-z-modal: 300` is misaligned with actual usage (1000–9999). Either raise the token to 1000 minimum, or define a z-index scale (`--io-z-dropdown: 200`, `--io-z-modal: 1000`, `--io-z-toast: 2000`). Do not leave the token at 300 when no dialog uses it.
- Fix (token): `--io-modal-backdrop` is already defined and used in ≥6 Settings files. Console and Designer should migrate to it from hardcoded `rgba(0,0,0,0.5–0.6)`.
- Fix (accessibility, urgent): `RestorePreviewModal.tsx` — add `role="dialog"` and `aria-modal="true"`. This is the highest-priority ARIA gap because it appears on a destructive-adjacent action path.
- Fix (accessibility): Console inline modals (3 dialogs in `index.tsx`) — add `role="dialog"` and `aria-modal`.
- Fix (accessibility): Settings `Import.tsx` Modal/Drawer and `OpcSources ManageCategoriesModal` — add ARIA.
- Fix: Replace all 8 `window.confirm()` calls with `ConfirmDialog`:
  - OpcSources.tsx (3 calls)
  - Import.tsx (3 calls)
  - CameraStreams.tsx (1 call)
  - SupplementalConnectorsTab.tsx (1 call)
- Fix: Standardize `borderRadius` to `var(--io-radius-lg)` across all modals (currently 8, 9, 10, 12px scattered)
- Fix: Standardize modal content background to `var(--io-surface-elevated)` (currently mixed with `--io-surface`, `--io-surface-secondary`, `--io-surface-primary`)
- Fix: Designer primary button text in dialogs — `#09090b`/`#fff` hardcoded → `var(--io-accent-foreground)` (after shared buttons.ts is in place, this is automatic)
- Fix: Designer error color mixing (`--io-alarm-high` for errors in wrong domain, `--io-error` undefined) → use `--io-danger` consistently
- Fix: Designer step indicator inconsistency across 5 wizard dialogs — define one step indicator pattern (not blocked by other work but needs its own task)

---

## Section 3 — Rough Migration Order

The dependency structure has four phases. Items within a phase are largely independent of each other.

### Phase 1 — Token registry (unblocks everything downstream)

No component changes. Pure token additions to `index.css`.

1. Define missing tokens: `--io-bg`, `--io-text`, `--io-surface-hover`, `--io-font-sans`, `--io-text-on-accent` (alias to `--io-accent-foreground`), `--io-error` (alias to `--io-danger`), `--io-alarm-inactive: #808080`, `--io-text-inverse`.
2. Fix z-index token: raise `--io-z-modal` to a realistic value (recommend 1000); optionally define `--io-z-dropdown: 500` and `--io-z-toast: 2000`.
3. Resolve sidebar width: pick 220px or 240px; update token or code to match.

**Why first:** Every downstream fix that replaces hardcoded hex or undefined token references becomes a one-word change once these tokens exist. Without them, each fix requires two changes (add the token AND update the reference).

### Phase 2 — Functional regressions (urgent; no dependency on Phase 1 being complete)

These are bugs visible at runtime, not polish issues.

1. ~~`selection.css` + `MarqueeLayer.tsx`: `var(--accent)` → `var(--io-accent)`, `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)`. (2-file change.)~~ **Fixed 2026-05-27.**
2. ~~`OpcSources StatusBadge` hex-alpha concat bug: `${color}20` → `color-mix(...)` or component migration.~~ **Fixed 2026-05-27.** `background: \`${color}20\`` → `color-mix(in srgb, ${color} 12%, transparent)`; `border: \`1px solid ${color}40\`` → `color-mix(in srgb, ${color} 25%, transparent)`. Fix scoped to the local `StatusBadge` function in `OpcSources.tsx` (lines 168–170); matches the `color-mix` pattern already used by `SystemHealth.tsx`. **Note:** The same `${color}20`/`${color}40` hex-alpha pattern also appears in `Users.tsx` (Badge, line 108/110), `Roles.tsx` (Badge, line 51/53), `CameraStreams.tsx` (line 785/787), and `MaintenanceTicketsPanel.tsx` (line 52) — these were not fixed here and remain broken when CSS variable strings are passed as the color argument.
3. `alarmFlash.css`: migrate hex to `--io-alarm-*` tokens. (This affects theme support, not current dark-theme functionality, but the hardcoded values are wrong in principle and block HPHMI work.)
4. Critical ARIA fixes: `RestorePreviewModal` + Console inline modals + Import/OpcSources dialogs. (Accessibility regression on destructive paths.)
5. Replace 8 `window.confirm()` calls with `ConfirmDialog`.
6. Console duplicate Publish button — remove one render block.

**Why second:** These are observable regressions. They are small-scope, can be reviewed independently, and should not wait for the broader convergence work.

### Phase 3 — Shared style constants (enables consistent convergence without component work)

Depends on: Phase 1 token fixes (so constants reference valid tokens).

1. Create `shared/styles/buttons.ts` with corrected `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall` variants.
2. Create `shared/styles/inputs.ts` with standard `inputStyle` (including focus ring; remove `outline: none`).
3. Migrate Console button and input inline styles to shared constants.
4. Migrate Designer text-action buttons and import buttons to `buttons.ts`; migrate `DesignerRightPanel inputStyle` and `PointPickerModal` to `inputs.ts`.
5. Migrate Settings `Import.tsx`, `BulkUpdate.tsx`, `Sessions.tsx` diverging buttons and inputs to shared constants.
6. Fix `accentColor` / font-family regressions (OpcSources `<style>` tag, monospace font references) as part of input migration.

**Unblocks:** Phase 4 modal work (button styles inside dialogs) and Cat 6/7 cleanup across all modules.

### Phase 4 — Shared components (highest coordination cost)

Depends on: Phase 3 constants (dialogs need buttons; StatusBadge needs token pairs from Phase 1).

1. Promote `FieldLabel` to `shared/components/FieldLabel.tsx`. Migrate usage in Console and Settings.
2. Build `shared/components/StatusBadge.tsx`. Migrate all five Settings implementations, Console priority/state/quality badges, Designer badge indicators.
3. Build `shared/components/Dialog.tsx` (thin wrapper: ARIA, backdrop token, z-index, standard container styles). Migrate Console inline modals and Designer non-Radix dialogs to use it.
4. Fix Designer TEST MODE `<style>` tag injection → CSS keyframe class.
5. Extend `SettingsPageLayout` accessibility or create a simpler page-title shared component for Console and Designer views.

### Phase 5 — Polish and alignment (deferred; no functional impact)

Depends on: Phases 1–4 being stable.

1. Typography: standardize on documented size/weight/spacing values across section labels, field labels, tab labels, page titles.
2. Toolbar heights: define `--io-toolbar-height` token; update Designer skeleton placeholder.
3. Hover/focus: replace remaining DOM-mutation hover with CSS `:hover` pseudo-classes or React state.
4. DesignerCanvas grid line colors, canvas border, guide line colors: token-ify or formally document as intentional.
5. Semantic headings: add `<h2>`/`<h3>` where currently bare `<div>`.
6. Section label `letterSpacing` standardization to 0.06em.

---

## Section 4 — Risks and Unknowns

### R1 — `--io-z-modal: 300` is unusable as-is

Every dialog in all three modules uses z-index values between 1000 and 9999. Raising the token will fix any code that correctly references it, but code currently using hardcoded integers (the majority) will be unaffected until individually migrated. There is a risk that the migration is incomplete and layers will stack incorrectly in edge cases (e.g., a console modal rendered inside a designer tab). A z-inde

---

Produce the review now.
```


## #TURN_END

_2026-05-27T05:52:28+00:00_

---


## #PROMPT

_2026-05-27T05:52:33+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
bash /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep" 2>&1
```


## #TURN_END

_2026-05-27T05:52:33+00:00_

---


## #PROMPT

_2026-05-27T05:55:22+00:00_

```
You are performing a SHALLOW verification review of a Claude Code work unit.

Your job is to compare what was asked (the initial prompt) against what was
actually built (the diff).

Be skeptical and direct. Look for:
- The diff does something different from what was asked
- The diff regresses previously working behavior
- The diff expands scope beyond the prompt
- The diff appears to invert architectural decisions

Output format (markdown):

## Summary
One paragraph: does the diff appear to match intent, or are there concerns?

## Concerns
If concerns exist, list them as numbered items. If none: "No concerns identified."

DO NOT include preamble. Start directly with "## Summary".
DO NOT speculate beyond what's in the log and diff.

WORK UNIT LOG:
---
# Work Unit Log: regression-statusbadge-hex-alpha

read-o

Started: 2026-05-27T05:47:57+00:00
Session: 361ad460-9bf3-4897-b065-aefe183d5610

---


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` (88→158 chars)

_2026-05-27T05:49:17+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/04-recommendations.md` (280→957 chars)

_2026-05-27T05:49:30+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/02-comparison.md` (1068→1632 chars)

_2026-05-27T05:49:47+00:00_


## #PROMPT

_2026-05-27T05:50:22+00:00_

```
~initprompt~ regression-statusbadge-hex-alpha

Read-only investigation first, then fix. Read ui-audit/04-recommendations.md and ui-audit/02-comparison.md to confirm the bug details. Read ui-audit/05-claim-c-deferral.md to confirm this regression is not affected by the Claim C deferral (StatusBadge in OpcSources is in the Settings module, not the canvas layer).

Goal: fix the OpcSources StatusBadge hex-alpha concatenation bug that renders all badge backgrounds as transparent.

Part one, investigation. Open the OpcSources.tsx file in the Settings module and locate the StatusBadge usage. Identify the hex-alpha concatenation pattern that produces transparent backgrounds. The audit suggests the bug is concatenating a hex color value with an alpha suffix in a way that produces an invalid CSS color (likely something like \${color}40 where the resulting string is not a valid color expression). Record the exact current code, the file, and the line numbers.

Confirm whether this bug exists only in OpcSources.tsx or whether the same pattern is used elsewhere in Settings. If StatusBadge itself has the bug internally (rather than the bug being in how OpcSources passes props to it), the fix scope is larger; record this finding.

Part two, fix. Replace the broken hex-alpha concatenation with a correct CSS color expression. Options include using rgba() with explicit values, using a CSS variable that already has the right alpha applied, or using color-mix() if the codebase already uses it elsewhere. Pick the approach that matches the codebase's existing patterns; do not introduce a new pattern just for this fix. If StatusBadge itself has the bug, fix it at the component level so all consumers benefit, not just OpcSources.

Do not change any other behavior. Do not refactor StatusBadge beyond what is needed to fix the bug. Do not modify any unrelated Settings pages.

Part three, update the audit artifacts. Update ui-audit/02-comparison.md to reflect the fix: locate the StatusBadge or OpcSources entry (likely category 8 status indicators) and update the deviations and notes fields with the fix date and corrected approach. Update ui-audit/04-recommendations.md similarly: mark the priority-one regression as resolved.

Do not modify any other audit files. Do not touch any Claim A, Claim B, or other Claim C work.

When done, print: the files modified, the specific code change (before and after), whether the fix was scoped to OpcSources or to StatusBadge itself with rationale, and the audit-file updates applied. Stop.
```


## #ASSISTANT

Starting with the audit docs and source files to understand the bug before touching anything.


## #ASSISTANT

Good. Now let me find OpcSources.tsx and read the relevant sections.


## #BASH
_Find OpcSources.tsx location_

```bash
find /home/io/io-dev/io/frontend -name "OpcSources.tsx" 2>/dev/null
```


## #ASSISTANT

Now let me find the StatusBadge and hex-alpha pattern in OpcSources.tsx.


## #BASH
_Find StatusBadge and hex-alpha concat patterns in OpcSources.tsx_

```bash
grep -n "StatusBadge\|statusBadge\|status_badge\|color}20\|color}40\|color}80\|hex.*alpha\|alpha.*hex\|\${color}" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx | head -60
```


## #BASH
_Find STATUS_COLORS definition_

```bash
grep -n "STATUS_COLORS" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx | head -20
```


## #ASSISTANT

Let me check how SystemHealth.tsx and Import.tsx do their StatusBadge correctly, to match the codebase pattern.


## #BASH
_Find SystemHealth StatusBadge pattern_

```bash
grep -n "color-mix\|success-subtle\|StatusBadge\|statusBadge\|status.*badge" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx | head -20
```


## #BASH
_Find Import.tsx status badge pattern_

```bash
grep -n "success-subtle\|color-mix\|StatusBadge\|status.*badge\|io-success" /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx | head -20
```


## #ASSISTANT

The codebase already uses `color-mix(in srgb, ...)` in SystemHealth.tsx — this is the correct existing pattern to match. Let me verify there are no other files with the same `${color}20` bug.


## #BASH
_Search for hex-alpha concat pattern across frontend_

```bash
grep -rn '${color}20\|${color}40\|${color}80\|`${.*}[0-9a-f][0-9a-f]`' /home/io/io-dev/io/frontend/src/ 2>/dev/null
```


## #BASH
_Search for hex-alpha concat pattern with different quoting_

```bash
grep -rn 'color}20\|color}40\|color}80\|color}10' /home/io/io-dev/io/frontend/src/ 2>/dev/null
```


## #ASSISTANT

Good — the same bug pattern exists in 4 more files. The task asks me to fix OpcSources only and record the finding. Let me verify the color values in Users.tsx and Roles.tsx are also CSS vars:


## #BASH
_Verify Users.tsx color values_

```bash
grep -n "color.*var\|color.*#\|COLORS\[" /home/io/io-dev/io/frontend/src/pages/settings/Users.tsx | head -15
```


## #BASH
_Verify Roles.tsx color values_

```bash
grep -n "color.*var\|color.*#\|COLORS\[" /home/io/io-dev/io/frontend/src/pages/settings/Roles.tsx | head -15
```


## #ASSISTANT

Let me check the SystemHealth StatusBadge implementation in full for the exact border pattern:


## #ASSISTANT

The bug is confirmed in OpcSources.tsx only. The `StatusBadge` is a local function (not shared), and the bug is in lines 168 and 170. The fix uses the `color-mix()` pattern already established by `SystemHealth.tsx`.

Applying the fix:


## #ASSISTANT

Now update the two audit files. Starting with `04-recommendations.md`:


## #ASSISTANT

Now update `02-comparison.md` — the Category 8 entry for Settings OpcSources:


## #ASSISTANT

Now verify the fix compiles cleanly:


## #BASH
_TypeScript check for OpcSources.tsx_

```bash
cd /home/io/io-dev/io/frontend && pnpm tsc --noEmit 2>&1 | grep -i "OpcSources\|error" | head -20
```


## #TURN_END

_2026-05-27T05:50:23+00:00_

---


## #PROMPT

_2026-05-27T05:52:28+00:00_

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
# Work Unit Log: regression-statusbadge-hex-alpha

read-o

Started: 2026-05-27T05:47:57+00:00
Session: 361ad460-9bf3-4897-b065-aefe183d5610

---


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` (88→158 chars)

_2026-05-27T05:49:17+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/04-recommendations.md` (280→957 chars)

_2026-05-27T05:49:30+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/02-comparison.md` (1068→1632 chars)

_2026-05-27T05:49:47+00:00_


## #PROMPT

_2026-05-27T05:50:22+00:00_

```
~initprompt~ regression-statusbadge-hex-alpha

Read-only investigation first, then fix. Read ui-audit/04-recommendations.md and ui-audit/02-comparison.md to confirm the bug details. Read ui-audit/05-claim-c-deferral.md to confirm this regression is not affected by the Claim C deferral (StatusBadge in OpcSources is in the Settings module, not the canvas layer).

Goal: fix the OpcSources StatusBadge hex-alpha concatenation bug that renders all badge backgrounds as transparent.

Part one, investigation. Open the OpcSources.tsx file in the Settings module and locate the StatusBadge usage. Identify the hex-alpha concatenation pattern that produces transparent backgrounds. The audit suggests the bug is concatenating a hex color value with an alpha suffix in a way that produces an invalid CSS color (likely something like \${color}40 where the resulting string is not a valid color expression). Record the exact current code, the file, and the line numbers.

Confirm whether this bug exists only in OpcSources.tsx or whether the same pattern is used elsewhere in Settings. If StatusBadge itself has the bug internally (rather than the bug being in how OpcSources passes props to it), the fix scope is larger; record this finding.

Part two, fix. Replace the broken hex-alpha concatenation with a correct CSS color expression. Options include using rgba() with explicit values, using a CSS variable that already has the right alpha applied, or using color-mix() if the codebase already uses it elsewhere. Pick the approach that matches the codebase's existing patterns; do not introduce a new pattern just for this fix. If StatusBadge itself has the bug, fix it at the component level so all consumers benefit, not just OpcSources.

Do not change any other behavior. Do not refactor StatusBadge beyond what is needed to fix the bug. Do not modify any unrelated Settings pages.

Part three, update the audit artifacts. Update ui-audit/02-comparison.md to reflect the fix: locate the StatusBadge or OpcSources entry (likely category 8 status indicators) and update the deviations and notes fields with the fix date and corrected approach. Update ui-audit/04-recommendations.md similarly: mark the priority-one regression as resolved.

Do not modify any other audit files. Do not touch any Claim A, Claim B, or other Claim C work.

When done, print: the files modified, the specific code change (before and after), whether the fix was scoped to OpcSources or to StatusBadge itself with rationale, and the audit-file updates applied. Stop.
```


## #ASSISTANT

Starting with the audit docs and source files to understand the bug before touching anything.


## #ASSISTANT

Good. Now let me find OpcSources.tsx and read the relevant sections.


## #BASH
_Find OpcSources.tsx location_

```bash
find /home/io/io-dev/io/frontend -name "OpcSources.tsx" 2>/dev/null
```


## #ASSISTANT

Now let me find the StatusBadge and hex-alpha pattern in OpcSources.tsx.


## #BASH
_Find StatusBadge and hex-alpha concat patterns in OpcSources.tsx_

```bash
grep -n "StatusBadge\|statusBadge\|status_badge\|color}20\|color}40\|color}80\|hex.*alpha\|alpha.*hex\|\${color}" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx | head -60
```


## #BASH
_Find STATUS_COLORS definition_

```bash
grep -n "STATUS_COLORS" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx | head -20
```


## #ASSISTANT

Let me check how SystemHealth.tsx and Import.tsx do their StatusBadge correctly, to match the codebase pattern.


## #BASH
_Find SystemHealth StatusBadge pattern_

```bash
grep -n "color-mix\|success-subtle\|StatusBadge\|statusBadge\|status.*badge" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx | head -20
```


## #BASH
_Find Import.tsx status badge pattern_

```bash
grep -n "success-subtle\|color-mix\|StatusBadge\|status.*badge\|io-success" /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx | head -20
```


## #ASSISTANT

The codebase already uses `color-mix(in srgb, ...)` in SystemHealth.tsx — this is the correct existing pattern to match. Let me verify there are no other files with the same `${color}20` bug.


## #BASH
_Search for hex-alpha concat pattern across frontend_

```bash
grep -rn '${color}20\|${color}40\|${color}80\|`${.*}[0-9a-f][0-9a-f]`' /home/io/io-dev/io/frontend/src/ 2>/dev/null
```


## #BASH
_Search for hex-alpha concat pattern with different quoting_

```bash
grep -rn 'color}20\|color}40\|color}80\|color}10' /home/io/io-dev/io/frontend/src/ 2>/dev/null
```


## #ASSISTANT

Good — the same bug pattern exists in 4 more files. The task asks me to fix OpcSources only and record the finding. Let me verify the color values in Users.tsx and Roles.tsx are also CSS vars:


## #BASH
_Verify Users.tsx color values_

```bash
grep -n "color.*var\|color.*#\|COLORS\[" /home/io/io-dev/io/frontend/src/pages/settings/Users.tsx | head -15
```


## #BASH
_Verify Roles.tsx color values_

```bash
grep -n "color.*var\|color.*#\|COLORS\[" /home/io/io-dev/io/frontend/src/pages/settings/Roles.tsx | head -15
```


## #ASSISTANT

Let me check the SystemHealth StatusBadge implementation in full for the exact border pattern:


## #ASSISTANT

The bug is confirmed in OpcSources.tsx only. The `StatusBadge` is a local function (not shared), and the bug is in lines 168 and 170. The fix uses the `color-mix()` pattern already established by `SystemHealth.tsx`.

Applying the fix:


## #ASSISTANT

Now update the two audit files. Starting with `04-recommendations.md`:


## #ASSISTANT

Now update `02-comparison.md` — the Category 8 entry for Settings OpcSources:


## #ASSISTANT

Now verify the fix compiles cleanly:


## #BASH
_TypeScript check for OpcSources.tsx_

```bash
cd /home/io/io-dev/io/frontend && pnpm tsc --noEmit 2>&1 | grep -i "OpcSources\|error" | head -20
```


## #TURN_END

_2026-05-27T05:50:23+00:00_

---
---



DIFF OF CHANGES:
---
diff --git a/frontend/src/pages/settings/OpcSources.tsx b/frontend/src/pages/settings/OpcSources.tsx
index 0807d2ff..89713e31 100644
--- a/frontend/src/pages/settings/OpcSources.tsx
+++ b/frontend/src/pages/settings/OpcSources.tsx
@@ -165,9 +165,9 @@ function StatusBadge({ status }: { status: string }) {
         borderRadius: "9999px",
         fontSize: "11px",
         fontWeight: 600,
-        background: `${color}20`,
+        background: `color-mix(in srgb, ${color} 12%, transparent)`,
         color,
-        border: `1px solid ${color}40`,
+        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
         textTransform: "capitalize",
       }}
     >
diff --git a/ui-audit/02-comparison.md b/ui-audit/02-comparison.md
index afb93f2d..4af88c4e 100644
--- a/ui-audit/02-comparison.md
+++ b/ui-audit/02-comparison.md
@@ -106,7 +106,7 @@
 | **Implementation** | Inline-styles; all hand-drawn `<span>` elements with circle or badge styles; no shared component | Inline-styles; module-local; scattered across `DesignerToolbar` (dirty dot, READ-ONLY badge), `DesignerTabBar` (modified dot), `DesignerStatusBar` (WS dot, binding summary, TEST MODE) | Inline-styles; no shared component; five distinct `StatusBadge` implementations across `OpcSources`, `SystemHealth`, `Import`, `Email`, `PointManagement`; connection dots in `OpcSources` and `SystemHealth` | All three: no shared status indicator component; all three use small circle dots (6–8px) for binary connection/state indicators; all three use `var(--io-success)` / `var(--io-danger)` tokens for the connected/error states | — |
 | **Source-of-truth files** | `index.tsx:59–134` (ConsoleStatusBar); `index.tsx:2026–2052` (tab dots, banners); `AlarmListPane:34–91`; `PointTablePane:26–59` | `DesignerStatusBar:204–371`; `DesignerToolbar:1584–1615`; `DesignerTabBar:181–193` | `OpcSources:156–186`; `SystemHealth:41–70`; `Import:72–106`; `Email:187–212`; `PointManagement:126–232`; `OpcSources` + `SystemHealth` connection dots | — | — |
 | **Visual properties actually applied** | Connection dot: 6×6px circle, `var(--io-success)`/`var(--io-warning)`/`var(--io-danger)`; dirty/playback dot: 6×6 `var(--io-warning)`; published dot: `#10b981` hardcoded; `PriorityBadge`: pill with hardcoded `rgba()` backgrounds per level; `StateBadge`: text-color-coded; `QualityBadge`: 6×6 circle + text, hardcoded colors | WS dot: `●` glyph 8px, `#22c55e`/`#ef4444` hardcoded; dirty indicator: 7×7px div, `#f97316` hardcoded; READ-ONLY badge: `#eab308`/`rgba(234,179,8,*)` hardcoded; modified tab dot: `var(--io-warning, #f59e0b)` — only token-using indicator; TEST MODE: `#4ade80` with CSS keyframe animation injected as inline `<style>` tag | `OpcSources StatusBadge`: hex-alpha concat bug (broken background); `SystemHealth`: `color-mix(in srgb, colorVar 12%, transparent)` (correct); `Import`: `--io-success-subtle`/`--io-success` token pairs (correct); `Email`: dot-only 7px, token-based; `PointManagement CriticalityBadge`: token pairs (correct); connection dots: `var(--io-success)`/`var(--io-danger)` fill + hardcoded `#22c55e` glow shadow | All three use `var(--io-success)`/`var(--io-danger)` as primary fill tokens for connection state dots | — |
-| **Deviations from app shell** | Alarm priority badge colors hardcoded (not `--io-alarm-*` tokens); published dot `#10b981` ≠ `var(--io-success)` (`#22c55e` dark); quality badge colors have no token equivalent; save-failure banner uses `#fff` not `var(--io-status-fg)` | WS dot bypasses tokens (`#22c55e`, `#ef4444`); dirty indicator `#f97316` not a token reference; READ-ONLY badge uses `#eab308` (distinct yellow) not `var(--io-warning)`; TEST MODE fully hardcoded including `<style>` tag injected on every render cycle; only `DesignerTabBar` modified dot uses a token (`var(--io-warning, #f59e0b)`) | `OpcSources StatusBadge` broken by hex-alpha CSS var concat; `--io-info: #3b82f6` IS defined in index.css:72; `AuthProviders TypeBadge` uses it correctly with matching fallback — no visual regression; connection dot glow shadow hardcodes `#22c55e` (not `var(--io-success)`); `--io-text-on-accent` undefined (applies to badge buttons in several pages) | All three: hardcoded `#22c55e` for connection dot glow shadows; none have a shared StatusBadge component | — |
+| **Deviations from app shell** | Alarm priority badge colors hardcoded (not `--io-alarm-*` tokens); published dot `#10b981` ≠ `var(--io-success)` (`#22c55e` dark); quality badge colors have no token equivalent; save-failure banner uses `#fff` not `var(--io-status-fg)` | WS dot bypasses tokens (`#22c55e`, `#ef4444`); dirty indicator `#f97316` not a token reference; READ-ONLY badge uses `#eab308` (distinct yellow) not `var(--io-warning)`; TEST MODE fully hardcoded including `<style>` tag injected on every render cycle; only `DesignerTabBar` modified dot uses a token (`var(--io-warning, #f59e0b)`) | **Fixed 2026-05-27:** `OpcSources StatusBadge` hex-alpha concat bug resolved — `background: \`${color}20\`` → `color-mix(in srgb, ${color} 12%, transparent)`; `border: \`1px solid ${color}40\`` → `1px solid color-mix(in srgb, ${color} 25%, transparent)`. Fix uses the `color-mix` pattern already established in `SystemHealth.tsx`; scoped to the local `StatusBadge` function (OpcSources.tsx:168–170). Remaining: `--io-info: #3b82f6` IS defined in index.css:72; `AuthProviders TypeBadge` uses it correctly with matching fallback — no visual regression; connection dot glow shadow hardcodes `#22c55e` (not `var(--io-success)`); `--io-text-on-accent` undefined (applies to badge buttons in several pages). **Open finding:** same `${color}20`/`${color}40` hex-alpha bug exists in `Users.tsx` (Badge:108/110), `Roles.tsx` (Badge:51/53), `CameraStreams.tsx` (785/787), `MaintenanceTicketsPanel.tsx` (52) — not fixed here. | All three: hardcoded `#22c55e` for connection dot glow shadows; none have a shared StatusBadge component | — |
 | **Notes** | `var(--io-alarm-high)` is used correctly on the save-failure banner — the only alarm token use in Console's status layer | TEST MODE injects a new `<style>` element on every render cycle when test mode is active — a performance concern | `Import.tsx` token-pair pattern (`--io-success-subtle`/`--io-success`) is the cleanest `StatusBadge` implementation across all three modules | — | — |
 
 ### Shared Infrastructure — Category 8
diff --git a/ui-audit/04-recommendations.md b/ui-audit/04-recommendations.md
index f1e6f423..2aabbd25 100644
--- a/ui-audit/04-recommendations.md
+++ b/ui-audit/04-recommendations.md
@@ -308,7 +308,7 @@ No component changes. Pure token additions to `index.css`.
 These are bugs visible at runtime, not polish issues.
 
 1. ~~`selection.css` + `MarqueeLayer.tsx`: `var(--accent)` → `var(--io-accent)`, `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)`. (2-file change.)~~ **Fixed 2026-05-27.**
-2. `OpcSources StatusBadge` hex-alpha concat bug: `${color}20` → `color-mix(...)` or component migration.
+2. ~~`OpcSources StatusBadge` hex-alpha concat bug: `${color}20` → `color-mix(...)` or component migration.~~ **Fixed 2026-05-27.** `background: \`${color}20\`` → `color-mix(in srgb, ${color} 12%, transparent)`; `border: \`1px solid ${color}40\`` → `color-mix(in srgb, ${color} 25%, transparent)`. Fix scoped to the local `StatusBadge` function in `OpcSources.tsx` (lines 168–170); matches the `color-mix` pattern already used by `SystemHealth.tsx`. **Note:** The same `${color}20`/`${color}40` hex-alpha pattern also appears in `Users.tsx` (Badge, line 108/110), `Roles.tsx` (Badge, line 51/53), `CameraStreams.tsx` (line 785/787), and `MaintenanceTicketsPanel.tsx` (line 52) — these were not fixed here and remain broken when CSS variable strings are passed as the color argument.
 3. `alarmFlash.css`: migrate hex to `--io-alarm-*` tokens. (This affects theme support, not current dark-theme functionality, but the hardcoded values are wrong in principle and block HPHMI work.)
 4. Critical ARIA fixes: `RestorePreviewModal` + Console inline modals + Import/OpcSources dialogs. (Accessibility regression on destructive paths.)
 5. Replace 8 `window.confirm()` calls with `ConfirmDialog`.
---

FULL FILE CONTENTS (for surrounding-code analysis):
---

--- File: /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx ---
import React, { useState } from "react";
import ContextMenu from "../../shared/components/ContextMenu";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  pointSourcesApi,
  pointSourceStatsApi,
  historyRecoveryApi,
  PointSource,
  PointSourceStats,
  RecoveryJob,
  CreatePointSourceRequest,
  UpdatePointSourceRequest,
} from "../../api/points";
import { opcCertsApi, OpcServerCert } from "../../api/opcCerts";
import { settingsApi } from "../../api/settings";
import SupplementalConnectorsTab from "./SupplementalConnectorsTab";
import { ExportButton } from "../../shared/components/ExportDialog";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  cellStyle,
} from "./settingsStyles";

// ---------------------------------------------------------------------------
// Column definitions for OPC sources export
// ---------------------------------------------------------------------------
const OPC_SOURCES_COLUMNS = [
  { id: "name", label: "Name" },
  { id: "endpoint_url", label: "Endpoint URL" },
  { id: "status", label: "Status" },
  { id: "enabled", label: "Enabled" },
  { id: "security_policy", label: "Security Policy" },
  { id: "security_mode", label: "Security Mode" },
  { id: "last_connected_at", label: "Last Connected" },
];

const OPC_SOURCES_DEFAULT_VISIBLE = [
  "name",
  "endpoint_url",
  "status",
  "enabled",
  "last_connected_at",
];

// ---------------------------------------------------------------------------
// TableSkeleton — shimmer rows for OPC sources table
// ---------------------------------------------------------------------------
function TableSkeleton({
  rows = 4,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr
          style={{
            borderBottom: "1px solid var(--io-border)",
            background: "var(--io-surface-primary)",
          }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} style={{ padding: "10px 14px", textAlign: "left" }}>
              <div
                style={{
                  height: "10px",
                  borderRadius: "4px",
                  background: "var(--io-border)",
                  width: i === columns - 1 ? "40px" : "120px",
                  animation: "io-shimmer 1.5s ease-in-out infinite",
                }}
              />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, ri) => (
          <tr
            key={ri}
            style={{
              borderBottom:
                ri < rows - 1 ? "1px solid var(--io-border-subtle)" : undefined,
            }}
          >
            {Array.from({ length: columns }).map((_, ci) => (
              <td key={ci} style={{ padding: "12px 14px" }}>
                <div
                  style={{
                    height: "12px",
                    borderRadius: "4px",
                    background: "var(--io-surface-primary)",
                    width:
                      ci === columns - 1
                        ? "40px"
                        : ci === 0
                          ? "120px"
                          : "160px",
                    animation: "io-shimmer 1.5s ease-in-out infinite",
                    animationDelay: `${ri * 0.05}s`,
                  }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Client certificate API (GET /api/certificates?type=client)
// ---------------------------------------------------------------------------

export interface ClientCertificate {
  id: string;
  name: string;
  subject: string | null;
  not_after: string | null;
  expired: boolean;
}

const clientCertsApi = {
  list: () =>
    fetch("/api/certificates?type=client", {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    }).then(async (r) => {
      const json = await r.json();
      return json as {
        success: boolean;
        data: ClientCertificate[];
        error?: { message: string };
      };
    }),
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  active: "var(--io-success)",
  inactive: "var(--io-text-muted)",
  connecting: "var(--io-warning)",
  error: "var(--io-danger)",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "var(--io-text-muted)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 600,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        textTransform: "capitalize",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Source stats — inline chips for the table row
// ---------------------------------------------------------------------------

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function SourceStatsChips({ stats }: { stats: PointSourceStats | undefined }) {
  if (!stats) return null;
  const chips: Array<{ label: string; value: string; color?: string }> = [
    { label: "pts", value: fmtCount(stats.point_count) },
    { label: "active", value: fmtCount(stats.active_subscriptions) },
  ];
  if (stats.updates_per_minute !== null) {
    chips.push({ label: "/min", value: fmtCount(stats.updates_per_minute) });
  }
  if (stats.error_count_24h > 0) {
    chips.push({
      label: "errors",
      value: String(stats.error_count_24h),
      color: "var(--io-danger)",
    });
  }
  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        marginTop: "5px",
        flexWrap: "wrap",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {chips.map((c) => (
        <span
          key={c.label}
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: "3px",
            fontSize: "11px",
            color: c.color ?? "var(--io-text-muted)",
          }}
        >
          <strong
            style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
          >
            {c.value}
          </strong>
          <span style={{ opacity: 0.7 }}>{c.label}</span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source stats — tile grid for the detail panel
// ---------------------------------------------------------------------------

function SourceStatsTiles({ sourceId }: { sourceId: string }) {
  const statsQuery = useQuery({
    queryKey: ["point-source-stats", sourceId],
    queryFn: async () => {
      const r = await pointSourceStatsApi.get(sourceId);
      if (!r.success) throw new Error(r.error.message);
      return r.data as PointSourceStats;
    },
    refetchInterval: 15_000,
  });

  const s = statsQuery.data;
  const tiles: Array<{
    label: string;
    value: string;
    sub?: string;
    accent?: boolean;
    danger?: boolean;
  }> = [
    {
      label: "Total Points",
      value: s ? fmtCount(s.point_count) : "—",
      sub: "configured",
    },
    {
      label: "Active Subs",
      value: s ? fmtCount(s.active_subscriptions) : "—",
      sub: "subscriptions",
      accent: s ? s.active_subscriptions > 0 : false,
    },
    {
      label: "Updates / min",
      value:
        s?.updates_per_minute !== null && s?.updates_per_minute !== undefined
          ? fmtCount(s.updates_per_minute)
          : "—",
      sub: "recording",
    },
    {
      label: "Errors (24 h)",
      value: s ? String(s.error_count_24h) : "—",
      danger: s ? s.error_count_24h > 0 : false,
    },
  ];

  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "10px",
        }}
      >
        Live Statistics
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        {tiles.map((t) => (
          <div
            key={t.label}
            style={{
              background: "var(--io-surface-secondary)",
              border: "1px solid var(--io-border-subtle)",
              borderRadius: "var(--io-radius)",
              padding: "12px 10px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: t.danger
                  ? "var(--io-danger)"
                  : t.accent
                    ? "var(--io-success)"
                    : "var(--io-text-primary)",
                lineHeight: 1.1,
              }}
            >
              {statsQuery.isLoading ? (
                <span style={{ opacity: 0.3 }}>—</span>
              ) : (
                t.value
              )}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--io-text-muted)",
                lineHeight: 1.3,
              }}
            >
              {t.label}
              {t.sub && (
                <span style={{ display: "block", opacity: 0.7 }}>{t.sub}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {s?.last_value_at && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--io-text-muted)",
            marginBottom: "16px",
          }}
        >
          Last value received: {new Date(s.last_value_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal wrapper
// ---------------------------------------------------------------------------

function ModalContent({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
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
        aria-describedby={undefined}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "10px",
          padding: "24px",
          width: "520px",
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto",
          zIndex: 101,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <Dialog.Title
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            {title}
          </Dialog.Title>
          <Dialog.Close asChild>
            <button
              style={{
                background: "none",
                border: "none",
                color: "var(--io-text-muted)",
                cursor: "pointer",
                fontSize: "18px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

// ---------------------------------------------------------------------------
// Source form fields (shared between create and edit)
// ---------------------------------------------------------------------------

interface SourceFormState {
  name: string;
  endpoint_url: string;
  security_policy: string;
  security_mode: string;
  username: string;
  password: string;
  enabled: boolean;
  client_certificate_id: string | null;
  platform: string | null;
  publish_interval_ms: number | null;
  data_category_id: string | null;
}

// ---------------------------------------------------------------------------
// Data categories
// ---------------------------------------------------------------------------

const PREDEFINED_CATEGORIES = [
  { id: "process", label: "Process" },
  { id: "event", label: "Event" },
  { id: "access_control", label: "Access Control" },
  { id: "personnel", label: "Personnel" },
  { id: "financial", label: "Financial" },
  { id: "maintenance", label: "Maintenance" },
  { id: "ticketing", label: "Ticketing" },
  { id: "environmental", label: "Environmental" },
  { id: "general", label: "General" },
];

interface DataCategory {
  id: string;
  label: string;
  predefined: boolean;
}

// Simple in-memory custom categories store (backed by API in production)
function useDataCategories() {
  const query = useQuery<DataCategory[]>({
    queryKey: ["data-categories"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/data-categories");
        if (!res.ok) throw new Error("API unavailable");
        const json = await res.json();
        return json.data ?? json;
      } catch {
        // Fall back to predefined only
        return PREDEFINED_CATEGORIES.map((c) => ({ ...c, predefined: true }));
      }
    },
    staleTime: 60_000,
    initialData: PREDEFINED_CATEGORIES.map((c) => ({ ...c, predefined: true })),
  });
  return query;
}

// ---------------------------------------------------------------------------
// Manage Categories modal
// ---------------------------------------------------------------------------

function ManageCategoriesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const catQuery = useDataCategories();
  const categories = catQuery.data ?? [];

  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/data-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      qc.invalidateQueries({ queryKey: ["data-categories"] });
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create category");
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/data-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      qc.invalidateQueries({ queryKey: ["data-categories"] });
      setEditId(null);
      setEditName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename category");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this custom category?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/data-categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      qc.invalidateQueries({ queryKey: ["data-categories"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete category");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const modalOverlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--io-overlay, rgba(0,0,0,0.5))",
  };

  const modalBox: React.CSSProperties = {
    position: "relative",
    width: "500px",
    maxWidth: "95vw",
    maxHeight: "80vh",
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: "10px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  };

  const catInputStyle: React.CSSProperties = {
    flex: 1,
    padding: "6px 10px",
    background: "var(--io-surface-secondary)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    color: "var(--io-text)",
    fontSize: "13px",
  };

  const smBtn = (
    variant: "primary" | "ghost" | "danger",
  ): React.CSSProperties => ({
    padding: "5px 10px",
    fontSize: "12px",
    border:
      variant === "danger"
        ? "1px solid var(--io-danger)"
        : variant === "ghost"
          ? "1px solid var(--io-border)"
          : "none",
    borderRadius: "var(--io-radius)",
    background: variant === "primary" ? "var(--io-accent)" : "transparent",
    color:
      variant === "primary"
        ? "var(--io-text-on-accent)"
        : variant === "danger"
          ? "var(--io-danger)"
          : "var(--io-text-secondary)",
    cursor: saving ? "not-allowed" : "pointer",
    opacity: saving ? 0.6 : 1,
  });

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--io-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "15px" }}>
            Manage Data Categories
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              fontSize: "18px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              marginBottom: "16px",
              lineHeight: 1.5,
            }}
          >
            Predefined categories cannot be deleted. Custom categories can be
            renamed or deleted.
          </div>

          {error && (
            <div
              style={{
                padding: "8px 12px",
                background: "var(--io-danger-subtle)",
                color: "var(--io-danger)",
                borderRadius: "var(--io-radius)",
                fontSize: "12px",
                marginBottom: "12px",
              }}
            >
              {error}
            </div>
          )}

          {/* Category list */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              marginBottom: "20px",
            }}
          >
            {categories.map((cat) => (
              <div
                key={cat.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  background: "var(--io-surface-secondary)",
                  border: "1px solid var(--io-border-subtle)",
                  borderRadius: "var(--io-radius)",
                }}
              >
                {editId === cat.id ? (
                  <>
                    <input
                      style={catInputStyle}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(cat.id);
                      }}
                      autoFocus
                    />
                    <button
                      style={smBtn("primary")}
                      onClick={() => handleRename(cat.id)}
                      disabled={saving}
                    >
                      Save
                    </button>
                    <button
                      style={smBtn("ghost")}
                      onClick={() => {
                        setEditId(null);
                        setEditName("");
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        flex: 1,
                        fontSize: "13px",
                        color: "var(--io-text-primary)",
                      }}
                    >
                      {cat.label}
                    </span>
                    {cat.predefined ? (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--io-text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        predefined
                      </span>
                    ) : (
                      <>
                        <button
                          style={smBtn("ghost")}
                          onClick={() => {
                            setEditId(cat.id);
                            setEditName(cat.label);
                          }}
                          disabled={saving}
                        >
                          Rename
                        </button>
                        <button
                          style={smBtn("danger")}
                          onClick={() => handleDelete(cat.id)}
                          disabled={saving}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new */}
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "8px",
            }}
          >
            Add Custom Category
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              style={catInputStyle}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <button
              style={smBtn("primary")}
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
            >
              Add
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--io-border)",
            display: "flex",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <button onClick={onClose} style={smBtn("ghost")}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const SECURITY_POLICIES = [
  "None",
  "Basic256Sha256",
  "Aes128Sha256RsaOaep",
  "Aes256Sha256RsaPss",
];
const SECURITY_MODES = ["None", "Sign", "SignAndEncrypt"];

// DCS platform options from doc 17 §Connection Profiles
const DCS_PLATFORMS = [
  { value: "", label: "Unknown / Generic" },
  { value: "siemens_s7_1500", label: "Siemens S7-1500 (TIA Portal)" },
  { value: "siemens_s7_1200", label: "Siemens S7-1200 (TIA Portal)" },
  { value: "siemens_wincc_oa", label: "Siemens WinCC OA" },
  { value: "siemens_wincc_v7", label: "Siemens WinCC V7 / RT Pro" },
  { value: "honeywell_experion", label: "Honeywell Experion PKS" },
  { value: "abb_800xa", label: "ABB 800xA" },
  { value: "emerson_deltav_pk", label: "Emerson DeltaV PK Controller" },
  { value: "emerson_deltav_app", label: "Emerson DeltaV Application Station" },
  { value: "yokogawa_exaopc", label: "Yokogawa Exaopc" },
];

function SourceFormFields({
  form,
  onChange,
  showEnabled,
  clientCerts,
}: {
  form: SourceFormState;
  onChange: (patch: Partial<SourceFormState>) => void;
  showEnabled?: boolean;
  clientCerts?: ClientCertificate[];
}) {
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const catQuery = useDataCategories();
  const categories = catQuery.data ?? [];
  const field = (
    label: string,
    key: keyof SourceFormState,
    type = "text",
    placeholder?: string,
    required?: boolean,
  ) => (
    <div>
      <label style={labelStyle}>
        {label}
        {required && " *"}
      </label>
      <input
        type={type}
        style={inputStyle}
        value={form[key] as string}
        onChange={(e) => onChange({ [key]: e.target.value })}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {field("Name", "name", "text", "OPC-Unit3-Primary", true)}
      {field(
        "Endpoint URL",
        "endpoint_url",
        "text",
        "opc.tcp://hostname:4840",
        true,
      )}

      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Security Policy</label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            value={form.security_policy}
            onChange={(e) => onChange({ security_policy: e.target.value })}
          >
            {SECURITY_POLICIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Security Mode</label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            value={form.security_mode}
            onChange={(e) => onChange({ security_mode: e.target.value })}
          >
            {SECURITY_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Client Certificate dropdown */}
      <div>
        <label style={labelStyle}>Client Certificate</label>
        <select
          style={{ ...inputStyle, cursor: "pointer" }}
          value={form.client_certificate_id ?? ""}
          onChange={(e) =>
            onChange({ client_certificate_id: e.target.value || null })
          }
        >
          <option value="">(none)</option>
          {(clientCerts ?? []).map((cert) => (
            <option key={cert.id} value={cert.id}>
              {cert.name}
              {cert.expired ? " [EXPIRED]" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Platform dropdown */}
      <div>
        <label style={labelStyle}>Platform</label>
        <select
          style={{ ...inputStyle, cursor: "pointer" }}
          value={form.platform ?? ""}
          onChange={(e) => onChange({ platform: e.target.value || null })}
        >
          {DCS_PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Data Category dropdown */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "4px",
          }}
        >
          <label style={labelStyle}>Data Category</label>
          <button
            type="button"
            onClick={() => setManageCatsOpen(true)}
            style={{
              background: "none",
              border: "none",
              color: "var(--io-accent)",
              fontSize: "11px",
              cursor: "p

--- File: /home/io/io-dev/io/ui-audit/02-comparison.md ---
# UI Audit Comparison — Cross-Module Analysis

**Source files:** `ui-audit/01-console.md`, `ui-audit/01-designer.md`, `ui-audit/01-settings.md`
**Date:** 2026-05-27

---

## Category 1 — Color Palette and Theme Tokens

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Shared-component; all colors via CSS custom properties from `index.css`; no module-specific token overrides | Inline-styles; all color references via CSS custom properties from app-shell token registry; no module-specific token declarations | Inline-styles; all color references are CSS custom property calls into app-shell token set defined in `index.css`; no module-specific token definitions | All three: primary color infrastructure is the 138-token registry in `index.css`; no module owns its own token namespace | — |
| **Source-of-truth files** | `index.css:19–295` (138 tokens); hardcoded values in `AlarmListPane.tsx`, `PointTablePane.tsx`, `TrendPane.tsx`, `index.tsx` | `index.css:19–219`; `shared/theme/tokens.ts` (JS mirror); hardcoded overrides in `DesignerToolbar`, `DesignerTabBar`, `DesignerStatusBar`, `DesignerGraphicsList` | `index.css:17–219`; `settingsStyles.ts:1–71` (subset of token aliases); hardcoded overrides in `Users.tsx`, `Roles.tsx`, `Groups.tsx`, `OpcSources.tsx`, `BulkUpdate.tsx` | `index.css` is the canonical token registry for all three | — |
| **Visual properties actually applied** | ~20 token references; hardcoded hex for alarm priority/quality badge colors, TrendPane series palette, published dot | ~15 token references; 9 hardcoded color values in shell components; 2 undefined tokens (`--io-surface-hover`, `--io-font-sans`) | ~15 token references including `--io-border-subtle`, `--io-success`, `--io-status-fg`; undefined `--io-text-on-accent` in `btnPrimary`; hex-alpha badge concatenation bug in OpcSources | All three use `var(--io-accent)`, `var(--io-border)`, `var(--io-text-primary)`, `var(--io-text-muted)`, `var(--io-surface)` family, `var(--io-success)`/`--io-warning`/`--io-danger` | — |
| **Deviations from app shell** | `var(--io-bg)` and `var(--io-text)` referenced but not defined in `index.css`; alarm priority badge colors hardcoded instead of using `--io-alarm-*` tokens; published dot `#10b981` ≠ `var(--io-success)` | `var(--io-surface-hover)` and `var(--io-font-sans)` undefined; 9 hardcoded values bypass tokens; `#09090b` hardcoded for active IconBtn text instead of `var(--io-accent-foreground)` | `--io-text-on-accent` undefined in `btnPrimary` across ~15 files; hex-alpha CSS var concatenation bug (`${color}20`) renders OpcSources StatusBadge backgrounds as invalid; hardcoded modal overlay/shadow values in Users/Roles/Groups | All three reference at least one undefined token; all three have hardcoded hex colors that bypass the token system | Each module references a different set of undefined tokens |
| **Notes** | Console quality badge colors (`#10B981`, `#F59E0B`, `#EF4444`) have no corresponding tokens; hardcoded is the only option for that sub-type | `DesignerGraphicsList` `SCOPE_COLORS`/`MODE_COLORS` are mostly hardcoded rgba; two of six entries use registered tokens: `SCOPE_COLORS.console.text = "var(--io-accent)"` and `MODE_COLORS.report.text = "var(--io-text-secondary)"` (DesignerGraphicsList.tsx:48,55) | OpcSources StatusBadge `${color}20` concatenation bug is a functional regression: backgrounds render as transparent in all browsers | — | — |

---

## Category 2 — Typography

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Inline-styles; no Console-specific CSS classes or shared typography component | Inline-styles; no module-local CSS; `FieldLabel` component in `DesignerRightPanel` is the only reusable label primitive in any Designer file | Inline-styles; no module-specific CSS; `settingsStyles.ts:labelStyle` exports a named label constant used across most pages | All three use inline-styles exclusively; no shared typography component exists across modules | — |
| **Source-of-truth files** | `index.css:179–218` (16 scale tokens + `--io-font-mono`); inline styles scattered across `index.tsx`, `PaneWrapper`, `ConsolePalette`, `PaneConfigModal`, `AlarmListPane` | `index.css:178–218` (same 16 tokens); `DesignerRightPanel:201–217` (`FieldLabel`); `DesignerModeTabs`, `DesignerToolbar`, `DesignerTabBar`, `DesignerStatusBar` | `index.css`; `index.tsx:198–224` (nav group/item); `SettingsPageLayout:36–55` (page title); `settingsStyles.ts:15–21` (labelStyle); `SettingsTabs:60–75` (tab labels) | `index.css` typography token scale is the reference for all three; none actually use it | — |
| **Visual properties actually applied** | Raw px integers 9–18px; `fontFamily: monospace` on alarm tag/time (not `--io-font-mono`); SubGroupLabel at 9px and PaneTypeBadge at 10px are below smallest token (11px) | Raw px integers 9–20px; `var(--io-font-mono)` used correctly for zoom input (only instance); `var(--io-font-sans)` referenced in zoom dropdown but undefined; RightPanel `FieldLabel`: 10px/600/uppercase/0.05em | Raw px integers 11–18px; bare `"monospace"` keyword in `Groups.tsx` (not `--io-font-mono`); `labelStyle`: 12px/500/`--io-text-secondary`; page title 18px/600; table headers 11px/600/uppercase | All three use raw pixel integer literals; none reference the 16 typography scale tokens (`--io-text-4xl` through `--io-text-code-sm`); all inherit the browser sans-serif stack | — |
| **Deviations from app shell** | Zero typography scale tokens used; `fontFamily: monospace` instead of `--io-font-mono`; SubGroupLabel 9px below minimum token; no font sizes map cleanly to token equivalents | Zero typography scale tokens used; `var(--io-font-sans)` undefined; five different `letterSpacing` values for uppercase labels within `DesignerRightPanel` alone (0em, 0.04em, 0.05em, 0.06em, 0.08em) | Nav group header 11px vs AppShell 10px (1px drift); three different `letterSpacing` values across semantically identical uppercase label elements (0.06em, 0.07em, 0.08em); bare `"monospace"` in `Groups.tsx` instead of `--io-font-mono` | All three: zero typography scale tokens used; all three use bare `monospace` or no font-family token for monospace contexts | — |
| **Notes** | None of the inline sizes map cleanly to token equivalents (e.g., 15px, 16px are not defined tokens) | `FieldLabel` (10px/600/uppercase/0.05em) is the only reusable typography primitive in any of the three modules | Typography is most internally consistent in Settings; deviations are minor relative to Console and Designer | — | — |

---

## Category 3 — Toolbars

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Module-local-component; single 48px horizontal header bar defined as inline JSX inside `ConsolePage` | Module-local-component; four stacked dedicated components (`DesignerModeTabs` 36px, `DesignerToolbar` 44px, `DesignerTabBar` 36px, `DesignerStatusBar` 28px) | **Absent.** Per-page action rows above tables are inline flexbox rows, not toolbars. No toolbar container, no icon-button strip found | N/A — Settings has no toolbars; Console and Designer both use module-local components with no shared toolbar primitive | — |
| **Source-of-truth files** | `index.tsx:1942–2826` (full header + tab strip); `index.tsx:247–466` (`LayoutPickerButton`) | `DesignerModeTabs:207–217`; `DesignerToolbar:1159–1169`; `DesignerTabBar:363–376`; `DesignerStatusBar:192–203` | N/A | — | — |
| **Visual properties actually applied** | 48px height; `background: var(--io-surface)`; `borderBottom: 1px solid var(--io-border)`; active tab: `borderBottom: 2px solid var(--io-accent)`; tab labels 13px/600 active/400 inactive; separator dividers `width:1, height:18, background: var(--io-border)` | DesignerToolbar 44px: same bg/border pattern; `IconBtn` 32×32 `var(--io-radius)`, `transition: background 0.1s, color 0.1s`; mode/tab strips with 2px accent underline; StatusBar 28px at bottom with segment dividers | N/A | Console + Designer share: `background: var(--io-surface)`, `borderBottom: 1px solid var(--io-border)`, active tab underline `2px solid var(--io-accent)`, tab labels font-weight active/inactive distinction | — |
| **Deviations from app shell** | `var(--io-surface)` background where app shell topbar uses `var(--io-surface-primary)` (darker); none of 6 `--io-btn-*` tokens used; no toolbar height token; Publish button rendered twice in right controls block (duplicate render) | Toolbar text action buttons use `borderRadius: 6` integer while IconBtn in the same component uses `var(--io-radius)` (both 6px currently but inconsistent); all heights hardcoded (36/44/36/28); loading skeleton uses 40px instead of actual 44px | N/A | Console + Designer: all toolbar heights are hardcoded integers with no token | — |
| **Notes** | `LayoutPickerButton` is module-local with its own custom inline absolute-positioned dropdown (`zIndex: 200`) | Loading skeleton toolbar placeholder uses 40px height vs the actual 44px, producing a brief layout shift on load | N/A | — | — |

---

## Category 4 — Menus

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Mix; right-click context menus use `shared/components/ContextMenu`; export quick-format dropdown is a hand-rolled inline-positioned panel | Mix; three patterns: custom inline dropdown (File menu, `position: absolute`), custom fixed-position dropdown (zoom presets, `getBoundingClientRect`), shared `ContextMenu` (tab right-click) | Shared-component only; `ContextMenu` is the sole menu type; no custom dropdown panels | All three use `shared/components/ContextMenu` for right-click context menus | — |
| **Source-of-truth files** | `index.tsx:3108–3405` (right-click menus); `index.tsx:2591–2654` (export dropdown); `shared/components/ContextMenu.tsx` | `DesignerModeTabs:317–389` (File menu); `DesignerToolbar:1373–1469` (zoom dropdown); `DesignerTabBar:102–253` (tab context menu); `shared/components/ContextMenu.tsx` | `shared/components/ContextMenu.tsx`; `Users:1628–1660`, `Roles`, `Groups` | `shared/components/ContextMenu.tsx` | — |
| **Visual properties actually applied** | ContextMenu: delegated to shared component; Export dropdown: `position: absolute`, `background: var(--io-surface-elevated)`, `border: 1px solid var(--io-border)`, `borderRadius: 6`, `boxShadow: 0 8px 24px rgba(0,0,0,0.3)`, items 13px | ContextMenu: delegated to shared component; File menu: `position: absolute`, `var(--io-surface-elevated)`, `boxShadow: 0 4px 16px rgba(0,0,0,0.35)`, `zIndex: 300`; Zoom dropdown: `position: fixed` (anchored via `getBoundingClientRect`), `zIndex: 2000` | ContextMenu container: `var(--io-surface-elevated)`, `border: 1px solid var(--io-border)`, `borderRadius: var(--io-radius)`, `boxShadow: 0 8px 24px rgba(0,0,0,0.4)`, `zIndex: 1800`; items: `var(--io-alarm-urgent)` for danger (not `--io-danger`) | All three: ContextMenu uses `var(--io-surface-elevated)` bg, `var(--io-border)` border, `var(--io-radius)` radius; hover applied via imperative `onMouseEnter`/`onMouseLeave` DOM mutation | — |
| **Deviations from app shell** | Export dropdown uses direct DOM style mutation (`e.currentTarget.style.background`) for hover rather than shared `ContextMenu`; no CSS class or React state | Zoom dropdown hover uses `var(--io-surface-hover)` (undefined token — no visual feedback); zoom font uses `var(--io-font-sans)` (undefined); box-shadows differ between File menu and zoom dropdown and do not use `--io-shadow-lg`; `zIndex: 300` vs `zIndex: 2000` across two custom dropdowns | None; Settings consumes `ContextMenu` identically to other modules | All three: custom dropdown implementations (where present) do not use `--io-shadow-lg` token | ContextMenu uses `var(--io-alarm-urgent)` for danger items rather than `var(--io-danger)`; same numeric value in dark theme but diverges in light theme |
| **Notes** | Export dropdown backdrop uses `position: fixed` — safe here since toolbar is not inside an RGL transform ancestor | File menu has no Escape key handler; Zoom dropdown uses `position: fixed` to escape toolbar's potential transform context (consistent with CLAUDE.md invariant) | `ConfirmDialog` (shared component) is used correctly for destructive actions; no dropdown menus needed | — | — |

---

## Category 5 — Side Panels

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Module-local-component; `ConsolePalette.tsx` with `useConsolePanelResize` hook; 220px default width, resizable by drag | Module-local-component; four files (`DesignerLeftPalette`, `DesignerRightPanel`, `ShapePointSelector`, `PointPickerModal`); no shared panel primitive | Module-local-component; bespoke `<aside>` in `index.tsx`; not derived from app-shell sidebar infrastructure | None; all three implement side panels independently | — |
| **Source-of-truth files** | `ConsolePalette.tsx:52–537`; `index.tsx:1127–1132` (state); `useConsolePanelResize.ts` | `DesignerLeftPalette:2430–2438`; `DesignerRightPanel:5961–5992`; `ShapePointSelector:378–393`; `PointPickerModal:44–55` | `index.tsx:179–229` (aside); `AppShell.tsx:1327–1516` (comparison baseline) | — | — |
| **Visual properties actually applied** | 220px; `background: var(--io-surface-secondary)`; `borderRight: 1px solid var(--io-border)`; accordion section headers 36px height; section label 11px/700/uppercase/0.06em; `--io-text-muted`; resize handle 5px `ns-resize` | DesignerLeftPalette: `background: var(--io-surface)`, `borderRight: 1px solid var(--io-border)`; `SectionHeader` 11px/600/uppercase/0.06em; 4px resize handle; palette tiles `var(--io-surface-elevated)` bg; DesignerRightPanel: `background: var(--io-surface)`, `borderLeft: 1px solid var(--io-border)`; RightPanel TabBar tabs 10px/uppercase | 220px; `background: var(--io-surface-secondary)`; `borderRight: 1px solid var(--io-border)`; nav items `padding: 7px 10px`, `borderRadius: var(--io-radius)`; active: `var(--io-accent-subtle)` bg + `var(--io-accent)` text/color | Console + Settings: 220px width, `var(--io-surface-secondary)` bg, `borderRight: 1px solid var(--io-border)` | DesignerLeftPalette diverges: uses `var(--io-surface)` not `var(--io-surface-secondary)` |
| **Deviations from app shell** | 220px vs `--io-sidebar-width: 240px`; `var(--io-text)` undefined in section search input; view mode selector hover via DOM mutation (`borderRadius: 3` vs `var(--io-radius)` on list items); `--io-sidebar-bg` token not used | DesignerLeftPalette: equipment tiles use `var(--io-surface-sunken)` (registered: index.css:26) vs `var(--io-surface-elevated)` for other tile types — real inconsistency in surface-tier choice; drag ghost hardcodes `borderRadius: 4px` and `color: "#09090b"`; `CanvasLayerRow` emoji icons (👁/🔒) vs SVG elsewhere; `var(--io-surface-raised)` undefined for `RowSection`; all hover via DOM mutation | 220px vs `--io-sidebar-width: 240px`; active left-border accent missing (AppShell shows `2px solid var(--io-accent)` on active items; Settings shows none); no hover transition (AppShell transitions bg/color); group header 11px vs AppShell 10px | Console + Settings: same width deviation (220px vs 240px token) and same background token (`var(--io-surface-secondary)`) but neither uses `--io-sidebar-width` | — |
| **Notes** | `PointsBrowserPanel` (app-shell) embedded inside the palette Points section; its styles are app-shell-owned | Stencil tile uses ⬜ emoji placeholder thumbnail; equipment tiles use `ShapeThumbnail` SVG; display element tiles use `DisplayElementPreview` SVG — three thumbnail strategies | Missing active left-border accent is the most visible deviation from AppShell nav pattern | — | — |

### Shared Infrastructure — Category 5

| Field | selection.css + MarqueeLayer.tsx |
|---|---|
| **Implementation** | Shared clipboard selection overlay system. `selection.css` applies a selection-box outline and glow effect to `.io-selection-overlay` container child elements via `data-indicator` attribute. `MarqueeLayer.tsx` renders a draggable marquee rectangle during drag operations via mouse events and writes to `globalSelectionStore`. |
| **Source-of-truth files** | `frontend/src/shared/clipboard/selection/selection.css:1-11`; `frontend/src/shared/clipboard/selection/MarqueeLayer.tsx:81-108` (render return), `:101` (token deviation) |
| **Visual properties actually applied** | `selection.css`: `[data-indicator="selection-box"]`: `outline: 2px solid var(--accent)`, `outline-offset: -1px`, `borderRadius: 2px`; `[data-indicator="soft-glow"]`: `box-shadow: 0 0 0 2px rgba(255,255,255,0.15), 0 0 12px 2px var(--accent)`, `borderRadius: 4px`. `MarqueeLayer.tsx`: container `position: absolute, inset: 0`; marquee rect while dragging: `background: rgba(80,180,255,0.08)`, `border: 1px dashed var(--accent)`, `pointerEvents: none` |
| **Deviations from app shell** | **Fixed 2026-05-27.** `var(--accent)` → `var(--io-accent)` in both files (selection.css lines 2 and 9; MarqueeLayer.tsx line 101). `MarqueeLayer.tsx:100` background `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)` (teal, index.css:42). Selection box outline, glow shadow, and marquee border now render with the correct teal accent color. |
| **Notes** | Regression resolved. Selection overlay is now visible. Two-line fix: selection.css (2 token references) + MarqueeLayer.tsx (1 token + 1 hardcoded background). Primary category: Cat 10 (Canvas). Secondary: Cat 5 (Panel/tile multi-select contexts). |

---

## Category 6 — Buttons

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Inline-styles; all native `<button>` elements; no shared Button component | Mix; no shared `<Button>` component; five patterns: primary (filled accent), secondary (bordered), destructive, `IconBtn` primitive, toggle/chip; `IconBtn` is the only reusable button primitive | Module-local-component; four named variants in `settingsStyles.ts` (`btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall`); row action buttons in `Users.tsx` duplicated inline | All three use `var(--io-accent)` for primary action button backgrounds; all three use `1px solid var(--io-border)` for secondary/outline borders; none use the 6 `--io-btn-*` tokens | — |
| **Source-of-truth files** | `index.tsx:2116–2824`; `PaneWrapper:143–619`; `PaneConfigModal:461–492`; `AlarmListPane:176–192`; `PointTablePane:185–270` | `DesignerToolbar:904–948` (IconBtn), `1618–1693` (text actions); `DesignerTabBar:208–238`; `DesignerHome:55–84`; `DesignerGraphicsList:342–955`; `DesignerImport:64–90`; `index.tsx:290–450` | `settingsStyles.ts:23–63`; `Users.tsx:1462–1519`; `Groups.tsx:27–31` | — | — |
| **Visual properties actually applied** | Primary: `var(--io-accent)` bg, `#fff` text, `borderRadius: 6`, `padding: 7–9px 14–20px`; Secondary toolbar: transparent, `var(--io-border)`, `borderRadius: 6`, 12px; Modal buttons: `borderRadius: 4`; Alarm Ack: `borderRadius: 3`; No hover states on toolbar or modal buttons | Primary: `var(--io-accent)` bg, `#fff` or `#09090b` text (hardcoded), `var(--io-radius)`; `IconBtn`: 32×32, `var(--io-radius)`, `transition: background 0.1s, color 0.1s`, hover `var(--io-surface-elevated)`; toolbar text actions: `borderRadius: 6` integer; tab close: `borderRadius: 3`; StatusBar segments are `<div>` not `<button>` | `btnPrimary`: `var(--io-accent)`, `var(--io-text-on-accent)` (undefined), `var(--io-radius)`, 13px/600; `btnSecondary`: transparent, `var(--io-text-secondary)`, `var(--io-border)`, `var(--io-radius)`, 13px; `btnDanger`: transparent, `var(--io-danger)`, `1px solid var(--io-danger)`, `var(--io-radius)`, 13px/600; no hover/focus styles on any variant | All three: primary button uses `var(--io-accent)` bg; secondary uses transparent bg + `var(--io-border)`; none use `--io-btn-*` tokens | — |
| **Deviations from app shell** | None of the 6 `--io-btn-*` tokens used; `borderRadius` inconsistent (6/4/3); `#fff` hardcoded on primary instead of `var(--io-accent-foreground)`; no hover states on any toolbar, pane icon, or modal button; no `:focus-visible` ring on any button | `#fff` or `#09090b` hardcoded on primary (not `var(--io-accent-foreground)`); `DesignerImport` fallback `#3b82f6` (blue) on `btnPrimary` is wrong hue; toolbar text actions use `borderRadius: 6` integer while IconBtn uses `var(--io-radius)`; two incompatible destructive styles (ghost rgba vs solid fill) | `--io-text-on-accent` undefined in `btnPrimary`; `btnSecondary`/`btnSmall` have no `fontWeight` (browser default 400 vs 600 on primary/danger); row action buttons duplicated inline in `Users.tsx`; close icon inconsistency (`✕` vs `x`); no hover or focus styles on any variant | All three: primary button text color is hardcoded (`#fff` or `#09090b`) or uses undefined token (`--io-text-on-accent`) rather than `var(--io-accent-foreground)`; all three suppress or lack hover/focus styles | — |
| **Notes** | No `:focus-visible` ring on any button in Console | StatusBar clickable grid/zoom/binding-summary segments are `<div onClick>` not `<button>` — no keyboard navigation | `BulkUpdate.tsx` defines its own full button set (`BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_DANGER`) independently from `settingsStyles`, introducing a second button system within Settings | — | — |

---

## Category 7 — Form Inputs

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Inline-styles; all form inputs use inline styles; no shared input or select component | Mix; `DesignerRightPanel` defines a reusable `inputStyle` constant + `NumberInput`, `SelectInput`, `ColorInput`, `ThemedColorSelect` helpers; `ShapePointSelector` defines its own `inputStyle` with different tokens; `PointPickerModal` defines its own style constants | Module-local-component; `settingsStyles.ts` exports `inputStyle` and `labelStyle`; most pages import these directly; exceptions: `Import.tsx`, `BulkUpdate.tsx`, `Sessions.tsx` define independent constants | All three suppress the native browser focus ring (`outline: none`) without a CSS replacement; Console and Settings use none of the five `--io-input-*` tokens; Designer's `ShapePointSelector` uses `--io-input-bg` and `--io-input-border`; all use `accentColor: var(--io-accent)` for checkboxes/radios in at least some pages | — |
| **Source-of-truth files** | `PaneConfigModal:65–437`; `index.tsx:3499–3547`; `PaneWrapper:1037–1055`; `ConsolePalette:404–424` | `DesignerRightPanel:219–458`; `ShapePointSelector:363–375`; `PointPickerModal:68–128` | `settingsStyles.ts` (baseline); `OpcSources`, `Certificates`, `AuthProviders`, `PointManagement`, `Email`, `Import`, `BulkUpdate`, `Sessions` | — | — |
| **Visual properties actually applied** | Text inputs: `var(--io-surface-secondary)` or `var(--io-surface-elevated)` bg (inconsistent across structurally identical inputs), `borderRadius: 6` or `4` (inconsistent), 13px, `outline: none`; checkboxes: `accentColor: var(--io-accent)` | `DesignerRightPanel inputStyle`: `var(--io-surface)` bg, `var(--io-radius)`, 12px, `outline: none`; `ShapePointSelector inputStyle`: `var(--io-input-bg)` (registered: index.css:131), `var(--io-input-border)` (registered: index.css:132), `borderRadius: 4` integer; `PointPickerModal`: `var(--io-surface-sunken)` bg, `var(--io-radius)` | `settingsStyles inputStyle`: `var(--io-surface-sunken)`, `1px solid var(--io-border)`, `var(--io-radius)`, `padding: 8px 10px`, 13px; `labelStyle`: 12px/500/`--io-text-secondary`/`marginBottom: 5px` (no `textTransform` or `letterSpacing`) (settingsStyles.ts:15-21); checkboxes via `accentColor: var(--io-accent)` on most pages | All three: `border: 1px solid var(--io-border)`; `outline: none`; native checkboxes/radios with `accentColor: var(--io-accent)` (some pages) | — |
| **Deviations from app shell** | `outline: none` removes focus ring; inconsistent backgrounds (`--io-surface-secondary` vs `--io-surface-elevated`) across structurally identical inputs; `borderRadius: 4` vs `6` across inputs; `var(--io-text)` undefined used in some inputs; no `--io-input-*` tokens | Three different input background tokens across three files (`var(--io-surface)`, `var(--io-input-bg)`, `var(--io-surface-sunken)`); `--io-input-bg` (index.css:131) and `--io-input-border` (index.css:132) in `ShapePointSelector` ARE registered tokens; ShapePointSelector correctly uses two of the five `--io-input-*` tokens; `--io-surface-raised` in `RowSection` unregistered; `RowSection` header is `<div onClick>` not `<button>`; `fontSize: "1em"` (relative) in `ShapePointSelector` vs bare integers elsewhere | `Import.tsx` uses `var(--io-surface-secondary)` not `var(--io-surface-sunken)` for input background; three different input backgrounds within `Import.tsx` alone; `BulkUpdate.tsx` uses `borderRadius: "6px"` string instead of `var(--io-radius)`; `--io-space-0` through `--io-space-48` (17 tokens) ARE defined in index.css:148-164; `BulkUpdate` and `RestorePreviewModal` correctly use registered spacing tokens; `AuthProviders` injects global `<style>` tag for checkbox accent-color; `BulkUpdate`/`RestorePreviewModal` conflict radios have no accent-color | Console and Settings: no `--io-input-*` tokens used; Designer's `ShapePointSelector` uses `--io-input-bg` (index.css:131) and `--io-input-border` (index.css:132); all three suppress focus ring | — |
| **Notes** | `fontFamily: monospace` (not `--io-font-mono`) on point tag labels in search results | `ThemedColorSelect` (restricts to ISA-101 token pairs: primary/secondary/muted) is the most defensible form input pattern in any of the three modules | `settingsStyles.ts inputStyle` is the closest to a shared pattern; divergence in `Import`/`BulkUpdate`/`Sessions` is a maintenance liability | — | — |

---

## Category 8 — Status Indicators

| Field | Console | Designer | Settings | Shared-across-all-three | Notes |
|---|---|---|---|---|---|
| **Implementation** | Inline-styles; all hand-drawn `<span>` elements with circle or badge styles; no shared component | Inline-styles; module-local; scattered across `DesignerToolbar` (dirty dot, READ-ONLY badge), `DesignerTabBar` (modified dot), `DesignerStatusBar` (WS dot, binding summary, TEST MODE) | Inline-styles; no shared component; five distinct `StatusBadge` implementations across `OpcSources`, `SystemHealth`, `Import`, `Email`, `PointManagement`; connection dots in `OpcSources` and `SystemHealth` | All three: no shared status indicator component; all three use small circle dots (6–8px) for binary connection/state indicators; all three use `var(--io-success)` / `var(--io-danger)` tokens for the connected/error states | — |
| **Source-of-truth files** | `index.tsx:59–134` (ConsoleStatusBar); `index.tsx:2026–2052` (tab dots, banners); `AlarmListPane:34–91`; `PointTablePane:26–59` | `DesignerStatusBar:204–371`; `DesignerToolbar:1584–1615`; `DesignerTabBar:181–193` | `OpcSources:156–186`; `SystemHealth:41–70`; `Import:72–106`; `Email:187–212`; `PointManagement:126–232`; `OpcSources` + `SystemHealth` connection dots | — | — |
| **Visual properties actually applied** | Connection dot: 6×6px circle, `var(--io-success)`/`var(--io-warning)`/`var(--io-danger)`; dirty/playback dot: 6×6 `var(--io-warning)`; published dot: `#10b981` hardcoded; `PriorityBadge`: pill with hardcoded `rgba()` backgrounds per level; `StateBadge`: text-color-coded; `QualityBadge`: 6×6 circle + text, hardcoded colors | WS dot: `●` glyph 8px, `#22c55e`/`#ef4444` hardcoded; dirty indicator: 7×7px div, `#f97316` hardcoded; READ-ONLY badge: `#eab308`/`rgba(234,179,8,*)` hardcoded; modified tab dot: `var(--io-warning, #f59e0b)` — only token-using indicator; TEST MODE: `#4ade80` with CSS keyframe animation injected as inline `<style>` tag | `OpcSources StatusBadge`: hex-alpha concat bug (broken background); `SystemHealth`: `color-mix(in srgb, colorVar 12%, transparent)` (correct); `Import`: `--io-success-subtle`/`--io-success` token pairs (correct); `Email`: dot-only 7px, token-based; `PointManagement CriticalityBadge`: token pairs (correct); connection dots: `var(--io-success)`/`var(--io-danger)` fill + hardcoded `#22c55e` glow shadow | All three use `var(--io-success)`/`var(--io-danger)` as primary fill tokens for connection state dots | — |
| **Deviations from app shell** | Alarm priority badge colors hardcoded (not `--io-alarm-*` tokens); published dot `#10b981` ≠ `var(--io-success)` (`#22c55e` dark); quality badge colors have no token equivalent; save-failure banner uses `#fff` not `var(--io-status-fg)` | WS dot bypasses tokens (`#22c55e`, `#ef4444`); dirty indicator `#f97316` not a token reference; READ-ONLY badge uses `#eab308` (distinct yellow) not `var(--io-warning)`; TEST MODE fully hardcoded including `<style>` tag injected on every render cycle; only `DesignerTabBar` modified dot uses a token (`var(--io-warning, #f59e0b)`) | **Fixed 2026-05-27:** `OpcSources StatusBadge` hex-alpha concat bug resolved — `background: \`${color}20\`` → `color-mix(in srgb, ${color} 12%, transparent)`; `border: \`1px solid ${color}40\`` → `1px solid color-mix(in srgb, ${color} 25%, transparent)`. Fix uses the `color-mix` pattern already established in `SystemHealth.tsx`; scoped to the local `StatusBadge` function (OpcSources.tsx:168–170). Remaining: `--io-info: #3b82f6` IS defined in index.css:72; `AuthProviders TypeBadge` uses it correctly with matching fallback — no visual regression; connection dot glow shadow hardcodes `#22c55e` (not `var(--io-success

--- File: /home/io/io-dev/io/ui-audit/04-recommendations.md ---
# UI Audit Recommendations

**Derived from:** `ui-audit/02-comparison.md` (post-reconciliation, authoritative)
**Date:** 2026-05-27

---

## Section 1 — Target Architecture

The user's working hypothesis stated three claims. Each is evaluated against the audit evidence.

### Claim A: App shell (top bar, left nav, routing, theme) should be shared across all modules

**Supported — partially already true, partially aspirational.**

All three modules draw from the same `index.css` 138-token registry (Cat 1, List 1 Item 1). The `shared/components/ContextMenu` component, `VersionRecoveryDialog`/`SaveConfirmDialog`, and `ConfirmDialog` are already cross-module shared infrastructure (Cat 4 List 1 Item 3; Cat 11 notes). The AppShell sidebar design pattern (`--io-sidebar-width: 240px`, active left-border accent) exists and is implemented, but all three modules deviate from it with hardcoded 220px and missing active indicators (Cat 5, Deviations). The token registry is the correct shared foundation; the gap is that modules define their own overrides, reference undefined tokens, and ignore defined tokens for height, modal backdrop, z-index, and button styles.

**Refined target:** The app shell provides the token registry, routing, top bar, sidebar chrome, and a small set of shared primitive components. Modules consume these without redefining them. No module defines its own token namespace; undefined token references are zero; every module uses the same constants for sidebar width, modal backdrop, and z-index stacking.

### Claim B: Each module should share an underlying framework implemented uniformly

**Partially supported — the right framing is a thin shared-constants layer, not a component library.**

The audit found no shared Button component, no shared Input component, no shared Dialog wrapper, and no shared form label component spanning all three modules. However, it also found that the `settingsStyles.ts` approach — a named export from a module-level constants file — is already the closest to a shared standard and is the pattern most easily extended (Cat 7, List 1; Cat 6, List 3 Items 1, 3). Designer's `IconBtn` and `FieldLabel` are module-local reusable primitives that would require minimal adaptation to promote to `shared/components/` (Cat 6; Cat 9, List 3 Item 6).

A heavyweight component library is not warranted given the app's scale. The evidence supports a **thin shared-constants and shared-primitives layer**: a small file of style constant objects (`btnPrimary`, `btnSecondary`, `inputStyle`, `labelStyle`) plus two or three React components (`FieldLabel`, `StatusBadge`, `Dialog`) promoted into `shared/components/`. Hover and focus states should be CSS-driven rather than DOM-mutation-driven (Cat 2 List 1 Item 9), which is achievable with a small `shared/styles/` Tailwind-class or CSS-module approach without a full component system.

**Refined target:** A `shared/styles/` constants file and no more than four new shared components replace the per-module duplicates. No module defines its own button system, input style, or dialog backdrop independently.

### Claim C: The main canvas/work area should share a rendering engine with per-module functionality layered on top

**Partially supported with a critical clarification about what "rendering engine" means.**

The shared graphics layer (`SceneRenderer`, `TimeSeriesChart`/`ChartRenderer`, `DataTable`, and the CSS files `alarmFlash.css`, `operationalState.css`, `lod.css`) is already a shared rendering engine consumed inside Console panes. This is working correctly and should continue (Cat 10, Shared Infrastructure entries). The evidence does NOT support merging the work-surface containers: Console's `WorkspaceGrid` (react-grid-layout tile dashboard) and Designer's `DesignerCanvas.tsx` (12,067-line SVG editor with FSM interaction model) serve fundamentally different work modes and share no meaningful interaction semantics (Cat 10, Implementation). Converging the containers would introduce false coupling without shared benefit.

**Refined target:** The shared rendering engine exists and should be maintained. The work-surface container is intentionally module-specific. The correct convergence work in Cat 10 is fixing bugs in the shared infrastructure (selection token prefix bug, alarmFlash.css theme hardcoding) and ensuring each module's canvas follows the same token conventions for its local chrome — not merging the containers.

---

### Consolidated target architecture statement

When this work is complete:

1. The `index.css` token registry is the sole source for all color, spacing, radius, shadow, and z-index values. No undefined tokens are referenced anywhere in the frontend. No module defines its own token namespace.

2. A `shared/styles/` constants file provides named style objects for buttons, inputs, and field labels used uniformly across Console, Designer, and Settings. No module duplicates a button or input style system independently.

3. Four shared components exist in `shared/components/`: `FieldLabel` (promoted from Designer), `StatusBadge` (promoted from Settings Import pattern), `Dialog` (wrapper with ARIA, `--io-modal-backdrop`, and a coordinated z-index), and `ConfirmDialog` (already exists; usage extended to all modules).

4. The shared graphics rendering layer (`SceneRenderer`, the CSS infrastructure files) is maintained as-is. The work-surface containers (WorkspaceGrid, DesignerCanvas) remain module-specific.

5. All interactive elements have visible focus indicators. DOM-mutation hover (`onMouseEnter`/`onMouseLeave` style writes) is replaced with CSS `:hover` rules or React state.

---

## Section 2 — Per-Element Convergence Recommendations

### Category 1 — Color Palette and Theme Tokens

**Standardize on:** The existing `index.css` 138-token registry. No changes to the registry structure; only fix what is broken in the token graph.

**Actions:**

- **Define missing tokens** — add to `index.css`:
  - `--io-bg` (used in Console but undefined — alias to `--io-surface-primary` or `--io-bg: var(--io-surface-primary)`)
  - `--io-text` (used in Console and Designer — alias to `--io-text-primary`)
  - `--io-surface-hover` (used in Designer zoom dropdown — alias to `--io-surface-elevated`)
  - `--io-font-sans` (used in Designer zoom dropdown — define with the same font stack as the document)
  - `--io-text-on-accent` (used in Settings btnPrimary — alias to `--io-accent-foreground`)
  - `--io-error` (used in DesignerCanvas context menu — alias to `--io-danger`)

- **Replace hardcoded hex with tokens** — highest-value cases:
  - Console published dot `#10b981` → `var(--io-success)`
  - Console alarm priority badges (PriorityBadge hardcoded rgba) → `--io-alarm-urgent`, `--io-alarm-high`, `--io-alarm-low`, etc.
  - Designer WS dot `#22c55e`/`#ef4444` → `var(--io-success)`/`var(--io-danger)`
  - Designer dirty indicator `#f97316` → `var(--io-warning)`
  - Designer READ-ONLY badge `#eab308` → `var(--io-warning)`
  - All modules: connection dot glow shadow `#22c55e` → `var(--io-success)`
  - `alarmFlash.css`: migrate hardcoded hex to `--io-alarm-*` tokens (see Cat 8 and Cat 10 notes)

- **Do not change:** `operationalState.css` hardcoded ISA-101 colors — documented intentional exception.

**Build new vs adopt:** No new infrastructure. Token registry is already the correct approach; this is a fill-the-gaps exercise.

---

### Category 2 — Typography

**Standardize on:** Raw pixel inline styles as the de-facto standard for component-level typography. The 16 `--io-text-*` scale tokens exist but have zero usage across all three modules; mandating adoption is a wide-blast refactor for low functional gain unless font-size theming is a product requirement.

**What to standardize now:** Document a fixed set of semantic size/weight values for recurring label contexts. Adopt these values uniformly rather than letting each module drift:

| Context | Value | Basis |
|---|---|---|
| Page title | 18px / 600 / `--io-text-primary` | Settings `SettingsPageLayout` |
| Section/palette group label | 11px / 600 / uppercase / 0.06em / `--io-text-muted` | Console palette, Designer SectionHeader agree |
| Form field label | 11px / 600 / uppercase / 0.05em / `--io-text-muted` | Designer `FieldLabel` (after minor size alignment) |
| Tab label active / inactive | 13px / 600 / 400 | Console + Designer tab strips agree |
| Table column header | 11px / 600 / uppercase / 0.06em | Console + Settings agree |

**Actions:**
- Fix: `fontFamily: monospace` → `var(--io-font-mono)` in all three modules (after defining `--io-font-sans` unblocks confidence in the font token approach)
- Adopt: Settings `SettingsPageLayout` as the shared page-title component (see Cat 9)
- Adopt: Designer `FieldLabel` as the shared form label component (see Cat 9)
- Eliminate: Sub-minimum font sizes (Console SubGroupLabel 9px, PaneTypeBadge 10px should be raised to 11px minimum)

**Do not attempt now:** Migrating all raw pixels to `--io-text-*` scale tokens. Defer until font-size scaling is a product requirement.

---

### Category 3 — Toolbars

**Standardize on:** Module-local toolbar components remain the right approach — toolbar structure is inherently module-specific. Converge on the *visual properties* shared between Console and Designer.

**Adopt:** The Console/Designer shared visual convention that already exists:
- `background: var(--io-surface)` / `borderBottom: 1px solid var(--io-border)`
- Active tab underline: `2px solid var(--io-accent)`
- Tab label: 13px / 600 active / 400 inactive
- Icon button: 32×32 with `var(--io-radius)` radius and `transition: background 0.1s, color 0.1s`

**Actions:**
- Fix: Duplicate Publish button in Console (two render blocks; remove one)
- Fix: Designer loading skeleton 40px → 44px (layout shift on load)
- Fix: Designer StatusBar segments (`<div onClick>`) → `<button>` for keyboard navigation
- Fix: All toolbar heights hardcoded — not a blocker but add a `--io-toolbar-height` token if/when height theming is needed
- Fix: Designer toolbar text-action buttons use `borderRadius: 6` integer while `IconBtn` uses `var(--io-radius)` — standardize on `var(--io-radius)` throughout

**Build new:** None. Shared constants for the visual convention are sufficient.

---

### Category 4 — Menus

**Standardize on:** `shared/components/ContextMenu` as the sole menu primitive. Settings demonstrates this is sufficient for a complex module (Cat 4, List 3 Item 5).

**Actions:**
- Fix: `ContextMenu` danger item color: `var(--io-alarm-urgent)` → `var(--io-danger)` in `shared/components/ContextMenu.tsx`
- Fix: Designer File menu — add Escape key handler to close
- Fix: Designer zoom dropdown hover — `var(--io-surface-hover)` → `var(--io-surface-elevated)` (after defining `--io-surface-hover` as an alias)
- Fix: Designer zoom dropdown box-shadow → use `--io-shadow-lg` token if defined, or a consistent hardcoded value matching the File menu
- Migrate: Console export quick-format dropdown → replace with `ContextMenu` usage (low-risk; existing pattern is one custom dropdown)
- Evaluate: Designer File menu — if `ContextMenu` can represent a triggered (non-right-click) menu, migrate; otherwise keep but fix the Escape handler and hover state

**Build new:** None.

---

### Category 5 — Side Panels

**Standardize on:** Module-local panel components remain the right approach (panels differ structurally across modules). Converge on visual properties.

**Adopt:** Console + Settings convention: `background: var(--io-surface-secondary)`, `borderRight: 1px solid var(--io-border)`.

**Actions (highest priority first):**
- **Fixed 2026-05-27** (functional regression): `shared/clipboard/selection/selection.css` — `var(--accent)` → `var(--io-accent)` (lines 2 and 9). `MarqueeLayer.tsx` — `var(--accent)` → `var(--io-accent)` (line 101) and `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)` (line 100). Selection highlight and marquee border now render with teal accent color.
- Fix: Align Designer left palette background: `var(--io-surface)` → `var(--io-surface-secondary)` to match Console and Settings
- Fix: Resolve `--io-sidebar-width` discrepancy — either update the token to 220px to match current practice, or update all three modules to 240px. Pick one and be consistent.
- Fix: Settings active nav item — add `borderLeft: 2px solid var(--io-accent)` on active state to match AppShell pattern
- Fix: Replace DOM-mutation hover in Console palette (`e.currentTarget.style.*`) with CSS `:hover` or React state
- Fix: Designer `CanvasLayerRow` `--io-surface-raised` undefined → use `var(--io-surface-elevated)`
- Fix: Section label typography — standardize on 11px/600/uppercase/0.06em per Cat 2 table (Console and Designer already agree; bring Settings nav group into alignment)

**Build new:** None for panel containers. Shared `FieldLabel` (Cat 9) and `StatusBadge` (Cat 8) are the shared components this category depends on.

---

### Category 6 — Buttons

**Standardize on:** `settingsStyles.ts` named-variant pattern as the starting point. Promote to `shared/styles/buttons.ts` accessible across all modules.

**Adopt:** The four named variants `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall` with corrected token references. Do not build a React `<Button>` component — named style constant objects are sufficient and the existing patterns already use this approach.

**Actions:**
- Create: `frontend/src/shared/styles/buttons.ts` with corrected variants:
  - `btnPrimary`: `var(--io-accent)` bg, `var(--io-accent-foreground)` text (replaces `--io-text-on-accent` and hardcoded `#fff`/`#09090b`), `var(--io-radius)`, add hover state via `transition: opacity 0.1s` or `var(--io-btn-hover)` token
  - `btnSecondary`: transparent bg, `var(--io-text-secondary)` text, `1px solid var(--io-border)`, `var(--io-radius)`, matching font-weight (600)
  - `btnDanger`: same structure as secondary but `var(--io-danger)` text and border
  - `btnSmall`: size modifier only
- Migrate: Console toolbar + modal buttons to the shared file
- Migrate: Designer text-action buttons and Stencil/Import primary buttons to the shared file; leave `IconBtn` as-is (it is already a good local primitive)
- Merge: `BulkUpdate.tsx` `BTN_PRIMARY`/etc. → import from shared file
- Fix: Designer StatusBar segments `<div onClick>` → `<button>` (see Cat 3)
- Fix: Add CSS hover states to all button variants; remove all `onMouseEnter`/`onMouseLeave` style mutations on buttons
- Fix: `DesignerImport` fallback `#3b82f6` primary button background → `var(--io-accent)`
- Fix: All destructive button inconsistency in Designer (ghost rgba vs solid fill) → standardize on `btnDanger` solid pattern

**Build new:** `shared/styles/buttons.ts` (constants file, not a component).

---

### Category 7 — Form Inputs

**Standardize on:** `settingsStyles.ts inputStyle` pattern. Same approach as buttons: promote to `shared/styles/inputs.ts`.

**Adopt:** Standard input object: `background: var(--io-surface-sunken)`, `border: 1px solid var(--io-border)`, `borderRadius: var(--io-radius)`, `padding: 8px 10px`, `fontSize: 13px`, `color: var(--io-text-primary)`. Use `--io-input-bg` and `--io-input-border` tokens where applicable (Designer's ShapePointSelector already does this correctly and can serve as validation that the tokens work).

**Actions:**
- Create: `frontend/src/shared/styles/inputs.ts` with `inputStyle` and `labelStyle` objects
- Migrate: Console `PaneConfigModal`, `PaneWrapper`, `ConsolePalette` inputs to shared inputStyle
- Migrate: Designer `DesignerRightPanel inputStyle`, `PointPickerModal` inputs to shared inputStyle
- Migrate: Settings `Import.tsx`, `BulkUpdate.tsx`, `Sessions.tsx` (the current diverging cases) to the shared inputStyle
- Fix (accessibility — all modules): Remove `outline: none` and replace with `outline: 2px solid var(--io-accent)` on `:focus-visible`. This is a wide change; use the shared constants file so it's fixed in one place.
- Fix: `fontFamily: monospace` → `var(--io-font-mono)` in Console `PaneConfigModal` and Settings `Groups.tsx`
- Fix: `AuthProviders.tsx` — remove the `<style>` tag injected for checkbox `accent-color`; use the `accentColor: "var(--io-accent)"` inline style already used by other pages
- Keep: Designer `ThemedColorSelect` as a module-local specialized component (restricts to ISA-101 token pairs — this is domain logic, not a shared concern)

**Build new:** `shared/styles/inputs.ts` (constants file, not a component).

---

### Category 8 — Status Indicators

**Standardize on:** Settings `Import.tsx` token-pair pattern (`background: var(--io-success-subtle)`, `color: var(--io-success)`) as the canonical StatusBadge implementation.

**Build new:** `shared/components/StatusBadge.tsx` — a simple component accepting `status` (connected/disconnected/error/warning/info/running/etc.) and optional `label` props, rendering with the correct token pair for each state. This is the one new component where a React component (not just a constants object) is warranted, because the rendering logic (which token pair, whether to show dot vs pill vs text) is non-trivial and repeated five different ways in Settings alone.

**Actions:**
- Fix (functional regression): `OpcSources StatusBadge` hex-alpha concat bug — `${color}20` → `color-mix(in srgb, ${color} 12%, transparent)` or migrate to shared `StatusBadge` component
- Migrate: All five Settings StatusBadge implementations → shared component
- Migrate: Console connection dots and priority/state/quality badges → shared component or token-based inline styles
- Migrate: Designer WS dot, dirty indicator, READ-ONLY badge → use token colors (minimum); migrate to shared component where appropriate
- Fix: Designer TEST MODE `<style>` tag injection → CSS class + token-based keyframe, remove the inline `<style>` element
- Fix: Console published dot `#10b981` → `var(--io-success)`
- Fix: All connection dot glow shadows `#22c55e` → `var(--io-success)` (or remove glow if it introduces complexity)
- Fix: `alarmFlash.css` — migrate `#ef4444`, `#f97316`, `#eab308`, `#f4f4f5`, `#60a5fa` to `--io-alarm-urgent`, `--io-alarm-high`, `--io-alarm-low`, `--io-alarm-diagnostic`, `--io-alarm-custom` tokens. This is the correct fix for theme adaptation; the off-state `#808080` has no token equivalent and should be defined (`--io-alarm-inactive: #808080`).

**Do not change:** `operationalState.css` — ISA-101 hardcoded colors are intentional and documented.

---

### Category 9 — Labels and Headers

**Standardize on:** Two shared components to promote:
1. `SettingsPageLayout.tsx` for page-level heading (already a shared component within Settings; extend access to Console and Designer views)
2. `FieldLabel` from `DesignerRightPanel` — promote to `shared/components/FieldLabel.tsx`

**Actions:**
- Promote: `DesignerRightPanel.tsx` `FieldLabel` (lines 201–203) → `shared/components/FieldLabel.tsx`. Minimal changes: standardize size to 11px (from 10px) to align with the Cat 2 table convention; keep other properties (`/600/uppercase/0.05em/--io-text-muted`).
- Adopt: `FieldLabel` in Console `PaneConfigModal` and Settings pages to replace inline `<div>`-based form labels
- Adopt: `SettingsPageLayout` pattern — evaluate extending it to Console's `PaneConfigModal` header and Designer's view-level headers as applicable
- Fix: `var(--io-text)` undefined in Console/Designer dialog titles → `var(--io-text-primary)`
- Fix: Inconsistent `letterSpacing` across uppercase labels → standardize on 0.06em
- Fix: Console — no semantic heading elements anywhere; add `<h2>` for page/section titles where appropriate
- Fix: Designer `SymbolLibrary` — `<h2>` elements with inconsistent sizes (15px/600 vs 16px/700 within same file) → pick one and apply consistently
- Do not change: Settings `SettingsPageLayout` `<h2>` page title — correct semantic for a sub-page context

---

### Category 10 — Canvas / Main Work Area

**Standardize on:** Module-specific canvas containers are correct and should not be merged. Shared graphics infrastructure should be the focus.

**Actions (by priority):**

- **Fixed 2026-05-27** (functional regression, was highest priority): `shared/clipboard/selection/selection.css` and `MarqueeLayer.tsx` — `var(--accent)` → `var(--io-accent)` (selection.css lines 2 and 9; MarqueeLayer.tsx line 101). `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)` (MarqueeLayer.tsx line 100). Selection highlight and marquee border now render with teal accent color.
- Fix: `alarmFlash.css` — migrate alarm hex colors to `--io-alarm-*` tokens (see Cat 8). Required for light/HPHMI theme support.
- Fix: Console `WorkspaceGrid` container `var(--io-bg)` (undefined) → `var(--io-surface-primary)` (after defining `--io-bg` alias in Cat 1 token work, this becomes automatic)
- Fix: DesignerCanvas canvas border `rgba(255,255,255,0.08)` → define a token or use `var(--io-border)` with opacity; grid lines `rgba(128,128,128,0.12/0.28)` → acceptable to leave as-is if theme support is not required for the grid appearance
- Fix: DesignerCanvas resize handles `fill="white"` → `fill="var(--io-text-inverse)"` or keep `white` with a formal comment documenting it as intentional in dark-theme-only contexts
- Fix: `--io-error` references in DesignerCanvas → `--io-danger` (after defining `--io-error` alias in Cat 1 token work, this becomes automatic)
- Fix: Guide line colors (`rgba(0,200,255,0.5)`, `rgba(255,160,0,0.5)`) — low priority, canvas-only; acceptable as-is if guide colors are intentional design choices
- Fix: "Paste as…" submenu items for `table`/`temporary-graphic` always render disabled — separate bug, out of scope for UI consistency work but worth a task file

**Do not change:** `lod.css` (no deviations), `operationalState.css` (intentional exception).

---

### Category 11 — Modals and Dialogs

**Standardize on:** Build one shared `Dialog` wrapper component. Radix Dialog (already used in Settings for PointManagement, AuthProviders, Email) is the best implementation and should be the standard for new dialogs. The shared wrapper provides: `--io-modal-backdrop` backdrop, `role="dialog"` + `aria-modal="true"`, `background: var(--io-surface-elevated)`, `borderRadius: var(--io-radius-lg)`, and a coordinated z-index.

**Actions:**

- Fix (token): Standardize z-index values. `--io-z-modal: 300` is misaligned with actual usage (1000–9999). Either raise the token to 1000 minimum, or define a z-index scale (`--io-z-dropdown: 200`, `--io-z-modal: 1000`, `--io-z-toast: 2000`). Do not leave the token at 300 when no dialog uses it.
- Fix (token): `--io-modal-backdrop` is already defined and used in ≥6 Settings files. Console and Designer should migrate to it from hardcoded `rgba(0,0,0,0.5–0.6)`.
- Fix (accessibility, urgent): `RestorePreviewModal.tsx` — add `role="dialog"` and `aria-modal="true"`. This is the highest-priority ARIA gap because it appears on a destructive-adjacent action path.
- Fix (accessibility): Console inline modals (3 dialogs in `index.tsx`) — add `role="dialog"` and `aria-modal`.
- Fix (accessibility): Settings `Import.tsx` Modal/Drawer and `OpcSources ManageCategoriesModal` — add ARIA.
- Fix: Replace all 8 `window.confirm()` calls with `ConfirmDialog`:
  - OpcSources.tsx (3 calls)
  - Import.tsx (3 calls)
  - CameraStreams.tsx (1 call)
  - SupplementalConnectorsTab.tsx (1 call)
- Fix: Standardize `borderRadius` to `var(--io-radius-lg)` across all modals (currently 8, 9, 10, 12px scattered)
- Fix: Standardize modal content background to `var(--io-surface-elevated)` (currently mixed with `--io-surface`, `--io-surface-secondary`, `--io-surface-primary`)
- Fix: Designer primary button text in dialogs — `#09090b`/`#fff` hardcoded → `var(--io-accent-foreground)` (after shared buttons.ts is in place, this is automatic)
- Fix: Designer error color mixing (`--io-alarm-high` for errors in wrong domain, `--io-error` undefined) → use `--io-danger` consistently
- Fix: Designer step indicator inconsistency across 5 wizard dialogs — define one step indicator pattern (not blocked by other work but needs its own task)

---

## Section 3 — Rough Migration Order

The dependency structure has four phases. Items within a phase are largely independent of each other.

### Phase 1 — Token registry (unblocks everything downstream)

No component changes. Pure token additions to `index.css`.

1. Define missing tokens: `--io-bg`, `--io-text`, `--io-surface-hover`, `--io-font-sans`, `--io-text-on-accent` (alias to `--io-accent-foreground`), `--io-error` (alias to `--io-danger`), `--io-alarm-inactive: #808080`, `--io-text-inverse`.
2. Fix z-index token: raise `--io-z-modal` to a realistic value (recommend 1000); optionally define `--io-z-dropdown: 500` and `--io-z-toast: 2000`.
3. Resolve sidebar width: pick 220px or 240px; update token or code to match.

**Why first:** Every downstream fix that replaces hardcoded hex or undefined token references becomes a one-word change once these tokens exist. Without them, each fix requires two changes (add the token AND update the reference).

### Phase 2 — Functional regressions (urgent; no dependency on Phase 1 being complete)

These are bugs visible at runtime, not polish issues.

1. ~~`selection.css` + `MarqueeLayer.tsx`: `var(--accent)` → `var(--io-accent)`, `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)`. (2-file change.)~~ **Fixed 2026-05-27.**
2. ~~`OpcSources StatusBadge` hex-alpha concat bug: `${color}20` → `color-mix(...)` or component migration.~~ **Fixed 2026-05-27.** `background: \`${color}20\`` → `color-mix(in srgb, ${color} 12%, transparent)`; `border: \`1px solid ${color}40\`` → `color-mix(in srgb, ${color} 25%, transparent)`. Fix scoped to the local `StatusBadge` function in `OpcSources.tsx` (lines 168–170); matches the `color-mix` pattern already used by `SystemHealth.tsx`. **Note:** The same `${color}20`/`${color}40` hex-alpha pattern also appears in `Users.tsx` (Badge, line 108/110), `Roles.tsx` (Badge, line 51/53), `CameraStreams.tsx` (line 785/787), and `MaintenanceTicketsPanel.tsx` (line 52) — these were not fixed here and remain broken when CSS variable strings are passed as the color argument.
3. `alarmFlash.css`: migrate hex to `--io-alarm-*` tokens. (This affects theme support, not current dark-theme functionality, but the hardcoded values are wrong in principle and block HPHMI work.)
4. Critical ARIA fixes: `RestorePreviewModal` + Console inline modals + Import/OpcSources dialogs. (Accessibility regression on destructive paths.)
5. Replace 8 `window.confirm()` calls with `ConfirmDialog`.
6. Console duplicate Publish button — remove one render block.

**Why second:** These are observable regressions. They are small-scope, can be reviewed independently, and should not wait for the broader convergence work.

### Phase 3 — Shared style constants (enables consistent convergence without component work)

Depends on: Phase 1 token fixes (so constants reference valid tokens).

1. Create `shared/styles/buttons.ts` with corrected `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall` variants.
2. Create `shared/styles/inputs.ts` with standard `inputStyle` (including focus ring; remove `outline: none`).
3. Migrate Console button and input inline styles to shared constants.
4. Migrate Designer text-action buttons and import buttons to `buttons.ts`; migrate `DesignerRightPanel inputStyle` and `PointPickerModal` to `inputs.ts`.
5. Migrate Settings `Import.tsx`, `BulkUpdate.tsx`, `Sessions.tsx` diverging buttons and inputs to shared constants.
6. Fix `accentColor` / font-family regressions (OpcSources `<style>` tag, monospace font references) as part of input migration.

**Unblocks:** Phase 4 modal work (button styles inside dialogs) and Cat 6/7 cleanup across all modules.

### Phase 4 — Shared components (highest coordination cost)

Depends on: Phase 3 constants (dialogs need buttons; StatusBadge needs token pairs from Phase 1).

1. Promote `FieldLabel` to `shared/components/FieldLabel.tsx`. Migrate usage in Console and Settings.
2. Build `shared/components/StatusBadge.tsx`. Migrate all five Settings implementations, Console priority/state/quality badges, Designer badge indicators.
3. Build `shared/components/Dialog.tsx` (thin wrapper: ARIA, backdrop token, z-index, standard container styles). Migrate Console inline modals and Designer non-Radix dialogs to use it.
4. Fix Designer TEST MODE `<style>` tag injection → CSS keyframe class.
5. Extend `SettingsPageLayout` accessibility or create a simpler page-title shared component for Console and Designer views.

### Phase 5 — Polish and alignment (deferred; no functional impact)

Depends on: Phases 1–4 being stable.

1. Typography: standardize on documented size/weight/spacing values across section labels, field labels, tab labels, page titles.
2. Toolbar heights: define `--io-toolbar-height` token; update Designer skeleton placeholder.
3. Hover/focus: replace remaining DOM-mutation hover with CSS `:hover` pseudo-classes or React state.
4. DesignerCanvas grid line colors, canvas border, guide line colors: token-ify or formally document as intentional.
5. Semantic headings: add `<h2>`/`<h3>` where currently bare `<div>`.
6. Section label `letterSpacing` standardization to 0.06em.

---

## Section 4 — Risks and Unknowns

### R1 — `--io-z-modal: 300` is unusable as-is

Every dialog in all three modules uses z-index values between 1000 and 9999. Raising the token will fix any code that correctly references it, but code currently using hardcoded integers (the majority) will be unaffected until individually migrated. There is a risk that the migration is incomplete and layers will stack incorrectly in edge cases (e.g., a console modal rendered inside a designer tab). A z-inde

---

Produce the review now.
```


## #TURN_END

_2026-05-27T05:52:28+00:00_

---


## #PROMPT

_2026-05-27T05:52:33+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
bash /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep" 2>&1
```


## #TURN_END

_2026-05-27T05:52:33+00:00_

---
---

WORK UNIT SUMMARY:
---
# Work Unit Summary

**Generated**: 2026-05-27T05:55:11+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-27_regression-statusbadge-hex-alpha

read-o_054757.md`
**Session**: 

---

## Work unit purpose

Fixed the `OpcSources` `StatusBadge` hex-alpha concatenation bug where template literal strings like `` `${color}20` `` produced invalid CSS when `color` was a CSS variable, rendering all badge backgrounds as transparent. Updated audit artifacts to reflect the fix.

## Key decisions made

- Scoped the fix to the local `StatusBadge` function in `OpcSources.tsx` only (not a shared component migration), because the function is module-local and not shared
- Used `color-mix(in srgb, ${color} 12%, transparent)` / `color-mix(in srgb, ${color} 25%, transparent)` to match the existing pattern already established in `SystemHealth.tsx`
- Did not fix the same `${color}20`/`${color}40` bug found in `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, and `MaintenanceTicketsPanel.tsx` — recorded as an open finding instead

## What was built or changed

- `OpcSources.tsx:168–170`: replaced `background: \`${color}20\`` and `border: \`1px solid ${color}40\`` with valid `color-mix()` expressions
- `ui-audit/04-recommendations.md`: marked the OpcSources StatusBadge regression as resolved (strikethrough + fix details + note about remaining affected files)
- `ui-audit/02-comparison.md`: updated Category 8 Settings deviations field to record the fix date, before/after code, and the four additional files with the same unfixed bug

## What was deliberately not done

- Same hex-alpha bug in `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx` not fixed — out of scope per prompt; recorded as an open finding
- No migration to a shared `StatusBadge` component (deferred to Phase 4 of the broader convergence plan)
- No changes to any Claim A, B, or other Claim C work

## Open questions or follow-ups

- Four additional files (`Users.tsx` Badge:108/110, `Roles.tsx` Badge:51/53, `CameraStreams.tsx`:785/787, `MaintenanceTicketsPanel.tsx`:52) have the same `${color}20`/`${color}40` bug and remain broken when CSS variable strings are passed as color arguments

## Files modified

- `frontend/src/pages/settings/OpcSources.tsx`
- `ui-audit/02-comparison.md`
- `ui-audit/04-recommendations.md`
SessionEnd hook [${CLAUDE_PROJECT_DIR}/.claude/hooks/session-end.sh] failed: /bin/sh: 1: /home/io/io-dev/io/frontend/.claude/hooks/session-end.sh: not found
---


DIFF OF CHANGES:
---
diff --git a/frontend/src/pages/settings/OpcSources.tsx b/frontend/src/pages/settings/OpcSources.tsx
index 0807d2ff..89713e31 100644
--- a/frontend/src/pages/settings/OpcSources.tsx
+++ b/frontend/src/pages/settings/OpcSources.tsx
@@ -165,9 +165,9 @@ function StatusBadge({ status }: { status: string }) {
         borderRadius: "9999px",
         fontSize: "11px",
         fontWeight: 600,
-        background: `${color}20`,
+        background: `color-mix(in srgb, ${color} 12%, transparent)`,
         color,
-        border: `1px solid ${color}40`,
+        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
         textTransform: "capitalize",
       }}
     >
diff --git a/ui-audit/02-comparison.md b/ui-audit/02-comparison.md
index afb93f2d..4af88c4e 100644
--- a/ui-audit/02-comparison.md
+++ b/ui-audit/02-comparison.md
@@ -106,7 +106,7 @@
 | **Implementation** | Inline-styles; all hand-drawn `<span>` elements with circle or badge styles; no shared component | Inline-styles; module-local; scattered across `DesignerToolbar` (dirty dot, READ-ONLY badge), `DesignerTabBar` (modified dot), `DesignerStatusBar` (WS dot, binding summary, TEST MODE) | Inline-styles; no shared component; five distinct `StatusBadge` implementations across `OpcSources`, `SystemHealth`, `Import`, `Email`, `PointManagement`; connection dots in `OpcSources` and `SystemHealth` | All three: no shared status indicator component; all three use small circle dots (6–8px) for binary connection/state indicators; all three use `var(--io-success)` / `var(--io-danger)` tokens for the connected/error states | — |
 | **Source-of-truth files** | `index.tsx:59–134` (ConsoleStatusBar); `index.tsx:2026–2052` (tab dots, banners); `AlarmListPane:34–91`; `PointTablePane:26–59` | `DesignerStatusBar:204–371`; `DesignerToolbar:1584–1615`; `DesignerTabBar:181–193` | `OpcSources:156–186`; `SystemHealth:41–70`; `Import:72–106`; `Email:187–212`; `PointManagement:126–232`; `OpcSources` + `SystemHealth` connection dots | — | — |
 | **Visual properties actually applied** | Connection dot: 6×6px circle, `var(--io-success)`/`var(--io-warning)`/`var(--io-danger)`; dirty/playback dot: 6×6 `var(--io-warning)`; published dot: `#10b981` hardcoded; `PriorityBadge`: pill with hardcoded `rgba()` backgrounds per level; `StateBadge`: text-color-coded; `QualityBadge`: 6×6 circle + text, hardcoded colors | WS dot: `●` glyph 8px, `#22c55e`/`#ef4444` hardcoded; dirty indicator: 7×7px div, `#f97316` hardcoded; READ-ONLY badge: `#eab308`/`rgba(234,179,8,*)` hardcoded; modified tab dot: `var(--io-warning, #f59e0b)` — only token-using indicator; TEST MODE: `#4ade80` with CSS keyframe animation injected as inline `<style>` tag | `OpcSources StatusBadge`: hex-alpha concat bug (broken background); `SystemHealth`: `color-mix(in srgb, colorVar 12%, transparent)` (correct); `Import`: `--io-success-subtle`/`--io-success` token pairs (correct); `Email`: dot-only 7px, token-based; `PointManagement CriticalityBadge`: token pairs (correct); connection dots: `var(--io-success)`/`var(--io-danger)` fill + hardcoded `#22c55e` glow shadow | All three use `var(--io-success)`/`var(--io-danger)` as primary fill tokens for connection state dots | — |
-| **Deviations from app shell** | Alarm priority badge colors hardcoded (not `--io-alarm-*` tokens); published dot `#10b981` ≠ `var(--io-success)` (`#22c55e` dark); quality badge colors have no token equivalent; save-failure banner uses `#fff` not `var(--io-status-fg)` | WS dot bypasses tokens (`#22c55e`, `#ef4444`); dirty indicator `#f97316` not a token reference; READ-ONLY badge uses `#eab308` (distinct yellow) not `var(--io-warning)`; TEST MODE fully hardcoded including `<style>` tag injected on every render cycle; only `DesignerTabBar` modified dot uses a token (`var(--io-warning, #f59e0b)`) | `OpcSources StatusBadge` broken by hex-alpha CSS var concat; `--io-info: #3b82f6` IS defined in index.css:72; `AuthProviders TypeBadge` uses it correctly with matching fallback — no visual regression; connection dot glow shadow hardcodes `#22c55e` (not `var(--io-success)`); `--io-text-on-accent` undefined (applies to badge buttons in several pages) | All three: hardcoded `#22c55e` for connection dot glow shadows; none have a shared StatusBadge component | — |
+| **Deviations from app shell** | Alarm priority badge colors hardcoded (not `--io-alarm-*` tokens); published dot `#10b981` ≠ `var(--io-success)` (`#22c55e` dark); quality badge colors have no token equivalent; save-failure banner uses `#fff` not `var(--io-status-fg)` | WS dot bypasses tokens (`#22c55e`, `#ef4444`); dirty indicator `#f97316` not a token reference; READ-ONLY badge uses `#eab308` (distinct yellow) not `var(--io-warning)`; TEST MODE fully hardcoded including `<style>` tag injected on every render cycle; only `DesignerTabBar` modified dot uses a token (`var(--io-warning, #f59e0b)`) | **Fixed 2026-05-27:** `OpcSources StatusBadge` hex-alpha concat bug resolved — `background: \`${color}20\`` → `color-mix(in srgb, ${color} 12%, transparent)`; `border: \`1px solid ${color}40\`` → `1px solid color-mix(in srgb, ${color} 25%, transparent)`. Fix uses the `color-mix` pattern already established in `SystemHealth.tsx`; scoped to the local `StatusBadge` function (OpcSources.tsx:168–170). Remaining: `--io-info: #3b82f6` IS defined in index.css:72; `AuthProviders TypeBadge` uses it correctly with matching fallback — no visual regression; connection dot glow shadow hardcodes `#22c55e` (not `var(--io-success)`); `--io-text-on-accent` undefined (applies to badge buttons in several pages). **Open finding:** same `${color}20`/`${color}40` hex-alpha bug exists in `Users.tsx` (Badge:108/110), `Roles.tsx` (Badge:51/53), `CameraStreams.tsx` (785/787), `MaintenanceTicketsPanel.tsx` (52) — not fixed here. | All three: hardcoded `#22c55e` for connection dot glow shadows; none have a shared StatusBadge component | — |
 | **Notes** | `var(--io-alarm-high)` is used correctly on the save-failure banner — the only alarm token use in Console's status layer | TEST MODE injects a new `<style>` element on every render cycle when test mode is active — a performance concern | `Import.tsx` token-pair pattern (`--io-success-subtle`/`--io-success`) is the cleanest `StatusBadge` implementation across all three modules | — | — |
 
 ### Shared Infrastructure — Category 8
diff --git a/ui-audit/04-recommendations.md b/ui-audit/04-recommendations.md
index f1e6f423..2aabbd25 100644
--- a/ui-audit/04-recommendations.md
+++ b/ui-audit/04-recommendations.md
@@ -308,7 +308,7 @@ No component changes. Pure token additions to `index.css`.
 These are bugs visible at runtime, not polish issues.
 
 1. ~~`selection.css` + `MarqueeLayer.tsx`: `var(--accent)` → `var(--io-accent)`, `rgba(80,180,255,0.08)` → `var(--io-accent-subtle)`. (2-file change.)~~ **Fixed 2026-05-27.**
-2. `OpcSources StatusBadge` hex-alpha concat bug: `${color}20` → `color-mix(...)` or component migration.
+2. ~~`OpcSources StatusBadge` hex-alpha concat bug: `${color}20` → `color-mix(...)` or component migration.~~ **Fixed 2026-05-27.** `background: \`${color}20\`` → `color-mix(in srgb, ${color} 12%, transparent)`; `border: \`1px solid ${color}40\`` → `color-mix(in srgb, ${color} 25%, transparent)`. Fix scoped to the local `StatusBadge` function in `OpcSources.tsx` (lines 168–170); matches the `color-mix` pattern already used by `SystemHealth.tsx`. **Note:** The same `${color}20`/`${color}40` hex-alpha pattern also appears in `Users.tsx` (Badge, line 108/110), `Roles.tsx` (Badge, line 51/53), `CameraStreams.tsx` (line 785/787), and `MaintenanceTicketsPanel.tsx` (line 52) — these were not fixed here and remain broken when CSS variable strings are passed as the color argument.
 3. `alarmFlash.css`: migrate hex to `--io-alarm-*` tokens. (This affects theme support, not current dark-theme functionality, but the hardcoded values are wrong in principle and block HPHMI work.)
 4. Critical ARIA fixes: `RestorePreviewModal` + Console inline modals + Import/OpcSources dialogs. (Accessibility regression on destructive paths.)
 5. Replace 8 `window.confirm()` calls with `ConfirmDialog`.
---

Produce the review now.
```


## #TURN_END

_2026-05-27T05:55:22+00:00_

---


## #PROMPT

_2026-05-27T05:57:04+00:00_

```
~wrapup~
```


## #BASH
_Generate work-unit summary_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/generate-summary.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID" 2>&1
```


## #BASH
_Generate work-unit summary with env set_

```bash
export CLAUDE_PROJECT_DIR=/home/io/io-dev/io && CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/generate-summary.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID" 2>&1
```


## #BASH
_Run shallow review_

```bash
export CLAUDE_PROJECT_DIR=/home/io/io-dev/io && CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID" "shallow" 2>&1
```


## #BASH
_Update interim docs_

```bash
export CLAUDE_PROJECT_DIR=/home/io/io-dev/io && CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID" 2>&1
```


## #BASH
_Read summary and shallow review_

```bash
cat "/home/io/io-dev/io/.claude/summaries/2026-05-27_regression-statusbadge-hex-alpha
read-o_054757_summary.md" && echo "---REVIEW---" && cat "/home/io/io-dev/io/.claude/reviews/2026-05-27_regression-statusbadge-hex-alpha
read-o_054757_review_shallow_055514.md"
```


## #BASH
_List summary and review files_

```bash
ls /home/io/io-dev/io/.claude/summaries/ | tail -5 && ls /home/io/io-dev/io/.claude/reviews/ | tail -5
```


## #BASH
_Find summary file_

```bash
find /home/io/io-dev/io/.claude/summaries/ -name "*054757*" -o -name "*statusbadge*" 2>/dev/null
```


## #BASH
_Read summary file with literal newline in filename_

```bash
cat /home/io/io-dev/io/.claude/summaries/2026-05-27_regression-statusbadge-hex-alpha$'\n'read-o_054757_summary.md 2>/dev/null || ls -la "/home/io/io-dev/io/.claude/summaries/" | grep 054757
```


## #BASH
_Cat the newest summary file_

```bash
find /home/io/io-dev/io/.claude/summaries/ -newer /home/io/io-dev/io/.claude/summaries/read-onl_052806_summary.md | xargs cat 2>/dev/null
```


## #BASH
_Cat all summary files_

```bash
find /home/io/io-dev/io/.claude/summaries/ -type f | while IFS= read -r f; do echo "=== $f ==="; cat "$f"; done | tail -80
```


## #BASH
_Read summary file using Python to handle newline in filename_

```bash
python3 -c "
import os
d = '/home/io/io-dev/io/.claude/summaries'
for f in os.listdir(d):
    if '054757' in f:
        path = os.path.join(d, f)
        print(open(path).read())
"
```


## #BASH
_Read shallow review file_

```bash
python3 -c "
import os
d = '/home/io/io-dev/io/.claude/reviews'
for f in os.listdir(d):
    if '055514' in f:
        path = os.path.join(d, f)
        print(open(path).read())
"
```


## #TURN_END

_2026-05-27T05:57:05+00:00_

---


## #PROMPT

_2026-05-27T05:58:47+00:00_

```
git add -A
git commit -m "Fix StatusBadge hex-alpha concatenation — badge backgrounds now render"
```


## #BASH
_Check staged changes before committing_

```bash
git -C /home/io/io-dev/io status && git -C /home/io/io-dev/io diff --cached
```


## #BASH
_Stage the three changed files and commit_

```bash
git -C /home/io/io-dev/io add frontend/src/pages/settings/OpcSources.tsx ui-audit/02-comparison.md ui-audit/04-recommendations.md && git -C /home/io/io-dev/io commit -m "$(cat <<'EOF'
Fix StatusBadge hex-alpha concatenation — badge backgrounds now render

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```


## #TURN_END

_2026-05-27T05:58:47+00:00_

---

