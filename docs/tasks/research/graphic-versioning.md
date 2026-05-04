# Graphic Versioning — Research and Planning Task

You are running on Opus. This is a research-and-planning task. Do **not** implement anything beyond a small documented bug fix until the user has approved a written plan. There are several open design questions that **must** be put to the user explicitly — do not assume answers.

---

## CONTEXT

The I/O designer has a half-built graphic versioning system. The database schema and one write path exist; nearly everything else is broken or missing. Console and Process always render the live `design_objects` row regardless of any "publish" action, so as it stands today "Publish" is essentially a no-op as far as end users can tell.

### What exists and works

- Migration `migrations/20260314000009_graphics_workspaces.up.sql` lines 18–28 defines table `design_object_versions`:
  - `id uuid PK`
  - `design_object_id uuid FK`
  - `version_number int`
  - `version_type varchar(50)` — values `'draft'` or `'publish'`
  - `svg_data text`
  - `bindings jsonb`
  - `metadata jsonb`
  - `created_by uuid`
  - `created_at`
- `services/api-gateway/src/handlers/graphics.rs` lines 644–657 — the `publish_graphic` handler writes a row correctly:
  ```sql
  INSERT INTO design_object_versions
    (design_object_id, version_number, version_type, svg_data, bindings, metadata, created_by)
  VALUES ($1, $2, 'publish', ...)
  ```
- Route `POST /api/v1/design-objects/:id/publish` is registered in `services/api-gateway/src/main.rs`.

### What is broken or missing

- `services/api-gateway/src/handlers/iographic.rs` lines 2638–2640 — also tries to insert into `design_object_versions` but uses **wrong column names** (`graphic_id` and `version` instead of `design_object_id` and `version_number`). This INSERT will fail at runtime; the surrounding code marks it non-fatal and silently continues. This is a real latent bug that should be fixed regardless of the design decisions below.
- **No read endpoints exist.** None of these are registered in `main.rs`:
  - `GET  /api/v1/design-objects/:id/versions`
  - `GET  /api/v1/design-objects/:id/versions/:versionId`
  - `POST /api/v1/design-objects/:id/versions/:versionId/restore`
- `frontend/src/api/graphics.ts` lines 184, 198, 217 — `getVersions`, `getVersionContent`, and `restoreVersion` all call those non-existent endpoints. They will all 404.
- `frontend/src/pages/designer/components/VersionHistoryDialog.tsx` opens, calls `getVersions`, gets a 404, and renders "No version history yet."
- **Console and Process always render the live `design_objects` row**, never a published version. The display path calls `graphicsApi.get(id)` → `GET /api/v1/design-objects/:id`, which reads `design_objects` directly. There is no concept of "render the published version" anywhere in the display pipeline today.

### Open design questions (no answers yet — ask the user)

The user has flagged five questions that must be resolved before any plan is written. Tradeoffs are summarized in the EXECUTE section below. Do **not** assume answers.

---

## EXECUTE

Follow these steps in order. Do not skip the user-conversation steps — this task is explicitly research-and-planning, not implementation.

### Step 1 — Read the authoritative code

Read each of the following in full. Note line ranges so you can quote them when discussing with the user.

1. `migrations/20260314000009_graphics_workspaces.up.sql` — full file. Confirm the `design_object_versions` schema and any related tables (e.g., `design_objects`, draft/workspace tables).
2. `services/api-gateway/src/handlers/graphics.rs` — the `publish_graphic` handler around lines 644–657, and any helpers it calls. Read enough surrounding code to understand how `version_number` is computed (is it monotonic per `design_object_id`? Is there a SELECT MAX before insert?).
3. `services/api-gateway/src/handlers/iographic.rs` lines 2580–2680 (covers the broken INSERT at 2638–2640 with surrounding context). Identify exactly which columns are wrong and what the correct INSERT should be.
4. `services/api-gateway/src/main.rs` — search for `design-objects` and `versions` to confirm which routes are and aren't registered.
5. `frontend/src/api/graphics.ts` — read every method, focus on `getVersions`, `getVersionContent`, `restoreVersion`, `get`, and `publish`. Note exact URLs and payload shapes.
6. `frontend/src/pages/designer/components/VersionHistoryDialog.tsx` — full file. Note the UI flow: how is it opened, what does it display, what actions does it offer.
7. Console and Process display paths — find where `graphicsApi.get(id)` is called:
   - `frontend/src/pages/console/` — grep for `graphicsApi` and `design-objects`.
   - `frontend/src/pages/process/` — same.
   - Trace from the API call to the SVG render; note any caching layers.
