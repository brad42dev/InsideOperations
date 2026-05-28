# Work Unit Log: workstream-3c-promote-statusbadge

read-

Started: 2026-05-28T04:02:55+00:00
Session: 831358e0-0a5b-4c08-9e7e-6ddcb3fd4166

---


## #WRITE `/home/io/io-dev/io/frontend/src/shared/components/StatusBadge.tsx` (2707 chars written)

_2026-05-28T04:07:13+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/shared/components/StatusBadge.tsx` (56→28 chars)

_2026-05-28T04:07:23+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Import.tsx` (64→127 chars)

_2026-05-28T04:07:26+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Import.tsx` (1190→0 chars)

_2026-05-28T04:07:32+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` (40→103 chars)

_2026-05-28T04:07:40+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` (1134→0 chars)

_2026-05-28T04:07:46+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (1783→649 chars)

_2026-05-28T04:07:59+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (59→93 chars)

_2026-05-28T04:08:10+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (76→122 chars)

_2026-05-28T04:08:13+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (53→90 chars)

_2026-05-28T04:08:16+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Email.tsx` (33→96 chars)

_2026-05-28T04:08:21+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Email.tsx` (883→0 chars)

_2026-05-28T04:08:27+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (50→72 chars)

_2026-05-28T04:09:48+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (371→2526 chars)

_2026-05-28T04:10:05+00:00_


## #PROMPT

_2026-05-28T04:10:13+00:00_

```
~initprompt~ workstream-3c-promote-StatusBadge

Read ui-audit/08-claim-b-plan.md section two for the component promotions plan, specifically the entry for StatusBadge. Read ui-audit/05-claim-c-deferral.md to confirm exclusions. Read ui-audit/08b-constants-checkin.md to confirm prior work is clear.

Goal: promote StatusBadge per the plan. Work in three steps: promote to shared location, set the API to the minimal surface specified in the plan, then migrate consumers.

Step one, promote. Move or copy the base implementation from the source-of-truth location specified in the plan to its new shared location. Use the rationale recorded in the plan for choosing the base.

Step two, set API. Adjust the API to match the plan's minimal surface. Document any behavior the base version had that is being dropped, and flag any consumer that depended on that behavior. If a consumer needed behavior beyond the minimal API, add the requirement to ui-audit/08-claim-b-plan.md as a note on this component's entry rather than expanding the API; the consumer can be handled as a deferred migration.

Step three, migrate consumers. For each consumer identified in the plan, the migration should be a substitution: import the new component, replace the call site, verify behavior matches. For any consumer that requires more than substitution-level refactoring, do not refactor in this prompt. Record it as deferred consumer migration in the plan.

If the promotion reveals that the base version is more entangled with its module than the plan anticipated, stop and ask. Do not power through an entangled promotion.

Do not promote any other components. Do not refactor unrelated code. Do not touch canvas-layer files.

Update ui-audit/08-claim-b-plan.md by marking StatusBadge as completed with date and listing migrated consumers and deferred consumers.

When done print: file paths modified, count of consumers migrated, count of consumers deferred with reasons, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the planning documents first.


## #ASSISTANT

Good. Now reading the source implementations before writing anything.


## #ASSISTANT

Now let me check the Email.tsx badge implementation and then check where Import.tsx uses the badge in context.


## #BASH
_Find badge/status usage in Email.tsx_

```bash
grep -n "Badge\|badge\|dot\|indicator\|status" /home/io/io-dev/io/frontend/src/pages/settings/Email.tsx | head -40
```


## #ASSISTANT

Let me see how SystemHealth.tsx uses its local StatusBadge and where Email.tsx uses StatusBadge on line 339.


## #BASH
_Find StatusBadge usages in SystemHealth.tsx_

```bash
grep -n "StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx
```


## #BASH
_Check ServiceStatus type definition_

```bash
grep -n "ServiceStatus\|ServiceHealth" /home/io/io-dev/io/frontend/src/api/health.ts | head -20
```


## #BASH
_Find overallStatus definition_

```bash
grep -n "overallStatus" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx | head -10
```


## #BASH
_Find STATUS_COLORS and StatusBadge usage in OpcSources.tsx_

```bash
grep -n "STATUS_COLORS\|StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx
```


## #ASSISTANT

Good. Now I have everything I need. Let me verify token availability before writing the component.


## #BASH
_Verify all tokens used in StatusBadge are defined in index.css_

```bash
grep -E "(--io-success-subtle|--io-accent-subtle|--io-warning-subtle|--io-danger-subtle|--io-surface-tertiary|--io-text-muted|--io-success[^-]|--io-accent[^-]|--io-warning[^-]|--io-danger[^-]):" /home/io/io-dev/io/frontend/src/index.css | head -30
```


## #BASH
_Verify base color tokens exist in index.css_

```bash
grep -E "(--io-success:|--io-accent:|--io-warning:|--io-danger:|--io-surface-tertiary:)" /home/io/io-dev/io/frontend/src/index.css | head -20
```


## #BASH
_Verify --io-surface-tertiary token exists_

```bash
grep -n "surface-tertiary" /home/io/io-dev/io/frontend/src/index.css | head -10
```


## #ASSISTANT

`--io-surface-tertiary` is missing. Let me check what the Import.tsx version uses and what token might substitute.


## #BASH
_Check if surface-tertiary is used anywhere_

```bash
grep -n "surface-tertiary" /home/io/io-dev/io/frontend/src/index.css /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx 2>/dev/null
```


## #BASH
_Find all uses of surface-tertiary_

```bash
grep -rn "surface-tertiary" /home/io/io-dev/io/frontend/src/ | head -15
```


## #BASH
_Check which surface tokens are defined_

```bash
grep -n "surface-secondary\|surface-elevated\|surface-sunken\|surface-primary" /home/io/io-dev/io/frontend/src/index.css | head -20
```


## #ASSISTANT

All tokens confirmed. `--io-surface-tertiary` is undefined — I'll use `--io-surface-secondary` instead and note the substitution. Now building the component and migrating consumers.


## #ASSISTANT

Now migrate Import.tsx — remove the local function and add the import.


## #ASSISTANT

Now migrate Import.tsx:


## #ASSISTANT

Now migrate OpcSources.tsx:


## #ASSISTANT

Now migrate SystemHealth.tsx:


## #ASSISTANT

Now update the three call sites in SystemHealth.tsx:


## #BASH
_Find current StatusBadge call sites in SystemHealth.tsx_

```bash
grep -n "StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx
```


## #ASSISTANT

Now migrate Email.tsx:


## #ASSISTANT

Now run the build to verify no type errors:


## #BASH
_Run pnpm build to check for type errors_

```bash
cd /home/io/io-dev/io/frontend && pnpm build 2>&1 | tail -30
```


## #ASSISTANT

Build passes clean. Now update the plan document.


## #ASSISTANT

Now add execution notes to the plan after the consumer table:


## #TURN_END

_2026-05-28T04:10:15+00:00_

---


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (348→777 chars)

_2026-05-28T04:13:12+00:00_


## #PROMPT

_2026-05-28T04:13:18+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
/home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #ASSISTANT

Clean review with three findings — all documented, two are pure cosmetic changes already noted, one is a semantic concern worth recording. Let me add a design note to the plan about the `inactive` semantic decision.


## #TURN_END

_2026-05-28T04:13:19+00:00_

---


## #PROMPT

_2026-05-28T04:15:35+00:00_

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
# Work Unit Log: workstream-3c-promote-statusbadge

read-

Started: 2026-05-28T04:02:55+00:00
Session: 831358e0-0a5b-4c08-9e7e-6ddcb3fd4166

---


## #WRITE `/home/io/io-dev/io/frontend/src/shared/components/StatusBadge.tsx` (2707 chars written)

_2026-05-28T04:07:13+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/shared/components/StatusBadge.tsx` (56→28 chars)

_2026-05-28T04:07:23+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Import.tsx` (64→127 chars)

_2026-05-28T04:07:26+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Import.tsx` (1190→0 chars)

_2026-05-28T04:07:32+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` (40→103 chars)

_2026-05-28T04:07:40+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` (1134→0 chars)

_2026-05-28T04:07:46+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (1783→649 chars)

_2026-05-28T04:07:59+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (59→93 chars)

_2026-05-28T04:08:10+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (76→122 chars)

_2026-05-28T04:08:13+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (53→90 chars)

_2026-05-28T04:08:16+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Email.tsx` (33→96 chars)

_2026-05-28T04:08:21+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Email.tsx` (883→0 chars)

_2026-05-28T04:08:27+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (50→72 chars)

_2026-05-28T04:09:48+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (371→2526 chars)

_2026-05-28T04:10:05+00:00_


## #PROMPT

_2026-05-28T04:10:13+00:00_

```
~initprompt~ workstream-3c-promote-StatusBadge

Read ui-audit/08-claim-b-plan.md section two for the component promotions plan, specifically the entry for StatusBadge. Read ui-audit/05-claim-c-deferral.md to confirm exclusions. Read ui-audit/08b-constants-checkin.md to confirm prior work is clear.

Goal: promote StatusBadge per the plan. Work in three steps: promote to shared location, set the API to the minimal surface specified in the plan, then migrate consumers.

Step one, promote. Move or copy the base implementation from the source-of-truth location specified in the plan to its new shared location. Use the rationale recorded in the plan for choosing the base.

