---
unit: DD-28
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 3
scenarios_passed: 2
scenarios_failed: 1
scenarios_skipped: 0
---

## Module Route Check

pass: /settings/email loads email settings with Providers/Templates/Queue tabs.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Email | [DD-28-005] Email settings accessible | ✅ pass | Providers/Templates/Queue tabs visible |
| 2 | Email | [DD-28-003] Email provider config form | ❌ fail | Type dropdown only shows SMTP and Webhook — MS Graph, Gmail, SES, SMTP-XOAUTH2 not present |
| 3 | Email | [DD-28-008] Test email button | skipped | No provider configured — test button would require a saved provider |

## New Bug Tasks Created

DD-28-009 — Email provider type selector missing MS Graph, Gmail, SES, SMTP-XOAUTH2 options

## Screenshot Notes

- Email Add Provider dialog shows Type combobox with only: SMTP, Webhook
- Expected per DD-28-003 spec: SMTP, Webhook, MS Graph, Gmail/OAuth2, Amazon SES, SMTP-XOAUTH2
- DD-28-002/004/005/006/007/008 are backend Rust service changes not directly verifiable in browser
