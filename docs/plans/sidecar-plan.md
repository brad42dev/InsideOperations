# Sidecar Architecture Plan — Phase Index

Seven self-contained phases. Each phase file contains everything needed to implement it
cold — read the file, execute the steps, verify the checklist.

**Kickoff pattern:** `read docs/plans/sidecar-phase-N.md and implement it`
Change `N` to the next phase number. That's it.

Phases must be executed in order. Each phase depends on the one before it (exceptions noted).

---

## Phase Table

| Phase | File | Summary | Depends On |
|-------|------|---------|------------|
| 1 | [sidecar-phase-1.md](sidecar-phase-1.md) | Fix io-shape-v1.schema.json — add 5 missing fields | — |
| 2 | [sidecar-phase-2.md](sidecar-phase-2.md) | Add sidecar_hash + svg_hash content hashing infrastructure | Phase 1 |
| 3 | [sidecar-phase-3.md](sidecar-phase-3.md) | Validate sidecar JSON against schema on write | Phases 1, 2 |
| 4 | [sidecar-phase-4.md](sidecar-phase-4.md) | Add hashes to thin iographic export manifest | Phase 2 |
| 5 | [sidecar-phase-5.md](sidecar-phase-5.md) | Full iographic export + smart import with ownership rules | Phase 4 |
| 6 | [sidecar-phase-6.md](sidecar-phase-6.md) | Fix compositeAttachment coordinates + bodyBase values | Phase 1 |
| 7 | [sidecar-phase-7.md](sidecar-phase-7.md) | Enforce append-only IDs in dev.sh shapes import | Phase 2 |

Note: Phase 6 only requires Phase 1. It can be done in parallel with Phases 2–5 if needed.

---

## Architecture Decisions (locked — do not re-litigate)

- **DB is source of truth.** Sidecars live in `design_objects.metadata->'sidecar'` JSONB. No file-based runtime path.
- **Validation on write.** Use `jsonschema` crate (MIT). Return HTTP 422 with error list on invalid sidecar.
- **Content hashing.** `sidecar_hash` = SHA-256 of RFC 8785 canonical JSON (keys sorted recursively, no whitespace). `svg_hash` = SHA-256 of SVG bytes with `\n` line endings. Both stored in `design_objects.metadata`. Hashes are content-based and deterministic across all IO systems.
- **iographic thin vs full.** Thin (default): shape_id refs + hashes for staleness detection. Full: embeds complete SVG + sidecar + hashes per shape; on import, hash-match each shape with ownership rules.
- **Library shapes are immutable to all user actions.** No user-facing operation (including full iographic import) can modify or delete a library shape. Full import of a mismatched library shape creates a user copy named `{shape_id}.imported`.
- **Append-only IDs.** Once an addon ID, connection ID, or bindableParts key ships, it cannot be removed. `dev.sh shapes import` enforces this unless `--force` is passed.
- **Schema fix prerequisite.** Phase 1 must run before Phase 3 validation is enabled — the current schema would reject valid shapes.

---

## Related Files

- `docs/architecture/shape-system.md` — shape storage architecture (DB source of truth confirmed)
- `docs/architecture/before-release.md` — stencil wizard, anchorSlots population, forPart docs (deferred)
- `design-docs/shape-sidecar-spec/` — authoritative sidecar spec (actively maintained)
