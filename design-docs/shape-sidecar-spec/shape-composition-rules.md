# Shape Composition Rules

Authoritative rules for how composable parts attach to base shapes. These rules are derived from and must match the canonical geometry in `*-shape-library-preview.html`. When the previews and this document disagree, fix this document.

All coordinates reference the SVG coordinate system used in the canonical preview files. Colors are always `#808080` (ISA-101 equipment stroke, theme-independent). Stroke widths: `1.5` for primary lines, `0.75` for foot/base lines.

---

## 1. Valve Actuators

### Coordinate system

All valve base shapes share a common coordinate space:

- Valve body viewBox: `0 0 48 24` — pipe centerline at `y=12`, pipe walls at `y=0` and `y=24`
- Valve + actuator combos extend above: viewBox `0 -30 48 54` (30 units headroom)
- Actuator base sits at `y=−2`; the space from `y=−2` upward belongs to the actuator

### Stem attachment point by valve type

The stem is a vertical line from the valve body to the actuator base (`y=−2`). The `y1` start point differs per valve type because each has a different physical exit geometry.

| Valve type | Stem `x1` | Stem `y1` | Stem `y2` | Reason |
|---|---|---|---|---|
| Gate | 24 | 12 | −2 | Bowtie apex — the two triangles meet at the center point (24,12); stem exits the bonnet there |
| Globe | 24 | 12 | −2 | Same bowtie geometry as gate; center dot marks the plug/seat but does not change the exit point |
| Ball | 24 | 6 | −2 | Top of ball circle (`cy=12`, `r=6`, so top = `cy−r = 6`); stem exits the ball housing at its topmost surface, not its center |
| Butterfly | 30 | 12 | −2 | Disc center — the shaft runs through the midpoint of the disc at `y=12`; butterfly uses `cx=30` not `cx=24` because the body is 60 units wide |

**Why ball is different from gate/globe:** Gate and globe bowties have their apex at the valve center. That apex IS the stem exit point — there is no surface above it. A ball valve has a cylindrical body with a discrete top surface. The stem physically exits from the top of the ball housing, not its rotational center.

**Why butterfly connects at y=12 not y=0:** The pipe walls run `y=0` to `y=24`. The disc shaft runs through the center at `y=12`. Connecting at `y=0` (top of pipe wall) creates a visually disconnected stem that hovers above the disc.

### Actuator body geometry (standalone, viewBox `0 0 30 30`)

| Actuator | Body | Stem stub |
|---|---|---|
| Pneumatic | `M5,20 A10,10 0,0,1 25,20 Z` (dome, base at y=20) | `x1=15 y1=20 x2=15 y2=28` |
| Electric | `rect x=7 y=7 w=16 h=16` + "E" label | `x1=15 y1=23 x2=15 y2=28` |
| Hydraulic | `rect x=7 y=5 w=16 h=18` + "H" label | `x1=15 y1=23 x2=15 y2=28` |
| Handwheel | `circle cx=15 cy=16 r=9` + crosshairs | `x1=15 y1=25 x2=15 y2=28` (bottom of circle to stub bottom) |

When composed with a valve, actuator positions in the combo viewBox (`0 -30 48 54`):

| Actuator | Body position in combo |
|---|---|
| Pneumatic | Dome `M14,−2 A10,10 0,0,1 34,−2 Z` |
| Electric | `rect x=18 y=−18 w=12 h=16` |
| Hydraulic | `rect x=17 y=−20 w=14 h=18` |
| Handwheel | `circle cx=24 cy=−11 r=9` + crosshairs; bottom of circle at `y=−2` |

### Butterfly valve specifics

Butterfly body (viewBox `0 -30 60 54`, `cx=30`):
- Two pipe walls: `x1=7 y1=0 x2=7 y2=24` and `x1=53 y1=0 x2=53 y2=24`
- Disc: diagonal `x1=10 y1=4 x2=50 y2=20` (stroke-width `2`)
- Actuator bodies shift to `cx=30`: pneumatic dome `M20,−2 A10,10 0,0,1 40,−2 Z`; electric `rect x=24`; hydraulic `rect x=23`; handwheel `cx=30 cy=−11`

---

## 2. Fail Indicators

### Direction convention

Arrow direction indicates the valve's fail-safe position (what it does when actuator power/air is lost):

| Indicator | Arrow direction | Meaning |
|---|---|---|
| **FO** (Fail Open) | Pointing **UP** | Valve opens on failure — spring/default drives it open |
| **FC** (Fail Close) | Pointing **DOWN** | Valve closes on failure — spring/default drives it closed |

