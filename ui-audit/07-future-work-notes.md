# Future Work Notes — Post-Claim-A Implications

**Written:** 2026-05-27 (Claim A close)  
**Feeds into:** Claim C revisit (Workstream 5) and the eight-module rebuild program  
**Source:** `06-claim-a-plan.md` Section 5, `06c-claim-a-drift-checkin.md`, Claim A execution record

---

## implications-for-claim-c-revisit

Claim C reopens only after Claim A and Claim B are both complete and reviewed (per `05-claim-c-deferral.md` Section 5). The following Claim A outcomes have direct downstream effects on Claim C scope and sequencing.

### Tokens that Claim C can now reference without re-entering the token layer

All of the following were undefined at the time Claim C was deferred; they are now defined:

| Token | Defined value | Claim C usage |
|---|---|---|
| `--io-alarm-inactive` | `#808080` (all three themes) | `alarmFlash.css` off-state hex migration (05 Section 3.1) |
| `--io-text-inverse` | Dark=#09090b, light=#ffffff, hphmi=#0f172a | DesignerCanvas resize handle fix (05 Section 3.4) — was already defined; A12 plan claim was wrong |
| `--io-error` | Alias: `var(--io-danger)` | DesignerCanvas context menu destructive color (05 Section 3.5) — already resolves via alias; no code change needed in DesignerCanvas |
| `--io-bg` | Alias: `var(--io-surface-primary)` | WorkspaceGrid container background (05 Section 3.2) — already resolves via alias; no code change needed in WorkspaceGrid |
| `--io-overlay` | Alias: `var(--io-modal-backdrop)` | Any Claim C dialog that needs a backdrop token |
| `--io-accent-rgb` | Per-theme RGB triplet values | Any Claim C component using `rgba(var(--io-accent-rgb), ...)` for tinted overlays |

### Alias-resolved Claim C items (zero code touches required in Claim C files)

Two Claim C items from `05-claim-c-deferral.md` are now automatically resolved by token aliases and require no code change when Claim C executes:

- **05 Section 3.5 — DesignerCanvas context menu destructive color:** `--io-error` now aliases `--io-danger`. The reference in DesignerCanvas already renders the correct color. Claim C should verify the visual (it will be correct) and remove the finding from its task list.
- **05 Section 3.2 — WorkspaceGrid container background:** `--io-bg` now aliases `var(--io-surface-primary)`. The container background now resolves correctly. Same: verify and close.

These are not blocked on Claim B. They are already done.

### Z-index scale is permanent — Claim C must coordinate with it

A13 set the permanent z-index scale (accepted 2026-05-27):

```
--io-z-dropdown:    500
--io-z-modal:      1000
--io-z-command:    1200
--io-z-visual-lock: 1500
--io-z-kiosk-auth: 1800
--io-z-toast:      2000
--io-z-emergency:  3000
```

DesignerCanvas uses internal `zIndex` values in the 300–2000 range for context menus, guide overlays, and floating panels. Before Claim C makes any z-index change inside `DesignerCanvas.tsx`, all internal values must be audited and mapped to this scale. Do not set any `zIndex` inside a Claim C file without first checking whether the value belongs to one of the named scale levels above.

### Sidebar width does not affect the canvas seam

A14 (220px) does not change the canvas boundary. Console's `WorkspaceGrid` and Designer's `DesignerCanvas` span the remaining viewport width after the sidebar; the seam is CSS-flex-driven and agnostic to the sidebar's pixel value. No Claim C scoping decision depends on the A14 outcome.

### selection.css + MarqueeLayer.tsx are already fixed (Cat 10 highest-priority items)

The selection overlay regression (`var(--accent)` prefix bug) was fixed in Claim A per the recommendations. These files should not appear in Claim C's task list. Verify at the start of Claim C that no regression was introduced between now and Claim C's start date.

---

## implications-for-module-rebuild

The eight modules being rebuilt around the converged Console/Designer/Settings foundation inherit all shell conventions locked in by Claim A. The following are non-negotiable constraints for all rebuilt modules, derived from decisions made during Claim A.

### Hard constraints (established by Claim A; cannot be overridden without a cross-module decision)

| Convention | Value | Basis |
|---|---|---|
| Side panel background | `var(--io-surface-secondary)` | B1 corrected Designer to match Console/Settings; now universal |
| Active nav item indicator | `borderLeft: 2px solid var(--io-accent)` + `padding: 7px 10px 7px 8px` (transparent border on inactive) | B2 implementation; uniform-padding approach is the correct mechanism |
| Sidebar width token | `var(--io-sidebar-width)` = 220px | A14 decision; no hardcoded integer permitted |
| Nav group header typography | 11px / 600 / uppercase / 0.06em / `var(--io-text-muted)` | Consensus across Console, Designer, Settings (B4 aligned Settings) |
| Toolbar surface | `var(--io-surface)` + `borderBottom: 1px solid var(--io-border)` | Console+Designer consensus; NOT `var(--io-surface-primary)` |
| Token hygiene | No reference to any token not defined in `index.css` | Zero undefined token references is the post-Claim-A baseline |

### Token registry as of Claim A close (2026-05-27)

The following tokens were added or corrected during Claim A and are now authoritative. Rebuilt modules must use these tokens where applicable:

- `--io-bg` → `var(--io-surface-primary)` (page/container backgrounds)
- `--io-text` → `var(--io-text-primary)` (default text color)
- `--io-surface-hover` → `var(--io-surface-elevated)` (hover state surfaces)
- `--io-font-sans` → full Inter/system sans-serif stack (sans-serif font family)
- `--io-text-on-accent` → `var(--io-accent-foreground)` (text on accent-bg buttons)
- `--io-error` → `var(--io-danger)` (error/destructive color)
- `--io-surface-raised` → `var(--io-surface-elevated)` (raised surface alias)
- `--io-overlay` → `var(--io-modal-backdrop)` (modal/dialog backdrop)
- `--io-accent-rgb` → per-theme RGB triplet (for rgba() composition)
- `--io-alarm-inactive` → `#808080` (alarm off-state color for `alarmFlash.css` migration)
- `--io-z-modal` → 1000 (full scale established; see scale table above)
- `--io-sidebar-width` → 220px

No rebuilt module may reference `--io-accent-muted` (intentionally not defined; one-consumer pattern — fix at consumer with `var(--io-accent-subtle)`).

### Pre-panel-layout gate

Before any of the eight rebuilt modules begins panel-layout work, confirm `--io-sidebar-width` still equals 220px in `index.css`. If it has changed (e.g., revised between Claim A and module rebuild), a single token update propagates to all modules automatically — but only if no module uses a hardcoded integer. Verify the token is used, not overridden.

### One Claim A lesson the rebuild should inherit

**Single-consumer tokens belong at the consumer.** If a rebuilt module needs a visual value used in only one place, use an existing registered token rather than proposing a new one. Claim A (A8) established this pattern explicitly. New tokens in `index.css` require cross-module review and a usage count justification. Rebuilt modules are not exempt from this discipline.
