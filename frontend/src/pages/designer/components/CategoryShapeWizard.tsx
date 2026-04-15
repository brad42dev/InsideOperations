/**
 * CategoryShapeWizard.tsx
 *
 * Multi-step shape configuration wizard opened when an equipment category
 * tile is dragged from the left palette.
 *
 * Step 0        — Pick base shape from category (thumbnail grid)
 * Steps 1 .. N  — One step per addon group in the selected shape's `addons`
 *                 (e.g. "actuator", "agitator", "support", "fail-indicator")
 * Final step    — Display element sidecars with slot picker + optional point bindings
 *
 * Layout: fixed-size dialog, left panel = full-height inline SVG composite preview,
 *         right panel = scrollable step content. "Place" available at every step.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLibraryStore } from "../../../store/designer";
import type { ShapeSidecar } from "../../../shared/types/shapes";
import type {
  DisplayElementType,
  GraphicDocument,
  SymbolInstance,
  DisplayElement,
} from "../../../shared/types/graphics";
import type {
  PlacedShapeConfig,
  DisplayElementUserConfig,
} from "./ShapeDropDialog";
import {
  DEConfigPanel,
  makeDefaultElementConfig,
  userConfigToDisplayConfig,
  DE_SIDECAR_KEY as _SDD_SIDECAR_KEY,
  DE_FALLBACK_SLOT as _SDD_FALLBACK_SLOT,
  DE_FALLBACK_SLOTS_LIST as _SDD_FALLBACK_SLOTS_LIST,
  DE_CHIP as _SDD_CHIP,
  displayConfigToUserConfig as _displayConfigToUserConfig,
} from "./ShapeDropDialog";
import { resolveSlotWithSidecar } from "../../../shared/graphics/anchorSlots";
import { SceneRenderer } from "../../../shared/graphics/SceneRenderer";
import { ShapePointSelector, resolvePointBindings } from "./ShapePointSelector";
import type { ShapeSlotDef, ShapeBindingEntry } from "./ShapePointSelector";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryShapeWizardProps {
  categoryId: string;
  defaultShapeId: string;
  onPlace: (config: PlacedShapeConfig) => void;
  onCancel: () => void;
  /** Edit mode: skip Step 0 (shape picker) and go straight to the final step. */
  editMode?: boolean;
  /** Display name shown in the header when editMode is true. */
  shapeDisplayName?: string;
  /** Pre-populated state from an existing shape node (edit mode only). */
  initialConfig?: {
    bindings: ShapeBindingEntry[];
    selectedElements: string[];
    elementConfigs: Record<string, DisplayElementUserConfig>;
  };
  /** When true, jump directly to the Point Bindings step once the shape loads. */
  jumpToPointBindings?: boolean;
}

interface AddonGroup {
  group: string;
  label: string;
  options: Array<{ id: string; file: string; label: string }>;
}

// ---------------------------------------------------------------------------
// Static maps
// ---------------------------------------------------------------------------

const GROUP_TO_CATEGORY: Record<string, string> = {
  actuator: "actuators",
  "fail-indicator": "indicators",
  agitator: "agitators",
  support: "supports",
};

const GROUP_LABELS: Record<string, string> = {
  actuator: "Actuator",
  "fail-indicator": "Fail Position",
  agitator: "Agitator Type",
  support: "Support Type",
};

// Re-use the canonical constants from ShapeDropDialog (single source of truth)
const DE_SIDECAR_KEY = _SDD_SIDECAR_KEY;
const DE_FALLBACK_SLOT = _SDD_FALLBACK_SLOT;
const DE_FALLBACK_SLOTS_LIST = _SDD_FALLBACK_SLOTS_LIST;
const DE_CHIP = _SDD_CHIP;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAddonAttachment(addonId: string): string {
  if (addonId.startsWith("actuator-") || addonId.includes("actuator"))
    return "actuator";
  if (addonId.startsWith("fail-")) return "fail-indicator";
  if (addonId.startsWith("agitator-")) return "agitator";
  if (addonId.startsWith("support-")) return "support";
  return addonId;
}

function deriveAddonGroups(sidecar: ShapeSidecar | null): AddonGroup[] {
  if (!sidecar?.addons?.length) return [];
  const groups = new Map<string, AddonGroup>();
  for (const addon of sidecar.addons) {
    const g = addon.group ?? "addon";
    if (!groups.has(g)) {
      groups.set(g, {
        group: g,
        label: GROUP_LABELS[g] ?? g.replace(/-/g, " "),
        options: [],
      });
    }
    groups.get(g)!.options.push(addon);
  }
  return Array.from(groups.values());
}

