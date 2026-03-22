---
id: DD-06-009
title: Replace static About page with API-driven license browser and SBOM download
unit: DD-06
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The About page must display live application metadata from the API, show full per-package license text in a searchable/sortable table (Backend and Frontend tabs), support "By Package" vs "By License" view toggle, and provide a SBOM download button. Currently it is a static hardcoded table of representative packages with no API integration.

## Spec Excerpt (verbatim)

> **Top section — Application Info:** Version (APP_VERSION env var), Build (git commit hash + timestamp), EULA version, Server hostname
>
> **Bottom section — Open Source Licenses (tabbed):** Two tabs: Backend and Frontend. Each tab: searchable, sortable table of Package, Version, License, Copyright. Expanding a row reveals the full license text.
>
> **Data source:** Backend: cargo-about → backend-licenses.json. Frontend: license-checker → frontend-licenses.json.
>
> **SBOM download:** "Download SBOM" button exports CycloneDX JSON. Available to any authenticated user.
>
> **API:** GET /api/system/about (JWT), GET /api/system/licenses/backend (JWT), GET /api/system/licenses/frontend (JWT), GET /api/system/sbom (JWT)
> — 06_FRONTEND_SHELL.md, §About Page

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/About.tsx` — entire file is static, needs to be replaced
- `frontend/src/api/` — check for any existing system API calls
- `services/api-gateway/src/` — check if /api/system/about and /api/system/licenses/* routes exist

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] About page calls `GET /api/system/about` and displays live version/build/server data
- [ ] Two tabs: Backend and Frontend for licenses
- [ ] Each tab: DataTable with Package, Version, License, Copyright columns
- [ ] Table rows are expandable to show full license text
- [ ] "Download SBOM" button calls `GET /api/system/sbom` with JWT and triggers file download
- [ ] "By Package" vs "By License" view toggle implemented
- [ ] Table is searchable (filter input)
- [ ] No hardcoded package list in the component

## Assessment

After checking:
- **Status**: ❌ Missing — About.tsx is entirely hardcoded static data. No API calls. No full license text. No SBOM download.

## Fix Instructions

**1. Add API types and calls in a new `frontend/src/api/system.ts`:**
```typescript
export interface AboutInfo {
  version: string; build: string; serverHostname: string; eulaVersion: string
}
export interface LicenseEntry {
  name: string; version: string; license: string; copyright: string; text: string
}
export const systemApi = {
  about: () => apiClient.get<AboutInfo>('/api/system/about'),
  licensesBackend: () => apiClient.get<LicenseEntry[]>('/api/system/licenses/backend'),
  licensesFrontend: () => apiClient.get<LicenseEntry[]>('/api/system/licenses/frontend'),
  downloadSbom: () => fetch('/api/system/sbom', { headers: { Authorization: `Bearer ${localStorage.getItem('io_access_token') ?? ''}` } }),
}
```

**2. Rewrite About.tsx as a data-driven component using TanStack Query:**
- Use `useQuery` for about info and license data
- Two tabs using Radix UI Tabs
- DataTable component (already exists at `frontend/src/shared/components/DataTable.tsx`)
- Expandable rows for license text
- SBOM download triggers blob download

**3. Backend: Ensure /api/system/about and /api/system/licenses/* routes exist in api-gateway. If not, add stubs that return the hardcoded data so the frontend can call them.**

Do NOT:
- Keep hardcoded package data in the component
- Block the About page behind extra permissions — spec says "Available to any authenticated user"
- Include `cargo-about` or `license-checker` as npm dependencies in the frontend build (they run at build time, output JSON files)
