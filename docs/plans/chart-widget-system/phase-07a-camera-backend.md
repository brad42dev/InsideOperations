# Phase 07a — Camera Stream Backend

**Goal:** Build the full backend for the Camera Streams system: PostgreSQL schema, Rust API in `io-api-gateway`, RBAC permissions, go2rtc Docker sidecar, nginx proxy.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phase 04 must be complete (this phase touches no frontend code; chart55 lands in 07c).
- `/home/io/io-dev/io/services/api-gateway/src/handlers/` — list all files. Pattern-match the existing handler structure (e.g. `dashboards.rs` for a CRUD-style resource).
- `/home/io/io-dev/io/services/api-gateway/src/main.rs` — to see how routes are registered.
- `/home/io/io-dev/io/crates/io-models/` — for the existing model patterns (e.g. dashboards, expressions).
- `/home/io/io-dev/io/migrations/` — recent migration files to match the timestamp + naming convention.
- `/home/io/io-dev/io/docker-compose.yml` — to add the go2rtc sidecar.
- `/home/io/io-dev/io/nginx/` (or wherever nginx config lives — `find . -name "nginx*.conf"`) — to add the `/go2rtc/` proxy location.
- The current RBAC permissions seed: `grep -rn "video_streams\|video_stream" /home/io/io-dev/io/migrations /home/io/io-dev/io/crates/io-auth` to confirm none exist yet. The permissions table seed is in an earlier migration; find it with `grep -rn "INSERT INTO permissions" migrations/`.

## Context

Camera Streams are a new domain object. They feed live video into Camera Stream widgets (chart55, Phase 07c). The system supports:

- **Visibility tiers**:
  - `public` — anyone can view; admins (and potentially anyone) can add. For phase 07a, only admins create.
  - `managed` — only admins create; anyone can view.
  - `private` — only admins create; viewing requires explicit role/user ACL grants.
- **Connection mode**:
  - `direct` — the widget connects directly to the camera URL (browser → camera). Works only on private networks where the browser can reach the camera.
  - `relay` — the widget connects to go2rtc, which fetches the camera and re-streams as WebRTC/HLS/MJPEG.
  - `auto` — Happy Eyeballs in the widget: try direct at t=0, relay at t+1s, first-frame-wins. Phase 07c implements the widget side; backend just stores both URLs.
- **go2rtc** — a small relay daemon. Configured via a YAML file; we mount the file into the container. Streams are added/removed by editing the YAML file or via go2rtc's REST API. We use the REST API for adds/removes from the API gateway.

Token endpoint: a widget mounted in a graphic doesn't get the camera URL directly — it calls `GET /api/video-streams/:id/token`. The endpoint enforces ACL (returns 403 for private streams the user can't access) and returns short-lived URLs the widget can connect to: `{ directUrl?, relayUrl?, expiresAt }`. This is the enforcement point — placement-time checks aren't enough because graphics can be shared.

go2rtc's outputs are reverse-proxied at `/go2rtc/` via nginx. Same domain, no CORS. The relay URLs returned to the widget are like `/go2rtc/api/stream.html?src=stream_<uuid>` or `/go2rtc/api/ws?src=stream_<uuid>` for WebRTC, depending on the protocol the widget chooses.

## Changes

### 1. Database migrations

**1a.** Create `migrations/<timestamp>_video_streams.up.sql` and `.down.sql`. Use today's date in the timestamp following the existing pattern (e.g. `20260430000001_video_streams.up.sql`).

