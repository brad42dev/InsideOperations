---
unit: GFX-DISPLAY
audited: 2026-03-21
relationship: OVERHAUL
spec-files:
  - /home/io/spec_docs/display-elements-implementation-spec.md
  - /home/io/io-dev/io/design-docs/19_GRAPHICS_SYSTEM.md (gap-fill only)
result: ⚠️ Gaps found
tasks-generated: 6
---

## Summary

All 6 display element types are present and render as `<g>` SVG elements inside the canvas layer. Core geometry, typography, and alarm priority colors are correct. Six gaps were found: (1) zone alarm replacement on the analog bar is missing — zone fills do not switch to ISA alarm priority colors when a value enters an alarmed zone; (2) vessel-interior fill gauge clip path uses a simple rect instead of the actual vessel geometry path; (3) quality state handling is incomplete in the real-time DOM mutation path (uncertain, manual badge, stale dashed-border, comm_fail border color all missing or wrong); (4) alarm flash text animation is missing for priorities P2–P5 (only P1 has a separate fill keyframe); (5) signal line is only implemented for `analog_bar` — missing for `text_readout`, `fill_gauge`, `sparkline`, and `digital_status`; (6) all colors are hardcoded hex in JS rather than CSS custom property references, violating the token-based color system non-negotiable.

## Non-Negotiables

| # | Non-Negotiable | Status | Evidence |
|---|---------------|--------|----------|
| 1 | Display elements are SVG `<g>` elements, not HTML `<div>` overlay | ✅ | SceneRenderer.tsx:505, 530, 546, 574, 639, 684 — all render as `<g>` inside SVG layer |
| 2 | 6 types exactly: `text_readout`, `analog_bar`, `fill_gauge`, `sparkline`, `alarm_indicator`, `digital_status` | ✅ | displayElements/index.ts:1–6 exports all 6; SceneRenderer.tsx:474 switch handles all 6; NumericIndicator.tsx correctly removed |
| 3 | Color system is token-based, no invented colors | ⚠️ Wrong | All colors hardcoded as hex literals (e.g. `'#27272A'`, `'#EF4444'`, `'#A1A1AA'`) in SceneRenderer.tsx:18–21, TextReadout.tsx:18–20, AnalogBar.tsx:17–20, AlarmIndicator.tsx:18–19, etc. No CSS var references |
| 4 | Analog bar 5-zone warm-to-cool ramp; zone color REPLACED by ISA alarm priority when zone is in alarm | ⚠️ Wrong | Zone fills correctly use muted ramp (SceneRenderer.tsx:567–572) but zone fill is never replaced by alarm priority color when alarm fires. Only the pointer fill changes (SceneRenderer.tsx:581). The per-threshold alarm activation described in spec §Analog Bar Layer 2 is not implemented |
| 5 | Alarm indicator shapes ISA-18.2: P1=rect 24×18 rx=2, P2=triangle up, P3=triangle down, P4=ellipse rx=14/ry=10, Custom=diamond | ✅ | AlarmIndicator.tsx:42–58 — all 5 shapes with correct dimensions and stroke-only rendering |
| 6 | 1Hz flash = CSS animation (steps(1)), not JS setInterval | ✅ | alarmFlash.css:1–31 — `animation: ... 1s steps(1) infinite` |
| 7 | Signal line — dashed SVG `<line>` when `cfg.showSignalLine`, connects element to parent | ⚠️ Partial | Signal line implemented only for `analog_bar` (SceneRenderer.tsx:599–613). Not implemented for `text_readout`, `fill_gauge`, `sparkline`, or `digital_status` |
| 8 | Quality states — all 6 produce specific rendered output | ⚠️ Wrong | See detail below |
| 9 | Analog bar pointer = filled triangle + crossing tick line (both present) | ✅ | SceneRenderer.tsx:580–583 — `<polygon>` + `<line>` both rendered |

### Quality State Detail (Non-Negotiable 8)

