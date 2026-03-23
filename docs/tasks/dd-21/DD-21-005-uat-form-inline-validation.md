---
id: DD-21-005
unit: DD-21
title: Add User form missing React inline validation error messages
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-21/CURRENT.md
---

## What to Build

The Add User dialog at /settings/users relies only on browser-native HTML5 validation (required attribute focus) when submitted with empty required fields. There are no React-rendered inline error messages below form fields. The spec requires inline validation errors shown in the form (not browser alert dialogs or native tooltips).

## Acceptance Criteria

- [ ] Submitting Add User with empty Username shows inline error "Username is required" below the field
- [ ] Submitting with empty Email shows inline error "Email is required"
- [ ] Submitting with empty Password shows inline error "Password is required"
- [ ] Error messages appear in the DOM (visible in accessibility tree, not just browser tooltip)

## Verification Checklist

- [ ] Navigate to /settings/users, click + Add User
- [ ] Click Create User without filling any fields
- [ ] Confirm red/error text appears inline below each required empty field
- [ ] Error messages are part of the React component tree (no browser alert dialogs)

## Do NOT

- Do not use browser alert() for validation errors
- Do not rely solely on HTML required attribute validation

## Dev Notes

UAT failure 2026-03-23: Clicking Create User with empty fields only focuses the Username field (browser-native validation behavior). No React inline error text rendered in the form.
Spec reference: DD-21-004
