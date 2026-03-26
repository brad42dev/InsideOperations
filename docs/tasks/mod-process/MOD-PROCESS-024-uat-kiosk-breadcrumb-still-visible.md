---
id: MOD-PROCESS-024
unit: MOD-PROCESS
title: Kiosk mode breadcrumb nav bar ("Process" heading) still visible at /process?kiosk=true
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-PROCESS/CURRENT.md
---

## What to Build

In kiosk mode (`/process?kiosk=true`), the module-level `<banner>` element containing the "Process" h1 heading is NOT being hidden. The accessibility snapshot at /process?kiosk=true shows:

```
banner:
  heading "Process" [level=1]
```

This is visible to users as a header bar at the top of the Process module canvas in kiosk mode. The task MOD-PROCESS-019 was previously verified as implementing breadcrumb/toolbar hiding in kiosk mode, but the banner persists.

**What IS correctly hidden in kiosk mode (do not break):**
- App shell left sidebar (navigation menu, services list)
- View toolbar (zoom controls, Live/Historical toggle, ★ bookmark, Export, Print, Map, fullscreen)
- Status bar at bottom
- Module-level sidebar (Views, Bookmarks, Navigation, Recent Views)

**What must be fixed:**
- The `<banner>` / breadcrumb nav bar containing the "Process" `<h1>` heading must also be hidden when `isKiosk === true`

## Acceptance Criteria

- [ ] Navigating to /process?kiosk=true renders NO banner/breadcrumb bar at the top — `heading "Process"` must not appear in the accessibility tree
- [ ] The canvas fills the full viewport height with no header gap in kiosk mode
- [ ] Sidebar and view toolbar remain correctly hidden (do not regress)
- [ ] Pressing Escape exits kiosk mode and restores the banner (already works — do not break)

## Verification Checklist

- [ ] Navigate to /process?kiosk=true — confirm no `banner` element or "Process" heading visible in accessibility snapshot
- [ ] Screenshot shows full-bleed canvas from top to bottom with no header bar
- [ ] Press Escape — confirm banner/heading is restored

## Do NOT

- Do not stub this with a TODO comment
- Do not only fix the accessibility tree — the visual header must also be absent
- Do not break the working Escape exit behavior

## Dev Notes

UAT failure 2026-03-26: `/process?kiosk=true` accessibility snapshot shows `banner: heading "Process" [level=1]` still present. All other kiosk elements are correctly hidden. The banner is the Process module's own `<header>` / `<banner>` wrapper around the page heading — check `isKiosk` guard on that element specifically.

Spec reference: MOD-PROCESS-019 (Hide breadcrumb nav bar and view toolbar in kiosk mode), MOD-PROCESS-022 (Kiosk mode leaves breadcrumb nav bar visible)
