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
    // do NOT combine allow-scripts + allow-same-origin — defeats the sandbox
    (config.extras?.sandbox as string | undefined) ?? "allow-scripts";

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
