---
id: DD-15-002
title: Wire MfaSettings, ApiKeys, ScimTokens, and SmsProviders into App.tsx routes
unit: DD-15
status: pending
priority: high
depends-on: [DD-15-001]
---

## What This Feature Should Do

The Authentication section of Settings requires four sub-pages: MFA method configuration and per-role MFA policies, API key management with one-time reveal, SCIM 2.0 provisioning management, and SMS provider configuration. All four components exist as fully-implemented files but are not imported into App.tsx and have no routes — they are completely unreachable.

## Spec Excerpt (verbatim)

> **MFA tab**: Global MFA method configuration and per-role MFA policies
> — 15_SETTINGS_MODULE.md, §Authentication

> **API Keys tab**: Manage service account API keys
> List table showing key name, prefix (e.g., `io_sk_a3b`), assigned permissions/scopes, last used timestamp, expiration date
> "Create API Key" button: name, scope selection, optional expiry. Key value shown once on creation (not retrievable afterward).
> — 15_SETTINGS_MODULE.md, §Authentication

> **SCIM** sub-section:
> Enable/disable SCIM 2.0 provisioning
> Generate/revoke SCIM bearer tokens (token shown once on creation)
> SCIM endpoint URL display (copy-paste for IdP configuration)
> — 15_SETTINGS_MODULE.md, §Authentication

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx` lines 40–52 (imports) and 791–1015 (settings routes) — where routes need to be added
- `frontend/src/pages/settings/MfaSettings.tsx` — exists, 439 lines, TOTP enroll/verify/disable (needs SMS/Email method controls added)
- `frontend/src/pages/settings/ApiKeys.tsx` — exists, 656 lines, full CRUD with reveal-once modal
- `frontend/src/pages/settings/ScimTokens.tsx` — exists, 611 lines
- `frontend/src/pages/settings/SmsProviders.tsx` — exists, 426 lines
- `frontend/src/pages/settings/index.tsx` — sub-nav list (lines 8–27) needs entries for new routes

## Verification Checklist

- [ ] `MfaSettings.tsx` is imported in App.tsx
- [ ] Route `/settings/mfa` renders `MfaSettings` inside `PermissionGuard permission="auth:manage_mfa"`
- [ ] `ApiKeys.tsx` is imported in App.tsx
- [ ] Route `/settings/api-keys` renders `ApiKeys` inside `PermissionGuard permission="auth:manage_api_keys"`
- [ ] `ScimTokens.tsx` is imported in App.tsx
- [ ] Route `/settings/scim` renders `ScimTokens` inside `PermissionGuard permission="auth:configure"`
- [ ] `SmsProviders.tsx` is imported in App.tsx
- [ ] Route `/settings/sms-providers` renders `SmsProviders` inside an appropriate PermissionGuard
- [ ] Sub-nav in `index.tsx` lists the new routes so users can navigate to them

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: All four components exist but App.tsx has no imports (lines 23–52) or routes (791–1015) for any of them

## Fix Instructions

1. **Add imports** to `frontend/src/App.tsx` after line 52:
   ```tsx
   import MfaSettingsPage from './pages/settings/MfaSettings'
   import ApiKeysPage from './pages/settings/ApiKeys'
   import ScimTokensPage from './pages/settings/ScimTokens'
   import SmsProvidersPage from './pages/settings/SmsProviders'
   ```

2. **Add routes** inside `<Route path="settings" element={<SettingsShell />}>` (after the `auth-providers` route, around line 978):
   ```tsx
   <Route
     path="mfa"
     element={
       <PermissionGuard permission="auth:manage_mfa">
         <MfaSettingsPage />
       </PermissionGuard>
     }
   />
   <Route
     path="api-keys"
     element={
       <PermissionGuard permission="auth:manage_api_keys">
         <ApiKeysPage />
       </PermissionGuard>
     }
   />
   <Route
     path="scim"
     element={
       <PermissionGuard permission="auth:configure">
         <ScimTokensPage />
       </PermissionGuard>
     }
   />
   <Route
     path="sms-providers"
     element={
       <PermissionGuard permission="system:configure">
         <SmsProvidersPage />
       </PermissionGuard>
     }
   />
   ```

3. **Update sub-nav** in `frontend/src/pages/settings/index.tsx` — add entries to `SUB_NAV` array:
   ```tsx
   { path: '/settings/mfa', label: 'MFA' },
   { path: '/settings/api-keys', label: 'API Keys' },
   { path: '/settings/scim', label: 'SCIM' },
   { path: '/settings/sms-providers', label: 'SMS Providers' },
   ```

4. **MfaSettings.tsx gap**: The current implementation only handles TOTP. The spec also requires SMS and Email method controls (enable/disable toggles with security warnings) and per-role MFA policy table. Review `MfaSettings.tsx` and add the admin-level tabs for global method config and per-role policies, separate from the individual user enrollment flow.

Do NOT:
- Create new component files — the files already exist, just wire them
- Add routes without PermissionGuards
