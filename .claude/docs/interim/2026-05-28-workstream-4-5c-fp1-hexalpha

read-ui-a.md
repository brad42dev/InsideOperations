---
id: 2026-05-28-workstream-4-5c-fp1-hexalpha
title: "Fix: Hex-Alpha Badge Concatenation Bug (FP-1)"
status: interim
created: 2026-05-28
last_updated: 2026-05-28
last_synced_with_code: 2026-05-28
work_units:
  - "2026-05-28_workstream-4-5c-fp1-hexalpha\n\nread-ui-au_071913"
implementation:
  - frontend/src/pages/settings/Users.tsx
  - frontend/src/pages/settings/Roles.tsx
  - frontend/src/pages/settings/CameraStreams.tsx
  - frontend/src/shared/components/MaintenanceTicketsPanel.tsx
  - ui-audit/09-post-ab-review.md
related:
  - 2026-05-28-workstream-4-5b-zindex-fix
---

# Fix: Hex-Alpha Badge Concatenation Bug (FP-1)

Four settings/panel files used hex-alpha concatenation (`${color}20`, `${color}40`) to compute badge background and border colors. This produces invalid CSS when the color value is a CSS custom property string, causing badges to render transparent. The fix replaces concatenation with `color-mix()`.

## Purpose

Badge and status-pill components in the settings pages display a colored label chip whose background is a translucent tint of the badge's foreground color. The intent is background at ~12% opacity and border at ~25% opacity of the base color.

## Behavior

Each of the four affected files contains its own local badge/pill component — no shared component is involved. After the fix:

- Background: `color-mix(in srgb, ${color} 12%, transparent)` (replaces `${color}20`, 0x20/0xFF ≈ 12.5%)
- Border: `color-mix(in srgb, ${color} 25%, transparent)` (replaces `${color}40`, 0x40/0xFF ≈ 25.1%)

`MaintenanceTicketsPanel.tsx`'s `StatusPill` had only a background tint (no border), so only one line was changed there.

## Implementation Notes

Files and components fixed:

| File | Component | Lines changed |
|------|-----------|---------------|
| `src/pages/settings/Users.tsx` | `Badge` | background (108), border (110) |
| `src/pages/settings/Roles.tsx` | `Badge` | background (51), border (53) |
| `src/pages/settings/CameraStreams.tsx` | `VisibilityBadge` | background (786), border (788) |
| `src/shared/components/MaintenanceTicketsPanel.tsx` | `StatusPill` | background only (52) |

The `color-mix()` approach was chosen to match the fix pattern specified for this bug class (FP-1 / DC-6) in the audit docs. OpcSources.tsx uses semantic token maps rather than `color-mix()`, so percentages were derived from the hex values directly rather than copied from that file.

`ui-audit/09-post-ab-review.md` was updated in two places: FP-1 entry in Section 4 marked resolved with date and per-file details; stale open-item in Section 7 struck through and marked resolved (this second update was identified and applied during the deep review pass).

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-28
Wrapup pass: deep review confirmed no code corrections needed. Noted that Section 7 of the audit doc was also updated (strikethrough + resolved marker) to match the Section 4 resolution entry — this cleanup was missed in the initial fix pass and caught by deep review. Shallow review raised no concerns. Doc finalized.

### 2026-05-28
Created. Documents the hex-alpha badge fix (FP-1) applied to four settings/panel files as Workstream 4.5c. Each file had an independent local component; `color-mix()` substitution applied to each. Audit doc updated to reflect resolution.
SessionEnd hook [${CLAUDE_PROJECT_DIR}/.claude/hooks/session-end.sh] failed: /bin/sh: 1: /home/io/io-dev/io/frontend/.claude/hooks/session-end.sh: not found