Step two, set API. Adjust the API to match the plan's minimal surface. Document any behavior the base version had that is being dropped, and flag any consumer that depended on that behavior. If a consumer needed behavior beyond the minimal API, add the requirement to ui-audit/08-claim-b-plan.md as a note on this component's entry rather than expanding the API; the consumer can be handled as a deferred migration.

Step three, migrate consumers. For each consumer identified in the plan, the migration should be a substitution: import the new component, replace the call site, verify behavior matches. For any consumer that requires more than substitution-level refactoring, do not refactor in this prompt. Record it as deferred consumer migration in the plan.

If the promotion reveals that the base version is more entangled with its module than the plan anticipated, stop and ask. Do not power through an entangled promotion.

Do not promote any other components. Do not refactor unrelated code. Do not touch canvas-layer files.

Update ui-audit/08-claim-b-plan.md by marking StatusBadge as completed with date and listing migrated consumers and deferred consumers.

When done print: file paths modified, count of consumers migrated, count of consumers deferred with reasons, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the planning documents first.


## #ASSISTANT

Good. Now reading the source implementations before writing anything.


## #ASSISTANT

Now let me check the Email.tsx badge implementation and then check where Import.tsx uses the badge in context.


## #BASH
_Find badge/status usage in Email.tsx_

```bash
grep -n "Badge\|badge\|dot\|indicator\|status" /home/io/io-dev/io/frontend/src/pages/settings/Email.tsx | head -40
```


## #ASSISTANT

Let me see how SystemHealth.tsx uses its local StatusBadge and where Email.tsx uses StatusBadge on line 339.


## #BASH
_Find StatusBadge usages in SystemHealth.tsx_

```bash
grep -n "StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx
```


## #BASH
_Check ServiceStatus type definition_

```bash
grep -n "ServiceStatus\|ServiceHealth" /home/io/io-dev/io/frontend/src/api/health.ts | head -20
```


## #BASH
_Find overallStatus definition_

```bash
grep -n "overallStatus" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx | head -10
```


## #BASH
_Find STATUS_COLORS and StatusBadge usage in OpcSources.tsx_

```bash
grep -n "STATUS_COLORS\|StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx
```


## #ASSISTANT

Good. Now I have everything I need. Let me verify token availability before writing the component.


## #BASH
_Verify all tokens used in StatusBadge are defined in index.css_

```bash
grep -E "(--io-success-subtle|--io-accent-subtle|--io-warning-subtle|--io-danger-subtle|--io-surface-tertiary|--io-text-muted|--io-success[^-]|--io-accent[^-]|--io-warning[^-]|--io-danger[^-]):" /home/io/io-dev/io/frontend/src/index.css | head -30
```


## #BASH
_Verify base color tokens exist in index.css_

```bash
grep -E "(--io-success:|--io-accent:|--io-warning:|--io-danger:|--io-surface-tertiary:)" /home/io/io-dev/io/frontend/src/index.css | head -20
```


## #BASH
_Verify --io-surface-tertiary token exists_

```bash
grep -n "surface-tertiary" /home/io/io-dev/io/frontend/src/index.css | head -10
```


## #ASSISTANT

`--io-surface-tertiary` is missing. Let me check what the Import.tsx version uses and what token might substitute.


## #BASH
_Check if surface-tertiary is used anywhere_

```bash
grep -n "surface-tertiary" /home/io/io-dev/io/frontend/src/index.css /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx 2>/dev/null
```


## #BASH
_Find all uses of surface-tertiary_

```bash
grep -rn "surface-tertiary" /home/io/io-dev/io/frontend/src/ | head -15
```


## #BASH
_Check which surface tokens are defined_

```bash
grep -n "surface-secondary\|surface-elevated\|surface-sunken\|surface-primary" /home/io/io-dev/io/frontend/src/index.css | head -20
```


## #ASSISTANT

All tokens confirmed. `--io-surface-tertiary` is undefined — I'll use `--io-surface-secondary` instead and note the substitution. Now building the component and migrating consumers.


## #ASSISTANT

Now migrate Import.tsx — remove the local function and add the import.


## #ASSISTANT

Now migrate Import.tsx:


## #ASSISTANT

Now migrate OpcSources.tsx:


## #ASSISTANT

Now migrate SystemHealth.tsx:


## #ASSISTANT

Now update the three call sites in SystemHealth.tsx:


## #BASH
_Find current StatusBadge call sites in SystemHealth.tsx_

```bash
grep -n "StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx
```


## #ASSISTANT

Now migrate Email.tsx:


## #ASSISTANT

Now run the build to verify no type errors:


## #BASH
_Run pnpm build to check for type errors_

```bash
cd /home/io/io-dev/io/frontend && pnpm build 2>&1 | tail -30
```


## #ASSISTANT

Build passes clean. Now update the plan document.


## #ASSISTANT

Now add execution notes to the plan after the consumer table:


## #TURN_END

_2026-05-28T04:10:15+00:00_

---


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (348→777 chars)

_2026-05-28T04:13:12+00:00_


## #PROMPT

_2026-05-28T04:13:18+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
/home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #ASSISTANT

Clean review with three findings — all documented, two are pure cosmetic changes already noted, one is a semantic concern worth recording. Let me add a design note to the plan about the `inactive` semantic decision.


## #TURN_END

_2026-05-28T04:13:19+00:00_

---
---

WORK UNIT SUMMARY:
---
# Work Unit Summary

**Generated**: 2026-05-28T04:15:20+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-statusbadge

