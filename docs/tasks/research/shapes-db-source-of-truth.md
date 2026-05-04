# Research & Plan: Make the DB the Source of Truth for Designer Shapes

This is a research-and-planning task file. When invoked, Claude should investigate the current shape-loading architecture, draft a concrete migration plan, and present it to the user for approval **before writing any code**.

---

## CONTEXT

### Problem Statement

The I/O designer's shape library (equipment stencils — valves, pumps, vessels, columns, agitators, etc.) is currently served entirely from static JSON + SVG files under `frontend/public/shapes/`. The DB has these shapes seeded into it (`design_objects` table, `type='shape'`, `source='library'`) but the frontend never reads from the DB at runtime for rendering.

Specifically: `shapeCache.ts:fetchShapes(ids, batchFetch?)` accepts an optional `batchFetch` callback. When `batchFetch` is `undefined`, the function falls through to `fetchShapesFromPublic()` which loads from `/shapes/<id>.json` static files. **No caller anywhere passes a `batchFetch`.** The DB-backed batch endpoint exists end-to-end but is dead code at runtime.

This is unacceptable because:

1. **Static files are not access-controlled** — anyone with server file access can edit them, bypassing RBAC.
2. **Static files can go missing or be corrupted** with no DB backup.
3. **Two sources of truth are already out of sync.** `frontend/public/shapes/*.json` (87 files on disk) versus `services/api-gateway/src/seed_shapes.rs` (66 shapes seeded inline as Rust string literals; missing `addons` and `compositeAttachments` fields entirely, and missing 21 shapes outright).
4. **No upgrade path.** New shapes added by users via designer would need DB persistence anyway; the runtime should already be DB-driven so that "library shape" and "user shape" share one path.

**Goal:** DB + code = source of truth. Static JSON files at most serve as a seed/build artifact, and ideally are deleted from the served bundle.

### Key Facts (verified by prior research)

#### Frontend — runtime rendering

- `frontend/src/shared/graphics/shapeCache.ts`
  - `fetchShapes(ids: string[], batchFetch?: (ids) => Promise<...>)` at line **136**.
  - When `batchFetch` is `undefined`, it skips straight to `fetchShapesFromPublic()` which `fetch()`es each `/shapes/<id>.json` individually.
  - Both call sites in `SceneRenderer.tsx` (lines **671** and **703**) pass no `batchFetch`. → DB path is unreachable at runtime.
  - Comment block at `SceneRenderer.tsx:668-670` documents *why* DB path was disabled: DB sidecars lack `addons` and `compositeAttachments` so renders are visually broken.

- `frontend/src/api/graphics.ts:88-92`
  - `batchShapes(ids: string[])` function — fully implemented, calls `POST /api/graphics/shapes/batch`.
  - **Never called anywhere in the frontend.** Pure dead code.

#### Frontend — designer palette / library UI

- `frontend/src/store/designer/libraryStore.ts:208` reads `/shapes/index.json` for the palette catalog.
- `frontend/src/store/designer/libraryStore.ts:326-327` reads individual `/shapes/<id>.json` for palette previews.
- Hardcoded `<img src="/shapes/...">` references (4 occurrences):
  - `DesignerLeftPalette.tsx:990`
  - `DesignerLeftPalette.tsx:1040`
  - `CategoryShapeWizard.tsx:204`
  - `CategoryShapeWizard.tsx:281`
  - `DesignerCanvas.tsx:9089`
  - These need a URL-shaped resource (image element `src` attr), so even if JSON moves to DB, an image-serving endpoint or inline SVG path is required.

#### Backend

- `services/api-gateway/src/handlers/graphics.rs:1305` — `batch_shapes` handler. Implemented, routed, wired through middleware. Verified to work but never invoked at runtime.
- `services/api-gateway/src/seed_shapes.rs` — seeds 66 shapes inline as Rust raw-string literals into `design_objects`. Missing `addons`, `compositeAttachments`, and 21 shapes vs. disk.

### Why This Is Tractable Now

The DB-backed read path is *already implemented end-to-end* — handler, route, frontend API client, cache layer hook. What's missing is:

1. The two SceneRenderer call sites passing `batchFetch`.
2. The seed data being correct/complete (or replaced by build-time generation from disk).
3. The palette UI switching to DB / API endpoint.
4. A decision about what happens to the `frontend/public/shapes/` tree after migration.

---

## EXECUTE

