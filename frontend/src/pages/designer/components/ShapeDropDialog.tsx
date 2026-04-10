/**
 * ShapeDropDialog.tsx
 *
 * 2-step dialog opened when a shape is dropped from the shape library panel:
 *   Step 1 — Variant picker + add-on checkboxes
 *   Step 2 — Per-bindable-part point binding + display element checklist
 *
 * Also used in edit mode (right-click → Shape Configuration…) where only
 * Step 2 is shown and the variant cannot change after placement.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLibraryStore } from "../../../store/designer";
import type { ShapeSidecar } from "../../../store/designer/libraryStore";
import { pointsApi } from "../../../api/points";
import type { PointMeta } from "../../../api/points";
import type { DisplayElementType } from "../../../shared/types/graphics";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PlacedShapeConfig {
  shapeId: string;
  /** Selected variant key (e.g. "opt1", "plain", "diaphragm") */
  variant: string;
  composableParts: Array<{ partId: string; attachment: string }>;
  pointBindings: Array<{
    partKey: string;
    pointId?: string;
    pointTag?: string;
  }>;
  /** Display element types to pre-attach (e.g. ["text_readout", "alarm_indicator"]) */
  displayElements: string[];
  /** User-chosen slot per display element type key (e.g. { text_readout: "right" }).
   *  When absent the canvas handler falls back to sidecar defaultSlots then NAMED_SLOT_POSITIONS. */
  displayElementSlots?: Record<string, string>;
}

