---
id: DD-22-005
title: Add ~20 missing spec-required environment variables to io.env.example
unit: DD-22
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `io.env.example` template is the canonical reference for operators configuring a new installation. The spec defines specific environment variables for the tile system, OPC data buffer, export system, backup system, alert heartbeat, auth MFA, and certificate management. These variables control critical behavior (how long tiles are cached, how much disk the OPC buffer uses, how often exports are cleaned up, when MFA lockout triggers). They must appear in the template so operators know they can be tuned, and so the services can read them at startup.

## Spec Excerpt (verbatim)

> Add to `.env`:
> ```
> EXPORT_FILE_DIR=/opt/insideoperations/exports
> EXPORT_RETENTION_HOURS=24
> EXPORT_MAX_WORKERS=3
> EXPORT_PER_USER_LIMIT=5
> EXPORT_MAX_FILE_SIZE_MB=500
> BULK_UPDATE_MAX_UPLOAD_MB=50
> BULK_UPDATE_MAX_ROWS=50000
> TILE_STORAGE_DIR=/opt/insideoperations/tiles
> TILE_MAX_ZOOM=5
> TILE_SIZE=256
> BACKUP_STORAGE_DIR=/opt/insideoperations/backups
> BACKUP_RETENTION_COUNT=7
> BACKUP_SCHEDULE=0 2 * * *
> ...
> IO_CERT_DIR=/etc/io/certs
> IO_ACME_WEBROOT=/var/www/acme-challenge
> IO_CERT_RENEW_DAYS=30
> ```
> — design-docs/22_DEPLOYMENT_GUIDE.md, §6. Configure Export File Storage

> | `TILE_RETENTION_HOURS` | `168` | Regenerate tiles older than this (default 7 days) |
> — design-docs/22_DEPLOYMENT_GUIDE.md, §Tile-Based Graphics Rendering

> | `OPC_BUFFER_MEMORY_SECONDS` | `60` | In-memory ring buffer capacity |
> | `OPC_BUFFER_DISK_PATH` | `/var/lib/io-opc/buffer/` | Directory for disk spill files |
> | `OPC_BUFFER_DISK_MAX_MB` | `1024` | Maximum disk buffer size |
> — design-docs/22_DEPLOYMENT_GUIDE.md, §OPC Service Data Buffering

> | `ALERT_HEARTBEAT_URL` | (none) | External webhook URL |
> | `ALERT_HEARTBEAT_INTERVAL_SEC` | `60` | Seconds between heartbeat pings |
> — design-docs/22_DEPLOYMENT_GUIDE.md, §Alert Service Heartbeat

> AUTH_MFA_GRACE_PERIOD_HOURS=72
> AUTH_MFA_MAX_FAILURES=5
> AUTH_MFA_LOCKOUT_DURATION_SEC=1800
> — design-docs/22_DEPLOYMENT_GUIDE.md, §Authentication Environment Variables

## Where to Look in the Codebase

Primary files:
- `/home/io/io-dev/io/config/io.env.example` — the env template file

Current state: the file has `TILE_STORAGE_DIR`, `TILE_MAX_ZOOM`, `TILE_SIZE`, and `IO_EXPORT_DIR` but is missing all other variables listed above. `TILE_MAX_ZOOM` defaults to `4` in the template; the spec says `5`.

## Verification Checklist

Read `config/io.env.example`:

