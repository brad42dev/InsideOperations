# Documentation Frontmatter Schema

This file defines the YAML frontmatter schema used for both interim and canonical design documentation. The two schemas share most fields; canonical adds fields that require taxonomy decisions you'll defer until the decomposition pass.

## Why one combined schema

Interim docs are produced now, during the period before the major doc decomposition. They will eventually be merged into the canonical structure. Keeping interim and canonical schemas aligned means the merge is mostly additive (filling in canonical-only fields on existing interim docs) rather than transformative.

## Machine-validated vs convention

Most fields in this schema are conventions — they're not mechanically enforced. The harness will not reject a doc for having an unusual `related` list or a missing `last_synced_with_code`.

Four fields ARE mechanically validated by `.claude/hooks/scripts/lib-frontmatter.py`:
- `topics` (vocabulary check against topics.txt)
- `aliases` (collision check at index rebuild)
- `covers` (single line, max 140 chars)
- `keywords` (max 8 entries, each ≤30 chars)

Validation failures during automated doc writes cause the write to be rejected and the doc to be preserved unchanged.

## Fields used by both interim and canonical docs

```yaml
---
# IDENTITY
id: feature-or-area-slug          # kebab-case, unique across all docs, stable
title: Human-Readable Title       # display title

# STATUS
status: interim                   # interim | canonical | deprecated | draft
created: 2026-05-15               # ISO 8601 date
last_updated: 2026-05-15          # ISO 8601 date, updated on every change
last_synced_with_code: 2026-05-15 # ISO 8601 date, updated when code-doc reconciliation runs

# PROVENANCE
work_units:                       # list of work-unit log filenames that contributed to this doc
  - 2026-05-12_phase_03_extract_renderer_core
  - 2026-05-14_phase_04_apply_constraints

# IMPLEMENTATION
implementation:                   # list of code file paths this doc describes
  - src/renderer/core.ts
  - src/renderer/constraints.ts
  - src/main.rs:1245-1289         # line ranges are OK and helpful

# RELATIONSHIPS
related:                          # informal list of related doc IDs (used by interim)
  - other-feature-slug
  - another-area-slug

# INDEXING (all four are machine-validated)
topics:                           # list of controlled-vocabulary topics from .claude/docs/topics.txt
  - module-designer
  - ui-framework
aliases:                          # list of prior slugs this doc has been known by (for rename safety)
  - old-slug-of-this-doc
keywords:                         # optional advisory keywords (model-generated, validated). max 8 entries, each ≤30 chars
  - keyword1
  - keyword2
covers: Brief description of what this doc covers.  # one-line blurb (model-generated, validated). single line, max 140 chars
---
```

## Additional fields for canonical docs only

These are populated during the decomposition pass when you have a stable taxonomy. Leave them out of interim docs.

```yaml
---
# TAXONOMY (canonical only)
category: ui-pattern              # see "Canonical categories" below
scope: app-wide                   # app-wide | module-specific | service | data | api

# WHERE IT APPLIES (canonical only)
applies_to:
  - all-modules                   # or: list of specific module IDs
  - frontend                      # or: backend | data | infra

# FORMAL CROSS-REFERENCES (canonical only)
# These replace the informal `related` field
references:                       # docs this one depends on
  - design-tokens
  - context-awareness
referenced_by:                    # docs that depend on this one
  - module-designer
  - module-console
  - module-dashboard

# CANONICAL PATTERN MARKERS (canonical only)
is_canonical_pattern: true        # if true, this is the SSOT for this concept
canonical_pattern: parent-slug    # if this is an instance, points to the canonical pattern

# IMPLEMENTATION EXAMPLES (canonical only)
canonical_examples:               # specific code locations that demonstrate the pattern
  - src/menus/contextMenu.ts:42-78
---
```

## Canonical categories

When you get to the canonical pass, these are the suggested top-level categories. Adjust as the project's actual shape becomes clear.

