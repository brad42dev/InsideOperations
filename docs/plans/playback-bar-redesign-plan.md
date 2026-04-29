# Playback Bar Redesign — Phased Implementation Plan

Three independently shippable phases.

---

## Background — current state

### Key files

| File | Role |
|------|------|
| `frontend/src/store/playback.ts` | Zustand store — `mode`, `timestamp`, `timeRange`, `isPlaying`, `isReversing`, `speed`, loop state |
| `frontend/src/shared/components/HistoricalPlaybackBar.tsx` | Shared bar component (1084 lines) used by both Console and Process |
| `frontend/src/pages/console/index.tsx` | Console module (3587 lines) |
| `frontend/src/pages/process/index.tsx` | Process module (2690 lines) |

### Current problems

- **Console top bar bug:** Clicking the Live button switches to historical mode but keeps the Live button highlighted green. There is no separate Historical button.
- **Process top bar:** Already correct — two distinct buttons `[● Live]` / `[◷ Historical]` that toggle correctly (lines 2329–2363).
- **Bottom bar (both modules):** Multi-element layout that expands to two rows, wastes space, puts Live/Historical mode switching inside the bar itself.

### `HistoricalPlaybackBar.tsx` structure

- Lines 86–94: dispatch between `TimeContextBar` (dashboards — **do not touch**) and `PlaybackBarInner`.
- Lines 448–1015: `PlaybackBarInner` — everything being redesigned.
  - Line 471: `stepIdx` local state.
  - Lines 475–487: alarm events fetch (React Query) — **keep**.
  - Lines 493–536: auto-advance timer effect — **keep**.
  - Lines 539–614: keyboard shortcut effect (Space, ←/→, Home, End, [, ], L) — **keep**.
  - Lines 616–643: live-mode early-return block (the broken "LIVE" button row) — **delete in Phase 1**.
  - Lines 659–1014: historical-mode JSX — **replace in Phase 2**.
- Lines 1021–1084: shared style constants.

### Current Console bar render (line 2936)

```tsx
{workspaces.length > 0 && <HistoricalPlaybackBar />}
```

Always renders in Console — needs to gate on historical mode.

### Process bar render (line 2602)

```tsx
{isHistorical && <HistoricalPlaybackBar />}
```

Already correct — no change needed.

---

## Desired end state

**Top bar (both modules):** Two distinct buttons — `[● Live]` and `[◷ Historical]`.
- Live active: green / `var(--io-accent)`, subtle background.
- Historical active: orange / `var(--io-warning)`, subtle background.
- Inactive: muted text, plain border.

**Bottom bar:** Only visible in historical mode.

**Compact layout (1 row, 40px):**
```
[▶/⏸] [From datetime] [────── scrub ~75% width ──────] [To datetime] [Speed ▾] [▲]
```

**Expanded layout (2 rows, 80px total) — after clicking ▲:**
```
Row 1: [▶/⏸] [──────────── wider scrub bar ────────────] [Speed ▾] [▼]
Row 2: [From datetime] [⏮] [◀◀] [▶/⏸] [⏭] [↺] [Step interval ▾] [step size] [To datetime]
```

- Expanded state: local `useState` in `PlaybackBarInner`, **not** persisted to the store.
- Alarm event ticks stay on the scrub bar in both modes.
- Keyboard shortcuts continue to work.

---

## Phase 1 — Fix Console top-bar Live/Historical toggle

**Goal:** Console gets two correct top-bar toggle buttons. The broken live-mode row in `HistoricalPlaybackBar` is deleted. Bar only shows in historical mode in Console.

### Changes

**`frontend/src/pages/console/index.tsx`**

1. **Add playback store access in the main page component** (not just in `ConsoleStatusBar`). Near the top of the Console component, add:
   ```ts
   const { mode: playbackMode, setMode: setPlaybackMode } = usePlaybackStore();
   const isHistorical = playbackMode === "historical";
   ```
   `usePlaybackStore` is already imported at line 26.

