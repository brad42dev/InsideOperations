# Review (shallow)

**Generated**: 2026-05-28T04:17:05+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-statusbadge

read-_040255.md`
**Session**: 831358e0-0a5b-4c08-9e7e-6ddcb3fd4166
**Depth**: shallow

---

## Summary

The diff matches the stated intent. A shared `StatusBadge` component was created at `frontend/src/shared/components/StatusBadge.tsx`, all four target consumers (`Import.tsx`, `OpcSources.tsx`, `SystemHealth.tsx`, `Email.tsx`) had their local inline implementations removed and replaced with imports of the shared component, and `ui-audit/08-claim-b-plan.md` was updated to mark the work complete. The diff does not touch canvas-layer files or promote any other components. Build was verified clean.

## Concerns

1. **OpcSources `inactive` semantic change is a visible regression risk.** The old implementation mapped `inactive` to `--io-text-muted` (neutral grey). The new shared component maps `inactive` to `danger` (red). This is a deliberate decision per the plan, but it changes what operators see for manually-disabled OPC sources from a neutral indicator to an alarm-level red badge. The log notes this and flags it for UX review, but the diff itself does not show what variant the shared `StatusBadge` assigns to `inactive` — that's in the new file which is not fully visible in the diff. If `inactive` was not explicitly added to the shared component's token map, it would fall through to the default muted tier, not danger, making the execution note inconsistent with the actual behavior.

2. **Email.tsx visual regression not confirmed.** The log notes a visual change: Email's badge was previously dot-only with no background; the shared component introduces a pill background. The diff confirms the local implementation was removed and the shared import added, but there are no call-site changes visible in the Email.tsx diff — meaning the call sites still pass `status` strings like `pending`, `retry`, `sent`, `failed`. Whether those strings are in the shared component's token map is unverifiable from the diff alone (the new file content is not shown). If any of those strings fall through to a default, the visual output will differ from what the old local `STATUS_COLORS` map produced.

3. **`label` prop not passed at Email.tsx and Import.tsx call sites.** Both files had zero call-site changes. The shared component's API is `{ status: string; label?: string }` with `label` defaulting to the raw `status` string. This means Email will display raw strings like `"pending"`, `"retry"`, `"sent"` as labels, which matches the old behavior (old component also displayed raw `status`). No regression, but worth confirming this is intentional for Email specifically since the old dot-only style rendered the raw string inline whereas the new pill style capitalizes or formats differently depending on the shared component implementation.