**Orientation note:** These directions assume an upward-facing actuator stem (standard vertical valve on a horizontal pipe). For a valve in a non-standard orientation, rotate the indicator 90° accordingly.

### Standalone indicator geometry (viewBox `0 0 20 34`)

Both indicators use a hollow arrow polygon + label below.

```
FO (up):  polygon points="10,2 5,10 8,10 8,22 12,22 12,10 15,10"
FC (down): polygon points="10,22 5,12 8,12 8,2 12,2 12,12 15,12"
Label: text x=10 y=30, font-size=7, text-anchor=middle
```

Arrow proportions: 8-unit head (arrowhead), 12-unit shaft, 7-unit label clearance below shaft bottom.

### Placement on control valve (viewBox `0 -12 48 60` for FO, `0 0 48 60` for FC)

Control valve body sits with bowtie junction at `(24,32)`, dome base at `y=18`, dome top at `y=8`.

- **FO:** Arrow sits above dome. Shaft bottom at `y=4` (4-unit gap above dome top `y=8`). Arrow tip at `y=−8`. Label at `x=36 y=−2` (right of arrow). ViewBox must extend to `y=−12` to contain tip.
  ```
  polygon points="24,-8 19,0 22,0 22,4 26,4 26,0 29,0"
  ```
- **FC:** Arrow sits below valve bottom (`y=44`). Shaft top at `y=44`, tip at `y=56`. Label at `x=36 y=53`.
  ```
  polygon points="24,56 19,48 22,48 22,44 26,44 26,48 29,48"
  ```

---

## 3. Reactor Agitators

### Reactor vessel coordinate system

Standard reactor base (viewBox `0 0 40 80`):
- Body: `x=10` to `x=30`, top ellipse `y=12`, bottom at `y=68`
- Interior width: 20 units (`x=10` to `x=30`)
- Agitator shaft enters from above the top ellipse

### Agitator shaft attachment

All agitators share the same drive coupling at the top of the shaft:

- **Drive coupling:** `circle cx=20 cy=5 r=3` (small circle above the top ellipse, centered on vessel)
- **Shaft start:** `y=7` (bottom of drive coupling circle)
- Shaft runs down the vessel centerline (`x=20`) to the impeller depth

### Agitator geometry by type

| Type | Shaft bottom | Impeller description | SVG |
|---|---|---|---|
| Turbine | y=45 | Two horizontal spurs + downward tines at y=42/48 | `line y1=7 y2=45`; spurs `x=13→20` and `x=20→27` at y=42; tines at x=13,27 from y=42 to y=48 |
| Propeller | y=48 | 4 angled spokes meeting at y=45 | `line y1=7 y2=48`; spokes: `(13,41)→(20,45)`, `(27,41)→(20,45)`, `(13,49)→(20,45)`, `(27,49)→(20,45)` |
| Anchor | y=30 | U-shape frame following vessel walls | Shaft to y=30; horizontal at y=30 `x=14→26`; verticals `x=14,26` to y=64; horizontal at y=64 `x=14→26` |
| Paddle | y=48 | Single horizontal bar at y=45 | `line y1=7 y2=48`; bar `x1=13 y1=45 x2=27 y2=45` |
| Helical | y=65 | Zigzag ribbon from y=25 to y=60 | `line y1=7 y2=65`; polyline `14,25 26,32 14,39 26,46 14,53 26,60` |

**Anchor note:** The anchor impeller is sized to the vessel — inner arms at `x=14` and `x=26` clear the `x=10`/`x=30` walls by 4 units. When the vessel has a closed bottom ellipse, trim the bottom bar clearance accordingly (e.g., closed bottom at y=68 curve, bottom bar at y=62 not y=64).

---

## 4. Reactor Supports

### Attachment point

All reactor supports attach at the vessel bottom edge: `y=68`, `x=10` (left wall) and `x=30` (right wall).

### Support geometry

**Skirt** (viewBox `0 0 40 86`):
- Two short drops: `(10,68)→(10,74)` and `(30,68)→(30,74)`
- Flare: horizontal `x=5→35` at `y=74`
- Skirt walls: `(5,74)→(5,80)` and `(35,74)→(35,80)`
- Base plate: `x=3→37` at `y=80` (extends 2 units beyond skirt walls)

**3 Splayed Legs** (viewBox `0 0 40 86`):
- Left leg: `(12,68)→(7,82)`, foot `x=4→10` at `y=82`
- Center leg: `(20,68)→(20,82)` (straight), foot `x=17→23` at `y=82`
- Right leg: `(28,68)→(33,82)`, foot `x=30→36` at `y=82`
- Leg length: 14 units vertical

