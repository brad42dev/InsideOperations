# Work Unit Summary

**Generated**: 2026-05-27T05:57:22+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-27_regression-statusbadge-hex-alpha

read-o_054757.md`
**Session**: 361ad460-9bf3-4897-b065-aefe183d5610

---

## Work unit purpose

Fixed the `OpcSources` `StatusBadge` hex-alpha concatenation bug where template literals like `` `${color}20` `` produced invalid CSS when `color` was a CSS variable string (e.g. `var(--io-success)`), causing all badge backgrounds and borders to render as transparent. Updated audit artifacts to record the fix.

## Key decisions made

- Scoped the fix to the local `StatusBadge` function in `OpcSources.tsx` — not a shared component migration — because `StatusBadge` is module-local and the prompt limited scope to this file
- Used `color-mix(in srgb, ${color} 12%, transparent)` / `color-mix(in srgb, ${color} 25%, transparent)` to match the existing pattern already established in `SystemHealth.tsx`, rather than introducing `rgba()` or a new approach
- Investigated the broader codebase and found the same bug in four additional files (`Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx`), but explicitly did not fix them — recorded as an open finding per the prompt's scope constraint

## What was built or changed

- `OpcSources.tsx:168–170`: replaced `` `${color}20` `` and `` `1px solid ${color}40` `` with valid `color-mix()` expressions
- `ui-audit/04-recommendations.md`: marked item 2 of Phase 2 regressions as resolved with strikethrough, added before/after code, and noted the four remaining unfixed files
- `ui-audit/02-comparison.md`: updated Category 8 Settings deviations cell to record the fix date, before/after code, fix rationale, and the four additional files with the same unresolved bug

## What was deliberately not done

- Same hex-alpha bug in `Users.tsx` (Badge:108/110), `Roles.tsx` (Badge:51/53), `CameraStreams.tsx` (785/787), `MaintenanceTicketsPanel.tsx` (52) — out of scope per prompt; documented as open finding
- No migration to a shared `StatusBadge` component (deferred to Phase 4 of the convergence plan)
- No changes to Claim A, Claim B, or other Claim C work

## Open questions or follow-ups

- Four files with the same `${color}20`/`${color}40` hex-alpha bug remain unfixed and will render broken badge backgrounds whenever a CSS variable string is passed as the color argument

## Files modified

- `frontend/src/pages/settings/OpcSources.tsx`
- `ui-audit/02-comparison.md`
- `ui-audit/04-recommendations.md`
SessionEnd hook [${CLAUDE_PROJECT_DIR}/.claude/hooks/session-end.sh] failed: /bin/sh: 1: /home/io/io-dev/io/frontend/.claude/hooks/session-end.sh: not found
