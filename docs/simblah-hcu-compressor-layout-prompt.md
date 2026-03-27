# SimBLAH Scene Graph Prompt — HCU Recycle Gas Compressor

## Task

Generate a new console graphic scene graph JSON for the **HCU Recycle Gas Compressor** display
(Unit 25, K-2501 / K-2502 recycle gas compressors). The JSON output is the `bindings` field stored
in our `design_objects` table — it is the full `GraphicDocument` object, not an iographic archive.

Return **only the JSON** — no explanation, no markdown fences. The JSON will be imported directly.

---

## Canvas

```
width:  1280 px
height:   720 px     ← fit EVERYTHING in this; do not overflow; no 1920×1080 scaling
backgroundColor: "#09090B"
autoHeight: false
```

Coordinate system: **top-left origin**, y increases downward, units are pixels.

---

## Layers (fixed — use these IDs)

```json
[
  { "id": "background", "name": "Background", "visible": true, "locked": true,  "order": 0 },
  { "id": "equipment",  "name": "Equipment",  "visible": true, "locked": false, "order": 1 },
  { "id": "instruments","name": "Instruments","visible": true, "locked": false, "order": 2 },
  { "id": "labels",     "name": "Labels",     "visible": true, "locked": false, "order": 3 }
]
```

---

## JSON Structure

Every child node must conform to `SceneNodeBase`:

```
{
  "id":        string  (kebab-case, unique),
  "type":      one of: "symbol_instance" | "pipe" | "display_element" | "text_block" | "primitive",
  "name":      string  (human label, optional),
  "layerId":   "background" | "equipment" | "instruments" | "labels",
  "visible":   true,
  "locked":    false,
  "opacity":   1,
  "transform": {
    "position": { "x": number, "y": number },
    "rotation": 0,
    "scale":    { "x": 1, "y": 1 },
    "mirror":   "none"
  }
}
```

---

## Shape Library — Equipment Symbols

Place equipment using `symbol_instance` nodes. The **position** is the top-left corner of the
shape's bounding box at the given scale. All shapes render as dark-themed SVG outlines.

Use `layerId: "equipment"`.

### Native dimensions (at scale 1.0):

| shape_id                  | width | height | key connections (x,y at scale 1.0)                                      |
|---------------------------|-------|--------|-------------------------------------------------------------------------|
| `compressor`              | 50    | 50     | suction: (5,25) left; discharge: (45,25) right                          |
| `vessel-vertical`         | 40    | 80     | inlet: (20,0) top; outlet: (20,80) bottom; drain: (20,80)               |
| `vessel-horizontal`       | 80    | 40     | inlet-left: (0,20) left; outlet-right: (80,20) right; top-nozzle: (40,0)|
| `column-distillation`     | 44    | 120    | feed: (0,60) left-mid; overhead-vapor: (22,0) top; bottoms: (22,120) bot|
| `valve-control`           | 48    | 44     | inlet: (0,22) left; outlet: (48,22) right; actuator: (24,0) top        |
| `pump-centrifugal`        | 48    | 48     | suction: (0,24) left; discharge: (48,24) right                          |
| `heat-exchanger-shell-tube`| 80   | 40     | shell-in: (0,20); shell-out: (80,20); tube-in: (40,0); tube-out: (40,40)|
| `heater-fired`            | 48    | 64     | inlet: (24,0) top; outlet-left: (0,32); outlet-right: (48,32)           |
| `air-cooler`              | 76    | 38     | inlet: (38,0) top; outlet: (38,38) bottom                               |
| `reactor`                 | 40    | 80     | inlet: (20,0) top; outlet: (20,80) bottom                               |

### symbol_instance schema:

```json
{
  "id": "compressor-k2501",
  "type": "symbol_instance",
  "layerId": "equipment",
  "visible": true, "locked": false, "opacity": 1,
  "transform": {
    "position": { "x": 420, "y": 310 },
    "rotation": 0,
    "scale":    { "x": 1.5, "y": 1.5 },
    "mirror":   "none"
  },
  "shapeRef": {
    "shapeId":   "compressor",
    "variant":   "opt1",
    "configuration": null
  },
  "composableParts": [],
  "stateBinding": null,
  "textZoneOverrides": {
    "tagname": { "staticText": "K-2501" }
  },
  "children": []
}
```

