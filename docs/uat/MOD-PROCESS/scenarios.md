# UAT Scenarios — MOD-PROCESS

Tasks to UAT: MOD-PROCESS-002, MOD-PROCESS-011, MOD-PROCESS-014, MOD-PROCESS-015,
              MOD-PROCESS-016, MOD-PROCESS-017, MOD-PROCESS-018, MOD-PROCESS-019, MOD-PROCESS-020

Seed data status: UNAVAILABLE (advisory — mark data-flow results ⚠️ seed data status unknown)

---

## Page Load & Data Flow

Scenario 1: [MOD-PROCESS-002] — data flow: GET /api/graphics — navigate to /process → page renders without error boundary, shows either graphic list in sidebar or empty-state message (no crash, no "Something went wrong")

Scenario 2: [MOD-PROCESS-002] Process module renders sidebar navigation — navigate to /process → left sidebar visible with "Views" or navigation section, no spinner stuck indefinitely

## Toolbar Buttons

Scenario 3: [MOD-PROCESS-014] Print button visible in toolbar — navigate to /process, check toolbar area → "Print" button visible to the right of Export button (admin has process:export permission)

Scenario 4: [MOD-PROCESS-014] Print button consistent styling — compare Print button appearance with adjacent Export/Fullscreen buttons → all toolbar buttons share consistent visual style

Scenario 5: [MOD-PROCESS-005] Export button visible in toolbar — navigate to /process → "Export" or "Export ▾" split button visible in view toolbar

## Bookmark Creation Dialog

Scenario 6: [MOD-PROCESS-015] Bookmark star button visible in toolbar — navigate to /process → "★" or bookmark button visible in view toolbar

Scenario 7: [MOD-PROCESS-015] Clicking bookmark button shows dialog — click bookmark (★) button → dialog/modal opens with Name input field and optional Description field

## Kiosk Mode

Scenario 8: [MOD-PROCESS-019] Kiosk mode hides breadcrumb nav bar — navigate to /process?kiosk=true → breadcrumb navigation bar NOT visible

Scenario 9: [MOD-PROCESS-019] Kiosk mode hides view toolbar — navigate to /process?kiosk=true → view toolbar (zoom controls, Live/Historical, Export, Print buttons) NOT visible

Scenario 10: [MOD-PROCESS-007] Kiosk mode hides sidebar — navigate to /process?kiosk=true → left sidebar NOT visible

Scenario 11: [MOD-PROCESS-007] Escape exits kiosk mode — navigate to /process?kiosk=true, press Escape → UI chrome returns (top bar, sidebar visible again)

## Detached Window Route

Scenario 12: [MOD-PROCESS-016] Detached process route renders — navigate to /detached/process/test-view-id → page loads (not 404, not blank, not error boundary)

Scenario 13: [MOD-PROCESS-016] Detached route has no sidebar/top bar — on /detached/process/test-view-id → module switcher sidebar and application top bar NOT present

## Minimap Toggle Persistence

Scenario 14: [MOD-PROCESS-017] Minimap toggle button visible — navigate to /process → minimap toggle button visible in process view

Scenario 15: [MOD-PROCESS-017] Minimap state persists across reload — toggle minimap collapsed, reload page → minimap remains in same collapsed/expanded state after reload

## Design Token Colors (Theme Check)

Scenario 16: [MOD-PROCESS-018] Process module renders without obvious color artifacts — navigate to /process in dark theme → no jarring hardcoded hex colors visible, status indicators use theme-appropriate colors
