# Work Unit Log: workstream-3c-promote-confirmdialog

rea

Started: 2026-05-28T04:50:13+00:00
Session: 5eda53d1-1415-440c-a95c-991141fefe2b

---


## #EDIT `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx` (44→47 chars)

_2026-05-28T04:52:05+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx` (86→102 chars)

_2026-05-28T04:52:08+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx` (138→152 chars)

_2026-05-28T04:52:14+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx` (24→50 chars)

_2026-05-28T04:52:17+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerReportsList.tsx` (360→431 chars)

_2026-05-28T04:52:23+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerReportsList.tsx` (106→185 chars)

_2026-05-28T04:52:27+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerReportsList.tsx` (161→69 chars)

_2026-05-28T04:52:30+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerReportsList.tsx` (41→456 chars)

_2026-05-28T04:52:36+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerDashboardsList.tsx` (367→438 chars)

_2026-05-28T04:52:44+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerDashboardsList.tsx` (43→122 chars)

_2026-05-28T04:52:48+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerDashboardsList.tsx` (132→69 chars)

_2026-05-28T04:52:51+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerDashboardsList.tsx` (41→451 chars)

_2026-05-28T04:52:58+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx` (90→161 chars)

_2026-05-28T04:53:02+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx` (255→335 chars)

_2026-05-28T04:53:06+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx` (463→114 chars)

_2026-05-28T04:53:10+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx` (170→666 chars)

_2026-05-28T04:53:16+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (21→43 chars)

_2026-05-28T04:54:30+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (562→2817 chars)

_2026-05-28T04:54:52+00:00_


## #PROMPT

_2026-05-28T04:55:00+00:00_

```
~initprompt~ workstream-3c-promote-ConfirmDialog

Read ui-audit/08-claim-b-plan.md section two for the component promotions plan, specifically the entry for ConfirmDialog. Read ui-audit/05-claim-c-deferral.md to confirm exclusions. Read ui-audit/08b-constants-checkin.md to confirm prior work is clear.

Goal: promote ConfirmDialog per the plan. Work in three steps: promote to shared location, set the API to the minimal surface specified in the plan, then migrate consumers.

Step one, promote. Move or copy the base implementation from the source-of-truth location specified in the plan to its new shared location. Use the rationale recorded in the plan for choosing the base.

Step two, set API. Adjust the API to match the plan's minimal surface. Document any behavior the base version had that is being dropped, and flag any consumer that depended on that behavior. If a consumer needed behavior beyond the minimal API, add the requirement to ui-audit/08-claim-b-plan.md as a note on this component's entry rather than expanding the API; the consumer can be handled as a deferred migration.

Step three, migrate consumers. For each consumer identified in the plan, the migration should be a substitution: import the new component, replace the call site, verify behavior matches. For any consumer that requires more than substitution-level refactoring, do not refactor in this prompt. Record it as deferred consumer migration in the plan.

If the promotion reveals that the base version is more entangled with its module than the plan anticipated, stop and ask. Do not power through an entangled promotion.

Do not promote any other components. Do not refactor unrelated code. Do not touch canvas-layer files.

Update ui-audit/08-claim-b-plan.md by marking ConfirmDialog as completed with date and listing migrated consumers and deferred consumers.

When done print: file paths modified, count of consumers migrated, count of consumers deferred with reasons, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the three planning documents before touching any code.


## #ASSISTANT

Now reading `ConfirmDialog.tsx` (pre-execution requirement) and grepping for `window.confirm()` calls.


## #BASH
_Find all window.confirm() calls in frontend_

```bash
grep -rn "window\.confirm\(" /home/io/io-dev/io/frontend/src/ --include="*.tsx" --include="*.ts"
```


## #BASH
_Find all window.confirm calls in frontend_

```bash
grep -rn "window\.confirm" /home/io/io-dev/io/frontend/src/ --include="*.tsx" --include="*.ts"
```


## #ASSISTANT

Current values confirmed — all match the plan's issue table. Now reading the three `window.confirm()` call sites.


## #ASSISTANT

Need to see the full component structure of each file to add state correctly.


## #ASSISTANT

Let me find the main component function in CameraStreams.tsx to understand state placement.


## #BASH
_Find main component and state declarations in CameraStreams.tsx_

```bash
grep -n "export default function\|^function \|const \[delete\|setState\|useState" /home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx | head -40
```


## #BASH
_Find component state declarations in CameraStreams.tsx_

```bash
grep -n "export default function\|^function \|setCreating\|setEditing\|setAclFor\|setDeleteError\|removeMut\|useState" /home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx | head -50
```


## #ASSISTANT

Let me read the end of CameraStreams.tsx to see the full JSX return area.


## #BASH
_Get line counts for both files_

```bash
wc -l /home/io/io-dev/io/frontend/src/pages/designer/DesignerReportsList.tsx /home/io/io-dev/io/frontend/src/pages/designer/DesignerDashboardsList.tsx
```


## #ASSISTANT

All context gathered. Now executing all three steps in parallel — patch `ConfirmDialog.tsx` plus set up state and imports in each consumer.

**Step 1: Patch ConfirmDialog.tsx** (5 token fixes)


## #BASH
_Check exact whitespace for token replacement_

```bash
grep -n "io-text-on-accent" /home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx
```


## #ASSISTANT

Now fix the z-index and surface tokens:


## #ASSISTANT

Good. All 5 token fixes applied to `ConfirmDialog.tsx`. Now migrate the three `window.confirm()` sites.

**Step 2: DesignerReportsList.tsx**


## #ASSISTANT

Now add the ConfirmDialog to the return JSX, just before the closing `</div>`:


## #ASSISTANT

**Step 3: DesignerDashboardsList.tsx**


## #ASSISTANT

**Step 4: CameraStreams.tsx**


## #ASSISTANT

Now replace the inline `window.confirm` onClick:


## #ASSISTANT

Now add the ConfirmDialog alongside the other dialogs in the JSX:


## #ASSISTANT

Now run the build to verify no type errors:


## #BASH
_Build frontend to check for type errors_

```bash
cd /home/io/io-dev/io/frontend && pnpm build 2>&1 | tail -30
```


## #ASSISTANT

Build clean. Now update the plan to mark ConfirmDialog completed.


## #ASSISTANT

Now append execution notes to Section 2.4, before Section 3:


## #TURN_END

_2026-05-28T04:55:02+00:00_

---


## #PROMPT

_2026-05-28T05:08:45+00:00_

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
# Work Unit Log: workstream-3c-promote-confirmdialog

rea

Started: 2026-05-28T04:50:13+00:00
Session: 5eda53d1-1415-440c-a95c-991141fefe2b

---


## #EDIT `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx` (44→47 chars)

_2026-05-28T04:52:05+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx` (86→102 chars)

_2026-05-28T04:52:08+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx` (138→152 chars)

_2026-05-28T04:52:14+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx` (24→50 chars)

_2026-05-28T04:52:17+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerReportsList.tsx` (360→431 chars)

_2026-05-28T04:52:23+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerReportsList.tsx` (106→185 chars)

_2026-05-28T04:52:27+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerReportsList.tsx` (161→69 chars)

_2026-05-28T04:52:30+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerReportsList.tsx` (41→456 chars)

_2026-05-28T04:52:36+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerDashboardsList.tsx` (367→438 chars)

_2026-05-28T04:52:44+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerDashboardsList.tsx` (43→122 chars)

_2026-05-28T04:52:48+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerDashboardsList.tsx` (132→69 chars)

_2026-05-28T04:52:51+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerDashboardsList.tsx` (41→451 chars)

_2026-05-28T04:52:58+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx` (90→161 chars)

_2026-05-28T04:53:02+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx` (255→335 chars)

_2026-05-28T04:53:06+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx` (463→114 chars)

_2026-05-28T04:53:10+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx` (170→666 chars)

_2026-05-28T04:53:16+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (21→43 chars)

_2026-05-28T04:54:30+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (562→2817 chars)

_2026-05-28T04:54:52+00:00_


## #PROMPT

_2026-05-28T04:55:00+00:00_

```
~initprompt~ workstream-3c-promote-ConfirmDialog

