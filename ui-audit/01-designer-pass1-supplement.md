# Designer UI Audit — Pass 1 Supplement: Categories 6, 8, 9

Scope: categories 6, 8, 9 only (buttons; status indicators; labels and headers).
Corrective supplement to `01-designer-pass1.md`, which covered categories 1–4.
Files read: `index.tsx`, `DesignerHome.tsx`, `DesignerGraphicsList.tsx`,
`DesignerToolbar.tsx`, `DesignerModeTabs.tsx`, `DesignerTabBar.tsx`,
`DesignerStatusBar.tsx`, `DesignerImport.tsx` (header/styles block),
`SymbolLibrary.tsx` (header/button layer).

---

## Category 6 — Buttons (Primary, Secondary, Icon Variants)

**Implementation:** `mix`. No shared `<Button>` component exists; all button
patterns are inline-styled individually. Five distinct patterns are in use
across the shell: primary (filled accent), secondary (bordered transparent),
destructive (danger fill or ghost), icon (IconBtn primitive), and toggle/chip.

**Source-of-truth files:**

| Pattern | File | Lines |
|---|---|---|
| IconBtn primitive | `DesignerToolbar.tsx` | 904–948 |
| Toolbar text actions (Delete/Save/Publish) | `DesignerToolbar.tsx` | 1618–1693 |
| Read-only badge | `DesignerToolbar.tsx` | 1598–1615 |
| Tab close button | `DesignerTabBar.tsx` | 208–238 |
| Scroll arrow buttons | `DesignerTabBar.tsx` | 273–300 |
| StatusBar TEST MODE pause/resume | `DesignerStatusBar.tsx` | 327–352 |
| Home screen primary / secondary | `DesignerHome.tsx` | 55–84 |
| GraphicsList header "New Graphic" | `DesignerGraphicsList.tsx` | 927–955 |
| GraphicsList hover overlay Edit / Delete | `DesignerGraphicsList.tsx` | 342–379 |
| GraphicsList empty-state "Create Graphic" | `DesignerGraphicsList.tsx` | 715–730 |
| GraphicsList DeleteDialog Cancel / Delete | `DesignerGraphicsList.tsx` | 608–641 |
| Import primaryBtn / secondaryBtn / disabledBtn | `DesignerImport.tsx` | 64–90 |
| SymbolLibrary "Upload SVG" | `SymbolLibrary.tsx` | 356–376 |
| SymbolLibrary "Delete" (custom shape row) | `SymbolLibrary.tsx` | 233–260 |
| NewGraphicDialog mode/scope/preset toggles | `index.tsx` | 290–390 |
| NewGraphicDialog proportional lock | `index.tsx` | 435–450 |

**Visual properties actually applied (concrete values):**

**Primary button (filled accent):**

| Location | background | color | border | radius | padding | fontSize | weight |
|---|---|---|---|---|---|---|---|
| DesignerHome "New" | `var(--io-accent)` | `var(--io-accent-foreground)` | none | `var(--io-radius)` | 9px 22px | 13 | 600 |
| GraphicsList "New Graphic" | `var(--io-accent)` | `#fff` (hardcoded) | none | `var(--io-radius)` | 7px 16px | 13 | 600 |
| GraphicsList hover "Edit" | `var(--io-accent)` | `#fff` (hardcoded) | none | `var(--io-radius)` | 7px 18px | 13 | 600 |
| GraphicsList empty "Create Graphic" | `var(--io-accent)` | `#fff` (hardcoded) | none | `var(--io-radius)` | 9px 20px | 13 | 600 |
| DesignerImport `primaryBtn` | `var(--io-accent, #3b82f6)` | `#fff` (hardcoded) | none | `var(--io-radius, 6px)` | 8px 18px | 13 | 600 |
| SymbolLibrary "Upload SVG" | `var(--io-accent)` | `#09090b` (hardcoded) | none | `var(--io-radius)` | 7px 14px | 12 | 600 |

**Secondary button (bordered, transparent bg):**

