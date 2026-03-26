---
id: DD-13-019
unit: DD-13
title: /log/templates direct URL navigation crashes browser
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

Direct URL navigation to `/log/templates` crashes the Playwright browser 3 consecutive times. The route is also inaccessible if a user bookmarks it or refreshes their browser while on that page.

Client-side tab-click navigation from `/log` → Templates tab works fine (React Router handles it in-memory). But a hard page load or direct URL entry to `/log/templates` fails catastrophically.

This is likely a server-side routing / Vite dev server issue where the route is not correctly handled on direct page loads (missing catch-all redirect to index.html, or a component-level crash during initial hydration for that specific path).

## Acceptance Criteria

- [ ] Navigating directly to http://localhost:5173/log/templates (hard page load) renders the templates list or empty state without crashing
- [ ] Refreshing the browser while on /log/templates does not crash
- [ ] The route behaves identically whether accessed via React Router link or direct URL

## Verification Checklist

- [ ] Navigate directly to /log/templates in a fresh browser tab → page loads without crash
- [ ] With the templates page open, press F5/refresh → page reloads without crash
- [ ] No "allSegments.filter is not a function" or similar TypeError in browser console

## Do NOT

- Do not only fix the tab-click path — the direct URL must also work
- Do not suppress the crash with a generic error boundary without fixing the root cause

## Dev Notes

UAT failure from 2026-03-26: 3 consecutive browser crashes on `browser_navigate('http://localhost:5173/log/templates')`. Each crash was recovered by navigating to `/` which worked. Final successful test was via clicking the Templates tab from `/log` (React Router in-memory navigation), which loaded the empty templates list correctly.
Spec reference: DD-13-017 (RBAC fix for /log/templates route)
