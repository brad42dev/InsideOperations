# Work Unit Log: workstream-3-claim-b-planning

planning-

Started: 2026-05-28T01:21:56+00:00
Session: dcbc9da0-969d-4d8b-9d8d-86ba479534a9

---


## #WRITE `/home/io/io-dev/io/ui-audit/08-claim-b-plan.md` (45069 chars written)

_2026-05-28T01:29:38+00:00_


## #PROMPT

_2026-05-28T01:29:46+00:00_

```
~initprompt~ workstream-3-claim-b-planning

Planning task. Read ui-audit/02-comparison.md and ui-audit/04-recommendations.md, focusing on entries that pertain to the module framework layer: toolbars, panels, palettes, buttons, form inputs, status indicators, labels and headers, modals and dialogs. Also read ui-audit/06-claim-a-plan.md including its lessons-for-claim-b section, ui-audit/05-claim-c-deferral.md, and ui-audit/07-future-work-notes.md.

Goal: produce ui-audit/08-claim-b-plan.md as a work plan for converging the module framework layer using the audit's recommended initial scope.

The audit's recommended initial scope is:
1. Constants files: shared/styles/buttons.ts and shared/styles/inputs.ts capturing the styling decisions that have already converged across Console, Designer, and Settings.
2. Four promoted components: FieldLabel, StatusBadge, Dialog, and the existing ConfirmDialog (which may need consolidation or migration of consumers).

The plan should focus on these. Additional component promotions are aligned with the longer-term direction but should be deferred to a follow-up pass after the initial four prove out. If you identify additional promotion candidates during planning, record them in a deferred-promotion-candidates section rather than adding them to the active scope.

Section one, constants files plan. For each constants file (buttons.ts, inputs.ts):
- Identify the styling decisions to capture. Cite the comparison rows that establish the converged values across modules.
- For any decision where Console, Designer, and Settings have already converged on the same value, capture that value as the constant.
- For any decision where modules diverge, note the divergence and recommend the value to standardize on with reasoning (typically the value that aligns with the app-shell tokens from Claim A, or the value used by the most modules, or the value the audit identified as best).
- List the consumer files that will be migrated to use these constants in a future workstream (not this one; just identify them).

Section two, component promotions plan. For each of the four components (FieldLabel, StatusBadge, Dialog, ConfirmDialog):
- Identify the source-of-truth location for the promoted version. If multiple module-local versions exist, the plan must specify which to use as the base, with reasoning.
- Identify the API surface for the promoted component: props, behavior, variants. Keep the API minimal; the goal is to promote what has converged, not to design a flexible new abstraction.
- List the consumer files that will be migrated. Some may need light refactoring at the call site; flag any needing substantive refactoring as risk items.
- For ConfirmDialog specifically, note its existing location and whether the promotion is moving it, consolidating multiple versions, or just migrating consumers.

Section three, sequencing. Constants files first because they are pure additions with no consumer changes. Component promotions next, in order of independence (FieldLabel is likely simplest, StatusBadge next, then Dialog, then ConfirmDialog if consolidation is needed). Consumer migration is deferred to a follow-up if substantial.

Section four, multi-module implications and eight-module rebuild considerations. For each constants file and each promoted component, note whether decisions affect future modules. Per the user's plan, eight additional modules will be rebuilt around these conventions. Flag any decision with significant multi-module implications for explicit user review.

Section five, definition of done for the initial Claim B scope. State concrete criteria: constants files exist with documented values; four components are promoted to shared locations with stable APIs; consumer migration plan exists (executed in this workstream or recorded as follow-up); comparison and recommendations files updated.

Section six, deferred promotion candidates. Record any component or styling pattern that emerged during planning as a candidate for a follow-up promotion pass. For each, note: what it is, where it currently lives, why it could be promoted, and what evidence would justify promoting it. This section feeds into future planning, not this workstream.

Section seven, scope discipline for execution. Enumerate things that are explicitly out of scope for THIS workstream (but may be in scope for follow-ups): promoting components beyond the initial four, building a component library framework, refactoring module-specific code beyond what consumer migration requires, touching canvas-layer files per the Claim C deferral.

Do not start implementation. When done print the file path, the counts of constants files planned and components planned, and the count of deferred promotion candidates. Stop.
```


