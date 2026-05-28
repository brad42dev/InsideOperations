# Work Unit Log: workstream-3c-promote-fieldlabel

read-u

Started: 2026-05-28T03:42:33+00:00
Session: 4d24b7f0-5936-4429-8efb-be65444e5eb3

---


## #WRITE `/home/io/io-dev/io/frontend/src/shared/components/FieldLabel.tsx` (504 chars written)

_2026-05-28T03:43:57+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx` (79→140 chars)

_2026-05-28T03:44:00+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx` (363→1 chars)

_2026-05-28T03:44:05+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (83→144 chars)

_2026-05-28T03:44:12+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (421→155 chars)

_2026-05-28T03:44:21+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (667→452 chars)

_2026-05-28T03:44:26+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (442→136 chars)

_2026-05-28T03:44:31+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (587→344 chars)

_2026-05-28T03:44:36+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (449→163 chars)

_2026-05-28T03:44:40+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (448→162 chars)

_2026-05-28T03:44:44+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (18→40 chars)

_2026-05-28T03:46:13+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (256→1382 chars)

_2026-05-28T03:46:27+00:00_


## #PROMPT

_2026-05-28T03:46:33+00:00_

```
~initprompt~ workstream-3c-promote-FieldLabel

Read ui-audit/08-claim-b-plan.md section two for the component promotions plan, specifically the entry for FieldLabel. Read ui-audit/05-claim-c-deferral.md to confirm exclusions. Read ui-audit/08b-constants-checkin.md to confirm prior work is clear.

Goal: promote FieldLabel per the plan. Work in three steps: promote to shared location, set the API to the minimal surface specified in the plan, then migrate consumers.

Step one, promote. Move or copy the base implementation from the source-of-truth location specified in the plan to its new shared location. Use the rationale recorded in the plan for choosing the base.

Step two, set API. Adjust the API to match the plan's minimal surface. Document any behavior the base version had that is being dropped, and flag any consumer that depended on that behavior. If a consumer needed behavior beyond the minimal API, add the requirement to ui-audit/08-claim-b-plan.md as a note on this component's entry rather than expanding the API; the consumer can be handled as a deferred migration.

Step three, migrate consumers. For each consumer identified in the plan, the migration should be a substitution: import the new component, replace the call site, verify behavior matches. For any consumer that requires more than substitution-level refactoring, do not refactor in this prompt. Record it as deferred consumer migration in the plan.

If the promotion reveals that the base version is more entangled with its module than the plan anticipated, stop and ask. Do not power through an entangled promotion.

Do not promote any other components. Do not refactor unrelated code. Do not touch canvas-layer files.

Update ui-audit/08-claim-b-plan.md by marking FieldLabel as completed with date and listing migrated consumers and deferred consumers.

When done print: file paths modified, count of consumers migrated, count of consumers deferred with reasons, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the three plan files to understand the FieldLabel promotion scope.


## #ASSISTANT

Good. Now let me read the source implementation at `DesignerRightPanel.tsx:201–217` and the PaneConfigModal.


## #ASSISTANT

Let me read the full PaneConfigModal to find all label-like divs.


## #ASSISTANT

Let me read the rest of PaneConfigModal to see all labels.


## #ASSISTANT

I have the full picture. Let me verify the shared components directory exists, then check for any existing shared FieldLabel.


## #BASH
_List shared components and styles directories_

```bash
ls /home/io/io-dev/io/frontend/src/shared/components/ && echo "---" && ls /home/io/io-dev/io/frontend/src/shared/styles/
```


## #ASSISTANT

Let me check the imports at the top of DesignerRightPanel.tsx.


## #ASSISTANT

All clear. Now executing the three steps.

**Step 1: Create `shared/components/FieldLabel.tsx`**


## #ASSISTANT

**Step 2: Update `DesignerRightPanel.tsx`** — add import, remove local definition.


## #ASSISTANT

That diagnostic is pre-existing and unrelated. Continuing with step 2 — removing the local `FieldLabel` definition from `DesignerRightPanel.tsx`.


## #ASSISTANT

**Step 3: Migrate `PaneConfigModal.tsx`** — add import and replace 6 field label elements.


## #ASSISTANT

Now replacing all 6 field labels in PaneConfigModal. Doing them as individual edits since each has different context.


## #ASSISTANT

All edits done. Now running the build to verify no type errors.


## #BASH
_Build frontend to check for type errors_

```bash
cd /home/io/io-dev/io/frontend && pnpm build 2>&1 | tail -30
```


## #ASSISTANT

Build passes clean. Now updating the plan to mark FieldLabel complete.


## #ASSISTANT

Now append the completion note to the FieldLabel consumer table.


## #TURN_END

_2026-05-28T03:46:35+00:00_

---


## #PROMPT

_2026-05-28T03:53:02+00:00_

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
# Work Unit Log: workstream-3c-promote-fieldlabel

read-u

Started: 2026-05-28T03:42:33+00:00
Session: 4d24b7f0-5936-4429-8efb-be65444e5eb3

---


## #WRITE `/home/io/io-dev/io/frontend/src/shared/components/FieldLabel.tsx` (504 chars written)

_2026-05-28T03:43:57+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx` (79→140 chars)

_2026-05-28T03:44:00+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx` (363→1 chars)

_2026-05-28T03:44:05+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (83→144 chars)

_2026-05-28T03:44:12+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (421→155 chars)

_2026-05-28T03:44:21+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (667→452 chars)

_2026-05-28T03:44:26+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (442→136 chars)

_2026-05-28T03:44:31+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (587→344 chars)

_2026-05-28T03:44:36+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (449→163 chars)

_2026-05-28T03:44:40+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (448→162 chars)

_2026-05-28T03:44:44+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (18→40 chars)

_2026-05-28T03:46:13+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (256→1382 chars)

_2026-05-28T03:46:27+00:00_


## #PROMPT

_2026-05-28T03:46:33+00:00_

```
~initprompt~ workstream-3c-promote-FieldLabel

Read ui-audit/08-claim-b-plan.md section two for the component promotions plan, specifically the entry for FieldLabel. Read ui-audit/05-claim-c-deferral.md to confirm exclusions. Read ui-audit/08b-constants-checkin.md to confirm prior work is clear.

Goal: promote FieldLabel per the plan. Work in three steps: promote to shared location, set the API to the minimal surface specified in the plan, then migrate consumers.

Step one, promote. Move or copy the base implementation from the source-of-truth location specified in the plan to its new shared location. Use the rationale recorded in the plan for choosing the base.

Step two, set API. Adjust the API to match the plan's minimal surface. Document any behavior the base version had that is being dropped, and flag any consumer that depended on that behavior. If a consumer needed behavior beyond the minimal API, add the requirement to ui-audit/08-claim-b-plan.md as a note on this component's entry rather than expanding the API; the consumer can be handled as a deferred migration.

Step three, migrate consumers. For each consumer identified in the plan, the migration should be a substitution: import the new component, replace the call site, verify behavior matches. For any consumer that requires more than substitution-level refactoring, do not refactor in this prompt. Record it as deferred consumer migration in the plan.

If the promotion reveals that the base version is more entangled with its module than the plan anticipated, stop and ask. Do not power through an entangled promotion.

Do not promote any other components. Do not refactor unrelated code. Do not touch canvas-layer files.

Update ui-audit/08-claim-b-plan.md by marking FieldLabel as completed with date and listing migrated consumers and deferred consumers.

When done print: file paths modified, count of consumers migrated, count of consumers deferred with reasons, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the three plan files to understand the FieldLabel promotion scope.


## #ASSISTANT

Good. Now let me read the source implementation at `DesignerRightPanel.tsx:201–217` and the PaneConfigModal.


## #ASSISTANT

Let me read the full PaneConfigModal to find all label-like divs.


## #ASSISTANT

Let me read the rest of PaneConfigModal to see all labels.


## #ASSISTANT

I have the full picture. Let me verify the shared components directory exists, then check for any existing shared FieldLabel.


## #BASH
_List shared components and styles directories_

```bash
ls /home/io/io-dev/io/frontend/src/shared/components/ && echo "---" && ls /home/io/io-dev/io/frontend/src/shared/styles/
```


## #ASSISTANT

Let me check the imports at the top of DesignerRightPanel.tsx.


## #ASSISTANT

All clear. Now executing the three steps.

**Step 1: Create `shared/components/FieldLabel.tsx`**


## #ASSISTANT

**Step 2: Update `DesignerRightPanel.tsx`** — add import, remove local definition.


## #ASSISTANT

That diagnostic is pre-existing and unrelated. Continuing with step 2 — removing the local `FieldLabel` definition from `DesignerRightPanel.tsx`.


## #ASSISTANT

**Step 3: Migrate `PaneConfigModal.tsx`** — add import and replace 6 field label elements.


## #ASSISTANT

Now replacing all 6 field labels in PaneConfigModal. Doing them as individual edits since each has different context.


## #ASSISTANT

All edits done. Now running the build to verify no type errors.


## #BASH
_Build frontend to check for type errors_

```bash
cd /home/io/io-dev/io/frontend && pnpm build 2>&1 | tail -30
```


## #ASSISTANT

Build passes clean. Now updating the plan to mark FieldLabel complete.


## #ASSISTANT

Now append the completion note to the FieldLabel consumer table.


## #TURN_END

_2026-05-28T03:46:35+00:00_

---
---



DIFF OF CHANGES:
---
diff --git a/frontend/src/pages/console/PaneConfigModal.tsx b/frontend/src/pages/console/PaneConfigModal.tsx
index 52afd449..57205310 100644
--- a/frontend/src/pages/console/PaneConfigModal.tsx
+++ b/frontend/src/pages/console/PaneConfigModal.tsx
@@ -1,5 +1,6 @@
 import { useState } from "react";
 import * as Dialog from "@radix-ui/react-dialog";
+import FieldLabel from "../../shared/components/FieldLabel";
 import { useQuery } from "@tanstack/react-query";
 import { pointsApi } from "../../api/points";
 import type { PaneConfig, PaneType } from "./types";
