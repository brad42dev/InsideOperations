/**
 * DesignerLeftPalette.tsx
 *
 * Left sidebar palette. Content is mode-dependent:
 *  - Graphic mode: Equipment, Stencils, Display Elements, Widgets, Points
 *  - Dashboard mode: Widgets, Equipment, Stencils, Display Elements
 *  - Report mode: Widgets, Report Elements, Equipment, Stencils, Display Elements
 *
 * Layers belong in the right panel only (spec §15).
 */

import React, { useEffect, useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";
import { useLibraryStore, useSceneStore } from "../../store/designer";
import type {
  DisplayElementType,
  WidgetType,
} from "../../shared/types/graphics";
import { graphicsApi } from "../../api/graphics";
import PointsBrowserPanel from "../../shared/components/PointsBrowserPanel";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerLeftPaletteProps {
  collapsed: boolean;
  width: number;
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform 0.15s",
      }}
    >
      <path
        d="M4 2L8 6L4 10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        padding: "6px 10px",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--io-border)",
        color: "var(--io-text-muted)",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        cursor: "pointer",
        textAlign: "left",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--io-surface-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <IconChevron open={open} />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// (SkeletonTile and SvgThumbnail removed — equipment section now uses category tiles)

// ---------------------------------------------------------------------------
// Delete confirmation dialog (Radix Dialog, no window.confirm)
// ---------------------------------------------------------------------------