2. **Insert Live/Historical toggle in the right-side toolbar.** The right-side controls `<div>` starts around line 2030. Place the pair as the first item (before the workspace-conditional block), so it's always visible:
   ```tsx
   {/* Live / Historical toggle */}
   <button
     onClick={() => setPlaybackMode("live")}
     style={{
       padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "1px solid",
       background: !isHistorical ? "var(--io-accent-subtle)" : "transparent",
       color: !isHistorical ? "var(--io-accent)" : "var(--io-text-muted)",
       borderColor: !isHistorical ? "var(--io-accent)" : "var(--io-border)",
     }}
   >
     ● Live
   </button>
   <button
     onClick={() => setPlaybackMode("historical")}
     style={{
       padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "1px solid",
       background: isHistorical ? "var(--io-warning-subtle)" : "transparent",
       color: isHistorical ? "var(--io-warning)" : "var(--io-text-muted)",
       borderColor: isHistorical ? "var(--io-warning)" : "var(--io-border)",
     }}
   >
     ◷ Historical
   </button>
   <div style={{ width: 1, height: 18, background: "var(--io-border)", margin: "0 4px" }} />
   ```

3. **Gate the bottom bar on historical mode.** Change line 2936:
   ```tsx
   // Before:
   {workspaces.length > 0 && <HistoricalPlaybackBar />}
   // After:
   {workspaces.length > 0 && isHistorical && <HistoricalPlaybackBar />}
   ```

**`frontend/src/shared/components/HistoricalPlaybackBar.tsx`**

4. **Delete the live-mode early-return block** (lines 616–643). Since the bar is now only ever mounted in historical mode, this code is dead.

5. **Delete unused `liveButtonStyle`** (lines 1033–1045). `backLiveStyle` (lines 1047–1057) can also be deleted now since the back-to-live button at lines 662–668 is inside the live-mode block being deleted.

### Gotchas

- Process toolbar (lines 2329–2363): **no changes** — already correct. The live-mode branch deletion in `HistoricalPlaybackBar` is a no-op for Process because Process already gates the bar on `isHistorical`.
- Match Process's color semantics exactly: `var(--io-accent)` for Live (renders green), `var(--io-warning)` for Historical (renders orange). Don't introduce `var(--io-success)`.

### Verify after Phase 1

- `pnpm build` succeeds, no TypeScript errors.
- Console top toolbar shows `[● Live]` `[◷ Historical]`. Active state renders correctly for each mode.
- Clicking Historical in Console: button turns orange, bar appears below workspace. Clicking Live: button turns green/accent, bar disappears, playback resets.
- Process module: behavior unchanged.
- Keyboard shortcuts (Space, ←/→, Home, End, [, ], L) work in historical mode.
- Alarm event ticks still appear on the scrub slider.

---

## Phase 2 — Redesign `PlaybackBarInner` to compact single-row layout

**Goal:** Replace the multi-row historical-mode JSX (lines 659–1014) with one 40px row:
```
[▶/⏸] [From datetime] [────── scrub ~75% ──────] [To datetime] [Speed ▾] [▲]
```
Chevron toggles `expanded` state but the advanced row is not rendered yet (Phase 3).

### Changes

**`frontend/src/shared/components/HistoricalPlaybackBar.tsx`**

1. **Add `expanded` state** alongside `stepIdx` at line 471:
   ```ts
   const [expanded, setExpanded] = useState(false);
   ```

