#!/bin/bash
# normalize_task_dirs.sh — Normalize docs/tasks/ to lowercase directory names.
#
# For directories that exist in both uppercase and lowercase (e.g., DD-10 and dd-10):
#   Move all files from the uppercase dir into the lowercase dir, then remove the uppercase dir.
# For directories that exist only in uppercase (e.g., DD-16):
#   Rename to lowercase (dd-16).
#
# Does NOT touch docs/state/ — state dirs use uppercase unit IDs from the registry.
# Safe to re-run: skips dirs that are already lowercase-only.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
TASKS_DIR="$REPO/docs/tasks"

echo "Normalizing $TASKS_DIR to lowercase..."
echo ""

moved_files=0
renamed_dirs=0
skipped=0

for upper_dir in "$TASKS_DIR"/*/; do
    # Strip trailing slash, get basename
    upper_dir="${upper_dir%/}"
    basename="${upper_dir##*/}"

    # Skip if already lowercase (no uppercase letters)
    if [[ "$basename" == "${basename,,}" ]]; then
        continue
    fi

    lower_dir="$TASKS_DIR/${basename,,}"

    if [ -d "$lower_dir" ]; then
        # Both cases exist — merge uppercase into lowercase
        file_count=$(ls -1 "$upper_dir" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$file_count" -eq 0 ]; then
            echo "  EMPTY: $basename — removing empty uppercase dir"
            rmdir "$upper_dir"
            skipped=$((skipped + 1))
            continue
        fi
        echo "  MERGE: $basename → ${basename,,}  ($file_count files)"
        for f in "$upper_dir"/*; do
            fname="${f##*/}"
            if [ -f "$lower_dir/$fname" ]; then
                echo "    SKIP (already exists): $fname"
            else
                mv "$f" "$lower_dir/$fname"
                moved_files=$((moved_files + 1))
                echo "    moved: $fname"
            fi
        done
        # Remove now-empty uppercase dir
        rmdir "$upper_dir" 2>/dev/null && echo "    removed: $basename/" || echo "    WARNING: could not remove $basename/ (not empty?)"
    else
        # Only uppercase exists — rename to lowercase
        echo "  RENAME: $basename → ${basename,,}"
        mv "$upper_dir" "$lower_dir"
        renamed_dirs=$((renamed_dirs + 1))
    fi
done

echo ""
echo "Done."
echo "  Merged (files moved): $moved_files"
echo "  Renamed (dir):        $renamed_dirs"
echo "  Skipped (already ok): $skipped"
