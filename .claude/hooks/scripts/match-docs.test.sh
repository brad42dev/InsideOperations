#!/usr/bin/env bash
set -euo pipefail

TMPDIR=$(mktemp -d)
TOPICS_FILE="$TMPDIR/topics.txt"
INTERIM_DIR="$TMPDIR/interim"
mkdir -p "$INTERIM_DIR"

# Minimal topics vocabulary for tests
cat > "$TOPICS_FILE" <<EOF
feature-x
feature-y
feature-z
EOF

# Create fixture doc A
cat > "$INTERIM_DIR/doc-a.md" <<'EOF'
---
id: doc-a
title: Doc A
status: interim
created: 2026-05-01
last_updated: 2026-05-01
last_synced_with_code: 2026-05-01
work_units: []
implementation:
  - src/foo.ts
related: []
topics:
  - feature-x
aliases: []
keywords: []
covers: Doc A
---

# Doc A
EOF

# Fixture doc B (shares foo.ts, has different topic)
cat > "$INTERIM_DIR/doc-b.md" <<'EOF'
---
id: doc-b
title: Doc B
status: interim
created: 2026-05-01
last_updated: 2026-05-01
last_synced_with_code: 2026-05-01
work_units: []
implementation:
  - src/foo.ts
  - src/shared.ts
related: []
topics: []
aliases: []
keywords: []
covers: Doc B
---

# Doc B
EOF

# Fixture doc C (has shared.ts and feature-y)
cat > "$INTERIM_DIR/doc-c.md" <<'EOF'
---
id: doc-c
title: Doc C
status: interim
created: 2026-05-01
last_updated: 2026-05-01
last_synced_with_code: 2026-05-01
work_units: []
implementation:
  - src/shared.ts
related: []
topics:
  - feature-y
aliases: []
keywords: []
covers: Doc C
---

# Doc C
EOF

# Helper: run match-docs and report result
run_case() {
  local case_name="$1"
  local files_input="$2"
  local topics_input="$3"
  local files_path="$TMPDIR/files-${case_name}.txt"
  printf '%s\n' "$files_input" > "$files_path"

  echo ""
  echo "=== $case_name ==="
  echo "  files: [$files_input]"
  echo "  topics: [$topics_input]"

  python3 .claude/hooks/scripts/match-docs.py \
    --files-modified "$files_path" \
    --topics "$topics_input" \
    --interim-dir "$INTERIM_DIR" \
    --topics-file "$TOPICS_FILE" \
    --debug 2>&1 | tee "$TMPDIR/out-${case_name}.txt"
}

# Case 1: foo.ts + feature-x
# Expected: doc-a wins decisively (matches both file and topic with clear margin over doc-b which only matches file)
run_case "case1" "src/foo.ts" "feature-x"

# Case 2: shared.ts only, no topics
# Expected: shared.ts is in 2 of 3 docs so its weight is 0.5; total < HIGH (2.0); likely triage or create depending on what else
run_case "case2" "src/shared.ts" ""

# Case 3: completely unrelated file
# Expected: create (no doc matches anything)
run_case "case3" "src/unrelated.ts" ""

# Case 4: foo.ts only, no topics
# Expected: foo.ts is in 2 of 3 docs (a and b), so weight=0.5 for each. Both docs tied at 0.5. Below HIGH. Triage with both as candidates.
run_case "case4" "src/foo.ts" ""

# Case 5: foo.ts + shared.ts + feature-y
# Expected: doc-b matches both files (foo.ts weight 0.5, shared.ts weight 0.5 = 1.0 file_score); doc-c matches shared.ts and feature-y (0.5 + 1.5 = 2.0). doc-c wins.
run_case "case5" "$(printf 'src/foo.ts\nsrc/shared.ts')" "feature-y"

echo ""
echo "=== Test complete. Outputs saved to $TMPDIR/out-*.txt ==="

echo ""
echo "=== Real-corpus dry run ==="
# Simulate a work unit that touched the lib-frontmatter script.
# Expected: should match interim-docs-indexing-infrastructure with topics [docs-system, harness-tooling]
echo ".claude/hooks/scripts/lib-frontmatter.py" > /tmp/dry-run-files.txt
python3 .claude/hooks/scripts/match-docs.py \
  --files-modified /tmp/dry-run-files.txt \
  --topics "docs-system,harness-tooling" \
  --debug 2>&1
