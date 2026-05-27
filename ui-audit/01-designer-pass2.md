# Designer UI Audit — Pass 2: Side Panels and Forms

Scope: categories 5, 7, and 9 (side panels; form inputs; labels/headers in DesignerRightPanel).
Primary categories for this pass: 5 (side panels) and 7 (form inputs).
Category 9 is audited here only as it appears within DesignerRightPanel, per the plan note;
findings from pass 1 supplement and this file will be reconciled at the consolidation step.

Files read: `DesignerLeftPalette.tsx` (2,707 lines, full file sampled in sections);
`DesignerRightPanel.tsx` (5,994 lines, sampled across all tabs);
`components/ShapePointSelector.tsx` (1,111 lines, full file);
`components/PointPickerModal.tsx` (567 lines, full file).

---

## Category 5 — Side Panels

**Implementation:** `module-local-component`. All four files implement inline-styled
panels with no shared side-panel primitive. The right panel is split between a
tab-strip top half and a permanent canvas-layers bottom half.

**Source-of-truth files:**

| Panel | File | Key lines |
|---|---|---|
| Left palette container | `DesignerLeftPalette.tsx` | 2430–2438 |
| `SectionHeader` button | `DesignerLeftPalette.tsx` | 59–99 |
| `PaletteSection` resize handle | `DesignerLeftPalette.tsx` | 178–207 |
| Equipment category tile (expanded) | `DesignerLeftPalette.tsx` | 995–1047 |
| Display element tile (expanded) | `DesignerLeftPalette.tsx` | 807–858 |
| Stencil tile (expanded) | `DesignerLeftPalette.tsx` | 1601–1659 |
| Chart widget tile | `DesignerLeftPalette.tsx` | 1800–1852 |
| Right panel container | `DesignerRightPanel.tsx` | 5961–5992 |
| `TabBar` component | `DesignerRightPanel.tsx` | 5101–5153 |
| `CanvasLayersPanel` | `DesignerRightPanel.tsx` | 5459–5546 |
| `CanvasLayerRow` | `DesignerRightPanel.tsx` | 5241–5456 |
| `ShapePointSelector` container | `ShapePointSelector.tsx` | 378–393 |
| `PointPickerModal` dialog | `PointPickerModal.tsx` | 44–55 |

**Visual properties actually applied:**

**DesignerLeftPalette container:**
- `background: "var(--io-surface)"`, `borderRight: "1px solid var(--io-border)"`
- Full-height flex column; `overflow: hidden`

**`SectionHeader` (collapsible section button):**
- `padding: "6px 10px"`, `fontSize: 11`, `fontWeight: 600`, `textTransform: "uppercase"`,
  `letterSpacing: "0.06em"`, `color: "var(--io-text-muted)"`, `borderBottom: "1px solid var(--io-border)"`
- Hover: `background: "var(--io-surface-elevated)"` — set by `onMouseEnter` DOM mutation
  (not CSS `:hover`); `onMouseLeave` resets to `"transparent"`
- Chevron: 12×12 SVG, animated `transform: rotate(90deg)` on open

**`PaletteSection` resize handle:**
- `height: 4`, `cursor: "ns-resize"`, `borderBottom: "1px solid var(--io-border)"`
- Inactive: transparent; hover and active-drag: `background: "var(--io-accent)"` (via event mutation)

**Palette tile matrix (expanded / collapsed):**

| Tile type | Expanded size | Collapsed size | Background |
|---|---|---|---|
| Equipment category | `calc(50% - 4px)` × auto, wraps | 36×36 | `var(--io-surface-sunken)` |
| Display element | 72×64 | 32×32 | `var(--io-surface-elevated)` |
| Custom shape | 64×64 | 32×32 | `var(--io-surface-elevated)` |
| Stencil | 64×48 | 28×28 | `var(--io-surface-elevated)` |
| Chart widget | 48×48 | 32×32 | `var(--io-surface-elevated)` |
| Report element | 48×48 | 32×32 | `var(--io-surface-elevated)` |

- All tile hover: `borderColor: "var(--io-accent)"` via `onMouseEnter` DOM mutation
- Equipment tile hover additionally changes bg: `color-mix(in srgb, var(--io-accent) 8%, var(--io-surface-sunken))`
- All tiles: `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`, `cursor: "grab"`, `userSelect: "none"`

