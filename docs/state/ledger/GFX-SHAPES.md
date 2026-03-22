GFX-SHAPES-001 | Complete JSON sidecar schema — add all required fields to every shape sidecar | verified 2026-03-21 | commit a320c57 | npx tsc --noEmit | PASS
GFX-SHAPES-002 | Add .io-stateful class to body elements in 101 SVG files missing it | verified 2026-03-21 | commit a320c57 | npx tsc --noEmit | PASS
GFX-SHAPES-004 | Fix batch shapes endpoint — URL mismatch, payload field name, and missing sidecar data in response | verified 2026-03-21 | commit a320c57 | cargo build --package api-gateway + npx tsc --noEmit | PASS
GFX-SHAPES-007 | Fix seed_shapes.rs shape IDs to match canonical sidecar IDs | verified 2026-03-22 | commit c462120 | cargo build -p api-gateway | PASS
GFX-SHAPES-003 | Add mandatory data-io-version and data-io-category attributes to all SVGs | verified 2026-03-22 | commit e3cf10a | npx tsc --noEmit | PASS
