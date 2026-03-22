---
id: DD-22-001
title: Fix Alert Service systemd restart policy to Restart=always with 3s delay
unit: DD-22
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The Alert Service is safety-critical. If it crashes, it must be restarted unconditionally and quickly — not just on failure but always, including intentional stops that might be caused by a race condition or external force. The spec explicitly singles out the Alert Service with `Restart=always` and a tighter 3-second restart delay to distinguish it from other services.

## Spec Excerpt (verbatim)

> # Alert Service — safety critical, always restart
> # /etc/systemd/system/io-alert-service.service
> [Service]
> ...
> Restart=always
> RestartSec=3s
> — design-docs/22_DEPLOYMENT_GUIDE.md, §3. Create systemd Services

## Where to Look in the Codebase

Primary files:
- `/home/io/io-dev/io/systemd/io-alert-service.service` — the systemd unit file that ships with the installer

## Verification Checklist

Read `systemd/io-alert-service.service`:

- [ ] `Restart=always` is set (not `on-failure`)
- [ ] `RestartSec=3s` is set (not `5s`)
- [ ] No `RestartMaxDelaySec` cap that would override the above in practice

## Assessment

- **Status**: ⚠️ Partial
- `systemd/io-alert-service.service` currently has `Restart=on-failure` and `RestartSec=5s`. These are the same values as all other services, but the spec mandates `Restart=always` and `RestartSec=3s` for the alert service specifically.

## Fix Instructions

In `/home/io/io-dev/io/systemd/io-alert-service.service`, change:

```
Restart=on-failure
RestartSec=5s
```

to:

```
Restart=always
RestartSec=3s
```

Leave all other directives unchanged. The `RestartMaxDelaySec=60s` and `StartLimitIntervalSec=0` lines should remain.

Do NOT:
- Change any other service's restart policy — only `io-alert-service.service` gets this treatment
- Remove the `RestartMaxDelaySec` or `StartLimitIntervalSec` lines
