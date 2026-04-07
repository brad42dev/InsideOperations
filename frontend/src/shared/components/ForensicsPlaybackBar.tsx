/**
 * ForensicsPlaybackBar — compact scrub + step bar for Forensics stage snapshot picker (doc 12, 32)
 *
 * A controlled, self-contained playback bar scoped to a specific time range.
 * Unlike HistoricalPlaybackBar (which uses the global playback store), this
 * component is purely prop-driven: the caller owns the selected timestamp.
 *
 * Features:
 *  - Scrub slider constrained to [startTime, endTime]
 *  - Step-back / step-forward buttons (1-minute default step)
 *  - Alarm event tick marks rendered on the scrub track
 *  - Current timestamp displayed in UTC
 *
 * Props:
 *  - startTime: ISO string — beginning of the scrub range
 *  - endTime: ISO string — end of the scrub range
 *  - value: ISO string — the currently selected timestamp
 *  - onChange: (isoString: string) => void — called whenever the selection changes
 *  - showAlarmMarkers: boolean — whether to fetch and render alarm tick marks
 */

import { useQuery } from "@tanstack/react-query";
import { alarmsApi, type AlarmPriority } from "../../api/alarms";

const ALARM_PRIORITY_COLORS: Record<AlarmPriority, string> = {
  urgent: "var(--io-alarm-urgent)",
  high: "var(--io-alarm-high)",
  low: "var(--io-alarm-low)",
  diagnostic: "var(--io-alarm-diagnostic)",
};

const STEP_MS = 60_000; // 1-minute default step

function fmtTimestamp(epochMs: number): string {
  return (
    new Date(epochMs).toISOString().replace("T", " ").slice(0, 19) + " UTC"
  );
}

interface ForensicsPlaybackBarProps {
  startTime: string;
  endTime: string;
  value: string;
  onChange: (isoString: string) => void;
  showAlarmMarkers?: boolean;
}

export default function ForensicsPlaybackBar({
  startTime,
  endTime,
  value,
  onChange,
  showAlarmMarkers = true,
}: ForensicsPlaybackBarProps) {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const currentMs = new Date(value).getTime();
  const rangeMs = endMs - startMs;

  // Clamp current to range
  const safeMs = isNaN(currentMs)
    ? startMs
    : Math.max(startMs, Math.min(endMs, currentMs));

  const progress = rangeMs > 0 ? (safeMs - startMs) / rangeMs : 0;
  const sliderValue = Math.round(progress * 1000);

  // Fetch alarm events for alarm tick markers
  const { data: alarmEvents } = useQuery({
    queryKey: ["forensics-alarm-events", startTime, endTime],
    queryFn: async () => {
      const result = await alarmsApi.getEvents({
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        limit: 500,
      });
      return result.success ? result.data : [];
    },
    enabled: showAlarmMarkers && rangeMs > 0,
    staleTime: 60_000,
  });

  function emitEpoch(epochMs: number) {
    onChange(
      new Date(Math.max(startMs, Math.min(endMs, epochMs))).toISOString(),
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {/* Scrub slider row */}
      <div
        style={{ position: "relative", display: "flex", alignItems: "center" }}
      >
        <input
          type="range"
          min={0}
          max={1000}
          value={sliderValue}
          onChange={(e) => {
            const pct = Number(e.target.value) / 1000;
            emitEpoch(startMs + pct * rangeMs);
          }}
          style={{
            width: "100%",
            cursor: "pointer",
            margin: 0,
            position: "relative",
            zIndex: 2,
          }}
          aria-label="Scrub timeline"
        />

        {/* Alarm tick marks */}
        {showAlarmMarkers &&
          rangeMs > 0 &&
          alarmEvents &&
          alarmEvents.length > 0 && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 8,
                pointerEvents: "none",
                zIndex: 3,
              }}
            >
              {alarmEvents.map((event) => {
                const ts = new Date(event.timestamp).getTime();
                if (ts < startMs || ts > endMs) return null;
                const pct = ((ts - startMs) / rangeMs) * 100;
                return (
                  <div
                    key={event.id}
                    title={`${event.priority.toUpperCase()}: ${event.message} @ ${new Date(event.timestamp).toLocaleTimeString()}`}
                    style={{
                      position: "absolute",
                      left: `${pct}%`,
                      transform: "translateX(-50%)",
                      width: 2,
                      height: 8,
                      background: ALARM_PRIORITY_COLORS[event.priority],
                      bottom: 0,
                      pointerEvents: "none",
                      zIndex: 4,
                    }}
                  />
                );
              })}
            </div>
          )}
      </div>

      {/* Step controls + timestamp display */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={() => emitEpoch(safeMs - STEP_MS)}
          title="Step back 1 minute"
          style={stepBtnStyle}
        >
          ⏮ -1m
        </button>

        <span
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: "11px",
            fontFamily: "var(--io-font-mono, monospace)",
            color: "var(--io-accent)",
            whiteSpace: "nowrap",
          }}
        >
          {fmtTimestamp(safeMs)}
        </span>

        <button
          type="button"
          onClick={() => emitEpoch(safeMs + STEP_MS)}
          title="Step forward 1 minute"
          style={stepBtnStyle}
        >
          +1m ⏭
        </button>
      </div>
    </div>
  );
}

const stepBtnStyle: React.CSSProperties = {
  background: "var(--io-surface-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: 4,
  padding: "3px 8px",
  cursor: "pointer",
  fontSize: "12px",
  color: "var(--io-text-primary)",
  lineHeight: 1,
  whiteSpace: "nowrap",
  flexShrink: 0,
};
