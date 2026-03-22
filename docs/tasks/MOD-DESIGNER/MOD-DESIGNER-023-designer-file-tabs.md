---
id: MOD-DESIGNER-023
unit: MOD-DESIGNER
title: Designer file tabs — multiple open graphics simultaneously
status: pending
priority: high
depends-on: []
source: feature
decision: docs/decisions/designer-groups-and-tabs.md
---

## What to Build

Add a **tab bar** to the Designer that lets the user have multiple graphics open at once. Each open graphic
is a tab; clicking a tab switches to that graphic. This is a file-level feature — groups opened in sub-tabs
(MOD-DESIGNER-024) build on top of this.

### Tab bar placement

Between the main Designer toolbar and the canvas area. Full width of the canvas+palette area (i.e., below
the toolbar, above the left palette + canvas + right panel row).

### Tab state in uiStore / tabStore

Add a tab management structure (either extend uiStore or create a lightweight `tabStore`):

```typescript
interface DesignerTab {
  id: string;              // tab UUID
  graphicId: string;       // the graphic's database ID
  graphicName: string;     // cached display name
  isModified: boolean;     // unsaved changes
  viewport: ViewportState; // per-tab pan/zoom/pan
  type: 'graphic';         // 'graphic' | 'group' (group tabs added in MOD-DESIGNER-024)
}

interface TabState {
  tabs: DesignerTab[];
  activeTabId: string | null;
}
```

### Opening a graphic in a tab

When the user opens a graphic from the `DesignerGraphicsList` (or `DesignerHome`):
1. Check if a tab with `graphicId` already exists → if yes, `setActiveTab(existingTab.id)`
2. If not → create new tab, load the graphic into sceneStore (or a per-tab scene store), set it active

**Per-tab scene state:** Each tab needs its own scene graph. Two approaches:
- **(Recommended) Single sceneStore, switch on tab change**: When switching tabs, swap the entire scene graph
  (`sceneStore.loadDocument(tab.graphicId)`). Store each tab's scene graph in the tab's own state slot when
  switching away. This avoids multiple concurrent WebSocket subscriptions and is simpler.
- (Alternative) Multiple sceneStore instances per tab — complex, skip for now.

On tab switch:
1. Save current sceneStore state into the outgoing tab's `savedScene` field
2. Load the incoming tab's `savedScene` into sceneStore (or fetch from server if not yet loaded)
3. Save/restore the viewport (pan/zoom) per tab

### Tab bar component

```tsx
<TabBar>
  {tabs.map(tab => (
    <Tab
      key={tab.id}
      label={tab.graphicName}
      modified={tab.isModified}  // shows ● dot
      active={tab.id === activeTabId}
      onClick={() => switchToTab(tab.id)}
      onClose={() => closeTab(tab.id)}
    />
  ))}
</TabBar>
```

Tab anatomy:
- Modified dot: `●` prefix in `--io-warning` color when `isModified`
- Label: graphic name, truncated at 20 chars with `…` + tooltip showing full name on hover
- Close button: `×` on right side of tab, appears on hover (or always visible — either is fine)
- Active tab: `border-bottom: 2px solid var(--io-accent)` and `background: var(--io-surface-elevated)`
- Inactive tab: `background: var(--io-surface)`, cursor: pointer, hover: subtle bg change

**Tab overflow:** If tabs overflow the tab bar width, show left/right scroll arrows at bar edges. Tabs
scroll horizontally within the bar (no wrapping).

### Closing a tab

When user clicks the `×` on a tab (or presses Ctrl+W on the active tab):
1. If `tab.isModified`:
   - Show a small confirmation: "Save changes to [graphic name]?" with [Save] [Discard] [Cancel] buttons
   - Save → auto-save the graphic → close tab
   - Discard → close without saving
   - Cancel → keep tab open
2. If not modified: close immediately

After closing:
- If it was the active tab: switch to the most recently active tab; if no tabs remain, show the Designer home screen
- Remove from `tabs` array

### Keyboard shortcuts

Wire in the existing global keydown handler:
- **Ctrl+W**: close active tab (with save prompt if modified)
- **Ctrl+Tab**: cycle to next tab (wraps around)
- **Ctrl+Shift+Tab**: cycle to previous tab
- **Ctrl+1 through Ctrl+9**: switch to tab by 1-indexed position

### Right-click on tab

Radix `ContextMenu` on each tab:
- "Close" (Ctrl+W)
- "Close Others" — closes all tabs except this one (save prompt for each modified tab)
- "Close All" — closes all tabs (save prompt for each modified tab)
- Separator
- "Copy Name" — copies the graphic name to clipboard

### Tab count limit

Maximum 10 tabs. When the 11th graphic is opened, close the least-recently-used tab (the one whose
`lastFocusedAt` timestamp is oldest), after auto-saving if modified. Show a brief toast:
"Max tabs reached — [graphic name] was closed and saved."

Track `lastFocusedAt: number` (Unix timestamp) on each tab, updated on `switchToTab`.

## Acceptance Criteria

- [ ] Designer shows a tab bar between the toolbar and canvas area.
- [ ] Opening a graphic from the graphics list adds a tab. Clicking the same graphic again focuses the
      existing tab instead of opening a duplicate.
- [ ] Switching tabs switches the canvas to that graphic's scene graph and restores its saved viewport.
- [ ] Modified indicator (●) appears on tabs with unsaved changes. It clears after save.
- [ ] Closing a modified tab prompts Save / Discard / Cancel.
- [ ] Ctrl+W closes the active tab. Ctrl+Tab/Ctrl+Shift+Tab cycles tabs. Ctrl+1–9 jumps by position.
- [ ] Tab right-click shows Close, Close Others, Close All, Copy Name.
- [ ] Tabs scroll horizontally when they overflow the bar width.
- [ ] When all tabs are closed, the Designer home screen is shown.
- [ ] Max 10 tabs enforced — 11th open closes the LRU tab with a toast.

## Do NOT

- Do not implement group sub-tabs here (that is MOD-DESIGNER-024, which extends this tab system).
- Do not implement multi-window / detached tabs (single browser window only).
- Do not use multiple concurrent WebSocket connections for simultaneously open graphics (the inactive tabs
  are not live-updating; only the active tab's graphic receives real-time data).

## Dev Notes

Files to edit:
- `frontend/src/pages/designer/index.tsx` — add TabBar component, tab state, tab switching logic,
  graphic open → tab logic
- `frontend/src/store/designer/` — add tab state (either extend uiStore or new tabStore.ts)
- `frontend/src/pages/designer/DesignerGraphicsList.tsx` (and Dashboard/Reports lists) — instead of
  directly navigating to the graphic editor, call `openGraphicInTab(graphicId)` which goes through the
  tab system

The "save/restore scene graph per tab" approach: uiStore or tabStore stores a `Map<tabId, SavedTabState>`
where `SavedTabState = { scene: GraphicDocument; undoStack: SceneCommand[] }`. On tab switch, flush
current state into the map and restore from map (or fetch from server if first open).

For Ctrl+W not to conflict with browser's native close-tab, use `e.preventDefault()` in the keydown
handler when the Designer is focused. This is already done for other keyboard shortcuts — follow the same
pattern.

The TabBar component should be styled with `var(--io-surface)` background, `var(--io-border)` bottom border
(between tabs and canvas area), height ~36px. Tab items: `padding: 0 12px`, `height: 100%`, flex row.