```sql
-- video_streams.up.sql
CREATE TYPE video_stream_visibility AS ENUM ('public', 'managed', 'private');
CREATE TYPE video_stream_connection_mode AS ENUM ('direct', 'relay', 'auto');

CREATE TABLE video_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  visibility video_stream_visibility NOT NULL DEFAULT 'managed',
  connection_mode video_stream_connection_mode NOT NULL DEFAULT 'auto',
  -- Direct stream URL (browser → camera). NULL when connection_mode = 'relay'.
  direct_url TEXT,
  -- go2rtc stream name + auxiliary config; JSON for forward compatibility.
  -- Example: { "stream_name": "cam_kitchen", "go2rtc_inputs": ["rtsp://..."] }
  relay_config JSONB,
  -- ONVIF discovery / PTZ / auth metadata for future phases. Not used by widget yet.
  onvif_config JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX video_streams_visibility_idx ON video_streams(visibility);

CREATE TRIGGER video_streams_set_updated_at
  BEFORE UPDATE ON video_streams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

(`set_updated_at` is the existing trigger function used elsewhere — `grep -rn "FUNCTION set_updated_at" migrations/` confirms.)

**1b.** Create `migrations/<timestamp>_video_stream_access.up.sql` and `.down.sql`:

```sql
-- video_stream_access.up.sql
CREATE TYPE video_stream_acl_entity_type AS ENUM ('role', 'user');

CREATE TABLE video_stream_access (
  stream_id UUID NOT NULL REFERENCES video_streams(id) ON DELETE CASCADE,
  entity_type video_stream_acl_entity_type NOT NULL,
  entity_id TEXT NOT NULL,    -- role name (slug) or user UUID, depending on entity_type
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (stream_id, entity_type, entity_id)
);

CREATE INDEX video_stream_access_stream_idx ON video_stream_access(stream_id);
```

**1c.** RBAC permissions seed migration `migrations/<timestamp>_video_stream_permissions.up.sql`:

```sql
INSERT INTO permissions (name, description) VALUES
  ('video_streams:manage', 'Create, edit, and delete video streams; manage ACL'),
  ('video_streams:view', 'View video streams (subject to per-stream ACL for private)')
ON CONFLICT (name) DO NOTHING;

