# Inside/Operations — Claude Working Instructions

**Project reference** (tech stack, modules, services, design-doc index): `docs/PROJECT_REFERENCE.md`
Update that file when any of it changes — the design-docs in `design-docs/` are frozen at initial commit.

---

## Specs and Design Docs — Historical Archive

Both `design-docs/` and `/home/io/spec_docs/` are **historical**. They describe original design intent but have not been maintained as the codebase evolved. **The code is the authority.**

See `design-docs/ARCHIVE.md` and `spec_docs/ARCHIVE.md` for details.

**Exception:** `design-docs/shape-sidecar-spec/` is actively maintained and current.

They're still worth a skim when working in a covered module for the first time — non-negotiables and architectural constraints are mostly still valid. But verify against the actual code before acting on specifics.

**`docs/SPEC_MANIFEST.md`** tracks audit status per unit. **`docs/decisions/`** has current decision files.

---

## Licensing (CRITICAL)

All dependencies must be licensed for royalty-free commercial use: MIT, Apache 2.0, BSD, ISC, PostgreSQL, MPL 2.0.
**Prohibited:** GPL, AGPL, LGPL, or any copyleft license. When in doubt, don't use it.

---

## Dev Environment

```bash
# Start everything (DB + all 11 services)
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" ./dev.sh start

# Frontend dev server (separate terminal)
cd frontend && pnpm dev          # Vite on port 5173

# Other dev.sh commands
./dev.sh stop / restart / status / health
./dev.sh logs [service-name]
./dev.sh build                   # rebuild + restart running services
```

> **Build gotcha:** `BINDGEN_EXTRA_CLANG_ARGS` is required on this machine — clang-18 runtime is installed but not its headers. Any `cargo build` that touches the `samael` crate will fail without it.

> **Kill gotcha:** `pkill -f "target/debug"` exits 144 (kills the shell). Use `pgrep -af target/debug` to find PIDs and `kill <pid>` individually.

---

## Build Commands (individual)

```bash
# Backend (from repo root)
cargo build                          # all workspace crates
cargo build -p io-api-gateway        # specific service
cargo test / cargo test -p <crate>
cargo clippy -- -D warnings          # must be clean

# Frontend (from frontend/)
pnpm build / pnpm test / pnpm lint

# Database
docker compose up -d                 # start PostgreSQL + TimescaleDB
sqlx migrate run                     # apply pending migrations
```

Admin login: `admin` / `changeme`
DB: `postgresql://io:io_password@localhost:5432/io_dev`

---

## Authority Documents

| Doc | Authority over |
|-----|---------------|
| `design-docs/03` | RBAC — 118 permissions, 8 roles, all permission names |
| `design-docs/04` | Schema — all table DDL, indexes, triggers, seed data |
| `design-docs/05` | Build order — 17 phases, what ships when |
| `design-docs/37` | Wire formats — inter-service message shapes, REST envelope, error codes |

---

## Audit System

```
/design-qa <contract>   → discover implementations, Q&A, write decision file
/audit <unit-id>        → verify code against spec, produce task files for gaps
```

- `docs/SPEC_MANIFEST.md` — all audit units, non-negotiables, false-DONE patterns
- `docs/decisions/` — decision files from `/design-qa` sessions
- `docs/tasks/` — task files for verified gaps

**Wave 0 cross-cutting contracts** (apply to ALL modules):
`CX-EXPORT`, `CX-POINT-CONTEXT`, `CX-ENTITY-CONTEXT`, `CX-CANVAS-CONTEXT`,
`CX-POINT-DETAIL`, `CX-PLAYBACK`, `CX-RBAC`, `CX-ERROR`, `CX-LOADING`, `CX-EMPTY`, `CX-TOKENS`, `CX-KIOSK`

---

## Known Gotchas

- **`point_meta.tagname`** — no underscore. The field is `tagname`, not `tag_name`. API always returns `tagname`.
- **`position: fixed` in react-grid-layout** — breaks due to CSS transforms. Use `createPortal(el, document.body)` instead.
- **Designer `graphicScope`** — stored in `doc.metadata.graphicScope`, not `doc.scope`.
- **`aggregation_types = 0`** means unrestricted (all types allowed), not "no aggregations". Sending 0 in the wrong context caused HTTP 400 on all charts.
- **TimescaleDB continuous aggregates** — `materialized_only=true` by default; manual `CALL refresh_continuous_aggregate(...)` required after `TRUNCATE`.
