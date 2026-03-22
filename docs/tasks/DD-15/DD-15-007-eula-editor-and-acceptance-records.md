---
id: DD-15-007
title: Replace EULA textarea with split-pane markdown editor and add acceptance records summary cards and Export CSV
unit: DD-15
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The EULA version create/edit dialog must use a split-pane editor (left: raw markdown, right: live rendered preview) with a full-screen toggle, not a plain textarea. The acceptance records tab must display summary cards at the top (Total Users, Accepted Current Version with count+%, Pending Acceptance with count+%) and an Export CSV button.

## Spec Excerpt (verbatim)

> **Version content editor**: split-pane markdown editor (left: raw markdown, right: rendered preview). Full-screen toggle for editing.
> — 15_SETTINGS_MODULE.md, §EULA Management

> **Acceptance summary cards** at top: Total Users, Accepted Current Version (count + percentage), Pending Acceptance (count + percentage)
> "Export CSV" button -> downloads complete acceptance history for legal/audit purposes. Export includes all columns plus `content_hash` for cryptographic proof of what was shown.
> — 15_SETTINGS_MODULE.md, §EULA Management

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/EulaAdmin.tsx` lines 127–235 — `CreateVersionDialog` with the textarea at line 203
- `frontend/src/pages/settings/EulaAdmin.tsx` around line 300+ — acceptance records tab

## Verification Checklist

- [ ] The EULA version create dialog has a two-column layout: left pane is a textarea/code input for raw markdown, right pane renders a live preview using a sanitized markdown renderer
- [ ] A "Full Screen" toggle expands the editor to fill most of the viewport
- [ ] Acceptance records tab renders three summary cards before the table: Total Users, Accepted Current Version (N / total, %), Pending Acceptance (N, %)
- [ ] An "Export CSV" button appears above the acceptance records table
- [ ] Export CSV includes `content_hash` column

## Assessment

- **Status**: ⚠️ Partial
- **If partial/missing**: CreateVersionDialog uses a single textarea (line 203). No split-pane, no markdown preview. Acceptance records table exists but no summary cards and no Export CSV button.

## Fix Instructions

**1. Split-pane editor** in `CreateVersionDialog` (EulaAdmin.tsx ~line 200):

Replace the single textarea with a two-column grid layout where the left column is the raw markdown textarea and the right column renders a read-only preview. For the preview, use a sanitized renderer: check if `marked` (MIT) + `DOMPurify` (Apache-2.0) are already in the dependency tree. If not, use a plain preformatted text block (`<pre>`) as the preview until a safe renderer is available — the preformatted fallback is better than introducing an unvetted library.

The dialog style at line 101 sets `width: '700px'` — increase to `900px` to accommodate the two-pane layout.

**2. Full-screen toggle**: Add a `fullscreen` boolean state. When true, override the `Dialog.Content` style to `width: '95vw', height: '95vh'`. The textarea and preview pane should each fill the available height.

**3. Summary cards** in the acceptance records section — add before the acceptance table. Fetch the stats from a dedicated endpoint `GET /api/auth/admin/eula/stats` which should return `total_users`, `accepted_current`, `pending_current` counts. If the API does not yet expose an aggregated stats endpoint, compute the counts from the already-loaded acceptance records list (the current query already fetches all rows).

Cards layout:
- Card 1: "Total Users" — total user count
- Card 2: "Accepted Current Version" — count + percentage with green text
- Card 3: "Pending Acceptance" — count + percentage with amber text (users who have not yet accepted the current active version)

**4. Export CSV button**: Add a button labeled "Export CSV" above the acceptance table. Call `GET /api/auth/admin/eula/acceptances/export` with `Accept: text/csv` or `?format=csv`. The CSV must include all columns from the `EulaAcceptanceRow` interface defined at EulaAdmin.tsx:21, including `content_hash`. Trigger a browser file download.

Do NOT:
- Remove the truncated `content_hash` display from the acceptance records table (line 357 — keep it)
- Use `innerHTML` or `dangerouslySetInnerHTML` with unsanitized user content for the markdown preview
- Break the existing create/publish/view/delete flows
