---
task_id: DD-27-017
unit: DD-27
status: completed
attempt: 1
claimed_at: 2026-03-26T00:00:00Z
last_heartbeat: 2026-03-26T00:00:00Z
---

## Prior Attempt Fingerprints

(none)

## Exit Checklist
- [x] AlertChannel_ struct has no `id` or `created_at` fields
- [x] list_channels query selects only existing columns
- [x] cargo check -p alert-service passes
- [x] No downstream references to ch.id or ch.created_at
