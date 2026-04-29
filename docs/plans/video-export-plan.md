# Historical Playback Video Export — Phased Build Plan

## Background and Authoritative Context

This feature adds a "Record" button to the historical playback bar that exports a WebM/VP9 video of the graphic stepping through the selected time range, plus a CC toggle that overlays absolute timestamps both during live playback and (when enabled) burned into the exported video.

The implementation is server-side: a headless Chromium controlled by Playwright navigates a dedicated minimal frontend route (`/export-render`) at each timestamp in the range, screenshots, then pipes the frames to FFmpeg which encodes WebM/VP9. The user fires-and-forgets; a WebSocket-delivered toast notifies them when the file is ready to download.

The codebase already has all the moving parts for an async export pipeline (job table, pg_notify → data-broker WebSocket → frontend toast). This plan reuses every existing pattern.

### Existing infrastructure we are reusing (not rebuilding)

| Concern | Existing mechanism | Path |
|---|---|---|
| Async job persistence | `export_jobs` table | `migrations/20260314000022_export.up.sql` |
| Job-complete notification | `pg_notify('export_complete', '{"job_id":...}')` consumed by data-broker, fanned out as `WsServerMessage::ExportComplete { job_id }`, surfaced as a toast | `services/api-gateway/src/handlers/exports.rs:335`, `services/data-broker/src/notify.rs:127`, `frontend/src/shared/hooks/useWsWorker.ts:264` |
| Download endpoint | `GET /api/exports/:id/download` | `services/api-gateway/src/handlers/exports.rs` |
| File retention/cleanup | `run_export_cleanup_task` deletes files past `EXPORT_RETENTION_HOURS` (default 24h) and unlinks orphans | `services/api-gateway/src/handlers/exports.rs:1152` |
| Export storage dir | `state.config.export_dir` (defaults `/tmp/io-exports`) | `services/api-gateway/src/config.rs` |
| RBAC permission gate | `claims.permissions` check (`*` or exact match) | every handler file in `services/api-gateway/src/handlers/` |
| Format/job model crate | `io-export` (currently format/status/job-row primitives only) | `crates/io-export/src/lib.rs` |
| Frontend permission UI gating | `useAuthStore` permissions array decoded from JWT | `frontend/src/store/auth.ts` |
| Playback state | Zustand `usePlaybackStore` (`mode`, `timestamp`, `timeRange`, `isPlaying`, `speed`, loop fields) | `frontend/src/store/playback.ts` |

### Architecture decisions

The four open architecture questions resolve to:

**Q1 — Export service placement.** Build a **new `services/video-export-service/`** Rust crate (Axum, port 3011). Rationale:
- The api-gateway is already 1,861 lines of routing and shouldn't own a Playwright + FFmpeg subprocess supervisor.
- The work is fundamentally different from the row-based universal exporter (long-running render loop, browser process, GPU/CPU affinity).
- It needs to spawn a Node.js Playwright child process and an FFmpeg child — deserves an isolated service so a hung Chromium can't impact the gateway request hot path.
- The api-gateway proxies the user-facing `POST /api/video-exports` and `GET /api/video-exports/:id/...` endpoints to it. The download endpoint can be served by the gateway directly off the shared `export_dir` (NFS/local volume in dev, shared volume in prod) so we don't proxy large binary streams.

**Q2 — Playwright integration.** Use a **Node.js capture worker** (`services/video-export-service/capture-worker/`), invoked as a subprocess by the Rust service via `tokio::process::Command`. Rationale:
- The Playwright Rust crate is immature, lags upstream protocol changes, and the entire video-export problem is solved end-to-end by a 200-line Node script that pipes Playwright `page.screenshot({ type: 'png' })` byte buffers to FFmpeg `stdin`.
- Communication: JSON-over-stdout for progress (`{"type":"progress","frame":N,"total":M}`) parsed by the Rust supervisor; non-zero exit code = failure.

