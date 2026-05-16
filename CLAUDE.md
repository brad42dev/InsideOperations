# Inside/Operations

Industrial control / SCADA-style web app. Rust backend (11 services + API gateway), TypeScript/React frontend (Vite), PostgreSQL + TimescaleDB.

## Project map
- `docs/PROJECT_REFERENCE.md` — tech stack, modules, services, design-doc index. Update when any of it changes.
- `frontend/` — React app, Vite dev server on :5173
- `crates/` — Rust workspace, all backend services
- `design-docs/` and `/home/io/spec_docs/` — **historical, not maintained**. Code is authority. See `design-docs/ARCHIVE.md` and `spec_docs/ARCHIVE.md`. Exception: `design-docs/shape-sidecar-spec/` is current.
- `docs/SPEC_MANIFEST.md` — audit status per unit, non-negotiables, false-DONE patterns
- `docs/decisions/` — current decision files (from `/design-qa`)
- `docs/tasks/` — task files for verified gaps

## Authority docs (current)
| Doc | Authority over |
|-----|----------------|
| `design-docs/03` | RBAC — 118 permissions, 8 roles |
| `design-docs/04` | Schema — DDL, indexes, triggers, seed data |
| `design-docs/05` | Build order — 17 phases |
| `design-docs/37` | Wire formats — inter-service messages, REST envelope, errors |

## Invariants — do not violate without explicit approval

1. **Point identity: UUID internal, tagname external.** Frontend never uses raw UUID as a point identifier. All bindings carry `pointTag` or `pointId` (resolved only). Resolution: `resolvedTagMap` in `SceneRenderer` + `POST /api/points/resolve-tags`. No fallback path skips resolution. If resolution fails → error/offline state, never silent bind. The one exception: `data-point-id` SVG attributes carry resolved UUIDs (WS wire format is UUID-keyed). Do not add user-facing APIs that take/display raw UUIDs.

2. **Licenses.** Dependencies must be MIT, Apache-2.0, BSD, ISC, PostgreSQL, or MPL-2.0. No GPL/AGPL/LGPL/copyleft. When in doubt, don't add it.

3. **Historical specs are not authoritative.** When working in a module covered by a spec in `design-docs/` or `spec_docs/`, skim for non-negotiables and architectural intent, but verify every specific against current code before acting on it.

## Building and running
- `./dev.sh` — start/stop/restart/status/health/logs/build for the full stack. Run `./dev.sh` with no args for usage.
- Frontend dev server: `cd frontend && pnpm dev`
- Tests: `cargo test [-p <crate>]` and `pnpm test` in `frontend/`
- Lint must be clean: `cargo clippy -- -D warnings` and `pnpm lint`

### Environment gotchas
- **`BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include"`** is required for any `cargo build` touching `samael`. `dev.sh` sets this; one-off `cargo` invocations need it exported.
- **Never use `pkill -f "target/debug"`** — exit 144 kills the shell. Use `pgrep -af target/debug` + `kill <pid>` individually.

## Audit workflow
- `/design-qa <contract>` — discover implementations, Q&A, write decision file
- `/audit <unit-id>` — verify code against spec, produce task files for gaps
- Wave 0 cross-cutting contracts (apply to all modules): see `docs/SPEC_MANIFEST.md`

## Codebase quirks (pointers, not copies)
- `point_meta.tagname` — one word, no underscore. API returns `tagname`.
- `position: fixed` inside `react-grid-layout` breaks (CSS transforms). Use `createPortal(el, document.body)`. See `frontend/src/shared/graphics/` for established pattern.
- Designer scope lives at `doc.metadata.graphicScope`, not `doc.scope`.
- `aggregation_types = 0` means *unrestricted*, not "none". Wrong context = HTTP 400.
- TimescaleDB continuous aggregates: `materialized_only=true` default; `CALL refresh_continuous_aggregate(...)` after `TRUNCATE`.

## Admin / DB (local dev)
`admin` / `changeme` · `postgresql://io:io_password@localhost:5432/io_dev`
