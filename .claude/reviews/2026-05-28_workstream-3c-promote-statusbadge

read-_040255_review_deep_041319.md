# Review (deep)

**Generated**: 2026-05-28T04:14:46+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3c-promote-statusbadge

read-_040255.md`
**Session**: 831358e0-0a5b-4c08-9e7e-6ddcb3fd4166
**Depth**: deep

---

## Summary

The diff matches intent accurately. `StatusBadge` is promoted to `frontend/src/shared/components/StatusBadge.tsx` with the plan's minimal `{ status, label? }` API, all four targeted consumers are migrated, local definitions removed cleanly, and the plan document is updated with thorough execution notes. The build passes. There are no undocumented deviations — every behavioral change is explicitly recorded in the execution notes.

## Concerns

1. **`inactive` remapped from muted to danger in OpcSources.tsx** — The plan's token table places `inactive` in the danger tier (`--io-danger-subtle` / `--io-danger`). OpcSources' prior local implementation mapped `inactive → --io-text-muted` (neutral/muted treatment). After migration, a manually-disabled OPC source shows a red badge. The execution notes document this and flag it for UX review, so it is not a surprise. But the change is real: operators accustomed to seeing muted for `inactive` will now see red. The plan chose this deliberately; the concern is whether that choice was made with full operator-context awareness or inherited uncritically from the table.

2. **Email.tsx visual regression beyond substitution-level** — The old Email.tsx `StatusBadge` rendered dot + colored text with no background pill (`fontSize: 12`, `fontWeight: 500`, no padding, no border-radius). The shared component renders a pill with background (`fontSize: 11`, `fontWeight: 600`, `padding: 2px 8px`, `borderRadius: 9999px`). This is more than a substitution — it's a visual change to queue item status display in the email tab. The prompt's instruction was to defer consumers requiring more than substitution-level changes. The execution notes acknowledge the visual change but proceed with the migration anyway. This is defensible as intended convergence, but it deviates from the stated stop-and-defer rule. No harm in practice, but it's worth flagging.

3. **`--io-surface-tertiary` silently undefined in the plan spec** — The plan's token table explicitly lists `--io-surface-tertiary` for the neutral/muted tier, but that token is undefined in `index.css`. The substitution to `--io-surface-secondary` is correct and documented. The underlying issue is that the plan itself contained a reference to a nonexistent token — the component's comment in `StatusBadge.tsx` preserves the note, which is the right call, but this token gap should be recorded as a separate follow-up (define `--io-surface-tertiary` or canonically retire it from the vocabulary in the plan).

## Verification Notes

- `STATUS_TOKENS` adds `degraded`, `sent`, `retry`, and `connected` beyond the plan's explicit table — all correct additions required by consumer migrations.
- `SystemHealth.tsx` correctly retains a local `STATUS_LABELS` record to preserve the custom display strings ("Ready", "Degraded", "Not Ready", "Unknown") that the old local component encoded in `STATUS_COLORS`. All three call sites pass `label={STATUS_LABELS[svc.status]}` correctly.
- OpcSources' border (`1px solid color-mix(...)`) from its post-fix version is intentionally dropped. No functional issue — purely cosmetic.
- Blank lines left after removed code blocks in Import.tsx, OpcSources.tsx, and Email.tsx are cosmetic noise but harmless.
- Deferred consumers (`PointManagement.tsx`, `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx`, console alarm badges) are all correctly categorized with accurate reasons.
