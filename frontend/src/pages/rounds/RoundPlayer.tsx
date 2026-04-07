import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  roundsApi,
  type Checkpoint,
  type ResponseItem,
} from "../../api/rounds";
import {
  useOfflineRounds,
  batchSyncRounds,
} from "../../shared/hooks/useOfflineRounds";
import { useAuthStore } from "../../store/auth";
import { shiftsApi } from "../../api/shifts";

// ---------------------------------------------------------------------------
// Transfer request banner — shown when the round is locked to another user
// ---------------------------------------------------------------------------

function LockedByOtherBanner({
  lockedToUser,
  instanceId,
  onTransferRequested,
}: {
  lockedToUser: string;
  instanceId: string;
  onTransferRequested: () => void;
}) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async () => {
    setRequesting(true);
    setError(null);
    const result = await roundsApi.transferInstance(instanceId);
    setRequesting(false);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    onTransferRequested();
  };

  return (
    <div
      style={{
        background: "rgba(251,191,36,0.1)",
        border: "1px solid rgba(251,191,36,0.4)",
        borderRadius: "10px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: "15px",
          color: "var(--io-text-primary)",
        }}
      >
        Round Locked
      </div>
      <div style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}>
        This round is currently locked to <strong>{lockedToUser}</strong>. You
        can request a transfer. If the current owner does not acknowledge within
        1 minute, the round will be automatically transferred to you.
      </div>
      {error && (
        <div style={{ fontSize: "12px", color: "var(--io-alarm-urgent)" }}>
          {error}
        </div>
      )}
      <button
        onClick={handleRequest}
        disabled={requesting}
        style={{
          padding: "10px 20px",
          background: "var(--io-accent, #4A9EFF)",
          border: "none",
          borderRadius: "8px",
          cursor: requesting ? "not-allowed" : "pointer",
          color: "var(--io-accent-foreground)",
          fontSize: "14px",
          fontWeight: 600,
          opacity: requesting ? 0.7 : 1,
          alignSelf: "flex-start",
        }}
      >
        {requesting ? "Requesting…" : "Request Transfer"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transfer pending banner — shown to requester while waiting for grant
// ---------------------------------------------------------------------------

function TransferPendingBanner({
  instanceId,
  onTransferCancelled,
}: {
  instanceId: string;
  onTransferCancelled: () => void;
}) {
  return (
    <div
      style={{
        background: "rgba(74,158,255,0.1)",
        border: "1px solid rgba(74,158,255,0.4)",
        borderRadius: "10px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: "15px",
          color: "var(--io-text-primary)",
        }}
      >
        Transfer Pending
      </div>
      <div style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}>
        A transfer request has been sent to the current owner. The round will be
        automatically transferred to you if they do not acknowledge within 1
        minute.
      </div>
      <button
        onClick={onTransferCancelled}
        style={{
          padding: "8px 16px",
          background: "none",
          border: "1px solid var(--io-border)",
          borderRadius: "6px",
          cursor: "pointer",
          color: "var(--io-text-secondary)",
          fontSize: "13px",
          alignSelf: "flex-start",
        }}
      >
        Cancel Request
      </button>
      <div style={{ fontSize: "11px", color: "var(--io-text-muted)" }}>
        Instance: {instanceId} — polling for transfer grant every 10 seconds…
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incoming transfer request banner — shown to current owner
// ---------------------------------------------------------------------------

function IncomingTransferBanner({
  requestedByUser,
  instanceId,
  onResponded,
}: {
  requestedByUser: string;
  instanceId: string;
  onResponded: () => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    const result = await roundsApi.acceptTransfer(instanceId);
    setAccepting(false);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    onResponded();
  };

  const handleDecline = async () => {
    setDeclining(true);
    setError(null);
    const result = await roundsApi.declineTransfer(instanceId);
    setDeclining(false);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    onResponded();
  };

  return (
    <div
      style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.35)",
        borderRadius: "10px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: "14px",
          color: "var(--io-text-primary)",
        }}
      >
        Transfer Requested
      </div>
      <div style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}>
        <strong>{requestedByUser}</strong> has requested to take over this
        round. If you do not respond within 1 minute, it will be automatically
        transferred.
      </div>
      {error && (
        <div style={{ fontSize: "12px", color: "var(--io-alarm-urgent)" }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleAccept}
          disabled={accepting || declining}
          style={{
            padding: "8px 16px",
            background: "var(--io-alarm-normal)",
            border: "none",
            borderRadius: "6px",
            cursor: accepting || declining ? "not-allowed" : "pointer",
            color: "var(--io-text-inverse)",
            fontSize: "13px",
            fontWeight: 600,
            opacity: accepting || declining ? 0.7 : 1,
          }}
        >
          {accepting ? "Accepting…" : "Accept"}
        </button>
        <button
          onClick={handleDecline}
          disabled={accepting || declining}
          style={{
            padding: "8px 16px",
            background: "none",
            border: "1px solid var(--io-border)",
            borderRadius: "6px",
            cursor: accepting || declining ? "not-allowed" : "pointer",
            color: "var(--io-text-secondary)",
            fontSize: "13px",
            fontWeight: 600,
            opacity: accepting || declining ? 0.7 : 1,
          }}
        >
          {declining ? "Declining…" : "Decline"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barcode gate — scans via BarcodeDetector API or manual entry fallback
// ---------------------------------------------------------------------------

function BarcodeGate({
  expectedValue,
  onUnlock,
}: {
  expectedValue?: string;
  onUnlock: (scanned: string) => void;
}) {
  const [manualValue, setManualValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const codeReaderRef = useRef<any>(null);

  // BarcodeDetector API scan
  const startScan = async () => {
    setScanError(null);
    if (!("BarcodeDetector" in window)) {
      // iOS/Safari: fall back to zxing-js (dynamic import — only loaded when needed)
      const { BrowserMultiFormatReader, NotFoundException } =
        await import("@zxing/library");
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
      try {
        await codeReader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current!,
          (result: any, err: any) => {
            if (result) {
              codeReader.reset();
              codeReaderRef.current = null;
              stopScan();
              const raw = result.getText();
              if (expectedValue && raw !== expectedValue) {
                setScanError(`Wrong barcode. Expected: ${expectedValue}`);
                return;
              }
              onUnlock(raw);
            }
            if (err && !(err instanceof NotFoundException)) {
              // transient decode errors during scanning are normal — ignore them
            }
          },
        );
        setScanning(true);
      } catch {
        codeReaderRef.current = null;
        setScanError("Camera access denied.");
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);

      // @ts-expect-error BarcodeDetector not in TS lib yet
      const detector = new window.BarcodeDetector({
        formats: [
          "qr_code",
          "code_128",
          "code_39",
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "data_matrix",
        ],
      });
      const interval = setInterval(async () => {
        if (!videoRef.current) {
          clearInterval(interval);
          return;
        }
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            clearInterval(interval);
            stopScan();
            const raw = barcodes[0].rawValue as string;
            if (expectedValue && raw !== expectedValue) {
              setScanError(`Wrong barcode. Expected: ${expectedValue}`);
              return;
            }
            onUnlock(raw);
          }
        } catch {
          /* ignore detection frames errors */
        }
      }, 300);

      // Auto-stop after 30s
      setTimeout(() => {
        clearInterval(interval);
        stopScan();
      }, 30_000);
    } catch (err) {
      setScanError("Camera access denied.");
      setScanning(false);
    }
  };

  const stopScan = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(
    () => () => {
      stopScan();
    },
    [],
  );

  const handleManualSubmit = () => {
    const v = manualValue.trim();
    if (!v) return;
    if (expectedValue && v !== expectedValue) {
      setScanError(`Incorrect. Expected barcode: ${expectedValue}`);
      return;
    }
    onUnlock(v);
  };

  return (
    <div
      style={{
        padding: "16px",
        background: "rgba(251,191,36,0.08)",
        border: "1px solid rgba(251,191,36,0.3)",
        borderRadius: "8px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontSize: "20px" }}>◉</span>
        <span
          style={{
            fontWeight: 700,
            fontSize: "14px",
            color: "var(--io-text-primary)",
          }}
        >
          Barcode Gate
        </span>
        <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          Scan barcode to unlock this checkpoint
        </span>
      </div>
      {scanning ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <video
            ref={videoRef}
            style={{
              width: "100%",
              maxHeight: "200px",
              borderRadius: "6px",
              background: "var(--io-surface-primary)",
            }}
            playsInline
            muted
          />
          <button
            onClick={stopScan}
            style={{
              padding: "8px",
              background: "none",
              border: "1px solid var(--io-border)",
              borderRadius: "6px",
              color: "var(--io-text-secondary)",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Cancel scan
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            onClick={startScan}
            style={{
              padding: "10px 16px",
              background: "var(--io-accent)",
              border: "none",
              borderRadius: "6px",
              color: "var(--io-accent-foreground)",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Scan Barcode
          </button>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type="text"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="Or enter barcode manually…"
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              style={{
                flex: 1,
                padding: "8px 10px",
                background: "var(--io-surface)",
                border: "1px solid var(--io-border)",
                borderRadius: "6px",
                color: "var(--io-text-primary)",
                fontSize: "13px",
              }}
            />
            <button
              onClick={handleManualSubmit}
              style={{
                padding: "8px 14px",
                background: "var(--io-surface-elevated)",
                border: "1px solid var(--io-border)",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "13px",
                color: "var(--io-text-secondary)",
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
      {scanError && (
        <div
          style={{
            marginTop: "8px",
            fontSize: "12px",
            color: "var(--io-alarm-urgent)",
          }}
        >
          {scanError}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GPS gate — checks proximity to configured fence
// ---------------------------------------------------------------------------

function GpsGate({
  lat,
  lng,
  radiusMetres,
  currentGps,
  onUnlock,
}: {
  lat: number;
  lng: number;
  radiusMetres: number;
  currentGps: { lat: number; lng: number } | null;
  onUnlock: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  function haversineMetres(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
    const R = 6371000;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLam = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const checkLocation = () => {
    setGpsError(null);
    setChecking(true);
    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported on this device.");
      setChecking(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineMetres(
          pos.coords.latitude,
          pos.coords.longitude,
          lat,
          lng,
        );
        setChecking(false);
        if (dist <= radiusMetres) {
          onUnlock();
        } else {
          setGpsError(
            `Too far away (${Math.round(dist)}m). Must be within ${radiusMetres}m.`,
          );
        }
      },
      () => {
        setGpsError("Could not get location. Check GPS/location permissions.");
        setChecking(false);
      },
      { timeout: 10_000, enableHighAccuracy: true },
    );
  };

  // If we already have GPS from earlier capture, check immediately
  useEffect(() => {
    if (currentGps) {
      const dist = haversineMetres(currentGps.lat, currentGps.lng, lat, lng);
      if (dist <= radiusMetres) onUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        padding: "16px",
        background: "rgba(34,197,94,0.08)",
        border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: "8px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontSize: "20px" }}>◎</span>
        <span
          style={{
            fontWeight: 700,
            fontSize: "14px",
            color: "var(--io-text-primary)",
          }}
        >
          GPS Gate
        </span>
        <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          Must be within {radiusMetres}m of equipment
        </span>
      </div>
      <button
        onClick={checkLocation}
        disabled={checking}
        style={{
          padding: "10px 16px",
          background: checking
            ? "var(--io-surface-elevated)"
            : "var(--io-accent)",
          border: "none",
          borderRadius: "6px",
          color: checking
            ? "var(--io-text-muted)"
            : "var(--io-accent-foreground)",
          fontWeight: 600,
          cursor: checking ? "not-allowed" : "pointer",
          fontSize: "14px",
        }}
      >
        {checking ? "Getting location…" : "Check My Location"}
      </button>
      {gpsError && (
        <div
          style={{
            marginTop: "8px",
            fontSize: "12px",
            color: "var(--io-alarm-urgent)",
          }}
        >
          {gpsError}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getThresholdHelperText(cp: Checkpoint): string | null {
  const v = cp.validation;
  if (!v || cp.data_type !== "numeric") return null;
  const parts: string[] = [];
  if (v.ll !== undefined) parts.push(`LL: ${v.ll}`);
  if (v.l !== undefined) parts.push(`L: ${v.l}`);
  if (v.h !== undefined) parts.push(`H: ${v.h}`);
  if (v.hh !== undefined) parts.push(`HH: ${v.hh}`);
  if (v.min !== undefined) parts.push(`min: ${v.min}`);
  if (v.max !== undefined) parts.push(`max: ${v.max}`);
  return parts.length ? parts.join("  ·  ") : null;
}

function evaluateNumericColor(value: string, cp: Checkpoint): string {
  const v = cp.validation;
  if (!v) return "var(--io-text-primary)";
  const n = parseFloat(value);
  if (isNaN(n)) return "var(--io-text-primary)";
  if ((v.hh !== undefined && n >= v.hh) || (v.ll !== undefined && n <= v.ll)) {
    return "var(--io-alarm-urgent)"; // alarm
  }
  if ((v.h !== undefined && n > v.h) || (v.l !== undefined && n < v.l)) {
    return "var(--io-alarm-high)"; // advisory
  }
  return "var(--io-alarm-normal)"; // in range
}

// ---------------------------------------------------------------------------
// Individual checkpoint input
// ---------------------------------------------------------------------------

function CheckpointInput({
  checkpoint,
  value,
  onChange,
  comment,
  onCommentChange,
  onVideoCapture,
  onAudioCapture,
  videoCaptured,
  audioCaptured,
}: {
  checkpoint: Checkpoint;
  value: string;
  onChange: (v: string) => void;
  comment: string;
  onCommentChange: (v: string) => void;
  onVideoCapture: (blob: Blob | null) => void;
  onAudioCapture: (blob: Blob | null) => void;
  videoCaptured: boolean;
  audioCaptured: boolean;
}) {
  const [videoRecording, setVideoRecording] = useState(false);
  const [audioRecording, setAudioRecording] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const startVideoRecording = async () => {
    setVideoError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVideoError("Camera access is not supported on this device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      videoStreamRef.current = stream;
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      videoRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        onVideoCapture(blob);
        stream.getTracks().forEach((t) => t.stop());
        videoStreamRef.current = null;
        videoRecorderRef.current = null;
        setVideoRecording(false);
      };
      recorder.start();
      setVideoRecording(true);
    } catch {
      setVideoError("Could not access camera. Check browser permissions.");
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorderRef.current && videoRecording) {
      videoRecorderRef.current.stop();
    }
  };

  const startAudioRecording = async () => {
    setAudioError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setAudioError("Microphone access is not supported on this device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      audioRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        onAudioCapture(blob);
        stream.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        audioRecorderRef.current = null;
        setAudioRecording(false);
      };
      recorder.start();
      setAudioRecording(true);
    } catch {
      setAudioError("Could not access microphone. Check browser permissions.");
    }
  };

  const stopAudioRecording = () => {
    if (audioRecorderRef.current && audioRecording) {
      audioRecorderRef.current.stop();
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    background: "var(--io-surface-secondary)",
    border: "1px solid var(--io-border)",
    borderRadius: "6px",
    color: "var(--io-text-primary)",
    fontSize: "16px",
    boxSizing: "border-box" as const,
  };

  const numericColor =
    checkpoint.data_type === "numeric" && value
      ? evaluateNumericColor(value, checkpoint)
      : "var(--io-text-primary)";

  const helperText = getThresholdHelperText(checkpoint);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Main input */}
      {checkpoint.data_type === "text" && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="Enter response…"
          style={{ ...inputStyle, resize: "vertical", fontSize: "14px" }}
        />
      )}

      {checkpoint.data_type === "numeric" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="number"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="0"
              style={{
                ...inputStyle,
                color: numericColor,
                fontWeight: 600,
                width: "auto",
                flex: 1,
              }}
            />
            {checkpoint.unit && (
              <span
                style={{
                  color: "var(--io-text-secondary)",
                  fontSize: "14px",
                  whiteSpace: "nowrap",
                }}
              >
                {checkpoint.unit}
              </span>
            )}
          </div>
          {helperText && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--io-text-muted)",
                marginTop: "6px",
              }}
            >
              Thresholds: {helperText}
            </div>
          )}
        </div>
      )}

      {checkpoint.data_type === "boolean" && (
        <div style={{ display: "flex", gap: "12px" }}>
          {(["true", "false"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              style={{
                flex: 1,
                height: "60px",
                border: `2px solid ${value === opt ? "var(--io-accent, #4A9EFF)" : "var(--io-border)"}`,
                borderRadius: "8px",
                background:
                  value === opt
                    ? "var(--io-accent-subtle, rgba(74,158,255,0.15))"
                    : "var(--io-surface-secondary)",
                color:
                  value === opt
                    ? "var(--io-accent, #4A9EFF)"
                    : "var(--io-text-secondary)",
                fontSize: "16px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {opt === "true" ? "Yes" : "No"}
            </button>
          ))}
        </div>
      )}

      {checkpoint.data_type === "dropdown" && checkpoint.options && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select…</option>
          {checkpoint.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {checkpoint.data_type === "multi_field" && checkpoint.fields && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {checkpoint.fields.map((field) => {
            let parsed: Record<string, string> = {};
            try {
              parsed = value ? JSON.parse(value) : {};
            } catch {
              /* ignore */
            }
            return (
              <div
                key={field.name}
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <label
                  style={{
                    fontSize: "12px",
                    color: "var(--io-text-secondary)",
                  }}
                >
                  {field.name}
                </label>
                <input
                  type={field.type === "numeric" ? "number" : "text"}
                  value={parsed[field.name] ?? ""}
                  onChange={(e) => {
                    let current: Record<string, string> = {};
                    try {
                      current = value ? JSON.parse(value) : {};
                    } catch {
                      /* ignore */
                    }
                    onChange(
                      JSON.stringify({
                        ...current,
                        [field.name]: e.target.value,
                      }),
                    );
                  }}
                  style={inputStyle}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Video capture */}
      {checkpoint.media_requirements?.video && (
        <div>
          <label
            style={{
              fontSize: "12px",
              color: "var(--io-text-secondary)",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Video Recording
            {checkpoint.media_requirements.video === "required" && (
              <span
                style={{ color: "var(--io-alarm-urgent)", marginLeft: "4px" }}
              >
                *
              </span>
            )}
          </label>
          {videoError && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--io-alarm-urgent)",
                marginBottom: "6px",
              }}
            >
              {videoError}
            </div>
          )}
          {videoCaptured ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{ fontSize: "13px", color: "var(--io-alarm-normal)" }}
              >
                Video recorded
              </span>
              <button
                onClick={() => {
                  onVideoCapture(null);
                  setVideoError(null);
                }}
                style={{
                  fontSize: "12px",
                  background: "none",
                  border: "1px solid var(--io-border)",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  cursor: "pointer",
                  color: "var(--io-text-secondary)",
                }}
              >
                Re-record
              </button>
            </div>
          ) : (
            <button
              onClick={
                videoRecording ? stopVideoRecording : startVideoRecording
              }
              style={{
                padding: "10px 16px",
                background: videoRecording
                  ? "var(--io-alarm-urgent)"
                  : "var(--io-surface-secondary)",
                border: `1px solid ${videoRecording ? "var(--io-alarm-urgent)" : "var(--io-border)"}`,
                borderRadius: "6px",
                cursor: "pointer",
                color: videoRecording
                  ? "var(--io-text-inverse)"
                  : "var(--io-text-primary)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {videoRecording ? "Stop Recording" : "Record Video"}
            </button>
          )}
        </div>
      )}

      {/* Audio capture */}
      {checkpoint.media_requirements?.audio && (
        <div>
          <label
            style={{
              fontSize: "12px",
              color: "var(--io-text-secondary)",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Audio Note
            {checkpoint.media_requirements.audio === "required" && (
              <span
                style={{ color: "var(--io-alarm-urgent)", marginLeft: "4px" }}
              >
                *
              </span>
            )}
          </label>
          {audioError && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--io-alarm-urgent)",
                marginBottom: "6px",
              }}
            >
              {audioError}
            </div>
          )}
          {audioCaptured ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{ fontSize: "13px", color: "var(--io-alarm-normal)" }}
              >
                Audio recorded
              </span>
              <button
                onClick={() => {
                  onAudioCapture(null);
                  setAudioError(null);
                }}
                style={{
                  fontSize: "12px",
                  background: "none",
                  border: "1px solid var(--io-border)",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  cursor: "pointer",
                  color: "var(--io-text-secondary)",
                }}
              >
                Re-record
              </button>
            </div>
          ) : (
            <button
              onClick={
                audioRecording ? stopAudioRecording : startAudioRecording
              }
              style={{
                padding: "10px 16px",
                background: audioRecording
                  ? "var(--io-alarm-urgent)"
                  : "var(--io-surface-secondary)",
                border: `1px solid ${audioRecording ? "var(--io-alarm-urgent)" : "var(--io-border)"}`,
                borderRadius: "6px",
                cursor: "pointer",
                color: audioRecording
                  ? "var(--io-text-inverse)"
                  : "var(--io-text-primary)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {audioRecording ? "Stop Recording" : "Record Audio"}
            </button>
          )}
        </div>
      )}

      {/* Comment field */}
      <div>
        <label
          style={{
            fontSize: "12px",
            color: "var(--io-text-secondary)",
            display: "block",
            marginBottom: "4px",
          }}
        >
          Comments
          {checkpoint.media_requirements?.comments === "required" && (
            <span
              style={{ color: "var(--io-alarm-urgent)", marginLeft: "4px" }}
            >
              *
            </span>
          )}
        </label>
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          rows={2}
          placeholder="Add a comment…"
          style={{ ...inputStyle, resize: "vertical", fontSize: "13px" }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RoundPlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  const canExecute = permissions.includes("rounds:execute");

  const [checkpointIdx, setCheckpointIdx] = useState(0);
  const [values, setValues] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Gate unlock state: tracks which checkpoint indexes have their barcode/GPS gates cleared
  const [barcodeUnlocked, setBarcodeUnlocked] = useState<
    Record<number, boolean>
  >({});
  const [gpsUnlocked, setGpsUnlocked] = useState<Record<number, boolean>>({});
  const [videoBlobs, setVideoBlobs] = useState<Record<number, Blob | null>>({});
  const [audioBlobs, setAudioBlobs] = useState<Record<number, Blob | null>>({});
  // Transfer state — set to true after calling transferInstance so we know to poll
  const [transferPending, setTransferPending] = useState(false);

  const {
    isOnline,
    pendingCount,
    saveOfflineResponse,
    getPendingResponses,
    clearSynced,
    syncPending,
  } = useOfflineRounds();

  // Check if the operator is currently badged-in (doc 14 §Non-Badged Entry Flagging)
  const { data: presenceData } = useQuery({
    queryKey: ["presence", userId],
    queryFn: async () => {
      if (!userId) return null;
      const result = await shiftsApi.getPresence(userId);
      return result.success ? result.data : null;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
  const operatorNotBadged =
    presenceData !== undefined &&
    presenceData !== null &&
    !presenceData.on_site;

  const { data: detailResult, isLoading } = useQuery({
    queryKey: ["rounds", "instance", id],
    queryFn: () => roundsApi.getInstance(id!),
    enabled: !!id,
    // Poll every 10 seconds while a transfer is pending so we can detect grant
    refetchInterval: transferPending ? 10_000 : false,
  });

  // Clear transferPending once the server grants the lock to us
  const latestLockedToUser = detailResult?.success
    ? (
        detailResult.data as typeof detailResult.data & {
          locked_to_user?: string;
        }
      ).locked_to_user
    : undefined;
  useEffect(() => {
    if (transferPending && latestLockedToUser === userId) {
      setTransferPending(false);
    }
  }, [transferPending, latestLockedToUser, userId]);

  // Silently capture GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        /* ignore errors */
      },
      { timeout: 5000 },
    );
  }, [checkpointIdx]);

  // Pre-populate responses from existing data
  useEffect(() => {
    if (!detailResult?.success) return;
    const { responses } = detailResult.data;
    const vals: Record<number, string> = {};
    responses.forEach((r) => {
      if (r.response_type === "boolean") {
        vals[r.checkpoint_index] = String(r.response_value);
      } else if (r.response_type === "multi_field") {
        vals[r.checkpoint_index] = JSON.stringify(r.response_value);
      } else {
        vals[r.checkpoint_index] = String(r.response_value ?? "");
      }
    });
    setValues(vals);
  }, [detailResult]);

  // Auto-sync pending offline responses when connectivity is restored.
  // Prefers the batch endpoint (one request per instance) for efficiency on
  // poor mobile connections; falls back to one-at-a-time if batch partially
  // fails so no responses are silently dropped.
  useEffect(() => {
    if (!isOnline || pendingCount === 0 || !id) return;

    getPendingResponses().then(async (pending) => {
      if (pending.length === 0) return;

      // Group responses by instanceId so we can batch-submit per instance.
      const byInstance = pending.reduce<Record<string, typeof pending>>(
        (acc, p) => {
          (acc[p.instanceId] ??= []).push(p);
          return acc;
        },
        {},
      );

      for (const [instId, items] of Object.entries(byInstance)) {
        const synced = await batchSyncRounds(instId, items);

        if (synced === items.length) {
          // All items synced — remove them from the queue.
          await clearSynced(
            items.map((i) => i.id!).filter(Boolean) as number[],
          );
        } else {
          // Batch partially failed — fall back to one-at-a-time for this
          // instance so individual items can succeed/fail independently.
          await syncPending(async (p) => {
            if (p.instanceId !== instId) return false;
            const item: ResponseItem = {
              checkpoint_index: parseInt(p.checkpointId, 10),
              response_type: "text",
              response_value: p.value,
              gps_latitude: undefined,
              gps_longitude: undefined,
            };
            const result = await roundsApi.saveResponses(p.instanceId, [item]);
            return result.success;
          });
        }
      }
    });
  }, [
    isOnline,
    pendingCount,
    id,
    getPendingResponses,
    clearSynced,
    syncPending,
  ]);

  const saveCurrentResponse = useCallback(
    async (cpIndex: number): Promise<boolean> => {
      if (!id || !detailResult?.success) return true;
      const { template } = detailResult.data;
      if (!template) return true;

      const checkpoints = Array.isArray(template.checkpoints)
        ? template.checkpoints
        : [];
      const cp = checkpoints[cpIndex];
      if (!cp) return true;

      // Block advancement if required video not captured
      if (cp.media_requirements?.video === "required" && !videoBlobs[cpIndex]) {
        setError("Video capture is required for this checkpoint.");
        return false;
      }

      // Block advancement if required audio not captured
      if (cp.media_requirements?.audio === "required" && !audioBlobs[cpIndex]) {
        setError("Audio recording is required for this checkpoint.");
        return false;
      }

      const rawValue = values[cpIndex];
      if (rawValue === undefined || rawValue === "") return true; // skip empty optional

      let responseValue: unknown = rawValue;
      if (cp.data_type === "numeric") responseValue = parseFloat(rawValue);
      else if (cp.data_type === "boolean") responseValue = rawValue === "true";
      else if (cp.data_type === "multi_field") {
        try {
          responseValue = JSON.parse(rawValue);
        } catch {
          responseValue = rawValue;
        }
      }

      const comment = comments[cpIndex];
      const commentField = comment ? { _comment: comment } : {};
      if (cp.data_type !== "multi_field" && comment) {
        responseValue = { value: responseValue, ...commentField };
      }

      setSaving(true);

      // When offline, save to IndexedDB and return success so the player advances
      if (!isOnline) {
        await saveOfflineResponse({
          instanceId: id,
          checkpointId: String(cpIndex),
          value: rawValue,
          notes: comments[cpIndex] ?? "",
          timestamp: new Date().toISOString(),
        });
        setSaving(false);
        return true;
      }

      // Convert media blobs to base64 for attachment in payload
      const blobToBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve((reader.result as string).split(",")[1] ?? "");
          reader.onerror = () => reject(new Error("Failed to read media blob"));
          reader.readAsDataURL(blob);
        });

      let videoAttachment: string | undefined;
      let audioAttachment: string | undefined;
      if (videoBlobs[cpIndex]) {
        videoAttachment = await blobToBase64(videoBlobs[cpIndex]!);
      }
      if (audioBlobs[cpIndex]) {
        audioAttachment = await blobToBase64(audioBlobs[cpIndex]!);
      }

      const item: ResponseItem = {
        checkpoint_index: cpIndex,
        response_type: cp.data_type,
        response_value: responseValue,
        gps_latitude: gps?.lat,
        gps_longitude: gps?.lng,
        flagged_not_badged: operatorNotBadged || undefined,
        video_attachment: videoAttachment,
        audio_attachment: audioAttachment,
      };

      const result = await roundsApi.saveResponses(id, [item]);
      setSaving(false);

      if (!result.success) {
        setError(result.error.message);
        return false;
      }
      return true;
    },
    [
      id,
      detailResult,
      values,
      comments,
      gps,
      isOnline,
      saveOfflineResponse,
      videoBlobs,
      audioBlobs,
    ],
  );

  // Helper: resolve the raw checkpoint index for a given visible-list position.
  // Needed because saveCurrentResponse uses raw checkpoint index to look up
  // values and checkpoints[]. Returns the raw index or the visible position as
  // a fallback when template data is unavailable.
  function getRawCheckpointIndex(visiblePos: number): number {
    if (!detailResult?.success) return visiblePos;
    const cps: Checkpoint[] = Array.isArray(
      detailResult.data.template?.checkpoints,
    )
      ? detailResult.data.template!.checkpoints
      : [];
    const indexes = cps
      .map((cp, i) => ({ cp, i }))
      .filter(({ cp }) => {
        if (!cp.condition) return true;
        const { depends_on_index, operator, value: condValue } = cp.condition;
        const rawAnswer = values[depends_on_index] ?? "";
        const numAnswer = parseFloat(rawAnswer);
        const numCond = parseFloat(condValue);
        const bothNumeric = !isNaN(numAnswer) && !isNaN(numCond);
        switch (operator) {
          case "eq":
            return bothNumeric
              ? numAnswer === numCond
              : rawAnswer === condValue;
          case "ne":
            return bothNumeric
              ? numAnswer !== numCond
              : rawAnswer !== condValue;
          case "gt":
            return bothNumeric ? numAnswer > numCond : rawAnswer > condValue;
          case "lt":
            return bothNumeric ? numAnswer < numCond : rawAnswer < condValue;
          case "gte":
            return bothNumeric ? numAnswer >= numCond : rawAnswer >= condValue;
          case "lte":
            return bothNumeric ? numAnswer <= numCond : rawAnswer <= condValue;
          case "contains":
            return rawAnswer.includes(condValue);
          default:
            return true;
        }
      })
      .map(({ i }) => i);
    return indexes[visiblePos] ?? visiblePos;
  }

  // Gates are per-checkpoint — reset for the target index when navigating
  const handleNext = async () => {
    const rawIdx = getRawCheckpointIndex(checkpointIdx);
    const ok = await saveCurrentResponse(rawIdx);
    if (!ok) return;
    setCheckpointIdx((i) => i + 1);
    setError(null);
  };

  const handlePrev = () => {
    setCheckpointIdx((i) => Math.max(0, i - 1));
    setError(null);
  };

  const handleComplete = async () => {
    if (!id) return;
    const rawIdx = getRawCheckpointIndex(checkpointIdx);
    const ok = await saveCurrentResponse(rawIdx);
    if (!ok) return;

    setCompleting(true);
    const result = await roundsApi.completeInstance(id);
    setCompleting(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["rounds"] });
    navigate("/rounds");
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--io-text-muted)",
        }}
      >
        Loading round…
      </div>
    );
  }

  if (!detailResult?.success) {
    return (
      <div style={{ padding: "24px", color: "var(--io-alarm-urgent)" }}>
        {detailResult?.error?.message ?? "Failed to load round."}
      </div>
    );
  }

  const { template } = detailResult.data;
  const { locked_to_user, transfer_requested_by } =
    detailResult.data as typeof detailResult.data & {
      transfer_requested_by?: string;
    };
  const currentStatus = detailResult.data.status;

  // ---- Transfer gate: if round is locked to another user (and not completed/missed) ----
  const isLockedToOther =
    currentStatus === "in_progress" &&
    !!locked_to_user &&
    locked_to_user !== userId;
  const hasIncomingRequest =
    currentStatus === "in_progress" &&
    locked_to_user === userId &&
    !!transfer_requested_by;

  if (isLockedToOther) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          maxWidth: "600px",
          margin: "0 auto",
          padding: "24px 16px",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/rounds")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-text-secondary)",
              padding: "4px",
              fontSize: "18px",
            }}
          >
            ←
          </button>
          <div
            style={{
              fontWeight: 700,
              fontSize: "16px",
              color: "var(--io-text-primary)",
            }}
          >
            {template?.name ?? "Round"}
          </div>
        </div>

        {transferPending ? (
          <TransferPendingBanner
            instanceId={id!}
            onTransferCancelled={() => {
              setTransferPending(false);
              queryClient.invalidateQueries({
                queryKey: ["rounds", "instance", id],
              });
            }}
          />
        ) : canExecute ? (
          <LockedByOtherBanner
            lockedToUser={locked_to_user}
            instanceId={id!}
            onTransferRequested={() => {
              setTransferPending(true);
              queryClient.invalidateQueries({
                queryKey: ["rounds", "instance", id],
              });
            }}
          />
        ) : (
          <div
            style={{
              background: "var(--io-surface)",
              border: "1px solid var(--io-border)",
              borderRadius: "10px",
              padding: "20px",
              fontSize: "14px",
              color: "var(--io-text-secondary)",
            }}
          >
            This round is locked to <strong>{locked_to_user}</strong>. You do
            not have permission to request a transfer.
          </div>
        )}
      </div>
    );
  }

  const checkpoints: Checkpoint[] = Array.isArray(template?.checkpoints)
    ? template.checkpoints
    : [];
  const totalCheckpoints = checkpoints.length;

  if (totalCheckpoints === 0) {
    return (
      <div style={{ padding: "24px", color: "var(--io-text-muted)" }}>
        This round has no checkpoints.
      </div>
    );
  }

  // Evaluate a checkpoint's condition against current response values.
  // Returns true if the checkpoint should be visible (no condition, or condition met).
  function evaluateCondition(cp: Checkpoint): boolean {
    if (!cp.condition) return true;
    const { depends_on_index, operator, value: condValue } = cp.condition;
    const rawAnswer = values[depends_on_index] ?? "";
    // Attempt numeric comparison first; fall back to string comparison
    const numAnswer = parseFloat(rawAnswer);
    const numCond = parseFloat(condValue);
    const bothNumeric = !isNaN(numAnswer) && !isNaN(numCond);
    switch (operator) {
      case "eq":
        return bothNumeric ? numAnswer === numCond : rawAnswer === condValue;
      case "ne":
        return bothNumeric ? numAnswer !== numCond : rawAnswer !== condValue;
      case "gt":
        return bothNumeric ? numAnswer > numCond : rawAnswer > condValue;
      case "lt":
        return bothNumeric ? numAnswer < numCond : rawAnswer < condValue;
      case "gte":
        return bothNumeric ? numAnswer >= numCond : rawAnswer >= condValue;
      case "lte":
        return bothNumeric ? numAnswer <= numCond : rawAnswer <= condValue;
      case "contains":
        return rawAnswer.includes(condValue);
      default:
        return true;
    }
  }

  // Build the list of visible checkpoint indexes (those with no condition or condition met).
  // The raw checkpoint index is used as key in `values` so stored responses are preserved
  // even if conditions change.
  const visibleCheckpointIndexes: number[] = checkpoints
    .map((cp, i) => ({ cp, i }))
    .filter(({ cp }) => evaluateCondition(cp))
    .map(({ i }) => i);

  const totalVisible = visibleCheckpointIndexes.length;

  // Map checkpointIdx (position within visible list) to the raw checkpoint index
  const visiblePosition = Math.min(
    checkpointIdx,
    Math.max(0, totalVisible - 1),
  );
  const clampedIdx = visibleCheckpointIndexes[visiblePosition] ?? 0;
  const cp = checkpoints[clampedIdx];
  const isLastCheckpoint = visiblePosition === totalVisible - 1;
  const progressPct =
    totalVisible > 0 ? ((visiblePosition + 1) / totalVisible) * 100 : 100;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "0 16px",
      }}
    >
      {/* Non-badged warning — operator not currently on-site per presence data (doc 14.3) */}
      {operatorNotBadged && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            borderBottom: "1px solid rgba(239,68,68,0.3)",
            padding: "8px 16px",
            fontSize: "12px",
            color: "var(--io-alarm-urgent)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700 }}>Not Badged In</span>
          <span>
            — You are not currently badged on-site. This round will be flagged
            for review.
          </span>
        </div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div
          style={{
            background: "rgba(251,191,36,0.15)",
            borderBottom: "1px solid rgba(251,191,36,0.4)",
            padding: "8px 16px",
            fontSize: "12px",
            color: "var(--io-alarm-high)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700 }}>Offline</span>
          <span>— Responses will sync when connection is restored.</span>
          {pendingCount > 0 && (
            <span
              style={{
                marginLeft: "auto",
                background: "rgba(251,191,36,0.3)",
                padding: "2px 8px",
                borderRadius: "100px",
                fontWeight: 600,
              }}
            >
              {pendingCount} pending
            </span>
          )}
        </div>
      )}

      {/* Sync confirmation banner (online with pending items) */}
      {isOnline && pendingCount > 0 && (
        <div
          style={{
            background: "rgba(34,197,94,0.1)",
            borderBottom: "1px solid rgba(34,197,94,0.3)",
            padding: "8px 16px",
            fontSize: "12px",
            color: "var(--io-alarm-normal)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          <span>
            Syncing {pendingCount} offline response
            {pendingCount !== 1 ? "s" : ""}…
          </span>
        </div>
      )}

      {/* Incoming transfer request banner — shown to current owner when another user has requested a transfer */}
      {hasIncomingRequest && transfer_requested_by && (
        <IncomingTransferBanner
          requestedByUser={transfer_requested_by}
          instanceId={id!}
          onResponded={() => {
            queryClient.invalidateQueries({
              queryKey: ["rounds", "instance", id],
            });
            queryClient.invalidateQueries({ queryKey: ["rounds"] });
          }}
        />
      )}

      {/* Header */}
      <div
        style={{
          padding: "16px 0 12px",
          borderBottom: "1px solid var(--io-border)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          <button
            onClick={() => navigate("/rounds")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-text-secondary)",
              padding: "4px",
              fontSize: "18px",
            }}
          >
            ←
          </button>
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: "16px",
                color: "var(--io-text-primary)",
              }}
            >
              {template?.name ?? "Round"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
              Checkpoint {visiblePosition + 1} of {totalVisible}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: "4px",
            background: "var(--io-surface-secondary)",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: "var(--io-accent, #4A9EFF)",
              borderRadius: "2px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Checkpoint content */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 0" }}>
        <div
          style={{
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: "10px",
            padding: "20px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--io-text-primary)",
                flex: 1,
              }}
            >
              {cp.title}
              {cp.required && (
                <span
                  style={{
                    color: "var(--io-alarm-urgent)",
                    marginLeft: "4px",
                  }}
                >
                  *
                </span>
              )}
            </h2>
            <span
              style={{
                fontSize: "10px",
                padding: "2px 8px",
                borderRadius: "100px",
                background: "var(--io-surface-secondary)",
                color: "var(--io-text-muted)",
                textTransform: "uppercase",
                fontWeight: 600,
                marginLeft: "8px",
                flexShrink: 0,
              }}
            >
              {cp.data_type}
            </span>
          </div>

          {cp.description && (
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "13px",
                color: "var(--io-text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {cp.description}
            </p>
          )}

          {/* Barcode gate — renders above input, blocks data entry until unlocked */}
          {cp.barcode_gate && !barcodeUnlocked[clampedIdx] && (
            <BarcodeGate
              expectedValue={cp.barcode_gate.expected_value}
              onUnlock={(scanned) => {
                void scanned;
                setBarcodeUnlocked((prev) => ({ ...prev, [clampedIdx]: true }));
              }}
            />
          )}

          {/* GPS gate — renders above input (after barcode), blocks until unlocked */}
          {cp.gps_gate && !gpsUnlocked[clampedIdx] && (
            <GpsGate
              lat={cp.gps_gate.lat}
              lng={cp.gps_gate.lng}
              radiusMetres={cp.gps_gate.radius_metres}
              currentGps={gps}
              onUnlock={() =>
                setGpsUnlocked((prev) => ({ ...prev, [clampedIdx]: true }))
              }
            />
          )}

          {/* Only render the data input once all gates are satisfied */}
          {(!cp.barcode_gate || barcodeUnlocked[clampedIdx]) &&
            (!cp.gps_gate || gpsUnlocked[clampedIdx]) && (
              <CheckpointInput
                checkpoint={cp}
                value={values[clampedIdx] ?? ""}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, [clampedIdx]: v }))
                }
                comment={comments[clampedIdx] ?? ""}
                onCommentChange={(v) =>
                  setComments((prev) => ({ ...prev, [clampedIdx]: v }))
                }
                onVideoCapture={(blob) =>
                  setVideoBlobs((prev) => ({ ...prev, [clampedIdx]: blob }))
                }
                onAudioCapture={(blob) =>
                  setAudioBlobs((prev) => ({ ...prev, [clampedIdx]: blob }))
                }
                videoCaptured={!!videoBlobs[clampedIdx]}
                audioCaptured={!!audioBlobs[clampedIdx]}
              />
            )}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "6px",
              color: "var(--io-alarm-urgent)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Saving indicator */}
        {saving && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              textAlign: "center",
              marginBottom: "8px",
            }}
          >
            Saving…
          </div>
        )}
      </div>

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          padding: "16px 0",
          borderTop: "1px solid var(--io-border)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={handlePrev}
          disabled={visiblePosition === 0 || saving}
          style={{
            flex: 1,
            padding: "12px",
            background: "none",
            border: "1px solid var(--io-border)",
            borderRadius: "8px",
            cursor: visiblePosition === 0 || saving ? "not-allowed" : "pointer",
            color: "var(--io-text-secondary)",
            fontSize: "14px",
            fontWeight: 600,
            opacity: visiblePosition === 0 ? 0.4 : 1,
          }}
        >
          ← Previous
        </button>

        {!isLastCheckpoint ? (
          <button
            onClick={handleNext}
            disabled={saving}
            style={{
              flex: 2,
              padding: "12px",
              background: "var(--io-accent, #4A9EFF)",
              border: "none",
              borderRadius: "8px",
              cursor: saving ? "not-allowed" : "pointer",
              color: "var(--io-accent-foreground)",
              fontSize: "14px",
              fontWeight: 600,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Next →"}
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={saving || completing}
            style={{
              flex: 2,
              padding: "12px",
              background: "var(--io-alarm-normal)",
              border: "none",
              borderRadius: "8px",
              cursor: saving || completing ? "not-allowed" : "pointer",
              color: "var(--io-text-inverse)",
              fontSize: "14px",
              fontWeight: 700,
              opacity: saving || completing ? 0.7 : 1,
            }}
          >
            {completing ? "Completing…" : "Complete Round"}
          </button>
        )}
      </div>
    </div>
  );
}