@@ -252,17 +253,7 @@ export default function PaneConfigModal({
 
           {/* Type selector */}
           <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
-            <label
-              style={{
-                fontSize: 12,
-                fontWeight: 600,
-                color: "var(--io-text-muted)",
-                textTransform: "uppercase",
-                letterSpacing: "0.04em",
-              }}
-            >
-              Pane Type
-            </label>
+            <FieldLabel>Pane Type</FieldLabel>
             <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
               {PANE_TYPES.map((pt) => (
                 <button
@@ -293,18 +284,9 @@ export default function PaneConfigModal({
 
           {/* Title */}
           <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
-            <label
-              style={{
-                fontSize: 12,
-                fontWeight: 600,
-                color: "var(--io-text-muted)",
-                textTransform: "uppercase",
-                letterSpacing: "0.04em",
-              }}
-            >
-              Title (optional)
-            </label>
+            <FieldLabel htmlFor="pane-title">Title (optional)</FieldLabel>
             <input
+              id="pane-title"
               type="text"
               value={title}
               onChange={(e) => setTitle(e.target.value)}
@@ -326,17 +308,7 @@ export default function PaneConfigModal({
           {type === "trend" && (
             <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
               <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
-                <label
-                  style={{
-                    fontSize: 12,
-                    fontWeight: 600,
-                    color: "var(--io-text-muted)",
-                    textTransform: "uppercase",
-                    letterSpacing: "0.04em",
-                  }}
-                >
-                  Points (max 8)
-                </label>
+                <FieldLabel>Points (max 8)</FieldLabel>
                 <PointSearch
                   selected={trendPointIds}
                   onChange={setTrendPointIds}
@@ -344,18 +316,9 @@ export default function PaneConfigModal({
                 />
               </div>
               <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
-                <label
-                  style={{
-                    fontSize: 12,
-                    fontWeight: 600,
-                    color: "var(--io-text-muted)",
-                    textTransform: "uppercase",
-                    letterSpacing: "0.04em",
-                  }}
-                >
-                  Duration (minutes)
-                </label>
+                <FieldLabel htmlFor="trend-duration">Duration (minutes)</FieldLabel>
                 <select
+                  id="trend-duration"
                   value={trendDuration}
                   onChange={(e) => setTrendDuration(Number(e.target.value))}
                   style={{
@@ -382,17 +345,7 @@ export default function PaneConfigModal({
 
           {type === "point_table" && (
             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
-              <label
-                style={{
-                  fontSize: 12,
-                  fontWeight: 600,
-                  color: "var(--io-text-muted)",
-                  textTransform: "uppercase",
-                  letterSpacing: "0.04em",
-                }}
-              >
-                Points
-              </label>
+              <FieldLabel>Points</FieldLabel>
               <PointSearch
                 selected={tablePointIds}
                 onChange={setTablePointIds}
@@ -402,17 +355,7 @@ export default function PaneConfigModal({
 
           {type === "alarm_list" && (
             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
-              <label
-                style={{
-                  fontSize: 12,
-                  fontWeight: 600,
-                  color: "var(--io-text-muted)",
-                  textTransform: "uppercase",
-                  letterSpacing: "0.04em",
-                }}
-              >
-                Filter
-              </label>
+              <FieldLabel>Filter</FieldLabel>
               <div style={{ display: "flex", gap: 8 }}>
                 {(["all", "active", "unacknowledged"] as const).map((f) => (
                   <label
diff --git a/frontend/src/pages/designer/DesignerRightPanel.tsx b/frontend/src/pages/designer/DesignerRightPanel.tsx
index ef6ed123..b7bd16c8 100644
--- a/frontend/src/pages/designer/DesignerRightPanel.tsx
+++ b/frontend/src/pages/designer/DesignerRightPanel.tsx
@@ -68,6 +68,7 @@ import {
 } from "../../shared/graphics/commands";
 import { recenterArrayOnBindingChange } from "../../shared/graphics/anchorSlots";
 import ChartConfigPanel from "../../shared/components/charts/ChartConfigPanel";
+import FieldLabel from "../../shared/components/FieldLabel";
 import type { ChartConfig } from "../../shared/components/charts/chart-config-types";
 import type {
   SceneCommand,
@@ -198,23 +199,6 @@ function findParentSymbol(
 // Small helper components
 // ---------------------------------------------------------------------------
 
-function FieldLabel({ children }: { children: React.ReactNode }) {
-  return (
-    <label
-      style={{
-        display: "block",
-        fontSize: 10,
-        fontWeight: 600,
-        textTransform: "uppercase",
-        letterSpacing: "0.05em",
-        color: "var(--io-text-muted)",
-        marginBottom: 3,
-      }}
-    >
-      {children}
-    </label>
-  );
-}
 
 const inputStyle: React.CSSProperties = {
   width: "100%",
diff --git a/ui-audit/08-claim-b-plan.md b/ui-audit/08-claim-b-plan.md
index af43683b..90a35764 100644
--- a/ui-audit/08-claim-b-plan.md
+++ b/ui-audit/08-claim-b-plan.md
@@ -183,7 +183,7 @@ inputClassName = "io-input"  // pair with companion inputs.css
 
 ## Section 2 — Component Promotions Plan
 
-### 2.1 FieldLabel
+### 2.1 FieldLabel — **DONE 2026-05-28**
 
 #### Source-of-truth location
 
@@ -218,6 +218,14 @@ The only change from the source: `fontSize: 10` → `fontSize: 11` per the Cat 2
 
 **Risk items:** None for the DesignerRightPanel migration (mechanical import change). PaneConfigModal migration is light but requires verifying each `<div>` label is semantically equivalent to a `<label>` and has a corresponding input target for `htmlFor`.
 
+**Execution notes (2026-05-28):**
+- `frontend/src/shared/components/FieldLabel.tsx` created. API: `{ children, htmlFor? }`. `fontSize: 11` (was 10 in source).
+- `DesignerRightPanel.tsx`: local `FieldLabel` function removed; import from shared added. Zero call-site changes — all 14+ usages inherited automatically.
+- `PaneConfigModal.tsx`: 6 field labels migrated. Labels were already `<label>` elements (plan said `<div>` — minor discrepancy, semantics were already correct). `htmlFor` added for "Title (optional)" → `id="pane-title"` and "Duration (minutes)" → `id="trend-duration"`. "Pane Type", "Points (max 8)", "Points", "Filter" have no single associated input; migrated without `htmlFor`. Visual change: `fontSize 12 → 11`, `letterSpacing 0.04em → 0.05em` (convergence target per Cat 2 table).
+- **Consumers migrated:** 2 (`DesignerRightPanel.tsx`, `PaneConfigModal.tsx`)
+- **Consumers deferred:** Settings pages using `labelStyle` (12px/500/no-uppercase — intentionally distinct, not to be migrated per plan). No deferred consumers beyond what the plan already documented.
+- `pnpm build` passed with no type errors.
+
 ---
 
 ### 2.2 StatusBadge
---

FULL FILE CONTENTS (for surrounding-code analysis):
---

--- File: /home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx ---
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import FieldLabel from "../../shared/components/FieldLabel";
import { useQuery } from "@tanstack/react-query";
import { pointsApi } from "../../api/points";
import type { PaneConfig, PaneType } from "./types";

interface PaneConfigModalProps {
  pane: PaneConfig;
  onSave: (updated: PaneConfig) => void;
  onClose: () => void;
}

const PANE_TYPES: { value: PaneType; label: string; description: string }[] = [
  { value: "trend", label: "Trend", description: "Real-time trend chart" },
  {
    value: "point_table",
    label: "Point Table",
    description: "Live point value table",
  },
  {
    value: "alarm_list",
    label: "Alarm List",
    description: "Active alarm list",
  },
  { value: "blank", label: "Blank", description: "Empty pane" },
];

// ---------------------------------------------------------------------------
// Point search section
// ---------------------------------------------------------------------------

function PointSearch({
  selected,
  onChange,
  maxSelect,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  maxSelect?: number;
}) {
  const [query, setQuery] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["points-search", query],
    queryFn: async () => {
      const result = await pointsApi.list({
        search: query || undefined,
        limit: 50,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data.data;
    },
    staleTime: 15_000,
  });

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      if (maxSelect && selected.length >= maxSelect) return;
      onChange([...selected, id]);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        type="text"
        placeholder="Search points by name or tag…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: 6,
          padding: "7px 10px",
          fontSize: 13,
          color: "var(--io-text-primary)",
          outline: "none",
        }}
      />

      {maxSelect && (
        <div style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
          {selected.length} / {maxSelect} selected
        </div>
      )}

      {isFetching && (
        <div style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
          Searching…
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          maxHeight: 200,
          overflowY: "auto",
        }}
      >
        {data?.map((pt) => {
          const isSelected = selected.includes(pt.id);
          const isDisabled =
            !isSelected && maxSelect != null && selected.length >= maxSelect;
          return (
            <label
              key={pt.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                background: isSelected
                  ? "var(--io-accent-subtle, rgba(74,158,255,0.1))"
                  : "var(--io-surface-secondary)",
                border: `1px solid ${isSelected ? "var(--io-accent)" : "var(--io-border)"}`,
                borderRadius: 6,
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.5 : 1,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => toggle(pt.id)}
                style={{ accentColor: "var(--io-accent)" }}
              />
              <span style={{ flex: 1, overflow: "hidden" }}>
                <span
                  style={{ fontWeight: 500, color: "var(--io-text-primary)" }}
                >
                  {pt.display_name ?? pt.tagname}
                </span>
                <span
                  style={{
                    color: "var(--io-text-muted)",
                    marginLeft: 6,
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                >
                  {pt.tagname}
                </span>
              </span>
              {pt.unit && (
                <span style={{ color: "var(--io-text-muted)", fontSize: 11 }}>
                  {pt.unit}
                </span>
              )}
            </label>
          );
        })}
        {data?.length === 0 && !isFetching && (
          <div
            style={{
              fontSize: 12,
              color: "var(--io-text-muted)",
              textAlign: "center",
              padding: 12,
            }}
          >
            No points found
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaneConfigModal
// ---------------------------------------------------------------------------

export default function PaneConfigModal({
  pane,
  onSave,
  onClose,
}: PaneConfigModalProps) {
  const [type, setType] = useState<PaneType>(pane.type);
  const [title, setTitle] = useState(pane.title ?? "");
  const [trendPointIds, setTrendPointIds] = useState<string[]>(
    pane.trendPointIds ?? [],
  );
  const [trendDuration, setTrendDuration] = useState(pane.trendDuration ?? 60);
  const [tablePointIds, setTablePointIds] = useState<string[]>(
    pane.tablePointIds ?? [],
  );
  const [alarmFilter, setAlarmFilter] = useState<
    "all" | "active" | "unacknowledged"
  >(pane.alarmFilter ?? "all");

  const handleSave = () => {
    const updated: PaneConfig = {
      id: pane.id,
      type,
      title: title.trim() || undefined,
      trendPointIds: type === "trend" ? trendPointIds : undefined,
      trendDuration: type === "trend" ? trendDuration : undefined,
      tablePointIds: type === "point_table" ? tablePointIds : undefined,
      alarmFilter: type === "alarm_list" ? alarmFilter : undefined,
    };
    onSave(updated);
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1001,
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: 8,
            padding: 24,
            width: 480,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "calc(100vh - 64px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <Dialog.Title
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Configure Pane
          </Dialog.Title>

          {/* Type selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FieldLabel>Pane Type</FieldLabel>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PANE_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => setType(pt.value)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: `1px solid ${type === pt.value ? "var(--io-accent)" : "var(--io-border)"}`,
                    background:
                      type === pt.value
                        ? "var(--io-accent-subtle, rgba(74,158,255,0.1))"
                        : "var(--io-surface-secondary)",
                    color:
                      type === pt.value
                        ? "var(--io-accent)"
                        : "var(--io-text-primary)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: type === pt.value ? 600 : 400,
                  }}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel htmlFor="pane-title">Title (optional)</FieldLabel>
            <input
              id="pane-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`e.g. ${PANE_TYPES.find((p) => p.value === type)?.label ?? type}`}
              style={{
                background: "var(--io-surface-secondary)",
                border: "1px solid var(--io-border)",
                borderRadius: 6,
                padding: "7px 10px",
                fontSize: 13,
                color: "var(--io-text-primary)",
                outline: "none",
              }}
            />
          </div>

          {/* Type-specific config */}

          {type === "trend" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <FieldLabel>Points (max 8)</FieldLabel>
                <PointSearch
                  selected={trendPointIds}
                  onChange={setTrendPointIds}
                  maxSelect={8}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel htmlFor="trend-duration">Duration (minutes)</FieldLabel>
                <select
                  id="trend-duration"
                  value={trendDuration}
                  onChange={(e) => setTrendDuration(Number(e.target.value))}
                  style={{
                    background: "var(--io-surface-secondary)",
                    border: "1px solid var(--io-border)",
                    borderRadius: 6,
                    padding: "7px 10px",
                    fontSize: 13,
                    color: "var(--io-text-primary)",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={240}>4 hours</option>
                  <option value={480}>8 hours</option>
                </select>
              </div>
            </div>
          )}

          {type === "point_table" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <FieldLabel>Points</FieldLabel>
              <PointSearch
                selected={tablePointIds}
                onChange={setTablePointIds}
              />
            </div>
          )}

          {type === "alarm_list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <FieldLabel>Filter</FieldLabel>
              <div style={{ display: "flex", gap: 8 }}>
                {(["all", "active", "unacknowledged"] as const).map((f) => (
                  <label
                    key={f}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="radio"
                      name="alarm-filter"
                      value={f}
                      checked={alarmFilter === f}
                      onChange={() => setAlarmFilter(f)}
                      style={{ accentColor: "var(--io-accent)" }}
                    />
                    <span
                      style={{
                        color: "var(--io-text-primary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {f === "unacknowledged"
                        ? "Unacknowledged"
                        : f.charAt(0).toUpperCase() + f.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 4,
            }}
          >
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: 6,
                  padding: "7px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--io-text-primary)",
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              style={{
                background: "var(--io-accent)",
                border: "none",
                borderRadius: 6,
                padding: "7px 16px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
              }}
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

--- File: /home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx ---
/**
 * DesignerRightPanel.tsx
 *
 * Context-sensitive property inspector panel.
 * Uses concern-based tabs (Layout / Style / Data / Shape / Content / Doc)
 * that appear conditionally based on the selected node type.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  useSceneStore,
  useHistoryStore,
  useLibraryStore,
  useUiStore,
} from "../../store/designer";
import type { NodeId } from "../../shared/types/graphics";
import type {
  SceneNode,
  SymbolInstance,
  TextBlock,
  Primitive,
  Pipe,
  DisplayElement,
  LayerDefinition,
  GraphicDocument,
  NavigationLink,
  WidgetNode,
  DisplayElementType,
  DisplayElementConfig,
  TextReadoutConfig,
  TextReadoutArrayConfig,
  AnalogBarConfig,
  FillGaugeConfig,
  SparklineConfig,
  DigitalStatusConfig,
  PointNameLabelConfig,
  DisplayElementFontFamily,
  DisplayElementBinding,
  ImageNode,
  EmbeddedSvgNode,
  Group,
  Annotation,
  Stencil,
  Transform,
} from "../../shared/types/graphics";
import {
  ChangePropertyCommand,
  ChangeTextCommand,
  ChangeBindingCommand,
  ChangeStyleCommand,
  ChangeLayerPropertyCommand,
  ChangeNavigationLinkCommand,
  ChangeShapeVariantCommand,
  ChangeShapeConfigurationCommand,
  ChangeDisplayElementConfigCommand,
  ChangeDisplayElementTypeCommand,
  AddDisplayElementCommand,
  RemoveDisplayElementCommand,
  HideDisplayElementCommand,
  AlignNodesCommand,
  DistributeNodesCommand,
  DeleteNodesCommand,
  GroupNodesCommand,
  ReorderNodeCommand,
  ChangeWidgetConfigCommand,
  CompoundCommand,
  MoveNodesCommand,
} from "../../shared/graphics/commands";
import { recenterArrayOnBindingChange } from "../../shared/graphics/anchorSlots";
import ChartConfigPanel from "../../shared/components/charts/ChartConfigPanel";
import FieldLabel from "../../shared/components/FieldLabel";
import type { ChartConfig } from "../../shared/components/charts/chart-config-types";
import type {
  SceneCommand,
  AlignmentType,
} from "../../shared/graphics/commands";
import type { ShapeEntry, ValueAnchor } from "../../store/designer";
import { PIPE_SERVICE_COLORS } from "../../shared/types/graphics";
import { pointsApi } from "../../api/points";

// ---------------------------------------------------------------------------
// PointResolutionIndicator — shows a yellow dot when a pointId is unresolved
// ---------------------------------------------------------------------------

function PointResolutionIndicator({
  pointId,
}: {
  pointId: string | undefined;
}) {
  const [status, setStatus] = useState<
    "idle" | "checking" | "found" | "notfound"
  >("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pointId) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const result = await pointsApi
        .list({ search: pointId, limit: 1 })
        .catch(() => null);
      if (!result?.success) {
        setStatus("idle");
        return;
      }
      const exact = result.data.data.find(
        (p) => p.id === pointId || p.tagname === pointId,
      );
      setStatus(exact ? "found" : "notfound");
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pointId]);

  if (status === "idle" || !pointId) return null;
  if (status === "checking")
    return (
      <span
        title="Checking…"
        style={{ fontSize: 10, color: "var(--io-text-muted)", marginLeft: 4 }}
      >
        …
      </span>
    );
  if (status === "found")
    return (
      <span
        title="Tag resolved"
        style={{ fontSize: 10, color: "#22c55e", marginLeft: 4 }}
      >
        ✓
      </span>
    );
  return (
    <span
      title="Tag not found — bindings with unresolved tags display N/C at runtime"
      style={{ fontSize: 10, color: "#facc15", marginLeft: 4 }}
    >
      ⚠ not found
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerRightPanelProps {
  collapsed: boolean;
  width: number;
}

// ---------------------------------------------------------------------------
// Find node by ID anywhere in the doc tree
// ---------------------------------------------------------------------------

function findNodeById(doc: GraphicDocument, id: NodeId): SceneNode | null {
  function search(nodes: SceneNode[]): SceneNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if ("children" in n && Array.isArray(n.children)) {
        const found = search(n.children as SceneNode[]);
        if (found) return found;
      }
    }
    return null;
  }
  return search(doc.children);
}

function findParentSymbol(
  doc: GraphicDocument,
  childId: NodeId,
): SymbolInstance | null {
  function search(nodes: SceneNode[]): SymbolInstance | null {
    for (const n of nodes) {
      if (n.type === "symbol_instance") {
        const si = n as SymbolInstance;
        for (const child of si.children) {
          if (child.id === childId) return si;
        }
      }
      if ("children" in n && Array.isArray(n.children)) {
        const found = search(n.children as SceneNode[]);
        if (found) return found;
      }
    }
    return null;
  }
  return search(doc.children as SceneNode[]);
}

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------


const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "4px 7px",
  background: "var(--io-surface)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-text-primary)",
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const safeValue =
    value === undefined || value === null || isNaN(value as number)
      ? ""
      : value;
  return (
    <input
      type="number"
      value={safeValue}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(v);
      }}
      style={inputStyle}
    />
  );
}

// ISA-101 / ISA-18.2 reserved colors — never use for decorative fills.
// These map directly to alarm priority, operational state, and connection indicators.
const RESERVED_COLOR_SET = new Set([
  "#ef4444",
  "#b91c1c", // P1 Urgent
  "#f97316",
  "#ea580c", // P2 High
  "#eab308",
  "#c8a800",
  "#facc15", // P3 Low + yellow adjacents
  "#d946ef",
  "#c026d3", // Shelved / Fault
  "#60a5fa",
  "#2563eb", // Custom alarm
  "#2dd4bf",
  "#0d9488",
  "#14b8a6", // Teal — connection points only
  "#059669",
  "#047857", // Running/Open operational state
  "#f87171", // near-alarm red
]);

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value);
  const isReserved = isHex && RESERVED_COLOR_SET.has(value.toLowerCase());
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <label
          style={{
            position: "relative",
            flexShrink: 0,
            cursor: "pointer",
            display: "block",
            width: 28,
            height: 28,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: value,
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
            }}
          />
          <input
            type="color"
            value={isHex ? value : "#ffffff"}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              cursor: "pointer",
              width: "100%",
              height: "100%",
            }}
          />
        </label>
        {isHex ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              fontSize: 10,
              color: "var(--io-text-muted)",
              fontFamily: "monospace",
              padding: "0 4px",
            }}
          >
            Theme default
          </span>
        )}
      </div>
      {isReserved && (
        <span style={{ fontSize: 9, color: "#f97316" }}>
          Reserved for alarm/status — choose another color
        </span>
      )}
    </div>
  );
}

// ISA-101 compliant text color presets — only tokens from the display element spec.
// Teal, yellow, red, and orange are excluded: reserved for alarm priority indicators.
const TEXT_COLOR_PRESETS = [
  { label: "White", value: "var(--io-text-primary)" },
  { label: "Gray", value: "var(--io-text-secondary)" },
  { label: "Muted", value: "var(--io-text-muted)" },
];

/**
 * Dropdown color selector for text/label colors.
 * Only exposes the three ISA-101 compliant text tokens — no custom hex picker.
 * Alarm-adjacent colors (red, orange, yellow, teal) are intentionally excluded.
 */
function ThemedColorSelect({
  value,
  defaultValue,
  onChange,
}: {
  value: string | undefined;
  defaultValue: string;
  onChange: (v: string) => void;
}) {
  const isPreset = TEXT_COLOR_PRESETS.some((p) => p.value === value);
  const selectValue = isPreset ? value! : "__default__";
  const swatchColor = isPreset ? value! : defaultValue;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <div
        style={{
          width: 20,
          height: 20,
          background: swatchColor,
          border: "1px solid var(--io-border)",
          borderRadius: 3,
          flexShrink: 0,
        }}
      />
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "__default__" ? defaultValue : v);
        }}
        style={{ ...inputStyle, flex: 1 }}
      >
        <option value="__default__">Default</option>
        {TEXT_COLOR_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...inputStyle,
        cursor: "pointer",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// NavigationLinkEditor
// ---------------------------------------------------------------------------

function NavigationLinkEditor({
  nodeId,
  link,
  prevLink,
  executeCmd,
}: {
  nodeId: NodeId;
  link: NavigationLink | undefined;
  prevLink: NavigationLink | undefined;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasLink = !!link?.targetGraphicId || !!link?.targetUrl;

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          color: hasLink ? "var(--io-accent)" : "var(--io-text-secondary)",
          fontSize: 11,
          padding: "4px 8px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span>Navigation Link {hasLink ? "(set)" : "(none)"}</span>
        <span style={{ fontSize: 9 }}>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div
          style={{
            marginTop: 6,
            padding: 8,
            background: "var(--io-surface-elevated)",
            borderRadius: "var(--io-radius)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div>
            <FieldLabel>Target Graphic ID</FieldLabel>
            <input
              type="text"
              defaultValue={link?.targetGraphicId ?? ""}
              onBlur={(e) => {
                const val = e.target.value.trim();
                const newLink = {
                  ...link,
                  targetGraphicId: val || undefined,
                  targetUrl: undefined,
                };
                executeCmd(
                  new ChangeNavigationLinkCommand(nodeId, newLink, prevLink),
                );
              }}
              style={inputStyle}
              placeholder="graphic-uuid"
            />
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--io-text-muted)",
              textAlign: "center",
            }}
          >
            — or —
          </div>
          <div>
            <FieldLabel>External URL</FieldLabel>
            <input
              type="text"
              defaultValue={link?.targetUrl ?? ""}
              onBlur={(e) => {
                const val = e.target.value.trim();
                const newLink = {
                  ...link,
                  targetUrl: val || undefined,
                  targetGraphicId: undefined,
                };
                executeCmd(
                  new ChangeNavigationLinkCommand(nodeId, newLink, prevLink),
                );
              }}
              style={inputStyle}
              placeholder="https://…"
            />
          </div>
          {hasLink && (
            <button
              onClick={() =>
                executeCmd(
                  new ChangeNavigationLinkCommand(nodeId, undefined, prevLink),
                )
              }
              style={{
                fontSize: 11,
                color: "var(--io-text-muted)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                padding: 0,
              }}
            >
              Clear link
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook: execute + push to history
// ---------------------------------------------------------------------------

function useExecuteCmd() {
  const doc = useSceneStore((s) => s.doc);
  const execute = useSceneStore((s) => s.execute);
  const push = useHistoryStore((s) => s.push);

  return useCallback(
    (cmd: SceneCommand) => {
      if (!doc) return;
      const before = doc;
      execute(cmd);
      push(cmd, before);
    },
    [doc, execute, push],
  );
}

// ---------------------------------------------------------------------------
// Document properties panel
// ---------------------------------------------------------------------------

function DocPropertiesPanel({ doc }: { doc: GraphicDocument }) {
  const executeCmd = useExecuteCmd();

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Canvas Width">
        <NumberInput
          value={doc.canvas.width}
          min={100}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                doc.id,
                "canvas",
                { ...doc.canvas, width: v },
                doc.canvas,
              ),
            )
          }
        />
      </Field>
      <Field label="Canvas Height">
        <NumberInput
          value={doc.canvas.height}
          min={100}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                doc.id,
                "canvas",
                { ...doc.canvas, height: v },
                doc.canvas,
              ),
            )
          }
        />
      </Field>
      <Field label="Background Color">
        <ColorInput
          value={doc.canvas.backgroundColor}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                doc.id,
                "canvas",
                { ...doc.canvas, backgroundColor: v },
                doc.canvas,
              ),
            )
          }
        />
      </Field>
      <Field label="Grid Size">
        <NumberInput
          value={doc.metadata.gridSize}
          min={1}
          max={128}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                doc.id,
                "metadata",
                { ...doc.metadata, gridSize: v },
                doc.metadata,
              ),
            )
          }
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransformSection — universal layout tab for all nodes
// ---------------------------------------------------------------------------

function TransformSection({
  node,
  doc,
  executeCmd,
  showRotation = true,
}: {
  node: SceneNode;
  doc: GraphicDocument | null;
  executeCmd: (cmd: SceneCommand) => void;
  showRotation?: boolean;
}) {
  const t = node.transform;
  const pos = t.position;
  const scale = t.scale ?? { x: 1, y: 1 };
  const mirror = t.mirror ?? "none";

  function setTransform(patch: Partial<Transform>) {
    executeCmd(
      new ChangePropertyCommand(node.id, "transform", { ...t, ...patch }, t),
    );
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <Field label="X">
          <NumberInput
            value={Math.round(pos.x)}
            onChange={(v) => setTransform({ position: { ...pos, x: v } })}
          />
        </Field>
        <Field label="Y">
          <NumberInput
            value={Math.round(pos.y)}
            onChange={(v) => setTransform({ position: { ...pos, y: v } })}
          />
        </Field>
        {showRotation && (
          <Field label="Rotation °">
            <NumberInput
              value={Math.round(t.rotation)}
              min={-360}
              max={360}
              onChange={(v) => setTransform({ rotation: v })}
            />
          </Field>
        )}
        <Field label="Opacity %">
          <NumberInput
            value={Math.round(node.opacity * 100)}
            min={0}
            max={100}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "opacity",
                  v / 100,
                  node.opacity,
                ),
              )
            }
          />
        </Field>
        <Field label="Scale X %">
          <NumberInput
            value={Math.round(scale.x * 100)}
            min={1}
            max={2000}
            onChange={(v) => setTransform({ scale: { ...scale, x: v / 100 } })}
          />
        </Field>
        <Field label="Scale Y %">
          <NumberInput
            value={Math.round(scale.y * 100)}
            min={1}
            max={2000}
            onChange={(v) => setTransform({ scale: { ...scale, y: v / 100 } })}
          />
        </Field>
      </div>

      <Field label="Mirror">
        <SelectInput
          value={mirror}
          onChange={(v) => setTransform({ mirror: v as Transform["mirror"] })}
          options={[
            { value: "none", label: "None" },
            { value: "horizontal", label: "Horizontal" },
            { value: "vertical", label: "Vertical" },
            { value: "both", label: "Both" },
          ]}
        />
      </Field>

      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            cursor: "pointer",
            color: "var(--io-text-secondary)",
          }}
        >
          <input
            type="checkbox"
            checked={node.visible}
            onChange={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "visible",
                  e.target.checked,
                  node.visible,
                ),
              )
            }
            style={{ cursor: "pointer" }}
          />
          Visible
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            cursor: "pointer",
            color: "var(--io-text-secondary)",
          }}
        >
          <input
            type="checkbox"
            checked={node.locked}
            onChange={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "locked",
                  e.target.checked,
                  node.locked,
                ),
              )
            }
            style={{ cursor: "pointer" }}
          />
          Locked
        </label>
      </div>

      {doc && (
        <Field label="Layer">
          <SelectInput
            value={node.layerId ?? ""}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "layerId",
                  v || undefined,
                  node.layerId,
                ),
              )
            }
            options={[
              { value: "", label: "— None —" },
              ...doc.layers.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
        </Field>
      )}

      <NavigationLinkEditor
        nodeId={node.id}
        link={node.navigationLink}
        prevLink={node.navigationLink}
        executeCmd={executeCmd}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Primitive geometry size fields (rect/circle/ellipse)
// ---------------------------------------------------------------------------

function PrimitiveGeometrySection({
  node,
  executeCmd,
}: {
  node: Primitive;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const geo = node.geometry;
  if (geo.type === "rect") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Field label="Width">
          <NumberInput
            value={geo.width}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, width: v },
                  geo,
                ),
              )
            }
          />
        </Field>
        <Field label="Height">
          <NumberInput
            value={geo.height}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, height: v },
                  geo,
                ),
              )
            }
          />
        </Field>
        <Field label="Corner Radius">
          <NumberInput
            value={geo.rx ?? 0}
            min={0}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, rx: v, ry: v },
                  geo,
                ),
              )
            }
          />
        </Field>
      </div>
    );
  }
  if (geo.type === "circle") {
    return (
      <Field label="Radius">
        <NumberInput
          value={geo.r}
          min={1}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "geometry",
                { ...geo, r: v },
                geo,
              ),
            )
          }
        />
      </Field>
    );
  }
  if (geo.type === "ellipse") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Field label="Radius X">
          <NumberInput
            value={geo.rx}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, rx: v },
                  geo,
                ),
              )
            }
          />
        </Field>
        <Field label="Radius Y">
          <NumberInput
            value={geo.ry}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, ry: v },
                  geo,
                ),
              )
            }
          />
        </Field>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Primitive style section (fill + stroke)
