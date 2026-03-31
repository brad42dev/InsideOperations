/**
 * HistoricalPlaybackBar — shared Live/Historical mode toggle + scrub controls (doc 07, 08, 32)
 *
 * Used by Console, Process, and Forensics modules. Reads/writes `usePlaybackStore`.
 *
 * Controls:
 *  - Live / Historical toggle
 *  - Date/time range picker (start + end)
 *  - Scrub slider (position within range) with loop region handles
 *  - Step-back / step-forward buttons with step interval dropdown
 *  - Reverse / Play / Pause transport buttons
 *  - Speed selector: x1, x2, x4, x8, x16, x32
 *  - Loop region with two draggable handles
 *  - Loop toggle button
 *  - Current timestamp display (RFC 3339)
 *  - Keyboard shortcuts (Space, arrows, [, ], L/l, Home, End)
 *
 * In "time-context" mode (used by DashboardViewer):
 *  - Preset time range buttons (15m / 1h / 6h / 24h / 7d / 30d)
 *  - Custom From/To datetime pickers
 *  - Playback Bar: play/pause, timeline scrubber, current timestamp, speed
 */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePlaybackStore, type PlaybackSpeed } from "../../store/playback";
import { alarmsApi, type AlarmPriority } from "../../api/alarms";

const SPEEDS: PlaybackSpeed[] = [1, 2, 4, 8, 16, 32];

const ALARM_PRIORITY_COLORS: Record<AlarmPriority, string> = {
  critical: "var(--io-alarm-critical)",
  high: "var(--io-alarm-high)",
  medium: "var(--io-alarm-medium)",
  advisory: "var(--io-alarm-advisory)",
};

function speedLabel(s: PlaybackSpeed): string {
  return `x${s}`;
}

function fmtTimestamp(epochMs: number): string {
  return (
    new Date(epochMs).toISOString().replace("T", " ").slice(0, 19) + " UTC"
  );
}

