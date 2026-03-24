# UAT Scenarios — DD-39

## Designer Page Integrity
Scenario 1: [DD-39-009] Designer renders without error — navigate to /designer → page loads with no error boundary ("Something went wrong" / "Designer failed to load")
Scenario 2: [DD-39-009] Export option visible in Designer — open a graphic or find export control → export/download option visible in toolbar or menu

## .iographic Export Flow
Scenario 3: [DD-39-009] Export initiates file download — click export button or menu item → file download starts (not a silent no-op)
Scenario 4: [DD-39-008] Export does not produce a 404 error — click export → action completes without "404" or "Not Found" error message in UI

## Custom Shapes UI
Scenario 5: [DD-39-010] Symbol Library loads at /designer/symbols — navigate to /designer/symbols → page renders without error boundary
Scenario 6: [DD-39-010] Custom Shapes section visible in Symbol Library — at /designer/symbols → "Custom Shapes", "My Shapes", or equivalent section visible in palette
Scenario 7: [DD-39-011] Custom Shapes section shows empty state not error — at /designer/symbols → "No custom shapes yet" or "Upload" message shown, NOT "Failed to parse server response"
Scenario 8: [DD-39-011] Upload button present in Custom Shapes section — Custom Shapes area → Upload/Add Shape button present and accessible

## Checksum and Backend Observability
Scenario 9: [DD-39-005] Export completes without checksum error — click export → no "checksum" or "verification failed" error message appears in UI
Scenario 10: [DD-39-006] Custom shape sidecar note — not directly browser-testable (ZIP inspection required); substitute: Custom shapes palette has a visible add/upload affordance
