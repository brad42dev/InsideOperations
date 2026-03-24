# UAT Scenarios — GFX-SHAPES

Tasks under test: GFX-SHAPES-005, GFX-SHAPES-006

## Designer Route

Scenario 1: [GFX-SHAPES-005] Designer page renders without error — navigate to /designer → page loads, no error boundary ("Something went wrong")

Scenario 2: [GFX-SHAPES-005] Shape palette visible in Designer — navigate to /designer → shape palette/sidebar visible with category sections or shape thumbnails

## Column Shape Variants (GFX-SHAPES-005)

Scenario 3: [GFX-SHAPES-005] Column shapes index accessible — fetch /shapes/index.json → column-distillation entries present with "columns" category

Scenario 4: [GFX-SHAPES-005] Column sidecar JSON has 12 configurations — fetch /shapes/columns/column-distillation.json → variants.configurations array contains 12 entries covering narrow/wide x trayed/trayed-10/packed

Scenario 5: [GFX-SHAPES-005] Column shape 6 new variants in sidecar — fetch /shapes/columns/column-distillation.json → entries for narrow-trayed, narrow-trayed-10, narrow-packed, wide-trayed, wide-trayed-10, wide-packed present

## Tank and Reactor Sidecars (GFX-SHAPES-006)

Scenario 6: [GFX-SHAPES-006] Tank sidecar has required schema fields — fetch /shapes/tanks/tank-storage-cone-roof.json → $schema, version, alarmAnchor, states fields are present

Scenario 7: [GFX-SHAPES-006] Tank alarmAnchor format correct — fetch /shapes/tanks/tank-storage-cone-roof.json → alarmAnchor has nx and ny float fields

Scenario 8: [GFX-SHAPES-006] Tank states field present with correct keys — fetch /shapes/tanks/tank-storage-cone-roof.json → states object has standard state name keys (running, stopped, fault, etc.)

Scenario 9: [GFX-SHAPES-006] Reactor sidecar has alarmAnchor and states — fetch first available reactor JSON → alarmAnchor and states fields present

## Shape Rendering in Designer (GFX-SHAPES-005 + 006)

Scenario 10: [GFX-SHAPES-006] Tank shapes visible in Designer palette — navigate to /designer, look for tanks category → tank shapes visible, no error message in UI