// ---------------------------------------------------------------------------

function PrimitiveStyleSection({
  node,
  executeCmd,
}: {
  node: Primitive;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const style = node.style;

  return (
    <>
      <Field label="Fill">
        <ColorInput
          value={style.fill === "none" ? "#000000" : style.fill}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(node.id, { ...style, fill: v }, style),
            )
          }
        />
      </Field>
      <Field label="Fill Opacity %">
        <NumberInput
          value={Math.round(style.fillOpacity * 100)}
          min={0}
          max={100}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                { ...style, fillOpacity: v / 100 },
                style,
              ),
            )
          }
        />
      </Field>
      <Field label="Stroke">
        <ColorInput
          value={style.stroke === "none" ? "#000000" : style.stroke}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(node.id, { ...style, stroke: v }, style),
            )
          }
        />
      </Field>
      <Field label="Stroke Width">
        <NumberInput
          value={style.strokeWidth}
          min={0}
          step={0.5}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                { ...style, strokeWidth: v },
                style,
              ),
            )
          }
        />
      </Field>
      <Field label="Stroke Dash">
        <SelectInput
          value={style.strokeDasharray ?? ""}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                { ...style, strokeDasharray: v || undefined },
                style,
              ),
            )
          }
          options={[
            { value: "", label: "Solid" },
            { value: "4 2", label: "Dashed" },
            { value: "2 2", label: "Dotted" },
            { value: "8 4 2 4", label: "Dash-Dot" },
          ]}
        />
      </Field>
      <Field label="Line Cap">
        <SelectInput
          value={style.strokeLinecap ?? "butt"}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                {
                  ...style,
                  strokeLinecap: v as "butt" | "round" | "square",
                },
                style,
              ),
            )
          }
          options={[
            { value: "butt", label: "Butt" },
            { value: "round", label: "Round" },
            { value: "square", label: "Square" },
          ]}
        />
      </Field>
      <Field label="Line Join">
        <SelectInput
          value={style.strokeLinejoin ?? "miter"}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                {
                  ...style,
                  strokeLinejoin: v as "miter" | "round" | "bevel",
                },
                style,
              ),
            )
          }
          options={[
            { value: "miter", label: "Miter" },
            { value: "round", label: "Round" },
            { value: "bevel", label: "Bevel" },
          ]}
        />
      </Field>
    </>
  );
}

