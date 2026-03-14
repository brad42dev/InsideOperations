# Inside/Operations - Production Deployment Guide

## Server Requirements

### Minimum Hardware
- **CPU:** 4 cores (8 recommended)
- **RAM:** 16 GB (32 GB recommended)
- **Disk:** 100 GB SSD (database and logs)
- **Network:** 1 Gbps Ethernet

### Operating System
- Ubuntu 20.04+ LTS
- RHEL 8+ / Rocky Linux 8+
- Debian 11+

### Software Prerequisites
- PostgreSQL 16 with TimescaleDB extension
- nginx 1.24+
- systemd (included in all modern Linux distros)
- openssl (for TLS certificates)
- `instant-acme` — compiled into the API Gateway (Apache-2.0, pure Rust, async/Tokio). Used for ACME/Let's Encrypt certificate automation. No external tools required. Optional if using only imported or self-signed certificates.
- unixODBC 2.3+ and ODBC drivers (if Import Service connects to non-native databases via ODBC)
- `resvg` — compiled into the API Gateway (pure Rust SVG renderer, MPL-2.0, no external dependencies). Used for server-side tile generation. Similar to YARA-X, no additional system packages needed.

## Deployment Profiles

### Standalone (Single Server/VM)

All 11 services on one machine. Simplest deployment — suitable for single-site installations with moderate load.

- **Minimum**: 16 GB RAM, 8 CPU cores, 500 GB SSD
- All services run as systemd units on a single host
- Systemd watchdog timers on all services (`WatchdogSec=30`)
- External health monitor recommended (UptimeRobot, Healthchecks.io, or cron on a separate machine) to detect full host failure
- UPS required if running on bare metal (not applicable for VMs with host-level UPS)

### Resilient (Primary + Standby VM)

Two-machine deployment where the standby provides survivable alerting if the primary goes down.

- **Primary**: Full stack — all 11 services + PostgreSQL
- **Standby**: Replicated PostgreSQL + Alert Service + Email Service + minimal health monitoring UI
- PostgreSQL streaming replication (async, <1s lag typical)
- SQLx multi-host connection string for automatic DB failover: `postgres://user:pass@primary:5432,standby:5432/iodb`
- If primary dies, the standby can independently send emergency alerts and monitor primary health
- Standby does NOT run the full I/O stack — just the survivable alerting core
- **Failover is partial**: Operators lose real-time graphics, dashboards, and process views. They retain the ability to receive emergency alerts and send manual alerts via a minimal web UI on the standby.

### Enterprise HA (Future — Reference Path)

Documented path for full high-availability. Not fully designed — included as a reference for organizations that require zero-downtime guarantees.

- Load balancer (nginx/HAProxy) in front of multiple API Gateway instances
- Multiple frontend servers
- PostgreSQL with synchronous replication
- Full redundancy and rolling upgrades with zero downtime
- Detailed design deferred until demand warrants it

---

## Database High Availability (Optional)

PostgreSQL streaming replication for the Resilient deployment profile. Skip this section for Standalone deployments.

### Primary Configuration

Add to `postgresql.conf` on the primary:
```
wal_level = replica
max_wal_senders = 3
synchronous_commit = off    # async for performance — <1s replication lag typical
```

Create a replication user:
```sql
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'secure_repl_password';
```

Add to `pg_hba.conf`:
```
host replication replicator standby_ip/32 scram-sha-256
```

### Standby Setup

```bash
# Bootstrap standby from primary
pg_basebackup -h primary_ip -D /var/lib/postgresql/16/main -U replicator -P -R
```

The `-R` flag creates `standby.signal` and populates `primary_conninfo` in `postgresql.auto.conf`.

### Failover

- **Manual**: Connect to standby and run `SELECT pg_promote();`
- **Automatic**: Configure `promote_trigger_file` in `postgresql.conf` — create the file to trigger promotion
- After promotion, the standby becomes a standalone primary. Reconfigure replication after primary recovery.

### TimescaleDB Replication Notes

TimescaleDB hypertables, continuous aggregates, and compression policies all replicate transparently via WAL-level replication. No special TimescaleDB-specific replication configuration is needed. Continuous aggregate refresh policies will run on the new primary after promotion.

---

## OPC Service Data Buffering

Data loss prevention for the OPC-to-database write path. If the database becomes temporarily unavailable, the OPC Service buffers incoming point data to prevent gaps.

### Buffer Architecture

```
OPC UA Server → OPC Service → [In-Memory Ring Buffer] → PostgreSQL
                                      ↓ (if full)
                              [Disk WAL-Style Buffer]
                                      ↓ (on DB recovery)
                              [Replay in chronological order]
```

### Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `OPC_BUFFER_MEMORY_SECONDS` | `60` | In-memory ring buffer capacity (seconds of point data) |
| `OPC_BUFFER_DISK_PATH` | `/var/lib/io-opc/buffer/` | Directory for disk spill files |
| `OPC_BUFFER_DISK_MAX_MB` | `1024` | Maximum disk buffer size before oldest data is dropped |

### Behavior

1. Normal operation: OPC Service writes directly to PostgreSQL. Buffer is empty.
2. DB write fails: Data accumulates in the in-memory ring buffer (default 60 seconds capacity).
3. Ring buffer fills: Spill to WAL-style append-only files on disk at `OPC_BUFFER_DISK_PATH`.
4. DB recovers: Replay buffered data (memory + disk) in chronological order. Disk files are deleted after successful replay.
5. Disk buffer exceeds `OPC_BUFFER_DISK_MAX_MB`: Oldest disk segments are dropped with a warning log. Some data loss is preferable to filling the disk.

---

## Deployment Hardening

### Systemd Watchdog

All 11 services support systemd watchdog integration. Each service periodically notifies systemd via `sd_notify("WATCHDOG=1")`. If the notification stops (service hung, deadlocked, or unresponsive), systemd restarts the service automatically.

