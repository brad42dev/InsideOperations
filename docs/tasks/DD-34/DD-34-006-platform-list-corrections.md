---
id: DD-34-006
title: Correct platform list — add missing platforms, remove non-spec platform
unit: DD-34
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

Both the frontend platform list (`dcsImport.ts`) and the backend platform validator (`dcs_import.rs`) contain `aspentech_aspen`, which is not in the spec's 12-platform list. They are also missing three platforms that are in the spec: `siemens_wincc_unified` (Platform #3 — separate from PCS7), `emerson_deltav_operate` (Platform #7 — legacy DeltaV with EMF reference overlay path), and `valmet_dna` (Platform #12 — TBD status). This mismatch means the frontend offers an unsupported option and hides three supported ones.

## Spec Excerpt (verbatim)

> | # | Platform | ... |
> | 3 | **Siemens WinCC Unified** | ... SVG + custom namespace |
> | 7 | **Emerson DeltaV Operate** | ... `.grf` binary (frozen iFIX v3.0) |
> | 12 | **Valmet DNA** | ... Engineering database |
>
> Note: WinCC Unified is distinct from WinCC Classic / PCS 7 (#10). The `dcs_siemens` module covers WinCC Unified only.
> — `34_DCS_GRAPHICS_IMPORT.md`, §Platform Feasibility Matrix

## Where to Look in the Codebase

Primary files:
- `frontend/src/api/dcsImport.ts` — `PLATFORMS` array at line 72; `DcsPlatform` type at line 50
- `services/parser-service/src/handlers/dcs_import.rs` — `is_valid_platform()` at line 415, `platform_display_name()` at line 397

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `DcsPlatform` type in `dcsImport.ts` does NOT include `aspentech_aspen`
- [ ] `DcsPlatform` type includes `siemens_wincc_unified`, `emerson_deltav_operate`, `valmet_dna`
- [ ] `PLATFORMS` array has entries for all three missing platforms with appropriate `support` values (`'full'`/`'kit'`/`'tbd'`)
- [ ] `is_valid_platform()` in `dcs_import.rs` does NOT include `aspentech_aspen`
- [ ] `is_valid_platform()` includes `siemens_wincc_unified`, `emerson_deltav_operate`, `valmet_dna`
- [ ] `platform_display_name()` returns correct strings for all three new platforms

## Assessment

- **Status**: ⚠️ Wrong
- `dcsImport.ts:50` includes `aspentech_aspen` (not in spec). Missing: `siemens_wincc_unified`, `emerson_deltav_operate`, `valmet_dna`. Same errors in `dcs_import.rs:415–430`.

## Fix Instructions

**In `frontend/src/api/dcsImport.ts`:**

1. In the `DcsPlatform` type (line 50), remove `'aspentech_aspen'` and add:
   - `'siemens_wincc_unified'`
   - `'emerson_deltav_operate'`
   - `'valmet_dna'`

2. In the `PLATFORMS` array (line 72), remove the `aspentech_aspen` entry and add:
   ```typescript
   {
     id: 'siemens_wincc_unified',
     name: 'Siemens WinCC Unified',
     support: 'kit',
     description: 'SVG with Siemens namespace extensions — TIA Portal Openness API export',
   },
   {
     id: 'emerson_deltav_operate',
     name: 'Emerson DeltaV Operate (Legacy)',
     support: 'kit',
     description: 'EMF reference overlay — assisted manual recreation, not full conversion',
   },
   {
     id: 'valmet_dna',
     name: 'Valmet DNA',
     support: 'tbd',
     description: 'Pending hands-on evaluation — most opaque platform studied',
   },
   ```

**In `services/parser-service/src/handlers/dcs_import.rs`:**

1. In `is_valid_platform()` (line 415), remove `"aspentech_aspen"` and add:
   - `"siemens_wincc_unified"`
   - `"emerson_deltav_operate"`
   - `"valmet_dna"`

2. In `platform_display_name()` (line 397), remove the `"aspentech_aspen"` arm and add:
   ```rust
   "siemens_wincc_unified" => "Siemens WinCC Unified",
   "emerson_deltav_operate" => "Emerson DeltaV Operate (Legacy)",
   "valmet_dna" => "Valmet DNA",
   ```

3. Update the error message string in `dcs_import()` (line 486) listing valid platforms to match.

Do NOT:
- Change the existing `"siemens_pcs7"` platform identifier — that remains for PCS 7/WinCC Classic
- Implement parsers for the new platforms in this task — they all return `stub_result()` for now