function fmtDatetimeLocal(epochMs: number): string {
  // Format suitable for <input type="datetime-local">
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface StepOption {
  label: string;
  ms: number;
}

const STEP_OPTIONS: StepOption[] = [
  { label: "Next change", ms: 0 },
  { label: "1 second", ms: 1_000 },
  { label: "5 seconds", ms: 5_000 },
  { label: "30 seconds", ms: 30_000 },
  { label: "1 minute", ms: 60_000 },
  { label: "5 minutes", ms: 300_000 },
  { label: "15 minutes", ms: 900_000 },
  { label: "1 hour", ms: 3_600_000 },
];

/** Index of the step to use when Shift+Arrow is pressed (next larger interval) */
function largerStepIndex(currentIdx: number): number {
  return Math.min(STEP_OPTIONS.length - 1, currentIdx + 1);
}

interface HistoricalPlaybackBarProps {
  /**
   * Rendering mode:
   *  - "playback" (default): full scrub bar for Console/Process/Forensics
   *  - "time-context": simplified time range selector for Dashboards — sets
   *    globalTimeRange in the playback store so all widgets use the same range
   */
  mode?: "playback" | "time-context";
}

export default function HistoricalPlaybackBar({
  mode: barMode = "playback",
}: HistoricalPlaybackBarProps) {
  if (barMode === "time-context") {
    return <TimeContextBar />;
  }

  return <PlaybackBarInner />;
}

// ---------------------------------------------------------------------------
// TimeContextBar — used by DashboardViewer
// Includes: preset buttons, From/To pickers, Playback Bar (play/pause/scrub/speed)
// ---------------------------------------------------------------------------

const TC_SPEEDS: PlaybackSpeed[] = [1, 2, 4, 8, 16, 32];

function TimeContextBar() {
  const {
    globalTimeRange,
    globalPlaybackTimestamp,
    setGlobalTimeRange,
    setGlobalPlaybackTimestamp,
  } = usePlaybackStore();

  // Local playback state
  const [tcPlaying, setTcPlaying] = useState(false);
  const [tcSpeed, setTcSpeed] = useState<PlaybackSpeed>(1);
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRealRef = useRef<number>(Date.now());

  // Default displayed range: last 1 hour
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  function fmtDatetimeLocalStr(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // Parse stored ISO strings back for display
  const displayStart = globalTimeRange
    ? fmtDatetimeLocalStr(new Date(globalTimeRange.start))
    : fmtDatetimeLocalStr(oneHourAgo);
  const displayEnd = globalTimeRange
    ? fmtDatetimeLocalStr(new Date(globalTimeRange.end))
    : fmtDatetimeLocalStr(now);

  // Effective range (fall back to last 1h)
  const rangeStart = globalTimeRange
    ? new Date(globalTimeRange.start).getTime()
    : oneHourAgo.getTime();
  const rangeEnd = globalTimeRange
    ? new Date(globalTimeRange.end).getTime()
    : now.getTime();
  const rangeMs = Math.max(1, rangeEnd - rangeStart);

  // Current playback position
  const currentMs = globalPlaybackTimestamp
    ? new Date(globalPlaybackTimestamp).getTime()
    : rangeStart;
  const clampedMs = Math.max(rangeStart, Math.min(rangeEnd, currentMs));
  const progress = (clampedMs - rangeStart) / rangeMs;
  const sliderValue = Math.round(progress * 1000);

  // Preset shortcuts
  const presets: { label: string; ms: number }[] = [
    { label: "15m", ms: 15 * 60 * 1000 },
    { label: "1h", ms: 60 * 60 * 1000 },
    { label: "6h", ms: 6 * 60 * 60 * 1000 },
    { label: "24h", ms: 24 * 60 * 60 * 1000 },
    { label: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
    { label: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
  ];

  function applyPreset(ms: number) {
    const end = new Date();
    const start = new Date(end.getTime() - ms);
    setGlobalTimeRange({ start: start.toISOString(), end: end.toISOString() });
    // Reset playback position to start of new range and stop
    setTcPlaying(false);
    setGlobalPlaybackTimestamp(start.toISOString());
  }

  function handleStartChange(val: string) {
    const start = new Date(val);
    if (!isNaN(start.getTime())) {
      const end = globalTimeRange ? new Date(globalTimeRange.end) : now;
      if (start < end) {
        setGlobalTimeRange({
          start: start.toISOString(),
          end: end.toISOString(),
        });
        setTcPlaying(false);
        setGlobalPlaybackTimestamp(start.toISOString());
      }
    }
  }

  function handleEndChange(val: string) {
    const end = new Date(val);
    if (!isNaN(end.getTime())) {
      const start = globalTimeRange
        ? new Date(globalTimeRange.start)
        : oneHourAgo;
      if (end > start) {
        setGlobalTimeRange({
          start: start.toISOString(),
          end: end.toISOString(),
        });
        setTcPlaying(false);
      }
    }
  }

  function handleScrub(sliderVal: number) {
    const pct = sliderVal / 1000;
    const ts = rangeStart + pct * rangeMs;
    setGlobalPlaybackTimestamp(new Date(ts).toISOString());
    setTcPlaying(false);
  }

  function togglePlay() {
    if (tcPlaying) {
      setTcPlaying(false);
      return;
    }
    // If at end of range, restart from beginning
    if (clampedMs >= rangeEnd) {
      setGlobalPlaybackTimestamp(new Date(rangeStart).toISOString());
    }
    setTcPlaying(true);
  }

  // Auto-advance timer
  useEffect(() => {
    if (!tcPlaying) {
      if (rafRef.current !== null) {
        clearInterval(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    lastRealRef.current = Date.now();

    rafRef.current = setInterval(() => {
      const now2 = Date.now();
      const realElapsed = now2 - lastRealRef.current;
      lastRealRef.current = now2;
      const simElapsed = realElapsed * tcSpeed;

      const store = usePlaybackStore.getState();
      const currentRangeStart = store.globalTimeRange
        ? new Date(store.globalTimeRange.start).getTime()
        : Date.now() - 3_600_000;
      const currentRangeEnd = store.globalTimeRange
        ? new Date(store.globalTimeRange.end).getTime()
        : Date.now();
      const currentPos = store.globalPlaybackTimestamp
        ? new Date(store.globalPlaybackTimestamp).getTime()
        : currentRangeStart;

      const next = currentPos + simElapsed;
      if (next >= currentRangeEnd) {
        // Reached the end — stop
        setGlobalPlaybackTimestamp(new Date(currentRangeEnd).toISOString());
        setTcPlaying(false);
      } else {
        setGlobalPlaybackTimestamp(new Date(next).toISOString());
      }
    }, 100);

    return () => {
      if (rafRef.current !== null) {
        clearInterval(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tcPlaying, tcSpeed]);

  // Stop playback when range changes
  useEffect(() => {
    setTcPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalTimeRange?.start, globalTimeRange?.end]);

  // Ensure globalPlaybackTimestamp is initialized when a range is set
  useEffect(() => {
    if (globalTimeRange && !globalPlaybackTimestamp) {
      setGlobalPlaybackTimestamp(globalTimeRange.start);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalTimeRange]);

  const isAtEnd = clampedMs >= rangeEnd;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        background: "var(--io-surface)",
        borderTop: "1px solid var(--io-border)",
      }}
    >
      {/* Top row: time range controls */}
      <div style={{ ...barStyle, borderTop: "none" }}>
        <span
          style={{
            fontSize: 10,
            color: "var(--io-text-muted)",
            whiteSpace: "nowrap",
            fontWeight: 600,
          }}
        >
          Time Range:
        </span>

        {/* Preset buttons */}
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.ms)}
            style={iconBtnStyle}
            title={`Last ${p.label}`}
          >
            {p.label}
          </button>
        ))}

        {/* Custom range */}
        <label style={labelStyle}>From</label>
        <input
          type="datetime-local"
          value={displayStart}
          onChange={(e) => handleStartChange(e.target.value)}
          style={inputStyle}
        />
        <label style={labelStyle}>To</label>
        <input
          type="datetime-local"
          value={displayEnd}
          onChange={(e) => handleEndChange(e.target.value)}
          style={inputStyle}
        />

        {/* Clear — restore per-widget defaults */}
        {globalTimeRange && (
          <button
            onClick={() => {
              setGlobalTimeRange(null);
              setGlobalPlaybackTimestamp(null);
              setTcPlaying(false);
            }}
            style={{ ...iconBtnStyle, color: "var(--io-text-muted)" }}
            title="Clear global time range — widgets use their per-widget default"
          >
            Reset
          </button>
        )}
      </div>

      {/* Playback Bar row — always visible */}
      <div
        style={{ ...barStyle, borderTop: "1px solid var(--io-border)", gap: 8 }}
      >
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          style={{
            ...iconBtnStyle,
            minWidth: 34,
            color: tcPlaying ? "var(--io-accent)" : "var(--io-text-primary)",
            borderColor: tcPlaying ? "var(--io-accent)" : "var(--io-border)",
          }}
          title={
            tcPlaying
              ? "Pause playback"
              : isAtEnd
                ? "Replay from start"
                : "Play"
          }
          aria-label={tcPlaying ? "Pause" : "Play"}
        >
          {tcPlaying ? "⏸" : isAtEnd ? "↺" : "▶"}
        </button>

        {/* Timeline scrubber */}
        <div
          style={{
            position: "relative",
            flex: 1,
            minWidth: 100,
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            type="range"
            min={0}
            max={1000}
            value={sliderValue}
            onChange={(e) => handleScrub(Number(e.target.value))}
            style={{ width: "100%", cursor: "pointer", margin: 0 }}
            aria-label="Playback timeline scrubber"
          />
        </div>

        {/* Current timestamp display */}
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--io-font-mono, monospace)",
            color: tcPlaying ? "var(--io-accent)" : "var(--io-text-secondary)",
            whiteSpace: "nowrap",
            minWidth: 160,
          }}
          title="Current playback position"
        >
          {globalPlaybackTimestamp
            ? new Date(clampedMs).toISOString().replace("T", " ").slice(0, 19) +
              " UTC"
            : "--"}
        </span>

        {/* Speed selector */}
        <select
          value={tcSpeed}
          onChange={(e) => setTcSpeed(Number(e.target.value) as PlaybackSpeed)}
          style={inputStyle}
          title="Playback speed"
          aria-label="Playback speed"
        >
          {TC_SPEEDS.map((s) => (
            <option key={s} value={s}>
              x{s}
            </option>
          ))}
        </select>

        {/* Label */}
        <span
          style={{
            fontSize: 10,
            color: "var(--io-text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          Playback
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlaybackBarInner — original full scrub bar for Console/Process/Forensics
// ---------------------------------------------------------------------------

function PlaybackBarInner() {
  const {
    mode,
    timestamp,
    timeRange,
    isPlaying,
    isReversing,
    speed,
    loopStart,
    loopEnd,
    loopEnabled,
    setMode,
    setTimestamp,
    setTimeRange,
    setPlaying,
    setReversing,
    setSpeed,
    setLoopStart,
    setLoopEnd,
    setLoopEnabled,
  } = usePlaybackStore();

  // Step interval state — default to index 4 (1 minute)
  const [stepIdx, setStepIdx] = useState<number>(4);
  const selectedStepMs = STEP_OPTIONS[stepIdx].ms;

  // Fetch alarm events for the current time range in historical mode
  const { data: alarmEvents } = useQuery({
    queryKey: ["alarm-events", mode, timeRange.start, timeRange.end],
    queryFn: async () => {
      const result = await alarmsApi.getEvents({
        start: new Date(timeRange.start).toISOString(),
        end: new Date(timeRange.end).toISOString(),
        limit: 500,
      });
      return result.success ? result.data : [];
    },
    enabled: mode === "historical",
    staleTime: 30_000,
  });

  // Advance (or reverse) playback timer when playing
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRealRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isPlaying || mode !== "historical") {
      if (rafRef.current !== null) {
        clearInterval(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    lastRealRef.current = Date.now();

    rafRef.current = setInterval(() => {
      const now = Date.now();
      const realElapsed = now - lastRealRef.current;
      lastRealRef.current = now;
      const simElapsed = realElapsed * speed;

      usePlaybackStore.setState((s) => {
        if (s.isReversing) {
          // Reverse playback — decrement timestamp
          const next = s.timestamp - simElapsed;
          if (next <= s.timeRange.start) {
            return { timestamp: s.timeRange.start, isPlaying: false };
          }
          return { timestamp: next };
        } else {
          // Forward playback
          const next = s.timestamp + simElapsed;
          // Loop region check
          if (s.loopEnabled && s.loopEnd !== null && next >= s.loopEnd) {
            return { timestamp: s.loopStart ?? s.timeRange.start };
          }
          if (next >= s.timeRange.end) {
            return { timestamp: s.timeRange.end, isPlaying: false };
          }
          return { timestamp: next };
        }
      });
    }, 100);

    return () => {
      if (rafRef.current !== null) clearInterval(rafRef.current);
    };
  }, [isPlaying, isReversing, mode, speed]);

  // Keyboard shortcuts — active only in historical mode
  useEffect(() => {
    if (mode !== "historical") return;

    const handler = (e: KeyboardEvent) => {
      // Guard: do not intercept keys when focus is in an input/textarea/select
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const store = usePlaybackStore.getState();

      switch (e.key) {
        case " ": {
          e.preventDefault();
          store.setPlaying(!store.isPlaying);
          break;
        }
        case "ArrowLeft": {
          if (e.shiftKey) {
            // Larger step back
            const biggerIdx = largerStepIndex(stepIdx);
            const biggerMs = STEP_OPTIONS[biggerIdx].ms || 60_000;
            store.setTimestamp(
              Math.max(store.timeRange.start, store.timestamp - biggerMs),
            );
          } else {
            const ms = selectedStepMs || 60_000;
            store.setTimestamp(
              Math.max(store.timeRange.start, store.timestamp - ms),
            );
          }
          break;
        }
        case "ArrowRight": {
          if (e.shiftKey) {
            // Larger step forward
            const biggerIdx = largerStepIndex(stepIdx);
            const biggerMs = STEP_OPTIONS[biggerIdx].ms || 60_000;
            store.setTimestamp(
              Math.min(store.timeRange.end, store.timestamp + biggerMs),
            );
          } else {
            const ms = selectedStepMs || 60_000;
            store.setTimestamp(
              Math.min(store.timeRange.end, store.timestamp + ms),
            );
          }
          break;
        }
        case "Home": {
          store.setTimestamp(store.timeRange.start);
          break;
        }
        case "End": {
          store.setTimestamp(store.timeRange.end);
          break;
        }
        case "[": {
          store.setLoopStart(store.timestamp);
          break;
        }
        case "]": {
          store.setLoopEnd(store.timestamp);
          break;
        }
        case "l":
        case "L": {
          store.setLoopEnabled(!store.loopEnabled);
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, stepIdx, selectedStepMs]);

  if (mode === "live") {
    return (
      <div style={barStyle}>
        <button
          onClick={() => setMode("historical")}
          style={liveButtonStyle}
          title="Switch to historical playback mode"
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22C55E",
              display: "inline-block",
              marginRight: 6,
            }}
          />
          LIVE
        </button>
        <span
          style={{ color: "var(--io-text-muted)", fontSize: 11, marginLeft: 8 }}
        >
          Click to enter historical playback
        </span>
      </div>
    );
  }

  const rangeMs = timeRange.end - timeRange.start;
  const progress = rangeMs > 0 ? (timestamp - timeRange.start) / rangeMs : 0;
  const sliderValue = Math.round(progress * 1000);

  // Loop region handle positions as 0–1000 slider units
  const loopStartSlider =
    loopStart !== null && rangeMs > 0
      ? Math.round(((loopStart - timeRange.start) / rangeMs) * 1000)
      : null;
  const loopEndSlider =
    loopEnd !== null && rangeMs > 0
      ? Math.round(((loopEnd - timeRange.start) / rangeMs) * 1000)
      : null;

  return (
    <div style={barStyle}>
      {/* Back to live */}
      <button
        onClick={() => setMode("live")}
        style={backLiveStyle}
        title="Return to live mode"
      >
        ◉ Live
      </button>

      {/* Range selectors */}
      <label style={labelStyle}>From</label>
      <input
        type="datetime-local"
        value={fmtDatetimeLocal(timeRange.start)}
        onChange={(e) => {
          const v = new Date(e.target.value).getTime();
          if (!isNaN(v) && v < timeRange.end) {
            setTimeRange({ start: v, end: timeRange.end });
            if (timestamp < v) setTimestamp(v);
          }
        }}
        style={inputStyle}
      />
      <label style={labelStyle}>To</label>
      <input
        type="datetime-local"
        value={fmtDatetimeLocal(timeRange.end)}
        onChange={(e) => {
          const v = new Date(e.target.value).getTime();
          if (!isNaN(v) && v > timeRange.start) {
            setTimeRange({ start: timeRange.start, end: v });
            if (timestamp > v) setTimestamp(v);
          }
        }}
        style={inputStyle}
      />

      {/* Step interval dropdown */}
      <select
        value={stepIdx}
        onChange={(e) => setStepIdx(Number(e.target.value))}
        style={inputStyle}
        title="Step interval"
      >
        {STEP_OPTIONS.map((opt, i) => (
          <option key={i} value={i}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Step back */}
      <button
        onClick={() => {
          const ms = selectedStepMs || 60_000;
          setTimestamp(Math.max(timeRange.start, timestamp - ms));
        }}
        style={iconBtnStyle}
        title="Step back"
      >
        ⏮
      </button>

      {/* Reverse button */}
      <button
        onClick={() => {
          if (isReversing && isPlaying) {
            // Already reversing — pause
            setPlaying(false);
            setReversing(false);
          } else {
            setReversing(true);
            setPlaying(true);
          }
        }}
        style={{
          ...iconBtnStyle,
          minWidth: 32,
          color:
            isReversing && isPlaying
              ? "var(--io-accent)"
              : "var(--io-text-primary)",
          borderColor:
            isReversing && isPlaying ? "var(--io-accent)" : "var(--io-border)",
        }}
        title={isReversing && isPlaying ? "Pause reverse" : "Reverse"}
      >
        ◀◀
      </button>

      {/* Play / Pause */}
      <button
        onClick={() => {
          if (isPlaying && !isReversing) {
            setPlaying(false);
          } else {
            setReversing(false);
            setPlaying(true);
          }
        }}
        style={{
          ...iconBtnStyle,
          minWidth: 32,
          color:
            isPlaying && !isReversing
              ? "var(--io-accent)"
              : "var(--io-text-primary)",
          borderColor:
            isPlaying && !isReversing ? "var(--io-accent)" : "var(--io-border)",
        }}
        title={isPlaying && !isReversing ? "Pause" : "Play"}
      >
        {isPlaying && !isReversing ? "⏸" : "▶"}
      </button>

      {/* Step forward */}
      <button
        onClick={() => {
          const ms = selectedStepMs || 60_000;
          setTimestamp(Math.min(timeRange.end, timestamp + ms));
        }}
        style={iconBtnStyle}
        title="Step forward"
      >
        ⏭
      </button>

      {/* Loop toggle button */}
      <button
        onClick={() => setLoopEnabled(!loopEnabled)}
        style={{
          ...iconBtnStyle,
          color: loopEnabled ? "var(--io-accent)" : "var(--io-text-muted)",
          borderColor: loopEnabled ? "var(--io-accent)" : "var(--io-border)",
        }}
        title={
          loopEnabled
            ? "Disable loop"
            : "Enable loop (set handles with [ and ])"
        }
      >
        ↺
      </button>

      {/* Scrub slider with alarm event markers and loop region handles */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minWidth: 80,
          maxWidth: 300,
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Loop region shading */}
        {loopEnabled &&
          loopStartSlider !== null &&
          loopEndSlider !== null &&
          loopEndSlider > loopStartSlider && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: `${loopStartSlider / 10}%`,
                width: `${(loopEndSlider - loopStartSlider) / 10}%`,
                top: 0,
                bottom: 0,
                background: "var(--io-accent)",
                opacity: 0.15,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          )}

        <input
          type="range"
          min={0}
          max={1000}
          value={sliderValue}
          onChange={(e) => {
            const pct = Number(e.target.value) / 1000;
            setTimestamp(timeRange.start + pct * rangeMs);
          }}
          style={{
            width: "100%",
            cursor: "pointer",
            margin: 0,
            position: "relative",
            zIndex: 2,
          }}
        />

        {/* Loop start handle */}
        {loopStartSlider !== null && (
          <input
            type="range"
            min={0}
            max={1000}
            value={loopStartSlider}
            onChange={(e) => {
              const pct = Number(e.target.value) / 1000;
              setLoopStart(timeRange.start + pct * rangeMs);
            }}
            title="Loop start"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              width: "100%",
              margin: 0,
              opacity: 0,
              cursor: "ew-resize",
              zIndex: 3,
            }}
          />
        )}

        {/* Loop start marker line */}
        {loopStartSlider !== null && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: `${loopStartSlider / 10}%`,
              transform: "translateX(-50%)",
              top: 2,
              bottom: 2,
              width: 3,
              background: "var(--io-accent)",
              borderRadius: 2,
              pointerEvents: "none",
              zIndex: 4,
              opacity: 0.85,
            }}
          />
        )}

        {/* Loop end handle — draggable range input */}
        {loopEndSlider !== null && (
          <input
            type="range"
            min={0}
            max={1000}
            value={loopEndSlider}
            onChange={(e) => {
              const pct = Number(e.target.value) / 1000;
              setLoopEnd(timeRange.start + pct * rangeMs);
            }}
            title="Loop end"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              width: "100%",
              margin: 0,
              opacity: 0,
              cursor: "ew-resize",
              zIndex: 3,
            }}
          />
        )}

        {/* Loop end marker line */}
        {loopEndSlider !== null && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: `${loopEndSlider / 10}%`,
              transform: "translateX(-50%)",
              top: 2,
              bottom: 2,
              width: 3,
              background: "var(--io-accent)",
              borderRadius: 2,
              pointerEvents: "none",
              zIndex: 4,
              opacity: 0.85,
            }}
          />
        )}

        {/* Alarm event tick marks — rendered on top of the range track */}
        {rangeMs > 0 && alarmEvents && alarmEvents.length > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 8,
              pointerEvents: "none",
              zIndex: 5,
            }}
          >
            {alarmEvents.map((event) => {
              const ts = new Date(event.timestamp).getTime();
              if (ts < timeRange.start || ts > timeRange.end) return null;
              const pct = ((ts - timeRange.start) / rangeMs) * 100;
              return (
                <div
                  key={event.id}
                  title={`${event.priority.toUpperCase()}: ${event.message} @ ${new Date(event.timestamp).toLocaleTimeString()}`}
                  onClick={() => setTimestamp(ts)}
                  style={{
                    position: "absolute",
                    left: `${pct}%`,
                    transform: "translateX(-50%)",
                    width: 2,
                    height: 8,
                    background: ALARM_PRIORITY_COLORS[event.priority],
                    bottom: 0,
                    pointerEvents: "auto",
                    cursor: "pointer",
                    zIndex: 6,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Timestamp display */}
      <span
        style={{
          fontSize: 11,
          fontFamily: "var(--io-font-mono, monospace)",
          color: "var(--io-accent)",
          whiteSpace: "nowrap",
          minWidth: 170,
        }}
      >
        {fmtTimestamp(timestamp)}
      </span>

      {/* Speed selector */}
      <select
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value) as PlaybackSpeed)}
        style={inputStyle}
        title="Playback speed"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {speedLabel(s)}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "0 10px",
  height: 40,
  flexShrink: 0,
  background: "var(--io-surface)",
  borderTop: "1px solid var(--io-border)",
  overflow: "hidden",
};

const liveButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  background: "var(--io-surface-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: 6,
  padding: "3px 10px",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 700,
  color: "#22C55E",
  letterSpacing: "0.05em",
};

const backLiveStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--io-accent)",
  borderRadius: 5,
  padding: "2px 8px",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--io-accent)",
  whiteSpace: "nowrap",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--io-text-muted)",
  whiteSpace: "nowrap",
};

const inputStyle: React.CSSProperties = {
  background: "var(--io-surface-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: 4,
  padding: "2px 6px",
  fontSize: 11,
  color: "var(--io-text-primary)",
  cursor: "pointer",
};

const iconBtnStyle: React.CSSProperties = {
  background: "var(--io-surface-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: 4,
  padding: "3px 7px",
  cursor: "pointer",
  fontSize: 13,
  color: "var(--io-text-primary)",
  lineHeight: 1,
};
