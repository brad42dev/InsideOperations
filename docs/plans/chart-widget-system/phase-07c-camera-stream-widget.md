# Phase 07c — Camera Stream Widget (chart55)

**Goal:** Implement chart55 — a video widget that plays a configured Camera Stream using a Happy Eyeballs strategy: try direct stream at t=0, relay at t+1s, first-frame-wins. Lock state when the user lacks access.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phases 04, 07a, 07b must be complete.
- `/home/io/io-dev/io/frontend/src/api/videoStreams.ts` — created in Phase 07b.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartRenderer.tsx` — chart55 commented entry from Phase 00.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-defaults.ts` — default for chart55 has `extras.streamId: ""`.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-definitions.ts` — chart55 stub.

## Context

The widget receives a `extras.streamId`. On mount:

1. Call `videoStreamsApi.token(streamId)` to get `{ direct_url, relay_url, token, expires_at }`. If 403, render a locked state with a lock icon and "Contact administrator for access".
2. Start the Happy Eyeballs race:
   - At t=0, if `direct_url` is present, attempt to connect to it.
   - At t=1000ms, start the relay attempt (if `relay_url` is present).
   - Whichever connection delivers a first frame first wins; cancel the loser.
3. Stream protocols:
   - **MJPEG**: `<img src={url}>` — first frame detected when `naturalWidth > 0`.
   - **HLS**: `<video>` + `hls.js` — first frame via `video.requestVideoFrameCallback`.
   - **WebRTC**: `RTCPeerConnection` against go2rtc's WebRTC endpoint — first frame via `requestVideoFrameCallback` on the receiver's stream.
4. If both attempts fail after 15s, render an error state.

For phase 07c, support **MJPEG and HLS** end-to-end. WebRTC is the typical go2rtc default, but it's enough complexity that we ship MJPEG + HLS in this phase and add WebRTC support as a follow-up (note in code). The chart55 picks the protocol based on the URL pattern (`.m3u8` → HLS, otherwise MJPEG/snapshot fallback). go2rtc returns suitable URLs by default for both.

The token expires after ~30 min. For phase 07c, we don't refresh tokens proactively — when the connection drops, the widget re-fetches the token. Document as a future enhancement.

## Changes

### 1. Verify hls.js dependency

```bash
cd frontend && grep '"hls.js"' package.json
```

If missing, add it. hls.js is **Apache-2.0** (verify before merging — repo says Apache-2.0 in `LICENSE`):

```bash
pnpm add hls.js
```

### 2. Create `frontend/src/shared/components/charts/renderers/chart55-camera-stream.tsx`

```tsx
// ---------------------------------------------------------------------------
// Chart 55 — Camera Stream
// Live video widget. Token endpoint enforces ACL. Happy Eyeballs:
//   t=0    : try direct_url (if present)
//   t+1s   : try relay_url (if present)
//   First frame wins; loser is cancelled.
// Supports MJPEG and HLS in this phase. WebRTC is a future enhancement.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { videoStreamsApi } from "../../../../api/videoStreams";
import type { ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type Status = "loading" | "playing" | "error" | "no-access" | "no-stream";

interface AttemptState {
  cancelled: boolean;
  cleanup: () => void;
}

function detectProtocol(url: string): "hls" | "mjpeg" {
  if (url.includes(".m3u8")) return "hls";
  return "mjpeg";
}

export default function Chart55CameraStream({ config }: RendererProps) {
  const streamId = (config.extras?.streamId as string | undefined) ?? "";
  const aspectRatio = (config.extras?.aspectRatio as string | undefined) ?? "16/9";

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!streamId) {
      setStatus("no-stream");
      return;
    }

    let aborted = false;
    let directAttempt: AttemptState | null = null;
    let relayAttempt: AttemptState | null = null;
    const overallTimeout = window.setTimeout(() => {
      if (status !== "playing") {
        setStatus("error");
        setErrorMessage("Connection timed out");
        cleanup();
      }
    }, 15000);

    function declareWinner(which: "direct" | "relay") {
      // Cancel loser
      if (which === "direct" && relayAttempt) {
        relayAttempt.cancelled = true;
        relayAttempt.cleanup();
        relayAttempt = null;
      }
      if (which === "relay" && directAttempt) {
        directAttempt.cancelled = true;
        directAttempt.cleanup();
        directAttempt = null;
      }
      setStatus("playing");
      window.clearTimeout(overallTimeout);
      // Mark for export pipeline
      queueMicrotask(() => {
        containerRef.current?.setAttribute("data-chart-ready", "true");
      });
    }

    function startAttempt(url: string, kind: "direct" | "relay"): AttemptState {
      const proto = detectProtocol(url);
      const state: AttemptState = { cancelled: false, cleanup: () => {} };

      if (proto === "hls") {
        const video = videoRef.current;
        if (!video) return state;
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(url);
          hls.attachMedia(video);
          state.cleanup = () => hls.destroy();
          // First frame detection
          const onFrame = () => {
            if (!state.cancelled) declareWinner(kind);
          };
          if ("requestVideoFrameCallback" in video) {
            (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void })
              .requestVideoFrameCallback(onFrame);
          } else {
            video.addEventListener("playing", onFrame, { once: true });
          }
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Native HLS (Safari)
          video.src = url;
          state.cleanup = () => { video.src = ""; };
          video.addEventListener("playing", () => {
            if (!state.cancelled) declareWinner(kind);
          }, { once: true });
        } else {
          state.cleanup = () => {};
        }
      } else {
        // MJPEG
        const img = imgRef.current;
        if (!img) return state;
        img.src = url;
        const check = () => {
          if (state.cancelled) return;
          if (img.naturalWidth > 0) declareWinner(kind);
          else if (!state.cancelled) requestAnimationFrame(check);
        };
        img.addEventListener("load", check, { once: true });
        // Some browsers don't fire `load` until next animation frame for MJPEG
        // streams; poll briefly until naturalWidth > 0 or attempt is cancelled.
        requestAnimationFrame(check);
        state.cleanup = () => { img.src = ""; };
      }
      return state;
    }

    function cleanup() {
      directAttempt?.cleanup();
      relayAttempt?.cleanup();
      directAttempt = null;
      relayAttempt = null;
    }

    (async () => {
      try {
        const tokRes = await videoStreamsApi.token(streamId);
        if (aborted) return;
        const { direct_url, relay_url } = tokRes.data;

        if (!direct_url && !relay_url) {
          setStatus("error");
          setErrorMessage("No connection URL configured");
          return;
        }

        if (direct_url) directAttempt = startAttempt(direct_url, "direct");

        if (relay_url) {
          window.setTimeout(() => {
            if (aborted) return;
            if (status === "playing") return;
            relayAttempt = startAttempt(relay_url, "relay");
          }, 1000);
        }
      } catch (err) {
        if (aborted) return;
        const e = err as { status?: number; message?: string };
        if (e.status === 403) {
          setStatus("no-access");
        } else {
          setStatus("error");
          setErrorMessage(e.message ?? "Failed to load stream");
        }
      }
    })();

    return () => {
      aborted = true;
      window.clearTimeout(overallTimeout);
      cleanup();
    };
    // streamId is the only thing that should retrigger the effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  if (status === "no-stream") {
    return <CameraEmptyState>Configure stream in Options</CameraEmptyState>;
  }
  if (status === "no-access") {
    return (
      <CameraEmptyState>
        <span style={{ fontSize: 24 }}>🔒</span>
        <span>Contact administrator for access</span>
      </CameraEmptyState>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ width: "100%", aspectRatio, maxHeight: "100%", position: "relative" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "contain", display: status === "playing" ? "block" : "none" }}
        />
        <img
          ref={imgRef}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain", display: status === "playing" ? "block" : "none" }}
        />
      </div>
      {status === "loading" && (
        <div style={{ position: "absolute", color: "#fff", fontSize: 12 }}>Connecting…</div>
      )}
      {status === "error" && (
        <div style={{ position: "absolute", color: "#EF4444", fontSize: 12, padding: 12, textAlign: "center" }}>
          {errorMessage ?? "Stream error"}
        </div>
      )}
    </div>
  );
}

function CameraEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "var(--io-text-muted)",
        background: "#000",
        fontSize: 12,
      }}
    >
      {children}
    </div>
  );
}
```

Note: the dual `<video>` + `<img>` setup is a placeholder so MJPEG and HLS share one container. A cleaner refactor swaps in the right element after protocol detection. Do that polish in this phase if straightforward; otherwise document for follow-up.

### 3. `frontend/src/shared/components/charts/ChartRenderer.tsx`

Uncomment chart55:

```ts
55: lazy(() => import("./renderers/chart55-camera-stream")),
```

### 4. `frontend/src/shared/components/charts/chart-definitions.ts`

Set chart55 `available: true`.

### 5. `frontend/src/shared/components/charts/ChartOptionsForm.tsx`

```tsx
if (config.chartType === 55) {
  // Fetch the user's accessible streams to populate the picker.
  const { data: streams = [] } = useQuery({
    queryKey: ["video-streams"],
    queryFn: () => videoStreamsApi.list().then((r) => r.data),
  });

  return (
    <div>
      <Field label="Camera Stream">
        <Select
          value={(config.extras?.streamId as string | undefined) ?? ""}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, streamId: v } })}
          options={[
            { value: "", label: "— Select a stream —" },
            ...streams.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      </Field>
      <Field label="Aspect Ratio">
        <Select
          value={(config.extras?.aspectRatio as string | undefined) ?? "16/9"}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, aspectRatio: v } })}
          options={[
            { value: "16/9", label: "16:9" },
            { value: "4/3", label: "4:3" },
            { value: "1/1", label: "1:1" },
            { value: "21/9", label: "21:9 (ultrawide)" },
          ]}
        />
      </Field>
      <p style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
        Streams are managed in <a href="/settings/camera-streams">Settings → Camera Streams</a>.
      </p>
    </div>
  );
}
```

`videoStreamsApi.list()` returns only streams the current user can see (per phase 07a's visibility rules). Private streams the user has no ACL access to are filtered out at the API level.

### 6. Phase 04 palette — chart55 designer-only

The chart55 widget should appear in the palette **only in graphic-editing contexts**, since the Settings tab is the system-of-record. The `contexts` field on `ChartDefinition` is the gate. For chart55, set `contexts: ["designer"]` so it doesn't pollute Console / Dashboard / Report pickers (camera widgets are placed via the designer).

Update the chart55 entry in `chart-definitions.ts`:

```ts
{
  id: 55,
  name: "Camera Stream",
  category: "Content",
  // ... other fields ...
  contexts: ["designer"],
  available: true,
},
```

## Gotchas

- **Token endpoint enforces ACL** — don't trust the picker filter alone; the widget must accept a 403 from the token endpoint and render the locked state.
- **`requestVideoFrameCallback`** is well-supported in Chromium and Safari but not Firefox older than ~120. The fallback to `playing` event works for Firefox.
- **MJPEG `naturalWidth`** check in a polling loop can busy-loop if the image never loads. Bound the polling: stop after 15s overall timeout.
- **CSP**: video and image elements load from `/go2rtc/...` (same origin); no CSP issue for relay. Direct URLs (`rtsp://`) are not directly playable in browsers — the **direct mode is only useful for HLS/MJPEG endpoints** the camera itself exposes (some IP cameras do). For RTSP-only cameras, only relay mode works. Document this in the chart55 file's header comment.
- **WebRTC**: out of scope for phase 07c. Note `// TODO(future): WebRTC via go2rtc whip endpoint`.
- **react-grid-layout `position: fixed`**: not used here; videos are normal block elements inside the chart wrapper.
- **`aspectRatio` CSS prop** is well-supported. If you must support very old browsers, use a padding-bottom hack — but assume modern browsers per the project's existing baseline.
- **Designer mode pointer-events**: the chart wrapper has `pointer-events: none` in designer (Phase 02). Video controls are not exposed (no `controls` attribute) — that's intentional. Viewer mode users get just the autoplaying stream.
- **`pnpm test` + `pnpm build`** required.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` clean; `pnpm build` and `pnpm test` clean.
2. **Manual:** As admin, open Settings → Camera Streams (Phase 07b) and configure a public test stream (e.g. an HLS test stream `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` configured in go2rtc as a relay).
3. Open Designer. Drag Camera Stream tile. Right panel shows the stream picker; select the test stream. Stream begins playing within ~2 seconds.
4. Save graphic. Reopen — stream still plays.
5. Set the stream's visibility to private and remove all ACLs. As a different non-admin user opening the same graphic, the widget renders the lock icon + "Contact administrator for access".
6. Restore admin ACL — playback resumes after refresh.
7. Disable network to the camera/relay — widget shows the error state after 15s timeout.

## Phase dependencies

- **Depends on:** Phase 04 (palette + drop), Phase 07a (token endpoint), Phase 07b (Settings UI to configure streams).
- **Gates:** Phase 08.
