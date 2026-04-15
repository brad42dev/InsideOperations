# design-docs — Historical Archive

> **These documents are historical.** They were written at project inception and have not been maintained as the codebase evolved. They describe original design intent, not current implementation.

**Do not treat these as authoritative for current development.**

- The code is the authority for what's actually built.
- `docs/PROJECT_REFERENCE.md` is the current tech stack and service reference.
- `docs/SPEC_MANIFEST.md` tracks audit status per module.
- `docs/decisions/` contains current decision files.

## Exception

**`design-docs/shape-sidecar-spec/`** is actively maintained and current. It is not archived.

## Also archived (not active workflow)

- `GAP_ANALYSIS.md` — gap sweep from 2026-03-17/18, mostly resolved. Superseded by `comms/tasks.db` and `docs/tasks/`.
- `DESIGNER_WORK_QUEUE.md` — one-off feedback doc from 2026-03-16. Work completed or absorbed into tasks.

The active orchestration workflow is: `comms/tasks.db` → `docs/tasks/` → `docs/decisions/`.

## What these docs are still useful for

Reading them gives useful design intent and context when building new features — just don't assume they reflect what was actually implemented. Where the code and these docs conflict, the code wins.

---

*Frozen as of initial commit. 765+ commits of development have occurred since.*
