---
id: DD-34-001
title: Parse manifest.json, tags.json, and import_report.json from extraction kit ZIP
unit: DD-34
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a customer uploads an extraction kit `.zip` to the DCS import endpoint, the service should read the three metadata files that every compliant kit must include: `manifest.json` (platform identity, display count, extraction date), `tags.json` (consolidated tag/point reference list), and `import_report.json` (extraction warnings and statistics). This information is needed by the wizard to show the user what platform was detected and how many tags were extracted, and to drive the tag mapping step.

## Spec Excerpt (verbatim)

> **Kit output:** A `.zip` file containing:
> - `manifest.json` — platform type, version, extraction date, display count
> - Per-display files (SVG, XML, or JSON depending on platform)
> - `tags.json` — consolidated tag/point reference list extracted from all displays
> - `import_report.json` — extraction warnings, skipped elements, statistics
>
> The customer uploads this `.zip` to I/O's Designer import wizard.
> — `34_DCS_GRAPHICS_IMPORT.md`, §Customer-Run Extraction Kit

## Where to Look in the Codebase

Primary files:
- `services/parser-service/src/handlers/dcs_import.rs` — `parse_zip()` function at line 498: currently reads only `display.json` and `.svg` files, ignores `manifest.json`/`tags.json`/`import_report.json`
- `frontend/src/api/dcsImport.ts` — `DcsImportResult` type at line 40: missing fields for `tags`, `manifest`, `import_warnings`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `parse_zip()` in `dcs_import.rs` reads `manifest.json` from the ZIP and extracts `platform`, `version`, `display_count`
- [ ] `parse_zip()` reads `tags.json` and returns the tag list as part of `DcsImportResult`
- [ ] `parse_zip()` reads `import_report.json` and surfaces warnings in the result
- [ ] `DcsImportResult` struct has fields for `tags: Vec<String>`, `manifest_platform: Option<String>`, `import_warnings: Vec<String>`
- [ ] Platform detected from `manifest.json` takes precedence over the `platform` multipart field

## Assessment

- **Status**: ❌ Missing
- `parse_zip()` at `dcs_import.rs:498–583` searches the archive for `display.json` and `.svg` files only. There is no code that opens `manifest.json`, `tags.json`, or `import_report.json`. `DcsImportResult` has no `tags` or `import_warnings` fields.

## Fix Instructions

In `services/parser-service/src/handlers/dcs_import.rs`:

1. Add three new fields to `DcsImportResult` (line 35):
   ```rust
   pub tags: Vec<String>,
   pub manifest_platform: Option<String>,
   pub import_warnings: Vec<String>,
   ```

2. In `parse_zip()`, do a single pass over the archive to collect content for all four file types: `manifest.json`, `display.json`, `tags.json`, `import_report.json`, and any `.svg` files. Currently only `display.json` and `.svg` are collected.

3. After collecting, parse `manifest.json` as:
   ```json
   { "platform": "...", "version": "...", "extraction_date": "...", "display_count": N }
   ```
   Store `platform` from manifest as `manifest_platform`.

4. Parse `tags.json` as `Vec<String>` (or `Vec<{ tag: String, ... }>`) and store the tag names in the `tags` field.

5. Parse `import_report.json` and extract `warnings: Vec<String>` into `import_warnings`.

6. Populate the three new fields in the returned `DcsImportResult`.

7. Update `DcsImportResult` in `frontend/src/api/dcsImport.ts` to add matching TypeScript fields:
   ```typescript
   tags: string[]
   manifest_platform: string | null
   import_warnings: string[]
   ```

Do NOT:
- Remove the existing `platform` field from the result — the caller still needs it
- Change the ZIP reading from synchronous to async (keep it synchronous in `parse_zip`)
- Fail the request if `tags.json` or `import_report.json` are absent — they should be optional