| Location | background | color | border | radius | padding | fontSize | weight |
|---|---|---|---|---|---|---|---|
| DesignerHome "Open Existing" | transparent | `var(--io-text-secondary)` | `1px solid var(--io-border)` | `var(--io-radius)` | 9px 22px | 13 | 500 |
| DesignerImport `secondaryBtn` | transparent | `var(--io-text-muted)` | `1px solid var(--io-border)` | `var(--io-radius, 6px)` | 8px 18px | 13 | 500 |
| Toolbar Delete | transparent | `var(--io-danger)` (enabled) / `var(--io-text-disabled)` | `1px solid var(--io-border)` | `6` (integer) | 4px 10px | 12 | — |
| Toolbar Save | transparent | `var(--io-accent)` (dirty) / `var(--io-text-disabled)` | `1px solid var(--io-border)` | `6` (integer) | 4px 10px | 12 | — |
| Toolbar Publish | transparent | `var(--io-accent)` (enabled) / `var(--io-text-disabled)` | `1px solid var(--io-border)` | `6` (integer) | 4px 10px | 12 | — |
| DeleteDialog "Cancel" | `var(--io-surface-elevated)` | `var(--io-text-primary)` | `1px solid var(--io-border)` | `var(--io-radius)` | 8px 18px | 13 | 500 |
| SymbolLibrary shape "Delete" | transparent | `var(--io-text-muted)` | `1px solid var(--io-border)` | `var(--io-radius)` | 4px 10px | 11 | — |

**Destructive button:**

| Location | Style | background | color |
|---|---|---|---|
| GraphicsList hover overlay "Delete" | ghost | `rgba(239,68,68,0.15)`, border `rgba(239,68,68,0.5)` | `#f87171` |
| GraphicsList DeleteDialog "Delete" confirm | solid | `#ef4444` | `#fff` |

**Icon button (IconBtn):**
- Size: 32×32, `borderRadius: "var(--io-radius)"`, no border
- Active: `background: "var(--io-accent)"`, `color: "#09090b"` (hardcoded)
- Inactive: `background: "transparent"`, `color: "var(--io-text-secondary)"`
- Hover (inactive): `background: "var(--io-surface-elevated)"`
- Disabled: `color: "var(--io-text-muted)"`, `opacity: 0.4`
- Transition: `background 0.1s, color 0.1s`

**Toggle/chip buttons (NewGraphicDialog mode/scope/preset selectors):**
- Mode/scope: active `background: "var(--io-accent)"`, `color: "var(--io-accent-foreground)"`; inactive `background: "var(--io-surface)"`, `color: "var(--io-text-secondary)"`; `border: "1px solid var(--io-border)"`, `borderRadius: "var(--io-radius)"`, `fontSize: 12`
- Preset chips: same active/inactive logic; `borderRadius: "calc(var(--io-radius) * 2)"` (pill shape), `fontSize: 11`

**Tab close button (DesignerTabBar:208–238):**
- 16×16, `borderRadius: 3` (hardcoded integer), `color: "var(--io-text-muted)"`, `fontSize: 14`
- Hover: `background: "rgba(239,68,68,0.15)"`, `color: "#f87171"` (hardcoded, no token)

**StatusBar TEST MODE pause/resume (DesignerStatusBar:327–352):**
- `borderRadius: 3` (hardcoded), height 20, `fontSize: 13`, `padding: "0 5px"`
- Paused: `background: "rgba(74,222,128,0.12)"`, `border: "1px solid rgba(74,222,128,0.4)"`, `color: "#4ade80"` — all hardcoded
- Live: `background: "rgba(239,68,68,0.12)"`, `border: "1px solid rgba(239,68,68,0.4)"`, `color: "#ef4444"` — all hardcoded

**Deviations from app shell:**

1. **Primary button text color inconsistency.** DesignerHome "New" correctly uses `var(--io-accent-foreground)`. Every other primary button in the shell uses `#fff` or `#09090b` hardcoded. In the light theme `--io-accent-foreground` resolves to `#fff` (light theme value differs from dark), so these hardcoded values will not adapt. SymbolLibrary "Upload SVG" uses `#09090b` which is the dark-mode accent foreground value — correct for dark but wrong for light.

