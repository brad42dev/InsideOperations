# Phase 06b — Content Widgets: Clock and IFrame (chart52, chart54)

**Goal:** Implement chart52 (Clock / Elapsed Timer) and chart54 (IFrame / Embed). Neither hits the database; clock uses `setInterval`, iframe just renders a `<iframe>` with sandbox attributes.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phase 04 must be complete.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartRenderer.tsx` — chart52 / chart54 commented entries from Phase 00.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-defaults.ts` — defaults for 52 and 54 already defined.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-config-types.ts` — `CONTENT_WIDGET_IDS` includes 52 and 54.

## Context

- **chart52 — Clock / Elapsed Timer**:
  - `extras.mode: "clock" | "elapsed"`. Clock = current time (local or specified timezone). Elapsed = time since `points[0]`'s value (epoch ms).
  - `extras.format`: time format string (default `"HH:mm:ss"`).
  - `extras.timezone?`: optional IANA timezone (default = browser local).
  - For elapsed mode: `points[0]` is bound to a point whose **value** is an epoch-ms start timestamp. That's an unusual binding but the cleanest fit — let users wire any "event start time" point.

- **chart54 — IFrame / Embed**:
  - `extras.url: string`.
  - `extras.sandbox?: string` — defaults to `"allow-scripts allow-same-origin"`. Configurable so users can permit forms, popups, etc.
  - Rendered as `<iframe src={url} sandbox={sandbox}>`.
  - Production CSP `frame-src` directive must allow the embedded domain. We document this in code comments; the deployment owner configures CSP.

## Changes

### 1. Create `frontend/src/shared/components/charts/renderers/chart52-clock-timer.tsx`

```tsx
// ---------------------------------------------------------------------------
// Chart 52 — Clock / Elapsed Timer
// "clock" mode: current time, optional IANA timezone, configurable format.
// "elapsed" mode: time since points[0] value (interpreted as epoch ms).
// Updates every second via setInterval.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../../../hooks/useWebSocket";
import type { ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type Mode = "clock" | "elapsed";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatTime(ms: number, format: string, tz?: string): string {
  const d = tz
    ? new Date(new Date(ms).toLocaleString("en-US", { timeZone: tz }))
    : new Date(ms);
  return format
    .replace("HH", pad(d.getHours()))
    .replace("mm", pad(d.getMinutes()))
    .replace("ss", pad(d.getSeconds()))
    .replace("YYYY", String(d.getFullYear()))
    .replace("MM", pad(d.getMonth() + 1))
    .replace("DD", pad(d.getDate()));
}

function formatElapsed(ms: number): string {
  if (ms < 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export default function Chart52ClockTimer({ config }: RendererProps) {
  const mode = (config.extras?.mode as Mode | undefined) ?? "clock";
  const format = (config.extras?.format as string | undefined) ?? "HH:mm:ss";
  const tz = config.extras?.timezone as string | undefined;

  const startPointId = mode === "elapsed" ? config.points[0]?.pointId : undefined;
  const { values } = useWebSocket(startPointId ? [startPointId] : []);
  const startMs = startPointId ? values?.[startPointId]?.value : undefined;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    queueMicrotask(() => {
      wrapperRef.current?.setAttribute("data-chart-ready", "true");
    });
  }, []);

  const display = (() => {
    if (mode === "clock") return formatTime(Date.now(), format, tz);
    if (typeof startMs !== "number" || !Number.isFinite(startMs)) return "—:—:—";
    return formatElapsed(Date.now() - startMs);
  })();

  // Keep `tick` referenced so the effect actually re-renders on each tick
  // (some bundlers strip unused state otherwise).
  void tick;

  return (
    <div
      ref={wrapperRef}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: 28,
        fontWeight: 600,
        color: "var(--io-text)",
        letterSpacing: 1,
      }}
    >
      {display}
    </div>
  );
}
```

### 2. Create `frontend/src/shared/components/charts/renderers/chart54-iframe-embed.tsx`

```tsx
// ---------------------------------------------------------------------------
// Chart 54 — IFrame / Embed
// Renders an iframe with a configurable sandbox attribute.
//
// Deployment note: in production, the CSP frame-src directive must permit
// the embedded domain (or use 'self' if iframes only load from the same
// origin). See nginx site config — frame-src is set in Content-Security-Policy.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import type { ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

