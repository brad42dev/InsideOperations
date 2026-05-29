---
id: interim-docs-indexing-infrastructure
title: Interim Docs Indexing Infrastructure
status: interim
created: 2026-05-29
last_updated: 2026-05-29
last_synced_with_code: 2026-05-29
work_units:
- 2026-05-29_general_004020
implementation:
- .claude/hooks/scripts/lib-frontmatter.py
- .claude/docs/topics.txt
- .claude/docs/frontmatter-schema.md
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

Supporting infrastructure for the interim docs indexing system: a deterministic Python frontmatter helper (`lib-frontmatter.py`), a 39-topic controlled vocabulary (`topics.txt`), and a consolidated frontmatter schema reference. Four new fields (`topics`, `aliases`, `keywords`, `covers`) were added to the schema to enable automated indexing and UPDATE vs CREATE routing.

## Purpose

The interim docs system needed a machine-readable layer to support automated indexing, doc update routing, and search. This work builds the foundation: a Python helper that reads and writes YAML frontmatter in `.claude/docs/interim/*.md` files, a controlled vocabulary for classifying docs by functional area, and a schema definition that specifies which fields are mechanically validated vs conventions.

## Behavior

**`lib-frontmatter.py`** is a stdlib + PyYAML Python helper invoked by harness scripts. Subcommands:
- `parse <path>` — print frontmatter as JSON to stdout; exit 1 if missing or malformed
- `get <path> <key>` — print a single top-level value; exit 1 if key missing
- `set <path> <key> <json-value>` — idempotent frontmatter key setter; preserves body verbatim; rejects `covers` values containing newlines
- `ensure-keys <path> <defaults-json>` — adds missing keys with default values; never overwrites existing; idempotent
- `validate <path>` — checks all 9 original required keys plus the 4 new keys; validates `topics` against `topics.txt`; validates `covers` (single line, ≤140 chars); validates `keywords` (≤8 entries, each ≤30 chars); exits 1 with error list to stderr on failure

Write operations use temp-file-then-rename to avoid partial writes. `ruamel.yaml` is not required; comment round-tripping is not preserved (documented in module docstring).

**`topics.txt`** contains 39 controlled-vocabulary topics, organized into sections by comments. Topics are grouped as: frontend modules (`module-*`), backend services (`service-*`), graphics (`graphics-*`), real-time/data (`real-time-data`, `timeseries-storage`, `opc-integration`), cross-cutting features, and meta (`harness-tooling`, `docs-system`). The `validate` subcommand reads this file, treating `#`-prefixed lines and blank lines as non-vocabulary.

**Schema changes** to `frontmatter-schema.md`:
- Four new fields added: `topics` (validated against topics.txt), `aliases` (prior slugs, append-only, collision-checked at index rebuild), `keywords` (advisory, model-generated, max 8 × 30 chars), `covers` (one-line blurb, max 140 chars)
- New subsection: "Validation and machine-checked fields"
- New subsections: "Aliases", "Topics", "Covers", "Keywords" under field rules
- Revised `id` field rule: explains rename-via-aliases as the sanctioned path when a slug was wrong from creation; preserves deprecate+redirect for concept splits

**Known gap:** All 23 existing interim docs are missing the four new fields (`topics`, `aliases`, `keywords`, `covers`). Validation against them fails until a bulk `ensure-keys` pass is run and committed.

**Harness investigation findings (read-only):** Two `.update-proposal-*` stray files confirmed present in `.claude/docs/interim/`. The oversized `2026-05-29_general_004020.md` log (10,081 lines, 13 prompts) is caused by untagged "general" prompts always appending to the same log; no `~initprompt~`/`~phaseprompt~` tags were present in the file to trigger rotation. Root cause identified, no fix applied in this work unit.

## Implementation Notes

**`lib-frontmatter.py`** lives at `.claude/hooks/scripts/lib-frontmatter.py`. It is a standalone executable with no external dependencies beyond PyYAML (already available system-wide). The file has a module docstring declaring it a trusted deterministic helper with no model calls and no network access.

**`topics.txt`** lives at `.claude/docs/topics.txt`. Section headers are YAML comments (`#`) and are not part of the vocabulary. The 39 topics were derived from a read-only structural survey of `design-docs/`, `spec_docs/`, and `docs/decisions/` filenames and archive catalogs.

**`frontmatter-schema.md`** (`.claude/docs/frontmatter-schema.md`) consolidates the original schema with the v2 additions doc. The v2 additions file (`.claude/docs/interim/.frontmatter-schema-v2.md`) was deleted — it was untracked by git and removed via plain `rm`.

**Frontmatter repair:** `claim-a-token-registry-gaps.md` had a corrupted `work_units` entry containing literal `\n\n` and embedded trailing text from a chatty sub-session. The entry was replaced with the clean filename, annotated with `# CORRECTED FROM CORRUPTED ENTRY`. The file was committed separately as `0e6a3ae9`.

**`claim-c-canvas-migration.md`** was identified as a slug mismatch (slug says "canvas-migration", body is about `docfresh` duplicate-doc convergence). Renaming was deferred; recommended replacement slug is `interim-doc-autodetect-fix` or `docfresh-duplicate-convergence-fix`.

All infrastructure work was committed in `baec1ef3` ("Add lib-frontmatter helper, topics vocabulary, consolidated schema").

**`_load_known_topics()` in `lib-frontmatter.py`** already skipped `#`-comment lines and blank lines before the final 39-topic vocabulary was written — no code change was needed when the vocabulary was updated.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-29
Doc-update pass from post-session harness invocation. Added harness investigation findings: confirmed two stray `.update-proposal-*` files in interim dir; confirmed oversized log root cause (untagged general prompts never rotate). No code or doc changes from this pass — captures final state of the work unit.

### 2026-05-29
Created. Documents the lib-frontmatter.py helper, topics.txt controlled vocabulary, and frontmatter-schema.md consolidation built during the interim-docs-indexing workstream. Notes the known gap: existing 23 docs are missing the four new fields and will fail `validate` until a bulk ensure-keys pass is run.
