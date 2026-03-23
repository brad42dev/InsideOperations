# UAT Scenarios — DD-20

## Mobile / PWA
Scenario 1: [DD-20-002] Rounds page renders at mobile viewport (375px) — resize to 375px, navigate to /rounds → page loads without error
Scenario 2: [DD-20-002] Mobile tab bar touch targets adequate — at 375px, check rounds navigation → tab bar links appear large enough (≥60px)
Scenario 3: [DD-20-006] Pinch-zoom works on rounds graphics — at 375px, navigate to /rounds → zoom controls or pinch-zoom enabled
Scenario 4: [DD-20-005] No obvious barcode scanner crash — navigate to /rounds on mobile → barcode/QR scan button visible or no JS error
Scenario 5: [DD-20-007] App loads without IndexedDB errors — navigate to /rounds → no IndexedDB-related error boundary
Scenario 6: [DD-20-003] App loads normally (page visibility backgrounding is internal) — navigate to /rounds → page loads, no error boundary