Read ui-audit/08-claim-b-plan.md section two for the component promotions plan, specifically the entry for ConfirmDialog. Read ui-audit/05-claim-c-deferral.md to confirm exclusions. Read ui-audit/08b-constants-checkin.md to confirm prior work is clear.

Goal: promote ConfirmDialog per the plan. Work in three steps: promote to shared location, set the API to the minimal surface specified in the plan, then migrate consumers.

Step one, promote. Move or copy the base implementation from the source-of-truth location specified in the plan to its new shared location. Use the rationale recorded in the plan for choosing the base.

Step two, set API. Adjust the API to match the plan's minimal surface. Document any behavior the base version had that is being dropped, and flag any consumer that depended on that behavior. If a consumer needed behavior beyond the minimal API, add the requirement to ui-audit/08-claim-b-plan.md as a note on this component's entry rather than expanding the API; the consumer can be handled as a deferred migration.

Step three, migrate consumers. For each consumer identified in the plan, the migration should be a substitution: import the new component, replace the call site, verify behavior matches. For any consumer that requires more than substitution-level refactoring, do not refactor in this prompt. Record it as deferred consumer migration in the plan.

If the promotion reveals that the base version is more entangled with its module than the plan anticipated, stop and ask. Do not power through an entangled promotion.

Do not promote any other components. Do not refactor unrelated code. Do not touch canvas-layer files.

Update ui-audit/08-claim-b-plan.md by marking ConfirmDialog as completed with date and listing migrated consumers and deferred consumers.

When done print: file paths modified, count of consumers migrated, count of consumers deferred with reasons, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the three planning documents before touching any code.


## #ASSISTANT

Now reading `ConfirmDialog.tsx` (pre-execution requirement) and grepping for `window.confirm()` calls.


## #BASH
_Find all window.confirm() calls in frontend_

```bash
grep -rn "window\.confirm\(" /home/io/io-dev/io/frontend/src/ --include="*.tsx" --include="*.ts"
```


## #BASH
_Find all window.confirm calls in frontend_

```bash
grep -rn "window\.confirm" /home/io/io-dev/io/frontend/src/ --include="*.tsx" --include="*.ts"
```


## #ASSISTANT

Current values confirmed — all match the plan's issue table. Now reading the three `window.confirm()` call sites.


## #ASSISTANT

Need to see the full component structure of each file to add state correctly.


## #ASSISTANT

Let me find the main component function in CameraStreams.tsx to understand state placement.


## #BASH
_Find main component and state declarations in CameraStreams.tsx_

```bash
grep -n "export default function\|^function \|const \[delete\|setState\|useState" /home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx | head -40
```


## #BASH
_Find component state declarations in CameraStreams.tsx_

```bash
grep -n "export default function\|^function \|setCreating\|setEditing\|setAclFor\|setDeleteError\|removeMut\|useState" /home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx | head -50
```


## #ASSISTANT

Let me read the end of CameraStreams.tsx to see the full JSX return area.


## #BASH
_Get line counts for both files_

```bash
wc -l /home/io/io-dev/io/frontend/src/pages/designer/DesignerReportsList.tsx /home/io/io-dev/io/frontend/src/pages/designer/DesignerDashboardsList.tsx
```


## #ASSISTANT

All context gathered. Now executing all three steps in parallel — patch `ConfirmDialog.tsx` plus set up state and imports in each consumer.

**Step 1: Patch ConfirmDialog.tsx** (5 token fixes)


## #BASH
_Check exact whitespace for token replacement_

```bash
grep -n "io-text-on-accent" /home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx
```


## #ASSISTANT

Now fix the z-index and surface tokens:


## #ASSISTANT

Good. All 5 token fixes applied to `ConfirmDialog.tsx`. Now migrate the three `window.confirm()` sites.

**Step 2: DesignerReportsList.tsx**


## #ASSISTANT

Now add the ConfirmDialog to the return JSX, just before the closing `</div>`:


## #ASSISTANT

**Step 3: DesignerDashboardsList.tsx**


## #ASSISTANT

**Step 4: CameraStreams.tsx**


## #ASSISTANT

Now replace the inline `window.confirm` onClick:


## #ASSISTANT

Now add the ConfirmDialog alongside the other dialogs in the JSX:


## #ASSISTANT

Now run the build to verify no type errors:


## #BASH
_Build frontend to check for type errors_

```bash
cd /home/io/io-dev/io/frontend && pnpm build 2>&1 | tail -30
```


## #ASSISTANT

Build clean. Now update the plan to mark ConfirmDialog completed.


## #ASSISTANT

Now append execution notes to Section 2.4, before Section 3:


## #TURN_END

_2026-05-28T04:55:02+00:00_

---
---



DIFF OF CHANGES:
---
diff --git a/frontend/src/pages/designer/DesignerDashboardsList.tsx b/frontend/src/pages/designer/DesignerDashboardsList.tsx
index ee8494eb..45243b75 100644
--- a/frontend/src/pages/designer/DesignerDashboardsList.tsx
+++ b/frontend/src/pages/designer/DesignerDashboardsList.tsx
@@ -8,6 +8,7 @@ import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { dashboardsApi, type Dashboard } from "../../api/dashboards";
 import { useContextMenu } from "../../shared/hooks/useContextMenu";
 import ContextMenu from "../../shared/components/ContextMenu";
+import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
 
 // ---------------------------------------------------------------------------
 // Thumbnail