// ---------------------------------------------------------------------------
// ALL_DISPLAY_ELEMENTS — ordered list shown in the sidecar step
// ---------------------------------------------------------------------------

const ALL_DISPLAY_ELEMENTS: Array<{ id: DisplayElementType; label: string }> = [
  { id: "text_readout", label: "Text Readout" },
  { id: "alarm_indicator", label: "Alarm Indicator" },
  { id: "analog_bar", label: "Analog Bar" },
  { id: "fill_gauge", label: "Fill Gauge" },
  { id: "sparkline", label: "Sparkline" },
  { id: "digital_status", label: "Digital Status" },
  { id: "point_name_label", label: "Shape Label" },
];

// ---------------------------------------------------------------------------
// ShapeThumbnailCard
// ---------------------------------------------------------------------------

function ShapeThumbnailCard({
  shapeId,
  category,
  label,
  selected,
  onClick,
}: {
  shapeId: string;
  category: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: 8,
        background: selected
          ? "color-mix(in srgb, var(--io-accent) 12%, transparent)"
          : "var(--io-surface-sunken)",
        border: `2px solid ${selected ? "var(--io-accent)" : "var(--io-border)"}`,
        borderRadius: "var(--io-radius)",
        cursor: "pointer",
        minWidth: 76,
        maxWidth: 96,
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={`/shapes/${category}/${shapeId}.svg`}
          alt={label}
          style={{
            maxWidth: 52,
            maxHeight: 52,
            objectFit: "contain",
            opacity: selected ? 1 : 0.75,
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <span
        style={{
          fontSize: 10,
          color: selected ? "var(--io-accent)" : "var(--io-text-secondary)",
          textAlign: "center",
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// AddonThumbnailCard
// ---------------------------------------------------------------------------

function AddonThumbnailCard({
  file,
  group,
  label,
  selected,
  onClick,
}: {
  addonId: string;
  file: string;
  group: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const addonCategory = GROUP_TO_CATEGORY[group] ?? group;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: 8,
        background: selected
          ? "color-mix(in srgb, var(--io-accent) 12%, transparent)"
          : "var(--io-surface-sunken)",
        border: `2px solid ${selected ? "var(--io-accent)" : "var(--io-border)"}`,
        borderRadius: "var(--io-radius)",
        cursor: "pointer",
        minWidth: 76,
        maxWidth: 96,
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={`/shapes/${addonCategory}/${file}`}
          alt={label}
          style={{
            maxWidth: 52,
            maxHeight: 52,
            objectFit: "contain",
            opacity: selected ? 1 : 0.75,
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <span
        style={{
          fontSize: 10,
          color: selected ? "var(--io-accent)" : "var(--io-text-secondary)",
          textAlign: "center",
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// buildPreviewDocument — constructs a minimal GraphicDocument for the
// SceneRenderer preview panel. One SymbolInstance with selected addons and
// display elements, canvas sized to encompass all content.
// ---------------------------------------------------------------------------

/** Pixel dimensions SceneRenderer renders each DE type at with the given config. */
function dePixelSize(
  dt: DisplayElementType,
  cfg?: DisplayElementUserConfig,
): { w: number; h: number } {
  switch (dt) {
    case "text_readout": {
      // Mirror nodeTransforms.ts getNodeLocalSize text_readout branch:
      // ROW_H=16, GAP=2; rows = value + optional pointName + optional displayName
      const rows =
        1 + (cfg?.showPointName ? 1 : 0) + (cfg?.showDisplayName ? 1 : 0);
      return { w: 40, h: rows * 16 + (rows - 1) * 2 };
    }
    case "alarm_indicator":
      return { w: 24, h: 18 };
    case "analog_bar":
      return { w: 20, h: 80 };
    case "fill_gauge":
      return { w: 22, h: 90 };
    case "sparkline":
      return { w: 110, h: 18 };
    case "digital_status":
      return { w: 40, h: 22 };
    case "point_name_label":
      return { w: 50, h: 12 };
    default:
      return { w: 40, h: 20 };
  }
}

/**
 * Convert a slot center to the transform.position used by SceneRenderer.
 * Most DE types are top-left anchored; alarm_indicator is center-anchored.
 * Mirrors applyDeSlotOffset in DesignerCanvas.
 */
function deSlotToPosition(
  dt: DisplayElementType,
  slotName: string,
  center: { x: number; y: number },
  cfg?: DisplayElementUserConfig,
): { x: number; y: number } {
  let { x, y } = center;
  const isTop = slotName === "top";
  const isHoriz = isTop || slotName === "bottom";
  const isRight = slotName.startsWith("right");
  const isLeft = slotName.startsWith("left");
  const isVert = isRight || isLeft;

  switch (dt) {
    case "alarm_indicator":
      break; // center-based — no adjustment
    case "text_readout": {
      const { w, h } = dePixelSize(dt, cfg);
      if (isHoriz) x -= w / 2;
      if (isTop) y -= h;
      if (isVert) y -= h / 2;
      if (isLeft) x -= w;
      break;
    }
    case "analog_bar": {
      const h = 80;
      if (isRight) x += 15;
      if (isLeft) x -= 25;
      y -= h / 2;
      break;
    }
    case "fill_gauge": {
      const w = 22,
        h = 90;
      if (isHoriz) x -= w / 2;
      if (isTop) y -= h;
      if (isVert) y -= h / 2;
      if (isLeft) x -= w;
      break;
    }
    case "sparkline": {
      const w = 110,
        h = 18;
      if (isHoriz) x -= w / 2;
      if (isTop) y -= h;
      if (isVert) y -= h / 2;
      if (isLeft) x -= w;
      break;
    }
    case "digital_status": {
      const w = 40,
        h = 22;
      if (isHoriz) x -= w / 2;
      if (isTop) y -= h;
      if (isVert) y -= h / 2;
      if (isLeft) x -= w;
      break;
    }
    case "point_name_label": {
      const w = 50,
        h = 12;
      if (isHoriz) x -= w / 2;
      if (isTop) y -= h;
      if (isVert) y -= h / 2;
      if (isLeft) x -= w;
      break;
    }
  }
  return { x, y };
}

function buildPreviewDocument(
  shapeId: string,
  selectedVariant: string,
  selectedAddons: Record<string, string>,
  selectedElements: Set<DisplayElementType>,
  elementSlots: Record<string, string>,
  elementConfigs: Record<string, DisplayElementUserConfig>,
  sidecar: ShapeSidecar,
): GraphicDocument {
  const geo = sidecar.geometry;
  const shapeW = geo?.baseSize?.[0] ?? geo?.width ?? 64;
  const shapeH = geo?.baseSize?.[1] ?? geo?.height ?? 64;
  const relBbox = { x: 0, y: 0, width: shapeW, height: shapeH };

  // Estimate canvas bounding box including composable parts and display elements
  let minX = 0,
    minY = 0,
    maxX = shapeW,
    maxY = shapeH;

  // Composable parts: estimate from compositeAttachments or stacking fallback.
  // Must mirror renderSymbolInstanceSvg's stacking logic so the canvas is large
  // enough to contain all rendered content without clipping.
  //
  // Parts with an attachment entry are placed at att.y - bodyBase.y (exact).
  // Parts without an attachment stack above/below the previous part using
  // highestAboveY / belowStacked accumulators — same as the renderer.
  let highestAboveY = 0; // tracks topmost y of above-stacked parts (renderer-side)
  let belowStacked = shapeH;
  for (const [group, addonId] of Object.entries(selectedAddons)) {
    if (!addonId) continue;
    const att =
      sidecar.compositeAttachments?.find((a) => a.forPart === addonId) ??
      sidecar.compositeAttachments?.find((a) => a.forPart === group);
    // Estimate part dimensions: parts are typically ~70% of the larger shape dim.
    const estPart = Math.max(shapeW, shapeH) * 0.7;
    if (att) {
      if (group === "support") {
        // Support parts extend downward from py = att.y and don't extend above it,
        // so don't push minX/minY into negative territory.
        // Leg/skirt SVGs are ~86 px tall; saddle SVGs are only ~14 px tall.
        // Use shapeH*0.12 + 14 as a proportional estimate that covers both cases:
        // saddles on short horizontal vessels (att.y + ~19 > shapeH) and leaves
        // vertical shapes unchanged (leg clip of ~6-8 px in preview is acceptable).
        maxY = Math.max(maxY, att.y + shapeH * 0.12 + 14);
        if (att.y < 0) minY = Math.min(minY, att.y);
      } else if (group === "agitator") {
        // Agitators render inside the vessel body — no bbox extension needed.
      } else {
        // Actuators and other top-mounted parts extend above att.y.
        const estPy = att.y - estPart * 0.7;
        if (estPy < highestAboveY) highestAboveY = estPy;
        minX = Math.min(minX, att.x - estPart / 2);
        minY = Math.min(minY, att.y - estPart);
        maxX = Math.max(maxX, att.x + estPart / 2);
        maxY = Math.max(maxY, att.y + estPart / 2);
      }
    } else if (group === "actuator" || group === "fail-indicator") {
      // Stacking fallback: renderer places this at highestAboveY - partHeight.
      // Use estPart as the part height estimate.
      const stackPy = highestAboveY - estPart;
      highestAboveY = stackPy;
      minY = Math.min(minY, stackPy);
      minX = Math.min(minX, (shapeW - estPart) / 2);
      maxX = Math.max(maxX, (shapeW + estPart) / 2);
    } else if (group === "support") {
      maxY = Math.max(maxY, belowStacked + estPart);
      belowStacked += estPart;
    }
  }

  // Display elements: resolve slot positions and extend bounding box
  const deChildren: DisplayElement[] = [];
  for (const dt of selectedElements) {
    const key = DE_SIDECAR_KEY[dt] ?? dt;
    const slotName = elementSlots[dt] ?? DE_FALLBACK_SLOT[key] ?? "bottom";
    const center = resolveSlotWithSidecar(slotName, key, sidecar, relBbox);
    const userCfg = elementConfigs[dt] ?? makeDefaultElementConfig(dt);
    const { w: dw, h: dh } = dePixelSize(dt, userCfg);
    const pos = deSlotToPosition(dt, slotName, center, userCfg);

    // vessel_overlay fill gauges are contained within the vessel — no bbox extension.
    // alarm_indicator is center-anchored; all other DEs are top-left anchored.
    const isVesselOverlay =
      dt === "fill_gauge" &&
      slotName === "vessel-interior" &&
      !!sidecar.vesselInteriorPath;
    if (!isVesselOverlay) {
      if (dt === "alarm_indicator") {
        minX = Math.min(minX, pos.x - dw / 2 - 4);
        minY = Math.min(minY, pos.y - dh / 2 - 4);
        maxX = Math.max(maxX, pos.x + dw / 2 + 4);
        maxY = Math.max(maxY, pos.y + dh / 2 + 4);
      } else {
        minX = Math.min(minX, pos.x - 4);
        minY = Math.min(minY, pos.y - 4);
        maxX = Math.max(maxX, pos.x + dw + 4);
        maxY = Math.max(maxY, pos.y + dh + 4);
      }
    }
    deChildren.push({
      id: `preview-de-${dt}`,
      type: "display_element",
      displayType: dt,
      name: dt,
      binding: {},
      config: userConfigToDisplayConfig(dt, userCfg, {
        vesselOverlay: isVesselOverlay,
      }),
      transform: {
        position: pos,
        rotation: 0,
        scale: { x: 1, y: 1 },
        mirror: "none",
      },
      visible: true,
      locked: false,
      opacity: 1,
    });
  }

  // Canvas with 15% margin on each side
  const rangeW = maxX - minX;
  const rangeH = maxY - minY;
  const mH = rangeW * 0.15;
  const mV = rangeH * 0.15;
  const canvasW = rangeW + mH * 2;
  const canvasH = rangeH + mV * 2;
  // Symbol positioned so its (0,0) aligns with the content plus margin
  const symX = -minX + mH;
  const symY = -minY + mV;

  const composableParts = Object.entries(selectedAddons)
    .filter(([, addonId]) => addonId)
    .map(([group, addonId]) => ({ partId: addonId, attachment: group }));

  const symbolInstance: SymbolInstance = {
    id: "preview-symbol",
    type: "symbol_instance",
    name: "Preview",
    shapeRef: { shapeId, variant: selectedVariant || "default" },
    composableParts,
    textZoneOverrides: {},
    children: deChildren,
    propertyOverrides: {},
    transform: {
      position: { x: symX, y: symY },
      rotation: 0,
      scale: { x: 1, y: 1 },
      mirror: "none",
    },
    visible: true,
    locked: false,
    opacity: 1,
  };

  return {
    id: "preview-doc",
    type: "graphic_document",
    name: "Preview",
    canvas: { width: canvasW, height: canvasH, backgroundColor: "transparent" },
    metadata: {
      tags: [],
      designMode: "graphic",
      graphicScope: "console",
      gridSize: 20,
      gridVisible: false,
      snapToGrid: false,
    },
    layers: [],
    expressions: {},
    children: [symbolInstance],
    transform: {
      position: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      mirror: "none",
    },
    visible: true,
    locked: false,
    opacity: 1,
  };
}

// ---------------------------------------------------------------------------
// CategoryShapeWizard — main component
// ---------------------------------------------------------------------------

export function CategoryShapeWizard({
  categoryId,
  defaultShapeId,
  onPlace,
  onCancel,
  editMode = false,
  shapeDisplayName,
  initialConfig,
  jumpToPointBindings = false,
}: CategoryShapeWizardProps) {
  const index = useLibraryStore((s) => s.index);
  const loadShape = useLibraryStore((s) => s.loadShape);
  const loadShapes = useLibraryStore((s) => s.loadShapes);

  // All non-part shapes visible in this category
  const categoryShapes = index.filter((s) => s.category === categoryId);

  // Wizard state
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState(defaultShapeId);
  const [sidecar, setSidecar] = useState<ShapeSidecar | null>(null);
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string>>(
    {},
  );
  const [selectedElements, setSelectedElements] = useState<
    Set<DisplayElementType>
  >(new Set());
  const [elementSlots, setElementSlots] = useState<Record<string, string>>({});
  const [elementConfigs, setElementConfigs] = useState<
    Record<string, DisplayElementUserConfig>
  >({});
  const [focusedElement, setFocusedElement] =
    useState<DisplayElementType | null>(null);
  const [bindings, setBindings] = useState<ShapeBindingEntry[]>([]);

  // Steps: 0 (variant picker) + N addon groups + 1 (display elements) + 1 (point bindings)
  const totalSteps = 1 + addonGroups.length + 2;
  const lastStep = totalSteps - 1;
  const isLastStep = step === lastStep;
  const isDisplayElementsStep = step === 1 + addonGroups.length;
  const isPointBindingsStep = isLastStep;

  // Pre-load all category shape SVGs
  useEffect(() => {
    if (categoryShapes.length > 0) {
      void loadShapes(categoryShapes.map((s) => s.id));
    }
  }, [categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load sidecar for selected shape
  useEffect(() => {
    void loadShape(selectedId).then((entry) => {
      if (!entry) return;
      const sc = entry.sidecar;
      setSidecar(sc);
      const groups = deriveAddonGroups(sc);
      setAddonGroups(groups);
      setSelectedAddons({});
      setSelectedElements(new Set());
      setElementConfigs({});
      setFocusedElement(null);

      // Initialize element slots from sidecar.defaultSlots
      const dSlots =
        (sc.defaultSlots as Record<string, string> | undefined) ?? {};
      const initialSlots: Record<string, string> = {};
      for (const { id } of ALL_DISPLAY_ELEMENTS) {
        const key = DE_SIDECAR_KEY[id]!;
        initialSlots[id] = dSlots[key] ?? DE_FALLBACK_SLOT[key] ?? "bottom";
      }
      setElementSlots(initialSlots);

      // Point bindings for ALL bindable parts (active filtering done at render)
      const parts = sc.bindableParts ?? [
        { partId: "body", label: "Equipment Body", category: "equipment" },
      ];

      if (editMode && initialConfig) {
        // Pre-populate from the existing node state
        const initBindingMap = new Map(
          initialConfig.bindings.map((b) => [b.partKey, b]),
        );
        setBindings(
          parts.map(
            (p) =>
              initBindingMap.get(p.partId) ?? {
                partKey: p.partId,
                tag: "",
                pointId: "",
              },
          ),
        );
        setSelectedElements(
          new Set(initialConfig.selectedElements as DisplayElementType[]),
        );
        setElementConfigs(initialConfig.elementConfigs);
        setFocusedElement(
          (initialConfig.selectedElements[0] as DisplayElementType) ?? null,
        );
      } else {
        setBindings(
          parts.map((p) => ({ partKey: p.partId, tag: "", pointId: "" })),
        );
        setSelectedElements(new Set());
        setElementConfigs({});
        setFocusedElement(null);
      }
    });
  }, [selectedId, loadShape, editMode, initialConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Jump straight to Point Bindings step when opened via "Bind point..." context menu
  useEffect(() => {
    if (jumpToPointBindings && sidecar) {
      setStep(addonGroups.length + 2); // lastStep = 1 + addonGroups.length + 2 - 1
    }
  }, [jumpToPointBindings, sidecar, addonGroups.length]);

  // Build PlacedShapeConfig from current wizard state
  const buildConfig = useCallback((): PlacedShapeConfig => {
    const variant = sidecar?.options?.[0]?.id ?? "opt1";
    const selectedAddonIds = new Set(
      Object.values(selectedAddons).filter(Boolean),
    );
    const allParts = sidecar?.bindableParts ?? [
      { partId: "body", label: "Equipment Body", category: "equipment" },
    ];
    const activeParts = allParts.filter(
      (p) => p.partId === "body" || selectedAddonIds.has(p.partId),
    );
    return {
      shapeId: selectedId,
      variant,
      composableParts: Object.values(selectedAddons)
        .filter(Boolean)
        .map((id) => ({ partId: id, attachment: getAddonAttachment(id) })),
      pointBindings: resolvePointBindings(activeParts, bindings),
      displayElements: Array.from(selectedElements) as string[],
      displayElementSlots: Object.fromEntries(
        Array.from(selectedElements).map((dt) => [
          dt,
          elementSlots[dt] ?? DE_FALLBACK_SLOT[DE_SIDECAR_KEY[dt]!] ?? "bottom",
        ]),
      ),
      displayElementConfigs: Object.fromEntries(
        Array.from(selectedElements)
          .filter((dt) => elementConfigs[dt])
          .map((dt) => [dt, elementConfigs[dt]!]),
      ),
    };
  }, [
    selectedId,
    sidecar,
    selectedAddons,
    bindings,
    selectedElements,
    elementSlots,
    elementConfigs,
  ]);

  // Build a minimal GraphicDocument for the SceneRenderer preview.
  // Rebuilt whenever the selection state changes; SceneRenderer loads shapes
  // from the cache (fast after initial load) when the document id changes.
  const previewDoc = useMemo((): GraphicDocument | null => {
    if (!sidecar) return null;
    const variant = sidecar.options?.[0]?.id ?? "opt1";
    return buildPreviewDocument(
      selectedId,
      variant,
      selectedAddons,
      selectedElements,
      elementSlots,
      elementConfigs,
      sidecar,
    );
  }, [
    selectedId,
    sidecar,
    selectedAddons,
    selectedElements,
    elementSlots,
    elementConfigs,
  ]);

  function handlePlace() {
    onPlace(buildConfig());
  }

  function handleSelectShape(id: string) {
    setSelectedId(id);
    setStep(0);
  }

  function handleAddonToggle(group: string, addonId: string) {
    setSelectedAddons((prev) => {
      if (prev[group] === addonId) {
        const next = { ...prev };
        delete next[group];
        return next;
      }
      return { ...prev, [group]: addonId };
    });
  }

  function handleElementToggle(type: DisplayElementType) {
    if (selectedElements.has(type)) {
      setSelectedElements((prev) => {
        const n = new Set(prev);
        n.delete(type);
        return n;
      });
      if (focusedElement === type) setFocusedElement(null);
    } else {
      setSelectedElements((prev) => new Set([...prev, type]));
      if (!elementConfigs[type]) {
        const bodyBinding = bindings.find((b) => b.partKey === "body");
        setElementConfigs((prev) => ({
          ...prev,
          [type]: makeDefaultElementConfig(type, bodyBinding),
        }));
      }
      setFocusedElement(type);
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 1100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.55)",
  };

  // Responsive dialog: scales with viewport
  const dialogStyle: React.CSSProperties = {
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    width: "min(1560px, 96vw)",
    height: "min(760px, 90vh)",
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
      padding: "7px 16px",
      borderRadius: "var(--io-radius)",
      fontSize: 12,
      fontWeight: 500,
      cursor: "pointer",
      border: `1px solid ${primary ? "transparent" : "var(--io-border)"}`,
      background: primary ? "var(--io-accent)" : "var(--io-surface)",
      color: primary ? "#09090b" : "var(--io-text-primary)",
    };
  }

  function stepLabel(): string {
    if (step === 0) return "Pick Type";
    if (step <= addonGroups.length)
      return addonGroups[step - 1]?.label ?? "Configure";
    if (isDisplayElementsStep) return "Display Elements";
    return "Point Bindings";
  }

  const categoryLabel = categoryId
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div style={dialogStyle}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
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
            {editMode
              ? (shapeDisplayName ?? categoryLabel)
              : `Place ${categoryLabel}`}
          </span>
          {/* Step dots */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  background:
                    i === step
                      ? "var(--io-accent)"
                      : i < step
                        ? "color-mix(in srgb, var(--io-accent) 40%, transparent)"
                        : "var(--io-border)",
                  transition: "width 0.2s, background 0.2s",
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              minWidth: 80,
              textAlign: "right",
            }}
          >
            {stepLabel()}
          </span>
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

        {/* ── Body: left preview + right step content ──────────────────── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "row",
          }}
        >
          {/* Left panel — composite SVG preview, full height */}
          <div
            style={{
              width: 600,
              flexShrink: 0,
              borderRight: "1px solid var(--io-border)",
              background: "var(--io-surface-sunken)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            {previewDoc ? (
              <SceneRenderer
                document={previewDoc}
                liveSubscribe={false}
                previewMode={true}
                style={{
                  // Cap scale at 4× so small shapes (48px valves) don't fill the
                  // entire 600px panel. Panel is 600px wide with 16px padding each
                  // side → 568px available. Height cap leaves room for the header.
                  width: Math.min(568, Math.ceil(previewDoc.canvas.width * 4)),
                  height: Math.min(
                    680,
                    Math.ceil(previewDoc.canvas.height * 4),
                  ),
                }}
              />
            ) : (
              <div style={{ color: "var(--io-text-muted)", fontSize: 11 }}>
                Loading…
              </div>
            )}
          </div>

          {/* Right panel — scrollable content */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {/* Content area */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: isPointBindingsStep ? "hidden" : "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Step 0: Shape variant picker */}
              {step === 0 && (
                <>
                  <div style={sectionLabel}>Select {categoryLabel} Type</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {categoryShapes.map((shape) => (
                      <ShapeThumbnailCard
                        key={shape.id}
                        shapeId={shape.id}
                        category={categoryId}
                        label={shape.label}
                        selected={shape.id === selectedId}
                        onClick={() => handleSelectShape(shape.id)}
                      />
                    ))}
                    {categoryShapes.length === 0 && (
                      <div
                        style={{ color: "var(--io-text-muted)", fontSize: 12 }}
                      >
                        No shapes in this category yet.
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Steps 1-N: Addon group pickers */}
              {step > 0 &&
                step <= addonGroups.length &&
                (() => {
                  const ag = addonGroups[step - 1]!;
                  const selectedAddon = selectedAddons[ag.group] ?? null;
                  return (
                    <>
                      <div style={sectionLabel}>
                        Select {ag.label} (optional)
                      </div>
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                      >
                        <button
                          onClick={() => {
                            const next = { ...selectedAddons };
                            delete next[ag.group];
                            setSelectedAddons(next);
                          }}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            padding: 8,
                            background: !selectedAddon
                              ? "color-mix(in srgb, var(--io-accent) 12%, transparent)"
                              : "var(--io-surface-sunken)",
                            border: `2px solid ${!selectedAddon ? "var(--io-accent)" : "var(--io-border)"}`,
                            borderRadius: "var(--io-radius)",
                            cursor: "pointer",
                            minWidth: 76,
                          }}
                        >
                          <div
                            style={{
                              width: 56,
                              height: 56,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 22,
                                color: "var(--io-text-muted)",
                              }}
                            >
                              ∅
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              color: !selectedAddon
                                ? "var(--io-accent)"
                                : "var(--io-text-secondary)",
                            }}
                          >
                            None
                          </span>
                        </button>
                        {ag.options.map((opt) => (
                          <AddonThumbnailCard
                            key={opt.id}
                            addonId={opt.id}
                            file={opt.file}
                            group={ag.group}
                            label={opt.label}
                            selected={selectedAddon === opt.id}
                            onClick={() => handleAddonToggle(ag.group, opt.id)}
                          />
                        ))}
                      </div>
                    </>
                  );
                })()}

              {/* Point Bindings step */}
              {isPointBindingsStep &&
                (() => {
                  const selectedAddonIds = new Set(
                    Object.values(selectedAddons).filter(Boolean),
                  );
                  const allParts = sidecar?.bindableParts ?? [
                    {
                      partId: "body",
                      label: "Equipment Body",
                      category: "equipment",
                    },
                  ];
                  const activeParts = allParts.filter(
                    (p) =>
                      p.partId === "body" || selectedAddonIds.has(p.partId),
                  );
                  const slotDefs: ShapeSlotDef[] = activeParts.map((p) => ({
                    partId: p.partId,
                    label: p.label,
                    isDefault: p.partId === "body",
                  }));
                  return (
                    <ShapePointSelector
                      slots={slotDefs}
                      bindings={bindings}
                      onChange={setBindings}
                    />
                  );
                })()}

              {/* Display Elements step — two-column: checklist left, config right */}
              {isDisplayElementsStep &&
                (() => {
                  const bodyBinding = bindings.find(
                    (b) => b.partKey === "body",
                  );
                  return (
                    <div
                      style={{ display: "flex", gap: 0, flex: 1, minHeight: 0 }}
                    >
                      {/* Left — element checklist */}
                      <div
                        style={{
                          width: 196,
                          flexShrink: 0,
                          borderRight: "1px solid var(--io-border)",
                          paddingRight: 10,
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <div style={sectionLabel}>Elements</div>
                        {ALL_DISPLAY_ELEMENTS.map(({ id, label }) => {
                          const isChecked = selectedElements.has(id);
                          const isFocused = focusedElement === id;
                          return (
                            <div
                              key={id}
                              onClick={() => setFocusedElement(id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "5px 6px",
                                borderRadius: "var(--io-radius)",
                                cursor: "pointer",
                                background: isFocused
                                  ? "color-mix(in srgb, var(--io-accent) 10%, transparent)"
                                  : "transparent",
                                border: `1px solid ${isFocused ? "var(--io-accent)" : "transparent"}`,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleElementToggle(id);
                                }}
                                style={{
                                  accentColor: "var(--io-accent)",
                                  flexShrink: 0,
                                  width: 14,
                                  height: 14,
                                }}
                              />
                              <div
                                style={{
                                  width: 14,
                                  height: 10,
                                  borderRadius: 2,
                                  background:
                                    DE_CHIP[id]?.color ?? "var(--io-border)",
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "var(--io-text-primary)",
                                }}
                              >
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {/* Right — config panel */}
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          paddingLeft: 14,
                          overflowY: "auto",
                        }}
                      >
                        {focusedElement ? (
                          selectedElements.has(focusedElement) ? (
                            <DEConfigPanel
                              elementType={focusedElement}
                              config={elementConfigs[focusedElement] ?? {}}
                              onChange={(updates) =>
                                setElementConfigs((prev) => ({
                                  ...prev,
                                  [focusedElement]: {
                                    ...(prev[focusedElement] ?? {}),
                                    ...updates,
                                  },
                                }))
                              }
                              slot={
                                elementSlots[focusedElement] ??
                                DE_FALLBACK_SLOT[
                                  DE_SIDECAR_KEY[focusedElement]!
                                ] ??
                                "bottom"
                              }
                              availableSlots={
                                (
                                  sidecar?.anchorSlots as
                                    | Record<string, string[]>
                                    | undefined
                                )?.[DE_SIDECAR_KEY[focusedElement]!] ??
                                DE_FALLBACK_SLOTS_LIST[
                                  DE_SIDECAR_KEY[focusedElement]!
                                ] ?? ["bottom"]
                              }
                              onSlotChange={(slot) =>
                                setElementSlots((prev) => ({
                                  ...prev,
                                  [focusedElement]: slot,
                                }))
                              }
                              bodyBinding={bodyBinding}
                            />
                          ) : (
                            <div
                              style={{
                                color: "var(--io-text-muted)",
                                fontSize: 12,
                                textAlign: "center",
                                padding: "40px 16px",
                              }}
                            >
                              Enable this element to configure it.
                            </div>
                          )
                        ) : (
                          <div
                            style={{
                              color: "var(--io-text-muted)",
                              fontSize: 12,
                              textAlign: "center",
                              padding: "40px 16px",
                            }}
                          >
                            Select an element on the left to configure it.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
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
          {step > 0 && (
            <button style={btnStyle()} onClick={() => setStep((s) => s - 1)}>
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button style={btnStyle()} onClick={onCancel}>
            Cancel
          </button>
          <button style={btnStyle(true)} onClick={handlePlace}>
            {editMode ? "Save" : "Place ↗"}
          </button>
          {!isLastStep && (
            <button style={btnStyle()} onClick={() => setStep((s) => s + 1)}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