**Q3 — Headless browser auth.** Use a **backend-generated short-lived JWT scoped to the export route** ("export ticket"). Rationale:
- The user's regular access token expires in 15 minutes; a long render could outlast it.
- A long-lived token is a security hazard if intercepted.
- The export ticket is a JWT with `sub = user_id`, `aud = "video-export"`, 30-minute TTL, and a custom claim `permissions: ["process:read", ...]` (copy of the user's read-tier permissions only — never write/delete/admin). The capture worker injects it into `localStorage` via `page.addInitScript()` before navigating to `/export-render`. The frontend's existing token bootstrap reads the same `io_access_token` localStorage key.
- The export route is rendered inside the regular auth-guarded shell but with a minimal layout. RBAC at navigation time still requires `process:read` / `console:read`, which the export ticket carries.

**Q4 — Notification mechanism.** **Reuse the existing `pg_notify('export_complete')` → data-broker → WebSocket → toast pipeline.** Add a `kind` discriminator to the payload (`"data_export"` vs `"video_export"`) so the frontend toast can show the right copy and link the right download. The data-broker already filters by user id; only the requesting user gets the toast.

**Temp file storage.** Reuse the gateway's `export_dir` plus a `videos/` subdirectory: `${EXPORT_DIR}/videos/{job_id}.webm` for completed files and `${EXPORT_DIR}/videos/.tmp/{job_id}/` for in-flight frames. Hourly cleanup task already in place; we extend the retention sweep to include the `videos/` subdir.

---

## Phase 0 — Decision Record

**Goal:** Capture all decisions in a docs/decisions file before any code lands.

**Files to create:**
- `docs/decisions/historical-playback-video-export.md`

**Contents:**
- Format = WebM/VP9; FPS range 10–15 (default 10); CRF target ~28 (high VP9 quality, content is mostly static between steps); bitrate uncapped.
- Capture strategy = headless Chromium + dedicated `/export-render` route + frame-by-frame screenshot.
- Output resolution = client-supplied; `window.screen.width × devicePixelRatio` etc. capped at 3840×2160 (prevent abuse).
- Service placement, capture worker language, auth ticket, and notification decisions per Q1–Q4 above.
- RBAC permissions to be added: `process:video_export` and `console:video_export`. CC toggle is permission-free (UI-only state, all users see it).
- Job retention reuses `EXPORT_RETENTION_HOURS` (24h). Single concurrent video export per user; second submission while one is processing returns 409.

**Verification:** Decision file merged. No code changes.

**Risks:** None. This is the gate that aligns the team on permission names and module boundaries before code begins.

---

## Phase 1 — RBAC Permissions

**Goal:** Introduce `process:video_export` and `console:video_export` permissions in the database, role assignments, and the design-doc.

**Files to create:**
- `migrations/20260428000001_add_video_export_permissions.up.sql`
- `migrations/20260428000001_add_video_export_permissions.down.sql`

**Files to modify:**
- `design-docs/03_SECURITY_RBAC.md` — bump permission count from 119 to 121, add the two permissions under Process Module (6→7) and Console Module (7→8), append v2.4 changelog entry.

**Implementation details:**
- Up-migration follows the pattern in `20260406000001_add_sms_configure_permission.up.sql`:
  ```sql
  INSERT INTO permissions (name, description, module) VALUES
    ('process:video_export', 'Trigger video exports of historical process playback', 'process'),
    ('console:video_export', 'Trigger video exports of historical console playback', 'console')
  ON CONFLICT (name) DO NOTHING;
  ```
- Role grants:
  - **Admin:** both (Admin already has `*` if seeded that way; check `seed_tier1.up.sql` and follow whatever pattern it uses).
  - **Shift Supervisor:** both.
  - **Operator:** both (operators are the primary audience for incident replay).
  - **Analyst:** both (forensic playback evidence).
  - **Content Manager / Maintenance / Viewer / Contractor:** none by default; can be granted via custom roles.
- Down-migration: `DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE name IN (...))` then `DELETE FROM permissions WHERE name IN (...)`.

**Verification:**
- `sqlx migrate run` succeeds against a fresh dev DB.
- `psql -c "SELECT name FROM permissions WHERE module IN ('process','console') AND name LIKE '%video_export%';"` returns both rows.
- A user logging in with the Operator role decodes a JWT containing `process:video_export` (verify in DevTools Application > localStorage > `io_access_token`).
- Down-migration rolls cleanly.

**Gotchas:**
- **`samael` build flag.** Any cargo build performed during this phase requires `BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include"` because `auth-service` depends on `samael`. Document this in the migration commit message.
- The `Admin` role grant only matters if `Admin` is seeded with explicit grants; if it carries `*` it's automatic. Check `migrations/20260314000033_seed_tier1.up.sql` Admin block before assuming.
- Existing JWTs are not invalidated by adding permissions; users must log out/in to see the new claims. This is acceptable (they can't use the feature until they log in anyway).

---

## Phase 2 — Database Schema for Video Export Jobs

**Goal:** Persist video export jobs with the per-video parameters not in `export_jobs`.

**Files to create:**
- `migrations/20260428000002_video_export_jobs.up.sql`
- `migrations/20260428000002_video_export_jobs.down.sql`

**Schema:**
```sql
CREATE TABLE video_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued','processing','completed','failed','cancelled')),
    -- Source
    module VARCHAR(20) NOT NULL CHECK (module IN ('process','console')),
    graphic_id UUID NOT NULL,
    -- Time range and stepping
    range_start TIMESTAMPTZ NOT NULL,
    range_end   TIMESTAMPTZ NOT NULL,
    step_ms     INTEGER NOT NULL CHECK (step_ms > 0),
    fps         SMALLINT NOT NULL CHECK (fps BETWEEN 1 AND 60),
    -- Render dimensions
    width_px    INTEGER NOT NULL CHECK (width_px BETWEEN 320 AND 7680),
    height_px   INTEGER NOT NULL CHECK (height_px BETWEEN 240 AND 4320),
    device_pixel_ratio NUMERIC(3,1) NOT NULL DEFAULT 1.0,
    -- Overlay
    overlay_timestamp BOOLEAN NOT NULL DEFAULT true,
    -- Encoding
    codec        VARCHAR(20) NOT NULL DEFAULT 'vp9',
    container    VARCHAR(20) NOT NULL DEFAULT 'webm',
    crf          SMALLINT NOT NULL DEFAULT 28 CHECK (crf BETWEEN 0 AND 63),
    -- Output
    file_path    VARCHAR(500),
    file_size_bytes BIGINT,
    original_filename VARCHAR(255),
    duration_seconds NUMERIC(10,2),
    -- Progress
    frames_total INTEGER,
    frames_rendered INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    -- Audit
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_video_export_jobs_user ON video_export_jobs(created_by, created_at DESC);
CREATE INDEX idx_video_export_jobs_status ON video_export_jobs(status) WHERE status IN ('queued','processing');
CREATE TRIGGER trg_video_export_jobs_updated_at
    BEFORE UPDATE ON video_export_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Decision: separate table vs reuse `export_jobs`.** Use a separate table. `export_jobs.format` enum doesn't include `webm`, columns like `module`/`entity` don't fit, and adding ~12 nullable columns to a hot CRUD path costs more than it saves. The download/retention infrastructure is generic enough that this table sits comfortably alongside the existing one.

**Verification:**
- Migration runs cleanly up and down.
- Unique index on `(created_by, status)` is **not** added — a user can have many completed jobs but Phase 4 enforces the "one in-flight" rule at the API layer.

**Gotchas:**
- The `update_updated_at_column()` function exists from `20260314000002_functions.up.sql`. Verify it before relying on it.

---

## Phase 3 — Frontend `/export-render` Capture Route

**Goal:** Ship a minimal, chrome-free frontend route that renders just the graphic at a given timestamp. Independently shippable: a developer can hit the URL with a JWT and see the right pixels even before any backend code exists.

**Files to create:**
- `frontend/src/pages/export-render/ExportRenderPage.tsx`
- `frontend/src/pages/export-render/ExportRenderProcess.tsx`
- `frontend/src/pages/export-render/ExportRenderConsole.tsx`
- `frontend/src/shared/components/TimestampOverlay.tsx`

**Files to modify:**
- `frontend/src/App.tsx` — register the new route **outside** the `<AppShell>` element so no nav/sidebar/playback bar renders. Place it next to `/login` etc.:
  ```tsx
  <Route path="/export-render" element={<ExportRenderPage />} />
  ```
  The route is still wrapped in the auth provider so `useAuthStore` works; it must NOT be wrapped in the kiosk/visual-lock middleware.
- `frontend/src/shared/components/HistoricalPlaybackBar.tsx` — render `<TimestampOverlay />` only when CC is on (this is the **live in-app overlay**, not the export burn-in; same component, two consumers).

**Implementation details:**

`ExportRenderPage.tsx` reads URL search params:
- `module` — `"process" | "console"` (required)
- `graphicId` — UUID (required)
- `timestamp` — epoch ms (required)
- `width` — px (optional; if absent, uses `window.innerWidth`)
- `height` — px (optional)
- `dpr` — device pixel ratio (optional; defaults to `window.devicePixelRatio`)
- `overlay` — `"1" | "0"` (default `"0"`)
- `theme` — `"light" | "dark"` (so server-rendered videos can match the user's theme)

It dispatches to either `<ExportRenderProcess>` or `<ExportRenderConsole>`. Both:
1. Force `usePlaybackStore.setState({ mode: 'historical', timestamp: tsParam, timeRange: { start: tsParam-1000, end: tsParam+1000 }, isPlaying: false })` on mount.
2. Force the theme via `ThemeProvider`.
3. Set `<body style={{ width, height, overflow: 'hidden', background: 'var(--io-bg)' }}>`.
4. Reuse the existing `SceneRenderer` from `frontend/src/shared/graphics/SceneRenderer.tsx` for process; reuse the `WorkspaceGrid` for console — wrapped so they render at full window size with no panes/chrome.
5. Subscribe to historical point values for the requested timestamp (existing react-query historical hook — same one Process/Console already use in historical mode).
6. Set a DOM signal when fully ready: `document.body.setAttribute('data-export-ready', 'true')`. The capture worker waits for this attribute (or `networkidle` + a 250ms grace) before screenshotting.
7. If `overlay=1`, render `<TimestampOverlay timestamp={ts} />` absolutely positioned bottom-center with semi-transparent black background, white monospace text, format `YYYY-MM-DD HH:mm:ss`, ~24px font (configurable), high z-index.

**`TimestampOverlay.tsx`** (also used live in playback bar):
- Pure presentation component, takes `timestamp: number` prop.
- Format using `Intl.DateTimeFormat` with `en-CA` locale + `HH:mm:ss` time for `YYYY-MM-DD HH:mm:ss` shape (or roll a small helper since `en-CA` quirks may inject a comma).
- Style: `position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 6px 14px; background: rgba(0,0,0,0.6); color: white; font: 600 18px ui-monospace, monospace; border-radius: 4px; pointer-events: none;`.
- Mobile users skip this on the playback bar (just feature-gated to non-phone via `detectDeviceType()`).

**CC toggle in HistoricalPlaybackBar:**
- Add `ccOverlayEnabled: boolean` and `setCcOverlayEnabled(v: boolean)` to `frontend/src/store/playback.ts` (persisted to localStorage on change inside `setCcOverlayEnabled`).
- Add a CC button to the playback bar between the playback controls and the speed selector.
- When `ccOn`, render `<TimestampOverlay timestamp={timestamp} />` mounted as a portal into the graphic surface container.

**`data-export-ready` signal:**
- Use a `useIsAllSettled` hook that watches `useIsFetching({ queryKey: ['historical'] })`.
- Only sets `data-export-ready` attribute when fetch count hits zero AND `document.fonts.ready` has resolved.

**Verification:**
1. Manual: log in, paste `https://localhost:5173/export-render?module=process&graphicId=<uuid>&timestamp=1714200000000&width=1920&height=1080&overlay=1&theme=dark`. Page renders only the graphic + overlay, no nav.
2. `data-export-ready` attribute appears on `<body>` once point values resolve.
3. CC toggle in playback bar (live or historical) shows/hides the timestamp overlay over the graphic.
4. No regressions: existing process/console pages render normally, playback bar still works.
5. RBAC: navigating to `/export-render?module=process&...` without `process:read` redirects to forbidden.

**Gotchas:**
- Animations and CSS transitions will produce different screenshots mid-transition. Add a CSS rule to the export-render route only: `* { animation: none !important; transition: none !important; }`.
- Custom fonts must be fully loaded before setting `data-export-ready`. Use `await document.fonts.ready`.
- `waitUntil: 'networkidle'` in Playwright fires when there have been no network requests for 500ms. The WebSocket may keep small frames flowing — the `data-export-ready` flag is the authoritative signal. Use it as the primary wait, with networkidle as a fallback.

---

## Phase 4 — `video-export-service` Skeleton + Job Persistence

**Goal:** A new Rust service that exposes internal HTTP endpoints to create/inspect video export jobs and writes to `video_export_jobs`. No actual rendering yet — the worker is a stub that immediately marks the job `failed` so the full pipeline (gateway → service → DB → notify → toast) can be exercised end-to-end.

**Files to create:**
- `services/video-export-service/Cargo.toml`
- `services/video-export-service/src/main.rs`
- `services/video-export-service/src/config.rs`
- `services/video-export-service/src/state.rs`
- `services/video-export-service/src/handlers.rs`
- `services/video-export-service/src/jobs.rs` (in-memory queue + worker stub)
- `services/video-export-service/src/render/mod.rs` (placeholder)
- `services/video-export-service/src/db.rs`

**Files to modify:**
- `Cargo.toml` (workspace) — add `services/video-export-service` to `members`.
- `services/api-gateway/src/config.rs` — add `video_export_service_url: String` (env `VIDEO_EXPORT_SERVICE_URL`, default `http://127.0.0.1:3011`).
- `services/api-gateway/src/handlers/mod.rs` — add `pub mod video_exports;`.
- `services/api-gateway/src/handlers/video_exports.rs` (new) — proxy handlers.
- `services/api-gateway/src/main.rs` — register routes:
  ```
  POST   /api/video-exports              → handlers::video_exports::create
  GET    /api/video-exports              → handlers::video_exports::list
  GET    /api/video-exports/:id          → handlers::video_exports::get
  DELETE /api/video-exports/:id          → handlers::video_exports::cancel
  GET    /api/video-exports/:id/download → handlers::video_exports::download
  ```
- `services/data-broker/src/notify.rs` — extend `handle_export_complete` to read `kind` from the payload and dispatch to either `export_jobs` (kind=`data_export`) or `video_export_jobs` (kind=`video_export`) lookup. Update existing api-gateway export handlers to include `"kind":"data_export"` in their payloads.
- `crates/io-bus/src/lib.rs` — extend `ExportComplete` enum variant to carry `kind` and `status`.
- `dev.sh` / orchestrator config — add `video-export-service` to dev startup.

**`services/video-export-service/Cargo.toml`:**
```toml
[package] name = "video-export-service" edition = "2021"
[dependencies]
tokio.workspace = true
axum.workspace = true
tower.workspace = true
tower-http.workspace = true
serde.workspace = true
serde_json.workspace = true
sqlx.workspace = true
chrono.workspace = true
uuid.workspace = true
tracing.workspace = true
tracing-subscriber.workspace = true
anyhow.workspace = true
thiserror.workspace = true
io-auth = { path = "../../crates/io-auth" }
io-db = { path = "../../crates/io-db" }
io-error = { path = "../../crates/io-error" }
io-health = { path = "../../crates/io-health" }
io-observability = { path = "../../crates/io-observability" }
io-models = { path = "../../crates/io-models" }
io-export = { path = "../../crates/io-export" }
dotenvy.workspace = true
reqwest.workspace = true
once_cell.workspace = true
jsonwebtoken.workspace = true
```

**`jobs.rs` — in-memory queue:**
- `pub struct JobQueue { tx: mpsc::Sender<Uuid>, in_flight: DashMap<Uuid, JobHandle> }`.
- A single Tokio task consumes the channel sequentially — one render at a time globally. Per-user concurrency = 1 enforced at the API layer.
- `JobHandle` carries an `AbortHandle` so DELETE can cancel.
- Phase 4 worker: sleeps 2s, marks job `failed` with `error_message = "render not implemented"`, emits pg_notify.

**Gateway proxy `video_exports.rs`:**
- `create_export`:
  - RBAC: requires `<module>:video_export`.
  - Reject if user already has a `queued` or `processing` job → 409.
  - Validate: `range_end > range_start`, duration ≤ 4h, `step_ms` in [100, 60000], `fps` in [1, 30], `width × height ≤ 3840 × 2160`, frames ≤ 14,400.
  - Forward to `POST {VIDEO_EXPORT_SERVICE_URL}/internal/jobs`.
  - Return `202 { id, status: 'queued', frames_total }`.
- `download_export`: query `file_path` from `video_export_jobs`, enforce `created_by = user_id`, stream from disk with `Content-Type: video/webm` and `Content-Disposition: attachment`.

**Verification:**
- `cargo check -p video-export-service` and `cargo check --workspace` both succeed.
- `POST /api/video-exports` returns 202 with a job id.
- DB row appears with status `queued`, transitions to `failed` after ~2s.
- `pg_notify('export_complete', '{"job_id":"...","kind":"video_export","status":"failed"}')` fires and produces a frontend error toast.
- `GET /api/video-exports/<id>` returns the row.
- Second submission while one is `queued` returns 409.

**Gotchas:**
- Port 3011 — verify it's unused against all existing services.
- The `pg_notify` payload must include `status` so the frontend toast can distinguish success from failure.
- Existing data-broker code looks up `report_jobs` to find the user; ensure the new `video_export` branch looks up `video_export_jobs.created_by`.

---

## Phase 5 — Capture Worker (Node.js Playwright + FFmpeg)

**Goal:** Replace the Phase 4 stub with the actual render pipeline.

**Files to create:**
- `services/video-export-service/capture-worker/package.json`
- `services/video-export-service/capture-worker/index.mjs`
- `services/video-export-service/capture-worker/README.md`
- `services/video-export-service/Dockerfile`
- `services/video-export-service/src/render/playwright.rs`

**Files to modify:**
- `docker-compose.yml` — add `video-export-service` with shared volume for `${EXPORT_DIR}`.
- `services/video-export-service/src/jobs.rs` — wire `render_job` to call `render::playwright::run`.

**`capture-worker/index.mjs`:**
- Reads JSON params from argv[2]: `{ url_template, frames: [{timestamp, frame_index}], width, height, dpr, ticket, fps, crf, output_path }`.
- Launches Chromium: `playwright.chromium.launch({ headless: true, args: ['--disable-gpu','--no-sandbox','--disable-dev-shm-usage'] })`.
- Creates context with `viewport: {width, height}, deviceScaleFactor: dpr, ignoreHTTPSErrors: true`.
- `page.addInitScript(...)` injects `localStorage.setItem('io_access_token', ticket)` before first navigation.
- Spawns FFmpeg child:
  ```
  ffmpeg -y -f image2pipe -framerate <fps> -i pipe:0 \
         -c:v libvpx-vp9 -crf <crf> -b:v 0 -pix_fmt yuv420p \
         -row-mt 1 -threads 4 -deadline good \
         <output_path>
  ```
  `-pix_fmt yuv420p` is mandatory for VLC/MPC-HC compatibility.
- For each frame:
  1. Build URL by substituting `timestamp` into `url_template`.
  2. `await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })`.
  3. `await page.waitForFunction("document.body.dataset.exportReady === 'true'", { timeout: 30_000 })`.
  4. `const buf = await page.screenshot({ type: 'png', omitBackground: false })`.
  5. Write `buf` to `ffmpeg.stdin`.
- After last frame: `ffmpeg.stdin.end()`, await ffmpeg exit.
- Emit progress JSON to stdout every frame: `{"type":"progress","frame":N,"total":M}`.
- Emit `{"type":"done","duration_seconds":...,"file_size":...}` or `{"type":"error","message":"..."}`.
- Recycle the page every 500 frames (close + new) to prevent memory leaks.

**`render/playwright.rs`:**
1. Compute frame timestamps from `range_start`, `range_end`, `step_ms`.
2. UPDATE job to `processing`, set `started_at = NOW()`, `frames_total`.
3. Mint export ticket JWT: `sub = user_id`, `aud = "video-export"`, exp = now + 30min, `permissions = user_read_only_perms`.
4. Build URL template: `http://${FRONTEND_BASE}/export-render?module={module}&graphicId={gid}&width={w}&height={h}&dpr={dpr}&overlay={0|1}&theme={theme}&timestamp={ts}`.
5. Write params to tempfile, spawn Node child.
6. Stream stdout line by line. On `progress`, throttle UPDATE of `frames_rendered` to once/second.
7. On `done`: UPDATE to `completed`, set `file_path`, `file_size_bytes`, `duration_seconds`, `completed_at`. Emit `pg_notify('export_complete', '{"job_id":"...","kind":"video_export","status":"completed"}')`.
8. On `error` or non-zero exit: UPDATE to `failed`. Still notify so frontend shows failure toast.
9. On abort (cancellation): SIGKILL Node child, remove partial output file, UPDATE to `cancelled`.

**Output filename:** `${module}_${graphicId}_${YYYY-MM-DD_HHmm}.webm` at `${EXPORT_DIR}/videos/{job_id}.webm`.

**Docker/dev:**
```yaml
# docker-compose.yml addition
video-export-service:
  build: ./services/video-export-service
  ports: ["3011:3011"]
  environment:
    IO_DATABASE_URL: postgresql://io:io_password@db:5432/io_dev
    IO_EXPORT_DIR: /data/exports
    IO_JWT_SECRET: ${IO_JWT_SECRET}
    FRONTEND_BASE_URL: http://host.docker.internal:5173
  volumes:
    - io_exports:/data/exports
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

Dockerfile: installs `ffmpeg` (apt), Node 20, then `npx playwright install --with-deps chromium`.

**Verification:**
- End-to-end: `POST /api/video-exports` with a 60-second range at 10fps. Job transitions queued → processing → completed.
- `ffprobe services/video-export-service/output.webm` confirms VP9, target FPS, target resolution.
- VLC plays the file cleanly.
- Timestamp overlay (when enabled) renders correctly through the duration.
- Download endpoint streams with correct MIME type.
- Toast fires on completion and failure.
- Cancellation: DELETE → status `cancelled` within a few seconds, no orphan Chromium processes.

**Gotchas:**
- `--no-sandbox` required inside Docker. Use `--cap-add SYS_ADMIN` in production as an alternative if security policy requires.
- `waitUntil: 'networkidle'` is unreliable with persistent WebSocket connections. The `data-export-ready` attribute is the authoritative signal.
- Memory: recycle the Playwright page every ~500 frames.
- Large videos (4K × 24min): stream the download via `tokio_util::io::ReaderStream`, never buffer into memory.
- **Linux Docker host access:** add `extra_hosts: ["host.docker.internal:host-gateway"]` so the worker can reach the frontend dev server.

---

## Phase 6 — Frontend Record Button + Configuration Modal

**Goal:** Wire the Record button into `HistoricalPlaybackBar`, gated by RBAC, opening a configuration modal that posts to `/api/video-exports`.

**Files to create:**
- `frontend/src/shared/components/VideoExportModal.tsx`
- `frontend/src/api/videoExports.ts`

**Files to modify:**
- `frontend/src/shared/components/HistoricalPlaybackBar.tsx`:
  - Accept `module?: "process" | "console"` prop.
  - Add Record button visible only when `mode === 'historical'` and user has `<module>:video_export` permission.
- `frontend/src/pages/process/index.tsx` and `frontend/src/pages/console/index.tsx`:
  - Pass `module={"process"|"console"}` to `<HistoricalPlaybackBar />`.

**Modal contents (`VideoExportModal.tsx`):**
- **Time range:** prefill from `usePlaybackStore.timeRange`; allow editing via `<input type="datetime-local">`.
- **FPS:** select — 5 / 10 (default) / 15.
- **Step interval:** 100ms / 250ms / 500ms / 1s (default) / 2s / 5s / 10s / 30s.
- **Resolution:** read-only display of `${window.screen.width * dpr} × ${window.screen.height * dpr}`. "Custom" toggle for power users.
- **Burn timestamp:** checkbox (default mirrors `ccOverlayEnabled`).
- **Quality:** Low (CRF 35) / Medium (CRF 28, default) / High (CRF 22).
- **Estimate readout:** frames count, rough wall-time estimate, rough file size estimate (estimates only).
- **Submit:** POST `/api/video-exports`. On 202 → close modal, show "Recording started — you'll be notified when ready" toast. On 409 → inline error "You already have a video export in progress."

**`videoExports.ts` API client:**
```typescript
create(req: CreateVideoExportRequest): Promise<{ id: string; status: string; frames_total: number }>
list(): Promise<VideoExportJob[]>
get(id: string): Promise<VideoExportJob>
cancel(id: string): Promise<void>
getDownloadUrl(id: string): string
```

**Validation (client-side):**
- Blocks impossible submissions: frames > 14,400; resolution > 4K.
- Shows error inline before submit.

**Verification:**
- Operator sees the Record button in historical mode; clicking opens the modal pre-populated from playback state.
- Viewer (no `process:video_export`) does NOT see the button.
- Modal submission triggers a real render and shows the queued toast.
- Existing playback bar functionality is unchanged.
- Button does NOT appear on time-context (dashboard) mode.

**Gotchas:**
- `window.screen.width` reports CSS pixels; multiply by `devicePixelRatio` for physical pixels.
- The Record button must only appear inside `PlaybackBarInner`, not `TimeContextBar`.

---

## Phase 7 — Notification Toast Polish + My Exports Integration

**Goal:** Distinct toast copy for video exports and a unified My Exports UI.

**Files to modify:**
- `frontend/src/shared/hooks/useWsWorker.ts:264` — branch on `payload.kind`:
  - `"data_export"` → existing report-ready toast.
  - `"video_export"`, `status: "completed"` → "Your video is ready" toast linking to `getDownloadUrl(job_id)`.
  - `"video_export"`, `status: "failed"` → destructive toast "Video export failed: {reason}".
- `services/data-broker/src/notify.rs` — forward `kind` and `status` in `WsServerMessage::ExportComplete`.
- `crates/io-bus/src/lib.rs` — extend `ExportComplete` variant.

**Files to create:**
- `frontend/src/pages/settings/MyExports.tsx` — unified list: data exports + video exports. Polls both `GET /api/exports` and `GET /api/video-exports`. Shows status, file size, age, Download / Delete / Cancel actions. Add sidebar entry under Settings → My Exports.

**Verification:**
- Successful video export → "Your video is ready" toast with correct download link.
- Failed video export → red toast with the error message.
- My Exports page lists both kinds, sortable by date.
- Old data export toasts continue to work unchanged.

---

## Phase 8 — Hardening, Tests, Docs

**Goal:** Ship-ready polish.

**Files to create:**
- `services/video-export-service/tests/integration.rs` — full pipeline test with `VIDEO_EXPORT_FAKE_WORKER=1` env var triggering a stub that writes a minimal valid WebM.
- `services/video-export-service/capture-worker/test/smoke.mjs` — Node test: 3 frames against a static HTML file, assert ffprobe metadata.
- `tests/e2e/video-export.spec.ts` — Playwright E2E: login → historical mode → modal → submit → wait for WS toast → download → assert valid WebM header.
- `docs/decisions/historical-playback-video-export.md` — if not created in Phase 0, create now.

**Files to modify:**
- `design-docs/25_EXPORT_SYSTEM.md` (or nearest existing export doc) — append section "Historical Playback Video Export" describing architecture and routes.
- `services/video-export-service/Cargo.toml` — add dev-deps: `reqwest`, `wiremock`, `tokio` test feature.

**Hardening checklist:**
- **Disk space pre-flight:** before starting a job, check `statvfs(EXPORT_DIR)` and reject if free < estimated bytes × 1.5.
- **Orphan recovery on startup:** on service start, find all `video_export_jobs WHERE status IN ('queued','processing')` and mark them `failed` with `error_message = 'Service restarted during render'`, emit pg_notify for each.
- **Audit log:** write to `audit_log` on job creation with `action = 'video_export.create'`, `target_id = job_id`.
- **Metrics:** emit Prometheus counters `video_export_jobs_total{status=...}`, histograms `video_export_render_duration_seconds` and `video_export_frames_total`.
- **Cleanup task:** extend (or add separately to `video-export-service`) a task that sweeps `${EXPORT_DIR}/videos/` and `.tmp/` subdirs older than `EXPORT_RETENTION_HOURS`.
- **Download streaming:** ensure `Content-Length` is set from `file_size_bytes` and the file is streamed (not buffered into memory).
- **Theme match:** export modal reads the user's current theme preference and passes it as the `theme` query param so the video matches what they see.

**Verification:**
- `cargo test -p video-export-service` passes.
- `cd services/video-export-service/capture-worker && npm test` passes.
- E2E test green.
- Chaos test: kill service mid-render, restart → orphaned `processing` rows become `failed`.
- Disk-full simulation → API returns 507 Insufficient Storage before job is queued.

---

## Sequencing Summary

| Phase | Dependencies | Can parallelize with |
|---|---|---|
| 0 — Decision Record | none | — |
| 1 — RBAC migrations | 0 | 3 (frontend-only) |
| 2 — DB schema | 1 | 3 (frontend-only) |
| 3 — `/export-render` route | 0 | 1, 2 |
| 4 — Service skeleton + stub | 1, 2 | — |
| 5 — Real capture worker | 3, 4 | — |
| 6 — Record button + modal | 1, 5 | — |
| 7 — Toast polish + My Exports | 5, 6 | — |
| 8 — Hardening + tests + docs | 7 | — |

Phases 1, 2, and 3 can all run in parallel after Phase 0. Everything else is strictly sequential.

---

## Cross-cutting Risks

1. **Chromium in production deployment.** The runtime image must include all of Chromium's transitive deps (~150MB). The official Playwright Docker image is the safe baseline.
2. **GPU/CPU saturation.** A 4K × 24-min render at 10fps = 14,400 page renders. Budget ~30 minutes wall time. Raise `step_ms` defaults at higher resolutions.
3. **Auth ticket scope.** Each render uses a fresh Chromium context destroyed at job end. Never reuse contexts across jobs.
4. **VLC compatibility requires `-pix_fmt yuv420p`.** Do not drop this flag for any reason.
5. **`samael` build flag.** `BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include"` is required on this machine for any workspace build. Document in service README and dev.sh.
6. **Single-concurrent-render bottleneck.** v1 enforces global concurrency = 1. Per-tenant concurrency limits are out of scope but should be noted for v2 planning.