@@ -303,6 +304,7 @@ export default function DesignerDashboardsList() {
   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const [search, setSearch] = useState("");
+  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
 
   const query = useQuery({
     queryKey: ["dashboards"],
@@ -331,9 +333,7 @@ export default function DesignerDashboardsList() {
   );
 
   function handleDelete(id: string) {
-    if (window.confirm("Delete this dashboard?")) {
-      deleteMutation.mutate(id);
-    }
+    setConfirmDeleteId(id);
   }
 
   return (
@@ -512,6 +512,17 @@ export default function DesignerDashboardsList() {
           </div>
         )}
       </div>
+      <ConfirmDialog
+        open={confirmDeleteId !== null}
+        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
+        title="Delete dashboard?"
+        description="Delete this dashboard? This cannot be undone."
+        confirmLabel="Delete"
+        variant="danger"
+        onConfirm={() => {
+          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
+        }}
+      />
     </div>
   );
 }
diff --git a/frontend/src/pages/designer/DesignerReportsList.tsx b/frontend/src/pages/designer/DesignerReportsList.tsx
index 03cf9730..83999e10 100644
--- a/frontend/src/pages/designer/DesignerReportsList.tsx
+++ b/frontend/src/pages/designer/DesignerReportsList.tsx
@@ -4,6 +4,7 @@ import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { reportsApi, type ReportTemplate } from "../../api/reports";
 import { useContextMenu } from "../../shared/hooks/useContextMenu";
 import ContextMenu from "../../shared/components/ContextMenu";
+import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
 
 // ---------------------------------------------------------------------------
 // Category badge colors
@@ -287,6 +288,7 @@ export default function DesignerReportsList() {
   const queryClient = useQueryClient();
   const [search, setSearch] = useState("");
   const [activeCategory, setActiveCategory] = useState("All");
+  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
 
   const query = useQuery({
     queryKey: ["report-templates"],
@@ -325,9 +327,7 @@ export default function DesignerReportsList() {
   const customTemplates = filtered.filter((t) => !t.is_system_template);
 
   function handleDelete(id: string) {
-    if (window.confirm("Delete this report template? This cannot be undone.")) {
-      deleteMutation.mutate(id);
-    }
+    setConfirmDeleteId(id);
   }
 
   return (
@@ -566,6 +566,17 @@ export default function DesignerReportsList() {
           </>
         )}
       </div>
+      <ConfirmDialog
+        open={confirmDeleteId !== null}
+        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
+        title="Delete template?"
+        description="Delete this report template? This cannot be undone."
+        confirmLabel="Delete"
+        variant="danger"
+        onConfirm={() => {
+          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
+        }}
+      />
     </div>
   );
 }
diff --git a/frontend/src/pages/settings/CameraStreams.tsx b/frontend/src/pages/settings/CameraStreams.tsx
index c2da6c69..b6dc3408 100644
--- a/frontend/src/pages/settings/CameraStreams.tsx
+++ b/frontend/src/pages/settings/CameraStreams.tsx
@@ -1,5 +1,6 @@
 import React, { useState } from "react";
 import * as Dialog from "@radix-ui/react-dialog";
+import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import {
   videoStreamsApi,
@@ -802,6 +803,7 @@ export default function CameraStreamsTab() {
   const [editing, setEditing] = useState<VideoStream | null>(null);
   const [aclFor, setAclFor] = useState<VideoStream | null>(null);
   const [deleteError, setDeleteError] = useState<string | null>(null);
+  const [confirmDelete, setConfirmDelete] = useState<VideoStream | null>(null);
 
   const streamsQuery = useQuery({
     queryKey: ["video-streams"],
@@ -999,16 +1001,7 @@ export default function CameraStreamsTab() {
                           borderColor: "rgba(239,68,68,0.3)",
                         }}
                         disabled={removeMut.isPending}
-                        onClick={() => {
-                          if (
-                            window.confirm(
-                              `Delete "${s.name}"? This cannot be undone.`,
-                            )
-                          ) {
-                            setDeleteError(null);
-                            removeMut.mutate(s.id);
-                          }
-                        }}
+                        onClick={() => setConfirmDelete(s)}
                       >
                         Delete
                       </button>
@@ -1033,6 +1026,20 @@ export default function CameraStreamsTab() {
           onClose={() => setAclFor(null)}
         />
       )}
+      <ConfirmDialog
+        open={confirmDelete !== null}
+        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
+        title="Delete camera stream?"
+        description={confirmDelete ? `Delete "${confirmDelete.name}"? This cannot be undone.` : ""}
+        confirmLabel="Delete"
+        variant="danger"
+        onConfirm={() => {
+          if (confirmDelete) {
+            setDeleteError(null);
+            removeMut.mutate(confirmDelete.id);
+          }
+        }}
+      />
     </SettingsPageLayout>
   );
 }
diff --git a/frontend/src/shared/components/ConfirmDialog.tsx b/frontend/src/shared/components/ConfirmDialog.tsx
index deeadb6c..283c7666 100644
--- a/frontend/src/shared/components/ConfirmDialog.tsx
+++ b/frontend/src/shared/components/ConfirmDialog.tsx
@@ -36,7 +36,7 @@ export function ConfirmDialog({
       : {
           padding: "8px 16px",
           background: "var(--io-accent)",
-          color: "var(--io-text-on-accent)",
+          color: "var(--io-accent-foreground)",
           border: "none",
           borderRadius: "var(--io-radius)",
           fontSize: "13px",
@@ -52,7 +52,7 @@ export function ConfirmDialog({
             position: "fixed",
             inset: 0,
             background: "var(--io-overlay, rgba(0,0,0,0.5))",
-            zIndex: 100,
+            zIndex: "var(--io-z-modal)",
           }}
         />
         <Dialog.Content
@@ -63,13 +63,13 @@ export function ConfirmDialog({
             top: "50%",
             left: "50%",
             transform: "translate(-50%, -50%)",
-            background: "var(--io-surface-secondary)",
+            background: "var(--io-surface-elevated)",
             border: "1px solid var(--io-border)",
-            borderRadius: "10px",
+            borderRadius: "var(--io-radius-lg)",
             padding: "24px",
             width: "420px",
             maxWidth: "calc(100vw - 32px)",
-            zIndex: 101,
+            zIndex: "calc(var(--io-z-modal) + 1)",
           }}
         >
           <Dialog.Title
diff --git a/ui-audit/08-claim-b-plan.md b/ui-audit/08-claim-b-plan.md
index 243b8554..8d59a79f 100644
--- a/ui-audit/08-claim-b-plan.md
+++ b/ui-audit/08-claim-b-plan.md
@@ -368,7 +368,7 @@ Visual spec derived from `04-recommendations.md` Cat 11:
 
 ---
 
-### 2.4 ConfirmDialog
+### 2.4 ConfirmDialog — **DONE 2026-05-28**
 
 #### Current location
 
@@ -410,6 +410,19 @@ There is no second `ConfirmDialog` implementation to merge. `DesignerLeftPalette
 
 The 15 existing import sites already use the component correctly. After the token fixes, they inherit the corrected values automatically. No call-site migration required for existing consumers.
 
+**Execution notes (2026-05-28):**
+- Pre-execution read of `ConfirmDialog.tsx` confirmed all 5 current values matched the issue table exactly: overlay `zIndex: 100`, content `zIndex: 101`, content `background: var(--io-surface-secondary)`, content `borderRadius: "10px"`, confirm button `color: var(--io-text-on-accent)`.
+- Token fixes applied to `shared/components/ConfirmDialog.tsx`: overlay `zIndex: 100` → `"var(--io-z-modal)"`, content `zIndex: 101` → `"calc(var(--io-z-modal) + 1)"`, content bg `var(--io-surface-secondary)` → `var(--io-surface-elevated)`, content borderRadius `"10px"` → `var(--io-radius-lg)`, confirm text color `var(--io-text-on-accent)` → `var(--io-accent-foreground)`. All 15 existing consumers inherit changes automatically; no call-site changes needed.
+- `window.confirm()` pre-execution grep: 5 calls found (matches plan). 2 in dashboards module (out of scope per Section 7 Item 8); 3 in scope.
+- **`DesignerReportsList.tsx`:** `handleDelete` changed to set state; ConfirmDialog added to JSX. Message preserved verbatim: "Delete this report template? This cannot be undone." `variant="danger"`.
+- **`DesignerDashboardsList.tsx`:** Same pattern. Message: "Delete this dashboard? This cannot be undone." `variant="danger"`.
+- **`CameraStreams.tsx`:** Inline onClick replaced with `setConfirmDelete(s)`. ConfirmDialog renders dynamic message `Delete "${confirmDelete.name}"? This cannot be undone.` Stores full `VideoStream` object in state to access `.name` for the description. `setDeleteError(null)` preserved in `onConfirm` (was in the original onClick). `variant="danger"`.
+- **createPortal check:** None of the 3 consumer components are inside a `react-grid-layout` transform. No portal needed.
+- **Consumers migrated (window.confirm()):** 3 (`DesignerReportsList.tsx`, `DesignerDashboardsList.tsx`, `CameraStreams.tsx`)
+- **Consumers deferred (window.confirm()):** 2 — `dashboards/index.tsx` and `PlaylistManager.tsx` (out of scope per Section 7 Item 8; documented for dashboards-module pass).
+- **Consumers deferred (existing ConfirmDialog users needing review):** `DesignerLeftPalette.tsx` local `DeleteConfirmDialog` (DC-5 in Section 6; not a substitution-level migration).
+- `pnpm build` passed with no type errors.
+
 ---
 
 ## Section 3 — Sequencing
---

FULL FILE CONTENTS (for surrounding-code analysis):
---

--- File: /home/io/io-dev/io/frontend/src/pages/designer/DesignerDashboardsList.tsx ---
// Re-export DashboardsPage with designer breadcrumb context.
// This page is reached via /designer/dashboards and shows the same
// dashboard list but with a Designer breadcrumb in the header.

import { useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardsApi, type Dashboard } from "../../api/dashboards";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------

function DashboardThumbnail({ name }: { name: string }) {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = hash % 360;
  const hue2 = (hue + 40) % 360;
  return (
    <div
      style={{
        height: "100px",
        borderRadius: "4px 4px 0 0",
        background: `linear-gradient(135deg, hsl(${hue},60%,20%) 0%, hsl(${hue2},50%,15%) 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "10px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(2, 1fr)",
          gap: "5px",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: `hsla(${(hue + i * 30) % 360},40%,50%,0.15)`,
              border: `1px solid hsla(${(hue + i * 30) % 360},40%,50%,0.3)`,
              borderRadius: 3,
            }}
          />
        ))}
      </div>
      <span
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: "20px",
          opacity: 0.5,
        }}
      >
        ▦
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardCard
// ---------------------------------------------------------------------------