**Drag ghost (shared across all palette drag sources):**
- `position: "fixed"`, `zIndex: 9999`, `background: "var(--io-accent)"`,
  `color: "#09090b"` (hardcoded), `borderRadius: "4px"` (hardcoded integer), `fontSize: 11`, `fontWeight: 600`
- Created as an imperative DOM element appended to `document.body`; Escape key cancels

**Point browser section:**
- Delegates to `PointsBrowserPanel` (app-shell shared component)
- Wrapping div: `maxHeight: 280`, `overflow: "hidden"`, `flexDirection: "column"`

**DesignerRightPanel container:**
- `background: "var(--io-surface)"`, `borderLeft: "1px solid var(--io-border)"`,
  `width` from prop, flex column, `overflow: hidden`, `height: "100%"`
- Collapsed state: 9px `writingMode: "vertical-lr"` label "INSPECTOR", `color: "var(--io-text-muted)"`

**`TabBar` component:**
- Container: `flexShrink: 0`, `borderBottom: "1px solid var(--io-border)"`, `background: "var(--io-surface)"`, `overflowX: auto`
- Tab button: `padding: "6px 8px"`, `fontSize: 10`, `textTransform: "uppercase"`, `letterSpacing: "0.06em"`, `whiteSpace: "nowrap"`
- Active: `fontWeight: 700`, `borderBottom: "2px solid var(--io-accent)"`, `color: "var(--io-text-primary)"`
- Inactive: `fontWeight: 500`, `borderBottom: "2px solid transparent"`, `color: "var(--io-text-muted)"`
- Doc tab: `flex: "0 0 auto"`, `marginLeft: "auto"` — always pushed rightmost

**Two-section right panel layout:**
- Tab content: `flex: 1`, `overflowY: auto`, `paddingTop: 8` — scrollable
- `CanvasLayersPanel`: always visible below; `borderTop: "1px solid var(--io-border)"`

**`CanvasLayersPanel` header:**
- `padding: "5px 10px 5px 12px"`, `fontSize: 10`, `fontWeight: 700`, `textTransform: "uppercase"`,
  `letterSpacing: "0.08em"`, `color: "var(--io-text-muted)"`

**`CanvasLayerRow`:**
- `padding: "2px 4px 2px {4 + depth * 14}px"` (depth-indented)
- Selected: `background: "var(--io-accent-subtle, rgba(99,102,241,0.1))"`, `borderLeft: "2px solid var(--io-accent)"` (left accent stripe)
- Unselected: transparent background, `borderLeft: "2px solid transparent"`
- Node name: `fontSize: 11`; type badge: `fontSize: 8`, `fontWeight: 700`, `letterSpacing: "0.04em"`
- Binding tag: `fontSize: 9`, `maxWidth: 56`
- Icon buttons (16×16): visibility toggle (👁/○), lock toggle (🔒/○), reorder arrows (↑/↓)

**ShapePointSelector container:**
- CSS grid: `gridTemplateColumns: "40% 1fr"`, `gridTemplateRows: "auto auto 1fr auto"`, `columnGap: 12`, `rowGap: 6`

**PointPickerModal overlay and dialog:**
- Overlay: `position: "fixed"`, `zIndex: 1100`, `background: "rgba(0,0,0,0.55)"`
- Dialog: `width: "560px"`, `maxWidth: "90vw"`, `maxHeight: "70vh"`, `background: "var(--io-surface-elevated)"`, `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`, `overflow: hidden`
- Header: `padding: "12px 16px"`, `borderBottom: "1px solid var(--io-border)"`, `fontWeight: 600`, `fontSize: "14px"`
- Footer: `padding: "10px 16px"`, `borderTop: "1px solid var(--io-border)"`

**Deviations from app shell:**

1. **Equipment tiles use `var(--io-surface-sunken)`; all other palette tiles use
   `var(--io-surface-elevated)`.** Two different surface tiers for palette items of equivalent
   semantic weight (draggable source objects). `var(--io-surface-sunken)` was not enumerated
   in the pass 1 token survey; it may or may not be registered in `index.css`.