-- Grant to default admin role (existing seed pattern; verify role name)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('video_streams:manage', 'video_streams:view')
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
```

(Inspect `migrations/` for the actual permissions and role_permissions schema; the column names may differ. Match the existing pattern exactly.)

### 2. Rust models

Add to `crates/io-models/src/lib.rs` (or a new module file `crates/io-models/src/video_streams.rs`):

```rust
use serde::{Deserialize, Serialize};
use sqlx::types::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "video_stream_visibility", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum VideoStreamVisibility { Public, Managed, Private }

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "video_stream_connection_mode", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum VideoStreamConnectionMode { Direct, Relay, Auto }

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct VideoStream {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub visibility: VideoStreamVisibility,
    pub connection_mode: VideoStreamConnectionMode,
    pub direct_url: Option<String>,
    pub relay_config: Option<serde_json::Value>,
    pub onvif_config: Option<serde_json::Value>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVideoStreamRequest {
    pub name: String,
    pub description: Option<String>,
    pub visibility: VideoStreamVisibility,
    pub connection_mode: VideoStreamConnectionMode,
    pub direct_url: Option<String>,
    pub relay_config: Option<serde_json::Value>,
    pub onvif_config: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVideoStreamRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub visibility: Option<VideoStreamVisibility>,
    pub connection_mode: Option<VideoStreamConnectionMode>,
    pub direct_url: Option<String>,
    pub relay_config: Option<serde_json::Value>,
    pub onvif_config: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "video_stream_acl_entity_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum VideoStreamAclEntityType { Role, User }

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct VideoStreamAccess {
    pub stream_id: Uuid,
    pub entity_type: VideoStreamAclEntityType,
    pub entity_id: String,
}

#[derive(Debug, Serialize)]
pub struct VideoStreamTokenResponse {
    pub direct_url: Option<String>,
    pub relay_url: Option<String>,
    pub token: String,
    pub expires_at: DateTime<Utc>,
}
```

Re-export from `crates/io-models/src/lib.rs` if using a submodule.

### 3. API handler `services/api-gateway/src/handlers/video_streams.rs`

Implement:

- `GET /api/video-streams` — list streams visible to the requesting user. Public + managed are visible to anyone authenticated. Private streams are visible only if the user has an ACL grant (role or user match) or has `video_streams:manage`.
- `GET /api/video-streams/:id` — single stream. Same visibility rules.
- `POST /api/video-streams` — requires `video_streams:manage`. Body: `CreateVideoStreamRequest`. On create with `connection_mode != "direct"`, register the stream in go2rtc by calling its REST API (see step 5).
- `PUT /api/video-streams/:id` — requires `video_streams:manage`. Update fields; if relay config changed, update go2rtc accordingly.
- `DELETE /api/video-streams/:id` — requires `video_streams:manage`. Remove from go2rtc, delete row, cascade ACLs.
- `GET /api/video-streams/:id/token` — enforces ACL strictly. Returns `{ direct_url, relay_url, token, expires_at }`. Token is short-lived (30 minutes). For the relay URL, build `format!("/go2rtc/api/ws?src=stream_{}", stream_id)` (or the appropriate go2rtc endpoint).
- `GET /api/video-streams/:id/access` — list ACL grants. Manage only.
- `POST /api/video-streams/:id/access` — add an ACL grant. Manage only. Body: `{ entity_type, entity_id }`.
- `DELETE /api/video-streams/:id/access/:entity_type/:entity_id` — remove ACL grant. Manage only.

ACL helper:

```rust
async fn user_can_view_stream(
    db: &Pool<Postgres>,
    user_id: Uuid,
    user_roles: &[String],
    stream: &VideoStream,
    user_perms: &HashSet<String>,
) -> bool {
    if user_perms.contains("video_streams:manage") { return true; }
    match stream.visibility {
        VideoStreamVisibility::Public => true,
        VideoStreamVisibility::Managed => true,
        VideoStreamVisibility::Private => {
            // Look up matching ACL grants
            let user_id_str = user_id.to_string();
            let row = sqlx::query!(
                r#"SELECT 1 AS hit FROM video_stream_access
                   WHERE stream_id = $1
                   AND ((entity_type = 'user' AND entity_id = $2)
                     OR (entity_type = 'role' AND entity_id = ANY($3)))
                   LIMIT 1"#,
                stream.id, user_id_str, user_roles
            )
            .fetch_optional(db).await.ok().flatten();
            row.is_some()
        }
    }
}
```

Wire the routes in `services/api-gateway/src/main.rs` (or wherever the existing route table is built — match the pattern used by `dashboards.rs`).

### 4. RBAC enforcement

The existing API gateway already has middleware that loads the user's effective permissions on each request. Use that same pattern. For `video_streams:manage` endpoints, return 403 if the permission is missing. For `video_streams:view`, the helper above suffices.

### 5. go2rtc integration

**5a.** Add go2rtc sidecar to `docker-compose.yml`. Pick the official image (`alexxit/go2rtc:latest` or pin to a release tag). It is **MIT licensed** — verify before merging:

```yaml
  go2rtc:
    image: alexxit/go2rtc:latest
    container_name: io-go2rtc
    restart: unless-stopped
    network_mode: host  # easiest for RTSP/UDP; alternative is bridged with port maps
    volumes:
      - ./go2rtc/go2rtc.yaml:/config/go2rtc.yaml
    # ports:    # only needed if not using host network
    #   - "1984:1984"   # API + WebRTC
    #   - "8554:8554"   # RTSP
```

Confirm `network_mode: host` is acceptable for the deployment. Bridged with explicit ports also works but RTSP-over-UDP requires careful port mapping.

**5b.** Create `go2rtc/go2rtc.yaml`:

```yaml
api:
  listen: ":1984"

# Streams added dynamically via REST API (POST /api/streams) by the API gateway.
streams: {}

webrtc:
  candidates:
    - stun:8555
```

**5c.** nginx proxy. Find the nginx config (likely `nginx/io.conf` or `nginx/conf.d/default.conf`) and add a `/go2rtc/` location:

```nginx
location /go2rtc/ {
    proxy_pass http://127.0.0.1:1984/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_buffering off;
    proxy_read_timeout 600s;
}
```

Reload nginx configuration (in dev: `docker compose restart nginx` or whatever the existing pattern is).

**5d.** API gateway → go2rtc REST integration. When creating/updating a stream with `connection_mode != "direct"`, call go2rtc's REST API:

```rust
async fn go2rtc_register_stream(
    client: &reqwest::Client,
    stream_name: &str,
    inputs: &[String],
) -> anyhow::Result<()> {
    let url = format!("http://127.0.0.1:1984/api/streams?name={}", stream_name);
    client.put(&url).json(&serde_json::json!({ "src": inputs })).send().await?;
    Ok(())
}

async fn go2rtc_remove_stream(
    client: &reqwest::Client,
    stream_name: &str,
) -> anyhow::Result<()> {
    let url = format!("http://127.0.0.1:1984/api/streams?name={}", stream_name);
    client.delete(&url).send().await?;
    Ok(())
}
```

Inspect go2rtc's actual REST schema (see https://github.com/AlexxIT/go2rtc) — the exact path/method may differ slightly. Confirm with the version pinned in compose.

**5e.** Stream name convention: `stream_{uuid}` (UUID without dashes). Store the resolved name in `relay_config` JSONB so the frontend (via the token endpoint) can build the correct relay URL.

### 6. Add `reqwest` and `anyhow` deps to api-gateway

If not already in `services/api-gateway/Cargo.toml`:

```toml
reqwest = { version = "0.12", features = ["json"] }
```

(Workspace likely already has these — check.)

## Gotchas

- **`BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include"`** required for `cargo build` because `samael` (auth crate transitive dep) needs it on this machine.
- **`cargo clippy -- -D warnings`** must be clean.
- **go2rtc license**: alexxit/go2rtc is MIT (verify against the repo before merging). Do not use any GPL-licensed video relay.
- **ACL enforcement at token endpoint** is the contract. Don't enforce only at placement-time — graphics can be shared, copied, exported.
- **Token expiration**: 30 minutes is fine for a video session. Longer = wider abuse window if leaked.
- **`network_mode: host` on go2rtc** simplifies RTSP/UDP but conflicts with the existing docker-compose if other services rely on internal networks. Check before merging. Alternative: bridged + explicit port maps.
- **Migrations down files** are required — write inverse SQL for every up migration.
- **Permissions table column names** may differ from the example; copy the existing seed pattern verbatim.
- **CORS isn't a concern** because go2rtc is reverse-proxied at the same origin (`/go2rtc/`) — no preflights needed.
- **Document the "go2rtc on a separate server" deployment**: in code comments at the integration call site, note that swapping the `127.0.0.1:1984` URL to a remote host is the only change needed. Don't build remote support; just make sure nothing assumes localhost beyond the compose default.

## Acceptance criteria

1. `BINDGEN_EXTRA_CLANG_ARGS=... cargo build` exits 0 in `services/api-gateway`.
2. `cargo clippy -- -D warnings` clean.
3. `cargo test -p io-api-gateway` passes.
4. `sqlx migrate run` applies the new migrations.
5. `./dev.sh start` starts the stack with go2rtc; `docker compose ps` shows `io-go2rtc` running.
6. `curl -s http://localhost/go2rtc/api/streams` returns the go2rtc API response (200 OK, possibly empty).
7. `curl -s -H "Authorization: Bearer <admin-jwt>" http://localhost/api/video-streams` returns `[]` initially.
8. Create a stream via `POST /api/video-streams` with a public RTSP URL. List shows it. go2rtc has the stream registered (`curl /go2rtc/api/streams` shows it).
9. `GET /api/video-streams/:id/token` as admin returns `{ direct_url, relay_url, token }`.
10. As a non-admin without ACL on a private stream, the token endpoint returns 403.
11. `DELETE /api/video-streams/:id` removes the row and the go2rtc registration.

## Phase dependencies

- **Depends on:** Phase 04 (only because the MASTER plan sequences phases 5x/6x as parallel siblings; this phase is independent of those, but should be done after 04 to keep the running checklist linear).
- **Gates:** Phase 07b (Settings UI), Phase 07c (Camera widget).
