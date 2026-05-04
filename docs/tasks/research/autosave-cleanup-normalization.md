# Research & Plan — Designer Autosave / Crash-Recovery Cleanup Normalization

**Type:** Research + Planning (NO CODE — discuss with user before implementing)
**Model:** Opus
**Owner:** Designer module
**Status:** Not started

---

## CONTEXT

The I/O designer (`frontend/src/pages/designer/index.tsx`) has an autosave / crash-recovery
system that is partially implemented and has multiple bugs around cleanup. Autosaves are
written both to IndexedDB (local) and to the server as `design_objects` rows whose `name`
column is prefixed `__autosave_<uuid>`. List queries hide those rows via
`name NOT LIKE '__autosave_%'`, but nothing in the system DELETEs them — over time they
accumulate forever as orphans in the DB.

The user wants the autosave/recovery UX normalized across all paths. The desired contract:

- **Discard** drops ALL edits — server `__autosave_*` row AND IndexedDB record cleaned up.
  No re-prompt on next session.
- **Preview (recovered graphic)** does NOT use the current in-page comparison overlay.
  Instead it opens the recovered graphic as a new designer tab titled
  `Preview - <GraphicName>` with a star (unsaved) indicator. On load, show a banner/toast:
  *"These are your recovered changes. Click Save to overwrite the current version, or
  rename then Save As to keep both."*
- No orphan `__autosave_*` rows accumulating in `design_objects`.

### Bugs already identified (prior research — verify line numbers when executing)

- **Crash-recovery dialog "Discard" button** — `frontend/src/pages/designer/index.tsx`
  ~line **2711-2741**. Only deletes the IndexedDB record. Does NOT call
  `graphicsApi.remove(autosaveId)`. Leaves an orphan `design_objects` row with
  `name = "__autosave_<uuid>"` forever.
- **Tab-close Discard path** — `frontend/src/pages/designer/index.tsx` ~line
  **3112-3117** and the surrounding `saveTabToServer` rows. Same orphan-leak pattern.
- **No server-side cleanup of `__autosave_*` rows** — grepping migrations and services
  finds zero `DELETE FROM design_objects WHERE name LIKE '__autosave_%'`. The list
  filter `name NOT LIKE '__autosave_%'` lives in
  `services/api-gateway/src/handlers/graphics.rs` ~lines **168 / 210 / 234**, but it
  only hides them from list responses — it does not delete.
- **"Preview" today** — `frontend/src/pages/designer/index.tsx` ~line **2698** opens an
  in-page split-view crash-recovery comparison overlay. The user wants this REPLACED
  with a new designer tab.

### Currently-correct cleanup paths (preserve these — do not regress)

- **Real save cleanup** — `frontend/src/pages/designer/index.tsx` ~line **1245-1269**.
  Deletes both the autosave server row and the IDB record on a successful real save.
- **Recover + load cleanup** — `frontend/src/pages/designer/index.tsx` ~line
  **2821-2837**. Deletes both the autosave server row and the IDB record after the user
  recovers and the recovered graphic loads.

### Save / autosave / cleanup paths to inventory

The executing Claude must locate and map every one of these in code (with exact line
numbers):

- Regular save (Ctrl+S, toolbar Save)
- Autosave interval timer (autosave effect, ~line 2289)
- Tab autosave (`saveTabToServer`)
- Crash-recovery dialog: Recover / Discard / Preview buttons
- Tab-close prompt (`TabClosePrompt`): Keep / Discard
- Unsaved-changes prompt on navigate-away
- Save As / rename flow

### Key files

- `frontend/src/pages/designer/index.tsx` — primary file (~3338 lines).
- `frontend/src/api/graphics.ts` — `remove`, `create`, `update` signatures (~407 lines).
- `services/api-gateway/src/handlers/graphics.rs` — `DELETE /api/v1/design-objects/:id`
  handler + RBAC + the `name NOT LIKE '__autosave_%'` filters.
- IDB helper(s) the designer uses for autosave storage (locate by grepping for `idb`,
  `openDB`, `indexedDB`, or autosave-related store names from the designer file).

### Architectural rules in play

- **UUID is internal-only**: never expose raw UUIDs in user-visible UI. Tab titles and
  banners use the human name, not the autosave UUID.
- **Tagname vs. UUID**: irrelevant here (no points), but the same "internal vs. external
  identifier" discipline applies to design object IDs in the UI.
- **RBAC**: deletion of design objects requires whichever permission `graphics.rs`
  currently enforces on `DELETE /api/v1/design-objects/:id` — confirm during research.

---

## EXECUTE

Do all of the following IN ORDER. Do not write production code at any step. Output is a
written plan presented to the user for approval.

1. **Read `CLAUDE.md`** at the repo root and skim the designer-related memory entries
   (`project_designer_reconciliation.md`, `project_designer_ux_fixes.md`,
   `project_iographic_format.md`) so you know the current designer architecture.

2. **Map every save/autosave/cleanup path** in `frontend/src/pages/designer/index.tsx`.
   For each path produce a table row with: trigger, function name, line range, what it
   writes (IDB? server? both?), what it deletes (IDB? server? both? neither?), and
   error-handling behavior. Include at minimum:
    - Autosave interval effect (~line 2289)
    - `saveTabToServer`
    - Real-save cleanup (~1245-1269)
    - Recover + load cleanup (~2821-2837)
    - Crash-recovery dialog Recover button
    - Crash-recovery dialog Discard button (~2711-2741) — KNOWN BUG
    - Crash-recovery dialog Preview button (~2698) — TO BE REPLACED
    - `TabClosePrompt` Keep path
    - `TabClosePrompt` Discard path (~3112-3117) — KNOWN BUG
    - Unsaved-changes navigate-away prompt
    - Save As / rename flow