2. **Drag ghost hardcodes `borderRadius: "4px"` (integer not `var(--io-radius)`)** and
   `color: "#09090b"` — consistent with the toolbar's IconBtn hardcoded foreground from pass 1
   (category 1 deviation), but still bypasses the token.

3. **Stencil tile (expanded) renders a ⬜ emoji as a placeholder thumbnail** while equipment
   tiles render a real `ShapeThumbnail` SVG and display element tiles render a spec-accurate
   `DisplayElementPreview` SVG. Three different thumbnail strategies with no visual parity.

4. **CanvasLayerRow uses emoji icons (👁, 🔒) for visibility and lock toggles.**
   The rest of the Designer uses `<svg>` inline elements or Unicode symbols for icons.
   No shared icon convention is applied.

5. **`CanvasLayerRow` selected background is `var(--io-accent-subtle, rgba(99,102,241,0.1))`.** The fallback
   `rgba(99,102,241,0.1)` is indigo — the app's accent is teal (`#2dd4bf`). If
   `var(--io-accent-subtle)` is not registered, the selection highlight renders with the wrong
   hue. This is a silent correctness risk on any environment where the token is absent.

6. **All panel hover effects are applied via `onMouseEnter`/`onMouseLeave` DOM mutations**
   rather than CSS `:hover`. This is consistent across DesignerLeftPalette and mirrors the
   pattern established in the toolbar layer (pass 1 observation), but means the hover
   state is lost if the user's pointer leaves without triggering `onMouseLeave` (e.g., rapid
   focus change).

7. **`PointPickerModal` uses a `rgba(0,0,0,0.55)` backdrop.** The pass 1 audit found
   `index.tsx` uses `rgba(0,0,0,0.6)` and the registered token `--io-modal-backdrop` is
   `rgba(0,0,0,0.7)` (dark) / `rgba(0,0,0,0.5)` (light). Three different backdrop opacities
   are now in use across the designer with none matching the registered token.

8. **`RowSection` collapsible (used heavily in the RightPanel for display element config)
   uses `background: "var(--io-surface-raised)"` for its header.** This token was not
   found in the pass 1 token registry survey. If unregistered, the header background
   resolves to empty (no background).

9. **`PointPickerModal` point list rows use `<div onClick>` not `<button>`.** All list items
   in Browse/Search/Favorites/Recent tabs are non-semantic clickable divs. No keyboard
   navigation (Tab/Enter) is possible without mouse interaction.

**Notes:** The Points section in the left palette delegates entirely to the shared
`PointsBrowserPanel` component (app-shell scope). The visual pattern of that component
is outside this audit's scope. The palette resize handle is the only interactive surface
in the palette that does not have a visible hover indicator in the default Tailwind sense —
the 4px bar is invisible (transparent) until hovered or during drag.

---

## Category 7 — Form Inputs

**Implementation:** `mix`. DesignerRightPanel defines a reusable `inputStyle` constant
and wraps it in `NumberInput`, `SelectInput`, `ColorInput`, and `ThemedColorSelect`
helper components — the densest form input system in the Designer. ShapePointSelector
uses its own `inputStyle` with different token references. PointPickerModal defines
style constants at module level and uses bare unstyled tag inputs throughout.

**Source-of-truth files:**

| Element | File | Lines |
|---|---|---|
| `inputStyle` constant | `DesignerRightPanel.tsx` | 219–229 |
| `FieldLabel` component | `DesignerRightPanel.tsx` | 201–217 |
| `Field` wrapper | `DesignerRightPanel.tsx` | 231–243 |
| `NumberInput` | `DesignerRightPanel.tsx` | 246–277 |
| `SelectInput` | `DesignerRightPanel.tsx` | 433–458 |
| `ColorInput` | `DesignerRightPanel.tsx` | 301–374 |
| `ThemedColorSelect` | `DesignerRightPanel.tsx` | 389–431 |
| `RowSection` collapsible | `DesignerRightPanel.tsx` | 3385–3447 |
| Checkbox inline pattern | `DesignerRightPanel.tsx` | 790–845 (TransformSection) |
| `inputStyle` (ShapePointSelector) | `ShapePointSelector.tsx` | 363–375 |
| Search input (PointPickerModal) | `PointPickerModal.tsx` | 68–78 |
| Tab chip buttons | `PointPickerModal.tsx` | 80–89 |
| Footer buttons | `PointPickerModal.tsx` | 112–128 |