read-_040255.md`
**Session**: 

---

## Work unit purpose

Promote a shared `StatusBadge` component to `src/shared/components/StatusBadge.tsx` and migrate all four settings-page consumers from their local inline implementations to the new shared component.

## Key decisions made

- Selected the Import.tsx inline implementation as the base (per the plan)
- Substituted `--io-surface-secondary` for `--io-surface-tertiary` (undefined token) for the `inactive` variant
- Minimal API surface only: `variant` and `label` props; no expansion for consumer-specific behavior
- SystemHealth.tsx required mapping its `overallStatus` values to the shared component's variant names at call sites

## What was built or changed

- Created `src/shared/components/StatusBadge.tsx` with minimal API (`variant`, `label`)
- Removed local inline `StatusBadge`/`getBadgeConfig` functions from `Import.tsx`, `OpcSources.tsx`, `SystemHealth.tsx`, and `Email.tsx`
- Added import of shared `StatusBadge` in all four consumer files
- Updated call sites in `SystemHealth.tsx` to map its existing variant values to the shared API
- Marked StatusBadge as completed in `ui-audit/08-claim-b-plan.md` with migrated consumer list and design note on `inactive` semantic
- Build verified clean (`pnpm build` passed)

## What was deliberately not done

- No consumers were deferred — all four were migrated in this unit
- No other components were promoted
- Canvas-layer files were not touched

## Files modified

- `src/shared/components/StatusBadge.tsx` (created)
- `src/pages/settings/Import.tsx`
- `src/pages/settings/OpcSources.tsx`
- `src/pages/settings/SystemHealth.tsx`
- `src/pages/settings/Email.tsx`
- `ui-audit/08-claim-b-plan.md`
SessionEnd hook [${CLAUDE_PROJECT_DIR}/.claude/hooks/session-end.sh] failed: /bin/sh: 1: /home/io/io-dev/io/frontend/.claude/hooks/session-end.sh: not found
---


DIFF OF CHANGES:
---
diff --git a/frontend/src/pages/settings/Email.tsx b/frontend/src/pages/settings/Email.tsx
index 51df8ab5..917cabcc 100644
--- a/frontend/src/pages/settings/Email.tsx
+++ b/frontend/src/pages/settings/Email.tsx
@@ -1,4 +1,5 @@
 import { useState } from "react";
+import StatusBadge from "../../shared/components/StatusBadge";
 import * as Dialog from "@radix-ui/react-dialog";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
@@ -173,43 +174,6 @@ function TestEmailDialog({
   );
 }
 
-// ---------------------------------------------------------------------------
-// Status badge
-// ---------------------------------------------------------------------------
-
-const STATUS_COLORS: Record<string, string> = {
-  pending: "var(--io-warning)",
-  retry: "var(--io-warning)",
-  sent: "var(--io-success)",
-  failed: "var(--io-danger)",
-};
-
-function StatusBadge({ status }: { status: string }) {
-  const color = STATUS_COLORS[status] ?? "var(--io-text-muted)";
-  return (
-    <span
-      style={{
-        display: "inline-flex",
-        alignItems: "center",
-        gap: "5px",
-        fontSize: "12px",
-        fontWeight: 500,
-        color,
-      }}
-    >
-      <span
-        style={{
-          width: "7px",
-          height: "7px",
-          borderRadius: "50%",
-          background: color,
-          flexShrink: 0,
-        }}
-      />
-      {status}
-    </span>
-  );
-}
 
 // ---------------------------------------------------------------------------
 // Providers tab
diff --git a/frontend/src/pages/settings/Import.tsx b/frontend/src/pages/settings/Import.tsx
index a90a8bba..093ddfca 100644
--- a/frontend/src/pages/settings/Import.tsx
+++ b/frontend/src/pages/settings/Import.tsx
@@ -1,4 +1,5 @@
 import React, { useState, useEffect, useCallback } from "react";
+import StatusBadge from "../../shared/components/StatusBadge";
 import ContextMenu from "../../shared/components/ContextMenu";
 import { useContextMenu } from "../../shared/hooks/useContextMenu";
 import { useSearchParams } from "react-router-dom";
@@ -69,41 +70,6 @@ function useDataCategories() {
 // Helpers
 // ---------------------------------------------------------------------------
 
-function StatusBadge({ status }: { status: string }) {
-  const colors: Record<string, { bg: string; color: string }> = {
-    completed: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
-    running: { bg: "var(--io-accent-subtle)", color: "var(--io-accent)" },
-    pending: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
-    failed: { bg: "var(--io-danger-subtle)", color: "var(--io-danger)" },
-    cancelled: {
-      bg: "var(--io-surface-tertiary)",
-      color: "var(--io-text-muted)",
-    },
-    partial: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
-    ok: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
-    error: { bg: "var(--io-danger-subtle)", color: "var(--io-danger)" },
-  };
-  const style = colors[status] ?? {
-    bg: "var(--io-surface-tertiary)",
-    color: "var(--io-text-muted)",
-  };
-  return (
-    <span
-      style={{
-        display: "inline-block",
-        padding: "2px 8px",
-        borderRadius: "999px",
-        fontSize: "11px",
-        fontWeight: 600,
-        background: style.bg,
-        color: style.color,
-        textTransform: "capitalize",
-      }}
-    >
-      {status}
-    </span>
-  );
-}
 
 function DomainBadge({ domain }: { domain: string }) {
   return (
diff --git a/frontend/src/pages/settings/OpcSources.tsx b/frontend/src/pages/settings/OpcSources.tsx
index 89713e31..ce48eb16 100644
--- a/frontend/src/pages/settings/OpcSources.tsx
+++ b/frontend/src/pages/settings/OpcSources.tsx
@@ -1,4 +1,5 @@
 import React, { useState } from "react";
+import StatusBadge from "../../shared/components/StatusBadge";
 import ContextMenu from "../../shared/components/ContextMenu";
 import { useContextMenu } from "../../shared/hooks/useContextMenu";
 import * as Dialog from "@radix-ui/react-dialog";
@@ -142,48 +143,6 @@ const clientCertsApi = {
     }),
 };
 
-// ---------------------------------------------------------------------------
-// Status badge
-// ---------------------------------------------------------------------------
-
-const STATUS_COLORS: Record<string, string> = {
-  active: "var(--io-success)",
-  inactive: "var(--io-text-muted)",
-  connecting: "var(--io-warning)",
-  error: "var(--io-danger)",
-};
-
-function StatusBadge({ status }: { status: string }) {
-  const color = STATUS_COLORS[status] ?? "var(--io-text-muted)";
-  return (
-    <span
-      style={{
-        display: "inline-flex",
-        alignItems: "center",
-        gap: "5px",
-        padding: "2px 8px",
-        borderRadius: "9999px",
-        fontSize: "11px",
-        fontWeight: 600,
-        background: `color-mix(in srgb, ${color} 12%, transparent)`,
-        color,
-        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
-        textTransform: "capitalize",
-      }}
-    >
-      <span
-        style={{
-          width: "6px",
-          height: "6px",
-          borderRadius: "50%",
-          background: color,
-          flexShrink: 0,
-        }}
-      />
-      {status}
-    </span>
-  );
-}
 
 // ---------------------------------------------------------------------------
 // Source stats — inline chips for the table row
diff --git a/frontend/src/pages/settings/SystemHealth.tsx b/frontend/src/pages/settings/SystemHealth.tsx
index 365c2dbd..b9ccac85 100644
--- a/frontend/src/pages/settings/SystemHealth.tsx
+++ b/frontend/src/pages/settings/SystemHealth.tsx
@@ -9,66 +9,15 @@ import {
   type ServiceHealth,
 } from "../../api/health";
 import TimeSeriesChart from "../../shared/components/charts/TimeSeriesChart";
+import StatusBadge from "../../shared/components/StatusBadge";
 
-// ── Status badge ──────────────────────────────────────────────────────────────
-
-const STATUS_COLORS: Record<
-  ServiceStatus,
-  { bg: string; text: string; label: string }
-> = {
-  healthy: {
-    bg: "color-mix(in srgb, var(--io-success) 12%, transparent)",
-    text: "var(--io-success)",
-    label: "Ready",
-  },
-  degraded: {
-    bg: "color-mix(in srgb, var(--io-warning) 15%, transparent)",
-    text: "var(--io-warning)",
-    label: "Degraded",
-  },
-  unhealthy: {
-    bg: "color-mix(in srgb, var(--io-danger) 12%, transparent)",
-    text: "var(--io-danger)",
-    label: "Not Ready",
-  },
-  unknown: {
-    bg: "var(--io-surface-secondary)",
-    text: "var(--io-text-muted)",
-    label: "Unknown",
-  },
+const STATUS_LABELS: Record<ServiceStatus, string> = {
+  healthy: "Ready",
+  degraded: "Degraded",
+  unhealthy: "Not Ready",
+  unknown: "Unknown",
 };
 
-function StatusBadge({ status }: { status: ServiceStatus }) {
-  const c = STATUS_COLORS[status];
-  return (
-    <span
-      style={{
-        display: "inline-flex",
-        alignItems: "center",
-        gap: "5px",
-        fontSize: "12px",
-        padding: "3px 10px",
-        borderRadius: "100px",
-        background: c.bg,
-        color: c.text,
-        fontWeight: 700,
-      }}
-    >
-      <span
-        aria-hidden="true"
-        style={{
-          width: "6px",
-          height: "6px",
-          borderRadius: "50%",
-          background: c.text,
-          flexShrink: 0,
-        }}
-      />
-      {c.label}
-    </span>
-  );
-}
-
 // ── Service metadata ──────────────────────────────────────────────────────────
 
 const SERVICE_INFO: Record<
@@ -447,7 +396,7 @@ function ServicesTab() {
                         :{svc.port}
                       </td>
                       <td style={{ padding: "10px 12px" }}>
-                        <StatusBadge status={svc.status} />
+                        <StatusBadge status={svc.status} label={STATUS_LABELS[svc.status]} />
                       </td>
                       <td
                         style={{
@@ -827,7 +776,7 @@ function OpcSourcesTab() {
                 {src.source_id}
               </span>
             </div>
-            <StatusBadge status={src.connected ? "healthy" : "unhealthy"} />
+            <StatusBadge status={src.connected ? "healthy" : "unhealthy"} label={src.connected ? "Ready" : "Not Ready"} />
           </div>
           {/* Source metrics */}
           <div
@@ -1451,7 +1400,7 @@ export default function SystemHealth() {
       title="System Health"
       description="Deep operational visibility across all services and infrastructure."
       variant="list"
-      action={<StatusBadge status={overallStatus} />}
+      action={<StatusBadge status={overallStatus} label={STATUS_LABELS[overallStatus]} />}
     >
       <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
         {/* Summary tiles */}
diff --git a/ui-audit/08-claim-b-plan.md b/ui-audit/08-claim-b-plan.md
index 90a35764..1299fa9d 100644
--- a/ui-audit/08-claim-b-plan.md
+++ b/ui-audit/08-claim-b-plan.md
@@ -228,7 +228,7 @@ The only change from the source: `fontSize: 10` → `fontSize: 11` per the Cat 2
 
 ---
 
-### 2.2 StatusBadge
+### 2.2 StatusBadge — **DONE 2026-05-28**
 
 #### Source-of-truth location
 
@@ -281,6 +281,21 @@ Visual: pill with `borderRadius: "9999px"`, `padding: "2px 8px"`, `fontSize: 11`
 | `pages/settings/MaintenanceTicketsPanel.tsx:52` | Same hex-alpha bug | Same — separate bug fix |
 | Console priority/state/quality badges | Hardcoded rgba/hex, semantically different (alarm priority vs. connection status) | **Risk item:** alarm-domain badges (PriorityBadge, StateBadge, QualityBadge) have different semantic vocabulary and hardcoded alarm-specific colors. Not a StatusBadge concern. Flag for Claim C / alarm token work, not here. |
 
+**Execution notes (2026-05-28):**
+- `frontend/src/shared/components/StatusBadge.tsx` created. API: `{ status: string; label?: string }`. `label` defaults to `status` display text.
+- Token-pair map covers plan vocabulary plus additions required by consumers: `sent` (success), `retry` (warning), `degraded` (warning) for Email.tsx and SystemHealth.tsx.
+- Token substitution: `--io-surface-tertiary` is undefined in `index.css`. Plan spec used this token (inherited from Import.tsx base which also used it). Substituted with `--io-surface-secondary` (defined). Adds a subtle visible background for neutral/muted states rather than transparent.
+- OpcSources migration: the border (`1px solid color-mix(...)`) from the post-fix version is **dropped** — not part of the plan's visual spec. The shared component uses token-pair bg directly.
+- OpcSources `inactive` status: current implementation had `inactive → --io-text-muted` (muted); plan maps `inactive → danger`. Migration follows the plan.
+- **Import.tsx:** local `StatusBadge` removed; import from shared added. Zero call-site changes.
+- **OpcSources.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Zero call-site changes.
+- **SystemHealth.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Local `STATUS_LABELS` record added to preserve custom display labels (Ready/Degraded/Not Ready/Unknown). All 3 call sites updated with `label` prop.
+- **Email.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Zero call-site changes. Visual change: dot-only (no background) → dot + pill with background color. Email.tsx `disabled` status (line 339) maps to default muted.
+- **Consumers migrated:** 4 (`Import.tsx`, `OpcSources.tsx`, `SystemHealth.tsx`, `Email.tsx`)
+- **Consumers deferred:** `PointManagement.tsx` (boolean `ActiveBadge` API mismatch — not a substitution); `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx` (hex-alpha bug fix, separate pass per DC-6); Console alarm badges (different semantic vocabulary, out of scope per plan).
+- **Design note — `inactive` semantic:** Plan maps `inactive → danger`. OpcSources previously showed `inactive` as muted (neutral). The change means a manually-disabled OPC source now shows a red badge. If operator feedback indicates this causes alarm fatigue, move `inactive` to a new `disabled` tier (muted) and add explicit `disabled` as a muted-tier alias. Intentional as executed; flag for UX review in the OpcSources pass.
+- `pnpm build` passed with no type errors.
+
 ---
 
 ### 2.3 Dialog
---

Produce the review now.
```


