# Designer Autosave / Crash-Recovery — Implementation Phases

Read this file and execute the section matching the requested phase letter.

---

## Phase A — Fix Discard Cleanup Bugs

> **STATUS: COMPLETE** — delivered in the session that produced this file.
> Kept here for reference only.

What was done:
- Added `cleanupAutosave(autosaveIdHint, idbKey)` helper at ~line 1035 of index.tsx.
  Deletes the server `__autosave_*` row (hard delete via `graphicsApi.remove`) and the
  IDB record. Idempotent — server 404 and IDB missing-key are both swallowed.
- Crash-recovery dialog Discard now calls `cleanupAutosave` (was IDB-only).
- TabClosePrompt Discard now calls `cleanupAutosave` for both active and inactive tabs.
- `handleTabPromptSave` success path now calls `cleanupAutosave` so a real save never
  leaves a stale autosave row that would trigger a false recovery dialog on next open.

---

## Phase B1 — Preview Tab: Data Model + Open Flow

Read this section and implement it completely before stopping.

### Background

The designer (`frontend/src/pages/designer/index.tsx`, ~3400 lines after Phase A) has a
crash-recovery dialog that appears on mount when an `__autosave_*` row exists for the
current graphic. The dialog has three buttons: Recover, Discard, Preview.

Currently "Preview" sets `showCrashPreview(true)` which opens an in-page split-view
overlay comparing the server version (left) vs the autosaved version (right). This is
being replaced with a proper designer tab so the user can interact with the recovered
content, save it, or close it.

Phase A is complete (Discard bugs fixed, `cleanupAutosave` helper exists).

### What to build

**1. Extend `DesignerTab` in `frontend/src/store/designer/tabStore.ts`**

Add four optional fields to the `DesignerTab` interface after the existing `groupName`
field:

```ts
  /** True when this tab holds recovered autosave content (not yet saved). */
  isPreview?: boolean;
  /** The canonical graphic's real server UUID — target for Save from preview tab. */
  previewSourceId?: string;
  /** The __autosave_* server row UUID — deleted when user saves or discards. */
  previewAutosaveId?: string;
  /** The IDB key for this recovery record (graphicId or "__new__"). */
  previewIdbKey?: string;
```

Add a new action to the `TabStore` interface:

```ts
  /** Stamp a tab as a preview tab and record its autosave metadata. */
  setTabPreviewMeta(tabId: string, meta: {
    previewSourceId?: string;
    previewAutosaveId?: string;
    previewIdbKey?: string;
  }): void;
```

Implement it in the store (find the other action implementations — they follow a simple
`set(state => ...)` pattern):

```ts
setTabPreviewMeta: (tabId, meta) =>
  set((state) => ({
    tabs: state.tabs.map((t) =>
      t.id === tabId ? { ...t, isPreview: true, ...meta } : t,
    ),
  })),
```

Also add a `clearTabPreviewMeta` action (used in Phase B2):

```ts
  /** Clear the preview flag and metadata (called after a successful save). */
  clearTabPreviewMeta(tabId: string): void;
```

```ts
clearTabPreviewMeta: (tabId) =>
  set((state) => ({
    tabs: state.tabs.map((t) =>
      t.id === tabId
        ? {
            ...t,
            isPreview: false,
            previewSourceId: undefined,
            previewAutosaveId: undefined,
            previewIdbKey: undefined,
          }
        : t,
    ),
  })),
```

**2. Wire the new actions in `index.tsx`**

The designer binds tab store actions via destructuring near the top. Add alongside the
other `useTabStore` bindings:

```ts
const tabStoreSetPreviewMeta = useTabStore((s) => s.setTabPreviewMeta);
const tabStoreClearPreviewMeta = useTabStore((s) => s.clearTabPreviewMeta);
```

**3. Add `openRecoveryPreviewTab` callback in `index.tsx`**

Add this `useCallback` after the `cleanupAutosave` helper (around line 1090 after Phase A):

