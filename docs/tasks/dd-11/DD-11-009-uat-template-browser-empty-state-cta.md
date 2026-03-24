---
id: DD-11-009
unit: DD-11
title: Add CTA button to template browser empty state
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-11/CURRENT.md
---

## What to Build

The template browser empty state (shown when search returns no matching templates) is missing a Call To Action (CTA) button. The DD-11-008 task specified that the empty state should include an illustration, explanation, AND a CTA. The illustration and explanation text were implemented, but the CTA was not.

**Observed in browser (2026-03-24):** When searching for a term that matches no templates (e.g., "xyznonexistent"), the left panel shows:
- ✅ A document icon illustration
- ✅ "No templates match your search" heading
- ✅ "Try clearing the search or selecting a different category." sub-text
- ❌ No CTA button (e.g., "Clear Search", "View All Templates", or "Reset Filters")

The CTA should allow the user to immediately act — either clear the search input or reset category filters to "All" — without having to manually interact with the search box or filter buttons.

## Acceptance Criteria

- [ ] Template browser empty state (no search results) includes a CTA button
- [ ] CTA button is actionable: clicking it either clears the search input or resets to "All" category filter
- [ ] The empty state layout remains: illustration → explanation heading → sub-text → CTA button
- [ ] CTA is accessible (has a visible label, is keyboard-focusable)

## Verification Checklist

- [ ] Navigate to /reports, type a search term that yields no results (e.g., "xyznonexistent")
- [ ] Confirm empty state shows illustration, explanation text, AND a CTA button
- [ ] Click the CTA button — confirm it clears the search or resets filters (visible change in template list)
- [ ] No silent no-op: clicking the CTA must produce a visible state change

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — test that clicking the CTA actually resets/clears correctly

## Dev Notes

UAT failure from 2026-03-24: Empty state renders illustration and text but is missing the CTA button. Accessibility tree for the empty state container (ref=e187) only contains `img` and two `generic` text nodes — no button element.
Spec reference: DD-11-008 (Improve template browser empty state with illustration, explanation, and CTA)
