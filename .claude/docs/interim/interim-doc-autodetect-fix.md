---
id: interim-doc-autodetect-fix
title: Interim Doc Auto-Detect Fix — Duplicate Doc Convergence via docfresh
status: interim
created: 2026-05-28
last_updated: 2026-05-28
last_synced_with_code: 2026-05-28
work_units:
- 2026-05-28_check-duplicate-doc-creation_083943
implementation:
- .claude/hooks/stop.sh
- .claude/WORKFLOW_NOTES.md
- .claude/docs/interim/slug.md
related:
- claim-a-token-registry-gaps
- claim-b-dialog-promotion-migration
topics:
- docs-system
- harness-tooling
aliases:
- claim-c-canvas-migration
keywords: []
covers: Interim Doc Auto-Detect Fix — Duplicate Doc Convergence via docfresh
---

# Interim Doc Auto-Detect Fix — Duplicate Doc Convergence via docfresh

Diagnosed why `update-docs.sh` produced near-duplicate interim docs across multi-step work units, then fixed `stop.sh` so `~wrapup~ ~docfresh:slug~` used together correctly targets a specific doc rather than falling through to auto-detect and spawning a new one.

## Purpose

The harness auto-detect logic decides whether to update an existing interim doc or create a new one by checking if any modified file appears in an existing doc's `implementation:` list. This works for single-session work, but breaks across sessions in the same feature area when file sets are disjoint — each session creates a fresh doc rather than accumulating into one.

## Behavior

**Before fix**: `~wrapup~ ~docfresh:slug~` was parsed by `classify_prompt_tags` as type `wrapup` only; the `docfresh:slug` portion was silently discarded and auto-detect ran. For multi-step work units (e.g. Claim C's 5b-A..5b-D, Workstream 6 per-batch migration), each session whose modified files didn't overlap with the prior session's doc produced a new duplicate doc.

**After fix**: `stop.sh`'s wrapup branch extracts any co-present `~docfresh:slug~` tag via a new `extract_docfresh_slug` helper. When a slug is found, it is passed directly to `update-docs.sh`, bypassing auto-detect entirely and targeting the named doc (creating it if it doesn't yet exist, updating it if it does).

**Convention for multi-step work**: For work units spanning multiple sessions over the same feature (Claim C, Workstream 6 batches), every sub-session wrapup must include `~wrapup~ ~docfresh:<consistent-slug>~` with the same slug to converge all sessions into one doc. Auto-detect alone cannot handle disjoint file sets across sessions without over-merge risk.

## Implementation Notes

- Fix is in `.claude/hooks/stop.sh` only — `update-docs.sh` is unchanged.
- Root cause (Factor B) was the all-or-nothing exact file-path match in auto-detect. Factor A (corrupted filenames from `read -r` truncation) was already resolved in a prior session.
- Partial-overlap inference was evaluated and rejected: a shared file like `index.css` touching multiple unrelated features would cause over-merge. Explicit user control via `~docfresh:slug~` is the safe path.
- Four verification scenarios were simulated in Python to confirm: same-feature disjoint-file sessions converge with docfresh, different features sharing `index.css` stay separate, two distinct claim-b docs stay separate, and first-session docfresh creates the doc correctly.
- `.claude/WORKFLOW_NOTES.md` documents the convention and guidance for Claim C / Workstream 6.
- A misnamed placeholder doc `slug.md` was created as an artifact of the same slug-extraction bug during the initial doc-creation step; it should be treated as a stale artifact.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-28
Second update pass from work unit `2026-05-28_check-duplicate-doc-creation_083943`. No content changes — doc accurately reflects delivered state from prior pass. Confirmed implementation list, behavior description, and convention documentation are all current.

### 2026-05-28
Update pass: synced doc with final work unit state. Confirmed implementation list and body sections match the actual changes delivered (stop.sh wrapup+docfresh routing, WORKFLOW_NOTES.md convention documentation). No content changes required — doc was already accurate from initial creation pass.

### 2026-05-28
Created from work unit `check-duplicate-doc-creation` / `fix-duplicate-doc-autodetect`. Documents the root-cause diagnosis of duplicate interim doc creation and the `stop.sh` fix enabling `~wrapup~ ~docfresh:slug~` to correctly target a specific doc. Note: the prior run of the doc-creation step produced `slug.md` (a misnamed placeholder) due to the same slug-extraction bug being fixed here.