2. **Replace lines 659–1014** with a new single-row layout inside `<div style={barStyle}>`:

   ```tsx
   return (
     <div style={barStyle}>
       {/* Play/Pause */}
       <button
         style={{ ...iconBtnStyle, color: isPlaying && !isReversing ? "var(--io-accent)" : "var(--io-text-primary)" }}
         onClick={() => {
           if (isPlaying && !isReversing) {
             setPlaying(false);
           } else {
             setReversing(false);
             setPlaying(true);
           }
         }}
       >
         {isPlaying && !isReversing ? "⏸" : "▶"}
       </button>

       {/* From datetime */}
       <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
         <span style={labelStyle}>From</span>
         <input
           type="datetime-local"
           style={{ ...inputStyle, width: 150 }}
           value={toLocalDatetimeString(timeRange.start)}
           onChange={(e) => {
             const ms = new Date(e.target.value).getTime();
             if (!isNaN(ms)) setTimeRange({ ...timeRange, start: ms });
           }}
         />
       </div>

       {/* Scrub slider — flex:1 so it fills ~75%+ of the bar */}
       <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
         {/* ... port scrub slider + alarm ticks + loop handles from lines 805–985 verbatim ... */}
       </div>

       {/* To datetime */}
       <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
         <span style={labelStyle}>To</span>
         <input
           type="datetime-local"
           style={{ ...inputStyle, width: 150 }}
           value={toLocalDatetimeString(timeRange.end)}
           onChange={(e) => {
             const ms = new Date(e.target.value).getTime();
             if (!isNaN(ms)) setTimeRange({ ...timeRange, end: ms });
           }}
         />
       </div>

       {/* Speed */}
       {/* ... port speed select from lines 1001–1012 verbatim ... */}

       {/* Chevron expand */}
       <button
         style={iconBtnStyle}
         onClick={() => setExpanded((v) => !v)}
         title={expanded ? "Collapse advanced controls" : "Expand advanced controls"}
       >
         {expanded ? "▼" : "▲"}
       </button>
     </div>
   );
   ```

3. **Controls removed from compact view** (will appear in Phase 3 advanced row):
   - Step-back ⏮ (was lines 712–722)
   - Reverse ◀◀ (was lines 724–749)
   - Step-forward ⏭ (was lines 776–786)
   - Loop toggle ↺ (was lines 788–803)
   - Step interval `<select>` (was lines 698–710) — **keep `stepIdx` state**, just don't render the dropdown yet
   - Inline timestamp span (was lines 988–998) — dropped per spec
   - Back-to-live button (was lines 662–668) — already deleted in Phase 1

### Gotchas

- **Scrub slider structural integrity:** Alarm tick marks rely on z-index layering within the scrub container (`input[type=range]` + positioned overlay divs). Port lines 805–985 verbatim into the `flex:1` wrapper — don't restructure the inner HTML.
- **`stepIdx` must persist** even though the dropdown is hidden. Keyboard `Shift+←/→` uses the next-larger step from `STEP_OPTIONS[stepIdx]`. Default index (e.g. 4 = "1 minute") will be locked in compact mode; user can change it once they expand the bar.
- **`toLocalDatetimeString` helper** already exists in the file (check around lines 100–102 or the bottom utility section). Use it consistently for both From and To.
- **No `maxWidth` cap on the slider.** The old layout had a fixed `maxWidth: 300` on the slider wrapper. Remove that — `flex: 1` is what gives us the wide scrub bar.
- **Input width:** `width: 150` on datetime inputs prevents jitter as browser chrome varies by OS.

### Verify after Phase 2

- `pnpm build` succeeds.
- Historical mode: single 40px row shows Play/Pause, From picker, wide scrub, To picker, Speed, chevron ▲.
- Chevron click: flips glyph (▲ ↔ ▼), no other visible change yet.
- Scrub still drives `timestamp`. From/To still drive `timeRange`. Auto-advance/play/pause works.
- Keyboard shortcuts still work. Shift+Arrow uses stepIdx even though the dropdown is hidden.
- Alarm event ticks render on the scrub slider.
- Loop handles visible on scrub when loop bounds are set via `[`/`]`.

---

## Phase 3 — Advanced/expanded mode

**Goal:** When `expanded === true`, the bar renders a second row with full transport controls, step interval, step/bucket size, and datetime pickers at the ends.

```
Row 1: [▶/⏸] [──── wider scrub bar ────] [Speed ▾] [▼]
Row 2: [From datetime] [⏮] [◀◀] [▶/⏸] [⏭] [↺] [Step ▾] [bucket size] [To datetime]
```

### Changes

**`frontend/src/shared/components/HistoricalPlaybackBar.tsx`**

1. **Add `wrapperStyle` constant** (after `iconBtnStyle`):
   ```ts
   const wrapperStyle: React.CSSProperties = {
     display: "flex",
     flexDirection: "column",
     flexShrink: 0,
     background: "var(--io-surface)",
     borderTop: "1px solid var(--io-border)",
   };
   ```