**Visual properties actually applied:**

**DesignerRightPanel `inputStyle` (applies to all text/number/select inputs):**

| Property | Value |
|---|---|
| `padding` | `"4px 7px"` |
| `background` | `"var(--io-surface)"` |
| `border` | `"1px solid var(--io-border)"` |
| `borderRadius` | `"var(--io-radius)"` |
| `color` | `"var(--io-text-primary)"` |
| `fontSize` | `12` (bare integer) |
| `outline` | `"none"` |
| `width` | `"100%"` |
| `boxSizing` | `"border-box"` |

**`FieldLabel` component:**
- `fontSize: 10`, `fontWeight: 600`, `textTransform: "uppercase"`, `letterSpacing: "0.05em"`,
  `color: "var(--io-text-muted)"`, `marginBottom: 3`
- Renders as `<label>` — semantically correct

**`Field` wrapper:**
- `marginBottom: 10` — uniform spacing below every field group

**`ColorInput` composite:**
- Outer div: 28×28 swatch (`background: value`, `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`)
- `<input type="color">` positioned absolutely inside swatch (`opacity: 0`) — invisible native picker trigger
- Adjacent hex text input: `{...inputStyle, flex: 1}` — hex direct edit
- If value is not a valid hex, shows "Theme default" in 10px monospace instead of hex input
- Reserved color warning: `fontSize: 9`, `color: "#f97316"` (hardcoded — the same alarm-high value from pass 1 findings)

**`ThemedColorSelect`:**
- 20×20 swatch + `<select>` with 3 options (White/Gray/Muted, ISA-101 compliant)
- Options map to `var(--io-text-primary)`, `var(--io-text-secondary)`, `var(--io-text-muted)` only
- Default option: "Default" → reverts to caller-provided `defaultValue`

**Checkbox pattern (inline form controls):**
- `<label>` wrapper, flex row, `gap: 4`, `fontSize: 11`, `cursor: "pointer"`, `color: "var(--io-text-secondary)"` or `var(--io-text-muted)`
- Bare `<input type="checkbox">`, no custom styling

**`RowSection` collapsible (display element config sub-sections):**
- Container: `border: "1px solid var(--io-border)"`, `borderRadius: 4` (integer, not `var(--io-radius)`), `overflow: hidden`
- Header div: `padding: "5px 8px"`, `background: "var(--io-surface-raised)"` (potentially unregistered), cursor pointer (div onClick, not a `<button>`)
- Title text: `fontSize: 11`, `fontWeight: 600`, `color: "var(--io-text-secondary)"` — NOT uppercase (contrast with `FieldLabel`)
- Open/close glyph: ▲/▼ Unicode, `fontSize: 8`, `color: "var(--io-text-muted)"`
- Body: `padding: "8px 8px 4px"`, `borderTop: "1px solid var(--io-border)"`

**Layout toggle buttons (TextReadoutArray):**
- Vertical/Horizontal selector: flex pair of `<button>` elements, `flex: 1`, `padding: "3px 0"`, `fontSize: 11`
- Active: `border: "1px solid var(--io-accent)"`, `borderRadius: "var(--io-radius)"`, `background: "color-mix(in srgb, var(--io-accent) 15%, transparent)"`, `color: "var(--io-accent)"`
- Inactive: `border: "1px solid var(--io-border)"`, transparent bg, `color: "var(--io-text-muted)"`

**ShapePointSelector `inputStyle`:**

| Property | Value |
|---|---|
| `height` | `26` |
| `background` | `"var(--io-input-bg)"` |
| `border` | `"1px solid var(--io-input-border)"` |
| `color` | `"var(--io-text-primary)"` |
| `fontSize` | `"1em"` (relative) |
| `padding` | `"0 8px"` |
| `borderRadius` | `4` (integer, not token) |

