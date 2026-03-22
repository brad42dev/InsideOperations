---
id: MOD-CONSOLE-001
title: Implement auto-save failure persistent banner with exponential backoff retry
unit: MOD-CONSOLE
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When the Console module fails to save a workspace to the server, it must retry automatically with exponential backoff. After 3 consecutive failures, it must show a persistent warning banner (not a dismissible toast) that stays visible until the user manually retries. The banner includes a "Save now" button. This ensures operators always know when their workspace layout is not being persisted.

## Spec Excerpt (verbatim)

> On save failure (network error): retry with exponential backoff (1s, 2s, 4s). After 3 failures, show persistent error banner: "Workspace changes not saved. Retry?"
> — console-implementation-spec.md, §3.5 Auto-Save

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/index.tsx` — lines 252-257: `saveMutation` has only `onSuccess`, no `onError`. No retry logic, no banner state.
- `frontend/src/pages/console/index.tsx` — lines 274-288: `persistWorkspace` calls `saveMutation.mutate(ws)` directly with no error handling.

## Verification Checklist

- [ ] `saveMutation` has an `onError` callback that increments a failure counter.
- [ ] After 3 failures, a persistent banner renders above or below the toolbar (never dismissed automatically).
- [ ] Banner text is "Workspace changes not saved. Retry?" and includes a "Save now" button.
- [ ] Retry uses exponential backoff: 1s delay, then 2s, then 4s before showing the banner.
- [ ] Successful save clears the failure counter and hides the banner.
- [ ] Banner does NOT auto-dismiss (it is not a toast).

## Assessment

- **Status**: ❌ Missing
- `saveMutation` at index.tsx:252 has only `onSuccess`. No `onError`, no failure counter, no banner. The spec-required persistent warning does not exist.

## Fix Instructions

In `frontend/src/pages/console/index.tsx`:

1. Add state for save failure tracking near line 320:
   ```typescript
   const [saveFailCount, setSaveFailCount] = useState(0)
   const [showSaveBanner, setShowSaveBanner] = useState(false)
   const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
   ```

2. Replace the `saveMutation` definition (lines 252-257) to add retry + banner logic:
   ```typescript
   const saveMutation = useMutation({
     mutationFn: (ws: WorkspaceLayout) => consoleApi.saveWorkspace(ws),
     onSuccess: () => {
       setSaveFailCount(0)
       setShowSaveBanner(false)
       void queryClient.invalidateQueries({ queryKey: ['console-workspaces'] })
     },
     onError: (_err, ws) => {
       setSaveFailCount(prev => {
         const next = prev + 1
         if (next >= 3) {
           setShowSaveBanner(true)
         } else {
           // Exponential backoff: 1s, 2s, 4s
           const delay = Math.pow(2, prev) * 1000
           if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
           retryTimerRef.current = setTimeout(() => {
             saveMutation.mutate(ws)
           }, delay)
         }
         return next
       })
     },
   })
   ```

3. Add the persistent banner in the JSX render, above the workspace toolbar (around line 980 where the toolbar header div begins):
   ```tsx
   {showSaveBanner && (
     <div style={{
       background: 'var(--io-alarm-high)',
       color: '#fff',
       padding: '6px 12px',
       fontSize: 13,
       display: 'flex',
       alignItems: 'center',
       gap: 12,
       flexShrink: 0,
     }}>
       <span>Workspace changes not saved.</span>
       <button
         onClick={() => {
           if (activeWorkspace) {
             setSaveFailCount(0)
             setShowSaveBanner(false)
             saveMutation.mutate(activeWorkspace)
           }
         }}
         style={{
           background: 'rgba(0,0,0,0.25)',
           border: '1px solid rgba(255,255,255,0.4)',
           borderRadius: 4,
           color: '#fff',
           padding: '2px 10px',
           cursor: 'pointer',
           fontSize: 12,
         }}
       >
         Retry
       </button>
     </div>
   )}
   ```

Do NOT:
- Use a toast component (the banner must persist until manually dismissed or save succeeds).
- Reset the failure counter on a workspace switch without also clearing the banner.
- Implement retry inside `persistWorkspace` — the retry must happen at the mutation level so the mutation `isError` state is also correct.
