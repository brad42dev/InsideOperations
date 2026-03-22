---
id: DD-11-002
title: Wire typst-as-lib for real PDF generation (not HTML fallback)
unit: DD-11
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a user generates a report in PDF format, the output must be a genuine PDF binary rendered by the Typst engine (`typst-as-lib` MIT-licensed crate). Currently the `typst-pdf` feature flag exists but the `typst-as-lib` crate is not in Cargo.toml, so the PDF path produces an HTML document served with a `.pdf` extension. This is a spec gap because browsers then mis-display the file.

## Spec Excerpt (verbatim)

> **PDF**: Via Typst engine (`typst-as-lib`, MIT) — branded templates, page-spanning tables, embedded charts
> — design-docs/11_REPORTS_MODULE.md, §Export Formats

> PDF: Typst (`typst-as-lib`, MIT)
> — design-docs/11_REPORTS_MODULE.md, §Export Libraries

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/Cargo.toml` — dependencies section; `typst-as-lib` is absent; feature flag `typst-pdf = []` exists at line 51
- `services/api-gateway/src/report_generator.rs` — `generate_pdf_report()` at line 1254; `build_typst_template()` at line 1289; `compile_typst_pdf()` function (if it exists) gated behind `#[cfg(feature = "typst-pdf")]`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `typst-as-lib` appears in `[dependencies]` section of `services/api-gateway/Cargo.toml` with an appropriate version
- [ ] The `typst-pdf` feature in Cargo.toml includes `typst-as-lib` in its dependency list (not just an empty feature flag)
- [ ] `compile_typst_pdf()` function exists and calls `typst_as_lib::compile()` or the equivalent API
- [ ] `generate_pdf_report()` at line 1254 returns actual PDF bytes (binary PDF, not HTML) when the feature is enabled
- [ ] `format_to_content_type()` returns `"application/pdf"` for the `"pdf"` format key (currently returns `text/html`)

## Assessment

After checking:
- **Status**: ❌ Missing — `typst-as-lib` not in Cargo.toml; PDF produces HTML with .pdf extension

## Fix Instructions

**Step 1 — Add the dependency.** In `services/api-gateway/Cargo.toml`, add under `[dependencies]`:
```toml
typst-as-lib = { version = "0.6", optional = true }
```
Then update the feature flag at line 51:
```toml
typst-pdf = ["dep:typst-as-lib"]
```

**Step 2 — Implement `compile_typst_pdf`.** In `report_generator.rs`, add the gated function after `build_typst_template()`:
```rust
#[cfg(feature = "typst-pdf")]
fn compile_typst_pdf(
    title: &str,
    headers: &[String],
    rows: &[Vec<String>],
) -> Result<Vec<u8>, String> {
    let source = build_typst_template(title, headers, rows);
    typst_as_lib::TypstEngine::default()
        .compile_string(&source)
        .map_err(|e| format!("Typst compilation error: {e:?}"))
}
```
Adjust to match the actual `typst-as-lib` API for the version chosen.

**Step 3 — Fix content type.** In `format_to_content_type()` at line 559, change the PDF arm:
```rust
"pdf" => ("application/pdf", "pdf"),
```
Currently it falls through to the `_` arm which returns `text/html`.

**Step 4 — Enable the feature.** Build the api-gateway with `--features typst-pdf` in the Makefile or `.cargo/config.toml`. For the v0.7 installer, this is the phase when PDF is required.

**Step 5 — Verify `build_typst_template`.** The existing `build_typst_template()` at line 1289 already generates valid Typst source. Verify it compiles without errors against the Typst version bundled in `typst-as-lib`.

Do NOT:
- Use browser-based PDF generation (window.print, html2canvas, pdfmake) — spec requires server-side Typst
- Use GPL/LGPL PDF libraries (report must remain MIT/Apache/BSD licensed)
- Delete the HTML fallback in `generate_pdf_report()` — keep it for when the feature flag is disabled in development