// ---------------------------------------------------------------------------
// TextBlock style section (font + color + background)
// ---------------------------------------------------------------------------

function TextBlockStyleSection({
  node,
  executeCmd,
}: {
  node: TextBlock;
  executeCmd: (cmd: SceneComma

--- File: /home/io/io-dev/io/frontend/src/shared/components/FieldLabel.tsx ---
import React from "react";

interface FieldLabelProps {
  children: React.ReactNode;
  htmlFor?: string;
}

export default function FieldLabel({ children, htmlFor }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--io-text-muted)",
        marginBottom: 3,
      }}
    >
      {children}
    </label>
  );
}

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

### 2.1 FieldLabel — **DONE 2026-05-28**

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

**Execution notes (2026-05-28):**
- `frontend/src/shared/components/FieldLabel.tsx` created. API: `{ children, htmlFor? }`. `fontSize: 11` (was 10 in source).
- `DesignerRightPanel.tsx`: local `FieldLabel` function removed; import from shared added. Zero call-site changes — all 14+ usages inherited automatically.
- `PaneConfigModal.tsx`: 6 field labels migrated. Labels were already `<label>` elements (plan said `<div>` — minor discrepancy, semantics were already correct). `htmlFor` added for "Title (optional)" → `id="pane-title"` and "Duration (minutes)" → `id="trend-duration"`. "Pane Type", "Points (max 8)", "Points", "Filter" have no single associated input; migrated without `htmlFor`. Visual change: `fontSize 12 → 11`, `letterSpacing 0.04em → 0.05em` (convergence target per Cat 2 table).
- **Consumers migrated:** 2 (`DesignerRightPanel.tsx`, `PaneConfigModal.tsx`)
- **Consumers deferred:** Settings pages using `labelStyle` (12px/500/no-uppercase — intentionally distinct, not to be migrated per plan). No deferred consumers beyond what the plan already documented.
- `pnpm build` passed with no type errors.

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

### Consumer migration (deferred unless p

---

Produce the review now.
```


## #TURN_END

_2026-05-28T03:53:02+00:00_

---


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx` (203→202 chars)

_2026-05-28T03:53:14+00:00_


## #PROMPT

_2026-05-28T03:53:21+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
bash /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #ASSISTANT

Clean review — no blocking concerns. One cosmetic fix: the blank line left behind after removing the FieldLabel function. Let me check and tidy it.


## #TURN_END

_2026-05-28T03:53:22+00:00_

---


## #PROMPT

_2026-05-28T03:54:58+00:00_

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
# Work Unit Log: workstream-3c-promote-fieldlabel

read-u

Started: 2026-05-28T03:42:33+00:00
Session: 4d24b7f0-5936-4429-8efb-be65444e5eb3

---


## #WRITE `/home/io/io-dev/io/frontend/src/shared/components/FieldLabel.tsx` (504 chars written)

_2026-05-28T03:43:57+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx` (79→140 chars)

_2026-05-28T03:44:00+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx` (363→1 chars)

_2026-05-28T03:44:05+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (83→144 chars)

_2026-05-28T03:44:12+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (421→155 chars)

_2026-05-28T03:44:21+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (667→452 chars)

_2026-05-28T03:44:26+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (442→136 chars)

_2026-05-28T03:44:31+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (587→344 chars)

_2026-05-28T03:44:36+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (449→163 chars)

_2026-05-28T03:44:40+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (448→162 chars)

_2026-05-28T03:44:44+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (18→40 chars)

_2026-05-28T03:46:13+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (256→1382 chars)

_2026-05-28T03:46:27+00:00_


## #PROMPT

_2026-05-28T03:46:33+00:00_

```
~initprompt~ workstream-3c-promote-FieldLabel

Read ui-audit/08-claim-b-plan.md section two for the component promotions plan, specifically the entry for FieldLabel. Read ui-audit/05-claim-c-deferral.md to confirm exclusions. Read ui-audit/08b-constants-checkin.md to confirm prior work is clear.

Goal: promote FieldLabel per the plan. Work in three steps: promote to shared location, set the API to the minimal surface specified in the plan, then migrate consumers.

Step one, promote. Move or copy the base implementation from the source-of-truth location specified in the plan to its new shared location. Use the rationale recorded in the plan for choosing the base.

Step two, set API. Adjust the API to match the plan's minimal surface. Document any behavior the base version had that is being dropped, and flag any consumer that depended on that behavior. If a consumer needed behavior beyond the minimal API, add the requirement to ui-audit/08-claim-b-plan.md as a note on this component's entry rather than expanding the API; the consumer can be handled as a deferred migration.

Step three, migrate consumers. For each consumer identified in the plan, the migration should be a substitution: import the new component, replace the call site, verify behavior matches. For any consumer that requires more than substitution-level refactoring, do not refactor in this prompt. Record it as deferred consumer migration in the plan.

If the promotion reveals that the base version is more entangled with its module than the plan anticipated, stop and ask. Do not power through an entangled promotion.

Do not promote any other components. Do not refactor unrelated code. Do not touch canvas-layer files.

Update ui-audit/08-claim-b-plan.md by marking FieldLabel as completed with date and listing migrated consumers and deferred consumers.

When done print: file paths modified, count of consumers migrated, count of consumers deferred with reasons, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the three plan files to understand the FieldLabel promotion scope.


## #ASSISTANT

Good. Now let me read the source implementation at `DesignerRightPanel.tsx:201–217` and the PaneConfigModal.


## #ASSISTANT

Let me read the full PaneConfigModal to find all label-like divs.


## #ASSISTANT

Let me read the rest of PaneConfigModal to see all labels.


## #ASSISTANT

I have the full picture. Let me verify the shared components directory exists, then check for any existing shared FieldLabel.


## #BASH
_List shared components and styles directories_

```bash
ls /home/io/io-dev/io/frontend/src/shared/components/ && echo "---" && ls /home/io/io-dev/io/frontend/src/shared/styles/
```


## #ASSISTANT

Let me check the imports at the top of DesignerRightPanel.tsx.


## #ASSISTANT

All clear. Now executing the three steps.

**Step 1: Create `shared/components/FieldLabel.tsx`**


## #ASSISTANT

**Step 2: Update `DesignerRightPanel.tsx`** — add import, remove local definition.


## #ASSISTANT

That diagnostic is pre-existing and unrelated. Continuing with step 2 — removing the local `FieldLabel` definition from `DesignerRightPanel.tsx`.


## #ASSISTANT

**Step 3: Migrate `PaneConfigModal.tsx`** — add import and replace 6 field label elements.


## #ASSISTANT

Now replacing all 6 field labels in PaneConfigModal. Doing them as individual edits since each has different context.


## #ASSISTANT

All edits done. Now running the build to verify no type errors.


## #BASH
_Build frontend to check for type errors_

```bash
cd /home/io/io-dev/io/frontend && pnpm build 2>&1 | tail -30
```


## #ASSISTANT

Build passes clean. Now updating the plan to mark FieldLabel complete.


## #ASSISTANT

Now append the completion note to the FieldLabel consumer table.


## #TURN_END

_2026-05-28T03:46:35+00:00_

---


## #PROMPT

_2026-05-28T03:53:02+00:00_

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
# Work Unit Log: workstream-3c-promote-fieldlabel

read-u

Started: 2026-05-28T03:42:33+00:00
Session: 4d24b7f0-5936-4429-8efb-be65444e5eb3

---


## #WRITE `/home/io/io-dev/io/frontend/src/shared/components/FieldLabel.tsx` (504 chars written)

_2026-05-28T03:43:57+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx` (79→140 chars)

_2026-05-28T03:44:00+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx` (363→1 chars)

_2026-05-28T03:44:05+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (83→144 chars)

_2026-05-28T03:44:12+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (421→155 chars)

_2026-05-28T03:44:21+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (667→452 chars)

_2026-05-28T03:44:26+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (442→136 chars)

_2026-05-28T03:44:31+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (587→344 chars)

_2026-05-28T03:44:36+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (449→163 chars)

_2026-05-28T03:44:40+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx` (448→162 chars)

_2026-05-28T03:44:44+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (18→40 chars)

_2026-05-28T03:46:13+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (256→1382 chars)

_2026-05-28T03:46:27+00:00_


## #PROMPT

_2026-05-28T03:46:33+00:00_