8. `design-docs/05` (build order) and any sibling design-docs that mention "publish", "version", or "draft" semantics. Also skim `docs/SPEC_MANIFEST.md` for related units. Per `CLAUDE.md`, design docs are historical — verify against code before quoting them as authority.

### Step 2 — Write down what you found

Before talking to the user, produce a short written summary (in your reply, not a file) covering:

- The confirmed `design_object_versions` schema.
- How `version_number` is currently computed (or whether it's broken/racey).
- The exact bug in `iographic.rs` (wrong column names).
- The exact 404-bound calls in `graphics.ts` and where they are used in the UI.
- The exact code path from "user opens a graphic in Console" to "SVG renders" — with file:line citations.
- Any design-doc statements about publish semantics, with caveats about historicity.

This grounds the conversation. Keep it tight.

### Step 3 — Fix the small bug now (and only this)

The `iographic.rs` INSERT at lines 2638–2640 is broken (wrong column names). Fix it to match the real schema (`design_object_id`, `version_number`, etc.). This is a latent bug independent of any design decision. After the fix:

- Run `cargo build -p io-api-gateway` (with `BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include"`) to confirm it compiles.
- Do **not** commit. Mention the fix in your summary so the user can review.
- Do **not** write any new endpoints or frontend code at this step.

### Step 4 — Ask the user the five design questions, one at a time

Present each question with its tradeoffs. **Wait for an answer before moving to the next question.** Do not batch them. Do not propose a plan until all five are answered.

#### Question 1 — What does "Publish" mean in this system?

Today `publish_graphic` writes a `version_type='publish'` snapshot, but Console and Process render the live `design_objects` row regardless. So Publish currently does nothing user-visible. Three options:

- **(A) Publish = stable snapshot that Console renders.** The live `design_objects` row becomes "draft in progress" (designer-only). Console/Process render the most recent `version_type='publish'` row. Implication: Console graphic fetch must change to read from `design_object_versions` (or a `published_version_id` pointer on `design_objects`). This is the most semantically meaningful option and matches what most users would expect from a "Publish" button.
- **(B) Publish = rollback breadcrumb only.** Console always renders the live row. Publish snapshots exist purely for version history / accident recovery. Implication: Publish has no effect on what end users see. Designers must save the live row to make changes visible.
- **(C) Something else.** E.g., publish gates an approval workflow; or publish creates an access-control boundary (operators see only published, designers see drafts).

Ask the user to pick A, B, or C. If C, ask them to describe it.

#### Question 2 — What is version history for?

- Accident recovery (oops, I broke it — give me yesterday's version)?
- Audit trail (who changed what, when)?
- Rollback to any historical version?
- Side-by-side compare of two versions?
- Some combination?

Each one has different UI and storage implications. Get the user to commit to a primary use case.

#### Question 3 — Should Console/Process render the published version or the live row?

This is the architectural fork. If the user picked option A in Q1, the answer is "published version" and the Console fetch path must change. If they picked B, it stays the live row. Confirm explicitly — don't infer from Q1.

#### Question 4 — What is the retention policy?

- Keep every publish forever?
- Keep last N publishes per graphic?
- Time-based pruning (e.g., keep last 90 days)?
- What happens to versions when the parent graphic is deleted — cascade delete, or orphan-and-keep?

The schema today has no retention logic. SVG blobs in `svg_data` can be large; unbounded retention will grow linearly with edit frequency.

#### Question 5 — Is there a draft-vs-published access control distinction?

- Operators see only the published version, designers see live drafts?
- Or is access control purely on the graphic itself (you can either see it or you can't, and "published" is irrelevant to permissions)?
- Are there RBAC permissions today like `designer:publish` that should gate this?

Check `design-docs/03` for the canonical permission list before asking, so you can quote the relevant permissions.

### Step 5 — Draft the plan based on the user's answers

Once you have answers to all five questions, draft a concrete plan covering:

**Backend:**
- List every new route to register in `main.rs`, with method, path, and handler name.
- For each handler: SQL queries (or query builder calls), authz checks, error cases.
- Any schema changes needed (e.g., a `published_version_id uuid` pointer on `design_objects` if Q3 = "render published"). Migration file naming: `migrations/YYYYMMDDHHMMSS_<descriptive-name>.up.sql` + matching `.down.sql`.
- How `publish_graphic` should compute `version_number` (atomic? `SELECT MAX + 1` in a transaction? sequence?).
- Retention enforcement (cron job? on-publish prune? trigger?).
- Fix for the `iographic.rs` bug (already done in Step 3 — just note it here).

**Frontend:**
- Confirm the existing `getVersions` / `getVersionContent` / `restoreVersion` URLs match the new backend routes, or list the changes needed in `frontend/src/api/graphics.ts`.
- `VersionHistoryDialog.tsx` — list changes needed (e.g., restore action, diff view, version metadata display).
- Console/Process display path — if Q3 = "render published", list the exact files and call sites that change.
- Any new RBAC checks in the UI.

**Out of scope (call out explicitly):**
- Side-by-side diff UI (unless Q2 says yes).
- Branching / multi-line version history.
- Anything not directly answering the five design questions.

### Step 6 — Present the plan and wait for approval

Show the user the full plan in chat. Ask for approval before writing any code. If the user requests changes, iterate. Do **not** start implementation until they say "go" or equivalent.

### Step 7 — Only after approval, begin implementation

Implementation is a separate phase. Do not start it inside this task. When the user approves the plan, ask them whether they want you to:
- Implement it now in this session, or
- Hand it off as a separate task file (e.g., `docs/tasks/MOD-DESIGNER/graphic-versioning-impl.md`).

---

## Non-negotiables

- Do **not** assume answers to the five design questions. Ask.
- Do **not** implement anything beyond the `iographic.rs` column-name fix until the user approves a written plan.
- Do **not** commit anything in this task without explicit user instruction.
- Verify code against actual files — do not trust design-docs (per `CLAUDE.md`, they're historical).
- Per the UUID identity rule in `CLAUDE.md`: any new frontend version-related code must use tagnames or graphic IDs, never expose raw point UUIDs.
- License: any new dependencies must be MIT / Apache-2.0 / BSD / ISC / PostgreSQL / MPL-2.0. No GPL/AGPL/LGPL.

---

## Reference paths

- `migrations/20260314000009_graphics_workspaces.up.sql` (lines 18–28)
- `services/api-gateway/src/handlers/graphics.rs` (lines 644–657 and surrounding)
- `services/api-gateway/src/handlers/iographic.rs` (lines 2638–2640 — broken INSERT)
- `services/api-gateway/src/main.rs` (route registration)
- `frontend/src/api/graphics.ts` (lines 184, 198, 217)
- `frontend/src/pages/designer/components/VersionHistoryDialog.tsx`
- `frontend/src/pages/console/`
- `frontend/src/pages/process/`
- `design-docs/05` (build order — historical)
- `design-docs/03` (RBAC permissions — authoritative)
- `docs/SPEC_MANIFEST.md`