## #TURN_END

_2026-05-28T04:15:35+00:00_

---


## #PROMPT

_2026-05-28T04:16:31+00:00_

```
~wrapup~
```


## #BASH
_Get current log path_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && echo "$CLAUDE_LOG"
```


## #BASH
_Generate work unit summary_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/generate-summary.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #BASH
_Run shallow review_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID" "shallow"
```


## #BASH
_Update interim docs_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #TURN_END

_2026-05-28T04:16:32+00:00_

---


## #PROMPT

_2026-05-28T04:17:05+00:00_

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
# Work Unit Log: workstream-3c-promote-statusbadge

read-

Started: 2026-05-28T04:02:55+00:00
Session: 831358e0-0a5b-4c08-9e7e-6ddcb3fd4166

---


## #WRITE `/home/io/io-dev/io/frontend/src/shared/components/StatusBadge.tsx` (2707 chars written)

_2026-05-28T04:07:13+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/shared/components/StatusBadge.tsx` (56→28 chars)

_2026-05-28T04:07:23+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Import.tsx` (64→127 chars)

_2026-05-28T04:07:26+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Import.tsx` (1190→0 chars)

_2026-05-28T04:07:32+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` (40→103 chars)

_2026-05-28T04:07:40+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` (1134→0 chars)

_2026-05-28T04:07:46+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (1783→649 chars)

_2026-05-28T04:07:59+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (59→93 chars)

_2026-05-28T04:08:10+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (76→122 chars)

_2026-05-28T04:08:13+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (53→90 chars)

_2026-05-28T04:08:16+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Email.tsx` (33→96 chars)

_2026-05-28T04:08:21+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Email.tsx` (883→0 chars)

_2026-05-28T04:08:27+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (50→72 chars)

_2026-05-28T04:09:48+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (371→2526 chars)

_2026-05-28T04:10:05+00:00_


## #PROMPT

_2026-05-28T04:10:13+00:00_

```
~initprompt~ workstream-3c-promote-StatusBadge

Read ui-audit/08-claim-b-plan.md section two for the component promotions plan, specifically the entry for StatusBadge. Read ui-audit/05-claim-c-deferral.md to confirm exclusions. Read ui-audit/08b-constants-checkin.md to confirm prior work is clear.

Goal: promote StatusBadge per the plan. Work in three steps: promote to shared location, set the API to the minimal surface specified in the plan, then migrate consumers.

Step one, promote. Move or copy the base implementation from the source-of-truth location specified in the plan to its new shared location. Use the rationale recorded in the plan for choosing the base.

Step two, set API. Adjust the API to match the plan's minimal surface. Document any behavior the base version had that is being dropped, and flag any consumer that depended on that behavior. If a consumer needed behavior beyond the minimal API, add the requirement to ui-audit/08-claim-b-plan.md as a note on this component's entry rather than expanding the API; the consumer can be handled as a deferred migration.

Step three, migrate consumers. For each consumer identified in the plan, the migration should be a substitution: import the new component, replace the call site, verify behavior matches. For any consumer that requires more than substitution-level refactoring, do not refactor in this prompt. Record it as deferred consumer migration in the plan.

If the promotion reveals that the base version is more entangled with its module than the plan anticipated, stop and ask. Do not power through an entangled promotion.

Do not promote any other components. Do not refactor unrelated code. Do not touch canvas-layer files.

Update ui-audit/08-claim-b-plan.md by marking StatusBadge as completed with date and listing migrated consumers and deferred consumers.

When done print: file paths modified, count of consumers migrated, count of consumers deferred with reasons, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the planning documents first.


## #ASSISTANT

Good. Now reading the source implementations before writing anything.


## #ASSISTANT

Now let me check the Email.tsx badge implementation and then check where Import.tsx uses the badge in context.


## #BASH
_Find badge/status usage in Email.tsx_

```bash
grep -n "Badge\|badge\|dot\|indicator\|status" /home/io/io-dev/io/frontend/src/pages/settings/Email.tsx | head -40
```


## #ASSISTANT

Let me see how SystemHealth.tsx uses its local StatusBadge and where Email.tsx uses StatusBadge on line 339.


## #BASH
_Find StatusBadge usages in SystemHealth.tsx_

```bash
grep -n "StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx
```


## #BASH
_Check ServiceStatus type definition_

```bash
grep -n "ServiceStatus\|ServiceHealth" /home/io/io-dev/io/frontend/src/api/health.ts | head -20
```


## #BASH
_Find overallStatus definition_

```bash
grep -n "overallStatus" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx | head -10
```


## #BASH
_Find STATUS_COLORS and StatusBadge usage in OpcSources.tsx_

```bash
grep -n "STATUS_COLORS\|StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx
```


## #ASSISTANT

Good. Now I have everything I need. Let me verify token availability before writing the component.


## #BASH
_Verify all tokens used in StatusBadge are defined in index.css_

```bash
grep -E "(--io-success-subtle|--io-accent-subtle|--io-warning-subtle|--io-danger-subtle|--io-surface-tertiary|--io-text-muted|--io-success[^-]|--io-accent[^-]|--io-warning[^-]|--io-danger[^-]):" /home/io/io-dev/io/frontend/src/index.css | head -30
```


## #BASH
_Verify base color tokens exist in index.css_

```bash
grep -E "(--io-success:|--io-accent:|--io-warning:|--io-danger:|--io-surface-tertiary:)" /home/io/io-dev/io/frontend/src/index.css | head -20
```


## #BASH
_Verify --io-surface-tertiary token exists_

```bash
grep -n "surface-tertiary" /home/io/io-dev/io/frontend/src/index.css | head -10
```


## #ASSISTANT

`--io-surface-tertiary` is missing. Let me check what the Import.tsx version uses and what token might substitute.


## #BASH
_Check if surface-tertiary is used anywhere_

```bash
grep -n "surface-tertiary" /home/io/io-dev/io/frontend/src/index.css /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx 2>/dev/null
```


## #BASH
_Find all uses of surface-tertiary_

```bash
grep -rn "surface-tertiary" /home/io/io-dev/io/frontend/src/ | head -15
```


## #BASH
_Check which surface tokens are defined_

```bash
grep -n "surface-secondary\|surface-elevated\|surface-sunken\|surface-primary" /home/io/io-dev/io/frontend/src/index.css | head -20
```


## #ASSISTANT

All tokens confirmed. `--io-surface-tertiary` is undefined — I'll use `--io-surface-secondary` instead and note the substitution. Now building the component and migrating consumers.


## #ASSISTANT

Now migrate Import.tsx — remove the local function and add the import.


## #ASSISTANT

Now migrate Import.tsx:


## #ASSISTANT

Now migrate OpcSources.tsx:


## #ASSISTANT

Now migrate SystemHealth.tsx:


## #ASSISTANT

Now update the three call sites in SystemHealth.tsx:


## #BASH
_Find current StatusBadge call sites in SystemHealth.tsx_

```bash
grep -n "StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx
```


## #ASSISTANT

Now migrate Email.tsx:


## #ASSISTANT

Now run the build to verify no type errors:


## #BASH
_Run pnpm build to check for type errors_

```bash
cd /home/io/io-dev/io/frontend && pnpm build 2>&1 | tail -30
```


## #ASSISTANT

Build passes clean. Now update the plan document.


## #ASSISTANT

Now add execution notes to the plan after the consumer table:


## #TURN_END

_2026-05-28T04:10:15+00:00_

---


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (348→777 chars)

_2026-05-28T04:13:12+00:00_


## #PROMPT

_2026-05-28T04:13:18+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
/home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #ASSISTANT

Clean review with three findings — all documented, two are pure cosmetic changes already noted, one is a semantic concern worth recording. Let me add a design note to the plan about the `inactive` semantic decision.


## #TURN_END

_2026-05-28T04:13:19+00:00_

---


## #PROMPT

_2026-05-28T04:15:35+00:00_

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
# Work Unit Log: workstream-3c-promote-statusbadge

read-

Started: 2026-05-28T04:02:55+00:00
Session: 831358e0-0a5b-4c08-9e7e-6ddcb3fd4166

---


## #WRITE `/home/io/io-dev/io/frontend/src/shared/components/StatusBadge.tsx` (2707 chars written)

_2026-05-28T04:07:13+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/shared/components/StatusBadge.tsx` (56→28 chars)

_2026-05-28T04:07:23+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Import.tsx` (64→127 chars)

