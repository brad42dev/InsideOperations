---
id: DD-22-002
title: Add Nice=10 to Import Service systemd unit for QoS tier 3
unit: DD-22
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Import Service is a QoS tier 3 process — its background ETL work should never compete with real-time services for CPU. Setting `Nice=10` in its systemd unit gives the kernel a hint to de-prioritize it when other processes need CPU, without preventing it from running when the system is idle.

## Spec Excerpt (verbatim)

> # Import Service runs at lower CPU priority (QoS tier 3)
> # /etc/systemd/system/io-import-service.service
> [Service]
> ...
> Nice=10
> — design-docs/22_DEPLOYMENT_GUIDE.md, §3. Create systemd Services

## Where to Look in the Codebase

Primary files:
- `/home/io/io-dev/io/systemd/io-import-service.service` — the systemd unit file for the import service

## Verification Checklist

Read `systemd/io-import-service.service`:

- [ ] `Nice=10` appears in the `[Service]` section
- [ ] No other CPU-limiting directive (`CPUWeight`, `CPUQuota`) is substituted in its place — `Nice=10` is the spec requirement

## Assessment

- **Status**: ❌ Missing
- `systemd/io-import-service.service` has no `Nice=` directive. It is identical to other service units in terms of CPU policy.

## Fix Instructions

In `/home/io/io-dev/io/systemd/io-import-service.service`, add `Nice=10` to the `[Service]` section, after the `ExecStart=` line:

```ini
ExecStart=/opt/io/bin/import-service
Nice=10
```

Do NOT:
- Add `Nice=10` to any other service unit
- Use `CPUWeight` or `CPUQuota` as a substitute — the spec specifically says `Nice=10`