**Scale guidance:** A compressor at scale 1.5 → 75×75 px on screen. A tall column at scale 2.0 →
88×240 px. Scale equipment to look natural relative to the 1280×800 canvas — equipment symbols
should be readable but not huge; 60–100 px wide is typical.

---

## Pipe Routing

Use `pipe` nodes. Paths are SVG path strings (`M x y L x y` or multi-segment `M x y L x y L x y`).
Place on `layerId: "background"`.

### Service types → visual color (for your reference):

| serviceType        | color       | typical strokeWidth |
|--------------------|-------------|---------------------|
| `gas_vapor`        | blue-gray   | 2.0                 |
| `steam`            | light gray  | 1.5                 |
| `chemical`         | green       | 1.5  (amine lines)  |
| `liquid`           | dark blue   | 1.5                 |
| `cooling_water`    | cyan        | 1.5                 |
| `fuel_gas`         | orange      | 1.5                 |
| `instrument_air`   | purple      | 1.0                 |

### pipe schema:

```json
{
  "id": "pipe-rg-suction",
  "type": "pipe",
  "layerId": "background",
  "visible": true, "locked": false, "opacity": 1,
  "transform": { "position": { "x": 0, "y": 0 }, "rotation": 0, "scale": { "x": 1, "y": 1 }, "mirror": "none" },
  "serviceType": "gas_vapor",
  "pathData": "M 60 340 L 420 340",
  "strokeWidth": 2.0,
  "routingMode": "manual",
  "label": null,
  "insulated": false
}
```

Route pipes along equipment connection points. Use orthogonal routing (horizontal + vertical
segments, L-shaped bends) — avoid diagonal lines. Keep pipe paths clean and readable.

---

## Display Elements

All display elements go on `layerId: "instruments"`. Each one is bound to a point via its UUID.

### 1. `text_readout` — numeric value in a labeled box

Use for: pressures, temperatures, flows, speed, vibration, calculated values, quality analyzers.

```json
{
  "id": "de-pi2001",
  "type": "display_element",
  "layerId": "instruments",
  "visible": true, "locked": false, "opacity": 1,
  "transform": { "position": { "x": 520, "y": 290 }, "rotation": 0, "scale": { "x": 1, "y": 1 }, "mirror": "none" },
  "displayType": "text_readout",
  "binding": { "pointId": "UUID-GOES-HERE" },
  "config": {
    "displayType": "text_readout",
    "showBox":    true,
    "showLabel":  true,
    "labelText":  "25-PI-2001",
    "showUnits":  true,
    "valueFormat": "%.0f",
    "minWidth":   80,
    "showSignalLine": false
  }
}
```

`valueFormat` guidance:
- `%.0f`  → integer (pressures psig, rpm, large values)
- `%.1f`  → 1 decimal (flows MMSCFD, temperatures, %)
- `%.2f`  → 2 decimals (small flows gpm, analysis mol%)
- `%.4f`  → 4 decimals (vibration mils, axial displacement)

### 2. `analog_bar` — horizontal or vertical bar gauge

Use for: level %, efficiency %, surge margin %, other percentages and bounded ranges.

```json
{
  "id": "de-calc2002",
  "type": "display_element",
  "layerId": "instruments",
  "visible": true, "locked": false, "opacity": 1,
  "transform": { "position": { "x": 640, "y": 440 }, "rotation": 0, "scale": { "x": 1, "y": 1 }, "mirror": "none" },
  "displayType": "analog_bar",
  "binding": { "pointId": "UUID-GOES-HERE" },
  "config": {
    "displayType":    "analog_bar",
    "orientation":    "horizontal",
    "barWidth":       120,
    "barHeight":      16,
    "rangeLo":        0,
    "rangeHi":        100,
    "showZoneLabels": true,
    "showPointer":    true
  }
}
```

### 3. `digital_status` — state indicator (on/off/state)

Use for: valve open/close status, pump running/stopped (if we have a status point).

