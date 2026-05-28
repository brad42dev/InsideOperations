# Claim B Plan Checkin — 08-claim-b-plan.md (Run 3)

**Date:** 2026-05-28
**Inputs:** 08-claim-b-plan.md, 02-comparison.md, 04-recommendations.md, 05-claim-c-deferral.md, 06-claim-a-plan.md
**Prior runs:** Run 1 flagged F6.1 (dashboards scope contradiction) + F6.2 (wrong DC cross-reference). Run 2 fixed both and returned clear-to-proceed. This run verifies those fixes and does a deeper structural sweep.
**Overall-status: clear-to-proceed**

---

## Prior Run Fixes — Confirmed Present

Both fixes from Run 2 are present in the current plan:

| Fix | Verification |
|-----|-------------|
| **F6.1** — Dashboards rows in Section 2.4 table now read `**Out of scope — dashboards module (see Section 7 Item 8)**` | Lines 349, 353 confirmed |
| **F6.1** — Portal-check paragraph changed from "flag both as requiring portal verification before migration" to "excluded from this workstream (Section 7 Item 8) — do not migrate them here. Document for a future dashboards-module pass." | Line 357 confirmed |
| **F6.2** — Section 7 Item 8 now reads "listed in Section 2.4 for documentation only — deferred to a future dashboards-module pass" (no DC-6 reference) | Line 596 confirmed |

---

## Check 1 — Scope Alignment (source citations in Sections 1 and 2)

**Result: Clean. Two previously flagged claims (F1.1, F1.2) are execution-time verification items already handled by the DoD.**

### Confirmed citations (spot checks)

| Plan entry | Source |
|-----------|--------|
| 1.1 Primary button accent bg | 02 Cat 6 Shared column |
| 1.1 settingsStyles named variants as base | 02 Cat 6 List 3 Item 3 |
| 1.1 `--io-btn-*` tokens excluded | 02 Cat 6 List 1 Item 6 |
| 1.1 A5 alias resolves btnPrimary | 02 Cat 6 Deviations Settings; 06 A5 |
| 1.1 borderRadius inconsistency | 02 Cat 6 Visual Properties all three columns |
| 1.1 No hover states | 02 Cat 6 Deviations Console/Settings; List 2 Item 8 |
| 1.2 settingsStyles inputStyle as base | 02 Cat 7 List 3 Item 1; 04 Cat 7 |
| 1.2 outline:none universal | 02 Cat 7 Shared column; 02 List 1 Item 8 |
| 1.2 DesignerRightPanel compact inputs exempted | 02 Cat 7 Visual Properties Designer |
| 2.1 FieldLabel source DesignerRightPanel:201–217 | 02 Cat 9 Source-of-truth; List 3 Item 6 |
| 2.1 Settings labelStyle not migrated | 02 Cat 2 Settings (12px/500/no uppercase) |
| 2.1 fontSize: 10 → 11 | 02/04 Cat 2 convergence table |
| 2.2 StatusBadge base Import.tsx token-pair | 02 Cat 8 List 3 Item 2; 04 Cat 8 |
| 2.2 OpcSources dot indicator post-fix | 02 Cat 8 Deviations Settings |
| 2.3 Radix already used in Settings | 02 Cat 11 Implementation Settings |
| 2.3 Dialog token spec | 04 Cat 11 actions; A13 |
| 2.4 ConfirmDialog fix targets | 04 Cat 11 z-index; 02 Cat 11 Visual Properties |
| 2.4 window.confirm() source count | 02 Cat 11 Deviations Settings (reconciliation log item 11) |

### Execution-time verification items (not blocking)

**F1.1 — BulkUpdate BTN_SECONDARY background**: Plan claims `var(--io-surface-sunken)`. Audit notes BulkUpdate has its own button constants (02 Cat 6 Notes; 04 Risk R5) but doesn't record the specific value. DoD criterion 1 already requires pre-execution grep. Risk: none — the migration is correct regardless of current value.

**F1.2 — `--io-input-bg` equals `--io-surface-sunken`**: Plan claims "same visual value." Audit confirms `--io-input-bg` is registered (02 Cat 7) but does not compare values. DoD Section 5b L7 already requires `grep "io-input-bg\|io-surface-sunken" frontend/src/index.css` before writing inputs.ts.

