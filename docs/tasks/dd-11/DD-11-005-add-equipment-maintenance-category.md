---
id: DD-11-005
title: Add "Equipment & Maintenance" to frontend template browser categories
unit: DD-11
status: pending
priority: low
depends-on: [DD-11-001]
---

## What This Feature Should Do

The design-doc §Canned Report Templates defines an "Equipment & Maintenance" category containing 4 reports. This category is absent from the CATEGORIES filter array in the template browser, so once Phase 2 templates are seeded (DD-11-001), users cannot filter to see these 4 reports by category.

## Spec Excerpt (verbatim)

> ### Equipment & Maintenance (4 reports)
> | Report | Description | Phase |
> |--------|-------------|-------|
> | **Alarm Rationalization Status** | ... | 2 |
> | **Disabled Alarms Audit** | ... | 2 |
> | **OPC Connection Health** | ... | 2 |
> | **Missed Readings Report** | ... | 2 |
> — design-docs/11_REPORTS_MODULE.md, §Equipment & Maintenance

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/reports/index.tsx` — `CATEGORIES` array at line 13; currently has 9 entries, missing "Equipment & Maintenance"

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `CATEGORIES` array in `index.tsx` contains "Equipment & Maintenance" as one of its entries
- [ ] The order matches the design-doc's category ordering (Alarm Management, Process Data, Operational Logs, Rounds & Inspections, Equipment & Maintenance, Environmental & Compliance, Security & Access, Executive & Management, Shift Operations)

## Assessment

After checking:
- **Status**: ❌ Missing — "Equipment & Maintenance" absent from CATEGORIES at index.tsx:13

## Fix Instructions

In `frontend/src/pages/reports/index.tsx`, update the `CATEGORIES` constant at line 13:

```typescript
const CATEGORIES = [
  'All',
  'Alarm Management',
  'Process Data',
  'Operational Logs',
  'Rounds & Inspections',
  'Equipment & Maintenance',   // ADD THIS
  'Environmental & Compliance',
  'Security & Access',
  'Executive & Management',
  'Shift Operations',
]
```

This is a one-line addition. The API already filters by `category` string — once the category string matches the seeded template category in the DB (from DD-11-001 which uses "Equipment & Maintenance"), the filter will work automatically.

Do NOT:
- Change the category names already present — they must match what is stored in the DB exactly (case-sensitive)
- Reorder the existing categories