## #ASSISTANT

Reading all the relevant audit documents before writing the plan.


## #ASSISTANT

Now I need to look at the actual source files to verify exact locations, APIs, and consumers before writing the plan.


## #BASH

```bash
grep -n "FieldLabel" /home/io/io-dev/io/frontend/src/pages/designer/DesignerRightPanel.tsx | head -30
```


## #BASH

```bash
find /home/io/io-dev/io/frontend/src/shared -name "ConfirmDialog*" 2>/dev/null && find /home/io/io-dev/io/frontend/src/shared -name "*.ts" -path "*/styles/*" 2>/dev/null
```


## #BASH

```bash
cat /home/io/io-dev/io/frontend/src/pages/settings/settingsStyles.ts
```


## #BASH

```bash
grep -rn "ConfirmDialog" /home/io/io-dev/io/frontend/src --include="*.tsx" --include="*.ts" | grep -v "ConfirmDialog.tsx" | head -30
```


## #BASH

```bash
grep -rn "ConfirmDialog" /home/io/io-dev/io/frontend/src --include="*.tsx" --include="*.ts" | grep -v "ConfirmDialog.tsx" | grep "import" | sort -u
```


## #BASH

```bash
# Check if any StatusBadge shared component exists yet
find /home/io/io-dev/io/frontend/src/shared -name "StatusBadge*" 2>/dev/null
# Check for Dialog shared component
find /home/io/io-dev/io/frontend/src/shared -name "Dialog*" 2>/dev/null
# Check for buttons.ts or inputs.ts
find /home/io/io-dev/io/frontend/src/shared -name "buttons*" -o -name "inputs*" 2>/dev/null
```


## #BASH

```bash
# Check StatusBadge implementations across Settings 
grep -n "StatusBadge\|statusBadge\|status_badge" /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx | head -20
grep -n "StatusBadge\|statusBadge\|status_badge\|color-mix" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx | head -15
```


## #BASH

```bash
# Check what button patterns exist in Console
grep -n "btnPrimary\|btnSecondary\|btnDanger\|BTN_PRIMARY\|BTN_SECONDARY" /home/io/io-dev/io/frontend/src/pages/settings/BulkUpdate.tsx | head -10
grep -n "btnPrimary\|btnSecondary\|btnDanger" /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx | head -5
```


## #BASH

```bash
# Check Import.tsx StatusBadge implementation for token-pair pattern
sed -n '72,115p' /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx
```


## #BASH

```bash
# Check SystemHealth StatusBadge
grep -n "StatusBadge\|color-mix" /home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx | head -20
```


## #BASH

```bash
# Check PointManagement and Email StatusBadge
grep -n "StatusBadge\|CriticalityBadge\|status.*badge\|badge.*status" /home/io/io-dev/io/frontend/src/pages/settings/PointManagement.tsx | head -15
grep -n "StatusBadge" /home/io/io-dev/io/frontend/src/pages/settings/Email.tsx | head -10
```


## #BASH

```bash
# Check console for StatusBadge-like things (PriorityBadge, QualityBadge)
grep -n "PriorityBadge\|QualityBadge\|StateBadge\|connection.*dot\|published.*dot" /home/io/io-dev/io/frontend/src/pages/console/index.tsx | head -20
```


## #BASH

```bash
# Check OpcSources StatusBadge (post-fix) 
sed -n '150,185p' /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx
```


## #BASH

```bash
# Check what files import from settingsStyles
grep -rn "from.*settingsStyles\|from.*settingsStyles" /home/io/io-dev/io/frontend/src --include="*.tsx" --include="*.ts" | head -25
```


## #BASH

```bash
# Find all console files that have inline button/input styles - to identify migration consumers
grep -n "background.*var(--io-accent)\|background.*#.*btn\|padding.*cursor.*pointer" /home/io/io-dev/io/frontend/src/pages/console/index.tsx | head -10
grep -n "background.*var(--io-accent)" /home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx | head -10
```


## #BASH

