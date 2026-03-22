---
id: DD-06-007
title: Add missing user menu items: Enter Kiosk Mode, My Exports, About, theme switcher
unit: DD-06
status: pending
priority: medium
depends-on: [DD-06-002]
---

## What This Feature Should Do

The user profile dropdown currently only shows the user's name, email, and a "Sign Out" button. The spec requires four additional items: a theme switcher in the top bar area, "My Exports" link, "About Inside/Operations" link, and "Enter Kiosk Mode" toggle.

## Spec Excerpt (verbatim)

> **Visible** | ~48px (density-dependent) | Logo, breadcrumbs, global search / Ctrl+K trigger, alert notification bell + badge, user profile dropdown, **theme switcher**
> — 06_FRONTEND_SHELL.md, §Top Bar (2-State)

> **Success Criteria:**
> - My Exports link accessible from user profile dropdown
> - About page displays version, build info, and open source licenses
> — 06_FRONTEND_SHELL.md, §Success Criteria

> | UI button | User profile dropdown: "Enter Kiosk Mode" |
> — 06_FRONTEND_SHELL.md, §Kiosk Mode > Entry

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx` lines 927–1043 — user menu dropdown with only Sign Out
- `frontend/src/store/ui.ts` line 29 — setTheme function
- `frontend/src/App.tsx` line 130 — /my-exports route exists

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Theme switcher (3 buttons: Light / Dark / HPHMI) present in top bar or user menu
- [ ] "My Exports" link in user menu navigates to /my-exports
- [ ] "About Inside/Operations" link in user menu navigates to /settings/about
- [ ] "Enter Kiosk Mode" button in user menu calls enterKiosk()
- [ ] Theme switcher shows active theme highlighted
- [ ] User menu items have correct icons (Lucide)

## Assessment

After checking:
- **Status**: ❌ Missing — user menu (lines 974–1043) only contains name display and Sign Out button

## Fix Instructions

In `frontend/src/shared/layout/AppShell.tsx`, expand the user dropdown menu:

```tsx
{userMenuOpen && (
  <div style={{ position: 'fixed', top: userMenuPos.top, right: userMenuPos.right,
    minWidth: '220px', background: 'var(--io-surface-elevated)',
    border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)',
    boxShadow: 'var(--io-shadow-lg)', zIndex: 3000, overflow: 'hidden' }}>
    {/* User info header */}
    ...

    {/* Theme switcher */}
    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--io-border)' }}>
      <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginBottom: '6px' }}>Theme</div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {(['light', 'dark', 'hphmi'] as const).map(t => (
          <button key={t} onClick={() => { setTheme(t) }}
            style={{ flex: 1, padding: '4px', border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)', fontSize: '11px',
              background: theme === t ? 'var(--io-accent-subtle)' : 'transparent',
              color: theme === t ? 'var(--io-accent)' : 'var(--io-text-muted)',
              cursor: 'pointer', textTransform: 'capitalize' }}>
            {t === 'hphmi' ? 'HPHMI' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    </div>

    {/* Navigation items */}
    <NavLink to="/my-exports" onClick={() => setUserMenuOpen(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
        textDecoration: 'none', color: 'var(--io-text-secondary)', fontSize: '13px' }}>
      <Download size={14} /> My Exports
    </NavLink>

    <NavLink to="/settings/about" onClick={() => setUserMenuOpen(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
        textDecoration: 'none', color: 'var(--io-text-secondary)', fontSize: '13px' }}>
      <Info size={14} /> About Inside/Operations
    </NavLink>

    <button onClick={() => { setUserMenuOpen(false); enterKiosk() }}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 14px', background: 'none', border: 'none',
        color: 'var(--io-text-secondary)', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>
      <Monitor size={14} /> Enter Kiosk Mode
    </button>

    <div style={{ height: '1px', background: 'var(--io-border)' }} />

    {/* Sign Out */}
    ...
  </div>
)}
```

Add `Download`, `Info` to Lucide imports at the top. Add `const { theme, setTheme } = useUiStore()` where theme is destructured.

Do NOT:
- Put the theme switcher inside a settings sub-page only (it must be accessible from the top bar area per spec)
- Disable "Enter Kiosk Mode" when already in kiosk — show "Exit Kiosk Mode" instead
