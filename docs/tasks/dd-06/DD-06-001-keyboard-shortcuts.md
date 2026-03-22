---
id: DD-06-001
title: Implement correct sidebar keyboard shortcuts (Ctrl+\, Ctrl+Shift+\)
unit: DD-06
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The sidebar has three states (expanded, collapsed, hidden). Two distinct keyboard shortcuts must control these states: `Ctrl+\` toggles between Expanded and Collapsed, while `Ctrl+Shift+\` toggles the sidebar to/from Hidden. Currently, both behaviors are mapped to a single `Ctrl+Shift+B` shortcut that cycles all three states.

## Spec Excerpt (verbatim)

> ```
>                     Ctrl+\                     Ctrl+Shift+\
>   Expanded (240px) ←────→ Collapsed (48px) ←────────────→ Hidden (0px)
>        ↑                                                       ↑
>        └───── Ctrl+Shift+\ (direct toggle to Hidden) ─────────┘
> ```
> — 06_FRONTEND_SHELL.md, §Navigation System > Sidebar (3-State)

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx` lines 319–325 — current Ctrl+Shift+B handler that needs to be split into two handlers

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `Ctrl+\` (key: `\\`) toggles between 'expanded' and 'collapsed' (if hidden, transitions to collapsed first)
- [ ] `Ctrl+Shift+\` toggles between hidden and the previous non-hidden state
- [ ] `Ctrl+Shift+B` is removed or remapped (not in spec)
- [ ] Keyboard shortcut help overlay (`?` key) lists the correct bindings

## Assessment

After checking:
- **Status**: ❌ Missing — `Ctrl+\` and `Ctrl+Shift+\` are not implemented. `Ctrl+Shift+B` cycles all three states but this key binding is not in the spec.

## Fix Instructions

In `frontend/src/shared/layout/AppShell.tsx`, in the `handleKeyDown` function (around line 301):

Replace the existing `Ctrl+Shift+B` block (lines 319–324) with two handlers:

```typescript
// Ctrl+\ — toggle Expanded ↔ Collapsed
if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === '\\') {
  e.preventDefault()
  setSidebarState(s => s === 'hidden' ? 'collapsed' : s === 'collapsed' ? 'expanded' : 'collapsed')
  return
}

// Ctrl+Shift+\ — toggle Hidden ↔ previous state
if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '\\') {
  e.preventDefault()
  setSidebarState(s => s === 'hidden' ? 'collapsed' : 'hidden')
  setCollapsedPeek(false)
  return
}
```

Do NOT:
- Keep `Ctrl+Shift+B` as the primary shortcut (not in spec)
- Implement a simple three-way cycle for `Ctrl+\` (spec says it toggles between expanded and collapsed only)