function DeleteConfirmDialog({
  open,
  onOpenChange,
  label,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9998,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            padding: "20px 24px",
            width: 360,
            zIndex: 9999,
            fontSize: 13,
            color: "var(--io-text-primary)",
          }}
        >
          <Dialog.Title
            style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}
          >
            Delete &ldquo;{label}&rdquo;?
          </Dialog.Title>
          <Dialog.Description
            style={{
              fontSize: 12,
              color: "var(--io-text-muted)",
              marginBottom: 20,
            }}
          >
            This action cannot be undone.
          </Dialog.Description>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Dialog.Close asChild>
              <button
                style={{
                  padding: "6px 14px",
                  background: "var(--io-surface-elevated)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-primary)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              style={{
                padding: "6px 14px",
                background: "var(--io-danger, #ef4444)",
                border: "none",
                borderRadius: "var(--io-radius)",
                color: "#fff",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


// ---------------------------------------------------------------------------
// Display element types
// ---------------------------------------------------------------------------

const DISPLAY_ELEMENT_TYPES: Array<{
  type: DisplayElementType;
  label: string;
}> = [
  { type: "text_readout", label: "Text Readout" },
  { type: "analog_bar", label: "Analog Bar" },
  { type: "fill_gauge", label: "Fill Gauge" },
  { type: "sparkline", label: "Sparkline" },
  { type: "alarm_indicator", label: "Alarm Indicator" },
  { type: "digital_status", label: "Digital Status" },
];

// Spec-accurate mini SVG previews for each display element type
function DisplayElementPreview({
  type,
  size,
}: {
  type: DisplayElementType;
  size: number;
}) {
  const s = size;
  switch (type) {
    case "text_readout":
      // Box with "123.4" value text
      return (
        <svg
          width={s}
          height={Math.round(s * 0.5)}
          viewBox="0 0 60 22"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="0"
            y="0"
            width="60"
            height="22"
            rx="2"
            fill="#27272A"
            stroke="#3F3F46"
            strokeWidth="1"
          />
          <text
            x="30"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="10"
            fill="#A1A1AA"
          >
            123.4
          </text>
          <text
            x="50"
            y="14"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize="8"
            fill="#71717A"
          >
            °F
          </text>
        </svg>
      );
    case "analog_bar":
      // Vertical bar with zones and pointer
      return (
        <svg
          width={Math.round(s * 0.45)}
          height={s}
          viewBox="0 0 20 46"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="2"
            y="0"
            width="14"
            height="46"
            fill="#27272A"
            stroke="#52525B"
            strokeWidth="0.5"
          />
          <rect x="3" y="1" width="12" height="7" fill="#5C3A3A" />
          <rect x="3" y="8" width="12" height="10" fill="#5C4A32" />
          <rect x="3" y="18" width="12" height="14" fill="#404048" />
          <rect x="3" y="32" width="12" height="7" fill="#32445C" />
          <rect x="3" y="39" width="12" height="6" fill="#2E3A5C" />
          <polygon points="16,21 22,24 16,27" fill="#A1A1AA" />
          <line
            x1="3"
            y1="24"
            x2="15"
            y2="24"
            stroke="#A1A1AA"
            strokeWidth="0.8"
          />
        </svg>
      );
    case "fill_gauge":
      // Vertical bar with fill
      return (
        <svg
          width={Math.round(s * 0.45)}
          height={s}
          viewBox="0 0 20 46"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="2"
            y="0"
            width="14"
            height="46"
            rx="1"
            fill="none"
            stroke="#52525B"
            strokeWidth="0.5"
          />
          <rect
            x="3"
            y="16"
            width="12"
            height="29"
            rx="0.5"
            fill="#475569"
            opacity="0.6"
          />
          <line
            x1="3"
            y1="16"
            x2="15"
            y2="16"
            stroke="#64748B"
            strokeWidth="0.8"
            strokeDasharray="3 2"
          />
        </svg>
      );
    case "sparkline":
      // Sparkline chart
      return (
        <svg
          width={s}
          height={Math.round(s * 0.4)}
          viewBox="0 0 60 16"
          style={{ pointerEvents: "none" }}
        >
          <rect x="0" y="0" width="60" height="16" rx="1" fill="#27272A" />
          <polyline
            points="3,12 10,9 17,11 24,6 31,8 38,4 45,9 52,7 59,10"
            fill="none"
            stroke="#A1A1AA"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      );
    case "alarm_indicator":
      // ISA-101 alarm shapes
      return (
        <svg
          width={s}
          height={Math.round(s * 0.6)}
          viewBox="0 0 52 24"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x="1"
            y="3"
            width="16"
            height="12"
            rx="1.5"
            fill="none"
            stroke="#EF4444"
            strokeWidth="1.5"
          />
          <text
            x="9"
            y="11"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="7"
            fontWeight="600"
            fill="#EF4444"
          >
            1
          </text>
          <polygon
            points="27,2 37,18 17,18"
            fill="none"
            stroke="#F97316"
            strokeWidth="1.5"
          />
          <text
            x="27"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="7"
            fontWeight="600"
            fill="#F97316"
          >
            2
          </text>
          <ellipse
            cx="46"
            cy="12"
            rx="5"
            ry="4"
            fill="none"
            stroke="#06B6D4"
            strokeWidth="1.5"
          />
          <text
            x="46"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="7"
            fontWeight="600"
            fill="#06B6D4"
          >
            4
          </text>
        </svg>
      );
    case "digital_status":
      // Pill with RUN / STOP
      return (
        <svg
          width={s}
          height={Math.round(s * 0.55)}
          viewBox="0 0 56 24"
          style={{ pointerEvents: "none" }}
        >
          <rect x="1" y="5" width="24" height="14" rx="2" fill="#3F3F46" />
          <text
            x="13"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="8"
            fill="#A1A1AA"
          >
            OPEN
          </text>
          <rect x="29" y="5" width="26" height="14" rx="2" fill="#059669" />
          <text
            x="42"
            y="14"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="8"
            fill="#F9FAFB"
          >
            RUN
          </text>
        </svg>
      );
    default:
      return (
        <span
          style={{
            fontSize: Math.round(s * 0.4),
            color: "var(--io-text-muted)",
          }}
        >
          ⊞
        </span>
      );
  }
}

function DisplayElementTile({
  type,
  label,
  collapsed,
}: {
  type: DisplayElementType;
  label: string;
  collapsed: boolean;
}) {
  const [isFavorited, setIsFavorited] = useState(() => {
    try {
      const raw = localStorage.getItem("io:palette-favorites") ?? "{}";
      const favs = JSON.parse(raw) as Record<string, string[]>;
      return (favs["display-elements"] ?? []).includes(type);
    } catch {
      return false;
    }
  });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left-click drags; right-clicks go to the context menu
      if (e.button !== 0) return;
      e.preventDefault();
      const ghost = document.createElement("div");
      ghost.id = "io-canvas-drag-ghost";
      ghost.setAttribute("data-drag-ghost", "true");
      ghost.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:9999",
        "opacity:0.7",
        "padding:4px 8px",
        "background:var(--io-accent)",
        "color:#09090b",
        "border-radius:4px",
        "font-size:11px",
        "font-weight:600",
        "transform:translate(-50%,-50%)",
        `left:${e.clientX}px`,
        `top:${e.clientY}px`,
        "display:block",
        "visibility:visible",
      ].join(";");
      ghost.textContent = label;
      document.body.appendChild(ghost);

      const onMove = (ev: MouseEvent) => {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
        document.dispatchEvent(
          new CustomEvent("io:display-element-drag-move", {
            detail: { elementType: type, x: ev.clientX, y: ev.clientY },
          }),
        );
      };
      const onUp = (ev: MouseEvent) => {
        ghost.remove();
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.dispatchEvent(
          new CustomEvent("io:display-element-drop", {
            detail: { elementType: type, x: ev.clientX, y: ev.clientY },
          }),
        );
      };
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ghost.remove();
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseup", onUp, true);
          document.removeEventListener("keydown", onKeyDown, true);
        }
      };
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
      document.addEventListener("keydown", onKeyDown, true);
    },
    [type, label],
  );

  function handlePlaceAtCenter() {
    const canvasEl = document.querySelector('[data-designer-canvas="true"]');
    const rect = canvasEl?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    document.dispatchEvent(
      new CustomEvent("io:display-element-drop", {
        detail: { elementType: type, x: cx, y: cy },
      }),
    );
  }

  function handleToggleFavorite() {
    try {
      const raw = localStorage.getItem("io:palette-favorites") ?? "{}";
      const favs = JSON.parse(raw) as Record<string, string[]>;
      if (!favs["display-elements"]) favs["display-elements"] = [];
      if (isFavorited) {
        favs["display-elements"] = favs["display-elements"].filter(
          (t) => t !== type,
        );
        setIsFavorited(false);
      } else {
        if (!favs["display-elements"].includes(type)) {
          favs["display-elements"].push(type);
        }
        setIsFavorited(true);
      }
      localStorage.setItem("io:palette-favorites", JSON.stringify(favs));
    } catch {
      // localStorage may be blocked — silently ignore
    }
  }

  const { menuState, handleContextMenu, closeMenu } = useContextMenu();

  const displayElemMenuItems = [
    { label: "Place at Center", onClick: handlePlaceAtCenter },
    {
      label: isFavorited ? "Remove from Favorites" : "Add to Favorites",
      onClick: handleToggleFavorite,
    },
  ];

  if (collapsed) {
    return (
      <>
        <div
          onMouseDown={handleMouseDown}
          onContextMenu={handleContextMenu}
          title={label}
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            cursor: "grab",
            overflow: "hidden",
            userSelect: "none",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--io-accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--io-border)";
          }}
        >
          <DisplayElementPreview type={type} size={26} />
        </div>
        {menuState && (
          <ContextMenu
            x={menuState.x}
            y={menuState.y}
            items={displayElemMenuItems}
            onClose={closeMenu}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        title={label}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          width: 72,
          height: 64,
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          cursor: "grab",
          overflow: "hidden",
          userSelect: "none",
          padding: 4,
          textAlign: "center",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--io-accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--io-border)";
        }}
      >
        <DisplayElementPreview type={type} size={40} />
        <span
          style={{
            fontSize: 9,
            color: "var(--io-text-muted)",
            lineHeight: 1.2,
            textAlign: "center",
          }}
        >
          {label.length > 12 ? label.slice(0, 11) + "…" : label}
        </span>
      </div>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={displayElemMenuItems}
          onClose={closeMenu}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Equipment section