Add to each service's systemd unit `[Service]` section:
```ini
WatchdogSec=30
```

The service must notify systemd at least every 30 seconds. The recommended notification interval is half the watchdog timeout (every 15 seconds).

### Alert Service Heartbeat

The Alert Service can send a periodic heartbeat to an external monitoring webhook. This ensures that if the entire I/O host goes down, an external system detects the failure.

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `ALERT_HEARTBEAT_URL` | (none) | External webhook URL (e.g., `https://hc-ping.com/xxxx`) |
| `ALERT_HEARTBEAT_INTERVAL_SEC` | `60` | Seconds between heartbeat pings |

When configured, the Alert Service sends an HTTP POST to the heartbeat URL at the specified interval. If the external monitoring service (Healthchecks.io, UptimeRobot, etc.) stops receiving pings, it triggers its own alert through a completely independent channel.

---

## Upgrade Procedure

### Pre-Upgrade Checklist

1. Review release notes for breaking changes and migration notes
2. Create a backup (`.iobackup`) before upgrading
3. Verify disk space for database migrations (check release notes for large migrations)
4. Schedule maintenance window if the upgrade includes breaking API changes (v1 → v2 transition)

### Standalone Upgrade (Single-Server)

1. Download new release package
2. Stop services in reverse dependency order: Alert Service, Email Service, Import Service, Event Service, Parser Service, Archive Service, Recognition Service, OPC Service, Data Broker, Auth Service, API Gateway
3. Replace binaries in `/opt/insideoperations/bin/`
4. Start services in dependency order: API Gateway → Auth Service → Data Broker → OPC Service → remaining services in any order
5. Each service runs embedded migrations automatically on startup — no manual `sqlx migrate run` step
6. Verify health: check `GET /health/ready` on each service, or use the System Health page in Settings
7. Monitor logs for errors: `journalctl -u io-* --since "5 minutes ago"`

### Rolling Restart (Resilient / HA Deployments)

Services can be restarted one at a time in any order because database migrations are idempotent and backward-compatible (see doc 04 Database Migration Policy).

- **Recommended order**: Auth Service first (other services validate tokens against it) → API Gateway → Data Broker → remaining services
- Each service checks the migration version on startup and applies pending migrations if needed
- Multiple service instances coordinate via PostgreSQL advisory locks to prevent concurrent migration execution
- Alert Service routing: swing to standby before upgrading primary, restore after primary is healthy (same as previous resilient upgrade procedure)

### Rollback

- **Binary rollback**: Stop services, restore previous binaries, restart in dependency order
- **Database rollback**: `sqlx migrate revert --target-version <previous>` using the `.down.sql` scripts included with each migration
- **If data backfill migrations ran**: Restore from `.iobackup` instead — backfills may not be cleanly reversible via `.down.sql`
- Always verify health on all 11 services after rollback

### Version Tracking

- Each service reports its version via the `/health/ready` response and the `io_service_info` metric
- Settings > System Health shows all service versions at a glance
- Version mismatch between services is flagged as a warning in System Health

---

## YARA-X Content Scanning

YARA-X provides content scanning for uploaded files (SVG imports, ONNX models, bulk update templates) to detect malicious payloads before they enter the system.

- YARA-X is compiled into the API Gateway (pure Rust via the `yara-x` crate, no external dependencies)
- Custom rule files deployed to a configurable directory
- Default rules ship compiled into the binary for SVG injection, XML XXE, and ONNX anomalies
- Additional rules can be added without recompilation by placing `.yar` files in the rules directory

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `YARA_RULES_PATH` | `/etc/io/yara-rules/` | Directory for custom YARA rule files |

```bash
# Create rules directory
sudo mkdir -p /etc/io/yara-rules
sudo chown insideoperations:insideoperations /etc/io/yara-rules
```

---

## Tile-Based Graphics Rendering

Server-side tile generation for phone-based graphics viewing. The API Gateway uses `resvg` (MPL-2.0, pure Rust SVG renderer) to pre-render Console graphics into tile pyramids. Phones display these tiles via Leaflet (BSD-2-Clause) with pinch-to-zoom navigation.

### Tile Storage Setup

```bash
sudo mkdir -p /opt/insideoperations/tiles
sudo chown insideoperations:insideoperations /opt/insideoperations/tiles
sudo chmod 750 /opt/insideoperations/tiles
```

### Directory Structure

```
/opt/insideoperations/tiles/{graphic_id}/{zoom_level}/{x}_{y}.png
```

Each graphic gets a directory. Zoom levels 0 through `TILE_MAX_ZOOM` contain progressively higher-resolution tiles. Zoom 0 is the entire graphic in a single tile; each level doubles the resolution.

### Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `TILE_STORAGE_DIR` | `/opt/insideoperations/tiles` | Root directory for tile pyramid storage |
| `TILE_MAX_ZOOM` | `5` | Maximum zoom level (levels 0-5) |
| `TILE_SIZE` | `256` | Pixels per tile edge |
| `TILE_RETENTION_HOURS` | `168` | Regenerate tiles older than this (default 7 days) |

### Tile Generation

Tile generation runs as a background Tokio task within the API Gateway process. Tiles are generated:

1. **On graphic save/update** — the Designer module triggers regeneration when a graphic is saved
2. **On first phone request** — if a phone requests tiles for a graphic that hasn't been pre-rendered (or whose tiles have expired), the API Gateway generates them on-demand before serving

Generation is CPU-bound (SVG rasterization via `resvg`). For large graphics at high zoom levels, initial generation may take several seconds. Subsequent requests are served directly from disk.

### nginx Configuration

Serve tiles directly from disk to bypass the API Gateway for performance. Add this block to the nginx site configuration:

```nginx
location /tiles/ {
    alias /opt/insideoperations/tiles/;
    expires 1h;
    add_header Cache-Control "public, immutable";
}
```

### Dynamic Value Overlays

