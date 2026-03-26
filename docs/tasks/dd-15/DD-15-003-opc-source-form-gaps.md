---
id: DD-15-003
title: Add client certificate dropdown, platform dropdown, and minimum publish interval to OPC source form
unit: DD-15
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When creating or editing an OPC UA source, the configuration form must include: a "Client Certificate" dropdown pulling from the central certificate store, a "What platform is this?" dropdown that pre-populates connection profile defaults, and a global "Minimum Publish Interval" guard rail configurable under Settings > OPC Sources. Currently the form only has endpoint URL, security policy/mode, and username/password.

## Spec Excerpt (verbatim)

> **OPC UA source configuration**: When adding or editing an OPC UA source, the configuration form includes: endpoint URL, security policy selection, "Client Certificate" dropdown (lists client certificates from the centralized certificate store — see Certificate Management section below), optional platform dropdown ("What platform is this?" — pre-populates connection profile defaults from doc 17), connection test button, and live connection status indicator.
> — 15_SETTINGS_MODULE.md, §Point Source Management

> **Global minimum publish interval**: `opc.minimum_publish_interval_ms` setting (default: 1000ms, minimum allowed: 100ms). Prevents any OPC source from being configured with a publish interval faster than this floor. Configurable under Settings > Point Sources as a global guard rail.
> — 15_SETTINGS_MODULE.md, §Point Source Management

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/OpcSources.tsx` lines 332–439 — `SourceFormState` interface and `SourceFormFields` component
- `frontend/src/pages/settings/OpcSources.tsx` around line 443+ — `CreateSourceDialog` and `EditSourceDialog` forms
- `frontend/src/api/points.ts` — `CreatePointSourceRequest` and `UpdatePointSourceRequest` types need `client_certificate_id` and `platform` fields

## Verification Checklist

- [ ] `SourceFormState` includes `client_certificate_id: string | null` field
- [ ] `SourceFormFields` renders a dropdown labeled "Client Certificate" populated from `GET /api/certificates` filtered to type="client"
- [ ] `SourceFormState` includes `platform: string | null` field
- [ ] `SourceFormFields` renders an optional "Platform" dropdown with DCS platform options from doc 17
- [ ] "Test Connection" button present in the create/edit dialog — calls a test endpoint and shows inline result
- [ ] A global `opc.minimum_publish_interval_ms` setting control exists on the OPC Sources page (separate from per-source config)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `SourceFormState` at line 332 has 7 fields. No client_certificate_id, platform, or publish_interval. No test connection button (grep confirmed absent).

## Fix Instructions

**Step 1: Update `SourceFormState`** at OpcSources.tsx:332:
```tsx
interface SourceFormState {
  name: string
  endpoint_url: string
  security_policy: string
  security_mode: string
  username: string
  password: string
  enabled: boolean
  client_certificate_id: string | null  // ADD
  platform: string | null               // ADD
  publish_interval_ms: number | null    // ADD (optional per-source override)
}
```

**Step 2: Add certificate query** inside `SourceFormFields` or its parent dialog — fetch `GET /api/certificates?type=client` and populate a `<select>` labeled "Client Certificate". A "(none)" option should be the default.

**Step 3: Add platform dropdown** — the list of supported DCS platforms is in `design-docs/17_OPC_INTEGRATION.md`. Render a `<select>` with an "Unknown / Generic" default and each supported platform as options.

**Step 4: Add test connection button** — the OPC Sources page already has `pointSourcesApi`; add a `testConnection(id: string)` API call. In the `EditSourceDialog`, show a "Test Connection" button that calls this and renders inline success/failure with a status message. For `CreateSourceDialog`, disable until the source is saved (or support test-before-save by sending connection params to a test endpoint).

**Step 5: Add global minimum publish interval control** — add a settings section at the top of the OpcSources page (above the source list). Fetch `GET /api/settings` for key `opc.minimum_publish_interval_ms`, render an integer input with 100ms floor validation, and save via `PUT /api/settings`.

Do NOT:
- Remove the existing security_policy and security_mode fields
- Make client_certificate_id required — it should be optional (some OPC servers don't require client certs)