// ---------------------------------------------------------------------------

/** Equipment category tiles — one tile per equipment family. */
const EQUIPMENT_CATEGORIES: Array<{
  id: string;
  label: string;
  defaultId: string;
}> = [
  { id: "valves",         label: "Valve",         defaultId: "valve-gate" },
  { id: "pumps",          label: "Pump",          defaultId: "pump-centrifugal-opt1" },
  { id: "rotating",       label: "Rotating",      defaultId: "compressor-opt1" },
  { id: "heat-transfer",  label: "Heat Transfer", defaultId: "heat-exchanger-shell-tube" },
  { id: "vessels",        label: "Vessel",        defaultId: "vessel-vertical-welded" },
  { id: "tanks",          label: "Tank",          defaultId: "tank-storage-cone-roof" },
  { id: "reactors",       label: "Reactor",       defaultId: "reactor-base" },
  { id: "columns",        label: "Column",        defaultId: "column-distillation-standard-plain" },
  { id: "filters",        label: "Filter",        defaultId: "filter-vacuum" },
  { id: "instrumentation",label: "Instrument",    defaultId: "instrument-field" },
  { id: "mixers",         label: "Mixer",         defaultId: "mixer-agitator" },
];

interface EquipmentCategoryTileProps {
  id: string;
  label: string;
  defaultId: string;
  collapsed: boolean;
}

function EquipmentCategoryTile({ id, label, defaultId, collapsed }: EquipmentCategoryTileProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();

      const ghost = document.createElement("div");
      ghost.id = "io-canvas-drag-ghost";
      ghost.setAttribute("data-drag-ghost", "true");
      ghost.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:9999",
        "opacity:0.85",
        "padding:4px 10px",
        "background:var(--io-accent)",
        "color:#09090b",
        "border-radius:4px",
        "font-size:11px",
        "font-weight:600",
        "white-space:nowrap",
        "transform:translate(-50%,-50%)",
        `left:${e.clientX}px`,
        `top:${e.clientY}px`,
      ].join(";");
      ghost.textContent = label;
      document.body.appendChild(ghost);

      const onMove = (ev: MouseEvent) => {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
      };

      const onUp = (ev: MouseEvent) => {
        ghost.remove();
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.dispatchEvent(
          new CustomEvent("io:category-drop", {
            detail: { categoryId: id, defaultShapeId: defaultId, x: ev.clientX, y: ev.clientY },
          }),
        );
      };

      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ghost.remove();
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseup", onUp, true);
          document.removeEventListener("keydown", onKeyDown, true);
        }
      };

      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
      document.addEventListener("keydown", onKeyDown, true);
    },
    [id, label, defaultId],
  );

  if (collapsed) {
    return (
      <button
        onMouseDown={handleMouseDown}
        title={label}
        style={{
          width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--io-surface-sunken)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          cursor: "grab", padding: 2, overflow: "hidden",
        }}
      >
        <img
          src={`/shapes/${id}/${defaultId}.svg`}
          alt={label}
          style={{ maxWidth: 28, maxHeight: 28, objectFit: "contain" }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </button>
    );
  }

  return (
    <button
      onMouseDown={handleMouseDown}
      title={`Drag to place ${label}`}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
        padding: "8px 4px",
        background: "var(--io-surface-sunken)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        cursor: "grab", width: "calc(50% - 4px)",
        transition: "border-color 0.1s, background 0.1s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--io-accent)";
        (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--io-accent) 8%, var(--io-surface-sunken))";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--io-border)";
        (e.currentTarget as HTMLElement).style.background = "var(--io-surface-sunken)";
      }}
    >
      <div style={{ width: 52, height: 44, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <img
          src={`/shapes/${id}/${defaultId}.svg`}
          alt={label}
          style={{ maxWidth: 48, maxHeight: 40, objectFit: "contain" }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <span style={{ fontSize: 10, color: "var(--io-text-secondary)", textAlign: "center", lineHeight: 1.2, fontWeight: 500 }}>
        {label}
      </span>
    </button>
  );
}

function EquipmentSection({ collapsed }: { collapsed: boolean }) {
  const loadIndex = useLibraryStore((s) => s.loadIndex);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  if (collapsed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 4px", alignItems: "center" }}>
        {EQUIPMENT_CATEGORIES.map(cat => (
          <EquipmentCategoryTile key={cat.id} {...cat} collapsed />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8 }}>
      {EQUIPMENT_CATEGORIES.map(cat => (
        <EquipmentCategoryTile key={cat.id} {...cat} collapsed={false} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom (user) shapes section — palette variant
// ---------------------------------------------------------------------------

interface UserShapeItem {
  id: string;
  shape_id: string;
  name: string;
  category: string;
  source: "user";
}

function CustomShapesPaletteTile({ item }: { item: UserShapeItem }) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left-click drags; right-clicks go to the context menu
      if (e.button !== 0) return;
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      el.setAttribute("data-dragging", "true");

      const ghost = document.createElement("div");
      ghost.id = "io-canvas-drag-ghost";
      ghost.setAttribute("data-drag-ghost", "true");
      ghost.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:9999",
        "opacity:0.7",
        "padding:4px 8px",
        "background:var(--io-accent)",
        "color:#09090b",
        "border-radius:4px",
        "font-size:11px",
        "font-weight:600",
        "white-space:nowrap",
        "transform:translate(-50%,-50%)",
        `left:${e.clientX}px`,
        `top:${e.clientY}px`,
        "display:block",
        "visibility:visible",
      ].join(";");
      ghost.textContent = item.name;
      document.body.appendChild(ghost);

      const onMove = (ev: MouseEvent) => {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
        document.dispatchEvent(
          new CustomEvent("io:shape-drag-move", {
            detail: { shapeId: item.shape_id, x: ev.clientX, y: ev.clientY },
          }),
        );
      };

      const onUp = (ev: MouseEvent) => {
        ghost.remove();
        el.removeAttribute("data-dragging");
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.dispatchEvent(
          new CustomEvent("io:shape-drop", {
            detail: { shapeId: item.shape_id, x: ev.clientX, y: ev.clientY },
          }),
        );
      };

      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ghost.remove();
          el.removeAttribute("data-dragging");
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseup", onUp, true);
          document.removeEventListener("keydown", onKeyDown, true);
        }
      };

      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
      document.addEventListener("keydown", onKeyDown, true);
    },
    [item.shape_id, item.name],
  );

  function handleAddToCanvas() {
    const canvasEl = document.querySelector('[data-designer-canvas="true"]');
    const rect = canvasEl?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    document.dispatchEvent(
      new CustomEvent("io:shape-drop", {
        detail: { shapeId: item.shape_id, x: cx, y: cy },
      }),
    );
  }

  const { menuState, handleContextMenu, closeMenu } = useContextMenu();

  return (
    <>
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        title={item.name}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          width: 64,
          height: 64,
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          cursor: "grab",
          overflow: "hidden",
          userSelect: "none",
          padding: 4,
          textAlign: "center",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--io-accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--io-border)";
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.5,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect
              x="3"
              y="6"
              width="18"
              height="12"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
            <path
              d="M8 12h8M12 8v8"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div
          style={{
            fontSize: 9,
            lineHeight: 1.2,
            wordBreak: "break-word",
            maxWidth: "100%",
            color: "var(--io-text-muted)",
          }}
        >
          {item.name.length > 12 ? item.name.slice(0, 11) + "…" : item.name}
        </div>
      </div>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[{ label: "Add to Canvas", onClick: handleAddToCanvas }]}
          onClose={closeMenu}
        />
      )}
    </>
  );
}

