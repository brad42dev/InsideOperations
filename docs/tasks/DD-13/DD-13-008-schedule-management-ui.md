---
id: DD-13-008
title: Implement log schedule management UI (currently a static stub)
unit: DD-13
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Administrators must be able to create and manage log schedules that automatically generate log instances on a recurring basis — per shift, by time window (every 6 hours, daily, custom interval), and per team. The current `LogSchedules` page is a static stub that tells users to "contact your system administrator."

## Spec Excerpt (verbatim)

> Log instances are generated automatically based on schedule configuration:
> - **Per shift**: One log instance per shift (e.g., day shift log, night shift log)
> - **By time window**: Every 6 hours, once per day, custom interval
> - **Multiple logs per shift by team**: Different templates for different teams on the same shift
> — design-docs/13_LOG_MODULE.md, §Scheduling

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/log/LogSchedules.tsx:1-15` — entire file is a static stub
- `frontend/src/api/logs.ts` — no schedule endpoints exist; they need to be added
- `frontend/src/App.tsx:523-531` — route at `log/schedules` guarded by `log:schedule_manage`

## Verification Checklist

- [ ] Schedule list shows existing schedules: template name, recurrence type, team, status (active/inactive)
- [ ] "New Schedule" button opens a form to create a schedule
- [ ] Form allows selecting: template, recurrence type (per-shift / time-window / per-team), interval (for time-window), team name (optional)
- [ ] Schedule can be toggled active/inactive without deleting
- [ ] Edit and delete actions exist per schedule row
- [ ] Page is only accessible to users with `log:schedule_manage` (already correct in App.tsx:526)

## Assessment

- **Status**: ❌ Missing
- `LogSchedules.tsx:10-14` renders a single static `<div>` with: "Log scheduling is configured on the backend. Contact your system administrator to set up recurring log instances."
- No schedule API endpoints exist in `logs.ts`
- The entire schedule CRUD feature is absent

## Fix Instructions

1. Add schedule API types and methods to `frontend/src/api/logs.ts`:
   ```ts
   export interface LogSchedule {
     id: string
     template_id: string
     template_name?: string
     recurrence_type: 'per_shift' | 'time_window' | 'per_team'
     interval_hours?: number
     team_name?: string
     is_active: boolean
     created_at: string
   }
   ```
   Add `listSchedules`, `createSchedule`, `updateSchedule`, `deleteSchedule` methods following the same pattern as template methods. Endpoint prefix: `/api/logs/schedules`.

2. Replace `LogSchedules.tsx` with a full CRUD page following the same pattern as `LogTemplates.tsx`:
   - Header with "New Schedule" button (only shown with `log:schedule_manage`)
   - List of schedule cards showing: template name, recurrence type badge, team, active status toggle
   - Edit modal or inline form
   - Delete with confirmation

3. The "New Schedule" form should include:
   - Template selector (`<select>` from `logsApi.listTemplates({ is_active: true })`)
   - Recurrence type: radio or select for `per_shift`, `time_window`, `per_team`
   - If `time_window`: interval_hours field (number input, min 1)
   - Optional team_name text input

Do NOT:
- Leave the static stub message in place
- Require Admin role — the route already correctly uses `log:schedule_manage`
- Implement the schedule execution engine in the frontend — that runs on the backend; this is only the management UI
