# Architecture — Authoritative Reference

This directory contains the current, maintained architecture documentation for the I/O platform. These documents reflect how the system actually works (or is definitively planned to work). They are updated as decisions are made and implementations complete.

**This is the place to look first.** If something in here conflicts with `design-docs/`, this wins. `design-docs/` is a historical archive of original design intent and has not been kept current with the codebase.

---

## Documents

| File | Covers |
|------|--------|
| [shape-system.md](shape-system.md) | Shape library: storage, access, immutability, update workflow, snapshot backup |

---

## How to maintain this directory

- When a significant architectural decision is finalized, update or add the relevant document here.
- Decisions (the "why") belong in `docs/decisions/`. Architecture docs (the "what and how") belong here.
- Keep these documents current. A stale architecture doc is worse than no doc — it misleads future work.
- When a document here conflicts with a `design-docs/` file, note the conflict in the architecture doc and leave `design-docs/` alone (it is frozen).