function CustomShapesPaletteSection({ collapsed }: { collapsed: boolean }) {
  const [shapes, setShapes] = useState<UserShapeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Lazy-load on first open (when not collapsed)
  useEffect(() => {
    if (collapsed || loaded || loading) return;
    setLoading(true);
    graphicsApi
      .listUserShapes()
      .then((resp) => {
        if (resp.success) setShapes(resp.data.data ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true))
      .finally(() => setLoading(false));
  }, [collapsed, loaded, loading]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const result = await graphicsApi.uploadUserShape(file);
      setShapes((prev) => [...prev, { ...result }]);
    } catch {
      // silently fail in palette context — user can try Symbol Library for details
    } finally {
      setUploading(false);
    }
  }

  if (collapsed) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "8px 4px",
          alignItems: "center",
        }}
      >
        {shapes.slice(0, 4).map((item) => (
          <div
            key={item.id}
            title={item.name}
            style={{
              width: 32,
              height: 32,
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect
                x="1"
                y="3"
                width="12"
                height="8"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
                style={{ color: "var(--io-text-muted)" }}
              />
            </svg>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column" }}
    >
      {/* Upload button row */}
      <div
        style={{
          padding: "6px 8px",
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            flex: 1,
            padding: "5px 0",
            background: "var(--io-surface-elevated)",
            border: "1px dashed var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-muted)",
            fontSize: 11,
            cursor: uploading ? "wait" : "pointer",
            textAlign: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--io-accent)";
            e.currentTarget.style.color = "var(--io-accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--io-border)";
            e.currentTarget.style.color = "var(--io-text-muted)";
          }}
        >
          {uploading ? "Uploading…" : "+ Upload SVG"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg,image/svg+xml"
          onChange={handleUpload}
          style={{ display: "none" }}
        />
      </div>

      {/* Shape tiles */}
      <div style={{ padding: "0 8px 8px" }}>
        {loading && (
          <div
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              padding: "8px 0",
            }}
          >
            Loading…
          </div>
        )}
        {loaded && shapes.length === 0 && (
          <div
            style={{
              padding: "12px 8px",
              fontSize: 11,
              color: "var(--io-text-muted)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            No custom shapes yet.
            <br />
            Upload an SVG to get started.
          </div>
        )}
        {loaded && shapes.length > 0 && (
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4 }}
          >
            {shapes.map((item) => (
              <CustomShapesPaletteTile key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stencils section
// ---------------------------------------------------------------------------

interface StencilItem {
  id: string;
  name: string;
}

function StencilTile({
  item,
  collapsed,
}: {
  item: StencilItem;
  collapsed: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left-click drags; right-clicks go to the context menu
      if (e.button !== 0) return;
      e.preventDefault();
      const ghost = document.createElement("div");
      ghost.id = "io-canvas-drag-ghost";
      ghost.setAttribute("data-drag-ghost", "true");
      ghost.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:9999",
        "opacity:0.7",
        "padding:4px 8px",
        "background:var(--io-accent)",
        "color:#09090b",
        "border-radius:4px",
        "font-size:11px",
        "font-weight:600",
        "transform:translate(-50%,-50%)",
        `left:${e.clientX}px`,
        `top:${e.clientY}px`,
        "display:block",
        "visibility:visible",
      ].join(";");
      ghost.textContent = item.name;
      document.body.appendChild(ghost);
      const onMove = (ev: MouseEvent) => {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
      };
      const onUp = (ev: MouseEvent) => {
        ghost.remove();
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.dispatchEvent(
          new CustomEvent("io:stencil-drop", {
            detail: { stencilId: item.id, x: ev.clientX, y: ev.clientY },
          }),
        );
      };
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ghost.remove();
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseup", onUp, true);
          document.removeEventListener("keydown", onKeyDown, true);
        }
      };
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
      document.addEventListener("keydown", onKeyDown, true);
    },
    [item.id, item.name],
  );

  function handleExportSvg() {
    graphicsApi
      .exportShapeSvg(item.id)
      .then((svgContent) => {
        const blob = new Blob([svgContent], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${item.name}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error("[StencilTile] SVG export failed:", err);
      });
  }

  function handleEdit() {
    // TODO: open stencil editor when implemented
    console.warn(
      "[StencilTile] Edit stencil: stencil editor not yet implemented for stencil",
      item.id,
    );
  }

  function handleDeleteConfirmed() {
    // TODO: call delete API when endpoint is available
    console.warn(
      "[StencilTile] Delete stencil: API not yet implemented for stencil",
      item.id,
    );
  }

  const { menuState, handleContextMenu, closeMenu } = useContextMenu();

  const stencilMenuItems = [
    { label: "Edit", onClick: handleEdit },
    { label: "Export SVG", onClick: handleExportSvg },
    {
      label: "Delete",
      onClick: () => setDeleteOpen(true),
      danger: true,
      divider: true,
    },
  ];

  if (collapsed) {
    return (
      <>
        <div
          onMouseDown={handleMouseDown}
          onContextMenu={handleContextMenu}
          title={item.name}
          style={{
            width: 28,
            height: 28,
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            color: "var(--io-text-muted)",
            cursor: "grab",
            userSelect: "none",
          }}
        >
          {item.name.slice(0, 2).toUpperCase()}
        </div>
        {menuState && (
          <ContextMenu
            x={menuState.x}
            y={menuState.y}
            items={stencilMenuItems}
            onClose={closeMenu}
          />
        )}
        <DeleteConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          label={item.name}
          onConfirm={handleDeleteConfirmed}
        />
      </>
    );
  }

  return (
    <>
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        title={item.name}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          width: 64,
          height: 48,
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          cursor: "grab",
          fontSize: 9,
          color: "var(--io-text-muted)",
          userSelect: "none",
          padding: 4,
          textAlign: "center",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--io-accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--io-border)";
        }}
      >
        <div style={{ fontSize: 16 }}>⬜</div>
        <div
          style={{
            fontSize: 9,
            lineHeight: 1.2,
            wordBreak: "break-word",
            maxWidth: "100%",
          }}
        >
          {item.name.length > 10 ? item.name.slice(0, 9) + "…" : item.name}
        </div>
      </div>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={stencilMenuItems}
          onClose={closeMenu}
        />
      )}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        label={item.name}
        onConfirm={handleDeleteConfirmed}
      />
    </>
  );
}

