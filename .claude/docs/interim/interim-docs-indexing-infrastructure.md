---
id: interim-docs-indexing-infrastructure
title: Interim Docs Indexing Infrastructure
status: interim
created: 2026-05-29
last_updated: 2026-05-29
last_synced_with_code: 2026-05-29
work_units:
- 2026-05-29_general_004020
- 2026-05-29_quick-audit-confirm-whether-there-are-ot_064305
implementation:
- .claude/hooks/scripts/lib-frontmatter.py
- .claude/hooks/scripts/match-docs.py
- .claude/hooks/scripts/match-docs.test.sh
- .claude/hooks/scripts/rebuild-index.py
- .claude/hooks/scripts/update-docs.sh
- .claude/hooks/scripts/lib-common.sh
- .claude/hooks/stop.sh
- .claude/hooks/user-prompt-submit.sh
- .claude/docs/topics.txt
- .claude/docs/frontmatter-schema.md
- .claude/docs/INDEXING_SYSTEM.md
related:
- slug
topics:
- docs-system
- harness-tooling
aliases: []
keywords: []
covers: Frontmatter helper, topics vocabulary, schema, and migration establishing
  the v2 interim docs indexing layer.
---

# Interim Docs Indexing Infrastructure

Complete v2 indexing pipeline for interim docs: a deterministic Python frontmatter helper (`lib-frontmatter.py`), a 39-topic controlled vocabulary (`topics.txt`), a scored UPDATE/CREATE/TRIAGE matcher (`match-docs.py`), and a deterministic index builder (`rebuild-index.py`). The full pipeline runs automatically at work-unit stop, replacing the former grep-based file-overlap auto-detect.

## Purpose

The interim docs system needed a machine-readable layer to support automated indexing, doc update routing, and search — and to stop creating duplicate interim docs across related sessions. This work builds the full pipeline: a Python helper that reads and writes YAML frontmatter, a controlled vocabulary for classifying docs by functional area, a scored matcher that decides UPDATE vs CREATE vs TRIAGE, and an index rebuilder that generates `index.json` and `INDEX.md` from frontmatter after every doc change.

## Behavior

**`lib-frontmatter.py`** is a stdlib + PyYAML Python helper invoked by harness scripts. Subcommands:
- `parse <path>` — print frontmatter as JSON to stdout; exit 1 if missing or malformed
- `get <path> <key>` — print a single top-level value; exit 1 if key missing
- `set <path> <key> <json-value>` — idempotent frontmatter key setter; preserves body verbatim; rejects `covers` values containing newlines
- `ensure-keys <path> <defaults-json>` — adds missing keys with default values; never overwrites existing; idempotent
- `validate <path>` — checks all 9 original required keys plus the 4 new keys; validates `topics` against `topics.txt`; validates `covers` (single line, ≤140 chars); validates `keywords` (≤8 entries, each ≤30 chars); exits 1 with error list to stderr on failure

Write operations use temp-file-then-rename to avoid partial writes. `ruamel.yaml` is not required; comment round-tripping is not preserved.

**`topics.txt`** contains 39 controlled-vocabulary topics, organized into sections by comments. Topics are grouped as: frontend modules (`module-*`), backend services (`service-*`), graphics (`graphics-*`), real-time/data (`real-time-data`, `timeseries-storage`, `opc-integration`), cross-cutting features, and meta (`harness-tooling`, `docs-system`). The `validate` subcommand reads this file, treating `#`-prefixed lines and blank lines as non-vocabulary.