**4 Straight Legs** (viewBox `0 0 40 86`):
- Legs at x=12, 18, 22, 28 — all straight vertical from `y=68` to `y=82`
- Base plate: `x=8→32` at `y=82` (continuous, spans all 4 legs)
- Leg spacing: inner pair at x=18/22 (4-unit gap), outer pair at x=12/28

---

## 5. Sphere & Capsule Supports

### Sphere surface geometry

When attaching supports to a sphere, the attachment point must lie on the sphere surface. The y-coordinate of the surface at a given x is:

```
y = cy + √(r² − (x − cx)²)
```

Use this formula to compute the leg/saddle top position at the chosen x-coordinate. Do not estimate — a gap between the support and sphere surface is always visible.

### Sphere + Splayed Legs (section 17 standalone — cx=35, cy=26, r=22)

Reference shape for splayed leg proportions:
- Attachment at `x=19` and `x=51` (cx ± 16)
- Surface y: `26 + √(484 − 256) = 26 + 15.1 ≈ 41`
- Left leg: `(19,41)→(14,60)`, foot `x=10→18` at `y=60`
- Right leg: `(51,41)→(56,60)`, foot `x=52→60` at `y=60`
- Leg length: 19 units vertical; foot extends 12 units below sphere bottom (`y=48`)
- Foot stroke-width: `0.75` (thinner than leg)

### Sphere + Splayed Legs (section G combined — cx=35, cy=28, r=22)

Same x offsets as section 17; cy shifted down 2 units:
- Attachment at `x=19` and `x=51`
- Surface y: `28 + √(484 − 256) ≈ 43`
- Left leg: `(19,43)→(14,62)`, foot `x=10→18` at `y=62`
- Right leg: `(51,43)→(56,62)`, foot `x=52→60` at `y=62`
- ViewBox: `0 0 70 68`

### Sphere + Saddles (section G — cx=35, cy=22, r=22)

Saddle tops computed from sphere surface formula:

Left saddle (outer leg `x=20`, inner leg `x=24`):
- `x=20`: `y = 22 + √(484 − 225) ≈ 38`
- `x=24`: `y = 22 + √(484 − 121) ≈ 41`
- Lines: `(20,38)→(17,54)` (outer), `(24,41)→(24,54)` (inner), foot `x=17→24` at `y=54`

Right saddle (inner leg `x=46`, outer leg `x=50`) — mirror of left:
- `x=46`: `y ≈ 41`, line `(46,41)→(46,54)`
- `x=50`: `y ≈ 38`, line `(50,38)→(53,54)`
- Foot `x=46→53` at `y=54`

ViewBox: `0 -3 70 71` (3-unit negative y clearance for sphere top at `cy=22, r=22, top=y=0`)

### Capsule + Splayed Legs (section G — body x=12→68, y=16→36, arcs r=10)

Capsule has a flat bottom edge at `y=36`. Legs attach to this flat bottom, no surface formula needed:
- Attachment at `x=25` (left) and `x=55` (right)
- Left leg: `(25,36)→(14,54)`, foot `x=10→18` at `y=54`
- Right leg: `(55,36)→(66,54)`, foot `x=62→70` at `y=54`
- Leg length: 18 units vertical
- ViewBox: `0 0 80 60`

**Capsule body constraint:** Body runs from `x=12` to `x=68` (not `x=8` to `x=72`) so the r=10 semicircle arcs (`x=2` and `x=78`) stay within the viewBox. Leg attachment positions must account for this inset.

### Capsule + Saddles (section G — body x=20→60, y=14→38, arcs r=12)

Saddle tops sit at the bottom corners of the capsule body `y=38`:
- Left saddle: `(20,38)→(17,48)` (outer), `(24,38)→(24,48)` (inner), foot `x=17→24` at `y=48`
- Right saddle: `(60,38)→(63,48)` (outer), `(56,38)→(56,48)` (inner), foot `x=56→63` at `y=48`
- ViewBox: `0 0 80 68`

---

## 6. Composition ID Convention

Composed shape IDs concatenate base and part IDs with `+`:

```
{base-id}+{part-id}
{base-id}+{part-id}+{part-id}   ← agitator + support
```

Examples:
- `valve-gate+actuator-pneumatic`
- `valve-ball+actuator-handwheel`
- `valve-control+fail-open`
- `reactor-flat-top+agitator-turbine+support-skirt`
- `tank-storage-sphere+support-legs-splayed`
- `tank-storage-capsule+support-saddles`

Order: base → agitator → support. Fail indicators are suffixed directly to control valve ID.

---

## Change Log

v0.1 — Initial spec, derived from canonical `*-shape-library-preview.html` geometry after preview refinement session. Covers valve actuators, fail indicators, agitators, reactor supports, sphere/capsule supports.
