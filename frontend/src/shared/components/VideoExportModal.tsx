import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePlaybackStore } from "../../store/playback";
import {
  videoExportsApi,
  type CreateVideoExportRequest,
} from "../../api/videoExports";
import { showToast } from "./Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (jobId: string) => void;
  module: "process" | "console";
  graphicId: string;
  resolveExportGraphicId?: () => Promise<string>;
}

const STEP_OPTIONS = [
  { label: "100ms", ms: 100 },
  { label: "250ms", ms: 250 },
  { label: "500ms", ms: 500 },
  { label: "1s", ms: 1_000 },
  { label: "2s", ms: 2_000 },
  { label: "5s", ms: 5_000 },
  { label: "10s", ms: 10_000 },
  { label: "30s", ms: 30_000 },
  { label: "1min", ms: 60_000 },
  { label: "5min", ms: 300_000 },
  { label: "15min", ms: 900_000 },
  { label: "30min", ms: 1_800_000 },
  { label: "1hr", ms: 3_600_000 },
];

// Steps per second → fps (direct mapping). Sub-1 values produce slow-motion video
// (1 step becomes multiple seconds); above 1 is time-lapse.
const STEPS_PER_SEC_OPTIONS = [
  { label: "1/10  (1 step = 10s)", value: 0.1 },
  { label: "1/4   (1 step = 4s)", value: 0.25 },
  { label: "1/2   (1 step = 2s)", value: 0.5 },
  { label: "1     (real-time)", value: 1 },
  { label: "2×", value: 2 },
  { label: "4×", value: 4 },
  { label: "10×", value: 10 },
  { label: "30×", value: 30 },
  { label: "60×", value: 60 },
];

const QUALITY_OPTIONS = [
  { label: "Low", crf: 35 },
  { label: "Medium", crf: 28 },
  { label: "High", crf: 22 },
];

const MAX_FRAMES = 3_600;

function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function VideoExportModal({
  open,
  onClose,
  onSuccess,
  module,
  graphicId,
  resolveExportGraphicId,
}: Props) {
  if (!open) return null;

  return createPortal(
    <VideoExportModalInner
      onClose={onClose}
      onSuccess={onSuccess}
      module={module}
      graphicId={graphicId}
      resolveExportGraphicId={resolveExportGraphicId}
    />,
    document.body,
  );
}