export default function Chart54IframeEmbed({ config }: RendererProps) {
  const url = (config.extras?.url as string | undefined) ?? "";
  const sandbox =
    (config.extras?.sandbox as string | undefined) ??
    "allow-scripts allow-same-origin";

  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    queueMicrotask(() => {
      wrapperRef.current?.setAttribute("data-chart-ready", "true");
    });
  }, []);

  if (!url) {
    return (
      <div
        ref={wrapperRef}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: 12,
          padding: 12,
          textAlign: "center",
        }}
      >
        Configure URL in Options
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <iframe
        src={url}
        sandbox={sandbox}
        title="Embedded content"
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          background: "var(--io-surface)",
        }}
      />
    </div>
  );
}
```

### 3. `frontend/src/shared/components/charts/ChartRenderer.tsx`

Uncomment chart52 and chart54:

```ts
52: lazy(() => import("./renderers/chart52-clock-timer")),
54: lazy(() => import("./renderers/chart54-iframe-embed")),
```

### 4. `frontend/src/shared/components/charts/chart-definitions.ts`

Set chart52 and chart54 `available: true`.

For chart52 — note that elapsed mode "uses an optional point binding". Since `requiresPoints: false` is on the definition, the Points tab is hidden. But for elapsed mode the user **does** need to bind a point. Solution: when `mode === "elapsed"`, the chart52 Options tab includes a point picker for the start-time point. That's done in step 5.

### 5. `frontend/src/shared/components/charts/ChartOptionsForm.tsx`

**chart52:**

```tsx
if (config.chartType === 52) {
  const mode = (config.extras?.mode as string | undefined) ?? "clock";
  return (
    <div>
      <Field label="Mode">
        <Select
          value={mode}
          onChange={(v) =>
            onChange({ ...config, extras: { ...config.extras, mode: v as "clock" | "elapsed" } })
          }
          options={[
            { value: "clock", label: "Clock (current time)" },
            { value: "elapsed", label: "Elapsed (time since event)" },
          ]}
        />
      </Field>
      <Field label="Format">
        <TextInput
          value={(config.extras?.format as string | undefined) ?? "HH:mm:ss"}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, format: v } })}
          placeholder="HH:mm:ss"
        />
      </Field>
      {mode === "clock" && (
        <Field label="Timezone (IANA)">
          <TextInput
            value={(config.extras?.timezone as string | undefined) ?? ""}
            onChange={(v) =>
              onChange({ ...config, extras: { ...config.extras, timezone: v || undefined } })
            }
            placeholder="America/New_York (blank = local)"
          />
        </Field>
      )}
      {mode === "elapsed" && (
        <Field label="Start Time Point">
          <PointPicker
            value={config.points[0]?.pointId ?? null}
            onChange={(pointId, label, tagname) => {
              const next: ChartPointSlot[] = pointId
                ? [{ slotId: "start-0", role: "start", pointId, label, tagname }]
                : [];
              onChange({ ...config, points: next });
            }}
          />
        </Field>
      )}
    </div>
  );
}
```

`PointPicker` is whatever the existing point-selector component is. Use the same one from chart01's Points tab.

**chart54:**

```tsx
if (config.chartType === 54) {
  return (
    <div>
      <Field label="URL">
        <TextInput
          value={(config.extras?.url as string | undefined) ?? ""}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, url: v } })}
          placeholder="https://example.com/embed"
        />
      </Field>
      <Field label="Sandbox (advanced)">
        <TextInput
          value={(config.extras?.sandbox as string | undefined) ?? "allow-scripts allow-same-origin"}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, sandbox: v } })}
        />
      </Field>
      <p style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
        Production CSP must allow the embedded domain in <code>frame-src</code>.
      </p>
    </div>
  );
}
```

## Gotchas

- **CSP `frame-src`**: in production, nginx adds Content-Security-Policy headers. If users embed external domains, the CSP must list them — out of scope here, but the comment in chart54-iframe-embed.tsx and the Options note tell the deployer.
- **`X-Frame-Options`** on the embedded site: even with permissive CSP on our side, the embedded site may set `X-Frame-Options: DENY` and refuse to load. There's nothing we can do — show the empty iframe and trust users to pick embeddable URLs.
- **Clock setInterval drift**: 1s timer is fine for second-precision display. Don't try sub-second precision.
- **Elapsed with no start point**: chart52 shows "—:—:—" until the start time arrives via WebSocket.
- **`requiresPoints: false`** on chart52 means the right panel hides the Points tab (Phase 03). That's why we put the start-point picker inside the **Options** tab for elapsed mode. Document this discrepancy in a comment.
- **`pnpm test` + `pnpm build`** required.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` clean; `pnpm build` and `pnpm test` clean.
2. **Manual:** Place a Clock widget. By default it shows current local time, ticking every second.
3. Change format to `YYYY-MM-DD HH:mm` — display updates.
4. Set timezone `Europe/London` — display shifts to UK time.
5. Switch to elapsed mode — Options tab shows a point picker. Bind a point whose value is an epoch ms (e.g. a "shift start time" point). Display counts up.
6. Place an IFrame widget. Configure URL `https://example.com` — page renders inside the wrapper. Resize the widget — iframe scales.
7. Saved config round-trip works for both.
8. Palette tiles (Phase 04) show Clock and IFrame.

## Phase dependencies

- **Depends on:** Phase 04.
- **Gates:** Nothing critical.
