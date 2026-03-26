---
id: DD-12-001
title: Add alarm search entry point to Forensics landing page
unit: DD-12
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Forensics landing page must offer a third top-level tab: "Alarm Search". From this tab, the user picks a point, sees its historical alarms listed, selects one alarm event as the investigation anchor, and clicks to start an investigation pre-populated with that alarm's time range and point.

## Spec Excerpt (verbatim)

> **Alarm search**: Pick a point → system shows historical alarms for that point → select an alarm as the investigation anchor. Aggregation interval selector (raw, 1m, 5m, 15m, 30m) for filtering transient spikes.
> — 12_FORENSICS_MODULE.md, §Investigation Entry Points > From Forensics Module Direct

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/forensics/index.tsx` — the landing page; currently has `Tab = 'investigations' | 'threshold'` (line 287); add `'alarm'` here
- `frontend/src/pages/forensics/ThresholdSearch.tsx` — reference implementation for the search-tab pattern to follow
- `frontend/src/api/forensics.ts` — check whether `alarmSearch` API method exists; if not, add `POST /api/forensics/alarm-search`

## Verification Checklist

- [ ] A third tab "Alarm Search" appears in the Forensics header tab bar
- [ ] Alarm search tab renders a point-picker input and an aggregation interval selector (raw/1m/5m/15m/30m)
- [ ] After submitting, a list of historical alarm events for the selected point is shown
- [ ] Clicking an alarm row starts an investigation via `forensicsApi.createInvestigation` and navigates to `/forensics/:id`
- [ ] The created investigation is pre-populated with the alarm's point ID and a time range derived from the alarm duration

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `Tab` type at index.tsx:287 only includes `'investigations' | 'threshold'`. No alarm search UI, API call, or route exists.

## Fix Instructions

1. In `frontend/src/pages/forensics/index.tsx`:
   - Extend the `Tab` type to `'investigations' | 'threshold' | 'alarm'`
   - Add an `{ key: 'alarm', label: 'Alarm Search' }` entry to the tab list at line 368
   - Add a third branch in the content area: `tab === 'alarm' ? <AlarmSearch /> : ...`

2. Create `frontend/src/pages/forensics/AlarmSearch.tsx` modeled on `ThresholdSearch.tsx`:
   - Point ID input field
   - Aggregation interval selector: `raw | 1m | 5m | 15m | 30m`
   - On submit: call `forensicsApi.alarmSearch({ point_id, aggregation_interval })` which maps to `POST /api/forensics/alarm-search`
   - Display results in a DataTable with columns: Time, Duration, Severity, Message
   - Row click selects the alarm; "Start Investigation" button calls `forensicsApi.createInvestigation` with `{ name: ..., anchor_point_id: pointId, anchor_alarm_id: alarm.id }` and navigates to `/forensics/:newId`

3. In `frontend/src/api/forensics.ts` add `alarmSearch` method if not present.

Do NOT:
- Reuse the ThresholdSearch component for alarm search — they are different flows
- Navigate away before the investigation creation API call succeeds