```
~initprompt~ workstream-3c-promote-FieldLabel

Read ui-audit/08-claim-b-plan.md section two for the component promotions plan, specifically the entry for FieldLabel. Read ui-audit/05-claim-c-deferral.md to confirm exclusions. Read ui-audit/08b-constants-checkin.md to confirm prior work is clear.

Goal: promote FieldLabel per the plan. Work in three steps: promote to shared location, set the API to the minimal surface specified in the plan, then migrate consumers.

Step one, promote. Move or copy the base implementation from the source-of-truth location specified in the plan to its new shared location. Use the rationale recorded in the plan for choosing the base.

Step two, set API. Adjust the API to match the plan's minimal surface. Document any behavior the base version had that is being dropped, and flag any consumer that depended on that behavior. If a consumer needed behavior beyond the minimal API, add the requirement to ui-audit/08-claim-b-plan.md as a note on this component's entry rather than expanding the API; the consumer can be handled as a deferred migration.

Step three, migrate consumers. For each consumer identified in the plan, the migration should be a substitution: import the new component, replace the call site, verify behavior matches. For any consumer that requires more than substitution-level refactoring, do not refactor in this prompt. Record it as deferred consumer migration in the plan.

If the promotion reveals that the base version is more entangled with its module than the plan anticipated, stop and ask. Do not power through an entangled promotion.

Do not promote any other components. Do not refactor unrelated code. Do not touch canvas-layer files.

Update ui-audit/08-claim-b-plan.md by marking FieldLabel as completed with date and listing migrated consumers and deferred consumers.

When done print: file paths modified, count of consumers migrated, count of consumers deferred with reasons, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the three plan files to understand the FieldLabel promotion scope.


## #ASSISTANT

Good. Now let me read the source implementation at `DesignerRightPanel.tsx:201–217` and the PaneConfigModal.


## #ASSISTANT

Let me read the full PaneConfigModal to find all label-like divs.


## #ASSISTANT

Let me read the rest of PaneConfigModal to see all labels.


## #ASSISTANT

I have the full picture. Let me verify the shared components directory exists, then check for any existing shared FieldLabel.


## #BASH
_List shared components and styles directories_

```bash
ls /home/io/io-dev/io/frontend/src/shared/components/ && echo "---" && ls /home/io/io-dev/io/frontend/src/shared/styles/
```


## #ASSISTANT

Let me check the imports at the top of DesignerRightPanel.tsx.


## #ASSISTANT

All clear. Now executing the three steps.

**Step 1: Create `shared/components/FieldLabel.tsx`**


## #ASSISTANT

**Step 2: Update `DesignerRightPanel.tsx`** — add import, remove local definition.


## #ASSISTANT

That diagnostic is pre-existing and unrelated. Continuing with step 2 — removing the local `FieldLabel` definition from `DesignerRightPanel.tsx`.


## #ASSISTANT

**Step 3: Migrate `PaneConfigModal.tsx`** — add import and replace 6 field label elements.


## #ASSISTANT

Now replacing all 6 field labels in PaneConfigModal. Doing them as individual edits since each has different context.


## #ASSISTANT

All edits done. Now running the build to verify no type errors.


## #BASH
_Build frontend to check for type errors_

```bash
cd /home/io/io-dev/io/frontend && pnpm build 2>&1 | tail -30
```


## #ASSISTANT

Build passes clean. Now updating the plan to mark FieldLabel complete.


## #ASSISTANT

Now append the completion note to the FieldLabel consumer table.


## #TURN_END

_2026-05-28T03:46:35+00:00_

---
---



DIFF OF CHANGES:
---
diff --git a/frontend/src/pages/console/PaneConfigModal.tsx b/frontend/src/pages/console/PaneConfigModal.tsx
index 52afd449..57205310 100644
--- a/frontend/src/pages/console/PaneConfigModal.tsx
+++ b/frontend/src/pages/console/PaneConfigModal.tsx
@@ -1,5 +1,6 @@
 import { useState } from "react";
 import * as Dialog from "@radix-ui/react-dialog";
+import FieldLabel from "../../shared/components/FieldLabel";
 import { useQuery } from "@tanstack/react-query";
 import { pointsApi } from "../../api/points";
 import type { PaneConfig, PaneType } from "./types";
@@ -252,17 +253,7 @@ export default function PaneConfigModal({
 
           {/* Type selector */}
           <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
-            <label
-              style={{
-                fontSize: 12,
-                fontWeight: 600,
-                color: "var(--io-text-muted)",
-                textTransform: "uppercase",
-                letterSpacing: "0.04em",
-              }}
-            >
-              Pane Type
-            </label>
+            <FieldLabel>Pane Type</FieldLabel>
             <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
               {PANE_TYPES.map((pt) => (
                 <button
@@ -293,18 +284,9 @@ export default function PaneConfigModal({
 
           {/* Title */}
           <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
-            <label
-              style={{
-                fontSize: 12,
-                fontWeight: 600,
-                color: "var(--io-text-muted)",
-                textTransform: "uppercase",
-                letterSpacing: "0.04em",
-              }}
-            >
-              Title (optional)
-            </label>
+            <FieldLabel htmlFor="pane-title">Title (optional)</FieldLabel>
             <input
+              id="pane-title"
               type="text"
               value={title}
               onChange={(e) => setTitle(e.target.value)}
@@ -326,17 +308,7 @@ export default function PaneConfigModal({
           {type === "trend" && (
             <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
               <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
-                <label
-                  style={{
-                    fontSize: 12,
-                    fontWeight: 600,
-                    color: "var(--io-text-muted)",
-                    textTransform: "uppercase",
-                    letterSpacing: "0.04em",
-                  }}
-                >
-                  Points (max 8)
-                </label>
+                <FieldLabel>Points (max 8)</FieldLabel>
                 <PointSearch
                   selected={trendPointIds}
                   onChange={setTrendPointIds}
@@ -344,18 +316,9 @@ export default function PaneConfigModal({
                 />
               </div>
               <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
-                <label
-                  style={{
-                    fontSize: 12,
-                    fontWeight: 600,
-                    color: "var(--io-text-muted)",
-                    textTransform: "uppercase",
-                    letterSpacing: "0.04em",
-                  }}
-                >
-                  Duration (minutes)
-                </label>
+                <FieldLabel htmlFor="trend-duration">Duration (minutes)</FieldLabel>
                 <select
+                  id="trend-duration"
                   value={trendDuration}
                   onChange={(e) => setTrendDuration(Number(e.target.value))}
                   style={{
@@ -382,17 +345,7 @@ export default function PaneConfigModal({
 
           {type === "point_table" && (
             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
-              <label
-                style={{
-                  fontSize: 12,
-                  fontWeight: 600,
-                  color: "var(--io-text-muted)",
-                  textTransform: "uppercase",
-                  letterSpacing: "0.04em",
-                }}
-              >
-                Points
-              </label>
+              <FieldLabel>Points</FieldLabel>
               <PointSearch
                 selected={tablePointIds}
                 onChange={setTablePointIds}
@@ -402,17 +355,7 @@ export default function PaneConfigModal({
 
           {type === "alarm_list" && (
             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
-              <label
-                style={{
-                  fontSize: 12,
-                  fontWeight: 600,
-                  color: "var(--io-text-muted)",
-                  textTransform: "uppercase",
-                  letterSpacing: "0.04em",
-                }}
-              >
-                Filter
-              </label>
+              <FieldLabel>Filter</FieldLabel>
               <div style={{ display: "flex", gap: 8 }}>
                 {(["all", "active", "unacknowledged"] as const).map((f) => (
                   <label
diff --git a/frontend/src/pages/designer/DesignerRightPanel.tsx b/frontend/src/pages/designer/DesignerRightPanel.tsx
index ef6ed123..b7bd16c8 100644
--- a/frontend/src/pages/designer/DesignerRightPanel.tsx
+++ b/frontend/src/pages/designer/DesignerRightPanel.tsx
@@ -68,6 +68,7 @@ import {
 } from "../../shared/graphics/commands";
 import { recenterArrayOnBindingChange } from "../../shared/graphics/anchorSlots";
 import ChartConfigPanel from "../../shared/components/charts/ChartConfigPanel";
+import FieldLabel from "../../shared/components/FieldLabel";
 import type { ChartConfig } from "../../shared/components/charts/chart-config-types";
 import type {
   SceneCommand,
@@ -198,23 +199,6 @@ function findParentSymbol(
 // Small helper components
 // ---------------------------------------------------------------------------
 
-function FieldLabel({ children }: { children: React.ReactNode }) {
-  return (
-    <label
-      style={{
-        display: "block",
-        fontSize: 10,
-        fontWeight: 600,
-        textTransform: "uppercase",
-        letterSpacing: "0.05em",
-        color: "var(--io-text-muted)",
-        marginBottom: 3,
-      }}
-    >
-      {children}
-    </label>
-  );
-}
 
 const inputStyle: React.CSSProperties = {
   width: "100%",
diff --git a/ui-audit/08-claim-b-plan.md b/ui-audit/08-claim-b-plan.md
index af43683b..90a35764 100644
--- a/ui-audit/08-claim-b-plan.md
+++ b/ui-audit/08-claim-b-plan.md
@@ -183,7 +183,7 @@ inputClassName = "io-input"  // pair with companion inputs.css
 
 ## Section 2 — Component Promotions Plan
 
-### 2.1 FieldLabel
+### 2.1 FieldLabel — **DONE 2026-05-28**
 
 #### Source-of-truth location
 
@@ -218,6 +218,14 @@ The only change from the source: `fontSize: 10` → `fontSize: 11` per the Cat 2
 
 **Risk items:** None for the DesignerRightPanel migration (mechanical import change). PaneConfigModal migration is light but requires verifying each `<div>` label is semantically equivalent to a `<label>` and has a corresponding input target for `htmlFor`.
 
+**Execution notes (2026-05-28):**
+- `frontend/src/shared/components/FieldLabel.tsx` created. API: `{ children, htmlFor? }`. `fontSize: 11` (was 10 in source).
+- `DesignerRightPanel.tsx`: local `FieldLabel` function removed; import from shared added. Zero call-site changes — all 14+ usages inherited automatically.
+- `PaneConfigModal.tsx`: 6 field labels migrated. Labels were already `<label>` elements (plan said `<div>` — minor discrepancy, semantics were already correct). `htmlFor` added for "Title (optional)" → `id="pane-title"` and "Duration (minutes)" → `id="trend-duration"`. "Pane Type", "Points (max 8)", "Points", "Filter" have no single associated input; migrated without `htmlFor`. Visual change: `fontSize 12 → 11`, `letterSpacing 0.04em → 0.05em` (convergence target per Cat 2 table).
+- **Consumers migrated:** 2 (`DesignerRightPanel.tsx`, `PaneConfigModal.tsx`)
+- **Consumers deferred:** Settings pages using `labelStyle` (12px/500/no-uppercase — intentionally distinct, not to be migrated per plan). No deferred consumers beyond what the plan already documented.
+- `pnpm build` passed with no type errors.
+
 ---
 
 ### 2.2 StatusBadge
---

FULL FILE CONTENTS (for surrounding-code analysis):
---

--- File: /home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx ---
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import FieldLabel from "../../shared/components/FieldLabel";
import { useQuery } from "@tanstack/react-query";
import { pointsApi } from "../../api/points";
import type { PaneConfig, PaneType } from "./types";

interface PaneConfigModalProps {
  pane: PaneConfig;
  onSave: (updated: PaneConfig) => void;
  onClose: () => void;
}

const PANE_TYPES: { value: PaneType; label: string; description: string }[] = [
  { value: "trend", label: "Trend", description: "Real-time trend chart" },
  {
    value: "point_table",
    label: "Point Table",
    description: "Live point value table",
  },
  {
    value: "alarm_list",
    label: "Alarm List",
    description: "Active alarm list",
  },
  { value: "blank", label: "Blank", description: "Empty pane" },
];

// ---------------------------------------------------------------------------
// Point search section
// ---------------------------------------------------------------------------

function PointSearch({
  selected,
  onChange,
  maxSelect,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  maxSelect?: number;
}) {
  const [query, setQuery] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["points-search", query],
    queryFn: async () => {
      const result = await pointsApi.list({
        search: query || undefined,
        limit: 50,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data.data;
    },
    staleTime: 15_000,
  });

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      if (maxSelect && selected.length >= maxSelect) return;
      onChange([...selected, id]);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        type="text"
        placeholder="Search points by name or tag…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: 6,
          padding: "7px 10px",
          fontSize: 13,
          color: "var(--io-text-primary)",
          outline: "none",
        }}
      />

      {maxSelect && (
        <div style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
          {selected.length} / {maxSelect} selected
        </div>
      )}

      {isFetching && (
        <div style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
          Searching…
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          maxHeight: 200,
          overflowY: "auto",
        }}
      >
        {data?.map((pt) => {
          const isSelected = selected.includes(pt.id);
          const isDisabled =
            !isSelected && maxSelect != null && selected.length >= maxSelect;
          return (
            <label
              key={pt.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                background: isSelected
                  ? "var(--io-accent-subtle, rgba(74,158,255,0.1))"
                  : "var(--io-surface-secondary)",
                border: `1px solid ${isSelected ? "var(--io-accent)" : "var(--io-border)"}`,
                borderRadius: 6,
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.5 : 1,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => toggle(pt.id)}
                style={{ accentColor: "var(--io-accent)" }}
              />
              <span style={{ flex: 1, overflow: "hidden" }}>
                <span
                  style={{ fontWeight: 500, color: "var(--io-text-primary)" }}
                >
                  {pt.display_name ?? pt.tagname}
                </span>
                <span
                  style={{
                    color: "var(--io-text-muted)",
                    marginLeft: 6,
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                >
                  {pt.tagname}
                </span>
              </span>
              {pt.unit && (
                <span style={{ color: "var(--io-text-muted)", fontSize: 11 }}>
                  {pt.unit}
                </span>
              )}
            </label>
          );
        })}
        {data?.length === 0 && !isFetching && (
          <div
            style={{
              fontSize: 12,
              color: "var(--io-text-muted)",
              textAlign: "center",
              padding: 12,
            }}
          >
            No points found
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaneConfigModal
// ---------------------------------------------------------------------------

export default function PaneConfigModal({
  pane,
  onSave,
  onClose,
}: PaneConfigModalProps) {
  const [type, setType] = useState<PaneType>(pane.type);
  const [title, setTitle] = useState(pane.title ?? "");
  const [trendPointIds, setTrendPointIds] = useState<string[]>(
    pane.trendPointIds ?? [],
  );
  const [trendDuration, setTrendDuration] = useState(pane.trendDuration ?? 60);
  const [tablePointIds, setTablePointIds] = useState<string[]>(
    pane.tablePointIds ?? [],
  );
  const [alarmFilter, setAlarmFilter] = useState<
    "all" | "active" | "unacknowledged"
  >(pane.alarmFilter ?? "all");

  const handleSave = () => {
    const updated: PaneConfig = {
      id: pane.id,
      type,
      title: title.trim() || undefined,
      trendPointIds: type === "trend" ? trendPointIds : undefined,
      trendDuration: type === "trend" ? trendDuration : undefined,
      tablePointIds: type === "point_table" ? tablePointIds : undefined,
      alarmFilter: type === "alarm_list" ? alarmFilter : undefined,
    };
    onSave(updated);
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1001,
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: 8,
            padding: 24,
            width: 480,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "calc(100vh - 64px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <Dialog.Title
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Configure Pane
          </Dialog.Title>

          {/* Type selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FieldLabel>Pane Type</FieldLabel>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PANE_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => setType(pt.value)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: `1px solid ${type === pt.value ? "var(--io-accent)" : "var(--io-border)"}`,
                    background:
                      type === pt.value
                        ? "var(--io-accent-subtle, rgba(74,158,255,0.1))"
                        : "var(--io-surface-secondary)",
                    color:
                      type === pt.value
                        ? "var(--io-accent)"
                        : "var(--io-text-primary)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: type === pt.value ? 600 : 400,
                  }}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel htmlFor="pane-title">Title (optional)</FieldLabel>
            <input
              id="pane-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`e.g. ${PANE_TYPES.find((p) => p.value === type)?.label ?? type}`}
              style={{
                background: "var(--io-surface-secondary)",
                border: "1px solid var(--io-border)",
                borderRadius: 6,
                padding: "7px 10px",
                fontSize: 13,
                color: "var(--io-text-primary)",
                outline: "none",
              }}
            />
          </div>

          {/* Type-specific config */}

          {type === "trend" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <FieldLabel>Points (max 8)</FieldLabel>
                <PointSearch
                  selected={trendPointIds}
                  onChange={setTrendPointIds}
                  maxSelect={8}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel htmlFor="trend-duration">Duration (minutes)</FieldLabel>
                <select
                  id="trend-duration"
                  value={trendDuration}
                  onChange={(e) => setTrendDuration(Number(e.target.value))}
                  style={{
                    background: "var(--io-surface-secondary)",
                    border: "1px solid var(--io-border)",
                    borderRadius: 6,
                    padding: "7px 10px",
                    fontSize: 13,
                    color: "var(--io-text-primary)",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={240}>4 hours</option>
                  <option value={480}>8 hours</option>
                </select>
              </div>
            </div>
          )}

          {type === "point_table" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <FieldLabel>Points</FieldLabel>
              <PointSearch
                selected={tablePointIds}
                onChange={setTablePointIds}
              />
            </div>
          )}

          {type === "alarm_list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <FieldLabel>Filter</FieldLabel>
              <div style={{ display: "flex", gap: 8 }}>
                {(["all", "active", "unacknowledged"] as const).map((f) => (
                  <label
                    key={f}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="radio"
                      name="alarm-filter"
                      value={f}
                      checked={alarmFilter === f}
                      onChange={() => setAlarmFilter(f)}
                      style={{ accentColor: "var(--io-accent)" }}
                    />
                    <span
                      style={{
                        color: "var(--io-text-primary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {f === "unacknowledged"
                        ? "Unacknowledged"
                        : f.charAt(0).toUpperCase() + f.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 4,
            }}
          >
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: 6,
                  padding: "7px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--io-text-primary)",
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              style={{
                background: "var(--io-accent)",
                border: "none",
                borderRadius: 6,
                padding: "7px 16px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
              }}
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

--- File: /home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx ---
/**
 * DesignerRightPanel.tsx
 *
 * Context-sensitive property inspector panel.
 * Uses concern-based tabs (Layout / Style / Data / Shape / Content / Doc)
 * that appear conditionally based on the selected node type.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  useSceneStore,
  useHistoryStore,
  useLibraryStore,
  useUiStore,
} from "../../store/designer";
import type { NodeId } from "../../shared/types/graphics";
import type {
  SceneNode,
  SymbolInstance,
  TextBlock,
  Primitive,
  Pipe,
  DisplayElement,
  LayerDefinition,
  GraphicDocument,
  NavigationLink,
  WidgetNode,
  DisplayElementType,
  DisplayElementConfig,
  TextReadoutConfig,
  TextReadoutArrayConfig,
  AnalogBarConfig,
  FillGaugeConfig,
  SparklineConfig,
  DigitalStatusConfig,
  PointNameLabelConfig,
  DisplayElementFontFamily,
  DisplayElementBinding,
  ImageNode,
  EmbeddedSvgNode,
  Group,
  Annotation,
  Stencil,
  Transform,
} from "../../shared/types/graphics";
import {
  ChangePropertyCommand,
  ChangeTextCommand,
  ChangeBindingCommand,
  ChangeStyleCommand,
  ChangeLayerPropertyCommand,
  ChangeNavigationLinkCommand,
  ChangeShapeVariantCommand,
  ChangeShapeConfigurationCommand,
  ChangeDisplayElementConfigCommand,
  ChangeDisplayElementTypeCommand,
  AddDisplayElementCommand,
  RemoveDisplayElementCommand,
  HideDisplayElementCommand,
  AlignNodesCommand,
  DistributeNodesCommand,
  DeleteNodesCommand,
  GroupNodesCommand,
  ReorderNodeCommand,
  ChangeWidgetConfigCommand,
  CompoundCommand,
  MoveNodesCommand,
} from "../../shared/graphics/commands";
import { recenterArrayOnBindingChange } from "../../shared/graphics/anchorSlots";
import ChartConfigPanel from "../../shared/components/charts/ChartConfigPanel";
import FieldLabel from "../../shared/components/FieldLabel";
import type { ChartConfig } from "../../shared/components/charts/chart-config-types";
import type {
  SceneCommand,
  AlignmentType,
} from "../../shared/graphics/commands";
import type { ShapeEntry, ValueAnchor } from "../../store/designer";
import { PIPE_SERVICE_COLORS } from "../../shared/types/graphics";
import { pointsApi } from "../../api/points";

// ---------------------------------------------------------------------------
// PointResolutionIndicator — shows a yellow dot when a pointId is unresolved
// ---------------------------------------------------------------------------

function PointResolutionIndicator({
  pointId,
}: {
  pointId: string | undefined;
}) {
  const [status, setStatus] = useState<
    "idle" | "checking" | "found" | "notfound"
  >("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pointId) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const result = await pointsApi
        .list({ search: pointId, limit: 1 })
        .catch(() => null);
      if (!result?.success) {
        setStatus("idle");
        return;
      }
      const exact = result.data.data.find(
        (p) => p.id === pointId || p.tagname === pointId,
      );
      setStatus(exact ? "found" : "notfound");
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pointId]);

  if (status === "idle" || !pointId) return null;
  if (status === "checking")
    return (
      <span
        title="Checking…"
        style={{ fontSize: 10, color: "var(--io-text-muted)", marginLeft: 4 }}
      >
        …
      </span>
    );
  if (status === "found")
    return (
      <span
        title="Tag resolved"
        style={{ fontSize: 10, color: "#22c55e", marginLeft: 4 }}
      >
        ✓
      </span>
    );
  return (
    <span
      title="Tag not found — bindings with unresolved tags display N/C at runtime"
      style={{ fontSize: 10, color: "#facc15", marginLeft: 4 }}
    >
      ⚠ not found
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerRightPanelProps {
  collapsed: boolean;
  width: number;
}

// ---------------------------------------------------------------------------
// Find node by ID anywhere in the doc tree
// ---------------------------------------------------------------------------

function findNodeById(doc: GraphicDocument, id: NodeId): SceneNode | null {
  function search(nodes: SceneNode[]): SceneNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if ("children" in n && Array.isArray(n.children)) {
        const found = search(n.children as SceneNode[]);
        if (found) return found;
      }
    }
    return null;
  }
  return search(doc.children);
}

function findParentSymbol(
  doc: GraphicDocument,
  childId: NodeId,
): SymbolInstance | null {
  function search(nodes: SceneNode[]): SymbolInstance | null {
    for (const n of nodes) {
      if (n.type === "symbol_instance") {
        const si = n as SymbolInstance;
        for (const child of si.children) {
          if (child.id === childId) return si;
        }
      }
      if ("children" in n && Array.isArray(n.children)) {
        const found = search(n.children as SceneNode[]);
        if (found) return found;
      }
    }
    return null;
  }
  return search(doc.children as SceneNode[]);
}

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------


const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "4px 7px",
  background: "var(--io-surface)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-text-primary)",
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const safeValue =
    value === undefined || value === null || isNaN(value as number)
      ? ""
      : value;
  return (
    <input
      type="number"
      value={safeValue}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(v);
      }}
      style={inputStyle}
    />
  );
}

// ISA-101 / ISA-18.2 reserved colors — never use for decorative fills.
// These map directly to alarm priority, operational state, and connection indicators.
const RESERVED_COLOR_SET = new Set([
  "#ef4444",
  "#b91c1c", // P1 Urgent
  "#f97316",
  "#ea580c", // P2 High
  "#eab308",
  "#c8a800",
  "#facc15", // P3 Low + yellow adjacents
  "#d946ef",
  "#c026d3", // Shelved / Fault
  "#60a5fa",
  "#2563eb", // Custom alarm
  "#2dd4bf",
  "#0d9488",
  "#14b8a6", // Teal — connection points only
  "#059669",
  "#047857", // Running/Open operational state
  "#f87171", // near-alarm red
]);

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value);
  const isReserved = isHex && RESERVED_COLOR_SET.has(value.toLowerCase());
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <label
          style={{
            position: "relative",
            flexShrink: 0,
            cursor: "pointer",
            display: "block",
            width: 28,
            height: 28,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: value,
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
            }}
          />
          <input
            type="color"
            value={isHex ? value : "#ffffff"}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              cursor: "pointer",
              width: "100%",
              height: "100%",
            }}
          />
        </label>
        {isHex ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              fontSize: 10,
              color: "var(--io-text-muted)",
              fontFamily: "monospace",
              padding: "0 4px",
            }}
          >
            Theme default
          </span>
        )}
      </div>
      {isReserved && (
        <span style={{ fontSize: 9, color: "#f97316" }}>
          Reserved for alarm/status — choose another color
        </span>
      )}
    </div>
  );
}

// ISA-101 compliant text color presets — only tokens from the display element spec.
// Teal, yellow, red, and orange are excluded: reserved for alarm priority indicators.
const TEXT_COLOR_PRESETS = [
  { label: "White", value: "var(--io-text-primary)" },
  { label: "Gray", value: "var(--io-text-secondary)" },
  { label: "Muted", value: "var(--io-text-muted)" },
];

/**
 * Dropdown color selector for text/label colors.
 * Only exposes the three ISA-101 compliant text tokens — no custom hex picker.
 * Alarm-adjacent colors (red, orange, yellow, teal) are intentionally excluded.
 */
function ThemedColorSelect({
  value,
  defaultValue,
  onChange,
}: {
  value: string | undefined;
  defaultValue: string;
  onChange: (v: string) => void;
}) {
  const isPreset = TEXT_COLOR_PRESETS.some((p) => p.value === value);
  const selectValue = isPreset ? value! : "__default__";
  const swatchColor = isPreset ? value! : defaultValue;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <div
        style={{
          width: 20,
          height: 20,
          background: swatchColor,
          border: "1px solid var(--io-border)",
          borderRadius: 3,
          flexShrink: 0,
        }}
      />
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "__default__" ? defaultValue : v);
        }}
        style={{ ...inputStyle, flex: 1 }}
      >
        <option value="__default__">Default</option>
        {TEXT_COLOR_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...inputStyle,
        cursor: "pointer",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// NavigationLinkEditor
// ---------------------------------------------------------------------------

function NavigationLinkEditor({
  nodeId,
  link,
  prevLink,
  executeCmd,
}: {
  nodeId: NodeId;
  link: NavigationLink | undefined;
  prevLink: NavigationLink | undefined;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasLink = !!link?.targetGraphicId || !!link?.targetUrl;

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          color: hasLink ? "var(--io-accent)" : "var(--io-text-secondary)",
          fontSize: 11,
          padding: "4px 8px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span>Navigation Link {hasLink ? "(set)" : "(none)"}</span>
        <span style={{ fontSize: 9 }}>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div
          style={{
            marginTop: 6,
            padding: 8,
            background: "var(--io-surface-elevated)",
            borderRadius: "var(--io-radius)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div>
            <FieldLabel>Target Graphic ID</FieldLabel>
            <input
              type="text"
              defaultValue={link?.targetGraphicId ?? ""}
              onBlur={(e) => {
                const val = e.target.value.trim();
                const newLink = {
                  ...link,
                  targetGraphicId: val || undefined,
                  targetUrl: undefined,
                };
                executeCmd(
                  new ChangeNavigationLinkCommand(nodeId, newLink, prevLink),
                );
              }}
              style={inputStyle}
              placeholder="graphic-uuid"
            />
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--io-text-muted)",
              textAlign: "center",
            }}
          >
            — or —
          </div>
          <div>
            <FieldLabel>External URL</FieldLabel>
            <input
              type="text"
              defaultValue={link?.targetUrl ?? ""}
              onBlur={(e) => {
                const val = e.target.value.trim();
                const newLink = {
                  ...link,
                  targetUrl: val || undefined,
                  targetGraphicId: undefined,
                };
                executeCmd(
                  new ChangeNavigationLinkCommand(nodeId, newLink, prevLink),
                );
              }}
              style={inputStyle}
              placeholder="https://…"
            />
          </div>
          {hasLink && (
            <button
              onClick={() =>
                executeCmd(
                  new ChangeNavigationLinkCommand(nodeId, undefined, prevLink),
                )
              }
              style={{
                fontSize: 11,
                color: "var(--io-text-muted)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                padding: 0,
              }}
            >
              Clear link
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook: execute + push to history
// ---------------------------------------------------------------------------

function useExecuteCmd() {
  const doc = useSceneStore((s) => s.doc);
  const execute = useSceneStore((s) => s.execute);
  const push = useHistoryStore((s) => s.push);

  return useCallback(
    (cmd: SceneCommand) => {
      if (!doc) return;
      const before = doc;
      execute(cmd);
      push(cmd, before);
    },
    [doc, execute, push],
  );
}

// ---------------------------------------------------------------------------
// Document properties panel
// ---------------------------------------------------------------------------

function DocPropertiesPanel({ doc }: { doc: GraphicDocument }) {
  const executeCmd = useExecuteCmd();

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Canvas Width">
        <NumberInput
          value={doc.canvas.width}
          min={100}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                doc.id,
                "canvas",
                { ...doc.canvas, width: v },
                doc.canvas,
              ),
            )
          }
        />
      </Field>
      <Field label="Canvas Height">
        <NumberInput
          value={doc.canvas.height}
          min={100}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                doc.id,
                "canvas",
                { ...doc.canvas, height: v },
                doc.canvas,
              ),
            )
          }
        />
      </Field>
      <Field label="Background Color">
        <ColorInput
          value={doc.canvas.backgroundColor}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                doc.id,
                "canvas",
                { ...doc.canvas, backgroundColor: v },
                doc.canvas,
              ),
            )
          }
        />
      </Field>
      <Field label="Grid Size">
        <NumberInput
          value={doc.metadata.gridSize}
          min={1}
          max={128}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                doc.id,
                "metadata",
                { ...doc.metadata, gridSize: v },
                doc.metadata,
              ),
            )
          }
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransformSection — universal layout tab for all nodes
// ---------------------------------------------------------------------------

function TransformSection({
  node,
  doc,
  executeCmd,
  showRotation = true,
}: {
  node: SceneNode;
  doc: GraphicDocument | null;
  executeCmd: (cmd: SceneCommand) => void;
  showRotation?: boolean;
}) {
  const t = node.transform;
  const pos = t.position;
  const scale = t.scale ?? { x: 1, y: 1 };
  const mirror = t.mirror ?? "none";

  function setTransform(patch: Partial<Transform>) {
    executeCmd(
      new ChangePropertyCommand(node.id, "transform", { ...t, ...patch }, t),
    );
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <Field label="X">
          <NumberInput
            value={Math.round(pos.x)}
            onChange={(v) => setTransform({ position: { ...pos, x: v } })}
          />
        </Field>
        <Field label="Y">
          <NumberInput
            value={Math.round(pos.y)}
            onChange={(v) => setTransform({ position: { ...pos, y: v } })}
          />
        </Field>
        {showRotation && (
          <Field label="Rotation °">
            <NumberInput
              value={Math.round(t.rotation)}
              min={-360}
              max={360}
              onChange={(v) => setTransform({ rotation: v })}
            />
          </Field>
        )}
        <Field label="Opacity %">
          <NumberInput
            value={Math.round(node.opacity * 100)}
            min={0}
            max={100}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "opacity",
                  v / 100,
                  node.opacity,
                ),
              )
            }
          />
        </Field>
        <Field label="Scale X %">
          <NumberInput
            value={Math.round(scale.x * 100)}
            min={1}
            max={2000}
            onChange={(v) => setTransform({ scale: { ...scale, x: v / 100 } })}
          />
        </Field>
        <Field label="Scale Y %">
          <NumberInput
            value={Math.round(scale.y * 100)}
            min={1}
            max={2000}
            onChange={(v) => setTransform({ scale: { ...scale, y: v / 100 } })}
          />
        </Field>
      </div>

      <Field label="Mirror">
        <SelectInput
          value={mirror}
          onChange={(v) => setTransform({ mirror: v as Transform["mirror"] })}
          options={[
            { value: "none", label: "None" },
            { value: "horizontal", label: "Horizontal" },
            { value: "vertical", label: "Vertical" },
            { value: "both", label: "Both" },
          ]}
        />
      </Field>

      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            cursor: "pointer",
            color: "var(--io-text-secondary)",
          }}
        >
          <input
            type="checkbox"
            checked={node.visible}
            onChange={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "visible",
                  e.target.checked,
                  node.visible,
                ),
              )
            }
            style={{ cursor: "pointer" }}
          />
          Visible
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            cursor: "pointer",
            color: "var(--io-text-secondary)",
          }}
        >
          <input
            type="checkbox"
            checked={node.locked}
            onChange={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "locked",
                  e.target.checked,
                  node.locked,
                ),
              )
            }
            style={{ cursor: "pointer" }}
          />
          Locked
        </label>
      </div>

      {doc && (
        <Field label="Layer">
          <SelectInput
            value={node.layerId ?? ""}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "layerId",
                  v || undefined,
                  node.layerId,
                ),
              )
            }
            options={[
              { value: "", label: "— None —" },
              ...doc.layers.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
        </Field>
      )}

      <NavigationLinkEditor
        nodeId={node.id}
        link={node.navigationLink}
        prevLink={node.navigationLink}
        executeCmd={executeCmd}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Primitive geometry size fields (rect/circle/ellipse)
// ---------------------------------------------------------------------------

function PrimitiveGeometrySection({
  node,
  executeCmd,
}: {
  node: Primitive;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const geo = node.geometry;
  if (geo.type === "rect") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Field label="Width">
          <NumberInput
            value={geo.width}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, width: v },
                  geo,
                ),
              )
            }
          />
        </Field>
        <Field label="Height">
          <NumberInput
            value={geo.height}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, height: v },
                  geo,
                ),
              )
            }
          />
        </Field>
        <Field label="Corner Radius">
          <NumberInput
            value={geo.rx ?? 0}
            min={0}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, rx: v, ry: v },
                  geo,
                ),
              )
            }
          />
        </Field>
      </div>
    );
  }
  if (geo.type === "circle") {
    return (
      <Field label="Radius">
        <NumberInput
          value={geo.r}
          min={1}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "geometry",
                { ...geo, r: v },
                geo,
              ),
            )
          }
        />
      </Field>
    );
  }
  if (geo.type === "ellipse") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Field label="Radius X">
          <NumberInput
            value={geo.rx}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, rx: v },
                  geo,
                ),
              )
            }
          />
        </Field>
        <Field label="Radius Y">
          <NumberInput
            value={geo.ry}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, ry: v },
                  geo,
                ),
              )
            }
          />
        </Field>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Primitive style section (fill + stroke)
// ---------------------------------------------------------------------------

function PrimitiveStyleSection({
  node,
  executeCmd,
}: {
  node: Primitive;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const style = node.style;

  return (
    <>
      <Field label="Fill">
        <ColorInput
          value={style.fill === "none" ? "#000000" : style.fill}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(node.id, { ...style, fill: v }, style),
            )
          }
        />
      </Field>
      <Field label="Fill Opacity %">
        <NumberInput
          value={Math.round(style.fillOpacity * 100)}
          min={0}
          max={100}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                { ...style, fillOpacity: v / 100 },
                style,
              ),
            )
          }
        />
      </Field>
      <Field label="Stroke">
        <ColorInput
          value={style.stroke === "none" ? "#000000" : style.stroke}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(node.id, { ...style, stroke: v }, style),
            )
          }
        />
      </Field>
      <Field label="Stroke Width">
        <NumberInput
          value={style.strokeWidth}
          min={0}
          step={0.5}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                { ...style, strokeWidth: v },
                style,
              ),
            )
          }
        />
      </Field>
      <Field label="Stroke Dash">
        <SelectInput
          value={style.strokeDasharray ?? ""}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                { ...style, strokeDasharray: v || undefined },
                style,
              ),
            )
          }
          options={[
            { value: "", label: "Solid" },
            { value: "4 2", label: "Dashed" },
            { value: "2 2", label: "Dotted" },
            { value: "8 4 2 4", label: "Dash-Dot" },
          ]}
        />
      </Field>
      <Field label="Line Cap">
        <SelectInput
          value={style.strokeLinecap ?? "butt"}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                {
                  ...style,
                  strokeLinecap: v as "butt" | "round" | "square",
                },
                style,
              ),
            )
          }
          options={[
            { value: "butt", label: "Butt" },
            { value: "round", label: "Round" },
            { value: "square", label: "Square" },
          ]}
        />
      </Field>
      <Field label="Line Join">
        <SelectInput
          value={style.strokeLinejoin ?? "miter"}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                {
                  ...style,
                  strokeLinejoin: v as "miter" | "round" | "bevel",
                },
                style,
              ),
            )
          }
          options={[
            { value: "miter", label: "Miter" },
            { value: "round", label: "Round" },
            { value: "bevel", label: "Bevel" },
          ]}
        />
      </Field>
    </>
  );
}

// ---------------------------------------------------------------------------
// TextBlock style section (font + color + background)
// ---------------------------------------------------------------------------

function TextBlockStyleSection({
  node,
  executeCmd,
}: {
  node: TextBlock;
  executeCmd: (cmd: SceneComma

--- File: /home/io/io-dev/io/frontend/src/shared/components/FieldLabel.tsx ---
import React from "react";

interface FieldLabelProps {
  children: React.ReactNode;
  htmlFor?: string;
}

export default function FieldLabel({ children, htmlFor }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--io-text-muted)",
        marginBottom: 3,
      }}
    >
      {children}
    </label>
  );
}

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

### 2.1 FieldLabel — **DONE 2026-05-28**

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

**Execution notes (2026-05-28):**
- `frontend/src/shared/components/FieldLabel.tsx` created. API: `{ children, htmlFor? }`. `fontSize: 11` (was 10 in source).
- `DesignerRightPanel.tsx`: local `FieldLabel` function removed; import from shared added. Zero call-site changes — all 14+ usages inherited automatically.
- `PaneConfigModal.tsx`: 6 field labels migrated. Labels were already `<label>` elements (plan said `<div>` — minor discrepancy, semantics were already correct). `htmlFor` added for "Title (optional)" → `id="pane-title"` and "Duration (minutes)" → `id="trend-duration"`. "Pane Type", "Points (max 8)", "Points", "Filter" have no single associated input; migrated without `htmlFor`. Visual change: `fontSize 12 → 11`, `letterSpacing 0.04em → 0.05em` (convergence target per Cat 2 table).
- **Consumers migrated:** 2 (`DesignerRightPanel.tsx`, `PaneConfigModal.tsx`)
- **Consumers deferred:** Settings pages using `labelStyle` (12px/500/no-uppercase — intentionally distinct, not to be migrated per plan). No deferred consumers beyond what the plan already documented.
- `pnpm build` passed with no type errors.

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

### Consumer migration (deferred unless p

---

Produce the review now.
```