Dynamic point values are **not** part of the tile layer. Real-time values are delivered via WebSocket as JSON and rendered client-side on top of the static tile layer. This keeps tiles cacheable and avoids regeneration on every point update.

---

## Installation Steps

### 1. Install PostgreSQL + TimescaleDB
```bash
# Ubuntu
sudo apt-get install postgresql-16 postgresql-16-timescaledb
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres createuser insideoperations
sudo -u postgres createdb insideoperations -O insideoperations
sudo -u postgres psql -c "ALTER USER insideoperations WITH PASSWORD 'secure_password';"

# Enable TimescaleDB
sudo -u postgres psql -d insideoperations -c "CREATE EXTENSION timescaledb;"
```

### 2. Deploy Rust Services
```bash
# Build release binaries
cargo build --release

# Copy binaries to /opt/insideoperations
sudo mkdir -p /opt/insideoperations/bin
sudo cp target/release/api-gateway /opt/insideoperations/bin/
sudo cp target/release/broker /opt/insideoperations/bin/
sudo cp target/release/opc-service /opt/insideoperations/bin/
sudo cp target/release/event-service /opt/insideoperations/bin/
sudo cp target/release/parser-service /opt/insideoperations/bin/
sudo cp target/release/archive-service /opt/insideoperations/bin/
sudo cp target/release/import-service /opt/insideoperations/bin/
sudo cp target/release/alert-service /opt/insideoperations/bin/
sudo cp target/release/email-service /opt/insideoperations/bin/
sudo cp target/release/auth-service /opt/insideoperations/bin/
sudo cp target/release/recognition-service /opt/insideoperations/bin/

# Create .env file
sudo cp .env.example /opt/insideoperations/.env
sudo nano /opt/insideoperations/.env  # Edit with production values
```

### 3. Create systemd Services
```bash
# Create service files for each Rust service
# Example: /etc/systemd/system/io-api-gateway.service
[Unit]
Description=Inside/Operations API Gateway
After=network.target postgresql.service

[Service]
Type=simple
User=insideoperations
Group=insideoperations
WorkingDirectory=/opt/insideoperations
EnvironmentFile=/opt/insideoperations/.env
ExecStart=/opt/insideoperations/bin/api-gateway
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target

# Enable and start services
sudo systemctl enable io-api-gateway
sudo systemctl start io-api-gateway
# (Repeat for broker, opc-service, event-service, parser-service, archive-service, import-service, alert-service, email-service, auth-service, recognition-service)

# Import Service runs at lower CPU priority (QoS tier 3)
# /etc/systemd/system/io-import-service.service
[Unit]
Description=Inside/Operations Import Service
After=network.target postgresql.service

[Service]
Type=simple
User=insideoperations
Group=insideoperations
WorkingDirectory=/opt/insideoperations
EnvironmentFile=/opt/insideoperations/.env
ExecStart=/opt/insideoperations/bin/import-service
Nice=10
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target

# Alert Service — safety critical, always restart
# /etc/systemd/system/io-alert-service.service
[Unit]
Description=Inside/Operations Alert Service
After=network.target postgresql.service

[Service]
Type=simple
User=insideoperations
Group=insideoperations
WorkingDirectory=/opt/insideoperations
EnvironmentFile=/opt/insideoperations/.env
ExecStart=/opt/insideoperations/bin/alert-service
Restart=always
RestartSec=3s

[Install]
WantedBy=multi-user.target

# Email Service
# /etc/systemd/system/io-email-service.service
[Unit]
Description=Inside/Operations Email Service
After=network.target postgresql.service

[Service]
Type=simple
User=insideoperations
Group=insideoperations
WorkingDirectory=/opt/insideoperations
EnvironmentFile=/opt/insideoperations/.env
ExecStart=/opt/insideoperations/bin/email-service
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target

# Auth Service
# /etc/systemd/system/io-auth-service.service
[Unit]
Description=Inside/Operations Auth Service
After=network.target postgresql.service

[Service]
Type=simple
User=insideoperations
Group=insideoperations
WorkingDirectory=/opt/insideoperations
EnvironmentFile=/opt/insideoperations/.env
ExecStart=/opt/insideoperations/bin/auth-service
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target

# Recognition Service
# /etc/systemd/system/io-recognition-service.service
[Unit]
Description=Inside/Operations Recognition Service
After=network.target postgresql.service

[Service]
Type=simple
User=insideoperations
Group=insideoperations
WorkingDirectory=/opt/insideoperations
EnvironmentFile=/opt/insideoperations/.env
ExecStart=/opt/insideoperations/bin/recognition-service
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

### 4. Build and Deploy Frontend
```bash
# Build frontend
cd packages/frontend
pnpm install
pnpm build

