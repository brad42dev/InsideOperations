/**
 * IographicImportWizard.tsx
 *
 * 5-step wizard for importing a .iographic package into the Designer.
 *
 * Step 1: Package Overview   — manifest summary + validation status
 * Step 2: Shapes & Stencils  — shape/stencil dependency resolution
 * Step 3: Point Tags          — tag resolution (auto-resolved / ambiguous / unresolved)
 * Step 4: Import Options      — name, draft/publish, overwrite
 * Step 5: Confirm & Import    — review + progress
 *
 * Spec: doc 39 IOGRAPHIC_FORMAT §9 (Import Workflow)
 */

import { useState, useRef } from "react";
import {
  graphicsApi,
  type IographicAnalysis,
  type IographicImportOptions,
  type IographicImportResult,
  type IographicTagResolution,
  type IographicShapeStatus,
} from "../../../api/graphics";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IographicImportWizardProps {
  onClose: () => void;
  onImported?: (result: IographicImportResult) => void;
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = ["Overview", "Shapes", "Tags", "Options", "Confirm"];

// ---------------------------------------------------------------------------
// Shared dialog shell
// ---------------------------------------------------------------------------

function WizardShell({
  step,
  children,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  onClose,
}: {
  step: number;
  children: React.ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
      }}
    >
      <div
        style={{
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          width: 640,
          maxWidth: "96%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderBottom: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Import .iographic
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              fontSize: 20,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ×
          </button>
        </div>

        {/* Step indicator */}
        <div
          style={{
            display: "flex",
            gap: 0,
            padding: "10px 20px",
            borderBottom: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        >
          {STEPS.map((label, idx) => {
            const active = idx === step;
            const done = idx < step;
            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flex: 1,
                  fontSize: 12,
                  color: active
                    ? "var(--io-text-primary)"
                    : done
                      ? "var(--io-accent)"
                      : "var(--io-text-muted)",
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                    background: active
                      ? "var(--io-accent)"
                      : done
                        ? "transparent"
                        : "var(--io-surface)",
                    color: active
                      ? "#09090b"
                      : done
                        ? "var(--io-accent)"
                        : "var(--io-text-muted)",
                    border: done
                      ? "1.5px solid var(--io-accent)"
                      : active
                        ? "none"
                        : "1.5px solid var(--io-border)",
                  }}
                >
                  {done ? "✓" : idx + 1}
                </div>
                <span style={{ fontWeight: active ? 500 : 400 }}>{label}</span>
                {idx < STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: "var(--io-border)",
                      marginLeft: 4,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {children}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderTop: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onBack}
            disabled={!onBack}
            style={{
              padding: "6px 16px",
              background: "transparent",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-text-secondary)",
              fontSize: 13,
              cursor: onBack ? "pointer" : "not-allowed",
              opacity: onBack ? 1 : 0.4,
            }}
          >
            ← Back
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "6px 16px",
                background: "transparent",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                color: "var(--io-text-secondary)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={onNext}
              disabled={nextDisabled}
              style={{
                padding: "6px 16px",
                background: "var(--io-accent)",
                border: "none",
                borderRadius: "var(--io-radius)",
                color: "#09090b",
                fontSize: 13,
                fontWeight: 600,
                cursor: nextDisabled ? "not-allowed" : "pointer",
                opacity: nextDisabled ? 0.5 : 1,
              }}
            >
              {nextLabel ?? "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: "ok" | "warn" | "error" }) {
  const cfg = {
    ok: { bg: "rgba(34,197,94,0.15)", color: "#22c55e", label: "✓" },
    warn: { bg: "rgba(234,179,8,0.15)", color: "#eab308", label: "⚠" },
    error: { bg: "rgba(239,68,68,0.15)", color: "#ef4444", label: "✗" },
  }[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: cfg.bg,
        color: cfg.color,
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Package Overview
// ---------------------------------------------------------------------------

function Step1Overview({
  file,
  analysis,
}: {
  file: File;
  analysis: IographicAnalysis;
}) {
  const { manifest } = analysis;
  const gCount = manifest.graphics.length;
  const sCount = manifest.shape_dependencies.length;
  const tCount = manifest.point_tags.length;
  const customShapes = manifest.shapes.length;
  const stencils = manifest.stencils.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* File info */}
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          padding: "10px 14px",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 24 }}>📦</div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--io-text-primary)",
            }}
          >
            {file.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              marginTop: 2,
            }}
          >
            {(file.size / 1024).toFixed(1)} KB · Exported by{" "}
            {manifest.exported_by} on{" "}
            {new Date(manifest.exported_at).toLocaleDateString()}
          </div>
          {manifest.description && (
            <div
              style={{
                fontSize: 12,
                color: "var(--io-text-secondary)",
                marginTop: 4,
              }}
            >
              {manifest.description}
            </div>
          )}
        </div>
      </div>

      {/* Validation status */}
      {analysis.errors.length > 0 && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--io-radius)",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#ef4444",
              marginBottom: 6,
            }}
          >
            Validation Errors
          </div>
          {analysis.errors.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: "#ef4444" }}>
              • {e}
            </div>
          ))}
        </div>
      )}

      {/* Summary grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
        }}
      >
        {[
          { label: "Graphics", value: gCount, icon: "◆" },
          { label: "Shape Deps", value: sCount, icon: "⬡" },
          { label: "Point Tags", value: tCount, icon: "⬤" },
          { label: "Custom Shapes", value: customShapes, icon: "★" },
          { label: "Stencils", value: stencils, icon: "▣" },
        ].map(({ label, value, icon }) => (
          <div
            key={label}
            style={{
              background: "var(--io-surface)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16, color: "var(--io-text-muted)" }}>
              {icon}
            </span>
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--io-text-primary)",
                  lineHeight: 1,
                }}
              >
                {value}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--io-text-muted)",
                  marginTop: 2,
                }}
              >
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Graphic list */}
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--io-text-secondary)",
            marginBottom: 6,
          }}
        >
          Graphics in this package
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {manifest.graphics.map((g) => (
            <div
              key={g.directory}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                background: "var(--io-surface)",
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 14 }}>◆</span>
              <span style={{ color: "var(--io-text-primary)", flex: 1 }}>
                {g.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--io-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {g.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Shapes & Stencils
// ---------------------------------------------------------------------------

function Step2Shapes({
  analysis,
  shapeActions,
  onShapeAction,
  stencilActions,
  onStencilAction,
}: {
  analysis: IographicAnalysis;
  shapeActions: Map<string, IographicShapeStatus["action"]>;
  onShapeAction: (
    shapeId: string,
    action: IographicShapeStatus["action"],
  ) => void;
  stencilActions: Map<string, "import" | "use_existing" | "skip">;
  onStencilAction: (
    stencilId: string,
    action: "import" | "use_existing" | "skip",
  ) => void;
}) {
  const customShapes = analysis.shape_statuses.filter((s) =>
    s.status.startsWith("custom"),
  );
  const builtinShapes = analysis.shape_statuses.filter(
    (s) => !s.status.startsWith("custom"),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Custom shapes */}
      {customShapes.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--io-text-secondary)",
              marginBottom: 8,
            }}
          >
            Custom Shapes ({customShapes.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {customShapes.map((s) => {
              const action =
                shapeActions.get(s.shape_id) ??
                (s.status === "custom_exists" ? "use_existing" : "import");
              return (
                <div
                  key={s.shape_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 10px",
                    background: "var(--io-surface)",
                    borderRadius: 4,
                    fontSize: 13,
                  }}
                >
                  <StatusBadge
                    status={s.status === "custom_exists" ? "warn" : "ok"}
                  />
                  <span style={{ flex: 1, color: "var(--io-text-primary)" }}>
                    {s.name ?? s.shape_id}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
                    {s.status === "custom_exists" ? "Already exists" : "New"}
                  </span>
                  <select
                    value={action ?? ""}
                    onChange={(e) =>
                      onShapeAction(
                        s.shape_id,
                        e.target.value as IographicShapeStatus["action"],
                      )
                    }
                    style={{
                      background: "var(--io-surface-elevated)",
                      border: "1px solid var(--io-border)",
                      borderRadius: 4,
                      color: "var(--io-text-primary)",
                      fontSize: 12,
                      padding: "2px 6px",
                    }}
                  >
                    <option value="import">Import</option>
                    {s.status === "custom_exists" && (
                      <option value="use_existing">Use existing</option>
                    )}
                    {s.status === "custom_exists" && (
                      <option value="import_as_copy">Import as copy</option>
                    )}
                    <option value="skip">Skip</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Built-in shapes */}
      {builtinShapes.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--io-text-secondary)",
              marginBottom: 8,
            }}
          >
            Built-in Shape Dependencies ({builtinShapes.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {builtinShapes.map((s) => (
              <div
                key={s.shape_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "5px 10px",
                  background: "var(--io-surface)",
                  borderRadius: 4,
                  fontSize: 13,
                }}
              >
                <StatusBadge
                  status={s.status === "available" ? "ok" : "warn"}
                />
                <span
                  style={{
                    flex: 1,
                    color: "var(--io-text-primary)",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  {s.shape_id}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: s.status === "available" ? "#22c55e" : "#eab308",
                  }}
                >
                  {s.status === "available"
                    ? "Available"
                    : "Missing — placeholder"}
                </span>
              </div>
            ))}
          </div>
          {builtinShapes.some((s) => s.status === "missing") && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "var(--io-text-muted)",
              }}
            >
              Missing shapes will be imported as placeholder rectangles. They
              resolve automatically when the shapes become available.
            </div>
          )}
        </div>
      )}

      {/* Stencils */}
      {analysis.stencil_statuses.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--io-text-secondary)",
              marginBottom: 8,
            }}
          >
            Stencils ({analysis.stencil_statuses.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {analysis.stencil_statuses.map((s) => {
              const action =
                stencilActions.get(s.stencil_id) ??
                (s.status === "exists" ? "use_existing" : "import");
              return (
                <div
                  key={s.stencil_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "5px 10px",
                    background: "var(--io-surface)",
                    borderRadius: 4,
                    fontSize: 13,
                  }}
                >
                  <StatusBadge status={s.status === "exists" ? "warn" : "ok"} />
                  <span style={{ flex: 1, color: "var(--io-text-primary)" }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
                    {s.status === "exists" ? "Exists" : "New"}
                  </span>
                  <select
                    value={action}
                    onChange={(e) =>
                      onStencilAction(
                        s.stencil_id,
                        e.target.value as "import" | "use_existing" | "skip",
                      )
                    }
                    style={{
                      background: "var(--io-surface-elevated)",
                      border: "1px solid var(--io-border)",
                      borderRadius: 4,
                      color: "var(--io-text-primary)",
                      fontSize: 12,
                      padding: "2px 6px",
                    }}
                  >
                    <option value="import">Import</option>
                    {s.status === "exists" && (
                      <option value="use_existing">Use existing</option>
                    )}
                    <option value="skip">Skip</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {customShapes.length === 0 &&
        builtinShapes.length === 0 &&
        analysis.stencil_statuses.length === 0 && (
          <div
            style={{
              fontSize: 13,
              color: "var(--io-text-muted)",
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            No shape or stencil dependencies in this package.
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Point Tag Resolution
// ---------------------------------------------------------------------------

function Step3Tags({
  tagResolutions,
  tagActions,
  onTagAction,
}: {
  tagResolutions: IographicTagResolution[];
  tagActions: Map<string, { action: "keep" | "skip"; remapTag?: string }>;
  onTagAction: (tag: string, action: "keep" | "skip") => void;
}) {
  const resolved = tagResolutions.filter((t) => t.status === "resolved");
  const ambiguous = tagResolutions.filter((t) => t.status === "ambiguous");
  const unresolved = tagResolutions.filter((t) => t.status === "unresolved");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "flex", gap: 8 }}>
        {[
          {
            label: `${resolved.length} Auto-resolved`,
            color: "#22c55e",
            bg: "rgba(34,197,94,0.1)",
          },
          {
            label: `${ambiguous.length} Ambiguous`,
            color: "#eab308",
            bg: "rgba(234,179,8,0.1)",
          },
          {
            label: `${unresolved.length} Unresolved`,
            color: "#ef4444",
            bg: "rgba(239,68,68,0.1)",
          },
        ].map(({ label, color, bg }) => (
          <div
            key={label}
            style={{
              flex: 1,
              padding: "8px 10px",
              background: bg,
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              color,
              textAlign: "center",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Ambiguous tags */}
      {ambiguous.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#eab308",
              marginBottom: 8,
            }}
          >
            Ambiguous — Multiple matches (select the correct source)
          </div>
          {ambiguous.map((t) => (
            <div
              key={t.tag}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                background: "var(--io-surface)",
                borderRadius: 4,
                fontSize: 13,
                marginBottom: 3,
              }}
            >
              <StatusBadge status="warn" />
              <span
                style={{
                  flex: 1,
                  fontFamily: "monospace",
                  color: "var(--io-text-primary)",
                }}
              >
                {t.tag}
              </span>
              <select
                style={{
                  background: "var(--io-surface-elevated)",
                  border: "1px solid var(--io-border)",
                  borderRadius: 4,
                  color: "var(--io-text-primary)",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                {t.candidates?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.tagname} ({c.source})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Unresolved tags */}
      {unresolved.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--io-text-secondary)",
              marginBottom: 8,
            }}
          >
            Unresolved Tags — not found in this system
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--io-text-muted)",
              marginBottom: 8,
            }}
          >
            Keep as-is (default): the binding is preserved with the original tag
            name. The element shows N/C at runtime and auto-resolves when a
            matching point is configured.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {unresolved.map((t) => {
              const cur = tagActions.get(t.tag)?.action ?? "keep";
              return (
                <div
                  key={t.tag}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "5px 10px",
                    background: "var(--io-surface)",
                    borderRadius: 4,
                    fontSize: 13,
                  }}
                >
                  <StatusBadge status="error" />
                  <span
                    style={{
                      flex: 1,
                      fontFamily: "monospace",
                      color: "var(--io-text-primary)",
                    }}
                  >
                    {t.tag}
                  </span>
                  {t.source_hint && (
                    <span
                      style={{ fontSize: 11, color: "var(--io-text-muted)" }}
                    >
                      {t.source_hint}
                    </span>
                  )}
                  <select
                    value={cur}
                    onChange={(e) =>
                      onTagAction(t.tag, e.target.value as "keep" | "skip")
                    }
                    style={{
                      background: "var(--io-surface-elevated)",
                      border: "1px solid var(--io-border)",
                      borderRadius: 4,
                      color: "var(--io-text-primary)",
                      fontSize: 12,
                      padding: "2px 6px",
                    }}
                  >
                    <option value="keep">Keep as-is (N/C)</option>
                    <option value="skip">Skip (no binding)</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Auto-resolved preview */}
      {resolved.length > 0 && (
        <details style={{ fontSize: 12 }}>
          <summary
            style={{
              cursor: "pointer",
              color: "var(--io-text-muted)",
              userSelect: "none",
            }}
          >
            {resolved.length} auto-resolved tags (click to expand)
          </summary>
          <div
            style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}
          >
            {resolved.map((t) => (
              <span
                key={t.tag}
                style={{
                  padding: "2px 8px",
                  background: "rgba(34,197,94,0.1)",
                  borderRadius: 10,
                  fontSize: 11,
                  color: "#22c55e",
                  fontFamily: "monospace",
                }}
              >
                {t.tag}
              </span>
            ))}
          </div>
        </details>
      )}

      {tagResolutions.length === 0 && (
        <div
          style={{
            fontSize: 13,
            color: "var(--io-text-muted)",
            textAlign: "center",
            padding: "24px 0",
          }}
        >
          No point bindings in this package.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Import Options
// ---------------------------------------------------------------------------

function Step4Options({
  defaultName,
  targetName,
  onTargetName,
  importAs,
  onImportAs,
  overwrite,
  onOverwrite,
}: {
  defaultName: string;
  targetName: string;
  onTargetName: (v: string) => void;
  importAs: "draft" | "published";
  onImportAs: (v: "draft" | "published") => void;
  overwrite: boolean;
  onOverwrite: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Target name */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--io-text-secondary)",
          }}
        >
          Graphic Name
        </label>
        <input
          type="text"
          value={targetName}
          onChange={(e) => onTargetName(e.target.value)}
          placeholder={defaultName}
          style={{
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-primary)",
            fontSize: 13,
            padding: "7px 10px",
          }}
        />
      </div>

      {/* Import as */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--io-text-secondary)",
          }}
        >
          Import as
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["draft", "published"] as const).map((opt) => (
            <label
              key={opt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontSize: 13,
                color: "var(--io-text-primary)",
              }}
            >
              <input
                type="radio"
                name="importAs"
                value={opt}
                checked={importAs === opt}
                onChange={() => onImportAs(opt)}
                style={{ accentColor: "var(--io-accent)" }}
              />
              <span style={{ textTransform: "capitalize" }}>{opt}</span>
            </label>
          ))}
        </div>
        {importAs === "draft" && (
          <div style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
            Imported as a draft — not visible in Console/Process until
            published.
          </div>
        )}
      </div>

      {/* Overwrite */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          id="overwrite"
          checked={overwrite}
          onChange={(e) => onOverwrite(e.target.checked)}
          style={{ accentColor: "var(--io-accent)", width: 14, height: 14 }}
        />
        <label
          htmlFor="overwrite"
          style={{
            fontSize: 13,
            color: "var(--io-text-primary)",
            cursor: "pointer",
          }}
        >
          Overwrite existing graphic if name matches
        </label>
      </div>
      {!overwrite && (
        <div
          style={{
            fontSize: 12,
            color: "var(--io-text-muted)",
            marginTop: -12,
          }}
        >
          If a graphic with this name already exists, a copy will be created.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Confirm & Import
// ---------------------------------------------------------------------------

function Step5Confirm({
  analysis,
  targetName,
  importAs,
  overwrite,
  tagActions,
  onImport,
  importing,
  importResult,
  importError,
}: {
  analysis: IographicAnalysis;
  targetName: string;
  importAs: "draft" | "published";
  overwrite: boolean;
  tagActions: Map<string, { action: "keep" | "skip" }>;
  onImport: () => void;
  importing: boolean;
  importResult: IographicImportResult | null;
  importError: string | null;
}) {
  const unresolvedKept = analysis.tag_resolutions.filter(
    (t) =>
      t.status === "unresolved" &&
      (tagActions.get(t.tag)?.action ?? "keep") === "keep",
  ).length;
  const skipped = Array.from(tagActions.values()).filter(
    (a) => a.action === "skip",
  ).length;

  if (importResult) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          alignItems: "center",
          padding: "16px 0",
        }}
      >
        <div style={{ fontSize: 32 }}>✅</div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          Import Complete
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            width: "100%",
          }}
        >
          {[
            {
              label: "Graphics imported",
              value: importResult.graphics_imported,
            },
            { label: "Shapes imported", value: importResult.shapes_imported },
            {
              label: "Stencils imported",
              value: importResult.stencils_imported,
            },
            {
              label: "Bindings resolved",
              value: `${importResult.bindings_resolved} / ${importResult.bindings_total}`,
            },
            {
              label: "Unresolved bindings",
              value: importResult.bindings_unresolved,
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                padding: "4px 0",
                borderBottom: "1px solid var(--io-border)",
              }}
            >
              <span style={{ color: "var(--io-text-secondary)" }}>{label}</span>
              <span
                style={{ color: "var(--io-text-primary)", fontWeight: 500 }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
        {importResult.missing_shapes.length > 0 && (
          <div style={{ fontSize: 12, color: "#eab308" }}>
            ⚠ {importResult.missing_shapes.length} shape(s) missing:{" "}
            {importResult.missing_shapes.slice(0, 3).join(", ")}
            {importResult.missing_shapes.length > 3
              ? ` +${importResult.missing_shapes.length - 3}`
              : ""}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          fontSize: 13,
          color: "var(--io-text-secondary)",
          marginBottom: 4,
        }}
      >
        Review your import settings before proceeding:
      </div>

      {[
        {
          label: "Graphics",
          value: `${analysis.manifest.graphics.length} graphic(s)`,
        },
        {
          label: "Target name",
          value: targetName || analysis.manifest.graphics[0]?.name,
        },
        { label: "Import as", value: importAs },
        {
          label: "Overwrite existing",
          value: overwrite ? "Yes" : "No — create copy",
        },
        { label: "Unresolved tags (kept)", value: unresolvedKept },
        { label: "Bindings skipped", value: skipped },
      ].map(({ label, value }) => (
        <div
          key={label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            padding: "6px 0",
            borderBottom: "1px solid var(--io-border)",
          }}
        >
          <span style={{ color: "var(--io-text-secondary)" }}>{label}</span>
          <span style={{ color: "var(--io-text-primary)", fontWeight: 500 }}>
            {String(value)}
          </span>
        </div>
      ))}

      {importError && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 4,
            fontSize: 13,
            color: "#ef4444",
          }}
        >
          {importError}
        </div>
      )}

      {!importing && !importResult && (
        <button
          onClick={onImport}
          style={{
            marginTop: 8,
            padding: "10px 0",
            background: "var(--io-accent)",
            border: "none",
            borderRadius: "var(--io-radius)",
            color: "#09090b",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Import Now
        </button>
      )}

      {importing && (
        <div
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "var(--io-text-muted)",
            padding: "12px 0",
          }}
        >
          Importing… please wait
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export default function IographicImportWizard({
  onClose,
  onImported,
}: IographicImportWizardProps) {
  const [step, setStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File selection
  const [file, setFile] = useState<File | null>(null);

  // Analysis result
  const [analysis, setAnalysis] = useState<IographicAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // User decisions
  const [shapeActions, setShapeActions] = useState<
    Map<string, IographicShapeStatus["action"]>
  >(new Map());
  const [stencilActions, setStencilActions] = useState<
    Map<string, "import" | "use_existing" | "skip">
  >(new Map());
  const [tagActions, setTagActions] = useState<
    Map<string, { action: "keep" | "skip" }>
  >(new Map());
  const [targetName, setTargetName] = useState("");
  const [importAs, setImportAs] = useState<"draft" | "published">("draft");
  const [overwrite, setOverwrite] = useState(false);

  // Import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] =
    useState<IographicImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ── Step 0: file picker ──────────────────────────────────────────────────

  if (step === 0) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            padding: 24,
            width: 420,
            maxWidth: "90%",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              Import .iographic
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--io-text-muted)",
                fontSize: 20,
                lineHeight: 1,
                padding: 2,
              }}
            >
              ×
            </button>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            style={{
              border: "2px dashed var(--io-border)",
              borderRadius: "var(--io-radius)",
              padding: "32px 20px",
              textAlign: "center",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              fontSize: 13,
              transition: "border-color 0.15s",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            {file ? (
              <div style={{ color: "var(--io-text-primary)", fontWeight: 500 }}>
                {file.name}
              </div>
            ) : (
              <>
                <div>Drop a .iographic file here</div>
                <div style={{ marginTop: 4, fontSize: 11 }}>
                  or click to browse
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".iographic"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
            }}
          />

          {analyzeError && (
            <div
              style={{
                fontSize: 12,
                color: "#ef4444",
                padding: "8px 10px",
                background: "rgba(239,68,68,0.08)",
                borderRadius: 4,
              }}
            >
              {analyzeError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{
                padding: "6px 16px",
                background: "transparent",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                color: "var(--io-text-secondary)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!file) return;
                setAnalyzing(true);
                setAnalyzeError(null);
                try {
                  const result = await graphicsApi.analyzeIographic(file);
                  setAnalysis(result);
                  if (result.manifest.graphics.length > 0) {
                    setTargetName(result.manifest.graphics[0].name);
                  }
                  setStep(1);
                } catch (err) {
                  setAnalyzeError(
                    err instanceof Error ? err.message : "Analysis failed",
                  );
                } finally {
                  setAnalyzing(false);
                }
              }}
              disabled={!file || analyzing}
              style={{
                padding: "6px 16px",
                background: "var(--io-accent)",
                border: "none",
                borderRadius: "var(--io-radius)",
                color: "#09090b",
                fontSize: 13,
                fontWeight: 600,
                cursor: !file || analyzing ? "not-allowed" : "pointer",
                opacity: !file || analyzing ? 0.5 : 1,
              }}
            >
              {analyzing ? "Analyzing…" : "Analyze →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Steps 1-5: wizard shell ──────────────────────────────────────────────

  if (!analysis || !file) return null;

  async function handleImport() {
    if (!file || !analysis) return;
    setImporting(true);
    setImportError(null);

    const options: IographicImportOptions = {
      tag_mappings: analysis.tag_resolutions.map((t) => ({
        original_tag: t.tag,
        action: tagActions.get(t.tag)?.action ?? "keep",
      })),
      shape_actions: analysis.shape_statuses
        .filter((s) => s.status.startsWith("custom"))
        .map((s) => ({
          shape_id: s.shape_id,
          action:
            shapeActions.get(s.shape_id) ??
            (s.status === "custom_exists" ? "use_existing" : "import"),
        })),
      stencil_actions: analysis.stencil_statuses.map((s) => ({
        stencil_id: s.stencil_id,
        action:
          stencilActions.get(s.stencil_id) ??
          (s.status === "exists" ? "use_existing" : "import"),
      })),
      target_name: targetName || undefined,
      import_as: importAs,
      overwrite,
    };

    try {
      const result = await graphicsApi.commitIographic(file, options);
      setImportResult(result);
      onImported?.(result);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const wizardStep = step - 1; // 1-indexed step → 0-indexed for STEPS array

  const stepContent = () => {
    switch (step) {
      case 1:
        return <Step1Overview file={file} analysis={analysis} />;
      case 2:
        return (
          <Step2Shapes
            analysis={analysis}
            shapeActions={shapeActions}
            onShapeAction={(id, action) =>
              setShapeActions((prev) => new Map(prev).set(id, action))
            }
            stencilActions={stencilActions}
            onStencilAction={(id, action) =>
              setStencilActions((prev) => new Map(prev).set(id, action))
            }
          />
        );
      case 3:
        return (
          <Step3Tags
            tagResolutions={analysis.tag_resolutions}
            tagActions={tagActions}
            onTagAction={(tag, action) =>
              setTagActions((prev) => new Map(prev).set(tag, { action }))
            }
          />
        );
      case 4:
        return (
          <Step4Options
            defaultName={analysis.manifest.graphics[0]?.name ?? ""}
            targetName={targetName}
            onTargetName={setTargetName}
            importAs={importAs}
            onImportAs={setImportAs}
            overwrite={overwrite}
            onOverwrite={setOverwrite}
          />
        );
      case 5:
        return (
          <Step5Confirm
            analysis={analysis}
            targetName={targetName}
            importAs={importAs}
            overwrite={overwrite}
            tagActions={tagActions}
            onImport={handleImport}
            importing={importing}
            importResult={importResult}
            importError={importError}
          />
        );
      default:
        return null;
    }
  };

  const isLastStep = step === 5;

  return (
    <WizardShell
      step={wizardStep}
      onBack={
        step > 1 && !importResult ? () => setStep((s) => s - 1) : undefined
      }
      onNext={() => {
        if (isLastStep) {
          if (importResult) onClose();
          // Import is triggered from within Step5
        } else {
          setStep((s) => s + 1);
        }
      }}
      nextLabel={isLastStep ? (importResult ? "Done" : undefined) : undefined}
      nextDisabled={isLastStep && !importResult}
      onClose={onClose}
    >
      {stepContent()}
    </WizardShell>
  );
}
