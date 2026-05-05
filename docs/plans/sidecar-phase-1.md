Implement Phase 1 of the sidecar architecture plan. Read this file completely before writing any code.

---

## Context

The JSON schema file `io-shape-v1.schema.json` was written before several sidecar features
were implemented. Production sidecar JSON files now contain fields the schema does not
declare: `compositeAttachments`, `vesselInteriorPath`, `geometry.selectionBounds`,
`geometry.bodyBase`, and `"actuator"` in the `connections[].type` enum. Validating against
the current schema would reject most complex shapes. This phase fixes the schema to match
reality. No Rust code changes. No DB changes. Just the JSON schema file.

This phase must be completed before Phase 3 (validation on write).

---

## Key Files

- **MODIFY:** `frontend/shapes-source/_schema/io-shape-v1.schema.json`
- **READ (reference — do not modify):**
  - `frontend/shapes-source/vessels/vessel-vertical-flanged-both.json` — has `compositeAttachments`, `vesselInteriorPath`, `geometry.selectionBounds`
  - `frontend/shapes-source/reactors/reactor-flat-top.json` — has `compositeAttachments`
  - `frontend/shapes-source/actuators/part-actuator-diaphragm.json` — has `geometry.bodyBase`, `connections[].type = "actuator"`
  - `frontend/shapes-source/valves/valve-butterfly.json` — has `compositeAttachments[].stemFrom`
  - `frontend/shapes-source/agitators/agitator-turbine.json` — has `geometry.bodyBase`, `isPart`, `partClass`

---

## Implementation Steps

**Read the full schema file first** to understand its current structure before making changes.

### Step 1 — Add `"actuator"` to `connections[].type` enum

Find the `connections` items definition. The `type` property has:
```json
"enum": ["process", "signal", "mechanical", "electrical"]
```
Change to:
```json
"enum": ["process", "signal", "mechanical", "electrical", "actuator"]
```

### Step 2 — Add `selectionBounds` to `geometry.properties`

Inside the `geometry` object's `properties`, add after the existing dimension fields:
```json
"selectionBounds": {
  "type": "object",
  "description": "Tight bounding box for selection highlighting (excludes protruding nozzles/stems)",
  "required": ["x", "y", "w", "h"],
  "properties": {
    "x": { "type": "number" },
    "y": { "type": "number" },
    "w": { "type": "number" },
    "h": { "type": "number" }
  }
}
```

### Step 3 — Add `bodyBase` to `geometry.properties`

Inside the `geometry` object's `properties`, add after `selectionBounds`:
```json
"bodyBase": {
  "type": "object",
  "description": "Alignment anchor for composite attachment rendering: px = attachment.x - bodyBase.x",
  "required": ["x", "y"],
  "properties": {
    "x": { "type": "number" },
    "y": { "type": "number" }
  }
}
```

### Step 4 — Add `vesselInteriorPath` as a top-level optional property

At the top level of the schema's `properties` object (same level as `connections`, `states`, `addons`), add:
```json
"vesselInteriorPath": {
  "type": "string",
  "description": "SVG path data defining the vessel interior boundary for fill gauge clipping"
}
```

### Step 5 — Add `compositeAttachments` as a top-level optional property

At the top level of the schema's `properties` object, add:
```json
"compositeAttachments": {
  "type": "array",
  "description": "Coordinates where composable part addons attach to this shape",
  "items": {
    "type": "object",
    "required": ["forPart", "x", "y"],
    "properties": {
      "forPart": {
        "type": "string",
        "description": "Matches addon id (exact) first, then addon group (fallback). See sidecar spec for matching semantics."
      },
      "x": { "type": "number" },
      "y": { "type": "number" },
      "stemFrom": {
        "type": "object",
        "description": "Optional origin point for the actuator stem line on valve shapes",
        "required": ["x", "y"],
        "properties": {
          "x": { "type": "number" },
          "y": { "type": "number" }
        }
      }
    }
  }
}
```

### Step 6 — Verify no other TS-type fields are missing

Cross-check TypeScript types in `frontend/src/shared/types/graphics.ts` (ShapeSidecar and related interfaces) against the schema. Confirm that `isPart`, `partClass`, `addons`, `anchorSlots`, `defaultSlots`, `bindableParts` are all already in the schema. Add any missing ones.

---

## Verification

```bash
# 1. Schema is valid JSON
cd /home/io/io-dev/io
python3 -c "import json; json.load(open('frontend/shapes-source/_schema/io-shape-v1.schema.json')); print('OK')"

# 2. Check all sidecar files for required-field coverage
python3 -c "
import json, glob, sys
schema = json.load(open('frontend/shapes-source/_schema/io-shape-v1.schema.json'))
required = schema.get('required', [])
errors = 0
files = sorted(glob.glob('frontend/shapes-source/*/*.json'))
files = [f for f in files if '/_schema/' not in f and not f.endswith('index.json')]
for f in files:
    try:
        data = json.load(open(f))
        for req in required:
            if req not in data:
                print(f'MISSING {req} in {f}')
                errors += 1
    except Exception as e:
        print(f'ERROR {f}: {e}')
        errors += 1
print(f'Checked {len(files)} files, {errors} errors')
sys.exit(1 if errors else 0)
"

# 3. Frontend builds
cd frontend && pnpm build

# 4. Backend builds (build.rs reads shapes-source)
cd /home/io/io-dev/io && BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p api-gateway
```

---

## Definition of Done

- [ ] `compositeAttachments` array added with `forPart`, `x`, `y`, `stemFrom?` items
- [ ] `vesselInteriorPath` string property added
- [ ] `geometry.selectionBounds` `{x, y, w, h}` added
- [ ] `geometry.bodyBase` `{x, y}` added
- [ ] `"actuator"` added to `connections[].type` enum
- [ ] Schema is valid JSON (python3 parse succeeds)
- [ ] All sidecar JSON files pass required-field check (0 errors)
- [ ] `pnpm build` succeeds
- [ ] `cargo build -p api-gateway` succeeds