# Copy build to nginx directory
sudo mkdir -p /var/www/insideoperations
sudo cp -r dist/* /var/www/insideoperations/
```

### 5. Configure nginx
```nginx
# /etc/nginx/sites-available/insideoperations
server {
    listen 443 ssl http2;
    server_name your-hostname.com;

    # TLS configuration (managed by I/O — see TLS Certificates section)
    include /etc/io/nginx/tls.conf;

    # Frontend static files
    root /var/www/insideoperations;
    index index.html;

    # API Gateway proxy
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:3001/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Frontend SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/insideoperations /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Configure Export File Storage
```bash
# Create export file directory
sudo mkdir -p /opt/insideoperations/exports
sudo chown insideoperations:insideoperations /opt/insideoperations/exports
sudo chmod 750 /opt/insideoperations/exports
```

The API Gateway writes export files to this directory. Files are named `{job_id}.{ext}`. A background task within the API Gateway process runs hourly, deleting export files older than the retention period (default 24 hours, configurable via `EXPORT_RETENTION_HOURS` environment variable).

Add to `.env`:
```
EXPORT_FILE_DIR=/opt/insideoperations/exports
EXPORT_RETENTION_HOURS=24
EXPORT_MAX_WORKERS=3
EXPORT_PER_USER_LIMIT=5
EXPORT_MAX_FILE_SIZE_MB=500
BULK_UPDATE_MAX_UPLOAD_MB=50
BULK_UPDATE_MAX_ROWS=50000
TILE_STORAGE_DIR=/opt/insideoperations/tiles
TILE_MAX_ZOOM=5
TILE_SIZE=256
BACKUP_STORAGE_DIR=/opt/insideoperations/backups
BACKUP_RETENTION_COUNT=7
BACKUP_SCHEDULE=0 2 * * *
ALERT_SERVICE_PORT=3007
EMAIL_SERVICE_PORT=3008
AUTH_SERVICE_PORT=3009
RECOGNITION_SERVICE_PORT=3010
IO_CERT_DIR=/etc/io/certs
IO_ACME_WEBROOT=/var/www/acme-challenge
IO_CERT_RENEW_DAYS=30
```

### 7. Generate Master Encryption Key
```bash
cd /opt/insideoperations
./bin/io-ctl generate-master-key

# Generates a 256-bit random key, encrypts it via systemd-creds, and stores
# the encrypted blob at /etc/io/creds/master-key.enc
#
# If TPM2 is available: key is sealed to the TPM (strongest protection)
# If no TPM2: key is encrypted with the host key (/var/lib/systemd/credential.secret)
#
# The plaintext key NEVER exists on disk — only the encrypted credential.
# At service start, systemd decrypts it into a tmpfs ($CREDENTIALS_DIRECTORY).
#
# CRITICAL: Back up the encrypted credential blob securely. Without it, all
# encrypted credentials in the database are unrecoverable. For TPM2-sealed
# keys, also document the TPM recovery procedure for hardware replacement.
```

### 8. Run Database Migrations
```bash
cd /opt/insideoperations
sqlx migrate run --source migrations --database-url "$DATABASE_URL"
```

### 9. Seed Initial Data
```bash
cd /opt/insideoperations

# Full seed (both tiers — recommended for fresh install)
./bin/api-gateway seed

# Or run tiers separately:
# ./bin/api-gateway seed --tier1   # Bootstrap: roles, permissions, admin user, settings
# ./bin/api-gateway seed --tier2   # Content: canned dashboards, reports, connectors, symbol library

# Tier 1 creates:
#   - Default admin user (admin / changeme, forced password change on first login)
#   - 8 predefined roles (Viewer, Operator, Shift Supervisor, etc.)
#   - 118 permissions with role-permission assignments
#   - 9 default data categories
#   - Manual Entry point source
#   - System settings (alarm, rounds, log, forensics, tile, backup)
#   - Alert channels (in_app, email, sms, push)
#   - EULA v1.0 (from bundled EULA.md, published and active)
#   - Default "Primary" site
#
# Tier 2 creates:
#   - 38 canned report templates
#   - 19 canned dashboard templates
#   - 40 connector templates for Universal Import
#   - ISA-101 symbol library SVG templates (27 equipment types)
#   - Recognition class-to-template mappings
#
# Both tiers are idempotent (safe to re-run). On upgrade, re-running
# seed adds new content without modifying existing user-customized data.
```

### 10. Configure Firewall
```bash
# Ubuntu (ufw)
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (for Let's Encrypt)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# Block direct access to service ports (3000-3010)
# Only nginx should access them via localhost
```

## TLS Certificates

### Self-Signed (Default on Install)

Auto-generated by the API Gateway on first startup via the `rcgen` crate (MIT/Apache-2.0, pure Rust). This ensures HTTPS works immediately — no manual certificate setup required before the admin can access the system.

- Generated on first startup if no certificate exists at the configured path
- Stored at `/etc/io/certs/self-signed.crt` and `/etc/io/certs/self-signed.key` (or configured path)
- nginx configured to use these by default via the `active.crt` / `active.key` symlinks
- Status indicator in the UI shows **amber** for self-signed certificates
- Persistent banner on all pages: "This server is using a self-signed certificate. Configure a trusted certificate in Settings > Certificates."

### ACME / Let's Encrypt Integration

Automated certificate issuance and renewal via `instant-acme` (Apache-2.0, pure Rust, async/Tokio). Compiled directly into the API Gateway — no external tools, no subprocess orchestration.

- ACME operations handled natively by the API Gateway service
- Certificate storage: `/etc/io/certs/acme/`

**Two challenge types supported:**

- **HTTP-01** (default): Requires port 80 reachable from the internet. nginx serves ACME challenge responses from a webroot:
  ```nginx
  # Added to the port-80 server block
  location /.well-known/acme-challenge/ {
      root /var/www/acme-challenge;
  }
  ```
- **DNS-01**: For environments where port 80 is blocked (common in industrial networks). Two modes:
  - **Manual**: Admin adds a TXT record at `_acme-challenge.<DOMAIN>` when prompted
  - **Automatic**: API Gateway makes DNS API calls directly (Cloudflare, AWS Route 53, Azure DNS, etc.) using admin-configured credentials

**Auto-renewal**: A systemd timer triggers the API Gateway's renewal check every 12 hours. Certificates are renewed when within 30 days of expiry. Post-renewal hook reloads nginx (zero downtime — SIGHUP to master process, workers drain gracefully).

```ini
# /etc/systemd/system/io-cert-renew.timer
[Unit]
Description=ACME Certificate Renewal

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/io-cert-renew.service
[Unit]
Description=ACME Certificate Renewal Check

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -s -o /dev/null -w '%%{http_code}' -X POST http://127.0.0.1:3001/api/internal/certs/renew
ExecStartPost=/bin/bash -c 'nginx -t && systemctl reload nginx'
User=root
```

### nginx TLS Configuration

TLS settings are managed via an included snippet file. Certificate changes never require editing the main nginx config.

```nginx
# /etc/io/nginx/tls.conf (included by main server block)
ssl_certificate     /etc/io/certs/active.crt;
ssl_certificate_key /etc/io/certs/active.key;
ssl_protocols       TLSv1.2 TLSv1.3;
ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache   shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
# HSTS disabled by default, enabled via Settings toggle
# add_header Strict-Transport-Security "max-age=63072000" always;
```

### Certificate File Organization

```
/etc/io/certs/
  self-signed.crt          # Auto-generated on install
  self-signed.key
  active.crt -> ...        # Symlink to current active cert
  active.key -> ...        # Symlink to current active key
  acme/                    # ACME-managed certificates
  imported/                # User-uploaded certificates
  client/                  # Client certificates (OPC UA, etc.)
  trusted/                 # Trusted CA certificates
```

```bash
# Create certificate directory (included in install script)
sudo mkdir -p /etc/io/certs/{acme,imported,client,trusted}
sudo chown root:insideoperations /etc/io/certs
sudo chmod 750 /etc/io/certs
```

### HSTS

HSTS is **off by default**. Enabling HSTS with a self-signed certificate would cause browsers to hard-block access with no bypass option. Admin toggle in Settings > Certificates enables HSTS after a valid (trusted) certificate is installed. When enabled, nginx adds the header:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains
```

HSTS preload is explicitly out of scope (internal hostnames, dynamic deployments).

### Certificate Expiry Monitoring

The API Gateway checks certificate expiry on startup and every 6 hours thereafter.

- **15-day warning threshold** for standard certificates (percentage-based for short-lived certs — e.g., 33% of remaining lifetime)
- Expiry warnings surface as system alerts (via Alert Service) and as a status indicator in the System Monitoring dashboard
- Banner at top of all pages when certificate is within 7 days of expiry or expired
- ACME auto-renewal prevents expiry for Let's Encrypt certs (renewal at 30 days before expiry, 90-day cert lifetime = 60-day buffer)

## Monitoring

### Logs
- Service logs: `journalctl -u io-api-gateway -f`
- nginx logs: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- Database logs: `/var/log/postgresql/`

### Health Checks

All 11 services implement health checks via the `io-health` shared crate. Response format:
```json
{
  "status": "ok",
  "service": "io-api-gateway",
  "version": "0.1.0",
  "uptime_seconds": 3600,
  "db": "connected"
}
```

| Service | Health Check |
|---------|-------------|
| API Gateway | `curl http://localhost:3000/healthz` |
| Data Broker | `curl http://localhost:3001/healthz` |
| OPC Service | `curl http://localhost:3002/healthz` |
| Event Service | `curl http://localhost:3003/healthz` |
| Parser Service | `curl http://localhost:3004/healthz` |
| Archive Service | `curl http://localhost:3005/healthz` |
| Import Service | `curl http://localhost:3006/healthz` |
| Alert Service | `curl http://localhost:3007/healthz` |
| Email Service | `curl http://localhost:3008/healthz` |
| Auth Service | `curl http://localhost:3009/healthz` |
| Recognition Service | `curl http://localhost:3010/healthz` |
| Frontend | `curl https://your-hostname.com` |

### Metrics (Future)
- Prometheus for metrics collection
- Grafana for visualization
- Alert manager for notifications

## Backup & Recovery

### .iobackup Encrypted Containers

I/O uses `.iobackup` files — AES-256-GCM encrypted containers produced by the backup system in Settings. See [15_SETTINGS_MODULE.md](15_SETTINGS_MODULE.md) for the full `.iobackup` format specification (triple-wrapped DEK encryption).

```bash
# Create backup storage directory
sudo mkdir -p /opt/insideoperations/backups
sudo chown insideoperations:insideoperations /opt/insideoperations/backups
sudo chmod 750 /opt/insideoperations/backups
```

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `BACKUP_STORAGE_DIR` | `/opt/insideoperations/backups` | Directory for `.iobackup` files |
| `BACKUP_RETENTION_COUNT` | `7` | Number of recent backups to keep (oldest auto-deleted) |
| `BACKUP_SCHEDULE` | `0 2 * * *` | Cron expression for automated backups (default: 2am daily) |

Backup and restore operations are managed through Settings > Backup & Recovery. The system handles database dumps, configuration, and attached files as a single encrypted package.

> **First-time setup**: The first backup generates a **customer recovery key** that **must** be printed and stored physically. This key is required to decrypt `.iobackup` files. It cannot be recovered from the system if lost.

### Manual pg_dump (Supplement)

A raw `pg_dump` can supplement the `.iobackup` system as a quick manual safety net. It does not include encryption, configuration, or attached files.

```bash
# Manual database-only backup
pg_dump insideoperations | gzip > /opt/insideoperations/backups/manual_$(date +%Y%m%d).sql.gz

# Restore from manual backup
gunzip -c manual_20260310.sql.gz | psql insideoperations
```

## Recognition Model Deployment

Symbol Recognition (P&ID and DCS) is optional. If no model files are deployed, recognition features are disabled and all other I/O functionality is unaffected. See [26_PID_RECOGNITION.md](26_PID_RECOGNITION.md) for full recognition system design.

### Model Directory Structure

```bash
# Create model directories
sudo mkdir -p /opt/io/models/{current/pid,current/dcs,archive/pid,archive/dcs,incoming,gap-reports}
sudo chown -R insideoperations:insideoperations /opt/io/models
sudo chmod -R 750 /opt/io/models
```

```
/opt/io/models/
├── current/
│   ├── pid/                   # Currently loaded P&ID model
│   │   └── model_pid_v1.2.0.iomodel
│   └── dcs/                   # Currently loaded DCS model
│       └── model_dcs_v1.0.0.iomodel
├── archive/
│   ├── pid/                   # Previous P&ID models
│   │   ├── model_pid_v1.1.0.iomodel
│   │   └── model_pid_v1.0.0.iomodel
│   └── dcs/                   # Previous DCS models
│       └── (none yet)
├── incoming/                  # Drop zone for new models (auto-detected by model_domain)
│   └── (new .iomodel files placed here trigger hot-swap)
└── gap-reports/               # .iogap variation gap reports from SymBA
    └── variation_report_2026Q1.iogap
```

Add to `.env`:
```
IO_MODEL_DIR=/opt/io/models
IO_RECOGNITION_ENABLED=true
```

### ONNX Runtime CUDA Setup

The `ort` crate (Rust ONNX Runtime bindings) requires the ONNX Runtime shared library and, for GPU inference, the CUDA execution provider. The API Gateway auto-detects available hardware at startup and falls back to CPU if CUDA is unavailable.

```bash
# Install ONNX Runtime (required)
# The ort crate downloads ONNX Runtime automatically during cargo build.
# For production, pre-install the shared library:
wget https://github.com/microsoft/onnxruntime/releases/download/v1.18.0/onnxruntime-linux-x64-gpu-1.18.0.tgz
tar xzf onnxruntime-linux-x64-gpu-1.18.0.tgz
sudo cp onnxruntime-linux-x64-gpu-1.18.0/lib/* /usr/local/lib/
sudo ldconfig

# For GPU inference (optional), install CUDA toolkit and cuDNN:
# CUDA 12.x and cuDNN 8.x are required by ONNX Runtime GPU provider
# Follow NVIDIA's official installation guide for your distribution
```

Execution provider priority (configured automatically by the `ort` crate):

| Priority | Provider | Requirement | Performance |
|----------|----------|------------|-------------|
| 1 | CUDA | NVIDIA GPU + CUDA 12.x + cuDNN 8.x | ~100-200ms/image (FCOS FP16) |
| 2 | CPU | None (always available) | ~1-3s/image (FCOS FP32) |

If CUDA initialization fails (missing drivers, incompatible GPU), the service logs a warning and falls back to CPU silently. No manual configuration is needed.

### .iomodel File Handling

`.iomodel` files are ZIP packages produced by SymBA containing ONNX model files, a manifest, preprocessing configuration, and a class map. See [SymBA 17_IO_INTEGRATION.md](../../SymBA/design-docs/17_IO_INTEGRATION.md) for the canonical format specification.

**Package contents (P&ID):**
```
model_pid_v1.0.0.iomodel (ZIP)
├── manifest.json          # Metadata, model_domain, architecture
├── model.onnx             # Primary ONNX model (FP32)
├── model_fp16.onnx        # GPU-optimized variant (FP16, optional)
├── class_map.json         # Class ID → symbol name mapping (20 P&ID classes)
├── preprocessing.json     # Input preprocessing config
└── eval_report.json       # Evaluation metrics
```

**Package contents (DCS):**
```
model_dcs_v1.0.0.iomodel (ZIP)
├── manifest.json          # model_domain: "dcs"
├── model.onnx             # DCS detection model (FP32)
├── model_fp16.onnx        # GPU-optimized variant (optional)
├── class_map.json         # DCS equipment class mapping
├── preprocessing.json     # Preprocessing config
└── eval_report.json       # Evaluation metrics
```

Both domains currently use single-model detection. The `model_domain` field in `manifest.json` tells I/O which class map and symbol template set to use. Both domain models can be loaded simultaneously.

**Loading:** On startup, the API Gateway scans `/opt/io/models/current/` for `.iomodel` files. If found, it unzips to a temp directory, validates the manifest, and creates `ort::Session` instances for each ONNX file.

**Hot-swap procedure:**
1. Place a new `.iomodel` file in `/opt/io/models/incoming/` (or upload via Settings > Recognition UI)
2. The API Gateway detects the new file and loads it into new `ort::Session` instances
3. The active model reference is swapped atomically via `Arc<RwLock<...>>`
4. In-flight requests using the old model complete normally (old sessions drop when last reference is released)
5. The previous model is moved from `current/` to `archive/`
6. The new model is moved from `incoming/` to `current/`

Zero downtime. No service restart required. No requests are dropped during the swap.

### .iogap File Handling

`.iogap` files are ZIP packages produced by SymBA's variation tracking system containing symbol variation analysis and gap recommendations. They are imported via Settings > Recognition > Variation Gap Reports.

**Placement:** Drop `.iogap` files in `/opt/io/models/gap-reports/` or upload via the Settings UI.

**Storage:** Gap reports are read-only reference data. Old reports can be deleted without affecting system operation — they are not required for recognition inference.

## Twilio Account Setup

The Alert Service uses Twilio for SMS and Voice call delivery channels. Twilio is optional — if not configured, SMS and Voice channels remain disabled.

1. **Create a Twilio account** at [twilio.com](https://www.twilio.com)
2. **Purchase a toll-free number** (recommended for SMS deliverability)
3. **Request 25 MPS throughput** for the toll-free number (default is 1 MPS, insufficient for alert bursts)
4. **Complete toll-free verification** — Twilio requires a use case description and business verification. Allow 3-4 weeks for approval.
5. **Note credentials**: Account SID, Auth Token, and From Number
6. **Configure in I/O**: Settings > Alerts > Channels > SMS (and Voice) — enter Account SID, Auth Token, and From Number
7. **Configure webhook URLs**: Set Twilio status callback URLs to `https://your-hostname.com/api/alerts/webhooks/twilio/status` (SMS) and `https://your-hostname.com/api/alerts/webhooks/twilio/voice` (Voice)

## SAML Build Dependencies

Building with SAML support (`--features saml`) requires C libraries for XML signature verification. These are **only needed on the build system** when the `saml` feature flag is enabled. Deployments using only OIDC/LDAP can skip this entirely.

```bash
# Ubuntu/Debian
sudo apt-get install libxmlsec1-dev libxml2-dev libxslt1-dev libxmlsec1-openssl-dev libclang-dev pkg-config

# RHEL/Rocky
sudo dnf install xmlsec1-devel libxml2-devel libxslt-devel xmlsec1-openssl-devel clang-devel pkgconfig
```

Build with SAML:
```bash
cargo build --release --features saml
```

Build without SAML (no C dependencies beyond openssl):
```bash
cargo build --release
```

The resulting binary includes or excludes SAML endpoints based on the feature flag. OIDC (`openidconnect` crate) and LDAP (`ldap3` crate) are pure Rust and always included.

> **Future**: The `bergshamra` crate (BSD-2-Clause, pure Rust) may eventually replace the xmlsec1 C dependency. If that materializes, the SAML feature flag and these build dependencies become unnecessary. See doc 29 for details.

## IdP Registration

When deploying I/O with SSO, the customer's IT team must register I/O in their identity provider before SSO will work.

### OIDC Registration

1. Register I/O as a **web application** in the IdP (Azure AD/Entra ID, Okta, PingFederate, etc.)
2. Set the redirect URI to: `https://{io-host}/api/auth/oidc/callback`
3. Receive **client ID** and **client secret** from the IdP
4. Enter these in I/O Settings > Authentication > Providers > Add OIDC Provider
5. I/O auto-discovers endpoints from the issuer URL via `.well-known/openid-configuration`

### SAML Registration

1. Register I/O as a **SAML Service Provider** in the IdP
2. Provide I/O's SP metadata URL: `https://{io-host}/api/auth/saml/metadata`
   - The IdP can fetch this URL directly, or the admin can download the XML and upload it manually
3. Configure **attribute mapping** in the IdP to send email, name, and group claims
4. In I/O, upload the IdP metadata (URL or XML) via Settings > Authentication > Providers > Add SAML Provider

### LDAP Registration

1. Create a **service account** in Active Directory / LDAP for I/O bind operations
2. Configure in I/O Settings > Authentication > Providers > Add LDAP Provider:
   - **Bind DN**: e.g., `CN=io-svc,OU=Service Accounts,DC=corp,DC=plant,DC=com`
   - **Base DN**: e.g., `OU=Users,DC=corp,DC=plant,DC=com`
   - **Search filter**: default `(&(sAMAccountName={username})(objectClass=user))`
   - **TLS settings**: `ldaps` (port 636, recommended), `starttls` (port 389), or `none` (testing only)
3. Use the **Test Connection** button to verify bind credentials and search base before enabling

### SCIM Provisioning

1. Enable SCIM in I/O Settings > Authentication > SCIM
2. Generate a **bearer token** (displayed once — copy it immediately)
3. Configure the IdP's SCIM provisioning to point to: `https://{io-host}/scim/v2/`
4. Provide the bearer token as the SCIM authentication credential

> **Note**: SCIM endpoints (`/scim/v2/*`) use bearer token authentication, not JWT. Tokens are generated and managed in Settings > Authentication > SCIM — they are independent of I/O's JWT session infrastructure.

## Authentication Environment Variables

Add to `.env`:
```
# Authentication (Auth Service, port 3009)
AUTH_DEFAULT_PROVIDER=local          # local, oidc, saml, or ldap — determines login page default
AUTH_LOCAL_ENABLED=true              # Whether local username/password auth is allowed alongside SSO
AUTH_MFA_GRACE_PERIOD_HOURS=72       # Default grace period before MFA enrollment is enforced
AUTH_MFA_MAX_FAILURES=5              # Failed MFA attempts before lockout
AUTH_MFA_LOCKOUT_DURATION_SEC=1800   # Lockout duration after max MFA failures (30 minutes)
AUTH_SESSION_DURATION_OVERRIDE=      # Optional per-provider session duration override (seconds)
```

These supplement the existing `AUTH_SESSION_ACCESS_TOKEN_LIFETIME_SEC` (900) and `AUTH_SESSION_REFRESH_TOKEN_LIFETIME_SEC` (604800) variables. See doc 29 for the full auth configuration model.

## Email Provider Configuration

The Email Service supports multiple provider types. At least one provider must be configured for email delivery (alerts, reports, password resets, etc.).

- **SMTP**: Hostname, port (587 for STARTTLS, 465 for implicit TLS), username, password. Most common for on-premise mail servers.
- **SMTP+XOAUTH2**: Same as SMTP but uses OAuth2 tokens instead of passwords. Required by Microsoft 365 and Gmail when basic auth is disabled.
- **Microsoft Graph**: Register an Azure AD application with `Mail.Send` application permission. Requires admin consent. Use client credentials flow (client_id, client_secret, tenant_id). No mailbox license needed for application-level send.
- **Gmail**: Create a GCP service account with domain-wide delegation. Enable the Gmail API. Grant the service account `https://www.googleapis.com/auth/gmail.send` scope via Google Workspace admin console.
- **Webhook**: HTTP POST to an external URL with JSON payload. Configure URL and authentication (Bearer token, API key header, or basic auth). Useful for integration with internal mail relay services.
- **Amazon SES**: IAM access key and secret key, AWS region. Requires verified sender identity (domain or email address). Use SES sandbox for testing before requesting production access.

Configure providers in Settings > Email > Providers. Set one provider as default and optionally one as fallback. The Email Service automatically fails over to the fallback provider on delivery failure.

## Success Criteria

✅ All 11 services running and healthy
✅ Frontend accessible via HTTPS
✅ Database backups automated
✅ Logs accessible for troubleshooting
✅ TLS certificates valid and auto-renewing

## Optional: Jaeger Deployment

Jaeger all-in-one (Apache 2.0) can be deployed alongside I/O for cross-service distributed request tracing. Not required for normal operation — only useful for debugging latency issues and understanding cross-service call chains.

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `IO_TRACING_ENABLED` | `false` | Enable OpenTelemetry trace export to Jaeger |
| `IO_JAEGER_ENDPOINT` | `http://localhost:4317` | Jaeger OTLP gRPC endpoint |

When enabled, each service emits trace spans for inbound HTTP requests, outbound service calls, and database queries. Jaeger UI is available at port 16686.

## Help Content Bundling

Help markdown files are bundled into the frontend build at compile time. There is no runtime dependency on external documentation servers. To update help content, update the `help/` directory and rebuild the frontend — the new content is included in the next release package.

## Change Log

- **v1.6**: Fixed canned report template count 37→38 in seed data script comment.
- **v1.5**: Fixed stale permission count in seed data section (114 → 118).
- **v1.4**: Replaced `acme.sh` subprocess with `instant-acme` (pure Rust, compiled into API Gateway). Removed `IO_ACME_DIR` env var. Renewal service now triggers API Gateway internal endpoint instead of calling external script.
- **v1.3**: Added master key generation step (step 7, `io-ctl generate-master-key`). Expanded seed data step with two-tier system (`--tier1`/`--tier2` flags), full inventory of seeded data per tier. Renumbered firewall to step 10. See doc 03 (Secrets Management) and doc 04 (Seed Data Strategy).
- **v1.2**: Added Upgrade Procedure section (pre-upgrade checklist, single-server and rolling restart steps, rollback procedure, version tracking). Added optional Jaeger deployment for distributed tracing. Added help content bundling note. See doc 36 (Observability).
- **v1.1**: Added "Seed Initial Data" installation step (step 8, firewall renumbered to 9). Seeds default roles, data categories, and EULA v1.0 from bundled EULA.md with SHA-256 content hash. First login prompts EULA acceptance. See 29_AUTHENTICATION.md EULA Acceptance Gate.
- **v1.0**: Deep dive: Expanded TLS section with self-signed auto-generation (rcgen), ACME/Let's Encrypt integration (acme.sh, HTTP-01 + DNS-01 challenges), nginx TLS snippet config, certificate file organization with symlink-based active cert, systemd renewal timer, HSTS toggle (off by default), certificate expiry monitoring (6-hour checks, 15-day warning). Added acme.sh to software prerequisites. Updated nginx config to use TLS snippet include. Added cert environment variables (IO_CERT_DIR, IO_ACME_DIR, IO_ACME_WEBROOT, IO_CERT_RENEW_DAYS).
- **v0.9**: Updated recognition model references to match SymBA's actual implementation. Replaced RF-DETR/YOLOX with FCOS (FP16 GPU, FP32 CPU). Replaced P&ID multi-file package (detector_gpu, detector_cpu, ocr) and DCS multi-model package (4 ONNX files) with unified single-model format for both domains (model.onnx + optional model_fp16.onnx). Both domains now use single-model detection; model_domain determines class map and template set.
- **v0.8**: Added Tile-Based Graphics Rendering section (resvg tile pyramids, Leaflet phone display, nginx direct-serve, directory structure, environment variables). Replaced Backup & Recovery section with .iobackup encrypted container format (AES-256-GCM, retention count, schedule, customer recovery key) — references doc 15 Settings; kept manual pg_dump as supplement. Added resvg to Software Prerequisites. Added tile and backup environment variables to .env block (TILE_STORAGE_DIR, TILE_MAX_ZOOM, TILE_SIZE, BACKUP_STORAGE_DIR, BACKUP_RETENTION_COUNT, BACKUP_SCHEDULE).
- **v0.7**: Added Deployment Profiles (Standalone, Resilient, Enterprise HA reference). Added Database High Availability section (PostgreSQL streaming replication, TimescaleDB notes). Added OPC Service Data Buffering section (in-memory ring buffer + disk spill). Added Deployment Hardening section (systemd watchdog, Alert Service heartbeat). Added Upgrade Procedure section (backward compatibility rule, standalone/resilient upgrade, rollback). Added YARA-X Content Scanning section. Updated health checks to all 11 services with `io-health` shared crate response format. Added Auth Service (port 3009) and Recognition Service (port 3010) systemd units, binaries, env vars, and port assignments. Updated firewall range to 3000-3010. Updated success criteria to 11 services.
- **v0.6**: Added SAML build dependencies section (feature-flagged C library requirements), IdP registration steps (OIDC, SAML, LDAP, SCIM), authentication environment variables, SCIM deployment note (bearer token auth, not JWT). References doc 29.
- **v0.5**: Added alert-service and email-service binaries, systemd units (alert-service: Restart=always/3s, email-service: Restart=on-failure/5s), ports 3007-3008, environment variables. Added Twilio Account Setup and Email Provider Configuration sections. Updated firewall range to 3000-3008, health checks and success criteria to 9 services. See 27_ALERT_SYSTEM.md and 28_EMAIL_SERVICE.md.
- **v0.4**: Expanded recognition model deployment for dual-domain support (P&ID + DCS). Organized model directory by domain subdirectories. Added DCS multi-model package contents. Added .iogap file handling section. Renamed section from "P&ID Recognition" to "Recognition Model Deployment". See SymBA 17_IO_INTEGRATION.md.
- **v0.3**: Added P&ID recognition model deployment section covering directory structure, ONNX Runtime CUDA setup, and `.iomodel` handling. See `26_PID_RECOGNITION.md`.
- **v0.2**: Added export file storage directory configuration (Step 6). Added environment variables for export system: EXPORT_FILE_DIR, EXPORT_RETENTION_HOURS, EXPORT_MAX_WORKERS, EXPORT_PER_USER_LIMIT, EXPORT_MAX_FILE_SIZE_MB, BULK_UPDATE_MAX_UPLOAD_MB, BULK_UPDATE_MAX_ROWS. Renumbered subsequent steps. See 25_EXPORT_SYSTEM.md.
- **v0.1**: Added Import Service (import-service binary, systemd unit with Nice=10 for QoS, port 3006). Added unixODBC to software prerequisites. Updated firewall range (3000-3006). Updated success criteria to 7 services. See 24_UNIVERSAL_IMPORT.md.
