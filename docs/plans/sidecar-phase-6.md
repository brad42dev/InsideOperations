Implement Phase 6 of the sidecar architecture plan. Read this file completely before writing any code.

---

## Context

Reactor and vessel shapes have `compositeAttachments` with placeholder `{x:0, y:0}`
coordinates. Agitator and support part shapes have placeholder `bodyBase: {x:0, y:0}`.
The renderer computes part placement as:

    px = compositeAttachment.x - partShape.geometry.bodyBase.x
    py = compositeAttachment.y - partShape.geometry.bodyBase.y

Both values must be correct for parts to render in the right position. These two fixes
must be done together — fixing attachment coords without fixing bodyBase (or vice versa)
produces wrong rendering.

This phase requires **visually inspecting SVG files** to determine correct coordinates.
Many values cannot be confirmed without viewing the SVG geometry in a browser or SVG viewer.

Depends on: Phase 1 (schema fix) must be complete. Phases 2–5 are not required.

---

## How the coordinate system works

Given:
- Base shape (e.g., reactor) has viewBox "0 0 40 80"
- `compositeAttachment.x = 20, y = 10` means the part should land at (20, 10) in the base shape's coordinate space
- Part shape (e.g., agitator) has `bodyBase.x = 20, bodyBase.y = 0`
- Renderer places the part's SVG so that its bodyBase point is at the attachment point

So for an agitator that hangs from the top of a reactor:
- Reactor `compositeAttachment` for agitator: `{x: <vessel_center_x>, y: <top_of_vessel_body>}`
- Agitator `bodyBase`: `{x: <agitator_shaft_center_x>, y: <agitator_shaft_top_y>}`

---

## Key Files

### Base shapes needing `compositeAttachment` coordinate fixes

All have placeholder `{x:0, y:0}` for agitator and/or support:
- `frontend/shapes-source/reactors/reactor-base.json`
- `frontend/shapes-source/reactors/reactor-closed.json`
- `frontend/shapes-source/reactors/reactor-trayed.json`
- `frontend/shapes-source/reactors/reactor-flat-top.json`
- `frontend/shapes-source/vessels/vessel-vertical-flanged-both.json`
- `frontend/shapes-source/vessels/vessel-vertical-flanged-top.json`
- `frontend/shapes-source/vessels/vessel-vertical-flanged-bottom.json`
- `frontend/shapes-source/vessels/vessel-vertical-welded.json`
- `frontend/shapes-source/vessels/vessel-horizontal-*.json` (all horizontal variants)

Columns in `frontend/shapes-source/columns/` may already have non-zero support coords —
verify correctness but do not assume they are wrong.

### Part shapes needing `bodyBase` verification

All confirmed or likely placeholder:
- `frontend/shapes-source/agitators/agitator-turbine.json`
- `frontend/shapes-source/agitators/agitator-propeller.json`
- `frontend/shapes-source/agitators/agitator-anchor.json`
- `frontend/shapes-source/agitators/agitator-paddle.json`
- `frontend/shapes-source/agitators/agitator-helical.json`
- `frontend/shapes-source/supports/support-skirt.json`
- `frontend/shapes-source/supports/support-legs-3.json`
- `frontend/shapes-source/supports/support-legs-4.json`
- `frontend/shapes-source/supports/support-legs-splayed.json`
- `frontend/shapes-source/supports/support-saddles.json`
- `frontend/shapes-source/actuators/part-actuator-diaphragm.json` — has `{x:15, y:20}`, verify
- `frontend/shapes-source/actuators/part-actuator-motor.json`
- `frontend/shapes-source/actuators/part-actuator-solenoid.json`
- `frontend/shapes-source/indicators/part-fail-open.json`
- `frontend/shapes-source/indicators/part-fail-closed.json`
- `frontend/shapes-source/indicators/part-fail-last.json`

---

## Implementation Steps

### Step 1 — Read all affected JSON files

Read every JSON file listed above. For each, note:
- The `viewBox` from the corresponding `.svg` file (or from `geometry.viewBox` in the JSON)
- Current `compositeAttachments` coordinates (base shapes)
- Current `geometry.bodyBase` coordinates (part shapes)

### Step 2 — Open SVG files visually and determine correct coordinates

**NEEDS VISUAL INSPECTION for every shape.** Open each SVG in a browser or SVG viewer:

```bash
# Quick way to preview in a browser (open from repo root)
xdg-open frontend/shapes-source/reactors/reactor-base.svg
```