function VideoExportModalInner({
  onClose,
  onSuccess,
  module,
  graphicId,
  resolveExportGraphicId,
}: {
  onClose: () => void;
  onSuccess?: (jobId: string) => void;
  module: "process" | "console";
  graphicId: string;
  resolveExportGraphicId?: () => Promise<string>;
}) {
  const { timeRange, ccOverlayEnabled } = usePlaybackStore();

  const [rangeStart, setRangeStart] = useState(timeRange.end - 15 * 60 * 1000);
  const [rangeEnd, setRangeEnd] = useState(timeRange.end);
  const [stepMs, setStepMs] = useState(1_000);
  const [stepsPerSec, setStepsPerSec] = useState(1);
  const [crf, setCrf] = useState(28);
  const [burnTimestamp, setBurnTimestamp] = useState(ccOverlayEnabled);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detected once at mount
  const widthPx = useMemo(
    () => Math.round(window.screen.width * window.devicePixelRatio),
    [],
  );
  const heightPx = useMemo(
    () => Math.round(window.screen.height * window.devicePixelRatio),
    [],
  );

  const frames = Math.floor((rangeEnd - rangeStart) / stepMs);
  const videoDurationSec = stepsPerSec > 0 ? frames / stepsPerSec : 0;
  const overLimit = frames > MAX_FRAMES;
  const invalid = rangeEnd <= rangeStart || frames <= 0;

  async function handleSubmit() {
    if (invalid || overLimit) return;
    setSubmitting(true);
    setError(null);

    let effectiveGraphicId = graphicId;
    let snapshotWorkspaceId: string | undefined;
    if (resolveExportGraphicId) {
      try {
        effectiveGraphicId = await resolveExportGraphicId();
        snapshotWorkspaceId = effectiveGraphicId;
      } catch (e: unknown) {
        setError(
          e instanceof Error
            ? e.message
            : "Could not snapshot workspace. Please try again.",
        );
        setSubmitting(false);
        return;
      }
    }

    const req: CreateVideoExportRequest = {
      module,
      graphic_id: effectiveGraphicId,
      range_start: rangeStart,
      range_end: rangeEnd,
      step_ms: stepMs,
      fps: stepsPerSec,
      width_px: widthPx,
      height_px: heightPx,
      device_pixel_ratio: window.devicePixelRatio,
      overlay_timestamp: burnTimestamp,
      crf,
      snapshot_workspace_id: snapshotWorkspaceId,
    };
    try {
      const result = (await videoExportsApi.create(req)) as
        | { data?: { id?: string }; id?: string }
        | undefined;
      const jobId = result?.data?.id ?? result?.id;
      if (onSuccess && jobId) {
        onSuccess(jobId);
      } else {
        showToast({
          title: "Recording started",
          description: "You'll be notified when your video export is ready.",
          variant: "success",
        });
      }
      onClose();
    } catch (e: unknown) {
      const err = e as {
        status?: number;
        message?: string;
        error?: string | { message?: string; code?: string };
      };
      if (err?.status === 409) {
        setError("You already have a video export in progress.");
      } else {
        const rawError = err?.error;
        const errorText =
          err?.message ??
          (typeof rawError === "string" ? rawError : rawError?.message) ??
          "An error occurred submitting the export.";
        setError(errorText);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--io-modal-backdrop)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--io-surface-primary)",
          border: "1px solid var(--io-border)",
          borderRadius: 10,
          padding: 24,
          width: 460,
          maxWidth: "95vw",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "var(--io-text-primary)",
            }}
          >
            Export Video
          </h2>
          <button onClick={onClose} style={BTN_ICON} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Time range */}
        <div style={FIELD_GROUP}>
          <label style={LABEL}>Time Range</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="datetime-local"
              value={toDatetimeLocal(rangeStart)}
              onChange={(e) => {
                const v = new Date(e.target.value).getTime();
                if (!isNaN(v)) setRangeStart(v);
              }}
              style={INPUT}
            />
            <span style={{ color: "var(--io-text-muted)", fontSize: 12 }}>
              to
            </span>
            <input
              type="datetime-local"
              value={toDatetimeLocal(rangeEnd)}
              onChange={(e) => {
                const v = new Date(e.target.value).getTime();
                if (!isNaN(v)) setRangeEnd(v);
              }}
              style={INPUT}
            />
          </div>
        </div>

        {/* Step Interval + Quality row */}
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ ...FIELD_GROUP, flex: 1 }}>
            <label style={LABEL}>Step Interval</label>
            <select
              value={stepMs}
              onChange={(e) => setStepMs(Number(e.target.value))}
              style={INPUT}
            >
              {STEP_OPTIONS.map((o) => (
                <option key={o.ms} value={o.ms}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ ...FIELD_GROUP, flex: 1 }}>
            <label style={LABEL}>Quality</label>
            <select
              value={crf}
              onChange={(e) => setCrf(Number(e.target.value))}
              style={INPUT}
            >
              {QUALITY_OPTIONS.map((q) => (
                <option key={q.crf} value={q.crf}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Playback speed */}
        <div style={FIELD_GROUP}>
          <label style={LABEL}>Playback Speed</label>
          <select
            value={stepsPerSec}
            onChange={(e) => setStepsPerSec(Number(e.target.value))}
            style={INPUT}
          >
            {STEPS_PER_SEC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Timestamp overlay */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            id="ve-burn-ts"
            type="checkbox"
            checked={burnTimestamp}
            onChange={(e) => setBurnTimestamp(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          <label htmlFor="ve-burn-ts" style={{ ...LABEL, cursor: "pointer" }}>
            Burn timestamp into video
          </label>
        </div>

        {/* Resolution (read-only) */}
        <div style={FIELD_GROUP}>
          <label style={LABEL}>Resolution</label>
          <span style={{ fontSize: 12, color: "var(--io-text-secondary)" }}>
            {widthPx} × {heightPx} px
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: "var(--io-text-muted)",
              }}
            >
              Detected from your display
            </span>
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "var(--io-text-muted)",
              marginTop: 4,
            }}
          >
            Export runs server-side — any browser is supported.
          </p>
        </div>

        {/* Estimates */}
        <div
          style={{
            background: "var(--io-surface-sunken)",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 12,
            color: "var(--io-text-secondary)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span>Frames: {frames > 0 ? frames.toLocaleString() : "—"}</span>
          <span>
            Approx. duration:{" "}
            {frames > 0 ? `${videoDurationSec.toFixed(1)}s video` : "—"}
          </span>
          {overLimit && (
            <span
              style={{
                color: "var(--io-danger)",
                fontWeight: 600,
                marginTop: 4,
              }}
            >
              Exceeds 1 hour at 1s step — shorten the range or increase the step
              interval.
            </span>
          )}
        </div>

        {/* Inline error */}
        {error && (
          <div
            style={{
              background: "var(--io-danger-subtle)",
              color: "var(--io-danger)",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={BTN_SECONDARY} disabled={submitting}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={invalid || overLimit || submitting}
            style={{
              ...BTN_PRIMARY,
              opacity: invalid || overLimit || submitting ? 0.5 : 1,
              cursor:
                invalid || overLimit || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Submitting…" : "⏺ Start Export"}
          </button>
        </div>
      </div>
    </div>
  );
}

const FIELD_GROUP: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--io-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const INPUT: React.CSSProperties = {
  background: "var(--io-surface-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
  color: "var(--io-text-primary)",
  cursor: "pointer",
};

const BTN_PRIMARY: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: 6,
  border: "none",
  background: "var(--io-accent)",
  color: "var(--io-text-on-accent)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const BTN_SECONDARY: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: 6,
  border: "1px solid var(--io-border)",
  background: "var(--io-surface-sunken)",
  color: "var(--io-text-primary)",
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
};

const BTN_ICON: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 14,
  color: "var(--io-text-muted)",
  padding: "2px 6px",
  borderRadius: 4,
};