**ShapePointSelector drop zone / slot assignment chip:**
- Empty zone: `border: "1px dashed {color-mix(in srgb, var(--io-accent) 35%, var(--io-border))}"`, `padding: "14px 12px"`, `bg: "color-mix(in srgb, var(--io-accent) 4%, var(--io-surface))"`
- Drag-over zone: `border: "1px dashed var(--io-accent)"`, `bg: "color-mix(in srgb, var(--io-accent) 8%, var(--io-surface))"`
- Filled chip: `background: "var(--io-surface-secondary)"`, `border: "1px solid var(--io-border)"`, `borderRadius: 3`, tag text: `fontFamily: "JetBrains Mono, monospace"`, `fontSize: "0.95em"`
- Point list item hover bg: `"var(--io-surface-hover)"` (confirmed undefined, pass 1)

**PointPickerModal input styles:**
- Search input: `padding: "8px 12px 8px 32px"` (left offset for icon), `background: "var(--io-surface-sunken)"`, `fontSize: "13px"` (string), `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`
- Tab chip buttons (active): `background: "var(--io-accent-subtle)"`, `border: "1px solid var(--io-accent)"`, `color: "var(--io-accent)"`, `fontSize: "12px"` (string), `fontWeight: 600`
- Tab chip buttons (inactive): `border: "1px solid var(--io-border)"`, `color: "var(--io-text-secondary)"`; `fontWeight: 400`
- Row dividers: `borderBottom: "1px solid var(--io-border-subtle)"` (potentially unregistered)
- Cancel button: `padding: "6px 14px"`, `border: "1px solid var(--io-border)"`, transparent bg, `color: "var(--io-text-secondary)"`, `fontSize: "12px"`, `borderRadius: "var(--io-radius)"`
- Select (primary) button: `background: "var(--io-accent)"`, `color: "#09090b"` (hardcoded), `fontWeight: 600`, no border

**Deviations from app shell:**

1. **Three different input background tokens across three files.** DesignerRightPanel:
   `var(--io-surface)`. ShapePointSelector: `var(--io-input-bg)`. PointPickerModal:
   `var(--io-surface-sunken)`. No consistent input-field background convention exists.

2. **`var(--io-input-bg)` and `var(--io-input-border)` in ShapePointSelector are not
   in the pass 1 token registry (138 tokens in `index.css`).** If unregistered, inputs
   in ShapePointSelector have no background and no border.

3. **`var(--io-surface-raised)` in RowSection header background is not in the pass 1
   token registry.** If unregistered, RowSection section headers have no background
   (renders same as transparent).

4. **`var(--io-accent-subtle)` used as active tab background in PointPickerModal and as
   selected-row background in CanvasLayerRow.** Its fallback in CanvasLayerRow is
   `rgba(99,102,241,0.1)` — indigo, which is the wrong hue if the token resolves to teal.
   The token was not enumerated in pass 1; requires verification against `index.css`.

5. **`var(--io-border-subtle)` in PointPickerModal row dividers is not enumerated in
   pass 1.** If unregistered, list rows have no bottom separator.

6. **`var(--io-surface-hover)` in ShapePointSelector point list item hover** is confirmed
   undefined (pass 1, category 1 and 4). Hover produces no visual feedback on list items.

7. **ShapePointSelector uses `fontSize: "1em"` (relative)** while all other form inputs
   in the designer use bare pixel integers (12). This is the only relative font-size
   unit in the pass 2 files' input surfaces.

8. **ShapePointSelector uses `borderRadius: 4` (integer)** rather than `var(--io-radius)`.
   DesignerRightPanel's `inputStyle` correctly uses `var(--io-radius)`. Within the
   designer, the two most-used form input surfaces differ in border radius tokens.

9. **`RowSection` header is a `<div onClick>`, not a `<button>`.** The collapsible section
   header captures clicks but has no focus ring, no keyboard Enter handler, and no ARIA
   role. This affects all display element configuration sub-sections in the right panel.

10. **PointPickerModal primary button hardcodes `color: "#09090b"`.** Consistent with
    the pattern identified in pass 1 (category 6), but the hardcoded foreground color
    fails to adapt in the light theme.

11. **`FieldLabel` uses `letterSpacing: "0.05em"` while `RowSection` titles use none.**
    Both are sub-group labels for form sections but diverge in uppercase treatment
    (FieldLabel: uppercase; RowSection: regular case) and color tier (muted vs secondary).