For each **base shape**, find:
- The x,y where the agitator shaft enters the vessel (top center of the vessel body, just below the dome/head)
- The x,y where supports connect to the vessel (bottom center of the vessel body, just above the skirt/legs)

For each **part shape**, find:
- The x,y of the alignment anchor point (where the part connects to the parent)
  - Agitators: top of the shaft (the point that enters the vessel top)
  - Supports: top of the support (the point that attaches to the vessel bottom)
  - Actuators: bottom of the actuator (the stem connection to the valve bonnet)
  - Fail indicators: center of the indicator body base

### Step 3 — Update reactor compositeAttachments

For each reactor JSON, update `compositeAttachments` with the correct coordinates.
Pattern (fill in actual values from visual inspection):

```json
"compositeAttachments": [
  {
    "forPart": "agitator",
    "x": <vessel_center_x>,
    "y": <top_of_vessel_interior>
  },
  {
    "forPart": "support",
    "x": <vessel_center_x>,
    "y": <bottom_of_vessel_body>
  }
]
```

### Step 4 — Update vessel compositeAttachments

For vertical vessels (support only at bottom):
```json
"compositeAttachments": [
  {
    "forPart": "support",
    "x": <vessel_center_x>,
    "y": <bottom_of_vessel_body>
  }
]
```

For horizontal vessels (support at bottom center — the vessel's bottom tangent line):
- Identify the lowest point of the vessel body in SVG coordinates
- The support center x is the horizontal center of the vessel

### Step 5 — Update agitator bodyBase values

For each agitator, set `geometry.bodyBase` to the top of the shaft:
```json
"geometry": {
  "viewBox": "0 0 40 80",
  "bodyBase": { "x": <shaft_center_x>, "y": <shaft_top_y> }
}
```

### Step 6 — Update support bodyBase values

For each support, set `geometry.bodyBase` to the top connection point:
```json
"geometry": {
  "viewBox": "0 0 40 86",
  "bodyBase": { "x": <support_center_x>, "y": <support_top_y> }
}
```

### Step 7 — Update actuator bodyBase values

For each actuator, verify or set `geometry.bodyBase` to the stem connection point (bottom
of the actuator body, where the stem meets the valve bonnet). The diaphragm actuator has
`{x:15, y:20}` — check if this is the bonnet connection point by visual inspection.

### Step 8 — Update fail indicator bodyBase values

For fail indicator parts, set `geometry.bodyBase` to the base center point.

### Step 9 — Import to DB and verify visually

```bash
cd /home/io/io-dev/io
./dev.sh shapes import
```

Then open the Designer, place a reactor, enable the agitator addon and a support addon,
and verify the parts render in the correct positions.

---

## Cargo.toml / Package Changes

None.

---

## DB / Migration Changes

None. Changes are pushed via `./dev.sh shapes import`.

---

## Verification

```bash
cd /home/io/io-dev/io

# 1. Validate JSON files
find frontend/shapes-source -name "*.json" \
  ! -path "*/_schema/*" ! -name "index.json" \
  -exec python3 -c "import json,sys; json.load(open(sys.argv[1])); print('OK:', sys.argv[1])" {} \; \
  | grep -v "^OK:" || true

# 2. Import shapes
./dev.sh shapes import

# 3. Build (build.rs re-embeds updated shapes)
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p api-gateway

# 4. Frontend build
cd frontend && pnpm build

# 5. VISUAL VERIFICATION (required)
# Start dev server: cd frontend && pnpm dev
# Open Designer, place a reactor
# Enable agitator addon → verify agitator appears at top center of vessel
# Enable support addon → verify support appears at bottom of vessel
# Place a valve → enable actuator → verify actuator aligns with valve stem
```

---

## Definition of Done

- [ ] All reactor `compositeAttachments` have non-zero, visually-verified coordinates
- [ ] All vertical vessel support `compositeAttachments` have correct bottom coordinates
- [ ] All horizontal vessel support `compositeAttachments` have correct bottom-center coordinates
- [ ] All agitator `bodyBase` values are correct (shaft entry point)
- [ ] All support `bodyBase` values are correct (vessel connection point)
- [ ] All actuator `bodyBase` values verified correct (stem connection point)
- [ ] All fail indicator `bodyBase` values verified correct
- [ ] All JSON files parse without error
- [ ] `./dev.sh shapes import` succeeds
- [ ] `cargo build -p api-gateway` succeeds
- [ ] VISUAL: reactor + agitator addon renders at top center of vessel
- [ ] VISUAL: reactor + support addon renders at bottom of vessel
- [ ] VISUAL: valve + actuator renders with stem correctly aligned