```json
{
  "id": "de-valve-status",
  "type": "display_element",
  "layerId": "instruments",
  "visible": true, "locked": false, "opacity": 1,
  "transform": { "position": { "x": 300, "y": 200 }, "rotation": 0, "scale": { "x": 1, "y": 1 }, "mirror": "none" },
  "displayType": "digital_status",
  "binding": { "pointId": "UUID-GOES-HERE" },
  "config": {
    "displayType":       "digital_status",
    "stateLabels":       { "0": "CLOSED", "1": "OPEN" },
    "normalStates":      ["1"],
    "abnormalPriority":  3
  }
}
```

---

## Text Labels

Use `text_block` nodes for equipment tag names, section headers, titles. Use `layerId: "labels"`.

```json
{
  "id": "label-k2501",
  "type": "text_block",
  "layerId": "labels",
  "visible": true, "locked": false, "opacity": 1,
  "transform": { "position": { "x": 420, "y": 390 }, "rotation": 0, "scale": { "x": 1, "y": 1 }, "mirror": "none" },
  "content":     "K-2501 Recycle Compressor",
  "fontFamily":  "Inter",
  "fontSize":    11,
  "fontWeight":  400,
  "fontStyle":   "normal",
  "textAnchor":  "middle",
  "fill":        "#A1A1AA"
}
```

Required labels:
- Screen title (top center): `"UNIT 25 — RECYCLE GAS SYSTEM / COMPRESSOR K-2501"`, fontSize 12, fill `#E5E5E5`
- Each equipment tag: fontSize 10, fill `#A1A1AA`
- Section headers for instrument groups (e.g. "COMPRESSOR K-2501", "TURBINE DRIVER", "VIBRATION"):
  fontSize 9, fill `#71717A`, fontWeight 600

---

## Section Divider Lines

Use `primitive` nodes with `geometry.type: "line"` to separate instrument groups.

```json
{
  "id": "divider-1",
  "type": "primitive",
  "layerId": "background",
  "visible": true, "locked": true, "opacity": 1,
  "transform": { "position": { "x": 0, "y": 0 }, "rotation": 0, "scale": { "x": 1, "y": 1 }, "mirror": "none" },
  "geometry": { "type": "line", "x1": 620, "y1": 45, "x2": 1270, "y2": 45 },
  "style": { "fill": "none", "stroke": "#3F3F46", "strokeWidth": 1 }
}
```

---

## Point Catalog (all 53 — use these exact UUIDs)

These are the display element bindings. Place each near the relevant equipment or in a logical
instrument panel. Choose the appropriate `displayType` for each.

### Gas Quality / Amine System (near C-2507 absorber)

| node-id suggestion      | tag              | units  | UUID                                   | recommended display  |
|-------------------------|------------------|--------|----------------------------------------|----------------------|
| de-ai1401               | 25-AI-1401       | mol%   | `4c9ef444-8b7a-4f3e-9c2d-1a5b6e7f8d9c` | text_readout %.1f — H2S in inlet gas |
| de-ai1402               | 25-AI-1402       | ppm    | `7e2f1a3b-9c4d-4e5f-8a1b-2c3d4e5f6a7b` | text_readout %.1f — H2S in treated gas (key quality indicator) |
| de-ai1403               | 25-AI-1403       | mol/mol| `8f3g2b4c-0d5e-5f6g-9b2c-3d4e5f6g7b8c` | text_readout %.4f — amine lean loading |
| de-fic1411-pv           | 25-FIC-1411.PV   | gpm    | `9a4h3c5d-1e6f-6g7h-0c3d-4e5f6g7h8c9d` | text_readout %.0f — lean amine flow (PV) |
| de-fic1411-sp           | 25-FIC-1411.SP   | gpm    | `0b5i4d6e-2f7g-7h8i-1d4e-5f6g7h8i9d0e` | text_readout %.0f — lean amine flow (SP) |
| de-fi1412               | 25-FI-1412       | gpm    | `1c6j5e7f-3g8h-8i9j-2e5f-6g7h8i9j0e1f` | text_readout %.0f — rich amine flow |
| de-li2020               | 25-LI-2020       | %      | `2d7k6f8g-4h9i-9j0k-3f6g-7h8i9j0k1f2g` | analog_bar vertical 0–100% — absorber sump level |
| de-lic1410-pv           | 25-LIC-1410.PV   | %      | `3e8l7g9h-5i0j-0k1l-4g7h-8i9j0k1l2g3h` | text_readout %.1f — lean amine surge drum level |
| de-ti1411               | 25-TI-1411       | degF   | `4f9m8h0i-6j1k-1l2m-5h8i-9j0k1l2m3h4i` | text_readout %.0f — lean amine inlet temp |
| de-ti1413               | 25-TI-1413       | degF   | `5g0n9i1j-7k2l-2m3n-6i9j-0k1l2m3n4i5j` | text_readout %.0f — lean amine outlet temp |

