---
id: DD-29-012
unit: DD-29
title: Duo Security MFA option missing from MFA settings page
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-29/CURRENT.md
---

## What to Build

The /settings/mfa page shows three MFA method cards: TOTP (Authenticator App), SMS OTP, and Email OTP. The Duo Security method card is absent.

Per the auth spec (DD-29-005), Duo Security should be a supported MFA provider alongside TOTP/SMS/Email. The Duo Security card should be present in the MFA settings page with configuration options (Duo integration key, secret key, API hostname).

## Acceptance Criteria

- [ ] /settings/mfa shows a Duo Security card alongside TOTP, SMS OTP, and Email OTP
- [ ] Duo Security card has an Enable/Configure button
- [ ] Clicking Configure opens a form with Duo-specific fields (integration key, secret key, API hostname)

## Verification Checklist

- [ ] Navigate to /settings/mfa — four MFA method cards visible (TOTP, SMS OTP, Email OTP, Duo Security)
- [ ] Duo Security card is not just a placeholder — has actionable configuration UI
- [ ] Existing TOTP/SMS/Email cards are not broken by the addition

## Do NOT

- Do not remove existing MFA method cards
- Do not stub the Duo card without actual configuration fields

## Dev Notes

UAT failure from 2026-03-23: /settings/mfa showed only TOTP, SMS OTP, and Email OTP cards. No Duo Security card visible.
Spec reference: DD-29-005 (Duo Security support)
