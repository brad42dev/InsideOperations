---
id: DD-34-002
title: Implement per-platform DCS parser modules for Phase 1 platforms
unit: DD-34
status: pending
priority: medium
depends-on: [DD-34-001]
---

## What This Feature Should Do

The spec defines named parser modules within the parser service, one per DCS vendor platform. Each module takes a platform-specific file (SVG with namespace attributes, XAML, XML, ASCII `.g` file) and produces the common intermediate representation. The three Phase 1 platforms (GE iFIX SVG, Rockwell FactoryTalk XML, Siemens WinCC Unified SVG) should be implemented first as they involve the least parsing complexity. Currently the service has no per-platform modules at all.

## Spec Excerpt (verbatim)

> ```
> Parser Service
> ├── svg_parser         (existing — raw SVG import)
> ├── dcs_honeywell      (HMIWeb .htm parser)
> ├── dcs_emerson        (DeltaV Live SVG/SQL parser)
> ├── dcs_yokogawa       (XAML parser)
> ├── dcs_siemens        (WinCC Unified SVG parser)
> ├── dcs_rockwell       (FactoryTalk XML parser)
> ├── dcs_ge             (iFIX SVG parser)
> ├── dcs_aveva          (InTouch XML parser)
> ├── dcs_foxboro        (ASCII .g parser)
> ├── dcs_abb            (800xA — future)
> └── dcs_valmet         (DNA — future)
> ```
> — `34_DCS_GRAPHICS_IMPORT.md`, §Import Service Integration

> **Phase 1 — High-Value, Low-Effort (Development Phases 12-13)**
> GE iFIX, Rockwell FactoryTalk, Siemens WinCC Unified
> — `34_DCS_GRAPHICS_IMPORT.md`, §Implementation Phasing

## Where to Look in the Codebase

Primary files:
- `services/parser-service/src/handlers/` — only `dcs_import.rs` and `parse.rs` exist; no `dcs_ge.rs`, `dcs_rockwell.rs`, `dcs_siemens.rs` etc.
- `services/parser-service/src/handlers/dcs_import.rs` — `parse_zip()` at line 498 handles all platforms uniformly via generic JSON/SVG fallback

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `services/parser-service/src/handlers/dcs_ge.rs` exists and parses iFIX SVG output: reads standard SVG elements, extracts tag references from `.xtg` sidecar in ZIP
- [ ] `services/parser-service/src/handlers/dcs_rockwell.rs` exists and parses FactoryTalk XML: reads `<gfx>` root element, maps FactoryTalk object types to intermediate format
- [ ] `services/parser-service/src/handlers/dcs_siemens.rs` exists and parses WinCC Unified SVG: strips `siemens:*` namespace, extracts tag bindings from `siemens:*` attributes
- [ ] `parse_zip()` dispatches to the appropriate per-platform parser based on the `platform` field
- [ ] Each per-platform parser returns `Vec<DcsElement>` using the common intermediate representation

## Assessment

- **Status**: ❌ Missing
- `services/parser-service/src/handlers/` contains only `dcs_import.rs` and `parse.rs`. No per-platform files exist. The `parse_zip()` function at line 498 handles all platform values identically — it looks for `display.json` or `.svg` files regardless of platform.

## Fix Instructions

Create three new files in `services/parser-service/src/handlers/`:

**`dcs_ge.rs`** — GE iFIX SVG parser:
- Input: raw SVG bytes (from ZIP via `parse_zip` dispatch)
- Uses the existing `parse_svg_from_bytes()` logic in `dcs_import.rs` as a starting point
- Additional: look for `.xtg` files in the ZIP alongside the SVG; parse tag group references from XML
- Map `data-*` attributes on SVG elements to tag bindings in intermediate format
- Set `display_element_hint` based on element tag/attributes when possible

**`dcs_rockwell.rs`** — Rockwell FactoryTalk XML parser:
- Input: XML bytes with root element `<gfx>`
- Use `roxmltree` (already in Cargo.toml) to parse the XML
- Map FactoryTalk object types to `source_type` in intermediate format (e.g. `<AnalogDisplay>` → `bar_graph`)
- Extract tag binding expressions from element properties
- Output: `Vec<DcsElement>`

**`dcs_siemens.rs`** — Siemens WinCC Unified SVG parser:
- Input: SVG with `siemens:*` namespace attributes
- Parse SVG geometry (reuse `extract_svg_elements` logic)
- Additionally scan every element for attributes in the `siemens:` namespace
- Extract tag references from `siemens:tagName` or equivalent attributes
- Strip the namespace prefix when writing the final SVG path through

In `dcs_import.rs`, update `parse_zip()` to dispatch by platform:
```rust
match platform {
    "ge_proficy" => dcs_ge::parse(&zip_contents),
    "rockwell_factorytalk" => dcs_rockwell::parse(&zip_contents),
    "siemens_wincc_unified" => dcs_siemens::parse(&zip_contents),
    "generic_svg" => parse_svg_path(&zip_contents),
    "generic_json" => parse_intermediate_json_path(&zip_contents),
    _ => Ok(stub_result(platform)),
}
```

Add `pub mod dcs_ge; pub mod dcs_rockwell; pub mod dcs_siemens;` to `handlers/mod.rs`.

Do NOT:
- Remove the generic SVG/JSON paths — they remain for `generic_svg` / `generic_json` platforms
- Use the `quick-xml` crate unless it's already in the workspace; `roxmltree` is already available
- Mark Phase 2/3 platforms (Honeywell, Emerson, Yokogawa, AVEVA, Foxboro, PCS7) as done — stub them returning `stub_result(platform)`