_2026-05-28T04:07:26+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Import.tsx` (1190→0 chars)

_2026-05-28T04:07:32+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` (40→103 chars)

_2026-05-28T04:07:40+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` (1134→0 chars)

_2026-05-28T04:07:46+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (1783→649 chars)

_2026-05-28T04:07:59+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (59→93 chars)

_2026-05-28T04:08:10+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (76→122 chars)

_2026-05-28T04:08:13+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` (53→90 chars)

_2026-05-28T04:08:16+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Email.tsx` (33→96 chars)

_2026-05-28T04:08:21+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/settings/Email.tsx` (883→0 chars)

_2026-05-28T04:08:27+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (50→72 chars)

_2026-05-28T04:09:48+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (371→2526 chars)

_2026-05-28T04:10:05+00:00_


## #PROMPT

_2026-05-28T04:10:13+00:00_

```
~initprompt~ workstream-3c-promote-StatusBadge

Read ui-audit/08-claim-b-plan.md section two for the component promotions plan, specifically the entry for StatusBadge. Read ui-audit/05-claim-c-deferral.md to confirm exclusions. Read ui-audit/08b-constants-checkin.md to confirm prior work is clear.

Goal: promote StatusBadge per the plan. Work in three steps: promote to shared location, set the API to the minimal surface specified in the plan, then migrate consumers.

Step one, promote. Move or copy the base implementation from the source-of-truth location specified in the plan to its new shared location. Use the rationale recorded in the plan for choosing the base.

Step two, set API. Adjust the API to match the plan's minimal surface. Document any behavior the base version had that is being dropped, and flag any consumer that depended on that behavior. If a consumer needed behavior beyond the minimal API, add the requirement to ui-audit/08-claim-b-plan.md as a note on this component's entry rather than expanding the API; the consumer can be handled as a deferred migration.

Step three, migrate consumers. For each consumer identified in the plan, the migration should be a substitution: import the new component, replace the call site, verify behavior matches. For any consumer that requires more than substitution-level refactoring, do not refactor in this prompt. Record it as deferred consumer migration in the plan.

If the promotion reveals that the base version is more entangled with its module than the plan anticipated, stop and ask. Do not power through an entangled promotion.

Do not promote any other components. Do not refactor unrelated code. Do not touch canvas-layer files.

Update ui-audit/08-claim-b-plan.md by marking StatusBadge as completed with date and listing migrated consumers and deferred consumers.

When done print: file paths modified, count of consumers migrated, count of consumers deferred with reasons, and any items where you stopped to ask. Stop.
```


## #ASSISTANT

Reading the planning documents first.


## #ASSISTANT

Good. Now reading the source implementations before writing anything.


## #ASSISTANT

Now let me check the Email.tsx badge implementation and then check where Import.tsx uses the badge in context.


## #BASH
_Find badge/status usage in Email.tsx_

```bash
grep -n "Badge\|badge\|dot\|indicator\|status" /home/io/io-dev/io/frontend/src/pages/settings/Email.tsx | head -40
```


## #ASSISTANT

Let me see how SystemHealth.tsx uses its local StatusBadge and where Email.tsx uses StatusBadge on line 339.


## #BASH
_Find StatusBadge usages in SystemHealth.tsx_

```bash
grep -n "StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx
```


## #BASH
_Check ServiceStatus type definition_

```bash
grep -n "ServiceStatus\|ServiceHealth" /home/io/io-dev/io/frontend/src/api/health.ts | head -20
```


## #BASH
_Find overallStatus definition_

```bash
grep -n "overallStatus" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx | head -10
```


## #BASH
_Find STATUS_COLORS and StatusBadge usage in OpcSources.tsx_

```bash
grep -n "STATUS_COLORS\|StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx
```


## #ASSISTANT

Good. Now I have everything I need. Let me verify token availability before writing the component.


## #BASH
_Verify all tokens used in StatusBadge are defined in index.css_

```bash
grep -E "(--io-success-subtle|--io-accent-subtle|--io-warning-subtle|--io-danger-subtle|--io-surface-tertiary|--io-text-muted|--io-success[^-]|--io-accent[^-]|--io-warning[^-]|--io-danger[^-]):" /home/io/io-dev/io/frontend/src/index.css | head -30
```


## #BASH
_Verify base color tokens exist in index.css_

```bash
grep -E "(--io-success:|--io-accent:|--io-warning:|--io-danger:|--io-surface-tertiary:)" /home/io/io-dev/io/frontend/src/index.css | head -20
```


## #BASH
_Verify --io-surface-tertiary token exists_

```bash
grep -n "surface-tertiary" /home/io/io-dev/io/frontend/src/index.css | head -10
```


## #ASSISTANT

`--io-surface-tertiary` is missing. Let me check what the Import.tsx version uses and what token might substitute.


## #BASH
_Check if surface-tertiary is used anywhere_

```bash
grep -n "surface-tertiary" /home/io/io-dev/io/frontend/src/index.css /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx 2>/dev/null
```


## #BASH
_Find all uses of surface-tertiary_

```bash
grep -rn "surface-tertiary" /home/io/io-dev/io/frontend/src/ | head -15
```


## #BASH
_Check which surface tokens are defined_

```bash
grep -n "surface-secondary\|surface-elevated\|surface-sunken\|surface-primary" /home/io/io-dev/io/frontend/src/index.css | head -20
```


## #ASSISTANT

All tokens confirmed. `--io-surface-tertiary` is undefined — I'll use `--io-surface-secondary` instead and note the substitution. Now building the component and migrating consumers.


## #ASSISTANT

Now migrate Import.tsx — remove the local function and add the import.


## #ASSISTANT

Now migrate Import.tsx:


## #ASSISTANT

Now migrate OpcSources.tsx:


## #ASSISTANT

Now migrate SystemHealth.tsx:


## #ASSISTANT

Now update the three call sites in SystemHealth.tsx:


## #BASH
_Find current StatusBadge call sites in SystemHealth.tsx_

```bash
grep -n "StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx
```


## #ASSISTANT

Now migrate Email.tsx:


## #ASSISTANT

Now run the build to verify no type errors:


## #BASH
_Run pnpm build to check for type errors_

```bash
cd /home/io/io-dev/io/frontend && pnpm build 2>&1 | tail -30
```


## #ASSISTANT

Build passes clean. Now update the plan document.


## #ASSISTANT

Now add execution notes to the plan after the consumer table:


## #TURN_END

_2026-05-28T04:10:15+00:00_

---


## #EDIT `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (348→777 chars)

_2026-05-28T04:13:12+00:00_


## #PROMPT

_2026-05-28T04:13:18+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
/home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #ASSISTANT

Clean review with three findings — all documented, two are pure cosmetic changes already noted, one is a semantic concern worth recording. Let me add a design note to the plan about the `inactive` semantic decision.


## #TURN_END

_2026-05-28T04:13:19+00:00_

---
---

WORK UNIT SUMMARY:
---
# Work Unit Summary

**Generated**: 2026-05-28T04:15:20+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-statusbadge