2. **Refactor `PlaybackBarInner` return** — replace the single `<div style={barStyle}>` with:
   ```tsx
   return (
     <div style={wrapperStyle}>
       {/* Row 1: always visible */}
       <div style={{ ...barStyle, borderTop: "none" }}>
         {/* play/pause */}
         {!expanded && /* From datetime picker */}
         {/* scrub slider — flex:1 */}
         {!expanded && /* To datetime picker */}
         {/* speed select */}
         {/* chevron */}
       </div>

       {/* Row 2: only when expanded */}
       {expanded && (
         <div style={{ ...barStyle, borderTop: "1px solid var(--io-border)" }}>
           {/* From datetime picker */}
           {/* ⏮ step-back */}
           {/* ◀◀ reverse */}
           {/* ▶/⏸ play/pause (duplicate — same store, auto-syncs) */}
           {/* ⏭ step-forward */}
           {/* ↺ loop toggle */}
           {/* Step interval <select> */}
           {/* Step size readout */}
           <div style={{ flex: 1 }} />
           {/* To datetime picker */}
         </div>
       )}
     </div>
   );
   ```

3. **Port controls to row 2:**
   - **Step-back ⏮** (was lines 712–722): decrements `timestamp` by `STEP_OPTIONS[stepIdx].ms`.
   - **Reverse ◀◀** (was lines 724–749): sets `isReversing=true, isPlaying=true`.
   - **Play/pause** (identical to row 1): both buttons read/write the same Zustand fields, auto-sync.
   - **Step-forward ⏭** (was lines 776–786): increments `timestamp` by step.
   - **Loop toggle ↺** (was lines 788–803): calls `setLoopEnabled(!loopEnabled)`.
   - **Step interval `<select>`** (was lines 698–710): maps `STEP_OPTIONS`, updates `stepIdx`.
   - **Step size readout:** `<span style={labelStyle}>{STEP_OPTIONS[stepIdx].ms === 0 ? "next-change" : STEP_OPTIONS[stepIdx].label}</span>` — or just the label from `STEP_OPTIONS[stepIdx].label` if that's already human-readable.

4. **`barStyle` adjustment:** Keep existing definition unchanged. The wrapper div handles the outer border-top; set `borderTop: "none"` on row 1's `barStyle` override to avoid a double border.

### Gotchas

- **Two play/pause buttons auto-sync** via Zustand — no local state to maintain.
- **Scrub width in expanded mode:** Row 1 has no datetime pickers when `expanded`, so `flex:1` on the slider gives it almost the full bar width (~85%+).
- **Total bar height = 80px** when expanded. Workspace/viewport area shrinks by 40px — this is intentional and acceptable.
- **`expanded` resets on page reload** — local state, not persisted. Confirmed per spec.
- **Keyboard shortcuts work in both modes** — the `useEffect` keyboard handler at lines 539–614 doesn't depend on rendered controls.
- **Loop handles and alarm ticks** in row 1's scrub slider: same as Phase 2, unaffected.

### Verify after Phase 3

- `pnpm build` succeeds.
- Compact (default): Phase 2 layout preserved.
- Click ▲: bar grows to 2 rows, scrub in row 1 widens, full transport + step interval + pickers appear in row 2. Chevron shows ▼.
- Click ▼: collapses back to 1 row.
- Both play/pause buttons stay in sync.
- Keyboard shortcuts work in both modes.
- Step interval dropdown changes which interval `←/→` uses. Shift+`←/→` uses next-larger interval.
- Loop: `[`/`]` set bounds, `L` toggles, loop overlay + handles visible on scrub.
- Alarm ticks render in both modes.
- Reload: `expanded` resets to `false`.

---

## Execution notes

- Run `pnpm build` after each phase before moving on.
- Do **not** modify `TimeContextBar` (dashboard mode) — it is separate code inside the same file.
- Do **not** modify `frontend/src/store/playback.ts` — no new store fields needed.
- Process toolbar (lines 2329–2363 of process/index.tsx): already correct — **read-only** during this plan.
