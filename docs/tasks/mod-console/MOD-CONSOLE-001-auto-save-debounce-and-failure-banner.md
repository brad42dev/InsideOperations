---
id: MOD-CONSOLE-001
title: Implement auto-save debounce, exponential backoff retry, and persistent failure banner
unit: MOD-CONSOLE
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Every workspace layout change should trigger an auto-save that is debounced 2 seconds (coalescing rapid edits into a single save). If the save fails, the system should retry with exponential backoff (1s, 2s, 4s). After 3 consecutive failures, a persistent warning banner appears at the top of the workspace area. The banner cannot be dismissed and includes a "Save now" manual retry button. Currently, saves fire immediately on every change with no debounce, and failure is silently swallowed.

## Spec Excerpt (verbatim)

> Every layout change (pane add/remove/resize/swap, template switch, content assignment) triggers a debounced save. Debounce period: 2 seconds after last change. Save target: `PUT /api/workspaces/:id`. On save failure (network error): retry with exponential backoff (1s, 2s, 4s). After 3 failures, show persistent error banner: "Workspace changes not saved. Retry?" Visual indicator: small dot on Save button when dirty, clears on successful save.
> — console-implementation-spec.md, §3.5

> Auto-save failure shows a persistent warning banner (not a toast that dismisses). The banner includes a manual "Save now" button. Silently failing or showing a dismissible toast is wrong.
> — docs/SPEC_MANIFEST.md, MOD-CONSOLE non-negotiable #12

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/index.tsx` — lines 252–288: `saveMutation` definition (no `onError`) and `persistWorkspace` (no debounce)
- `frontend/src/pages/console/index.tsx` — lines 276–288: `persistWorkspace` callback called synchronously on every change

## Verification Checklist

- [ ] `persistWorkspace` uses a `useRef`-based debounce timer with 2-second delay (i.e., only the last call within 2s fires)
- [ ] `saveMutation.onError` handler exists and triggers retry logic
- [ ] After 3 consecutive failures, a persistent banner renders (not a toast) with "Workspace changes not saved" text
- [ ] Banner includes a "Save now" button that manually triggers a retry
- [ ] Banner does not auto-dismiss (persists until a successful save)
- [ ] A dirty indicator (dot/asterisk) appears while the debounce is pending or a save is in-flight

## Assessment

- **Status**: ❌ Missing
- `saveMutation` at `index.tsx:252` has no `onError` handler.
- `persistWorkspace` at `index.tsx:276` calls `saveMutation.mutate(ws)` synchronously — no debounce.
- No failure banner UI anywhere in `index.tsx`.

## Fix Instructions

**Step 1 — Add debounce ref at the top of ConsolePage component** (around line 320, near other refs):
```typescript
const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const failureCountRef = useRef(0)
const [saveFailed, setSaveFailed] = useState(false)
```

**Step 2 — Replace `persistWorkspace` with a debounced version:**
```typescript
const persistWorkspace = useCallback(
  (ws: WorkspaceLayout) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (useApi) {
        saveMutation.mutate(ws)
      } else {
        const current = useWorkspaceStore.getState().workspaces
        const exists = current.find((w) => w.id === ws.id)
        const updated = exists ? current.map((w) => (w.id === ws.id ? ws : w)) : [...current, ws]
        saveWorkspacesLocal(updated)
      }
    }, 2000)
  },
  [useApi, saveMutation],
)
```

**Step 3 — Add retry logic to `saveMutation`:**
```typescript
const saveMutation = useMutation({
  mutationFn: (ws: WorkspaceLayout) => consoleApi.saveWorkspace(ws),
  onSuccess: () => {
    failureCountRef.current = 0
    setSaveFailed(false)
    void queryClient.invalidateQueries({ queryKey: ['console-workspaces'] })
  },
  onError: (_err, ws) => {
    failureCountRef.current += 1
    if (failureCountRef.current >= 3) {
      setSaveFailed(true)
    } else {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, failureCountRef.current - 1) * 1000
      setTimeout(() => saveMutation.mutate(ws), delay)
    }
  },
})
```

**Step 4 — Add the failure banner in the render, above the workspace area** (around line 1135, inside the workspace column div):
```tsx
{saveFailed && (
  <div style={{
    flexShrink: 0,
    padding: '8px 14px',
    background: '#7F1D1D',
    color: '#FEF2F2',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  }}>
    <span>Workspace changes not saved. Check your connection.</span>
    <button
      onClick={() => {
        failureCountRef.current = 0
        const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
        if (ws) saveMutation.mutate(ws)
      }}
      style={{ background: '#FEF2F2', color: '#7F1D1D', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
    >
      Save now
    </button>
  </div>
)}
```

Do NOT:
- Use a toast for the failure notification (spec explicitly requires a persistent banner)
- Auto-dismiss the banner on a successful timeout (only clear on `onSuccess`)
- Remove the `saveMutation.mutate(ws)` calls elsewhere — only wrap them in the debounced helper
