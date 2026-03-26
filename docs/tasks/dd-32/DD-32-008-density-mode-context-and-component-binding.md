---
id: DD-32-008
title: Implement density mode React context so shared components respond to global density setting
unit: DD-32
status: pending
priority: medium
depends-on: [DD-32-003]
---

## What This Feature Should Do

Density mode (Compact/Default/Comfortable) is a global setting that must be provided via React context. All shared components must read density from this context — not from caller-supplied props. Currently density is stored only in localStorage by the Settings page and no component reads it; DataTable's `rowHeight` is a prop the caller must manually set.

## Spec Excerpt (verbatim)

> Components read density from `ThemeProvider` context (same provider that handles light/dark/high-contrast)
> Density affects: row heights, cell padding, icon sizes, touch target sizes, spacing between elements
> ...
> | `<DataTable />` | 28px rows, 4px cell padding | 36px rows, 8px cell padding | 44px rows, 12px cell padding |
> — design-docs/32_SHARED_UI_COMPONENTS.md, §Density Mode Support

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/settings/Display.tsx` — stores density in localStorage under `io:display:density` (line 4); this is the source to read on init
- `frontend/src/shared/components/DataTable.tsx:83` — `rowHeight = 36` default prop; should be density-driven
- `frontend/src/shared/theme/ThemeContext.tsx` — to be created in DD-32-003; density should be added to this same context

## Verification Checklist

- [ ] The ThemeContext (from DD-32-003) includes `density: 'compact' | 'default' | 'comfortable'`
- [ ] On app load, density is read from localStorage (`io:display:density`) and injected into context
- [ ] `DataTable.tsx` does NOT accept `rowHeight` as a required prop; it reads density from context to determine row height (28/36/44px)
- [ ] When the user changes density in Settings > Display, the context updates and DataTable row heights update without page reload

## Assessment

- **Status**: ❌ Missing — no density context; DataTable uses `rowHeight = 36` default prop; no component reads density dynamically

## Fix Instructions

1. **Add density to ThemeContext** (alongside the DD-32-003 ThemeContext work):
   ```ts
   interface ThemeContextValue {
     theme: Theme
     colors: ThemeColors
     density: 'compact' | 'default' | 'comfortable'
     setDensity: (d: Density) => void
   }
   ```

2. **Initialise density from localStorage**: In `App.tsx` or the ThemeProvider component, read `localStorage.getItem('io:display:density') ?? 'default'` as the initial density value.

3. **DataTable density binding**: In `DataTable.tsx`, import `useDensity()` from the ThemeContext. Remove the `rowHeight` default value of `36`. Replace it with:
   ```ts
   const density = useDensity()
   const densityRowHeight = density === 'compact' ? 28 : density === 'comfortable' ? 44 : 36
   const resolvedRowHeight = rowHeight ?? densityRowHeight
   ```
   This preserves the ability to override rowHeight for specific use cases while defaulting to density.

4. **Settings persistence**: In `Display.tsx`, when the user changes density, also call `setDensity()` from the ThemeContext (not just store in localStorage). This triggers the live context update.

Do NOT:
- Remove the `rowHeight` prop from DataTable — some callers may legitimately override it
- Store density in a separate Zustand store — spec says it shares the ThemeProvider context