- `ui-pattern` — reusable interaction or visual patterns (right-click menus, modals, tooltips)
- `module` — a major functional area of the app (designer, dashboard, reports)
- `service` — a backend service or capability (auth, persistence, eventing)
- `data` — data structures, schemas, storage formats
- `api` — internal or external API surfaces
- `infra` — build, deploy, configuration concerns
- `design-token` — visual or behavioral tokens shared across the app

Each category implies different expected fields. Modules describe themselves; ui-patterns describe behavior; data describes shape; api describes contract.

## Field rules

### `id`
- Lowercase, kebab-case, no spaces, no special characters except hyphens
- Globally unique across all docs in the project
- Stable in spirit, but the `aliases` field provides a sanctioned rename mechanism. If a doc's slug was wrong from creation (e.g., model error during initial slug generation) or a concept name changes substantially, you may rename the file and `id` field, adding the old slug to `aliases`. The harness's index resolves docfresh references through aliases, so prior references continue to work. Use rename + alias rather than deprecate + redirect when the original slug was a mistake or never accumulated meaningful external references. Use deprecate + redirect when the concept itself has split or fundamentally changed.

### `status`
- `interim` — produced during the pre-decomposition period; will be merged into canonical structure
- `canonical` — part of the canonical structure after decomposition; SSOT for its concept
- `deprecated` — kept for historical reference; pointers redirect readers/agents to the replacement
- `draft` — incomplete, not yet authoritative

### Dates
- All dates ISO 8601 (`YYYY-MM-DD`)
- `created` set once and never updated
- `last_updated` updated every time the file is meaningfully modified
- `last_synced_with_code` updated when the doc has been verified against current code reality

### `implementation`
- List of paths relative to project root
- Line ranges welcome (`src/file.ts:42-78`)
- Order roughly from most-canonical to least-canonical example
- Empty list is acceptable for purely conceptual docs (no specific code yet)

### `work_units`
- Filenames of work-unit logs that contributed to this doc, without `.md` extension
- Append-only — each new work unit that updates this doc adds to the list
- Enables tracing any documentation claim back to the conversation that produced it

### `related` (interim) vs `references`/`referenced_by` (canonical)
- During the interim period, just maintain `related` as an informal list
- During canonical decomposition, `related` is replaced with `references` and `referenced_by`, which are bidirectional and formally maintained

### `aliases`
- List of prior slugs this doc has been known by.
- Append-only — when a doc is renamed, the old slug is added to aliases.
- Resolved by the docs index (index.json) so docfresh:slug tags using old slugs continue to work.
- Two docs MUST NOT claim the same alias. The index rebuilder detects collisions and fails loudly.

### `topics`
- List of controlled-vocabulary topics from `.claude/docs/topics.txt`.
- Used by the auto-detect matcher to decide UPDATE vs CREATE vs TRIAGE when a work unit completes.
- Multiple topics per doc are fine and expected (e.g., [module-designer, ui-framework]).
- Unknown topics cause validation failure. To add a new topic, edit topics.txt directly.
- The vocabulary is intentionally coarse-grained. Sub-areas are NOT broken out as separate topics — they're handled by file-path overlap in the matcher.

### `covers`
- One-line human-readable blurb summarizing what this doc covers.
- Single line only. Max 140 characters. Newlines rejected by validation.
- Model-generated during doc creation/update, validated before write. Falls back to `title` on validation failure.
- Used in the human-readable INDEX.md and index.json for discovery.

### `keywords`
- Optional list of advisory keywords.
- Max 8 entries, each ≤30 chars.
- Model-generated. Advisory signal in the matcher (low weight). Never decisive on its own.
- Falls back to empty list on validation failure.

## Validation and machine-checked fields

- `topics` values are validated against `.claude/docs/topics.txt`; unknown topics cause validation failure.
- `covers` must be a single line, max 140 characters.
- `keywords` is capped at 8 entries, each ≤30 chars.
- All four new fields are validated by `.claude/hooks/scripts/lib-frontmatter.py`.
- All other fields in this schema are NOT mechanically validated — they're conventions.

