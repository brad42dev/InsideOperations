import { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { usePlaybackStore } from "../../store/playback";
import { useUiStore } from "../../store/ui";
import { ExportRenderProcess } from "./ExportRenderProcess";
import { ExportRenderConsole } from "./ExportRenderConsole";

type ExportWindow = typeof window & {
  __exportSetTimestamp?: (ts: number) => void;
};

export default function ExportRenderPage() {
  const [params] = useSearchParams();

  const module = params.get("module");
  const graphicId = params.get("graphicId");
  const timestampStr = params.get("timestamp");
  const widthStr = params.get("width");
  const heightStr = params.get("height");
  const overlayStr = params.get("overlay");
  const themeStr = params.get("theme");

  const tsParam = timestampStr ? Number(timestampStr) : 0;
  const width = widthStr ? parseInt(widthStr, 10) : window.innerWidth;
  const height = heightStr ? parseInt(heightStr, 10) : window.innerHeight;
  const overlayEnabled = overlayStr === "1";

  const setTheme = useUiStore((s) => s.setTheme);

  // Live timestamp — updated in-place by __exportSetTimestamp between frames
  const [liveTs, setLiveTs] = useState(tsParam);

  useEffect(() => {
    if (themeStr === "light" || themeStr === "dark") {
      setTheme(themeStr);
    }
  }, [themeStr, setTheme]);

  // Initial playback store setup on first load
  useEffect(() => {
    if (!tsParam) return;
    usePlaybackStore.setState({
      mode: "historical",
      timestamp: tsParam,
      timeRange: { start: tsParam - 1000, end: tsParam + 1000 },
      isPlaying: false,
    });
  }, [tsParam]);

  useEffect(() => {
    document.body.style.cssText = `width:${width}px;height:${height}px;overflow:hidden`;
    return () => {
      document.body.style.cssText = "";
    };
  }, [width, height]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent =
      "* { animation: none !important; transition: none !important; }";
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Expose in-place timestamp update for the capture worker.
  // The worker clears data-export-ready before calling this, then waits for it
  // to be re-set by the render components once new data has loaded.
  useEffect(() => {
    (window as ExportWindow).__exportSetTimestamp = (ts: number) => {
      usePlaybackStore.setState({
        timestamp: ts,
        timeRange: { start: ts - 1000, end: ts + 1000 },
      });
      setLiveTs(ts);
    };
    return () => {
      delete (window as ExportWindow).__exportSetTimestamp;
    };
  }, []);

  if (!module || !graphicId || !tsParam) {
    return <Navigate to="/" replace />;
  }

  if (module === "process") {
    return (
      <ExportRenderProcess
        graphicId={graphicId}
        tsParam={liveTs}
        width={width}
        height={height}
        overlayEnabled={overlayEnabled}
      />
    );
  }

  if (module === "console") {
    return (
      <ExportRenderConsole
        graphicId={graphicId}
        tsParam={liveTs}
        width={width}
        height={height}
        overlayEnabled={overlayEnabled}
      />
    );
  }

  return <Navigate to="/" replace />;
}