const DashboardCard = memo(function DashboardCard({
  dashboard,
  onEdit,
  onDelete,
}: {
  dashboard: Dashboard;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { menuState, handleContextMenu, closeMenu } =
    useContextMenu<Dashboard>();

  return (
    <div
      style={{
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        position: "relative",
      }}
      onClick={() => navigate(`/designer/dashboards/${dashboard.id}/edit`)}
      onContextMenu={(e) => handleContextMenu(e, dashboard)}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "var(--io-accent)";
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 4px 16px rgba(0,0,0,0.2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "var(--io-border)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      <DashboardThumbnail name={dashboard.name} />

      <div style={{ padding: "10px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "6px",
            marginBottom: "4px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {dashboard.name}
          </span>

          <div
            style={{ position: "relative", flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                background: "none",
                border: "none",
                color: "var(--io-text-muted)",
                cursor: "pointer",
                padding: "2px 4px",
                fontSize: "14px",
              }}
            >
              ⋯
            </button>

            {menuOpen && (
              <>
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 98 }}
                />
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 4px)",
                    minWidth: "140px",
                    background: "var(--io-surface-elevated)",
                    border: "1px solid var(--io-border)",
                    borderRadius: "var(--io-radius)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                    zIndex: 99,
                    overflow: "hidden",
                  }}
                >
                  {[
                    {
                      label: "Edit",
                      action: () => {
                        onEdit(dashboard.id);
                        setMenuOpen(false);
                      },
                      danger: false,
                      disabled: false,
                    },
                    {
                      label: "Delete",
                      action: () => {
                        onDelete(dashboard.id);
                        setMenuOpen(false);
                      },
                      danger: true,
                      disabled: dashboard.is_system,
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.disabled ? undefined : item.action}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        background: "none",
                        border: "none",
                        color: item.danger
                          ? "var(--io-danger, #ef4444)"
                          : "var(--io-text-secondary)",
                        fontSize: "13px",
                        cursor: item.disabled ? "not-allowed" : "pointer",
                        textAlign: "left",
                        opacity: item.disabled ? 0.4 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!item.disabled) {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.background = "var(--io-surface-secondary)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "transparent";
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {dashboard.description && (
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "var(--io-text-secondary)",
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {dashboard.description}
          </p>
        )}
      </div>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            {
              label: "Open",
              onClick: () => {
                closeMenu();
                onEdit(dashboard.id);
              },
            },
            {
              label: "Open in New Tab",
              onClick: () => {
                closeMenu();
                window.open(
                  `/designer/dashboards/${dashboard.id}/edit`,
                  "_blank",
                );
              },
            },
            {
              label: "Duplicate",
              permission: "designer:write",
              onClick: () => {
                closeMenu();
              },
            },
            {
              label: "Delete",
              danger: true,
              divider: true,
              disabled: dashboard.is_system,
              onClick: () => {
                closeMenu();
                onDelete(dashboard.id);
              },
            },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// DesignerDashboardsList
// ---------------------------------------------------------------------------

export default function DesignerDashboardsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["dashboards"],
    queryFn: async () => {
      const r = await dashboardsApi.list();
      if (!r.success) throw new Error(r.error.message);
      return r.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await dashboardsApi.delete(id);
      if (!r.success) throw new Error(r.error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });

  const dashboards = (query.data ?? []).filter(
    (d) => !d.name.startsWith("__autosave_"),
  );
  const filtered = dashboards.filter(
    (d) => !search || d.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleDelete(id: string) {
    setConfirmDeleteId(id);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--io-surface-primary)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "0 20px",
          height: "48px",
          flexShrink: 0,
          background: "var(--io-surface)",
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        <button
          onClick={() => navigate("/designer")}
          style={{
            background: "none",
            border: "none",
            color: "var(--io-text-muted)",
            cursor: "pointer",
            fontSize: "13px",
            padding: "4px 0",
          }}
        >
          ← Designer
        </button>
        <span style={{ color: "var(--io-border)" }}>/</span>
        <span
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          Dashboards
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate("/designer/dashboards/new")}
          style={{
            padding: "6px 14px",
            background: "var(--io-accent)",
            border: "none",
            borderRadius: "var(--io-radius)",
            color: "#09090b",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          + New Dashboard
        </button>
      </div>

      {/* Search */}
      <div
        style={{
          padding: "10px 20px",
          background: "var(--io-surface)",
          borderBottom: "1px solid var(--io-border)",
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          placeholder="Search dashboards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "280px",
            padding: "7px 10px",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-primary)",
            fontSize: "13px",
            outline: "none",
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {query.isLoading && (
          <div style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
            Loading dashboards...
          </div>
        )}

        {query.isError && (
          <div
            style={{
              padding: "20px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-danger, #ef4444)",
              fontSize: "13px",
            }}
          >
            Failed to load dashboards.
          </div>
        )}

        {!query.isLoading && !query.isError && filtered.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "80px 20px",
              gap: "12px",
              color: "var(--io-text-muted)",
            }}
          >
            <span style={{ fontSize: "48px", opacity: 0.3 }}>▦</span>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--io-text-secondary)",
              }}
            >
              {search ? "No dashboards match your search" : "No dashboards yet"}
            </p>
            {!search && (
              <button
                onClick={() => navigate("/designer/dashboards/new")}
                style={{
                  marginTop: "8px",
                  padding: "7px 16px",
                  background: "var(--io-accent)",
                  border: "none",
                  borderRadius: "var(--io-radius)",
                  color: "#09090b",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                + New Dashboard
              </button>
            )}
          </div>
        )}

        {!query.isLoading && filtered.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {filtered.map((d) => (
              <DashboardCard
                key={d.id}
                dashboard={d}
                onEdit={(id) => navigate(`/designer/dashboards/${id}/edit`)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        title="Delete dashboard?"
        description="Delete this dashboard? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
        }}
      />
    </div>
  );
}

--- File: /home/io/io-dev/io/frontend/src/pages/designer/DesignerReportsList.tsx ---
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reportsApi, type ReportTemplate } from "../../api/reports";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";

// ---------------------------------------------------------------------------
// Category badge colors
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  executive: { bg: "var(--io-accent-subtle)", fg: "var(--io-accent)" },
  compliance: { bg: "rgba(239,68,68,0.12)", fg: "#ef4444" },
  maintenance: { bg: "rgba(251,191,36,0.12)", fg: "#f59e0b" },
  analytics: { bg: "rgba(99,102,241,0.12)", fg: "#818cf8" },
  operations: { bg: "rgba(34,197,94,0.12)", fg: "#22c55e" },
};

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const colors = CATEGORY_COLORS[category] ?? {
    bg: "var(--io-surface-secondary)",
    fg: "var(--io-text-muted)",
  };
  return (
    <span
      style={{
        fontSize: "10px",
        padding: "1px 6px",
        borderRadius: "100px",
        background: colors.bg,
        color: colors.fg,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "capitalize",
      }}
    >
      {category}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ReportTemplateRow
// ---------------------------------------------------------------------------

function ReportTemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: ReportTemplate;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { menuState, handleContextMenu, closeMenu } =
    useContextMenu<ReportTemplate>();
  const formattedDate = new Date(template.created_at).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        alignItems: "center",
        gap: "12px",
        padding: "10px 16px",
        borderBottom: "1px solid var(--io-border)",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background =
          "var(--io-surface-elevated)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
      onContextMenu={(e) => handleContextMenu(e, template)}
    >
      {/* Name + description */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: "2px",
          }}
        >
          {template.name}
        </div>
        {template.description && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {template.description}
          </div>
        )}
      </div>

      {/* Category badge */}
      <CategoryBadge category={template.category} />

      {/* Date */}
      <span
        style={{
          fontSize: "12px",
          color: "var(--io-text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {formattedDate}
      </span>

      {/* Actions menu */}
      <div
        style={{ position: "relative" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            background: "none",
            border: "none",
            color: "var(--io-text-muted)",
            cursor: "pointer",
            padding: "4px 8px",
            fontSize: "14px",
            borderRadius: 4,
          }}
        >
          ⋯
        </button>

        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 98 }}
            />
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                minWidth: "140px",
                background: "var(--io-surface-elevated)",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                zIndex: 99,
                overflow: "hidden",
              }}
            >
              {[
                {
                  label: "Edit",
                  action: () => {
                    onEdit(template.id);
                    setMenuOpen(false);
                  },
                  danger: false,
                  disabled: template.is_system_template,
                },
                {
                  label: "Delete",
                  action: () => {
                    onDelete(template.id);
                    setMenuOpen(false);
                  },
                  danger: true,
                  disabled: template.is_system_template,
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.disabled ? undefined : item.action}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "none",
                    border: "none",
                    color: item.danger
                      ? "var(--io-danger, #ef4444)"
                      : "var(--io-text-secondary)",
                    fontSize: "13px",
                    cursor: item.disabled ? "not-allowed" : "pointer",
                    textAlign: "left",
                    display: "block",
                    opacity: item.disabled ? 0.4 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!item.disabled) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "var(--io-surface-secondary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "transparent";
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            {
              label: "Open",
              onClick: () => {
                closeMenu();
                onEdit(template.id);
              },
            },
            {
              label: "Open in New Tab",
              onClick: () => {
                closeMenu();
                window.open(`/designer/reports/${template.id}/edit`, "_blank");
              },
            },
            {
              label: "Duplicate",
              permission: "designer:write",
              onClick: () => {
                closeMenu();
              },
            },
            {
              label: "Delete",
              danger: true,
              divider: true,
              disabled: template.is_system_template,
              onClick: () => {
                closeMenu();
                onDelete(template.id);
              },
            },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DesignerReportsList
// ---------------------------------------------------------------------------

const CATEGORIES = [
  "All",
  "executive",
  "compliance",
  "maintenance",
  "analytics",
  "operations",
];

export default function DesignerReportsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["report-templates"],
    queryFn: async () => {
      const r = await reportsApi.listTemplates({ limit: 200 });
      if (!r.success) throw new Error(r.error.message);
      return r.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await reportsApi.deleteTemplate(id);
      if (!r.success) throw new Error(r.error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["report-templates"] });
    },
  });

  const templates = (query.data ?? []).filter(
    (t) => !t.name.startsWith("__autosave_"),
  );
  const filtered = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || t.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Separate system vs custom
  const systemTemplates = filtered.filter((t) => t.is_system_template);
  const customTemplates = filtered.filter((t) => !t.is_system_template);

  function handleDelete(id: string) {
    setConfirmDeleteId(id);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--io-surface-primary)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "0 20px",
          height: "48px",
          flexShrink: 0,
          background: "var(--io-surface)",
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        <button
          onClick={() => navigate("/designer")}
          style={{
            background: "none",
            border: "none",
            color: "var(--io-text-muted)",
            cursor: "pointer",
            fontSize: "13px",
            padding: "4px 0",
          }}
        >
          ← Designer
        </button>
        <span style={{ color: "var(--io-border)" }}>/</span>
        <span
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          Report Templates
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate("/designer/reports/new")}
          style={{
            padding: "6px 14px",
            background: "var(--io-accent)",
            border: "none",
            borderRadius: "var(--io-radius)",
            color: "#09090b",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          + New Template
        </button>
      </div>

      {/* Filters */}
      <div
        style={{
          padding: "10px 20px 0",
          background: "var(--io-surface)",
          borderBottom: "1px solid var(--io-border)",
          flexShrink: 0,
        }}
      >
        <div style={{ marginBottom: "10px" }}>
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "280px",
              padding: "7px 10px",
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-text-primary)",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          {CATEGORIES.map((cat) => {
            const isActive = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "0 16px",
                  height: "36px",
                  background: "none",
                  border: "none",
                  borderBottom: isActive
                    ? "2px solid var(--io-accent)"
                    : "2px solid transparent",
                  color: isActive
                    ? "var(--io-accent)"
                    : "var(--io-text-secondary)",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  textTransform: "capitalize",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {query.isLoading && (
          <div
            style={{
              padding: "20px",
              color: "var(--io-text-muted)",
              fontSize: "13px",
            }}
          >
            Loading templates...
          </div>
        )}

        {query.isError && (
          <div
            style={{
              margin: "20px",
              padding: "20px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-danger, #ef4444)",
              fontSize: "13px",
            }}
          >
            Failed to load report templates.
          </div>
        )}

        {!query.isLoading && !query.isError && (
          <>
            {/* Custom templates section */}
            {customTemplates.length > 0 && (
              <div style={{ borderBottom: "1px solid var(--io-border)" }}>
                <div
                  style={{
                    padding: "10px 16px 8px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--io-text-muted)",
                  }}
                >
                  Custom Templates ({customTemplates.length})
                </div>
                {customTemplates.map((t) => (
                  <ReportTemplateRow
                    key={t.id}
                    template={t}
                    onEdit={(id) => navigate(`/designer/reports/${id}/edit`)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {/* System templates section */}
            {systemTemplates.length > 0 && (
              <div>
                <div
                  style={{
                    padding: "10px 16px 8px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--io-text-muted)",
                  }}
                >
                  System Templates ({systemTemplates.length}) — read-only
                </div>
                {systemTemplates.map((t) => (
                  <ReportTemplateRow
                    key={t.id}
                    template={t}
                    onEdit={(id) => navigate(`/designer/reports/${id}/edit`)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {filtered.length === 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "80px 20px",
                  gap: "12px",
                  color: "var(--io-text-muted)",
                }}
              >
                <span style={{ fontSize: "48px", opacity: 0.3 }}>📄</span>
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--io-text-secondary)",
                  }}
                >
                  {search || activeCategory !== "All"
                    ? "No templates match your filters"
                    : "No custom templates yet"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        title="Delete template?"
        description="Delete this report template? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
        }}
      />
    </div>
  );
}

--- File: /home/io/io-dev/io/frontend/src/pages/settings/CameraStreams.tsx ---
import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  videoStreamsApi,
  type VideoStream,
  type CreateVideoStreamInput,
  type VideoStreamAccess,
} from "../../api/videoStreams";
import { rolesApi, type Role } from "../../api/roles";
import { usersApi, type User } from "../../api/users";
import SettingsPageLayout from "./SettingsPageLayout";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnSmall,
  cellStyle,
} from "./settingsStyles";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: "var(--io-radius)",
        padding: "10px 14px",
        color: "var(--io-danger)",
        fontSize: "13px",
        marginBottom: "16px",
      }}
    >
      {message}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "rgba(34,197,94,0.1)",
        border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: "var(--io-radius)",
        padding: "10px 14px",
        color: "var(--io-success, #22c55e)",
        fontSize: "13px",
        marginBottom: "16px",
      }}
    >
      {message}
    </div>
  );
}