function StencilsSection({ collapsed }: { collapsed: boolean }) {
  const [stencils, setStencils] = useState<StencilItem[]>([]);

  useEffect(() => {
    graphicsApi
      .listStencils()
      .then((result) => {
        if (result.success) {
          setStencils(
            result.data.data.map((s) => ({ id: s.id, name: s.name })),
          );
        }
      })
      .catch(() => {
        /* silent — stencil list is non-critical */
      });
  }, []);

  if (collapsed) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2, padding: 4 }}>
        {stencils.map((s) => (
          <StencilTile key={s.id} item={s} collapsed />
        ))}
      </div>
    );
  }

  if (stencils.length === 0) {
    return (
      <div
        style={{
          padding: "8px 12px",
          fontSize: 11,
          color: "var(--io-text-muted)",
          lineHeight: 1.5,
        }}
      >
        No stencils saved yet.
        <br />
        Select elements → right-click → "Save as Stencil…"
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: 8,
        flexShrink: 0,
      }}
    >
      {stencils.map((s) => (
        <StencilTile key={s.id} item={s} collapsed={false} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget types (dashboard / report modes)
// ---------------------------------------------------------------------------

const WIDGET_TYPES: Array<{ type: WidgetType; label: string; icon: string }> = [
  { type: "trend", label: "Trend", icon: "∿" },
  { type: "table", label: "Table", icon: "⊞" },
  { type: "gauge", label: "Gauge", icon: "◎" },
  { type: "kpi_card", label: "KPI Card", icon: "#" },
  { type: "bar_chart", label: "Bar Chart", icon: "▊" },
  { type: "pie_chart", label: "Pie Chart", icon: "◔" },
  { type: "alarm_list", label: "Alarm List", icon: "⚠" },
  { type: "muster_point", label: "Muster Point", icon: "⛺" },
];

function WidgetTile({
  type,
  label,
  icon,
  collapsed,
}: {
  type: WidgetType;
  label: string;
  icon: string;
  collapsed: boolean;
}) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left-click drags; right-clicks go to the context menu
      if (e.button !== 0) return;
      e.preventDefault();
      const ghost = document.createElement("div");
      ghost.id = "io-canvas-drag-ghost";
      ghost.setAttribute("data-drag-ghost", "true");
      ghost.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:9999",
        "opacity:0.7",
        "padding:4px 8px",
        "background:var(--io-accent)",
        "color:#09090b",
        "border-radius:4px",
        "font-size:11px",
        "font-weight:600",
        "transform:translate(-50%,-50%)",
        `left:${e.clientX}px`,
        `top:${e.clientY}px`,
        "display:block",
        "visibility:visible",
      ].join(";");
      ghost.textContent = label;
      document.body.appendChild(ghost);
      const onMove = (ev: MouseEvent) => {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
      };
      const onUp = (ev: MouseEvent) => {
        ghost.remove();
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.dispatchEvent(
          new CustomEvent("io:widget-drop", {
            detail: { widgetType: type, x: ev.clientX, y: ev.clientY },
          }),
        );
      };
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ghost.remove();
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseup", onUp, true);
          document.removeEventListener("keydown", onKeyDown, true);
        }
      };
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
      document.addEventListener("keydown", onKeyDown, true);
    },
    [type, label],
  );

  function handlePlaceAtCenter() {
    const canvasEl = document.querySelector('[data-designer-canvas="true"]');
    const rect = canvasEl?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    document.dispatchEvent(
      new CustomEvent("io:widget-drop", {
        detail: { widgetType: type, x: cx, y: cy },
      }),
    );
  }

  function handleAddToFavorites() {
    try {
      const raw = localStorage.getItem("io:palette-favorites") ?? "{}";
      const favs = JSON.parse(raw) as Record<string, string[]>;
      if (!favs["widgets"]) favs["widgets"] = [];
      if (!favs["widgets"].includes(type)) {
        favs["widgets"].push(type);
        localStorage.setItem("io:palette-favorites", JSON.stringify(favs));
      }
    } catch {
      // localStorage may be blocked — silently ignore
    }
  }

  const size = collapsed ? 32 : 48;
  const { menuState, handleContextMenu, closeMenu } = useContextMenu();

  return (
    <>
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        title={label}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          width: size,
          height: size,
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          cursor: "grab",
          fontSize: collapsed ? 14 : 20,
          color: "var(--io-text-secondary)",
          userSelect: "none",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--io-accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--io-border)";
        }}
      >
        <span>{icon}</span>
        {!collapsed && (
          <span
            style={{
              fontSize: 9,
              color: "var(--io-text-muted)",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            {label.length > 10 ? label.slice(0, 9) + "…" : label}
          </span>
        )}
      </div>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            { label: "Place at Center", onClick: handlePlaceAtCenter },
            { label: "Add to Favorites", onClick: handleAddToFavorites },
          ]}
          onClose={closeMenu}
        />
      )}
    </>
  );
}