12. **`ColorInput` reserved-color warning renders in `color: "#f97316"`** — the same
    hardcoded alarm-high orange identified in pass 1 (category 1 deviation), bypassing
    `var(--io-alarm-high)`.

13. **TextBlock background default values hardcoded as `fill: "#27272A"`, `stroke: "#3F3F46"`**
    when enabling "Background Box". These are dark-theme hex values with no token
    reference; light theme would apply dark surface colors to a text box background.

**Notes:** `NumberInput` uses `type="number"` with a native browser spinner — no custom
increment/decrement UI. The range limits (`min`, `max`) are set per-field; there is no
shared validation layer. The `SelectInput` component and bare `<select>` elements are
styled identically; both correctly apply `cursor: "pointer"` which bare selects usually
lack. `ThemedColorSelect` is the most defensible form input pattern in the file: it
restricts options to safe ISA-101 compliant tokens and uses a live swatch preview.

---

## Category 9 — Labels and Headers (DesignerRightPanel only)

**Implementation:** `inline-styles`. All labels are `<div>`, `<span>`, or `<label>`
elements with bare pixel literals. No semantic heading elements (`h1`, `h2`, `h3`)
appear anywhere in DesignerRightPanel. The `FieldLabel` component is the only reusable
label primitive in the file; collapsible section headers (`RowSection`) use a divergent
pattern.

**Source-of-truth files:**

| Element | File | Lines |
|---|---|---|
| `FieldLabel` component | `DesignerRightPanel.tsx` | 201–217 |
| `TabBar` tab labels | `DesignerRightPanel.tsx` | 5121–5148 |
| `CanvasLayersPanel` "Layers" header | `DesignerRightPanel.tsx` | 5490–5511 |
| `RowSection` section title | `DesignerRightPanel.tsx` | 3416–3427 |
| "Shape Info" card header | `DesignerRightPanel.tsx` | 1711–1722 |
| Type badge in `CanvasLayerRow` | `DesignerRightPanel.tsx` | 5312–5323 |
| Hint/helper text boxes | `DesignerRightPanel.tsx` | 1510–1521 (PipeStyleSection) |
| `PointResolutionIndicator` labels | `DesignerRightPanel.tsx` | 119–145 |
| Collapsed "INSPECTOR" label | `DesignerRightPanel.tsx` | 5706–5712 |
| `NavigationLinkEditor` toggle button | `DesignerRightPanel.tsx` | 479–497 |

**Visual properties actually applied (concrete values):**

**`FieldLabel` (used for all form field labels throughout the file):**

| Property | Value |
|---|---|
| Tag | `<label>` |
| `fontSize` | `10` |
| `fontWeight` | `600` |
| `textTransform` | `"uppercase"` |
| `letterSpacing` | `"0.05em"` |
| `color` | `"var(--io-text-muted)"` |
| `marginBottom` | `3` |

**`TabBar` tab button labels:**

| State | `fontSize` | `fontWeight` | `color` | `letterSpacing` |
|---|---|---|---|---|
| Active | `10` | `700` | `var(--io-text-primary)` | `"0.06em"` |
| Inactive | `10` | `500` | `var(--io-text-muted)` | `"0.06em"` |
| All | uppercase | — | — | `textTransform: "uppercase"` |

**`CanvasLayersPanel` "Layers" header:**
- `fontSize: 10`, `fontWeight: 700`, `textTransform: "uppercase"`, `letterSpacing: "0.08em"`, `color: "var(--io-text-muted)"`

**`RowSection` collapsible section title:**
- `fontSize: 11`, `fontWeight: 600`, `color: "var(--io-text-secondary)"` — **no uppercase, no letterSpacing**

**"Shape Info" card header (SymbolInstanceShapeTab):**
- `fontSize: 10`, `fontWeight: 700`, `textTransform: "uppercase"`, `letterSpacing: "0.06em"`, `color: "var(--io-text-muted)"`

**Type badge in CanvasLayerRow (SYM, DE, GEO, etc.):**
- `fontSize: 8`, `fontWeight: 700`, `color: "var(--io-text-muted)"`, `letterSpacing: "0.04em"`, `minWidth: 24`

