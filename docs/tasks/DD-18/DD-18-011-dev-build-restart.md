---
id: DD-18-011
unit: DD-18
title: dev.sh build does not restart running services — stale binary causes repeated 404s
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-18/CURRENT.md
---

## What to Build

`./dev.sh build` rebuilds Rust binaries but leaves running service processes unchanged. When a service binary is rebuilt, the old process stays in memory, serving the stale pre-rebuild code. This caused the same archive-settings 404 to be reported four times (DD-18-007 through DD-18-010) — each time the route was "fixed" in code, the running binary didn't have the fix.

**Root cause confirmed in DD-18-010 CURRENT.md:**
> ROOT CAUSE: archive-service binary was from 2026-03-23 (before dc3baa4 fix committed on 2026-03-24). Code is correct but stale binary was running (PID 43285, exe marked "(deleted)" after rebuild)

The dev.sh `build` command must also restart any running services so developers always test against the freshly-built binary.

## Acceptance Criteria

- [ ] `./dev.sh build` restarts all services that were running before the build completes
- [ ] If no services are running, `./dev.sh build` just builds (no error, no-op restart)
- [ ] After `./dev.sh build`, running service processes have a `last_heartbeat` or `/proc/{pid}/exe` that points to the new binary (no deleted/stale exe)
- [ ] A new `./dev.sh build-only` command is available for building without restarting (for CI or cases where restart is unwanted)
- [ ] The help text (`./dev.sh`) is updated to reflect both commands

## Files to Create or Modify

- `dev.sh` — split `build` into build-then-restart + new `build-only`

## Do NOT

- Do not restart database containers (Docker Compose) — only Rust service processes
- Do not start services that were not already running before the build
- Do not use `exec` to replace the process in-place — stop, build, start is the correct sequence

## Dev Notes

Caused four consecutive UAT failures (DD-18-007, DD-18-008, DD-18-009, DD-18-010) for the same archive-settings 404. The fix is always "restart the service" but the build step never does this automatically.

Stale binary detection: `ls -la /proc/{pid}/exe` shows `(deleted)` if the binary on disk was replaced after the process started.