**NOTE:** The UUIDs above are illustrative placeholders. The real UUIDs are listed below in the
master table — use those exact values.

---

## MASTER POINT TABLE (use these exact UUIDs)

```
node-id            tag                 units      UUID                                      format   recommended type
de-ai1401          25-AI-1401          mol%       4c9ef444-5e8f-4f7d-9a57-0c154f8de5ba      %.1f     text_readout — H2S in feed gas
de-ai1402          25-AI-1402          ppm        0d35993d-b26d-454e-88ee-135916cd7dda      %.1f     text_readout — H2S in treated gas (key quality)
de-ai1403          25-AI-1403          mol/mol    5dcbb1de-1c11-4587-9ba6-6c99eb3130d3      %.4f     text_readout — amine lean loading
de-calc2001        25-CALC-2001        ft-lbf/lbm 88688b4c-2ba5-4fb4-9070-9bd8f560ac8a     %.0f     text_readout — compressor head
de-calc2002        25-CALC-2002        %          05638872-3ce3-45c2-9cc9-5cce68024909      %.0f     analog_bar horiz 0-100 — efficiency
de-calc2003        25-CALC-2003        %          ad9d0695-ce4d-481d-bd30-6e3f1211fd39      %.0f     analog_bar horiz 0-100 — surge margin (low=alarm)
de-fi1401          25-FI-1401          MMSCFD     0168e374-a2e5-4cb1-9ebe-ff7a406bdf6b      %.2f     text_readout — feed gas flow
de-fi1412          25-FI-1412          gpm        d08f57bf-ed4a-4227-a50b-b33a6709d7df      %.0f     text_readout — rich amine flow
de-fi2001          25-FI-2001          gpm        1425e63c-5ce1-40bd-824c-1fff7771878f      %.1f     text_readout — lube oil flow
de-fi2002          25-FI-2002          gpm        5647649f-7ee8-4748-8e15-8b25b5335818      %.1f     text_readout — seal oil flow
de-fi2003          25-FI-2003          MMSCFD     8f54a701-707c-45cf-b454-158895a358db      %.2f     text_readout — suction flow
de-fi2004          25-FI-2004          MMSCFD     ac76afa2-6199-45df-bd48-f0a8531520e1      %.2f     text_readout — discharge flow
de-fi2010          25-FI-2010          MMSCFD     f44cbcdd-e718-44ce-b43a-6c240eef0d5c      %.3f     text_readout — recycle/bypass flow
de-fic1411-pv      25-FIC-1411.PV      gpm        bc2b2b67-5a64-414c-a704-ed929b0d7043      %.0f     text_readout — lean amine flow PV
de-fic1411-sp      25-FIC-1411.SP      gpm        bf7043d8-3bf8-455e-a243-08e80d6f24d9      %.0f     text_readout — lean amine flow SP
de-fic1501-pv      25-FIC-1501.PV      MMSCFD     ec5f5edf-347f-4ed1-8b89-56b3b4b8f3a9      %.3f     text_readout
de-fic2010-pv      25-FIC-2010.PV      %          fa63844e-b2f8-4002-931a-f200a3d1c540      %.1f     text_readout — antisurge controller PV
de-fic2010-sp      25-FIC-2010.SP      %          94849b21-4d8b-4d61-94cd-cd2f87d0f773      %.1f     text_readout — antisurge controller SP
de-ii2001          25-II-2001          klb/hr     77d3b169-8e49-4ea6-9ca6-e6d322b65349      %.1f     text_readout — HP steam flow to turbine
de-ii2030          25-II-2030          A          122bee51-b2b2-45a0-84dc-fbf85216d8d2      %.0f     text_readout — motor/turbine current
de-li2020          25-LI-2020          %          9ad8912b-dd78-4ccd-b6c9-b51cfcb84430      %.1f     analog_bar vert 0-100 — absorber sump level
de-li2030          25-LI-2030          %          eed17971-83c9-46e9-9da5-5229aa05391c      %.1f     analog_bar horiz 0-100 — seal oil tank level
de-lic1410-pv      25-LIC-1410.PV      %          1ad39afc-7797-41e6-9924-1b8cab4a38c6      %.1f     text_readout — amine surge drum level
de-pi2001          25-PI-2001          psig       dea558bd-494e-4898-95d0-de68cbcd9cd6      %.0f     text_readout — suction pressure
de-pi2002          25-PI-2002          psig       6b244c28-b0d9-4ea0-84a8-974b8b530d88      %.0f     text_readout — discharge pressure
de-pi2003          25-PI-2003          psig       7fb76167-8831-43f7-86a0-0d0de428a3e0      %.0f     text_readout — lube oil pressure
de-pi2004          25-PI-2004          psig       218ecf8f-3fae-4ed5-92fd-6c44bd3ddab1      %.0f     text_readout
de-pi2005          25-PI-2005          psig       ce54ade0-61ec-48bb-96e2-172ec3abf52f      %.0f     text_readout — seal oil pressure
de-pi2030          25-PI-2030          psig       63604645-fffc-4130-b5ed-b906798cd243      %.0f     text_readout — turbine inlet pressure
de-pi2031          25-PI-2031          psig       ef5cf11e-c404-43d7-abd7-6fd571223a79      %.0f     text_readout — turbine outlet pressure
de-pi2032          25-PI-2032          psig       d345ed93-6205-46c4-9b18-7fc536bdcbe7      %.0f     text_readout — HP steam pressure
de-pi2033          25-PI-2033          psig       1a8a6fe0-3c30-4f3d-beb7-b14e1986faad      %.0f     text_readout — exhaust steam pressure
de-sic2001-pv      25-SIC-2001.PV      rpm        35e3f128-45d7-4394-a126-dba0bd36934f      %.0f     text_readout LARGE — compressor speed actual
de-sic2001-sp      25-SIC-2001.SP      rpm        6075cd47-94e0-4b11-af8d-aaa35e36b778      %.0f     text_readout — compressor speed setpoint
de-ti1411          25-TI-1411          degF       16f68f36-a397-48b7-b739-86bbd2ea2b60      %.0f     text_readout — lean amine inlet temp
de-ti1413          25-TI-1413          degF       dda837ee-f70d-440c-9c7b-973e34bd0003      %.0f     text_readout — lean amine outlet temp
de-ti2001          25-TI-2001          degF       16ad29ac-8098-41b0-b36c-651926b3540c      %.0f     text_readout — suction temperature
de-ti2002          25-TI-2002          degF       6a3be0a6-2c57-4859-8621-3a4c1347b4e5      %.0f     text_readout — discharge temperature
de-ti2003          25-TI-2003          degF       b00e05a2-5209-4838-93ff-7a67a7f0e5e5      %.0f     text_readout — bearing temperature
de-ti2004          25-TI-2004          degF       1fe4c9ff-2766-4bd0-9a89-dba73a6cfe44      %.0f     text_readout — bearing temperature
de-ti2005          25-TI-2005          degF       7e419adf-ae84-412e-8471-23c5e96d218e      %.0f     text_readout — lube oil temperature
de-ti2006          25-TI-2006          degF       d0edaf60-c14f-44cd-b940-c4e9255298b4      %.0f     text_readout
de-ti2007          25-TI-2007          degF       43446b86-218a-4c10-9913-b0800c7270c8      %.0f     text_readout — bearing temperature
de-ti2008          25-TI-2008          %          5d08ef38-23e0-4b32-a724-607b37ddbc55      %.1f     text_readout
de-ti2031          25-TI-2031          degF       8a5d9439-ba24-4041-a335-c6257a24682b      %.0f     text_readout — turbine inlet temp
de-ti2032          25-TI-2032          degF       7238931e-29f5-4ee3-8a0c-b9f48d22d9d5      %.0f     text_readout — HP steam temp (638°F typical)
de-vt2001-1x       25-VT-2001-1X       mil        fb9b9672-a29b-40f2-91cc-12a2db2a1dce      %.3f     text_readout — shaft vibration bearing 1 X
de-vt2001-1y       25-VT-2001-1Y       mil        a0035254-8c4e-4388-aaef-0f1bc1e5a279      %.3f     text_readout — shaft vibration bearing 1 Y
de-vt2001-2x       25-VT-2001-2X       mil        72cbad06-f6dc-4b37-be20-95ec4e8d899f      %.3f     text_readout — shaft vibration bearing 2 X
de-vt2001-2y       25-VT-2001-2Y       mil        193e587f-1f21-4650-bcc4-4058b4da26bb      %.3f     text_readout — shaft vibration bearing 2 Y
de-zt2001-ax       25-ZT-2001-AX       inch       45c47364-a63a-42cb-baa4-01ed699e8e56      %.4f     text_readout — axial position A
de-zt2001-bx       25-ZT-2001-BX       mil        40a5cfd6-351b-489c-8d6d-c6d38054e1cd      %.3f     text_readout — axial position B X
de-zt2001-by       25-ZT-2001-BY       mil        401fc9e1-b644-4864-a8dc-35ee71ec9121      %.3f     text_readout — axial position B Y
```