**Hint/helper text boxes (e.g., PipeStyleSection, SymbolInstanceShapeTab):**
- Wrapper: `padding: "6px 8px"`, `background: "var(--io-surface-elevated)"`, `borderRadius: "var(--io-radius)"`
- Text: `fontSize: 10`, `color: "var(--io-text-muted)"` (some instances use `fontSize: 10`, others inherit)

**`PointResolutionIndicator` labels:**
- Checking (`…`): `fontSize: 10`, `color: "var(--io-text-muted)"`
- Found (✓): `fontSize: 10`, `color: "#22c55e"` (hardcoded — same as WS dot in pass 1)
- Not found (⚠ not found): `fontSize: 10`, `color: "#facc15"` (hardcoded yellow)

**Collapsed "INSPECTOR" label:**
- `fontSize: 9`, `color: "var(--io-text-muted)"`, `writingMode: "vertical-lr"`, `transform: "rotate(180deg)"`

**NavigationLinkEditor toggle button:**
- `fontSize: 11`, `color: hasLink ? "var(--io-accent)" : "var(--io-text-secondary)"` — changes color semantically based on state (good pattern)
- Disclosure glyph: `fontSize: 9`, inline Unicode ▲/▼

**Letter-spacing survey across all uppercase label contexts in RightPanel:**

| Context | `letterSpacing` |
|---|---|
| `FieldLabel` | `0.05em` |
| `TabBar` tabs | `0.06em` |
| `CanvasLayersPanel` header | `0.08em` |
| "Shape Info" card | `0.06em` |
| Type badge | `0.04em` |
| `RowSection` title | none (not uppercase) |

**Deviations from app shell:**

1. **`RowSection` section title is 11px, regular case, `var(--io-text-secondary)`.** `FieldLabel`
   is 10px, uppercase, `var(--io-text-muted)`. Both delimit sub-groups of form controls within
   the same panel, but use different size, transform, and color tier. No shared primitive
   unifies these two label levels.

2. **Four different `letterSpacing` values (0em, 0.04em, 0.05em, 0.06em, 0.08em) appear across
   uppercase label contexts in the same file.** The app shell defines no token for
   letter-spacing; this is consistent with the absence found in pass 1, but the variation
   is wider here (five distinct values vs. the two or three seen in the toolbar shell files).

3. **`PointResolutionIndicator` hardcodes `#22c55e` (found) and `#facc15` (not found)** rather
   than using `var(--io-alarm-normal)` and `var(--io-alarm-low)` or equivalent tokens. The `#22c55e`
   hardcoding is consistent with the WS dot finding in pass 1 (category 8).

4. **No semantic heading elements in DesignerRightPanel.** All structural labels are `<div>`,
   `<span>`, or `<label>`. Section-level headers that could use `<h3>` (e.g., "Shape Info"
   card, CanvasLayersPanel header) do not. Consistent with the inconsistency found in pass 1
   but at a greater scale (the entire inspector panel).

5. **`RowSection` header is a `<div onClick>` without ARIA role.** It acts as a disclosure
   button but is not accessible to keyboard users and does not receive focus. (Repeated from
   category 7 where it is reported as a form input deviation; listed here as it is also a
   label/header deviation.)

6. **Disclosure glyphs are Unicode characters (▲/▼, ▶/▼) not SVG icons.** `RowSection`
   uses ▲/▼ at `fontSize: 8`. `CanvasLayerRow` expand toggle uses ▶/▼ at `fontSize: 8`.
   Consistent within the file, but different from the `IconChevron` SVG used in the left
   palette's `SectionHeader`, and different from the toolbar's text glyphs.

7. **Tab labels use `fontWeight: 700` for active state** while the left palette's section
   headers use `fontWeight: 600` at the same label scale (11px vs. 10px). Neither matches
   the tab weight conventions from the `DesignerTabBar` (which uses 600/400 active/inactive).
   Three different weight conventions for "active vs. inactive" tab/section labeling across
   the designer panels.

**Notes:** The right panel contains more label diversity in a single file than all the
toolbar shell files combined. The `FieldLabel` component is the one stable convention —
it is used consistently for every form field label in the inspector and could serve as a
foundation for a shared label system if the letterSpacing and size conventions were
consolidated.
