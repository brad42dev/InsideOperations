import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { dashboardsApi } from "../../api/dashboards";
import { useUiStore } from "../../store/ui";
import DashboardViewer from "./DashboardViewer";

export default function PlaylistPlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setKiosk } = useUiStore();

  // PlaylistPlayer always runs in kiosk mode — hide AppShell chrome
  useEffect(() => {
    setKiosk(true);
    return () => setKiosk(false);
  }, [setKiosk]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showStrip, setShowStrip] = useState(false);
  const hideStripTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const query = useQuery({
    queryKey: ["playlist", id],
    queryFn: async () => {
      if (!id) throw new Error("No playlist ID");
      const result = await dashboardsApi.getPlaylist(id);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    enabled: !!id,
  });

  const playlist = query.data;
  const sortedItems = playlist
    ? [...playlist.items].sort((a, b) => a.position - b.position)
    : [];
  const currentItem = sortedItems[currentIndex];
  const totalItems = sortedItems.length;

  // Initialize time remaining when item changes
  useEffect(() => {
    if (!currentItem) return;
    setTimeRemaining(currentItem.dwell_seconds);
  }, [currentIndex, currentItem?.dwell_seconds]);

  // Auto-advance timer
  useEffect(() => {
    if (!currentItem || isPaused || totalItems === 0) return;

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Advance to next
          setCurrentIndex((idx) => (idx + 1) % totalItems);
          return currentItem.dwell_seconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (progressIntervalRef.current)
        clearInterval(progressIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isPaused, totalItems, currentItem?.dwell_seconds]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.code) {
        case "Space":
          e.preventDefault();
          setIsPaused((v) => !v);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (totalItems > 0) {
            setCurrentIndex((idx) => (idx + 1) % totalItems);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (totalItems > 0) {
            setCurrentIndex((idx) => (idx - 1 + totalItems) % totalItems);
          }
          break;
        case "Escape":
          navigate("/dashboards");
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, totalItems]);

  // Show/hide strip on mouse move
  const handleMouseMove = useCallback(() => {
    setShowStrip(true);
    if (hideStripTimerRef.current) clearTimeout(hideStripTimerRef.current);
    hideStripTimerRef.current = setTimeout(() => {
      setShowStrip(false);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (hideStripTimerRef.current) clearTimeout(hideStripTimerRef.current);
      if (progressIntervalRef.current)
        clearInterval(progressIntervalRef.current);
    };
  }, []);

  if (query.isLoading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--io-surface-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: "14px",
        }}
      >
        Loading playlist...
      </div>
    );
  }

  if (query.isError || !playlist) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--io-surface-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "12px",
          color: "var(--io-danger)",
        }}
      >
        <span>Failed to load playlist</span>
        <button
          onClick={() => navigate("/dashboards")}
          style={{
            padding: "6px 14px",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-secondary)",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Back to Dashboards
        </button>
      </div>
    );
  }

  if (totalItems === 0) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--io-surface-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "12px",
          color: "var(--io-text-muted)",
        }}
      >
        <span>This playlist has no dashboards.</span>
        <button
          onClick={() => navigate("/dashboards")}
          style={{
            padding: "6px 14px",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-secondary)",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Back to Dashboards
        </button>
      </div>
    );
  }

  const dwellSeconds = currentItem?.dwell_seconds ?? 30;
  const progressPercent = ((dwellSeconds - timeRemaining) / dwellSeconds) * 100;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--io-surface-primary)",
        overflow: "hidden",
      }}
      onMouseMove={handleMouseMove}
    >
      {/* Dashboard viewer — kiosk mode, no own toolbar */}
      {currentItem && (
        <div style={{ position: "absolute", inset: 0 }}>
          <DashboardViewer kiosk />
        </div>
      )}

      {/* Overlay strip — shows on hover */}
      {showStrip && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "48px",
            // Kiosk overlay strip — intentionally dark regardless of theme;
            // var(--io-surface-overlay) provides the correct semi-transparent dark background.
            background: "var(--io-surface-overlay)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Pause/resume */}
            <button
              onClick={() => setIsPaused((v) => !v)}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: "18px",
                padding: "4px",
              }}
              title={isPaused ? "Resume (Space)" : "Pause (Space)"}
            >
              {isPaused ? "▶" : "⏸"}
            </button>

            {/* Prev */}
            <button
              onClick={() =>
                setCurrentIndex((idx) => (idx - 1 + totalItems) % totalItems)
              }
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: "16px",
                padding: "4px",
              }}
              title="Previous (←)"
            >
              ◀
            </button>

            {/* Next */}
            <button
              onClick={() => setCurrentIndex((idx) => (idx + 1) % totalItems)}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: "16px",
                padding: "4px",
              }}
              title="Next (→)"
            >
              ▶
            </button>

            {/* Dashboard name */}
            <span style={{ fontSize: "13px", color: "#fff", fontWeight: 600 }}>
              {playlist.name}
            </span>

            {isPaused && (
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: "100px",
                  color: "#fff",
                  letterSpacing: "0.05em",
                  fontWeight: 700,
                }}
              >
                PAUSED
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Position indicator */}
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
              {currentIndex + 1} / {totalItems}
            </span>

            {/* Exit */}
            <button
              onClick={() => navigate("/dashboards")}
              style={{
                padding: "4px 10px",
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "var(--io-radius)",
                color: "#fff",
                cursor: "pointer",
                fontSize: "12px",
              }}
              title="Exit (Esc)"
            >
              ✕ Exit
            </button>
          </div>
        </div>
      )}

      {/* Progress bar at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "var(--io-border-subtle)",
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progressPercent}%`,
            background: "var(--io-accent)",
            transition: isPaused ? "none" : "width 1s linear",
          }}
        />
      </div>

      {/* Dot indicators */}
      {totalItems > 1 && showStrip && (
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "6px",
            zIndex: 100,
          }}
        >
          {sortedItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              style={{
                width: idx === currentIndex ? "20px" : "8px",
                height: "8px",
                borderRadius: "100px",
                background:
                  idx === currentIndex
                    ? "var(--io-accent)"
                    : "rgba(255,255,255,0.3)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "width 0.2s, background 0.2s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
