---
id: DD-29-012
title: "Duo Security MFA option missing from MFA settings page"
unit: DD-29
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-29/CURRENT.md
---

## What to Build

The MFA Settings page (`/settings/mfa`) shows three MFA method cards: TOTP, SMS OTP, and Email OTP. However, per design doc 29 (AUTHENTICATION), Duo Security should be a fourth supported MFA method. The `MfaMethod` type in `MfaSettings.tsx` only includes `'totp' | 'sms' | 'email'` and the `methods` array only initialises those three.

Add a Duo Security MFA method card to the MFA Settings page's Global MFA Methods tab. Duo Security requires a separate integration configuration (Duo hostname, integration key, secret key) which should be explained in the card description.

## Acceptance Criteria

- [ ] The MFA Settings methods tab shows a fourth card: "Duo Security"
- [ ] The Duo Security card includes a description explaining it requires Duo API credentials (hostname, integration key, secret key) configured in Settings
- [ ] The Duo Security card has an enable/disable toggle consistent with the other method cards
- [ ] A warning is shown if Duo Security is enabled without a Duo provider configured (similar to the SMS warning about requiring SMS provider)
- [ ] No TypeScript compilation errors

## Files to Create or Modify

- `frontend/src/pages/settings/MfaSettings.tsx` — add `'duo'` to the `MfaMethod['id']` union type and add a Duo Security entry to the `methods` array in `MfaMethodsTab`

## Specific Changes

In `MfaSettings.tsx`:

1. Update the `MfaMethod` interface:
```ts
interface MfaMethod {
  id: 'totp' | 'sms' | 'email' | 'duo'
  // ...
}
```

2. Add to the `methods` array in `MfaMethodsTab`:
```ts
{
  id: 'duo',
  label: 'Duo Security',
  description: 'Push notifications and passcodes via Duo Security. Requires Duo API credentials configured under Security > Duo Integration.',
  enabled: false,
  warning: 'Duo Security requires a Duo hostname, integration key, and secret key configured in Security settings before enabling.',
},
```

3. Update the `RoleMfaPolicy.allowed_methods` type:
```ts
allowed_methods: ('totp' | 'sms' | 'email' | 'duo')[]
```

## Verification Checklist

- [ ] TypeScript build passes: `cd frontend && npx tsc --noEmit`
- [ ] `/settings/mfa` Methods tab shows 4 cards: TOTP, SMS OTP, Email OTP, Duo Security
- [ ] Duo Security card has toggle and warning text

## Do NOT

- Do not implement backend Duo Security authentication logic — this is a UI-only addition
- Do not add API calls for Duo configuration — stubs only (like the existing method toggle simulation)
- Do not remove or modify the existing TOTP, SMS, or Email method cards

## Dev Notes

UAT failure 2026-03-23: `/settings/mfa` shows only 3 MFA method cards (TOTP, SMS OTP, Email OTP). Design doc 29 specifies Duo Security as a supported MFA method. The fix is adding the Duo entry to the hardcoded methods array in `MfaMethodsTab`. The toggle simulation code is already in place for the other methods — just add the new entry.