function WidgetsSection({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "8px 4px",
          alignItems: "center",
        }}
      >
        {WIDGET_TYPES.map((w) => (
          <WidgetTile key={w.type} {...w} collapsed />
        ))}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: 8,
        flexShrink: 0,
      }}
    >
      {WIDGET_TYPES.map((w) => (
        <WidgetTile key={w.type} {...w} collapsed={false} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report Elements section (report mode only)
// ---------------------------------------------------------------------------

type ReportElementDef = {
  elementType:
    | "text_block"
    | "section_break"
    | "page_break"
    | "header"
    | "footer";
  label: string;
};

const REPORT_ELEMENTS: ReportElementDef[] = [
  { elementType: "text_block", label: "Text Block" },
  { elementType: "section_break", label: "Section Break" },
  { elementType: "page_break", label: "Page Break" },
  { elementType: "header", label: "Header" },
  { elementType: "footer", label: "Footer" },
];

function ReportElementPreview({
  elementType,
  size,
}: {
  elementType: ReportElementDef["elementType"];
  size: number;
}) {
  switch (elementType) {
    case "text_block":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 40 40"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x={2}
            y={2}
            width={36}
            height={36}
            rx={2}
            fill="#27272A"
            stroke="#3F3F46"
            strokeWidth={1}
          />
          <line
            x1={6}
            y1={10}
            x2={34}
            y2={10}
            stroke="#71717A"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <line
            x1={6}
            y1={16}
            x2={30}
            y2={16}
            stroke="#71717A"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <line
            x1={6}
            y1={22}
            x2={34}
            y2={22}
            stroke="#71717A"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <line
            x1={6}
            y1={28}
            x2={22}
            y2={28}
            stroke="#71717A"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>
      );
    case "section_break":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 40 40"
          style={{ pointerEvents: "none" }}
        >
          <line
            x1={4}
            y1={20}
            x2={36}
            y2={20}
            stroke="#6366f1"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <line
            x1={4}
            y1={14}
            x2={36}
            y2={14}
            stroke="#3F3F46"
            strokeWidth={1}
            strokeLinecap="round"
          />
          <line
            x1={4}
            y1={26}
            x2={36}
            y2={26}
            stroke="#3F3F46"
            strokeWidth={1}
            strokeLinecap="round"
          />
        </svg>
      );
    case "page_break":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 40 40"
          style={{ pointerEvents: "none" }}
        >
          <line
            x1={4}
            y1={20}
            x2={36}
            y2={20}
            stroke="#EF4444"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="4,3"
          />
          <text
            x={20}
            y={16}
            textAnchor="middle"
            fontSize={6}
            fill="#EF4444"
            fontWeight={600}
          >
            PAGE BREAK
          </text>
        </svg>
      );
    case "header":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 40 40"
          style={{ pointerEvents: "none" }}
        >
          <rect
            x={2}
            y={2}
            width={36}
            height={12}
            rx={2}
            fill="#1e3a5f"
            stroke="#3b82f6"
            strokeWidth={1}
          />
          <line
            x1={6}
            y1={8}
            x2={26}
            y2={8}
            stroke="#93c5fd"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <line
            x1={2}
            y1={16}
            x2={38}
            y2={16}
            stroke="#3F3F46"
            strokeWidth={1}
            strokeLinecap="round"
            strokeDasharray="3,2"
          />
          <line
            x1={6}
            y1={22}
            x2={34}
            y2={22}
            stroke="#52525B"
            strokeWidth={1}
            strokeLinecap="round"
          />
          <line
            x1={6}
            y1={27}
            x2={30}
            y2={27}
            stroke="#52525B"
            strokeWidth={1}
            strokeLinecap="round"
          />
        </svg>
      );
    case "footer":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 40 40"
          style={{ pointerEvents: "none" }}
        >
          <line
            x1={6}
            y1={10}
            x2={34}
            y2={10}
            stroke="#52525B"
            strokeWidth={1}
            strokeLinecap="round"
          />
          <line
            x1={6}
            y1={16}
            x2={30}
            y2={16}
            stroke="#52525B"
            strokeWidth={1}
            strokeLinecap="round"
          />
          <line
            x1={2}
            y1={22}
            x2={38}
            y2={22}
            stroke="#3F3F46"
            strokeWidth={1}
            strokeLinecap="round"
            strokeDasharray="3,2"
          />
          <rect
            x={2}
            y={26}
            width={36}
            height={12}
            rx={2}
            fill="#1e3a5f"
            stroke="#3b82f6"
            strokeWidth={1}
          />
          <line
            x1={6}
            y1={32}
            x2={26}
            y2={32}
            stroke="#93c5fd"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function ReportElementTile({
  elementType,
  label,
  collapsed,
}: ReportElementDef & { collapsed: boolean }) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left-click drags; right-clicks go to the context menu
      if (e.button !== 0) return;
      e.preventDefault();
      const ghost = document.createElement("div");
      ghost.id = "io-canvas-drag-ghost";
      ghost.setAttribute("data-drag-ghost", "true");
      ghost.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:9999",
        "opacity:0.7",
        "padding:4px 8px",
        "background:var(--io-accent)",
        "color:#09090b",
        "border-radius:4px",
        "font-size:11px",
        "font-weight:600",
        "transform:translate(-50%,-50%)",
        `left:${e.clientX}px`,
        `top:${e.clientY}px`,
        "display:block",
        "visibility:visible",
      ].join(";");
      ghost.textContent = label;
      document.body.appendChild(ghost);
      const onMove = (ev: MouseEvent) => {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
      };
      const onUp = (ev: MouseEvent) => {
        ghost.remove();
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.dispatchEvent(
          new CustomEvent("io:report-element-drop", {
            detail: { elementType, x: ev.clientX, y: ev.clientY },
          }),
        );
      };
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
          ghost.remove();
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseup", onUp, true);
          document.removeEventListener("keydown", onKeyDown, true);
        }
      };
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
      document.addEventListener("keydown", onKeyDown, true);
    },
    [elementType, label],
  );

  function handlePlaceAtCenter() {
    const canvasEl = document.querySelector('[data-designer-canvas="true"]');
    const rect = canvasEl?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    document.dispatchEvent(
      new CustomEvent("io:report-element-drop", {
        detail: { elementType, x: cx, y: cy },
      }),
    );
  }

  function handleAddToFavorites() {
    try {
      const raw = localStorage.getItem("io:palette-favorites") ?? "{}";
      const favs = JSON.parse(raw) as Record<string, string[]>;
      if (!favs["report-elements"]) favs["report-elements"] = [];
      if (!favs["report-elements"].includes(elementType)) {
        favs["report-elements"].push(elementType);
        localStorage.setItem("io:palette-favorites", JSON.stringify(favs));
      }
    } catch {
      // localStorage may be blocked — silently ignore
    }
  }

  const size = collapsed ? 32 : 48;
  const previewSize = collapsed ? 20 : 32;
  const { menuState, handleContextMenu, closeMenu } = useContextMenu();

  return (
    <>
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        title={label}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          width: size,
          height: size,
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          cursor: "grab",
          color: "var(--io-text-secondary)",
          userSelect: "none",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--io-accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--io-border)";
        }}
      >
        <ReportElementPreview elementType={elementType} size={previewSize} />
        {!collapsed && (
          <span
            style={{
              fontSize: 8,
              color: "var(--io-text-muted)",
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            {label.length > 11 ? label.slice(0, 10) + "…" : label}
          </span>
        )}
      </div>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            { label: "Place at Center", onClick: handlePlaceAtCenter },
            { label: "Add to Favorites", onClick: handleAddToFavorites },
          ]}
          onClose={closeMenu}
        />
      )}
    </>
  );
}

