---
id: DD-28-009
unit: DD-28
title: Email provider type selector missing MS Graph, Gmail, SES, SMTP-XOAUTH2 options
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-28/CURRENT.md
---

## What to Build

The email provider "Add Provider" dialog at /settings/email only shows two type options: SMTP and Webhook.
The spec (DD-28-003) requires MS Graph, Gmail/OAuth2, Amazon SES, and SMTP-XOAUTH2 provider adapters.
These provider types should appear in the Type dropdown of the Add Provider dialog so users can select the appropriate provider.

## Acceptance Criteria

- [ ] Email Add Provider dialog Type selector includes: SMTP, Webhook, MS Graph, Gmail/OAuth2, Amazon SES, SMTP-XOAUTH2
- [ ] Selecting each type shows the appropriate configuration fields
- [ ] The backend adapters are wired to the type selection

## Verification Checklist

- [ ] Navigate to /settings/email → click "Add Provider" → Type dropdown shows all 6 provider types
- [ ] Select "MS Graph" → see MS Graph specific fields (tenant_id, client_id, client_secret)
- [ ] Select "Gmail" → see Gmail OAuth2 fields
- [ ] Select "Amazon SES" → see SES fields (region, access key)
- [ ] Select "SMTP-XOAUTH2" → see XOAUTH2 fields

## Do NOT

- Do not stub with TODO comment
- Do not add types to dropdown without wiring backend adapter

## Dev Notes

UAT failure from 2026-03-23: Add Provider dialog shows only SMTP and Webhook in Type combobox.
Expected per DD-28-003: MS Graph, Gmail, SES, SMTP-XOAUTH2 adapters implemented.
Spec reference: DD-28-003