When this task file is read and executed, Claude must perform the following research and produce a written plan. **Do not write production code, edit `seed_shapes.rs`, edit `shapeCache.ts`, or edit `SceneRenderer.tsx` until the user has explicitly approved the plan.**

### Step 1 — Read the actual source

Read each of these files in full (no skimming, no `head` — `Read` the whole file or the relevant ±50 lines around the cited locations):

- `/home/io/io-dev/io/frontend/src/shared/graphics/shapeCache.ts` — entire file
- `/home/io/io-dev/io/frontend/src/scene/SceneRenderer.tsx` — at minimum lines 600–750, plus enough surrounding context to understand the call sites and the `// DB path disabled` comment
- `/home/io/io-dev/io/frontend/src/store/designer/libraryStore.ts` — entire file (or at minimum the palette-loading paths around lines 200 and 320)
- `/home/io/io-dev/io/frontend/src/api/graphics.ts` — entire file
- `/home/io/io-dev/io/services/api-gateway/src/seed_shapes.rs` — entire file
- `/home/io/io-dev/io/services/api-gateway/src/handlers/graphics.rs` — at minimum the `batch_shapes` handler and surrounding routing/middleware
- One full disk sidecar as ground truth, e.g. `/home/io/io-dev/io/frontend/public/shapes/agitators/agitator-turbine.json`
- `/home/io/io-dev/io/frontend/public/shapes/index.json` — to see palette catalog shape

Additionally:

- The Rust route registration that mounts `batch_shapes` (grep for `batch_shapes` in `services/api-gateway/src/`).
- The four `<img src="/shapes/...">` call sites listed in CONTEXT.

### Step 2 — Inventory disk-vs-DB drift

Produce a **field-level diff** between what disk sidecars contain and what `seed_shapes.rs` produces:

- List every top-level key found in disk sidecars.
- List every top-level key seeded by `seed_shapes.rs`.
- Specifically confirm whether `addons` and `compositeAttachments` are absent from seed, and identify any *other* missing fields (e.g. `metadata`, `variants`, `anchors`, `defaults`, `bbox`, `viewBox`).
- A representative sample is sufficient — pick 3–5 disk sidecars with varying complexity (simple, with addons, with composites) and compare against their seed counterparts.

Produce a **shape-set diff**:

- Enumerate the 87 disk shape IDs (from the directory tree of `frontend/public/shapes/`, excluding `index.json`).
- Enumerate the seeded shape IDs from `seed_shapes.rs`.
- List the 21 (or however many — verify the count) shapes that exist on disk but not in seed.
- List any shapes that exist in seed but not on disk (probably zero, but verify).

### Step 3 — Determine the minimal SceneRenderer wiring

For the two call sites at `SceneRenderer.tsx:671` and `:703`, identify:

- Exactly which import is needed (`batchShapes` from `@/api/graphics`).
- Exactly which line gets the new argument and what it looks like.
- Whether the `// DB path disabled` comment block needs updating or removal.
- Whether the same change applies to `libraryStore.ts:208,326-327` or whether the palette has different requirements (catalog vs. full sidecar).

### Step 4 — Decide: update seed_shapes.rs or replace it?

Two candidate approaches — evaluate both and recommend one:

**Approach A — Hand-update `seed_shapes.rs`.**
- Rewrite to include `addons`, `compositeAttachments`, and the 21 missing shapes.
- Pros: single Rust file, no build pipeline change, deterministic.
- Cons: drift will recur the moment anyone edits a JSON. Maintaining 87+ shapes inline as Rust strings is hostile.

**Approach B — Build-time generation.**
- A `build.rs` or one-shot script reads `frontend/public/shapes/**.json` at build time and generates the seed (either as a generated `.rs` file or as an embedded `include_str!` of a single JSON manifest).
- JSON files become **build inputs**, not runtime dependencies.
- Pros: single source of truth (the JSONs), no inline string maintenance, easy to add shapes.
- Cons: build now depends on those JSONs being present in the repo. Must decide whether to remove them post-build or keep them in repo (they are already in repo).

**Approach C — Migration script (one-time).**
- Run a migration that imports disk JSONs into DB on first run, and from then on the DB is canonical.
- Disk files can be deleted post-migration.
- Pros: clean break, DB is truly canonical.
- Cons: dev environments must run the migration; new shapes added to disk won't auto-propagate (but that's the desired behavior — new shapes should go through the API).

