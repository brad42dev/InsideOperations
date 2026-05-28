# Review (deep)

**Generated**: 2026-05-28T04:12:59+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-statusbadge

read-_040255.md`
**Session**: 
**Depth**: deep

---

## Summary

The diff faithfully implements the stated goal: create a shared `StatusBadge` component, set its API to the minimal `{ status, label? }` surface, and migrate four consumers (`Import.tsx`, `OpcSources.tsx`, `SystemHealth.tsx`, `Email.tsx`). All local implementations are removed and replaced with a single shared import. The execution notes in the plan document accurately describe what was done, including the intentional deviations. One concern stands out that is plan-intentional but constitutes a real UX behavioral change worth calling out explicitly.

## Concerns

1. **`inactive` status changed from muted to danger in OpcSources.tsx**
   - `StatusBadge.tsx:31` maps `inactive → { bg: --io-danger-subtle, color: --io-danger }`
   - The original `OpcSources.tsx` implementation had `inactive → --io-text-muted` (neutral/grey)
   - The plan table lists inactive under danger-tier, but OPC sources can be *intentionally* inactive (manually disabled). Rendering a manually-disabled source as danger red may generate false alarm fatigue or operator confusion. This is a semantic decision, not just a cosmetic one.
   - The execution notes flag this, but the change is live with no corresponding plan note about the design rationale.

2. **Email.tsx visual regression: dot-only → dot+pill**
   - The old `Email.tsx` `StatusBadge` was a dot+plain-text renderer with no background pill. The new shared component adds a background pill for all statuses including `active` and `disabled`.
   - The call site at `Email.tsx:339` passes `status={p.enabled ? "active" : "disabled"}`. `disabled` is not in `STATUS_TOKENS` so it falls to `DEFAULT_TOKENS` (muted surface background). The old implementation would have also fallen through to muted — but as a dot-only render, not a pill. The visual change is documented but represents a departure from the Email page's prior aesthetic.

3. **`--io-surface-tertiary` substitution changes Import.tsx `cancelled` state appearance**
   - The old `Import.tsx` local component used `--io-surface-tertiary` for `cancelled`, which is an undefined CSS custom property and resolves to transparent background
   - The shared component uses `--io-surface-secondary` (`StatusBadge.tsx:35–38`), which is a visible surface color
   - `cancelled` jobs in the Import page now render with a visible grey pill background instead of transparent. Minor, documented, but a real visual change.

## Verification Notes

- `STATUS_LABELS` in `SystemHealth.tsx:14–19` correctly preserves the custom display labels (`Ready`, `Degraded`, `Not Ready`, `Unknown`) that the old local component embedded in its `STATUS_COLORS` record. All three call sites pass `label={STATUS_LABELS[svc.status]}` — the migration correctly avoids showing raw status strings like `"healthy"` where `"Ready"` was shown before.
- `disabled` status passed by `Email.tsx` is not in `STATUS_TOKENS` but the fallthrough to `DEFAULT_TOKENS` matches the old behavior (old code also fell to `--io-text-muted` for unrecognized statuses).
- The `untested` status passed in `Import.tsx` (`<StatusBadge status="untested" />`) similarly falls to default muted, which is reasonable.
- Build passed clean. The `label` prop defaulting to `status` string via `label ?? status` works for all consumer call sites.