export interface ShapeDropDialogProps {
  shapeId: string;
  shapeDisplayName: string;
  onPlace: (config: PlacedShapeConfig) => void;
  onCancel: () => void;
  open: boolean;
  /** Edit mode: opens at Step 2 by default; Step 1 is shown when the shape has multiple variants */
  editMode?: boolean;
  /** Current variant on the shape being edited — pre-selects it in Step 1 */
  initialVariant?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_ELEMENTS: Array<{ id: DisplayElementType; label: string }> = [
  { id: "text_readout", label: "Text Readout" },
  { id: "alarm_indicator", label: "Alarm Indicator" },
  { id: "analog_bar", label: "Analog Bar" },
  { id: "fill_gauge", label: "Fill Gauge" },
  { id: "sparkline", label: "Sparkline" },
  { id: "digital_status", label: "Digital Status" },
];

/** Actuator variant patterns → implied composable part */
const ACTUATOR_PATTERNS: Array<{ pattern: RegExp; partId: string }> = [
  { pattern: /actuator-diaphragm|^diaphragm$/, partId: "actuator-diaphragm" },
  { pattern: /actuator-motor|^motor$/, partId: "actuator-motor" },
  { pattern: /actuator-solenoid|^solenoid$/, partId: "actuator-solenoid" },
];

function getVariantImpliedParts(
  variantKey: string,
): Array<{ partId: string; attachment: string }> {
  for (const { pattern, partId } of ACTUATOR_PATTERNS) {
    if (pattern.test(variantKey)) {
      return [{ partId, attachment: "actuator" }];
    }
  }
  return [];
}

function getAddonAttachment(addonId: string): string {
  if (addonId.startsWith("fail-")) return "fail-indicator";
  if (addonId.startsWith("agitator-")) return "agitator";
  if (addonId.startsWith("support-")) return "support";
  return addonId;
}

function variantHasActuator(variantKey: string): boolean {
  return ACTUATOR_PATTERNS.some(({ pattern }) => pattern.test(variantKey));
}

// ---------------------------------------------------------------------------
// PointSearch — inline debounced search input per bindable part
// ---------------------------------------------------------------------------

interface PointSearchProps {
  label: string;
  selectedTag: string;
  selectedId: string;
  onSelect: (tag: string, pointId: string) => void;
}

function PointSearch({
  label,
  selectedTag,
  selectedId,
  onSelect,
}: PointSearchProps) {
  const [search, setSearch] = useState(selectedTag);
  const [results, setResults] = useState<PointMeta[]>([]);
  const [dropOpen, setDropOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const doSearch = useCallback((term: string) => {
    if (term.length < 2) {
      setResults([]);
      setDropOpen(false);
      return;
    }
    void pointsApi.list({ search: term, limit: 8 }).then((res) => {
      if (res.success) {
        setResults(res.data.data);
        setDropOpen(true);
      }
    });
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setSearch(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(v), 300);
  }

  function handlePick(pt: PointMeta) {
    setSearch(pt.tagname);
    setDropOpen(false);
    onSelect(pt.tagname, pt.id);
  }

  function handleClear() {
    setSearch("");
    setResults([]);
    setDropOpen(false);
    onSelect("", "");
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ position: "relative" }}>
        <input
          value={search}
          onChange={handleChange}
          onFocus={() => search.length >= 2 && setDropOpen(true)}
          onBlur={() => {
            timerRef.current = setTimeout(() => setDropOpen(false), 150);
          }}
          placeholder="Search by tag name…"
          style={{
            width: "100%",
            padding: "6px 28px 6px 8px",
            background: "var(--io-surface-sunken)",
            border: `1px solid ${selectedId ? "var(--io-accent)" : "var(--io-border)"}`,
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-primary)",
            fontSize: 12,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {search && (
          <button
            onMouseDown={handleClear}
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              fontSize: 14,
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ×
          </button>
        )}
        {dropOpen && results.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 2px)",
              left: 0,
              right: 0,
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              zIndex: 20,
              maxHeight: 180,
              overflowY: "auto",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            {results.map((pt) => (
              <button
                key={pt.id}
                onMouseDown={() => handlePick(pt)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "5px 10px",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--io-border)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 11,
                    color: "var(--io-text-primary)",
                  }}
                >
                  {pt.tagname}
                </div>
                {pt.display_name && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--io-text-muted)",
                      marginTop: 1,
                    }}
                  >
                    {pt.display_name}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedId && (
        <div style={{ fontSize: 10, color: "var(--io-accent)", marginTop: 3 }}>
          ✓ {selectedTag}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VariantCard — labeled card for the variant picker grid
// ---------------------------------------------------------------------------

interface VariantCardProps {
  label: string;
  isSelected: boolean;
  onClick: () => void;
}

function VariantCard({ label, isSelected, onClick }: VariantCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: 8,
        background: isSelected
          ? "color-mix(in srgb, var(--io-accent) 12%, transparent)"
          : "var(--io-surface-sunken)",
        border: `2px solid ${isSelected ? "var(--io-accent)" : "var(--io-border)"}`,
        borderRadius: "var(--io-radius)",
        cursor: "pointer",
        minWidth: 80,
      }}
    >
      {/* Shape preview placeholder */}
      <div
        style={{
          width: 56,
          height: 56,
          background: isSelected
            ? "color-mix(in srgb, var(--io-accent) 20%, transparent)"
            : "color-mix(in srgb, var(--io-border) 60%, transparent)",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="4"
            y="4"
            width="20"
            height="20"
            rx="2"
            stroke={isSelected ? "var(--io-accent)" : "var(--io-text-muted)"}
            strokeWidth="1.5"
            fill="none"
          />
          <line
            x1="9"
            y1="14"
            x2="19"
            y2="14"
            stroke={isSelected ? "var(--io-accent)" : "var(--io-text-muted)"}
            strokeWidth="1.5"
          />
          <line
            x1="14"
            y1="9"
            x2="14"
            y2="19"
            stroke={isSelected ? "var(--io-accent)" : "var(--io-text-muted)"}
            strokeWidth="1.5"
          />
        </svg>
      </div>
      <span
        style={{
          fontSize: 10,
          color: isSelected ? "var(--io-accent)" : "var(--io-text-muted)",
          textAlign: "center",
          lineHeight: 1.3,
          maxWidth: 80,
          wordBreak: "break-word",
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ShapeDropDialog
// ---------------------------------------------------------------------------

export function ShapeDropDialog({
  shapeId,
  shapeDisplayName,
  onPlace,
  onCancel,
  open,
  editMode = false,
  initialVariant,
}: ShapeDropDialogProps) {
  const loadShape = useLibraryStore((s) => s.loadShape);

  const [sidecar, setSidecar] = useState<ShapeSidecar | null>(null);
  const [loading, setLoading] = useState(true);

  // Step 1 state
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());

  // Step 2 state
  const [bindings, setBindings] = useState<
    Array<{ partKey: string; tag: string; pointId: string }>
  >([]);
  const [selectedElements, setSelectedElements] = useState<Set<string>>(
    new Set<string>(),
  );

  const [step, setStep] = useState<1 | 2>(editMode ? 2 : 1);

  // Load shape sidecar when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSidecar(null);

    void loadShape(shapeId).then((entry) => {
      if (!entry) {
        setLoading(false);
        return;
      }
      const sc = entry.sidecar;
      setSidecar(sc);

      // libraryStore uses sidecar.options (Array) for variants
      const opts = sc.options ?? [];
      // Pre-select initialVariant when editing; fall back to first option
      const startVariant =
        initialVariant && opts.some((o) => o.id === initialVariant)
          ? initialVariant
          : (opts[0]?.id ?? "default");
      setSelectedVariant(startVariant);
      setSelectedAddons(new Set());

      // Init per-part bindings
      const parts = sc.bindableParts ?? [
        { partId: "body", label: "Equipment Body", category: "process" },
      ];
      setBindings(
        parts.map((p) => ({ partKey: p.partId, tag: "", pointId: "" })),
      );

      // Init display elements
      setSelectedElements(new Set<string>());

      // Decide starting step: show step 1 whenever multiple variants exist
      // (even in edit mode, so the user can switch variants).
      const hasMultipleOpts = opts.length > 1;
      const hasAddons = (sc.addons ?? []).length > 0;
      const showStep1 = hasMultipleOpts || (!editMode && hasAddons);
      setStep(showStep1 ? 1 : 2);

      setLoading(false);
    });
  }, [open, shapeId, editMode, initialVariant, loadShape]);

  if (!open) return null;

  // libraryStore sidecar uses `options` array (not `variants.options` Record)
  const variantOptions = sidecar?.options ?? [];
  const addons = sidecar?.addons ?? [];
  const bindableParts = sidecar?.bindableParts ?? [
    { partId: "body", label: "Equipment Body", category: "process" },
  ];

  function buildComposableParts() {
    return [
      ...getVariantImpliedParts(selectedVariant),
      ...Array.from(selectedAddons).map((id) => ({
        partId: id,
        attachment: getAddonAttachment(id),
      })),
    ];
  }

  function buildConfig(): PlacedShapeConfig {
    return {
      shapeId,
      variant: selectedVariant || "default",
      composableParts: buildComposableParts(),
      pointBindings: bindings
        .filter((b) => b.tag || b.pointId)
        .map((b) => ({
          partKey: b.partKey,
          pointId: b.pointId || undefined,
          pointTag: b.tag || undefined,
        })),
      displayElements: Array.from(selectedElements),
    };
  }

  function handleUseDefaults() {
    const firstKey = variantOptions[0]?.id ?? "default";
    onPlace({
      shapeId,
      variant: firstKey,
      composableParts: getVariantImpliedParts(firstKey),
      pointBindings: [],
      displayElements: [],
    });
  }

  function handleSkipBinding() {
    onPlace({
      shapeId,
      variant: selectedVariant || "default",
      composableParts: buildComposableParts(),
      pointBindings: [],
      displayElements: Array.from(selectedElements),
    });
  }

  function toggleAddon(id: string) {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleElement(id: string) {
    setSelectedElements((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Shared styles
  // ---------------------------------------------------------------------------

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 1100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.55)",
  };

  const dialogStyle: React.CSSProperties = {
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    width: 560,
    maxWidth: "90vw",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--io-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 10,
  };

  function btnStyle(primary?: boolean): React.CSSProperties {
    return {
      padding: "6px 14px",
      borderRadius: "var(--io-radius)",
      fontSize: 12,
      fontWeight: 500,
      cursor: "pointer",
      border: "1px solid var(--io-border)",
      background: primary ? "var(--io-accent)" : "var(--io-surface)",
      color: primary ? "#09090b" : "var(--io-text-primary)",
    };
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={overlayStyle}>
        <div
          style={{
            ...dialogStyle,
            minHeight: 120,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ color: "var(--io-text-muted)", fontSize: 13 }}>
            Loading shape…
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div style={dialogStyle}>
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--io-text-primary)",
              flex: 1,
            }}
          >
            {editMode ? "Shape Configuration" : `Place ${shapeDisplayName}`}
          </span>
          {!editMode && (
            <span style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
              Step {step} of 2
            </span>
          )}
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              fontSize: 18,
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ×
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {/* Step 1: Variant picker + add-ons */}
          {step === 1 && (
            <>
              {variantOptions.length > 0 && (
                <>
                  <div style={sectionLabel}>Select Variant</div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 20,
                    }}
                  >
                    {variantOptions.map((opt) => (
                      <VariantCard
                        key={opt.id}
                        label={opt.label}
                        isSelected={opt.id === selectedVariant}
                        onClick={() => setSelectedVariant(opt.id)}
                      />
                    ))}
                  </div>
                </>
              )}

              {addons.length > 0 && (
                <>
                  <div style={sectionLabel}>Add-ons</div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {addons.map((addon) => {
                      const isFailPos = addon.id.startsWith("fail-");
                      const disabled =
                        isFailPos && !variantHasActuator(selectedVariant);
                      const checked = selectedAddons.has(addon.id);
                      return (
                        <label
                          key={addon.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: disabled ? "default" : "pointer",
                            opacity: disabled ? 0.4 : 1,
                            fontSize: 12,
                            color: "var(--io-text-primary)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => !disabled && toggleAddon(addon.id)}
                            style={{ accentColor: "var(--io-accent)" }}
                          />
                          {addon.label}
                          {disabled && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "var(--io-text-muted)",
                              }}
                            >
                              (requires actuator variant)
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </>
              )}

              {variantOptions.length === 0 && addons.length === 0 && (
                <div
                  style={{
                    color: "var(--io-text-muted)",
                    fontSize: 12,
                    textAlign: "center",
                    padding: "24px 0",
                  }}
                >
                  No variants available. Click Next to configure bindings.
                </div>
              )}
            </>
          )}

          {/* Step 2: Point bindings + display elements */}
          {step === 2 && (
            <>
              {bindableParts.length > 0 && (
                <>
                  <div style={sectionLabel}>Point Bindings</div>
                  {bindableParts.map((part) => {
                    const b = bindings.find((x) => x.partKey === part.partId);
                    return (
                      <PointSearch
                        key={part.partId}
                        label={part.label}
                        selectedTag={b?.tag ?? ""}
                        selectedId={b?.pointId ?? ""}
                        onSelect={(tag, pointId) => {
                          setBindings((prev) =>
                            prev.map((x) =>
                              x.partKey === part.partId
                                ? { ...x, tag, pointId }
                                : x,
                            ),
                          );
                        }}
                      />
                    );
                  })}
                </>
              )}

              <div
                style={{
                  ...sectionLabel,
                  marginTop: bindableParts.length > 0 ? 16 : 0,
                }}
              >
                Display Elements
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {ALL_ELEMENTS.map(({ id, label }) => (
                  <label
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--io-text-primary)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedElements.has(id)}
                      onChange={() => toggleElement(id)}
                      style={{ accentColor: "var(--io-accent)" }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderTop: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        >
          {step === 1 && (
            <>
              {!editMode && (
                <button style={btnStyle()} onClick={handleUseDefaults}>
                  Use Defaults
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button style={btnStyle()} onClick={onCancel}>
                Cancel
              </button>
              <button style={btnStyle(true)} onClick={() => setStep(2)}>
                Next →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              {(!editMode || variantOptions.length > 1) && (
                <button style={btnStyle()} onClick={() => setStep(1)}>
                  ← Back
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button style={btnStyle()} onClick={onCancel}>
                Cancel
              </button>
              <button style={btnStyle()} onClick={handleSkipBinding}>
                Skip Binding
              </button>
              <button
                style={btnStyle(true)}
                onClick={() => onPlace(buildConfig())}
              >
                {editMode ? "Save" : "Place"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