---

## Process Description (for layout context)

The graphic shows the **Unit 25 Recycle Gas Compressor** system:

**Equipment:**
- **V-2506 HP KO Drum** (`vessel-vertical`) — horizontal knockout vessel, removes liquid from
  recycle gas before the absorber. Feed from left, gas out to absorber.
- **C-2507 Amine Absorber** (`column-distillation`) — tall vertical column, H2S absorption.
  Gas enters mid-bottom, treated gas exits top. Lean amine in top, rich amine out bottom.
  Key instrument: AI-1401 (H2S in), AI-1402 (H2S out, should be low ppm).
- **CV-FIC-1411** (`valve-control`) — lean amine flow control valve on the amine inlet.
- **K-2501 Recycle Compressor** (`compressor`) — main centrifugal compressor, steam turbine driven.
  Suction from absorber overhead, discharge to reactor loop. Most important piece of equipment.
- **K-2502 Makeup Compressor** (`compressor`, smaller) — supplements recycle gas.
- **Seal Oil Tank** (`vessel-vertical`, small) — small overhead tank, gravity-fed seal oil.
- **CV-FIC-2010** (`valve-control`) — antisurge/recycle valve on K-2501.

**Main gas flow (left to right):**
`[Gas In] → V-2506 → C-2507 (absorber) → K-2501 (compressor) → [To Reactor]`