- [ ] `TILE_RETENTION_HOURS=168` is present
- [ ] `TILE_MAX_ZOOM=5` (spec default) — currently `4` in the template
- [ ] `EXPORT_RETENTION_HOURS=24` is present
- [ ] `EXPORT_MAX_WORKERS=3` is present
- [ ] `EXPORT_PER_USER_LIMIT=5` is present
- [ ] `EXPORT_MAX_FILE_SIZE_MB=500` is present
- [ ] `BULK_UPDATE_MAX_UPLOAD_MB=50` is present
- [ ] `BULK_UPDATE_MAX_ROWS=50000` is present
- [ ] `BACKUP_RETENTION_COUNT=7` is present
- [ ] `BACKUP_SCHEDULE=0 2 * * *` is present
- [ ] `BACKUP_STORAGE_DIR=/opt/io/backups` is present
- [ ] `OPC_BUFFER_MEMORY_SECONDS=60` is present
- [ ] `OPC_BUFFER_DISK_PATH=/var/lib/io-opc/buffer/` is present
- [ ] `OPC_BUFFER_DISK_MAX_MB=1024` is present
- [ ] `ALERT_HEARTBEAT_URL=` is present (empty default, optional)
- [ ] `ALERT_HEARTBEAT_INTERVAL_SEC=60` is present
- [ ] `AUTH_MFA_GRACE_PERIOD_HOURS=72` is present
- [ ] `AUTH_MFA_MAX_FAILURES=5` is present
- [ ] `AUTH_MFA_LOCKOUT_DURATION_SEC=1800` is present
- [ ] `IO_CERT_DIR=/etc/io/certs` is present
- [ ] `IO_ACME_WEBROOT=/var/www/acme-challenge` is present
- [ ] `IO_CERT_RENEW_DAYS=30` is present

## Assessment

- **Status**: ⚠️ Partial
- `config/io.env.example` exists and contains some variables but is missing approximately 20 spec-required entries. `TILE_MAX_ZOOM` has a wrong default (4 vs 5).

## Fix Instructions

Open `/home/io/io-dev/io/config/io.env.example` and add the following variable groups to their respective sections (add new sections if the section does not exist):

**In the "File storage" section (section 7), add after existing tile/export vars:**
```bash
TILE_RETENTION_HOURS=168
EXPORT_RETENTION_HOURS=24
EXPORT_MAX_WORKERS=3
EXPORT_PER_USER_LIMIT=5
EXPORT_MAX_FILE_SIZE_MB=500
BULK_UPDATE_MAX_UPLOAD_MB=50
BULK_UPDATE_MAX_ROWS=50000
BACKUP_STORAGE_DIR=/opt/io/backups
BACKUP_RETENTION_COUNT=7
BACKUP_SCHEDULE=0 2 * * *
```

Also change `TILE_MAX_ZOOM=4` to `TILE_MAX_ZOOM=5` to match the spec default.

**Add a new "OPC Data Buffering" section:**
```bash
# =============================================================================
# OPC Service Data Buffering
# =============================================================================
OPC_BUFFER_MEMORY_SECONDS=60
OPC_BUFFER_DISK_PATH=/var/lib/io-opc/buffer/
OPC_BUFFER_DISK_MAX_MB=1024
```

**Add a new "Alert Heartbeat" section:**
```bash
# =============================================================================
# Alert Service External Heartbeat (optional — set URL to enable)
# =============================================================================
ALERT_HEARTBEAT_URL=
ALERT_HEARTBEAT_INTERVAL_SEC=60
```

**In the auth/MFA area (or add a new section):**
```bash
# MFA enforcement
AUTH_MFA_GRACE_PERIOD_HOURS=72
AUTH_MFA_MAX_FAILURES=5
AUTH_MFA_LOCKOUT_DURATION_SEC=1800
```

**Add a "Certificates / TLS" section:**
```bash
# =============================================================================
# TLS Certificate Management
# =============================================================================
IO_CERT_DIR=/etc/io/certs
IO_ACME_WEBROOT=/var/www/acme-challenge
IO_CERT_RENEW_DAYS=30
```

Do NOT:
- Remove existing variables that are already correct
- Change path conventions from `/opt/io/` to match the spec's `/opt/insideoperations/` — the codebase uses `/opt/io/` consistently
- Change `IO_EXPORT_DIR` to `EXPORT_FILE_DIR` — the codebase variable name takes precedence over the spec example name