3. **Confirm the IDB schema** used for autosave. Find the open-DB call, the store name(s),
   the key shape, and the value shape. Note whether one record per graphic, per tab, or
   per session, and how stale records are (or are not) garbage-collected.

4. **Confirm the server-side `__autosave_*` row shape**. Read the relevant create/update
   call sites in the designer and the corresponding handler in
   `services/api-gateway/src/handlers/graphics.rs`. Document `type`, `metadata`,
   `bindings`, and any other columns that differ from a normal published graphic.

5. **Map every path that CREATES a `__autosave_*` server row** and trace whether each
   creator has a guaranteed deletion counterpart. Produce a "creator → terminal state"
   matrix listing: discard, successful save, tab close (keep), tab close (discard),
   navigate away (save), navigate away (discard), session crash. Flag every cell where a
   row can be created and never deleted.

6. **Inspect the DELETE endpoint**. In `services/api-gateway/src/handlers/graphics.rs`,
   read the `DELETE /api/v1/design-objects/:id` handler. Note its RBAC permission name,
   any soft-delete vs. hard-delete behavior, and whether it accepts deletion of rows whose
   `name` starts with `__autosave_`. Confirm `frontend/src/api/graphics.ts`'s `remove`
   wrapper matches.

7. **Design a normalized cleanup contract**. For each session-end event (Discard,
   successful Save, tab close → Keep, tab close → Discard, navigate away → Save, navigate
   away → Discard, recover + load), specify:
    - Exact calls to fire and their order.
    - Which calls are best-effort vs. must-succeed.
    - Failure handling (e.g., server delete fails — still drop IDB? prompt user? retry?).
    - Idempotency (the same cleanup running twice must not error).

8. **Design the "Preview as new tab" UX**. Concretely:
    - Tab data model — how the existing designer tab system represents an open document.
      Identify whether tabs are keyed by graphic id, by ephemeral session id, or both.
    - How to mark a tab as "preview / unsaved": star indicator, title prefix
      `Preview - <GraphicName>`, dirty state.
    - Where the recovered-changes banner/toast lives (per tab? global?). Banner text:
      *"These are your recovered changes. Click Save to overwrite the current version, or
      rename then Save As to keep both."*
    - Behavior on Save from the preview tab — overwrites the canonical graphic with the
      preview content, then deletes the autosave row + IDB record.
    - Behavior on Save As from the preview tab — creates a new graphic, leaves the
      original untouched, then deletes the autosave row + IDB record.
    - Behavior when the user closes the preview tab WITHOUT saving — must trigger the
      tab-close prompt with Keep / Discard semantics that match the normalized contract;
      Discard must clean up the autosave row.
    - Interaction with the existing crash-recovery dialog — does the dialog still appear
      and the Preview button now opens a tab? Or is the dialog removed entirely in favor
      of always opening the preview tab on next load? Recommend one and justify.

9. **Assess server-side periodic cleanup as a safety net**. Decide whether the system
   needs a janitor that deletes `__autosave_*` rows older than N hours regardless of
   client behavior. Consider:
    - Trigger options: API gateway startup task, dedicated cron endpoint hit by an
      external scheduler, timescaledb retention job, or a tokio interval task in the
      gateway.
    - TTL: propose N (e.g., 48h, 7d) and justify.
    - Risk: a janitor that runs while a user has a live autosave session must not delete
      a row mid-session. Propose a guard (e.g., only delete rows whose `updated_at` is
      older than TTL).
    - Whether this is required for correctness or just defense in depth.

10. **State-management impact assessment**. Identify every Zustand store, React state
    hook, ref, and event listener touched by autosave/recovery. For each session-end
    event, list which state must be reset, and in what order, to avoid stale subscriptions
    or stale tab entries.

11. **Draft a phased plan** with explicit acceptance criteria per phase:
    - **Phase A (low risk)**: fix the Discard cleanup bugs at ~2711-2741 and ~3112-3117 to
      call `graphicsApi.remove(autosaveId)` and clean up IDB. Add idempotency.
    - **Phase B (medium)**: build the "Preview as new tab" flow, including banner, Save
      behavior, Save As behavior, and tab-close handling.
    - **Phase C (lower priority)**: server-side periodic cleanup safety net.
    - For each phase: files changed, new functions, test strategy, rollback plan.

12. **Open questions for the user** — list any decisions that require their input before
    implementation. Examples to anticipate:
    - Keep crash-recovery dialog or remove it in favor of always opening preview tab?
    - Should Save from preview tab require an explicit confirm before overwriting?
    - TTL for the server-side janitor?
    - Should `__autosave_*` rows be hard-deleted or soft-deleted (if a soft-delete pattern
      exists elsewhere in the schema)?
    - Should tab-close → Discard be confirmed once or fire silently?

13. **Present everything to the user**. Deliver a single response containing:
    - The path inventory table.
    - The IDB and server-row shape findings.
    - The "creator → terminal state" matrix with leaks highlighted.
    - The normalized cleanup contract.
    - The Preview-as-tab design.
    - The janitor recommendation.
    - The phased plan with acceptance criteria.
    - The open questions.

    Then STOP and wait for user approval. Do not write code. Do not begin Phase A until
    the user explicitly approves the plan.

---

## OUT OF SCOPE

- Re-architecting the designer tab system. Use what exists.
- Changing the IDB schema unless absolutely required (call out clearly if it is).
- Changes to non-autosave design-object flows (publish, import, export, .iographic).
- Frontend lint/build cleanup (separate eslint-debt task).
