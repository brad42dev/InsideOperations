---
task_id: DD-31-023
unit: DD-31
status: completed
attempt: 1
claimed_at: 2026-03-26T00:00:00Z
last_heartbeat: 2026-03-26T00:00:00Z
---

## Solution Summary

Fixed template variable rendering to display human-readable labels and required indicators.

### Changes Made

1. **Database Migration** (`20260326000001_notification_templates_structured_variables`):
   - Changed `notification_templates.variables` from `TEXT[]` to `JSONB`
   - Migrated existing templates to structured format: `{name, label, required, default_value}`
   - Provided human-readable labels for all 10 built-in templates
   - Marked appropriate variables as required

2. **Backend API** (`services/api-gateway/src/handlers/notifications.rs`):
   - Replaced `var_names_to_objects()` with `normalize_variables()` to handle JSONB
   - Updated all database reads to properly deserialize structured variables
   - Updated INSERT/UPDATE to bind JSONB-formatted variables

3. **Frontend**: No changes needed — already correctly displays `v.label` with required asterisk

### Verification

- ✅ Backend compiles successfully (cargo build -p api-gateway)
- ✅ Frontend builds successfully (npm run build)
- ✅ TypeScript type checking passes (npx tsc --noEmit)
- ✅ Database migration applied (20260326000001)
- ✅ All 4 acceptance criteria met:
  - Labels display correctly (v.label, not v.name)
  - Required indicators show (red asterisk *)
  - Send button disabled when required fields empty
  - Variables pre-filled with default_value

## Prior Attempt Fingerprints

| Attempt | Fingerprint | Before Hash | After Hash | Result |
|---------|-------------|-------------|------------|--------|
| 1 | DD-31-023 schema migration + API refactor | N/A | Complete | ✅ pass |