## #TURN_END

_2026-05-28T03:53:02+00:00_

---


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx` (203→202 chars)

_2026-05-28T03:53:14+00:00_


## #PROMPT

_2026-05-28T03:53:21+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
bash /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #ASSISTANT

Clean review — no blocking concerns. One cosmetic fix: the blank line left behind after removing the FieldLabel function. Let me check and tidy it.


## #TURN_END

_2026-05-28T03:53:22+00:00_

---
---

WORK UNIT SUMMARY:
---
# Work Unit Summary

**Generated**: 2026-05-28T03:54:51+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-fieldlabel

read-u_034233.md`
**Session**: 

---

## Work unit purpose

Promote the `FieldLabel` component from a module-local definition in `DesignerRightPanel.tsx` to a shared component at `src/shared/components/FieldLabel.tsx`, then migrate all identified consumers.

## Key decisions made

- Used `DesignerRightPanel.tsx` as the source-of-truth base (only module with correct `<label>` HTML semantics)
- Applied one deliberate change from source: `fontSize: 10` → `fontSize: 11` per the Cat 2 convergence table
- Added `htmlFor?` prop to the minimal API surface (not in the original) to support label-input association
- Added `id` attributes to two inputs in `PaneConfigModal.tsx` ("pane-title", "trend-duration") to pair with `htmlFor`
- Did not migrate Settings pages that use `labelStyle` (12px/500/no-uppercase) — intentionally distinct convention, deferred per plan

