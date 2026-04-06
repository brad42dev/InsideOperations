# Decision: Context Menu Standard

**Date:** 2026-04-06
**Status:** Accepted
**Authors:** I/O Build

---

## Context

The application requires right-click (and long-press) context menus on:

- Data table rows
- Card and list items
- Point-bound display elements (live OPC values, tag badges)
- Chart surfaces (time-series, canvas, table-based)
- Tree nodes, SVG graphics, map elements

A consistent mechanism was needed across all 11 frontend modules to avoid divergent
implementations, z-index fights, and portal leakage inside react-grid-layout transforms.

---

## Decision

### 1. Custom `<ContextMenu>` component over Radix UI DropdownMenu / ContextMenu

**Use `src/shared/components/ContextMenu.tsx` for all context menus.**

**Why not Radix ContextMenu?**

Radix `ContextMenu` is well-designed but adds ~8 KB to the bundle, introduces its own
portal + z-index management, and its `onContextMenu` capture model conflicts with the
global prevention listener in AppShell. The custom component:

- Already exists and is in use
- Renders via `ReactDOM.createPortal` to `document.body` — works correctly inside
  react-grid-layout CSS transforms (where `position:fixed` children break)
- Exposes a `permission` prop for RBAC-aware hiding without any additional wrapper
- Exposes a `danger` prop for destructive-action styling
- Is 80 lines of focused code with no external dependencies

The Radix `DropdownMenu` (for kebab/toolbar menus) remains acceptable and is not
affected by this decision.

### 2. Z-index: 1800

All context menus render at `z-index: 1800`.

**Rationale:**

| Layer | Z-index |
|---|---|
| Pane chrome / chart overlays | 5–100 |
| Modals / dialogs | 1000–1200 |
| Toasts / notifications | 1300–1500 |
| Context menus | **1800** |
| Tooltips | 2000 |

Context menus must float above modals (a right-click inside a modal dialog is valid).
1800 achieves this without breaking tooltips.

### 3. Hide unauthorized items (not disable)

Items the current user lacks permission to perform are **not rendered** rather than
rendered as disabled.

**Why hide instead of disable?**

- Disabled items with tooltips ("you need role X") reveal the permission model to
  attackers performing UI reconnaissance.
- Hidden items reduce visual clutter for users who will never have the permission.
- Exception: the `disabled` prop on `<ContextMenu>` items is still used for
  **informational header rows** (e.g., "Row: Tank-101" at the top of a row menu).
  These are not actions and do not involve RBAC.

Implementation: pass `permission="some:permission"` on any `<ContextMenu>` item.
The component reads the permission from the auth store and omits the item if the
user lacks it.

### 4. Global prevention via AppShell

AppShell registers a document-level `contextmenu` listener that calls
`e.preventDefault()`. This suppresses the browser's native context menu everywhere
in the app. Individual surfaces then show the custom menu via their own
`onContextMenu` handlers (which also call `e.preventDefault()` + `e.stopPropagation()`
for belt-and-suspenders).

**Why global prevention?**

Without it, the native menu appears on elements with no explicit `onContextMenu`
handler (e.g., chart backgrounds, canvas edges). A user seeing the browser menu on a
chart is a visual regression.

**Consequence:** any surface that intentionally wants no context menu needs no special
handling — the global listener covers it.

### 5. Mobile long-press threshold: 500 ms

Touch devices trigger context menus via long-press at **500 milliseconds**.

**Rationale:**

- iOS Safari's native long-press for text selection triggers at ~500 ms.
- Matching the threshold means the custom menu appears simultaneously with (and
  replaces) the system selection UI.
- Values below 300 ms cause false triggers during normal scroll gestures.
- Values above 700 ms feel unresponsive.

**Implementation pattern:**

```tsx
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

const handleTouchStart = (e: React.TouchEvent, data: T) => {
  longPressTimer = setTimeout(() => {
    e.preventDefault(); // suppress text selection
    setMenuPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  }, 500);
};

const handleTouchEnd = () => {
  if (longPressTimer) clearTimeout(longPressTimer);
};
```

### 6. Hook for typed menus: `useContextMenu<T>()`

Stateful menus with typed row data use `src/shared/hooks/useContextMenu.ts`:

```ts
const { menuState, handleContextMenu, closeMenu } = useContextMenu<RowType>();
```

- `handleContextMenu(e, data)` — stores position + typed payload
- `menuState` — `{ x, y, data } | null`
- `closeMenu()` — resets to null

Charts that only need position (no typed row data) may use local `useState` instead
of the hook — this is acceptable for simplicity.

---

## Consequences

- **Positive:** Uniform right-click behavior across all modules. Single portal target
  eliminates z-index fights. RBAC hiding is automatic via prop.
- **Positive:** The `useContextMenu` hook keeps component state minimal and testable.
- **Negative:** ECharts' own `contextmenu` event is not used. Position is derived from
  the DOM `MouseEvent`, not from the data point. This means "right-click a data point"
  menus cannot automatically identify which series/point was clicked — a future
  enhancement would require cross-referencing mouse position with chart data.
- **Neutral:** Mobile long-press must be wired manually per surface. There is no global
  long-press interceptor.

---

## Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| Radix ContextMenu | Extra bundle weight, portal conflicts with react-grid-layout |
| Browser native context menu | Cannot be styled, no RBAC, no app-specific actions |
| Floating UI (Popper) | Overkill for a simple fixed-position overlay |
| Global right-click interceptor | Cannot determine what was clicked without explicit registration |