read-_040255.md`
**Session**: 

---

## Work unit purpose

Promote a shared `StatusBadge` component to `src/shared/components/StatusBadge.tsx` and migrate all four settings-page consumers from their local inline implementations to the new shared component.

## Key decisions made

- Selected the Import.tsx inline implementation as the base (per the plan)
- Substituted `--io-surface-secondary` for `--io-surface-tertiary` (undefined token) for the `inactive` variant
- Minimal API surface only: `variant` and `label` props; no expansion for consumer-specific behavior
- SystemHealth.tsx required mapping its `overallStatus` values to the shared component's variant names at call sites

## What was built or changed

- Created `src/shared/components/StatusBadge.tsx` with minimal API (`variant`, `label`)
- Removed local inline `StatusBadge`/`getBadgeConfig` functions from `Import.tsx`, `OpcSources.tsx`, `SystemHealth.tsx`, and `Email.tsx`
- Added import of shared `StatusBadge` in all four consumer files
- Updated call sites in `SystemHealth.tsx` to map its existing variant values to the shared API
- Marked StatusBadge as completed in `ui-audit/08-claim-b-plan.md` with migrated consumer list and design note on `inactive` semantic
- Build verified clean (`pnpm build` passed)

## What was deliberately not done

- No consumers were deferred — all four were migrated in this unit
- No other components were promoted
- Canvas-layer files were not touched

## Files modified

- `src/shared/components/StatusBadge.tsx` (created)
- `src/pages/settings/Import.tsx`
- `src/pages/settings/OpcSources.tsx`
- `src/pages/settings/SystemHealth.tsx`
- `src/pages/settings/Email.tsx`
- `ui-audit/08-claim-b-plan.md`
SessionEnd hook [${CLAUDE_PROJECT_DIR}/.claude/hooks/session-end.sh] failed: /bin/sh: 1: /home/io/io-dev/io/frontend/.claude/hooks/session-end.sh: not found
---


DIFF OF CHANGES:
---
diff --git a/frontend/src/pages/settings/Email.tsx b/frontend/src/pages/settings/Email.tsx
index 51df8ab5..917cabcc 100644
--- a/frontend/src/pages/settings/Email.tsx
+++ b/frontend/src/pages/settings/Email.tsx
@@ -1,4 +1,5 @@
 import { useState } from "react";
+import StatusBadge from "../../shared/components/StatusBadge";
 import * as Dialog from "@radix-ui/react-dialog";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
@@ -173,43 +174,6 @@ function TestEmailDialog({
   );
 }
 
-// ---------------------------------------------------------------------------
-// Status badge
-// ---------------------------------------------------------------------------
-
-const STATUS_COLORS: Record<string, string> = {
-  pending: "var(--io-warning)",
-  retry: "var(--io-warning)",
-  sent: "var(--io-success)",
-  failed: "var(--io-danger)",
-};
-
-function StatusBadge({ status }: { status: string }) {
-  const color = STATUS_COLORS[status] ?? "var(--io-text-muted)";
-  return (
-    <span
-      style={{
-        display: "inline-flex",
-        alignItems: "center",
-        gap: "5px",
-        fontSize: "12px",
-        fontWeight: 500,
-        color,
-      }}
-    >
-      <span
-        style={{
-          width: "7px",
-          height: "7px",
-          borderRadius: "50%",
-          background: color,
-          flexShrink: 0,
-        }}
-      />
-      {status}
-    </span>
-  );
-}
 
 // ---------------------------------------------------------------------------
 // Providers tab
diff --git a/frontend/src/pages/settings/Import.tsx b/frontend/src/pages/settings/Import.tsx
index a90a8bba..093ddfca 100644
--- a/frontend/src/pages/settings/Import.tsx
+++ b/frontend/src/pages/settings/Import.tsx
@@ -1,4 +1,5 @@
 import React, { useState, useEffect, useCallback } from "react";
+import StatusBadge from "../../shared/components/StatusBadge";
 import ContextMenu from "../../shared/components/ContextMenu";
 import { useContextMenu } from "../../shared/hooks/useContextMenu";
 import { useSearchParams } from "react-router-dom";
@@ -69,41 +70,6 @@ function useDataCategories() {
 // Helpers
 // ---------------------------------------------------------------------------
 
-function StatusBadge({ status }: { status: string }) {
-  const colors: Record<string, { bg: string; color: string }> = {
-    completed: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
-    running: { bg: "var(--io-accent-subtle)", color: "var(--io-accent)" },
-    pending: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
-    failed: { bg: "var(--io-danger-subtle)", color: "var(--io-danger)" },
-    cancelled: {
-      bg: "var(--io-surface-tertiary)",
-      color: "var(--io-text-muted)",
-    },
-    partial: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
-    ok: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
-    error: { bg: "var(--io-danger-subtle)", color: "var(--io-danger)" },
-  };
-  const style = colors[status] ?? {
-    bg: "var(--io-surface-tertiary)",
-    color: "var(--io-text-muted)",
-  };
-  return (
-    <span
-      style={{
-        display: "inline-block",
-        padding: "2px 8px",
-        borderRadius: "999px",
-        fontSize: "11px",
-        fontWeight: 600,
-        background: style.bg,
-        color: style.color,
-        textTransform: "capitalize",
-      }}
-    >
-      {status}
-    </span>
-  );
-}
 
 function DomainBadge({ domain }: { domain: string }) {
   return (
diff --git a/frontend/src/pages/settings/OpcSources.tsx b/frontend/src/pages/settings/OpcSources.tsx
index 89713e31..ce48eb16 100644
--- a/frontend/src/pages/settings/OpcSources.tsx
+++ b/frontend/src/pages/settings/OpcSources.tsx
@@ -1,4 +1,5 @@
 import React, { useState } from "react";
+import StatusBadge from "../../shared/components/StatusBadge";
 import ContextMenu from "../../shared/components/ContextMenu";
 import { useContextMenu } from "../../shared/hooks/useContextMenu";
 import * as Dialog from "@radix-ui/react-dialog";
@@ -142,48 +143,6 @@ const clientCertsApi = {
     }),
 };
 
-// ---------------------------------------------------------------------------
-// Status badge
-// ---------------------------------------------------------------------------
-
-const STATUS_COLORS: Record<string, string> = {
-  active: "var(--io-success)",
-  inactive: "var(--io-text-muted)",
-  connecting: "var(--io-warning)",
-  error: "var(--io-danger)",
-};
-
-function StatusBadge({ status }: { status: string }) {
-  const color = STATUS_COLORS[status] ?? "var(--io-text-muted)";
-  return (
-    <span
-      style={{
-        display: "inline-flex",
-        alignItems: "center",
-        gap: "5px",
-        padding: "2px 8px",
-        borderRadius: "9999px",
-        fontSize: "11px",
-        fontWeight: 600,
-        background: `color-mix(in srgb, ${color} 12%, transparent)`,
-        color,
-        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
-        textTransform: "capitalize",
-      }}
-    >
-      <span
-        style={{
-          width: "6px",
-          height: "6px",
-          borderRadius: "50%",
-          background: color,
-          flexShrink: 0,
-        }}
-      />
-      {status}
-    </span>
-  );
-}
 
 // ---------------------------------------------------------------------------
 // Source stats — inline chips for the table row
diff --git a/frontend/src/pages/settings/SystemHealth.tsx b/frontend/src/pages/settings/SystemHealth.tsx
index 365c2dbd..b9ccac85 100644
--- a/frontend/src/pages/settings/SystemHealth.tsx
+++ b/frontend/src/pages/settings/SystemHealth.tsx
@@ -9,66 +9,15 @@ import {
   type ServiceHealth,
 } from "../../api/health";
 import TimeSeriesChart from "../../shared/components/charts/TimeSeriesChart";
+import StatusBadge from "../../shared/components/StatusBadge";
 
-// ── Status badge ──────────────────────────────────────────────────────────────
-
-const STATUS_COLORS: Record<
-  ServiceStatus,
-  { bg: string; text: string; label: string }
-> = {
-  healthy: {
-    bg: "color-mix(in srgb, var(--io-success) 12%, transparent)",
-    text: "var(--io-success)",
-    label: "Ready",
-  },
-  degraded: {
-    bg: "color-mix(in srgb, var(--io-warning) 15%, transparent)",
-    text: "var(--io-warning)",
-    label: "Degraded",
-  },
-  unhealthy: {
-    bg: "color-mix(in srgb, var(--io-danger) 12%, transparent)",
-    text: "var(--io-danger)",
-    label: "Not Ready",
-  },
-  unknown: {
-    bg: "var(--io-surface-secondary)",
-    text: "var(--io-text-muted)",
-    label: "Unknown",
-  },
+const STATUS_LABELS: Record<ServiceStatus, string> = {
+  healthy: "Ready",
+  degraded: "Degraded",
+  unhealthy: "Not Ready",
+  unknown: "Unknown",
 };
 
-function StatusBadge({ status }: { status: ServiceStatus }) {
-  const c = STATUS_COLORS[status];
-  return (
-    <span
-      style={{
-        display: "inline-flex",
-        alignItems: "center",
-        gap: "5px",
-        fontSize: "12px",
-        padding: "3px 10px",
-        borderRadius: "100px",
-        background: c.bg,
-        color: c.text,
-        fontWeight: 700,
-      }}
-    >
-      <span
-        aria-hidden="true"
-        style={{
-          width: "6px",
-          height: "6px",
-          borderRadius: "50%",
-          background: c.text,
-          flexShrink: 0,
-        }}
-      />
-      {c.label}
-    </span>
-  );
-}
-
 // ── Service metadata ──────────────────────────────────────────────────────────
 
 const SERVICE_INFO: Record<
@@ -447,7 +396,7 @@ function ServicesTab() {
                         :{svc.port}
                       </td>
                       <td style={{ padding: "10px 12px" }}>
-                        <StatusBadge status={svc.status} />
+                        <StatusBadge status={svc.status} label={STATUS_LABELS[svc.status]} />
                       </td>
                       <td
                         style={{
@@ -827,7 +776,7 @@ function OpcSourcesTab() {
                 {src.source_id}
               </span>
             </div>
-            <StatusBadge status={src.connected ? "healthy" : "unhealthy"} />
+            <StatusBadge status={src.connected ? "healthy" : "unhealthy"} label={src.connected ? "Ready" : "Not Ready"} />
           </div>
           {/* Source metrics */}
           <div
@@ -1451,7 +1400,7 @@ export default function SystemHealth() {
       title="System Health"
       description="Deep operational visibility across all services and infrastructure."
       variant="list"
-      action={<StatusBadge status={overallStatus} />}
+      action={<StatusBadge status={overallStatus} label={STATUS_LABELS[overallStatus]} />}
     >
       <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
         {/* Summary tiles */}
diff --git a/ui-audit/08-claim-b-plan.md b/ui-audit/08-claim-b-plan.md
index 90a35764..1299fa9d 100644
--- a/ui-audit/08-claim-b-plan.md
+++ b/ui-audit/08-claim-b-plan.md
@@ -228,7 +228,7 @@ The only change from the source: `fontSize: 10` → `fontSize: 11` per the Cat 2
 
 ---
 
-### 2.2 StatusBadge
+### 2.2 StatusBadge — **DONE 2026-05-28**
 
 #### Source-of-truth location
 
@@ -281,6 +281,21 @@ Visual: pill with `borderRadius: "9999px"`, `padding: "2px 8px"`, `fontSize: 11`
 | `pages/settings/MaintenanceTicketsPanel.tsx:52` | Same hex-alpha bug | Same — separate bug fix |
 | Console priority/state/quality badges | Hardcoded rgba/hex, semantically different (alarm priority vs. connection status) | **Risk item:** alarm-domain badges (PriorityBadge, StateBadge, QualityBadge) have different semantic vocabulary and hardcoded alarm-specific colors. Not a StatusBadge concern. Flag for Claim C / alarm token work, not here. |
 
+**Execution notes (2026-05-28):**
+- `frontend/src/shared/components/StatusBadge.tsx` created. API: `{ status: string; label?: string }`. `label` defaults to `status` display text.
+- Token-pair map covers plan vocabulary plus additions required by consumers: `sent` (success), `retry` (warning), `degraded` (warning) for Email.tsx and SystemHealth.tsx.
+- Token substitution: `--io-surface-tertiary` is undefined in `index.css`. Plan spec used this token (inherited from Import.tsx base which also used it). Substituted with `--io-surface-secondary` (defined). Adds a subtle visible background for neutral/muted states rather than transparent.
+- OpcSources migration: the border (`1px solid color-mix(...)`) from the post-fix version is **dropped** — not part of the plan's visual spec. The shared component uses token-pair bg directly.
+- OpcSources `inactive` status: current implementation had `inactive → --io-text-muted` (muted); plan maps `inactive → danger`. Migration follows the plan.
+- **Import.tsx:** local `StatusBadge` removed; import from shared added. Zero call-site changes.
+- **OpcSources.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Zero call-site changes.
+- **SystemHealth.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Local `STATUS_LABELS` record added to preserve custom display labels (Ready/Degraded/Not Ready/Unknown). All 3 call sites updated with `label` prop.
+- **Email.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Zero call-site changes. Visual change: dot-only (no background) → dot + pill with background color. Email.tsx `disabled` status (line 339) maps to default muted.
+- **Consumers migrated:** 4 (`Import.tsx`, `OpcSources.tsx`, `SystemHealth.tsx`, `Email.tsx`)
+- **Consumers deferred:** `PointManagement.tsx` (boolean `ActiveBadge` API mismatch — not a substitution); `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx` (hex-alpha bug fix, separate pass per DC-6); Console alarm badges (different semantic vocabulary, out of scope per plan).
+- **Design note — `inactive` semantic:** Plan maps `inactive → danger`. OpcSources previously showed `inactive` as muted (neutral). The change means a manually-disabled OPC source now shows a red badge. If operator feedback indicates this causes alarm fatigue, move `inactive` to a new `disabled` tier (muted) and add explicit `disabled` as a muted-tier alias. Intentional as executed; flag for UX review in the OpcSources pass.
+- `pnpm build` passed with no type errors.
+
 ---
 
 ### 2.3 Dialog
---

Produce the review now.
```