2. **DesignerImport `primaryBtn` has a wrong fallback.** `background: "var(--io-accent, #3b82f6)"` — the fallback `#3b82f6` (blue) does not match the accent token (`#2dd4bf` in dark theme). The fallback is unreachable in practice but is incorrect.

3. **Toolbar text action buttons use `borderRadius: 6` (integer literal)** rather than `var(--io-radius)`. IconBtn in the same toolbar uses `var(--io-radius)`. Both resolve to 6px currently but the inconsistency is present.

4. **Tab close button and StatusBar button use `borderRadius: 3` (hardcoded integer)** — no token reference.

5. **No shared button primitive for primary/secondary/destructive patterns.** Six files each define their own inline-style primary button with minor variations (different padding, slightly different color token usage). No `<Button>` component exists.

6. **Two incompatible destructive button styles.** Ghost destructive (rgba red background + red border + `#f87171` text) used for hover-overlay delete; solid destructive (`#ef4444` fill + `#fff` text) used for modal confirm. No system governs which to use where.

7. **StatusBar clickable segments are `<div>` elements, not `<button>` elements.** Grid, zoom, and binding-summary clickable segments use `<div onClick>` with `cursor: "pointer"`. This bypasses keyboard navigation and accessibility semantics.

8. **Secondary button color token varies.** DesignerHome secondary uses `--io-text-secondary`; DesignerImport secondary uses `--io-text-muted`; toolbar Save/Delete use `--io-accent` / `--io-danger` for active state. No consistent secondary button color convention.

**Notes:** The DesignerModeTabs mode tab buttons function as primary navigation buttons (role=button, onClick sets mode). They are styled as tabs (active bottom border, font-weight change) rather than as buttons. They are not captured in the above patterns but share the active/inactive token convention of toggle buttons.

---

## Category 8 — Status Indicators

**Implementation:** `inline-styles`, all module-local. No shared status indicator
component. Indicators are scattered across DesignerToolbar (dirty dot, read-only
badge), DesignerTabBar (modified dot), and DesignerStatusBar (WS dot, binding
summary, mode label, auto-save label, TEST MODE).

**Source-of-truth files:**

| Indicator | File | Lines |
|---|---|---|
| WS connection dot | `DesignerStatusBar.tsx` | 204–216 |
| Point binding summary | `DesignerStatusBar.tsx` | 220–234 |
| Grid size segment | `DesignerStatusBar.tsx` | 238–245 |
| Zoom level segment | `DesignerStatusBar.tsx` | 249–309 |
| Mode indicator (Edit / Read-Only) | `DesignerStatusBar.tsx` | 313–358 |
| TEST MODE indicator + pause/resume | `DesignerStatusBar.tsx` | 314–353 |
| Auto-save indicator | `DesignerStatusBar.tsx` | 363–371 |
| Dirty / unsaved-changes dot | `DesignerToolbar.tsx` | 1584–1597 |
| READ-ONLY badge | `DesignerToolbar.tsx` | 1598–1615 |
| Modified dot in tab | `DesignerTabBar.tsx` | 181–193 |

**Visual properties actually applied (concrete values):**

**WS connection dot (DesignerStatusBar:204–216):**
- Glyph: `●` (U+25CF), `fontSize: 8`, `lineHeight: 1`
- Connected: `color: "#22c55e"` (hardcoded)
- Disconnected: `color: "#ef4444"` (hardcoded)
- Adjacent label: "Connected" / "Disconnected", 11px, `var(--io-text-secondary)`

**Point binding summary (DesignerStatusBar:220–234):**
- Normal state: "Points: N bound" — 11px, `var(--io-text-secondary)`, entire segment clickable
- Unresolved state: appends `({unresolved} unresolved)` in `color: "#f97316"` (hardcoded orange)

**Dirty indicator (DesignerToolbar:1584–1597):**
- 7×7px `<div>`, `borderRadius: "50%"`, `background: "#f97316"` (hardcoded orange)
- Title tooltip: "Unsaved changes"

