# Review (shallow)

**Generated**: 2026-05-28T04:15:35+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-statusbadge

read-_040255.md`
**Session**: 
**Depth**: shallow

---

## Summary

The diff matches the stated intent. A shared `StatusBadge` component was created at `src/shared/components/StatusBadge.tsx`, all four identified consumers (`Import.tsx`, `OpcSources.tsx`, `SystemHealth.tsx`, `Email.tsx`) had their local inline implementations removed and replaced with the shared import, and the plan document was updated. No other components were touched. The build was verified clean.

## Concerns

1. **OpcSources `inactive` semantic change is silent to operators.** The migration changes `inactive` from muted/neutral to `danger` (red). This is documented in the plan notes, but the consumer diff itself has no comment at the call site. A future reader seeing `<StatusBadge status="inactive" />` rendering red has no local hint that this was a deliberate semantic decision, not a mistake. Low severity — well-documented in the plan — but worth a call-site comment if this causes confusion during review.

2. **Email.tsx visual regression: dot-only → pill with background.** The old `StatusBadge` in Email.tsx was a colored dot + text with no background container. The new shared component renders a pill with a background. The plan notes this as an intentional change, but it is a visible rendering difference for users of the email log view. No screenshot or UAT confirmation is present in the log.

3. **`label` prop is optional but required in practice for SystemHealth.** The shared component accepts `label?: string` defaulting to `status`. SystemHealth's `status` values are `healthy`/`degraded`/`unhealthy`/`unknown`, but the desired display text is `Ready`/`Degraded`/`Not Ready`/`Unknown`. The `STATUS_LABELS` mapping and explicit `label` prop threading are correct, but if a new call site in SystemHealth omits `label`, it will silently display the raw enum value instead of the user-facing string. The API surface makes this easy to misuse.