**Amine loop (vertical, alongside C-2507):**
Lean amine down into top of C-2507, rich amine exits bottom.

**Steam (below K-2501):**
HP steam in → turbine → exhaust steam out.

**Antisurge:**
K-2501 discharge → CV-FIC-2010 → back to K-2501 suction (loop).

---

## Layout Guidance

### Approach: Integrated layout (not a separate panel)

Place **instrument readouts directly near the equipment they instrument**, not in a separate
two-column list. The canvas is **1280×720** — every node must stay within y=0–720. All 53 points
must fit. Design the layout so nothing exceeds y=710.

Suggested zones:
```
x: 0–60      = left margin / pipe entry
x: 60–580    = process equipment area (V-2506, C-2507, K-2501, K-2502 left to right)
x: 580–640   = gap / antisurge area
x: 640–1270  = instrument readout area (grouped by subsystem, top to bottom)
y: 25–50     = title bar
y: 50–710    = active area  ← 660 px for all 53 readouts
```

With 660 px of active height and 53 readouts, target ~12 px row height or pack into tight
grouped columns. Use 3 or 4 columns in the readout area (e.g. at x=650, 790, 930, 1070)
to keep everything above y=710.

### Instrument grouping in the readout area (x=640–1260, y=65–760)

Use section headers (text_block, fontSize 9, fontWeight 600, fill `#52525B`) and horizontal
divider lines between groups. Suggest these groups top-to-bottom:

1. **COMPRESSOR K-2501** (y≈70)
   - SIC-2001.PV, SIC-2001.SP  ← speed setpoint/actual, most prominent (text_readout, large)
   - PI-2001, PI-2002 ← suction / discharge pressure
   - TI-2001, TI-2002 ← suction / discharge temperature
   - FI-2003, FI-2004 ← suction / discharge flow
   - CALC-2001 ← head (ft-lbf/lbm)
   - CALC-2002 ← efficiency % (analog_bar)
   - CALC-2003 ← surge margin % (analog_bar — low value is bad)