function ModalContent({
  title,
  children,
  width = 560,
}: {
  title: string;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
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
          width,
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
// RelayInputsEditor — edit the go2rtc input URL list
// ---------------------------------------------------------------------------
function RelayInputsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function setLine(i: number, text: string) {
    const next = [...value];
    next[i] = text;
    onChange(next);
  }
  function removeLine(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function addLine() {
    onChange([...value, ""]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {value.map((url, i) => (
        <div key={i} style={{ display: "flex", gap: "6px" }}>
          <input
            style={{
              ...inputStyle,
              flex: 1,
              fontFamily: "ui-monospace, monospace",
              fontSize: "12px",
            }}
            value={url}
            onChange={(e) => setLine(i, e.target.value)}
            placeholder="rtsp://camera.local/stream1"
          />
          <button
            type="button"
            style={{
              ...btnSmall,
              color: "var(--io-danger)",
              borderColor: "rgba(239,68,68,0.3)",
            }}
            onClick={() => removeLine(i)}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" style={btnSmall} onClick={addLine}>
        + Add URL
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CameraStreamDialog — create and edit
// ---------------------------------------------------------------------------
type StreamFormState = {
  name: string;
  description: string;
  visibility: VideoStream["visibility"];
  connection_mode: VideoStream["connection_mode"];
  direct_url: string;
  relay_inputs: string[];
};

function defaultFormState(stream: VideoStream | null): StreamFormState {
  return {
    name: stream?.name ?? "",
    description: stream?.description ?? "",
    visibility: stream?.visibility ?? "managed",
    connection_mode: stream?.connection_mode ?? "relay",
    direct_url: stream?.direct_url ?? "",
    relay_inputs: stream?.relay_config?.go2rtc_inputs ?? [""],
  };
}

function validateForm(form: StreamFormState): string | null {
  if (!form.name.trim()) return "Name is required.";
  if (
    (form.connection_mode === "direct" || form.connection_mode === "auto") &&
    !form.direct_url.trim()
  ) {
    return "Direct URL is required for the selected connection mode.";
  }
  if (
    (form.connection_mode === "relay" || form.connection_mode === "auto") &&
    form.relay_inputs.every((u) => !u.trim())
  ) {
    return "At least one relay input URL is required for the selected connection mode.";
  }
  return null;
}

function buildPayload(form: StreamFormState): CreateVideoStreamInput {
  const payload: CreateVideoStreamInput = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    visibility: form.visibility,
    connection_mode: form.connection_mode,
  };
  if (form.connection_mode === "direct" || form.connection_mode === "auto") {
    payload.direct_url = form.direct_url.trim() || undefined;
  }
  if (form.connection_mode === "relay" || form.connection_mode === "auto") {
    const inputs = form.relay_inputs.map((u) => u.trim()).filter(Boolean);
    payload.relay_config = { go2rtc_inputs: inputs };
  }
  return payload;
}

function CameraStreamDialog({
  stream,
  onClose,
}: {
  stream: VideoStream | null;
  onClose: () => void;
}) {
  const isNew = stream === null;
  const qc = useQueryClient();
  const [form, setForm] = useState<StreamFormState>(() =>
    defaultFormState(stream),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "ok" | "fail"
  >("idle");
  const [testMessage, setTestMessage] = useState("");

  function patch(partial: Partial<StreamFormState>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  const saveMut = useMutation({
    mutationFn: (payload: CreateVideoStreamInput) =>
      isNew
        ? videoStreamsApi.create(payload)
        : videoStreamsApi.update(stream!.id, payload),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["video-streams"] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const err = validateForm(form);
    if (err) {
      setFormError(err);
      return;
    }
    saveMut.mutate(buildPayload(form));
  }

  async function handleTestConnection() {
    if (!stream) return;
    setTestStatus("testing");
    setTestMessage("");
    const result = await videoStreamsApi.token(stream.id);
    if (result.success) {
      setTestStatus("ok");
      setTestMessage("go2rtc connection confirmed.");
    } else {
      setTestStatus("fail");
      setTestMessage(result.error.message);
    }
  }

  const showDirectUrl =
    form.connection_mode === "direct" || form.connection_mode === "auto";
  const showRelay =
    form.connection_mode === "relay" || form.connection_mode === "auto";

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ModalContent
        title={isNew ? "Add Camera Stream" : `Edit: ${stream?.name}`}
      >
        {formError && <ErrorBanner message={formError} />}
        {testStatus === "ok" && <SuccessBanner message={testMessage} />}
        {testStatus === "fail" && <ErrorBanner message={testMessage} />}

        <form onSubmit={handleSubmit}>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label style={labelStyle}>Name *</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Line 3 Camera"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <input
                style={inputStyle}
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div>
                <label style={labelStyle}>Visibility</label>
                <select
                  style={inputStyle}
                  value={form.visibility}
                  onChange={(e) =>
                    patch({
                      visibility: e.target.value as VideoStream["visibility"],
                    })
                  }
                >
                  <option value="public">Public — everyone can view</option>
                  <option value="managed">
                    Managed — admin adds, anyone views
                  </option>
                  <option value="private">
                    Private — explicit ACL required
                  </option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Connection Mode</label>
                <select
                  style={inputStyle}
                  value={form.connection_mode}
                  onChange={(e) =>
                    patch({
                      connection_mode: e.target
                        .value as VideoStream["connection_mode"],
                    })
                  }
                >
                  <option value="direct">
                    Direct — browser reaches camera
                  </option>
                  <option value="relay">Relay — go2rtc proxy</option>
                  <option value="auto">
                    Auto — direct first, relay fallback
                  </option>
                </select>
              </div>
            </div>

            {showDirectUrl && (
              <div>
                <label style={labelStyle}>
                  Direct URL{form.connection_mode === "direct" ? " *" : ""}
                </label>
                <input
                  style={{
                    ...inputStyle,
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "12px",
                  }}
                  value={form.direct_url}
                  onChange={(e) => patch({ direct_url: e.target.value })}
                  placeholder="rtsp://camera.local/stream1"
                />
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "11px",
                    color: "var(--io-text-muted)",
                  }}
                >
                  Direct mode requires the browser to reach the camera; intended
                  for private networks.
                </p>
              </div>
            )}

            {showRelay && (
              <div>
                <label style={labelStyle}>
                  go2rtc Input URLs
                  {form.connection_mode === "relay" ? " *" : ""}
                </label>
                <RelayInputsEditor
                  value={form.relay_inputs}
                  onChange={(inputs) => patch({ relay_inputs: inputs })}
                />
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
              marginTop: "24px",
            }}
          >
            <div>
              {!isNew && showRelay && (
                <button
                  type="button"
                  style={btnSmall}
                  disabled={testStatus === "testing"}
                  onClick={handleTestConnection}
                >
                  {testStatus === "testing" ? "Testing…" : "Test Connection"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Dialog.Close asChild>
                <button type="button" style={btnSecondary}>
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                style={btnPrimary}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending
                  ? "Saving…"
                  : isNew
                    ? "Add Stream"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </ModalContent>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// CameraStreamAclDialog — manage ACL grants for a private stream
// ---------------------------------------------------------------------------
type EntityType = "role" | "user";

function CameraStreamAclDialog({
  stream,
  onClose,
}: {
  stream: VideoStream;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [addType, setAddType] = useState<EntityType>("role");
  const [addId, setAddId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const accessQuery = useQuery({
    queryKey: ["video-stream-access", stream.id],
    queryFn: async () => {
      const result = await videoStreamsApi.listAccess(stream.id);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const result = await rolesApi.list();
      if (!result.success) throw new Error(result.error.message);
      return (result.data as { data: Role[] }).data;
    },
  });

  const usersQuery = useQuery({
    queryKey: ["users", { page: 1, limit: 200 }],
    queryFn: async () => {
      const result = await usersApi.list({ page: 1, limit: 200 });
      if (!result.success) throw new Error(result.error.message);
      return (result.data as { data: User[] }).data;
    },
  });

  const addMut = useMutation({
    mutationFn: ({ type, id }: { type: EntityType; id: string }) =>
      videoStreamsApi.addAccess(stream.id, type, id),
    onSuccess: (result) => {
      if (!result.success) {
        setAddError(result.error.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["video-stream-access", stream.id] });
      setAddId("");
      setAddError(null);
    },
  });

  const removeMut = useMutation({
    mutationFn: (grant: VideoStreamAccess) =>
      videoStreamsApi.removeAccess(
        stream.id,
        grant.entity_type,
        grant.entity_id,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-stream-access", stream.id] });
    },
  });

  const grants = accessQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const users = usersQuery.data ?? [];

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!addId) {
      setAddError("Select a role or user to add.");
      return;
    }
    addMut.mutate({ type: addType, id: addId });
  }

  function labelFor(grant: VideoStreamAccess): string {
    if (grant.entity_name) return grant.entity_name;
    if (grant.entity_type === "role") {
      const r = roles.find((x) => x.id === grant.entity_id);
      return r ? r.display_name : grant.entity_id;
    }
    const u = users.find((x) => x.id === grant.entity_id);
    return u ? (u.display_name ?? u.username) : grant.entity_id;
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ModalContent title={`Access — ${stream.name}`} width={480}>
        <div style={{ marginBottom: "20px" }}>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: "13px",
              color: "var(--io-text-muted)",
            }}
          >
            Only listed roles and users can view this stream.
          </p>

          {accessQuery.isLoading && (
            <div
              style={{
                padding: "12px",
                color: "var(--io-text-muted)",
                fontSize: "13px",
              }}
            >
              Loading…
            </div>
          )}

          {grants.length === 0 && !accessQuery.isLoading && (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                color: "var(--io-text-muted)",
                fontSize: "13px",
                border: "1px dashed var(--io-border)",
                borderRadius: "var(--io-radius)",
                marginBottom: "16px",
              }}
            >
              No access grants — no one can view this stream.
            </div>
          )}

          {grants.length > 0 && (
            <div
              style={{
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                overflow: "hidden",
                marginBottom: "16px",
              }}
            >
              {grants.map((grant, i) => (
                <div
                  key={`${grant.entity_type}:${grant.entity_id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderBottom:
                      i < grants.length - 1
                        ? "1px solid var(--io-border-subtle)"
                        : undefined,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--io-text-muted)",
                        textTransform: "uppercase",
                        marginRight: "8px",
                      }}
                    >
                      {grant.entity_type}
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        color: "var(--io-text-primary)",
                      }}
                    >
                      {labelFor(grant)}
                    </span>
                  </div>
                  <button
                    style={{
                      ...btnSmall,
                      color: "var(--io-danger)",
                      borderColor: "rgba(239,68,68,0.3)",
                    }}
                    onClick={() => removeMut.mutate(grant)}
                    disabled={removeMut.isPending}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {addError && <ErrorBanner message={addError} />}

          <form onSubmit={handleAdd}>
            <div
              style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}
            >
              <div style={{ width: "100px" }}>
                <label style={labelStyle}>Type</label>
                <select
                  style={inputStyle}
                  value={addType}
                  onChange={(e) => {
                    setAddType(e.target.value as EntityType);
                    setAddId("");
                  }}
                >
                  <option value="role">Role</option>
                  <option value="user">User</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={labelStyle}>
                  {addType === "role" ? "Role" : "User"}
                </label>
                <select
                  style={inputStyle}
                  value={addId}
                  onChange={(e) => setAddId(e.target.value)}
                >
                  <option value="">— select —</option>
                  {addType === "role" &&
                    roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.display_name}
                      </option>
                    ))}
                  {addType === "user" &&
                    users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name ?? u.username}
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="submit"
                style={{ ...btnPrimary, flexShrink: 0 }}
                disabled={addMut.isPending}
              >
                {addMut.isPending ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Dialog.Close asChild>
            <button style={btnSecondary}>Close</button>
          </Dialog.Close>
        </div>
      </ModalContent>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Visibility badge
// ---------------------------------------------------------------------------
const VISIBILITY_COLORS: Record<VideoStream["visibility"], string> = {
  public: "var(--io-accent, #3b82f6)",
  managed: "#a855f7",
  private: "var(--io-danger, #ef4444)",
};

function VisibilityBadge({ value }: { value: VideoStream["visibility"] }) {
  const color = VISIBILITY_COLORS[value];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        background: `${color}20`,
        color,
        border: `1px solid ${color}40`,
        textTransform: "capitalize",
      }}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CameraStreamsTab — main page
// ---------------------------------------------------------------------------
export default function CameraStreamsTab() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VideoStream | null>(null);
  const [aclFor, setAclFor] = useState<VideoStream | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VideoStream | null>(null);

  const streamsQuery = useQuery({
    queryKey: ["video-streams"],
    queryFn: async () => {
      const result = await videoStreamsApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => videoStreamsApi.remove(id),
    onSuccess: (result) => {
      if (!result.success) {
        setDeleteError(result.error.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["video-streams"] });
    },
  });

  const streams = streamsQuery.data ?? [];

  return (
    <SettingsPageLayout
      title="Camera Streams"
      description="Configure live video sources for Camera Stream widgets."
      variant="list"
      action={
        <button style={btnPrimary} onClick={() => setCreating(true)}>
          + Add Stream
        </button>
      }
    >
      {deleteError && <ErrorBanner message={deleteError} />}

      <div
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {streamsQuery.isLoading && (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "var(--io-text-muted)",
              fontSize: "13px",
            }}
          >
            Loading…
          </div>
        )}
        {streamsQuery.isError && (
          <div style={{ padding: "20px" }}>
            <ErrorBanner
              message={
                streamsQuery.error instanceof Error
                  ? streamsQuery.error.message
                  : "Failed to load streams"
              }
            />
          </div>
        )}
        {!streamsQuery.isLoading && !streamsQuery.isError && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--io-border)",
                  background: "var(--io-surface-primary)",
                }}
              >
                {["Name", "Visibility", "Mode", "URL / Inputs", "Actions"].map(
                  (col) => (
                    <th
                      key={col}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--io-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {streams.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "var(--io-text-muted)",
                      fontSize: "14px",
                    }}
                  >
                    No streams configured
                  </td>
                </tr>
              )}
              {streams.map((s, i) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom:
                      i < streams.length - 1
                        ? "1px solid var(--io-border-subtle)"
                        : undefined,
                  }}
                >
                  <td style={cellStyle}>
                    <span
                      style={{
                        fontWeight: 500,
                        color: "var(--io-text-primary)",
                      }}
                    >
                      {s.name}
                    </span>
                    {s.description && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--io-text-muted)",
                          marginTop: "2px",
                        }}
                      >
                        {s.description}
                      </div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <VisibilityBadge value={s.visibility} />
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--io-text-secondary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {s.connection_mode}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, maxWidth: "300px" }}>
                    <code
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "11px",
                        color: "var(--io-text-secondary)",
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.direct_url ??
                        s.relay_config?.go2rtc_inputs?.join(", ") ??
                        "—"}
 

--- File: /home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx ---
import * as Dialog from "@radix-ui/react-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: "danger" | "default";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "default",
}: ConfirmDialogProps) {
  const confirmStyle =
    variant === "danger"
      ? {
          padding: "8px 16px",
          background: "transparent",
          color: "var(--io-danger)",
          border: "1px solid var(--io-danger)",
          borderRadius: "var(--io-radius)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        }
      : {
          padding: "8px 16px",
          background: "var(--io-accent)",
          color: "var(--io-accent-foreground)",
          border: "none",
          borderRadius: "var(--io-radius)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-overlay, rgba(0,0,0,0.5))",
            zIndex: "var(--io-z-modal)",
          }}
        />
        <Dialog.Content
          role="alertdialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius-lg)",
            padding: "24px",
            width: "420px",
            maxWidth: "calc(100vw - 32px)",
            zIndex: "calc(var(--io-z-modal) + 1)",
          }}
        >
          <Dialog.Title
            style={{
              margin: "0 0 8px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            {title}
          </Dialog.Title>
          <Dialog.Description
            style={{
              margin: "0 0 24px",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {description}
          </Dialog.Description>
          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
            }}
          >
            <button
              style={{
                padding: "8px 16px",
                background: "transparent",
                color: "var(--io-text-secondary)",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                fontSize: "13px",
                cursor: "pointer",
              }}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </button>
            <button
              style={confirmStyle}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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

### 2.2 StatusBadge — **DONE 2026-05-28**

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

**Execution notes (2026-05-28):**
- `frontend/src/shared/components/StatusBadge.tsx` created. API: `{ status: string; label?: string }`. `label` defaults to `status` display text.
- Token-pair map covers plan vocabulary plus additions required by consumers: `sent` (success), `retry` (warning), `degraded` (warning) for Email.tsx and SystemHealth.tsx.
- Token substitution: `--io-surface-tertiary` is undefined in `index.css`. Plan spec used this token (inherited from Import.tsx base which also used it). Substituted with `--io-surface-secondary` (defined). Adds a subtle visible background for neutral/muted states rather than transparent.
- OpcSources migration: the border (`1px solid color-mix(...)`) from the post-fix version is **dropped** — not part of the plan's visual spec. The shared component uses token-pair bg directly.
- OpcSources `inactive` status: current implementation had `inactive → --io-text-muted` (muted); plan maps `inactive → danger`. Migration follows the plan.
- **Import.tsx:** local `StatusBadge` removed; import from shared added. Zero call-site changes.
- **OpcSources.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Zero call-site changes.
- **SystemHealth.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Local `STATUS_LABELS` record added to preserve custom display labels (Ready/Degraded/Not Ready/Unknown). All 3 call sites updated with `label` prop.
- **Email.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Zero call-site changes. Visual change: dot-only (no background) → dot + pill with background color. Email.tsx `disabled` status (line 339) maps to default muted.
- **Consumers migrated:** 4 (`Import.tsx`, `OpcSources.tsx`, `SystemHealth.tsx`, `Email.tsx`)
- **Consumers deferred:** `PointManagement.tsx` (boolean `ActiveBadge` API mismatch — not a substitution); `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx` (hex-alpha bug fix, separate pass per DC-6); Console alarm badges (different semantic vocabulary, out of scope per plan).
- **Design note — `inactive` semantic:** Plan maps `inactive → danger`. OpcSources previously showed `inactive` as muted (neutral). The change means a manually-disabled OPC source now shows a red badge. If operator feedback indicates this causes alarm fatigue, move `inactive` to a new `disabled` tier (muted) and add explicit `disabled` as a muted-tier alias. Intentional as executed; flag for UX review in the OpcSources pass.
- `pnpm build` passed with no type errors.

---

### 2.3 Dialog — **DONE 2026-05-28**

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

**Execution notes (2026-05-28):**
- `frontend/src/shared/components/Dialog.tsx` created. API: `{ open, onOpenChange, title, description?, children, width?=480, footer? }`. Uses Radix Dialog for ARIA. Overlay `var(--io-modal-backdrop)` / `zIndex: 1000`. Content `var(--io-surface-elevated)` / `var(--io-radius-lg)` / `zIndex: 1001`.
- **PaneConfigModal.tsx:** Token fixes only — overlay `rgba(0,0,0,0.55)` → `var(--io-modal-backdrop)`, content bg `var(--io-surface)` → `var(--io-surface-elevated)`, content borderRadius `8` → `var(--io-radius-lg)`. Already on Radix Dialog; no structural change.
- **console/index.tsx WorkspaceNameModal:** Replaced hand-rolled overlay divs with Dialog wrapper. Title converges to 16px/600/text-primary (was 14px/text). Escape handling removed from input keyDown (Radix handles via onOpenChange).
- **console/index.tsx DeleteConfirmDialog:** Replaced with Dialog. Bold workspace name preserved via `description?: React.ReactNode` (changed from `string` in initial cut after deep review).
- **console/index.tsx CloseConfirmDialog:** Replaced with Dialog. Three-button footer works via `footer?: ReactNode` prop. Bold workspace name preserved via ReactNode description.
- **RestorePreviewModal.tsx:** Replaced MODAL_OVERLAY + MODAL_BOX + header section with Dialog wrapper. Title/description rendered by Dialog. Top-right Cancel button removed (Radix Escape/overlay click replaces it). Diff table `flex: 1` changed to `maxHeight: 400px` (Dialog content not flex; explicit cap works for migration pass).
- **TabClosePrompt.tsx:** Full rewrite using Dialog. Bold graphic name preserved via ReactNode description. Three-button footer.
- **IographicExportDialog.tsx:** Replaced hand-rolled overlay with Dialog. Header × button removed. Graphic info block and description textarea in children.
- **Consumers migrated:** 6 (`PaneConfigModal.tsx`, `WorkspaceNameModal` in console/index.tsx, `DeleteConfirmDialog` in console/index.tsx, `CloseConfirmDialog` in console/index.tsx, `RestorePreviewModal.tsx`, `TabClosePrompt.tsx`, `IographicExportDialog.tsx` — counting index.tsx as 3 separate consumers = 8 call sites total across 6 files)
- **Consumers deferred:**
  - `pages/settings/Certificates.tsx` — both dialogs already have `role="dialog"`, `aria-modal="true"`, `var(--io-modal-backdrop)`. ARIA gap already addressed; no migration needed.
  - `pages/designer/components/ValidateBindingsDialog.tsx` — panel widget (`position: absolute`), not a modal overlay. Dialog.tsx not applicable.
  - `pages/designer/components/VersionHistoryDialog.tsx` — already uses `VersionRecoveryDialog` (shared component); properly structured.
  - `pages/designer/components/CanvasPropertiesDialog.tsx` — already has `role="dialog"`, `aria-modal="true"`. Primary ARIA gap addressed.
  - `pages/designer/components/RecognitionWizard.tsx` — already has `role="dialog"`. Complex multi-step; no gain from wrapping.
  - `pages/designer/components/IographicImportWizard.tsx` — complex multi-step wizard; more than substitution-level work.
  - `pages/designer/components/CategoryShapeWizard.tsx` — complex multi-step wizard.
  - `pages/designer/components/SaveAsStencilDialog.tsx` — rendered inside DesignerCanvas.tsx (Claim C scope).
  - `pages/designer/components/ShapeDropDialog.tsx` — rendered inside DesignerCanvas.tsx (Claim C scope).
  - `pages/designer/components/PromoteToShapeWizard.tsx` — rendered inside DesignerCanvas.tsx (Claim C scope).
- `pnpm build` pass

---

Produce the review now.
```


## #TURN_END

_2026-05-28T05:08:45+00:00_

---


## #PROMPT

_2026-05-28T05:09:09+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
/home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #BASH
_List latest review files_

```bash
ls /home/io/io-dev/io/.claude/reviews/ | tail -5
```


## #BASH
_List review files by modification time_

```bash
ls -t /home/io/io-dev/io/.claude/reviews/ | head -5
```


## #BASH
_Read the deep review file (filename contains newline)_

```bash
cat "/home/io/io-dev/io/.claude/reviews/2026-05-28_workstream-3c-promote-confirmdialog"$'\n'"rea_045013_review_deep_050728.md"
```


## #BASH
_Find the newly created review file_

```bash
find /home/io/io-dev/io/.claude/reviews/ -newer /home/io/io-dev/io/.claude/reviews/2026-05-28_workstream-3c-promote-statusbadge$'\n'read-_040255_review_shallow_041648.md -type f 2>/dev/null || find /home/io/io-dev/io/.claude/reviews/ -name "*050728*" -type f 2>/dev/null || find /home/io/io-dev/io/.claude/reviews/ -name "*confirmdialog*" -type f 2>/dev/null
```


## #BASH
_Find review file with exact name_

```bash
python3 -c "
import os
d = '/home/io/io-dev/io/.claude/reviews/'
files = os.listdir(d)
for f in files:
    if '050728' in f or 'confirmdialog' in f.lower():
        print(repr(f))
        full = os.path.join(d, f)
        print(repr(full))
"
```


## #BASH
_Read review file contents via Python (handles newline in filename)_

```bash
python3 -c "
path = '/home/io/io-dev/io/.claude/reviews/2026-05-28_workstream-3c-promote-confirmdialog\n\nrea_045013_review_deep_050728.md'
with open(path, 'r') as f:
    print(f.read())
"
```


## #TURN_END

_2026-05-28T05:09:10+00:00_

---


## #PROMPT

_2026-05-28T05:13:55+00:00_

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
_Run shallow review_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt)
/home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID" "shallow"
```


## #BASH
_Update interim documentation_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt)
/home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #BASH
_List latest interim doc files_

```bash
python3 -c "
import os
d = '/home/io/io-dev/io/.claude/docs/interim/'
files = sorted(os.listdir(d), key=lambda f: os.path.getmtime(os.path.join(d, f)), reverse=True)
for f in files[:5]:
    print(repr(f))
"
```


## #BASH
_Read the interim doc update proposal_

```bash
python3 -c "
with open('/home/io/io-dev/io/.claude/docs/interim/2026-05-28-workstream-3c-promote-confirmdialog\n\nre.md.update-proposal-051342') as f:
    print(f.read())
"
```


## #BASH
_Read the interim doc itself_

```bash
python3 -c "
with open('/home/io/io-dev/io/.claude/docs/interim/2026-05-28-workstream-3c-promote-confirmdialog\n\nre.md') as f:
    print(f.read())
"
```


## #TURN_END

_2026-05-28T05:13:55+00:00_

---

