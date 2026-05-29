---
id: slug
title: Interim Doc Auto-Detect Fix — Multi-Session Doc Convergence
status: interim
created: 2026-05-28
last_updated: 2026-05-28
last_synced_with_code: 2026-05-28
work_units:
  - 2026-05-28_check-duplicate-doc-creation_083943
implementation:
  - .claude/hooks/stop.sh
  - .claude/WORKFLOW_NOTES.md
related:
  - []
---

# Interim Doc Auto-Detect Fix — Multi-Session Doc Convergence

Diagnosed and fixed a harness bug where a single multi-step feature workstream produced near-duplicate interim docs instead of updating one. The fix adds `[wrapup] [docfresh:slug]` combined-tag support to `stop.sh` and documents the convergence convention in `WORKFLOW_NOTES.md`.

## Purpose

The `update-docs.sh` auto-detect logic decides whether to update an existing interim doc or create a new one by checking whether any of the session's modified files appear in an existing doc's `implementation:` list. This works for first sessions on a feature but fails for follow-on sessions that touch different (but related) files — those sessions see zero overlap and create a new doc instead of updating the existing one.

## Behavior

**Before the fix:** Each session in a multi-step workstream (e.g. Claim C sub-sessions 5b-A through 5b-D, each migrating a different batch of files) would create its own doc because the new files had no entry in any prior doc's `implementation:` list. Result: 4–5 near-duplicate docs for one logical feature.

**After the fix:** `stop.sh` detects when both `[wrapup]` and `[docfresh:slug]` appear in the same prompt. When both are present, the full wrapup runs (summary + review) but `update-docs.sh` is called in targeted mode with the explicit slug, bypassing auto-detect entirely. The slug is created if it doesn't exist yet.

**Why not auto-infer?** Matching on shared files is risky — `index.css` or a shared utility can appear in many unrelated docs' implementation lists, causing over-merge across genuinely distinct features. Explicit `[docfresh:slug]` is zero-risk.

**Convention for multi-session workstreams:**
- Session A: `[wrapup]` — auto-detect creates the doc; note the slug it produces.
- Sessions B onward: `[wrapup] [docfresh:<slug>]` — full wrapup, targets the same doc.
- `[docfresh:slug]` alone (without `[wrapup]`) also works for doc-only updates with no summary/review.

## Implementation Notes

**`stop.sh`** (`WRAPUP_DOC_SLUG` extraction): after classifying the prompt tag as `wrapup`, the script now also checks for a `[docfresh:slug]` pattern in the same prompt text. If found, the slug is exported as `WRAPUP_DOC_SLUG` and passed to `update-docs.sh`'s `--slug` flag, switching it to targeted mode.

**`WORKFLOW_NOTES.md`** documents the root cause analysis, the chosen fix rationale (explicit user intent over heuristic inference), and the convention for Claim C (5b-A..5b-D) and Workstream 6 (per-batch migration) to keep their docs converged.

Known minor issue noted in `WORKFLOW_NOTES.md`: `update-docs.sh` frontmatter validation fails when `claude -p` emits a tool-status line before the `---` opening. A spurious `.update-proposal-*` file results; correctness is not affected. Low-priority hardening candidate.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-28
Created. Documents root-cause diagnosis of near-duplicate interim docs and the `[wrapup] [docfresh:slug]` combined-tag fix applied to `stop.sh` and `WORKFLOW_NOTES.md`.
