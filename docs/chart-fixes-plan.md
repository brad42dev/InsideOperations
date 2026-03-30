# Chart System Fixes Plan
**Created:** 2026-03-30
**Status:** IN PROGRESS

## HOW TO RESUME
1. Read this file: `/home/io/io-dev/io/docs/chart-fixes-plan.md`
2. Find the first item that is NOT marked `[DONE]`
3. Continue from there
4. Mark each item `[DONE]` as completed

---

## Phase 1 — Critical Bug Fixes

### 1.1 chart07-kpi-card: setInterval cleared on every liveValue update [DONE]
**File:** `frontend/src/shared/components/charts/renderers/chart07-kpi-card.tsx`
**Problem:** useEffect dep is `[liveValue]` so cleanup runs on every WS tick, killing the interval before it fires. Trend arrow always wrong.
**Fix:** Move interval to a separate useEffect with `[]` dep. Read current value via ref inside the callback — do NOT close over liveValue.
**Pattern:**
```
const liveValueRef = useRef(liveValue)
useEffect(() => { liveValueRef.current = liveValue }, [liveValue])

useEffect(() => {
  const snapshot = liveValueRef.current
  const timer = setInterval(() => {
    setBaseline(liveValueRef.current)  // or compare to snapshot
  }, 5 * 60_000)
  return () => clearInterval(timer)
}, [])  // mount once
```

### 1.2 chart31-probability-plot: Plotly async cleanup race condition [DONE]
**File:** `frontend/src/shared/components/charts/renderers/chart31-probability-plot.tsx`
**Problem:** cleanup fn does async import then purge — component may be unmounted before import resolves.
**Fix:** `let cancelled = false` guard. Check before calling newPlot and purge. Null-guard plotDivRef.current.

### 1.3 chart34-surface3d: Plotly async cleanup race condition [DONE]
**File:** `frontend/src/shared/components/charts/renderers/chart34-surface3d.tsx`
**Problem:** Same as 1.2.
**Fix:** Same pattern — `cancelled` guard + null check.

### 1.4 list_stale_points: silent i64→i32 truncating cast [DONE]
**File:** `services/api-gateway/src/handlers/points.rs`
**Problem:** `threshold as i32` silently wraps on overflow.
**Fix:** `let threshold_i32 = threshold.min(i64::from(i32::MAX)) as i32;`

---

## Phase 2 — Important Fixes

### 2.1 useTimeSeriesBuffer: module-scope buffer memory leak [DONE]
**File:** `frontend/src/shared/components/charts/hooks/useTimeSeriesBuffer.ts`
**Problem:** `_globalBuffers` and `_globalLastTs` module Maps grow forever — no cleanup on pane unmount.
**Fix:** Add useEffect cleanup that deletes the pane's key from both maps on unmount.

### 2.2 chart08-gauge: threshold color fraction formula wrong for absolute values [DONE]
**File:** `frontend/src/shared/components/charts/renderers/chart08-gauge.tsx`
**Problem:** Formula `t.value * range / range = t.value` is accidentally correct only for fraction-based thresholds. Breaks for absolute values.
**Fix:** Change formula to `(t.value - min) / range` — correct for absolute thresholds. Update DEFAULT_THRESHOLDS to use absolute-looking values or clarify with comment.

### 2.3 chart24-shewhart: population std dev instead of sample std dev [DONE]
**File:** `frontend/src/shared/components/charts/renderers/chart24-shewhart.tsx`
**Problem:** `math.std(vals, 'uncorrected')` uses N denominator. SPC requires N-1 (sample std dev).
**Fix:** Change to `math.std(vals)` — mathjs default is sample std dev (N-1).

### 2.4 StalePointsWidget: raw float display [DONE]
**File:** `frontend/src/pages/dashboards/widgets/StalePointsWidget.tsx`
**Problem:** Displays "47.38200001m" instead of "47m".
**Fix:** `{Math.round(pt.minutes_stale ?? 0)}m`

### 2.5 startISO at render time causes constant TanStack Query refetches [DONE]
**Files:**
- `frontend/src/shared/components/charts/renderers/chart24-shewhart.tsx`
- `frontend/src/shared/components/charts/renderers/chart29-cusum.tsx`
- `frontend/src/shared/components/charts/renderers/chart30-ewma.tsx`
- `frontend/src/shared/components/charts/renderers/chart31-probability-plot.tsx`
- `frontend/src/shared/components/charts/renderers/chart34-surface3d.tsx`
**Problem:** `new Date(Date.now() - ...).toISOString()` computed fresh each render → unstable query key → constant refetches, defeats staleTime.
**Fix:** Truncate to nearest minute: `const startISO = new Date(Math.floor((Date.now() - durationMs) / 60_000) * 60_000).toISOString()`

### 2.6 ChartConfigPanel: point picker capped at 2000 [DONE]
**File:** `frontend/src/shared/components/charts/ChartConfigPanel.tsx`
**Problem:** `pointsApi.list({ limit: 2000 })` silently cuts off large deployments (10k+ points expected).
**Fix:** Add search input to ChartPointSelector that queries `GET /api/points?q=<search>&limit=100` on keystroke. Show "type to search" placeholder instead of pre-loading all points.

---

## Phase 3 — Minor Fixes

### 3.1 CHART_COLORS duplicate #EF4444 [DONE]
**File:** `frontend/src/shared/components/charts/chart-config-types.ts`
**Problem:** `#EF4444` (red) appears at index 3 AND index 11.
**Fix:** Replace index 11 with `#F43F5E` (rose).

### 3.2 Stale "34 chart types" comments [DONE]
**Files:**
- `frontend/src/shared/components/charts/chart-config-types.ts` line 2
- `frontend/src/shared/components/charts/ChartRenderer.tsx` line 3
- `frontend/src/shared/components/charts/ChartTypePicker.tsx` line 2
**Fix:** Update to "39 chart types".

### 3.3 Misleading AlarmHistoryFilter comment [DONE]
**File:** `services/event-service/src/handlers/alarms.rs`
**Problem:** Comment incorrectly explains why i64 is used.
**Fix:** Replace with accurate comment.

---

## Phase 4 — Build + Verify

### 4.1 TypeScript build clean [DONE]
Run: `cd frontend && pnpm tsc --noEmit`

### 4.2 Rust build clean [DONE]
Run: `BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p io-api-gateway -p io-event-service`

### 4.3 Commit and snapshot [DONE]
Commit message: "fix: chart system bug fixes from deep-dive review"
Snapshot: "POINTS 27% COMPLETE"