## Body content conventions

Below the frontmatter, the document body uses these conventions:

- First-level heading is the title (matches `title` field)
- Brief 1-3 sentence summary directly under the title
- Sections use second-level headings (`##`)
- Standard section order when applicable:
  1. Purpose / Overview
  2. Behavior
  3. Caveats
  4. Implementation Notes
  5. Changelog (interim docs use a changelog section; see below)

## Changelog section (interim docs only)

Interim docs include a changelog section at the bottom of the body. This satisfies the user-requested ability to roll back doc updates if a wrap-up sequence produces a wrong update.

```markdown
## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
<!-- Each entry is appended on update. Older entries on bottom. Newer on top. -->

### 2026-05-15
Updated implementation list to include constraints.ts. Refined caveats section based on findings in phase 4 work unit.

### 2026-05-12
Initial creation from phase 3 work unit. Documented core renderer extraction.
```

The HTML comments tell the LLM to skip the changelog during normal reads. When you specifically want to audit history, you can ask the LLM to read the changelog section.

Canonical docs do not need this section — git history serves that role once docs are stable.

## Examples

### Minimal interim doc

```markdown
---
id: shape-resize-sidecar-positioning
title: Shape Resize Sidecar Positioning
status: interim
created: 2026-05-15
last_updated: 2026-05-15
last_synced_with_code: 2026-05-15
work_units:
  - 2026-05-15_fix_sidecar_scaling
implementation:
  - src/designer/shapes/scaleHandler.ts
related:
  - designer-resize-controls
  - sidecar-rendering
topics:
  - module-designer
  - graphics-shapes
aliases: []
keywords:
  - sidecar
  - resize
  - positioning
  - shape
covers: How shape sidecars maintain absolute pixel offsets during resize rather than scaling with the shape.
---

# Shape Resize Sidecar Positioning

When a shape is resized, sidecars maintain their absolute pixel offsets from the shape's edges and center rather than scaling along with the shape.

## Behavior

Sidecar offsets are measured from the resized shape's edges. If a sidecar's left edge is 10px right of the shape's right edge, that remains true at any shape size.

## Caveats

The interior fill gauge is the one exception — it scales with the shape.

## Implementation Notes

The fix lives in the resize handler's preview-update path. The final-commit path was already correct; only the live preview was incorrectly scaling sidecar offsets.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->

### 2026-05-15
Initial creation from the sidecar scaling fix work unit.
```

### Eventual canonical doc (after decomposition)

```markdown
---
id: ui-right-click-menus
title: Right-Click Menus
status: canonical
created: 2026-05-15
last_updated: 2026-08-01
last_synced_with_code: 2026-08-01
category: ui-pattern
scope: app-wide
applies_to:
  - all-modules
  - frontend
is_canonical_pattern: true
work_units:
  - 2026-05-15_initial_decomposition
  - 2026-06-22_module_designer_context_menus
references:
  - design-tokens
  - context-awareness
referenced_by:
  - module-designer
  - module-console
  - module-dashboard
implementation:
  - src/menus/contextMenu.ts
  - src/main.rs:1245-1289
canonical_examples:
  - src/menus/contextMenu.ts:42-78
topics:
  - context-menus
  - ui-framework
aliases:
  - right-click-menus
keywords:
  - context menu
  - right-click
  - event intercept
  - cursor position
covers: Global right-click menu system — context-aware menus rendered at cursor position, shared across all modules.
---

# Right-Click Menus

The application intercepts right-click events globally. Menus render at the click position and are always context-aware.

## Behavior

[...]

## Caveats

In the designer module, right-click in test mode behaves differently than in design mode — see `module-designer-test-mode`.

## Implementation Notes

The canonical implementation lives in `src/menus/contextMenu.ts`. When implementing right-click handling in a new module, replicate this pattern rather than creating a new one.
```