**ConfirmDialog current-state values**: Plan's issue table (zIndex: 100/101, surface-secondary bg, 10px radius) are code facts, not audit facts. DoD criterion 6 already requires reading `ConfirmDialog.tsx` before writing to verify them.

**Check 1 status: CLEAN (F1.1, F1.2 already covered by mandatory DoD pre-execution steps).**

---

## Check 2 — Exclusion Compliance

**Result: Clean. No Claim C violations.**

| Section | Files listed | Claim C conflict |
|---------|-------------|-----------------|
| 1.1 buttons.ts consumers | DesignerToolbar, DesignerImport, DesignerGraphicsList, Settings/Console pages | None |
| 1.2 inputs.ts consumers | Settings/Console pages, PointPickerModal, DesignerRightPanel exempted | None |
| 2.1 FieldLabel consumers | DesignerRightPanel, PaneConfigModal, Settings (deferred) | None |
| 2.2 StatusBadge consumers | Settings pages; Console alarm-domain badges deferred to alarm-token workstream | None |
| 2.3 Dialog consumers | Console index.tsx inline modals, PaneConfigModal, RestorePreviewModal, Designer standalone dialog files | None |
| 2.3 DesignerCanvas.tsx-internal dialogs | Explicitly marked "Out of scope. Do not touch." | Correctly excluded |
| 2.4 window.confirm() | DesignerReportsList, DesignerDashboardsList, CameraStreams; dashboards files marked out of scope | None |

Section 7 Item 4 enumerates all six Claim C files by name and extends the exclusion to DesignerCanvas-internal dialogs.

**Check 2 status: CLEAN.**

---

## Check 3 — Lessons Applied

**Result: All seven lessons addressed explicitly in Section 5b.**

| Lesson | Plan's handling | Verified |
|--------|-----------------|---------|
| L1 — Deferred gates are hard gates | Section 7 enumerates 10 hard out-of-scope items; Section 6 items not executable without explicit re-prioritization | ✓ |
| L2 — Verify "undefined" claims before writing | DoD criterion 1 has explicit grep command; same applies to inputs.ts token verification | ✓ |
| L3 — Alias over code-replacement for Claim C files | N/A — no new tokens; Claim C files excluded | ✓ (correctly N/A) |
| L4 — Single-consumer tokens: fix consumer not registry | N/A — no new tokens to index.css | ✓ (correctly N/A) |
| L5 — Describe mechanism not visual effect | All variant specs provide exact TypeScript property-value objects; Dialog spec names tokens and computed values | ✓ |
| L6 — DoD grep scopes must be explicit | DoD criterion 1 has explicit path-scoped grep; DoD criterion 6 requires reading ConfirmDialog.tsx by name | ✓ |
| L7 — Pre-execution token validation mandatory | DoD criterion 1, criterion 6, and Section 5b L7 all require grep before writing | ✓ |

**Check 3 status: CLEAN.**

---

## Check 4 — Multi-Module Flags

**Four items flagged for user review (informational — not blocking execution):**

1. **Hover via companion CSS class (buttons.ts)** — "The pattern of 'constants file + companion CSS' is new; confirm the approach fits the project's styling conventions before locking it in for eight modules."

2. **`--io-surface-sunken` as standard input background (inputs.ts)** — "Visually slightly deeper/darker than `--io-surface`. Confirm this is the correct visual depth for the app's form language."

3. **11px / uppercase / 0.05em form field label convention (FieldLabel)** — "Locks in form label visual language for all future modules. Differs from Settings `labelStyle` (12px / 500 / no uppercase). Confirm before building the component."

4. **ConfirmDialog z-index fix to `var(--io-z-modal)` (ConfirmDialog)** — "Correct fix but touches existing consumers indirectly. All consumers must be verified visually after the fix."

**Check 4 status: 4 items flagged (user review required before or during execution).**

---

## Check 5 — Deferred Candidates Well-Formed

**Result: All six are fully well-formed.**

