// ---------------------------------------------------------------------------
// Chart 55 — Camera Stream
// Live video widget. Token endpoint enforces ACL. Happy Eyeballs:
//   t=0    : try direct_url (if present)
//   t+1s   : try relay_url (if present)
//   First frame wins; loser is cancelled.
// Supports MJPEG and HLS in this phase. WebRTC is a future enhancement.
//
// Note on "direct" mode: direct_url must be an HTTP/HTTPS endpoint that
// serves MJPEG or HLS. RTSP-only cameras cannot be played directly in
// browsers — for RTSP sources, only the relay (go2rtc) path works.
//
// Token refresh: tokens expire after ~30 min. We re-fetch the token on
// connection loss (effect re-run). Proactive refresh is a future enhancement.
//
// TODO(future): WebRTC via go2rtc WHIP endpoint.
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
  return url.includes(".m3u8") ? "hls" : "mjpeg";
}

export default function Chart55CameraStream({ config }: RendererProps) {
  const streamId = (config.extras?.streamId as string | undefined) ?? "";
  const aspectRatio =
    (config.extras?.aspectRatio as string | undefined) ?? "16/9";

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<"video" | "img" | null>(null);

  useEffect(() => {
    if (!streamId) {
      setStatus("no-stream");
      return;
    }

    let aborted = false;
    let directAttempt: AttemptState | null = null;
    let relayAttempt: AttemptState | null = null;

    const overallTimeout = window.setTimeout(() => {
      setStatus((prev) => {
        if (prev !== "playing") {
          setErrorMessage("Connection timed out");
          cleanup();
          return "error";
        }
        return prev;
      });
    }, 15000);

    function declareWinner(which: "direct" | "relay", media: "video" | "img") {
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
      setActiveMedia(media);
      setStatus("playing");
      window.clearTimeout(overallTimeout);
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
          video.addEventListener(
            "playing",
            () => {
              if (!state.cancelled) declareWinner(kind, "video");
            },
            { once: true },
          );
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Native HLS (Safari)
          video.src = url;
          state.cleanup = () => {
            video.src = "";
          };
          video.addEventListener(
            "playing",
            () => {
              if (!state.cancelled) declareWinner(kind, "video");
            },
            { once: true },
          );
        }
        // else: HLS not supported — attempt silently fails, overall timeout fires
      } else {
        // MJPEG — poll naturalWidth until the first frame arrives
        const img = imgRef.current;
        if (!img) return state;

        state.cleanup = () => {
          img.src = "";
        };

        const pollForFrame = () => {
          if (state.cancelled) return;
          if (img.naturalWidth > 0) {
            declareWinner(kind, "img");
          } else {
            requestAnimationFrame(pollForFrame);
          }
        };

        // Attach listener before assigning src to avoid the cached-load race.
        img.addEventListener("load", pollForFrame, { once: true });
        img.src = url;
        requestAnimationFrame(pollForFrame);
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
      const tokRes = await videoStreamsApi.token(streamId);
      if (aborted) return;

      if (!tokRes.success) {
        if (tokRes.error.code === "FORBIDDEN") {
          setStatus("no-access");
        } else {
          setStatus("error");
          setErrorMessage(tokRes.error.message ?? "Failed to load stream");
        }
        return;
      }

      const { direct_url, relay_url } = tokRes.data;

      if (!direct_url && !relay_url) {
        setStatus("error");
        setErrorMessage("No connection URL configured");
        return;
      }

      if (direct_url) {
        directAttempt = startAttempt(direct_url, "direct");
      }

      if (relay_url) {
        // Delay relay only when competing against a direct attempt (Happy Eyeballs).
        // If there's no direct URL, start relay immediately.
        const relayDelay = direct_url ? 1000 : 0;
        window.setTimeout(() => {
          if (aborted) return;
          relayAttempt = startAttempt(relay_url, "relay");
        }, relayDelay);
      }
    })();

    return () => {
      aborted = true;
      window.clearTimeout(overallTimeout);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  // Error state: containerRef is in the DOM but declareWinner was never called.
  // Set the attribute directly so the export pipeline doesn't hang.
  useEffect(() => {
    if (status === "error") {
      queueMicrotask(() => {
        containerRef.current?.setAttribute("data-chart-ready", "true");
      });
    }
  }, [status]);

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

  const isPlaying = status === "playing";

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
      <div
        style={{
          width: "100%",
          aspectRatio,
          maxHeight: "100%",
          position: "relative",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: isPlaying && activeMedia === "video" ? "block" : "none",
          }}
        />
        <img
          ref={imgRef}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: isPlaying && activeMedia === "img" ? "block" : "none",
          }}
        />
      </div>

      {status === "loading" && (
        <div style={{ position: "absolute", color: "#fff", fontSize: 12 }}>
          Connecting…
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            position: "absolute",
            color: "#EF4444",
            fontSize: 12,
            padding: 12,
            textAlign: "center",
          }}
        >
          {errorMessage ?? "Stream error"}
        </div>
      )}
    </div>
  );
}

function CameraEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-chart-ready="true"
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