| Quality State | React Render | DOM Mutation Path | Status |
|---|---|---|---|
| `good` | Normal rendering | Normal rendering | ✅ |
| `bad` | `????` value, red (#EF4444) dashed border | `????` value, red stroke set but `strokeDasharray` NOT set | ⚠️ DOM path missing dashed border |
| `comm_fail` | "COMM" text, fill `#3F3F46` but stroke stays `#3F3F46` (spec requires `#52525B` border) | "COMM" text, incorrect stroke color | ⚠️ Wrong border color in both paths |
| `stale` | 60% opacity + dashed border | Opacity set (line 1023), `strokeDasharray` NOT set on box rect | ⚠️ DOM path missing dashed border |
| `uncertain` | Dotted border `'2 2'` via `strokeDotted` (line 496) | `quality` not checked at all in `applyPointValue` for `text_readout` | ⚠️ DOM path no-op |
| `manual` | Cyan "M" badge (line 512–514) | `pv.manual` not available in `applyPointValue` signature — badge cannot be added/removed | ⚠️ DOM path no-op |

## False-DONE Patterns

| Pattern | Present? | Evidence |
|---------|----------|----------|
| Analog bar uses alarm priority colors instead of muted warm-to-cool ramp | ✅ Not present | Zone fills use `#5C3A3A`/`#5C4A32`/`#404048`/`#32445C`/`#2E3A5C` (AnalogBar.tsx:20) |
| Analog bar pointer rendered as circle or line instead of filled triangle + crossing tick | ✅ Not present | SceneRenderer.tsx:581–582 — polygon + line both present |
| Alarm indicator uses generic colored circles instead of ISA-18.2 shapes | ✅ Not present | AlarmIndicator.tsx:42–58 — all 5 ISA shapes correctly implemented |
| Flash animation uses JS timer instead of CSS animation | ✅ Not present | alarmFlash.css uses `@keyframes` + `steps(1)` |
| Quality states only handle `good` and `bad` | ⚠️ Partial | `comm_fail`, `stale`, `uncertain`, `manual` present in React render but DOM mutation path incomplete |
| `stale` just changes border color instead of reducing opacity to 60% | ✅ Not present | SceneRenderer.tsx:495 `opacity = isStale ? 0.6 : node.opacity` |
| Colors hardcoded hex instead of CSS token references | ⚠️ Found | All color values throughout SceneRenderer.tsx, TextReadout.tsx, AnalogBar.tsx, AlarmIndicator.tsx, FillGauge.tsx, Sparkline.tsx, DigitalStatus.tsx are JS string literals not `var(--io-*)` references |

## Wave 0 Contract Gaps

GFX-DISPLAY is a Wave 1 rendering unit (not a user-facing module). The applicable Wave 0 contracts are limited to CX-TOKENS (which applies to ALL frontend code). The others (CX-EXPORT, CX-POINT-CONTEXT, CX-RBAC, CX-ERROR, CX-LOADING, CX-EMPTY, CX-PLAYBACK, CX-KIOSK) apply to module-level UI that GFX-DISPLAY does not own — these will be checked in MOD-CONSOLE, MOD-PROCESS, and MOD-DESIGNER audits.

| Contract | Check | Status | Evidence |
|----------|-------|--------|----------|
| CX-TOKENS | All colors reference CSS custom properties | ⚠️ Wrong | See GFX-DISPLAY-006 — hardcoded hex throughout all display element files |

## Findings Summary

- [GFX-DISPLAY-001] Analog bar zone alarm replacement not implemented — zone fills never switch to ISA alarm priority color when alarm fires in that zone — SceneRenderer.tsx:566–576
- [GFX-DISPLAY-002] Fill gauge vessel-overlay mode uses rect clipPath instead of vessel geometry path — SceneRenderer.tsx:668–671
- [GFX-DISPLAY-003] Quality state DOM mutation path incomplete for text_readout — `uncertain`, `manual` badge, `stale` dashed border, `comm_fail` border color all wrong or missing in `applyPointValue` — SceneRenderer.tsx:1007–1025
- [GFX-DISPLAY-004] Alarm flash text animation missing for P2–P5 priorities — only P1 has `io-alarm-flash-critical-text` keyframe; P2–P5 `> *` selector animates stroke only, does not animate text fill — alarmFlash.css:26–31
- [GFX-DISPLAY-005] Signal line only implemented for analog_bar — missing for text_readout, fill_gauge, sparkline, digital_status — SceneRenderer.tsx:599–613
- [GFX-DISPLAY-006] All display element colors hardcoded as hex literals instead of CSS custom property references — violates token-based color system non-negotiable — TextReadout.tsx:18–20, AnalogBar.tsx:17–20, AlarmIndicator.tsx:18–19, FillGauge.tsx:19–21, Sparkline.tsx:11–13, DigitalStatus.tsx:10–12, SceneRenderer.tsx:489, 491–498