2. **GAS QUALITY / ABSORBER** (below compressor group)
   - AI-1401 ← H2S in (mol%)
   - AI-1402 ← H2S out (ppm — show with label "TREATED GAS H2S")
   - AI-1403 ← amine ratio
   - FIC-1411.PV, FIC-1411.SP ← lean amine flow
   - FI-1412 ← rich amine return
   - LI-2020 ← absorber level (analog_bar)
   - LIC-1410.PV ← amine drum level
   - TI-1411, TI-1413 ← amine temperatures

3. **VIBRATION / MECHANICAL** (middle of readout area)
   - VT-2001-1X, VT-2001-1Y ← bearing 1 vibration X/Y (pair)
   - VT-2001-2X, VT-2001-2Y ← bearing 2 vibration X/Y (pair)
   - ZT-2001-AX, ZT-2001-BX, ZT-2001-BY ← axial displacement
   - TI-2003, TI-2004, TI-2007, TI-2008 ← bearing temperatures

4. **LUBE / SEAL OIL**
   - FI-2001 ← lube oil flow
   - PI-2003 ← lube oil pressure
   - TI-2005 ← lube oil temp
   - FI-2002 ← seal oil flow
   - PI-2005 ← seal oil pressure
   - LI-2030 ← seal oil tank level (analog_bar)
   - PI-2004, TI-2006 ← additional

5. **TURBINE DRIVER** (lower readout area)
   - II-2001 ← HP steam flow (klb/hr)
   - PI-2032, TI-2032 ← HP steam P/T
   - PI-2033 ← exhaust steam pressure
   - PI-2030, PI-2031 ← turbine inlet/outlet pressures
   - TI-2031 ← turbine inlet temp
   - II-2030 ← current/power
   - FIC-2010.PV, FIC-2010.SP ← antisurge controller
   - FI-2010, FI-2001 ← additional flows
   - FIC-1501.PV ← additional flow

### Readout layout within groups

Use **two-column format within each group**: 140px wide readout boxes, columns at x≈650 and x≈820.
Row height 30px. Group separator lines every subsection.

Text readout box size: width≈130, height 28 (2-line with label+value), or 20 (value only).
Analog bar: width 120, height 14.

---

## Required Output Format

Return a single JSON object — this is stored verbatim in the `bindings` column:

```json
{
  "canvas": {
    "width": 1280,
    "height": 800,
    "backgroundColor": "#09090B",
    "autoHeight": false
  },
  "metadata": {
    "description": "Recycle gas system — K-2501 centrifugal compressor (steam turbine driven), amine absorber C-2507, HP KO drum V-2506, seal oil tank, and K-2502 makeup compressor.",
    "tags": ["hcu", "unit25", "compressor", "k2501", "k2502", "amine", "recycle-gas", "turbine"],
    "gridSize": 20,
    "designMode": "graphic",
    "snapToGrid": true,
    "gridVisible": false
  },
  "layers": [ ... as defined above ... ],
  "children": [ ... all nodes ... ]
}
```

Do not include any fields not listed in this spec. Do not invent node types.
Every node must have all required base fields: id, type, layerId, visible, locked, opacity, transform.

---

## Checklist before submitting

- [ ] All 53 points are present as display_elements with real UUIDs (not PLACEHOLDER)
- [ ] All equipment shapes present: V-2506, C-2507, CV-FIC1411, K-2501, K-2502, seal-oil-tank, CV-FIC2010
- [ ] Main gas flow pipe connects: left edge → V-2506 → C-2507 → K-2501 → right edge
- [ ] Amine pipes connect to C-2507 top and bottom
- [ ] Steam pipes below K-2501
- [ ] Antisurge pipe loops K-2501 discharge back to suction via CV-FIC2010
- [ ] Canvas is 1280×800 and no node position exceeds those bounds
- [ ] No display element is at the same x,y as another (no overlaps)
- [ ] Section headers and divider lines separate instrument groups
- [ ] Screen title text_block present at top
