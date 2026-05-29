# Interim Docs Indexing System

This system replaces the original file-overlap-only auto-detect in update-docs.sh with a deterministic matcher that uses both file overlap and controlled-vocabulary topics. Goal: stop creating duplicate interim docs across related sessions.

## How it works

1. When update-docs.sh runs (triggered by [wrapup] or [docfresh]), it:
   - Extracts the files-modified list from the work-unit log.
   - Calls match-docs.py with those files + (currently empty) topics.
   - Receives a decision: UPDATE, CREATE, or TRIAGE.
2. UPDATE → modify the matched doc. CREATE → new doc with model-generated slug. TRIAGE → new doc, but flagged with needs_triage: true and merge_candidates pointing at near-matches for human review.
3. After any doc change, rebuild-index.py regenerates index.json and INDEX.md from frontmatter.

## Files

- `.claude/hooks/scripts/match-docs.py` — the deterministic matcher.
- `.claude/hooks/scripts/match-docs.test.sh` — test fixtures.
- `.claude/hooks/scripts/lib-frontmatter.py` — YAML parse/get/set helper.
- `.claude/hooks/scripts/rebuild-index.py` — index regeneration.
- `.claude/docs/topics.txt` — controlled topic vocabulary (39 topics).
- `.claude/docs/frontmatter-schema.md` — the v2 schema spec.
- `.claude/docs/index.json` — generated, machine-readable.
- `.claude/docs/INDEX.md` — generated, human-readable.

## Audit logs

- `.claude/state/match-docs.log` — every matcher invocation with inputs, decision, and reasoning.
- `.claude/state/slug-gen.log` — slug sanitization audit.
- `.claude/state/rebuild-index.log` — index rebuild status.

## Known limitations

- "Same bug pattern, different files" duplicates can't be detected: when two semantically-related docs have zero file overlap and only generic topics, the matcher has no signal to recognize the relationship. For these cases, use [docfresh:<original-slug>] to bypass auto-detect and merge onto the existing doc.
- Untagged sessions (no [initprompt]) accumulate into a shared "general" log. Logs are only bounded when work units are tagged.
- Topics field is sparse: 20 of 24 initial docs have empty topics. Topics get populated as new work is done; the matcher's signal strengthens over time.

## Tuning

Thresholds in match-docs.py (HIGH=2.0, LOW=0.5, MARGIN_REQUIRED=1.0) were chosen to produce 7/8 correct decisions on the original duplicate corpus, with 1 known structural BAD-OVER (case requiring [docfresh] override). If duplicate rate increases meaningfully, inspect match-docs.log and consider:

- Lowering MARGIN_REQUIRED if many cases land at the margin and should be triage instead of update.
- Raising HIGH_THRESHOLD if false updates appear.
- Adding more topics to docs that have empty topics fields.

Don't tune the algorithm against synthetic tests; tune against real observed cases.
