import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  shiftsApi,
  type ShiftDetail,
  type ShiftCrew,
  type ShiftPattern,
  type CreateShiftPayload,
  type UpdateShiftPayload,
} from "../../api/shifts";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--io-text-secondary)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "var(--io-bg)",
  border: "1px solid var(--io-border)",
  borderRadius: 6,
  color: "var(--io-text-primary)",
  fontSize: 14,
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 80,
  fontFamily: "inherit",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
};

const errorBanner: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(239,68,68,0.1)",
  border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: 6,
  color: "#ef4444",
  fontSize: 13,
  marginBottom: 16,
};

const successBanner: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(34,197,94,0.1)",
  border: "1px solid rgba(34,197,94,0.3)",
  borderRadius: 6,
  color: "#22c55e",
  fontSize: 13,
  marginBottom: 16,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(val: string): string {
  if (!val) return "";
  return new Date(val).toISOString();
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ShiftScheduleEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id && id !== "new");
  const qc = useQueryClient();

  // Form state
  const [name, setName] = useState("");
  const [crewId, setCrewId] = useState("");
  const [patternId, setPatternId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [handoverMinutes, setHandoverMinutes] = useState<number>(30);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string>("scheduled");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Load existing shift for edit
  const { data: shiftDetail } = useQuery<ShiftDetail>({
    queryKey: ["shifts", "detail", id],
    queryFn: async () => {
      const res = await shiftsApi.getShift(id!);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    enabled: isEdit,
  });

  // Populate form from loaded shift
  useEffect(() => {
    if (!shiftDetail) return;
    const s = shiftDetail.shift;
    setName(s.name);
    setCrewId(s.crew_id ?? "");
    setPatternId(s.pattern_id ?? "");
    setStartTime(toDatetimeLocal(s.start_time));
    setEndTime(toDatetimeLocal(s.end_time));
    setHandoverMinutes(s.handover_minutes);
    setNotes(s.notes ?? "");
    setStatus(s.status);
  }, [shiftDetail]);

  // Load crews for dropdown
  const { data: crewsData } = useQuery({
    queryKey: ["shifts", "crews"],
    queryFn: async () => {
      const res = await shiftsApi.listCrews();
      if (!res.success) throw new Error(res.error.message);
      return res.data.data;
    },
  });

  // Load patterns for dropdown
  const { data: patternsData } = useQuery({
    queryKey: ["shifts", "patterns"],
    queryFn: async () => {
      const res = await shiftsApi.listPatterns();
      if (!res.success) throw new Error(res.error.message);
      return res.data.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateShiftPayload) => {
      const res = await shiftsApi.createShift(payload);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts", "list"] });
      setSubmitSuccess(true);
      setSubmitError(null);
      setTimeout(() => navigate("/shifts/schedule"), 1200);
    },
    onError: (e: Error) => {
      setSubmitError(e.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateShiftPayload) => {
      const res = await shiftsApi.updateShift(id!, payload);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts", "list"] });
      qc.invalidateQueries({ queryKey: ["shifts", "detail", id] });
      setSubmitSuccess(true);
      setSubmitError(null);
      setTimeout(() => navigate("/shifts/schedule"), 1200);
    },
    onError: (e: Error) => {
      setSubmitError(e.message);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  // Show skeleton while waiting for edit data to load
  const formReady = !isEdit || Boolean(shiftDetail);
  const isExternal = shiftDetail?.shift.source === "external";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!name.trim()) {
      setSubmitError("Shift name is required.");
      return;
    }
    if (!startTime) {
      setSubmitError("Start time is required.");
      return;
    }
    if (!endTime) {
      setSubmitError("End time is required.");
      return;
    }

    const startIso = fromDatetimeLocal(startTime);
    const endIso = fromDatetimeLocal(endTime);

    if (new Date(endIso) <= new Date(startIso)) {
      setSubmitError("End time must be after start time.");
      return;
    }

    const payload = {
      name: name.trim(),
      crew_id: crewId || undefined,
      pattern_id: patternId || undefined,
      start_time: startIso,
      end_time: endIso,
      handover_minutes: handoverMinutes,
      notes: notes.trim() || undefined,
      ...(isEdit ? { status } : {}),
    };

    if (isEdit) {
      updateMutation.mutate(payload as UpdateShiftPayload);
    } else {
      createMutation.mutate(payload as CreateShiftPayload);
    }
  }

  const crews = crewsData ?? [];
  const patterns = patternsData ?? [];

  return (
    <div style={{ padding: "var(--io-space-6)", maxWidth: 680 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <button
          onClick={() => navigate("/shifts/schedule")}
          style={{
            background: "none",
            border: "1px solid var(--io-border)",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            color: "var(--io-text-secondary)",
            fontSize: 13,
          }}
        >
          ← Back
        </button>
        <div>
          <h2
            style={{
              margin: 0,
              color: "var(--io-text-primary)",
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            {isEdit ? "Edit Shift" : "New Shift"}
          </h2>
          <p
            style={{
              margin: "2px 0 0",
              color: "var(--io-text-muted)",
              fontSize: 13,
            }}
          >
            {isEdit
              ? "Update shift details and status."
              : "Schedule a new shift on the calendar."}
          </p>
        </div>
      </div>

      {/* Form card */}
      {!formReady ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--io-text-muted)",
          }}
        >
          Loading…
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: 8,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {submitError && <div style={errorBanner}>{submitError}</div>}
          {submitSuccess && (
            <div style={successBanner}>
              {isEdit ? "Shift updated." : "Shift created."} Redirecting…
            </div>
          )}

          {isExternal && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(99, 102, 241, 0.08)",
                border: "1px solid rgba(99, 102, 241, 0.25)",
                borderRadius: 8,
                marginBottom: 4,
                fontSize: 13,
                color: "#6366f1",
              }}
            >
              &#128274; This shift is managed by{" "}
              <strong>
                {shiftDetail?.shift.source_system || "an external system"}
              </strong>
              . To modify it, update the source system and re-import.
            </div>
          )}

          {/* Name */}
          <div>
            <label style={fieldLabel}>Shift Name *</label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Day Shift — Week 12"
              required
              disabled={isExternal}
            />
          </div>

          {/* Start / End */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            <div>
              <label style={fieldLabel}>Start Time *</label>
              <input
                type="datetime-local"
                style={inputStyle}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                disabled={isExternal}
              />
            </div>
            <div>
              <label style={fieldLabel}>End Time *</label>
              <input
                type="datetime-local"
                style={inputStyle}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                disabled={isExternal}
              />
            </div>
          </div>

          {/* Crew */}
          <div>
            <label style={fieldLabel}>Crew</label>
            <select
              style={selectStyle}
              value={crewId}
              onChange={(e) => setCrewId(e.target.value)}
              disabled={isExternal}
            >
              <option value="">— No crew assigned —</option>
              {crews.map((c: ShiftCrew) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pattern */}
          <div>
            <label style={fieldLabel}>Shift Pattern</label>
            <select
              style={selectStyle}
              value={patternId}
              onChange={(e) => setPatternId(e.target.value)}
              disabled={isExternal}
            >
              <option value="">— No pattern —</option>
              {patterns.map((p: ShiftPattern) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Handover minutes */}
          <div>
            <label style={fieldLabel}>Handover Duration (minutes)</label>
            <input
              type="number"
              min={0}
              max={120}
              style={{ ...inputStyle, maxWidth: 120 }}
              value={handoverMinutes}
              onChange={(e) => setHandoverMinutes(Number(e.target.value))}
              disabled={isExternal}
            />
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "var(--io-text-muted)",
              }}
            >
              Overlap period for incoming and outgoing crews.
            </p>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label style={fieldLabel}>Status</label>
              <select
                style={selectStyle}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={isExternal}
              >
                {["scheduled", "active", "completed", "cancelled"].map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={fieldLabel}>Notes</label>
            <textarea
              style={textareaStyle}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional handover notes or instructions…"
              disabled={isExternal}
            />
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              paddingTop: 4,
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/shifts/schedule")}
              style={{
                padding: "8px 18px",
                borderRadius: 6,
                border: "1px solid var(--io-border)",
                background: "var(--io-surface)",
                color: "var(--io-text-secondary)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {isExternal ? "Back" : "Cancel"}
            </button>
            {!isExternal && (
              <button
                type="submit"
                disabled={isPending}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: "none",
                  background: isPending
                    ? "var(--io-border)"
                    : "var(--io-accent)",
                  color: "#fff",
                  cursor: isPending ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Shift"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