## #TURN_END

_2026-05-28T04:15:35+00:00_

---


## #PROMPT

_2026-05-28T04:16:31+00:00_

```
~wrapup~
```


## #BASH
_Get current log path_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && echo "$CLAUDE_LOG"
```


## #BASH
_Generate work unit summary_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/generate-summary.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #BASH
_Run shallow review_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID" "shallow"
```


## #BASH
_Update interim docs_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #TURN_END

_2026-05-28T04:16:32+00:00_

---
---

WORK UNIT SUMMARY:
---
# Work Unit Summary

**Generated**: 2026-05-28T04:16:48+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-statusbadge

read-_040255.md`
**Session**: 831358e0-0a5b-4c08-9e7e-6ddcb3fd4166

---

## Work unit purpose

Promote a shared `StatusBadge` component to `src/shared/components/StatusBadge.tsx` and migrate all four settings-page consumers from inline local implementations to the new shared component.

## Key decisions made

- Import.tsx implementation selected as the base (pill-style with token-pair bg/text map)
- `--io-surface-tertiary` (undefined token) substituted with `--io-surface-secondary` for the neutral/muted variant
- Minimal API surface only: `{ status: string; label?: string }` — no consumer-specific expansion
- `inactive` status mapped to `danger` variant per plan (not the muted style OpcSources previously used)
- Border styling from OpcSources post-fix version dropped — not in plan's visual spec
- SystemHealth requires a local `STATUS_LABELS` record to preserve custom display text (Ready/Degraded/Not Ready/Unknown)

## What was built or changed

- Created `src/shared/components/StatusBadge.tsx` with minimal API
- Removed local `StatusBadge` implementations and `STATUS_COLORS` from `Import.tsx`, `OpcSources.tsx`, `SystemHealth.tsx`, and `Email.tsx`
- Added shared import in all four consumer files
- Updated all 3 call sites in `SystemHealth.tsx` with explicit `label` prop
- `pnpm build` verified clean
- `ui-audit/08-claim-b-plan.md` updated: StatusBadge marked DONE 2026-05-28, full execution notes added including token substitution, visual changes, and deferred consumers

## What was deliberately not done

- `PointManagement.tsx` deferred — boolean `ActiveBadge` API mismatch, not a substitution migration
- `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx` deferred — hex-alpha bug fix, separate pass per DC-6
- Console alarm badges (PriorityBadge, StateBadge, QualityBadge) explicitly out of scope — different semantic vocabulary

## Open questions or follow-ups

- `inactive → danger` mapping (red badge for manually-disabled OPC source) flagged for UX review — may need a distinct `disabled` muted tier if operator feedback indicates alarm fatigue

## Files modified

- `frontend/src/shared/components/StatusBadge.tsx`
- `frontend/src/pages/settings/Import.tsx`
- `frontend/src/pages/settings/OpcSources.tsx`
- `frontend/src/pages/settings/SystemHealth.tsx`
- `frontend/src/pages/settings/Email.tsx`
- `ui-audit/08-claim-b-plan.md`
SessionEnd hook [${CLAUDE_PROJECT_DIR}/.claude/hooks/session-end.sh] failed: /bin/sh: 1: /home/io/io-dev/io/frontend/.claude/hooks/session-end.sh: not found
---


DIFF OF CHANGES:
---
diff --git a/frontend/src/pages/settings/Email.tsx b/frontend/src/pages/settings/Email.tsx
index 51df8ab5..917cabcc 100644
--- a/frontend/src/pages/settings/Email.tsx
+++ b/frontend/src/pages/settings/Email.tsx
@@ -1,4 +1,5 @@
 import { useState } from "react";
+import StatusBadge from "../../shared/components/StatusBadge";
 import * as Dialog from "@radix-ui/react-dialog";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
@@ -173,43 +174,6 @@ function TestEmailDialog({
   );
 }
 
-// ---------------------------------------------------------------------------
-// Status badge
-// ---------------------------------------------------------------------------
-
-const STATUS_COLORS: Record<string, string> = {
-  pending: "var(--io-warning)",
-  retry: "var(--io-warning)",
-  sent: "var(--io-success)",
-  failed: "var(--io-danger)",
-};
-
-function StatusBadge({ status }: { status: string }) {
-  const color = STATUS_COLORS[status] ?? "var(--io-text-muted)";
-  return (
-    <span
-      style={{
-        display: "inline-flex",
-        alignItems: "center",
-        gap: "5px",
-        fontSize: "12px",
-        fontWeight: 500,
-        color,
-      }}
-    >
-      <span
-        style={{
-          width: "7px",
-          height: "7px",
-          borderRadius: "50%",
-          background: color,
-          flexShrink: 0,
-        }}
-      />
-      {status}
-    </span>
-  );
-}
 
 // ---------------------------------------------------------------------------
 // Providers tab
diff --git a/frontend/src/pages/settings/Import.tsx b/frontend/src/pages/settings/Import.tsx
index a90a8bba..093ddfca 100644
--- a/frontend/src/pages/settings/Import.tsx
+++ b/frontend/src/pages/settings/Import.tsx
@@ -1,4 +1,5 @@
 import React, { useState, useEffect, useCallback } from "react";
+import StatusBadge from "../../shared/components/StatusBadge";
 import ContextMenu from "../../shared/components/ContextMenu";
 import { useContextMenu } from "../../shared/hooks/useContextMenu";
 import { useSearchParams } from "react-router-dom";
@@ -69,41 +70,6 @@ function useDataCategories() {
 // Helpers
 // ---------------------------------------------------------------------------
 
-function StatusBadge({ status }: { status: string }) {
-  const colors: Record<string, { bg: string; color: string }> = {
-    completed: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
-    running: { bg: "var(--io-accent-subtle)", color: "var(--io-accent)" },
-    pending: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
-    failed: { bg: "var(--io-danger-subtle)", color: "var(--io-danger)" },
-    cancelled: {
-      bg: "var(--io-surface-tertiary)",
-      color: "var(--io-text-muted)",
-    },
-    partial: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
-    ok: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
-    error: { bg: "var(--io-danger-subtle)", color: "var(--io-danger)" },
-  };
-  const style = colors[status] ?? {
-    bg: "var(--io-surface-tertiary)",
-    color: "var(--io-text-muted)",
-  };
-  return (
-    <span
-      style={{
-        display: "inline-block",
-        padding: "2px 8px",
-        borderRadius: "999px",
-        fontSize: "11px",
-        fontWeight: 600,
-        background: style.bg,
-        color: style.color,
-        textTransform: "capitalize",
-      }}
-    >
-      {status}
-    </span>
-  );
-}
 
 function DomainBadge({ domain }: { domain: string }) {
   return (
diff --git a/frontend/src/pages/settings/OpcSources.tsx b/frontend/src/pages/settings/OpcSources.tsx
index 89713e31..ce48eb16 100644
--- a/frontend/src/pages/settings/OpcSources.tsx
+++ b/frontend/src/pages/settings/OpcSources.tsx
@@ -1,4 +1,5 @@
 import React, { useState } from "react";
+import StatusBadge from "../../shared/components/StatusBadge";
 import ContextMenu from "../../shared/components/ContextMenu";
 import { useContextMenu } from "../../shared/hooks/useContextMenu";
 import * as Dialog from "@radix-ui/react-dialog";
@@ -142,48 +143,6 @@ const clientCertsApi = {
     }),
 };
 
-// ---------------------------------------------------------------------------
-// Status badge
-// ---------------------------------------------------------------------------
-
-const STATUS_COLORS: Record<string, string> = {
-  active: "var(--io-success)",
-  inactive: "var(--io-text-muted)",
-  connecting: "var(--io-warning)",
-  error: "var(--io-danger)",
-};
-
-function StatusBadge({ status }: { status: string }) {
-  const color = STATUS_COLORS[status] ?? "var(--io-text-muted)";
-  return (
-    <span
-      style={{
-        display: "inline-flex",
-        alignItems: "center",
-        gap: "5px",
-        padding: "2px 8px",
-        borderRadius: "9999px",
-        fontSize: "11px",
-        fontWeight: 600,
-        background: `color-mix(in srgb, ${color} 12%, transparent)`,
-        color,
-        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
-        textTransform: "capitalize",
-      }}
-    >
-      <span
-        style={{
-          width: "6px",
-          height: "6px",
-          borderRadius: "50%",
-          background: color,
-          flexShrink: 0,
-        }}
-      />
-      {status}
-    </span>
-  );
-}
 
 // ---------------------------------------------------------------------------
 // Source stats — inline chips for the table row
diff --git a/frontend/src/pages/settings/SystemHealth.tsx b/frontend/src/pages/settings/SystemHealth.tsx
index 365c2dbd..b9ccac85 100644
--- a/frontend/src/pages/settings/SystemHealth.tsx
+++ b/frontend/src/pages/settings/SystemHealth.tsx
@@ -9,66 +9,15 @@ import {
   type ServiceHealth,
 } from "../../api/health";
 import TimeSeriesChart from "../../shared/components/charts/TimeSeriesChart";
+import StatusBadge from "../../shared/components/StatusBadge";
 
-// ── Status badge ──────────────────────────────────────────────────────────────
-
-const STATUS_COLORS: Record<
-  ServiceStatus,
-  { bg: string; text: string; label: string }
-> = {
-  healthy: {
-    bg: "color-mix(in srgb, var(--io-success) 12%, transparent)",
-    text: "var(--io-success)",
-    label: "Ready",
-  },
-  degraded: {
-    bg: "color-mix(in srgb, var(--io-warning) 15%, transparent)",
-    text: "var(--io-warning)",
-    label: "Degraded",
-  },
-  unhealthy: {
-    bg: "color-mix(in srgb, var(--io-danger) 12%, transparent)",
-    text: "var(--io-danger)",
-    label: "Not Ready",
-  },
-  unknown: {
-    bg: "var(--io-surface-secondary)",
-    text: "var(--io-text-muted)",
-    label: "Unknown",
-  },
+const STATUS_LABELS: Record<ServiceStatus, string> = {
+  healthy: "Ready",
+  degraded: "Degraded",
+  unhealthy: "Not Ready",
+  unknown: "Unknown",
 };
 
-function StatusBadge({ status }: { status: ServiceStatus }) {
-  const c = STATUS_COLORS[status];
-  return (
-    <span
-      style={{
-        display: "inline-flex",
-        alignItems: "center",
-        gap: "5px",
-        fontSize: "12px",
-        padding: "3px 10px",
-        borderRadius: "100px",
-        background: c.bg,
-        color: c.text,
-        fontWeight: 700,
-      }}
-    >
-      <span
-        aria-hidden="true"
-        style={{
-          width: "6px",
-          height: "6px",
-          borderRadius: "50%",
-          background: c.text,
-          flexShrink: 0,
-        }}
-      />
-      {c.label}
-    </span>
-  );
-}
-
 // ── Service metadata ──────────────────────────────────────────────────────────
 
 const SERVICE_INFO: Record<
@@ -447,7 +396,7 @@ function ServicesTab() {
                         :{svc.port}
                       </td>
                       <td style={{ padding: "10px 12px" }}>
-                        <StatusBadge status={svc.status} />
+                        <StatusBadge status={svc.status} label={STATUS_LABELS[svc.status]} />
                       </td>
                       <td
                         style={{
@@ -827,7 +776,7 @@ function OpcSourcesTab() {
                 {src.source_id}
               </span>
             </div>
-            <StatusBadge status={src.connected ? "healthy" : "unhealthy"} />
+            <StatusBadge status={src.connected ? "healthy" : "unhealthy"} label={src.connected ? "Ready" : "Not Ready"} />
           </div>
           {/* Source metrics */}
           <div
@@ -1451,7 +1400,7 @@ export default function SystemHealth() {
       title="System Health"
       description="Deep operational visibility across all services and infrastructure."
       variant="list"
-      action={<StatusBadge status={overallStatus} />}
+      action={<StatusBadge status={overallStatus} label={STATUS_LABELS[overallStatus]} />}
     >
       <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
         {/* Summary tiles */}
diff --git a/ui-audit/08-claim-b-plan.md b/ui-audit/08-claim-b-plan.md
index 90a35764..1299fa9d 100644
--- a/ui-audit/08-claim-b-plan.md
+++ b/ui-audit/08-claim-b-plan.md
@@ -228,7 +228,7 @@ The only change from the source: `fontSize: 10` → `fontSize: 11` per the Cat 2
 
 ---
 
-### 2.2 StatusBadge
+### 2.2 StatusBadge — **DONE 2026-05-28**
 
 #### Source-of-truth location
 
@@ -281,6 +281,21 @@ Visual: pill with `borderRadius: "9999px"`, `padding: "2px 8px"`, `fontSize: 11`
 | `pages/settings/MaintenanceTicketsPanel.tsx:52` | Same hex-alpha bug | Same — separate bug fix |
 | Console priority/state/quality badges | Hardcoded rgba/hex, semantically different (alarm priority vs. connection status) | **Risk item:** alarm-domain badges (PriorityBadge, StateBadge, QualityBadge) have different semantic vocabulary and hardcoded alarm-specific colors. Not a StatusBadge concern. Flag for Claim C / alarm token work, not here. |
 
+**Execution notes (2026-05-28):**
+- `frontend/src/shared/components/StatusBadge.tsx` created. API: `{ status: string; label?: string }`. `label` defaults to `status` display text.
+- Token-pair map covers plan vocabulary plus additions required by consumers: `sent` (success), `retry` (warning), `degraded` (warning) for Email.tsx and SystemHealth.tsx.
+- Token substitution: `--io-surface-tertiary` is undefined in `index.css`. Plan spec used this token (inherited from Import.tsx base which also used it). Substituted with `--io-surface-secondary` (defined). Adds a subtle visible background for neutral/muted states rather than transparent.
+- OpcSources migration: the border (`1px solid color-mix(...)`) from the post-fix version is **dropped** — not part of the plan's visual spec. The shared component uses token-pair bg directly.
+- OpcSources `inactive` status: current implementation had `inactive → --io-text-muted` (muted); plan maps `inactive → danger`. Migration follows the plan.
+- **Import.tsx:** local `StatusBadge` removed; import from shared added. Zero call-site changes.
+- **OpcSources.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Zero call-site changes.
+- **SystemHealth.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Local `STATUS_LABELS` record added to preserve custom display labels (Ready/Degraded/Not Ready/Unknown). All 3 call sites updated with `label` prop.
+- **Email.tsx:** local `STATUS_COLORS` and `StatusBadge` removed; import from shared added. Zero call-site changes. Visual change: dot-only (no background) → dot + pill with background color. Email.tsx `disabled` status (line 339) maps to default muted.
+- **Consumers migrated:** 4 (`Import.tsx`, `OpcSources.tsx`, `SystemHealth.tsx`, `Email.tsx`)
+- **Consumers deferred:** `PointManagement.tsx` (boolean `ActiveBadge` API mismatch — not a substitution); `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx` (hex-alpha bug fix, separate pass per DC-6); Console alarm badges (different semantic vocabulary, out of scope per plan).
+- **Design note — `inactive` semantic:** Plan maps `inactive → danger`. OpcSources previously showed `inactive` as muted (neutral). The change means a manually-disabled OPC source now shows a red badge. If operator feedback indicates this causes alarm fatigue, move `inactive` to a new `disabled` tier (muted) and add explicit `disabled` as a muted-tier alias. Intentional as executed; flag for UX review in the OpcSources pass.
+- `pnpm build` passed with no type errors.
+
 ---
 
 ### 2.3 Dialog
---

Produce the review now.
```


## #TURN_END

_2026-05-28T04:17:05+00:00_

---


## #PROMPT

_2026-05-28T04:18:09+00:00_

```
git add -A
git commit -m "Claim B: promote COMPONENT_NAME to shared location"
```


## #BASH
_Stage all changes and commit with StatusBadge promotion message_

```bash
cd /home/io/io-dev/io && git add -A && git commit -m "Claim B: promote StatusBadge to shared location"
```


## #TURN_END

_2026-05-28T04:18:09+00:00_

---