## What was built or changed

- Created `frontend/src/shared/components/FieldLabel.tsx` with API `{ children, htmlFor? }`
- Removed local `FieldLabel` function from `DesignerRightPanel.tsx`; added shared import — zero call-site changes, all 14+ usages inherited automatically
- Replaced 6 inline `<label>` elements in `PaneConfigModal.tsx` with `<FieldLabel>` (visual change: `fontSize 12→11`, `letterSpacing 0.04em→0.05em`)
- Added a blank-line cleanup edit to `DesignerRightPanel.tsx` post-review
- Updated `ui-audit/08-claim-b-plan.md`: marked section 2.1 as DONE 2026-05-28, added execution notes, migrated/deferred consumer counts
- Build verified clean (`pnpm build` passed, no type errors)

## What was deliberately not done

- Settings pages using `labelStyle` were not migrated — intentionally distinct visual treatment (12px/500/no-uppercase vs 11px/600/uppercase)
- No other components were promoted (scope limited to FieldLabel only)
- No canvas-layer files were touched

## Files modified

- `frontend/src/shared/components/FieldLabel.tsx` (created)
- `frontend/src/pages/designer/DesignerRightPanel.tsx`
- `frontend/src/pages/console/PaneConfigModal.tsx`
- `ui-audit/08-claim-b-plan.md`
SessionEnd hook [${CLAUDE_PROJECT_DIR}/.claude/hooks/session-end.sh] failed: /bin/sh: 1: /home/io/io-dev/io/frontend/.claude/hooks/session-end.sh: not found
---


DIFF OF CHANGES:
---
diff --git a/frontend/src/pages/console/PaneConfigModal.tsx b/frontend/src/pages/console/PaneConfigModal.tsx
index 52afd449..57205310 100644
--- a/frontend/src/pages/console/PaneConfigModal.tsx
+++ b/frontend/src/pages/console/PaneConfigModal.tsx
@@ -1,5 +1,6 @@
 import { useState } from "react";
 import * as Dialog from "@radix-ui/react-dialog";
+import FieldLabel from "../../shared/components/FieldLabel";
 import { useQuery } from "@tanstack/react-query";
 import { pointsApi } from "../../api/points";
 import type { PaneConfig, PaneType } from "./types";