**`match-docs.py`** is the deterministic UPDATE/CREATE/TRIAGE decision script. It scores each existing interim doc against two signals:
- **File score**: for each file in files-modified that appears in a doc's `implementation:` list, the weight is `1.0 / N` where N = the number of docs that list that file. Sparse overlap with a unique file scores high; overlap with a shared utility file scores low.
- **Topic score**: `|T_in ∩ T_doc| × 1.5`, where T_in is the comma-separated topics passed by the caller (currently always empty; topic extraction from log content is deferred).
- Thresholds: `HIGH_THRESHOLD=2.0`, `LOW_THRESHOLD=0.5`, `MARGIN_REQUIRED=1.0`. Decision: UPDATE if top score ≥ HIGH and margin over runner-up ≥ MARGIN; CREATE if top score < LOW; TRIAGE otherwise.
- Path normalization: both files-modified and doc implementation lists are normalized to repo-relative paths before comparison. Absolute paths from the hook are stripped of the repo root prefix.
- Output: JSON with `decision`, `target_doc`, `merge_candidates`, and `scores` (all docs with score > 0, sorted descending).
- Every invocation is logged to `.claude/state/match-docs.log` for audit.
- Test harness in `match-docs.test.sh`: 5 fixture cases, all passing.

Smoke test results against 5 known duplicate groups (8 later-doc simulations): 5 GOOD, 2 TRIAGE-GOOD, 1 BAD-OVER. The BAD-OVER (Group E: same bug pattern, different files) is a structural limitation — those cases require explicit `[docfresh:<slug>]` override.

**`rebuild-index.py`** regenerates `index.json` and `INDEX.md` from frontmatter after any doc change. Features:
- Scans all `.claude/docs/interim/*.md` via `lib-frontmatter.py parse` (one subprocess per doc).
- Writes `index.json`: doc list sorted by slug, `topic_index` (topic → slug list), `alias_index` (alias → canonical slug), `triage_queue` (docs with `needs_triage: true`).
- Writes `INDEX.md`: human-readable rendering with Triage Queue, By Topic, and All Documents sections.
- Atomic writes (temp file then rename).
- Alias collision detection: if any alias is claimed by two docs, or any alias collides with an existing slug, exits 1 and writes no output.
- Deterministic: two runs with no doc changes produce byte-identical output except for the `generated` timestamp line.

**`update-docs.sh`** wiring:
- Replaced the former grep-based auto-detect block (lines 80–99) with a call to `match-docs.py`. The `~docfresh:slug~` override path is unchanged.
- On TRIAGE decision, new docs get `needs_triage: true` and `merge_candidates: [...]` injected into frontmatter via `lib-frontmatter.py set`.
- Short-output guard: if `claude -p` returns < 100 bytes or a "doc is up to date" pattern, skip the write and log — no proposal file is created.
- `rebuild-index.py` is called non-fatally after every doc write.

**`stop.sh`** auto-triggers were temporarily disabled during rollout (prompt 5.6) and re-enabled after the smoke test passed (prompt 7). Three invocation sites active: `~wrapup~` with slug, `~wrapup~` without slug, and standalone `~docfresh~`.

**`user-prompt-submit.sh`** alias resolution: on a `~docfresh:<slug>~` tag, if the slug doesn't match an existing file, the handler checks `index.json`'s `alias_index` and resolves to the canonical slug. No-op if `index.json` is absent. Also added: a log-line-count nudge (> 2000 lines without `~initprompt~` triggers a stderr hint to start a new work unit).

**`lib-common.sh`** `sanitize_body` helper: strips ANSI escapes and common LLM preamble lines (`Here is`, `Here's`, `Sure,`, `Okay,`, opening backtick blocks). Used by `generate-summary.sh` and `run-review.sh` before writing output to disk.

**Slug corruption audit (read-only):** Confirmed that the 33 corrupted `.claude/logs/` filenames (pattern: `valid_id\n\ngarbage`) originated from the old `user-prompt-submit.sh` code path that lacked `head -1` before passing multi-line initprompt text through `slugify`. The `head -1` fix (already landed in a prior commit) is sufficient — `slugify` does not strip embedded newlines, so the caller must pre-strip. `rotate_log_to_new` is safe because it only receives already-slugified descriptors. No other unsafe filename construction sites were found.

