---
id: 2026-05-28-workstream-3c-promote-statusbadge
title: StatusBadge — Shared Component Promotion
status: interim
created: 2026-05-28
last_updated: 2026-05-28
last_synced_with_code: 2026-05-28
work_units:
  - 2026-05-28_workstream-3c-promote-statusbadge_040255
implementation:
  - frontend/src/shared/components/StatusBadge.tsx
  - frontend/src/pages/settings/Import.tsx
  - frontend/src/pages/settings/OpcSources.tsx
  - frontend/src/pages/settings/SystemHealth.tsx
  - frontend/src/pages/settings/Email.tsx
related:
  - 2026-05-28-workstream-3c-promote-fieldlabel
---

# StatusBadge — Shared Component Promotion

`StatusBadge` is a shared pill/dot indicator component promoted from per-module inline implementations to `src/shared/components/StatusBadge.tsx`. All four settings-page consumers were migrated in this work unit.

## Purpose

Provides a consistent visual indicator for connection, operational, and job-status states across settings pages (Import jobs, OPC sources, system services, email delivery). Replaces four separate local implementations that had diverging visual styles and inconsistent color tokens.

## Behavior

Props: `{ status: string; label?: string }`. When `label` is omitted, the displayed text defaults to the `status` value. The component renders a pill with a colored background derived from a token-pair map keyed on `status`:

- `completed`, `sent`, `ok`, `healthy`, `active` → success tier (`--io-success-subtle` bg, `--io-success` text)
- `running` → accent tier
- `pending`, `retry`, `connecting`, `degraded`, `warning` → warning tier
- `failed`, `error`, `unhealthy`, `inactive` → danger tier
- `cancelled`, `unknown`, or any unrecognized value → muted tier (`--io-surface-secondary` bg, `--io-text-muted` text)

**Token substitution:** `--io-surface-tertiary` (used by the Import.tsx base) is undefined in `index.css`. The muted/neutral tier uses `--io-surface-secondary` instead, producing a subtle visible background rather than transparent.

**`inactive` semantic:** `inactive` maps to the danger tier per the promotion plan. OpcSources previously showed `inactive` as muted/neutral. This is intentional but flagged for UX review — if operator feedback indicates alarm fatigue from red badges on manually-disabled sources, add an explicit `disabled` muted-tier alias.

**Visual delta from removed implementations:**
- OpcSources dropped its `1px solid color-mix(...)` border (was not part of the shared spec).
- Email.tsx changed from a dot-only (no background) style to a pill with background.
- SystemHealth.tsx preserves custom display labels (Ready / Degraded / Not Ready / Unknown) via a local `STATUS_LABELS` map passed through the `label` prop.

## Implementation Notes

**Component location:** `src/shared/components/StatusBadge.tsx`. Selected Import.tsx as the base implementation per the plan (pill style with token-pair bg/text map; richest visual spec of the four).

**Consumer migrations:**
- `Import.tsx` — drop-in substitution; zero call-site changes.
- `OpcSources.tsx` — drop-in substitution; zero call-site changes.
- `SystemHealth.tsx` — local `STATUS_COLORS`/`StatusBadge` removed; local `STATUS_LABELS` record retained for display-label mapping; all 3 call sites updated to pass `label` prop.
- `Email.tsx` — drop-in substitution; zero call-site changes. `disabled` status maps to default muted tier.

**Deferred consumers (not migrated here):**
- `PointManagement.tsx` — boolean `ActiveBadge` API mismatch; not a drop-in substitution.
- `Users.tsx`, `Roles.tsx`, `CameraStreams.tsx`, `MaintenanceTicketsPanel.tsx` — hex-alpha color bug present; separate bug-fix pass (DC-6).
- Console alarm badges (`PriorityBadge`, `StateBadge`, `QualityBadge`) — different semantic vocabulary and alarm-specific colors; out of scope.

**Build:** `pnpm build` passed clean after all migrations.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->

### 2026-05-28
Created document. Promoted `StatusBadge` from four separate inline implementations to `src/shared/components/StatusBadge.tsx`. Migrated four consumers (Import, OpcSources, SystemHealth, Email). Documented token substitution (`--io-surface-tertiary` → `--io-surface-secondary`), `inactive`-to-danger semantic change, and deferred consumers. Build verified clean. Deep and shallow reviews passed with no blocking concerns; `inactive → danger` semantic noted for UX review.
