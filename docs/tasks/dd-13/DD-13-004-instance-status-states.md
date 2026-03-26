---
id: DD-13-004
title: Align instance status states with spec (draft/submitted/reviewed vs pending/completed)
unit: DD-13
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Log instances follow a four-state lifecycle: `draft` (created, not yet started), `in_progress` (operator is filling it out), `submitted` (operator marked complete), `reviewed` (supervisor has reviewed). The implementation uses `pending` instead of `draft` and `completed` instead of `submitted`, and has no `reviewed` state at all.

## Spec Excerpt (verbatim)

> Status: `draft` → `in_progress` → `submitted` → `reviewed`
> — design-docs/13_LOG_MODULE.md, §Log Instances

## Where to Look in the Codebase

Primary files:
- `frontend/src/api/logs.ts:32` — `LogInstance.status` union type
- `frontend/src/pages/log/LogEditor.tsx:14-22` — `StatusBadge` map
- `frontend/src/pages/log/LogEditor.tsx:685` — `readOnly = instanceData?.status === 'completed'`
- `frontend/src/pages/log/index.tsx:12-22` — `StatusBadge` in index
- `frontend/src/pages/log/index.tsx:403,415` — `listInstances({ status: 'pending' })` and `listInstances({ status: 'completed' })`

## Verification Checklist

- [ ] `LogInstance.status` type in `logs.ts` includes `'draft'`, `'in_progress'`, `'submitted'`, `'reviewed'` (not `'pending'` or `'completed'`)
- [ ] `StatusBadge` in both `LogEditor.tsx` and `index.tsx` handles all four states with appropriate labels and colors
- [ ] The Active Logs query fetches `draft` and `in_progress` instances (not `pending`)
- [ ] The Completed tab fetches `submitted` and `reviewed` instances (not `completed`)
- [ ] `readOnly` check in `LogEditor.tsx:685` tests for `submitted` or `reviewed` (not `completed`)
- [ ] The "Submit" button in LogEditor transitions to `submitted` (not `completed`)
- [ ] A supervisor "Mark Reviewed" action exists or is noted as a future task

## Assessment

- **Status**: ⚠️ Wrong
- `logs.ts:32`: status is `'pending' | 'in_progress' | 'completed'` — missing `draft`, `submitted`, `reviewed`; `pending` should be `draft`; `completed` should be `submitted`
- The `reviewed` state and supervisor review flow are entirely absent
- The backend API and database schema (doc 04) should be the source of truth here — verify the DB `log_instances.status` column values match the spec before changing the frontend type

## Fix Instructions

1. **Coordinate with backend first**: The `log_instances.status` enum in the database must match the spec. If the database uses `pending`/`completed`, a migration is needed alongside this change.

2. Once the backend is confirmed, update `frontend/src/api/logs.ts:32`:
   ```ts
   status: 'draft' | 'in_progress' | 'submitted' | 'reviewed'
   ```

3. Update `StatusBadge` in both `LogEditor.tsx` (lines 14-22) and `index.tsx` (lines 12-22) to add `submitted` and `reviewed` entries. Example:
   ```ts
   submitted: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', label: 'Submitted' },
   reviewed: { bg: 'rgba(74,158,255,0.12)', text: 'var(--io-accent)', label: 'Reviewed' },
   ```
   Replace `pending` with `draft` and `completed` with `submitted`.

4. Update `index.tsx:403`: change `status: 'pending'` to `status: 'draft'`
5. Update `index.tsx:415`: change `status: 'completed'` to `status: 'submitted'`; add second query for `reviewed`
6. Update `LogEditor.tsx:685`: change `=== 'completed'` to `status === 'submitted' || status === 'reviewed'`
7. The submit mutation in `LogEditor.tsx:628` should call `logsApi.submitInstance()` which POSTs to `/api/logs/instances/:id/submit` — verify this transitions to `submitted` on the backend.

Do NOT:
- Change the database enum without a migration
- Introduce a `reviewed` transition in the frontend before the backend implements the review endpoint