**READ-ONLY badge (DesignerToolbar:1598–1615):**
- Text: "READ-ONLY", `fontSize: 11`, `fontWeight: 600`, `letterSpacing: "0.05em"`
- `padding: "3px 8px"`, `borderRadius: "var(--io-radius)"`
- `background: "rgba(234,179,8,0.15)"`, `border: "1px solid rgba(234,179,8,0.4)"`, `color: "#eab308"` — all hardcoded

**Modified dot in TabBar (DesignerTabBar:181–193):**
- Glyph: `&#9679;` (●), `fontSize: 14`, `lineHeight: 1`
- `color: "var(--io-warning, #f59e0b)"` — uses token with fallback (only status indicator that references a token)

**TEST MODE indicator (DesignerStatusBar:314–340):**
- Text: "TEST MODE", `fontWeight: 600`, `letterSpacing: "0.06em"`, `color: "#4ade80"` (hardcoded)
- Animated: CSS keyframes injected via inline `<style>` — `@keyframes io-test-mode-glow { 0%,100% { text-shadow: 0 0 6px #4ade80; opacity:1; } 50% { text-shadow: 0 0 14px #4ade80, 0 0 28px #4ade80; opacity:0.9; } }`
- Pause/resume button: colors fully hardcoded (#4ade80 / #ef4444), `borderRadius: 3`

**Auto-save indicator (DesignerStatusBar:363–371):**
- Text: "Auto-saved N ago" — 11px, `var(--io-text-secondary)`, right-aligned via flex spacer
- Conditional render: only appears when `lastAutoSave != null`

**Deviations from app shell:**

1. **WS dot colors bypass tokens.** `#22c55e` / `#ef4444` are the dark-mode values of `--io-alarm-normal` / `--io-alarm-urgent` respectively, but are not referenced via tokens. Light-theme adaptation fails.

2. **Dirty indicator uses `#f97316`.** Same hex as `--io-alarm-high` dark value, not a token reference.

3. **Unresolved bindings text uses `#f97316`.** Same pattern — hardcoded rather than `var(--io-alarm-high)`.

4. **READ-ONLY badge uses fully hardcoded yellow palette.** Token `--io-warning: #f59e0b` exists in the registry but is not used; the badge uses `#eab308` (a slightly different yellow) with `rgba()` background/border variants.

5. **TEST MODE indicator fully hardcoded.** `#4ade80` (green) and `rgba(74,222,128,*)` are used throughout; no token maps to this color. The animated glow keyframe is injected as a raw `<style>` tag inside the JSX, creating a new `<style>` element on every render cycle when testMode is active.

6. **TabBar modified dot is the only status indicator that uses a token.** `var(--io-warning, #f59e0b)` is correct usage. All other status indicators bypass the token system.

7. **No semantic severity taxonomy.** Three separate "warning" states (dirty indicator, READ-ONLY badge, unresolved bindings) all use different oranges/yellows (`#f97316`, `#eab308`, `rgba(234,179,8,*)`) with no shared token or visual convention linking them.

**Notes:** The mode indicator in the non-test-mode case ("Edit" / "Read-Only") renders in plain `var(--io-text-secondary)` with no visual differentiation between edit and read-only states beyond the text label. The READ-ONLY badge in the toolbar is the only distinct visual signal for the read-only permission state.

---

## Category 9 — Labels and Headers

**Implementation:** `inline-styles`. No shared heading or label component exists.
Semantic HTML heading elements (`h1`, `h2`, `h3`) are used only in SymbolLibrary
and DesignerGraphicsList DeleteDialog; all other headers are styled `<div>` or
`<span>` elements with bare font-size and weight literals.

**Source-of-truth files:**

| Element | File | Lines |
|---|---|---|
| Page h1 "Symbol Library" | `SymbolLibrary.tsx` | 495–501 |
| Page subtitle (SymbolLibrary) | `SymbolLibrary.tsx` | 503–511 |
| Section h2 "ISA-101 Equipment Shapes" | `SymbolLibrary.tsx` | 519–524 |
| Section h2 "Custom Shapes" | `SymbolLibrary.tsx` | 335–344 |
| Category card label | `SymbolLibrary.tsx` | 97–103 |
| Category card description | `SymbolLibrary.tsx` | 119–126 |
| Page breadcrumb "Designer" link | `DesignerGraphicsList.tsx` | 899–912 |
| Breadcrumb separator "/" | `DesignerGraphicsList.tsx` | 913 |
| Page breadcrumb "Process Graphics" (current) | `DesignerGraphicsList.tsx` | 914–922 |
| GraphicCard name | `DesignerGraphicsList.tsx` | 439–449 |
| GraphicCard description | `DesignerGraphicsList.tsx` | 453–467 |
| GraphicCard timestamp | `DesignerGraphicsList.tsx` | 469–479 |
| DeleteDialog h3 "Delete Graphic" | `DesignerGraphicsList.tsx` | 583–590 |
| DeleteDialog body text | `DesignerGraphicsList.tsx` | 592–606 |
| DesignerHome "Designer" subtitle | `DesignerHome.tsx` | 44–54 |
| NewGraphicDialog title | `index.tsx` | 259–271 |
| NewGraphicDialog form labels (`labelStyle`) | `index.tsx` | 223–231 |
| DesignerImport form `label` style | `DesignerImport.tsx` | 55–62 |
| DesignerImport step indicator labels | `DesignerImport.tsx` | 149–163 |
| Mode tab labels ("Graphic" / "Dashboard" / "Report") | `DesignerModeTabs.tsx` | 219–267 |
| File dropdown trigger "File" | `DesignerModeTabs.tsx` | 313–314 |
| Tab bar labels (graphic name) | `DesignerTabBar.tsx` | 195–204 |
| StatusBar segment labels | `DesignerStatusBar.tsx` | 174–184 |
| TEST MODE label | `DesignerStatusBar.tsx` | 319–325 |

**Visual properties actually applied (concrete values):**

**Page-level headers:**

| Element | Tag | fontSize | weight | color |
|---|---|---|---|---|
| "Symbol Library" h1 | `<h1>` | "20px" | 700 | `var(--io-text-primary)` |
| "Custom Shapes" h2 | `<h2>` | "16px" | 700 | `var(--io-text-primary)` |
| "ISA-101 Equipment Shapes" h2 | `<h2>` | "15px" | 600 | `var(--io-text-primary)` |
| "Process Graphics" breadcrumb | `<span>` | 14 | 600 | `var(--io-text-primary)` |
| DeleteDialog "Delete Graphic" h3 | `<h3>` | 16 | 600 | `var(--io-text-primary)` |

**Form / dialog titles:**

| Element | fontSize | weight | color |
|---|---|---|---|
| NewGraphicDialog title | 15 | 600 | `var(--io-text-primary)` |

**Uppercase form field labels:**

| Location | fontSize | weight | color | transforms |
|---|---|---|---|---|
| `index.tsx labelStyle` | 11 | 600 | `var(--io-text-muted)` | uppercase, 0.05em letter-spacing, marginBottom 4 |
| `DesignerImport label` style | 12 | 600 | `var(--io-text-muted)` | uppercase, 0.05em letter-spacing, marginBottom 6 |

**Subtitle / descriptive text:**

| Element | fontSize | color | notes |
|---|---|---|---|
| DesignerHome "Designer" subtitle | 13 | `var(--io-text-muted)` | letterSpacing 0.03em |
| SymbolLibrary page subtitle | "13px" | `var(--io-text-secondary)` | — |
| SymbolLibrary "Custom Shapes" subtitle | "12px" | `var(--io-text-secondary)` | below h2 |

**Breadcrumb:**

| Element | fontSize | weight | color |
|---|---|---|---|
| "Designer" link | 13 | — | `var(--io-text-muted)` |
| "/" separator | 13 | — | `var(--io-border)` |
| "Process Graphics" (current) | 14 | 600 | `var(--io-text-primary)` |

**Card content labels:**

| Element | fontSize | weight | color |
|---|---|---|---|
| GraphicCard name | 14 | 600 | `var(--io-text-primary)` |
| GraphicCard description | 12 | — | `var(--io-text-muted)` |
| GraphicCard timestamp | 11 | — | `var(--io-text-muted)` |
| CategoryCard label | "14px" | 600 | `var(--io-text-primary)` |
| CategoryCard description | "12px" | — | `var(--io-text-secondary)` |

**Navigation / toolbar labels:**

| Element | fontSize | weight | color |
|---|---|---|---|
| Mode tab label (active) | 13 | 500 | `var(--io-text-primary)` |
| Mode tab label (inactive) | 13 | 400 | `var(--io-text-secondary)` |
| Mode tab icon (◆/▦) | 11 | — | inherited |
| Mode tab icon (📄) | 13 | — | inherited |
| File dropdown trigger "File" | 13 | — | `var(--io-text-secondary)` |
| Tab bar label (active) | 12 | 600 | `var(--io-text-primary)` |
| Tab bar label (inactive) | 12 | 400 | `var(--io-text-secondary)` |
| StatusBar segment text | 11 | — | `var(--io-text-secondary)` |
| TEST MODE label | inherited | 600 | `#4ade80` (hardcoded) |

**DesignerImport step indicator labels:**
- Active step: `fontSize: 12`, `fontWeight: 600`, `color: "var(--io-text-primary)"`
- Done step: `fontSize: 12`, `fontWeight: 400`, `color: "var(--io-text-secondary, #475569)"` (with light-theme fallback)
- Future step: `fontSize: 12`, `fontWeight: 400`, `color: "var(--io-text-muted)"`

**Deviations from app shell:**

1. **Section header sizes are inconsistent within SymbolLibrary.** "Custom Shapes" h2 is 16px/weight 700 while "ISA-101 Equipment Shapes" h2 is 15px/weight 600 — same file, same semantic level, different values. There is no size/weight convention for section headings.

2. **Uppercase form label duplicated with divergent values.** `index.tsx labelStyle` (11px, marginBottom 4) and `DesignerImport label` (12px, marginBottom 6) serve the same purpose (uppercase section label above a form field) but are not shared and differ in font size and bottom margin. A third instance of the same pattern appears in `DesignerImport.tsx`'s rendered form body.

3. **Subtitle text color uses different token tiers for the same semantic role.** DesignerHome "Designer" subtitle (`--io-text-muted`, #71717a) vs SymbolLibrary page subtitle (`--io-text-secondary`, #a1a1aa) — both are 13px descriptive text directly beneath a page-level heading.

4. **No `--io-text-*` scale tokens used anywhere.** All font sizes are bare pixel integer literals (11, 12, 13, 14, 15, 16, 20) or string literals with units ("14px", "12px" in SymbolLibrary). The registered token scale (`--io-text-xs: 12px`, `--io-text-sm: 13px`, `--io-text-label: 12px`, `--io-text-label-sm: 11px`) is never referenced. Consistent with the finding in category 2.

5. **Heading element inconsistency.** SymbolLibrary uses semantic `<h1>`/`<h2>` tags. DesignerGraphicsList "Process Graphics" uses `<span>`. NewGraphicDialog title is a `<div>`. DeleteDialog uses `<h3>`. No module-level convention for when to use semantic vs presentational elements.

6. **Mixed font-size notation in SymbolLibrary.** CategoryCard uses `fontSize: "14px"` and `"12px"` (string with CSS unit), while all other Designer shell files use bare integer literals (`14`, `12`). React inline styles accept both; the inconsistency is within the same file subtree.

7. **DesignerImport step indicator includes a light-theme fallback directly in JSX** (`color: "var(--io-text-secondary, #475569)"`) — the only instance in the shell files where a token fallback specifies a light-theme value. `#475569` is a slate-gray that would be correct in light mode but is inconsistent with how other files handle fallbacks (which use dark-mode hex values as fallbacks).

**Notes:** The DesignerHome "Designer" subtitle at DesignerHome.tsx:44–54 is a module identifier label, not a page heading — it appears on the splash screen when no graphic is open. No toolbar or mode-tab bar renders visible section titles or headers; all labeling at the toolbar level is handled via icon tooltips (`title` attributes) rather than visible text labels.
