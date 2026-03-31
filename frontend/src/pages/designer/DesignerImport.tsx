/**
 * DesignerImport.tsx
 *
 * 6-step wizard for importing DCS graphics into the Designer.
 *
 * Step 1 — Upload:     File upload + platform selector
 * Step 2 — Preview:    Parsed intermediate representation overview + geometry preview
 * Step 3 — Tag Mapping: DCS tags ↔ I/O points side-by-side UI
 * Step 4 — Symbol Mapping: symbol_class ↔ shape library template selector
 * Step 5 — Generate:  Call generate endpoint, show import report
 * Step 6 — Refine:    Navigate to /designer/:id
 *
 * Spec: design-docs/34_DCS_GRAPHICS_IMPORT.md
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PLATFORMS,
  uploadDcsImport,
  createGraphicFromDcsResult,
  listImportJobs,
  type DcsPlatform,
  type DcsImportResult,
  type DcsElement,
  type DcsImportJobSummary,
} from "../../api/dcsImport";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".pdf", ".bmp"]);

const STEP_LABELS = [
  "Upload",
  "Preview",
  "Tag Mapping",
  "Symbol Mapping",
  "Generate",
  "Refine",
];

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const card: React.CSSProperties = {
  background: "var(--io-surface-elevated)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius, 6px)",
  padding: "16px 20px",
};

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--io-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

const primaryBtn: React.CSSProperties = {
  background: "var(--io-accent, #3b82f6)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--io-radius, 6px)",
  padding: "8px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--io-text-muted)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius, 6px)",
  padding: "8px 18px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const disabledBtn: React.CSSProperties = {
  ...primaryBtn,
  opacity: 0.45,
  cursor: "not-allowed",
};

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: number }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        padding: "12px 24px",
        borderBottom: "1px solid var(--io-border)",
        flexShrink: 0,
        overflowX: "auto",
      }}
    >
      {STEP_LABELS.map((label, idx) => {
        const active = idx === current;
        const done = idx < current;
        return (
          <div
            key={label}
            style={{ display: "flex", alignItems: "center", gap: 0 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px",
                borderRadius: 4,
                background: active
                  ? "var(--io-accent-subtle, rgba(59,130,246,0.12))"
                  : "transparent",
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  background: done
                    ? "var(--io-success, #22c55e)"
                    : active
                      ? "var(--io-accent, #3b82f6)"
                      : "var(--io-surface-secondary, #e2e8f0)",
                  color: done || active ? "#fff" : "var(--io-text-muted)",
                  flexShrink: 0,
                }}
              >
                {done ? "✓" : idx + 1}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  color: active
                    ? "var(--io-text-primary)"
                    : done
                      ? "var(--io-text-secondary, #475569)"
                      : "var(--io-text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div
                style={{
                  width: 24,
                  height: 1,
                  background: done
                    ? "var(--io-success, #22c55e)"
                    : "var(--io-border)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Upload
// ---------------------------------------------------------------------------

function Step1Upload({
  onUploadSuccess,
}: {
  onUploadSuccess: (result: DcsImportResult) => void;
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPlatform, setSelectedPlatform] =
    useState<DcsPlatform>("generic_svg");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelect(file: File) {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      navigate("/designer/import/recognition");
      return;
    }
    setSelectedFile(file);
    setError(null);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function handleSubmit() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    const result = await uploadDcsImport(selectedPlatform, selectedFile);
    setUploading(false);
    if (result.success) {
      onUploadSuccess(result.data);
    } else {
      setError(result.error.message);
    }
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 20, padding: 24 }}
    >
      {/* Drag-and-drop zone */}
      <div>
        <div style={label}>DCS Export File</div>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragOver ? "var(--io-accent, #3b82f6)" : "var(--io-border)"}`,
            borderRadius: 8,
            padding: "32px 20px",
            textAlign: "center",
            cursor: "pointer",
            background: dragOver
              ? "var(--io-accent-subtle, rgba(59,130,246,0.06))"
              : "var(--io-surface)",
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.htm,.xml,.xaml,.g,.svg"
            style={{ display: "none" }}
            onChange={onInputChange}
          />
          <div
            style={{
              fontSize: 28,
              marginBottom: 10,
              color: "var(--io-text-muted)",
            }}
          >
            ⬆
          </div>
          {selectedFile ? (
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--io-text-primary)",
                  marginBottom: 4,
                }}
              >
                {selectedFile.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
                {(selectedFile.size / 1024).toFixed(1)} KB — click to change
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--io-text-primary)",
                  marginBottom: 4,
                }}
              >
                Drop file here or click to browse
              </div>
              <div style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
                Accepts: .zip, .htm, .xml, .xaml, .g, .svg
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Platform selector */}
      <div>
        <div style={label}>DCS Platform</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 8,
          }}
        >
          {PLATFORMS.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedPlatform(p.id)}
              style={{
                ...card,
                padding: "10px 14px",
                cursor: "pointer",
                border: `1px solid ${selectedPlatform === p.id ? "var(--io-accent, #3b82f6)" : "var(--io-border)"}`,
                background:
                  selectedPlatform === p.id
                    ? "var(--io-accent-subtle, rgba(59,130,246,0.08))"
                    : "var(--io-surface)",
                transition: "border-color 0.1s, background 0.1s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--io-text-primary)",
                  }}
                >
                  {p.name}
                </span>
                <SupportBadge support={p.support} />
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--io-text-muted)",
                  lineHeight: 1.4,
                }}
              >
                {p.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "var(--io-error-subtle, rgba(239,68,68,0.08))",
            border: "1px solid var(--io-error, #ef4444)",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 13,
            color: "var(--io-error, #ef4444)",
          }}
        >
          {error}
        </div>
      )}

      {/* Footer */}
      <div
        style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}
      >
        <button
          style={!selectedFile || uploading ? disabledBtn : primaryBtn}
          disabled={!selectedFile || uploading}
          onClick={handleSubmit}
        >
          {uploading ? "Uploading…" : "Next: Preview →"}
        </button>
      </div>
    </div>
  );
}

function SupportBadge({ support }: { support: "full" | "kit" | "tbd" }) {
  const cfg = {
    full: {
      bg: "var(--io-success-subtle, rgba(34,197,94,0.12))",
      text: "var(--io-success, #16a34a)",
      label: "Full",
    },
    kit: {
      bg: "var(--io-warning-subtle, rgba(234,179,8,0.12))",
      text: "var(--io-warning, #ca8a04)",
      label: "Kit Required",
    },
    tbd: {
      bg: "var(--io-surface-secondary, #e2e8f0)",
      text: "var(--io-text-muted)",
      label: "TBD",
    },
  }[support];

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "1px 6px",
        borderRadius: 3,
        background: cfg.bg,
        color: cfg.text,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Preview
// ---------------------------------------------------------------------------

function Step2Preview({
  result,
  onBack,
  onNext,
}: {
  result: DcsImportResult;
  onBack: () => void;
  onNext: () => void;
}) {
  // Scale down for preview canvas
  const CANVAS_MAX = 480;
  const scale = Math.min(
    CANVAS_MAX / result.width,
    CANVAS_MAX / result.height,
    1,
  );
  const canvasW = result.width * scale;
  const canvasH = result.height * scale;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 20, padding: 24 }}
    >
      {/* Summary stats */}
      <div style={{ display: "flex", gap: 12 }}>
        <StatCard label="Display Name" value={result.display_name} />
        <StatCard label="Elements" value={String(result.element_count)} />
        <StatCard label="Tags" value={String(result.tags.length)} />
        <StatCard
          label="Unresolved Symbols"
          value={String(result.unresolved_symbols.length)}
        />
      </div>

      {/* Warnings */}
      {result.import_warnings.length > 0 && (
        <div
          style={{
            background: "var(--io-warning-subtle, rgba(234,179,8,0.08))",
            border: "1px solid var(--io-warning-border, rgba(234,179,8,0.3))",
            borderRadius: 6,
            padding: "10px 14px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--io-warning, #ca8a04)",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Import Warnings
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {result.import_warnings.map((w, i) => (
              <li
                key={i}
                style={{
                  fontSize: 12,
                  color: "var(--io-text-secondary)",
                  marginBottom: 2,
                }}
              >
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Geometry preview */}
      <div>
        <div style={label}>Geometry Preview</div>
        <div
          style={{
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: 6,
            overflow: "hidden",
            display: "inline-flex",
          }}
        >
          <svg
            width={canvasW}
            height={canvasH}
            viewBox={`0 0 ${result.width} ${result.height}`}
            style={{ display: "block" }}
          >
            <rect width={result.width} height={result.height} fill="#f8fafc" />
            {result.elements.map((el) => (
              <PreviewElement key={el.id} el={el} />
            ))}
          </svg>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 8,
        }}
      >
        <button style={secondaryBtn} onClick={onBack}>
          ← Back
        </button>
        <button style={primaryBtn} onClick={onNext}>
          Next: Tag Mapping →
        </button>
      </div>
    </div>
  );
}

function StatCard({ label: lbl, value }: { label: string; value: string }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 80 }}>
      <div style={{ ...label, marginBottom: 4 }}>{lbl}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--io-text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PreviewElement({ el }: { el: DcsElement }) {
  if (el.element_type === "pipe") {
    return (
      <rect
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={2}
      />
    );
  }
  if (el.element_type === "dynamic_text" || el.element_type === "instrument") {
    return (
      <text x={el.x} y={el.y + el.height * 0.6} fontSize={10} fill="#64748b">
        {el.label ?? el.tag ?? el.id}
      </text>
    );
  }
  // Default: outline rect
  return (
    <rect
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      fill="none"
      stroke="#64748b"
      strokeWidth={1.5}
      rx={2}
    />
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Tag Mapping
// ---------------------------------------------------------------------------

interface PointSearchResult {
  id: string;
  tag: string;
  description: string;
}

function Step3TagMapping({
  result,
  tagMap,
  setTagMap,
  onBack,
  onNext,
}: {
  result: DcsImportResult;
  tagMap: Map<string, string>;
  setTagMap: (m: Map<string, string>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const taggedElements = result.elements.filter((el) => el.tag !== null);

  function handleMap(elementId: string, pointId: string) {
    const next = new Map(tagMap);
    next.set(elementId, pointId);
    setTagMap(next);
  }

  function handleSkip(elementId: string) {
    const next = new Map(tagMap);
    next.delete(elementId);
    setTagMap(next);
  }

  function handleAcceptAll() {
    // Auto-match: use tag value as pointId placeholder
    const next = new Map(tagMap);
    for (const el of taggedElements) {
      if (el.tag && !next.has(el.id)) {
        next.set(el.id, el.tag);
      }
    }
    setTagMap(next);
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={label}>
          {taggedElements.length} DCS Tag
          {taggedElements.length !== 1 ? "s" : ""} to Map
        </div>
        <button
          style={{ ...secondaryBtn, fontSize: 12 }}
          onClick={handleAcceptAll}
        >
          Accept Auto-Matches
        </button>
      </div>

      {taggedElements.length === 0 ? (
        <div
          style={{
            ...card,
            textAlign: "center",
            color: "var(--io-text-muted)",
            fontSize: 13,
            padding: 32,
          }}
        >
          No tagged elements found in this import.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: 12,
              padding: "0 4px",
            }}
          >
            <div style={label}>DCS Tag</div>
            <div style={label}>I/O Point</div>
            <div style={{ ...label, width: 60 }} />
          </div>
          {taggedElements.map((el) => (
            <TagRow
              key={el.id}
              element={el}
              mappedPointId={tagMap.get(el.id)}
              onMap={(pointId) => handleMap(el.id, pointId)}
              onSkip={() => handleSkip(el.id)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 8,
        }}
      >
        <button style={secondaryBtn} onClick={onBack}>
          ← Back
        </button>
        <button style={primaryBtn} onClick={onNext}>
          Next: Symbol Mapping →
        </button>
      </div>
    </div>
  );
}

function TagRow({
  element,
  mappedPointId,
  onMap,
  onSkip,
}: {
  element: DcsElement;
  mappedPointId: string | undefined;
  onMap: (pointId: string) => void;
  onSkip: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PointSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const isAutoMatch = mappedPointId === element.tag;

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const API_BASE =
      (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
    const token = localStorage.getItem("io_access_token") ?? "";
    fetch(`${API_BASE}/api/points?search=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json: { data?: PointSearchResult[] }) => {
        setResults(json.data ?? []);
        setSearching(false);
      })
      .catch(() => setSearching(false));

    return () => controller.abort();
  }, [query]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto",
        gap: 12,
        alignItems: "start",
        padding: "10px 12px",
        background: isAutoMatch
          ? "var(--io-success-subtle, rgba(34,197,94,0.06))"
          : "var(--io-surface)",
        border: `1px solid ${isAutoMatch ? "var(--io-success-border, rgba(34,197,94,0.25))" : "var(--io-border)"}`,
        borderRadius: 6,
      }}
    >
      {/* DCS Tag (left) */}
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          {element.tag}
        </div>
        {element.label && (
          <div
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              marginTop: 2,
            }}
          >
            {element.label}
          </div>
        )}
        {element.symbol_class && (
          <div style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
            {element.symbol_class}
          </div>
        )}
      </div>

      {/* I/O Point search (right) */}
      <div style={{ position: "relative" }}>
        {mappedPointId ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: isAutoMatch
                ? "var(--io-success-subtle, rgba(34,197,94,0.10))"
                : "var(--io-accent-subtle, rgba(59,130,246,0.08))",
              border: `1px solid ${isAutoMatch ? "var(--io-success-border, rgba(34,197,94,0.3))" : "var(--io-accent-border, rgba(59,130,246,0.25))"}`,
              borderRadius: 4,
              fontSize: 12,
              color: "var(--io-text-primary)",
            }}
          >
            <span style={{ flex: 1 }}>{mappedPointId}</span>
            {isAutoMatch && (
              <span
                style={{
                  fontSize: 10,
                  color: "var(--io-success, #16a34a)",
                  fontWeight: 700,
                }}
              >
                AUTO
              </span>
            )}
            <button
              onClick={() => {
                setQuery("");
                onSkip();
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                color: "var(--io-text-muted)",
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search I/O points…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "6px 10px",
                fontSize: 12,
                background: "var(--io-surface)",
                border: "1px solid var(--io-border)",
                borderRadius: 4,
                color: "var(--io-text-primary)",
                outline: "none",
              }}
            />
            {(results.length > 0 || searching) && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  background: "var(--io-surface-elevated)",
                  border: "1px solid var(--io-border)",
                  borderRadius: 4,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  maxHeight: 160,
                  overflowY: "auto",
                }}
              >
                {searching && (
                  <div
                    style={{
                      padding: "8px 12px",
                      fontSize: 12,
                      color: "var(--io-text-muted)",
                    }}
                  >
                    Searching…
                  </div>
                )}
                {results.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      onMap(r.id);
                      setQuery("");
                      setResults([]);
                    }}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--io-text-primary)",
                      borderBottom: "1px solid var(--io-border)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "var(--io-surface-secondary)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "";
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.tag}</div>
                    {r.description && (
                      <div
                        style={{ color: "var(--io-text-muted)", marginTop: 2 }}
                      >
                        {r.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: 4, width: 60 }}
      >
        <button
          onClick={onSkip}
          style={{ ...secondaryBtn, padding: "4px 8px", fontSize: 11 }}
        >
          Skip
        </button>
        <button
          onClick={() => onMap(`__placeholder__${element.tag}`)}
          style={{ ...secondaryBtn, padding: "4px 8px", fontSize: 11 }}
        >
          Placeholder
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Symbol Mapping
// ---------------------------------------------------------------------------

interface ShapeTemplate {
  id: string;
  name: string;
  category: string;
}

function Step4SymbolMapping({
  result,
  symbolMap,
  setSymbolMap,
  onBack,
  onNext,
}: {
  result: DcsImportResult;
  symbolMap: Map<string, string | null>;
  setSymbolMap: (m: Map<string, string | null>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [shapes, setShapes] = useState<ShapeTemplate[]>([]);
  const [shapesLoaded, setShapesLoaded] = useState(false);

  // Unique symbol classes
  const symbolClasses = Array.from(
    new Set(
      result.elements
        .filter((el) => el.symbol_class !== null)
        .map((el) => el.symbol_class as string),
    ),
  );

  useEffect(() => {
    const API_BASE =
      (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
    const token = localStorage.getItem("io_access_token") ?? "";
    fetch(`${API_BASE}/api/shapes`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => r.json())
      .then((json: { data?: ShapeTemplate[] }) => {
        setShapes(json.data ?? []);
        setShapesLoaded(true);
      })
      .catch(() => setShapesLoaded(true));
  }, []);

  function handleSelect(symbolClass: string, value: string | null) {
    const next = new Map(symbolMap);
    next.set(symbolClass, value);
    setSymbolMap(next);
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24 }}
    >
      <div style={label}>
        {symbolClasses.length} Unique Symbol Class
        {symbolClasses.length !== 1 ? "es" : ""}
      </div>

      {symbolClasses.length === 0 ? (
        <div
          style={{
            ...card,
            textAlign: "center",
            color: "var(--io-text-muted)",
            fontSize: 13,
            padding: 32,
          }}
        >
          No equipment symbol classes found in this import.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 420,
            overflowY: "auto",
          }}
        >
          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              padding: "0 4px",
            }}
          >
            <div style={label}>DCS Symbol Class</div>
            <div style={label}>I/O Shape Template</div>
          </div>
          {symbolClasses.map((sc) => (
            <div
              key={sc}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                alignItems: "center",
                padding: "10px 12px",
                background: "var(--io-surface)",
                border: "1px solid var(--io-border)",
                borderRadius: 6,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--io-text-primary)",
                  }}
                >
                  {sc}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--io-text-muted)",
                    marginTop: 2,
                  }}
                >
                  {
                    result.elements.filter((el) => el.symbol_class === sc)
                      .length
                  }{" "}
                  element(s)
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={symbolMap.get(sc) ?? ""}
                  onChange={(e) => handleSelect(sc, e.target.value || null)}
                  disabled={symbolMap.get(sc) === "__static__"}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    fontSize: 12,
                    background: "var(--io-surface)",
                    border: "1px solid var(--io-border)",
                    borderRadius: 4,
                    color: "var(--io-text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <option value="">-- Select template --</option>
                  {!shapesLoaded && <option disabled>Loading shapes…</option>}
                  {shapes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    handleSelect(
                      sc,
                      symbolMap.get(sc) === "__static__" ? null : "__static__",
                    )
                  }
                  title="Mark as static shape"
                  style={{
                    ...secondaryBtn,
                    padding: "6px 10px",
                    fontSize: 11,
                    background:
                      symbolMap.get(sc) === "__static__"
                        ? "var(--io-accent-subtle, rgba(59,130,246,0.1))"
                        : undefined,
                    borderColor:
                      symbolMap.get(sc) === "__static__"
                        ? "var(--io-accent, #3b82f6)"
                        : undefined,
                  }}
                >
                  Static
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 8,
        }}
      >
        <button style={secondaryBtn} onClick={onBack}>
          ← Back
        </button>
        <button style={primaryBtn} onClick={onNext}>
          Next: Generate →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Generate