```ts
const openRecoveryPreviewTab = useCallback(
  (recovery: {
    id: string;
    savedAt: number;
    savedDoc: unknown;
    autosaveId: string | null;
    historyDocs: GraphicDocument[];
  }) => {
    const savedDoc = recovery.savedDoc as GraphicDocument;
    const originalName = savedDoc?.name ?? "Untitled";
    const previewTabId = "preview-" + crypto.randomUUID();

    // Open tab (reuses existing open-tab machinery)
    tabStoreOpenTab(previewTabId, "Preview — " + originalName);
    tabStoreSetPreviewMeta(previewTabId, {
      previewSourceId: graphicId ?? undefined,
      previewAutosaveId: recovery.autosaveId ?? undefined,
      previewIdbKey: recovery.id,
    });

    // Load recovered doc directly into scene store (no server fetch)
    useSceneStore.setState({
      doc: savedDoc,
      graphicId: null,
      isDirty: true,
      designMode: savedDoc.metadata?.designMode ?? "graphic",
      version: 0,
    });

    // Restore undo history
    historyRestoreFromSnapshots(recovery.historyDocs, savedDoc);

    // Mark dirty so the star indicator appears
    useSceneStore.getState()._setDoc(savedDoc, true);

    // Pre-load any shapes referenced in the recovered doc
    const recShapeIds: string[] = [];
    const walkShapes = (nodes: SceneNode[]) => {
      for (const n of nodes) {
        if (n.type === "symbol_instance") {
          recShapeIds.push((n as SymbolInstance).shapeRef.shapeId);
        }
        if ("children" in n && Array.isArray((n as { children?: unknown[] }).children)) {
          walkShapes((n as { children: SceneNode[] }).children);
        }
      }
    };
    walkShapes(savedDoc.children ?? []);
    if (recShapeIds.length > 0) {
      void useLibraryStore.getState().loadShapes(recShapeIds);
    }
  },
  [graphicId, tabStoreOpenTab, tabStoreSetPreviewMeta, historyRestoreFromSnapshots],
);
```

Note: `tabStoreOpenTab` already exists in the component's bindings. Check the existing
binding name — search for `tabStoreOpenTab` to confirm.

**4. Wire the Preview button in the crash-recovery dialog**

Find the Preview button (search for `setShowCrashPreview(true)` — there is exactly one).
Replace the entire `onClick` handler:

```ts
onClick={() => {
  openRecoveryPreviewTab(crashRecovery);
  setCrashRecovery(null);
}}
```

**5. Remove the split-view overlay**

Search for `showCrashPreview` across `index.tsx`. There are:
- One `useState` declaration: `const [showCrashPreview, setShowCrashPreview] = useState(false);`
- One close-preview button: `onClick={() => setShowCrashPreview(false)}`
- One large JSX block: `{crashRecovery && showCrashPreview && (() => { ... })()}`

Delete all three. The JSX block is approximately 110 lines — it starts with
`{/* Crash recovery split-view preview overlay` and ends with the matching `})()}`.

**6. Verify**

```bash
cd frontend && pnpm tsc --noEmit
```

Must be clean. Stop here — Phase B2 handles the banner, save confirmation, and
tab-close cleanup routing.

---

## Phase B2 — Preview Tab: Banner + Save + Close Behaviors

Read this section and implement it completely. Phase B1 must already be done.

### Background

Phase B1 added `isPreview`, `previewSourceId`, `previewAutosaveId`, `previewIdbKey` to
`DesignerTab` and wired the crash-recovery Preview button to open a new tab containing
the recovered content. The tab is marked `isModified: true` and `isPreview: true` from
birth. Phase B2 adds the user-facing behaviors for that tab.

### What to build

**1. Recovery banner**

In `index.tsx`, find the pessimistic lock banner (search for `lockState &&` — it renders
a strip at the top of the canvas area). Add a second banner immediately after it (or
immediately before it — either works) that renders when the active tab is a preview tab.

`activeTab` is already computed in the component:
```ts
const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId) ?? null);
```

Banner JSX:

```tsx
{activeTab?.isPreview && (
  <div
    style={{
      background: "color-mix(in srgb, var(--io-accent) 12%, transparent)",
      borderBottom: "1px solid color-mix(in srgb, var(--io-accent) 40%, transparent)",
      padding: "6px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontSize: 12,
      color: "var(--io-text-primary)",
      flexShrink: 0,
    }}
  >
    <span style={{ color: "var(--io-accent)", fontWeight: 600 }}>
      Recovered changes
    </span>
    <span style={{ color: "var(--io-text-secondary)" }}>
      Click Save to overwrite the current version, or rename then Save As to keep both.
    </span>
  </div>
)}
```

**2. Save confirmation state**

Add a state variable near the other dialog state variables:

```ts
const [showPreviewSaveConfirm, setShowPreviewSaveConfirm] = useState(false);
```

**3. Intercept Save in preview tabs**

In `handleSave` (the main save callback), find the very beginning of the function body
(just after `if (isSaving) return;`). Add an early-out that gates preview tabs behind
a confirmation dialog instead of running the normal save flow:

```ts
// Preview tabs require explicit confirmation before overwriting the canonical graphic
if (useTabStore.getState().tabs.find(
  (t) => t.id === useTabStore.getState().activeTabId
)?.isPreview) {
  setShowPreviewSaveConfirm(true);
  return;
}
```

