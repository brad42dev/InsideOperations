Implement Phase 7 of the sidecar architecture plan. Read this file completely before writing any code.

---

## Context

Once an addon ID, connection ID, or bindableParts key ships in a library shape, removing it
breaks existing graphics that reference it. `dev.sh shapes import` must enforce append-only
semantics: the incoming sidecar is diffed against the DB version, and any removed IDs block
the import unless `--force` is passed.

Also: the `forPart` matching semantics (addon ID first, group name fallback) are currently
only in the renderer code (`renderNodeSvg.tsx`) and undocumented. This phase documents them
in the sidecar spec.

Depends on: Phase 2 (content hashing) should be complete so the import already has DB access.
Phases 3–6 are not required.

---

## Key Files

- **MODIFY:** `dev.sh` — update `shapes_import()` function (around line 307–377)
- **MODIFY:** `design-docs/shape-sidecar-spec/shape-sidecar-spec.md` — add forPart section
- **READ:** `dev.sh` lines 307–500 to understand current import flow and variable names

---

## Implementation Steps

### Step 1 — Parse `--force` flag in `shapes_import()`

At the top of the `shapes_import()` function in `dev.sh`, add flag parsing before any
other logic:

```bash
shapes_import() {
    local force=false
    if [[ "${1:-}" == "--force" ]]; then
        force=true
        echo "WARNING: --force mode — append-only ID checks disabled"
    fi
    # ... rest of function continues
```

### Step 2 — Add `check_append_only` helper function

Add this function **before** `shapes_import` in `dev.sh`:

```bash
# Diff incoming sidecar against DB version for a library shape.
# Prints error lines and returns 1 if any addon IDs, connection IDs,
# or bindableParts keys were removed. Returns 0 if OK (no removals or new shape).
# Usage: check_append_only <shape_id> <new_sidecar_json>
check_append_only() {
    local shape_id="$1"
    local new_sidecar="$2"

    # Fetch existing sidecar from DB
    local existing
    existing=$($DOCKER_PSQL -t -A -c \
        "SELECT metadata->'sidecar' FROM design_objects \
         WHERE metadata->>'shape_id' = '$shape_id' \
           AND type IN ('shape','shape_part') \
           AND metadata->>'source' = 'library' \
         LIMIT 1;" 2>/dev/null | tr -d '[:space:]')

    # New shape — no prior IDs to protect
    if [[ -z "$existing" || "$existing" == "null" || "$existing" == "" ]]; then
        return 0
    fi

    local removals=""

    # Check addon IDs
    while IFS= read -r old_id; do
        [[ -z "$old_id" ]] && continue
        if ! echo "$new_sidecar" | jq -r '[.addons[]?.id // empty] | .[]' 2>/dev/null \
            | grep -qxF "$old_id"; then
            removals+="  REMOVED addon ID: $old_id\n"
        fi
    done < <(echo "$existing" | jq -r '[.addons[]?.id // empty] | .[]' 2>/dev/null)

    # Check connection IDs
    while IFS= read -r old_id; do
        [[ -z "$old_id" ]] && continue
        if ! echo "$new_sidecar" | jq -r '[.connections[]?.id // empty] | .[]' 2>/dev/null \
            | grep -qxF "$old_id"; then
            removals+="  REMOVED connection ID: $old_id\n"
        fi
    done < <(echo "$existing" | jq -r '[.connections[]?.id // empty] | .[]' 2>/dev/null)

    # Check bindableParts partIds
    while IFS= read -r old_id; do
        [[ -z "$old_id" ]] && continue
        if ! echo "$new_sidecar" | jq -r '[.bindableParts[]?.partId // empty] | .[]' 2>/dev/null \
            | grep -qxF "$old_id"; then
            removals+="  REMOVED bindablePart: $old_id\n"
        fi
    done < <(echo "$existing" | jq -r '[.bindableParts[]?.partId // empty] | .[]' 2>/dev/null)

    if [[ -n "$removals" ]]; then
        echo "ERROR: Append-only violation in '$shape_id':"
        echo -e "$removals"
        return 1
    fi

    return 0
}
```

### Step 3 — Wire the check into the import loop

In the `shapes_import()` function, find the loop that processes each shape. After `sidecar`
is populated but before the `$DOCKER_PSQL` INSERT/UPDATE call, add:

```bash
# Append-only enforcement for library shapes
if [[ "$force" != "true" ]]; then
    if ! check_append_only "$shape_id" "$sidecar"; then
        echo "  BLOCKED: $shape_id"
        echo "  Use './dev.sh shapes import --force' to override (breaks existing graphics)"
        (( skipped++ )) || true
        continue
    fi
fi
```

### Step 4 — Update `case` statement to pass arguments

Find where `import)` is handled in the `case` statement (around line 501 or wherever the
`shapes` subcommand is dispatched). Change:

```bash
import)  shapes_import ;;
```
to:
```bash
import)  shapes_import "$@" ;;
```

Or if there is already argument passing, verify `--force` is forwarded correctly.

### Step 5 — Update usage/help text

Find the usage/help block for the `shapes` command in `dev.sh`. Update the `import` entry:

```
shapes import [--force]   Import shapes-source/ files into DB.
                          Blocks removal of addon IDs, connection IDs, or
                          bindableParts keys (use --force to override).
```

### Step 6 — Document forPart matching in sidecar spec

Open `design-docs/shape-sidecar-spec/shape-sidecar-spec.md`. Find the section on
`compositeAttachments` (or add one if it doesn't exist). Add:

```markdown
### compositeAttachments — forPart Matching Semantics

The `forPart` string determines which addon a given attachment point applies to.
The runtime (`renderNodeSvg.tsx`) uses this algorithm:

1. **Exact ID match (first):** Check if `forPart` matches any addon's `id` field exactly.
   Example: `forPart: "fail-open"` matches `addons[].id == "fail-open"`.

2. **Group name fallback:** If no ID match, check if `forPart` matches any addon's `group`
   field. Example: `forPart: "agitator"` matches any addon where `group == "agitator"`.

**Rule:** Never use the same string as both an addon `id` on one shape and a `group` name
on a different shape — ID-first matching would shadow the group-based match.

**Examples:**
- `forPart: "actuator"` (group match) — positions the actuator for any actuator-group addon
- `forPart: "fail-open"` (ID match) — positions the fail-open indicator specifically
- `forPart: "agitator"` (group match) — positions agitator parts for any agitator-group addon
- `forPart: "support"` (group match) — positions support legs/skirt for any support-group addon
```

---

## Cargo.toml / Package Changes

None.

---

## DB / Migration Changes

None.

---

## Verification

```bash
cd /home/io/io-dev/io

# 1. Normal import succeeds (no removals in current shape files)
./dev.sh shapes import

# 2. Test append-only detection
# Temporarily remove one addon from a shape:
jq 'del(.addons[0])' frontend/shapes-source/reactors/reactor-base.json > /tmp/test-sidecar.json
cp frontend/shapes-source/reactors/reactor-base.json /tmp/reactor-base-backup.json
cp /tmp/test-sidecar.json frontend/shapes-source/reactors/reactor-base.json

./dev.sh shapes import
# Expected: "ERROR: Append-only violation in 'reactor-base': REMOVED addon ID: <id>"
# Expected: "BLOCKED: reactor-base"

# 3. Force override works
./dev.sh shapes import --force
# Expected: "WARNING: --force mode" + import succeeds

# 4. Restore original file
cp /tmp/reactor-base-backup.json frontend/shapes-source/reactors/reactor-base.json
./dev.sh shapes import  # should succeed cleanly

# 5. New shape (not in DB) imports without append-only error
# (New shapes have no prior IDs to protect)

# 6. Verify sidecar spec was updated
grep -q "forPart Matching" design-docs/shape-sidecar-spec/shape-sidecar-spec.md && echo "OK"

# 7. Frontend build (no Rust changes in this phase)
cd frontend && pnpm build
```

---

## Definition of Done

- [ ] `shapes_import()` accepts `--force` flag
- [ ] Without `--force`: removed addon IDs block the import with a clear error
- [ ] Without `--force`: removed connection IDs block the import with a clear error
- [ ] Without `--force`: removed bindableParts keys block the import with a clear error
- [ ] With `--force`: all removals are allowed with a warning printed
- [ ] New shapes (not yet in DB) import without append-only checks
- [ ] Error messages list specifically which IDs were removed
- [ ] Usage/help text updated for `shapes import`
- [ ] `forPart` matching semantics documented in `shape-sidecar-spec.md`
- [ ] Normal import (no removals) still succeeds
- [ ] `pnpm build` succeeds