function ReportElementsSection({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "8px 4px",
          alignItems: "center",
        }}
      >
        {REPORT_ELEMENTS.map((r) => (
          <ReportElementTile key={r.elementType} {...r} collapsed />
        ))}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: 8,
        flexShrink: 0,
      }}
    >
      {REPORT_ELEMENTS.map((r) => (
        <ReportElementTile key={r.elementType} {...r} collapsed={false} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Point Browser — for Quick Bind (drag point onto symbol with valueAnchors)
// ---------------------------------------------------------------------------

function PointBrowserSection({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 6,
          fontSize: 14,
        }}
        title="Points"
      >
        ⌗
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        maxHeight: 280,
        overflow: "hidden",
      }}
    >
      <PointsBrowserPanel
        cacheKey="designer-points-browser"
        emptyHint="Drag a point onto a symbol to bind it."
        onDragStart={(e, pts) => {
          // Designer binds one point at a time; use the first (or only) point.
          const pt = pts[0];
          e.dataTransfer.setData(
            "application/io-point",
            JSON.stringify({
              type: "point",
              pointId: pt.id,
              tagname: pt.tagname,
              displayName: pt.display_name ?? pt.tagname,
              unit: pt.unit ?? "",
            }),
          );
          e.dataTransfer.effectAllowed = "copy";
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DesignerLeftPalette({
  collapsed,
  width,
}: DesignerLeftPaletteProps) {
  const designMode = useSceneStore((s) => s.designMode);
  const isGraphicMode = designMode === "graphic";
  const isReportMode = designMode === "report";

  const [equipOpen, setEquipOpen] = useState(true);
  const [myShapesOpen, setMyShapesOpen] = useState(false);
  const [stencilsOpen, setStencilsOpen] = useState(false);
  const [elemOpen, setElemOpen] = useState(true);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [widgetsOpen, setWidgetsOpen] = useState(true);
  const [reportElemOpen, setReportElemOpen] = useState(true);

  const containerStyle: React.CSSProperties = {
    width,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "var(--io-surface)",
    borderRight: "1px solid var(--io-border)",
  };

  if (collapsed) {
    return (
      <div style={containerStyle}>
        {isGraphicMode ? (
          <>
            <EquipmentSection collapsed />
            <div
              style={{
                height: 1,
                background: "var(--io-border)",
                flexShrink: 0,
              }}
            />
            <CustomShapesPaletteSection collapsed />
            <div
              style={{
                height: 1,
                background: "var(--io-border)",
                flexShrink: 0,
              }}
            />
            <StencilsSection collapsed />
            <div
              style={{
                height: 1,
                background: "var(--io-border)",
                flexShrink: 0,
              }}
            />
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4 }}
            >
              {DISPLAY_ELEMENT_TYPES.map((t) => (
                <DisplayElementTile key={t.type} {...t} collapsed />
              ))}
            </div>
            <div
              style={{
                height: 1,
                background: "var(--io-border)",
                flexShrink: 0,
              }}
            />
            <WidgetsSection collapsed />
          </>
        ) : (
          <>
            <WidgetsSection collapsed />
            {isReportMode && (
              <>
                <div
                  style={{
                    height: 1,
                    background: "var(--io-border)",
                    flexShrink: 0,
                  }}
                />
                <ReportElementsSection collapsed />
              </>
            )}
            <div
              style={{
                height: 1,
                background: "var(--io-border)",
                flexShrink: 0,
              }}
            />
            <EquipmentSection collapsed />
            <div
              style={{
                height: 1,
                background: "var(--io-border)",
                flexShrink: 0,
              }}
            />
            <CustomShapesPaletteSection collapsed />
            <div
              style={{
                height: 1,
                background: "var(--io-border)",
                flexShrink: 0,
              }}
            />
            <StencilsSection collapsed />
            <div
              style={{
                height: 1,
                background: "var(--io-border)",
                flexShrink: 0,
              }}
            />
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4 }}
            >
              {DISPLAY_ELEMENT_TYPES.map((t) => (
                <DisplayElementTile key={t.type} {...t} collapsed />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Single scrollable column — all sections stack at natural height */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {isGraphicMode ? (
          <>
            <SectionHeader
              label="Equipment"
              open={equipOpen}
              onToggle={() => setEquipOpen((v) => !v)}
            />
            {equipOpen && <EquipmentSection collapsed={false} />}

            <SectionHeader
              label="My Shapes"
              open={myShapesOpen}
              onToggle={() => setMyShapesOpen((v) => !v)}
            />
            {myShapesOpen && <CustomShapesPaletteSection collapsed={false} />}

            <SectionHeader
              label="Stencils"
              open={stencilsOpen}
              onToggle={() => setStencilsOpen((v) => !v)}
            />
            {stencilsOpen && <StencilsSection collapsed={false} />}

            <SectionHeader
              label="Display Elements"
              open={elemOpen}
              onToggle={() => setElemOpen((v) => !v)}
            />
            {elemOpen && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 8 }}>
                {DISPLAY_ELEMENT_TYPES.map((t) => (
                  <DisplayElementTile key={t.type} {...t} collapsed={false} />
                ))}
              </div>
            )}

            <SectionHeader
              label="Widgets"
              open={widgetsOpen}
              onToggle={() => setWidgetsOpen((v) => !v)}
            />
            {widgetsOpen && <WidgetsSection collapsed={false} />}

            <SectionHeader
              label="Points"
              open={pointsOpen}
              onToggle={() => setPointsOpen((v) => !v)}
            />
            {pointsOpen && <PointBrowserSection collapsed={false} />}
          </>
        ) : (
          <>
            <SectionHeader
              label="Widgets"
              open={widgetsOpen}
              onToggle={() => setWidgetsOpen((v) => !v)}
            />
            {widgetsOpen && <WidgetsSection collapsed={false} />}

            {isReportMode && (
              <>
                <SectionHeader
                  label="Report Elements"
                  open={reportElemOpen}
                  onToggle={() => setReportElemOpen((v) => !v)}
                />
                {reportElemOpen && <ReportElementsSection collapsed={false} />}
              </>
            )}

            <SectionHeader
              label="Equipment"
              open={equipOpen}
              onToggle={() => setEquipOpen((v) => !v)}
            />
            {equipOpen && <EquipmentSection collapsed={false} />}

            <SectionHeader
              label="My Shapes"
              open={myShapesOpen}
              onToggle={() => setMyShapesOpen((v) => !v)}
            />
            {myShapesOpen && <CustomShapesPaletteSection collapsed={false} />}

            <SectionHeader
              label="Stencils"
              open={stencilsOpen}
              onToggle={() => setStencilsOpen((v) => !v)}
            />
            {stencilsOpen && <StencilsSection collapsed={false} />}

            <SectionHeader
              label="Display Elements"
              open={elemOpen}
              onToggle={() => setElemOpen((v) => !v)}
            />
            {elemOpen && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 8 }}>
                {DISPLAY_ELEMENT_TYPES.map((t) => (
                  <DisplayElementTile key={t.type} {...t} collapsed={false} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