// ---------------------------------------------------------------------------

interface ImportReport {
  graphicId: string;
  elementCount: number;
  boundTags: number;
  unmappedSymbols: number;
  warnings: string[];
}

function Step5Generate({
  result,
  tagMap,
  onBack,
  onGenerated,
}: {
  result: DcsImportResult;
  tagMap: Map<string, string>;
  onBack: () => void;
  onGenerated: (report: ImportReport) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    // Merge tag map decisions into the result for generation
    // (bridge path until the job API is in place)
    const enrichedResult: DcsImportResult = {
      ...result,
      elements: result.elements.map((el) => ({
        ...el,
        tag: tagMap.has(el.id) ? tagMap.get(el.id)! : el.tag,
      })),
    };

    const res = await createGraphicFromDcsResult(enrichedResult);

    setGenerating(false);
    if (res.success) {
      const r: ImportReport = {
        graphicId: res.data.id,
        elementCount: result.element_count,
        boundTags: tagMap.size,
        unmappedSymbols: result.unresolved_symbols.length,
        warnings: result.import_warnings,
      };
      setReport(r);
      onGenerated(r);
    } else {
      setError(res.error.message);
    }
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 20, padding: 24 }}
    >
      <div style={label}>Generate I/O Graphic</div>

      {!report && (
        <div
          style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div style={{ fontSize: 13, color: "var(--io-text-secondary)" }}>
            Ready to generate the I/O graphic from the parsed DCS data. This
            will create a new graphic in the Designer.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <SummaryRow label="Display Name" value={result.display_name} />
            <SummaryRow
              label="Total Elements"
              value={String(result.element_count)}
            />
            <SummaryRow
              label="Tags Mapped"
              value={`${tagMap.size} of ${result.tags.length}`}
            />
            <SummaryRow
              label="Unresolved Symbols"
              value={String(result.unresolved_symbols.length)}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "var(--io-error-subtle, rgba(239,68,68,0.08))",
            border: "1px solid var(--io-error, #ef4444)",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 13,
            color: "var(--io-error, #ef4444)",
          }}
        >
          {error}
        </div>
      )}

      {report && (
        <div
          style={{
            background: "var(--io-success-subtle, rgba(34,197,94,0.06))",
            border: "1px solid var(--io-success-border, rgba(34,197,94,0.25))",
            borderRadius: 6,
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--io-success, #16a34a)",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Import Complete
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <SummaryRow label="Graphic ID" value={report.graphicId} />
            <SummaryRow
              label="Elements Imported"
              value={String(report.elementCount)}
            />
            <SummaryRow label="Tags Bound" value={String(report.boundTags)} />
            <SummaryRow
              label="Unmapped Symbols"
              value={String(report.unmappedSymbols)}
            />
          </div>
          {report.warnings.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={label}>Warnings</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {report.warnings.map((w, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 12,
                      color: "var(--io-text-secondary)",
                      marginBottom: 2,
                    }}
                  >
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 8,
        }}
      >
        <button
          style={secondaryBtn}
          onClick={onBack}
          disabled={generating || !!report}
        >
          ← Back
        </button>
        {!report ? (
          <button
            style={generating ? disabledBtn : primaryBtn}
            disabled={generating}
            onClick={handleGenerate}
          >
            {generating ? "Generating…" : "Generate Graphic"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SummaryRow({ label: lbl, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span
        style={{
          fontSize: 12,
          color: "var(--io-text-muted)",
          width: 140,
          flexShrink: 0,
        }}
      >
        {lbl}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--io-text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6 — Refine
// ---------------------------------------------------------------------------

function Step6Refine({ report }: { report: ImportReport }) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: 24,
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 0 }}>🎉</div>
      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--io-text-primary)",
            marginBottom: 8,
          }}
        >
          Graphic imported successfully
        </div>
        <div style={{ fontSize: 13, color: "var(--io-text-secondary)" }}>
          Your graphic is ready. Open it in the Designer to refine element
          positions, bindings, and symbol styles.
        </div>
      </div>

      <div style={{ ...card, width: "100%", maxWidth: 360, textAlign: "left" }}>
        <div style={label}>Import Summary</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: 8,
          }}
        >
          <SummaryRow label="Elements" value={String(report.elementCount)} />
          <SummaryRow label="Tags Bound" value={String(report.boundTags)} />
          <SummaryRow
            label="Unresolved Symbols"
            value={String(report.unmappedSymbols)}
          />
        </div>
      </div>

      <button
        style={{ ...primaryBtn, padding: "10px 24px", fontSize: 14 }}
        onClick={() => navigate(`/designer/${report.graphicId}`)}
      >
        Open in Designer →
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import Job History panel
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  preview: "In Progress",
  partial: "In Progress",
  ready: "Ready",
  completed: "Completed",
};

const STATUS_COLOR: Record<string, string> = {
  preview: "var(--io-text-muted)",
  partial: "var(--io-warning, #f59e0b)",
  ready: "var(--io-success, #22c55e)",
  completed: "var(--io-success, #22c55e)",
};

function ImportJobHistory() {
  const [jobs, setJobs] = useState<DcsImportJobSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listImportJobs().then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.success) {
        setJobs(result.data);
      } else {
        setError(result.error.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 200,
          color: "var(--io-text-muted)",
          fontSize: 14,
        }}
      >
        Loading import history...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 200,
          gap: 8,
          color: "var(--io-danger, #ef4444)",
          fontSize: 14,
        }}
      >
        <span>Failed to load import history</span>
        <span style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
          {error}
        </span>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 24px",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--io-surface-secondary, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            color: "var(--io-text-muted)",
          }}
        >
          &#8635;
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          No import history
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--io-text-muted)",
            textAlign: "center",
            maxWidth: 320,
          }}
        >
          Past DCS graphics imports will appear here once you run your first
          import.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: 800 }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr>
            {["Display Name", "Platform", "Elements", "Status", "Created"].map(
              (h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--io-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--io-border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              style={{
                borderBottom: "1px solid var(--io-border)",
              }}
            >
              <td
                style={{
                  padding: "10px 12px",
                  color: "var(--io-text-primary)",
                  fontWeight: 500,
                  maxWidth: 220,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {job.display_name || "(unnamed)"}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  color: "var(--io-text-secondary, #475569)",
                }}
              >
                {job.platform}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  color: "var(--io-text-secondary, #475569)",
                  textAlign: "right",
                }}
              >
                {job.element_count}
              </td>
              <td style={{ padding: "10px 12px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 500,
                    color: STATUS_COLOR[job.status] ?? "var(--io-text-muted)",
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background:
                        STATUS_COLOR[job.status] ?? "var(--io-text-muted)",
                      flexShrink: 0,
                    }}
                  />
                  {STATUS_LABEL[job.status] ?? job.status}
                </span>
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  color: "var(--io-text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {new Date(job.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type PageTab = "wizard" | "history";

export default function DesignerImport() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PageTab>("wizard");
  const [step, setStep] = useState(0);
  const [importResult, setImportResult] = useState<DcsImportResult | null>(
    null,
  );
  const [tagMap, setTagMap] = useState<Map<string, string>>(new Map());
  const [symbolMap, setSymbolMap] = useState<Map<string, string | null>>(
    new Map(),
  );
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  const handleUploadSuccess = useCallback((result: DcsImportResult) => {
    setImportResult(result);
    setStep(1);
  }, []);

  const handleGenerated = useCallback((report: ImportReport) => {
    setImportReport(report);
    setStep(5);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--io-surface-primary)",
        overflow: "hidden",
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "0 20px",
          height: "48px",
          flexShrink: 0,
          background: "var(--io-surface)",
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        <button
          onClick={() => navigate("/designer")}
          style={{
            background: "none",
            border: "none",
            color: "var(--io-text-muted)",
            cursor: "pointer",
            fontSize: "13px",
            padding: "4px 0",
          }}
        >
          ← Designer
        </button>
        <span style={{ color: "var(--io-border)" }}>/</span>
        <span
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          Import Graphics
        </span>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          padding: "0 20px",
          borderBottom: "1px solid var(--io-border)",
          background: "var(--io-surface)",
          flexShrink: 0,
        }}
      >
        {(["wizard", "history"] as PageTab[]).map((tab) => {
          const label = tab === "wizard" ? "New Import" : "Import History";
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: "none",
                border: "none",
                borderBottom: active
                  ? "2px solid var(--io-accent, #3b82f6)"
                  : "2px solid transparent",
                color: active
                  ? "var(--io-text-primary)"
                  : "var(--io-text-muted)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                padding: "10px 14px",
                marginBottom: -1,
                whiteSpace: "nowrap",
                transition: "color 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "wizard" ? (
        <>
          {/* Step indicator */}
          <StepIndicator current={step} />

          {/* Step content — scrollable */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {step === 0 && (
              <Step1Upload onUploadSuccess={handleUploadSuccess} />
            )}
            {step === 1 && importResult && (
              <Step2Preview
                result={importResult}
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && importResult && (
              <Step3TagMapping
                result={importResult}
                tagMap={tagMap}
                setTagMap={setTagMap}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}
            {step === 3 && importResult && (
              <Step4SymbolMapping
                result={importResult}
                symbolMap={symbolMap}
                setSymbolMap={setSymbolMap}
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
              />
            )}
            {step === 4 && importResult && (
              <Step5Generate
                result={importResult}
                tagMap={tagMap}
                onBack={() => setStep(3)}
                onGenerated={handleGenerated}
              />
            )}
            {step === 5 && importReport && (
              <Step6Refine report={importReport} />
            )}
          </div>
        </>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <ImportJobHistory />
        </div>
      )}
    </div>
  );
}