```bash
# Check designer text-action button locations
grep -n "borderRadius.*6\|btnPrimary\|io-accent.*bg\|background.*var(--io-accent)" /home/io/io-dev/io/frontend/src/pages/designer/DesignerToolbar.tsx | head -15
```


## #BASH

```bash
# Check designer import file for button pattern
grep -n "background.*btn\|btnPrimary\|#3b82f6\|background.*accent" /home/io/io-dev/io/frontend/src/pages/designer/DesignerImport.tsx | head -10
```


## #BASH

```bash
# Check console inline modals - to identify Dialog consumer migration
grep -n "WorkspaceNameModal\|DeleteConfirmDialog\|CloseConfirmDialog\|role.*dialog" /home/io/io-dev/io/frontend/src/pages/console/index.tsx | head -15
```


## #BASH

```bash
# Check PaneConfigModal usage details
grep -n "role.*dialog\|aria-modal\|position.*fixed.*background.*rgba" /home/io/io-dev/io/frontend/src/pages/console/PaneConfigModal.tsx | head -10
```


## #BASH

```bash
# What does DesignerImport use for buttons?
grep -n "background.*accent\|background.*#3b82f6\|btnPrimary" /home/io/io-dev/io/frontend/src/pages/designer/DesignerImport.tsx | head -10
```


## #BASH

```bash
# Get all console inline input style locations
grep -rn "outline.*none\|background.*surface-secondary.*input\|background.*surface-elevated.*input" /home/io/io-dev/io/frontend/src/pages/console/ --include="*.tsx" | head -15
```


## #BASH

```bash
# Check window.confirm calls locations 
grep -rn "window\.confirm" /home/io/io-dev/io/frontend/src --include="*.tsx" | head -15
```


## #BASH

```bash
# Check OpcSources window.confirm and Import window.confirm — updated vs comparison doc claims
grep -n "window\.confirm" /home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx 2>/dev/null | head -5
grep -n "window\.confirm" /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx 2>/dev/null | head -5
grep -n "window\.confirm" /home/io/io-dev/io/frontend/src/pages/settings/SupplementalConnectorsTab.tsx 2>/dev/null | head -5
```


## #BASH

```bash
# Check existing shared/components to understand landscape
ls /home/io/io-dev/io/frontend/src/shared/components/ 2>/dev/null
```


## #BASH

```bash
# Check Users.tsx and Roles.tsx hex-alpha bug status (whether still present)
grep -n "Badge\|badge" /home/io/io-dev/io/frontend/src/pages/settings/Users.tsx | head -10
sed -n '104,115p' /home/io/io-dev/io/frontend/src/pages/settings/Users.tsx
```


## #BASH

```bash
# Check ConfirmDialog z-index issue - it uses 100/101, not --io-z-modal
grep -n "zIndex" /home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx
```


## #BASH

```bash
grep -n "io-radius-lg\|io-radius" /home/io/io-dev/io/frontend/src/index.css | head -10
```


## #BASH

```bash
# Check for BulkUpdate BTN_DANGER pattern  
grep -n "BTN_DANGER\|BTN_PRIMARY\|BTN_SECONDARY" /home/io/io-dev/io/frontend/src/pages/settings/BulkUpdate.tsx | head -10
```


## #BASH

```bash
sed -n '33,68p' /home/io/io-dev/io/frontend/src/pages/settings/BulkUpdate.tsx
```


## #BASH

```bash
# Verify Sessions.tsx divergent inputs
grep -n "inputStyle\|outline.*none\|borderRadius\|background.*surface" /home/io/io-dev/io/frontend/src/pages/settings/Sessions.tsx | head -10
```


## #ASSISTANT

I have enough to write the plan. Let me now produce the document.


## #BASH

```bash
sed -n '187,235p' /home/io/io-dev/io/frontend/src/pages/settings/PointManagement.tsx
```


## #BASH

```bash
grep -n "StatusBadge\|function.*Badge" /home/io/io-dev/io/frontend/src/pages/settings/PointManagement.tsx | head -10
```


## #ASSISTANT

Now I have everything needed to write the plan. Writing `ui-audit/08-claim-b-plan.md`.


## #TURN_END

_2026-05-28T01:29:48+00:00_

---

