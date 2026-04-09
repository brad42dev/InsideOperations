# Right-Click & Context Menu Behaviors — Quick Reference

**Compiled:** April 6, 2026  
**Source:** All 40 I/O Design Documents (00-39)

---

## 🎯 Universal Point Context Menu (ALL MODULES)

**Trigger:** Right-click on any point-bound element OR Long-press 500ms (mobile)

**Available Everywhere:**
- Graphics (Console, Process)
- Tables (any point cell)
- Charts (any data point)
- Dashboards (any widget value)
- Alarms (alarm rows)

**Menu Items:**
- **Point Detail** — Opens floating panel (up to 3 concurrent) | Permission: `console:read`
- **Trend Point** — Full-screen trend (last 24h) | Permission: `console:read`
- **Investigate Point** — Create Forensics investigation | Permission: `forensics:write`
- **Report on Point** — Generate report | Permission: `reports:read`
- **Investigate Alarm** — Forensics from alarm (alarm rows only) | Permission: `forensics:write`

**Reference:** DOC 32 SHARED_UI_COMPONENTS.md (lines 1121-1138)

---

## 🎨 Designer Module Context Menus

### Selected Elements
- **Promote to Shape** → Opens 8-step wizard
- **Save as Stencil** → Dialog: name, category, tags

### Shapes/Stencils in Palette
- **Export SVG** → Download as standalone SVG
- **Replace SVG...** → Reimport (user shapes only)
- **Switch Variant** → Override global shape style
- **Promote to Shape** → On stencils, convert to shape

### Pipes
- **Service Type** → Dropdown (process/gas/steam/water/etc.)

### Canvas (Empty)
- **Paste** → Paste copied elements
- **Select All** → Ctrl+A equivalent
- **Zoom to Fit** → Fit selection or all
- **Toggle Grid** → Show/hide grid
- **Layer Operations** → Full CRUD on layer panel

---

## 🖥️ Console Module Context Menus

### Panes
- **Right-click on pane** → **Remove** | Alternative: Delete key, drag outside

### Empty Workspace
- **Right-click empty area** → **Add Pane** | Alternative: Drag graphic from palette

### Point-Bound Elements
→ Uses Universal Point Context Menu (see above)

---

## 🔬 Process Module Context Menus

### Point-Bound Elements
→ Uses Universal Point Context Menu (see above)

---

## 📊 Dashboards Module Context Menus

### Point Values in Widgets
→ Uses Universal Point Context Menu (see above)

---

## 🔍 Forensics Module Context Menus

### Entry Points (via Universal Point Context Menu)
- **Right-click alarm** → **Investigate Alarm**
- **Right-click point** → **Investigate Point**

---

## 🔧 Expression Builder Context Menus

### Tile Workspace Operations
- **Right-click selected tile** → Cut, Copy, Delete Tile(s), Select All
- **Right-click unselected tile** → Copy, Delete
- **Right-click empty workspace** → Paste, Select All
- **Right-click inside container** → Paste (inside container)

---

## 📱 Mobile (Long-Press Equivalent to Right-Click)

**Gesture:** Long-press 500ms (5-10x slower than hover, accommodates gloved operation)

**Available:** All Point Context Menu items
- Point Detail
- Trend Point
- Investigate Point
- Report on Point
- Investigate Alarm (on alarms)

**Reference:** DOC 20 MOBILE_ARCHITECTURE.md (line 95)

---

## 📦 Export Operations

### Console/Process Graphic Pane
- **Right-click graphic pane** → **Export Graphic** | Format: `.iographic`

### Designer
- **File → Export → `.iographic`** | Single graphic

### Settings
- **Graphics Management → Select multiple** → **Export Selected** | Batch `.iographic`

---

## 🎭 Graphics System Context Menus

### Display Elements in Designer
- **Right-click display element** → Opens element configuration panel

### Point Operations
- Participate in Universal Point Context Menu

---

## 📋 Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Point Context Menu (DOC 32) | ✅ Implemented | App-wide shared component |
| Designer Asset Operations | ✅ Partially Done | Core menus working, some gaps noted |
| Console Pane Menus | ✅ Implemented | Remove, Add operations |
| Expression Builder Tiles | ✅ Implemented | Full tile CRUD menu |
| Mobile Long-Press | ✅ Implemented | 500ms threshold |
| Designer Full Context Menu | ⚠️ Gaps Identified | See DESIGNER_WORK_QUEUE.md Section 3.4 |

---

## 🔐 Permission Gates

| Menu Item | Required Permission | Module | Behavior |
|-----------|-------------------|--------|----------|
| Point Detail | `console:read` (or equiv) | All | Hidden if no permission |
| Trend Point | `console:read` (or equiv) | All | Hidden if no permission |
| Investigate Point | `forensics:write` | All | Hidden if no permission |
| Investigate Alarm | `forensics:write` | Forensics | Hidden if no permission |
| Report on Point | `reports:read` | All | Hidden if no permission |
| Designer operations | `designer:write` | Designer | Hidden if no permission |
| Export operations | `designer:export` | Designer/Console/Process | Hidden if no permission |

**Note:** Items are HIDDEN, not grayed out. No visual indication of unavailable items.

---

## 🔗 Cross-References

- **DOC 05:** Development phases — right-click component implementation (Phase 5)
- **DOC 06:** Frontend shell — detached window context menus
- **DOC 07:** Console — pane operations, point context menu
- **DOC 08:** Process — point context menu (same as Console)
- **DOC 09:** Designer — shape/stencil operations, asset management
- **DOC 10:** Dashboards — point context menu
- **DOC 12:** Forensics — investigation entry points via context menu
- **DOC 19:** Graphics System — display element config, point operations
- **DOC 20:** Mobile — long-press equivalent, 500ms threshold
- **DOC 23:** Expression Builder — tile workspace context menu
- **DOC 32:** Shared UI Components — **DEFINITIVE** Point Context Menu spec
- **DOC 35:** Shape Library — variant selection via context menu
- **DOC 39:** iographic Format — graphic export workflow

---

## 📝 Notes

1. **Universal Point Context Menu is canonical source** — All point-related right-click operations should use DOC 32 component
2. **Mobile long-press is functional equivalent** — 500ms press trigger, same menu items, same permissions
3. **Permission gating:** Hide items (not disable/gray) if user lacks permission
4. **Detached windows:** Maintain feature parity with main app
5. **Destructive operations:** Confirmation after menu selection, not on hover
6. **Keyboard alternatives:** Ctrl+I for Point Detail, Ctrl+C/X/V for copy/cut/paste, Ctrl+Z/Y for undo/redo
7. **App-wide consistency:** Designer operations (cut/copy/paste) follow CMS-style patterns

---

**For full details, see:** `design-docs-research.md` in this directory