**4. Confirmation dialog JSX**

Add a `ConfirmDialog` in the JSX (it is already imported). Place it alongside the other
`ConfirmDialog` instances (search for `showDeleteConfirm`):

```tsx
<ConfirmDialog
  open={showPreviewSaveConfirm}
  onOpenChange={setShowPreviewSaveConfirm}
  title="Overwrite saved version?"
  description={`This will replace the current saved version of "${activeTab?.graphicName?.replace(/^Preview — /, "") ?? "this graphic"}" with your recovered changes. This cannot be undone.`}
  confirmLabel="Overwrite"
  variant="danger"
  onConfirm={handlePreviewSaveConfirmed}
/>
```

**5. `handlePreviewSaveConfirmed` callback**

Add this callback (as `useCallback`). It runs the actual save after the user confirms.

```ts
const handlePreviewSaveConfirmed = useCallback(async () => {
  setShowPreviewSaveConfirm(false);
  const currentActiveTab = useTabStore.getState().tabs.find(
    (t) => t.id === useTabStore.getState().activeTabId,
  );
  if (!currentActiveTab?.isPreview || !currentActiveTab.previewSourceId) return;

  const doc = useSceneStore.getState().doc;
  if (!doc) return;

  setIsSaving(true);
  try {
    const result = await graphicsApi.update(currentActiveTab.previewSourceId, {
      name: doc.name ?? "Untitled",
      scene_data: doc,
    });
    if (result.success) {
      // Clean up the autosave now that the real graphic is updated
      void cleanupAutosave(
        currentActiveTab.previewAutosaveId ?? null,
        currentActiveTab.previewIdbKey ?? "",
      );
      // Promote the preview tab to a normal edit tab
      tabStoreClearPreviewMeta(currentActiveTab.id);
      tabStoreSetGraphicId(
        currentActiveTab.id,
        currentActiveTab.previewSourceId,
        doc.name ?? "Untitled",
      );
      markClean();
      historyMarkClean();
      showToast({ title: "Graphic saved", variant: "success", duration: 3000 });
      navigate(`/designer/graphics/${currentActiveTab.previewSourceId}/edit`);
    } else {
      showToast({ title: "Save failed", variant: "error" });
    }
  } catch {
    showToast({ title: "Save failed", variant: "error" });
  } finally {
    setIsSaving(false);
  }
}, [
  cleanupAutosave,
  tabStoreClearPreviewMeta,
  tabStoreSetGraphicId,
  markClean,
  historyMarkClean,
  navigate,
]);
```

Check that `tabStoreClearPreviewMeta` is bound from the store (added in Phase B1). Also
check the existing name for `tabStoreSetGraphicId` — search for `tabStoreSetGraphicId`
to confirm the binding name used in the component.

**6. Fix TabClosePrompt Discard routing for preview tabs**

The Phase A fix wires cleanup into the TabClosePrompt Discard handler but uses
`discardTab.graphicId` as the IDB key. For preview tabs the IDB key is `previewIdbKey`,
not `graphicId`.

Find the TabClosePrompt `onDiscard` handler (search for `discardTab.isPreview` — if
Phase B1 didn't add this yet, it won't exist; search for `void cleanupAutosave` in the
onDiscard block instead). Replace the cleanup call:

```ts
const idbKey = discardTab.isPreview
  ? (discardTab.previewIdbKey ?? discardTab.graphicId)
  : discardTab.graphicId;
const autosaveHint = discardTab.isPreview
  ? (discardTab.previewAutosaveId ?? null)
  : (isActive ? autoSaveIdRef.current : null);
void cleanupAutosave(autosaveHint, idbKey);
```

**7. Verify and smoke-test**

```bash
cd frontend && pnpm tsc --noEmit
```

Then manual test (assumes dev stack is running — `./dev.sh start` if not):

1. Open a graphic, wait 30 s for the autosave interval to fire.
2. Hard-reload the page (Ctrl+Shift+R).
3. Crash-recovery dialog appears → click **Preview**.
4. A new tab opens titled "Preview — <name>" with a star and the amber banner.
5. Make a small edit. Click **Save** → confirmation dialog appears → click **Overwrite**.
6. Tab becomes a normal edit tab; banner is gone; no orphan rows:
   ```
   psql postgresql://io:io_password@localhost:5432/io_dev \
     -c "SELECT name FROM design_objects WHERE name LIKE '__autosave_%';"
   ```
   Result should be empty (or contain only rows from other live sessions).
7. Repeat steps 1–3 but close the preview tab → **Discard** in TabClosePrompt → same
   DB check → no orphan rows.
