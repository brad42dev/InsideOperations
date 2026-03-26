---
id: DD-22-004
title: Disable HSTS in nginx config by default — enable only via Settings toggle
unit: DD-22
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

HSTS must be **off by default** in the nginx configuration. Enabling HSTS with a self-signed certificate (the default install state) would cause browsers to hard-block access with no bypass option. The spec explicitly documents this as a deliberate default-off decision, with HSTS enabled only after the admin confirms a trusted certificate is in place via Settings > Certificates.

The current nginx config unconditionally sends `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` on every HTTPS response, which would lock out fresh installs using self-signed certificates.

## Spec Excerpt (verbatim)

> HSTS is **off by default**. Enabling HSTS with a self-signed certificate would cause browsers to hard-block access with no bypass option. Admin toggle in Settings > Certificates enables HSTS after a valid (trusted) certificate is installed. When enabled, nginx adds the header:
> ```
> Strict-Transport-Security: max-age=63072000; includeSubDomains
> ```
> HSTS preload is explicitly out of scope (internal hostnames, dynamic deployments).
> — design-docs/22_DEPLOYMENT_GUIDE.md, §HSTS

Also note the TLS snippet:
> ```nginx
> # HSTS disabled by default, enabled via Settings toggle
> # add_header Strict-Transport-Security "max-age=63072000" always;
> ```
> — design-docs/22_DEPLOYMENT_GUIDE.md, §nginx TLS Configuration

## Where to Look in the Codebase

Primary files:
- `/home/io/io-dev/io/nginx/io.nginx.conf` — line 40: `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;`
- `/home/io/io-dev/io/scripts/setup-nginx.sh` — check if this script also hardcodes HSTS

## Verification Checklist

Read `nginx/io.nginx.conf`:

- [ ] No active (uncommented) `add_header Strict-Transport-Security` line in the default config
- [ ] Either the line is commented out, or a comment indicates it is managed by the Settings toggle
- [ ] The spec-documented max-age when enabled is `63072000` (2 years), not `31536000` (1 year)
- [ ] `preload` flag is absent — spec says preload is explicitly out of scope

## Assessment

- **Status**: ⚠️ Wrong
- `nginx/io.nginx.conf:40` has HSTS unconditionally enabled with `max-age=31536000; includeSubDomains; preload`. The spec requires it to be commented out by default, enabled only via a Settings toggle, and uses `max-age=63072000` (not `31536000`). The `preload` flag is explicitly out of scope.

## Fix Instructions

In `/home/io/io-dev/io/nginx/io.nginx.conf`, comment out the HSTS header line:

```nginx
# HSTS: disabled by default. Enable via Settings > Certificates after installing a trusted cert.
# add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
```

Also check `/home/io/io-dev/io/scripts/setup-nginx.sh` for any HSTS-related lines and apply the same treatment.

The Settings > Certificates "Enable HSTS" toggle will, when implemented, write an nginx include fragment (or reload nginx with the header added). That mechanism is a separate task — this task is only about ensuring the default nginx config ships with HSTS commented out.

Do NOT:
- Leave `preload` in the commented example — the spec says it is out of scope
- Use `max-age=31536000` — the spec example uses `63072000`
- Disable other security headers (`X-Content-Type-Options`, `X-Frame-Options`, etc.) — only HSTS needs to be off by default
