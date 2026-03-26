---
id: MOD-DESIGNER-040
title: Implement Navigation Link "Set Link…" dialog for Designer canvas nodes
unit: MOD-DESIGNER
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Any node on the Designer canvas can have a navigation link (a property on SceneNodeBase that causes clicking the node in view mode to navigate to a target graphic or external URL). The context menu already has a "Navigation Link" submenu with "Set Link…", "Remove Link", and "Navigate" items, but "Set Link…" is a TODO stub. The user should be able to open a dialog from "Set Link…" to specify either a target graphic (by selecting from the graphic library) or a target URL (by typing), and optionally set whether the link opens in the same tab or a new tab.

## Spec Excerpt (verbatim)

> **NavigationLink on any node.** Any `SceneNode` can have `navigationLink`. Clicking the node navigates to `targetGraphicId` or opens `targetUrl`. Not just SymbolInstances.
> — docs/SPEC_MANIFEST.md, GFX-CORE Non-Negotiable #8

> `Navigation Link submenu, Properties. These appear for ALL node types.` [in RC-DES-2 base items]
> — docs/SPEC_MANIFEST.md, CX-CANVAS-CONTEXT Non-Negotiable #2

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/DesignerCanvas.tsx:5300–5337` — the Navigation Link submenu. "Set Link…" has `/* TODO: open Navigation Link dialog */` at line 5311.
- `frontend/src/shared/types/graphics.ts` — `NavigationLink` interface with `targetGraphicId`, `targetUrl`, `openInNewTab` fields.
- `frontend/src/pages/designer/components/` — directory where the new dialog should be created.
- `frontend/src/shared/graphics/commands.ts` — `ChangePropertyCommand` to use for setting/removing the link.

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Clicking "Set Link…" opens a dialog (not an inline input — a proper modal or sheet)
- [ ] The dialog has two modes: "Link to Graphic" (shows a searchable list of existing graphics) and "Link to URL" (text input for external URL)
- [ ] Setting a link commits via `ChangePropertyCommand(nodeId, 'navigationLink', newLink, oldLink)` — undoable
- [ ] "Remove Link" is enabled only when the node has a `navigationLink` set; clicking it removes it via ChangePropertyCommand
- [ ] "Navigate" in the submenu is enabled only when the node has a navigationLink; clicking it navigates to the target graphic or opens the URL

## Assessment

After checking:
- **Status**: ❌ Missing — `DesignerCanvas.tsx:5311` has `/* TODO: open Navigation Link dialog */`. No dialog component exists in `frontend/src/pages/designer/components/` for navigation links.

## Fix Instructions

**1. Create a new dialog component** `frontend/src/pages/designer/components/NavigationLinkDialog.tsx`:

```tsx
interface NavigationLinkDialogProps {
  nodeId: NodeId
  currentLink: NavigationLink | undefined
  onClose: () => void
  onConfirm: (link: NavigationLink | undefined) => void
}
```

The dialog should:
- Show a radio group: "Link to Graphic" | "Link to URL" | "No Link" (to clear)
- When "Link to Graphic" is selected: fetch `/api/v1/graphics` and show a searchable list
- When "Link to URL" is selected: show a text input for the URL
- Show an "Open in new tab" checkbox (for both modes)
- Confirm button fires `onConfirm` with the new NavigationLink value

**2. Wire the dialog** in `DesignerCanvas.tsx`:
- Add state: `const [navLinkNodeId, setNavLinkNodeId] = useState<NodeId | null>(null)`
- Replace the TODO at line 5311 with: `setNavLinkNodeId(nodeId)`
- Render the dialog conditionally, calling `executeCmd(new ChangePropertyCommand(nodeId, 'navigationLink', newLink, oldLink))` on confirm

**3. Wire the "Navigate" item** (line 5326–5334) to:
```tsx
onSelect={() => {
  if (!targetNode?.navigationLink) return
  const link = targetNode.navigationLink
  if (link.targetGraphicId) {
    navigate(`/designer/graphics/${link.targetGraphicId}/edit`)
  } else if (link.targetUrl) {
    link.openInNewTab ? window.open(link.targetUrl, '_blank') : navigate(link.targetUrl)
  }
}}
```

Do NOT:
- Use an inline text input inside the context menu as the link entry UX — it must be a full dialog
- Allow saving a link without either a targetGraphicId or a targetUrl (one is required)