Recommend the approach that best fits I/O's deployment model (multi-tenant prod + dev clones) and explain trade-offs.

### Step 5 — Decide the fate of `frontend/public/shapes/`

Three options to evaluate:

1. **Delete entirely.** All shape rendering and palette imagery served from DB / API. Requires solving the `<img src>` problem (likely a `GET /api/graphics/shapes/:id/preview.svg` or similar).
2. **Keep as a fallback / bootstrap asset.** Static files remain but are explicitly marked as a build-time seed only; runtime never touches them. Risk: drift returns.
3. **Keep only previews (SVG files), drop sidecars (JSONs).** Sidecars come from DB; previews stay static for `<img src>` simplicity.

Recommend one and justify.

### Step 6 — Plan the `<img src>` migration

For the 4–5 hardcoded `<img src="/shapes/...">` references:

- Identify each call site and what URL pattern is used.
- Propose the replacement: a new API endpoint that returns SVG (`Content-Type: image/svg+xml`), or inline `<svg>` rendered from sidecar data, or kept as-is if Step 5 chose option 3.
- Estimate complexity per call site.

### Step 7 — Risks and gotchas

Enumerate concretely:

- **Cache invalidation.** `shapeCache.ts` caches by ID — what triggers eviction when a shape is updated in DB? Is there a current invalidation path? Does the API need an `etag` or `updated_at` header?
- **Auth on the batch endpoint.** Is `POST /api/graphics/shapes/batch` behind the same auth/RBAC as other graphics endpoints? Confirm by reading the route registration and middleware. The static-file path is currently auth-free (Vite serves it).
- **CORS.** Frontend served from `5173` in dev, gateway on a different port — confirm CORS is configured for the batch endpoint.
- **Performance.** First-paint of a designer document with ~50 shape instances currently fires ~50 parallel `fetch()` calls to static files. The batch endpoint should reduce this to one round trip — but verify `shapeCache.ts` actually batches by collecting all needed IDs before issuing the request, rather than serializing.
- **Backward compat.** Are there saved `.iographic` exports or designer documents that reference shape IDs not in DB? What happens when a missing shape is requested?
- **Test path.** Is there any test coverage for `shapeCache.ts` or `batch_shapes` that would catch regressions? If not, note it as a gap.

### Step 8 — Phased plan

Produce a phased migration plan. For each phase, specify:

- **Goal** (one sentence).
- **Files touched** (absolute paths).
- **Verification** (how to confirm the phase works — manual test or automated).
- **Estimated effort** (hours, ranges OK).
- **Rollback strategy** (how to undo if something breaks in prod).

Suggested phase shape (Claude should refine):

- Phase 0 — Fix seed (Approach A/B/C from Step 4).
- Phase 1 — Wire `batchFetch` into `SceneRenderer`.
- Phase 2 — Verify rendering parity (designer canvas, console, process module — every consumer of `SceneRenderer`).
- Phase 3 — Migrate `libraryStore.ts` palette catalog to DB.
- Phase 4 — Resolve `<img src>` references (per Step 6).
- Phase 5 — Remove or repurpose `frontend/public/shapes/` (per Step 5).
- Phase 6 — Cache invalidation / etag / auth hardening (per Step 7).

### Step 9 — Present and wait

Once Steps 1–8 are complete, present the user with:

1. A concise findings summary (not a wall of text — bullet points).
2. The chosen recommendations for Steps 4, 5, 6.
3. The full phased plan from Step 8.
4. The risk list from Step 7.
5. An explicit question: **"Approve this plan? Any phase to reorder, drop, or add detail to?"**

**Do not write any production code until the user replies with approval.** Acceptable pre-approval actions: reading more files, running `grep`/`find` for verification, checking the DB for current shape rows. Not acceptable: editing `seed_shapes.rs`, `shapeCache.ts`, `SceneRenderer.tsx`, `libraryStore.ts`, or any `*.tsx` palette file.

If the user requests changes, revise and re-present. If the user approves, begin Phase 0 only — do not chain phases without check-ins between them.

---

## Tone & Length Expectations

- Be direct and technical. The user does not need encouragement or hedging.
- Findings should fit in a single message; don't pad with explanations of things already in this CONTEXT section.
- If something is uncertain after reading code, say so — don't guess.
- If the plan reveals that the problem is bigger or smaller than the CONTEXT section implies, say that too.
