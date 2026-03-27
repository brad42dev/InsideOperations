# UAT Scenarios — DD-26

## Recognition Settings Page

Scenario 1: [DD-26-011] Settings recognition page renders without error — navigate to /settings/recognition → page loads, heading "Recognition" visible, no error boundary
Scenario 2: [DD-26-011] Service Status section shows per-domain status — navigate to /settings/recognition → ServiceStatusCard shows "P&ID Model" and "DCS Model" as separate stat items
Scenario 3: [DD-26-011] — data flow: GET /api/recognition/status — navigate to /settings/recognition, wait 3s for status load → "P&ID Model" stat shows "Not Loaded" or "Loaded" (not "Loading..." or error boundary); "DCS Model" stat appears independently
Scenario 4: [DD-26-011] P&ID and DCS model labels both visible simultaneously — navigate to /settings/recognition → "P&ID Model" text AND "DCS Model" text both present in Service Status section at the same time
Scenario 5: [DD-26-012] Loaded Models section renders with Upload button — navigate to /settings/recognition → "Loaded Models" section visible, "Upload .iomodel" button present
Scenario 6: [DD-26-012] Models table has Domain column — navigate to /settings/recognition → "Loaded Models" section renders a table with "Domain" column header visible (indicates per-domain architecture is reflected in UI)
Scenario 7: [DD-26-011] Status subtext shows mode and hardware per domain — navigate to /settings/recognition, wait for status → subtext under P&ID Model shows "mode:" and "hw:" values (per-domain metadata from ModelManager)
Scenario 8: [DD-26-012] Gap Reports section renders — navigate to /settings/recognition → "Gap Reports" section visible with "Import .iogap" button
Scenario 9: [DD-26-011] No error boundary after page load — navigate to /settings/recognition, wait 3s → no "Something went wrong" text visible