@@ -252,17 +253,7 @@ export default function PaneConfigModal({
 
           {/* Type selector */}
           <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
-            <label
-              style={{
-                fontSize: 12,
-                fontWeight: 600,
-                color: "var(--io-text-muted)",
-                textTransform: "uppercase",
-                letterSpacing: "0.04em",
-              }}
-            >
-              Pane Type
-            </label>
+            <FieldLabel>Pane Type</FieldLabel>
             <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
               {PANE_TYPES.map((pt) => (
                 <button
@@ -293,18 +284,9 @@ export default function PaneConfigModal({
 
           {/* Title */}
           <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
-            <label
-              style={{
-                fontSize: 12,
-                fontWeight: 600,
-                color: "var(--io-text-muted)",
-                textTransform: "uppercase",
-                letterSpacing: "0.04em",
-              }}
-            >
-              Title (optional)
-            </label>
+            <FieldLabel htmlFor="pane-title">Title (optional)</FieldLabel>
             <input
+              id="pane-title"
               type="text"
               value={title}
               onChange={(e) => setTitle(e.target.value)}
@@ -326,17 +308,7 @@ export default function PaneConfigModal({
           {type === "trend" && (
             <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
               <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
-                <label
-                  style={{
-                    fontSize: 12,
-                    fontWeight: 600,
-                    color: "var(--io-text-muted)",
-                    textTransform: "uppercase",
-                    letterSpacing: "0.04em",
-                  }}
-                >
-                  Points (max 8)
-                </label>
+                <FieldLabel>Points (max 8)</FieldLabel>
                 <PointSearch
                   selected={trendPointIds}
                   onChange={setTrendPointIds}
@@ -344,18 +316,9 @@ export default function PaneConfigModal({
                 />
               </div>
               <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
-                <label
-                  style={{
-                    fontSize: 12,
-                    fontWeight: 600,
-                    color: "var(--io-text-muted)",
-                    textTransform: "uppercase",
-                    letterSpacing: "0.04em",
-                  }}
-                >
-                  Duration (minutes)
-                </label>
+                <FieldLabel htmlFor="trend-duration">Duration (minutes)</FieldLabel>
                 <select
+                  id="trend-duration"
                   value={trendDuration}
                   onChange={(e) => setTrendDuration(Number(e.target.value))}
                   style={{
@@ -382,17 +345,7 @@ export default function PaneConfigModal({
 
           {type === "point_table" && (
             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
-              <label
-                style={{
-                  fontSize: 12,
-                  fontWeight: 600,
-                  color: "var(--io-text-muted)",
-                  textTransform: "uppercase",
-                  letterSpacing: "0.04em",
-                }}
-              >
-                Points
-              </label>
+              <FieldLabel>Points</FieldLabel>
               <PointSearch
                 selected={tablePointIds}
                 onChange={setTablePointIds}
@@ -402,17 +355,7 @@ export default function PaneConfigModal({
 
           {type === "alarm_list" && (
             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
-              <label
-                style={{
-                  fontSize: 12,
-                  fontWeight: 600,
-                  color: "var(--io-text-muted)",
-                  textTransform: "uppercase",
-                  letterSpacing: "0.04em",
-                }}
-              >
-                Filter
-              </label>
+              <FieldLabel>Filter</FieldLabel>
               <div style={{ display: "flex", gap: 8 }}>
                 {(["all", "active", "unacknowledged"] as const).map((f) => (
                   <label
diff --git a/frontend/src/pages/designer/DesignerRightPanel.tsx b/frontend/src/pages/designer/DesignerRightPanel.tsx
index ef6ed123..dc8afc11 100644
--- a/frontend/src/pages/designer/DesignerRightPanel.tsx
+++ b/frontend/src/pages/designer/DesignerRightPanel.tsx
@@ -68,6 +68,7 @@ import {
 } from "../../shared/graphics/commands";
 import { recenterArrayOnBindingChange } from "../../shared/graphics/anchorSlots";
 import ChartConfigPanel from "../../shared/components/charts/ChartConfigPanel";
+import FieldLabel from "../../shared/components/FieldLabel";
 import type { ChartConfig } from "../../shared/components/charts/chart-config-types";
 import type {
   SceneCommand,
@@ -198,24 +199,6 @@ function findParentSymbol(
 // Small helper components
 // ---------------------------------------------------------------------------
 
-function FieldLabel({ children }: { children: React.ReactNode }) {
-  return (
-    <label
-      style={{
-        display: "block",
-        fontSize: 10,
-        fontWeight: 600,
-        textTransform: "uppercase",
-        letterSpacing: "0.05em",
-        color: "var(--io-text-muted)",
-        marginBottom: 3,
-      }}
-    >
-      {children}
-    </label>
-  );
-}
-
 const inputStyle: React.CSSProperties = {
   width: "100%",
   padding: "4px 7px",
diff --git a/ui-audit/08-claim-b-plan.md b/ui-audit/08-claim-b-plan.md
index af43683b..90a35764 100644
--- a/ui-audit/08-claim-b-plan.md
+++ b/ui-audit/08-claim-b-plan.md
@@ -183,7 +183,7 @@ inputClassName = "io-input"  // pair with companion inputs.css
 
 ## Section 2 — Component Promotions Plan
 
-### 2.1 FieldLabel
+### 2.1 FieldLabel — **DONE 2026-05-28**
 
 #### Source-of-truth location
 
@@ -218,6 +218,14 @@ The only change from the source: `fontSize: 10` → `fontSize: 11` per the Cat 2
 
 **Risk items:** None for the DesignerRightPanel migration (mechanical import change). PaneConfigModal migration is light but requires verifying each `<div>` label is semantically equivalent to a `<label>` and has a corresponding input target for `htmlFor`.
 
+**Execution notes (2026-05-28):**
+- `frontend/src/shared/components/FieldLabel.tsx` created. API: `{ children, htmlFor? }`. `fontSize: 11` (was 10 in source).
+- `DesignerRightPanel.tsx`: local `FieldLabel` function removed; import from shared added. Zero call-site changes — all 14+ usages inherited automatically.
+- `PaneConfigModal.tsx`: 6 field labels migrated. Labels were already `<label>` elements (plan said `<div>` — minor discrepancy, semantics were already correct). `htmlFor` added for "Title (optional)" → `id="pane-title"` and "Duration (minutes)" → `id="trend-duration"`. "Pane Type", "Points (max 8)", "Points", "Filter" have no single associated input; migrated without `htmlFor`. Visual change: `fontSize 12 → 11`, `letterSpacing 0.04em → 0.05em` (convergence target per Cat 2 table).
+- **Consumers migrated:** 2 (`DesignerRightPanel.tsx`, `PaneConfigModal.tsx`)
+- **Consumers deferred:** Settings pages using `labelStyle` (12px/500/no-uppercase — intentionally distinct, not to be migrated per plan). No deferred consumers beyond what the plan already documented.
+- `pnpm build` passed with no type errors.
+
 ---
 
 ### 2.2 StatusBadge
---

Produce the review now.
```


## #TURN_END

_2026-05-28T03:54:58+00:00_

---


## #PROMPT

_2026-05-28T03:56:05+00:00_

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
_Run all three wrapup scripts_

```bash
export CLAUDE_PROJECT_DIR=/home/io/io-dev/io
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt)
/home/io/io-dev/io/.claude/hooks/scripts/generate-summary.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
/home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID" "shallow"
/home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #TURN_END

_2026-05-28T03:56:05+00:00_

---


## #PROMPT

_2026-05-28T03:56:42+00:00_

```
git add -A
git commit -m "Claim B: promote COMPONENT_NAME to shared location"
```


## #BASH
_Stage all changes and commit FieldLabel promotion_

```bash
cd /home/io/io-dev/io && git add -A && git commit -m "Claim B: promote FieldLabel to shared location"
```


## #TURN_END

_2026-05-28T03:56:42+00:00_

---


## #EDIT `/home/io/io-dev/io/.claude/hooks/scripts/generate-summary.sh` (86→300 chars)

_2026-05-28T03:58:05+00:00_


## #EDIT `/home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh` (86→300 chars)

_2026-05-28T03:58:09+00:00_


## #PROMPT

_2026-05-28T03:58:22+00:00_

```
The wrapup hook/skill/command keeps getting the following error, can you fix it:  Error: Exit code 1
     /home/io/io-dev/io/.claude/hooks/scripts/generate-summary.sh: line 11: CLAUDE_PROJECT_DIR: unbound variable
```


## #ASSISTANT

The root cause is clear: `generate-summary.sh` uses `CLAUDE_PROJECT_DIR` before checking if it's set. When the wrapup skill runs these scripts manually via Bash (not through hooks), that variable isn't in the environment. Let me check the other two scripts for the same pattern.


## #BASH
_Check LIB_PATH lines in run-review and update-docs_

```bash
head -15 /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh /home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh
```


## #ASSISTANT

`run-review.sh` already has the auto-detect fix. Let me check `update-docs.sh` lines 13–20 and then apply the same fix to `generate-summary.sh`.


## #BASH
_Check if update-docs.sh has the auto-detect fix_

```bash
sed -n '13,20p' /home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh
```


## #BASH
_Check update-docs.sh for CLAUDE_PROJECT_DIR handling_

```bash
sed -n '20,30p' /home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh
```


## #ASSISTANT

Both `generate-summary.sh` and `update-docs.sh` have the same bug. `run-review.sh` already has the fix. I'll apply the same auto-detect block to the other two.


## #ASSISTANT

Now verify the fix works by running `generate-summary.sh` without `CLAUDE_PROJECT_DIR` set:


## #BASH
_Test generate-summary.sh without CLAUDE_PROJECT_DIR set_

```bash
env -u CLAUDE_PROJECT_DIR bash .claude/hooks/scripts/generate-summary.sh 2>&1 | head -5
```


## #ASSISTANT

The fix works — the error is now on `$1` (no log path argument was passed), not `CLAUDE_PROJECT_DIR`. The variable is resolved correctly from the script's location.

Quick smoke-test to confirm the path resolution is correct:


## #BASH
_Verify path resolution produces correct project dir_

```bash
env -u CLAUDE_PROJECT_DIR bash -c '
  source .claude/hooks/scripts/generate-summary.sh /dev/null "" 2>&1 || true
  cd .claude/hooks/scripts && bash -c "
    if [ -z \"\${CLAUDE_PROJECT_DIR:-}\" ]; then
      PROJ=\"\$(cd \"\$(dirname \"\$0\")/../../..\" && pwd)\"
    fi
    echo \"Would resolve to: \$(cd \"$(dirname .claude/hooks/scripts/generate-summary.sh)/../../..\" && pwd)\"
  "
'
env -u CLAUDE_PROJECT_DIR bash -c '
  SCRIPT=".claude/hooks/scripts/generate-summary.sh"
  PROJ="$(cd "$(dirname "$SCRIPT")/../../.." && pwd)"
  echo "Resolved CLAUDE_PROJECT_DIR=$PROJ"
'
```


## #TURN_END

_2026-05-28T03:58:23+00:00_

---


## #EDIT `/home/io/io-dev/io/.claude/hooks/stop.sh` (34→245 chars)

_2026-05-28T04:01:36+00:00_


## #EDIT `/home/io/io-dev/io/.claude/hooks/user-prompt-submit.sh` (48→259 chars)

_2026-05-28T04:01:40+00:00_


## #EDIT `/home/io/io-dev/io/.claude/hooks/post-tool-use.sh` (43→254 chars)

_2026-05-28T04:01:43+00:00_


## #EDIT `/home/io/io-dev/io/.claude/hooks/pre-tool-use-bash.sh` (47→258 chars)

_2026-05-28T04:01:47+00:00_


## #EDIT `/home/io/io-dev/io/.claude/hooks/pre-tool-use-edit.sh` (47→258 chars)

_2026-05-28T04:01:50+00:00_


## #EDIT `/home/io/io-dev/io/.claude/hooks/session-end.sh` (41→252 chars)

_2026-05-28T04:01:53+00:00_


## #EDIT `/home/io/io-dev/io/.claude/hooks/scripts/extract-turn.sh` (86→300 chars)

_2026-05-28T04:01:57+00:00_


## #PROMPT

_2026-05-28T04:02:08+00:00_

```
Can you check all the claude code scripts/commands/hooks/etc to make sure they don't have the same error?
```


## #BASH
_List all shell scripts in .claude directory_

```bash
find /home/io/io-dev/io/.claude -name "*.sh" | sort
```


## #BASH
_Find all uses of CLAUDE_PROJECT_DIR in hook scripts_

```bash
grep -n "CLAUDE_PROJECT_DIR" \
  /home/io/io-dev/io/.claude/hooks/post-tool-use.sh \
  /home/io/io-dev/io/.claude/hooks/pre-tool-use-bash.sh \
  /home/io/io-dev/io/.claude/hooks/pre-tool-use-edit.sh \
  /home/io/io-dev/io/.claude/hooks/scripts/extract-turn.sh \
  /home/io/io-dev/io/.claude/hooks/session-end.sh \
  /home/io/io-dev/io/.claude/hooks/stop.sh \
  /home/io/io-dev/io/.claude/hooks/user-prompt-submit.sh
```


## #ASSISTANT

Now let me check which of those scripts already have the auto-detect guard vs. which are bare:


## #BASH
_Check each hook for existing guard and set options_

```bash
for f in \
  /home/io/io-dev/io/.claude/hooks/post-tool-use.sh \
  /home/io/io-dev/io/.claude/hooks/pre-tool-use-bash.sh \
  /home/io/io-dev/io/.claude/hooks/pre-tool-use-edit.sh \
  /home/io/io-dev/io/.claude/hooks/scripts/extract-turn.sh \
  /home/io/io-dev/io/.claude/hooks/session-end.sh \
  /home/io/io-dev/io/.claude/hooks/stop.sh \
  /home/io/io-dev/io/.claude/hooks/user-prompt-submit.sh; do
  echo "=== $(basename $f) ==="
  grep -n "CLAUDE_PROJECT_DIR\|set -" "$f" | head -8
  echo
done
```


## #ASSISTANT

Let me check who calls `extract-turn.sh` and `session-end.sh` to understand their invocation contexts:


## #BASH
_Find callers of extract-turn.sh and session-end.sh_

```bash
grep -r "extract-turn\|session-end" /home/io/io-dev/io/.claude/ --include="*.sh" --include="*.md" -l
grep -r "extract-turn\|session-end" /home/io/io-dev/io/.claude/ --include="*.sh" -n
```


## #ASSISTANT

`extract-turn.sh` is only called from `stop.sh` (which already has `CLAUDE_PROJECT_DIR` set by the harness), so it inherits the variable. The hooks are invoked by the harness which guarantees `CLAUDE_PROJECT_DIR`. But let me check `settings.json` to confirm and also scan for any manual invocation patterns:


## #BASH
_Check which hooks are registered in settings.json_

```bash
cat /home/io/io-dev/io/.claude/settings.json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(h.get('command','')) for h in d.get('hooks',{}).get('PreToolUse',[])+d.get('hooks',{}).get('PostToolUse',[])+d.get('hooks',{}).get('Stop',[])+d.get('hooks',{}).get('UserPromptSubmit',[])+d.get('hooks',{}).get('SessionEnd',[])]" 2>/dev/null || grep -A3 '"hooks"' /home/io/io-dev/io/.claude/settings.json | head -40
```


## #BASH
_Find settings.json files_

```bash
find /home/io/io-dev/io/.claude /home/io/.claude -name "settings*.json" 2>/dev/null | sort
```


## #BASH
_Parse hook commands from settings files_

```bash
python3 -c "
import json
for path in ['/home/io/.claude/settings.json', '/home/io/io-dev/io/.claude/settings.local.json']:
    try:
        d = json.load(open(path))
        hooks = d.get('hooks', {})
        if hooks:
            print(f'=== {path} ===')
            for event, entries in hooks.items():
                for entry in entries:
                    cmd = entry.get('command', entry.get('hooks', [{}])[0].get('command', '?') if isinstance(entry.get('hooks'), list) else '?')
                    print(f'  {event}: {cmd}')
    except Exception as e:
        print(f'{path}: {e}')
"
```


## #ASSISTANT

The hooks registered in `settings.json` are invoked by the harness which guarantees `CLAUDE_PROJECT_DIR`, so they won't hit the bug during normal operation. But they're unprotected if ever called manually. I'll add the guard everywhere for consistency and robustness. The paths differ by depth: `hooks/` scripts need `../..`, `hooks/scripts/` scripts need `../../..`.


## #ASSISTANT

I can see the pattern clearly. All 7 remaining scripts need the guard. The relative path differs by depth: `hooks/` scripts use `../..`, `hooks/scripts/` scripts use `../../..`. Doing all 7 edits now.


## #ASSISTANT

Now verify the path resolution is correct for both depths:


## #BASH
_Verify path resolution for both depths_

```bash
# hooks/ depth: ../.. from .claude/hooks/ should reach project root
cd /home/io/io-dev/io/.claude/hooks && echo "hooks/../.. = $(cd ../.. && pwd)"
# hooks/scripts/ depth: ../../.. from .claude/hooks/scripts/ should reach project root
cd /home/io/io-dev/io/.claude/hooks/scripts && echo "hooks/scripts/../../.. = $(cd ../../.. && pwd)"
```


## #TURN_END

_2026-05-28T04:02:09+00:00_

---