| Candidate | What | Where | Why | Evidence-to-justify |
|-----------|------|-------|-----|---------------------|
| DC-1 IconBtn | ✓ | ✓ DesignerToolbar.tsx:904–948 | ✓ | ✓ Needs second module before promotion |
| DC-2 SettingsPageLayout | ✓ | ✓ (path noted as inferred — transparent caveat) | ✓ | ✓ Needs path confirmation + rebuild module need |
| DC-3 ContextMenu token fix | ✓ | ✓ ContextMenu.tsx danger item | ✓ | ✓ Bug fix, not promotion; can land any time |
| DC-4 SectionLabel | ✓ | ✓ Three files named | ✓ | ✓ Wait for initial four stable + rebuild module need |
| DC-5 DeleteConfirmDialog | ✓ | ✓ DesignerLeftPalette.tsx:217 | ✓ | ✓ No new evidence needed; consumer migration pass |
| DC-6 Hex-alpha badge bug | ✓ | ✓ Four files with line numbers | ✓ | ✓ Fix pattern established from OpcSources |

**Check 5 status: CLEAN.**

---

## Check 6 — Scope Boundary Clarity

**Result: Section 7 present with 10 items. Permanent vs. deferred distinction is present. No blocking contradictions.**

Section 7 Item 2 explicitly labels itself: "This is a **permanent architectural exclusion for this project**, not a deferred workstream item — no planned future workstream will introduce a component framework." All other items indicate future-workstream or follow-up handling. ✓

**Check 6 status: CLEAN.**

---

## Deep Dive — Why Issues Recur Across Three Runs

The previous two runs each found issues. After three runs, the plan is clean on all six checks. But the persistent borderline findings across all runs trace to a single structural pattern worth documenting for the implementer:

### The consumer-table / sequencing-section tension

The plan uses consumer tables in Sections 1 and 2 as comprehensive inventories — they document the full picture of what migration would eventually look like across all files. The Section 3 sequencing block is the authoritative execution guide that determines what is actually in scope for this workstream.

These two layers sometimes give mixed signals:

**Example 1 — FieldLabel PaneConfigModal:**
Section 2.1 consumer table entry: "Replace inline divs with `<FieldLabel>`. Light refactoring; no substantive risk." — reads as active work.
Section 3 Phase 2: "Console and Settings consumer migration is deferred to the follow-up pass." — defers it.
DoD criterion 3: Only requires DesignerRightPanel migration, not PaneConfigModal. — DoD is the tiebreaker.

**Example 2 — inputs.ts consumer table header:**
Section 1.1 (buttons.ts) consumer table header: "Consumer files to migrate *(deferred to execution unless part of initial scope)*" — includes a deferred qualifier.
Section 1.2 (inputs.ts) consumer table header: "Consumer files to migrate" — no deferred qualifier.
Section 3: "All remaining consumers of buttons.ts and inputs.ts are a follow-up pass." — both are deferred.

**Why this is not blocking:** The DoD is unambiguous about what is required to mark Claim B complete. The sequencing section is authoritative for execution order. An implementer who reads the DoD and Section 3 will scope the work correctly — the consumer tables won't mislead them on final scope.

**Why this keeps generating borderline findings:** The consumer tables, by design, don't echo the "deferred" markers from Section 3. They're meant to be referenced in future workstreams. Readers who encounter the tables without the sequencing section read them as to-do lists.

**Recommendation for the implementer:** When in doubt about whether a consumer migration is in scope, check DoD first, then Section 3 sequencing. If neither names the file, it is deferred.

---

## Summary

| Check | Status | Blocking? |
|-------|--------|-----------|
| 1 — Source alignment | Clean (F1.1/F1.2 are execution-time verifications already in DoD) | No |
| 2 — Exclusion compliance | Clean | — |
| 3 — Lessons applied | Clean | — |
| 4 — Multi-module flags | 4 items flagged (informational) | No |
| 5 — Deferred candidates | Clean | — |
| 6 — Scope boundary | Clean (prior F6.1/F6.2 fixes confirmed in current plan) | — |
| Prior fixes (F6.1, F6.2) | Confirmed present in plan | — |

**Overall-status: clear-to-proceed**