**`.gitignore`** additions: patterns for `.claude/archive/`, `.claude/reviews/`, `.claude/summaries/`, `current_turn_*.json`, `match-docs.log`, `slug-gen.log`, `rebuild-index.log`, `wrapup.log`, `*.update-proposal-*`, and `.claude/docs/interim.pre-migration-backup/`.

**`INDEXING_SYSTEM.md`** (`.claude/docs/INDEXING_SYSTEM.md`): system overview and tuning guide for future maintainers.

## Implementation Notes

**`lib-frontmatter.py`** lives at `.claude/hooks/scripts/lib-frontmatter.py`. Standalone executable; no external dependencies beyond PyYAML (system-wide). Trusted deterministic helper with no model calls.

**`topics.txt`** lives at `.claude/docs/topics.txt`. 39 topics; section headers are YAML comments and not part of the vocabulary. `_load_known_topics()` skips `#`-comment lines and blank lines.

**`match-docs.py`** path normalization uses `git rev-parse --show-toplevel` (falling back to `os.getcwd()`) to find the repo root, then strips it from any absolute path before computing overlap. The pre-compute pass builds a `file_freq` map in one O(docs × avg_implementation_len) pass before scoring.

**`rebuild-index.py`** invokes `lib-frontmatter.py parse` as a subprocess for each doc — no direct YAML imports. The `generated` field uses `datetime.utcnow().isoformat() + "Z"`. All other output fields are derived deterministically from frontmatter.

**`frontmatter-schema.md`** (`.claude/docs/frontmatter-schema.md`) consolidates the original schema with the v2 additions. The v2 additions scratch file was deleted.

**Prior infrastructure work** was committed in `baec1ef3` ("Add lib-frontmatter helper, topics vocabulary, consolidated schema"). Path normalization fix and stop.sh re-enable were committed in `c367cc0f`. Index builder and final hardening were committed in `600c9660`.

**Known gap:** 20 of 24 interim docs have empty `topics:` fields. The matcher's signal strengthens as new work populates them. For now, topic scoring contributes only when the caller passes non-empty topics.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-29
Full pipeline shipped in this work unit: built `match-docs.py` (scored UPDATE/CREATE/TRIAGE matcher with file-frequency weighting and controlled-vocabulary topic scoring); built `match-docs.test.sh` (5-case fixture test harness, all passing); wired `match-docs.py` into `update-docs.sh` replacing the grep-based auto-detect; discovered and fixed path normalization bug (hook passed absolute paths, docs stored relative paths); ran smoke test against 5 known duplicate groups (7/8 GOOD or TRIAGE-GOOD, 1 known structural BAD-OVER); built `rebuild-index.py` (generates `index.json` + `INDEX.md` atomically with alias collision detection); wired `rebuild-index.py` into `update-docs.sh`; added alias resolution to `user-prompt-submit.sh` via `alias_index`; re-enabled stop.sh auto-triggers after smoke test; added `sanitize_body` to `lib-common.sh` and wired into `generate-summary.sh` and `run-review.sh`; added `.gitignore` patterns for ephemeral harness state; created `INDEXING_SYSTEM.md`; confirmed slug corruption root cause (missing `head -1` in old `user-prompt-submit.sh`); cleaned up 16 stale `.update-proposal-*` files. Implementation list expanded to include all 11 core files.

### 2026-05-29
Doc-update pass from post-session harness invocation. Added harness investigation findings: confirmed two stray `.update-proposal-*` files in interim dir; confirmed oversized log root cause (untagged general prompts never rotate). No code or doc changes from this pass — captures final state of the work unit.

### 2026-05-29
Created. Documents the lib-frontmatter.py helper, topics.txt controlled vocabulary, and frontmatter-schema.md consolidation built during the interim-docs-indexing workstream. Notes the known gap: existing 23 docs are missing the four new fields and will fail `validate` until a bulk ensure-keys pass is run.
