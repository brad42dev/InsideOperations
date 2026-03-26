---
id: DD-28-009
title: Email provider type selector missing MS Graph, Gmail, SES, SMTP-XOAUTH2 options
unit: DD-28
status: pending
priority: high
depends-on: []
source: uat
---

## What This Feature Should Do

The email provider form in Settings → Email → Providers only shows "SMTP" and "Webhook" as provider type options. The backend (`queue_worker.rs`) already supports `ms_graph`, `gmail`, `ses`, and `smtp_xoauth2`, but these options are not present in the frontend dropdown, making it impossible for admins to create providers of these types through the UI.

## Spec Excerpt (verbatim)

From `28_EMAIL_SERVICE.md` §Provider Types:
- `smtp` — Standard SMTP
- `smtp_xoauth2` — SMTP with XOAUTH2 (Office 365, Gmail relay)
- `ms_graph` — Microsoft Graph API (send-as delegated or service principal)
- `gmail` — Gmail API (service account)
- `ses` — Amazon SES v2

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/Email.tsx` lines 374–377: the provider type `<select>` with only `smtp` and `webhook`
- `frontend/src/pages/settings/Email.tsx` line 389: config help text only mentions SMTP/webhook JSON fields
- `services/email-service/src/queue_worker.rs` lines 414–440: `attempt_delivery` match handles all provider types
- `services/email-service/src/crypto.rs` lines 62–76: `secret_fields()` lists encrypted fields per provider type

## Verification Checklist

- [ ] Provider type select includes all 6 options: smtp, smtp_xoauth2, ms_graph, gmail, ses, webhook
- [ ] Config help text is updated to mention config keys for each provider type
- [ ] Default `providerType` state remains `smtp`
- [ ] No backend changes required — the adapters are already implemented

## Assessment

- **Status**: ❌ Missing — four provider types not selectable in UI

## Fix Instructions

**In `frontend/src/pages/settings/Email.tsx`:**

1. Expand the `<select>` at line 374 to include all provider types:
```tsx
<select style={inputStyle} value={providerType} onChange={(e) => setProviderType(e.target.value)}>
  <option value="smtp">SMTP</option>
  <option value="smtp_xoauth2">SMTP (XOAUTH2)</option>
  <option value="ms_graph">Microsoft Graph</option>
  <option value="gmail">Gmail (Service Account)</option>
  <option value="ses">Amazon SES</option>
  <option value="webhook">Webhook</option>
</select>
```

2. Update the config label (line 389) to include hints for each type:
```tsx
<label style={labelStyle}>
  Config (JSON) — smtp: {"{host, port, username, password}"} · smtp_xoauth2: {"{host, port, username, client_id, client_secret, tenant_id}"} · ms_graph: {"{tenant_id, client_id, client_secret}"} · gmail: {"{service_account_key}"} · ses: {"{region, access_key_id, secret_access_key}"} · webhook: {"{url}"}
</label>
```

Do NOT:
- Add backend changes — the adapters are already implemented in `queue_worker.rs`
- Change the default value from `smtp`
