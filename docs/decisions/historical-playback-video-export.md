# Decision: Historical Playback Video Export

**Status:** Decided  
**Date:** 2026-04-27  
**Plan:** `docs/plans/video-export-plan.md`  
**Tasks:** `docs/tasks/VE/VE-00.md` through `VE-08.md`

---

## Format and Encoding

- Output format: WebM/VP9 (royalty-free; plays natively in VLC and MPC-HC)
- FPS: 10–15 (default 10); configurable at export time
- Quality: CRF 28 constrained quality mode (`-b:v 0`); configurable Low (CRF 35) / Medium (CRF 28) / High (CRF 22)
- Audio: none
- `-pix_fmt yuv420p` is mandatory for VLC/MPC-HC compatibility — never drop this flag
- Rationale for low FPS: content is mostly static between data steps; 10–15fps is enough to smooth inter-step transitions without inflating file size

## Capture Strategy

- Server-side headless Chromium controlled by a Node.js Playwright capture worker
- Dedicated minimal frontend route `/export-render` renders only the graphic at a single timestamp — no nav, no sidebar, no playback bar
- Playwright navigates to a new URL per frame, waits for `document.body.dataset.exportReady === 'true'`, screenshots as PNG, pipes to FFmpeg stdin
- One frame per data step; output FPS controls how fast the video plays, not how fast frames are captured
- The `data-export-ready` signal is set by the frontend after all historical point queries settle and `document.fonts.ready` resolves

## Resolution

- Client reports `window.screen.width`, `window.screen.height`, and `window.devicePixelRatio` at export submission time
- Server configures Playwright viewport to match exactly (`viewport: { width, height }, deviceScaleFactor: dpr`)
- Capped at 3840×2160 server-side to prevent abuse
- SVG-based rendering (`SceneRenderer`) is resolution-independent — scales cleanly to any viewport size without quality loss
- Rationale: refineries run 4K displays on 85" screens where readability is essential; 1080p downscale would be unacceptable

## Service Placement

- New `services/video-export-service/` Rust crate, Axum, port 3011
- Rationale: long-running subprocess supervision (Playwright + FFmpeg) must not block the api-gateway request hot path; a hung Chromium process should not impact unrelated API calls
- api-gateway proxies user-facing endpoints (`POST /api/video-exports`, `GET /api/video-exports/:id`, etc.)
- Download endpoint served directly by the gateway from the shared `export_dir` volume — avoids proxying large binary streams through the video-export-service

## Playwright Integration

- Node.js worker at `services/video-export-service/capture-worker/index.mjs`
- Invoked as a child process by the Rust service via `tokio::process::Command`
- Rationale for Node.js over Rust Playwright crate: the Rust crate is immature and lags protocol changes; the Node.js library is the canonical implementation
- Communication protocol (stdout JSON lines):
  - Progress: `{"type":"progress","frame":N,"total":M}`
  - Success: `{"type":"done","duration_seconds":F,"file_size":N}`
  - Failure: `{"type":"error","message":"..."}` + exit code 1
- Rust supervisor throttles DB progress updates to once per second to avoid write amplification

## Headless Browser Authentication

- Backend mints a short-lived "export ticket" JWT per render job
- Claims: `sub=user_id`, `aud="video-export"`, TTL 30 minutes, `permissions=[...read-only subset...]`
- Read-only subset: only permissions not containing `write`, `delete`, `admin`, `configure`, or `export`
- Capture worker injects via `page.addInitScript(() => localStorage.setItem('io_access_token', ticket))` before first navigation
- Rationale: user's regular access token (15-min TTL) may expire during a long render; storing the user's real token server-side is a security hazard; export ticket is scoped to minimum necessary access

## Notification

- Reuse existing `pg_notify('export_complete')` → data-broker → WebSocket → frontend toast pipeline
- Extend payload with two new fields:
  - `kind`: `"data_export"` (existing behaviour, default) or `"video_export"` (new)
  - `status`: `"completed"` or `"failed"`
- data-broker branches on `kind` to look up the correct job table for `created_by`
- Frontend `useWsWorker` branches on `kind` and `status` for toast copy

## RBAC

- New permissions: `process:video_export`, `console:video_export`
- Granted to: Admin, Shift Supervisor, Operator, Engineer
- Not granted by default: Maintenance Technician, Safety Officer, Data Steward, Viewer (grantable via custom roles)
- CC overlay toggle is permission-free — available to all authenticated users regardless of role
- Rationale: operators and engineers are the primary audience for incident replay exports

## Storage and Retention

- Completed files: `${EXPORT_DIR}/videos/{job_id}.webm`
- In-flight temp files: `${EXPORT_DIR}/videos/.tmp/{job_id}.json` (params file, deleted after worker exits)
- Retention: reuses `EXPORT_RETENTION_HOURS` env var (default 24h); hourly cleanup sweep
- Orphan recovery: on service startup, any rows in `queued` or `processing` are marked `failed` and a pg_notify is emitted so the user receives a failure toast rather than silent disappearance

## Concurrency

- Single concurrent render per user enforced at the API layer (409 if user already has a `queued` or `processing` job)
- Single global render at a time enforced by a single-consumer Tokio mpsc channel inside the video-export-service
- Rationale for v1: simplicity; per-tenant concurrency limits are out of scope and can be added in v2

## Subtitle / Timestamp Overlay

- CC toggle in the playback bar: `ccOverlayEnabled: boolean` in `usePlaybackStore`, persisted to `localStorage` key `io_playback_cc`
- When enabled in-app: `<TimestampOverlay>` rendered as a `createPortal` to `document.body` over the graphic
- In exported video: if the job was submitted with `overlay_timestamp=true` (mirroring the CC toggle state at submission time), the `/export-render` route renders `<TimestampOverlay>` which burns into each screenshot frame
- Timestamp format: `YYYY-MM-DD HH:mm:ss` in local time — absolute datetime, not elapsed
- Rationale: refinery operations must align with real-world time; elapsed time is irrelevant to incident analysis
- Style: bottom-center, `padding: 6px 14px`, `rgba(0,0,0,0.6)` background, white monospace text, `border-radius: 4px`, `pointer-events: none`
