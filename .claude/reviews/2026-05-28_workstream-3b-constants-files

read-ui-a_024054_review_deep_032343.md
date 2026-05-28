# Review (deep)

**Generated**: 2026-05-28T03:25:17+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-3b-constants-files

read-ui-a_024054.md`
**Session**: 
**Depth**: deep

---

I have enough to write the review.

## Summary

The diff is a precise match to the plan. All four files (`buttons.ts`, `buttons.css`, `inputs.ts`, `inputs.css`) reproduce the exact property values and export names from the Section 1 variant specifications, inline comments cite the correct comparison row references, the companion CSS rules match the plan's stated selectors and values verbatim, and the plan file is updated with the correct DONE markers. No consumer files were touched. No properties were added beyond what the spec required.

## Concerns

1. **Export name divergence between plan's divergence table and formal spec section — `buttonBaseClass` vs `buttonHoverClass`.** The "hover state" row in the divergence table (Section 1.1) names the export `buttonHoverClass = "io-btn"`, but the formal variant spec section immediately below names it `buttonBaseClass = "io-btn"`. The file uses `buttonBaseClass`. This is the correct choice — the variant specs section is the authoritative deliverable spec — but the stale `buttonHoverClass` mention in the divergence table will cause confusion when consumers read the plan to understand the API. The divergence table row is a loose end in `08-claim-b-plan.md`, not in the code.

2. **Companion CSS files are unreferenced dead code until a consumer is migrated.** `buttons.css` and `inputs.css` have no import anywhere in the codebase right now. Vite will not bundle them; the `.io-btn` hover rule and `.io-input` focus ring rule have no effect until at least one consumer imports the CSS file alongside the TS constants. This is architecturally intentional per the task scope ("constants files only, no consumer migration"), but it means `buttonBaseClass` and `inputClassName` are currently inert — spreading them has no visible effect. No action needed now, but the first consumer migration must import both the `.ts` and `.css` companions or the class names do nothing.

3. **`btnSmall` has no `fontWeight` — correct by spec but potentially surprising.** The plan specifies `fontWeight: 600` for primary, secondary, and danger, and the deviation table says "Align all variants: 600." However the `btnSmall` spec block in the plan omits `fontWeight`, and the file omits it too. This is technically faithful to the written spec, but if a future consumer assumes all four variants carry explicit weight, they'll get browser-default 400 on small buttons. Not a bug in this diff; a latent inconsistency in the plan.

## Verification Notes

- All CSS custom-property references (`--io-accent`, `--io-surface-sunken`, `--io-border`, `--io-radius`, `--io-text-primary`, `--io-text-secondary`, `--io-danger`, `--io-accent-foreground`) were verified against `index.css` during the session before writing — this is documented in the log.
- The `shared/styles/` directory is newly created; there is no existing barrel/index file to update, and none was created. Direct path imports will be required.
- `boxSizing: "border-box"` in `inputStyle` is valid for `React.CSSProperties` — the type accepts the string literal correctly.
- The scope boundary for DesignerRightPanel compact inputs (excluded from migration) is explicitly documented in a code comment in `inputs.ts:8–10`, which is useful context for whoever runs the consumer migration phase.
