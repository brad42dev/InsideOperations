---
id: slug
title: Interim Doc Auto-Detect Fix — Multi-Session Doc Convergence
status: interim
created: 2026-05-28
last_updated: 2026-05-29
last_synced_with_code: 2026-05-29
work_units:
- 2026-05-28_check-duplicate-doc-creation_083943
- 2026-05-29_general_004020
- 2026-05-29_quick-audit-confirm-whether-there-are-ot_064305
implementation:
- .claude/hooks/stop.sh
- .claude/hooks/user-prompt-submit.sh
- .claude/hooks/scripts/lib-common.sh
- .claude/hooks/scripts/update-docs.sh
related:
- []
topics:
- docs-system
- harness-tooling
aliases: []
keywords: []
covers: Interim Doc Auto-Detect Fix — Multi-Session Doc Convergence
---

# Interim Doc Auto-Detect Fix — Multi-Session Doc Convergence

Diagnosed and fixed a harness bug where a single multi-step feature workstream produced near-duplicate interim docs instead of updating one. Subsequent work replaced the grep-based auto-detect in `update-docs.sh` with a deterministic scoring script (`match-docs.py`) and identified the root cause of 33 corrupted log filenames.

## Purpose

The `update-docs.sh` auto-detect logic decides whether to update an existing interim doc or create a new one when a work unit completes. The original implementation used grep-based file overlap, which failed for follow-on sessions touching different but related files. The replacement is a deterministic Python scorer that combines file overlap (inverse-frequency weighted) with topic matching, and emits one of three decisions: UPDATE, CREATE, or TRIAGE.

## Behavior

**`[docfresh:slug]` override (unchanged):** `stop.sh` detects when both `[wrapup]` and `[docfresh:slug]` appear in the same prompt. When both are present, `update-docs.sh` is called in targeted mode with the explicit slug, bypassing auto-detect entirely. This is the recommended path for multi-session workstreams.

**Auto-detect via `match-docs.py`:** When no explicit slug is given, `update-docs.sh` calls `match-docs.py` with the list of modified files and an optional comma-separated topics string. The scorer:
1. Parses every interim doc's frontmatter via `lib-frontmatter.py` to read `implementation:` and `topics:` lists.
2. Computes `file_score` = sum of inverse-frequency weights for files in the overlap between modified files and the doc's `implementation:` list. A file listed by N docs contributes weight `1/N` to each matched doc.
3. Computes `topic_score` = count of matched topics × 1.5.
4. Emits `update` if top score ≥ 2.0 with margin ≥ 1.0 over runner-up; `create` if top score < 0.5; otherwise `triage`.

On `update`, `AFFECTED_DOCS` is set to the matched doc path. On `create` or `triage`, the existing new-doc creation path runs. Triage additionally sets `needs_triage: true` and `merge_candidates:` in the new doc's frontmatter via `lib-frontmatter.py set`.

`match-docs.py` logs every decision (files, topics, exit code, JSON output, stderr) to `.claude/state/match-docs.log`. On any non-zero exit or unparseable JSON it falls back to triage.

**Log filename corruption (identified and root-caused):** 33 existing `.claude/logs/` filenames contained embedded newlines. Root cause: the old `user-prompt-submit.sh` initprompt descriptor path passed the full multi-line prompt through `sed -E 's/\[initprompt\]//'` before `slugify`, with no `head -1` guard. `slugify` does not strip newlines, so multi-paragraph prompts produced filenames with literal `\n` bytes. The fix (`head -1` before `sed`) was already applied in a prior session; this session confirmed the mechanism via test reproduction.

**Convention for multi-session workstreams:**
- Session A: `[wrapup]` — auto-detect creates the doc; note the slug.
- Sessions B onward: `[wrapup] [docfresh:<slug>]` — full wrapup, targets the same doc.
- `[docfresh:slug]` alone also works for doc-only updates with no summary/review.

## Implementation Notes

**`match-docs.py`** is standalone Python 3 stdlib only, with one subprocess call to `lib-frontmatter.py parse` per doc. Thresholds (`HIGH_THRESHOLD=2.0`, `LOW_THRESHOLD=0.5`, `MARGIN_REQUIRED=1.0`) are constants at the top. `--debug` flag emits per-doc score breakdowns to stderr. Returns JSON with `decision`, `target_doc`, `merge_candidates`, and `scores` array.

**`match-docs.test.sh`** creates a temp interim dir with three fixture docs (doc-a/b/c sharing `src/foo.ts` and `src/shared.ts` in various combinations), runs five cases covering update/triage/create branches, and reports decisions with debug output. Also runs a real-corpus dry run against `lib-frontmatter.py`.

**`update-docs.sh`** — the grep-based auto-detect block (former lines 80–99) is replaced by a `match-docs.py` invocation with a temp file for modified paths. The docfresh branch (lines 72–79) is unchanged. A `match-docs.log` audit trail is written on every auto-detect run. Triage path injects `needs_triage` and `merge_candidates` fields into the new doc via `lib-frontmatter.py set`. A commented-out `TODO(indexing-prompt-7)` placeholder marks the future index-rebuild hook location.

**`user-prompt-submit.sh`** — `head -1` guard on initprompt descriptor extraction prevents multi-line prompts from producing newline-embedded log filenames.

**`lib-common.sh`** — `slugify` does not strip newlines; callers are responsible for pre-sanitizing input with `head -1` before passing to `slugify`.

The harness consists of seven scripts: `lib-common.sh`, `update-docs.sh`, `stop.sh`, `user-prompt-submit.sh`, `generate-summary.sh`, `run-review.sh`, and the new `match-docs.py`. No index file exists in `.claude/docs/` or `.claude/docs/interim/` — doc discovery is file-system based. `jq` is available system-wide; `yq` is not present.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-29
Replaced grep-based auto-detect in `update-docs.sh` with deterministic `match-docs.py` scorer (file overlap + topic scoring, UPDATE/CREATE/TRIAGE decisions). Added audit logging to `.claude/state/match-docs.log`, triage frontmatter injection via `lib-frontmatter.py set`, fail-safe fallback on matcher error, and a `TODO(indexing-prompt-7)` placeholder. Created `match-docs.test.sh` with five fixture cases and a real-corpus dry run. Separately audited all log-filename generation paths; confirmed the `slugify`-without-`head -1` pattern was the source of 33 corrupted `.claude/logs/` filenames; that fix was already applied in a prior session.

### 2026-05-29
Read-only harness audit session. Committed pending `.claude/` changes as "documentation hooks update - v2". Ran comprehensive inspection of all six harness scripts (line counts, UPDATE vs CREATE decision logic, `docfresh` slug extraction path, frontmatter schema consistency across all interim docs). No logic changes; expanded implementation list to include all hook scripts inventoried. Confirmed no index files exist; `jq` available, `yq` absent.

### 2026-05-28
Created. Documents root-cause diagnosis of near-duplicate interim docs and the `[wrapup] [docfresh:slug]` combined-tag fix applied to `stop.sh` and `WORKFLOW_NOTES.md`.
